import { user, pay, toast, notify, f, commit } from './db'
import { cstate, PERIOD, colorResult, colorMult } from './fair'

// Runs every 200ms while the app is open. Settles Crash and Colour bets even when
// the player is on another page.
export function tick() {
  const u = user()
  if (!u || u.admin) return
  const s = cstate(), P = u.cbet
  if (P && !P.out && (P.i < s.i || (P.i === s.i && s.st === 'crash'))) {
    P.out = 1; pay('crash', P.a, 0)
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
    commit()
    // Group by period and aggregate
    const byPeriod = {}
    done.forEach((b) => {
      const n = colorResult(b.id), w = b.amt * colorMult(b, n)
      pay('color', b.amt, w)
      if (!byPeriod[b.id]) byPeriod[b.id] = { totalBet: 0, totalWin: 0, result: n, bets: [] }
      byPeriod[b.id].totalBet += b.amt
      byPeriod[b.id].totalWin += w
      byPeriod[b.id].bets.push({ type: b.type, val: b.val, amt: b.amt, win: w })
    })
    // Send one notification per period with net result
    Object.entries(byPeriod).forEach(([periodId, data]) => {
      const net = data.totalWin - data.totalBet
      const isWin = net > 0
      const betDetails = data.bets.map(b => {
        const name = b.type === 'num' ? `Number ${b.val}` : b.type === 'size' ? (b.val === 'big' ? 'Big (5-9)' : 'Small (0-4)') : b.val[0].toUpperCase() + b.val.slice(1)
        return `${name} ₹${f(b.amt)} → ${b.win > b.amt ? '+' : ''}₹${f(b.win - b.amt)}`
      }).join('; ')
      notify({ 
        type: isWin ? 'win' : 'loss', 
        title: `Colour Trading - Period #${periodId}`, 
        message: isWin ? `Net Profit ₹${f(net)}` : `Net Loss ₹${f(-net)}`, 
        details: `Result: ${data.result} · Total Bet: ₹${f(data.totalBet)} · Total Return: ₹${f(data.totalWin)} · ${betDetails}`,
        center: true  // Flag to show at center
      })
    })
  }
}
