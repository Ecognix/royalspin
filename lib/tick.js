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
    done.forEach((b) => {
      const n = colorResult(b.id), w = b.amt * colorMult(b, n)
      pay('color', b.amt, w)
      const isWin = w > b.amt
      notify({ 
        type: isWin ? 'win' : 'loss', 
        title: `Colour Trading - Period #${b.id}`, 
        message: isWin ? `Win ₹${f(w)}` : `Lost ₹${f(b.amt)}`, 
        details: `Result: ${n} · ${isWin ? 'Win' : 'Loss'} · Bet: ₹${f(b.amt)}` 
      })
    })
  }
}
