import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const SIZE = 15

// Score a line segment of 5 for a given player
function scoreSegment(seg: (null | 1 | 2)[], player: 1 | 2): number {
  const opp = player === 1 ? 2 : 1
  if (seg.includes(opp)) return 0
  const count = seg.filter(c => c === player).length
  if (count === 5) return 1000000
  if (count === 4) return 10000
  if (count === 3) return 1000
  if (count === 2) return 100
  if (count === 1) return 10
  return 1
}

function evaluateBoard(board: (null | 1 | 2)[][], player: 1 | 2): number {
  const opp = player === 1 ? 2 : 1
  let score = 0

  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (const [dr, dc] of dirs) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const seg: (null | 1 | 2)[] = []
        for (let k = 0; k < 5; k++) {
          const nr = r + dr * k, nc = c + dc * k
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break
          seg.push(board[nr][nc])
        }
        if (seg.length < 5) continue
        score += scoreSegment(seg, player)
        score -= scoreSegment(seg, opp) * 1.1
      }
    }
  }
  return score
}

// Check if a move creates an open-four (4 in a row with open ends) — needs immediate block
function checkImmediate(board: (null | 1 | 2)[][], player: 1 | 2): [number, number] | null {
  const avail: [number, number][] = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!board[r][c]) avail.push([r, c])

  for (const [r, c] of avail) {
    board[r][c] = player
    const wins = checkFiveInRow(board, player)
    board[r][c] = null
    if (wins) return [r, c]
  }
  return null
}

function checkFiveInRow(board: (null | 1 | 2)[][], player: 1 | 2): boolean {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== player) continue
      for (const [dr, dc] of dirs) {
        let count = 1
        for (let k = 1; k < 5; k++) {
          const nr = r + dr * k, nc = c + dc * k
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || board[nr][nc] !== player) break
          count++
        }
        if (count >= 5) return true
      }
    }
  }
  return false
}

function getCandidatesNearPieces(board: (null | 1 | 2)[][], radius = 2): [number, number][] {
  const candidates = new Set<string>()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c]) continue
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const nr = r + dr, nc = c + dc
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !board[nr][nc]) {
            candidates.add(`${nr},${nc}`)
          }
        }
      }
    }
  }
  if (!candidates.size) return [[7, 7]]
  return Array.from(candidates).map(s => s.split(',').map(Number) as [number, number])
}

function getBestMoveHard(board: (null | 1 | 2)[][]): [number, number] {
  // Win immediately
  const winMove = checkImmediate(board, 2)
  if (winMove) return winMove

  // Block opponent from winning
  const blockMove = checkImmediate(board, 1)
  if (blockMove) return blockMove

  // Score all candidates
  const candidates = getCandidatesNearPieces(board, 3)
  let bestScore = -Infinity, bestMove: [number, number] = candidates[0]

  for (const [r, c] of candidates) {
    board[r][c] = 2
    const myScore = evaluateBoard(board, 2)
    board[r][c] = null

    board[r][c] = 1
    const oppScore = evaluateBoard(board, 1)
    board[r][c] = null

    const total = myScore + oppScore * 1.05 // slightly prefer blocking
    if (total > bestScore) { bestScore = total; bestMove = [r, c] }
  }
  return bestMove
}

export async function POST(request: Request) {
  try {
    const { board, lastMove, difficulty = 'medium' } = await request.json() as {
      board: (null | 1 | 2)[][]
      lastMove?: [number, number]
      difficulty?: string
    }

    if (difficulty === 'easy') {
      const candidates: [number, number][] = []
      const radius = 2
      if (lastMove) {
        for (let r = lastMove[0] - radius; r <= lastMove[0] + radius; r++)
          for (let c = lastMove[1] - radius; c <= lastMove[1] + radius; c++)
            if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && !board[r][c]) candidates.push([r, c])
      }
      const pool = candidates.length ? candidates : (() => {
        const all: [number, number][] = []
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!board[r][c]) all.push([r, c])
        return all
      })()
      return NextResponse.json({ move: pool[Math.floor(Math.random() * pool.length)] ?? [7, 7] })
    }

    if (difficulty === 'hard') {
      const b = board.map(r => [...r]) as (null | 1 | 2)[][]
      const move = getBestMoveHard(b)
      return NextResponse.json({ move })
    }

    // medium: Claude AI
    const candidates: [number, number][] = []
    const radius = 2
    if (lastMove) {
      for (let r = lastMove[0] - radius; r <= lastMove[0] + radius; r++)
        for (let c = lastMove[1] - radius; c <= lastMove[1] + radius; c++)
          if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && !board[r][c]) candidates.push([r, c])
    }
    if (!candidates.length) {
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!board[r][c]) candidates.push([r, c])
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
