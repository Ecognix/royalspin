-- Run in the Supabase SQL Editor. A single server-side random result is persisted
-- per period so all clients settle against the same outcome.

CREATE TABLE IF NOT EXISTS public.color_results (
  period_id BIGINT PRIMARY KEY,
  winning_number INT NOT NULL CHECK (winning_number BETWEEN 0 AND 9),
  total_bets DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_payout DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.color_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read color results" ON public.color_results;
DROP POLICY IF EXISTS "Anyone can insert color results" ON public.color_results;
DROP POLICY IF EXISTS "Anyone can update color results" ON public.color_results;
CREATE POLICY "Anyone can read color results"
  ON public.color_results FOR SELECT USING (true);

GRANT SELECT ON public.color_results TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.color_results FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.color_payout_multiplier(
  p_bet_type TEXT,
  p_bet_value TEXT,
  p_number INT,
  p_edge NUMERIC
)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (
    CASE
      WHEN p_bet_type = 'num' AND p_bet_value ~ '^[0-9]$'
        THEN CASE WHEN p_bet_value::INT = p_number THEN 8.8 ELSE 0 END
      WHEN p_bet_type = 'size'
        THEN CASE
          WHEN (p_bet_value = 'big' AND p_number >= 5)
            OR (p_bet_value = 'small' AND p_number < 5) THEN 1.96
          ELSE 0
        END
      WHEN p_bet_type = 'color' AND p_bet_value = 'violet'
        THEN CASE WHEN p_number IN (0, 5) THEN 4.4 ELSE 0 END
      WHEN p_bet_type = 'color' AND p_bet_value = 'green'
        THEN CASE
          WHEN p_number IN (1, 3, 7, 9) THEN 1.96
          WHEN p_number = 5 THEN 1.47
          ELSE 0
        END
      WHEN p_bet_type = 'color' AND p_bet_value = 'red'
        THEN CASE
          WHEN p_number IN (2, 4, 6, 8) THEN 1.96
          WHEN p_number = 0 THEN 1.47
          ELSE 0
        END
      ELSE 0
    END
  ) * ((100 - COALESCE(p_edge, 5)) / 95);
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

  IF clock_timestamp() < to_timestamp((p_period_id + 1) * 30) + INTERVAL '2 seconds' THEN
    RAISE EXCEPTION 'Color period is not closed yet';
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

  v_result := floor(random() * 10)::INT;

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

REVOKE ALL ON FUNCTION public.color_payout_multiplier(TEXT, TEXT, INT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_color_period(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_color_period(BIGINT) TO anon, authenticated;
