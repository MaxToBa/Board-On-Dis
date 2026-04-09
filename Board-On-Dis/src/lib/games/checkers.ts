export type Piece = { player: 1 | 2; king: boolean } | null
export type Board = Piece[][]
export type Move = { from: [number,number]; to: [number,number]; captures: [number,number][] }

export function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array(8).fill(null))
}

export function initialBoard(): Board {
  const b = emptyBoard()
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { player: 2, king: false }
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { player: 1, king: false }
  return b
}

function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8 }

export function getValidMoves(board: Board, player: 1 | 2): Move[] {
  const captures: Move[] = []
  const moves: Move[] = []

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p || p.player !== player) continue
      const dirs = p.king
        ? [[-1,-1],[-1,1],[1,-1],[1,1]]
        : player === 1 ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]

      for (const [dr, dc] of dirs) {
        // capture
        const mr = r + dr, mc = c + dc
        const lr = r + dr * 2, lc = c + dc * 2
        if (inBounds(lr, lc) && board[mr]?.[mc]?.player === (player === 1 ? 2 : 1) && !board[lr][lc]) {
          captures.push({ from: [r,c], to: [lr,lc], captures: [[mr,mc]] })
        }
        // simple
        if (inBounds(mr, mc) && !board[mr][mc]) {
          moves.push({ from: [r,c], to: [mr,mc], captures: [] })
        }
      }
    }
  }
  return captures.length > 0 ? captures : moves
}

export function applyMove(board: Board, move: Move): Board {
  const b = board.map((r) => r.map((c) => c ? { ...c } : null))
  const [fr, fc] = move.from
  const [tr, tc] = move.to
  const piece = b[fr][fc]!
  b[tr][tc] = piece
  b[fr][fc] = null
  for (const [cr, cc] of move.captures) b[cr][cc] = null
  if ((piece.player === 1 && tr === 0) || (piece.player === 2 && tr === 7)) piece.king = true
  return b
}

export function checkWinner(board: Board): 1 | 2 | null {
  const p1 = board.flat().filter((c) => c?.player === 1).length
  const p2 = board.flat().filter((c) => c?.player === 2).length
  if (p1 === 0) return 2
  if (p2 === 0) return 1
  return null
}

export function getChainJumps(board: Board, from: [number, number], player: 1 | 2): Move[] {
  const [r, c] = from
  const p = board[r][c]
  if (!p) return []
  const dirs = p.king
    ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : player === 1 ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]
  const jumps: Move[] = []
  for (const [dr, dc] of dirs) {
    const mr = r + dr, mc = c + dc
    const lr = r + dr * 2, lc = c + dc * 2
    if (inBounds(lr, lc) && board[mr]?.[mc]?.player === (player === 1 ? 2 : 1) && !board[lr][lc]) {
      jumps.push({ from: [r, c], to: [lr, lc], captures: [[mr, mc]] })
    }
  }
  return jumps
}
