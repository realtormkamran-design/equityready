import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MARKET = {
  avgPsf: 468, lowPsf: 451, highPsf: 481,
  avgDOM: 28, fastestDOM: 19, avgAboveBCA: 111500,
}

function extractStreetNumber(address: string): string | null {
  const match = address.match(/^\s*(\d+)/)
  return match ? match[1] : null
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s*/gm, '')        // remove # ## ### headings
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove **bold**
    .replace(/\*(.*?)\*/g, '$1')     // remove *italic*
    .replace(/^[-*]\s+/gm, '')       // remove bullet points
    .replace(/\n{3,}/g, '\n\n')      // collapse excess newlines
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, name, phone } = body

    const supabase = createClient(supabaseUrl, supabaseKey)

    // ── Find BCA record ──────────────────────────────────────────────────────
    let bcaRecord: any = null
    const streetNumber = extractStreetNumber(address || '')

    if (streetNumber) {
      const { data } = await supabase
        .from('bca_data')
        .select('*')
        .ilike('civic_address', `${streetNumber} %`)
        .limit(5)

      if (data && data.length > 0) {
        if (data.length === 1) {
          bcaRecord = data[0]
        } else {
          // Best match by street name fragment
          const inputLower = address.toLowerCase()
          const streetRef = inputLower.match(/\b(\d+[a-z]?)\s+(ave|av|st|rd|dr|blvd|cres|pl|way|ct)/i)
          if (streetRef) {
            const ref = streetRef[1].toLowerCase()
            bcaRecord = data.find((r: any) =>
              r.civic_address.toLowerCase().includes(ref)
            ) || data[0]
          } else {
            bcaRecord = data[0]
          }
        }
      }
    }

    // ── Update lead stage ────────────────────────────────────────────────────
    await supabase
      .from('leads')
      .update({
        stage: 'report_requested',
        bca_assessed: bcaRecord?.assessed_total || null,
      })
      .eq('address', address)

    // ── Push to Follow Up Boss at Gate 2 unlock (name + phone captured) ──────
    // FIX: Removed X-System-Key header — was causing intermittent FUB failures
    // FUB only needs Basic auth. X-System should be your domain, not the API key.
    const fubKey = process.env.FOLLOWUPBOSS_API_KEY
    if (fubKey && name && phone) {
      try {
        const fubPayload = {
          source: 'equityready.ca',
          type: 'Registration',
          person: {
            firstName: name.split(' ')[0] || name,
            lastName: name.split(' ').slice(1).join(' ') || '',
            phones: [{ value: phone, type: 'mobile' }],
            addresses: [{ street: address, type: 'home' }],
            tags: ['EquityReady', 'Willoughby', 'Unlocked Estimate'],
          },
          notes: `EquityReady — unlocked estimate at Gate 2
Address: ${address}
BCA Assessed: ${bcaRecord?.assessed_total ? '$' + Number(bcaRecord.assessed_total).toLocaleString() : 'N/A'}
Purchase price: ${bcaRecord?.purchase_price ? '$' + Number(bcaRecord.purchase_price).toLocaleString() : 'N/A'}
Equity gain: ${bcaRecord?.equity_gain ? '$' + Number(bcaRecord.equity_gain).toLocaleString() : 'N/A'}
Source: equityready.ca`,
        }

        const fubRes = await fetch('https://api.followupboss.com/v1/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(fubKey + ':').toString('base64')}`,
            'X-System': 'equityready.ca',
          },
          body: JSON.stringify(fubPayload),
        })

        if (!fubRes.ok) {
          const errText = await fubRes.text()
          console.error('FUB error response:', fubRes.status, errText)
        } else {
          console.log('FUB lead created successfully')
        }
      } catch (fubError) {
        console.error('FUB error at Gate 2:', fubError)
      }
    }

    // ── Extract real property data ───────────────────────────────────────────
    const purchaseYear = bcaRecord?.purchase_date
      ? new Date(bcaRecord.purchase_date).getFullYear()
      : null
    const yearsOwned = purchaseYear
      ? new Date().getFullYear() - purchaseYear
      : null
    const purchasePrice  = bcaRecord?.purchase_price  ? Number(bcaRecord.purchase_price)  : null
    const assessedTotal  = bcaRecord?.assessed_total  ? Number(bcaRecord.assessed_total)  : null
    const equityGain     = bcaRecord?.equity_gain     ? Number(bcaRecord.equity_gain)     : null
    const equityMultiple = bcaRecord?.equity_multiple ? Number(bcaRecord.equity_multiple) : null
    const bedrooms       = bcaRecord?.bedrooms   || '3–4'
    const stories        = bcaRecord?.stories    || '2'
    const floorArea      = bcaRecord?.floor_area && bcaRecord.floor_area !== '-'
                           ? Number(bcaRecord.floor_area)
                           : null

    const fmt = (n: number) => '$' + Math.round(n).toLocaleString()

    // ── FIXED estimate formula ───────────────────────────────────────────────
    let estimateLow  = 1353000
    let estimateHigh = 1522000

    if (assessedTotal) {
      const psfLow  = floorArea ? Math.round(MARKET.lowPsf * floorArea / 1000) * 1000 : assessedTotal
      const psfHigh = floorArea ? Math.round(MARKET.highPsf * floorArea / 1000) * 1000 : assessedTotal

      estimateLow  = Math.max(psfLow,  Math.round(assessedTotal * 0.97 / 1000) * 1000)
      estimateHigh = Math.max(psfHigh, Math.round(assessedTotal * 1.05 / 1000) * 1000)
    }

    // ── Build instant narrative with real numbers ────────────────────────────
    let instantNarrative = ''

    if (bcaRecord && purchaseYear && purchasePrice && assessedTotal) {
      const sqftNote = floorArea ? ` (${floorArea.toLocaleString()} sq ft)` : ''
      instantNarrative = `You made a decision in ${purchaseYear} that most people second-guessed at the time. Your ${bedrooms}-bedroom${sqftNote} home in Willoughby has gone from ${fmt(purchasePrice)} to a 2026 BCA assessment of ${fmt(assessedTotal)} — ${equityMultiple ? `${equityMultiple}x your original investment` : 'a remarkable return'}, completely tax-free as your principal residence. That is not luck. That is the payoff of staying when others weren't sure.

Three comparable detached homes sold in Willoughby between September and October 2025 at an average of $${MARKET.avgPsf} per square foot, with two of three selling above their BC Assessment by an average of $${MARKET.avgAboveBCA.toLocaleString()}. Your realistic selling range today is ${fmt(estimateLow)} to ${fmt(estimateHigh)}. For most well-maintained homes on your street, the assessed value has been the floor — not the ceiling.

The market right now is active and supply is limited. Average days on market for comparable homes is just ${MARKET.avgDOM} days. The homeowners who listed first in this low-supply environment captured the strongest offers. You already made the smart move in ${purchaseYear}. What you do with ${equityGain ? fmt(equityGain) : 'the equity you have built'} — and when — is entirely your decision. I just want you to know exactly what you are sitting on.`
    } else {
      instantNarrative = `You made a decision to put down roots in Willoughby — and the market has rewarded that decision in a way most people only dream about. Three comparable detached homes sold between September and October 2025 at an average of $${MARKET.avgPsf} per square foot, with two of three selling above their BC Assessment by an average of $${MARKET.avgAboveBCA.toLocaleString()}.

At the current market rate of $${MARKET.lowPsf}–$${MARKET.highPsf} per square foot, the actual selling price for a well-maintained Willoughby home is consistently higher than what the BCA notice shows. Your assessment is not your ceiling. For most homes on your street, it has been the floor.

The market is active right now with an average of just ${MARKET.avgDOM} days on market. Supply of comparable detached homes in Willoughby is very limited — which consistently produces stronger offers for sellers who move first. You already made the smart move. This is just about knowing when to take the win.`
    }

    // ── Try Claude for enhanced narrative (8 second hard timeout) ───────────
    let finalNarrative = instantNarrative

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const sqftNote = floorArea ? `\nFloor area: ${floorArea} sqft` : ''
      const prompt = `Write a 3-paragraph equity report for this Willoughby homeowner.
Warm, human tone. Lead with emotion — the pride of having made a great decision in ${purchaseYear || '2004'}. 
Then the market facts. Then what it means for their future.
Never mention AI. Never use markdown headers or bullet points. Plain paragraphs only.
Under 270 words total.

Address: ${address}
Bedrooms: ${bedrooms}, Stories: ${stories}${sqftNote}
${purchaseYear ? `Purchase year: ${purchaseYear}` : ''}
${purchasePrice ? `Purchase price: ${fmt(purchasePrice)}` : ''}
${assessedTotal ? `2026 BCA assessed: ${fmt(assessedTotal)}` : ''}
${equityGain ? `Equity gained: ${fmt(equityGain)} (${equityMultiple}x, 100% tax-free)` : ''}
Estimated selling range: ${fmt(estimateLow)} – ${fmt(estimateHigh)}
Market: $${MARKET.avgPsf}/sqft avg, ${MARKET.avgDOM} days avg DOM, 2 of 3 recent sales above BCA by avg $${MARKET.avgAboveBCA.toLocaleString()}`

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: `You are a Willoughby, Langley BC real estate expert writing a personal equity report for a homeowner.
Write in second person. Warm but data-driven. Sound like a trusted local expert.
NEVER use markdown headers (#, ##), bullet points, or bold text.
Write plain paragraphs only. Never mention AI or templates.`,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const aiText = aiData.content?.[0]?.text
        if (aiText && aiText.length > 100) {
          finalNarrative = stripMarkdown(aiText)
        }
      }
    } catch {
      // Timed out or failed — instant narrative already set
    }

    // ── Return response ──────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      narrative: finalNarrative,
      bcaData: bcaRecord ? {
        address:        bcaRecord.civic_address,
        purchasePrice:  bcaRecord.purchase_price,
        purchaseDate:   bcaRecord.purchase_date,
        assessedTotal:  bcaRecord.assessed_total,
        equityGain:     bcaRecord.equity_gain,
        equityMultiple: bcaRecord.equity_multiple,
        bedrooms:       bcaRecord.bedrooms,
        stories:        bcaRecord.stories,
        yearsOwned:     bcaRecord.years_owned,
        floorArea:      bcaRecord.floor_area,
        estimateLow,
        estimateHigh,
      } : null,
    })

  } catch (error) {
    console.error('Report error:', error)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}
