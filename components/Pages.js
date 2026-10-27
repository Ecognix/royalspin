'use client'
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { db, commit, toast, f, addtx } from '../lib/db'

export function Wallet({ u, me }) {
  const D = db()
  const [tab, setTab] = useState('d'), [dq, setDq] = useState(500), [utr, setUtr] = useState('')
  const [wu, setWu] = useState(''), [wa, setWa] = useState('')
  const link = `upi://pay?pa=${encodeURIComponent(D.cfg.upi)}&pn=RoyalSpinDemo&am=${dq}&cu=INR`
  const my = D.reqs.filter((r) => r.u === me)
  function dsub() {
    if (!/^\d{12}$/.test(utr.trim())) return toast('UTR must be 12 digits')
    if (D.reqs.some((r) => r.utr === utr.trim())) return toast('UTR already used')
    if (!(dq >= 1)) return toast('Enter amount')
    D.reqs.unshift({ id: Date.now(), u: me, type: 'Deposit', amt: +dq, utr: utr.trim(), status: 'Pending', t: Date.now() })
    commit(); setUtr(''); toast('Submitted. Awaiting approval')
  }
  function wsub() {
    const a = +wa
    if (!wu.trim() || !(a > 0) || a > u.bal) return toast('Check UPI ID and amount')
    u.bal -= a; addtx(u, 'Withdraw request', -a)
    D.reqs.unshift({ id: Date.now(), u: me, type: 'Withdraw', amt: a, utr: wu.trim(), status: 'Pending', t: Date.now() })
    commit(); setWa(''); toast('Withdrawal requested')
  }
  return (
    <>
      <div className="card"><b>Demo wallet</b><div className="big">₹{f(u.bal)}</div>
        <p className="small">Dummy money. No real payments happen here.</p>
        <div className="row"><button className="p" onClick={() => setTab('d')}>Deposit</button><button onClick={() => setTab('w')}>Withdraw</button></div></div>
      {tab === 'd' ? (
        <div className="card"><b>UPI deposit (demo)</b>
          <label>Amount</label><input type="number" value={dq} onChange={(e) => setDq(e.target.value)} />
          <div style={{ textAlign: 'center', margin: '12px 0' }}>
            <div className="qr"><QRCodeSVG value={link} size={170} /></div>
            <p className="small">Pay to {D.cfg.upi} · amount fills on scan</p></div>
          <label>12 digit UTR number</label><input inputMode="numeric" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value)} />
          <button className="p" style={{ width: '100%', marginTop: 10 }} onClick={dsub}>Submit UTR</button></div>
      ) : (
        <div className="card"><b>Withdraw</b>
          <label>UPI ID</label><input placeholder="name@bank" value={wu} onChange={(e) => setWu(e.target.value)} />
          <label>Amount</label><input type="number" value={wa} onChange={(e) => setWa(e.target.value)} />
          <button className="p" style={{ width: '100%', marginTop: 10 }} onClick={wsub}>Request withdrawal</button></div>
      )}
      <div className="card"><b>Requests</b><table><tbody>
        {my.map((r) => <tr key={r.id}><td>{r.type}</td><td>₹{f(r.amt)}</td><td>{r.utr}</td><td>{r.status}</td></tr>)}
        {!my.length && <tr><td className="small">None yet</td></tr>}</tbody></table></div>
      <div className="card"><b>Transactions</b><table><tbody>
        {u.tx.map((t, i) => <tr key={i}><td>{t[0]}</td><td style={{ color: t[1] >= 0 ? 'var(--ac)' : 'var(--bad)' }}>{t[1] >= 0 ? '+' : ''}{f(t[1])}</td></tr>)}</tbody></table></div>
    </>
  )
}

