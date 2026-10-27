import { db } from './db'

// Every player sees the same Crash round and the same Colour result because both
// come from a public seed plus the clock. Nobody (including admins) can pick outcomes.
export const rnd = () => {
  const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296
}
export const E = (g) => (100 - db().cfg.edge[g]) / 100

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
export const cpOf = (i) => Math.min(100, Math.max(1, Math.floor((100 - db().cfg.edge.crash) / (1 - hs(i, CSEED))) / 100))
const cache = {}
export function sched(b) {
  const key = b + ':' + db().cfg.edge.crash
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
const KSEED = 'RS-COLOR-SEED-1'
export const PERIOD = 30000, LOCK = 5000
export const colorResult = (id) => Math.floor(hs(id, KSEED) * 10)
export const ballClass = (n) => (n === 0 ? 'rv' : n === 5 ? 'gv' : n % 2 ? 'green' : 'red')
// bet = { type: 'color'|'num'|'size', val }; returns the multiplier (0 on a loss)
export function colorMult(bet, n) {
  let m = 0
  if (bet.type === 'num') m = n === bet.val ? 8.8 : 0
  else if (bet.type === 'size') m = (bet.val === 'big') === (n >= 5) ? 1.96 : 0
  else if (bet.val === 'violet') m = n === 0 || n === 5 ? 4.4 : 0
  else if (bet.val === 'green') m = [1, 3, 7, 9].includes(n) ? 1.96 : n === 5 ? 1.47 : 0
  else if (bet.val === 'red') m = [2, 4, 6, 8].includes(n) ? 1.96 : n === 0 ? 1.47 : 0
  return m * (100 - db().cfg.edge.color) / 95
}
