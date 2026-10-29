'use client'

import { useEffect, useState } from 'react'
import { useDB, adminLogin, toast, f, addtx, supabase, updateConfig } from '../lib/supabase-db'
import { GAMES } from './meta'
import { Notifications } from './App'
import { colorResult, ballClass, cpOf, PERIOD, cstate } from '../lib/fair'

// Admin console (route: /console). Separate login, separate session key,
// not linked from the player app. Default login: admin / admin123 (change it in Security).

// ------------------------------------------------------------------ Color Rounds Admin
function ColorRoundsAdmin() {
  const [colorBets, setColorBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [openPeriods, setOpenPeriods] = useState({})
  const [now, setNow] = useState(Date.now())
  const [colorResults, setColorResults] = useState({})

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])

  const currentPeriod = Math.floor(now / PERIOD)
  const left = Math.ceil(((currentPeriod + 1) * PERIOD - now) / 1000)

  const fetchColorBets = async () => {
    setLoading(true)
    try {
      const [{ data }, { data: resultRows }] = await Promise.all([
        supabase
          .from('color_bets')
          .select('period_id, bet_type, bet_value, amount, win_amount, created_at')
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase
          .from('color_results')
          .select('period_id, winning_number')
          .order('period_id', { ascending: false })
          .limit(500)
      ])
      if (data) setColorBets(data)
      if (resultRows) {
        const map = {}
        resultRows.forEach(r => { map[r.period_id] = Number(r.winning_number) })
        setColorResults(map)
      }
    } catch (e) {
      console.error('fetchColorBets error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchColorBets()
    const iv = setInterval(fetchColorBets, 4000)
    return () => clearInterval(iv)
  }, [])

  // Group bets by period_id
  const periodMap = {}
  colorBets.forEach(b => {
    const pid = b.period_id
    if (!periodMap[pid]) {
      periodMap[pid] = {
        period_id: pid,
        totalBet: 0,
        totalWin: 0,
        betsCount: 0,
        options: {
          green: 0, violet: 0, red: 0,
          big: 0, small: 0,
          nums: { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 }
        }
      }
    }
    const amt = Number(b.amount || 0)
    const win = Number(b.win_amount || 0)
    periodMap[pid].totalBet += amt
    periodMap[pid].totalWin += win
    periodMap[pid].betsCount++

    const val = String(b.bet_value || '').toLowerCase()
    if (val === 'green' || val === 'violet' || val === 'red') {
      periodMap[pid].options[val] = (periodMap[pid].options[val] || 0) + amt
    } else if (val === 'big' || val === 'small') {
      periodMap[pid].options[val] = (periodMap[pid].options[val] || 0) + amt
    } else if (!isNaN(val) && periodMap[pid].options.nums[val] !== undefined) {
      periodMap[pid].options.nums[val] = (periodMap[pid].options.nums[val] || 0) + amt
    }
  })

  // Ensure current and recent periods are in the list even if 0 bets
  for (let i = 0; i < 40; i++) {
    const pid = currentPeriod - i
    if (!periodMap[pid]) {
      periodMap[pid] = {
        period_id: pid,
        totalBet: 0,
        totalWin: 0,
        betsCount: 0,
        options: {
          green: 0, violet: 0, red: 0,
          big: 0, small: 0,
          nums: { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 }
        }
      }
    }
  }

  const allPeriods = Object.values(periodMap).sort((a, b) => b.period_id - a.period_id)
  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(allPeriods.length / PAGE_SIZE))
  const displayed = allPeriods.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const togglePeriod = (pid) => {
    setOpenPeriods(prev => ({ ...prev, [pid]: !prev[pid] }))
  }

  const sizeOf = (n) => (n >= 5 ? 'Big' : 'Small')
  const sizeCol = (n) => (n >= 5 ? '#f59e0b' : '#3b82f6')
  const cname = (n) => (n === 0 ? 'Red+Violet' : n === 5 ? 'Green+Violet' : n % 2 ? 'Green' : 'Red')

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div>
          <b>Color Trading Rounds</b>
          <div className="small" style={{ color: 'var(--mut)' }}>Click any round to view cumulative bet amounts per option</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="live" style={{ background: 'var(--ac)' }} />
          <span style={{ fontSize: 12, color: 'var(--ac)', fontWeight: 700 }}>Period #{currentPeriod} ({left}s)</span>
          <button onClick={fetchColorBets} style={{ padding: '3px 8px', fontSize: 11, background: 'var(--c2)' }}>Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayed.map((p) => {
          const isLive = p.period_id === currentPeriod
          const n = isLive ? null : (colorResults[p.period_id] ?? colorResult(p.period_id))
          const housePnl = p.totalBet - p.totalWin
          const isOpen = !!openPeriods[p.period_id]
          const opt = p.options

          return (
            <div 
              key={p.period_id}
              style={{ 
                background: 'var(--c2)', 
                borderRadius: 10, 
                border: '1px solid ' + (isOpen ? 'var(--ac)' : isLive ? '#2ee67a44' : '#ffffff14'),
                overflow: 'hidden',
                transition: 'border 0.2s'
              }}
            >
              {/* Header Dropdown Summary Row */}
              <div 
                onClick={() => togglePeriod(p.period_id)}
                style={{ 
                  padding: '12px 14px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  cursor: 'pointer',
                  userSelect: 'none',
                  gap: 10,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <b style={{ fontSize: 14 }}>#{p.period_id}</b>
                  {isLive ? (
                    <span style={{ fontSize: 10, background: 'var(--ac)', color: '#000', padding: '2px 7px', borderRadius: 8, fontWeight: 900 }}>
                      LIVE ({left}s)
                    </span>
                  ) : n !== null && n !== undefined ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={'ball sm ' + ballClass(n)}>{n}</span>
                      <span style={{ color: sizeCol(n), fontWeight: 700, fontSize: 12 }}>{sizeOf(n)}</span>
                      <span style={{ fontSize: 11, color: 'var(--mut)' }}>{cname(n)}</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--mut)', fontSize: 12 }}>Pending settlement</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p.totalBet > 0 ? 'var(--ac)' : 'inherit' }}>
                      Pool: ₹{f(p.totalBet)}
                    </div>
                    <div style={{ fontSize: 11, color: isLive ? '#ffd54f' : housePnl >= 0 ? 'var(--ac)' : 'var(--bad)', fontWeight: 600 }}>
                      {isLive ? `${p.betsCount} bets placed` : `House: ${housePnl >= 0 ? '+' : ''}₹${f(housePnl)}`}
                    </div>
                  </div>
                  <span style={{ 
                    fontSize: 12, 
                    color: 'var(--mut)', 
                    display: 'inline-block',
                    transform: isOpen ? 'rotate(180deg)' : 'none', 
                    transition: 'transform 0.2s' 
                  }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Collapsible Dropdown Details */}
              {isOpen && (
                <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.22)' }}>
                  {/* Round Overview Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>Total Bet Pool</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ac)', marginTop: 2 }}>₹{f(p.totalBet)}</div>
                      <div style={{ fontSize: 10, color: 'var(--mut)' }}>{p.betsCount} bets placed</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>Total Payout</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{isLive ? '—' : '₹' + f(p.totalWin)}</div>
                      <div style={{ fontSize: 10, color: 'var(--mut)' }}>{isLive ? 'In progress' : 'Won by players'}</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>House Net PnL</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: housePnl >= 0 ? 'var(--ac)' : 'var(--bad)', marginTop: 2 }}>
                        {isLive ? '—' : (housePnl >= 0 ? '+' : '') + '₹' + f(housePnl)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mut)' }}>{housePnl >= 0 ? 'House Profit' : 'House Loss'}</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>Round Outcome</div>
                      <div style={{ marginTop: 2 }}>
                        {isLive ? (
                          <span style={{ color: '#ffd54f', fontSize: 12, fontWeight: 700 }}>In progress ({left}s)</span>
                        ) : n !== null && n !== undefined ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={'ball sm ' + ballClass(n)}>{n}</span>
                            <span style={{ color: sizeCol(n), fontWeight: 700, fontSize: 12 }}>{sizeOf(n)}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--mut)' }}>Pending</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cumulative Amounts By Option Section */}
                  <b style={{ fontSize: 11, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                    Cumulative Amount Bet Per Option
                  </b>

                  {/* Main Colors & Sizes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: '#2e9e5b15', border: '1px solid #2e9e5b33', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ color: '#2e9e5b', fontWeight: 800, fontSize: 12 }}>Green (1.96×)</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>₹{f(opt.green)}</div>
                    </div>
                    <div style={{ background: '#8e44ad15', border: '1px solid #8e44ad33', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ color: '#b975e6', fontWeight: 800, fontSize: 12 }}>Violet (4.4×)</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>₹{f(opt.violet)}</div>
                    </div>
                    <div style={{ background: '#e5393515', border: '1px solid #e5393533', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ color: '#ff6b6b', fontWeight: 800, fontSize: 12 }}>Red (1.96×)</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>₹{f(opt.red)}</div>
                    </div>
                    <div style={{ background: '#f59e0b15', border: '1px solid #f59e0b33', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: 12 }}>Big (5-9)</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>₹{f(opt.big)}</div>
                    </div>
                    <div style={{ background: '#3b82f615', border: '1px solid #3b82f633', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ color: '#60a5fa', fontWeight: 800, fontSize: 12 }}>Small (0-4)</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>₹{f(opt.small)}</div>
                    </div>
                  </div>

                  {/* Numbers 0 - 9 Grid */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 8, fontWeight: 600 }}>Numbers Bet Pool (8.8× payout):</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6 }}>
                      {Array.from({ length: 10 }, (_, num) => {
                        const numAmt = opt.nums[num] || 0
                        return (
                          <div 
                            key={num} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              background: numAmt > 0 ? 'rgba(46,230,122,0.08)' : 'rgba(255,255,255,0.03)', 
                              border: '1px solid ' + (numAmt > 0 ? 'rgba(46,230,122,0.3)' : 'rgba(255,255,255,0.05)'),
                              padding: '5px 8px', 
                              borderRadius: 6 
                            }}
                          >
                            <span className={'ball sm ' + ballClass(num)} style={{ transform: 'scale(0.85)' }}>{num}</span>
                            <span style={{ fontSize: 12, fontWeight: numAmt > 0 ? 800 : 500, color: numAmt > 0 ? 'var(--ac)' : 'var(--mut)' }}>
                              ₹{f(numAmt)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12 }}>
          <button 
            type="button"
            disabled={page === 0} 
            onClick={() => setPage(p => Math.max(0, p - 1))}
            style={{ padding: '5px 12px', background: 'var(--c2)', opacity: page === 0 ? 0.4 : 1, cursor: page === 0 ? 'default' : 'pointer' }}
          >
            ← Previous
          </button>
          <span style={{ color: 'var(--mut)' }}>Page {page + 1} of {totalPages}</span>
          <button 
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= allPeriods.length} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '5px 12px', background: 'var(--c2)', opacity: (page + 1) * PAGE_SIZE >= allPeriods.length ? 0.4 : 1, cursor: (page + 1) * PAGE_SIZE >= allPeriods.length ? 'default' : 'pointer' }}
          >
            Next →
          </button>
        </div>
      )}
    </>
  )
}

