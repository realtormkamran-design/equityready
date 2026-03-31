import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, name, phone, email, bcaData, narrative, checkedRenos } = body

    const supabase = createClient(supabaseUrl, supabaseKey)

    await supabase
      .from('leads')
      .update({ stage: 'report_requested', email })
      .eq('address', address)

    const RENO_LABELS: Record<string, { label: string; low: number; high: number }> = {
      kitchen_full:    { label: 'Kitchen — full renovation',  low: 25000, high: 45000 },
      kitchen_partial: { label: 'Kitchen — partial update',   low: 10000, high: 20000 },
      bath_primary:    { label: 'Primary bathroom — full',    low: 15000, high: 25000 },
      bath_secondary:  { label: 'Secondary bathroom',         low: 8000,  high: 15000 },
      flooring:        { label: 'Flooring throughout',        low: 12000, high: 22000 },
      suite:           { label: 'Basement suite added',       low: 40000, high: 65000 },
      deck:            { label: 'Deck / outdoor space',       low: 8000,  high: 18000 },
      roof:            { label: 'New roof',                   low: 5000,  high: 10000 },
    }

    const selectedRenos = (checkedRenos || []) as string[]
    const renoLow  = selectedRenos.reduce((s: number, id: string) => s + (RENO_LABELS[id]?.low  ?? 0), 0)
    const renoHigh = selectedRenos.reduce((s: number, id: string) => s + (RENO_LABELS[id]?.high ?? 0), 0)
    const baseEstLow  = bcaData?.estimateLow  ?? 1650000
    const baseEstHigh = bcaData?.estimateHigh ?? 1786000
    const adjLow  = baseEstLow  + renoLow
    const adjHigh = baseEstHigh + renoHigh
    const midEstimate = Math.round((adjLow + adjHigh) / 2)
    const netInPocket = Math.round(midEstimate * 0.93)

    const fmt = (n: number) => '$' + n.toLocaleString()

    const purchaseYear = bcaData?.purchaseDate
      ? new Date(bcaData.purchaseDate).getFullYear()
      : 2004
    const yearsOwned = new Date().getFullYear() - purchaseYear
    const equityGain = bcaData?.equityGain ? fmt(bcaData.equityGain) : '$1,346,058'
    const equityMultiple = bcaData?.equityMultiple ?? '4.8'
    const purchasePrice = bcaData?.purchasePrice ? fmt(bcaData.purchasePrice) : '$354,942'
    const assessedTotal = bcaData?.assessedTotal ? fmt(bcaData.assessedTotal) : '$1,701,000'

    const renoRows = selectedRenos.length > 0
      ? selectedRenos.map((id: string) => {
          const r = RENO_LABELS[id]
          return `<tr>
            <td style="padding:10px 0;color:#334155;border-bottom:1px solid #f1f5f9">${r?.label ?? id}</td>
            <td style="padding:10px 0;text-align:right;color:#0D9488;font-weight:700;border-bottom:1px solid #f1f5f9">+${fmt(r?.low ?? 0)}–${fmt(r?.high ?? 0)}</td>
          </tr>`
        }).join('')
      : ''

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif">

