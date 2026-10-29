'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@supabase/supabase-js'



// Supabase client

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fixzutnmiumvvnaruuhk.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_eXW0WPAtFCHqAOxzxdT3sg_R7AV6sb5'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)



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



export const notifySubscribers = () => {

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
  try {
    // 1. Try reading saved config from requests table
    const { data: reqConfig } = await supabase
      .from('requests')
      .select('admin_notes')
      .eq('type', 'config')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (reqConfig && reqConfig.length > 0 && reqConfig[0].admin_notes) {
      try {
        const parsed = JSON.parse(reqConfig[0].admin_notes)
        if (parsed && typeof parsed === 'object') {
          return { ...defCfg(), ...parsed }
        }
      } catch (e) {}
    }

    // 2. Fallback to game_config table
    const { data, error } = await supabase
      .from('game_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (data && !error) {
      return {
        edge: data.edge || defCfg().edge,
        on: data.enabled || defCfg().on,
        min: data.min_bet ?? defCfg().min,
        max: data.max_bet ?? defCfg().max,
        upi: data.upi_id || defCfg().upi,
        welcome: data.welcome_bonus ?? defCfg().welcome,
        dep: data.min_deposit ?? defCfg().dep,
        wr: data.wager_requirement ?? defCfg().wr
      }
    }
  } catch (err) {
    console.error('fetchConfig error:', err)
  }
  return defCfg()
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
        if (localCache.user && localCache.user.phone === phone) {
          if (localCache.user.cbets) fresh.cbets = localCache.user.cbets
          if (localCache.user.cbet) fresh.cbet = localCache.user.cbet
          if (localCache.user.tx) fresh.tx = localCache.user.tx
          // Stale balance check removed so admin approvals update immediately
        }
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
  setTimeout(notifySubscribers, 0);

  // Background persist to Supabase
  const persistBet = async () => {
    try {
      const updateData = {
        balance: newBalance,
        total_wagered: u.total_wagered,
        total_bets: u.total_bets,
        bonus_needed: u.bonus_needed,
        updated_at: new Date().toISOString()
      }
      if (u.id) {
        await supabase.from('users').update(updateData).eq('id', u.id)
      } else {
        await supabase.from('users').update(updateData).eq('phone', phone)
      }

      if (u.id) {
        await supabase.from('transactions').insert({
          user_id: u.id,
          type: 'bet',
          amount: -amount,
          balance_after: newBalance,
          details: { game }
        })
      }
    } catch (err) {
      console.error('place background sync error:', err)
    }
  }; persistBet();

  return amount
}

// Settle a bet — credits winnings, persists to Supabase

// Cancel Crash bet — immediately refunds balance & notifies subscribers
export function cancelCrashBet(amount) {
  const phone = getMe()
  if (!phone) return 0
  const u = localCache.user
  if (!u) return 0

  amount = +amount || 0
  if (amount <= 0) return 0

  const newBalance = u.balance + amount
  u.balance = newBalance
  u.total_wagered = Math.max(0, (u.total_wagered || 0) - amount)
  u.total_bets = Math.max(0, (u.total_bets || 0) - 1)
  delete u.cbet
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('rs-user', JSON.stringify(u))
  }
  notifySubscribers();

  const persistCancel = async () => {
    try {
      const updateData = {
        balance: newBalance,
        total_wagered: u.total_wagered,
        total_bets: u.total_bets,
        updated_at: new Date().toISOString()
      }
      if (u.id) {
        await supabase.from('users').update(updateData).eq('id', u.id)
        await supabase.from('transactions').insert({
          user_id: u.id,
          type: 'refund',
          amount: amount,
          balance_after: newBalance,
          details: { game: 'crash', reason: 'Bet cancelled' }
        })
      } else {
        await supabase.from('users').update(updateData).eq('phone', phone)
      }
    } catch (err) {
      console.error('cancelCrashBet error:', err)
    }
  }; persistCancel();

  return amount
}

