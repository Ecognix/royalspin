import { db } from './supabase-db'

// Public seed generation for crash and fallback for color
export const rnd = () => {
  const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296
}
export const E = (g) => (100 - (db().cfg?.edge?.[g] ?? 1)) / 100

export function hs(i, seed) {
  let a = 0x9e3779b9 ^ i
  for (let k = 0; k < seed.length; k++) { a = Math.imul(a ^ seed.charCodeAt(k), 2654435761); a ^= a >>> 15 }
  a = Math.imul(a ^ (a >>> 13), 0x85ebca6b); a ^= a >>> 16
  a = Math.imul(a, 0xc2b2ae35); a ^= a >>> 13
  return (a >>> 0) / 4294967296
}

// ---------------- Crash ----------------
const CSEED = 'RS-PUBLIC-SEED-1'
export const BETW = 7000, PAUSE = 3500, BLK = 600000, G = 0.35
export const cpOf = (i) => Math.min(100, Math.max(1, Math.floor((100 - (db().cfg?.edge?.crash ?? 1)) / (1 - hs(i, CSEED))) / 100))
const cache = {}
export function sched(b) {
  const edgeVal = db().cfg?.edge?.crash ?? 1
  const key = b + ':' + edgeVal
  if (cache[key]) return cache[key]
  let t = b * BLK, k = 0
  const r = []
  for (;;) {
    const id = b * 1000 + k, cp = cpOf(id), fl = Math.log(cp) / G * 1000
    if (t + BETW + fl + PAUSE > (b + 1) * BLK) break
    r.push({ id, s: t, cp, fl }); t += BETW + fl + PAUSE; k++
  }
  return (cache[key] = r)
}
export function cstate() {
  const n = Date.now(), b = Math.floor(n / BLK), R = sched(b)
  let j = 0
  while (j + 1 < R.length && n >= R[j + 1].s) j++
  const r = R[j], el = n - r.s
  const ns = j + 1 < R.length ? R[j + 1].s : (b + 1) * BLK
  const ni = j + 1 < R.length ? R[j + 1].id : (b + 1) * 1000
  if (el < BETW) return { i: r.id, ni, st: 'bet', m: 1, t: 0, left: Math.ceil((BETW - el) / 1000), p: el / BETW }
  const fe = el - BETW
  if (fe < r.fl) { const e = fe / 1000; return { i: r.id, ni, st: 'fly', m: Math.exp(G * e), t: e } }
  const ps = r.s + BETW + r.fl
  return { i: r.id, ni, st: 'crash', m: r.cp, t: r.fl / 1000, nx: Math.max(1, Math.ceil((ns - n) / 1000)), np: Math.min(1, (n - ps) / Math.max(1, ns - ps)) }
}

// ---------------- Colour trading ----------------
export const KSEED = 'RS-COLOR-SEED-1'
export const PERIOD = 30000, LOCK = 5000

// In-memory cache for settled period results
export const colorResultCache = {}

// Calculates the winning number 0-9 based on LOWEST TOTAL PAYOUT for the house.
// For each possible winning number, we compute how much the house would pay out in total.
// The number that costs the house the LEAST wins (house always wins on the pool imbalance).
// Uses actual multipliers (matching colorMult) so fractional payouts (1.47x at 0/5) are correct.
export function computeLowestBetResult(periodId, periodBets, edge) {
  if (!periodBets || periodBets.length === 0) {
    // No bets this period — use deterministic hash (no money at stake)
    return Math.floor(hs(periodId, KSEED) * 10)
  }

  // Edge factor: same formula as colorMult uses
  const edgeFactor = (100 - (edge ?? 5)) / 95

  // Compute total house payout if each number n were to land
  const payouts = Array(10).fill(0)
  for (let n = 0; n <= 9; n++) {
    for (const b of periodBets) {
      const amt = Number(b.amount || b.amt || 0)
      if (!amt) continue
      const type = String(b.bet_type || b.type || '').toLowerCase()
      const val = String(b.bet_value !== undefined ? b.bet_value : (b.val !== undefined ? b.val : '')).toLowerCase()

      let mult = 0
      if (type === 'num') {
        mult = parseInt(val, 10) === n ? 8.8 * edgeFactor : 0
      } else if (type === 'size') {
        mult = (val === 'big') === (n >= 5) ? 1.96 * edgeFactor : 0
      } else if (val === 'violet') {
        mult = (n === 0 || n === 5) ? 4.4 * edgeFactor : 0
      } else if (val === 'green') {
        // 0,5 are violet-overlap; green pays 1.96x on pure green (1,3,7,9), 1.47x on green+violet (5)
        if ([1, 3, 7, 9].includes(n)) mult = 1.96 * edgeFactor
        else if (n === 5) mult = 1.47 * edgeFactor
        else mult = 0
      } else if (val === 'red') {
        // red pays 1.96x on pure red (2,4,6,8), 1.47x on red+violet (0)
        if ([2, 4, 6, 8].includes(n)) mult = 1.96 * edgeFactor
        else if (n === 0) mult = 1.47 * edgeFactor
        else mult = 0
      }

      payouts[n] += amt * mult
    }
  }

  // Find number(s) with minimum house payout
  const minPayout = Math.min(...payouts)
  const candidates = []
  for (let n = 0; n <= 9; n++) {
    if (payouts[n] <= minPayout + 0.001) { // tiny epsilon for float safety
      candidates.push(n)
    }
  }

  // Tie-breaker: deterministic hash so same result on all clients for same period
  const hashVal = hs(periodId, KSEED)
  const chosenIndex = Math.floor(hashVal * candidates.length) % candidates.length
  return candidates[chosenIndex]
}

export const colorResult = (id) => {
  if (colorResultCache[id] !== undefined) return colorResultCache[id]
  return Math.floor(hs(id, KSEED) * 10)
}

export const ballClass = (n) => (n === 0 ? 'rv' : n === 5 ? 'gv' : n % 2 ? 'green' : 'red')

// bet = { type: 'color'|'num'|'size', val }; returns the multiplier (0 on a loss)
export function colorMult(bet, n) {
  let m = 0
  const type = bet.type || bet.bet_type
  const val = String(bet.val !== undefined ? bet.val : bet.bet_value).toLowerCase()
  if (type === 'num') m = parseInt(val, 10) === n ? 8.8 : 0
  else if (type === 'size') m = (val === 'big') === (n >= 5) ? 1.96 : 0
  else if (val === 'violet') m = n === 0 || n === 5 ? 4.4 : 0
  else if (val === 'green') m = [1, 3, 7, 9].includes(n) ? 1.96 : n === 5 ? 1.47 : 0
  else if (val === 'red') m = [2, 4, 6, 8].includes(n) ? 1.96 : n === 0 ? 1.47 : 0
  const edge = db().cfg?.edge?.color ?? 5
  return m * (100 - edge) / 95
}
