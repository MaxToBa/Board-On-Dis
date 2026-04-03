import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { grid } = await request.json() as { grid: string[][] }
    // Find untargeted cells
    const available: [number, number][] = []
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        if (grid[r][c] === 'empty' || grid[r][c] === 'ship') available.push([r, c])

    if (!available.length) return NextResponse.json({ row: 0, col: 0 })

    // Prefer cells near hits
    const hitCells = available.filter(() => false) // placeholder
    const hits: [number, number][] = []
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        if (grid[r][c] === 'hit') hits.push([r, c])

    let candidates = available
    if (hits.length) {
      const near = available.filter(([r, c]) =>
        hits.some(([hr, hc]) => Math.abs(r - hr) + Math.abs(c - hc) === 1)
      )
      if (near.length) candidates = near
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)]

    void hitCells // suppress lint
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{
        role: 'user',
        content: `Battleship. Grid hits so far: ${JSON.stringify(hits)}. Candidate cells: ${JSON.stringify(candidates.slice(0, 15))}. Reply with ONLY [row,col] JSON array.`
      }]
    })
    const text = (msg.content[0] as { type: string; text: string }).text.trim()
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed) && parsed.length === 2) return NextResponse.json({ row: parsed[0], col: parsed[1] })
    } catch { /**/ }
    return NextResponse.json({ row: pick[0], col: pick[1] })
  } catch {
    return NextResponse.json({ row: 0, col: 0 })
  }
}
