'use client'
import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@supabase/supabase-js'
import { 
  db, toast, f, createRequest, refreshUser,
  getAllUsers, getAllBets, getAllRequests,
  updateRequest, updateUser, updateConfig, isAdminPhone,
  supabase
} from '../lib/supabase-db'

// Password hashing (local copy for Settings)
const hashPassword = async (password) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'royal-spin-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function Wallet({ u, me }) {
  const [tab, setTab] = useState('d')
  const [dq, setDq] = useState(500)
  const [utr, setUtr] = useState('')
  const [wu, setWu] = useState('')
  const [wa, setWa] = useState('')
  const [requests, setRequests] = useState([])
  const [transactions, setTransactions] = useState([])
  const [upiId, setUpiId] = useState(() => db().cfg?.upi || '8812862976@ybl')

  useEffect(() => {
    refreshUser()
    // Fetch requests and transactions
    fetchData()
  }, [me])

  const fetchData = async () => {
    try {
      const cfg = await import('../lib/supabase-db').then(m => m.fetchConfig())
      if (cfg?.upi) setUpiId(cfg.upi)
    } catch (e) {
      const { data: cfgData } = await supabase.from('game_config').select('upi_id').eq('id', 1).maybeSingle()
      if (cfgData?.upi_id) setUpiId(cfgData.upi_id)
    }
    const { data: reqs } = await supabase
      .from('requests')
      .select('*')
      .eq('user_id', u.id)
      .order('created_at', { ascending: false })
    setRequests(reqs || [])

    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', u.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setTransactions(txs || [])
  }

  const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=RoyalSpin&am=${dq}&cu=INR`

  async function dsub() {
    if (!/^\d{12}$/.test(utr.trim())) return toast('UTR must be 12 digits')
    if (!(dq >= 1)) return toast('Enter amount')
    const res = await createRequest('deposit', +dq, utr.trim())
    if (res.error) return toast(res.error)
    setUtr(''); toast('Submitted. Awaiting approval')
    fetchData()
  }

  async function wsub() {
    const a = +wa
    if (!wu.trim() || !(a > 0) || a > u.balance) return toast('Check UPI ID and amount')
    const res = await createRequest('withdraw', a, wu.trim())
    if (res.error) return toast(res.error)
    setWa('')
    toast('Withdrawal requested: ₹' + f(a) + ' held')
    await refreshUser()
    fetchData()
  }

  return (
    <>
      <div className="card"><b>Wallet</b><div className="big">₹{f(u.balance)}</div>
        <div className="row"><button className="p" onClick={() => setTab('d')}>Deposit</button><button onClick={() => setTab('w')}>Withdraw</button></div></div>
      {tab === 'd' ? (
        <div className="card"><b>UPI Deposit</b>
          <label>Amount</label><input type="number" value={dq} onChange={(e) => setDq(e.target.value)} />
          <div style={{ textAlign: 'center', margin: '12px 0' }}>
            <div className="qr"><QRCodeSVG value={link} size={170} /></div>
            <p className="small">Scan QR to pay</p></div>
          <label>12 digit UTR number</label><input inputMode="numeric" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value)} />
          <button className="p" style={{ width: '100%', marginTop: 10 }} onClick={dsub}>Submit UTR</button></div>
      ) : (
        <div className="card"><b>Withdraw</b>
          <label>UPI ID</label><input placeholder="name@bank" value={wu} onChange={(e) => setWu(e.target.value)} />
          <label>Amount</label><input type="number" value={wa} onChange={(e) => setWa(e.target.value)} />
          <button className="p" style={{ width: '100%', marginTop: 10 }} onClick={wsub}>Request withdrawal</button></div>
      )}
      <div className="card"><b>Requests</b><table><tbody>
        {requests.map((r) => <tr key={r.id}><td>{r.type}</td><td>₹{f(r.amount)}</td><td>{r.upi_id || r.utr}</td><td>{r.status}</td></tr>)}
        {!requests.length && <tr><td className="small">None yet</td></tr>}</tbody></table></div>
      <div className="card"><b>Transactions</b><table><tbody>
        {transactions.map((t, i) => <tr key={i}><td>{t.type}</td><td style={{ color: t.amount >= 0 ? 'var(--ac)' : 'var(--bad)' }}>{t.amount >= 0 ? '+' : ''}{f(t.amount)}</td></tr>)}</tbody></table></div>
    </>
  )
}

export function Vault({ u }) {
  const [a, setA] = useState('')
  async function move(lock) {
    const x = +a; if (!(x > 0)) return
    if (lock) { if (x > u.balance) return toast('Low balance') }
    else { if (x > u.vault_balance) return toast('Not enough in vault') }
    
    const newBal = lock ? u.balance - x : u.balance + x
    const newVault = lock ? u.vault_balance + x : u.vault_balance - x
    
    const { error } = await supabase
      .from('users')
      .update({ balance: newBal, vault_balance: newVault })
      .eq('id', u.id)
    
    if (error) return toast('Failed')
    await refreshUser()
    setA('')
  }
  return (
    <div className="card"><b>Vault</b><div className="big">₹{f(u.vault_balance)}</div>
      <p className="small">Coins in the vault cannot be used for bets until you move them back.</p>
      <label>Amount</label><input type="number" value={a} onChange={(e) => setA(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}><button className="p" onClick={() => move(true)}>Lock in</button><button onClick={() => move(false)}>Unlock</button></div></div>
  )
}

export function Wager({ u, me }) {
  const [bets, setBets] = useState([])
  
  useEffect(() => {
    const fetchBets = async () => {
      const { data } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
        .limit(25)
      setBets(data || [])
    }
    fetchBets()
  }, [u.id])

  return (
    <>
      <div className="card"><b>Wager stats</b><table><tbody>
        <tr><td>Total wagered</td><td>₹{f(u.total_wagered)}</td></tr><tr><td>Bets</td><td>{u.total_bets}</td></tr>
        <tr><td>Wins</td><td>{u.total_wins}</td></tr>
        <tr><td>Net profit</td><td style={{ color: u.pnl >= 0 ? 'var(--ac)' : 'var(--bad)' }}>₹{f(u.pnl)}</td></tr></tbody></table></div>
      <div className="card"><b>My bets</b><table><tbody>
        {bets.map((b, i) => <tr key={i}><td>{b.game}</td><td>₹{f(b.amount)}</td><td style={{ color: b.win_amount > b.amount ? 'var(--ac)' : 'var(--bad)' }}>₹{f(b.win_amount)}</td></tr>)}</tbody></table></div>
    </>
  )
}

export function Bonus({ u }) {
  const c = u // config would come from db
  async function claim() { 
    if (u.welcome_claimed) return toast('Already claimed')
    const { error } = await supabase
      .from('users')
      .update({ 
        welcome_claimed: true, 
        bonus_balance: u.bonus_balance + 100,
        bonus_needed: u.bonus_needed + 300
      })
      .eq('id', u.id)
    if (error) return toast('Failed')
    await refreshUser()
    toast('Welcome bonus claimed!')
  }
  async function unlock() {
    if (u.bonus_balance <= 0) return toast('No bonus')
    if (u.bonus_needed > 0) return toast('Wager ₹' + f(u.bonus_needed) + ' more')
    const { error } = await supabase
      .from('users')
      .update({ 
        balance: u.balance + u.bonus_balance,
        bonus_balance: 0,
        bonus_needed: 0
      })
      .eq('id', u.id)
    if (error) return toast('Failed')
    await refreshUser()
    toast('Bonus unlocked to wallet!')
  }
  return (
    <div className="card"><b>Bonuses</b>
      <p className="small">Welcome bonus ₹100. Bonus coins unlock after wagering 3× the bonus.</p>
      <div className="big">₹{f(u.bonus_balance)}</div><p className="small">Still to wager: ₹{f(u.bonus_needed)}</p>
      <div className="row"><button className="p" onClick={claim} disabled={!!u.welcome_claimed}>Claim welcome</button><button onClick={unlock}>Unlock to wallet</button></div></div>
  )
}

export function Profile({ u, me }) {
  const [n, setN] = useState(u.name)
  const lv = u.total_wagered >= 50000 ? 'Platinum' : u.total_wagered >= 10000 ? 'Gold' : u.total_wagered >= 1000 ? 'Silver' : 'Bronze'
  async function save() {
    const { error } = await supabase
      .from('users')
      .update({ name: n })
      .eq('id', u.id)
    if (error) return toast('Failed')
    await refreshUser()
    toast('Saved')
  }
  return (
    <div className="card"><div style={{ fontSize: 42 }}>🧑</div><b>{u.name}</b>
      <p className="small">{me} · joined {new Date(u.created_at).toLocaleDateString()}</p>
      <p>VIP level: <b style={{ color: 'var(--ac)' }}>{lv}</b></p>
      <label>Display name</label><input value={n} onChange={(e) => setN(e.target.value)} />
      <button className="p" style={{ marginTop: 10 }} onClick={save}>Save</button></div>
  )
}

export function Settings({ u, onLogout }) {
  const [np, setNp] = useState('')
  async function changePassword() {
    if (np.length < 6) return toast('Min 6 characters')
    const hash = await hashPassword(np)
    const { error } = await supabase
      .from('users')
      .update({ password_hash: hash })
      .eq('id', u.id)
    if (error) return toast('Failed')
    setNp(''); toast('Password changed')
  }
  return (
    <div className="card"><b>Settings</b>
      <label><input type="checkbox" checked={!!u.hide_balance} onChange={(e) => { 
        supabase.from('users').update({ hide_balance: e.target.checked }).eq('id', u.id)
        refreshUser()
      }} /> Hide balance</label>
      <label>New password</label><input type="password" value={np} onChange={(e) => setNp(e.target.value)} />
      <button className="p" style={{ margin: '10px 0' }} onClick={changePassword}>Change password</button>
      <hr style={{ borderColor: 'var(--ln)' }} /><button className="d" onClick={onLogout}>Log out</button></div>
  )
}

// Admin Panel
export function Admin({ u }) {
  const [users, setUsers] = useState([])
  const [bets, setBets] = useState([])
  const [requests, setRequests] = useState([])
  const [config, setConfig] = useState({})
  const [tab, setTab] = useState('users')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (u.is_admin) fetchAll()
  }, [u.is_admin])

  async function fetchAll() {
    setLoading(true)
    const [usersData, betsData, requestsData, configData] = await Promise.all([
      getAllUsers(),
      getAllBets(),
      getAllRequests(),
      supabase.from('game_config').select('*').eq('id', 1).single()
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
      // Handle balance update
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

  if (!u.is_admin) return <div className="card"><b>Access denied</b></div>

  return (
    <>
      <div className="card">
        <b>Admin Panel</b>
        <div className="row" style={{ marginBottom: 10 }}>
          <button className={tab === 'users' ? 'p' : ''} onClick={() => setTab('users')}>Users</button>
          <button className={tab === 'bets' ? 'p' : ''} onClick={() => setTab('bets')}>All Bets</button>
          <button className={tab === 'requests' ? 'p' : ''} onClick={() => setTab('requests')}>Requests</button>
          <button className={tab === 'config' ? 'p' : ''} onClick={() => setTab('config')}>Config</button>
        </div>
        {loading && <div className="small">Loading...</div>}
        
        {tab === 'users' && (
          <div className="card" style={{ marginTop: 10 }}>
            <table><thead><tr><th>Phone</th><th>Username</th><th>Name</th><th>Balance</th><th>Wagered</th><th>Banned</th><th>Admin</th></tr></thead>
            <tbody>{users.map(usr => <tr key={usr.id}>
              <td>{usr.phone}</td>
              <td>{usr.username || '-'}</td>
              <td>{usr.name}</td>
              <td>₹{f(usr.balance)}</td>
              <td>₹{f(usr.total_wagered)}</td>
              <td><button className={usr.is_banned ? 'p' : ''} onClick={() => toggleUserBan(usr.id, usr.is_banned)}>{usr.is_banned ? 'Unban' : 'Ban'}</button></td>
              <td>{usr.is_admin ? 'Yes' : 'No'}</td>
            </tr>)}</tbody></table>
          </div>
        )}
        
        {tab === 'bets' && (
          <div className="card" style={{ marginTop: 10 }}>
            <table><thead><tr><th>User</th><th>Game</th><th>Bet</th><th>Win</th><th>Time</th></tr></thead>
            <tbody>{bets.map(b => <tr key={b.id}>
              <td>{b.users?.phone || b.users?.username || 'Unknown'}</td>
              <td>{b.game}</td>
              <td>₹{f(b.amount)}</td>
              <td style={{ color: b.win_amount > b.amount ? 'var(--ac)' : 'var(--bad)' }}>₹{f(b.win_amount)}</td>
              <td>{new Date(b.created_at).toLocaleString()}</td>
            </tr>)}</tbody></table>
          </div>
        )}
        
        {tab === 'requests' && (
          <div className="card" style={{ marginTop: 10 }}>
            <table><thead><tr><th>User</th><th>Type</th><th>Amount</th><th>UPI/UTR</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{requests.map(r => <tr key={r.id}>
              <td>{r.users?.phone || r.users?.username || 'Unknown'}</td>
              <td>{r.type}</td>
              <td>₹{f(r.amount)}</td>
              <td>{r.upi_id || r.utr}</td>
              <td>{r.status}</td>
              <td>
                {r.status === 'pending' && (
                  <>
                    <button className="p" style={{fontSize:11,padding:'4px 8px'}} onClick={() => handleRequestAction(r.id, 'approved')}>Approve</button>
                    <button style={{fontSize:11,padding:'4px 8px',marginLeft:4}} onClick={() => handleRequestAction(r.id, 'rejected')}>Reject</button>
                  </>
                )}
              </td>
            </tr>)}</tbody></table>
          </div>
        )}
        
        {tab === 'config' && (
          <div className="card" style={{ marginTop: 10 }}>
            <label>Min bet</label><input type="number" value={config.min} onChange={(e) => setConfig({...config, min: +e.target.value})} />
            <label>Max bet</label><input type="number" value={config.max} onChange={(e) => setConfig({...config, max: +e.target.value})} />
            <label>UPI ID</label><input value={config.upi} onChange={(e) => setConfig({...config, upi: e.target.value})} />
            <label>Welcome bonus</label><input type="number" value={config.welcome} onChange={(e) => setConfig({...config, welcome: +e.target.value})} />
            <label>Min deposit</label><input type="number" value={config.dep} onChange={(e) => setConfig({...config, dep: +e.target.value})} />
            <label>Wager requirement</label><input type="number" value={config.wr} onChange={(e) => setConfig({...config, wr: +e.target.value})} />
            <div style={{marginTop:10}}><b>House Edge %</b></div>
            {Object.entries(config.edge || {}).map(([game, val]) => (
              <div key={game} className="row"><span>{game}</span><input type="number" value={val} onChange={(e) => setConfig({...config, edge: {...(config.edge || {}), [game]: +e.target.value}})} /></div>
            ))}
            <div style={{marginTop:10}}><b>Games Enabled</b></div>
            {Object.entries(config.on || {}).map(([game, val]) => (
              <label key={game} className="row"><span>{game}</span><input type="checkbox" checked={val} onChange={(e) => setConfig({...config, on: {...(config.on || {}), [game]: e.target.checked}})} /></label>
            ))}
            <button className="p" style={{marginTop:10,width:'100%'}} onClick={saveConfig}>Save Config</button>
          </div>
        )}
      </div>
    </>
  )
}
