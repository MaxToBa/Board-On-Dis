import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { board } = await request.json() as { board: (null | 1 | 2)[][] }
    const available = Array.from({ length: 7 }, (_, i) => i).filter((c) => board[0][c] === null)
    if (!available.length) return NextResponse.json({ col: -1 })

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{
        role: 'user',
        content: `Connect Four (6 rows, 7 cols). Board: ${JSON.stringify(board)}. You are player 2. Available cols: ${JSON.stringify(available)}. Reply with ONLY the column number.`
      }]
    })
    const text = (msg.content[0] as { type: string; text: string }).text.trim()
    const col = parseInt(text)
    return NextResponse.json({ col: available.includes(col) ? col : available[Math.floor(Math.random() * available.length)] })
  } catch {
    return NextResponse.json({ col: 3 })
  }
}
