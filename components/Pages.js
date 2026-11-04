'use client'
import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { 
  db, toast, f, createRequest, refreshUser, changePassword,
  supabase, REFERRAL_REWARD_PERCENT, DEPOSIT_APPROVAL_BONUS_PERCENT,
  BET_FEE_WAGER_STEP, BET_FEE_AMOUNT, MIN_WITHDRAWAL_AMOUNT
} from '../lib/supabase-db'
import { GAMES } from './meta'

export function HubIcon({ name }) {
  const icons = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></>,
    activity: <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /><path d="M2 21h20" /></>,
    promotion: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></>,
    account: <><circle cx="12" cy="8" r="3.5" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    wallet: <><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M6 6V4a1 1 0 0 1 1-1h12" /></>,
    deposit: <><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" /></>,
    withdraw: <><path d="M12 4v12m5-5-5 5-5-5" /><path d="M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" /></>,
    vip: <><path d="m12 3 2.2 5 5.4.5-4.1 3.6 1.2 5.2-4.7-2.8-4.7 2.8 1.2-5.2-4.1-3.6 5.4-.5z" /><path d="M5 20h14" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
    transactions: <><path d="M4 7h15l-3-3m4 13H5l3 3" /><path d="M19 7v4M5 17v-4" /></>,
    notifications: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    gift: <><rect x="3" y="9" width="18" height="12" rx="1" /><path d="M2 6h20v4H2zm10 0v15M12 6H8.5a2 2 0 1 1 2-2c0 1.1 1.5 2 1.5 2zm0 0h3.5a2 2 0 1 0-2-2c0 1.1-1.5 2-1.5 2z" /></>,
    coupon: <><path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z" /><path d="M13 8v2m0 4v2" /></>,
    chart: <><path d="M4 20V10m5 10V4m5 16v-7m5 7V7" /><path d="M2 21h20" /></>,
    language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2z" /></>,
    feedback: <><path d="M4 5h16v12H9l-5 4z" /><path d="M8 9h8m-8 4h5" /></>,
    announcement: <><path d="M4 14V9l15-5v15L4 14z" /><path d="m7 15 2 6h4l-2-5M19 9h2v5h-2" /></>,
    support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2" /><path d="M4 13h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2zm16 0h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2zM17 20a5 5 0 0 1-5 2h-1" /></>,
    guide: <><path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 1-2-2z" /><path d="M4 17a2 2 0 0 1 2-2h13M8 7h7m-7 4h7" /></>,
    about: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>,
    wager: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    bonus: <><path d="m12 3 2.3 5.1 5.6.6-4.2 3.8 1.2 5.5-4.9-2.9-4.9 2.9 1.2-5.5-4.2-3.8 5.6-.6z" /><path d="m9 20 3 2 3-2" /></>,
    vault: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 5V3h10v2m-5 5v6m-3-3h6" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name] || icons.about}</svg>
}

