'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@supabase/supabase-js'
import { ADMIN_PHONES } from './auth-constants'

export { ADMIN_PHONES }



// Supabase client

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fixzutnmiumvvnaruuhk.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_eXW0WPAtFCHqAOxzxdT3sg_R7AV6sb5'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)



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

async function requestServerSession(phone, password, role = 'player') {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, role })
    })
    let result
    try {
      result = await response.json()
    } catch {
      result = {}
    }
    if (!response.ok) return { error: result.error || 'Sign-in service is temporarily unavailable.' }
    return result
  } catch (error) {
    console.error('Sign-in session request error:', error)
    return { error: 'Could not connect to the sign-in service.' }
  }
}


const defCfg = () => ({

  edge: { dice: 1, limbo: 1, mines: 1, keno: 10, flip: 2, crash: 1, color: 5 },

  on: { dice: 1, limbo: 1, mines: 1, keno: 1, flip: 1, crash: 1, color: 1 },

  min: 1, max: 100000, upi: '8812862976@ybl', welcome: 0, dep: 50, wr: 2,

})

export const DEPOSIT_APPROVAL_BONUS_PERCENT = 50
export const DEPOSIT_WAGER_MULTIPLIER = 2
export const MIN_WITHDRAWAL_AMOUNT = 1000
export const REFERRAL_REWARD_PERCENT = 5
export const WITHDRAWAL_FEE_PERCENT = 5

export function calculateWithdrawalFee(amount) {
  const amountCents = Math.round(Number(amount) * 100)
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0
  return Math.round(amountCents * WITHDRAWAL_FEE_PERCENT / 100) / 100
}



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

let wagerPersistenceQueue = Promise.resolve()
let walletMutationVersion = 0
let walletPersistedVersion = 0



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
          return { ...defCfg(), ...parsed, welcome: 0, wr: DEPOSIT_WAGER_MULTIPLIER }
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
        welcome: 0,
        dep: data.min_deposit ?? defCfg().dep,
        wr: DEPOSIT_WAGER_MULTIPLIER
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
      await wagerPersistenceQueue
      const versionAtFetch = walletMutationVersion
      const fresh = await fetchUser(phone)
      if (fresh) {
        if (localCache.user && localCache.user.phone === phone) {
          if (walletMutationVersion !== versionAtFetch || walletPersistedVersion < versionAtFetch) {
            for (const field of ['balance', 'pnl', 'total_wins', 'total_wagered', 'total_bets', 'bonus_needed']) {
              fresh[field] = localCache.user[field]
            }
          }
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
  const amountCents = Math.round(amount * 100)
  amount = amountCents / 100
  if (amountCents > Math.round(Number(u.balance || 0) * 100)) {
    toast('Low balance. Deposit first.')
    return 0
  }

  const previousWageredCents = Math.max(0, Math.round(Number(u.total_wagered || 0) * 100))
  const newBalance = Number((Number(u.balance || 0) - amount).toFixed(2))
  u.balance = newBalance
  u.total_wagered = Number(((previousWageredCents + amountCents) / 100).toFixed(2))
  u.total_bets = Number(u.total_bets || 0) + 1
  u.bonus_needed = Math.max(0, Number(u.bonus_needed || 0) - amount)
  const mutationVersion = ++walletMutationVersion
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('rs-user', JSON.stringify(u))
  }
  setTimeout(notifySubscribers, 0);

  const totalWagered = u.total_wagered
  const totalBets = u.total_bets
  const bonusNeeded = u.bonus_needed
  // Background persist to Supabase
  const persistBet = async () => {
    const updateData = {
      balance: newBalance,
      total_wagered: totalWagered,
      total_bets: totalBets,
      bonus_needed: bonusNeeded,
      updated_at: new Date().toISOString()
    }
    let updateQuery = supabase.from('users').update(updateData)
    if (u.id) {
      updateQuery = updateQuery.eq('id', u.id)
    } else {
      updateQuery = updateQuery.eq('phone', phone)
    }
    const { error: updateError } = await updateQuery
    if (updateError) throw updateError
    walletPersistedVersion = Math.max(walletPersistedVersion, mutationVersion)

    if (u.id) {
      const transactions = [{
        user_id: u.id,
        type: 'bet',
        amount: -amount,
        balance_after: newBalance,
        details: { game }
      }]
      const { error: transactionError } = await supabase.from('transactions').insert(transactions)
      if (transactionError) console.error('bet transaction insert error:', transactionError)
    }
  }
  wagerPersistenceQueue = wagerPersistenceQueue.then(persistBet).catch(err => {
    console.error('place background sync error:', err)
    toast('Bet balance update failed. Please refresh and check your balance.')
  })

  return amount
}

