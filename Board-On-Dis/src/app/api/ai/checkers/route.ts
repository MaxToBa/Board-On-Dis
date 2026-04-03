import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getValidMoves } from '@/lib/games/checkers'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { board } = await request.json()
    const moves = getValidMoves(board, 2)
    if (!moves.length) return NextResponse.json({ moveIndex: -1 })
    if (moves.length === 1) return NextResponse.json({ moveIndex: 0 })

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{
        role: 'user',
        content: `Checkers. You are player 2. Available moves (index: from->to): ${moves.map((m, i) => `${i}: ${m.from}->${m.to}`).join(', ')}. Reply with ONLY the move index number.`
      }]
    })
    const text = (msg.content[0] as { type: string; text: string }).text.trim()
    const idx = parseInt(text)
    return NextResponse.json({ moveIndex: idx >= 0 && idx < moves.length ? idx : 0 })
  } catch {
    return NextResponse.json({ moveIndex: 0 })
  }
}
