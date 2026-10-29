import { user, pay, toast, notify, f, refreshUser, supabase, notifySubscribers } from './supabase-db'
import { cstate, PERIOD, colorResult, colorResultCache, computeLowestBetResult, colorMult, hs, KSEED } from './fair'

// ---------------------------------------------------------------
// Canonical colour result resolution.
// 
// ARCHITECTURE:
//  - `color_results` table stores the settled result (period_id -> winning_number).
//  - First client to detect a closed period fetches all bets, computes result,
//    upserts into color_results (DB-level conflict = only one write succeeds).
//  - ALL clients then read the result from color_results to settle user bets.
//  - This prevents race conditions when 100 concurrent players are all computing
//    the result simultaneously with different in-memory cached data.
//
// color_results table schema (create once in Supabase SQL editor):
//   CREATE TABLE IF NOT EXISTS color_results (
//     period_id BIGINT PRIMARY KEY,
//     winning_number INT NOT NULL,
//     total_bets DECIMAL(15,2) DEFAULT 0,
//     total_payout DECIMAL(15,2) DEFAULT 0,
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );
//   ALTER TABLE color_results ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Anyone can read color results" ON color_results FOR SELECT USING (true);
//   CREATE POLICY "Anyone can insert color results" ON color_results FOR INSERT WITH CHECK (true);
// ---------------------------------------------------------------

// In-flight resolution promises — prevents the same period from being resolved multiple times
const resolvingPeriods = new Set()

// Fetch and cache result for a period. If not yet in color_results, computes and stores it.
async function resolveColorPeriod(pid, cfgEdge) {
  // Already resolving this period in this tab
  if (resolvingPeriods.has(pid)) return colorResultCache[pid]
  // Already cached
  if (colorResultCache[pid] !== undefined) return colorResultCache[pid]

  resolvingPeriods.add(pid)
  try {
    // 1. Try reading from canonical color_results table (fastest path)
    const { data: existingResult } = await supabase
      .from('color_results')
      .select('winning_number')
      .eq('period_id', pid)
      .maybeSingle()

    if (existingResult && existingResult.winning_number !== null && existingResult.winning_number !== undefined) {
      const n = Number(existingResult.winning_number)
      colorResultCache[pid] = n
      resolvingPeriods.delete(pid)
      return n
    }

    // 2. No canonical result yet — fetch all bets for this period and compute
    const { data: allBets, error: betErr } = await supabase
      .from('color_bets')
      .select('bet_type, bet_value, amount')
      .eq('period_id', pid)

    if (betErr) {
      console.error('resolveColorPeriod: fetch bets error:', betErr)
      // Fallback to hash-based result (deterministic, but may not reflect bets)
      const fallback = Math.floor(hs(pid, KSEED) * 10)
      colorResultCache[pid] = fallback
      resolvingPeriods.delete(pid)
      return fallback
    }

    const n = computeLowestBetResult(pid, allBets || [], cfgEdge)
    colorResultCache[pid] = n

    // 3. Compute totals for record-keeping
    const edgeFactor = (100 - (cfgEdge ?? 5)) / 95
    let totalBets = 0, totalPayout = 0
    for (const b of (allBets || [])) {
      const amt = Number(b.amount || 0)
      totalBets += amt
      totalPayout += amt * (colorMult({ type: b.bet_type, val: b.bet_value }, n) || 0)
    }

    // 4. Upsert with conflict on period_id — only first writer wins, others silently skip
    await supabase.from('color_results').upsert(
      { period_id: pid, winning_number: n, total_bets: totalBets, total_payout: totalPayout },
      { onConflict: 'period_id', ignoreDuplicates: true }
    )

    // 5. Mark all unsettled bets for this period as settled in DB (background)
    if (allBets && allBets.length > 0) {
      const { data: unsettled } = await supabase
        .from('color_bets')
        .select('id, amount, bet_type, bet_value')
        .eq('period_id', pid)
        .eq('settled', false)

      if (unsettled && unsettled.length > 0) {
        const updates = unsettled.map(row => ({
          id: row.id,
          settled: true,
          win_amount: Number(row.amount) * (colorMult({ type: row.bet_type, val: row.bet_value }, n) || 0)
        }))
        // Batch update in chunks of 50 to avoid payload limits
        for (let i = 0; i < updates.length; i += 50) {
          const chunk = updates.slice(i, i + 50)
          for (const upd of chunk) {
            await supabase.from('color_bets')
              .update({ settled: true, win_amount: upd.win_amount })
              .eq('id', upd.id)
          }
        }
      }
    }

    resolvingPeriods.delete(pid)
    return n
  } catch (err) {
    console.error('resolveColorPeriod error for period', pid, err)
    resolvingPeriods.delete(pid)
    // Emergency fallback — deterministic hash
    const fallback = colorResultCache[pid] ?? Math.floor(hs(pid, KSEED) * 10)
    colorResultCache[pid] = fallback
    return fallback
  }
}

