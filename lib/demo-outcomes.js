'use client'

import { toast, user } from './supabase-db'

const BATCH_SIZE = 10

function randomIndex(length) {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % length
}

function makeBatch() {
  // Keep wins sparse and separated: each ten-bet batch has at most three wins,
  // and no two winning bets are adjacent.
  const wins = 1 + randomIndex(3)
  const layouts = []

  for (let mask = 0; mask < (1 << BATCH_SIZE); mask++) {
    const positions = Array.from({ length: BATCH_SIZE }, (_, index) => index)
      .filter(index => mask & (1 << index))
    if (
      positions.length === wins &&
      positions.every((position, index) => index === 0 || position > positions[index - 1] + 1)
    ) {
      layouts.push(positions)
    }
  }

  const selected = layouts[randomIndex(layouts.length)]
  return Array.from({ length: BATCH_SIZE }, (_, index) => selected.includes(index))
}

function accountKey() {
  const account = user()?.id || user()?.phone
  if (!account) return null

  let hash = 2166136261
  for (let index = 0; index < account.length; index++) {
    hash = Math.imul(hash ^ account.charCodeAt(index), 16777619)
  }
  return (hash >>> 0).toString(36)
}

function validState(state) {
  return state &&
    Array.isArray(state.slots) &&
    state.slots.length === BATCH_SIZE &&
    state.slots.every(value => typeof value === 'boolean') &&
    Number.isInteger(state.cursor) &&
    state.cursor >= 0 &&
    state.cursor <= BATCH_SIZE
}

export function reserveDemoOutcome(game) {
  const account = accountKey()
  if (!account || typeof window === 'undefined') {
    toast('Demo outcome tracking is unavailable. Please sign in again.')
    return null
  }

  const key = `rs-demo-outcomes:${account}:${game}`
  try {
    let state = JSON.parse(localStorage.getItem(key) || 'null')
    if (!validState(state) || state.cursor === BATCH_SIZE) {
      state = { cursor: 0, slots: makeBatch() }
    }

    const cursor = state.cursor
    const won = state.slots[cursor]
    state.cursor++
    localStorage.setItem(key, JSON.stringify(state))
    return { key, cursor, slots: state.slots, won }
  } catch (error) {
    console.error('Could not persist demo game outcome:', error)
    toast('Demo outcome tracking failed; no bet was placed.')
    return null
  }
}

export function rollbackDemoOutcome(reservation) {
  if (!reservation || typeof window === 'undefined') return

  try {
    const state = JSON.parse(localStorage.getItem(reservation.key) || 'null')
    if (
      validState(state) &&
      state.cursor === reservation.cursor + 1 &&
      state.slots.every((value, index) => value === reservation.slots[index])
    ) {
      state.cursor = reservation.cursor
      localStorage.setItem(reservation.key, JSON.stringify(state))
    }
  } catch (error) {
    console.error('Could not roll back unused demo outcome:', error)
    toast('The unused demo outcome could not be restored. Your wallet bet was not placed.')
  }
}
