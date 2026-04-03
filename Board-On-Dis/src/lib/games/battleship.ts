export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk'
export type Grid = CellState[][]

export interface Ship {
  id: string
  size: number
  positions: [number, number][]
  hits: number
}

export const SHIP_SIZES = [5, 4, 3, 3, 2]

export function emptyGrid(): Grid {
  return Array.from({ length: 10 }, () => Array(10).fill('empty'))
}

export function placeShipOnGrid(grid: Grid, ship: Ship): Grid {
  const g = grid.map((r) => [...r]) as Grid
  for (const [r, c] of ship.positions) g[r][c] = 'ship'
  return g
}

export function fireShot(
  grid: Grid,
  ships: Ship[],
  r: number,
  c: number
): { grid: Grid; ships: Ship[]; result: 'hit' | 'miss' | 'sunk' | 'already' } {
  if (grid[r][c] === 'hit' || grid[r][c] === 'miss' || grid[r][c] === 'sunk') {
    return { grid, ships, result: 'already' }
  }
  const g = grid.map((row) => [...row]) as Grid
  const newShips = ships.map((s) => ({ ...s, positions: s.positions.map(([sr, sc]) => [sr, sc] as [number,number]) }))

  if (g[r][c] === 'ship') {
    g[r][c] = 'hit'
    const ship = newShips.find((s) => s.positions.some(([sr, sc]) => sr === r && sc === c))
    if (ship) {
      ship.hits++
      if (ship.hits >= ship.size) {
        for (const [sr, sc] of ship.positions) g[sr][sc] = 'sunk'
        return { grid: g, ships: newShips, result: 'sunk' }
      }
    }
    return { grid: g, ships: newShips, result: 'hit' }
  }
  g[r][c] = 'miss'
  return { grid: g, ships: newShips, result: 'miss' }
}

export function checkAllSunk(ships: Ship[]): boolean {
  return ships.every((s) => s.hits >= s.size)
}

export function randomPlacement(): Ship[] {
  const grid: boolean[][] = Array.from({ length: 10 }, () => Array(10).fill(false))
  const ships: Ship[] = []

  for (let i = 0; i < SHIP_SIZES.length; i++) {
    const size = SHIP_SIZES[i]
    let placed = false
    let attempts = 0
    while (!placed && attempts < 200) {
      attempts++
      const horiz = Math.random() < 0.5
      const r = Math.floor(Math.random() * (horiz ? 10 : 10 - size + 1))
      const c = Math.floor(Math.random() * (horiz ? 10 - size + 1 : 10))
      const positions: [number, number][] = []
      let ok = true
      for (let j = 0; j < size; j++) {
        const nr = horiz ? r : r + j
        const nc = horiz ? c + j : c
        if (grid[nr][nc]) { ok = false; break }
        positions.push([nr, nc])
      }
      if (ok) {
        for (const [nr, nc] of positions) grid[nr][nc] = true
        ships.push({ id: `ship-${i}`, size, positions, hits: 0 })
        placed = true
      }
    }
  }
  return ships
}
