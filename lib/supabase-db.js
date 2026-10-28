'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Supabase client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Admin phone numbers (only these can access admin panel)
export const ADMIN_PHONES = ['9999999999', '8888888888', '7777777777', '6666666666']

// Check if phone is admin
export const isAdminPhone = (phone) => ADMIN_PHONES.includes(phone)

// Password hashing (simple for demo - use bcrypt in production)
const hashPassword = async (password) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'royal-spin-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const hashSha256Plain = async (password) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const verifyPassword = async (password, hash) => {
  if (!password || !hash) return false
  if (password === hash) return true
  const salted = await hashPassword(password)
  if (salted === hash) return true
  const plain = await hashSha256Plain(password)
  if (plain === hash) return true
  return false
}

// Default config
const defCfg = () => ({
  edge: { dice: 1, limbo: 1, mines: 1, keno: 10, flip: 2, crash: 1, color: 5 },
  on: { dice: 1, limbo: 1, mines: 1, keno: 1, flip: 1, crash: 1, color: 1 },
  min: 1, max: 100000, upi: '8812862976@ybl', welcome: 100, dep: 50, wr: 3,
})

// Local cache for real-time updates
let localCache = {
  user: null,
  config: defCfg(),
  subscribers: new Set()
}

const notifySubscribers = () => {
  localCache.subscribers.forEach(fn => fn())
}

// Get current user from session
export const getMe = () => {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('rs-me')
}

export const setMe = (v) => {
  if (typeof window === 'undefined') return
  if (v) sessionStorage.setItem('rs-me', v)
  else sessionStorage.removeItem('rs-me')
  localCache.user = null
  notifySubscribers()
}

// Get user data from Supabase
export const fetchUser = async (phone) => {
  if (!phone) return null
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()
  if (error || !data) return null
  return data
}

// Get game config
export const fetchConfig = async () => {
  const { data, error } = await supabase
    .from('game_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return defCfg()
  return {
    edge: data.edge,
    on: data.enabled,
    min: data.min_bet,
    max: data.max_bet,
    upi: data.upi_id,
    welcome: data.welcome_bonus,
    dep: data.min_deposit,
    wr: data.wager_requirement
  }
}

// Main db function - returns cached data with async refresh
export async function db() {
  const phone = getMe()
  if (phone && !localCache.user) {
    localCache.user = await fetchUser(phone)
    localCache.config = await fetchConfig()
  } else if (phone && localCache.user) {
    // Refresh user data periodically
    const fresh = await fetchUser(phone)
    if (fresh) localCache.user = fresh
  }
  
  return {
    users: localCache.user ? { [phone]: localCache.user } : {},
    bets: [],
    reqs: [],
    cfg: localCache.config
  }
}

// Subscribe to changes
export function useDB() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const fn = () => setTick(x => x + 1)
    localCache.subscribers.add(fn)
    return () => localCache.subscribers.delete(fn)
  }, [])
  return db()
}

// Force refresh
export const refreshUser = async () => {
  const phone = getMe()
  if (phone) {
    localCache.user = await fetchUser(phone)
    localCache.config = await fetchConfig()
    notifySubscribers()
  }
}

// Get current user from cache
export const user = () => {
  const phone = getMe()
  if (!phone) return null
  return localCache.user
}

// Format number
export const f = (n) => (+n).toFixed(2)

// Toast notification
export const toast = (t) => window.dispatchEvent(new CustomEvent('rs-toast', { detail: t }))

// Detailed notification
export const notify = (n) => window.dispatchEvent(new CustomEvent('rs-notify', { detail: n }))

// Add transaction
export const addtx = (u, t, a) => {
  u.tx = u.tx || []
  u.tx.unshift([t, a, Date.now()])
  u.tx = u.tx.slice(0, 30)
}

// Place a bet
export async function place(game, amount) {
  const phone = getMe()
  if (!phone) { toast('Please login first'); return 0 }
  
  const cfg = (await db()).cfg
  if (!cfg.on[game]) { toast('Game disabled'); return 0 }
  
  amount = +amount
  if (!(amount >= cfg.min && amount <= cfg.max)) { 
    toast(`Bet must be ${cfg.min} to ${cfg.max}`); return 0 
  }
  
  const user = await fetchUser(phone)
  if (!user) { toast('User not found'); return 0 }
  if (amount > user.balance) { toast('Low balance. Deposit first.'); return 0 }
  
  // Deduct balance
  const newBalance = user.balance - amount
  const { error } = await supabase
    .from('users')
    .update({ 
      balance: newBalance,
      total_wagered: user.total_wagered + amount,
      total_bets: user.total_bets + 1,
      bonus_needed: Math.max(0, (user.bonus_needed || 0) - amount)
    })
    .eq('phone', phone)
  
  if (error) { toast('Failed to place bet'); return 0 }
  
  // Add transaction record
  await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'bet',
    amount: -amount,
    balance_after: newBalance,
    details: { game }
  })
  
  await refreshUser()
  return amount
}