// Settle a bet — credits winnings, persists to Supabase

// Cancel Crash bet — immediately refunds balance & notifies subscribers
export function cancelCrashBet(amount, game = 'crash') {
  const phone = getMe()
  if (!phone) return 0
  const u = localCache.user
  if (!u) return 0

  amount = +amount || 0
  if (amount <= 0) return 0

  const amountCents = Math.round(amount * 100)
  amount = amountCents / 100
  const currentWageredCents = Math.max(0, Math.round(Number(u.total_wagered || 0) * 100))
  const newBalance = Number((Number(u.balance || 0) + amount).toFixed(2))
  u.balance = newBalance
  u.total_wagered = Number((Math.max(0, currentWageredCents - amountCents) / 100).toFixed(2))
  u.total_bets = Math.max(0, Number(u.total_bets || 0) - 1)
  u.bonus_needed = Number(u.bonus_needed || 0) + amount
  const mutationVersion = ++walletMutationVersion
  delete u.cbet
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('rs-user', JSON.stringify(u))
  }
  notifySubscribers();

  const totalWagered = u.total_wagered
  const totalBets = u.total_bets
  const bonusNeeded = u.bonus_needed

  const persistCancel = async () => {
    const updateData = {
      balance: newBalance,
      total_wagered: totalWagered,
      total_bets: totalBets,
      bonus_needed: bonusNeeded,
      updated_at: new Date().toISOString()
    }
    let updateQuery = supabase.from('users').update(updateData)
    if (u.id) updateQuery = updateQuery.eq('id', u.id)
    else updateQuery = updateQuery.eq('phone', phone)

    const { error: updateError } = await updateQuery
    if (updateError) throw updateError
    walletPersistedVersion = Math.max(walletPersistedVersion, mutationVersion)

    if (u.id) {
      const transactions = [{
        user_id: u.id,
        type: 'refund',
        amount,
        balance_after: newBalance,
        details: { game, reason: 'Bet cancelled' }
      }]
      const { error: transactionError } = await supabase.from('transactions').insert(transactions)
      if (transactionError) console.error('Crash cancellation transaction insert error:', transactionError)
    }
  }
  wagerPersistenceQueue = wagerPersistenceQueue.then(persistCancel).catch(err => {
    console.error('cancelCrashBet error:', err)
    toast('Crash cancellation could not sync. Please refresh and check your balance.')
  })

  return amount + feeRefund
}

export async function pay(game, amount, winAmount, who = getMe(), extraDetails = {}) {
  if (!who) return
  const u = localCache.user
  if (!u || u.phone !== who) return

  amount = +amount
  winAmount = +winAmount
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(winAmount) || winAmount < 0) {
    console.error('pay received an invalid amount:', { game, amount, winAmount })
    toast('Bet settlement failed. Please contact support.')
    return
  }
  const newBalance = Number((Number(u.balance || 0) + winAmount).toFixed(2))
  const pnlChange = winAmount - amount
  const isWin = winAmount > amount

  // Optimistic update
  u.balance = newBalance
  u.pnl = Number(u.pnl || 0) + pnlChange
  if (isWin) u.total_wins = Number(u.total_wins || 0) + 1
  const mutationVersion = ++walletMutationVersion
  u.bets = u.bets || []
  u.bets.unshift({ g: game, a: amount, w: winAmount, t: Date.now() })
  u.bets = u.bets.slice(0, 30)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('rs-user', JSON.stringify(u))
  }
  notifySubscribers()

  // Persist in order with wager debits so stale writes cannot restore a lost stake.
  const userId = u.id || null
  const pnl = u.pnl
  const totalWins = u.total_wins
  const persistPay = async () => {
    const updateData = {
      balance: newBalance,
      pnl,
      total_wins: totalWins,
      updated_at: new Date().toISOString()
    }
    let updateQuery = supabase.from('users').update(updateData)
    if (userId) {
      updateQuery = updateQuery.eq('id', userId)
    } else {
      updateQuery = updateQuery.eq('phone', who)
    }
    const { error: updateError } = await updateQuery
    if (updateError) throw updateError
    walletPersistedVersion = Math.max(walletPersistedVersion, mutationVersion)

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
  }
  wagerPersistenceQueue = wagerPersistenceQueue.then(persistPay).catch(err => {
    console.error('pay error:', err)
    toast('Bet result could not sync. Please refresh and check your balance.')
  })
  await wagerPersistenceQueue
}


// Signup

