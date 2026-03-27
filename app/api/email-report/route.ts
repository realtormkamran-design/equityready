import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, name, phone, email, bcaData, narrative, checkedRenos } = body

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Update lead stage
    await supabase
      .from('leads')
      .update({ stage: 'report_requested', email })
      .eq('address', address)

    // Build reno summary
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
    const renoLow  = selectedRenos.reduce((s: number, id: string) => s + (RENO_LABELS[id]?.low ?? 0), 0)
    const renoHigh = selectedRenos.reduce((s: number, id: string) => s + (RENO_LABELS[id]?.high ?? 0), 0)
    const baseEstLow  = bcaData?.estimateLow  ?? 1353000
    const baseEstHigh = bcaData?.estimateHigh ?? 1522000
    const adjLow  = baseEstLow  + renoLow
    const adjHigh = baseEstHigh + renoHigh

    const fmt = (n: number) => '$' + n.toLocaleString()

    const renoRows = selectedRenos.length > 0
      ? selectedRenos.map((id: string) => {
          const r = RENO_LABELS[id]
          return `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:10px 0;color:#334155">${r?.label ?? id}</td>
            <td style="padding:10px 0;text-align:right;color:#0D9488;font-weight:600">+${fmt(r?.low ?? 0)}–${fmt(r?.high ?? 0)}</td>
          </tr>`
        }).join('')
      : `<tr><td colspan="2" style="padding:10px 0;color:#64748b;font-style:italic">No renovations selected</td></tr>`

    // Build HTML email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:620px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">

  <!-- Header -->
  <div style="background:#0A1628;padding:32px 36px">
    <p style="color:#C8952A;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px">EquityReady</p>
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 6px">Your Personalized Equity Report</h1>
    <p style="color:#64748B;font-size:14px;margin:0">Prepared exclusively for the homeowner at ${address}</p>
  </div>

  <!-- Stat cards -->
  <div style="display:flex;border-bottom:1px solid #e2e8f0">
    <div style="flex:1;padding:24px 20px;border-right:1px solid #e2e8f0;text-align:center">
      <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">Purchased For</p>
      <p style="color:#0F2B5B;font-size:22px;font-weight:800;margin:0">${bcaData?.purchasePrice ? fmt(bcaData.purchasePrice) : '$342,794'}</p>
      <p style="color:#94a3b8;font-size:12px;margin:6px 0 0">${bcaData?.purchaseDate ? new Date(bcaData.purchaseDate).getFullYear() : '2004'} · ${bcaData?.yearsOwned ? Math.round(bcaData.yearsOwned) : 22} years ago</p>
    </div>
    <div style="flex:1;padding:24px 20px;border-right:1px solid #e2e8f0;text-align:center">
      <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">Market Estimate</p>
      <p style="color:#0F2B5B;font-size:22px;font-weight:800;margin:0">${fmt(adjLow)}–</p>
      <p style="color:#0F2B5B;font-size:18px;font-weight:700;margin:0">${fmt(adjHigh)}</p>
      <p style="color:#94a3b8;font-size:12px;margin:6px 0 0">at $451–$481/sqft</p>
    </div>
    <div style="flex:1;padding:24px 20px;background:#FEF9EC;text-align:center">
      <p style="color:#92600A;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">Equity Gained</p>
      <p style="color:#C8952A;font-size:22px;font-weight:800;margin:0">${bcaData?.equityGain ? fmt(bcaData.equityGain) : '$1,096,206'}+</p>
      <p style="color:#92600A;font-size:12px;margin:6px 0 0">${bcaData?.equityMultiple ?? '4.2'}x your money · 100% tax-free</p>
    </div>
  </div>

  <div style="padding:32px 36px">

    <!-- Narrative -->
    <h2 style="color:#0A1628;font-size:17px;font-weight:700;margin:0 0 14px">Market Analysis</h2>
    <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 28px">${narrative || 'Your Willoughby home sits in one of Langley\'s most established neighbourhoods. Recent comparable sales show strong buyer demand, with homes selling at $451–$481 per square foot — often above BCA assessment.'}</p>

    <!-- Comp table -->
    <h2 style="color:#0A1628;font-size:17px;font-weight:700;margin:0 0 14px">Comparable Sales — Sept–Oct 2025</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">
      <thead>
        <tr style="border-bottom:2px solid #e2e8f0">
          <th style="padding:10px 0;text-align:left;color:#64748b;font-size:12px;font-weight:600">Street</th>
          <th style="padding:10px 0;text-align:left;color:#64748b;font-size:12px;font-weight:600">Sold</th>
          <th style="padding:10px 0;text-align:left;color:#64748b;font-size:12px;font-weight:600">BCA</th>
          <th style="padding:10px 0;text-align:left;color:#64748b;font-size:12px;font-weight:600">Sold Price</th>
          <th style="padding:10px 0;text-align:left;color:#64748b;font-size:12px;font-weight:600">vs BCA</th>
          <th style="padding:10px 0;text-align:right;color:#64748b;font-size:12px;font-weight:600">Days</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px 0">69A Ave, Willoughby</td>
          <td style="padding:12px 0;color:#64748b">Sep 2025</td>
          <td style="padding:12px 0;color:#64748b">$1,543,000</td>
          <td style="padding:12px 0;font-weight:600">$1,650,000</td>
          <td style="padding:12px 0;color:#166534;font-weight:700">+$107,000</td>
          <td style="padding:12px 0;text-align:right;color:#64748b">19</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px 0">69 Ave, Willoughby</td>
          <td style="padding:12px 0;color:#64748b">Sep 2025</td>
          <td style="padding:12px 0;color:#64748b">$1,486,000</td>
          <td style="padding:12px 0;font-weight:600">$1,480,000</td>
          <td style="padding:12px 0;color:#64748b">at assessed</td>
          <td style="padding:12px 0;text-align:right;color:#64748b">28</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px 0">70A Ave, Willoughby</td>
          <td style="padding:12px 0;color:#64748b">Oct 2025</td>
          <td style="padding:12px 0;color:#64748b">$1,239,000</td>
          <td style="padding:12px 0;font-weight:600">$1,355,000</td>
          <td style="padding:12px 0;color:#166534;font-weight:700">+$116,000</td>
          <td style="padding:12px 0;text-align:right;color:#64748b">38</td>
        </tr>
      </tbody>
    </table>
    <div style="background:#FEF9EC;border:1px solid #C8952A;border-radius:8px;padding:14px 16px;margin-bottom:28px">
      <p style="color:#92600A;font-size:13px;font-weight:600;margin:0">2 of 3 homes sold above BCA by avg $111,500 · $451–$481/sqft · Avg 28 days on market</p>
    </div>

    <!-- Reno section -->
    ${selectedRenos.length > 0 ? `
    <h2 style="color:#0A1628;font-size:17px;font-weight:700;margin:0 0 14px">Renovation-Adjusted Estimate</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:14px">
      <tbody>${renoRows}</tbody>
    </table>
    <div style="background:#F0FDFA;border:1px solid #0D9488;border-radius:8px;padding:14px 16px;margin-bottom:28px">
      <p style="color:#0A1628;font-size:15px;font-weight:700;margin:0">Adjusted estimate: ${fmt(adjLow)} – ${fmt(adjHigh)}</p>
      <p style="color:#64748b;font-size:13px;margin:6px 0 0">Buyer premium for your upgrades: +${fmt(renoLow)}–${fmt(renoHigh)}</p>
    </div>
    ` : ''}

    <!-- Net in pocket -->
    <h2 style="color:#0A1628;font-size:17px;font-weight:700;margin:0 0 14px">Your Net-In-Pocket Estimate</h2>
    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 28px">
      On a sale around ${fmt(Math.round((adjLow + adjHigh) / 2))}, after realtor commission, legal fees, and moving costs, 
      most original Willoughby owners in this range walk away with approximately 
      <strong>${fmt(Math.round((adjLow + adjHigh) / 2 * 0.93))}</strong> in hand — completely tax-free as your principal residence.
    </p>

    <!-- CTA -->
    <div style="background:#0A1628;border-radius:12px;padding:28px;text-align:center;margin-bottom:12px">
      <p style="color:#C8952A;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px">Next Step</p>
      <p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 6px">Book a free 15-minute call</p>
      <p style="color:#94A3B8;font-size:14px;margin:0 0 20px">No obligation. I'll show you your exact number and the full buyer list.</p>
      <a href="tel:+12366602594" style="display:inline-block;padding:14px 32px;background:#C8952A;color:#fff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none">
        Call +1-236-660-2594
      </a>
    </div>

    <!-- Realtor sig -->
    <div style="border-top:1px solid #e2e8f0;padding-top:24px;margin-top:24px">
      <p style="font-weight:800;font-size:17px;color:#0A1628;margin:0 0 4px">Kamran Khan</p>
      <p style="color:#64748B;font-size:14px;margin:0 0 4px">REALTOR® · Royal Lepage Global Force Realty</p>
      <p style="color:#64748B;font-size:14px;margin:0 0 4px">+1-236-660-2594 · Realtormkamran@gmail.com</p>
      <p style="color:#64748B;font-size:14px;margin:0">equityready.ca</p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#F8FAFC;padding:20px 36px;border-top:1px solid #e2e8f0">
    <p style="color:#94A3B8;font-size:11px;margin:0;line-height:1.6">
      Based on 3 verified MLS transactions in Willoughby, Sept–Oct 2025. Market estimates only — verify with current MLS data before any transaction. 
      This report was prepared exclusively for the property address listed above and is not for general distribution.
    </p>
  </div>

</div>
</body>
</html>`

    // Send via Resend
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && email) {
      // Email to homeowner
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'Kamran Khan <kamran@equityready.ca>',
          to: email,
          subject: `Your Willoughby equity report — ${address}`,
          html: emailHtml,
        }),
      })

      // Alert to Kamran
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'EquityReady Leads <kamran@equityready.ca>',
          to: process.env.REALTOR_EMAIL || 'Realtormkamran@gmail.com',
          subject: `🔥 PDF requested — ${name} · ${phone} · ${address}`,
          html: `<p><strong>New PDF report requested:</strong></p>
<p>Name: <strong>${name}</strong><br>
Phone: <strong>${phone}</strong><br>
Email: <strong>${email}</strong><br>
Address: <strong>${address}</strong><br>
Renovations selected: ${selectedRenos.length > 0 ? selectedRenos.join(', ') : 'None'}</p>
<p>Adjusted estimate range: <strong>${fmt(adjLow)} – ${fmt(adjHigh)}</strong></p>
<p>Follow up within 24 hours.</p>`,
        }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email report error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send report' }, { status: 500 })
  }
}