export function Wallet({ u, me, initialTab = 'd' }) {
  const [tab, setTab] = useState(initialTab)
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

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

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

  async function copyDepositUpi() {
    try {
      await navigator.clipboard.writeText(upiId)
      toast('UPI ID copied')
    } catch (error) {
      console.error('Deposit UPI copy error:', error)
      toast('Could not copy UPI ID')
    }
  }

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
    if (Number(u.bonus_needed || 0) > 0) {
      return toast('Wager ₹' + f(u.bonus_needed) + ' more before withdrawing')
    }
    if (a < MIN_WITHDRAWAL_AMOUNT) return toast('Minimum withdrawal is ₹' + f(MIN_WITHDRAWAL_AMOUNT))
    if (a > u.balance) return toast('Check withdrawal amount')

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
    <div className="wallet-page">
      <div className="page-title"><div><h2>Wallet</h2><p>Manage your balance securely.</p></div></div>
      <div className="wallet-balance-card">
        <small>Available balance</small>
        <strong>{u.hide_balance ? '••••••' : `₹${f(u.balance)}`}</strong>
        <div className="wallet-tabs">
          <button className={tab === 'd' ? 'selected' : ''} onClick={() => setTab('d')}>＋ Deposit</button>
          <button className={tab === 'w' ? 'selected' : ''} onClick={() => setTab('w')}>↗ Withdraw</button>
        </div>
      </div>

      {tab === 'd' ? (
        <div className="wallet-section">
          <h2>Add money</h2>
          <p>Choose an available payment method and submit your payment reference.</p>
          <div className="wallet-channel-grid">
            <div className="wallet-channel selected">
              <span className="wallet-channel-icon"><HubIcon name="deposit" /></span>
              <span><b>UPI QR</b><small>Available now</small></span>
            </div>
            <button type="button" className="wallet-channel" onClick={() => toast('Other payment methods coming soon')}>
              <span className="wallet-channel-icon"><HubIcon name="wallet" /></span>
              <span><b>More methods</b><small>Coming soon</small></span>
            </button>
          </div>

          <label className="wallet-field-label">Deposit amount</label>
          <div className="wallet-amount-grid">
            {[100, 500, 1000, 3000].map(amount => (
              <button type="button" key={amount} className={Number(dq) === amount ? 'selected' : ''} onClick={() => setDq(amount)}>₹{amount >= 1000 ? `${amount / 1000}k` : amount}</button>
            ))}
          </div>
          <input type="number" min="1" value={dq} onChange={(e) => setDq(e.target.value)} aria-label="Deposit amount" />

          <div className="wallet-qr-box">
            <b>Scan with any UPI app</b>
            <div><QRCodeSVG value={link} size={180} /></div>
            <div className="wallet-upi">
              <span>{upiId}</span>
              <button type="button" onClick={copyDepositUpi}>Copy UPI ID</button>
            </div>
          </div>

          <label className="wallet-field-label">12-digit UTR / transaction ID</label>
          <input inputMode="numeric" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="Enter the UTR after payment" />
          <button className="wallet-submit" onClick={dsub}>Submit deposit request</button>
          <div className="wallet-instructions">
            <b>Deposit instructions</b>
            Pay the selected amount to the UPI ID shown above, then submit the 12-digit UTR. Your request will appear in history while the team verifies it. Approved deposits receive the configured 50% wallet bonus; a 2× deposit wager is required before withdrawal.
          </div>
        </div>
      ) : (
        <div className="wallet-section">
          <h2>Withdraw funds</h2>
          <p>Choose where you want to receive your withdrawal.</p>
          {Number(u.bonus_needed || 0) > 0 && (
            <div className="wallet-lock">🔒 Withdrawals are locked</div>
          )}
          <div className="wallet-channel-grid">
            <button type="button" className={`wallet-channel ${wMethod === 'upi' ? 'selected' : ''}`} onClick={() => setWMethod('upi')}>
              <span className="wallet-channel-icon"><HubIcon name="withdraw" /></span><span><b>UPI transfer</b><small>Send to a UPI ID</small></span>
            </button>
            <button type="button" className={`wallet-channel ${wMethod === 'bank' ? 'selected' : ''}`} onClick={() => setWMethod('bank')}>
              <span className="wallet-channel-icon"><HubIcon name="wallet" /></span><span><b>Bank transfer</b><small>Send to a bank account</small></span>
            </button>
          </div>

          {wMethod === 'upi' ? (
            <>
              <label className="wallet-field-label">UPI ID</label>
              <input placeholder="name@bank" value={wu} onChange={(e) => setWu(e.target.value)} />
            </>
          ) : (
            <>
              <label className="wallet-field-label">Account holder name</label>
              <input placeholder="Name as in bank account" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
              <label className="wallet-field-label">Bank name <span>(optional)</span></label>
              <input placeholder="Enter bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <label className="wallet-field-label">Account number</label>
              <input placeholder="Enter bank account number" value={bankAcc} onChange={(e) => setBankAcc(e.target.value)} />
              <label className="wallet-field-label">IFSC code</label>
              <input placeholder="Enter IFSC code" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} />
            </>
          )}

          <label className="wallet-field-label">Withdrawal amount</label>
          <div className="wallet-amount-grid">
            {[1000, 2000, 5000, 10000].map(amount => (
              <button type="button" key={amount} className={Number(wa) === amount ? 'selected' : ''} disabled={amount > Number(u.balance || 0)} onClick={() => setWa(amount)}>₹{amount >= 1000 ? `${amount / 1000}k` : amount}</button>
            ))}
          </div>
          <input type="number" min={MIN_WITHDRAWAL_AMOUNT} value={wa} onChange={(e) => setWa(e.target.value)} placeholder="Minimum ₹1,000" />
          <p style={{ marginTop: 8, fontSize: 12 }}>Minimum withdrawal: ₹{f(MIN_WITHDRAWAL_AMOUNT)}</p>
          <button
            className="wallet-submit"
            onClick={wsub}
            disabled={Number(u.bonus_needed || 0) > 0}
          >
            {Number(u.bonus_needed || 0) > 0 ? '🔒 Withdrawal locked' : 'Request withdrawal'}
          </button>
        </div>
      )}

      <div className="wallet-section">
        <div className="wallet-history-heading">
          <b>Deposit & withdrawal history</b>
          <button onClick={fetchData}>Refresh</button>
        </div>
        {displayedReqs.map(request => (
          <div className="wallet-request-row" key={request.id}>
            <div>
              <b>{request.type === 'deposit' ? 'Deposit request' : 'Withdrawal request'} · ₹{f(request.amount)}</b>
              <small>{new Date(request.created_at).toLocaleString()} · {request.upi_id || request.utr || 'No reference'}</small>
            </div>
            <span className="wallet-request-status">{request.status || 'pending'}</span>
          </div>
        ))}
        {!displayedReqs.length && <div className="activity-empty">No deposit or withdrawal requests yet</div>}
        {reqTotalPages > 1 && (
          <div className="activity-pagination">
            <button disabled={reqPage === 0} onClick={() => setReqPage(p => p - 1)}>Previous</button>
            <span>Page {reqPage + 1} of {reqTotalPages}</span>
            <button disabled={reqPage >= reqTotalPages - 1} onClick={() => setReqPage(p => p + 1)}>Next</button>
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
    </div>
  )
}

function getIndiaPeriodRange(period) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const today = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day))
  const day = 24 * 60 * 60 * 1000
  let start = today
  let end = today + day

  if (period === 'yesterday') {
    start = today - day
    end = today
  } else if (period === 'week') {
    const weekday = new Date(today).getUTCDay()
    start = today - ((weekday + 6) % 7) * day
  } else if (period === 'month') {
    start = Date.UTC(Number(values.year), Number(values.month) - 1, 1)
    end = Date.UTC(Number(values.year), Number(values.month), 1)
  }

  const indiaMidnight = timestamp => new Date(timestamp - (5 * 60 + 30) * 60 * 1000).toISOString()
  return { start: indiaMidnight(start), end: indiaMidnight(end) }
}