export async function signup(phone, password, username, referralId) {

  if (!/^\d{10}$/.test(phone)) return { error: 'Enter a 10 digit number' }

  if (password.length < 6) return { error: 'Password min 6 characters' }

  if (username && username.length < 3) return { error: 'Username min 3 characters' }

  if (isAdminPhone(phone)) return { error: 'Cannot register as admin' }

  let referredBy = null
  if (referralId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referralId)) {
      return { error: 'Invalid referral link' }
    }

    const { data: referrerIdResult, error: referrerError } = await supabase
      .rpc('get_referrer_id', { referral_code: referralId })

    if (referrerError) return { error: 'Could not verify referral link' }
    if (!referrerIdResult) return { error: 'Referral account not found' }
    referredBy = referrerIdResult
  }

  

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

  const newUser = {
    phone,
    username: username || null,
    password_hash: passwordHash,
    name: 'Player ' + phone.slice(-4),
    balance: 0,
  }
  if (referredBy) newUser.referred_by = referredBy

  

  const { data, error } = await supabase

    .from('users')

    .insert(newUser)

    .select()

    .single()

  

  if (error) return { error: 'Registration failed: ' + error.message }

  const session = await requestServerSession(phone, password)
  if (session.error) return { error: `Account created, but secure sign-in failed: ${session.error}` }

  localCache.user = session.user
  localCache.initialized = true

  return { success: true, user: session.user }

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

  const session = await requestServerSession(phone, password)
  if (session.error) return { error: session.error }

  localCache.user = session.user
  localCache.initialized = true

  return { success: true, user: session.user }

}



// Admin login

export async function adminLogin(phone, password) {

  if (!isAdminPhone(phone)) return { error: 'Invalid admin credentials' }

  const session = await requestServerSession(phone, password, 'admin')
  if (session.error) return { error: session.error }

  return { success: true, user: session.user }

}



// Create deposit or withdrawal request

