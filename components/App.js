'use client'

export function GameHistory({ game }) {
  const [bets, setBets] = useState([])
  const [page, setPage] = useState(0)
  const [totalBets, setTotalBets] = useState(0)
  const [loading, setLoading] = useState(false)
  const u = user()

  const loadBets = async (targetPage = page) => {
    if (!u) return
    setLoading(true)
    try {
      if (u.id) {
        const { data, count, error } = await supabase
          .from('bets')
          .select('*', { count: 'exact' })
          .eq('user_id', u.id)
          .eq('game', game)
          .order('created_at', { ascending: false })
          .range(targetPage * 15, targetPage * 15 + 14)
        if (error) throw error
        if ((data && data.length) || count) {
          setBets(data || [])
          setTotalBets(count || 0)
          return
        }
      }
      const local = (u.bets || []).filter(b => b.g === game)
      const localRows = local.map((b, idx) => ({
        id: 'local-' + idx + '-' + b.t,
        amount: b.a,
        win_amount: b.w,
        created_at: new Date(b.t).toISOString()
      }))
      setTotalBets(localRows.length)
      setBets(localRows.slice(targetPage * 15, targetPage * 15 + 15))
    } catch (e) {
      console.error('loadBets error:', e)
      const local = (u.bets || []).filter(b => b.g === game).map((b, idx) => ({
        id: 'local-' + idx + '-' + b.t,
        amount: b.a,
        win_amount: b.w,
        created_at: new Date(b.t).toISOString()
      }))
      setTotalBets(local.length)
      setBets(local.slice(targetPage * 15, targetPage * 15 + 15))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(0)
    loadBets(0)
    const onNotif = () => setTimeout(() => { setPage(0); loadBets(0) }, 600)
    window.addEventListener('rs-notify', onNotif)
    return () => window.removeEventListener('rs-notify', onNotif)
  }, [game, u?.id])

  const totalPages = Math.max(1, Math.ceil(totalBets / 15))
  const displayed = bets
  const gameLabel = game === 'color' ? 'WIN GO' : String(game || 'Game').replace(/^\w/, letter => letter.toUpperCase())

  return (
    <div className="card" style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <b>{gameLabel} Bet History</b>
        <button onClick={() => loadBets(page)} style={{ padding: '3px 8px', fontSize: 11, background: 'var(--c2)' }}>Refresh</button>
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
            onClick={() => { const target = page - 1; setPage(target); loadBets(target) }}
            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 12, color: 'var(--mut)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button 
            disabled={page >= totalPages - 1} 
            onClick={() => { const target = page + 1; setPage(target); loadBets(target) }}
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

import { useEffect, useRef, useState } from 'react'

import { 

  db, useDB, getMe, setMe, user, toast, f, 

  signup, login, adminLogin, refreshUser, notifySubscribers,

  createRequest, getAllUsers, getAllBets, getAllRequests,

  updateRequest, updateUser, updateConfig, isAdminPhone, supabase,
  BET_FEE_WAGER_STEP, BET_FEE_AMOUNT

} from '../lib/supabase-db'

import { tick } from '../lib/tick'

import { GAMES } from './meta'

import { Dice, Limbo, Mines, Keno, Flip, Crash, Color, ColorPeriodTabs } from './Games'

import { Wallet, Support, Activity, ActivityHistory, GameStatistics, NotificationCenter, AccountHub, PromotionHub, HubIcon, Vault, Wager, Bonus, Referral, Profile, Settings } from './Pages'



const COMP = { dice: Dice, limbo: Limbo, mines: Mines, keno: Keno, flip: Flip, crash: Crash, color: Color }

const GAME_ART = {
  crash: '/games/aviator.png',
  color: '/games/wingo.png',
  dice: '/games/dice.png',
  mines: '/games/mines.png',
  limbo: '/games/limbo.png',
  keno: '/games/keno.png',
  flip: '/games/flip.png'
}

const OTHER_HOME_GAMES = [
  { label: 'Chicken Road 2', image: '/games/chicken-road-2.jpg' },
  { label: 'Chicken Shoot', image: '/games/chicken-shoot.png' },
  { label: 'Vortex', image: '/games/vortex.png' },
  { label: 'Dragon Gems Clash', image: '/games/dragon-gems-clash.png' },
  { label: 'Go Rush', image: '/games/go-rush.png' },
  { label: 'Cricket', image: '/games/cricket.png' },
  { label: 'Penalty Kicks', image: '/games/penalty.png' },
  { label: 'Plinko', image: '/games/plinko.png' },
  { label: 'Rocket', image: '/games/rocket.png' },
  { label: 'Andar Bahar', image: '/games/andar-bahar.png' }
]

const LOTTERY_HOME_GAMES = [
  { gameKey: 'color', label: 'WIN GO', image: '/games/wingo.png' },
  { label: 'K3', image: '/games/k3.png' },
  { label: '5D', image: '/games/5d.png' },
  { label: 'TRX WINGO', image: '/games/trx-wingo.png' }
]

function HomeGameCard({ item, cfg, onOpen, variant = '' }) {
  const active = Boolean(item.gameKey && cfg.on?.[item.gameKey])
  return (
    <button
      type="button"
      className={`home-game-card ${variant}`}
      onClick={() => active ? onOpen(item.gameKey) : toast(`${item.label} coming soon`)}
      aria-label={active ? `Open ${item.label}` : `${item.label}, coming soon`}
    >
      <img src={item.image} alt="" loading="lazy" />
      <span className="home-game-name">{item.label}</span>
    </button>
  )
}

// Notification system - supports both simple toasts and detailed result cards

export function Notifications() {

  const [notifs, setNotifs] = useState([])

  const [toasts, setToasts] = useState([])
  const [adminTheme, setAdminTheme] = useState(false)



  useEffect(() => {

    const on = (e) => {

      const n = e.detail

      setAdminTheme(Boolean(document.querySelector('.admin-shell')))
      setNotifs((prev) => [...prev, { ...n, id: Date.now() + Math.random() }])

    }

    const onToast = (e) => {

      const id = Date.now() + Math.random()

      setAdminTheme(Boolean(document.querySelector('.admin-shell')))
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

    <div className={`player-notification-layer${adminTheme ? ' admin-theme' : ''}`}>

      {notifs.map((n) => (

        <NotificationCard key={n.id} notif={n} onDismiss={() => dismiss(n.id)} />

      ))}

      {toasts.map((t) => (

        <div key={t.id} className="msg">

          {t.text}

        </div>

      ))}

    </div>

  )

}



function WinGoResultCard({ notif, onDismiss, progress }) {
  const isWin = notif.type === 'win'
  const number = notif.resultNumber
  const resultColor = number === 0
    ? 'Red + Violet'
    : number === 5
      ? 'Green + Violet'
      : number % 2 === 0 ? 'Red' : 'Green'
  const resultTone = number % 2 === 0 ? 'red' : 'green'

  return (
    <div className="win-go-result-overlay">
      <section className="win-go-result-card" role="dialog" aria-modal="true" aria-label="WIN GO result">
        <button type="button" className="win-go-result-close" onClick={onDismiss} aria-label="Close result">×</button>
        <div className="win-go-result-medallion" aria-hidden="true">✦</div>
        <h2>{isWin ? 'Congratulations' : 'Round complete'}</h2>
        <div className="win-go-result-tags">
          <span>Lottery result</span>
          <b className={`win-go-result-chip ${resultTone}`}>{resultColor}</b>
          <b className="win-go-result-chip number">{number}</b>
          <b className="win-go-result-chip size">{number >= 5 ? 'Big' : 'Small'}</b>
        </div>
        <div className="win-go-result-payout">
          <span>{isWin ? 'Net win' : 'Net loss'}</span>
          <strong className={isWin ? 'win' : 'loss'}>{notif.message}</strong>
          <small>{notif.periodTitle} · Period #{notif.periodNumber}</small>
          <small>Bet ₹{f(notif.betAmount)} · Return ₹{f(notif.returnAmount)}</small>
        </div>
        <p className="win-go-result-autoclose"><span aria-hidden="true">✓</span> {Math.ceil((notif.autoClose || 3000) / 1000)} seconds auto close</p>
        <div className="win-go-result-progress"><i style={{ width: `${progress}%` }} /></div>
      </section>
    </div>
  )
}

function NotificationCard({ notif, onDismiss }) {

  const { type, title, message, details, autoClose = 2000, center = false, resultNumber } = notif

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

  if (center && Number.isInteger(resultNumber)) {
    return <WinGoResultCard notif={notif} onDismiss={onDismiss} progress={progress} />
  }

  

  // Top card for WIN GO (net result) - overlaps main game card

  if (center) {

    return (

      <div className="winloss-card" style={{

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
        color: 'var(--tx)',

        borderRadius: '10px',

        boxShadow: '0 8px 24px #000a',

        bottom: 'auto',

        border: '1px solid var(--ln)',

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

        <div style={{ fontSize: 16, fontWeight: 700, color: isWin ? 'var(--win)' : 'var(--bad)', marginBottom: 4 }}>

          {isWin ? 'NET PROFIT' : 'NET LOSS'}

        </div>

        <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 6, fontWeight: 500 }}>{title}</div>

        <div style={{ fontSize: 22, fontWeight: 800, color: isWin ? 'var(--win)' : 'var(--bad)' }}>

          {message}

        </div>

        {/* Animated timeout progress bar - joined to bottom edge */}

        <div className="winloss-progress" style={{

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

              background: isWin ? 'var(--win)' : 'var(--bad)',

              transition: 'width 0.05s linear'

            }} 

          />

        </div>

      </div>

    )

  }

  

  // Win/Loss - detailed card at top, overlapping game card (like WIN GO)

  return (

    <div className="winloss-card" style={{

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
      color: 'var(--tx)',

      borderRadius: '10px',

      boxShadow: '0 8px 24px #000a',

      bottom: 'auto',

      border: '1px solid var(--ln)',

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

      <div style={{ fontSize: 16, fontWeight: 700, color: isWin ? 'var(--win)' : 'var(--bad)', marginBottom: 4 }}>

        {isWin ? 'WIN' : 'LOSS'}

      </div>

      <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 6, fontWeight: 500 }}>{title}</div>

      <div style={{ fontSize: 22, fontWeight: 800, color: isWin ? 'var(--win)' : 'var(--bad)' }}>

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

            background: isWin ? 'var(--win)' : 'var(--bad)',

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
  const recentListRef = useRef(null)
  const [game, setGame] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('rs-game') || null
    }
    return null
  })
  const [colorPeriodKey, setColorPeriodKey] = useState('wgo_30')

  const [amt, setAmt] = useState(10)
  const [walletTab, setWalletTab] = useState('d')
  const [activityTab, setActivityTab] = useState('bets')
  const [messageTab, setMessageTab] = useState('notifications')

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

  const openMessages = (tab = 'notifications') => {
    setMessageTab(tab)
    go('messages')
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
  const scrollRecentGames = direction => {
    const list = recentListRef.current
    if (list) list.scrollBy({ left: direction * Math.max(list.clientWidth * 0.8, 160), behavior: 'smooth' })
  }
  const recentGames = GAMES.map(([gameKey, label]) => ({
    gameKey, label, image: GAME_ART[gameKey]
  }))
  const workingMainGames = [
    ...GAMES
      .filter(([gameKey]) => gameKey !== 'color')
      .map(([gameKey, label]) => ({ gameKey, label, image: GAME_ART[gameKey] })),
  ]
  const mainGames = [...workingMainGames, ...OTHER_HOME_GAMES.slice(0, 4)]
  const allGames = [
    ...workingMainGames,
    ...OTHER_HOME_GAMES
  ]

  

  return (

    <>

      <div className={view === 'admin' ? 'player-shell admin-shell' : 'player-shell'}>

      {view !== 'admin' && <header className="player-header">

        <span className="logo" style={{ cursor: 'pointer' }} onClick={() => go('home')}>♠ Royal Spin</span>

        <div className="player-header-actions">
          <button className="player-balance" type="button" onClick={() => openWallet('d')}>
            <span>Total balance</span><b>{u.hide_balance ? '••••' : `₹${f(u.balance)}`}</b>
          </button>
          <button className="player-account-button" type="button" onClick={() => openMessages('notifications')} aria-label="Notifications and announcements"><HubIcon name="notifications" /></button>
        </div>

      </header>}

      <main className={view === 'admin' ? '' : 'player-main'}>

        {view === 'home' && <div className="home-page">
          <section className="home-section">
            <div className="home-section-heading home-section-heading-with-actions">
              <h3>Recent</h3>
              <div className="home-section-actions">
                <button type="button" className="home-scroll-button" aria-label="Scroll recent games left" onClick={() => scrollRecentGames(-1)}>‹</button>
                <button type="button" className="home-scroll-button" aria-label="Scroll recent games right" onClick={() => scrollRecentGames(1)}>›</button>
              </div>
            </div>
            <div className="recent-game-list" ref={recentListRef}>
              {recentGames.map(item => <HomeGameCard key={item.gameKey} item={item} cfg={cfg} onOpen={gameKey => go('game', gameKey)} variant="recent-game-card" />)}
            </div>
          </section>

          <section className="home-section">
            <div className="home-section-heading home-section-heading-with-actions">
              <h3>Main</h3>
              <button type="button" className="home-view-more" onClick={() => go('all-games')}>View more <span aria-hidden="true">→</span></button>
            </div>
            <div className="home-game-grid">
              {mainGames.map((item, index) => <HomeGameCard key={item.gameKey || item.image + index} item={item} cfg={cfg} onOpen={gameKey => go('game', gameKey)} />)}
            </div>
          </section>

          <section className="home-section">
            <div className="lottery-section-heading">
              <img src="/games/lottery-logo.svg" alt="" />
              <div><h3>Lottery</h3><p>Number draw games and prediction rounds.</p></div>
            </div>
            <div className="home-game-grid lottery-game-grid">
              {LOTTERY_HOME_GAMES.map(item => <HomeGameCard key={item.label} item={item} cfg={cfg} onOpen={gameKey => go('game', gameKey)} variant="lottery-game-card" />)}
            </div>
          </section>
        </div>}

        {view === 'all-games' && <section className="home-section all-games-page">
          <div className="all-games-title">
            <button type="button" onClick={() => go('home')}>← Home</button>
            <h2>All Games</h2>
          </div>
          <div className="home-game-grid">
            {allGames.map((item, index) => <HomeGameCard key={item.gameKey || item.image + index} item={item} cfg={cfg} onOpen={gameKey => go('game', gameKey)} />)}
          </div>
        </section>}

        {view === 'game' && Game && <>

          <button onClick={() => go('home', null)}>← Games</button>

          <div className="card" style={{ marginTop: 10 }}>

            <b>{GAMES.find((g) => g[0] === game)[1]}</b><p className="small">House edge {cfg.edge?.[game] || 0}%</p>
            {game === 'color' && <ColorPeriodTabs value={colorPeriodKey} onChange={setColorPeriodKey} />}

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

            <div style={{ marginTop: 10 }}><Game key={game} amt={amt} periodKey={colorPeriodKey} /></div>
            {game !== 'color' && <GameHistory game={game} />}

          </div></>}

        {view === 'wallet' && <Wallet u={u} me={me} initialTab={walletTab} />}

        {view === 'vault' && <Vault u={u} />}

        {view === 'wager' && <Wager u={u} me={me} />}

        {view === 'bonus' && <Bonus u={u} />}

        {view === 'messages' && <NotificationCenter u={u} announcements={cfg.announcements || []} initialTab={messageTab} />}

        {view === 'referral' && <Referral u={u} />}

        {view === 'profile' && <Profile u={u} me={me} />}

        {view === 'settings' && <Settings u={u} onLogout={logout} />}

        {view === 'admin' && <Admin u={u} />}

        {view === 'activity' && <Activity u={u} onNavigate={go} />}

        {view === 'history' && <ActivityHistory u={u} initialTab={activityTab} />}

        {view === 'gameStats' && <GameStatistics u={u} onBack={() => go('account')} />}

        {view === 'promotion' && <PromotionHub u={u} onNavigate={go} onSupport={openSupport} />}

        {view === 'account' && (
          <AccountHub
            u={u}
            isAdmin={isAdmin}
            onWallet={openWallet}
            onActivity={openActivity}
            onNavigate={go}
            onMessages={openMessages}
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
                  : ['account', 'wallet', 'vault', 'wager', 'bonus', 'profile', 'settings', 'history', 'gameStats', 'messages'].includes(view)
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
