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



const defCfg = () => ({

  edge: { dice: 1, limbo: 1, mines: 1, keno: 10, flip: 2, crash: 1, color: 5 },

  on: { dice: 1, limbo: 1, mines: 1, keno: 1, flip: 1, crash: 1, color: 1 },

  min: 1, max: 100000, upi: '8812862976@ybl', welcome: 100, dep: 50, wr: 3,

})



// Local cache for real-time updates
const getStoredUser = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('rs-user')
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

let localCache = {
  user: getStoredUser(),
  config: defCfg(),
  subscribers: new Set(),
  loading: false,
  initialized: false
}



const notifySubscribers = () => {

  localCache.subscribers.forEach(fn => fn())

}



// Get current user from session

export const getMe = () => {

  if (typeof window === 'undefined') return null

  return sessionStorage.getItem('rs-me')

}



export const setMe = (v, userData = null) => {
  if (typeof window === 'undefined') return
  if (v) {
    sessionStorage.setItem('rs-me', v)
    if (userData) {
      sessionStorage.setItem('rs-user', JSON.stringify(userData))
      localCache.user = userData
      localCache.initialized = true
    }
  } else {
    sessionStorage.removeItem('rs-me')
    sessionStorage.removeItem('rs-user')
    localCache.user = null
    localCache.initialized = false
  }
  notifySubscribers()
  if (v && !userData) {
    refreshUser()
  }
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



// Main db function - returns cached data synchronously
export function db() {
  const phone = getMe()
  return {
    users: (localCache.user && phone) ? { [phone]: localCache.user } : {},
    bets: [],
    reqs: [],
    cfg: localCache.config || defCfg()
  }
}

// Subscribe to changes
export function useDB() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const fn = () => setTick(x => x + 1)
    localCache.subscribers.add(fn)
    // Trigger load on mount if not already initialized
    if (!localCache.initialized) {
      refreshUser()
    }
    return () => localCache.subscribers.delete(fn)
  }, [])
  return db()
}

// Force refresh from Supabase — always writes fresh data to cache
export const refreshUser = async () => {
  if (localCache.loading) return  // prevent concurrent refreshes
  localCache.loading = true
  const phone = getMe()
  try {
    const cfg = await fetchConfig()
    if (cfg) localCache.config = cfg
    if (phone) {
      const fresh = await fetchUser(phone)
      if (fresh) {
        localCache.user = fresh
        localCache.initialized = true
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('rs-user', JSON.stringify(fresh))
        }
      }
    }
  } catch (e) {
    console.error('refreshUser error:', e)
  } finally {
    localCache.loading = false
    localCache.initialized = true
    notifySubscribers()
  }
}

// Get current user from cache (returns null while loading)
export const user = () => {
  const phone = getMe()
  if (!phone) return null
  return localCache.user
}

// Returns true while initial user load is in progress
export const isLoading = () => {
  const phone = getMe()
  if (!phone) return false
  return !localCache.initialized && localCache.loading
}

// Format number
export const f = (n) => (+n || 0).toFixed(2)

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

// Place a bet — synchronous for UI, persists in background
export function place(game, amount) {
  const phone = getMe()
  if (!phone) { toast('Please login first'); return 0 }

  const cfg = localCache.config || defCfg()
  if (cfg.on && !cfg.on[game]) { toast('Game disabled'); return 0 }

  amount = +amount
  if (!(amount >= (cfg.min || 1) && amount <= (cfg.max || 100000))) {
    toast('Bet must be ' + (cfg.min || 1) + ' to ' + (cfg.max || 100000)); return 0
  }

  const u = localCache.user
  if (!u) { toast('User not found'); return 0 }
  if (amount > u.balance) { toast('Low balance. Deposit first.'); return 0 }

  // Deduct balance synchronously
  const newBalance = u.balance - amount
  u.balance = newBalance
  u.total_wagered = (u.total_wagered || 0) + amount
  u.total_bets = (u.total_bets || 0) + 1
  u.bonus_needed = Math.max(0, (u.bonus_needed || 0) - amount)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('rs-user', JSON.stringify(u))
  }
  notifySubscribers()

  // Background persist to Supabase
  (async () => {
    try {
      await supabase
        .from('users')
        .update({
          balance: newBalance,
          total_wagered: u.total_wagered,
          total_bets: u.total_bets,
          bonus_needed: u.bonus_needed,
          updated_at: new Date().toISOString()
        })
        .eq('id', u.id)

      await supabase.from('transactions').insert({
        user_id: u.id,
        type: 'bet',
        amount: -amount,
        balance_after: newBalance,
        details: { game }
      })
    } catch (err) {
      console.error('place background sync error:', err)
    }
  })()

  return amount
}