export function Vault({ u }) {
  const [a, setA] = useState('')
  function move(lock) {
    const x = +a; if (!(x > 0)) return
    if (lock) { if (x > u.bal) return toast('Low balance'); u.bal -= x; u.vault += x }
    else { if (x > u.vault) return toast('Not enough in vault'); u.vault -= x; u.bal += x }
    commit(); setA('')
  }
  return (
    <div className="card"><b>Vault</b><div className="big">₹{f(u.vault)}</div>
      <p className="small">Coins in the vault cannot be used for bets until you move them back.</p>
      <label>Amount</label><input type="number" value={a} onChange={(e) => setA(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}><button className="p" onClick={() => move(true)}>Lock in</button><button onClick={() => move(false)}>Unlock</button></div></div>
  )
}

export function Wager({ u, me }) {
  const bets = db().bets.filter((b) => b.u === me).slice(0, 25)
  return (
    <>
      <div className="card"><b>Wager stats</b><table><tbody>
        <tr><td>Total wagered</td><td>₹{f(u.wager)}</td></tr><tr><td>Bets</td><td>{u.n}</td></tr>
        <tr><td>Wins</td><td>{u.wins}</td></tr>
        <tr><td>Net profit</td><td style={{ color: u.pnl >= 0 ? 'var(--ac)' : 'var(--bad)' }}>₹{f(u.pnl)}</td></tr></tbody></table></div>
      <div className="card"><b>My bets</b><table><tbody>
        {bets.map((b, i) => <tr key={i}><td>{b.g}</td><td>₹{f(b.a)}</td><td style={{ color: b.w > b.a ? 'var(--ac)' : 'var(--bad)' }}>₹{f(b.w)}</td></tr>)}</tbody></table></div>
    </>
  )
}

export function Bonus({ u }) {
  const c = db().cfg
  function claim() { if (u.wel) return; u.wel = 1; u.bonus += c.welcome; u.bneed += c.welcome * c.wr; commit() }
  function unlock() {
    if (u.bonus <= 0) return toast('No bonus')
    if (u.bneed > 0) return toast('Wager ₹' + f(u.bneed) + ' more')
    u.bal += u.bonus; addtx(u, 'Bonus unlocked', u.bonus); u.bonus = 0; commit()
  }
  return (
    <div className="card"><b>Bonuses</b>
      <p className="small">Welcome bonus ₹{c.welcome}. Deposit bonus {c.dep}%. Bonus coins unlock after wagering {c.wr}× the bonus.</p>
      <div className="big">₹{f(u.bonus)}</div><p className="small">Still to wager: ₹{f(u.bneed)}</p>
      <div className="row"><button className="p" onClick={claim} disabled={!!u.wel}>Claim welcome</button><button onClick={unlock}>Unlock to wallet</button></div></div>
  )
}

export function Profile({ u, me }) {
  const [n, setN] = useState(u.name)
  const lv = u.wager >= 50000 ? 'Platinum' : u.wager >= 10000 ? 'Gold' : u.wager >= 1000 ? 'Silver' : 'Bronze'
  return (
    <div className="card"><div style={{ fontSize: 42 }}>🧑</div><b>{u.name}</b>
      <p className="small">{me} · joined {new Date(u.joined).toLocaleDateString()}</p>
      <p>VIP level: <b style={{ color: 'var(--ac)' }}>{lv}</b></p>
      <label>Display name</label><input value={n} onChange={(e) => setN(e.target.value)} />
      <button className="p" style={{ marginTop: 10 }} onClick={() => { u.name = n; commit(); toast('Saved') }}>Save</button></div>
  )
}

export function Settings({ u, onLogout }) {
  const [np, setNp] = useState('')
  return (
    <div className="card"><b>Settings</b>
      <label><input type="checkbox" checked={!!u.hide} onChange={(e) => { u.hide = e.target.checked; commit() }} /> Hide balance</label>
      <label>New password</label><input type="password" value={np} onChange={(e) => setNp(e.target.value)} />
      <button className="p" style={{ margin: '10px 0' }} onClick={() => { if (np.length < 6) return toast('Min 6 characters'); u.pw = np; commit(); setNp(''); toast('Password changed') }}>Change password</button>
      <hr style={{ borderColor: 'var(--ln)' }} /><button className="d" onClick={onLogout}>Log out</button></div>
  )
}
