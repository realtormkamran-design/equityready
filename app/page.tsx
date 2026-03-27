'use client'

import { useState } from 'react'

const RENOS = [
  { label: 'Kitchen — full renovation', low: 25000, high: 45000 },
  { label: 'Kitchen — partial update', low: 10000, high: 20000 },
  { label: 'Primary bathroom — full', low: 15000, high: 25000 },
  { label: 'Secondary bathroom', low: 8000, high: 15000 },
  { label: 'Flooring throughout', low: 12000, high: 22000 },
  { label: 'Basement suite added', low: 40000, high: 65000 },
  { label: 'Deck / outdoor space', low: 8000, high: 18000 },
  { label: 'New windows', low: 8000, high: 15000 },
  { label: 'Fresh paint throughout', low: 5000, high: 10000 },
  { label: 'New roof / HVAC', low: 5000, high: 10000 },
]

const BASE_LOW = 1353000
const BASE_HIGH = 1443000

function fmt(n: number) {
  return '$' + n.toLocaleString('en-CA')
}

type Gate = 'gate1' | 'gate2' | 'gate3' | 'gate4' | 'privacy'

export default function Home() {
  const [gate, setGate] = useState<Gate>('gate1')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [leadId, setLeadId] = useState<string | null>(null)
  const [narrative, setNarrative] = useState('')
  const [loadingNarrative, setLoadingNarrative] = useState(false)
  const [loadingUnlock, setLoadingUnlock] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [renoChecked, setRenoChecked] = useState<boolean[]>(new Array(10).fill(false))

  const renoTotLow = RENOS.reduce((s, r, i) => s + (renoChecked[i] ? r.low : 0), 0)
  const renoTotHigh = RENOS.reduce((s, r, i) => s + (renoChecked[i] ? r.high : 0), 0)
  const renoCount = renoChecked.filter(Boolean).length
  const renoLow = BASE_LOW + renoTotLow
  const renoHigh = BASE_HIGH + renoTotHigh

  async function submitG1() {
    if (!address.trim()) return
    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, postal: 'V2Y', utmSource: new URLSearchParams(window.location.search).get('utm_source') }),
      })
      const data = await res.json()
      if (data.leadId) setLeadId(data.leadId)
    } catch (e) { /* continue anyway */ }
    setGate('gate2')
  }

  async function submitG2() {
    if (!name || !phone) return
    setLoadingUnlock(true)
    try {
      await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, name, phone }),
      })
    } catch (e) {}
    setLoadingUnlock(false)
    setGate('gate3')
    setLoadingNarrative(true)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (data.narrative) setNarrative(data.narrative)
    } catch (e) {}
    setLoadingNarrative(false)
  }

  async function submitG3() {
    if (!email) return
    setLoadingEmail(true)
    try {
      await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, email }),
      })
    } catch (e) {}
    setLoadingEmail(false)
    setGate('gate4')
  }

  function toggleReno(i: number) {
    const next = [...renoChecked]
    next[i] = !next[i]
    setRenoChecked(next)
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --navy:#0A1628;--navy2:#0D1F3C;
          --teal:#0D9488;--teal2:#0F766E;
          --gold:#C8952A;--gold2:#F0C040;--gold-bg:#FEF9EC;--gold-border:#E8B84B;
          --white:#fff;--off:#F4F6FB;--gray:#64748B;--lgray:#CBD5E1;--border:#E2E8F0;
          --green:#166534;--green-bg:#DCFCE7;
        }
        html,body{font-family:'DM Sans',system-ui,sans-serif;background:var(--navy);color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased}
        input,button,select{font-family:inherit}
        .page{display:none;min-height:100vh;flex-direction:column}
        .page.active{display:flex}
        .topnav{padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06)}
        .logo{font-size:20px;font-weight:700;color:var(--gold2);cursor:pointer;font-family:Georgia,serif}
        .btn{border:none;border-radius:10px;padding:13px 20px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;transition:.18s}
        .btn-teal{background:var(--teal);color:#fff}.btn-teal:hover{background:var(--teal2)}
        .btn-navy{background:var(--navy);color:var(--gold2);border:1.5px solid rgba(200,149,42,.4)}.btn-navy:hover{background:var(--navy2)}
        .inp{width:100%;padding:13px 15px;border-radius:10px;border:1.5px solid var(--border);background:#fff;font-size:16px;color:var(--navy);outline:none;transition:.18s}
        .inp:focus{border-color:var(--teal)}
        .inp-dark{background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.1);color:#fff}
        .inp-dark::placeholder{color:rgba(255,255,255,.3)}
        .inp-dark:focus{border-color:var(--teal);background:rgba(255,255,255,.1)}
        .card{background:#fff;border-radius:14px;border:1px solid var(--border);overflow:hidden}
        .card-header{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
        .card-header h3{font-size:14px;font-weight:600;color:var(--navy)}
        .card-body{padding:20px}
        .stat-card{background:var(--navy2);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:22px 26px;border-top:3px solid}
        .blur-val{filter:blur(7px);user-select:none}
        .lock-ov{position:absolute;inset:0;background:rgba(8,18,34,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
        .g2-card{background:var(--navy2);border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:20px 16px;text-align:center;min-height:118px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden}
        .reno-check{display:flex;align-items:flex-start;gap:8px;background:var(--off);border:1.5px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;transition:.15s}
        .reno-check:hover,.reno-check.sel{border-color:var(--teal);background:rgba(13,148,136,.06)}
        .above{color:var(--green);font-weight:600}
        .tl-right{padding-bottom:16px;border-left:2px solid var(--border);padding-left:16px;position:relative}
        .tl-right::before{content:'';position:absolute;left:-5px;top:6px;width:8px;height:8px;border-radius:50%;background:var(--teal)}
        .dot{width:7px;height:7px;border-radius:50%;background:currentColor;animation:pulse 2s infinite;flex-shrink:0}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
        @media(max-width:700px){
          .two-col{grid-template-columns:1fr!important}
          .three-col{grid-template-columns:1fr!important}
          .hide-mobile{display:none!important}
        }
      `}</style>

      {/* ═══ GATE 1 ═══ */}
      <main className="page active" id="g1" style={{display: gate==='gate1'?'flex':'none', background:'var(--navy)', position:'relative', overflow:'hidden', paddingTop:40}}>
        <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:0}}>
          <div style={{position:'absolute',top:'-15%',right:'-8%',width:560,height:560,borderRadius:'50%',background:'radial-gradient(circle,rgba(13,148,136,.16) 0%,transparent 68%)'}}/>
          <div style={{position:'absolute',bottom:'-20%',left:'-8%',width:480,height:480,borderRadius:'50%',background:'radial-gradient(circle,rgba(200,149,42,.09) 0%,transparent 68%)'}}/>
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)',backgroundSize:'56px 56px'}}/>
        </div>

        <nav className="topnav" style={{position:'relative',zIndex:1}}>
          <div className="logo">EquityReady</div>
          <a href="#" onClick={e=>{e.preventDefault();setGate('privacy')}} style={{fontSize:12,color:'var(--gray)',textDecoration:'none'}}>Privacy</a>
        </nav>

        <div style={{position:'relative',zIndex:1,flex:1,display:'flex',flexDirection:'column',padding:'44px 24px 36px',maxWidth:1080,margin:'0 auto',width:'100%'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 400px',gap:60,alignItems:'center',flex:1}} className="two-col">
            <div>
              <div style={{display:'inline-flex',alignItems:'center',gap:7,background:'rgba(13,148,136,.1)',border:'1px solid rgba(13,148,136,.28)',borderRadius:24,padding:'5px 14px',fontSize:11,color:'var(--teal)',fontWeight:500,marginBottom:24}}>
                <div className="dot" style={{color:'var(--teal)'}}/>
                Willoughby market data — updated Oct 2025
              </div>
              <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(32px,4.8vw,54px)',fontWeight:800,lineHeight:1.08,marginBottom:16,letterSpacing:'-.4px'}}>
                Before you call<br/>a realtor,<br/><span style={{color:'var(--gold2)'}}>know your number.</span>
              </h1>
              <p style={{fontSize:16,color:'var(--lgray)',lineHeight:1.7,marginBottom:20,maxWidth:500}}>
                Your home&apos;s real value isn&apos;t on your BC Assessment notice. Enter your address and get an accurate estimate in <strong style={{color:'#fff'}}>30 seconds</strong> — based on actual sales data from your street.
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:20}}>
                <input className="inp inp-dark" type="text" placeholder="e.g. 201B St, Willoughby, Langley BC" value={address} onChange={e=>setAddress(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitG1()}/>
                <button className="btn btn-teal" onClick={submitG1}>
                  Get my home&apos;s value →
                </button>
                <p style={{fontSize:11,color:'var(--gray)',textAlign:'center'}}>Free — no account needed — instant results</p>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="stat-card" style={{borderTopColor:'var(--teal)'}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:36,fontWeight:700,marginBottom:4,color:'var(--gold2)'}}>$468</div>
                <div style={{fontSize:12,color:'var(--lgray)'}}>avg $/sqft — recent Willoughby sales</div>
              </div>
              <div className="stat-card" style={{borderTopColor:'var(--gold2)'}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:36,fontWeight:700,marginBottom:4,color:'#fff'}}>28 days</div>
                <div style={{fontSize:12,color:'var(--lgray)'}}>avg days on market — homes are moving</div>
              </div>
              <div className="stat-card" style={{borderTopColor:'#16a34a'}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:36,fontWeight:700,marginBottom:4,color:'var(--teal)'}}>+$111K</div>
                <div style={{fontSize:12,color:'var(--lgray)'}}>avg above BCA assessed — 2 of 3 homes</div>
              </div>
            </div>
          </div>
          <div style={{paddingTop:32,borderTop:'1px solid rgba(255,255,255,.06)',fontSize:11,color:'var(--gray)',display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:6,marginTop:32}}>
            <span>Based on 3 verified MLS transactions · Willoughby, Sept–Oct 2025</span>
            <span>Powered by Kamran Khan, REALTOR® · Royal Lepage Global Force Realty</span>
          </div>
        </div>
      </main>

      {/* ═══ GATE 2 ═══ */}
      <main style={{display: gate==='gate2'?'flex':'none', flexDirection:'column', minHeight:'100vh', background:'var(--navy)', paddingTop:40}}>
        <nav className="topnav"><div className="logo" onClick={()=>setGate('gate1')}>EquityReady</div><div style={{fontSize:12,color:'var(--lgray)'}}>Step 1 of 2</div></nav>
        <div style={{flex:1,padding:'36px 24px',maxWidth:700,margin:'0 auto',width:'100%'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:9,background:'rgba(13,148,136,.09)',border:'1px solid rgba(13,148,136,.22)',borderRadius:24,padding:'9px 16px',fontSize:12,color:'var(--teal)',fontWeight:500,marginBottom:24}}>
            <div className="dot" style={{color:'var(--teal)'}}/>
            Property detected: <strong style={{marginLeft:4}}>{address || '123 Willoughby St'}</strong>
          </div>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,marginBottom:7}}>We found your property</h2>
          <p style={{color:'var(--lgray)',fontSize:14,marginBottom:22,lineHeight:1.6}}>Your estimate is ready. Enter your name and phone to unlock it.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}} className="three-col">
            <div className="g2-card">
              <div style={{fontSize:10,color:'var(--lgray)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:8,fontWeight:500}}>BCA Assessed</div>
              <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700}}>$1,439,000</div>
              <div style={{fontSize:10,color:'var(--lgray)',marginTop:5}}>your notice figure</div>
            </div>
            <div className="g2-card">
              <div className="lock-ov">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold2)" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span style={{fontSize:9,textTransform:'uppercase',letterSpacing:1,color:'rgba(255,255,255,.55)',fontWeight:600}}>Locked</span>
              </div>
              <div className="blur-val">
                <div style={{fontSize:10,color:'var(--lgray)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:8,fontWeight:500}}>Market Estimate</div>
                <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700}}>$1,522,000</div>
              </div>
            </div>
            <div className="g2-card">
              <div className="lock-ov">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold2)" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span style={{fontSize:9,textTransform:'uppercase',letterSpacing:1,color:'rgba(255,255,255,.55)',fontWeight:600}}>Locked</span>
              </div>
              <div className="blur-val">
                <div style={{fontSize:10,color:'var(--lgray)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:8,fontWeight:500}}>Est. Net In Hand</div>
                <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700}}>$1,408,000</div>
              </div>
            </div>
          </div>
          <div style={{background:'#fff',borderRadius:14,padding:26}}>
            <div style={{fontSize:17,fontWeight:700,color:'var(--navy)',marginBottom:5}}>Unlock your full estimate</div>
            <div style={{fontSize:13,color:'var(--gray)',marginBottom:18}}>No spam. No pressure. Used only to prepare your personalized report.</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}} className="two-col">
                <input className="inp" type="text" placeholder="First name" value={name} onChange={e=>setName(e.target.value)}/>
                <input className="inp" type="tel" placeholder="Phone number" value={phone} onChange={e=>setPhone(e.target.value)}/>
              </div>
              <button className="btn btn-navy" onClick={submitG2} disabled={loadingUnlock}>
                {loadingUnlock ? 'Unlocking...' : 'Unlock my estimate →'}
              </button>
              <p style={{fontSize:11,color:'var(--gray)',textAlign:'center'}}>We will never share your information. Ever.</p>
            </div>
          </div>
        </div>
      </main>

      {/* ═══ GATE 3 — REPORT ═══ */}
      <main style={{display: gate==='gate3'?'flex':'none', flexDirection:'column', minHeight:'100vh', background:'var(--off)', paddingTop:40}}>
        <nav className="topnav" style={{background:'var(--navy)'}}><div className="logo" onClick={()=>setGate('gate1')}>EquityReady</div><div style={{fontSize:12,color:'var(--lgray)'}}>Your personalized report</div></nav>
        <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 320px',gap:20,padding:'24px',maxWidth:1080,margin:'0 auto',width:'100%',alignItems:'start'}} className="two-col">
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* Equity numbers */}
            <div className="card">
              <div className="card-header">
                <h3>Equity report — <span style={{color:'var(--teal)'}}>{address}</span></h3>
                <span style={{fontSize:11,color:'var(--gray)'}}>Willoughby · 2004 build</span>
              </div>
              <div className="card-body">
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}} className="three-col">
                  <div style={{background:'var(--off)',borderRadius:12,padding:14,border:'1px solid var(--border)',textAlign:'center'}}>
                    <div style={{fontSize:9,color:'var(--gray)',textTransform:'uppercase',letterSpacing:'.6px',fontWeight:600,marginBottom:5}}>Purchased for</div>
                    <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'var(--navy)'}}>$342,794</div>
                    <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>April 2004 · 22 yrs ago</div>
                  </div>
                  <div style={{background:'var(--off)',borderRadius:12,padding:14,border:'1px solid var(--border)',textAlign:'center'}}>
                    <div style={{fontSize:9,color:'var(--gray)',textTransform:'uppercase',letterSpacing:'.6px',fontWeight:600,marginBottom:5}}>Market estimate</div>
                    <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'var(--navy)'}}>$1,353,000–$1,443,000</div>
                    <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>at $451–$481/sqft</div>
                  </div>
                  <div style={{background:'var(--gold-bg)',borderRadius:12,padding:14,border:'1px solid var(--gold-border)',textAlign:'center'}}>
                    <div style={{fontSize:9,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.6px',fontWeight:600,marginBottom:5}}>Equity gained</div>
                    <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'var(--gold)'}}>$1,096,206+</div>
                    <div style={{fontSize:10,color:'var(--gold)',fontWeight:600,marginTop:3}}>4.2x · 100% tax-free</div>
                  </div>
                </div>
                <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#1D4ED8',marginBottom:12,display:'flex',alignItems:'center',gap:7}}>
                  <div className="dot" style={{color:'#3B82F6'}}/>
                  {loadingNarrative ? 'Reviewing recent sales on your street...' : 'Market analysis ready'}
                </div>
                <p style={{fontSize:13,color:'var(--gray)',lineHeight:1.75}}>
                  {narrative || 'Your home is in one of Willoughby\'s most established neighbourhoods, built in 2004. Three comparable detached homes sold between September and October 2025 at an average of $468 per square foot — with two of three selling above their BC Assessment by an average of $111,500. Your assessment is not your ceiling. For most homes in this area it has been the floor.'}
                </p>
              </div>
            </div>

            {/* Comp table */}
            <div className="card">
              <div className="card-header"><h3>Comparable sales — Sept–Oct 2025</h3><span style={{fontSize:11,color:'var(--gray)'}}>MLS sold data</span></div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'var(--off)'}}>
                    {['Street','Sold','BCA Assessed','Actual Sold','vs BCA','Days'].map(h=><th key={h} style={{textAlign:'left',padding:'9px 12px',fontSize:10,fontWeight:600,color:'var(--gray)',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'1px solid var(--border)'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    <tr><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)',fontWeight:500}}>69A Ave, Willoughby</td><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)'}}>Sep 2025</td><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)'}}>$1,543,000</td><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)',fontWeight:600}}>$1,650,000</td><td className="above" style={{padding:'11px 12px',borderBottom:'1px solid var(--border)'}}>+$107,000</td><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)'}}>19</td></tr>
                    <tr><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)',fontWeight:500}}>69 Ave, Willoughby</td><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)'}}>Sep 2025</td><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)'}}>$1,486,000</td><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)',fontWeight:600}}>$1,480,000</td><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--gray)'}}>at assessed</td><td style={{padding:'11px 12px',borderBottom:'1px solid var(--border)',color:'var(--navy)'}}>28</td></tr>
                    <tr><td style={{padding:'11px 12px',color:'var(--navy)',fontWeight:500}}>70A Ave, Willoughby</td><td style={{padding:'11px 12px',color:'var(--navy)'}}>Oct 2025</td><td style={{padding:'11px 12px',color:'var(--navy)'}}>$1,239,000</td><td style={{padding:'11px 12px',color:'var(--navy)',fontWeight:600}}>$1,355,000</td><td className="above" style={{padding:'11px 12px'}}>+$116,000</td><td style={{padding:'11px 12px',color:'var(--navy)'}}>38</td></tr>
                  </tbody>
                </table>
              </div>
              <div style={{padding:'12px 16px',background:'var(--gold-bg)',borderTop:'1px solid var(--gold-border)',fontSize:12,color:'var(--gold)',fontWeight:500}}>
                2 of 3 homes sold <strong>above</strong> BCA by avg $111,500 · $451–$481/sqft · Avg 28 days on market
              </div>
            </div>

            {/* Reno calculator */}
            <div className="card">
              <div className="card-header"><h3>Renovation value calculator</h3><span style={{fontSize:11,background:'#FEF3C7',color:'#92400E',padding:'2px 8px',borderRadius:16,fontWeight:600}}>Refine your estimate</span></div>
              <div className="card-body">
                <p style={{fontSize:13,color:'var(--gray)',lineHeight:1.7,marginBottom:14}}>Have you renovated? Select what applies and we&apos;ll adjust your estimated range.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}} className="two-col">
                  {RENOS.map((r,i)=>(
                    <label key={i} className={`reno-check${renoChecked[i]?' sel':''}`} onClick={()=>toggleReno(i)}>
                      <input type="checkbox" checked={renoChecked[i]} onChange={()=>toggleReno(i)} style={{accentColor:'var(--teal)',flexShrink:0,marginTop:2}}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--navy)',marginBottom:1}}>{r.label}</div>
                        <div style={{fontSize:11,color:'var(--green)',fontWeight:500}}>+{fmt(r.low)}–{fmt(r.high)}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {renoCount > 0 && (
                  <div style={{background:'var(--gold-bg)',border:'1px solid var(--gold-border)',borderRadius:10,padding:'14px 16px'}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--gold)',marginBottom:4}}>Updated estimate based on your renovations</div>
                    <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'var(--navy)'}}>{fmt(renoLow)} – {fmt(renoHigh)}</div>
                    <div style={{fontSize:11,color:'var(--gray)',marginTop:4}}>Renovation premium: <span style={{color:'var(--green)',fontWeight:600}}>+{fmt(renoTotLow)} – +{fmt(renoTotHigh)}</span></div>
                    <div style={{fontSize:11,color:'var(--gray)',marginTop:8,fontStyle:'italic'}}>Estimated market adjustments — not a formal appraisal.</div>
                  </div>
                )}
              </div>
            </div>

            {/* Move costs */}
            <div className="card">
              <div className="card-header"><h3>The real cost of moving</h3><span style={{fontSize:11,background:'var(--off)',color:'var(--gray)',padding:'2px 8px',borderRadius:16,fontWeight:600}}>Transparency</span></div>
              <div className="card-body">
                {[['Legal / notary fees','$1,800 – $2,500'],['Moving costs (local)','$2,000 – $4,000'],['Home preparation / staging','$1,500 – $3,000'],['Bridge financing (if needed)','~$2,000 – $4,000']].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                    <span style={{color:'var(--gray)'}}>{l}</span><span style={{fontWeight:600,color:'var(--navy)'}}>{v}</span>
                  </div>
                ))}
                <div style={{background:'var(--gold-bg)',borderRadius:8,padding:'12px 14px',marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div><div style={{fontSize:13,fontWeight:600,color:'var(--gold)'}}>As % of your estimated net proceeds</div><div style={{fontSize:11,color:'var(--gray)'}}>On an estimated net of ~$1.1M</div></div>
                  <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'var(--gold)'}}>less than 1.3%</div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="card">
              <div className="card-header"><h3>What happens if you decide to list</h3></div>
              <div className="card-body">
                {[['Week 1','Prepare the home','Photos, staging consultation, pricing strategy finalized.'],['Week 2','Live on MLS','Open house weekend. Active buyer agents notified. Showings begin.'],['Week 3–4','Offers and negotiation','Review offers, negotiate terms, accept. Subject removal follows.'],['Day 30–60','Completion','Keys change hands. Proceeds arrive in your account. Done.']].map(([w,t,d])=>(
                  <div key={w} style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:12,alignItems:'start',marginBottom:4}}>
                    <div style={{textAlign:'right',paddingTop:3,fontSize:11,fontWeight:600,color:'var(--teal)'}}>{w}</div>
                    <div className="tl-right">
                      <div style={{fontSize:13,fontWeight:600,color:'var(--navy)',marginBottom:2}}>{t}</div>
                      <div style={{fontSize:12,color:'var(--gray)',lineHeight:1.5}}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Sidebar */}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:'var(--green-bg)',border:'1px solid #86EFAC',borderRadius:13,padding:16}}>
              <div style={{display:'flex',alignItems:'center',gap:7,fontWeight:600,color:'var(--green)',marginBottom:7,fontSize:13}}>
                <div className="dot" style={{color:'var(--green)'}}/>Active buyer demand
              </div>
              <div style={{fontSize:12,color:'#166534',lineHeight:1.6}}>There is currently strong buyer demand in Willoughby for detached homes in the $1.3M–$1.6M range. I work with buyers actively looking in this area.</div>
            </div>

            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:13,padding:16}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--navy)',marginBottom:10}}>Who is buying in Willoughby right now</div>
              {['Families relocating from Metro Vancouver — pre-approved $1.3M–$1.6M','Looking for move-in ready — not planning renovations','Prioritize school catchment, suite income, and garage','Typically need 30–45 day completion timeline'].map(t=>(
                <div key={t} style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:8,fontSize:12,color:'var(--gray)',lineHeight:1.5}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'var(--teal)',flexShrink:0,marginTop:4}}/>
                  <span>{t}</span>
                </div>
              ))}
            </div>

            <div style={{background:'var(--navy)',border:'1px solid rgba(240,192,64,.2)',borderRadius:13,padding:16}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--gold2)',marginBottom:7}}>Right now supply is very limited</div>
              <div style={{fontSize:12,color:'var(--lgray)',lineHeight:1.6}}>There are very few comparable detached homes available in Willoughby at this moment. The homeowners who list first in a low-supply market consistently capture the strongest offers.</div>
            </div>

            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:13,padding:18}}>
              <div style={{fontSize:15,fontWeight:700,color:'var(--navy)',marginBottom:5}}>Get the full report as a PDF</div>
              <div style={{fontSize:12,color:'var(--gray)',marginBottom:14,lineHeight:1.5}}>Includes your renovation-adjusted estimate, net-in-pocket number, full comp breakdown, and move cost calculator.</div>
              <div style={{display:'flex',flexDirection:'column',gap:9}}>
                <input className="inp" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
                <button className="btn btn-teal" onClick={submitG3} disabled={loadingEmail} style={{fontSize:14}}>
                  {loadingEmail ? 'Sending...' : 'Email me the full report →'}
                </button>
                <p style={{fontSize:11,color:'var(--gray)',textAlign:'center'}}>Kamran Khan will follow up personally within 24 hours</p>
              </div>
            </div>
          </div>
        </div>

        <footer style={{background:'var(--navy2)',borderTop:'1px solid rgba(255,255,255,.06)',padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,fontSize:11,color:'var(--gray)'}}>
          <span>Kamran Khan · REALTOR® · Royal Lepage Global Force Realty · +1-236-660-2594</span>
          <span><a href="#" onClick={e=>{e.preventDefault();setGate('privacy')}} style={{color:'var(--gray)',textDecoration:'none'}}>Privacy Policy</a> &nbsp;·&nbsp; Based on MLS data Sept–Oct 2025 · Estimates only</span>
        </footer>
      </main>

      {/* ═══ GATE 4 ═══ */}
      <main style={{display: gate==='gate4'?'flex':'none', flexDirection:'column', minHeight:'100vh', background:'var(--navy)', alignItems:'center', justifyContent:'center', padding:'72px 20px'}}>
        <div style={{background:'#fff',borderRadius:18,padding:'44px 38px',maxWidth:540,width:'100%',textAlign:'center'}}>
          <div style={{width:60,height:60,background:'var(--green-bg)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:'var(--navy)',marginBottom:10}}>Your report is on its way</h1>
          <p style={{fontSize:14,color:'var(--gray)',lineHeight:1.65,marginBottom:24}}>Check your inbox. <strong>Kamran Khan</strong> will also follow up personally within 24 hours with your complete net-in-pocket number.</p>
          <div style={{background:'var(--gold-bg)',border:'1px solid var(--gold-border)',borderRadius:12,padding:18,marginBottom:24,textAlign:'left'}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--navy)',marginBottom:6}}>Request your neighbourhood position report</div>
            <div style={{fontSize:12,color:'var(--gray)',lineHeight:1.6}}>I prepare these personally for a limited number of Willoughby homeowners each month. No obligation. No pitch. Just your complete picture.</div>
          </div>
          <p style={{fontSize:14,fontWeight:600,color:'var(--navy)',marginBottom:14}}>Book a free 15-minute call</p>
          <div style={{height:360,background:'var(--off)',borderRadius:12,border:'1px solid var(--border)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,color:'var(--gray)',fontSize:13}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>Calendly booking goes here</span>
            <span style={{fontSize:11}}>Add your Calendly embed code</span>
          </div>
        </div>
      </main>

      {/* ═══ PRIVACY ═══ */}
      <main style={{display: gate==='privacy'?'flex':'none', flexDirection:'column', minHeight:'100vh', background:'var(--off)'}}>
        <nav className="topnav" style={{background:'var(--navy)'}}><div className="logo" onClick={()=>setGate('gate1')}>EquityReady</div><a href="#" onClick={e=>{e.preventDefault();setGate('gate1')}} style={{fontSize:12,color:'var(--lgray)',textDecoration:'none'}}>← Back</a></nav>
        <div style={{flex:1,maxWidth:700,margin:'0 auto',padding:'48px 24px',width:'100%'}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:28,color:'var(--navy)',marginBottom:8}}>Privacy Policy</h1>
          <p style={{fontSize:12,color:'var(--gray)',marginBottom:20}}>Last updated: March 2026</p>
          {[
            ['What we collect','When you use EquityReady, we collect the information you voluntarily provide: your property address, name, phone number, and email address. We also log which addresses are looked up on the platform, including anonymous lookups.'],
            ['How we use it','Your information is used solely to prepare and deliver your personalized equity report and to follow up with you personally. We do not use your information for automated marketing, third-party advertising, or any purpose other than your direct real estate inquiry.'],
            ['Who sees it','Your information is accessible only to Kamran Khan, REALTOR® at Royal Lepage Global Force Realty. It is never sold, shared, or disclosed to any third party.'],
            ['Your rights','Under PIPEDA you have the right to access, correct, or request deletion of your personal information at any time. Contact us at Realtormkamran@gmail.com.'],
            ['Contact','Kamran Khan · REALTOR® · Royal Lepage Global Force Realty · +1-236-660-2594 · Realtormkamran@gmail.com'],
          ].map(([h,p])=>(
            <div key={h}>
              <h2 style={{fontSize:16,fontWeight:600,color:'var(--navy)',margin:'20px 0 8px'}}>{h}</h2>
              <p style={{fontSize:14,color:'var(--gray)',lineHeight:1.75,marginBottom:14}}>{p}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
