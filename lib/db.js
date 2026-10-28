'use client'
import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// DATA LAYER. Everything lives in localStorage so the demo runs with no backend.
// SUPABASE: replace db()/commit()/auth calls with supabase-js queries when ready.
// ---------------------------------------------------------------------------
export const SUPA = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
}
const KEY = 'rs-next-v1'

const defCfg = () => ({
  edge: { dice: 1, limbo: 1, mines: 1, keno: 10, flip: 2, crash: 1, color: 5 },
  on: { dice: 1, limbo: 1, mines: 1, keno: 1, flip: 1, crash: 1, color: 1 },
  min: 1, max: 100000, upi: '8812862976@ybl', welcome: 100, dep: 50, wr: 3,
})

export const newUser = (pw, name) => ({
  pw, name, bal: 0, vault: 0, bonus: 0, bneed: 0, wager: 0, wins: 0, n: 0, pnl: 0,
  tx: [], cbets: [], cbet: null, joined: Date.now(), wel: 0, ban: 0, hide: false,
})

let D = null
const subs = new Set()

export function db() {
  if (!D) {
    try { D = JSON.parse(localStorage.getItem(KEY)) } catch {}
    D = D || { users: {}, bets: [], reqs: [], cfg: defCfg() }
    // Migration: ensure config has latest defaults
    const def = defCfg()
    D.cfg = { ...def, ...D.cfg, edge: { ...def.edge, ...D.cfg.edge }, on: { ...def.on, ...D.cfg.on } }
    if (!D.users.admin) D.users.admin = { ...newUser('admin123', 'Admin'), admin: 1 }
  }
  return D
}
export function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(D)) } catch {}
  subs.forEach((f) => f())
}
export function useDB() {
  const [, set] = useState(0)
  useEffect(() => {
    const fn = () => set((x) => x + 1)
    subs.add(fn)
    return () => { subs.delete(fn) }
  }, [])
  return db()
}

// session (player and admin sessions are separate keys)
export const getMe = () => (typeof window === 'undefined' ? null : sessionStorage.getItem('rs-me'))
export const setMe = (v) => (v ? sessionStorage.setItem('rs-me', v) : sessionStorage.removeItem('rs-me'))
export const user = () => db().users[getMe()]

export const f = (n) => (+n).toFixed(2)
export const toast = (t) => window.dispatchEvent(new CustomEvent('rs-toast', { detail: t }))
export const addtx = (u, t, a) => { u.tx.unshift([t, a, Date.now()]); u.tx = u.tx.slice(0, 30) }

// take a stake from the wallet; returns the amount or 0 when refused
export function place(g, a) {
  const u = user(), c = db().cfg
  if (!c.on[g]) { toast('Game disabled'); return 0 }
  a = +a
  if (!(a >= c.min && a <= c.max)) { toast(`Bet must be ${c.min} to ${c.max}`); return 0 }
  if (a > u.bal) { toast('Low balance. Deposit first.'); return 0 }
  u.bal -= a; u.wager += a; u.n++; u.bneed = Math.max(0, u.bneed - a)
  commit()
  return a
}
// settle a bet: w is the total returned (0 on a loss)
export function pay(g, a, w, who = getMe()) {
  const u = db().users[who]
  if (!u) return
  u.bal += w; u.pnl += w - a
  if (w > a) u.wins++
  const d = db()
  d.bets.unshift({ u: who, g, a, w, t: Date.now() })
  d.bets = d.bets.slice(0, 300)
  commit()
}
