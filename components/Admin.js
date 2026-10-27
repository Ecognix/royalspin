'use client'
import { useEffect, useState } from 'react'
import { db, useDB, commit, toast, f, addtx } from '../lib/db'
import { GAMES } from './meta'
import { Toasts } from './App'

// Admin console (route: /console). Separate login, separate session key,
// not linked from the player app. Default login: admin / admin123 (change it in Security).
export default function Admin() {
  const [ok, setOk] = useState(false), [authed, setAuthed] = useState(false)
  useEffect(() => { setOk(true); setAuthed(sessionStorage.getItem('rs-admin') === '1') }, [])
  return <>{ok && (authed ? <Panel onOut={() => { sessionStorage.removeItem('rs-admin'); setAuthed(false) }} /> : <Login onIn={() => { sessionStorage.setItem('rs-admin', '1'); setAuthed(true) }} />)}<Toasts /></>
}

function Login({ onIn }) {
  const [id, setId] = useState(''), [pw, setPw] = useState('')
  const go = () => (id.trim() === 'admin' && db().users.admin.pw === pw ? onIn() : toast('Invalid credentials'))
  return (
    <div className="auth"><div className="card">
      <div className="logo" style={{ fontSize: 20 }}>Admin Console</div><p className="small">Authorized access only.</p>
      <label>Admin ID</label><input autoComplete="off" value={id} onChange={(e) => setId(e.target.value)} />
      <label>Password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <button className="p" style={{ width: '100%', marginTop: 14 }} onClick={go}>Sign in</button>
    </div></div>
  )
}

const TABS = ['over', 'games', 'wallet', 'users', 'bonus', 'logs', 'security']

function Panel({ onOut }) {
  const D = useDB(), c = D.cfg, [at, setAt] = useState('over'), [ap, setAp] = useState('')
  const set = (fn) => { fn(); commit() }
  function rq(id, ok) {
    const r = D.reqs.find((x) => x.id === id), u = D.users[r.u]
    r.status = ok ? 'Approved' : 'Rejected'
    if (r.type === 'Deposit' && ok) { u.bal += r.amt; addtx(u, 'Deposit', r.amt); const b = (r.amt * c.dep) / 100; u.bonus += b; u.bneed += b * c.wr }
    if (r.type === 'Withdraw' && !ok) { u.bal += r.amt; addtx(u, 'Withdraw refunded', r.amt) }
    commit()
  }
  function adj(k) {
    const a = parseFloat(prompt('Add (+) or remove (-) coins')); if (!a) return
    set(() => { D.users[k].bal += a; addtx(D.users[k], 'Admin adjustment', a) })
  }
  const players = Object.keys(D.users).filter((k) => k !== 'admin')
  const vol = D.bets.reduce((s, x) => s + x.a, 0), profit = D.bets.reduce((s, x) => s + x.a - x.w, 0)
  return (
    <>
      <header><span className="logo">♠ Admin Console</span><button className="d" onClick={onOut}>Log out</button></header>
      <main>
        <div className="chips" style={{ marginBottom: 10 }}>{TABS.map((t) => <button key={t} className={t === at ? 'on' : ''} onClick={() => setAt(t)}>{t}</button>)}</div>
        <div className="card">
          {at === 'over' && <table><tbody>
            <tr><td>Players</td><td>{players.length}</td></tr><tr><td>Bets logged</td><td>{D.bets.length}</td></tr>
            <tr><td>Volume</td><td>₹{f(vol)}</td></tr><tr><td>House profit</td><td>₹{f(profit)}</td></tr>
            <tr><td>Pending requests</td><td>{D.reqs.filter((r) => r.status === 'Pending').length}</td></tr></tbody></table>}
          {at === 'games' && <>
            <p className="small">House edge applies to every player equally. Outcomes cannot be set per user or per round.</p>
            <table><tbody>{GAMES.map(([k, n]) => (
              <tr key={k}><td>{n}</td>
                <td><input type="number" step="0.5" min="0" max="20" value={c.edge[k]} onChange={(e) => set(() => { c.edge[k] = +e.target.value })} /></td>
                <td><label style={{ margin: 0 }}><input type="checkbox" checked={!!c.on[k]} onChange={(e) => set(() => { c.on[k] = +e.target.checked })} /> on</label></td></tr>))}</tbody></table>
            <div className="row"><div><label>Min bet</label><input type="number" value={c.min} onChange={(e) => set(() => { c.min = +e.target.value })} /></div>
              <div><label>Max bet</label><input type="number" value={c.max} onChange={(e) => set(() => { c.max = +e.target.value })} /></div></div></>}
          {at === 'wallet' && <>
            <label>Demo UPI ID shown in the QR</label><input value={c.upi} onChange={(e) => set(() => { c.upi = e.target.value })} />
            <table><tbody>{D.reqs.map((r) => (
              <tr key={r.id}><td>{r.u}</td><td>{r.type}</td><td>₹{f(r.amt)}</td><td>{r.utr}</td>
                <td>{r.status === 'Pending' ? <><button className="p" onClick={() => rq(r.id, 1)}>✓</button> <button className="d" onClick={() => rq(r.id, 0)}>✕</button></> : r.status}</td></tr>))}
              {!D.reqs.length && <tr><td className="small">No requests</td></tr>}</tbody></table></>}
          {at === 'users' && <table><tbody>{players.map((k) => (
            <tr key={k}><td>{k}</td><td>₹{f(D.users[k].bal)}</td>
              <td><button onClick={() => adj(k)}>±</button> <button className={D.users[k].ban ? 'd' : ''} onClick={() => set(() => { D.users[k].ban = D.users[k].ban ? 0 : 1 })}>{D.users[k].ban ? 'Unban' : 'Ban'}</button></td></tr>))}
            {!players.length && <tr><td className="small">No players yet</td></tr>}</tbody></table>}
          {at === 'bonus' && <>
            <label>Welcome bonus</label><input type="number" value={c.welcome} onChange={(e) => set(() => { c.welcome = +e.target.value })} />
            <label>Deposit bonus %</label><input type="number" value={c.dep} onChange={(e) => set(() => { c.dep = +e.target.value })} />
            <label>Wagering multiple</label><input type="number" value={c.wr} onChange={(e) => set(() => { c.wr = +e.target.value })} /></>}
          {at === 'logs' && <table><tbody>{D.bets.slice(0, 40).map((x, i) => <tr key={i}><td>{x.u.slice(-4)}</td><td>{x.g}</td><td>₹{f(x.a)}</td><td>₹{f(x.w)}</td></tr>)}</tbody></table>}
          {at === 'security' && <>
            <label>New admin password</label><input type="password" value={ap} onChange={(e) => setAp(e.target.value)} />
            <button className="p" style={{ marginTop: 10 }} onClick={() => { if (ap.length < 8) return toast('Min 8 characters'); set(() => { D.users.admin.pw = ap }); setAp(''); toast('Admin password changed') }}>Change password</button></>}
        </div>
      </main>
    </>
  )
}
