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

import { useEffect, useRef, useState } from 'react'

import { 

  db, useDB, getMe, setMe, user, toast, f, 

  signup, login, adminLogin, refreshUser, notifySubscribers,

  createRequest, getAllUsers, getAllBets, getAllRequests,

  updateRequest, updateUser, updateConfig, isAdminPhone, supabase

} from '../lib/supabase-db'

import { tick } from '../lib/tick'

import { GAMES, ICON } from './meta'

import { Dice, Limbo, Mines, Keno, Flip, Crash, Color } from './Games'

import { Wallet, Vault, Wager, Bonus, Referral, Profile, Settings } from './Pages'



const COMP = { dice: Dice, limbo: Limbo, mines: Mines, keno: Keno, flip: Flip, crash: Crash, color: Color }

const MENU = [['home', 'Games'], ['wallet', 'Wallet'], ['vault', 'Vault'], ['wager', 'Wager'], ['bonus', 'Bonus'], ['referral', 'Refer & Earn'], ['profile', 'Profile'], ['settings', 'Settings']]



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

  const [referralCode] = useState(() => (
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('ref') || ''
  ))

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

        

        const res = await signup(ph, pw, un || undefined, referralCode || undefined)

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

        {referralCode && <p className="small">Referral link applied.</p>}

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

          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#000000', border: '1px solid #222', borderRadius: 20, padding: '3px 4px 3px 12px', gap: 8, height: 38, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            <span style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--ac)', fontSize: 14, whiteSpace: 'nowrap', letterSpacing: '0.2px' }} onClick={() => go('wallet')}>
              {u.hide_balance ? '••••' : '₹' + f(u.balance)}
            </span>
            <button 
              type="button"
              onClick={() => go('wallet')}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--ac)',
                color: '#000000',
                border: 'none',
                fontSize: 18,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                flexShrink: 0
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'block', pointerEvents: 'none' }}>+</span>
            </button>
          </div>

          <div className="menu" ref={menuRef}>

            <button className="av" onClick={() => setOpen((o) => !o)}>👤</button>

            {open && <div className="dd">{menuItems.map(([k, l]) => <button key={k} onClick={() => go(k)}>{l}</button>)}<button onClick={logout}>Log out</button></div>}

          </div>

        </div>

      </header>

      <main>

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

            <div style={{ marginTop: 10 }}><Game key={game} amt={amt} /></div>
            {game !== 'color' && <GameHistory game={game} />}

          </div></>}

        {view === 'wallet' && <Wallet u={u} me={me} />}

        {view === 'vault' && <Vault u={u} />}

        {view === 'wager' && <Wager u={u} me={me} />}

        {view === 'bonus' && <Bonus u={u} />}

        {view === 'referral' && <Referral u={u} />}

        {view === 'profile' && <Profile u={u} me={me} />}

        {view === 'settings' && <Settings u={u} onLogout={logout} />}

        {view === 'admin' && <Admin u={u} />}

      </main>

    </>

  )

}
