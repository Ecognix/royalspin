import { db } from './supabase-db'

// Public seed generation for crash
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

// Movement starts slow and accelerates smoothly into high multipliers
export function crashTime(cp) {
  return ((-0.06 + Math.sqrt(0.0036 + 0.12 * Math.max(0, cp - 1))) / 0.06) * 1000
}

export function crashMult(e) {
  return Math.max(1, 1 + 0.06 * e + 0.03 * e * e)
}

// In every group of 10 rounds, 5 randomly chosen (deterministic per round id) crash below 2x
function isLowCrash(i) {
  const pos = i % 10, base = i - pos
  const rank = Array.from({ length: 10 }, (_, p) => p).sort((a, b) => hs(base + a, 'RS-LOW-PICK') - hs(base + b, 'RS-LOW-PICK'))
  return rank.indexOf(pos) < 5
}

export const cpOf = (i) => {
  if (isLowCrash(i)) return Math.floor((1 + hs(i, 'RS-LOW-VAL') * 0.99) * 100) / 100
  return Math.min(300, Math.max(1, Math.floor((100 - (db().cfg?.edge?.crash ?? 1)) / (1 - hs(i, CSEED))) / 100))
}
const cache = {}
export function sched(b) {
  const edgeVal = db().cfg?.edge?.crash ?? 1
  const key = b + ':' + edgeVal
  if (cache[key]) return cache[key]
  let t = b * BLK, k = 0
  const r = []
  for (;;) {
    const id = b * 1000 + k, cp = cpOf(id), fl = Math.max(300, crashTime(cp))
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
  if (fe < r.fl) { const e = fe / 1000; return { i: r.id, ni, st: 'fly', m: crashMult(e), t: e } }
  const ps = r.s + BETW + r.fl
  return { i: r.id, ni, st: 'crash', m: r.cp, t: r.fl / 1000, nx: Math.max(1, Math.ceil((ns - n) / 1000)), np: Math.min(1, (n - ps) / Math.max(1, ns - ps)) }
}

// ---------------- Colour trading ----------------
export const PERIOD = 30000, LOCK = 5000
export const COLOR_PERIODS = [
  { key: 'wgo_30', seconds: 30, code: 1, label: '30 sec', title: 'WIN GO 30 sec' },
  { key: 'wgo_60', seconds: 60, code: 2, label: '1 min', title: 'WIN GO 1 min' },
  { key: 'wgo_180', seconds: 180, code: 3, label: '3 min', title: 'WIN GO 3 min' }
]

const ENCODED_COLOR_PERIOD_MIN = 10_000_000_000

export function colorPeriodInfo(nowMs = Date.now(), periodKey = 'wgo_30') {
  const config = COLOR_PERIODS.find(period => period.key === periodKey)
  if (!config) throw new Error('Unknown WIN GO period')
  const nowSeconds = Math.floor(nowMs / 1000)
  const startSeconds = Math.floor(nowSeconds / config.seconds) * config.seconds
  const endMs = (startSeconds + config.seconds) * 1000
  return {
    id: startSeconds * 10 + config.code,
    key: config.key,
    seconds: config.seconds,
    label: config.label,
    title: config.title,
    periodNumber: Math.floor(startSeconds / config.seconds),
    startSeconds,
    endMs,
    left: Math.max(0, Math.ceil((endMs - nowMs) / 1000)),
    locked: endMs - nowMs <= LOCK
  }
}

export function colorPeriodId(nowMs = Date.now(), periodKey = 'wgo_30') {
  return colorPeriodInfo(nowMs, periodKey).id
}

export function colorPeriodDetails(id) {
  const periodId = Number(id)
  if (!Number.isSafeInteger(periodId) || periodId < 0) return null

  if (periodId >= ENCODED_COLOR_PERIOD_MIN) {
    const config = COLOR_PERIODS.find(period => period.code === periodId % 10)
    if (!config) return null
    const startSeconds = Math.floor(periodId / 10)
    return {
      id: periodId,
      key: config.key,
      seconds: config.seconds,
      label: config.label,
      title: config.title,
      periodNumber: Math.floor(startSeconds / config.seconds),
      startSeconds,
      endSeconds: startSeconds + config.seconds
    }
  }

  const seconds = 30
  return {
    id: periodId,
    key: 'wgo_30',
    seconds,
    label: '30 sec',
    title: 'WIN GO 30 sec',
    periodNumber: periodId,
    startSeconds: periodId * seconds,
    endSeconds: (periodId + 1) * seconds
  }
}

export function colorPeriodEndMs(id) {
  const period = colorPeriodDetails(id)
  return period ? period.endSeconds * 1000 : 0
}

// In-memory cache for settled period results
export const colorResultCache = {}

function baseColorMult(type, value, n) {
  const val = String(value ?? '').toLowerCase()
  if (type === 'num') return parseInt(val, 10) === n ? 8.8 : 0
  if (type === 'size') return (val === 'big') === (n >= 5) ? 1.96 : 0
  if (val === 'violet') return n === 0 || n === 5 ? 4.4 : 0
  if (val === 'green') return [1, 3, 7, 9].includes(n) ? 1.96 : n === 5 ? 1.47 : 0
  if (val === 'red') return [2, 4, 6, 8].includes(n) ? 1.96 : n === 0 ? 1.47 : 0
  return 0
}

// Returns the settled winning number for a past period.
// Returns null if not yet loaded from DB (prevents flicker with wrong hash-based fallback).
export const colorResult = (id) => {
  if (colorResultCache[id] !== undefined) return colorResultCache[id]
  return null  // null = "loading", caller should show a placeholder
}

export const ballClass = (n) => (n === 0 ? 'rv' : n === 5 ? 'gv' : n % 2 ? 'green' : 'red')

// bet = { type: 'color'|'num'|'size', val }; returns the multiplier (0 on a loss)
export function colorMult(bet, n) {
  const type = bet.type || bet.bet_type
  const val = bet.val !== undefined ? bet.val : bet.bet_value
  const edge = db().cfg?.edge?.color ?? 5
  return baseColorMult(type, val, n) * (100 - edge) / 95
}
