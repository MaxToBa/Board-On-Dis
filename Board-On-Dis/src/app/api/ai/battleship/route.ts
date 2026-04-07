import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Probability density map — counts how many ways a ship of each size can cover each cell
function buildProbabilityMap(grid: string[][], shipSizes: number[]): number[][] {
  const prob = Array.from({ length: 10 }, () => Array(10).fill(0))

  for (const size of shipSizes) {
    // Horizontal placements
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c <= 10 - size; c++) {
        const cells = Array.from({ length: size }, (_, k) => [r, c + k])
        const canPlace = cells.every(([cr, cc]) => grid[cr][cc] === 'empty' || grid[cr][cc] === 'ship')
        if (canPlace) cells.forEach(([cr, cc]) => prob[cr][cc]++)
      }
    }
    // Vertical placements
    for (let c = 0; c < 10; c++) {
      for (let r = 0; r <= 10 - size; r++) {
        const cells = Array.from({ length: size }, (_, k) => [r + k, c])
        const canPlace = cells.every(([cr, cc]) => grid[cr][cc] === 'empty' || grid[cr][cc] === 'ship')
        if (canPlace) cells.forEach(([cr, cc]) => prob[cr][cc]++)
      }
    }
  }

  // Zero out already-fired cells
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (grid[r][c] !== 'empty' && grid[r][c] !== 'ship') prob[r][c] = 0
    }
  }
  return prob
}

function getHits(grid: string[][]): [number, number][] {
  const hits: [number, number][] = []
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      if (grid[r][c] === 'hit') hits.push([r, c])
  return hits
}

function getBestMoveHard(grid: string[][]): [number, number] {
  const hits = getHits(grid)

  // Target mode: if there are hits, finish the ship
  if (hits.length > 0) {
    // Find adjacent cells to hits that are untargeted
    const candidates: [number, number][] = []
    for (const [hr, hc] of hits) {
      const adj: [number, number][] = [[hr-1,hc],[hr+1,hc],[hr,hc-1],[hr,hc+1]]
      for (const [r, c] of adj) {
        if (r >= 0 && r < 10 && c >= 0 && c < 10 && (grid[r][c] === 'empty' || grid[r][c] === 'ship')) {
          candidates.push([r, c])
        }
      }
    }
    // If multiple hits in line, prefer continuing that line
    if (hits.length >= 2) {
      const drs = hits.map(([r]) => r)
      const dcs = hits.map(([,c]) => c)
      const sameRow = new Set(drs).size === 1
      const sameCol = new Set(dcs).size === 1
      if (sameRow) {
        const r = drs[0]
        const minC = Math.min(...dcs), maxC = Math.max(...dcs)
        const lineAdj: [number, number][] = []
        if (minC - 1 >= 0 && (grid[r][minC-1] === 'empty' || grid[r][minC-1] === 'ship')) lineAdj.push([r, minC - 1])
        if (maxC + 1 < 10 && (grid[r][maxC+1] === 'empty' || grid[r][maxC+1] === 'ship')) lineAdj.push([r, maxC + 1])
        if (lineAdj.length) return lineAdj[Math.floor(Math.random() * lineAdj.length)]
      } else if (sameCol) {
        const c = dcs[0]
        const minR = Math.min(...drs), maxR = Math.max(...drs)
        const lineAdj: [number, number][] = []
        if (minR - 1 >= 0 && (grid[minR-1][c] === 'empty' || grid[minR-1][c] === 'ship')) lineAdj.push([minR - 1, c])
        if (maxR + 1 < 10 && (grid[maxR+1][c] === 'empty' || grid[maxR+1][c] === 'ship')) lineAdj.push([maxR + 1, c])
        if (lineAdj.length) return lineAdj[Math.floor(Math.random() * lineAdj.length)]
      }
    }
    if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)]
  }

  // Hunt mode: use probability density map
  // Typical ship sizes in battleship: [5, 4, 3, 3, 2]
  const prob = buildProbabilityMap(grid, [5, 4, 3, 3, 2])

  // Checkerboard parity optimization: prefer cells that match the parity of remaining smallest ship
  let bestScore = -1, bestMove: [number, number] = [0, 0]
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (prob[r][c] > bestScore) {
        bestScore = prob[r][c]
        bestMove = [r, c]
      }
    }
  }
  return bestMove
}

export async function POST(request: Request) {
  try {
    const { grid, difficulty = 'medium' } = await request.json() as { grid: string[][]; difficulty?: string }

    const available: [number, number][] = []
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        if (grid[r][c] === 'empty' || grid[r][c] === 'ship') available.push([r, c])
    if (!available.length) return NextResponse.json({ row: 0, col: 0 })

    if (difficulty === 'easy') {
      const pick = available[Math.floor(Math.random() * available.length)]
      return NextResponse.json({ row: pick[0], col: pick[1] })
    }

    if (difficulty === 'hard') {
      const [row, col] = getBestMoveHard(grid)
      return NextResponse.json({ row, col })
    }

    // medium: Claude + basic hunt/target
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
