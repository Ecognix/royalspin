'use client'
import { useEffect, useRef, useState } from 'react'
import { db, useDB, commit, getMe, setMe, user, toast, f, newUser } from '../lib/db'
import { tick } from '../lib/tick'
import { GAMES, ICON } from './meta'
import { Dice, Limbo, Mines, Keno, Flip, Crash, Color } from './Games'
import { Wallet, Vault, Wager, Bonus, Profile, Settings } from './Pages'

const COMP = { dice: Dice, limbo: Limbo, mines: Mines, keno: Keno, flip: Flip, crash: Crash, color: Color }
const MENU = [['home', 'Games'], ['wallet', 'Wallet'], ['vault', 'Vault'], ['wager', 'Wager'], ['bonus', 'Bonus'], ['profile', 'Profile'], ['settings', 'Settings']]

// Notification system - supports both simple toasts and detailed result cards
export function Notifications() {
  const [notifs, setNotifs] = useState([])
  useEffect(() => {
    const on = (e) => {
      const n = e.detail
      setNotifs((prev) => [...prev, { ...n, id: Date.now() + Math.random() }])
    }
    window.addEventListener('rs-notify', on)
    return () => window.removeEventListener('rs-notify', on)
  }, [])
  const dismiss = (id) => setNotifs((prev) => prev.filter((n) => n.id !== id))
  return (
    <>
      {notifs.map((n) => (
        <NotificationCard key={n.id} notif={n} onDismiss={() => dismiss(n.id)} />
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
      <div className="msg" style={{ 
        maxWidth: 360, 
        padding: 20, 
        textAlign: 'center',
        animation: 'slideDown .3s cubic-bezier(.3,1.6,.5,1)',
        zIndex: 100,
        position: 'fixed',
        top: 'calc(70px + env(safe-area-inset-top,0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--c1)',
        border: '1px solid var(--ln)',
        borderRadius: '12px',
        boxShadow: '0 12px 32px #000a'
      }}>
        <button 
          onClick={onDismiss}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--c2)',
            color: 'var(--mut)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >×</button>
        <div style={{ fontSize: 22, fontWeight: 700, color: isWin ? 'var(--ac)' : 'var(--bad)', marginBottom: 6 }}>
          {isWin ? 'NET PROFIT' : 'NET LOSS'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--tx)', marginBottom: 10, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: isWin ? 'var(--ac)' : 'var(--bad)', marginBottom: 12 }}>
          {isWin ? '+' : ''}₹{message.replace(/[^0-9.]/g, '')}
        </div>
        {details && <div style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.5, fontWeight: 400 }}>{details}</div>}
        {/* Animated timeout progress bar */}
        <div style={{ 
          height: 3, 
          borderRadius: 2, 
          background: 'var(--c2)', 
          overflow: 'hidden',
          marginTop: 12
        }}>
          <div 
            style={{ 
              height: '100%', 
              width: `${progress}%`, 
              background: isWin ? 'var(--ac)' : 'var(--bad)',
              transition: 'width 0.05s linear',
              borderRadius: 2
            }} 
          />
        </div>
      </div>
    )
  }
  
  // Win/Loss - detailed card at bottom, overlapping game card
  return (
    <div className="winloss-card" style={{ 
      maxWidth: 320, 
      padding: 14, 
      textAlign: 'center',
      animation: 'slideUp .3s cubic-bezier(.3,1.6,.5,1)',
      zIndex: 100,
      position: 'relative'
    }}>
      <button 
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: 'none',
          background: 'var(--c2)',
          color: 'var(--mut)',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >×</button>
      <div style={{ fontSize: 16, fontWeight: 700, color: isWin ? 'var(--ac)' : 'var(--bad)', marginBottom: 4 }}>
        {isWin ? 'WIN' : 'LOSS'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx)', marginBottom: 6, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: isWin ? 'var(--ac)' : 'var(--bad)', marginBottom: 8 }}>
        {isWin ? '+' : ''}₹{message.replace(/[^0-9.]/g, '')}
      </div>
      {details && <div style={{ fontSize: 10, color: 'var(--mut)', lineHeight: 1.4, fontWeight: 400, marginBottom: 8 }}>{details}</div>}
      {/* Animated timeout progress bar */}
      <div style={{ 
        height: 3, 
        borderRadius: 2, 
        background: 'var(--c2)', 
        overflow: 'hidden',
        marginTop: 4
      }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${progress}%`, 
            background: isWin ? 'var(--ac)' : 'var(--bad)',
            transition: 'width 0.05s linear',
            borderRadius: 2
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
  const [m, setM] = useState('login'), [ph, setPh] = useState(''), [pw, setPw] = useState(''), [cp, setCp] = useState('')
  function go() {
    const D = db()
    if (m === 'signup') {
      if (!/^\d{10}$/.test(ph)) return toast('Enter a 10 digit number')
      if (pw.length < 6) return toast('Password min 6 characters')
      if (pw !== cp) return toast('Passwords do not match')
      if (D.users[ph]) return toast('Number already registered')
      D.users[ph] = newUser(pw, 'Player ' + ph.slice(-4)); commit()
    } else {
      const u = D.users[ph]
      if (!u || ph === 'admin' || u.pw !== pw) return toast('Wrong number or password')
      if (u.ban) return toast('Account blocked')
    }
    setMe(ph); onIn(ph)
  }
  return (
    <div className="auth"><div className="card">
      <div className="logo" style={{ fontSize: 22 }}>♠ Royal Spin</div>
      <p className="small">Play-money demo. Coins have no cash value.</p>
      <div className="row"><button className={m === 'login' ? 'p' : ''} onClick={() => setM('login')}>Login</button><button className={m === 'signup' ? 'p' : ''} onClick={() => setM('signup')}>Sign up</button></div>
      <label>Mobile number</label><input inputMode="numeric" placeholder="10 digit number" value={ph} onChange={(e) => setPh(e.target.value.trim())} />
      <label>Password</label><input type="password" placeholder="min 6 characters" value={pw} onChange={(e) => setPw(e.target.value)} />
      {m === 'signup' && <><label>Confirm password</label><input type="password" placeholder="re-enter password" value={cp} onChange={(e) => setCp(e.target.value)} /></>}
      <button className="p" style={{ width: '100%', marginTop: 14 }} onClick={go}>{m === 'login' ? 'Login' : 'Create account'}</button>
    </div></div>
  )
}

function Main() {
  useDB()
  const [me, setM] = useState(() => getMe()), [view, setView] = useState('home'), [game, setGame] = useState(null)
  const [amt, setAmt] = useState(10), [open, setOpen] = useState(false), menuRef = useRef(null)
  useEffect(() => { const iv = setInterval(tick, 200); return () => clearInterval(iv) }, [])
  useEffect(() => {
    const c = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', c)
    return () => document.removeEventListener('mousedown', c)
  }, [])
  const u = me ? user() : null
  if (!u || u.admin) return <Auth onIn={setM} />
  const go = (v, g) => { setView(v); if (g) setGame(g); setOpen(false) }
  const logout = () => { setMe(null); setM(null); setView('home') }
  const Game = COMP[game]
  return (
    <>
      <header>
        <span className="logo" style={{ cursor: 'pointer' }} onClick={() => go('home')}>♠ Royal Spin</span>
        <div className="row" style={{ flex: 'none', gap: 10 }}>
          <span className="bal" style={{ cursor: 'pointer' }} onClick={() => go('wallet')}>{u.hide ? '••••' : '₹' + f(u.bal)}</span>
          <button className="p" style={{ padding: '8px 12px' }} onClick={() => go('wallet')}>+</button>
          <div className="menu" ref={menuRef}>
            <button className="av" onClick={() => setOpen((o) => !o)}>👤</button>
            {open && <div className="dd">{MENU.map(([k, l]) => <button key={k} onClick={() => go(k)}>{l}</button>)}<button onClick={logout}>Log out</button></div>}
          </div>
        </div>
      </header>
      <main key={view + game}>
        {view === 'home' && <>
          <h3>Choose a game</h3>
          <div className="tiles">{GAMES.map(([k, n, c]) => {
            const [a, b] = c.split(',')
            return <button key={k} className={'tile' + (db().cfg.on[k] ? '' : ' off')} style={{ background: `linear-gradient(135deg,${a},${b})` }} onClick={() => go('game', k)}>
              <svg viewBox="0 -2 100 100">{ICON[k]}</svg><span>{n}</span></button>
          })}</div></>}
        {view === 'game' && Game && <>
          <button onClick={() => go('home')}>← Games</button>
          <div className="card" style={{ marginTop: 10 }}>
            <b>{GAMES.find((g) => g[0] === game)[1]}</b><p className="small">House edge {db().cfg.edge[game]}%</p>
            <label>Bet amount</label>
            <div className="row"><input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} />
              <button onClick={() => setAmt(Math.max(1, amt / 2))}>½</button><button onClick={() => setAmt(amt * 2)}>2×</button></div>
            <div style={{ marginTop: 10 }}><Game amt={amt} /></div>
          </div></>}
        {view === 'wallet' && <Wallet u={u} me={me} />}
        {view === 'vault' && <Vault u={u} />}
        {view === 'wager' && <Wager u={u} me={me} />}
        {view === 'bonus' && <Bonus u={u} />}
        {view === 'profile' && <Profile u={u} me={me} />}
        {view === 'settings' && <Settings u={u} onLogout={logout} />}
      </main>
    </>
  )
}
