'use client'
import { useEffect, useRef, useState } from 'react'
import { useDB, place, pay, cancelCrashBet, toast, notify, notifySubscribers, f, user, supabase } from '../lib/supabase-db'
import { E, rnd, BETW, G, BLK, sched, cstate, cpOf, crashMult, PERIOD, LOCK, colorResult, colorResultCache, computeLowestBetResult, ballClass } from '../lib/fair'

const FULL = { width: '100%' }
const comb = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r }

// ------------------------------------------------------------------ Dice
export function Dice({ amt }) {
  const [over, setOver] = useState(true), [t, setT] = useState(50)
  const [res, setRes] = useState(null), [spin, setSpin] = useState(null), [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  const ch = over ? 100 - t : t, mult = (100 * E('dice')) / ch
  function roll() {
    if (busy) return
    const a = place('dice', amt); if (!a) return
    setBusy(true); setLastResult(null)
    const x = rnd() * 100, w = over ? x > t : x < t
    setRes({ x, w }); let n = 0
    const iv = setInterval(() => {
      setSpin(Math.random() * 100)
      if (++n > 9) {
        clearInterval(iv); setSpin(null)
        const win = w ? a * mult : 0
        pay('dice', a, win)
        setLastResult({ w, win, a, x })
        if (w) {
          notify({ type: 'win', title: `Dice - ${over ? 'Over' : 'Under'} ${t}`, message: `Win ₹${f(win)}`, details: `Rolled ${f(x)} · Chance ${ch}% · Payout ${f(mult)}×` })
        } else {
          notify({ type: 'loss', title: `Dice - ${over ? 'Over' : 'Under'} ${t}`, message: `Lost ₹${f(a)}`, details: `Rolled ${f(x)} · Chance ${ch}%` })
        }
        setBusy(false)
      }
    }, 70)
  }
  const shown = spin != null ? f(spin) : res ? f(res.x) : '—'
  const color = spin != null || !res ? undefined : res.w ? 'var(--ac)' : 'var(--bad)'
  return (
    <>
      <div className="big" style={{ color }}>{shown}</div>
      
      <div className="dbar" style={{ background: `linear-gradient(90deg,${over ? '#ff5a5a' : '#2ee67a'} ${t}%,${over ? '#2ee67a' : '#ff5a5a'} ${t}%)` }}>
        <div className="mk" style={{ left: (res ? res.x : 50) + '%', opacity: res ? 1 : 0 }}>{res ? f(res.x) : 0}</div>
      </div>
      <div className="chips">
        <button className={over ? 'on' : ''} onClick={() => setOver(true)}>Roll over</button>
        <button className={!over ? 'on' : ''} onClick={() => setOver(false)}>Roll under</button>
      </div>
      <input type="range" min="2" max="98" value={t} onChange={(e) => setT(+e.target.value)} />
      <p className="small">{over ? 'Over' : 'Under'} {t} · chance {ch}% · pays {f(mult)}×</p>
      <p className="small" style={{ color: 'var(--mut)', marginTop: 4 }}>Win multiplier is dynamically calculated based on your target roll. Choose your risk — pays from 1.01× up to 49.50× your bet.</p>
      <button className="p" style={{ ...FULL, opacity: busy ? 0.7 : 1 }} onClick={roll} disabled={busy}>
        {busy ? 'Rolling...' : 'Roll'}
      </button>
    </>
  )
}

// ------------------------------------------------------------------ Limbo
export function Limbo({ amt }) {
  const [tg, setTg] = useState(2), [v, setV] = useState(null), [col, setCol] = useState(undefined), [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  function play() {
    if (busy) return
    const a = place('limbo', amt); if (!a) return
    setBusy(true); setCol(undefined); setLastResult(null)
    const t = Math.min(300, Math.max(1.01, +tg)), r = Math.max(1, Math.floor((100 * E('limbo')) / (rnd() || 1e-9)) / 100), w = r >= t
    const t0 = performance.now(), dur = Math.min(1600, 500 + Math.log10(r) * 600)
    const iv = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / dur)
      setV(1 + (r - 1) * (1 - Math.pow(1 - p, 3)))
      if (p >= 1) {
        clearInterval(iv); setCol(w ? 'var(--ac)' : 'var(--bad)')
        const win = w ? a * t : 0
        pay('limbo', a, win)
        setLastResult({ w, win, a })
        if (w) {
          notify({ type: 'win', title: `Limbo - Target ${f(t)}×`, message: `Win ₹${f(win)}`, details: `Result ${f(r)}× · Target ${f(t)}× · Payout ${f(t)}×` })
        } else {
          notify({ type: 'loss', title: `Limbo - Target ${f(t)}×`, message: `Lost ₹${f(a)}`, details: `Result ${f(r)}× · Target ${f(t)}×` })
        }
        setBusy(false)
      }
    }, 30)
  }
  return (
    <>
      <div className="big" style={{ color: col }}>{v == null ? '—' : f(v) + '×'}</div>
      
      <label>Target multiplier</label>
      <input type="number" step="0.01" min="1.01" max="300" value={tg} onChange={(e) => setTg(Math.min(300, +e.target.value))} />
      <p className="small" style={{ color: 'var(--mut)', marginTop: 6 }}>Set any target multiplier from 1.01× up to 300×. If the rolled number meets or beats your target, you win your bet multiplied by that exact rate.</p>
      <button className="p" style={{ ...FULL, marginTop: 12, opacity: busy ? 0.7 : 1 }} onClick={play} disabled={busy}>
        {busy ? 'Playing...' : 'Play'}
      </button>
    </>
  )
}

