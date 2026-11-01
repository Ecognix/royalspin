import { user, pay, notify, toast, f, supabase, notifySubscribers } from './supabase-db'
import { cstate, PERIOD, colorResultCache, colorMult } from './fair'

const resolvingPeriods = new Map()
const settlingUserPeriods = new Set()
const failedResolutionRetryAt = new Map()
const notifiedSettlementFailures = new Set()

function validWinningNumber(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 9 ? number : null
}

// Only cache results returned by the canonical database record/RPC.
export function resolveColorPeriod(pid) {
  if (colorResultCache[pid] !== undefined) return Promise.resolve(colorResultCache[pid])
  if (resolvingPeriods.has(pid)) return resolvingPeriods.get(pid)
  if ((failedResolutionRetryAt.get(pid) || 0) > Date.now()) return Promise.resolve(null)

  const resolution = (async () => {
    try {
      const { data: existing, error: readError } = await supabase
        .from('color_results')
        .select('winning_number')
        .eq('period_id', pid)
        .maybeSingle()
      if (readError) throw readError

      let winningNumber = validWinningNumber(existing?.winning_number)
      if (winningNumber === null) {
        const { data, error } = await supabase.rpc('resolve_color_period', {
          p_period_id: pid
        })
        if (error) throw error
        winningNumber = validWinningNumber(data)
        if (winningNumber === null) throw new Error('RPC returned an invalid winning number')
      }

      const { data: canonical, error: canonicalError } = await supabase
        .from('color_results')
        .select('winning_number')
        .eq('period_id', pid)
        .maybeSingle()
      if (canonicalError) throw canonicalError

      const canonicalNumber = validWinningNumber(canonical?.winning_number)
      if (canonicalNumber === null) throw new Error('No canonical color result was persisted')

      failedResolutionRetryAt.delete(pid)
      colorResultCache[pid] = canonicalNumber
      return canonicalNumber
    } catch (error) {
      failedResolutionRetryAt.set(pid, Date.now() + 5000)
      console.error('Could not resolve canonical color result for period', pid, error)
      return null
    }
  })()

  resolvingPeriods.set(pid, resolution)
  resolution.finally(() => resolvingPeriods.delete(pid))
  return resolution
}

// Runs every 200ms while the app is open. Settles Crash and Colour bets even when
// the player is on another page.
export async function tick() {
  const u = user()
  const now = Date.now()

  // ---- Colour Trading settlement ----
  if (u && !u.is_admin) {
    const done = (u.cbets || []).filter((b) => now >= (b.id + 1) * PERIOD + 2000)
    const periodIds = [...new Set(done.map(b => b.id))]

    for (const pid of periodIds) {
      if (settlingUserPeriods.has(pid)) continue
      settlingUserPeriods.add(pid)
      try {
        const winningNumber = await resolveColorPeriod(pid)
        if (winningNumber === null) {
          if (!notifiedSettlementFailures.has(pid)) {
            notifiedSettlementFailures.add(pid)
            toast('Color settlement is paused because the server result is unavailable. Your bet remains pending; contact support.')
          }
          continue
        }
        notifiedSettlementFailures.delete(pid)

        const currentUser = user()
        const userBets = (currentUser?.cbets || []).filter(b => b.id === pid)
        if (!userBets.length) continue

        let totalBet = 0
        let totalWin = 0
        for (const bet of userBets) {
          const win = Number((Number(bet.amt) * colorMult(bet, winningNumber)).toFixed(2))
          totalBet += Number(bet.amt)
          totalWin += win
          await pay('color', bet.amt, win)
        }

        const latestUser = user()
        if (latestUser) {
          latestUser.cbets = (latestUser.cbets || []).filter(b => b.id !== pid)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('rs-user', JSON.stringify(latestUser))
          }
          notifySubscribers()
        }

        const net = totalWin - totalBet
        const isWin = net > 0
        notify({
          type: isWin ? 'win' : 'loss',
          title: 'Colour Trading - Period #' + pid,
          message: isWin ? '+₹' + f(net) : '-₹' + f(-net),
          details: 'Result: ' + winningNumber + ' · Bet: ₹' + f(totalBet) + ' · Return: ₹' + f(totalWin),
          center: true
        })
      } finally {
        settlingUserPeriods.delete(pid)
      }
    }
  }

  // Warm the canonical result shortly after a period closes.
  const currentPeriod = Math.floor(now / PERIOD)
  const prevPeriod = currentPeriod - 1
  const prevPeriodAge = now - (currentPeriod * PERIOD)
  if (
    colorResultCache[prevPeriod] === undefined &&
    !resolvingPeriods.has(prevPeriod) &&
    prevPeriodAge >= 2000
  ) {
    resolveColorPeriod(prevPeriod)
  }

  if (!u || u.is_admin) return

  // ---- Crash settlement ----
  const state = cstate(), crashBet = u.cbet
  if (crashBet && !crashBet.out && (crashBet.i < state.i || (crashBet.i === state.i && state.st === 'crash'))) {
    crashBet.out = 1
    await pay('crash', crashBet.a, 0)
    notify({
      type: 'loss',
      title: 'Crash - Crashed',
      message: 'Lost ₹' + f(crashBet.a),
      details: 'Crashed at ' + f(state.m) + '×'
    })
  }
}