export async function pay(game, amount, winAmount, who = getMe(), extraDetails = {}) {
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
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('rs-user', JSON.stringify(u))
  }
  notifySubscribers()

  // Persist in background — userId may be null, fall back to phone match
  const userId = u.id || null
  try {
    const updateData = {
      balance: newBalance,
      pnl: u.pnl,
      total_wins: u.total_wins,
      updated_at: new Date().toISOString()
    }
    if (userId) {
      await supabase.from('users').update(updateData).eq('id', userId)
    } else {
      await supabase.from('users').update(updateData).eq('phone', who)
    }

    // Insert bet record (always)
    const betRow = { game, amount, win_amount: winAmount, details: { pnl: pnlChange, ...extraDetails } }
    if (userId) betRow.user_id = userId
    const { error: betErr } = await supabase.from('bets').insert(betRow)
    if (betErr) console.error('bets insert error:', JSON.stringify(betErr))

    // Insert transaction record (always)
    const txRow = { type: isWin ? 'win' : 'loss', amount: winAmount - amount, balance_after: newBalance, details: { game, bet_amount: amount, ...extraDetails } }
    if (userId) txRow.user_id = userId
    const { error: txErr } = await supabase.from('transactions').insert(txRow)
    if (txErr) console.error('transactions insert error:', JSON.stringify(txErr))
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


// Change password for logged in user
export async function changePassword(oldPassword, newPassword) {
  const phone = getMe()
  if (!phone) return { error: 'Please login first' }
  if (!oldPassword) return { error: 'Enter your current password' }
  if (!newPassword || newPassword.length < 6) return { error: 'New password must be at least 6 characters' }

  const u = localCache.user || await fetchUser(phone)
  if (!u) return { error: 'User not found' }

  const valid = await verifyPassword(oldPassword, u.password_hash)
  if (!valid) return { error: 'Current password is incorrect' }

  const newHash = await hashPassword(newPassword)
  const updateData = { password_hash: newHash, updated_at: new Date().toISOString() }

  const { error } = u.id
    ? await supabase.from('users').update(updateData).eq('id', u.id)
    : await supabase.from('users').update(updateData).eq('phone', phone)

  if (error) return { error: 'Failed to update password' }

  u.password_hash = newHash
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('rs-user', JSON.stringify(u))
  }
  return { success: true }
}

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

  // For withdrawals: deduct balance immediately
  if (isWithdraw) {
    const newBal = u.balance - amount
    u.balance = newBal
    localCache.user = u
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('rs-user', JSON.stringify(u))
    }
    notifySubscribers()
    // Persist deduction
    const updateQuery = u.id 
      ? supabase.from('users').update({ balance: newBal, updated_at: new Date().toISOString() }).eq('id', u.id)
      : supabase.from('users').update({ balance: newBal, updated_at: new Date().toISOString() }).eq('phone', phone)
    const { error: deductErr } = await updateQuery
    if (deductErr) {
      console.error('Withdrawal deduct error:', deductErr)
      u.balance += amount
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('rs-user', JSON.stringify(u))
      }
      notifySubscribers()
      return { error: 'Could not process withdrawal' }
    }
    if (u.id) {
      await supabase.from('transactions').insert({
        user_id: u.id,
        type: 'withdraw_hold',
        amount: -amount,
        balance_after: newBal,
        details: { upi: upiOrUtr }
      })
    }
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
  try {
    // 1. Try updating game_config (id=1)
    await supabase
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

    // 2. Persist to requests table (type: 'config')
    const { data: existing } = await supabase
      .from('requests')
      .select('id')
      .eq('type', 'config')
      .limit(1)

    const notes = JSON.stringify(config)
    if (existing && existing.length > 0) {
      await supabase
        .from('requests')
        .update({ admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id)
    } else {
      const { data: admin } = await supabase.from('users').select('id').eq('is_admin', true).limit(1)
      if (admin && admin.length > 0) {
        await supabase.from('requests').insert({
          user_id: admin[0].id,
          type: 'config',
          amount: 0,
          status: 'active',
          admin_notes: notes
        })
      }
    }

    localCache.config = config
    notifySubscribers()
    return true
  } catch (err) {
    console.error('updateConfig error:', err)
    return false
  }
}
