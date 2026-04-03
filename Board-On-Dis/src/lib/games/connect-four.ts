export const ROWS = 6
export const COLS = 7
export type Cell = null | 1 | 2
export type Board = Cell[][]
export type Winner = 1 | 2 | 'draw' | null

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

export function dropPiece(board: Board, col: number, player: 1 | 2): Board | null {
  const next = board.map((r) => [...r])
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!next[r][col]) { next[r][col] = player; return next }
  }
  return null // column full
}

export function checkWinner(board: Board): Winner {
  const DIRS = [[0,1],[1,0],[1,1],[1,-1]]
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p) continue
      for (const [dr, dc] of DIRS) {
        let count = 1
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== p) break
          count++
        }
        if (count === 4) return p
      }
    }
  }
  if (board[0].every((c) => c !== null)) return 'draw'
  return null
}

export function getAvailableCols(board: Board): number[] {
  return Array.from({ length: COLS }, (_, i) => i).filter((c) => board[0][c] === null)
}