// Settle a bet — credits winnings, persists to Supabase
export async function pay(game, amount, winAmount, who = getMe()) {
  if (!who) return
  const u = localCache.user
  if (!u || u.phone !== who) return

  amount = +amount
  winAmount = +winAmount
  const newBalance = u.balance + winAmount
  const pnlChange = winAmount - amount
  const isWin = winAmount > amount

  // Optimistic update
  u.balance = newBalance
  u.pnl = (u.pnl || 0) + pnlChange
  if (isWin) u.total_wins = (u.total_wins || 0) + 1
  u.bets = u.bets || []
  u.bets.unshift({ g: game, a: amount, w: winAmount, t: Date.now() })
  u.bets = u.bets.slice(0, 30)
  notifySubscribers()

  // Persist in background
  try {
    await supabase
      .from('users')
      .update({
        balance: newBalance,
        pnl: u.pnl,
        total_wins: u.total_wins,
        updated_at: new Date().toISOString()
      })
      .eq('phone', who)

    await supabase.from('bets').insert({
      user_id: u.id,
      game,
      amount,
      win_amount: winAmount,
      details: { pnl: pnlChange }
    })

    await supabase.from('transactions').insert({
      user_id: u.id,
      type: isWin ? 'win' : 'loss',
      amount: winAmount - amount,
      balance_after: newBalance,
      details: { game, bet_amount: amount }
    })
  } catch (err) {
    console.error('pay error:', err)
  }
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

  

  const { data, error } = await supabase

    .from('users')

    .insert({

      phone,

      username: username || null,

      password_hash: passwordHash,

      name: 'Player ' + phone.slice(-4),

      balance: 0,

    })

    .select()

    .single()

  

  if (error) return { error: 'Registration failed: ' + error.message }

  

  localCache.user = data
  localCache.initialized = true

  return { success: true, user: data }

}



// Login

export async function login(phone, password) {

  if (!phone || !password) return { error: 'Enter phone and password' }

  

  const { data, error } = await supabase

    .from('users')

    .select('*')

    .eq('phone', phone)

    .maybeSingle()

  

  if (error || !data) return { error: 'Account not found' }

  if (data.is_banned) return { error: 'Account suspended. Contact support.' }

  

  const valid = await verifyPassword(password, data.password_hash)

  if (!valid) return { error: 'Invalid password' }

  

  localCache.user = data
  localCache.initialized = true

  return { success: true, user: data }

}



// Admin login

export async function adminLogin(phone, password) {

  if (!isAdminPhone(phone)) return { error: 'Invalid admin credentials' }

  

  const { data, error } = await supabase

    .from('users')

    .select('*')

    .eq('phone', phone)

    .maybeSingle()

  

  if (error || !data) return { error: 'Admin account not found' }

  if (!data.is_admin) return { error: 'Not an admin account' }

  

  const valid = await verifyPassword(password, data.password_hash)

  if (!valid) return { error: 'Invalid password' }

  

  return { success: true, user: data }

}



// Create deposit or withdrawal request

export async function createRequest(type, amount, upiOrUtr = null) {

  const phone = getMe()

  if (!phone) return { error: 'Please login first' }

  const u = localCache.user || await fetchUser(phone)
  if (!u) return { error: 'User not found' }

  const isWithdraw = String(type).toLowerCase() === 'withdraw'
  if (isWithdraw && amount > u.balance) {
    return { error: 'Insufficient balance' }
  }

  // For withdrawals: deduct balance optimistically
  if (isWithdraw) {
    const newBal = u.balance - amount
    localCache.user.balance = newBal
    notifySubscribers()
    // Persist deduction
    const { error: deductErr } = await supabase
      .from('users')
      .update({ balance: newBal, updated_at: new Date().toISOString() })
      .eq('phone', phone)
    if (deductErr) {
      localCache.user.balance += amount
      notifySubscribers()
      return { error: 'Could not process withdrawal' }
    }
    await supabase.from('transactions').insert({
      user_id: u.id,
      type: 'withdraw_hold',
      amount: -amount,
      balance_after: newBal,
      details: { upi: upiOrUtr }
    })
  }

  const { data, error } = await supabase

    .from('requests')

    .insert({

      user_id: u.id,

      type: isWithdraw ? 'withdraw' : 'deposit',

      amount,

      upi_id: upiOrUtr,

      status: 'pending'

    })

    .select()

    .single()

  

  if (error) {
    // Rollback withdrawal deduction on request creation failure
    if (isWithdraw && localCache.user) {
      localCache.user.balance += amount
      notifySubscribers()
    }
    return { error: 'Failed to create request' }
  }

  return { success: true, request: data }

}



// Get all users (admin)

export async function getAllUsers() {

  const { data, error } = await supabase

    .from('users')

    .select('*')

    .order('created_at', { ascending: false })

  if (error) return []

  return data

}



// Get all bets (admin)

export async function getAllBets() {

  const { data, error } = await supabase

    .from('bets')

    .select('*, users:user_id(phone)')

    .order('created_at', { ascending: false })

    .limit(500)

  if (error) return []

  return data

}



// Get all requests (admin)

export async function getAllRequests() {

  const { data, error } = await supabase

    .from('requests')

    .select('*, users:user_id(phone)')

    .order('created_at', { ascending: false })

  if (error) return []

  return data

}



// Update request status (admin)

export async function updateRequest(id, status) {

  const { error } = await supabase

    .from('requests')

    .update({ status, updated_at: new Date().toISOString() })

    .eq('id', id)

  return !error

}



// Update user (admin)

export async function updateUser(id, updates) {

  const { error } = await supabase

    .from('users')

    .update({ ...updates, updated_at: new Date().toISOString() })

    .eq('id', id)

  return !error

}



// Update game config

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
