export type Board = number[][]
export type Direction = 'up' | 'down' | 'left' | 'right'

export function emptyBoard(): Board {
  return Array.from({ length: 4 }, () => Array(4).fill(0))
}

export function addRandomTile(board: Board): Board {
  const empties: [number, number][] = []
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (!board[r][c]) empties.push([r, c])
  if (!empties.length) return board
  const [r, c] = empties[Math.floor(Math.random() * empties.length)]
  const next = board.map((row) => [...row])
  next[r][c] = Math.random() < 0.9 ? 2 : 4
  return next
}

function mergeRow(row: number[]): { row: number[]; score: number } {
  const filtered = row.filter((v) => v)
  let score = 0
  const merged: number[] = []
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] === filtered[i + 1]) {
      merged.push(filtered[i] * 2)
      score += filtered[i] * 2
      i++
    } else {
      merged.push(filtered[i])
    }
  }
  while (merged.length < 4) merged.push(0)
  return { row: merged, score }
}

export function move(board: Board, dir: Direction): { board: Board; score: number; moved: boolean } {
  let b = board.map((r) => [...r])
  let totalScore = 0
  let moved = false

  // rotate CW: col c (bottom→top) becomes row c
  const rotate = (b: Board) => b[0].map((_, c) => b.map((r) => r[c]).reverse())
  // rotate CCW: col (3-r) becomes row r
  const rotateCCW = (b: Board) => b[0].map((_, r) => b.map((row) => row[b[0].length - 1 - r]))

  if (dir === 'up') b = rotateCCW(b)
  if (dir === 'down') b = rotate(b)
  if (dir === 'right') b = b.map((r) => [...r].reverse())

  const result = b.map((row) => {
    const { row: newRow, score } = mergeRow(row)
    totalScore += score
    if (JSON.stringify(row) !== JSON.stringify(newRow)) moved = true
    return newRow
  })

  let final = result
  if (dir === 'right') final = result.map((r) => [...r].reverse())
  if (dir === 'up') final = rotate(result)
  if (dir === 'down') final = rotateCCW(result)

  return { board: final, score: totalScore, moved }
}

export function isGameOver(board: Board): boolean {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (!board[r][c]) return false
      if (c < 3 && board[r][c] === board[r][c + 1]) return false
      if (r < 3 && board[r][c] === board[r + 1][c]) return false
    }
  return true
}

export function getBestTile(board: Board): number {
  return Math.max(...board.flat())
}
