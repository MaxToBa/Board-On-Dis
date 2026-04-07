import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ROWS = 6, COLS = 7

function dropPieceLocal(board: (null | 1 | 2)[][], col: number, player: 1 | 2): (null | 1 | 2)[][] | null {
  const b = board.map(r => [...r]) as (null | 1 | 2)[][]
  for (let r = ROWS - 1; r >= 0; r--) {
    if (b[r][col] === null) { b[r][col] = player; return b }
  }
  return null
}

function checkWinLocal(board: (null | 1 | 2)[][], player: 1 | 2): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue
      // horizontal
      if (c + 3 < COLS && board[r][c+1] === player && board[r][c+2] === player && board[r][c+3] === player) return true
      // vertical
      if (r + 3 < ROWS && board[r+1][c] === player && board[r+2][c] === player && board[r+3][c] === player) return true
      // diag down-right
      if (r + 3 < ROWS && c + 3 < COLS && board[r+1][c+1] === player && board[r+2][c+2] === player && board[r+3][c+3] === player) return true
      // diag down-left
      if (r + 3 < ROWS && c - 3 >= 0 && board[r+1][c-1] === player && board[r+2][c-2] === player && board[r+3][c-3] === player) return true
    }
  }
  return false
}

function scoreWindow(window: (null | 1 | 2)[], player: 1 | 2): number {
  const opp = player === 2 ? 1 : 2
  const p = window.filter(c => c === player).length
  const o = window.filter(c => c === opp).length
  const e = window.filter(c => c === null).length
  if (p === 4) return 100
  if (p === 3 && e === 1) return 5
  if (p === 2 && e === 2) return 2
  if (o === 3 && e === 1) return -80
  if (o === 2 && e === 2) return -3
  return 0
}

function scoreBoard(board: (null | 1 | 2)[][], player: 1 | 2): number {
  let score = 0
  const centerCol = board.map(r => r[3])
  score += centerCol.filter(c => c === player).length * 3

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreWindow([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]], player)
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      score += scoreWindow([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]], player)
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], player)
      score += scoreWindow([board[r][c+3], board[r+1][c+2], board[r+2][c+1], board[r+3][c]], player)
    }
  }
  return score
}

function getAvailableLocal(board: (null | 1 | 2)[][]): number[] {
  return Array.from({ length: COLS }, (_, i) => i).filter(c => board[0][c] === null)
}

function minimax(board: (null | 1 | 2)[][], depth: number, alpha: number, beta: number, isMax: boolean): [number, number] {
  const avail = getAvailableLocal(board)
  const p2win = checkWinLocal(board, 2)
  const p1win = checkWinLocal(board, 1)
  if (p2win) return [100000 + depth, -1]
  if (p1win) return [-100000 - depth, -1]
  if (!avail.length || depth === 0) return [scoreBoard(board, 2), -1]

  // Center column preference
  const ordered = [3, 2, 4, 1, 5, 0, 6].filter(c => avail.includes(c))

  if (isMax) {
    let best = -Infinity, bestCol = ordered[0]
    for (const col of ordered) {
      const nb = dropPieceLocal(board, col, 2)
      if (!nb) continue
      const [score] = minimax(nb, depth - 1, alpha, beta, false)
      if (score > best) { best = score; bestCol = col }
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return [best, bestCol]
  } else {
    let best = Infinity, bestCol = ordered[0]
    for (const col of ordered) {
      const nb = dropPieceLocal(board, col, 1)
      if (!nb) continue
      const [score] = minimax(nb, depth - 1, alpha, beta, true)
      if (score < best) { best = score; bestCol = col }
      beta = Math.min(beta, best)
      if (alpha >= beta) break
    }
    return [best, bestCol]
  }
}

export async function POST(request: Request) {
  try {
    const { board, difficulty = 'medium' } = await request.json() as { board: (null | 1 | 2)[][]; difficulty?: string }
    const available = Array.from({ length: COLS }, (_, i) => i).filter(c => board[0][c] === null)
    if (!available.length) return NextResponse.json({ col: -1 })

    if (difficulty === 'easy') {
      return NextResponse.json({ col: available[Math.floor(Math.random() * available.length)] })
    }

    if (difficulty === 'hard') {
      const [, bestCol] = minimax(board, 7, -Infinity, Infinity, true)
      return NextResponse.json({ col: available.includes(bestCol) ? bestCol : available[Math.floor(Math.random() * available.length)] })
    }

    // medium: Claude AI
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
