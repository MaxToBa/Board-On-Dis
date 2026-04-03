export type Board = (null | 1 | 2)[][]
export type Winner = 1 | 2 | null

const DIRS = [[0,1],[1,0],[1,1],[1,-1]]

function count(board: Board, r: number, c: number, dr: number, dc: number, player: 1|2): number {
  let n = 0
  let row = r + dr, col = c + dc
  while (row >= 0 && row < 15 && col >= 0 && col < 15 && board[row][col] === player) {
    n++; row += dr; col += dc
  }
  return n
}

export function checkWinner(board: Board): Winner {
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const p = board[r][c]
      if (!p) continue
      for (const [dr, dc] of DIRS) {
        const total = 1 + count(board, r, c, dr, dc, p) + count(board, r, c, -dr, -dc, p)
        if (total >= 5) return p
      }
    }
  }
  return null
}

export function emptyBoard(): Board {
  return Array.from({ length: 15 }, () => Array(15).fill(null))
}

export function getAvailableMoves(board: Board): [number, number][] {
  const moves: [number, number][] = []
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (!board[r][c]) moves.push([r, c])
    }
  }
  return moves
}
