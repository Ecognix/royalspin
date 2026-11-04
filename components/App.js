'use client'

export function GameHistory({ game }) {
  const [bets, setBets] = useState([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const u = user()

  const loadBets = async () => {
    if (!u) return
    setLoading(true)
    try {
      if (u.id) {
        const { data } = await supabase
          .from('bets')
          .select('*')
          .eq('user_id', u.id)
          .eq('game', game)
          .order('created_at', { ascending: false })
          .limit(100)
        if (data && data.length) {
          setBets(data)
          return
        }
      }
      const local = (u.bets || []).filter(b => b.g === game)
      setBets(local.map((b, idx) => ({
        id: 'local-' + idx + '-' + b.t,
        amount: b.a,
        win_amount: b.w,
        created_at: new Date(b.t).toISOString()
      })))
    } catch (e) {
      console.error('loadBets error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(0)
    loadBets()
    const onNotif = () => setTimeout(loadBets, 600)
    window.addEventListener('rs-notify', onNotif)
    return () => window.removeEventListener('rs-notify', onNotif)
  }, [game, u?.id])

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(bets.length / PAGE_SIZE))
  const displayed = bets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="card" style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <b>Bet History</b>
        <button onClick={loadBets} style={{ padding: '3px 8px', fontSize: 11, background: 'var(--c2)' }}>Refresh</button>
      </div>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--mut)', borderBottom: '1px solid var(--ln)', textAlign: 'left' }}>
            <th style={{ padding: '6px 4px' }}>Time</th>
            <th style={{ padding: '6px 4px' }}>Bet</th>
            <th style={{ padding: '6px 4px' }}>Result</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Payout</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((b, i) => {
            const isWin = (b.win_amount || 0) > (b.amount || 0)
            const net = (b.win_amount || 0) - (b.amount || 0)
            const d = new Date(b.created_at || Date.now())
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            return (
              <tr key={b.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '7px 4px', color: 'var(--mut)', fontSize: 11 }}>{timeStr}</td>
                <td style={{ padding: '7px 4px' }}>₹{f(b.amount)}</td>
                <td style={{ padding: '7px 4px', fontWeight: 600, color: isWin ? 'var(--ac)' : 'var(--bad)' }}>
                  {isWin ? 'Win' : 'Loss'}
                </td>
                <td style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 700, color: isWin ? 'var(--ac)' : 'var(--bad)' }}>
                  {isWin ? '+' : ''}₹{f(net)}
                </td>
              </tr>
            )
          })}
          {!displayed.length && (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', padding: '16px 0', color: 'var(--mut)' }}>
                {loading ? 'Loading history...' : 'No bets yet'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--ln)' }}>
          <button 
            disabled={page === 0} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 12, color: 'var(--mut)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button 
            disabled={page >= totalPages - 1} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}


import Admin from './Admin'

import { useEffect, useState } from 'react'

import { 

  db, useDB, getMe, setMe, user, toast, f, 

  signup, login, adminLogin, refreshUser, notifySubscribers,

  createRequest, getAllUsers, getAllBets, getAllRequests,

  updateRequest, updateUser, updateConfig, isAdminPhone, supabase,
  BET_FEE_WAGER_STEP, BET_FEE_AMOUNT

} from '../lib/supabase-db'

import { tick } from '../lib/tick'

import { GAMES, ICON } from './meta'

import { Dice, Limbo, Mines, Keno, Flip, Crash, Color } from './Games'

import { Wallet, Support, Activity, ActivityHistory, GameStatistics, AccountHub, PromotionHub, HubIcon, Vault, Wager, Bonus, Referral, Profile, Settings } from './Pages'



const COMP = { dice: Dice, limbo: Limbo, mines: Mines, keno: Keno, flip: Flip, crash: Crash, color: Color }

// Notification system - supports both simple toasts and detailed result cards

export function Notifications() {

  const [notifs, setNotifs] = useState([])

  const [toasts, setToasts] = useState([])



  useEffect(() => {

    const on = (e) => {

      const n = e.detail

      setNotifs((prev) => [...prev, { ...n, id: Date.now() + Math.random() }])

    }

    const onToast = (e) => {

      const id = Date.now() + Math.random()

      setToasts((prev) => [...prev, { id, text: e.detail }])

      setTimeout(() => {

        setToasts((prev) => prev.filter((t) => t.id !== id))

      }, 2500)

    }

    window.addEventListener('rs-notify', on)

    window.addEventListener('rs-toast', onToast)

    return () => {

      window.removeEventListener('rs-notify', on)

      window.removeEventListener('rs-toast', onToast)

    }

  }, [])



  const dismiss = (id) => setNotifs((prev) => prev.filter((n) => n.id !== id))

  return (

    <>

      {notifs.map((n) => (

        <NotificationCard key={n.id} notif={n} onDismiss={() => dismiss(n.id)} />

      ))}

      {toasts.map((t) => (

        <div key={t.id} className="msg">

          {t.text}

        </div>

      ))}

    </>

  )

}



function NotificationCard({ notif, onDismiss }) {

  const { type, title, message, details, autoClose = 2000, center = false } = notif

  const [progress, setProgress] = useState(100)

  const isWin = type === 'win'

  

  useEffect(() => {

    if (autoClose) {

      const startTime = Date.now()

      const duration = autoClose

      const interval = setInterval(() => {

        const elapsed = Date.now() - startTime

        const p = Math.max(0, 100 - (elapsed / duration) * 100)

        setProgress(p)

        if (p <= 0) {

          clearInterval(interval)

          onDismiss()

        }

      }, 50)

      return () => clearInterval(interval)

    }

  }, [autoClose, onDismiss])

  

  if (type === 'bet') {

    // Bet placed - simple center toast

    return (

      <div className="msg">{message}</div>

    )

  }

  

  // Top card for Color Trading (net result) - overlaps main game card

  if (center) {

    return (

      <div style={{ 

        minWidth: 280,

        maxWidth: '90vw',

        padding: '18px 14px 0', 

        textAlign: 'center',

        animation: 'slideDown .3s cubic-bezier(.3,1.6,.5,1)',

        zIndex: 100,

        position: 'fixed',

        top: 'calc(70px + env(safe-area-inset-top,0px))',

        left: '50%',

        transform: 'translateX(-50%)',

        background: 'var(--c1)',

        borderRadius: '10px',

        boxShadow: '0 8px 24px #000a',

        bottom: 'auto',

        border: 'none',

        display: 'flex',

        flexDirection: 'column',

        alignItems: 'center',

        justifyContent: 'center',

        overflow: 'hidden'

      }}>

        <button 

          onClick={onDismiss}

          style={{

            position: 'absolute',

            top: 2,

            right: 2,

            width: 18,

            height: 18,

            border: 'none', background: 'transparent',

            color: 'var(--mut)',

            cursor: 'pointer',

            fontSize: 12,

            lineHeight: 1,

            display: 'flex',

            alignItems: 'center',

            justifyContent: 'center'

          }}

        >×</button>

        <div style={{ fontSize: 16, fontWeight: 700, color: isWin ? 'var(--ac)' : 'var(--bad)', marginBottom: 4 }}>

          {isWin ? 'NET PROFIT' : 'NET LOSS'}

        </div>

        <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 6, fontWeight: 500 }}>{title}</div>

        <div style={{ fontSize: 22, fontWeight: 800, color: isWin ? 'var(--ac)' : 'var(--bad)' }}>

          {message}

        </div>

        {/* Animated timeout progress bar - joined to bottom edge */}

        <div style={{ 

          height: 3, 

          width: '100%',

          background: 'var(--c2)', 

          overflow: 'hidden',

          marginTop: 14,

          borderRadius: '0 0 10px 10px',

          flexShrink: 0

        }}>

          <div 

            style={{ 

              height: '100%', 

              width: `${progress}%`, 

              background: isWin ? 'var(--ac)' : 'var(--bad)',

              transition: 'width 0.05s linear'

            }} 

          />

        </div>

      </div>

    )

  }

  

  // Win/Loss - detailed card at top, overlapping game card (like Color Trading)

  return (

    <div style={{ 

      minWidth: 280,

      maxWidth: '90vw',

      padding: '18px 14px 0', 

      textAlign: 'center',

      animation: 'slideDown .3s cubic-bezier(.3,1.6,.5,1)',

      zIndex: 100,

      position: 'fixed',

      top: 'calc(70px + env(safe-area-inset-top,0px))',

      left: '50%',

      transform: 'translateX(-50%)',

      background: 'var(--c1)',

      borderRadius: '10px',

      boxShadow: '0 8px 24px #000a',

      bottom: 'auto',

      border: 'none',

      display: 'flex',

      flexDirection: 'column',

      alignItems: 'center',

      justifyContent: 'center',

      overflow: 'hidden'

    }}>

      <button 

        onClick={onDismiss}

        style={{

          position: 'absolute',

          top: 2,

          right: 2,

          width: 18,

          height: 18,

          border: 'none', background: 'transparent',

          color: 'var(--mut)',

          cursor: 'pointer',

          fontSize: 12,

          lineHeight: 1,

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'center'

        }}

      >×</button>

      <div style={{ fontSize: 16, fontWeight: 700, color: isWin ? 'var(--ac)' : 'var(--bad)', marginBottom: 4 }}>

        {isWin ? 'WIN' : 'LOSS'}

      </div>

      <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 6, fontWeight: 500 }}>{title}</div>

      <div style={{ fontSize: 22, fontWeight: 800, color: isWin ? 'var(--ac)' : 'var(--bad)' }}>

        {isWin ? '+' : ''}₹{message.replace(/[^0-9.]/g, '')}

      </div>

      {details && <div style={{ fontSize: 11, color: 'var(--mut)', lineHeight: 1.3, fontWeight: 400, marginTop: 6 }}>{details}</div>}

      {/* Animated timeout progress bar - joined to bottom edge */}

      <div style={{ 

        height: 3, 

        width: '100%',

        background: 'var(--c2)', 

        overflow: 'hidden',

        marginTop: 14,

        borderRadius: '0 0 10px 10px',

        flexShrink: 0

      }}>

        <div 

          style={{ 

            height: '100%', 

            width: `${progress}%`, 

            background: isWin ? 'var(--ac)' : 'var(--bad)',

            transition: 'width 0.05s linear'

          }} 

        />

      </div>

    </div>

  )

}



