import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { board, lastMove } = await request.json() as {
      board: (null | 1 | 2)[][]
      lastMove?: [number, number]
    }

    // Find candidates near last move or center
    const candidates: [number, number][] = []
    const radius = 2
    if (lastMove) {
      for (let r = lastMove[0] - radius; r <= lastMove[0] + radius; r++) {
        for (let c = lastMove[1] - radius; c <= lastMove[1] + radius; c++) {
          if (r >= 0 && r < 15 && c >= 0 && c < 15 && !board[r][c]) candidates.push([r, c])
        }
      }
    }
    if (!candidates.length) {
      // near any piece
      for (let r = 0; r < 15; r++)
        for (let c = 0; c < 15; c++)
          if (!board[r][c]) candidates.push([r, c])
    }

    const sample = candidates.slice(0, 20)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{
        role: 'user',
        content: `Gomoku 15x15. You are player 2. Last move: ${JSON.stringify(lastMove)}. Candidate moves: ${JSON.stringify(sample)}. Reply with ONLY [row,col] JSON array.`
      }]
    })
    const text = (msg.content[0] as { type: string; text: string }).text.trim()
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && parsed.length === 2) return NextResponse.json({ move: parsed })
    return NextResponse.json({ move: sample[0] ?? [7, 7] })
  } catch {
    return NextResponse.json({ move: [7, 7] })
  }
}
