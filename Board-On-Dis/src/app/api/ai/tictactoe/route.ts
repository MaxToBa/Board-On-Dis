import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { board } = await request.json() as { board: (null | 'X' | 'O')[] }
    const available = board.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1)
    if (!available.length) return NextResponse.json({ index: -1 })

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: `Tic-Tac-Toe board (0-8): ${JSON.stringify(board)}. You are O. Available: ${JSON.stringify(available)}. Reply with ONLY the index number to play.`
      }]
    })
    const text = (msg.content[0] as { type: string; text: string }).text.trim()
    const index = parseInt(text)
    const move = available.includes(index) ? index : available[Math.floor(Math.random() * available.length)]
    return NextResponse.json({ index: move })
  } catch {
    return NextResponse.json({ index: -1 }, { status: 500 })
  }
}
