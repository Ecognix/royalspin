import { user, pay, toast, notify, f, refreshUser, supabase } from './supabase-db'
import { cstate, PERIOD, colorResult, colorResultCache, computeLowestBetResult, colorMult } from './fair'

// Runs every 200ms while the app is open. Settles Crash and Colour bets even when
// the player is on another page.
export async function tick() {
  const u = user()
  if (!u || u.is_admin) return

  // Crash settlement
  const s = cstate(), P = u.cbet
  if (P && !P.out && (P.i < s.i || (P.i === s.i && s.st === 'crash'))) {
    P.out = 1
    pay('crash', P.a, 0)
    notify({ 
      type: 'loss', 
      title: 'Crash - Crashed', 
      message: 'Lost ₹' + f(P.a), 
      details: 'Crashed at ' + f(s.m) + '×' 
    })
  }

  // Colour Trading settlement
  const now = Date.now(), cb = u.cbets || []
  const done = cb.filter((b) => now >= (b.id + 1) * PERIOD)
  if (done.length) {
    u.cbets = cb.filter((b) => now < (b.id + 1) * PERIOD)

    // Settle each finished period
    const periodIds = [...new Set(done.map(b => b.id))]
    for (const pid of periodIds) {
      let n = colorResultCache[pid]
      if (n === undefined) {
        try {
          // Fetch all bets across all players for this period
          const { data: allPeriodBets } = await supabase
            .from('color_bets')
            .select('*')
            .eq('period_id', pid)

          n = computeLowestBetResult(pid, allPeriodBets || [])
          colorResultCache[pid] = n

          // Mark settled in color_bets
          if (allPeriodBets && allPeriodBets.length) {
            for (const row of allPeriodBets) {
              if (!row.settled) {
                const win = row.amount * colorMult({ type: row.bet_type, val: row.bet_value }, n)
                await supabase
                  .from('color_bets')
                  .update({ settled: true, win_amount: win })
                  .eq('id', row.id)
              }
            }
          }
        } catch (err) {
          console.error('Error settling period bets:', err)
          n = computeLowestBetResult(pid, [])
          colorResultCache[pid] = n
        }
      }

      // Settle this user bets for this period
      const userBets = done.filter(b => b.id === pid)
      let totalBet = 0
      let totalWin = 0
      for (const b of userBets) {
        const w = b.amt * colorMult(b, n)
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

    refreshUser()
  }
}