function RewardsLanding({ u, onNavigate, title }) {
  const [todayBonus, setTodayBonus] = useState(0)
  const [bonusError, setBonusError] = useState('')

  useEffect(() => {
    if (!u?.id) return
    let active = true
    async function loadTodayBonus() {
      const { start, end } = getIndiaPeriodRange('today')
      const [depositResult, referralResult] = await Promise.all([
        supabase.from('requests').select('amount')
          .eq('user_id', u.id).eq('type', 'deposit').eq('status', 'approved')
          .gte('updated_at', start).lt('updated_at', end),
        supabase.from('transactions').select('amount')
          .eq('user_id', u.id).eq('type', 'Referral reward')
          .gte('created_at', start).lt('created_at', end)
      ])
      if (!active) return
      if (depositResult.error || referralResult.error) {
        console.error('Today bonus load error:', depositResult.error || referralResult.error)
        setBonusError('Could not load today’s bonus.')
        return
      }
      const depositBonuses = (depositResult.data || []).reduce(
        (total, row) => total + Number((Number(row.amount || 0) * DEPOSIT_APPROVAL_BONUS_PERCENT / 100).toFixed(2)),
        0
      )
      const referralBonuses = (referralResult.data || []).reduce((total, row) => total + Math.max(0, Number(row.amount || 0)), 0)
      setTodayBonus(depositBonuses + referralBonuses)
      setBonusError('')
    }
    loadTodayBonus()
    return () => { active = false }
  }, [u?.id])

  const comingSoon = () => toast('Coming soon')
  const shortcuts = [
    { icon: 'account', label: 'Invite bonus', action: () => onNavigate('referral') },
    { icon: 'activity', label: 'Betting rebate', action: comingSoon },
    { icon: 'vip', label: 'Super jackpot', action: comingSoon },
    { icon: 'gift', label: 'First gift', action: comingSoon },
    { icon: 'promotion', label: 'Invite wheel', action: comingSoon }
  ]

  return (
    <div className="rewards-page">
      <div className="page-title"><div><h2>{title}</h2><p>Rewards, offers and activity</p></div></div>
      <section className="rewards-hero">
        <div className="rewards-brand"><span>♠</span> ROYAL SPIN REWARDS</div>
        <div className="rewards-totals">
          <div><small>Today's bonus</small><strong>₹{f(todayBonus)}</strong></div>
          <div><small>Total bonus</small><strong>₹{f(u.bonus_balance || 0)}</strong></div>
        </div>
        {bonusError && <p className="rewards-error">{bonusError}</p>}
        <div className="rewards-actions">
          <button type="button" onClick={() => onNavigate('bonus')}>Bonus details</button>
          <button type="button" onClick={() => onNavigate('gameStats')}>Game statistics</button>
        </div>
      </section>

      <section className="rewards-shortcuts" aria-label="Bonus options">
        {shortcuts.map((item, index) => (
          <button key={item.label} className={'reward-shortcut reward-shortcut-' + index} onClick={item.action}>
            <span><HubIcon name={item.icon} /></span><b>{item.label}</b>
          </button>
        ))}
      </section>

      <section className="reward-feature-grid">
        <button className="reward-feature" onClick={comingSoon}>
          <span className="reward-art reward-art-gift"><HubIcon name="gift" /></span>
          <b>Gift codes</b>
          <small>Enter a reward code to check available gifts.</small>
          <strong>View gifts <span>›</span></strong>
        </button>
        <button className="reward-feature" onClick={comingSoon}>
          <span className="reward-art reward-art-calendar"><HubIcon name="bonus" /></span>
          <b>Attendance bonus</b>
          <small>Check back for sign-in rewards and special offers.</small>
          <strong>View rewards <span>›</span></strong>
        </button>
      </section>

      <button className="reward-event" onClick={comingSoon}>
        <span><HubIcon name="vip" /></span>
        <div><b>Special events</b><small>New Royal Spin events and rewards will appear here.</small></div>
        <strong>›</strong>
      </button>
    </div>
  )
}

export function Activity({ u, onNavigate }) {
  return <RewardsLanding u={u} onNavigate={onNavigate} title="Activity" />
}