export async function createRequest(type, amount, upiOrUtr = null) {

  const phone = getMe()

  if (!phone) return { error: 'Please login first' }

  const u = await fetchUser(phone)
  if (!u) return { error: 'User not found' }

  const isWithdraw = String(type).toLowerCase() === 'withdraw'
  amount = Number(amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter a valid amount' }
  }
  amount = Number((Math.round(amount * 100) / 100).toFixed(2))
  if (amount <= 0) return { error: 'Enter a valid amount' }
  if (isWithdraw && amount < MIN_WITHDRAWAL_AMOUNT) {
    return { error: 'Minimum withdrawal is ₹' + f(MIN_WITHDRAWAL_AMOUNT) }
  }
  if (isWithdraw && Number(u.bonus_needed || 0) > 0) {
    return { error: 'Wager ₹' + f(u.bonus_needed) + ' more before withdrawing' }
  }
  if (isWithdraw && amount > u.balance) {
    return { error: 'Insufficient balance' }
  }
  const withdrawalFee = isWithdraw ? calculateWithdrawalFee(amount) : 0
  const payoutAmount = isWithdraw ? Number((amount - withdrawalFee).toFixed(2)) : 0

  // For withdrawals: deduct balance immediately
  const originalBalance = Number(u.balance || 0)
  if (isWithdraw) {
    const expectedBalance = u.balance
    const newBal = originalBalance - amount
    u.balance = newBal
    localCache.user = u
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('rs-user', JSON.stringify(u))
    }
    notifySubscribers()
    // Persist deduction
    let updateQuery = supabase
      .from('users')
      .update({ balance: newBal, updated_at: new Date().toISOString() })
    updateQuery = u.id ? updateQuery.eq('id', u.id) : updateQuery.eq('phone', phone)
    if (expectedBalance == null) {
      updateQuery = updateQuery.is('balance', null)
    } else {
      updateQuery = updateQuery.eq('balance', expectedBalance)
    }
    const { data: deductedUser, error: deductErr } = await updateQuery.select('id').maybeSingle()
    if (deductErr || !deductedUser) {
      console.error('Withdrawal deduct error:', deductErr)
      u.balance = originalBalance
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('rs-user', JSON.stringify(u))
      }
      notifySubscribers()
      return { error: deductErr ? 'Could not process withdrawal' : 'Balance changed; refresh and try again' }
    }
    if (u.id) {
      await supabase.from('transactions').insert({
        user_id: u.id,
        type: 'withdraw_hold',
        amount: -amount,
        balance_after: newBal,
        details: {
          upi: upiOrUtr,
          withdrawal_fee: withdrawalFee,
          payout_amount: payoutAmount
        }
      })
    }
  }

  const requestId = crypto.randomUUID()
  const requestData = {
    id: requestId,
    user_id: u.id,
    type: isWithdraw ? 'withdraw' : 'deposit',
    amount,
    upi_id: upiOrUtr,
    status: 'pending'
  }
  if (isWithdraw) {
    requestData.withdrawal_fee = withdrawalFee
    requestData.payout_amount = payoutAmount
  }
  const { data, error } = await supabase

    .from('requests')

    .insert(requestData)

    .select()

    .single()

  

  if (error) {
    const { data: savedRequest, error: lookupError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle()
    if (savedRequest) return { success: true, request: savedRequest }
    if (lookupError) {
      console.error('Request creation confirmation error:', lookupError)
      return { error: isWithdraw ? 'Could not confirm withdrawal status; funds may be held. Contact support.' : 'Could not confirm deposit request status' }
    }

    // Rollback withdrawal deduction on request creation failure
    if (isWithdraw && localCache.user) {
      let restoredUser = null
      let rollbackError = null
      for (let attempt = 0; attempt < 3 && !restoredUser; attempt++) {
        const latestUser = await fetchUser(phone)
        if (!latestUser) break
        let rollbackQuery = supabase
          .from('users')
          .update({ balance: Number(latestUser.balance || 0) + amount, updated_at: new Date().toISOString() })
        rollbackQuery = latestUser.id ? rollbackQuery.eq('id', latestUser.id) : rollbackQuery.eq('phone', phone)
        rollbackQuery = latestUser.balance == null
          ? rollbackQuery.is('balance', null)
          : rollbackQuery.eq('balance', latestUser.balance)
        const rollbackResult = await rollbackQuery.select('*').maybeSingle()
        rollbackError = rollbackResult.error
        if (rollbackError) break
        restoredUser = rollbackResult.data
      }
      if (!restoredUser) {
        console.error('Withdrawal rollback error:', rollbackError)
        return { error: 'Withdrawal request failed and balance restoration needs admin attention' }
      }
      localCache.user.balance = Number(restoredUser.balance || 0)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('rs-user', JSON.stringify(localCache.user))
      }
      notifySubscribers()
      if (u.id) {
        const { error: refundLogError } = await supabase.from('transactions').insert({
          user_id: u.id,
          type: 'withdraw_hold_refunded',
          amount,
          balance_after: Number(restoredUser.balance || 0),
          details: { reason: 'Withdrawal request creation failed' }
        })
        if (refundLogError) console.error('Withdrawal refund log error:', refundLogError)
      }
    }
    return {
      error: isWithdraw && ['42703', 'PGRST204'].includes(error?.code)
        ? 'Withdrawal fees are not set up in the database. Apply withdrawal_platform_fee_migration.sql.'
        : 'Failed to create request'
    }
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
    const { data: gameConfigRow, error: gameConfigError } = await supabase
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
      .select('id')
      .maybeSingle()
    if (gameConfigError) console.error('game_config update error:', gameConfigError)

    // 2. Persist to requests table (type: 'config')
    const { data: existing, error: existingError } = await supabase
      .from('requests')
      .select('id')
      .eq('type', 'config')
      .limit(1)

    const notes = JSON.stringify(config)
    let requestConfigSaved = false
    const requestConfigExists = Boolean(existing?.length)
    if (existingError) {
      console.error('Config request lookup error:', existingError)
    } else if (requestConfigExists) {
      const { data, error } = await supabase
        .from('requests')
        .update({ admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id)
        .select('id')
        .maybeSingle()
      if (error) console.error('Config request update error:', error)
      requestConfigSaved = Boolean(data)
    } else {
      const { data: admin, error: adminError } = await supabase.from('users').select('id').eq('is_admin', true).limit(1)
      if (adminError) console.error('Config admin lookup error:', adminError)
      if (admin && admin.length > 0) {
        const { data, error } = await supabase.from('requests').insert({
          user_id: admin[0].id,
          type: 'config',
          amount: 0,
          status: 'active',
          admin_notes: notes
        }).select('id').maybeSingle()
        if (error) console.error('Config request insert error:', error)
        requestConfigSaved = Boolean(data)
      }
    }

    const gameConfigSaved = Boolean(gameConfigRow)
    const announcementsRequireRequestConfig = Object.prototype.hasOwnProperty.call(config, 'announcements')
    if ((requestConfigExists && !requestConfigSaved) ||
      (announcementsRequireRequestConfig && !requestConfigSaved) ||
      (!requestConfigSaved && !gameConfigSaved)) {
      return false
    }

    localCache.config = config
    notifySubscribers()
    return true
  } catch (err) {
    console.error('updateConfig error:', err)
    return false
  }
}