// ------------------------------------------------------------------ Mines
const mmul = (m) => { let x = 1; for (let i = 0; i < m.f; i++) x *= (25 - i) / (25 - m.n - i); return x * E('mines') }
export function Mines({ amt }) {
  const [n, setN] = useState(3), [M, setM] = useState(null), [shake, setShake] = useState(false)
  const ref = useRef(null); ref.current = M
  // leaving mid-round cashes out gems, or refunds the stake if none were found
  useEffect(() => () => { const m = ref.current; if (m && m.on) pay('mines', m.a, m.f ? m.a * mmul(m) : m.a) }, [])
  function start() {
    if (M && M.on) return
    const a = place('mines', amt); if (!a) return
    const s = new Set(); while (s.size < n) s.add(Math.floor(rnd() * 25))
    setM({ on: true, n, s, a, f: 0, rev: {} })
    notify({ type: 'bet', title: 'Mines Round Started', message: `Bet ₹${f(a)} · ${n} mines` })
  }
  function pick(i) {
    if (!M || !M.on || M.rev[i]) return
    if (M.s.has(i)) {
      pay('mines', M.a, 0); setM({ ...M, on: false, rev: { ...M.rev, [i]: 'mine' } })
      setShake(true); setTimeout(() => setShake(false), 500)
      notify({ type: 'loss', title: 'Mines - Hit Mine', message: `Lost ₹${f(M.a)}`, details: `Found ${M.f} gems · Multiplier ${f(mmul(M))}×` })
    } else {
      const m2 = { ...M, f: M.f + 1, rev: { ...M.rev, [i]: 'gem' } }
      if (m2.f === 25 - M.n) { const w = M.a * mmul(m2); pay('mines', M.a, w); notify({ type: 'win', title: 'Mines - Cleared Board!', message: `Win ₹${f(w)}`, details: `Found all ${25 - M.n} gems · Multiplier ${f(mmul(m2))}×` }); setM({ ...m2, on: false }) }
      else setM(m2)
    }
  }
  function cash() {
    if (!M || !M.on || !M.f) return
    const w = M.a * mmul(M); pay('mines', M.a, w); notify({ type: 'win', title: 'Mines - Cashed Out', message: `Win ₹${f(w)}`, details: `Found ${M.f} gems · Multiplier ${f(mmul(M))}×` }); setM({ ...M, on: false })
  }
  const on = M && M.on
  return (
    <>
      <label>Mines</label>
      <select value={n} disabled={on} onChange={(e) => setN(+e.target.value)}>
        {Array.from({ length: 24 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
      </select>
      <div className={'grid' + (shake ? ' shake' : '')}>
        {Array.from({ length: 25 }, (_, i) => {
          const r = M && M.rev[i], showMine = M && !M.on && M.s.has(i)
          return (
            <button key={i} className={'t' + (r === 'gem' ? ' gem' : r === 'mine' || showMine ? ' mine' : '')}
              disabled={!on || !!r} onClick={() => pick(i)}>
              {r === 'gem' ? '💎' : r === 'mine' || showMine ? '💣' : ''}
            </button>
          )
        })}
      </div>
      <p className="small">
        {!M && 'Start a round'}
        {on && (M.f ? <b style={{ color: 'var(--ac)' }}>{M.f} gems · {f(mmul(M))}× · cash out ₹{f(M.a * mmul(M))}</b>
          : <><span className="live" style={{ background: 'var(--ac)' }} />Round started · bet ₹{f(M.a)} · {M.n} mines. Pick a tile</>)}
        {M && !on && 'Round over'}
      </p>
      <div className="row">
        <button className="p" onClick={start} disabled={on}>{on ? 'Round live' : M ? 'Play again' : 'Start'}</button>
        <button onClick={cash} disabled={!on || !M.f}>Cash out</button>
      </div>
    </>
  )
}

// ------------------------------------------------------------------ Keno
// Payout ladder for Keno hits 3 to 10 (each has a unique, strictly increasing multiplier up to 300x)
const KENO_PAYOUTS = {
  3: 1.8,
  4: 3.5,
  5: 7.5,
  6: 18.0,
  7: 45.0,
  8: 100.0,
  9: 190.0,
  10: 300.0
}

export function Keno({ amt }) {
  const [K, setK] = useState([]), [drawn, setDrawn] = useState([]), [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  const tog = (i) => !busy && setK((k) => k.includes(i) ? k.filter((x) => x !== i) : k.length < 10 ? [...k, i] : k)

  function play() {
    if (busy) return
    if (!K.length) return toast('Pick at least 1 number (up to 10)')
    const a = place('keno', amt); if (!a) return
    setBusy(true); setDrawn([]); setLastResult(null)
    const d = []; while (d.length < 10) { const x = Math.floor(rnd() * 40); if (!d.includes(x)) d.push(x) }
    const p = K.length
    const h = d.filter((x) => K.includes(x)).length
    const m = (h >= 3 && h <= 10) ? KENO_PAYOUTS[h] : h > 10 ? 300.0 : 0

    d.forEach((x, j) => setTimeout(() => setDrawn((z) => [...z, x]), j * 160))
    setTimeout(() => {
      const winAmt = a * m
      pay('keno', a, winAmt)
      setLastResult({ win: m > 0, net: winAmt - a, h, p })
      if (m > 0) {
        notify({ type: 'win', title: `Keno - ${h} Hits`, message: `Win ₹${f(winAmt)}`, details: `${h}/${p} numbers matched · Payout ${f(m)}×` })
      } else {
        notify({ type: 'loss', title: `Keno - ${h} Hits`, message: `Lost ₹${f(a)}`, details: `${h}/${p} numbers matched (Min 3 hits required to win)` })
      }
      setBusy(false)
    }, 1750)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p className="small" style={{ margin: 0 }}>Pick 1 to 10 numbers ({K.length}/10)</p>
        <span className="small" style={{ color: 'var(--mut)' }}>10 winning numbers drawn</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(8,1fr)' }}>
        {Array.from({ length: 40 }, (_, i) => {
          const sel = K.includes(i), dr = drawn.includes(i)
          const bg = sel && dr ? '#b8860b' : sel ? '#0d6b43' : dr ? '#33495a' : undefined
          return <button key={i} className={'t' + (dr ? ' pop' : '')} style={{ fontSize: 13, background: bg, outline: dr ? (sel ? '3px solid #ffd54f' : '2px solid #ffffff55') : 'none' }} onClick={() => tog(i)}>{i + 1}</button>
        })}
      </div>

      {/* Payout multipliers ladder in small text / badges */}
      <div style={{ marginTop: 12, marginBottom: 8, background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="small" style={{ fontWeight: 700, color: '#fff' }}>Winning Multipliers (Hits 3 to 10):</span>
          <span className="small" style={{ color: 'var(--ac)', fontWeight: 800 }}>Max 300× at 10 hits</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(68px, 1fr))', gap: 6 }}>
          {[
            { h: 3, m: '1.8×' },
            { h: 4, m: '3.5×' },
            { h: 5, m: '7.5×' },
            { h: 6, m: '18×' },
            { h: 7, m: '45×' },
            { h: 8, m: '100×' },
            { h: 9, m: '190×' },
            { h: 10, m: '300×' }
          ].map(item => (
            <div 
              key={item.h} 
              style={{ 
                background: 'rgba(255,255,255,0.04)', 
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6, 
                padding: '4px 6px', 
                textAlign: 'center' 
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--mut)' }}>{item.h} hits</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ac)' }}>{item.m}</div>
            </div>
          ))}
        </div>
        <p className="small" style={{ color: 'var(--mut)', margin: '6px 0 0', fontSize: 11 }}>
          Matching 3 to 10 numbers pays gradually increasing profit multipliers up to 300×. Hits under 3 do not pay.
        </p>
      </div>
      
      <div className="row">
        <button className="p" onClick={play} disabled={busy}>{busy ? 'Drawing...' : 'Draw'}</button>
        <button onClick={() => { setK([]); setDrawn([]); setLastResult(null) }} disabled={busy}>Clear</button>
      </div>
    </>
  )
}

// ------------------------------------------------------------------ Coin flip
export function Flip({ amt }) {
  const [side, setSide] = useState('Heads'), [rot, setRot] = useState(0), [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const scene = useRef(null)
  function flip() {
    if (busy) return
    const a = place('flip', amt); if (!a) return
    setBusy(true); setLastResult(null)
    const r = rnd() < 0.5 ? 'Heads' : 'Tails'
    setRot(rot - (rot % 360) + 1800 + (r === 'Tails' ? 180 : 0))
    const el = scene.current; el.classList.remove('toss'); void el.offsetWidth; el.classList.add('toss')
    setTimeout(() => {
      const w = r === side, win = a * 2 * E('flip')
      pay('flip', a, w ? win : 0)
      setLastResult({ w, win, a, r })
      if (w) {
        notify({ type: 'win', title: `Coin Flip - ${side}`, message: `Win ₹${f(win)}`, details: `Result: ${r} · Payout ${f(2 * E('flip'))}×` })
      } else {
        notify({ type: 'loss', title: `Coin Flip - ${side}`, message: `Lost ₹${f(a)}`, details: `Result: ${r}` })
      }
      setBusy(false)
    }, 1450)
  }
  return (
    <>
      <div className="scene" ref={scene}>
        <div className="coin" style={{ transform: `rotateY(${rot}deg)` }}>
          <div className="face">H</div><div className="face b">T</div>
        </div>
      </div>
      <div className="chips">
        {['Heads', 'Tails'].map((s) => <button key={s} className={side === s ? 'on' : ''} onClick={() => setSide(s)}>{s}</button>)}
      </div>
      
      <p className="small">Pays {f(2 * E('flip'))}×</p>
      <button className="p" style={{ ...FULL, opacity: busy ? 0.7 : 1 }} onClick={flip} disabled={busy}>
        {busy ? 'Flipping...' : 'Flip'}
      </button>
    </>
  )
}

// ------------------------------------------------------------------ Live Crash
function draw(cv, s) {
  if (!cv) return
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, pad = 36
  x.clearRect(0, 0, W, H); x.strokeStyle = '#ffffff12'; x.lineWidth = 1
  for (let k = 1; k < 5; k++) { x.beginPath(); x.moveTo(0, (H * k) / 5); x.lineTo(W, (H * k) / 5); x.stroke() }
  if (s.st === 'bet') return
  const top = Math.max(2, s.m * 1.3), tt = Math.max(4, s.t * 1.12)
  const X = (e) => pad + (e / tt) * (W - 2 * pad), Y = (v) => H - pad - ((v - 1) / (top - 1)) * (H - 2 * pad)
  const col = s.st === 'crash' ? '#ff5a5a' : '#2ee67a', ex = X(s.t), ey = Y(s.m)
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, col + '66'); gr.addColorStop(1, col + '00')
  const trace = () => { x.beginPath(); x.moveTo(X(0), Y(1)); for (let k = 1; k <= 80; k++) { const e = (s.t * k) / 80; x.lineTo(X(e), Y(crashMult(e))) } }
  trace(); x.lineTo(ex, H - pad); x.lineTo(X(0), H - pad); x.closePath(); x.fillStyle = gr; x.fill()
  trace(); x.strokeStyle = col; x.lineWidth = 6; x.lineJoin = 'round'; x.shadowColor = col; x.shadowBlur = 18; x.stroke(); x.shadowBlur = 0
  x.beginPath(); x.arc(ex, ey, s.st === 'crash' ? 11 : 8 + Math.sin(Date.now() / 120) * 2, 0, 7)
  x.fillStyle = s.st === 'crash' ? '#ff5a5a' : '#fff'; x.fill()
}

export function Crash({ amt }) {
  const D = useDB()
  const cv = useRef(null), [s, setS] = useState(() => cstate())
  const [cbet, setCbet] = useState(() => user()?.cbet || null)

  useEffect(() => {
    const iv = setInterval(() => {
      const st = cstate()
      setS(st)
      draw(cv.current, st)
      const curUser = user()
      const myP = curUser?.cbet
      if (st.st === 'crash' && myP && !myP.out && myP.i === st.i) {
        myP.out = 1
        setCbet(null)
        if (curUser) delete curUser.cbet
        pay('crash', myP.a, 0, undefined, { round_id: st.i, multiplier: st.m, status: 'crashed' })
        notify({ 
          type: 'loss', 
          title: 'Crash - Crashed', 
          message: 'Lost ₹' + f(myP.a), 
          details: 'Crashed at ' + f(st.m) + '×' 
        })
      }
    }, 100)
    return () => clearInterval(iv)
  }, [])

  const u = user()
  const P = cbet || u?.cbet

  async function act() {
    const st = cstate()
    // Cash out active flight
    if (P && !P.out && P.i === st.i && st.st === 'fly') {
      P.out = 1
      setCbet(null)
      if (u) delete u.cbet
      const w = P.a * st.m
      pay('crash', P.a, w, undefined, { round_id: st.i, multiplier: st.m, status: 'cashed_out' })
      notify({ type: 'win', title: 'Crash - Cashed Out', message: 'Win ₹' + f(w), details: 'Cashed out at ' + f(st.m) + '×' })
      return
    }
    // Block duplicate bets for same round
    if (P && !P.out && P.i >= st.i) return toast('Bet already placed')

    const a = place('crash', amt)
    if (!a) return
    const newBet = { i: st.st === 'bet' ? st.i : st.ni, a, out: 0 }
    if (u) u.cbet = newBet
    setCbet(newBet)
    notify({ type: 'bet', title: 'Bet Placed', message: st.st === 'bet' ? `Bet ₹${f(amt)} placed` : `Bet ₹${f(amt)} queued for next round` })
  }

  async function cancelBet() {
    if (P && !P.out) {
      const refund = P.a
      setCbet(null)
      if (u) delete u.cbet
      cancelCrashBet(refund)
      notify({ type: 'bet', title: 'Bet Cancelled', message: `₹${f(refund)} returned to balance` })
    }
  }

  const mine = P && !P.out && P.i === s.i, q = P && !P.out && P.i > s.i, co = mine && s.st === 'fly', crashed = s.st === 'crash'
  const canCancel = (mine || q) && s.st === 'bet' && !co
  const label = mine ? (co ? `Cash out ₹${f(P.a * s.m)}` : s.st === 'bet' ? 'Bet placed ✓' : 'Settling') : q ? 'Queued for next round ✓' : s.st === 'bet' ? `Bet ₹${f(amt)}` : `Bet next round ₹${f(amt)}`
  const bk = Math.floor(Date.now() / BLK)
  const hist = sched(bk - 1).concat(sched(bk)).filter((r) => r.id < s.i).slice(-12).reverse()

  return (
    <>
      <div className="hist">{hist.map((r) => <b key={r.id} style={{ color: r.cp < 2 ? 'var(--bad)' : 'var(--ac)' }}>{f(r.cp)}×</b>)}</div>
      <div className="row" style={{ margin: '6px 0' }}>
        <span className="small"><span className="live" style={{ background: crashed ? undefined : 'var(--ac)' }} />
          {s.st === 'bet' ? 'Betting open' : crashed ? `Crashed · next round in ${s.nx}s` : 'Round live'}</span>
      </div>
      <div className="bar" style={{ marginBottom: 8 }}>
        <i style={{ width: s.st === 'bet' ? 100 - s.p * 100 + '%' : crashed ? 100 - s.np * 100 + '%' : '100%', background: crashed ? 'var(--bad)' : 'var(--ac)' }} />
      </div>
      <div style={{ position: 'relative' }}>
        <canvas ref={cv} width="800" height="590" style={{ width: '100%', height: 'auto', display: 'block' }} />
        <div className="big" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontSize: 56, pointerEvents: 'none' }}>
          {s.st === 'bet'
            ? <><div style={{ fontSize: 72 }}>{s.left}</div><div className="small">Betting open. Place your bet</div></>
            : <><div style={{ color: crashed ? 'var(--bad)' : s.m >= 10 ? '#ffd54f' : 'var(--ac)' }}>{f(s.m)}×</div><div className="small">{crashed ? `Crashed. Next round in ${s.nx}s` : 'Flying'}</div></>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="p" style={{ ...FULL, flex: 1, background: co ? '#ffd54f' : canCancel ? 'var(--bad)' : undefined }} onClick={act}>{label}</button>
        {canCancel && <button className="p" style={{ ...FULL, flex: 1, background: 'var(--bad)' }} onClick={cancelBet}>Cancel Bet</button>}
      </div>
      <p className="small">Multiplier begins at 1.00× and accelerates smoothly. Cash out anytime before the crash to win your bet multiplied by the live flight rate.</p>
    </>
  )
}

// ------------------------------------------------------------------ Color trading
const PAY = { green: '1.96×', violet: '4.4×', red: '1.96×' }
const BTN = { green: '#2e9e5b', violet: '#8e44ad', red: '#e53935' }
const sizeOf = (n) => (n >= 5 ? 'Big' : 'Small')
const sizeCol = (n) => (n >= 5 ? '#f59e0b' : '#3b82f6')
const cname = (n) => (n === 0 ? 'Red + Violet' : n === 5 ? 'Green + Violet' : n % 2 ? 'Green' : 'Red')
export function Color({ amt }) {
  const [now, setNow] = useState(() => Date.now()), [sel, setSel] = useState(null)
  const [myBets, setMyBets] = useState([])
  const [historyPage, setHistoryPage] = useState(0)
  const [placing, setPlacing] = useState(false)
  
  const [, setRndTick] = useState(0)
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(iv) }, [])
  const id = Math.floor(now / PERIOD), left = Math.ceil(((id + 1) * PERIOD - now) / 1000), locked = left * 1000 <= LOCK
  const u = user()

  // Load this user's bets for current period from Supabase or memory
  useEffect(() => {
    async function loadPeriodBets() {
      const curUser = user()
      if (!curUser) return
      try {
        if (curUser.id) {
          const { data } = await supabase
            .from('color_bets')
            .select('*')
            .eq('user_id', curUser.id)
            .eq('period_id', id)
          if (data && data.length) {
            const mapped = data.map(b => ({
              id: b.period_id,
              type: b.bet_type,
              val: b.bet_value,
              amt: Number(b.amount)
            }))
            setMyBets(mapped)
            curUser.cbets = mapped
            return
          }
        }
        if (curUser.cbets && curUser.cbets.length) {
          const matching = curUser.cbets.filter(b => b.id === id)
          if (matching.length) {
            setMyBets(matching)
            return
          }
        }
        setMyBets([])
      } catch (e) {
        if (curUser.cbets) setMyBets(curUser.cbets.filter(b => b.id === id))
      }
    }
    loadPeriodBets()
  }, [id])

  const mine = myBets.filter((b) => b.id === id)

  // Fetch past period results from canonical color_results table, then fall back to computing
  useEffect(() => {
    let cancelled = false
    async function loadPastResults() {
      const pastPeriods = Array.from({ length: 15 }, (_, k) => id - 1 - k)
      const missing = pastPeriods.filter(p => colorResultCache[p] === undefined)
      if (missing.length === 0) return

      try {
        // 1. Read canonical settled results from color_results table
        const { data: results } = await supabase
          .from('color_results')
          .select('period_id, winning_number')
          .in('period_id', missing)

        const fromDB = {}
        results?.forEach(r => { fromDB[r.period_id] = Number(r.winning_number) })

        // 2. For periods not yet in color_results, compute from color_bets
        const stillMissing = missing.filter(p => fromDB[p] === undefined)
        if (stillMissing.length > 0) {
          const { data: bets } = await supabase
            .from('color_bets')
            .select('period_id, bet_type, bet_value, amount')
            .in('period_id', stillMissing)

          const byPeriod = {}
          bets?.forEach(b => {
            if (!byPeriod[b.period_id]) byPeriod[b.period_id] = []
            byPeriod[b.period_id].push(b)
          })

          stillMissing.forEach(p => {
            fromDB[p] = computeLowestBetResult(p, byPeriod[p] || [])
          })
        }

        if (cancelled) return
        Object.assign(colorResultCache, fromDB)
        setRndTick(t => t + 1)
      } catch (e) {
        console.error('Failed to load past color results:', e)
      }
    }
    loadPastResults()
    return () => { cancelled = true }
  }, [id])

    const last = colorResult(id - 1)
  const totalPast = Array.from({ length: 100 }, (_, k) => id - 1 - k)
  const past = totalPast.slice(historyPage * 10, (historyPage + 1) * 10)
  const same = (a, b) => a && b && a.type === b.type && a.val === b.val
  const pick = (type, val) => setSel({ type, val })
  async function bet() {
    if (!sel) return toast('Choose a colour, number or size')
    if (locked) return toast('Betting is locked for the last 5 seconds')
    const curUser = user()
    if (!curUser) return toast('Please login first')
    const a = place('color', amt)
    if (!a) return

    const placedOption = name(sel)
    const newBet = { id, type: sel.type, val: sel.val, amt: a }
    curUser.cbets = curUser.cbets || []
    curUser.cbets.push(newBet)
    setMyBets(prev => [...prev.filter(b => b.id === id), newBet])

    // Clear selection so the button and buttons reset cleanly
    setSel(null)
    

    // Insert into color_bets
    try {
      const betPayload = {
        period_id: id,
        bet_type: newBet.type,
        bet_value: String(newBet.val),
        amount: a,
        settled: false,
        win_amount: 0
      }
      if (curUser.id) betPayload.user_id = curUser.id
      const { error: cbErr } = await supabase.from('color_bets').insert(betPayload)
      if (cbErr) console.error('color_bets insert error:', JSON.stringify(cbErr))
    } catch (err) {
      console.error('Failed to insert color_bet:', err)
    }

    setPlacing(false)
    notify({ type: 'bet', title: 'Color Trading', message: 'Bet ₹' + f(a) + ' placed on ' + placedOption })
    
  }
  const name = (b) => { if (!b) return ''; if (b.type === 'num') return 'Number ' + b.val; const s = String(b.val || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  return (
    <>
      <div className="row" style={{ alignItems: 'center' }}>
        <div><div className="small">Period</div><b>#{id}</b></div>
        <div style={{ textAlign: 'center' }}><div className="small">Closes in</div><b style={{ fontSize: 22 }}>0:{String(left).padStart(2, '0')}</b></div>
        <div style={{ textAlign: 'right' }}><div className="small">Last result</div>
          {last !== null && last !== undefined
            ? <><span className={'ball sm ' + ballClass(last)}>{last}</span> <b style={{ color: sizeCol(last) }}>{sizeOf(last)}</b></>
            : <span style={{ color: 'var(--mut)', fontSize: 12 }}>…</span>
          }</div>
      </div>
      <div style={{ position: 'relative', marginTop: 12, padding: '14px 0', minHeight: 340, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
        {locked && <div className="lock">{left}</div>}
        <div className="row">
          {['green', 'violet', 'red'].map((c) => (
            <button key={c} className={'cbtn' + (same(sel, { type: 'color', val: c }) ? ' sel' : '')} style={{ background: BTN[c] }} onClick={() => pick('color', c)}>
              {c[0].toUpperCase() + c.slice(1)}<div className="small" style={{ color: '#fffc' }}>{PAY[c]}</div>
            </button>
          ))}
        </div>
        <div className="numgrid">
          {Array.from({ length: 10 }, (_, n) => (
            <button key={n} className={'ball ' + ballClass(n) + (same(sel, { type: 'num', val: n }) ? ' sel' : '')} onClick={() => pick('num', n)}>{n}</button>
          ))}
        </div>
        <div className="row">
          {['big', 'small'].map((z) => (
            <button key={z} className={'cbtn sm' + (same(sel, { type: 'size', val: z }) ? ' sel' : '')} style={{ background: z === 'big' ? '#f59e0b' : '#3b82f6' }} onClick={() => pick('size', z)}>
              {z === 'big' ? 'Big (5-9)' : 'Small (0-4)'}<div className="small" style={{ color: '#fffc' }}>1.96×</div>
            </button>
          ))}
        </div>
      </div>
      <p className="small">Number pays 8.8×. If 0 or 5 lands, it counts as red or green at 1.47× and also as violet (4.4×). Red and Green pay 1.96×, Big and Small pay 1.96×.</p>
      
      <button className="p" style={{ ...FULL, opacity: (locked || placing) ? 0.6 : 1 }} onClick={bet} disabled={locked || placing}>
        {placing ? 'Placing bet...' : sel ? `Bet ₹${f(amt)} on ${name(sel)}` : 'Choose an option'}
      </button>
      {mine.length > 0 && <div className="card" style={{ marginTop: 12, marginBottom: 0, background: 'var(--bg)' }}><b>Your bets this period</b>
        <table><tbody>{mine.map((b, i) => <tr key={i}><td>{name(b)}</td><td>₹{f(b.amt)}</td></tr>)}</tbody></table></div>}

      <div className="card" style={{ marginTop: 12, marginBottom: 0, background: 'var(--bg)' }}>
        <b>History</b>
        <table>
          <thead><tr><th>Period</th><th>Number</th><th>Big / Small</th><th>Colour</th></tr></thead>
          <tbody>{past.map((p) => {
            const n = colorResult(p)
            if (n === null || n === undefined) {
              return <tr key={p}><td>#{p}</td><td colSpan="3" style={{ color: 'var(--mut)', fontSize: 12 }}>Loading...</td></tr>
            }
            return <tr key={p}><td>#{p}</td><td><span className={'ball sm ' + ballClass(n)}>{n}</span></td><td style={{ color: sizeCol(n), fontWeight: 700 }}>{sizeOf(n)}</td><td>{cname(n)}</td></tr>
          })}</tbody>
        </table>
      </div>
    </>
  )
}