function CrashRoundsAdmin() {
  const [crashBets, setCrashBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [openRounds, setOpenRounds] = useState({})
  const [st, setSt] = useState(() => cstate())

  useEffect(() => {
    const iv = setInterval(() => setSt(cstate()), 1000)
    return () => clearInterval(iv)
  }, [])

  const fetchCrashBets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('bets')
        .select('details, amount, win_amount, created_at')
        .eq('game', 'crash')
        .order('created_at', { ascending: false })
        .limit(2000)
      if (data) setCrashBets(data)
    } catch (e) {
      console.error('fetchCrashBets error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCrashBets()
    const iv = setInterval(fetchCrashBets, 4000)
    return () => clearInterval(iv)
  }, [])

  // Group bets by round_id
  const roundMap = {}
  crashBets.forEach(b => {
    const rid = b.details?.round_id || Math.floor(new Date(b.created_at).getTime() / 15000)
    if (!roundMap[rid]) {
      roundMap[rid] = {
        round_id: rid,
        totalBet: 0,
        totalWin: 0,
        betsCount: 0
      }
    }
    const amt = Number(b.amount || 0)
    const win = Number(b.win_amount || 0)
    roundMap[rid].totalBet += amt
    roundMap[rid].totalWin += win
    roundMap[rid].betsCount++
  })

  // Ensure current round and past 30 rounds exist in the list
  const curRound = st?.i || Math.floor(Date.now() / 15000)
  for (let i = 0; i < 30; i++) {
    const rid = curRound - i
    if (!roundMap[rid]) {
      roundMap[rid] = {
        round_id: rid,
        totalBet: 0,
        totalWin: 0,
        betsCount: 0
      }
    }
  }

  const allRounds = Object.values(roundMap).sort((a, b) => b.round_id - a.round_id)
  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(allRounds.length / PAGE_SIZE))
  const displayed = allRounds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleRound = (rid) => {
    setOpenRounds(prev => ({ ...prev, [rid]: !prev[rid] }))
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div>
          <b>Crash Game Rounds</b>
          <div className="small" style={{ color: 'var(--mut)' }}>Click any round to view pool amounts, multiplier and payout details</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="live" style={{ background: st.st === 'crash' ? 'var(--bad)' : 'var(--ac)' }} />
          <span style={{ fontSize: 12, color: 'var(--ac)', fontWeight: 700 }}>
            Round #{st.i} ({st.st === 'bet' ? 'Betting ' + st.left + 's' : st.st === 'crash' ? 'Crashed' : f(st.m) + '× Flying'})
          </span>
          <button onClick={fetchCrashBets} style={{ padding: '3px 8px', fontSize: 11, background: 'var(--c2)' }}>Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayed.map((r) => {
          const isLive = r.round_id === curRound
          let crashPoint = null
          try { crashPoint = cpOf(r.round_id) } catch (e) { crashPoint = 1.95 }
          const housePnl = r.totalBet - r.totalWin
          const isOpen = !!openRounds[r.round_id]

          return (
            <div 
              key={r.round_id}
              style={{ 
                background: 'var(--c2)', 
                borderRadius: 10, 
                border: '1px solid ' + (isOpen ? 'var(--ac)' : isLive ? '#2ee67a44' : '#ffffff14'),
                overflow: 'hidden',
                transition: 'border 0.2s'
              }}
            >
              {/* Header Dropdown Summary Row */}
              <div 
                onClick={() => toggleRound(r.round_id)}
                style={{ 
                  padding: '12px 14px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  cursor: 'pointer',
                  userSelect: 'none',
                  gap: 10,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <b style={{ fontSize: 14 }}>Round #{r.round_id}</b>
                  {isLive ? (
                    <span style={{ fontSize: 10, background: 'var(--ac)', color: '#000', padding: '2px 7px', borderRadius: 8, fontWeight: 900 }}>
                      LIVE {st.st === 'bet' ? `(Betting ${st.left}s)` : st.st === 'crash' ? 'CRASHED' : `${f(st.m)}× FLYING`}
                    </span>
                  ) : (
                    <b style={{ fontSize: 13, color: crashPoint < 2 ? 'var(--bad)' : 'var(--ac)' }}>
                      {f(crashPoint)}×
                    </b>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: r.totalBet > 0 ? 'var(--ac)' : 'inherit' }}>
                      Pool: ₹{f(r.totalBet)}
                    </div>
                    <div style={{ fontSize: 11, color: isLive ? '#ffd54f' : housePnl >= 0 ? 'var(--ac)' : 'var(--bad)', fontWeight: 600 }}>
                      {isLive ? `${r.betsCount} bets placed` : `House: ${housePnl >= 0 ? '+' : ''}₹${f(housePnl)}`}
                    </div>
                  </div>
                  <span style={{ 
                    fontSize: 12, 
                    color: 'var(--mut)', 
                    display: 'inline-block',
                    transform: isOpen ? 'rotate(180deg)' : 'none', 
                    transition: 'transform 0.2s' 
                  }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Collapsible Dropdown Details */}
              {isOpen && (
                <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.22)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>Total Bet Pool</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ac)', marginTop: 2 }}>₹{f(r.totalBet)}</div>
                      <div style={{ fontSize: 10, color: 'var(--mut)' }}>{r.betsCount} bets in this round</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>Crash Multiplier</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: crashPoint < 2 ? 'var(--bad)' : 'var(--ac)', marginTop: 2 }}>
                        {isLive ? (st.st === 'crash' ? `Crashed at ${f(st.m)}×` : st.st === 'bet' ? 'Pending flight' : `Flying at ${f(st.m)}×`) : `${f(crashPoint)}×`}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mut)' }}>{isLive ? 'Active live round' : 'Final settled crash multiplier'}</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>Total Player Payout</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: r.totalWin > 0 ? 'var(--ac)' : 'inherit', marginTop: 2 }}>
                        ₹{f(r.totalWin)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mut)' }}>Total paid out to players</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>House Net PnL</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: housePnl >= 0 ? 'var(--ac)' : 'var(--bad)', marginTop: 2 }}>
                        {isLive ? '—' : (housePnl >= 0 ? '+' : '') + '₹' + f(housePnl)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mut)' }}>{housePnl >= 0 ? 'House Profit' : 'House Loss'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12 }}>
          <button 
            type="button"
            disabled={page === 0} 
            onClick={() => setPage(p => Math.max(0, p - 1))}
            style={{ padding: '5px 12px', background: 'var(--c2)', opacity: page === 0 ? 0.4 : 1, cursor: page === 0 ? 'default' : 'pointer' }}
          >
            ← Previous
          </button>
          <span style={{ color: 'var(--mut)' }}>Page {page + 1} of {totalPages}</span>
          <button 
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= allRounds.length} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '5px 12px', background: 'var(--c2)', opacity: (page + 1) * PAGE_SIZE >= allRounds.length ? 0.4 : 1, cursor: (page + 1) * PAGE_SIZE >= allRounds.length ? 'default' : 'pointer' }}
          >
            Next →
          </button>
        </div>
      )}
    </>
  )
}

