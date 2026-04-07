import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Cell = null | 'X' | 'O'

function checkWinnerLocal(board: Cell[]): 'X' | 'O' | null {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a] as 'X' | 'O'
  }
  return null
}

function minimax(board: Cell[], isMaximizing: boolean, depth: number): number {
  const winner = checkWinnerLocal(board)
  if (winner === 'O') return 10 - depth
  if (winner === 'X') return depth - 10
  const avail = board.map((v, i) => v === null ? i : -1).filter(i => i !== -1)
  if (!avail.length) return 0
  if (isMaximizing) {
    let best = -Infinity
    for (const i of avail) {
      board[i] = 'O'
      best = Math.max(best, minimax(board, false, depth + 1))
      board[i] = null
    }
    return best
  } else {
    let best = Infinity
    for (const i of avail) {
      board[i] = 'X'
      best = Math.min(best, minimax(board, true, depth + 1))
      board[i] = null
    }
    return best
  }
}

function getBestMoveHard(board: Cell[]): number {
  const avail = board.map((v, i) => v === null ? i : -1).filter(i => i !== -1)
  let bestScore = -Infinity, bestMove = avail[0]
  const b = [...board]
  for (const i of avail) {
    b[i] = 'O'
    const score = minimax(b, false, 0)
    b[i] = null
    if (score > bestScore) { bestScore = score; bestMove = i }
  }
  return bestMove
}

export async function POST(request: Request) {
  try {
    const { board, difficulty = 'medium' } = await request.json() as { board: Cell[]; difficulty?: string }
    const available = board.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1)
    if (!available.length) return NextResponse.json({ index: -1 })

    if (difficulty === 'easy') {
      return NextResponse.json({ index: available[Math.floor(Math.random() * available.length)] })
    }
    if (difficulty === 'hard') {
      return NextResponse.json({ index: getBestMoveHard([...board]) })
    }

    // medium: Claude AI
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
    return NextResponse.json({ index: available.includes(index) ? index : available[Math.floor(Math.random() * available.length)] })
  } catch {
    return NextResponse.json({ index: -1 }, { status: 500 })
  }
}
