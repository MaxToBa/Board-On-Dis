import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getValidMoves, applyMove, checkWinner } from '@/lib/games/checkers'
import type { Board } from '@/lib/games/checkers'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function evaluateBoard(board: Board): number {
  let score = 0
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p) continue
      const base = p.king ? 3 : 1
      // AI is player 2 (positive), player 1 is negative
      if (p.player === 2) {
        score += base
        // Bonus for advancing (rows 4-7 for player 2)
        score += r * 0.1
        // Bonus for edge safety (less likely to get captured)
        if (c === 0 || c === 7) score += 0.2
      } else {
        score -= base
        score -= (7 - r) * 0.1
        if (c === 0 || c === 7) score -= 0.2
      }
    }
  }
  return score
}

function minimax(board: Board, depth: number, alpha: number, beta: number, isMax: boolean): number {
  const winner = checkWinner(board)
  if (winner === 2) return 1000 + depth
  if (winner === 1) return -1000 - depth

  const player: 1 | 2 = isMax ? 2 : 1
  const moves = getValidMoves(board, player)
  if (!moves.length || depth === 0) return evaluateBoard(board)

  if (isMax) {
    let best = -Infinity
    for (const mv of moves) {
      const nb = applyMove(board, mv)
      best = Math.max(best, minimax(nb, depth - 1, alpha, beta, false))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  } else {
    let best = Infinity
    for (const mv of moves) {
      const nb = applyMove(board, mv)
      best = Math.min(best, minimax(nb, depth - 1, alpha, beta, true))
      beta = Math.min(beta, best)
      if (alpha >= beta) break
    }
    return best
  }
}

function getBestMoveHard(board: Board): number {
  const moves = getValidMoves(board, 2)
  if (!moves.length) return -1
  if (moves.length === 1) return 0

  // Always take captures if available
  const captures = moves.filter(m => m.captures.length > 0)
  if (captures.length > 0) {
    // Pick best capture using minimax
    let bestScore = -Infinity, bestIdx = 0
    captures.forEach((mv, i) => {
      const nb = applyMove(board, mv)
      const score = minimax(nb, 4, -Infinity, Infinity, false)
      if (score > bestScore) { bestScore = score; bestIdx = i }
    })
    return moves.indexOf(captures[bestIdx])
  }

  let bestScore = -Infinity, bestIdx = 0
  moves.forEach((mv, i) => {
    const nb = applyMove(board, mv)
    const score = minimax(nb, 5, -Infinity, Infinity, false)
    if (score > bestScore) { bestScore = score; bestIdx = i }
  })
  return bestIdx
}

export async function POST(request: Request) {
  try {
    const { board, difficulty = 'medium' } = await request.json() as { board: Board; difficulty?: string }
    const moves = getValidMoves(board, 2)
    if (!moves.length) return NextResponse.json({ moveIndex: -1 })
    if (moves.length === 1) return NextResponse.json({ moveIndex: 0 })

    if (difficulty === 'easy') {
      return NextResponse.json({ moveIndex: Math.floor(Math.random() * moves.length) })
    }

    if (difficulty === 'hard') {
      return NextResponse.json({ moveIndex: getBestMoveHard(board) })
    }

    // medium: Claude AI
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{
        role: 'user',
        content: `Checkers. You are player 2. Available moves (index: from->to): ${moves.map((m, i) => `${i}: [${m.from}]->[${m.to}]`).join(', ')}. Reply with ONLY the move index number.`
      }]
    })
    const text = (msg.content[0] as { type: string; text: string }).text.trim()
    const idx = parseInt(text)
    return NextResponse.json({ moveIndex: idx >= 0 && idx < moves.length ? idx : 0 })
  } catch {
    return NextResponse.json({ moveIndex: 0 })
  }
}