export default function Admin() {
  const [ok, setOk] = useState(false), [authed, setAuthed] = useState(false)
  useEffect(() => { setOk(true); setAuthed(sessionStorage.getItem('rs-admin') === '1') }, [])
  return <>{ok && (authed ? <Panel onOut={() => { sessionStorage.removeItem('rs-admin'); setAuthed(false) }} /> : <Login onIn={() => { sessionStorage.setItem('rs-admin', '1'); setAuthed(true) }} />)}<Notifications /></>
}

function Login({ onIn }) {
  const [id, setId] = useState(''), [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)

  const go = async () => {
    setLoading(true)
    try {
      const adminPhones = ['9999999999', '8888888888', '7777777777', '6666666666']
      const phone = adminPhones[parseInt(id) - 1] || id
      const res = await adminLogin(phone, pw)
      if (res.error) return toast(res.error)
      onIn()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth"><div className="card">
      <div className="logo" style={{ fontSize: 20 }}>Admin Console</div><p className="small">Authorized access only.</p>
      <label>Admin ID (1-4)</label><input autoComplete="off" value={id} onChange={(e) => setId(e.target.value)} />
      <label>Password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <button className="p" style={{ width: '100%', marginTop: 14 }} onClick={go} disabled={loading}>
        {loading ? '...' : 'Sign in'}
      </button>
    </div></div>
  )
}

const TABS = [
  { id: 'over', label: 'Overview' },
  { id: 'color_rounds', label: 'Color Rounds' },
  { id: 'crash_rounds', label: 'Crash Rounds' },
  { id: 'games', label: 'Games' },
  { id: 'deposits', label: 'Deposits' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'wallet', label: 'UPI / QR' },
  { id: 'users', label: 'Users' },
  { id: 'bonus', label: 'Bonus' },
  { id: 'logs', label: 'Logs' },
  { id: 'security', label: 'Security' }
]

function Panel({ onOut }) {
  const D = useDB()
  const [at, setAt] = useState('over')
  const [ap, setAp] = useState('')
  const [saving, setSaving] = useState(false)
  const [userPage, setUserPage] = useState(0)
  const [depFilter, setDepFilter] = useState('all')
  const [withFilter, setWithFilter] = useState('all')
  const [openReqs, setOpenReqs] = useState({})

  // Local config state
  const [c, setC] = useState(() => D.cfg || {
    edge: { dice: 1, limbo: 1, mines: 1, keno: 10, flip: 2, crash: 1, color: 5 },
    on: { dice: 1, limbo: 1, mines: 1, keno: 1, flip: 1, crash: 1, color: 1 },
    min: 1, max: 100000, upi: '8812862976@ybl', welcome: 100, dep: 50, wr: 3
  })

  useEffect(() => {
    if (D.cfg) {
      setC(JSON.parse(JSON.stringify(D.cfg)))
    }
  }, [D.cfg])

  const [usersList, setUsersList] = useState([])
  const [usersData, setUsersData] = useState({})
  const [betsData, setBetsData] = useState([])
  const [reqsData, setReqsData] = useState([])

  const fetchAdminData = async () => {
    try {
      const { data: users } = await supabase.from('users').select('*').eq('is_admin', false).order('created_at', { ascending: false })
      const { data: bets } = await supabase.from('bets').select('*, users:user_id(phone)').order('created_at', { ascending: false }).limit(500)
      const { data: reqs } = await supabase.from('requests').select('*, users:user_id(phone,name,balance,total_wagered,total_bets,total_wins)').order('created_at', { ascending: false })

      const usersMap = {}
      users?.forEach(u => { usersMap[u.phone] = u })
      setUsersList(users || [])
      setUsersData(usersMap)
      setBetsData(bets || [])
      setReqsData(reqs || [])
    } catch (err) {
      console.error('fetchAdminData error:', err)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [])

  const refreshData = async () => {
    await fetchAdminData()
  }

  // Save config explicitly to Supabase
  const saveConfig = async () => {
    setSaving(true)
    try {
      const ok = await updateConfig(c)
      if (ok) {
        toast('Configuration saved successfully!')
      } else {
        toast('Failed to save configuration')
      }
    } catch (err) {
      console.error('saveConfig error:', err)
      toast('Error saving configuration')
    } finally {
      setSaving(false)
    }
  }

  // Update handlers
  const updateEdge = (game, val) => {
    setC(prev => ({
      ...prev,
      edge: { ...(prev?.edge || {}), [game]: +val }
    }))
  }

  const updateOn = (game, enabled) => {
    setC(prev => ({
      ...prev,
      on: { ...(prev?.on || {}), [game]: enabled ? 1 : 0 }
    }))
  }

  const updateField = (field, val) => {
    setC(prev => ({
      ...prev,
      [field]: val
    }))
  }

  // Approve / Reject requests
  async function rq(id, ok) {
    const r = reqsData.find((x) => x.id === id)
    if (!r) return

    const userObj = r.users || usersList.find(x => x.id === r.user_id) || usersData[r.users?.phone]
    const userId = r.user_id || userObj?.id
    if (!userId) {
      return toast('User not found for this request')
    }

    const newStatus = ok ? 'approved' : 'rejected'
    const { error: reqErr } = await supabase
      .from('requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (reqErr) return toast('Failed to update request status')

    const isDeposit = String(r.type || '').toLowerCase() === 'deposit'
    const isWithdraw = String(r.type || '').toLowerCase() === 'withdraw'
    const reqAmount = Number(r.amount || 0)

    // Fetch fresh user record from Supabase
    const { data: freshUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    const currentBal = freshUser ? Number(freshUser.balance || 0) : Number(userObj?.balance || 0)

    if (isDeposit && ok) {
      const newBal = currentBal + reqAmount
      await supabase.from('users').update({ 
        balance: newBal,
        updated_at: new Date().toISOString() 
      }).eq('id', userId)

      await supabase.from('transactions').insert({ 
        user_id: userId, 
        type: 'Deposit', 
        amount: reqAmount, 
        balance_after: newBal, 
        details: { utr: r.upi_id || r.utr } 
      })

      const depBonusPercent = Number(c.dep || 0)
      if (depBonusPercent > 0) {
        const bonus = (reqAmount * depBonusPercent) / 100
        const curBonus = Number(freshUser?.bonus_balance || 0)
        const curNeed = Number(freshUser?.bonus_needed || 0)
        await supabase.from('users').update({ 
          bonus_balance: curBonus + bonus,
          bonus_needed: curNeed + bonus * Number(c.wr || 3)
        }).eq('id', userId)
      }
      toast('Deposit of ₹' + f(reqAmount) + ' approved and credited!')
    } else if (isWithdraw && !ok) {
      // Refund balance on rejected withdrawal
      const newBal = currentBal + reqAmount
      await supabase.from('users').update({ 
        balance: newBal,
        updated_at: new Date().toISOString() 
      }).eq('id', userId)

      await supabase.from('transactions').insert({ 
        user_id: userId, 
        type: 'Withdraw refunded', 
        amount: reqAmount, 
        balance_after: newBal, 
        details: { reason: 'Rejected by admin' } 
      })
      toast('Withdrawal rejected & ₹' + f(reqAmount) + ' refunded')
    } else if (isWithdraw && ok) {
      toast('Withdrawal of ₹' + f(reqAmount) + ' approved')
    } else if (isDeposit && !ok) {
      toast('Deposit rejected')
    }

    await refreshData()
  }

  async function adj(phone) {
    const a = parseFloat(prompt('Add (+) or remove (-) coins'))
    if (!a) return
    const u = usersData[phone]
    if (!u) return

    const newBal = Number(u.balance || 0) + a
    const { error } = await supabase.from('users').update({ balance: newBal, updated_at: new Date().toISOString() }).eq('id', u.id)
    if (error) return toast('Failed to adjust balance')

    await supabase.from('transactions').insert({ 
      user_id: u.id, 
      type: 'Admin adjustment', 
      amount: a, 
      balance_after: newBal, 
      details: {} 
    })
    toast('Balance updated to ₹' + f(newBal))
    await refreshData()
  }

  async function toggleBan(phone) {
    const u = usersData[phone]
    if (!u) return

    const newStatus = !u.is_banned
    const { error } = await supabase.from('users').update({ is_banned: newStatus, updated_at: new Date().toISOString() }).eq('id', u.id)
    if (error) return toast('Failed to update ban status')

    toast(newStatus ? 'User blocked' : 'User unblocked')
    await refreshData()
  }

  const toggleReqDropdown = (id) => {
    setOpenReqs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const players = Object.keys(usersData)
  const vol = betsData.reduce((s, x) => s + (Number(x.amount) || 0), 0)
  const profit = betsData.reduce((s, x) => s + (Number(x.amount) || 0) - (Number(x.win_amount) || 0), 0)

  const deposits = reqsData.filter(r => String(r.type || '').toLowerCase() === 'deposit')
  const withdrawals = reqsData.filter(r => String(r.type || '').toLowerCase() === 'withdraw')

  const pendingDeposits = deposits.filter(r => String(r.status || '').toLowerCase() === 'pending')
  const pendingWithdrawals = withdrawals.filter(r => String(r.status || '').toLowerCase() === 'pending')

  // Filtered deposits
  const filteredDeposits = deposits.filter(r => {
    if (depFilter === 'all') return true
    return String(r.status || '').toLowerCase() === depFilter
  })

  // Filtered withdrawals
  const filteredWithdrawals = withdrawals.filter(r => {
    if (withFilter === 'all') return true
    return String(r.status || '').toLowerCase() === withFilter
  })

  // Render a request card with minimum details & expandable dropdown
  const renderRequestCard = (r, isDep = true) => {
    const isOpen = !!openReqs[r.id]
    const status = String(r.status || 'pending').toLowerCase()
    const isPending = status === 'pending'
    const isApproved = status === 'approved'
    const userPhone = r.users?.phone || usersList.find(x => x.id === r.user_id)?.phone || 'Unknown'
    const userBal = r.users?.balance ?? usersList.find(x => x.id === r.user_id)?.balance ?? 0
    const userName = r.users?.name || usersList.find(x => x.id === r.user_id)?.name

    const badgeColor = isApproved ? 'var(--ac)' : isPending ? '#f59e0b' : 'var(--bad)'
    const badgeBg = isApproved ? '#2ee67a22' : isPending ? '#f59e0b22' : '#ff5a5a22'

    return (
      <div key={r.id} style={{ 
        background: 'var(--c2)', 
        borderRadius: 12, 
        border: '1px solid ' + (isOpen ? 'var(--ac)' : '#ffffff14'), 
        marginBottom: 10,
        overflow: 'hidden',
        transition: 'border .2s'
      }}>
        {/* Main Header Row - Minimum Details */}
        <div style={{ 
          padding: '12px 14px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: 10 
        }}>
          {/* User info & amount */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 150 }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: '50%', 
              background: isDep ? '#2ee67a22' : '#f59e0b22', 
              color: isDep ? 'var(--ac)' : '#f59e0b',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16
            }}>
              {isDep ? '↓' : '↑'}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{userPhone}</div>
              <div className="small" style={{ color: 'var(--mut)', fontSize: 11 }}>
                {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Amount & Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: isDep ? 'var(--ac)' : '#fff' }}>
                ₹{f(r.amount)}
              </div>
              <span style={{ 
                fontSize: 10, 
                fontWeight: 700, 
                padding: '2px 6px', 
                borderRadius: 4, 
                background: badgeBg, 
                color: badgeColor, 
                textTransform: 'uppercase',
                display: 'inline-block'
              }}>
                {status}
              </span>
            </div>
          </div>

          {/* Action buttons (Tick / Cross) & Dropdown Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            {isPending && (
              <>
                <button 
                  className="p" 
                  title="Approve"
                  style={{ padding: '6px 12px', fontSize: 13, background: 'var(--ac)', color: '#000', fontWeight: 800 }} 
                  onClick={(e) => { e.stopPropagation(); rq(r.id, 1) }}
                >
                  ✓
                </button>
                <button 
                  className="d" 
                  title="Reject"
                  style={{ padding: '6px 12px', fontSize: 13, background: 'var(--bad)', fontWeight: 800 }} 
                  onClick={(e) => { e.stopPropagation(); rq(r.id, 0) }}
                >
                  ✕
                </button>
              </>
            )}
            <button 
              onClick={() => toggleReqDropdown(r.id)} 
              style={{ 
                padding: '6px 10px', 
                fontSize: 12, 
                background: '#ffffff14', 
                border: 'none', 
                color: '#fff',
                cursor: 'pointer',
                borderRadius: 8
              }}
            >
              {isOpen ? '▲ Details' : '▼ Details'}
            </button>
          </div>
        </div>

        {/* Collapsible Dropdown Area - All Crucial Details */}
        {isOpen && (
          <div style={{ 
            padding: '12px 14px', 
            borderTop: '1px solid #ffffff14', 
            background: 'var(--c1)',
            fontSize: 13
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
              <div>
                <span className="small" style={{ color: 'var(--mut)' }}>Request ID</span>
                <div style={{ fontSize: 11, wordBreak: 'break-all', fontFamily: 'monospace' }}>{r.id}</div>
              </div>
              <div>
                <span className="small" style={{ color: 'var(--mut)' }}>Player Balance</span>
                <div style={{ fontWeight: 700 }}>₹{f(userBal)}</div>
              </div>
              <div>
                <span className="small" style={{ color: 'var(--mut)' }}>{isDep ? 'UTR / Txn Ref' : 'Withdrawal UPI / Details'}</span>
                <div style={{ fontWeight: 700, color: '#f59e0b', wordBreak: 'break-all' }}>
                  {r.upi_id || r.utr || 'None provided'}
                </div>
              </div>
              <div>
                <span className="small" style={{ color: 'var(--mut)' }}>Submitted At</span>
                <div>{new Date(r.created_at).toLocaleString()}</div>
              </div>
            </div>

            {isPending && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #ffffff0a' }}>
                <button 
                  className="p" 
                  style={{ flex: 1, padding: '8px', background: 'var(--ac)', color: '#000', fontWeight: 700 }}
                  onClick={() => rq(r.id, 1)}
                >
                  ✓ Approve {isDep ? 'Deposit' : 'Withdrawal'}
                </button>
                <button 
                  className="d" 
                  style={{ flex: 1, padding: '8px', background: 'var(--bad)', fontWeight: 700 }}
                  onClick={() => rq(r.id, 0)}
                >
                  ✕ Reject {isDep ? 'Deposit' : 'Withdrawal'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <header>
        <span className="logo">♠ Admin Console</span>
        <button className="d" onClick={onOut}>Log out</button>
      </header>
      <main>
        {/* Navigation Tabs */}
        <div className="chips" style={{ marginBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch', whiteSpace: 'nowrap', paddingBottom: 4 }}>
          {TABS.map((t) => {
            let badge = null
            if (t.id === 'deposits' && pendingDeposits.length > 0) badge = pendingDeposits.length
            if (t.id === 'withdrawals' && pendingWithdrawals.length > 0) badge = pendingWithdrawals.length

            return (
              <button 
                key={t.id} 
                className={t.id === at ? 'on' : ''} 
                onClick={() => setAt(t.id)}
                style={{ position: 'relative' }}
              >
                {t.label}
                {badge && (
                  <span style={{ 
                    marginLeft: 6, 
                    background: 'var(--bad)', 
                    color: '#fff', 
                    fontSize: 10, 
                    padding: '1px 5px', 
                    borderRadius: 10,
                    fontWeight: 800
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="card">
          {/* TAB 1: OVERVIEW */}
                    {/* TAB: COLOR ROUNDS */}
          {at === 'color_rounds' && <ColorRoundsAdmin />}

          {/* TAB: CRASH ROUNDS */}
          {at === 'crash_rounds' && <CrashRoundsAdmin />}

          {/* TAB 1: OVERVIEW */}
          {at === 'over' && (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: 300 }}>
                <tbody>
                  <tr><td>Players Registered</td><td><b>{players.length}</b></td></tr>
                  <tr><td>Total Bets Logged</td><td><b>{betsData.length}</b></td></tr>
                  <tr><td>Total Volume</td><td><b style={{ color: 'var(--ac)' }}>₹{f(vol)}</b></td></tr>
                  <tr><td>House Net Profit</td><td style={{ color: profit >= 0 ? 'var(--ac)' : 'var(--bad)', fontWeight: 700 }}>₹{f(profit)}</td></tr>
                  <tr><td>Pending Deposits</td><td><b style={{ color: pendingDeposits.length ? '#f59e0b' : 'inherit' }}>{pendingDeposits.length}</b></td></tr>
                  <tr><td>Pending Withdrawals</td><td><b style={{ color: pendingWithdrawals.length ? 'var(--bad)' : 'inherit' }}>{pendingWithdrawals.length}</b></td></tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: GAMES CONFIG */}
          {at === 'games' && (
            <>
              <p className="small">Set house edge (%) and toggle games on/off. Click Save Changes to persist.</p>
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '8px 0' }}>
                <table style={{ minWidth: 320, width: '100%' }}>
                  <thead>
                    <tr><th>Game</th><th>House Edge (%)</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {GAMES.map(([k, n]) => (
                      <tr key={k}>
                        <td style={{ fontWeight: 600 }}>{n}</td>
                        <td style={{ width: 120 }}>
                          <input 
                            type="number" 
                            step="0.5" 
                            min="0" 
                            max="20" 
                            value={c.edge?.[k] ?? 1} 
                            onChange={(e) => updateEdge(k, e.target.value)} 
                            style={{ width: 90 }}
                          />
                        </td>
                        <td>
                          <label style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input 
                              type="checkbox" 
                              checked={!!c.on?.[k]} 
                              onChange={(e) => updateOn(k, e.target.checked)} 
                            />
                            <span>{c.on?.[k] ? 'Active' : 'Off'}</span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <div>
                  <label>Min Bet (₹)</label>
                  <input type="number" value={c.min ?? 1} onChange={(e) => updateField('min', +e.target.value)} />
                </div>
                <div>
                  <label>Max Bet (₹)</label>
                  <input type="number" value={c.max ?? 100000} onChange={(e) => updateField('max', +e.target.value)} />
                </div>
              </div>

              <button 
                className="p" 
                style={{ width: '100%', marginTop: 14, padding: 12 }} 
                onClick={saveConfig} 
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </>
          )}

          {/* TAB 3: DEPOSITS */}
          {at === 'deposits' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <b>Deposits ({deposits.length})</b>
                <div className="chips" style={{ margin: 0 }}>
                  {['all', 'pending', 'approved', 'rejected'].map((st) => (
                    <button 
                      key={st} 
                      className={depFilter === st ? 'on' : ''} 
                      onClick={() => setDepFilter(st)}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      {st[0].toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {filteredDeposits.length === 0 ? (
                <p className="small" style={{ textAlign: 'center', padding: '20px 0' }}>No {depFilter !== 'all' ? depFilter : ''} deposits found</p>
              ) : (
                filteredDeposits.map(r => renderRequestCard(r, true))
              )}
            </>
          )}

          {/* TAB 4: WITHDRAWALS */}
          {at === 'withdrawals' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <b>Withdrawals ({withdrawals.length})</b>
                <div className="chips" style={{ margin: 0 }}>
                  {['all', 'pending', 'approved', 'rejected'].map((st) => (
                    <button 
                      key={st} 
                      className={withFilter === st ? 'on' : ''} 
                      onClick={() => setWithFilter(st)}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      {st[0].toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {filteredWithdrawals.length === 0 ? (
                <p className="small" style={{ textAlign: 'center', padding: '20px 0' }}>No {withFilter !== 'all' ? withFilter : ''} withdrawals found</p>
              ) : (
                filteredWithdrawals.map(r => renderRequestCard(r, false))
              )}
            </>
          )}

          {/* TAB 5: WALLET / UPI SETTINGS */}
          {at === 'wallet' && (
            <>
              <b>House UPI Settings</b>
              <p className="small">Set the official UPI ID shown on QR codes for player deposits.</p>
              <label>Deposit Receiving UPI ID</label>
              <input 
                value={c.upi || ''} 
                onChange={(e) => updateField('upi', e.target.value)} 
                placeholder="e.g. 8812862976@ybl" 
              />
              <button 
                className="p" 
                style={{ width: '100%', marginTop: 14, padding: 12 }} 
                onClick={saveConfig} 
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save UPI Configuration'}
              </button>
            </>
          )}

          {/* TAB 6: USERS (10 Per Page + Numbered Pagination Top & Bottom) */}
          {at === 'users' && (() => {
            const pageSize = 10
            const totalPages = Math.ceil(usersList.length / pageSize) || 1
            const currentPage = Math.min(userPage, totalPages - 1)
            const paginated = usersList.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

            // Pagination Controls Component
            const renderPagination = () => (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexWrap: 'wrap', 
                gap: 6, 
                margin: '10px 0' 
              }}>
                <button 
                  disabled={currentPage === 0} 
                  onClick={() => setUserPage(p => Math.max(0, p - 1))}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, idx) => (
                  <button 
                    key={idx} 
                    className={idx === currentPage ? 'p' : ''} 
                    onClick={() => setUserPage(idx)}
                    style={{ 
                      minWidth: 32, 
                      padding: '6px 8px', 
                      fontSize: 12,
                      fontWeight: idx === currentPage ? 800 : 400
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button 
                  disabled={currentPage >= totalPages - 1} 
                  onClick={() => setUserPage(p => Math.min(totalPages - 1, p + 1))}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Next →
                </button>
              </div>
            )

            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <b>Registered Players ({usersList.length})</b>
                  <span className="small">Page {currentPage + 1} of {totalPages} (10 users / page)</span>
                </div>

                {/* Top Numbered Pagination */}
                {totalPages > 1 && renderPagination()}

                {/* Mobile Responsive Horizontal Scroll Table */}
                <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '8px 0' }}>
                  <table style={{ minWidth: 550, width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>#</th>
                        <th style={{ textAlign: 'left' }}>Phone</th>
                        <th style={{ textAlign: 'left' }}>Balance</th>
                        <th style={{ textAlign: 'left' }}>Wagered</th>
                        <th style={{ textAlign: 'left' }}>Status</th>
                        <th style={{ textAlign: 'left' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((u, i) => (
                        <tr key={u.id || u.phone}>
                          <td style={{ color: 'var(--mut)', fontSize: 12 }}>{currentPage * pageSize + i + 1}</td>
                          <td>
                            <b>{u.phone}</b>
                            {u.username && <div className="small" style={{ color: 'var(--mut)' }}>@{u.username}</div>}
                          </td>
                          <td style={{ fontWeight: 700 }}>₹{f(u.balance)}</td>
                          <td className="small">₹{f(u.total_wagered || 0)}</td>
                          <td>
                            <span style={{ 
                              fontSize: 10, 
                              fontWeight: 800, 
                              padding: '2px 8px', 
                              borderRadius: 4, 
                              background: u.is_banned ? 'var(--bad)' : 'var(--ac)',
                              color: '#000'
                            }}>
                              {u.is_banned ? 'BLOCKED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                              <button 
                                onClick={() => adj(u.phone)} 
                                title="Adjust Balance"
                                style={{ padding: '4px 8px', fontSize: 13 }}
                              >
                                ±
                              </button>
                              <button 
                                className={u.is_banned ? 'p' : 'd'} 
                                onClick={() => toggleBan(u.phone)}
                                style={{ padding: '4px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                              >
                                {u.is_banned ? 'Unblock' : 'Ban User'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!usersList.length && <tr><td colSpan="6" className="small">No players registered yet</td></tr>}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Numbered Pagination */}
                {totalPages > 1 && renderPagination()}
              </>
            )
          })()}

          {/* TAB 7: BONUS CONFIG */}
          {at === 'bonus' && (
            <>
              <b>Bonus Settings</b>
              <p className="small">Configure player welcome bonus and deposit bonuses.</p>
              <label>Welcome Bonus Amount (₹)</label>
              <input type="number" value={c.welcome ?? 100} onChange={(e) => updateField('welcome', +e.target.value)} />

              <label>Deposit Bonus (%)</label>
              <input type="number" value={c.dep ?? 50} onChange={(e) => updateField('dep', +e.target.value)} />

              <label>Wagering Requirement Multiple</label>
              <input type="number" value={c.wr ?? 3} onChange={(e) => updateField('wr', +e.target.value)} />

              <button 
                className="p" 
                style={{ width: '100%', marginTop: 14, padding: 12 }} 
                onClick={saveConfig} 
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save Bonus Configuration'}
              </button>
            </>
          )}

          {/* TAB 8: BETS LOGS */}
          {at === 'logs' && (
            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ minWidth: 400, width: '100%', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr><th>User</th><th>Game</th><th>Bet</th><th>Win</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {betsData.slice(0, 50).map((x, i) => (
                    <tr key={i}>
                      <td>{x.users?.phone ? '···' + x.users.phone.slice(-4) : 'Player'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{x.game}</td>
                      <td>₹{f(x.amount)}</td>
                      <td style={{ color: Number(x.win_amount) > Number(x.amount) ? 'var(--ac)' : 'inherit' }}>₹{f(x.win_amount)}</td>
                      <td>
                        <span style={{ 
                          fontSize: 10, 
                          fontWeight: 700, 
                          color: Number(x.win_amount) > Number(x.amount) ? 'var(--ac)' : 'var(--bad)' 
                        }}>
                          {Number(x.win_amount) > Number(x.amount) ? 'WIN' : 'LOSS'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!betsData.length && <tr><td colSpan="5" className="small">No bets logged yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 9: SECURITY */}
          {at === 'security' && (
            <>
              <b>Admin Security</b>
              <p className="small">Change admin access password.</p>
              <label>New Admin Password</label>
              <input type="password" value={ap} onChange={(e) => setAp(e.target.value)} placeholder="Minimum 8 characters" />
              <button 
                className="p" 
                style={{ marginTop: 12, padding: 10 }} 
                onClick={() => { 
                  if (ap.length < 8) return toast('Min 8 characters required'); 
                  toast('Password change requires database admin update') 
                }}
              >
                Change Password
              </button>
            </>
          )}
        </div>
      </main>
    </>
  )
}