// Runs every 200ms while the app is open. Settles Crash and Colour bets even when
// the player is on another page.
export async function tick() {
  const u = user()
  const now = Date.now()

  // ---- Colour Trading settlement ----
  if (u && !u.is_admin) {
    const cb = u.cbets || []
    // Bets for periods that have fully closed (period end + 2s grace)
    const done = cb.filter((b) => now >= (b.id + 1) * PERIOD + 2000)
    if (done.length) {
      u.cbets = cb.filter((b) => now < (b.id + 1) * PERIOD + 2000)

      const periodIds = [...new Set(done.map(b => b.id))]
      for (const pid of periodIds) {
        // CRITICAL: always fetch canonical result from Supabase before settling
        const cfgEdge = (() => {
          try { return user()?.cfg?.edge?.color ?? 5 } catch { return 5 }
        })()
        const n = await resolveColorPeriod(pid, cfgEdge)

        if (n === undefined || n === null) {
          console.warn('tick: could not resolve period', pid, '— skipping settlement')
          continue
        }

        const userBets = done.filter(b => b.id === pid)
        let totalBet = 0
        let totalWin = 0
        for (const b of userBets) {
          const w = b.amt * (colorMult(b, n) || 0)
          totalBet += b.amt
          totalWin += w
          pay('color', b.amt, w)
        }

        const net = totalWin - totalBet
        const isWin = net > 0
        notify({
          type: isWin ? 'win' : 'loss',
          title: 'Colour Trading - Period #' + pid,
          message: isWin ? '+₹' + f(net) : '-₹' + f(-net),
          details: 'Result: ' + n + ' · Bet: ₹' + f(totalBet) + ' · Return: ₹' + f(totalWin),
          center: true
        })
      }
    }
  }

  // ---- Pre-fetch result for the period that just closed (if not yet in cache) ----
  // This runs in background to warm the cache ~2s after period ends,
  // so that when user settlement fires it finds the result already cached.
  const currentPeriod = Math.floor(now / PERIOD)
  const prevPeriod = currentPeriod - 1
  const prevPeriodAge = now - (currentPeriod * PERIOD) // ms since new period started
  if (
    colorResultCache[prevPeriod] === undefined &&
    !resolvingPeriods.has(prevPeriod) &&
    prevPeriodAge >= 1500 // Wait 1.5s after period ends so all bets have landed in DB
  ) {
    // Trigger resolution in background — don't await (non-blocking)
    resolveColorPeriod(prevPeriod, 5).catch(err => console.error('background resolve error:', err))
  }

  if (!u || u.is_admin) return

  // ---- Crash settlement ----
  const s = cstate(), P = u.cbet
  if (P && !P.out && (P.i < s.i || (P.i === s.i && s.st === 'crash'))) {
    P.out = 1
    await pay('crash', P.a, 0)
    notify({
      type: 'loss',
      title: 'Crash - Crashed',
      message: 'Lost ₹' + f(P.a),
      details: 'Crashed at ' + f(s.m) + '×'
    })
  }
}
