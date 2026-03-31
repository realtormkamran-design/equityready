'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// ─── SET YOUR PASSWORD HERE ───────────────────────────────────────────────────
// Change the word YOURPASSWORD below to whatever password you want
// Example: const DASHBOARD_PASSWORD = 'kamran2026'
const DASHBOARD_PASSWORD = 'Equitygain$2026'
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Lead {
  id: string
  address: string
  postal_code: string
  area_type: string
  name: string | null
  phone: string | null
  email: string | null
  stage: string
  bca_assessed: number | null
  created_at: string
}

const fmt = (n: number) => '$' + Math.round(n).toLocaleString()

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  return `${days}d ago`
}

function getStage(lead: Lead) {
  if (lead.email && lead.stage === 'report_requested') return 'pdf'
  if (lead.phone && lead.name) return 'unlocked'
  if (lead.stage === 'viewed') return 'viewed'
  return 'address'
}

function getInitials(name: string | null) {
  if (!name) return '--'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Dashboard() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')

  const handleLogin = () => {
    if (pw === DASHBOARD_PASSWORD) {
      setAuthed(true)
      setPwError(false)
    } else {
      setPwError(true)
    }
  }

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLeads(data || [])
        setLoading(false)
      })
  }, [authed])

  const filtered = leads.filter(l => {
    if (filter === 'all') return true
    if (filter === 'pdf') return getStage(l) === 'pdf'
    if (filter === 'unlocked') return getStage(l) === 'unlocked'
    if (filter === 'viewed') return getStage(l) === 'viewed'
    return true
  })

  const counts = {
    all: leads.length,
    pdf: leads.filter(l => getStage(l) === 'pdf').length,
    unlocked: leads.filter(l => getStage(l) === 'unlocked').length,
    viewed: leads.filter(l => getStage(l) === 'viewed').length,
  }

  // ── Login screen ─────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0A1628',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Helvetica Neue', Arial, sans-serif"
      }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '48px 40px',
          width: '100%', maxWidth: 380, textAlign: 'center'
        }}>
          <div style={{ color: '#C8952A', fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            EquityReady
          </div>
          <div style={{ color: '#64748B', fontSize: 14, marginBottom: 32 }}>
            Lead Dashboard
          </div>
          <input
            type="password"
            placeholder="Enter password"
            value={pw}
            onChange={e => { setPw(e.target.value); setPwError(false) }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 8,
              border: pwError ? '2px solid #ef4444' : '1.5px solid #E2E8F0',
              fontSize: 15, outline: 'none', marginBottom: 12,
              boxSizing: 'border-box'
            }}
          />
          {pwError && (
            <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>
              Incorrect password
            </div>
          )}
          <button
            onClick={handleLogin}
            style={{
              width: '100%', padding: '13px', background: '#0A1628',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 700, cursor: 'pointer'
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: '#F1F5F9',
      fontFamily: "'Helvetica Neue', Arial, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        background: '#0A1628', padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ color: '#C8952A', fontSize: 18, fontWeight: 800 }}>EquityReady</span>
        <span style={{ color: '#94A3B8', fontSize: 13 }}>Lead Dashboard · Willoughby 2026</span>
        <button
          onClick={() => setAuthed(false)}
          style={{
            background: 'transparent', border: '1px solid #334155',
            color: '#94A3B8', borderRadius: 6, padding: '5px 12px',
            fontSize: 12, cursor: 'pointer'
          }}
        >
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total leads', value: counts.all, sub: 'all time', color: '#0A1628' },
            { label: 'PDF requested', value: counts.pdf, sub: 'name + phone + email', color: '#16a34a' },
            { label: 'Phone unlocked', value: counts.unlocked, sub: 'name + phone only', color: '#185FA5' },
            { label: 'Viewed only', value: counts.viewed, sub: 'no contact yet', color: '#C8952A' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: 10, padding: '16px',
              border: '0.5px solid #E2E8F0'
            }}>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'pdf', label: `PDF requested (${counts.pdf})` },
            { key: 'unlocked', label: `Phone unlocked (${counts.unlocked})` },
            { key: 'viewed', label: `Viewed only (${counts.viewed})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12,
                border: filter === f.key ? '1.5px solid #0A1628' : '1px solid #E2E8F0',
                background: filter === f.key ? '#0A1628' : '#fff',
                color: filter === f.key ? '#C8952A' : '#64748B',
                cursor: 'pointer', fontWeight: filter === f.key ? 700 : 400
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lead list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748B' }}>
            Loading leads...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748B' }}>
            No leads in this category yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(lead => {
              const stage = getStage(lead)
              const stageColors: Record<string, { border: string; badge: string; badgeTxt: string; avatarBg: string; avatarTxt: string; label: string }> = {
                pdf:      { border: '#22c55e', badge: '#dcfce7', badgeTxt: '#166534', avatarBg: '#dcfce7', avatarTxt: '#166534', label: 'PDF requested' },
                unlocked: { border: '#378ADD', badge: '#E6F1FB', badgeTxt: '#0C447C', avatarBg: '#E6F1FB', avatarTxt: '#0C447C', label: 'Call now' },
                viewed:   { border: '#C8952A', badge: '#FEF9EC', badgeTxt: '#92600A', avatarBg: '#FEF9EC', avatarTxt: '#92600A', label: 'Send letter' },
                address:  { border: '#CBD5E1', badge: '#F1F5F9', badgeTxt: '#64748B', avatarBg: '#F1F5F9', avatarTxt: '#64748B', label: 'Address only' },
              }
              const sc = stageColors[stage]

              return (
                <div key={lead.id} style={{
                  background: '#fff', borderRadius: 12,
                  border: '0.5px solid #E2E8F0',
                  borderLeft: `3px solid ${sc.border}`,
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: sc.avatarBg, color: sc.avatarTxt,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, flexShrink: 0
                  }}>
                    {getInitials(lead.name)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: '#0A1628',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {lead.address}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                      {lead.name && <span style={{ marginRight: 8 }}>{lead.name}</span>}
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} style={{ color: '#185FA5', marginRight: 8, textDecoration: 'none' }}>
                          {lead.phone}
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} style={{ color: '#185FA5', marginRight: 8, textDecoration: 'none' }}>
                          {lead.email}
                        </a>
                      )}
                      {!lead.name && !lead.phone && !lead.email && (
                        <span style={{ color: '#94A3B8' }}>No contact info</span>
                      )}
                      <span style={{ color: '#94A3B8' }}>· {timeAgo(lead.created_at)}</span>
                    </div>
                  </div>

                  {/* Stage badge */}
                  <span style={{
                    fontSize: 10, padding: '3px 10px', borderRadius: 10,
                    background: sc.badge, color: sc.badgeTxt,
                    fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap'
                  }}>
                    {sc.label}
                  </span>

                  {/* Value */}
                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90 }}>
                    {lead.bca_assessed ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1628' }}>
                          {fmt(lead.bca_assessed)}
                        </div>
                        <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                          BCA assessed
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>No BCA data</div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <a
                      href={lead.phone ? `tel:${lead.phone}` : '#'}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        background: lead.phone ? '#F0FDF4' : '#F8FAFC',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, textDecoration: 'none',
                        opacity: lead.phone ? 1 : 0.3, pointerEvents: lead.phone ? 'auto' : 'none'
                      }}
                    >
                      📞
                    </a>
                    <a
                      href={lead.email ? `mailto:${lead.email}` : '#'}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        background: lead.email ? '#EFF6FF' : '#F8FAFC',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, textDecoration: 'none',
                        opacity: lead.email ? 1 : 0.3, pointerEvents: lead.email ? 'auto' : 'none'
                      }}
                    >
                      ✉️
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
