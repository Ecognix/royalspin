-- Run in the Supabase SQL Editor after deploying the matching client code.
-- WIN GO period IDs encode the UTC period start (Unix seconds * 10) and the
-- interval suffix: 1 = 30 seconds, 2 = 1 minute, 3 = 3 minutes.

CREATE OR REPLACE FUNCTION public.color_period_seconds(p_period_id BIGINT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_code INT;
BEGIN
  IF p_period_id IS NULL OR p_period_id < 0 THEN
    RAISE EXCEPTION 'Invalid color period';
  END IF;

  IF p_period_id < 10000000000 THEN
    RETURN 30;
  END IF;

  v_code := (p_period_id % 10)::INT;
  CASE v_code
    WHEN 1 THEN RETURN 30;
    WHEN 2 THEN RETURN 60;
    WHEN 3 THEN RETURN 180;
    ELSE RAISE EXCEPTION 'Invalid WIN GO period interval';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_color_period(p_period_id BIGINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result INT;
  v_edge NUMERIC;
  v_total_bets NUMERIC;
  v_total_payout NUMERIC;
  v_period_seconds INT;
  v_period_start_seconds BIGINT;
BEGIN
  IF p_period_id IS NULL OR p_period_id < 0 THEN
    RAISE EXCEPTION 'Invalid color period';
  END IF;

  PERFORM pg_advisory_xact_lock(p_period_id);

  SELECT winning_number
    INTO v_result
    FROM public.color_results
    WHERE period_id = p_period_id;
  IF FOUND THEN
    RETURN v_result;
  END IF;

  v_period_seconds := public.color_period_seconds(p_period_id);
  IF p_period_id >= 10000000000 THEN
    v_period_start_seconds := FLOOR(p_period_id::NUMERIC / 10)::BIGINT;
  ELSE
    v_period_start_seconds := p_period_id * 30;
  END IF;

  IF clock_timestamp() < to_timestamp(v_period_start_seconds + v_period_seconds) + INTERVAL '2 seconds' THEN
    RAISE EXCEPTION 'WIN GO period is not closed yet';
  END IF;

  SELECT COALESCE(
    (
      SELECT NULLIF(r.admin_notes::jsonb -> 'edge' ->> 'color', '')::NUMERIC
      FROM public.requests AS r
      WHERE r.type = 'config'
      ORDER BY r.updated_at DESC
      LIMIT 1
    ),
    (
      SELECT NULLIF(gc.edge ->> 'color', '')::NUMERIC
      FROM public.game_config AS gc
      WHERE gc.id = 1
    ),
    5
  )
  INTO v_edge;
  v_edge := LEAST(99, GREATEST(0, v_edge));

  SELECT outcome.number
    INTO v_result
    FROM generate_series(0, 9) AS outcome(number)
    ORDER BY COALESCE((
      SELECT SUM(ROUND(
        cb.amount * public.color_payout_multiplier(
          cb.bet_type, cb.bet_value, outcome.number, v_edge
        ),
        2
      ))
      FROM public.color_bets AS cb
      WHERE cb.period_id = p_period_id
    ), 0), random()
    LIMIT 1;

  SELECT COALESCE(SUM(cb.amount), 0),
         COALESCE(SUM(ROUND(
           cb.amount * public.color_payout_multiplier(
             cb.bet_type, cb.bet_value, v_result, v_edge
           ),
           2
         )), 0)
    INTO v_total_bets, v_total_payout
    FROM public.color_bets AS cb
    WHERE cb.period_id = p_period_id;

  INSERT INTO public.color_results (
    period_id, winning_number, total_bets, total_payout
  )
  VALUES (p_period_id, v_result, v_total_bets, v_total_payout)
  ON CONFLICT (period_id) DO NOTHING;

  SELECT winning_number
    INTO v_result
    FROM public.color_results
    WHERE period_id = p_period_id;

  UPDATE public.color_bets AS cb
    SET settled = TRUE,
        win_amount = ROUND(
          cb.amount * public.color_payout_multiplier(
            cb.bet_type, cb.bet_value, v_result, v_edge
          ),
          2
        )
    WHERE cb.period_id = p_period_id
      AND cb.settled = FALSE;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.color_period_seconds(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_color_period(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_color_period(BIGINT) TO anon, authenticated;
