'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface BcaData {
  address: string
  purchasePrice: number
  purchaseDate: string
  assessedTotal: number
  equityGain: number
  equityMultiple: number
  bedrooms: string
  stories: string
  yearsOwned: number
  estimateLow: number
  estimateHigh: number
  floorArea: string
}

interface Lead {
  address: string
  name: string
  phone: string
  email: string
}

declare global {
  interface Window {
    google: any
    initGoogleMaps: () => void
  }
}

const MARKET = {
  avgPsf: 468, lowPsf: 451, highPsf: 481,
  avgDOM: 28, fastestDOM: 19, avgAboveBCA: 111500,
}

const COMPS = [
  { street: '69A Ave, Willoughby', sold: 'Sep 2025', bca: '$1,543,000', actual: '$1,650,000', vsBca: '+$107,000', days: 19, positive: true },
  { street: '69 Ave, Willoughby',  sold: 'Sep 2025', bca: '$1,486,000', actual: '$1,480,000', vsBca: 'at assessed', days: 28, positive: false },
  { street: '70A Ave, Willoughby', sold: 'Oct 2025', bca: '$1,239,000', actual: '$1,355,000', vsBca: '+$116,000', days: 38, positive: true },
]

const RENOS = [
  { id: 'kitchen_full',    label: 'Kitchen — full renovation',  sub: '+$25,000–$45,000', low: 25000, high: 45000 },
  { id: 'kitchen_partial', label: 'Kitchen — partial update',   sub: '+$10,000–$20,000', low: 10000, high: 20000 },
  { id: 'bath_primary',    label: 'Primary bathroom — full',    sub: '+$15,000–$25,000', low: 15000, high: 25000 },
  { id: 'bath_secondary',  label: 'Secondary bathroom',         sub: '+$8,000–$15,000',  low: 8000,  high: 15000 },
  { id: 'flooring',        label: 'Flooring throughout',        sub: '+$12,000–$22,000', low: 12000, high: 22000 },
  { id: 'suite',           label: 'Basement suite added',       sub: '+$40,000–$65,000', low: 40000, high: 65000 },
  { id: 'deck',            label: 'Deck / outdoor space',       sub: '+$8,000–$18,000',  low: 8000,  high: 18000 },
  { id: 'roof',            label: 'New roof',                   sub: '+$5,000–$10,000',  low: 5000,  high: 10000 },
]

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 11
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  if (digits.length <= 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  return `+${digits.slice(0,1)} (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
}

const fmt = (n: number) => '$' + n.toLocaleString()

export default function Home() {
  const [gate, setGate] = useState<1|2|3|4>(1)
  const [address, setAddress] = useState('')
  const [lead, setLead] = useState<Lead>({ address: '', name: '', phone: '', email: '' })
  const [bcaData, setBcaData] = useState<BcaData | null>(null)
  const [narrative, setNarrative] = useState('')
  const [checkedRenos, setCheckedRenos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{role:string,text:string}[]>([
    { role: 'assistant', text: "Hi! I can answer any questions about your home's value in Willoughby. What's on your mind?" }
  ])
  const [chatInput, setChatInput] = useState('')
  const [outOfArea, setOutOfArea] = useState(false)
  const [outOfAreaMsg, setOutOfAreaMsg] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualSubmitted, setManualSubmitted] = useState(false)

  const addressInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const googleMapsLoaded = useRef(false)

  useEffect(() => {
    if (googleMapsLoaded.current) return
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    if (!apiKey) return
    window.initGoogleMaps = () => {
      googleMapsLoaded.current = true
      initAutocomplete()
    }
    // Only add script if not already present
    if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`
      script.async = true; script.defer = true
      document.head.appendChild(script)
    } else if (window.google) {
      googleMapsLoaded.current = true
      initAutocomplete()
    }
  }, [])

  const initAutocomplete = useCallback(() => {
    if (!addressInputRef.current || !window.google) return
    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      componentRestrictions: { country: 'ca' },
      fields: ['formatted_address', 'address_components', 'geometry'],
      types: ['address'],
      bounds: new window.google.maps.LatLngBounds({ lat: 49.05, lng: -122.75 }, { lat: 49.25, lng: -122.50 }),
      strictBounds: false,
    })
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (place.formatted_address) setAddress(place.formatted_address)
    })
    autocompleteRef.current = ac
  }, [])

  useEffect(() => {
    if (gate === 1 && window.google && addressInputRef.current && !autocompleteRef.current) initAutocomplete()
  }, [gate, initAutocomplete])

  async function handleAddressSubmit() {
    if (!address.trim()) return
    setLoading(true)
    // Always reset state on new search
    setBcaData(null)
    setOutOfArea(false)
    setOutOfAreaMsg('')
    setNarrative('')
    setCheckedRenos([])
    setEmailSent(false)
    setManualSubmitted(false)
    setManualEmail('')
    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const data = await res.json()
      if (data.outOfArea || data.notFound) {
        setOutOfArea(true)
        setOutOfAreaMsg(data.message || "We don't have automated data for this address yet. Kamran will prepare your report personally within 24 hours.")
      } else if (data.bcaData) {
        setBcaData(data.bcaData)
      }
      setLead(prev => ({ ...prev, address }))
    } catch {}
    setLoading(false)
    setGate(2)
  }

  async function handleManualCapture() {
    if (!manualEmail.includes('@')) return
    try {
      await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, manualEmail }),
      })
    } catch {}
    setManualSubmitted(true)
  }

  async function handleUnlock() {
    if (!lead.name.trim() || lead.name.trim().length < 2) return
    if (!isValidPhone(lead.phone)) { setPhoneError('Please enter a valid phone number (e.g. 604-555-0123)'); return }
    setPhoneError('')
    setLoading(true)
    try {
      const res = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: lead.address, name: lead.name, phone: lead.phone }) })
      const data = await res.json()
      if (data.narrative) setNarrative(data.narrative)
      if (data.bcaData) setBcaData(data.bcaData)
    } catch {}
    setLoading(false)
    setGate(3)
  }

  async function handleEmailReport() {
    if (!lead.email || !lead.email.includes('@')) return
    setEmailLoading(true)
    try {
      await fetch('/api/email-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: lead.address, name: lead.name, phone: lead.phone, email: lead.email, bcaData, narrative, checkedRenos }) })
      setEmailSent(true)
    } catch {}
    setEmailLoading(false)
    setTimeout(() => setGate(4), 1500)
  }

  const renoAddLow  = checkedRenos.reduce((s, id) => s + (RENOS.find(r => r.id === id)?.low  ?? 0), 0)
  const renoAddHigh = checkedRenos.reduce((s, id) => s + (RENOS.find(r => r.id === id)?.high ?? 0), 0)
  const adjLow  = (bcaData?.estimateLow  ?? 1650000) + renoAddLow
  const adjHigh = (bcaData?.estimateHigh ?? 1786000) + renoAddHigh

  async function handleChat() {
    if (!chatInput.trim()) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }])
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg, address: lead.address }) })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', text: data.reply || 'Let me connect you with Kamran directly. Call +1-236-660-2594.' }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Reach Kamran at +1-236-660-2594 or Realtormkamran@gmail.com.' }])
    }
  }

  const propertySubtitle = (() => {
    if (!bcaData) return 'Willoughby · 2004 build'
    const year = new Date(bcaData.purchaseDate).getFullYear()
    const parts = [`Willoughby · ${year} build`]
    if (bcaData.floorArea && bcaData.floorArea !== '-' && bcaData.floorArea !== 'nan') parts.push(`${Number(bcaData.floorArea).toLocaleString()} sq ft`)
    if (bcaData.bedrooms && bcaData.bedrooms !== '-') parts.push(`${bcaData.bedrooms} bed`)
    if (bcaData.stories && bcaData.stories !== '-') parts.push(`${bcaData.stories} storey`)
    return parts.join(' · ')
  })()

  const DISCLAIMER = `Market estimates are based on 3 verified MLS transactions in Willoughby, Sept–Oct 2025 and BC Assessment data. All figures are estimates only — verify with current MLS data before any transaction. Kamran Khan is a licensed REALTOR® with Royal Lepage Global Force Realty. This is not a formal appraisal.`

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: '#F4F6FB', minHeight: '100vh', color: '#0F2B5B' }}>
      <style>{`
        @media (max-width: 768px) {
          .gate3-grid { grid-template-columns: 1fr !important; }
          .stat-cards { grid-template-columns: 1fr !important; }
          .report-header-meta { flex-direction: column !important; gap: 4px !important; }
          .three-cols { grid-template-columns: 1fr !important; }
          .sidebar-sticky { position: relative !important; top: 0 !important; }
          .hero-search { flex-direction: column !important; }
          .hero-search input { min-width: unset !important; width: 100% !important; }
          .hero-search button { width: 100% !important; }
          .comp-table td, .comp-table th { padding: 8px 6px !important; font-size: 12px !important; }
          .reno-grid { grid-template-columns: 1fr !important; }
          .gate2-cards { grid-template-columns: 1fr !important; }
        }
        * { box-sizing: border-box; }
        a { cursor: pointer; }
      `}</style>

      {/* NAV */}
      <nav style={{ background: '#0A1628', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, position: 'sticky', top: 0, zIndex: 100 }}>
        <span onClick={() => { setGate(1); setAddress(''); setBcaData(null); setNarrative(''); setCheckedRenos([]); setEmailSent(false); }} style={{ color: '#C8952A', fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px', cursor: 'pointer' }}>
          EquityReady
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#64748B', fontSize: 13 }}>Kamran Khan · Royal Lepage</span>
          <a href="tel:+12366602594" style={{ color: '#C8952A', fontSize: 13, fontWeight: 600, textDecoration: 'none', background: '#1E3A5F', padding: '8px 14px', borderRadius: 8 }}>
            +1-236-660-2594
          </a>
        </div>
      </nav>

      {/* ── GATE 1 ── */}
      {gate === 1 && (
        <div>
          {/* Hero */}
          <div style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D1F3C 60%, #0A2040 100%)', padding: '80px 24px 100px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            {/* Background accent */}
            <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(200,149,42,0.04)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(13,148,136,0.04)', pointerEvents: 'none' }} />

            <p style={{ color: '#C8952A', fontWeight: 700, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>
              Willoughby, Langley BC
            </p>
            <h1 style={{ color: '#fff', fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800, lineHeight: 1.15, maxWidth: 700, margin: '0 auto 16px' }}>
              Before you call a realtor,<br />
              <span style={{ color: '#C8952A' }}>know your number.</span>
            </h1>
            <p style={{ color: '#94A3B8', fontSize: 18, maxWidth: 520, margin: '0 auto 12px', lineHeight: 1.6 }}>
              You bought in Willoughby when others weren't sure.
            </p>
            <p style={{ color: '#64748B', fontSize: 15, maxWidth: 480, margin: '0 auto 48px' }}>
              Now it's time to find out what that decision is actually worth.
            </p>

            {/* Address search */}
            <div className="hero-search" style={{ maxWidth: 580, margin: '0 auto', display: 'flex', gap: 10 }}>
              <input
                ref={addressInputRef}
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddressSubmit()}
                placeholder="Start typing your Willoughby address..."
                style={{ flex: 1, minWidth: 260, padding: '18px 22px', fontSize: 16, border: '2px solid #1E3A5F', borderRadius: 12, background: '#0D1F3C', color: '#fff', outline: 'none' }}
              />
              <button
                onClick={handleAddressSubmit}
                disabled={loading || !address.trim()}
                style={{ padding: '18px 32px', background: loading ? '#555' : '#0D9488', color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(13,148,136,0.3)' }}
              >
                {loading ? 'Checking...' : 'See my estimate →'}
              </button>
            </div>
            <p style={{ color: '#4A6080', fontSize: 13, marginTop: 14 }}>No sign-up required · Takes 30 seconds</p>

            {/* Trust badge */}
            <div style={{ marginTop: 40, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 100, padding: '10px 20px' }}>
              <span style={{ color: '#16A34A', fontSize: 16 }}>●</span>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>Off-market buyer connections available — ask about a private sale option</span>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { val: '$468', label: 'avg $/sqft sold', accent: '#0D9488', note: 'Willoughby detached' },
                { val: '28 days', label: 'avg days on market', accent: '#C8952A', note: 'Sept–Oct 2025' },
                { val: '+$111,500', label: 'avg above BCA assessed', accent: '#166534', note: '2 of 3 recent sales' },
              ].map((s, i) => (
                <div key={i} style={{ flex: '1 1 200px', padding: '28px 24px', textAlign: 'center', borderRight: i < 2 ? '1px solid #E2E8F0' : 'none' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: s.accent }}>{s.val}</div>
                  <div style={{ fontSize: 13, color: '#0F2B5B', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.note}</div>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11, padding: '6px 0 14px' }}>
              Based on 3 verified MLS transactions in Willoughby, Sept–Oct 2025
            </p>
          </div>

          {/* Off-market section — THE NEW EMOTIONAL HOOK */}
          <div style={{ background: '#0A1628', padding: '60px 24px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 32, alignItems: 'center' }}>
              <div>
                <p style={{ color: '#C8952A', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Just curious? No problem.</p>
                <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 800, lineHeight: 1.3, marginBottom: 16 }}>
                  Not ready to list publicly?<br />There's another way.
                </h2>
                <p style={{ color: '#94A3B8', fontSize: 15, lineHeight: 1.8, marginBottom: 24 }}>
                  Many Willoughby owners sell privately before their home ever hits MLS. If the right buyer exists at the right price — why go through the full process?
                </p>
                <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.7 }}>
                  I work with registered buyers actively looking for homes exactly like yours. A quick conversation costs nothing and might surprise you.
                </p>
              </div>
              <div style={{ background: '#0D1F3C', borderRadius: 16, padding: '32px', border: '1px solid #1E3A5F' }}>
                <p style={{ color: '#C8952A', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>What a private sale means for you:</p>
                {[
                  { icon: '🔒', text: 'No public listing — neighbours never need to know' },
                  { icon: '⚡', text: 'No open houses, no disruption to your life' },
                  { icon: '💰', text: 'Same market value — qualified buyers pay full price' },
                  { icon: '🤝', text: 'Move on your timeline, not the market\'s' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                    <p style={{ color: '#CBD5E1', fontSize: 14, lineHeight: 1.5, margin: 0 }}>{item.text}</p>
                  </div>
                ))}
                <a href="tel:+12366602594" style={{ display: 'block', marginTop: 20, padding: '14px', background: '#C8952A', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 10, textDecoration: 'none', textAlign: 'center' }}>
                  Ask about off-market options
                </a>
              </div>
            </div>
          </div>

          {/* What you get */}
          <div style={{ maxWidth: 900, margin: '70px auto', padding: '0 24px' }}>
            <p style={{ textAlign: 'center', color: '#C8952A', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Free · No obligation · 30 seconds</p>
            <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 48, color: '#0A1628' }}>What you get when you enter your address</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              {[
                { icon: '📊', title: 'Your real market range', body: 'Based on actual $/sqft from recent Willoughby MLS sales — not just your assessment.' },
                { icon: '💰', title: 'Your equity position', body: 'What you paid, what it\'s worth today, and your tax-free gain — your real number.' },
                { icon: '🏡', title: 'Renovation value', body: 'Tick what you\'ve upgraded and see how buyers actually price those improvements.' },
                { icon: '📋', title: 'Net-in-pocket estimate', body: 'What actually lands in your bank after all costs — most owners are surprised.' },
              ].map((c, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '28px 22px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 32, marginBottom: 14 }}>{c.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: '#0A1628' }}>{c.title}</div>
                  <div style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6 }}>{c.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Kamran section */}
          <div style={{ background: '#fff', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '60px 24px' }}>
            <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '3px solid #C8952A' }}>
                <span style={{ color: '#C8952A', fontSize: 32, fontWeight: 800 }}>KK</span>
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <p style={{ color: '#C8952A', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Your Willoughby specialist</p>
                <p style={{ color: '#0A1628', fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Kamran Khan</p>
                <p style={{ color: '#64748B', fontSize: 14, marginBottom: 4 }}>REALTOR® · Royal Lepage Global Force Realty</p>
                <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16 }}>Specializing in Willoughby original homeowners</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <a href="tel:+12366602594" style={{ padding: '10px 20px', background: '#0A1628', color: '#fff', fontWeight: 600, fontSize: 14, borderRadius: 8, textDecoration: 'none' }}>+1-236-660-2594</a>
                  <a href="mailto:Realtormkamran@gmail.com" style={{ padding: '10px 20px', background: '#F4F6FB', color: '#0A1628', fontWeight: 600, fontSize: 14, borderRadius: 8, textDecoration: 'none', border: '1px solid #E2E8F0' }}>Send email</a>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer style={{ background: '#0A1628', color: '#64748B', padding: '40px 24px', fontSize: 13 }}>
            <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
              <p style={{ color: '#C8952A', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>EquityReady</p>
              <p style={{ color: '#94A3B8', marginBottom: 4 }}>Kamran Khan · REALTOR® · Royal Lepage Global Force Realty</p>
              <p style={{ marginBottom: 20 }}>+1-236-660-2594 · Realtormkamran@gmail.com</p>
              <p style={{ color: '#4A6080', fontSize: 11, lineHeight: 1.7, maxWidth: 600, margin: '0 auto 16px' }}>
                {`Market estimates are based on verified MLS transactions in Willoughby and BC Assessment data. All figures are estimates only — verify with current MLS data before any transaction. Kamran Khan is a licensed REALTOR® with Royal Lepage Global Force Realty. This is not a formal appraisal. By using this site you agree to our privacy policy.`}
              </p>
              <a href="/privacy" style={{ color: '#4A6080', textDecoration: 'underline', fontSize: 12 }}>Privacy Policy</a>
            </div>
          </footer>
        </div>
      )}

      {/* ── GATE 2 ── */}
      {gate === 2 && (
        <div style={{ maxWidth: 600, margin: '48px auto', padding: '0 16px' }}>
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
            <div style={{ background: 'linear-gradient(135deg, #0A1628, #0D1F3C)', padding: '28px 32px' }}>
              <p style={{ color: '#C8952A', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Property detected</p>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, lineHeight: 1.3 }}>{lead.address || address}</p>
              <p style={{ color: '#64748B', fontSize: 13, marginTop: 6 }}>Willoughby · Original build</p>
            </div>
            <div style={{ padding: '28px 32px' }}>
              {outOfArea ? (
                // OUT OF AREA — capture form
                <div>
                  <div style={{ background: '#FEF9EC', border: '1px solid #C8952A', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
                    <p style={{ color: '#92600A', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>📍 Outside our automated coverage</p>
                    <p style={{ color: '#334155', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{outOfAreaMsg}</p>
                  </div>
                  {!manualSubmitted ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <p style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
                        Leave your email and Kamran will prepare your personalized market analysis within 24 hours — real local expertise, not an automated tool.
                      </p>
                      <input value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="your@email.com" type="email" style={{ padding: '15px 18px', border: '1.5px solid #CBD5E1', borderRadius: 10, fontSize: 16, outline: 'none' }} />
                      <button onClick={handleManualCapture} disabled={!manualEmail.includes('@')} style={{ padding: '16px', background: '#0D9488', color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 12, cursor: manualEmail.includes('@') ? 'pointer' : 'not-allowed', opacity: manualEmail.includes('@') ? 1 : 0.6 }}>
                        Send me a personal report →
                      </button>
                      <div style={{ textAlign: 'center', marginTop: 8 }}>
                        <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>Or call Kamran directly:</p>
                        <a href="tel:+12366602594" style={{ color: '#C8952A', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>+1-236-660-2594</a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#F0FDF4', border: '1px solid #166534', borderRadius: 10, padding: '28px', textAlign: 'center' }}>
                      <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
                      <p style={{ color: '#166534', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Got it — Kamran will be in touch within 24 hours</p>
                      <p style={{ color: '#64748B', fontSize: 14 }}>Check your inbox for your personalized market analysis.</p>
                    </div>
                  )}
                </div>
              ) : (
                // NORMAL — blurred cards + form
                <div>
                <div className="gate2-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
                  <div style={{ color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>BCA Assessed</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#0F2B5B' }}>{bcaData ? fmt(bcaData.assessedTotal) : '$1,701,000'}</div>
                  <div style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>Official</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 12px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Market Value</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#0F2B5B', filter: 'blur(7px)', userSelect: 'none' }}>{bcaData ? fmt(bcaData.estimateLow) : '$1,650,000'}</div>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 22 }}>🔒</span></div>
                </div>
                <div style={{ background: '#FEF9EC', border: '1px solid #C8952A', borderRadius: 12, padding: '16px 12px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ color: '#92600A', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Tax-Free Gain</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#C8952A', filter: 'blur(7px)', userSelect: 'none' }}>{bcaData ? fmt(bcaData.equityGain) : '$1,346,058'}</div>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 22 }}>🔒</span></div>
                </div>
                </div>
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 16px', marginBottom: 24, borderLeft: '3px solid #C8952A' }}>
                  <p style={{ color: '#334155', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                    Most original Willoughby owners are surprised — not by the number itself, but by what it means for the next chapter of their life.
                  </p>
                </div>
                <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, marginBottom: 20 }}>Enter your name and phone to unlock your full estimate</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input value={lead.name} onChange={e => setLead(p => ({ ...p, name: e.target.value }))} placeholder="Your first name" style={{ padding: '15px 18px', border: '1.5px solid #CBD5E1', borderRadius: 10, fontSize: 16, outline: 'none' }} />
                  <div>
                    <input value={lead.phone} onChange={e => { setLead(p => ({ ...p, phone: formatPhone(e.target.value) })); if (phoneError) setPhoneError('') }} placeholder="Phone number (e.g. 604-555-0123)" type="tel" style={{ width: '100%', padding: '15px 18px', border: `1.5px solid ${phoneError ? '#EF4444' : '#CBD5E1'}`, borderRadius: 10, fontSize: 16, outline: 'none' }} />
                    {phoneError && <p style={{ color: '#EF4444', fontSize: 13, marginTop: 6 }}>{phoneError}</p>}
                  </div>
                  <button onClick={handleUnlock} disabled={loading || !lead.name.trim() || lead.name.trim().length < 2} style={{ padding: '17px', background: loading ? '#94A3B8' : '#0D9488', color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 16px rgba(13,148,136,0.3)' }}>
                    {loading ? 'Preparing your report...' : 'Unlock my estimate →'}
                  </button>
                  <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>No spam. No pressure. Used only to prepare your personalized report.</p>
                </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── GATE 3 ── */}
      {gate === 3 && (
        <div className="gate3-grid" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Header */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="report-header-meta" style={{ background: 'linear-gradient(135deg, #0A1628, #0D1F3C)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ color: '#C8952A', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Equity report</p>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{lead.address}</p>
                </div>
                <span style={{ color: '#64748B', fontSize: 12 }}>{propertySubtitle}</span>
              </div>
              <div className="three-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {[
                  { label: 'Purchased for', val: bcaData ? fmt(bcaData.purchasePrice) : '$354,942', sub: bcaData ? `${new Date(bcaData.purchaseDate).toLocaleDateString('en-CA',{month:'long',year:'numeric'})} · ${Math.round(bcaData.yearsOwned)} yrs ago` : 'January 2004 · 22 yrs ago', gold: false },
                  { label: 'Market estimate', val: bcaData ? `${fmt(bcaData.estimateLow)}–` : '$1,650,000–', sub: bcaData ? fmt(bcaData.estimateHigh) : '$1,786,000', gold: false, sub2: 'at $451–$481/sqft' },
                  { label: 'Equity gained', val: bcaData ? `${fmt(bcaData.equityGain)}+` : '$1,346,058+', sub: bcaData ? `${bcaData.equityMultiple}x · 100% tax-free` : '4.8x · 100% tax-free', gold: true },
                ].map((c, i) => (
                  <div key={i} style={{ padding: '20px 22px', borderRight: i < 2 ? '1px solid #E2E8F0' : 'none', background: c.gold ? '#FEF9EC' : '#fff' }}>
                    <div style={{ color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{c.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: c.gold ? '#C8952A' : '#0F2B5B' }}>{c.val}</div>
                    <div style={{ color: c.gold ? '#92600A' : '#64748B', fontSize: 12, marginTop: 4 }}>{c.sub}</div>
                    {c.sub2 && <div style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>{c.sub2}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Narrative */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px 28px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#0A1628' }}>Market analysis</h3>
              {narrative
                ? <p style={{ color: '#334155', lineHeight: 1.9, fontSize: 15 }}>{narrative}</p>
                : <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 20, color: '#64748B', fontSize: 14 }}>Preparing your personalized analysis...</div>
              }
            </div>

            {/* Comps */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0A1628' }}>Comparable sales — Sept–Oct 2025</h3>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>MLS sold data</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="comp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 400 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                      {['Street', 'Sold', 'BCA', 'Sold Price', 'vs BCA', 'Days'].map(h => (
                        <th key={h} style={{ padding: '10px 10px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPS.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '13px 10px', fontWeight: 500 }}>{c.street}</td>
                        <td style={{ padding: '13px 10px', color: '#64748B' }}>{c.sold}</td>
                        <td style={{ padding: '13px 10px', color: '#64748B' }}>{c.bca}</td>
                        <td style={{ padding: '13px 10px', fontWeight: 600 }}>{c.actual}</td>
                        <td style={{ padding: '13px 10px', fontWeight: 700, color: c.positive ? '#166534' : '#64748B' }}>{c.vsBca}</td>
                        <td style={{ padding: '13px 10px', color: '#64748B' }}>{c.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 14, padding: '13px 16px', background: '#FEF9EC', borderRadius: 8, border: '1px solid #C8952A' }}>
                <p style={{ color: '#92600A', fontSize: 13, fontWeight: 600, margin: 0 }}>2 of 3 homes sold <strong>above BCA</strong> by avg $111,500 · $451–$481/sqft · Avg {MARKET.avgDOM} days on market</p>
              </div>
            </div>

            {/* Reno calculator */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0A1628' }}>Renovation value calculator</h3>
                {checkedRenos.length > 0 && <span style={{ background: '#0D9488', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>+{fmt(renoAddLow)}–{fmt(renoAddHigh)}</span>}
              </div>
              <p style={{ color: '#64748B', fontSize: 14, marginBottom: 20 }}>Have you renovated? Select what applies and we'll adjust your range.</p>
              <div className="reno-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {RENOS.map(r => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', border: `1.5px solid ${checkedRenos.includes(r.id) ? '#0D9488' : '#E2E8F0'}`, borderRadius: 10, cursor: 'pointer', background: checkedRenos.includes(r.id) ? '#F0FDFA' : '#FAFAFA' }}>
                    <input type="checkbox" checked={checkedRenos.includes(r.id)} onChange={e => setCheckedRenos(prev => e.target.checked ? [...prev, r.id] : prev.filter(x => x !== r.id))} style={{ marginTop: 2, accentColor: '#0D9488', width: 16, height: 16, flexShrink: 0 }} />
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</div><div style={{ color: '#0D9488', fontSize: 13, marginTop: 2 }}>{r.sub}</div></div>
                  </label>
                ))}
              </div>
              {checkedRenos.length > 0 && (
                <div style={{ marginTop: 18, padding: '16px 20px', background: '#F0FDFA', borderRadius: 10, border: '1px solid #0D9488' }}>
                  <p style={{ color: '#0A1628', fontWeight: 700, fontSize: 15, margin: 0 }}>Adjusted estimate: {fmt(adjLow)} – {fmt(adjHigh)}</p>
                  <p style={{ color: '#64748B', fontSize: 13, marginTop: 4, margin: '4px 0 0' }}>Buyer premium: +{fmt(renoAddLow)}–{fmt(renoAddHigh)}</p>
                </div>
              )}
            </div>

            {/* Move costs */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px 28px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#0A1628' }}>The real cost of moving</h3>
              <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16, lineHeight: 1.7 }}>Most original owners assume moving is expensive. Here's the realistic math on a {bcaData ? fmt(Math.round((adjLow + adjHigh)/2)) : '$1,700,000'} sale:</p>
              {[
                { label: 'Legal / notary fees', val: '$1,800–$2,500' },
                { label: 'Moving costs (local Langley)', val: '$2,000–$4,000' },
                { label: 'Professional staging (optional)', val: '$3,000–$6,000' },
                { label: 'Total transition costs (est.)', val: '~$7,000–$13,000', bold: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 3 ? '1px solid #F1F5F9' : 'none' }}>
                  <span style={{ color: '#334155', fontSize: 14, fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: row.bold ? '#0A1628' : '#334155' }}>{row.val}</span>
                </div>
              ))}
              <div style={{ marginTop: 14, padding: '13px 16px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #166534' }}>
                <p style={{ color: '#166534', fontSize: 13, fontWeight: 600, margin: 0 }}>Less than 1% of your estimated proceeds — far less than most owners expect.</p>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px 28px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: '#0A1628' }}>What happens if you decide to list</h3>
              {[
                { week: 'Week 1', title: 'Prepare & photograph', body: 'Staging consultation, professional photos, pricing strategy. Your home is ready before it goes live.' },
                { week: 'Week 2', title: 'Live on MLS', body: 'Open house weekend. Qualified buyers in Willoughby are active and ready right now.' },
                { week: 'Weeks 3–4', title: 'Offers & negotiation', body: 'Comparable homes are receiving offers within 28 days. We negotiate the strongest terms.' },
                { week: 'Day 30–60', title: 'Completion', body: 'Keys handed over. Proceeds in your account. Done on your timeline.' },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 20, paddingBottom: i < 3 ? 20 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0A1628', color: '#C8952A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{i+1}</div>
                    {i < 3 && <div style={{ width: 2, flex: 1, background: '#E2E8F0', margin: '6px 0' }} />}
                  </div>
                  <div style={{ paddingTop: 6 }}>
                    <p style={{ color: '#C8952A', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{step.week}</p>
                    <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{step.title}</p>
                    <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6 }}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div style={{ padding: '16px 20px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
              <p style={{ color: '#94A3B8', fontSize: 12, lineHeight: 1.7, margin: 0 }}>{DISCLAIMER}</p>
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="sidebar-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0A1628' }}>Active buyer demand</span>
              </div>
              <p style={{ color: '#334155', fontSize: 14, lineHeight: 1.6 }}>Strong buyer demand in Willoughby for detached homes in the $1.3M–$1.8M range. I work with buyers actively looking right now.</p>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px' }}>
              <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#0A1628' }}>Who is buying right now</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Families from Metro Vancouver — pre-approved $1.3M–$1.8M','Move-in ready — not planning renovations','School catchment, suite income, and garage a priority','30–45 day completion timeline needed'].map((pt, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#0D9488', fontSize: 14, flexShrink: 0 }}>•</span>
                    <span style={{ color: '#334155', fontSize: 13, lineHeight: 1.5 }}>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ background: '#0A1628', borderRadius: 14, padding: '20px', border: '1px solid #1E3A5F' }}>
              <p style={{ color: '#C8952A', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Supply is very limited right now</p>
              <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.6 }}>Very few comparable detached homes available in Willoughby. Sellers in low-supply markets consistently capture the strongest offers.</p>
            </div>

            {/* Off-market option */}
            <div style={{ background: '#F0FDFA', borderRadius: 14, border: '1px solid #0D9488', padding: '20px' }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0A1628', marginBottom: 8 }}>Not ready to list publicly?</p>
              <p style={{ color: '#334155', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>Ask about a private off-market sale. Qualified buyers, full market value, no public listing required.</p>
              <a href="tel:+12366602594" style={{ display: 'block', padding: '12px', background: '#0D9488', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 10, textDecoration: 'none', textAlign: 'center' }}>Ask Kamran about this</a>
            </div>

            {/* PDF gate */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px' }}>
              <h4 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#0A1628' }}>Get the full report as a PDF</h4>
              <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>Renovation-adjusted estimate, net-in-pocket number, full comp breakdown, and move cost calculator.</p>
              {emailSent ? (
                <div style={{ background: '#F0FDF4', border: '1px solid #166534', borderRadius: 8, padding: '14px', textAlign: 'center' }}>
                  <p style={{ color: '#166534', fontWeight: 700, fontSize: 14, margin: 0 }}>✓ Report sent! Check your inbox.</p>
                </div>
              ) : (
                <>
                  <input value={lead.email} onChange={e => setLead(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" type="email" style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #CBD5E1', borderRadius: 8, fontSize: 15, marginBottom: 10, outline: 'none' }} />
                  <button onClick={handleEmailReport} disabled={emailLoading || !lead.email.includes('@')} style={{ width: '100%', padding: '14px', background: emailLoading ? '#94A3B8' : '#0D9488', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 10, cursor: emailLoading ? 'not-allowed' : 'pointer' }}>
                    {emailLoading ? 'Sending...' : 'Email me the full report →'}
                  </button>
                  <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 10, textAlign: 'center' }}>Kamran Khan follows up personally within 24 hours</p>
                </>
              )}
            </div>
            <div style={{ background: '#FEF9EC', borderRadius: 14, border: '1px solid #C8952A', padding: '20px', textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#0A1628', marginBottom: 6 }}>Prefer to talk now?</p>
              <p style={{ color: '#64748B', fontSize: 13, marginBottom: 14 }}>15 minutes. No obligation. Just your real number.</p>
              <a href="tel:+12366602594" style={{ display: 'block', padding: '12px', background: '#0A1628', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 10, textDecoration: 'none' }}>Call +1-236-660-2594</a>
            </div>
          </div>
        </div>
      )}

      {/* ── GATE 4 ── */}
      {gate === 4 && (
        <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0', padding: '52px 40px', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>✅</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, color: '#0A1628' }}>Your report is on its way</h2>
            <p style={{ color: '#64748B', fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
              Check your inbox — your personalized Willoughby equity report is headed there now.<br /><br />
              <strong style={{ color: '#0A1628' }}>Kamran Khan</strong> will follow up personally within 24 hours.
            </p>
            <div style={{ background: '#FEF9EC', border: '1px solid #C8952A', borderRadius: 12, padding: '24px', marginBottom: 20 }}>
              <p style={{ fontWeight: 700, color: '#0A1628', marginBottom: 6 }}>Want to talk today?</p>
              <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16 }}>15 minutes. No pressure. Just your complete picture.</p>
              <a href="tel:+12366602594" style={{ display: 'block', padding: '14px', background: '#0A1628', color: '#fff', fontWeight: 700, borderRadius: 10, textDecoration: 'none', fontSize: 15 }}>Call +1-236-660-2594</a>
            </div>
            <p style={{ color: '#94A3B8', fontSize: 13 }}>Kamran Khan · REALTOR® · Royal Lepage Global Force Realty</p>
          </div>
        </div>
      )}

      {/* CHAT */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
        {chatOpen && (
          <div style={{ width: 320, background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ background: '#0A1628', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>Willoughby Home Value</p>
                <p style={{ color: '#64748B', fontSize: 12, margin: 0 }}>Ask anything — Kamran answers personally</p>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ height: 240, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, background: m.role === 'user' ? '#0D9488' : '#F1F5F9', color: m.role === 'user' ? '#fff' : '#334155' }}>{m.text}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} placeholder="Type a question..." style={{ flex: 1, padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14, outline: 'none' }} />
              <button onClick={handleChat} style={{ padding: '10px 16px', background: '#0D9488', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>→</button>
            </div>
          </div>
        )}
        <button onClick={() => setChatOpen(!chatOpen)} style={{ width: 56, height: 56, borderRadius: '50%', background: '#0A1628', border: '3px solid #C8952A', color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
          💬
        </button>
      </div>
    </div>
  )
}
