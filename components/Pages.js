'use client'
import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { 
  db, toast, f, createRequest, refreshUser, changePassword,
  supabase
} from '../lib/supabase-db'

export function Wallet({ u, me }) {
  const [tab, setTab] = useState('d')
  const [dq, setDq] = useState(500)
  const [utr, setUtr] = useState('')
  const [wu, setWu] = useState('')
  const [wa, setWa] = useState('')
  const [wMethod, setWMethod] = useState('upi')
  const [bankAcc, setBankAcc] = useState('')
  const [bankIfsc, setBankIfsc] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [requests, setRequests] = useState([])
  const [bets, setBets] = useState([])
  const [reqPage, setReqPage] = useState(0)
  const [betPage, setBetPage] = useState(0)
  const [upiId, setUpiId] = useState(() => db().cfg?.upi || '8812862976@ybl')

  useEffect(() => {
    refreshUser()
    fetchData()
  }, [me, u?.id])

  const fetchData = async () => {
    try {
      const cfg = await import('../lib/supabase-db').then(m => m.fetchConfig())
      if (cfg?.upi) setUpiId(cfg.upi)
    } catch (e) {
      const { data: cfgData } = await supabase.from('game_config').select('upi_id').eq('id', 1).maybeSingle()
      if (cfgData?.upi_id) setUpiId(cfgData.upi_id)
    }

    if (u?.id) {
      const { data: reqs } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
      setRequests(reqs || [])

      const { data: bData } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (bData && bData.length) {
        setBets(bData)
      } else {
        const local = (u.bets || []).map((b, i) => ({
          id: 'local-' + i,
          game: b.g,
          amount: b.a,
          win_amount: b.w,
          created_at: new Date(b.t).toISOString()
        }))
        setBets(local)
      }
    }
  }

  const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=RoyalSpin&am=${dq}&cu=INR`

  async function dsub() {
    if (!/^\d{12}$/.test(utr.trim())) return toast('UTR must be 12 digits')
    if (!(dq >= 1)) return toast('Enter amount')
    const res = await createRequest('deposit', +dq, utr.trim())
    if (res.error) return toast(res.error)
    setUtr('')
    toast('Submitted. Awaiting approval')
    fetchData()
  }

  async function wsub() {
    const a = +wa
    if (!(a > 0) || a > u.balance) return toast('Check withdrawal amount')

    let withdrawRef = ''
    if (wMethod === 'upi') {
      if (!wu.trim() || !wu.includes('@')) return toast('Enter valid UPI ID (e.g. name@bank)')
      withdrawRef = wu.trim()
    } else {
      if (!bankHolder.trim()) return toast('Enter account holder name')
      if (!bankAcc.trim() || bankAcc.trim().length < 8) return toast('Enter valid bank account number')
      if (!bankIfsc.trim() || bankIfsc.trim().length < 9) return toast('Enter valid IFSC code (e.g. SBIN0001234)')
      withdrawRef = `Bank: ${bankName.trim() || 'Bank'} | A/C: ${bankAcc.trim()} | IFSC: ${bankIfsc.trim().toUpperCase()} | Name: ${bankHolder.trim()}`
    }

    const res = await createRequest('withdraw', a, withdrawRef)
    if (res.error) return toast(res.error)
    setWa('')
    setWu('')
    setBankAcc('')
    setBankIfsc('')
    setBankHolder('')
    toast('Withdrawal requested: ₹' + f(a) + ' held')
    await refreshUser()
    fetchData()
  }

  const PAGE_SIZE = 10
  const reqTotalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE))
  const displayedReqs = requests.slice(reqPage * PAGE_SIZE, (reqPage + 1) * PAGE_SIZE)

  const betTotalPages = Math.max(1, Math.ceil(bets.length / PAGE_SIZE))
  const displayedBets = bets.slice(betPage * PAGE_SIZE, (betPage + 1) * PAGE_SIZE)

  return (
    <>
      <div className="card">
        <b>Wallet</b>
        <div className="big">₹{f(u.balance)}</div>
        <div className="row">
          <button className={tab === 'd' ? 'p' : ''} onClick={() => setTab('d')}>Deposit</button>
          <button className={tab === 'w' ? 'p' : ''} onClick={() => setTab('w')}>Withdraw</button>
        </div>
      </div>

      {tab === 'd' ? (
        <div className="card">
          <b>UPI Deposit</b>
          <label>Amount</label>
          <input type="number" value={dq} onChange={(e) => setDq(e.target.value)} />
          <div style={{ textAlign: 'center', margin: '14px 0' }}>
            <div className="qr"><QRCodeSVG value={link} size={170} /></div>
            <p className="small" style={{ marginTop: 6 }}>Scan QR to pay</p>
          </div>
          <label>12 digit UTR number</label>
          <input inputMode="numeric" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Enter 12 digit UTR" />
          <button className="p" style={{ width: '100%', marginTop: 12 }} onClick={dsub}>Submit UTR</button>
        </div>
      ) : (
        <div className="card">
          <b>Withdraw Funds</b>
          <div style={{ display: 'flex', gap: 8, margin: '10px 0 14px' }}>
            <button 
              type="button" 
              className={wMethod === 'upi' ? 'p' : ''} 
              style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
              onClick={() => setWMethod('upi')}
            >
              UPI Transfer
            </button>
            <button 
              type="button" 
              className={wMethod === 'bank' ? 'p' : ''} 
              style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
              onClick={() => setWMethod('bank')}
            >
              Bank Transfer
            </button>
          </div>

          {wMethod === 'upi' ? (
            <>
              <label>UPI ID</label>
              <input placeholder="name@bank (e.g. 9876543210@ybl)" value={wu} onChange={(e) => setWu(e.target.value)} />
            </>
          ) : (
            <>
              <label>Account Holder Name</label>
              <input placeholder="Name as in bank account" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
              <label>Bank Name (Optional)</label>
              <input placeholder="e.g. SBI, HDFC, ICICI" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <label>Account Number</label>
              <input placeholder="Enter bank account number" value={bankAcc} onChange={(e) => setBankAcc(e.target.value)} />
              <label>IFSC Code</label>
              <input placeholder="e.g. SBIN0001234" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} style={{ textTransform: 'uppercase' }} />
            </>
          )}

          <label style={{ marginTop: 8 }}>Amount (₹)</label>
          <input type="number" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="Enter withdrawal amount" />
          <button className="p" style={{ width: '100%', marginTop: 14 }} onClick={wsub}>Request Withdrawal</button>
        </div>
      )}

      {/* Modern Request History Card with Status Badges & 10-Item Pagination */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b>Deposit / Withdrawal Requests</b>
          <button onClick={fetchData} style={{ padding: '3px 8px', fontSize: 11, background: 'var(--c2)' }}>Refresh</button>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--mut)', borderBottom: '1px solid var(--ln)', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px' }}>Type</th>
                <th style={{ padding: '8px 6px' }}>Amount</th>
                <th style={{ padding: '8px 6px' }}>Reference</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedReqs.map((r) => {
                const isApproved = r.status === 'approved'
                const isRejected = r.status === 'rejected'
                const statusBg = isApproved ? 'rgba(46,230,122,0.12)' : isRejected ? 'rgba(255,90,90,0.12)' : 'rgba(255,213,79,0.12)'
                const statusCol = isApproved ? 'var(--ac)' : isRejected ? 'var(--bad)' : '#ffd54f'
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '9px 6px', textTransform: 'capitalize', fontWeight: 600 }}>{r.type}</td>
                    <td style={{ padding: '9px 6px', fontWeight: 700 }}>₹{f(r.amount)}</td>
                    <td style={{ padding: '9px 6px', color: 'var(--mut)', fontSize: 11 }}>{r.upi_id || r.utr || '—'}</td>
                    <td style={{ padding: '9px 6px', textAlign: 'right' }}>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '3px 8px', 
                        borderRadius: 12, 
                        fontSize: 11, 
                        fontWeight: 700, 
                        background: statusBg, 
                        color: statusCol,
                        textTransform: 'uppercase'
                      }}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {!displayedReqs.length && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '16px 0', color: 'var(--mut)' }}>No requests found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {reqTotalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--ln)' }}>
            <button 
              disabled={reqPage === 0} 
              onClick={() => setReqPage(p => p - 1)}
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: 12, color: 'var(--mut)' }}>
              Page {reqPage + 1} of {reqTotalPages}
            </span>
            <button 
              disabled={reqPage >= reqTotalPages - 1} 
              onClick={() => setReqPage(p => p + 1)}
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* My Bet History Card with 10-Item Pagination */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b>My Bet History</b>
          <button onClick={fetchData} style={{ padding: '3px 8px', fontSize: 11, background: 'var(--c2)' }}>Refresh</button>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--mut)', borderBottom: '1px solid var(--ln)', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px' }}>Game</th>
                <th style={{ padding: '8px 6px' }}>Bet</th>
                <th style={{ padding: '8px 6px' }}>Result</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Payout</th>
              </tr>
            </thead>
            <tbody>
              {displayedBets.map((b, i) => {
                const isWin = (b.win_amount || 0) > (b.amount || 0)
                const net = (b.win_amount || 0) - (b.amount || 0)
                return (
                  <tr key={b.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '9px 6px', textTransform: 'capitalize', fontWeight: 600 }}>{b.game || 'Game'}</td>
                    <td style={{ padding: '9px 6px' }}>₹{f(b.amount)}</td>
                    <td style={{ padding: '9px 6px', fontWeight: 600, color: isWin ? 'var(--ac)' : 'var(--bad)' }}>
                      {isWin ? 'Win' : 'Loss'}
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: isWin ? 'var(--ac)' : 'var(--bad)' }}>
                      {isWin ? '+' : ''}₹{f(net)}
                    </td>
                  </tr>
                )
              })}
              {!displayedBets.length && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '16px 0', color: 'var(--mut)' }}>No bets yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {betTotalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--ln)' }}>
            <button 
              disabled={betPage === 0} 
              onClick={() => setBetPage(p => p - 1)}
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: 12, color: 'var(--mut)' }}>
              Page {betPage + 1} of {betTotalPages}
            </span>
            <button 
              disabled={betPage >= betTotalPages - 1} 
              onClick={() => setBetPage(p => p + 1)}
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
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
      <p className="small">Safely store funds away from betting balance</p>
      <input type="number" placeholder="Amount" value={a} onChange={(e) => setA(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="p" onClick={() => move(true)}>Lock into Vault</button>
        <button onClick={() => move(false)}>Withdraw from Vault</button>
      </div></div>
  )
}

export function Wager({ u, me }) {
  return (
    <div className="card"><b>Wager Requirement</b>
      <div className="big">₹{f(u.bonus_needed || 0)}</div>
      <p className="small">Total amount you need to bet before bonus money can be withdrawn.</p>
      <div className="bar" style={{ margin: '14px 0' }}>
        <i style={{ width: Math.min(100, ((u.total_wagered || 0) / Math.max(1, (u.total_wagered || 0) + (u.bonus_needed || 0))) * 100) + '%' }} />
      </div>
      <p className="small">Total wagered so far: <b>₹{f(u.total_wagered || 0)}</b></p>
    </div>
  )
}

export function Bonus({ u }) {
  return (
    <div className="card"><b>Bonus Balance</b>
      <div className="big">₹{f(u.bonus_balance || 0)}</div>
      <p className="small">Bonus funds available for play. Subject to wagering requirements.</p>
    </div>
  )
}

export function Profile({ u, me }) {
  return (
    <div className="card"><b>Profile</b>
      <p>Phone: <b>{u.phone}</b></p>
      <p>Name: <b>{u.name}</b></p>
      <p>Total Bets: <b>{u.total_bets || 0}</b></p>
      <p>Total Wins: <b>{u.total_wins || 0}</b></p>
      <p>Total PnL: <b style={{ color: (u.pnl || 0) >= 0 ? 'var(--ac)' : 'var(--bad)' }}>₹{f(u.pnl || 0)}</b></p>
    </div>
  )
}

export function Settings({ u, onLogout }) {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePasswordChange(e) {
    e.preventDefault()
    if (!oldPw) return toast('Enter current password')
    if (newPw.length < 6) return toast('New password must be at least 6 characters')
    if (newPw !== confirmPw) return toast('New passwords do not match')

    setLoading(true)
    try {
      const res = await changePassword(oldPw, newPw)
      if (res.error) {
        toast(res.error)
      } else {
        toast('Password changed successfully!')
        setOldPw('')
        setNewPw('')
        setConfirmPw('')
      }
    } catch (err) {
      toast('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="card">
        <b>Account Details</b>
        <div style={{ margin: '10px 0', fontSize: 13, lineHeight: 1.8 }}>
          <div>Phone: <b style={{ color: 'var(--ac)' }}>{u.phone}</b></div>
          <div>Username: <b>{u.username || 'Player'}</b></div>
          <div>Joined: <span style={{ color: 'var(--mut)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}</span></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <b>Change Password</b>
        <p className="small">Ensure your account is protected with a strong password</p>
        <form onSubmit={handlePasswordChange} style={{ marginTop: 10 }}>
          <label>Current Password</label>
          <input 
            type="password" 
            placeholder="Enter current password" 
            value={oldPw} 
            onChange={(e) => setOldPw(e.target.value)} 
          />

          <label style={{ marginTop: 8 }}>New Password</label>
          <input 
            type="password" 
            placeholder="Min 6 characters" 
            value={newPw} 
            onChange={(e) => setNewPw(e.target.value)} 
          />

          <label style={{ marginTop: 8 }}>Confirm New Password</label>
          <input 
            type="password" 
            placeholder="Re-enter new password" 
            value={confirmPw} 
            onChange={(e) => setConfirmPw(e.target.value)} 
          />

          <button 
            type="submit" 
            className="p" 
            style={{ width: '100%', marginTop: 14 }} 
            disabled={loading}
          >
            {loading ? 'Updating Password...' : 'Change Password'}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <b>Log Out</b>
        <p className="small">Sign out of your account on this device</p>
        <button style={{ width: '100%', marginTop: 12, background: 'var(--bad)' }} onClick={onLogout}>
          Log Out
        </button>
      </div>
    </>
  )
}
