import { user, pay, toast, f, commit } from './db'
import { cstate, PERIOD, colorResult, colorMult } from './fair'

// Runs every 200ms while the app is open. Settles Crash and Colour bets even when
// the player is on another page.
export function tick() {
  const u = user()
  if (!u || u.admin) return
  const s = cstate(), P = u.cbet
  if (P && !P.out && (P.i < s.i || (P.i === s.i && s.st === 'crash'))) {
    P.out = 1; pay('crash', P.a, 0); toast('Crashed. Bet lost')
  }
  const now = Date.now(), cb = u.cbets || []
  const done = cb.filter((b) => now >= (b.id + 1) * PERIOD)
  if (done.length) {
    u.cbets = cb.filter((b) => now < (b.id + 1) * PERIOD)
    commit()
    done.forEach((b) => {
      const n = colorResult(b.id), w = b.amt * colorMult(b, n)
      pay('color', b.amt, w)
      toast(w ? `Colour result ${n}: won ₹${f(w)}` : `Colour result ${n}: lost`)
    })
  }
}
