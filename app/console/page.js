'use client'
import { useEffect, useState } from 'react'
import { 
  getAllUsers, getAllBets, getAllRequests,
  updateRequest, updateUser, updateConfig, isAdminPhone,
  supabase, toast, f
} from '../../lib/supabase-db'
import { getMe } from '../../lib/supabase-db'

// Separate admin portal at /console. It is not linked from the player app.
export default function ConsolePage() {
  const [authed, setAuthed] = useState(false)
  const [users, setUsers] = useState([])
  const [bets, setBets] = useState([])
  const [requests, setRequests] = useState([])
  const [config, setConfig] = useState({})
  const [tab, setTab] = useState('users')
  const [loading, setLoading] = useState(false)
  const [loginPhone, setLoginPhone] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    // Check if already authed
    if (sessionStorage.getItem('rs-admin') === '1') {
      setAuthed(true)
      fetchAll()
    }
  }, [])

  async function handleAdminLogin() {
    setLoginError('')
    if (!isAdminPhone(loginPhone)) {
      setLoginError('Invalid admin credentials')
      return
    }
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', loginPhone)
      .eq('is_admin', true)
      .maybeSingle()
    
    if (error || !user) {
      setLoginError('Invalid admin credentials')
      return
    }
    
    // Verify password
    const encoder = new TextEncoder()
    const data = encoder.encode(loginPw + 'royal-spin-salt')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    if (hash !== user.password_hash) {
      setLoginError('Invalid admin credentials')
      return
    }
    
    sessionStorage.setItem('rs-admin', '1')
    setAuthed(true)
    fetchAll()
  }

  async function fetchAll() {
    setLoading(true)
    const [usersData, betsData, requestsData, configData] = await Promise.all([
      getAllUsers(),
      getAllBets(),
      getAllRequests(),
      supabase.from('game_config').select('*').eq('id', 1).maybeSingle()
    ])
    setUsers(usersData || [])
    setBets(betsData || [])
    setRequests(requestsData || [])
    if (configData.data) setConfig({
      edge: configData.data.edge,
      on: configData.data.enabled,
      min: configData.data.min_bet,
      max: configData.data.max_bet,
      upi: configData.data.upi_id,
      welcome: configData.data.welcome_bonus,
      dep: configData.data.min_deposit,
      wr: configData.data.wager_requirement
    })
    setLoading(false)
  }

  async function handleRequestAction(reqId, status) {
    await updateRequest(reqId, status)
    if (status === 'approved') {
      const req = requests.find(r => r.id === reqId)
      if (req && req.type === 'deposit') {
        await supabase.from('users').update({ balance: supabase.raw(`balance + ${req.amount}`) }).eq('id', req.user_id)
      }
    }
    fetchAll()
  }

  async function saveConfig() {
    await updateConfig(config)
    toast('Config saved')
  }

  async function toggleUserBan(userId, currentBan) {
    await updateUser(userId, { is_banned: !currentBan })
    fetchAll()
  }

  function logout() {
    sessionStorage.removeItem('rs-admin')
    setAuthed(false)
  }

  if (!authed) {
    return (
      <div className="auth"><div className="card">
        <div className="logo" style={{ fontSize: 20 }}>Admin Console</div>
        <p className="small">Authorized access only.</p>
        {loginError && <div style={{ color: 'var(--bad)', marginBottom: 10 }}>{loginError}</div>}
        <label>Admin Phone</label>
        <input inputMode="numeric" placeholder="10 digit admin number" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value.trim())} />
        <label>Password</label>
        <input type="password" placeholder="admin password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
        <button className="p" style={{ width: '100%', marginTop: 14 }} onClick={handleAdminLogin}>Sign in</button>
      </div></div>
    )
  }

  const players = users.filter(u => !u.is_admin)
  const vol = bets.reduce((s, x) => s + x.amount, 0)
  const profit = bets.reduce((s, x) => s + x.amount - x.win_amount, 0)

  return (
    <>
      <header><span className="logo">♠ Admin Console</span><button className="d" onClick={logout}>Log out</button></header>
      <main>
        <div className="chips" style={{ marginBottom: 10 }}>
          {['users', 'bets', 'requests', 'config'].map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="card">
          {tab === 'users' && (
            <>
              <table><thead><tr><th>Phone</th><th>Username</th><th>Name</th><th>Balance</th><th>Wagered</th><th>Banned</th><th>Admin</th></tr></thead>
              <tbody>{players.map(usr => <tr key={usr.id}>
                <td>{usr.phone}</td>
                <td>{usr.username || '-'}</td>
                <td>{usr.name}</td>
                <td>₹{f(usr.balance)}</td>
                <td>₹{f(usr.total_wagered)}</td>
                <td><button className={usr.is_banned ? 'p' : ''} onClick={() => toggleUserBan(usr.id, usr.is_banned)}>{usr.is_banned ? 'Unban' : 'Ban'}</button></td>
                <td>{usr.is_admin ? 'Yes' : 'No'}</td>
              </tr>)}</tbody></table>
              {!players.length && <div className="small">No players yet</div>}
            </>
          )}
          {tab === 'bets' && (
            <>
              <table><thead><tr><th>User</th><th>Game</th><th>Bet</th><th>Win</th><th>Time</th></tr></thead>
              <tbody>{bets.map(b => <tr key={b.id}>
                <td>{b.users?.phone || b.users?.username || 'Unknown'}</td>
                <td>{b.game}</td>
                <td>₹{f(b.amount)}</td>
                <td style={{ color: b.win_amount > b.amount ? 'var(--ac)' : 'var(--bad)' }}>₹{f(b.win_amount)}</td>
                <td>{new Date(b.created_at).toLocaleString()}</td>
              </tr>)}</tbody></table>
              {!bets.length && <div className="small">No bets yet</div>}
            </>
          )}
          {tab === 'requests' && (
            <>
              <table><thead><tr><th>User</th><th>Type</th><th>Amount</th><th>UPI</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{requests.map(r => <tr key={r.id}>
                <td>{r.users?.phone || r.users?.username || 'Unknown'}</td>
                <td>{r.type}</td>
                <td>₹{f(r.amount)}</td>
                <td>{r.upi_id || '-'}</td>
                <td>{r.status}</td>
                <td>{r.status === 'pending' && (
                  <>
                    <button className="p" onClick={() => handleRequestAction(r.id, 'approved')}>✓</button>
                    <button className="d" onClick={() => handleRequestAction(r.id, 'rejected')}>✕</button>
                  </>
                )}</td>
              </tr>)}</tbody></table>
              {!requests.length && <div className="small">No requests</div>}
            </>
          )}
          {tab === 'config' && (
            <>
              <label>Demo UPI ID shown in the QR</label>
              <input value={config.upi} onChange={(e) => setConfig({...config, upi: e.target.value})} />
              <table><thead><tr><th>Game</th><th>Edge %</th><th>Enabled</th></tr></thead>
              <tbody>{Object.entries(config.edge || {}).map(([k, v]) => (
                <tr key={k}><td>{k}</td>
                  <td><input type="number" step="0.5" min="0" max="20" value={v} onChange={(e) => setConfig({...config, edge: {...config.edge, [k]: +e.target.value}})} /></td>
                  <td><label style={{ margin: 0 }}><input type="checkbox" checked={!!config.on?.[k]} onChange={(e) => setConfig({...config, on: {...config.on, [k]: +e.target.checked}})} /> on</label></td></tr>
              ))}</tbody></table>
              <div className="row">
                <div><label>Min bet</label><input type="number" value={config.min} onChange={(e) => setConfig({...config, min: +e.target.value})} /></div>
                <div><label>Max bet</label><input type="number" value={config.max} onChange={(e) => setConfig({...config, max: +e.target.value})} /></div>
              </div>
              <label>Welcome bonus</label><input type="number" value={config.welcome} onChange={(e) => setConfig({...config, welcome: +e.target.value})} />
              <label>Deposit bonus %</label><input type="number" value={config.dep} onChange={(e) => setConfig({...config, dep: +e.target.value})} />
              <label>Wagering multiple</label><input type="number" value={config.wr} onChange={(e) => setConfig({...config, wr: +e.target.value})} />
              <button className="p" style={{ marginTop: 10 }} onClick={saveConfig}>Save Config</button>
            </>
          )}
        </div>
      </main>
    </>
  )
}
