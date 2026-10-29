'use client'

import Admin from './Admin'

import { useEffect, useRef, useState } from 'react'

import { 

  db, useDB, getMe, setMe, user, toast, f, 

  signup, login, adminLogin, refreshUser,

  createRequest, getAllUsers, getAllBets, getAllRequests,

  updateRequest, updateUser, updateConfig, isAdminPhone

} from '../lib/supabase-db'

import { tick } from '../lib/tick'

import { GAMES, ICON } from './meta'

import { Dice, Limbo, Mines, Keno, Flip, Crash, Color } from './Games'

import { Wallet, Vault, Wager, Bonus, Profile, Settings } from './Pages'



const COMP = { dice: Dice, limbo: Limbo, mines: Mines, keno: Keno, flip: Flip, crash: Crash, color: Color }

const MENU = [['home', 'Games'], ['wallet', 'Wallet'], ['vault', 'Vault'], ['wager', 'Wager'], ['bonus', 'Bonus'], ['profile', 'Profile'], ['settings', 'Settings']]



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

        <div key={t.id} className="msg" style={{ animation: 'fin .2s', zIndex: 200 }}>

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

      <div className="msg" style={{ animation: 'fin .2s', zIndex: 100 }}>{message}</div>

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

            borderRadius: '50%',

            border: 'none',

            background: 'var(--c2)',

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

          borderRadius: '50%',

          border: 'none',

          background: 'var(--c2)',

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

  const [loading, setLoading] = useState(false)



  async function go() {

    setLoading(true)

    try {

      if (m === 'signup') {

        if (!/^\d{10}$/.test(ph)) return toast('Enter a 10 digit number')

        if (pw.length < 6) return toast('Password min 6 characters')

        if (pw !== cp) return toast('Passwords do not match')

        if (un && un.length < 3) return toast('Username min 3 characters')

        if (isAdminPhone(ph)) return toast('Cannot register as admin')

        

        const res = await signup(ph, pw, un || undefined)

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

    <div className="auth"><div className="card">

      <div className="logo" style={{ fontSize: 22 }}>♠ Royal Spin</div>

      <p className="small">Enter your credentials to continue.</p>

      <div className="row">

        <button className={m === 'login' ? 'p' : ''} onClick={() => setM('login')}>Login</button>

        <button className={m === 'signup' ? 'p' : ''} onClick={() => setM('signup')}>Sign up</button>

      </div>

      <label>Mobile number</label>

      <input inputMode="numeric" placeholder="10 digit number" value={ph} onChange={(e) => setPh(e.target.value.trim())} />

      <label>Password</label>

      <input type="password" placeholder="min 6 characters" value={pw} onChange={(e) => setPw(e.target.value)} />

      {m === 'signup' && <>

        <label>Username (optional)</label>

        <input placeholder="Choose username" value={un} onChange={(e) => setUn(e.target.value.trim())} />

        <label>Confirm password</label>

        <input type="password" placeholder="re-enter password" value={cp} onChange={(e) => setCp(e.target.value)} />

      </>}

      <button className="p" style={{ width: '100%', marginTop: 14 }} onClick={go} disabled={loading}>

        {loading ? '...' : m === 'login' ? 'Login' : 'Create account'}

      </button>

    </div></div>

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

  const [amt, setAmt] = useState(10), [open, setOpen] = useState(false), menuRef = useRef(null)

  useEffect(() => { const iv = setInterval(tick, 200); return () => clearInterval(iv) }, [])

  useEffect(() => {

    const c = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }

    document.addEventListener('mousedown', c)

    return () => document.removeEventListener('mousedown', c)

  }, [])

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
    setOpen(false)
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

  

  const menuItems = isAdmin 

    ? [...MENU, ['admin', 'Admin Panel']]

    : MENU

  

  return (

    <>

      <header>

        <span className="logo" style={{ cursor: 'pointer' }} onClick={() => go('home')}>♠ Royal Spin</span>

        <div className="row" style={{ flex: 'none', gap: 10 }}>

          <span className="bal" style={{ cursor: 'pointer' }} onClick={() => go('wallet')}>{u.hide_balance ? '••••' : '₹' + f(u.balance)}</span>

          <button className="p" style={{ padding: '8px 12px' }} onClick={() => go('wallet')}>+</button>

          <div className="menu" ref={menuRef}>

            <button className="av" onClick={() => setOpen((o) => !o)}>👤</button>

            {open && <div className="dd">{menuItems.map(([k, l]) => <button key={k} onClick={() => go(k)}>{l}</button>)}<button onClick={logout}>Log out</button></div>}

          </div>

        </div>

      </header>

      <main key={view + game}>

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

                        <label>Bet amount</label>
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

            <div style={{ marginTop: 10 }}><Game amt={amt} /></div>

          </div></>}

        {view === 'wallet' && <Wallet u={u} me={me} />}

        {view === 'vault' && <Vault u={u} />}

        {view === 'wager' && <Wager u={u} me={me} />}

        {view === 'bonus' && <Bonus u={u} />}

        {view === 'profile' && <Profile u={u} me={me} />}

        {view === 'settings' && <Settings u={u} onLogout={logout} />}

        {view === 'admin' && <Admin u={u} />}

      </main>

    </>

  )

}