// Settle a bet
export async function pay(game, amount, winAmount, who = getMe()) {
  if (!who) return
  
  const user = await fetchUser(who)
  if (!user) return
  
  const newBalance = user.balance + winAmount
  const pnlChange = winAmount - amount
  const isWin = winAmount > amount
  
  const { error } = await supabase
    .from('users')
    .update({
      balance: newBalance,
      pnl: user.pnl + pnlChange,
      total_wins: user.total_wins + (isWin ? 1 : 0)
    })
    .eq('phone', who)
  
  if (error) return
  
  // Record bet
  await supabase.from('bets').insert({
    user_id: user.id,
    game,
    amount,
    win_amount: winAmount,
    details: { pnl: pnlChange }
  })
  
  // Add transaction
  await supabase.from('transactions').insert({
    user_id: user.id,
    type: isWin ? 'win' : 'loss',
    amount: winAmount - amount,
    balance_after: newBalance,
    details: { game, bet_amount: amount }
  })
  
  await refreshUser()
}

// Signup
export async function signup(phone, password, username) {
  if (!/^\d{10}$/.test(phone)) return { error: 'Enter a 10 digit number' }
  if (password.length < 6) return { error: 'Password min 6 characters' }
  if (username && username.length < 3) return { error: 'Username min 3 characters' }
  if (isAdminPhone(phone)) return { error: 'Cannot register as admin' }
  
  // Check if phone exists
    const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('phone')
    .eq('phone', phone)
      .maybeSingle()
    if (existingError) return { error: 'Registration failed' }
    if (existing) return { error: 'Number already registered' }
  
    // Check if username exists
    if (username) {
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .maybeSingle()
      if (userError) return { error: 'Registration failed' }
      if (existingUser) return { error: 'Username already taken' }
    }
  
  const passwordHash = await hashPassword(password)
  const name = username || `Player ${phone.slice(-4)}`
  
  const { data, error } = await supabase
    .from('users')
    .insert({
      phone,
      username,
      password_hash: passwordHash,
      name,
      balance: 0,
      vault_balance: 0,
      bonus_balance: 0,
      bonus_needed: 0,
      total_wagered: 0,
      total_wins: 0,
      total_bets: 0,
      pnl: 0,
      is_admin: false,
      is_banned: false,
      hide_balance: false,
      welcome_claimed: false
    })
    .select()
    .single()
  
  if (error) return { error: 'Registration failed' }
  
  return { success: true, user: data }
}

// Login
export async function login(phone, password) {
  if (!/^\d{10}$/.test(phone)) return { error: 'Enter a 10 digit number' }
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()
  
  if (error || !user) return { error: 'Wrong number or password' }
  if (user.is_banned) return { error: 'Account blocked' }
  
  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return { error: 'Wrong number or password' }
  
  return { success: true, user }
}

// Admin login
export async function adminLogin(phone, password) {
  if (!isAdminPhone(phone)) return { error: 'Invalid admin credentials' }
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .eq('is_admin', true)
    .maybeSingle()
  
  if (error || !user) return { error: 'Invalid admin credentials' }
  
  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return { error: 'Invalid admin credentials' }
  
  return { success: true, user }
}

// Get all users (admin only)
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

// Get all bets (admin only)
export async function getAllBets(limit = 500) {
  const { data, error } = await supabase
    .from('bets')
    .select(`
      *,
      users:user_id (phone, username, name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

// Get all requests (admin only)
export async function getAllRequests() {
  const { data, error } = await supabase
    .from('requests')
    .select(`
      *,
      users:user_id (phone, username, name)
    `)
    .order('created_at', { ascending: false })
  return data || []
}

// Update request status (admin only)
export async function updateRequest(requestId, status, adminNotes = '') {
  const { error } = await supabase
    .from('requests')
    .update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() })
    .eq('id', requestId)
  return !error
}

// Update user (admin only)
export async function updateUser(userId, updates) {
  const { error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
  return !error
}

// Update game config (admin only)
export async function updateConfig(config) {
  const { error } = await supabase
    .from('game_config')
    .update({ 
      edge: config.edge,
      enabled: config.on,
      min_bet: config.min,
      max_bet: config.max,
      upi_id: config.upi,
      welcome_bonus: config.welcome,
      min_deposit: config.dep,
      wager_requirement: config.wr,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1)
  if (!error) {
    localCache.config = config
    notifySubscribers()
  }
  return !error
}

// Create deposit/withdrawal request
export async function createRequest(type, amount, upiId = null) {
  const phone = getMe()
  if (!phone) return { error: 'Please login first' }
  
  const user = await fetchUser(phone)
  if (!user) return { error: 'User not found' }
  
  if (type === 'withdraw' && amount > user.balance) {
    return { error: 'Insufficient balance' }
  }
  
  const { data, error } = await supabase
    .from('requests')
    .insert({
      user_id: user.id,
      type,
      amount,
      upi_id: upiId,
      status: 'pending'
    })
    .select()
    .single()
  
  if (error) return { error: 'Failed to create request' }
  return { success: true, request: data }
}