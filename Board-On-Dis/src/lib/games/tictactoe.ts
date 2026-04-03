export type Board = (null | 'X' | 'O')[]
export type Winner = 'X' | 'O' | 'draw' | null

const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
]

export function checkWinner(board: Board): Winner {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as 'X' | 'O'
    }
  }
  if (board.every((c) => c !== null)) return 'draw'
  return null
}

export function getAvailableMoves(board: Board): number[] {
  return board.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1)
}

export function getWinLine(board: Board): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line
  }
  return null
}