<div style="max-width:600px;margin:0 auto;padding:32px 16px">

  <!-- EMOTIONAL OPENER — no logo, no header, just feeling -->
  <div style="background:#0A1628;border-radius:16px 16px 0 0;padding:48px 40px 40px;text-align:center">
    <p style="color:#C8952A;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 20px">
      A message for the homeowner at
    </p>
    <p style="color:#94A3B8;font-size:15px;margin:0 0 32px">${address}</p>
    
    <!-- THE EMOTIONAL LINE -->
    <p style="color:#ffffff;font-size:26px;font-weight:700;line-height:1.4;margin:0 0 16px;max-width:460px;margin-left:auto;margin-right:auto">
      ${yearsOwned} years ago you made a decision most people were too scared to make.
    </p>
    <p style="color:#C8952A;font-size:18px;font-weight:600;margin:0">
      This is what it's worth.
    </p>
  </div>

  <!-- THE BIG NUMBER -->
  <div style="background:#FEF9EC;border-left:5px solid #C8952A;border-right:5px solid #C8952A;padding:40px;text-align:center">
    <p style="color:#92600A;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px">Your tax-free equity gain</p>
    <p style="color:#C8952A;font-size:64px;font-weight:900;margin:0;line-height:1">${equityGain}+</p>
    <p style="color:#92600A;font-size:16px;margin:12px 0 0">${equityMultiple}x your original investment · 100% tax-free · principal residence</p>
    <div style="margin:24px auto 0;padding:16px 24px;background:#fff;border-radius:10px;display:inline-block;border:1px solid #C8952A">
      <p style="color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">What lands in your bank account</p>
      <p style="color:#0A1628;font-size:28px;font-weight:800;margin:0">~${fmt(netInPocket)}</p>
      <p style="color:#94A3B8;font-size:12px;margin:6px 0 0">after all costs on an estimated ${fmt(midEstimate)} sale</p>
    </div>
  </div>

  <!-- WHAT THIS MEANS -->
  <div style="background:#ffffff;padding:40px">
    <p style="color:#0A1628;font-size:18px;font-weight:700;margin:0 0 16px">What ${fmt(netInPocket)} actually means</p>
    <div style="display:grid;gap:12px">
      ${[
        { icon: '🏡', text: `Buy a brand new townhome in Langley outright — fully paid, no mortgage — and still have money left over` },
        { icon: '✈️', text: `Travel for years. Help your kids with a down payment. Invest and generate passive income for life` },
        { icon: '😮‍💨', text: `Never worry about maintenance, property taxes, or a big home you no longer need` },
        { icon: '🔒', text: `Lock in your gain now — before new supply in Willoughby puts pricing pressure on 2003-2007 built homes` },
      ].map(item => `
      <div style="display:flex;gap:14px;align-items:flex-start;padding:14px;background:#F8FAFC;border-radius:10px;border:1px solid #E2E8F0">
        <span style="font-size:22px;flex-shrink:0">${item.icon}</span>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0">${item.text}</p>
      </div>`).join('')}
    </div>
  </div>

  <!-- STAT CARDS -->
  <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;display:flex">
    <div style="flex:1;padding:20px;text-align:center;border-right:1px solid #E2E8F0">
      <p style="color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Purchased for</p>
      <p style="color:#0F2B5B;font-size:20px;font-weight:800;margin:0">${purchasePrice}</p>
      <p style="color:#94A3B8;font-size:12px;margin:4px 0 0">${purchaseYear} · ${yearsOwned} yrs ago</p>
    </div>
    <div style="flex:1;padding:20px;text-align:center;border-right:1px solid #E2E8F0">
      <p style="color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">2026 BCA Assessed</p>
      <p style="color:#0F2B5B;font-size:20px;font-weight:800;margin:0">${assessedTotal}</p>
      <p style="color:#94A3B8;font-size:12px;margin:4px 0 0">Official assessment</p>
    </div>
    <div style="flex:1;padding:20px;text-align:center">
      <p style="color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Market estimate</p>
      <p style="color:#0F2B5B;font-size:20px;font-weight:800;margin:0">${fmt(adjLow)}–</p>
      <p style="color:#0F2B5B;font-size:16px;font-weight:700;margin:0">${fmt(adjHigh)}</p>
      <p style="color:#94A3B8;font-size:12px;margin:4px 0 0">$451–$481/sqft</p>
    </div>
  </div>

  <!-- NARRATIVE -->
  <div style="background:#ffffff;padding:36px 40px">
    <p style="color:#0A1628;font-size:17px;font-weight:700;margin:0 0 14px">What the market is telling us about your home</p>
    <p style="color:#334155;font-size:15px;line-height:1.9;margin:0">${narrative || `Your home sits in one of Willoughby's most established neighbourhoods. Three comparable homes sold between September and October 2025 at an average of $468 per square foot — with two of three selling above their BC Assessment by an average of $111,500. The market is active, supply is limited, and homes like yours are selling in an average of 28 days.`}</p>
  </div>

  <!-- COMP TABLE -->
  <div style="background:#F8FAFC;padding:36px 40px;border-top:1px solid #E2E8F0">
    <p style="color:#0A1628;font-size:16px;font-weight:700;margin:0 0 16px">Verified sales on your street — Sept–Oct 2025</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="border-bottom:2px solid #E2E8F0">
          <th style="padding:8px 0;text-align:left;color:#64748B;font-weight:600;font-size:11px;text-transform:uppercase">Street</th>
          <th style="padding:8px 0;text-align:left;color:#64748B;font-weight:600;font-size:11px;text-transform:uppercase">Sold</th>
          <th style="padding:8px 0;text-align:left;color:#64748B;font-weight:600;font-size:11px;text-transform:uppercase">BCA</th>
          <th style="padding:8px 0;text-align:left;color:#64748B;font-weight:600;font-size:11px;text-transform:uppercase">Sold Price</th>
          <th style="padding:8px 0;text-align:right;color:#64748B;font-weight:600;font-size:11px;text-transform:uppercase">vs BCA</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #F1F5F9">
          <td style="padding:12px 0">69A Ave</td>
          <td style="padding:12px 0;color:#64748B">Sep 2025</td>
          <td style="padding:12px 0;color:#64748B">$1,543,000</td>
          <td style="padding:12px 0;font-weight:600">$1,650,000</td>
          <td style="padding:12px 0;text-align:right;color:#166534;font-weight:700">+$107,000</td>
        </tr>
        <tr style="border-bottom:1px solid #F1F5F9">
          <td style="padding:12px 0">69 Ave</td>
          <td style="padding:12px 0;color:#64748B">Sep 2025</td>
          <td style="padding:12px 0;color:#64748B">$1,486,000</td>
          <td style="padding:12px 0;font-weight:600">$1,480,000</td>
          <td style="padding:12px 0;text-align:right;color:#64748B">at assessed</td>
        </tr>
        <tr>
          <td style="padding:12px 0">70A Ave</td>
          <td style="padding:12px 0;color:#64748B">Oct 2025</td>
          <td style="padding:12px 0;color:#64748B">$1,239,000</td>
          <td style="padding:12px 0;font-weight:600">$1,355,000</td>
          <td style="padding:12px 0;text-align:right;color:#166534;font-weight:700">+$116,000</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:14px;padding:12px 16px;background:#FEF9EC;border-radius:8px;border:1px solid #C8952A">
      <p style="color:#92600A;font-size:13px;font-weight:600;margin:0">2 of 3 homes sold above BCA by avg $111,500 · $451–$481/sqft · Avg 28 days on market</p>
    </div>
  </div>

  ${selectedRenos.length > 0 ? `
  <!-- RENO ADJUSTMENTS -->
  <div style="background:#F0FDFA;padding:36px 40px;border-top:1px solid #0D9488">
    <p style="color:#0A1628;font-size:16px;font-weight:700;margin:0 0 14px">Your renovation-adjusted estimate</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
      <tbody>${renoRows}</tbody>
    </table>
    <div style="padding:16px;background:#fff;border-radius:10px;border:1px solid #0D9488">
      <p style="color:#0A1628;font-size:16px;font-weight:700;margin:0">Adjusted range: ${fmt(adjLow)} – ${fmt(adjHigh)}</p>
      <p style="color:#64748B;font-size:13px;margin:4px 0 0">Buyer premium for your upgrades: +${fmt(renoLow)}–${fmt(renoHigh)}</p>
    </div>
  </div>` : ''}

  <!-- CTA -->
  <div style="background:#0A1628;padding:48px 40px;text-align:center">
    <p style="color:#C8952A;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px">You already made the smart move</p>
    <p style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;line-height:1.4">This is just about knowing<br>when to take the win.</p>
    <p style="color:#94A3B8;font-size:14px;margin:0 0 28px;line-height:1.6">15 minutes. No obligation. I'll show you your exact net number,<br>walk you through the process, and answer every question you have.</p>
    <a href="tel:+12366602594" style="display:inline-block;padding:16px 40px;background:#C8952A;color:#fff;font-weight:800;font-size:16px;border-radius:12px;text-decoration:none;letter-spacing:0.5px">
      Call Kamran · +1-236-660-2594
    </a>
    <p style="color:#4A6080;font-size:13px;margin:20px 0 0">Or reply to this email — I read every one personally.</p>
  </div>

  <!-- SIGNATURE -->
  <div style="background:#fff;padding:32px 40px;border-top:1px solid #E2E8F0">
    <p style="font-weight:800;font-size:18px;color:#0A1628;margin:0 0 4px">Kamran Khan</p>
    <p style="color:#64748B;font-size:14px;margin:0 0 2px">REALTOR® · Royal Lepage Global Force Realty</p>
    <p style="color:#64748B;font-size:14px;margin:0 0 2px">+1-236-660-2594</p>
    <p style="color:#64748B;font-size:14px;margin:0 0 2px">Realtormkamran@gmail.com</p>
    <p style="color:#0D9488;font-size:14px;margin:0">equityready.ca</p>
  </div>

  <!-- FOOTER -->
  <div style="background:#F8FAFC;padding:20px 40px;border-top:1px solid #E2E8F0;border-radius:0 0 16px 16px">
    <p style="color:#94A3B8;font-size:11px;margin:0;line-height:1.6;text-align:center">
      Based on 3 verified MLS transactions in Willoughby, Sept–Oct 2025. Market estimates only — verify with current MLS data before any transaction.
      This report was prepared exclusively for the homeowner at ${address}.
    </p>
  </div>

