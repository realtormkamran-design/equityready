import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { address, utmSource } = await req.json()
    if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 })

    // Clean address for matching
    const cleanAddress = address.trim().toUpperCase()
    
    // Try to find in BCA data - match on partial address
    const { data: bcaMatch } = await supabaseAdmin
      .from('bca_data')
      .select('*')
      .ilike('civic_address', `%${cleanAddress.split(' ').slice(0,2).join(' ')}%`)
      .order('priority_score', { ascending: false })
      .limit(1)
      .single()

    // Classify area
    const postalMatch = address.match(/V\d\w/i)
    const postal = postalMatch ? postalMatch[0].toUpperCase() : 'V2Y'
    const areaType = postal.startsWith('V2Y') ? 'willoughby' : 
                     ['V1M','V3A','V4W','V2Z'].some(p => postal.startsWith(p)) ? 'langley' : 'other'

    // Save lead
    const leadData: any = {
      address: address.trim(),
      postal_code: postal,
      area_type: areaType,
      stage: 'viewed',
      utm_source: utmSource || null,
    }

    // If BCA match found, enrich the lead
    if (bcaMatch) {
      leadData.bca_assessed = bcaMatch.assessed_total
      leadData.purchase_price = bcaMatch.purchase_price
      leadData.purchase_date = bcaMatch.purchase_date
      leadData.years_owned = bcaMatch.years_owned
      leadData.equity_gain = bcaMatch.equity_gain
      leadData.equity_multiple = bcaMatch.equity_multiple
    }

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .insert([leadData])
      .select()
      .single()

    return NextResponse.json({ 
      leadId: lead?.id,
      found: !!bcaMatch,
      areaType,
      bca: bcaMatch ? {
        assessed: bcaMatch.assessed_total,
        purchasePrice: bcaMatch.purchase_price,
        purchaseDate: bcaMatch.purchase_date,
        yearsOwned: bcaMatch.years_owned,
        equityGain: bcaMatch.equity_gain,
        equityMultiple: bcaMatch.equity_multiple,
        bedrooms: bcaMatch.bedrooms,
        stories: bcaMatch.stories,
        zone: bcaMatch.zone_code,
        landUse: bcaMatch.actual_land_use,
        planNumber: bcaMatch.plan_number,
      } : null
    })
  } catch (err) {
    console.error('Lookup error:', err)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
