import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Extract street number from any address format
function extractStreetNumber(address: string): string | null {
  const match = address.match(/^\s*(\d+)/)
  return match ? match[1] : null
}

// Extract postal code from Google Maps format: "V2Y 2Y2" or "V2Y2Y2"
function extractPostalCode(address: string): string | null {
  const match = address.match(/([A-Z]\d[A-Z])\s*(\d[A-Z]\d)/i)
  return match ? `${match[1].toUpperCase()}${match[2].toUpperCase()}` : null
}

// Extract street name keywords for fuzzy matching
function extractStreetKeywords(address: string): string[] {
  // Remove house number, city, province, postal, country
  const cleaned = address
    .replace(/^\d+\s+/, '')           // remove leading number
    .replace(/,.*$/, '')              // remove everything after first comma
    .replace(/\b(Ave|Avenue|St|Street|Rd|Road|Dr|Drive|Blvd|Cres|Crescent|Pl|Place|Ct|Court|Way|Lane|Ln)\b/gi, '')
    .trim()
    .toLowerCase()
  return cleaned.split(/\s+/).filter(w => w.length > 1)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address } = body

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const streetNumber = extractStreetNumber(address)
    const postalCode = extractPostalCode(address)

    let bcaRecord: any = null

    // Strategy 1: Match on street number + postal code (most reliable)
    if (streetNumber && postalCode) {
      const { data } = await supabase
        .from('bca_data')
        .select('*')
        .ilike('civic_address', `${streetNumber}%`)
        .ilike('postal_code', `${postalCode.slice(0, 3)}%`)
        .limit(1)
        .maybeSingle()
      bcaRecord = data
    }

    // Strategy 2: Match on street number + partial address
    if (!bcaRecord && streetNumber) {
      // Extract the street number and first part of street name
      const addressParts = address.replace(/,.*$/, '').trim()
      const { data } = await supabase
        .from('bca_data')
        .select('*')
        .ilike('civic_address', `${streetNumber}%`)
        .limit(5)

      if (data && data.length > 0) {
        // Find best match by comparing street name digits (e.g. "69a" in "69a Ave")
        const streetDigits = addressParts.match(/\d+[a-zA-Z]?\s+(Ave|St|Rd|Dr|Blvd|Cres|Pl|Ct|Way)/i)
        if (streetDigits) {
          const streetRef = streetDigits[0].toLowerCase()
          bcaRecord = data.find((r: any) =>
            r.civic_address.toLowerCase().includes(streetRef.split(' ')[0])
          ) || data[0]
        } else {
          bcaRecord = data[0]
        }
      }
    }

    // Strategy 3: Broad fuzzy search on street number only
    if (!bcaRecord && streetNumber) {
      const { data } = await supabase
        .from('bca_data')
        .select('*')
        .ilike('civic_address', `${streetNumber} %`)
        .limit(1)
        .maybeSingle()
      bcaRecord = data
    }

    // Log the visit
    await supabase.from('leads').insert({
      address: address,
      postal_code: postalCode || '',
      stage: 'viewed',
      bca_assessed: bcaRecord?.assessed_total || null,
      purchase_year: bcaRecord?.purchase_date
        ? new Date(bcaRecord.purchase_date).getFullYear()
        : null,
      purchase_price: bcaRecord?.purchase_price || null,
      equity_gain: bcaRecord?.equity_gain || null,
    })

    if (!bcaRecord) {
      return NextResponse.json({
        success: true,
        bcaData: null,
        message: 'Address not in database — manual report will be prepared',
      })
    }

    // Build estimate range (±3% around assessed)
    const assessed = Number(bcaRecord.assessed_total)
    const estimateLow  = Math.round(assessed * 0.97 / 1000) * 1000
    const estimateHigh = Math.round(assessed * 1.07 / 1000) * 1000

    return NextResponse.json({
      success: true,
      bcaData: {
        address: bcaRecord.civic_address,
        purchasePrice: bcaRecord.purchase_price,
        purchaseDate: bcaRecord.purchase_date,
        assessedTotal: bcaRecord.assessed_total,
        equityGain: bcaRecord.equity_gain,
        equityMultiple: bcaRecord.equity_multiple,
        bedrooms: bcaRecord.bedrooms,
        yearsOwned: bcaRecord.years_owned,
        estimateLow,
        estimateHigh,
      },
    })
  } catch (error) {
    console.error('Lookup error:', error)
    return NextResponse.json(
      { success: false, error: 'Lookup failed' },
      { status: 500 }
    )
  }
}