export function ActivityHistory({ u, initialTab = 'bets' }) {
  const [tab, setTab] = useState(initialTab)
  const [bets, setBets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [requests, setRequests] = useState([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [recordFilter, setRecordFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')

  async function loadActivity() {
    if (!u?.id) return
    setLoading(true)
    setLoadError('')
    try {
      const [betResult, transactionResult, requestResult] = await Promise.all([
        supabase.from('bets').select('id,game,amount,win_amount,created_at').eq('user_id', u.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('transactions').select('id,type,amount,balance_after,details,created_at').eq('user_id', u.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('requests').select('id,type,amount,status,upi_id,created_at').eq('user_id', u.id).in('type', ['deposit', 'withdraw']).order('created_at', { ascending: false }).limit(200)
      ])
      const firstError = betResult.error || transactionResult.error || requestResult.error
      if (firstError) {
        console.error('Activity history load error:', firstError)
        setLoadError('Could not load all activity. Please refresh to try again.')
      }
      setBets(betResult.data || [])
      setTransactions(transactionResult.data || [])
      setRequests(requestResult.data || [])
    } catch (error) {
      console.error('Activity history load error:', error)
      setLoadError('Could not load activity. Please refresh to try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTab(initialTab)
    setPage(0)
    setRecordFilter('all')
    setDateFilter('')
    loadActivity()
  }, [u?.id, initialTab])

  const rows = tab === 'bets' ? bets
    : tab === 'transactions' ? transactions
      : requests.filter(request => request.type === tab)
  const filteredRows = rows.filter(row => {
    if (dateFilter && new Date(row.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) !== dateFilter) return false
    if (recordFilter === 'all') return true
    if (tab === 'bets') return recordFilter === 'wins' ? Number(row.win_amount) > Number(row.amount) : Number(row.win_amount) <= Number(row.amount)
    if (tab === 'transactions') return recordFilter === 'credits' ? Number(row.amount) > 0 : Number(row.amount) < 0
    return String(row.status || 'pending').toLowerCase() === recordFilter
  })
  const pageSize = 10
  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const shown = filteredRows.slice(page * pageSize, (page + 1) * pageSize)
  const pageTitle = tab === 'bets' ? 'Game history'
    : tab === 'transactions' ? 'Transaction history'
      : tab === 'deposit' ? 'Deposit history' : 'Withdrawal history'
  const filterOptions = tab === 'bets' ? [['all', 'All results'], ['wins', 'Wins'], ['losses', 'Losses']]
    : tab === 'transactions' ? [['all', 'All transactions'], ['credits', 'Credits'], ['debits', 'Debits']]
      : [['all', 'All statuses'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']]

  function chooseTab(nextTab) {
    setTab(nextTab)
    setPage(0)
    setRecordFilter('all')
    setDateFilter('')
  }

  return (
    <div className="activity-page">
      <div className="page-title"><div><h2>{pageTitle}</h2><p>Review your recent account history.</p></div><button onClick={loadActivity}>Refresh</button></div>
      <div className="activity-tabs">
        {[['bets', 'Game history'], ['transactions', 'Transactions'], ['deposit', 'Deposits'], ['withdraw', 'Withdrawals']].map(([key, label]) => (
          <button key={key} className={tab === key ? 'selected' : ''} onClick={() => chooseTab(key)}>{label}</button>
        ))}
      </div>
      <div className="history-filters">
        <select value={recordFilter} onChange={event => { setRecordFilter(event.target.value); setPage(0) }} aria-label="Filter history">
          {filterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={event => { setDateFilter(event.target.value); setPage(0) }} aria-label="Filter by date" />
      </div>
      {loadError && <p className="page-error">{loadError}</p>}
      <div className="history-records">
        {shown.map(row => {
          if (tab === 'bets') {
            const net = Number(row.win_amount || 0) - Number(row.amount || 0)
            return (
              <div className="activity-row" key={row.id}>
                <div><b>{String(row.game || 'Game').replace(/^\w/, letter => letter.toUpperCase())} · {net > 0 ? 'Win' : 'Loss'}</b><small>{new Date(row.created_at).toLocaleString()} · Bet ₹{f(row.amount)}</small></div>
                <strong className={net > 0 ? 'positive' : 'negative'}>{net > 0 ? '+' : ''}₹{f(net)}</strong>
              </div>
            )
          }
          if (tab === 'transactions') {
            const amount = Number(row.amount || 0)
            const type = String(row.type || 'Transaction').toLowerCase()
            const game = row.details?.game
              ? String(row.details.game).replace(/^\w/, letter => letter.toUpperCase())
              : ''
            const typeLabels = {
              bet: 'Bet placed',
              bet_fee: 'Bet fee',
              bet_fee_refund: 'Bet fee refunded',
              win: 'Win',
              loss: 'Loss',
              refund: 'Refund',
              'deposit reward': 'Deposit reward',
              'deposit bonus claim': 'Deposit bonus claimed',
              'referral reward': 'Referral reward',
              withdraw_hold: 'Withdrawal hold',
              withdraw_hold_refunded: 'Withdrawal refunded',
              'withdraw refunded': 'Withdrawal refunded'
            }
            const reason = row.details?.reason
              || (game && ['bet', 'bet_fee', 'win', 'loss', 'refund', 'bet_fee_refund'].includes(type)
                ? `${game} · ${typeLabels[type]}`
                : typeLabels[type] || type.replace(/_/g, ' ').replace(/^\w/, letter => letter.toUpperCase()))
            const detail = row.details?.utr
              ? `UTR: ${row.details.utr}`
              : row.details?.upi
                ? `UPI: ${row.details.upi}`
                : row.details?.request_id
                  ? `Request: ${String(row.details.request_id).slice(0, 8)}`
                  : game && row.details?.bet_amount
                    ? `${game} · Bet ₹${f(row.details.bet_amount)}`
                    : game || row.type
            const signedAmount = `${amount >= 0 ? '+' : '−'}₹${f(Math.abs(amount))}`
            return (
              <article className="history-record" key={row.id}>
                <div className="history-record-heading">
                  <span><HubIcon name="transactions" /></span>
                  <b>{reason}</b>
                </div>
                <div className="history-record-details">
                  <div><span>Detail</span><b>{detail}</b></div>
                  <div><span>Time</span><b>{new Date(row.created_at).toLocaleString()}</b></div>
                  <div><span>Balance</span><b className={'history-balance ' + (amount >= 0 ? 'positive' : 'negative')}>{signedAmount}</b></div>
                </div>
              </article>
            )
          }
          return (
            <article className="history-record" key={row.id}>
              <div className="history-record-heading">
                <span><HubIcon name={tab === 'deposit' ? 'deposit' : 'withdraw'} /></span>
                <b>{tab === 'deposit' ? 'Deposit request' : 'Withdrawal request'}</b>
                <strong>₹{f(row.amount)}</strong>
              </div>
              <div className="history-record-details">
                <div><span>Detail</span><b>{row.upi_id || 'No reference provided'}</b></div>
                <div><span>Time</span><b>{new Date(row.created_at).toLocaleString()}</b></div>
                <div><span>Status</span><b className={'history-status status-' + String(row.status || 'pending').toLowerCase()}>{row.status || 'Pending'}</b></div>
              </div>
            </article>
          )
        })}
        {!shown.length && <div className="activity-empty">{loading ? 'Loading activity…' : 'No activity found for these filters'}</div>}
      </div>
      {pages > 1 && (
        <div className="activity-pagination">
          <button disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage(current => current + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}

export function GameStatistics({ u, onBack }) {
  const [period, setPeriod] = useState('today')
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!u?.id) return
    let active = true
    async function loadStatistics() {
      setLoading(true)
      setLoadError('')
      try {
        const { start, end } = getIndiaPeriodRange(period)
        const pageSize = 1000
        let offset = 0
        const allBets = []
        while (true) {
          const { data, error } = await supabase
            .from('bets')
            .select('id,game,amount,win_amount,created_at')
            .eq('user_id', u.id)
            .gte('created_at', start)
            .lt('created_at', end)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + pageSize - 1)
          if (error) throw error
          const pageRows = data || []
          allBets.push(...pageRows)
          if (pageRows.length < pageSize) break
          offset += pageSize
        }
        if (active) setBets(allBets)
      } catch (error) {
        console.error('Game statistics load error:', error)
        if (active) setLoadError('Could not load game statistics. Please refresh to try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadStatistics()
    return () => { active = false }
  }, [u?.id, period])

  const totals = bets.reduce((summary, bet) => {
    summary.bet += Number(bet.amount || 0)
    summary.winning += Number(bet.win_amount || 0)
    return summary
  }, { bet: 0, winning: 0 })
  const gameStats = GAMES.map(([game, label]) => {
    const gameBets = bets.filter(bet => bet.game === game)
    return {
      game,
      label,
      bet: gameBets.reduce((total, row) => total + Number(row.amount || 0), 0),
      count: gameBets.length,
      winning: gameBets.reduce((total, row) => total + Number(row.win_amount || 0), 0)
    }
  })

  return (
    <div className="game-statistics-page">
      <div className="page-title game-statistics-title">
        <button type="button" onClick={onBack} aria-label="Back to account">‹</button>
        <div><h2>Game statistics</h2></div>
      </div>
      <div className="statistics-periods">
        {[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month']].map(([key, label]) => (
          <button type="button" key={key} className={period === key ? 'selected' : ''} onClick={() => setPeriod(key)}>{label}</button>
        ))}
      </div>
      <section className="statistics-total">
        <strong>₹{f(totals.bet)}</strong>
        <span>Total bet</span>
      </section>
      {loadError && <p className="page-error">{loadError}</p>}
      <section className="statistics-games">
        {gameStats.map(stat => (
          <article className="statistics-game" key={stat.game}>
            <h3><span><HubIcon name="chart" /></span>{stat.label}</h3>
            <div><span>Total bet</span><strong>₹{f(stat.bet)}</strong></div>
            <div><span>Number of bets</span><strong>{stat.count}</strong></div>
            <div><span>Winning amount</span><strong className="statistics-winning">₹{f(stat.winning)}</strong></div>
          </article>
        ))}
        {!bets.length && !loading && <p className="statistics-empty">No bets recorded for this period.</p>}
        {loading && <p className="statistics-empty">Loading statistics…</p>}
      </section>
    </div>
  )
}

export function AccountHub({ u, isAdmin, onWallet, onActivity, onNavigate, onMessages, onSupport, onLogout }) {
  const comingSoon = () => toast('Coming soon')
  const accountOptions = [
    { icon: 'notifications', label: 'Notifications', action: () => onMessages('notifications') },
    { icon: 'announcement', label: 'Announcements', action: () => onMessages('announcements') },
    { icon: 'gift', label: 'Gifts', action: comingSoon },
    { icon: 'coupon', label: 'Top-up coupons', action: comingSoon },
    { icon: 'chart', label: 'Game statistics', action: () => onNavigate('gameStats') },
    { icon: 'language', label: 'Language', detail: 'English', action: comingSoon }
  ]
  const services = [
    { icon: 'settings', label: 'Settings', action: () => onNavigate('settings') },
    { icon: 'feedback', label: 'Feedback', action: comingSoon },
    { icon: 'support', label: 'Customer service', action: onSupport },
    { icon: 'guide', label: 'Beginner guide', action: comingSoon },
    { icon: 'about', label: 'About Royal Spin', action: comingSoon }
  ]

  return (
    <div className="account-page">
      <section className="account-hero">
        <div className="account-user">
          <div className="account-avatar">{String(u.username || u.name || 'R').slice(0, 1).toUpperCase()}</div>
          <div><b>{u.username || u.name || 'Royal Spin Player'}</b><small>+91 {u.phone}</small></div>
          <span className="account-tier">PLAYER</span>
        </div>
        <div className="account-balance">
          <span>Total balance</span>
          <strong>{u.hide_balance ? '••••••' : `₹${f(u.balance)}`}</strong>
          <button onClick={() => onWallet('d')}>Open wallet</button>
        </div>
      </section>

      <div className="account-shortcuts">
        {[
          ['wallet', 'Wallet', () => onWallet('d')],
          ['deposit', 'Deposit', () => onWallet('d')],
          ['withdraw', 'Withdraw', () => onWallet('w')],
          ['vip', 'VIP', comingSoon]
        ].map(([icon, label, action]) => (
          <button key={label} onClick={action}><span><HubIcon name={icon} /></span>{label}</button>
        ))}
      </div>

      <div className="account-history-grid">
        {[
          ['history', 'Game history', () => onActivity('bets')],
          ['transactions', 'Transactions', () => onActivity('transactions')],
          ['deposit', 'Deposit history', () => onActivity('deposit')],
          ['withdraw', 'Withdraw history', () => onActivity('withdraw')]
        ].map(([icon, label, action]) => (
          <button key={label} onClick={action}><span><HubIcon name={icon} /></span><b>{label}</b><small>View details</small></button>
        ))}
      </div>

      <section className="account-section">
        {accountOptions.map(option => (
          <button className="account-list-row" key={option.label} onClick={option.action}>
            <span className="account-option-icon"><HubIcon name={option.icon} /></span><b>{option.label}</b>
            {option.detail && <small>{option.detail}</small>}<span className="account-chevron">›</span>
          </button>
        ))}
      </section>

      <section className="account-section account-service">
        <h3>Service center</h3>
        <div>{services.map(service => (
          <button key={service.label} onClick={service.action}><span><HubIcon name={service.icon} /></span><small>{service.label}</small></button>
        ))}</div>
      </section>

      <section className="account-systems">
        <button onClick={() => onNavigate('wager')}><span><HubIcon name="wager" /></span><b>Wager requirement</b><strong>₹{f(u.bonus_needed || 0)}</strong></button>
        <button onClick={() => onNavigate('bonus')}><span><HubIcon name="bonus" /></span><b>Bonus balance</b><strong>₹{f(u.bonus_balance || 0)}</strong></button>
        <button onClick={() => onNavigate('vault')}><span><HubIcon name="vault" /></span><b>Vault</b><strong>₹{f(u.vault_balance || 0)}</strong></button>
        <button onClick={() => onNavigate('profile')}><span><HubIcon name="profile" /></span><b>Profile & stats</b><strong>›</strong></button>
      </section>

      {isAdmin && <button className="account-admin" onClick={() => onNavigate('admin')}>Open Admin Panel</button>}
      <button className="account-logout" onClick={onLogout}>Log out</button>
    </div>
  )
}

export function PromotionHub({ u, onNavigate }) {
  return (
    <div className="promotion-page">
      <RewardsLanding u={u} onNavigate={onNavigate} title="Promotion" />
      <Referral u={u} />
    </div>
  )
}

export function Support({ u }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chatError, setChatError] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef(null)

  function supportErrorMessage(error) {
    if (error?.code === '42P01' || error?.code === 'PGRST205') {
      return 'Support chat is not set up yet. Please ask the site administrator to apply support_messages_migration.sql.'
    }
    if (error?.code === '42501' || error?.code === 'PGRST301') {
      return 'Support chat database permissions are not configured. Please contact the site administrator.'
    }
    return error?.message || 'An unexpected database error occurred.'
  }

  const loadMessages = async () => {
    if (!u?.id) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, sender_role, message, created_at')
      .eq('user_id', u.id)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Support messages load error:', error)
      setChatError(supportErrorMessage(error))
      setLoading(false)
      return
    }
    setMessages(data || [])
    setChatError('')
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    loadMessages()
    const timer = setInterval(loadMessages, 10000)
    const openChat = () => setIsOpen(true)
    window.addEventListener('rs-open-support', openChat)
    return () => {
      clearInterval(timer)
      window.removeEventListener('rs-open-support', openChat)
    }
  }, [u?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  async function send() {
    const message = draft.trim()
    if (!message || sending || loading || chatError || !u?.id) return
    setSending(true)
    try {
      const { error } = await supabase.from('support_messages').insert({
        user_id: u.id,
        sender_role: 'user',
        message
      })
      if (error) throw error

      const hasAutoReply = messages.some(item => item.sender_role === 'system')
      if (!hasAutoReply) {
        const { error: autoReplyError } = await supabase.from('support_messages').insert({
          user_id: u.id,
          sender_role: 'system',
          message: 'Please wait while our support team reviews your message and responds.'
        })
        if (autoReplyError) throw autoReplyError
      }

      setDraft('')
      setChatError('')
      await loadMessages()
    } catch (error) {
      console.error('Support message send error:', error)
      setChatError(supportErrorMessage(error))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="support-widget">
      {isOpen && (
        <section className="support-panel" aria-label="Customer support chat">
          <div className="support-header">
            <div className="support-avatar">♠</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>Royal Spin Support</b>
              <div className="small" style={{ color: '#d3e6dc' }}>We’re here to help</div>
            </div>
            <button type="button" className="support-close" onClick={() => setIsOpen(false)} aria-label="Close support chat">×</button>
          </div>
          <div className="support-messages" aria-live="polite">
            {!messages.length && !loading && !chatError && (
              <div className="support-welcome">Hi! Send us a message and our team will get back to you here.</div>
            )}
            {loading && !messages.length && <div className="support-state">Loading conversation…</div>}
            {messages.map(item => {
              const fromPlayer = item.sender_role === 'user'
              return (
                <div key={item.id} className={'support-message ' + (fromPlayer ? 'support-message-player' : 'support-message-team')}>
                  <div>{item.message}</div>
                  <time>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              )
            })}
            {chatError && <div className="support-error" role="alert">{chatError}</div>}
            <div ref={messagesEndRef} />
          </div>
          <form className="support-compose" onSubmit={(event) => { event.preventDefault(); send() }}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  send()
                }
              }}
              placeholder="Type a message…"
              rows={1}
              maxLength={2000}
              disabled={loading || !!chatError}
              aria-label="Type a support message"
            />
            <button type="submit" className="support-send" disabled={sending || loading || !!chatError || !draft.trim()} aria-label="Send message">
              {sending ? '…' : '➤'}
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className="support-launcher"
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
      >
        {isOpen ? '×' : '✉'}
        {!isOpen && <span>Support</span>}
      </button>
    </div>
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
      <p className="small">Amount you still need to wager before withdrawals are available.</p>
      <div className="bar" style={{ margin: '14px 0' }}>
        <i style={{ width: Math.min(100, ((u.total_wagered || 0) / Math.max(1, (u.total_wagered || 0) + (u.bonus_needed || 0))) * 100) + '%' }} />
      </div>
      <p className="small">Total wagered so far: <b>₹{f(u.total_wagered || 0)}</b></p>
      <p className="small">
        Bet fee: ₹{BET_FEE_AMOUNT} per completed ₹{BET_FEE_WAGER_STEP} wagered.
        ₹{f(u.bet_fee_progress || 0)} counted toward the next fee.
      </p>
    </div>
  )
}

export function Bonus({ u }) {
  const [claiming, setClaiming] = useState(false)

  async function claimBonus() {
    if (claiming) return
    setClaiming(true)
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: latestUser, error: loadError } = await supabase
          .from('users')
          .select('balance,bonus_balance')
          .eq('id', u.id)
          .maybeSingle()
        if (loadError || !latestUser) {
          console.error('Bonus claim balance lookup error:', loadError)
          toast('Could not load your bonus balance. Please try again.')
          return
        }

        const amount = Number(latestUser.bonus_balance || 0)
        if (!(amount > 0)) {
          await refreshUser()
          toast('No deposit bonus is available to claim')
          return
        }

        const balance = Number(latestUser.balance || 0)
        const nextBalance = Number((balance + amount).toFixed(2))
        let claimQuery = supabase
          .from('users')
          .update({ balance: nextBalance, bonus_balance: 0, updated_at: new Date().toISOString() })
          .eq('id', u.id)
        claimQuery = latestUser.balance == null
          ? claimQuery.is('balance', null)
          : claimQuery.eq('balance', latestUser.balance)
        claimQuery = latestUser.bonus_balance == null
          ? claimQuery.is('bonus_balance', null)
          : claimQuery.eq('bonus_balance', latestUser.bonus_balance)
        const { data: claimedUser, error: claimError } = await claimQuery.select('id').maybeSingle()
        if (claimError) {
          console.error('Bonus claim update error:', claimError)
          toast('Could not claim your bonus. Please try again.')
          return
        }
        if (!claimedUser) continue

        const { error: transactionError } = await supabase.from('transactions').insert({
          user_id: u.id,
          type: 'Deposit bonus claim',
          amount,
          balance_after: nextBalance,
          details: { source: 'deposit_bonus_claim' }
        })
        await refreshUser()
        if (transactionError) {
          console.error('Bonus claim transaction log error:', transactionError)
          toast('Bonus claimed, but the transaction history could not be saved.')
        } else {
          toast('₹' + f(amount) + ' bonus claimed to your wallet')
        }
        return
      }

      toast('Your bonus changed while claiming. Please try again.')
    } catch (error) {
      console.error('Bonus claim error:', error)
      toast('Could not claim your bonus. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="bonus-details-page">
      <div className="page-title"><div><h2>Bonus details</h2><p>Claim your approved deposit bonus.</p></div></div>
      <section className="bonus-claim-card">
        <span className="bonus-claim-icon"><HubIcon name="bonus" /></span>
        <small>Available to claim</small>
        <strong>₹{f(u.bonus_balance || 0)}</strong>
        <p>Deposit bonuses are kept here until you claim them to your wallet.</p>
        <button className="wallet-submit" onClick={claimBonus} disabled={claiming || Number(u.bonus_balance || 0) <= 0}>
          {claiming ? 'Claiming…' : Number(u.bonus_balance || 0) > 0 ? 'Claim bonus' : 'No bonus available'}
        </button>
      </section>
    </div>
  )
}

export function NotificationCenter({ u, announcements = [], initialTab = 'notifications' }) {
  const [tab, setTab] = useState(initialTab)
  const [requests, setRequests] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (!u?.id) return
    let active = true
    async function loadMessages() {
      setLoading(true)
      setLoadError('')
      try {
        const [requestResult, transactionResult] = await Promise.all([
          supabase.from('requests').select('id,type,amount,status,created_at,updated_at')
            .eq('user_id', u.id).in('type', ['deposit', 'withdraw']).order('updated_at', { ascending: false }).limit(100),
          supabase.from('transactions').select('id,type,amount,created_at')
            .eq('user_id', u.id).order('created_at', { ascending: false }).limit(100)
        ])
        if (!active) return
        if (requestResult.error) console.error('Notification request load error:', requestResult.error)
        if (transactionResult.error) console.error('Notification transaction load error:', transactionResult.error)
        setRequests(requestResult.data || [])
        setTransactions(transactionResult.data || [])
        setLoadError(requestResult.error || transactionResult.error ? 'Some notifications could not be loaded.' : '')
      } catch (error) {
        console.error('Notification load error:', error)
        if (active) setLoadError('Could not load notifications. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadMessages()
    return () => { active = false }
  }, [u?.id])

  const requestNotifications = requests
    .filter(request => ['approved', 'rejected'].includes(String(request.status || '').toLowerCase()))
    .map(request => {
      const type = String(request.type).toLowerCase()
      const status = String(request.status).toLowerCase()
      const amount = Number(request.amount || 0)
      const isDeposit = type === 'deposit'
      const heading = `${isDeposit ? 'Deposit' : 'Withdrawal'} ${status}`
      const body = status === 'approved'
        ? isDeposit
          ? `Your deposit of ₹${f(amount)} was approved.`
          : `Your withdrawal request for ₹${f(amount)} was approved.`
        : `Your ${isDeposit ? 'deposit' : 'withdrawal'} request for ₹${f(amount)} was rejected.`
      return { id: `request-${request.id}`, heading, body, created_at: request.updated_at || request.created_at }
    })
  const transactionNotifications = transactions.flatMap(transaction => {
    const type = String(transaction.type || '').toLowerCase()
    const amount = Number(transaction.amount || 0)
    if (type === 'referral reward') {
      return [{ id: `transaction-${transaction.id}`, heading: 'Referral reward', body: `₹${f(amount)} referral reward was added to your wallet.`, created_at: transaction.created_at }]
    }
    if (type === 'deposit bonus claim') {
      return [{ id: `transaction-${transaction.id}`, heading: 'Deposit bonus claimed', body: `₹${f(amount)} deposit bonus was claimed to your wallet.`, created_at: transaction.created_at }]
    }
    if (type === 'deposit reward') {
      return [{ id: `transaction-${transaction.id}`, heading: 'Deposit bonus credited', body: `₹${f(amount)} deposit bonus was credited to your wallet.`, created_at: transaction.created_at }]
    }
    return []
  })
  const notifications = [
    {
      id: 'welcome',
      heading: 'Welcome to Royal Spin',
      body: 'Thanks for joining us. Explore the games, review your account activity, and contact support whenever you need help.',
      created_at: u.created_at || new Date().toISOString()
    },
    ...[
    ...(Number(u.bonus_balance || 0) > 0 ? [{
      id: 'claimable-bonus',
      heading: 'Deposit bonus available',
      body: `₹${f(u.bonus_balance)} is ready to claim from Bonus details.`,
      created_at: new Date().toISOString()
    }] : []),
    ...requestNotifications,
    ...transactionNotifications
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  ]
  const activeAnnouncements = (Array.isArray(announcements) ? announcements : [])
    .filter(announcement => announcement && announcement.active !== false)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  return (
    <div className="notification-page">
      <div className="page-title"><div><h2>{tab === 'notifications' ? 'Notification' : 'Announcements'}</h2><p>Updates about your account and Royal Spin.</p></div></div>
      <div className="notification-tabs" role="tablist" aria-label="Messages">
        <button type="button" role="tab" aria-selected={tab === 'notifications'} className={tab === 'notifications' ? 'selected' : ''} onClick={() => setTab('notifications')}>Notifications</button>
        <button type="button" role="tab" aria-selected={tab === 'announcements'} className={tab === 'announcements' ? 'selected' : ''} onClick={() => setTab('announcements')}>Announcements</button>
      </div>
      {loadError && tab === 'notifications' && <p className="page-error">{loadError}</p>}
      <div className="notification-list">
        {tab === 'notifications' ? (
          <>
            {notifications.map(item => (
              <article className="notification-card" key={item.id}>
                <div className="notification-card-heading"><span><HubIcon name="notifications" /></span><b>{item.heading}</b></div>
                <p>{item.body}</p>
                <time>{new Date(item.created_at).toLocaleString()}</time>
              </article>
            ))}
            {loading && <div className="activity-empty">Loading notifications…</div>}
          </>
        ) : (
          <>
            {activeAnnouncements.map(item => (
              <article className="notification-card announcement-card" key={item.id}>
                <div className="notification-card-heading"><span><HubIcon name="announcement" /></span><b>{item.heading}</b></div>
                <p>{item.body}</p>
                {item.created_at && <time>{new Date(item.created_at).toLocaleString()}</time>}
              </article>
            ))}
            {!activeAnnouncements.length && <div className="activity-empty">No announcements at this time.</div>}
          </>
        )}
      </div>
    </div>
  )
}

export function Referral({ u }) {
  const [referralLink, setReferralLink] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [earnings, setEarnings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!u?.id) return
    setReferralLink(`${window.location.origin}/?ref=${encodeURIComponent(u.id)}`)

    let active = true
    async function loadReferralEarnings() {
      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase
        .from('transactions')
        .select('amount,details')
        .eq('user_id', u.id)
        .eq('type', 'Referral reward')
      if (!active) return
      if (queryError) {
        console.error('Referral earnings load error:', queryError)
        setError('Could not load referral earnings')
        setLoading(false)
        return
      }

      const referredPlayers = new Set((data || []).map(row => row.details?.referred_user_id).filter(Boolean))
      setReferralCount(referredPlayers.size)
      setEarnings((data || []).reduce((total, row) => total + Number(row.amount || 0), 0))
      setLoading(false)
    }
    loadReferralEarnings()

    return () => { active = false }
  }, [u?.id])

  async function copyReferralLink() {
    try {
      await navigator.clipboard.writeText(referralLink)
      toast('Referral link copied')
    } catch (copyError) {
      console.error('Referral link copy error:', copyError)
      toast('Could not copy the link; select and copy it manually')
    }
  }

  return (
    <div className="card">
      <b>Refer &amp; Earn</b>
      <p className="small">Earn {REFERRAL_REWARD_PERCENT}% of every approved deposit made by a player who joins using your link.</p>
      <label>Your referral link</label>
      <input readOnly value={referralLink} onFocus={event => event.target.select()} />
      <button className="p" style={{ width: '100%', marginTop: 10 }} onClick={copyReferralLink} disabled={!referralLink}>
        Copy referral link
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <span>Players who deposited</span>
        <b>{loading ? '…' : referralCount}</b>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span>Referral earnings</span>
        <b>{loading ? '…' : `₹${f(earnings)}`}</b>
      </div>
      {error && <p className="small" style={{ color: 'var(--bad)' }}>{error}</p>}
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
