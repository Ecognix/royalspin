'use client'
import { useEffect, useState } from 'react'
import { useDB, adminLogin, toast, f, addtx, supabase } from '../lib/supabase-db'
import { GAMES } from './meta'
import { Notifications } from './App'

// Admin console (route: /console). Separate login, separate session key,
// not linked from the player app. Default login: admin / admin123 (change it in Security).
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
      // Admin phones are predefined
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

const TABS = ['over', 'games', 'wallet', 'users', 'bonus', 'logs', 'security']

function Panel({ onOut }) {
  const D = useDB(), c = D.cfg, [at, setAt] = useState('over'), [ap, setAp] = useState('')
  const [usersList, setUsersList] = useState([])
  const [usersData, setUsersData] = useState({})
  const [betsData, setBetsData] = useState([])
  const [reqsData, setReqsData] = useState([])
  const [userPage, setUserPage] = useState(0)
  
  // Fetch admin data
  useEffect(() => {
    async function fetchAdminData() {
      const { data: users } = await supabase.from('users').select('*').eq('is_admin', false).order('created_at', { ascending: false })
      const { data: bets } = await supabase.from('bets').select('*, users:user_id(phone)').order('created_at', { ascending: false }).limit(500)
      const { data: reqs } = await supabase.from('requests').select('*, users:user_id(phone)').order('created_at', { ascending: false })
      
      const usersMap = {}
      users?.forEach(u => { usersMap[u.phone] = u })
      setUsersList(users || [])
      setUsersData(usersMap)
      setBetsData(bets || [])
      setReqsData(reqs || [])
    }
    fetchAdminData()
  }, [])
  
  const refreshData = async () => {
    const { data: users } = await supabase.from('users').select('*').eq('is_admin', false).order('created_at', { ascending: false })
    const { data: bets } = await supabase.from('bets').select('*, users:user_id(phone)').order('created_at', { ascending: false }).limit(500)
    const { data: reqs } = await supabase.from('requests').select('*, users:user_id(phone)').order('created_at', { ascending: false })
    
    const usersMap = {}
    users?.forEach(u => { usersMap[u.phone] = u })
    setUsersList(users || [])
    setUsersData(usersMap)
    setBetsData(bets || [])
    setReqsData(reqs || [])
  }
  
  const set = (fn) => { fn() }
  
  async function rq(id, ok) {
    const r = reqsData.find((x) => x.id === id)
    const u = usersData[r.users?.phone]
    if (!r || !u) return
    
    const newStatus = ok ? 'Approved' : 'Rejected'
    const { error } = await supabase.from('requests').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return toast('Failed to update request')
    
    if (r.type === 'Deposit' && ok) {
      const newBal = u.balance + r.amount
      await supabase.from('users').update({ balance: newBal }).eq('id', u.id)
      await supabase.from('transactions').insert({ user_id: u.id, type: 'Deposit', amount: r.amount, balance_after: newBal, details: {} })
      const bonus = (r.amount * c.dep) / 100
      await supabase.from('users').update({ 
        bonus_balance: u.bonus_balance + bonus,
        bonus_needed: u.bonus_needed + bonus * c.wr
      }).eq('id', u.id)
    }
    if (r.type === 'Withdraw' && !ok) {
      const newBal = u.balance + r.amount
      await supabase.from('users').update({ balance: newBal }).eq('id', u.id)
      await supabase.from('transactions').insert({ user_id: u.id, type: 'Withdraw refunded', amount: r.amount, balance_after: newBal, details: {} })
    }
    await refreshData()
  }
  
  async function adj(phone) {
    const a = parseFloat(prompt('Add (+) or remove (-) coins')); if (!a) return
    const u = usersData[phone]
    if (!u) return
    
    const newBal = u.balance + a
    const { error } = await supabase.from('users').update({ balance: newBal }).eq('id', u.id)
    if (error) return toast('Failed to adjust balance')
    
    await supabase.from('transactions').insert({ user_id: u.id, type: 'Admin adjustment', amount: a, balance_after: newBal, details: {} })
    await refreshData()
  }
  
  async function toggleBan(phone) {
    const u = usersData[phone]
    if (!u) return
    
    const { error } = await supabase.from('users').update({ is_banned: !u.is_banned }).eq('id', u.id)
    if (error) return toast('Failed to update ban status')
    await refreshData()
  }
  
  const players = Object.keys(usersData)
  const vol = betsData.reduce((s, x) => s + (x.amount || 0), 0)
  const profit = betsData.reduce((s, x) => s + (x.amount || 0) - (x.win_amount || 0), 0)
  
  return (
    <>
      <header><span className="logo">♠ Admin Console</span><button className="d" onClick={onOut}>Log out</button></header>
      <main>
        <div className="chips" style={{ marginBottom: 10 }}>{TABS.map((t) => <button key={t} className={t === at ? 'on' : ''} onClick={() => setAt(t)}>{t}</button>)}</div>
        <div className="card">
          {at === 'over' && <table><tbody>
            <tr><td>Players</td><td>{players.length}</td></tr><tr><td>Bets logged</td><td>{betsData.length}</td></tr>
            <tr><td>Volume</td><td>₹{f(vol)}</td></tr><tr><td>House profit</td><td>₹{f(profit)}</td></tr>
            <tr><td>Pending requests</td><td>{reqsData.filter((r) => r.status === 'Pending').length}</td></tr></tbody></table>}
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
            <table><tbody>{reqsData.map((r) => (
              <tr key={r.id}><td>{r.users?.phone}</td><td>{r.type}</td><td>₹{f(r.amount)}</td><td>{r.utr}</td>
                <td>{r.status === 'Pending' ? <><button className="p" onClick={() => rq(r.id, 1)}>✓</button> <button className="d" onClick={() => rq(r.id, 0)}>✕</button></> : r.status}</td></tr>))}
              {!reqsData.length && <tr><td className="small">No requests</td></tr>}</tbody></table></>}
          {at === 'users' && (() => {
            const pageSize = 10
            const totalPages = Math.ceil(usersList.length / pageSize) || 1
            const currentPage = Math.min(userPage, totalPages - 1)
            const paginated = usersList.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
            
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b>Registered Users ({usersList.length})</b>
                  <span className="small">Page {currentPage + 1} of {totalPages} (10 per page)</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((u) => (
                      <tr key={u.id || u.phone}>
                        <td>
                          <b>{u.phone}</b>
                          {u.username && <div className="small" style={{ color: 'var(--mut)' }}>@{u.username}</div>}
                        </td>
                        <td>₹{f(u.balance)}</td>
                        <td>
                          <span style={{ 
                            fontSize: 11, 
                            fontWeight: 700, 
                            padding: '2px 6px', 
                            borderRadius: 4, 
                            background: u.is_banned ? 'var(--bad)' : 'var(--ac)',
                            color: '#000'
                          }}>
                            {u.is_banned ? 'BLOCKED' : 'ACTIVE'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => adj(u.phone)} title="Adjust Balance">±</button>
                            <button 
                              className={u.is_banned ? '' : 'd'} 
                              onClick={() => toggleBan(u.phone)}
                            >
                              {u.is_banned ? 'Unblock' : 'Block / Ban'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!usersList.length && <tr><td colSpan="4" className="small">No players registered yet</td></tr>}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="row" style={{ marginTop: 12, justifyContent: 'center', gap: 10 }}>
                    <button 
                      disabled={currentPage === 0} 
                      onClick={() => setUserPage(p => Math.max(0, p - 1))}
                    >
                      ← Previous 10
                    </button>
                    <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--mut)' }}>
                      {currentPage + 1} / {totalPages}
                    </span>
                    <button 
                      disabled={currentPage >= totalPages - 1} 
                      onClick={() => setUserPage(p => Math.min(totalPages - 1, p + 1))}
                    >
                      Next 10 →
                    </button>
                  </div>
                )}
              </>
            )
          })()}
          {at === 'bonus' && <>
            <label>Welcome bonus</label><input type="number" value={c.welcome} onChange={(e) => set(() => { c.welcome = +e.target.value })} />
            <label>Deposit bonus %</label><input type="number" value={c.dep} onChange={(e) => set(() => { c.dep = +e.target.value })} />
            <label>Wagering multiple</label><input type="number" value={c.wr} onChange={(e) => set(() => { c.wr = +e.target.value })} /></>}
          {at === 'logs' && <table><tbody>{betsData.slice(0, 40).map((x, i) => <tr key={i}><td>{x.users?.phone?.slice(-4)}</td><td>{x.game}</td><td>₹{f(x.amount)}</td><td>₹{f(x.win_amount)}</td></tr>)}</tbody></table>}
          {at === 'security' && <>
            <label>New admin password</label><input type="password" value={ap} onChange={(e) => setAp(e.target.value)} />
            <button className="p" style={{ marginTop: 10 }} onClick={() => { if (ap.length < 8) return toast('Min 8 characters'); toast('Password change requires database update') }}>Change password</button></>}
        </div>
      </main>
    </>
  )
}
