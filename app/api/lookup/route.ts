import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function extractStreetNumber(address: string): string | null {
  const match = address.match(/^\s*(\d+)/)
  return match ? match[1] : null
}

function extractPostalCode(address: string): string | null {
  const match = address.match(/([A-Z]\d[A-Z])\s*(\d[A-Z]\d)/i)
  return match ? `${match[1].toUpperCase()}${match[2].toUpperCase()}` : null
}

function classifyAddress(address: string): 'willoughby' | 'langley' | 'lower_mainland' | 'outside_bc' {
  const upper = address.toUpperCase()
  const postalMatch = address.match(/([A-Z]\d[A-Z])\s*\d[A-Z]\d/i)
  const postal = postalMatch ? postalMatch[1].toUpperCase() : ''

  // Willoughby specific — V2Y postal codes
  if (postal === 'V2Y') return 'willoughby'

  // Check if it mentions Willoughby or Langley explicitly
  if (upper.includes('WILLOUGHBY')) return 'willoughby'

  // Greater Langley area
  const langleyCodes = ['V1M', 'V3A', 'V4W', 'V2Z', 'V1C', 'V2R', 'V1B', 'V1E', 'V4R']
  if (langleyCodes.includes(postal)) return 'langley'
  if (upper.includes('LANGLEY') && !upper.includes('SURREY') && !upper.includes('VANCOUVER')) return 'langley'

  // BC but outside Langley
  const bcPrefixes = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9']
  if (bcPrefixes.some(p => postal.startsWith(p))) return 'lower_mainland'

  // If no postal found but address looks BC
  if (upper.includes('BC') || upper.includes('BRITISH COLUMBIA')) return 'lower_mainland'

  return 'outside_bc'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address } = body

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const postalCode = extractPostalCode(address) || ''
    const streetNumber = extractStreetNumber(address)
    const areaType = classifyAddress(address)

    // ── Log the visit regardless of area ─────────────────────────────────────
    await supabase.from('leads').insert({
      address,
      postal_code: postalCode,
      stage: 'viewed',
      bca_assessed: null,
    }).single()

    // ── Out of area — return appropriate message, NO bca data ─────────────────
    if (areaType !== 'willoughby') {
      return NextResponse.json({
        success: true,
        bcaData: null,  // CRITICAL: always null for out-of-area
        outOfArea: true,
        areaType,
        message: areaType === 'langley'
          ? 'Your home is just outside our Willoughby coverage — but we cover all of Langley. Leave your details and Kamran will prepare a personal market analysis within 24 hours.'
          : 'We currently specialize in Willoughby, Langley BC. Leave your details and we\'ll let you know when we expand to your area — or if you\'re considering buying in Willoughby, we\'d love to help.',
      })
    }

    // ── Willoughby address — find in database ─────────────────────────────────
    let bcaRecord: any = null

    if (streetNumber) {
      // Strategy 1: street number + postal code prefix
      if (postalCode) {
        const { data } = await supabase
          .from('bca_data')
          .select('*')
          .ilike('civic_address', `${streetNumber} %`)
          .ilike('postal_code', `${postalCode.slice(0, 3)}%`)
          .limit(1)
          .maybeSingle()
        bcaRecord = data
      }

      // Strategy 2: street number + street name fragment
      if (!bcaRecord) {
        const { data } = await supabase
          .from('bca_data')
          .select('*')
          .ilike('civic_address', `${streetNumber} %`)
          .limit(5)

        if (data && data.length > 0) {
          if (data.length === 1) {
            bcaRecord = data[0]
          } else {
            const inputLower = address.toLowerCase()
            const streetRef = inputLower.match(/\b(\d+[a-z]?)\s+(ave|av|st|rd|dr|blvd|cres|pl|way|ct)/i)
            if (streetRef) {
              const ref = streetRef[1].toLowerCase()
              bcaRecord = data.find((r: any) => r.civic_address.toLowerCase().includes(ref)) || data[0]
            } else {
              bcaRecord = data[0]
            }
          }
        }
      }
    }

    // ── Not found in Willoughby database ─────────────────────────────────────
    if (!bcaRecord) {
      return NextResponse.json({
        success: true,
        bcaData: null,
        outOfArea: false,
        notFound: true,
        message: 'Your address is in Willoughby but we don\'t have automated data for it yet. Leave your details and Kamran will prepare your personalized report manually within 24 hours.',
      })
    }

    // ── Found — return real data ──────────────────────────────────────────────
    const assessed = Number(bcaRecord.assessed_total)
    const floorArea = bcaRecord.floor_area && bcaRecord.floor_area !== '-' && bcaRecord.floor_area !== 'nan'
      ? Number(bcaRecord.floor_area)
      : null

    const psfLow  = floorArea ? Math.round(451 * floorArea / 1000) * 1000 : assessed
    const psfHigh = floorArea ? Math.round(481 * floorArea / 1000) * 1000 : assessed
    const estimateLow  = Math.max(psfLow,  Math.round(assessed * 0.97 / 1000) * 1000)
    const estimateHigh = Math.max(psfHigh, Math.round(assessed * 1.05 / 1000) * 1000)

    // Update lead with real data
    await supabase
      .from('leads')
      .update({
        bca_assessed: bcaRecord.assessed_total,
        purchase_year: bcaRecord.purchase_date ? new Date(bcaRecord.purchase_date).getFullYear() : null,
        purchase_price: bcaRecord.purchase_price,
        equity_gain: bcaRecord.equity_gain,
      })
      .eq('address', address)

    return NextResponse.json({
      success: true,
      outOfArea: false,
      notFound: false,
      bcaData: {
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
      },
    })
  } catch (error) {
    console.error('Lookup error:', error)
    return NextResponse.json({ success: false, error: 'Lookup failed' }, { status: 500 })
  }
}
