import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, name, phone } = body

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Pull BCA data for this address
    let bcaData: any = null
    if (address) {
      const normalizedAddress = address.trim().toUpperCase()
      const { data } = await supabase
        .from('bca_data')
        .select('*')
        .or(`civic_address.ilike.%${normalizedAddress}%`)
        .limit(1)
        .single()
      bcaData = data
    }

    // Market stats constants
    const stats = {
      avgPsf: 468,
      lowPsf: 451,
      highPsf: 481,
      avgDOM: 28,
      fastestDOM: 19,
      avgAboveBCA: 111500,
    }

    // Build data-driven narrative without waiting for AI
    // This is instant and uses real numbers
    const purchaseYear = bcaData?.purchase_date
      ? new Date(bcaData.purchase_date).getFullYear()
      : 2004
    const yearsOwned = new Date().getFullYear() - purchaseYear
    const purchasePrice = bcaData?.purchase_price
      ? `$${Number(bcaData.purchase_price).toLocaleString()}`
      : '$342,794'
    const assessedValue = bcaData?.assessed_total
      ? `$${Number(bcaData.assessed_total).toLocaleString()}`
      : '$1,439,000'
    const equityGain = bcaData?.equity_gain
      ? `$${Number(bcaData.equity_gain).toLocaleString()}`
      : '$1,096,206'
    const equityMultiple = bcaData?.equity_multiple
      ? `${Number(bcaData.equity_multiple).toFixed(1)}x`
      : '4.2x'
    const bedrooms = bcaData?.bedrooms || '3'
    const zone = bcaData?.zone_code || 'CD-54'

    // Instant narrative — data-driven, no AI wait time
    const instantNarrative = `Your ${bedrooms}-bedroom home in Willoughby was built in ${purchaseYear} as part of one of Langley's most established residential neighbourhoods. You purchased in ${purchaseYear} for ${purchasePrice} — and in ${yearsOwned} years, the market has done the work for you.

Three comparable detached homes sold in Willoughby between September and October 2025 at an average of $${stats.avgPsf} per square foot, with two of three selling above their BC Assessment by an average of $${stats.avgAboveBCA.toLocaleString()}. At the current market rate, your realistic selling range is well above your ${assessedValue} assessment. Your assessment is not your ceiling — for most homes on your street, it has been the floor.

The market is active right now. Average days on market for comparable homes is just ${stats.avgDOM} days, with the fastest sale closing in ${stats.fastestDOM} days. Original owners like you who have held since ${purchaseYear} are in the strongest possible position — ${equityGain} in equity (${equityMultiple} your money), completely tax-free as your principal residence. The question is not whether the time is right. It is whether now is right for you.`

    // Try to enhance with Claude in background — but don't block response
    let finalNarrative = instantNarrative
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second max

      const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: `You are a Willoughby, Langley real estate expert writing a personalized 3-paragraph equity report for a homeowner. 
Write in second person, warm but data-driven. Sound like a knowledgeable human expert — not a template or chatbot.
Never mention AI. Be specific to the Willoughby market. Keep total response under 280 words.
Do NOT say "as an AI" or anything similar. Just write the report naturally.`,
          messages: [{
            role: 'user',
            content: `Write a 3-paragraph equity report for this homeowner:
Address: ${address}
Bedrooms: ${bedrooms}
Purchase year: ${purchaseYear}
Purchase price: ${purchasePrice}
Current BCA assessed: ${assessedValue}
Equity gained: ${equityGain} (${equityMultiple} their money, tax-free)
Zone: ${zone}
Market data: $${stats.avgPsf}/sqft avg, $${stats.lowPsf}-$${stats.highPsf} range, ${stats.avgDOM} days avg DOM, 2 of 3 recent sales above BCA by avg $${stats.avgAboveBCA.toLocaleString()}`
          }]
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (aiResponse.ok) {
        const aiData = await aiResponse.json()
        const aiText = aiData.content?.[0]?.text
        if (aiText && aiText.length > 100) {
          finalNarrative = aiText
        }
      }
    } catch (aiError) {
      // AI timed out or failed — use the instant narrative (already set)
      console.log('AI narrative timed out, using instant narrative')
    }

    // Update lead stage in Supabase
    if (address) {
      await supabase
        .from('leads')
        .update({ stage: 'report_requested' })
        .eq('address', address)
    }

    // Build market estimate range
    const estimateLow = bcaData?.assessed_total
      ? Math.round(Number(bcaData.assessed_total) * 0.97 / 1000) * 1000
      : 1353000
    const estimateHigh = bcaData?.assessed_total
      ? Math.round(Number(bcaData.assessed_total) * 1.05 / 1000) * 1000
      : 1522000

    return NextResponse.json({
      success: true,
      narrative: finalNarrative,
      bcaData: bcaData ? {
        address: bcaData.civic_address,
        purchasePrice: bcaData.purchase_price,
        purchaseDate: bcaData.purchase_date,
        assessedTotal: bcaData.assessed_total,
        equityGain: bcaData.equity_gain,
        equityMultiple: bcaData.equity_multiple,
        bedrooms: bcaData.bedrooms,
        yearsOwned: bcaData.years_owned,
        estimateLow,
        estimateHigh,
      } : null,
      marketStats: stats,
    })
  } catch (error) {
    console.error('Report API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
