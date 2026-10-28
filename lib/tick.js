import { user, pay, toast, notify, f, refreshUser, supabase } from './supabase-db'
import { cstate, PERIOD, colorResult, colorMult } from './fair'

// Runs every 200ms while the app is open. Settles Crash and Colour bets even when
// the player is on another page.
export async function tick() {
  const u = user()
  if (!u || u.is_admin) return
  const s = cstate(), P = u.cbet
  if (P && !P.out && (P.i < s.i || (P.i === s.i && s.st === 'crash'))) {
    P.out = 1; 
    await pay('crash', P.a, 0)
    notify({ 
      type: 'loss', 
      title: `Crash - Crashed`, 
      message: `Lost ₹${f(P.a)}`, 
      details: `Crashed at ${f(s.m)}×` 
    })
  }
  const now = Date.now(), cb = u.cbets || []
  const done = cb.filter((b) => now >= (b.id + 1) * PERIOD)
  if (done.length) {
    u.cbets = cb.filter((b) => now < (b.id + 1) * PERIOD)
    // Update user in supabase
    await supabase.from('users').update({ cbets: u.cbets }).eq('phone', u.phone)
    
    // Group by period and aggregate
    const byPeriod = {}
    for (const b of done) {
      const n = colorResult(b.id), w = b.amt * colorMult(b, n)
      await pay('color', b.amt, w)
      if (!byPeriod[b.id]) byPeriod[b.id] = { totalBet: 0, totalWin: 0, result: n }
      byPeriod[b.id].totalBet += b.amt
      byPeriod[b.id].totalWin += w
    }
    // Send one notification per period with net result
    Object.entries(byPeriod).forEach(([periodId, data]) => {
      const net = data.totalWin - data.totalBet
      const isWin = net > 0
      notify({ 
        type: isWin ? 'win' : 'loss', 
        title: `Colour Trading - Period #${periodId}`, 
        message: isWin ? `+₹${f(net)}` : `-₹${f(-net)}`, 
        details: `Result: ${data.result} · Bet: ₹${f(data.totalBet)} · Return: ₹${f(data.totalWin)}`,
        center: true  // Flag to show at top
      })
    })
    await refreshUser()
  }
}