</div>
</body>
</html>`

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && email) {
      // ── FIX 1: Clean subject line — no dollar amounts, no address ──────────
      // Dollar amounts and addresses in subject lines trigger spam filters
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: 'Kamran Khan <Realtormkamran@gmail.com>',
          to: email,
          subject: `Your Willoughby home report is ready — Kamran Khan`,
          html: emailHtml,
        }),
      })

      // Alert to Kamran
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: 'EquityReady Leads <kamran@equityready.ca>',
          to: process.env.REALTOR_EMAIL || 'Realtormkamran@gmail.com',
          subject: `New lead — ${name} · ${address.split(',')[0]}`,
          html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
            <h2 style="color:#0A1628">New PDF report requested</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#64748B;font-size:14px">Name</td><td style="padding:8px 0;font-weight:700">${name}</td></tr>
              <tr><td style="padding:8px 0;color:#64748B;font-size:14px">Phone</td><td style="padding:8px 0;font-weight:700"><a href="tel:${phone}">${phone}</a></td></tr>
              <tr><td style="padding:8px 0;color:#64748B;font-size:14px">Email</td><td style="padding:8px 0;font-weight:700">${email}</td></tr>
              <tr><td style="padding:8px 0;color:#64748B;font-size:14px">Address</td><td style="padding:8px 0;font-weight:700">${address}</td></tr>
              <tr><td style="padding:8px 0;color:#64748B;font-size:14px">Equity gain</td><td style="padding:8px 0;font-weight:700;color:#C8952A">${equityGain}</td></tr>
              <tr><td style="padding:8px 0;color:#64748B;font-size:14px">Estimate range</td><td style="padding:8px 0;font-weight:700">${fmt(adjLow)} – ${fmt(adjHigh)}</td></tr>
              <tr><td style="padding:8px 0;color:#64748B;font-size:14px">Renovations</td><td style="padding:8px 0">${selectedRenos.length > 0 ? selectedRenos.join(', ') : 'None selected'}</td></tr>
            </table>
            <div style="margin-top:20px;padding:16px;background:#FEF9EC;border-radius:8px;border:1px solid #C8952A">
              <p style="font-weight:700;color:#0A1628;margin:0">Follow up within 24 hours. Call or text ${phone}.</p>
            </div>
          </div>`,
        }),
      })
    }

    // ── Follow Up Boss integration ──────────────────────────────────────────
    // FIX 2: Removed X-System-Key header — it was causing intermittent FUB failures
    // FUB only needs Basic auth with the API key. X-System-Key is not required.
    const fubKey = process.env.FOLLOWUPBOSS_API_KEY
    if (fubKey && name && phone) {
      try {
        const fubPayload = {
          source: 'EquityReady',
          type: 'Registration',
          person: {
            firstName: name.split(' ')[0] || name,
            lastName: name.split(' ').slice(1).join(' ') || '',
            emails: email ? [{ value: email, type: 'home' }] : [],
            phones: [{ value: phone, type: 'mobile' }],
            addresses: [{
              street: address,
              type: 'home',
            }],
            tags: ['EquityReady', 'Willoughby', 'PDF Requested'],
          },
          notes: `EquityReady lead — ${address}
Equity gain: ${bcaData?.equityGain ? fmt(Number(bcaData.equityGain)) : 'N/A'}
Market estimate: ${fmt(adjLow)} – ${fmt(adjHigh)}
Renovations selected: ${selectedRenos.length > 0 ? selectedRenos.join(', ') : 'None'}
Source: equityready.ca PDF report request`,
        }

        await fetch('https://api.followupboss.com/v1/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(fubKey + ':').toString('base64')}`,
            'X-System': 'equityready.ca',
          },
          body: JSON.stringify(fubPayload),
        })
      } catch (fubError) {
        console.error('Follow Up Boss error:', fubError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email report error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send report' }, { status: 500 })
  }
}