// Mount gate: the data layer reads localStorage, so nothing renders on the server.

export default function App() {

  const [ok, setOk] = useState(false)

  useEffect(() => setOk(true), [])

  return <>{ok && <Main />}<Notifications /></>

}



function Auth({ onIn }) {

  const [m, setM] = useState('login')

  const [ph, setPh] = useState('')

  const [pw, setPw] = useState('')

  const [cp, setCp] = useState('')

  const [un, setUn] = useState('')

  const [referralCode, setReferralCode] = useState(() => (
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('ref') || ''
  ))

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)



  async function go() {

    setLoading(true)

    try {

      if (m === 'signup') {

        if (!/^\d{10}$/.test(ph)) return toast('Enter a 10 digit number')

        if (pw.length < 6) return toast('Password min 6 characters')

        if (pw !== cp) return toast('Passwords do not match')

        if (un && un.length < 3) return toast('Username min 3 characters')

        if (isAdminPhone(ph)) return toast('Cannot register as admin')

        

        const res = await signup(ph, pw, un || undefined, referralCode.trim() || undefined)

        if (res.error) return toast(res.error)

        setMe(ph, res.user); onIn(ph)

      } else {

        const res = await login(ph, pw)

        if (res.error) return toast(res.error)

        setMe(ph, res.user); onIn(ph)

      }

    } finally {

      setLoading(false)

    }

  }



  return (
    <div className="auth-screen">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="auth-mark">♠</div>
          <div>
            <div className="auth-brand-name">ROYAL SPIN</div>
            <div className="auth-brand-caption">Play. Spin. Enjoy.</div>
          </div>
        </div>
        <div className="auth-intro">
          <h1>{m === 'login' ? 'Welcome back' : 'Join Royal Spin'}</h1>
          <p>{m === 'login' ? 'Sign in with your phone number to continue.' : 'Create your account with a phone number.'}</p>
        </div>

        <div className="auth-form">
          <div className="auth-switch" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={m === 'login'} className={m === 'login' ? 'selected' : ''} onClick={() => setM('login')}>Log in</button>
            <button type="button" role="tab" aria-selected={m === 'signup'} className={m === 'signup' ? 'selected' : ''} onClick={() => setM('signup')}>Register</button>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); go() }}>
            <label className="auth-label" htmlFor="auth-phone">Phone number</label>
            <div className="auth-phone">
              <span>+91</span>
              <input
                id="auth-phone"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="Enter 10 digit number"
                value={ph}
                onChange={(event) => setPh(event.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>

            {m === 'signup' && (
              <>
                <label className="auth-label" htmlFor="auth-username">Username <span>(optional)</span></label>
                <input id="auth-username" className="auth-input" autoComplete="username" placeholder="Choose a username" value={un} onChange={(event) => setUn(event.target.value.trim())} />
              </>
            )}

            <label className="auth-label" htmlFor="auth-password">{m === 'login' ? 'Password' : 'Set password'}</label>
            <div className="auth-password">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={m === 'login' ? 'current-password' : 'new-password'}
                placeholder={m === 'login' ? 'Enter your password' : 'At least 6 characters'}
                value={pw}
                onChange={(event) => setPw(event.target.value)}
              />
              <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>

            {m === 'signup' && (
              <>
                <label className="auth-label" htmlFor="auth-confirm">Confirm password</label>
                <div className="auth-password">
                  <input
                    id="auth-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Enter your password again"
                    value={cp}
                    onChange={(event) => setCp(event.target.value)}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>{showConfirmPassword ? 'Hide' : 'Show'}</button>
                </div>
                <label className="auth-label" htmlFor="auth-referral">Invite code <span>(optional)</span></label>
                <input id="auth-referral" className="auth-input" placeholder="Enter invite code" value={referralCode} onChange={(event) => setReferralCode(event.target.value.trim())} />
              </>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : m === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="auth-footnote">
            {m === 'login' ? 'New to Royal Spin?' : 'Already have an account?'}
            <button type="button" onClick={() => setM(m === 'login' ? 'signup' : 'login')}>
              {m === 'login' ? 'Create account' : 'Log in'}
            </button>
          </p>
        </div>
      </section>
    </div>
  )

}



function Main() {
  const D = useDB()
  const cfg = D?.cfg || {}

  const [me, setM] = useState(() => getMe())
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('rs-view') || 'home'
    }
    return 'home'
  })
  const [game, setGame] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('rs-game') || null
    }
    return null
  })

  const [amt, setAmt] = useState(10)
  const [walletTab, setWalletTab] = useState('d')
  const [activityTab, setActivityTab] = useState('bets')

  useEffect(() => {
    const iv1 = setInterval(tick, 200)
    const iv2 = setInterval(refreshUser, 3000)
    return () => { clearInterval(iv1); clearInterval(iv2) }
  }, [])

  // Instant Realtime balance sync upon admin deposit/withdrawal approval
  useEffect(() => {
    const curPhone = getMe()
    if (!curPhone) return
    const channel = supabase
      .channel('user-bal-sync-' + curPhone)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: 'phone=eq.' + curPhone
      }, (payload) => {
        if (payload?.new) {
          const freshUser = payload.new
          const cur = user()
          if (cur) {
            cur.balance = Number(freshUser.balance)
            cur.bonus_balance = Number(freshUser.bonus_balance || 0)
            cur.bonus_needed = Number(freshUser.bonus_needed || 0)
            cur.is_admin = freshUser.is_admin
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('rs-user', JSON.stringify(cur))
            }
          }
          notifySubscribers()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [me])

  const u = me ? user() : null

  if (me && !u) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div className="logo" style={{ fontSize: 28, fontWeight: 800 }}>♠ Royal Spin</div>
        <div style={{ color: 'var(--mut)', fontSize: 13 }}>Loading account...</div>
      </div>
    )
  }

  if (!u) return <Auth onIn={setM} />

  

  const isAdmin = u.is_admin === true

  const go = (v, g) => {
    setView(v)
    if (g !== undefined) setGame(g)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('rs-view', v)
      if (g) sessionStorage.setItem('rs-game', g)
      else if (v !== 'game') sessionStorage.removeItem('rs-game')
    }
  }

  const openWallet = (tab = 'd') => {
    setWalletTab(tab)
    go('wallet')
  }

  const openActivity = (tab = 'bets') => {
    setActivityTab(tab)
    go('history')
  }

  const openSupport = () => {
    window.dispatchEvent(new CustomEvent('rs-open-support'))
  }

  const logout = () => {
    setMe(null)
    setM(null)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('rs-view')
      sessionStorage.removeItem('rs-game')
    }
    setView('home')
  }

  const Game = COMP[game]

  

  return (

    <>

      <div className={view === 'admin' ? 'player-shell admin-shell' : 'player-shell'}>

      {view !== 'admin' && <header className="player-header">

        <span className="logo" style={{ cursor: 'pointer' }} onClick={() => go('home')}>♠ Royal Spin</span>

        <div className="player-header-actions">
          <button className="player-balance" type="button" onClick={() => openWallet('d')}>
            <span>Total balance</span><b>{u.hide_balance ? '••••' : `₹${f(u.balance)}`}</b>
          </button>
          <button className="player-account-button" type="button" onClick={() => go('account')} aria-label="Account"><HubIcon name="account" /></button>
        </div>

      </header>}

      <main className={view === 'admin' ? '' : 'player-main'}>

        {view === 'home' && <>

          <h3>Choose a game</h3>

          <div className="tiles">{GAMES.map(([k, n, c]) => {

            const [a, b] = c.split(',')

            // using D.cfg

            return <button key={k} className={'tile' + (cfg.on?.[k] ? '' : ' off')} style={{ background: `linear-gradient(135deg,${a},${b})` }} onClick={() => go('game', k)}>

              <svg viewBox="0 -2 100 100">{ICON[k]}</svg><span>{n}</span></button>

          })}</div></>}

        {view === 'game' && Game && <>

          <button onClick={() => go('home', null)}>← Games</button>

          <div className="card" style={{ marginTop: 10 }}>

            <b>{GAMES.find((g) => g[0] === game)[1]}</b><p className="small">House edge {cfg.edge?.[game] || 0}%</p>
            <p className="small" style={{ padding: '9px 11px', margin: '8px 0', borderRadius: 8, background: '#8b5e0022', border: '1px solid #ffd54f55', color: '#ffe9a8' }}>
              Play-money demo rules: Dice, Limbo, Mines, Keno, and Coin Flip use per-player groups of 10 bets with 3 wins, occasionally 4, placed at random nonconsecutive positions. Results can override normal game mechanics. Color Trading selects the number with the lowest total payout across all bets in each period. These outcomes are controlled, not random or fair. Sequences are saved in this browser; another browser or device has a separate sequence.
            </p>

                        <label>Bet amount</label>
            <p className="small">₹{BET_FEE_AMOUNT} is deducted for every completed ₹{BET_FEE_WAGER_STEP} of cumulative bets. Partial amounts carry over.</p>
            <div className="row">
              <input type="number" min="1" max="100000" value={amt} onChange={(e) => setAmt(e.target.value)} />
              <button type="button" onClick={() => setAmt(Math.max(1, Math.floor((+amt || 10) / 2)))}>½</button>
              <button type="button" onClick={() => setAmt((+amt || 10) * 2)}>2×</button>
            </div>
            <div className="row" style={{ marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
              {[10, 50, 100, 500, 1000].map(v => (
                <button key={v} type="button" style={{ padding: '4px 10px', fontSize: 12, flex: '1 1 auto' }} onClick={() => setAmt(v)}>
                  ₹{v}
                </button>
              ))}
              <button type="button" style={{ padding: '4px 10px', fontSize: 12, flex: '1 1 auto' }} onClick={() => setAmt(Math.min(100000, Math.floor(u?.balance || 10)))}>
                Max
              </button>
            </div>

            <div style={{ marginTop: 10 }}><Game key={game} amt={amt} /></div>
            {game !== 'color' && <GameHistory game={game} />}

          </div></>}

        {view === 'wallet' && <Wallet u={u} me={me} initialTab={walletTab} />}

        {view === 'vault' && <Vault u={u} />}

        {view === 'wager' && <Wager u={u} me={me} />}

        {view === 'bonus' && <Bonus u={u} />}

        {view === 'referral' && <Referral u={u} />}

        {view === 'profile' && <Profile u={u} me={me} />}

        {view === 'settings' && <Settings u={u} onLogout={logout} />}

        {view === 'admin' && <Admin u={u} />}

        {view === 'activity' && <Activity u={u} onNavigate={go} />}

        {view === 'history' && <ActivityHistory u={u} initialTab={activityTab} />}

        {view === 'gameStats' && <GameStatistics u={u} onBack={() => go('account')} />}

        {view === 'promotion' && <PromotionHub u={u} onNavigate={go} />}

        {view === 'account' && (
          <AccountHub
            u={u}
            isAdmin={isAdmin}
            onWallet={openWallet}
            onActivity={openActivity}
            onNavigate={go}
            onSupport={openSupport}
            onLogout={logout}
          />
        )}

      </main>

      {!isAdmin && <Support u={u} />}

      {view !== 'admin' && (
        <nav className="player-nav" aria-label="Main navigation">
          {[
            ['home', 'home', 'Home'],
            ['activity', 'activity', 'Activity'],
            ['promotion', 'promotion', 'Promotion'],
            ['account', 'account', 'Account']
          ].map(([destination, icon, label]) => {
            const active = destination === 'home'
              ? ['home', 'game'].includes(view)
              : destination === 'activity'
                ? view === 'activity'
                : destination === 'promotion'
                  ? ['promotion', 'referral'].includes(view)
                  : ['account', 'wallet', 'vault', 'wager', 'bonus', 'profile', 'settings', 'history', 'gameStats'].includes(view)
            return (
              <button key={destination} className={active ? 'active' : ''} onClick={() => go(destination)}>
                <span><HubIcon name={icon} /></span><small>{label}</small>
              </button>
            )
          })}
        </nav>
      )}

      </div>
    </>

  )

}
