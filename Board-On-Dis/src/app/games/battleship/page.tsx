'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import PlayerCard from '@/components/game/PlayerCard'
import RoomCode from '@/components/game/RoomCode'
import CoinFlip from '@/components/game/CoinFlip'
import ChatBox from '@/components/game/ChatBox'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { useGameRoom } from '@/hooks/useGameRoom'
import { emptyGrid, fireShot, checkAllSunk, randomPlacement } from '@/lib/games/battleship'
import { sound } from '@/lib/sound'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { Grid, Ship } from '@/lib/games/battleship'

const COL_LABELS = ['A','B','C','D','E','F','G','H','I','J']

function BattleGrid({
  grid,
  ships,
  isEnemy,
  canFire,
  onFire,
}: {
  grid: Grid
  ships: Ship[]
  isEnemy: boolean
  canFire: boolean
  onFire?: (r: number, c: number) => void
}) {
  const getCellStyle = (cell: string, r: number, c: number) => {
    const isShipCell = !isEnemy && ships.some(s => s.positions.some(([sr, sc]) => sr === r && sc === c))
    if (cell === 'sunk') return 'bg-red/70 border-red/80 cursor-default'
    if (cell === 'hit') return 'bg-orange-500/60 border-orange-400/70 cursor-default'
    if (cell === 'miss') return 'bg-blue-900/50 border-blue-700/40 cursor-default'
    if (isShipCell) return 'bg-surface border-white/25 cursor-default'
    if (isEnemy && canFire) return 'bg-surface2 border-white/10 hover:bg-purple/30 hover:border-purple/40 cursor-crosshair'
    return 'bg-surface2 border-white/10 cursor-default'
  }

  return (
    <div className="select-none">
      {/* Column labels */}
      <div className="flex ml-6 mb-1">
        {COL_LABELS.map(l => (
          <div key={l} className="w-7 h-4 flex items-center justify-center text-[9px] text-muted font-bold">
            {l}
          </div>
        ))}
      </div>
      <div className="flex">
        {/* Row labels */}
        <div className="flex flex-col mr-1">
          {Array.from({length: 10}, (_, i) => (
            <div key={i} className="w-5 h-7 flex items-center justify-center text-[9px] text-muted font-bold">
              {i + 1}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(10, 1.75rem)' }}>
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const display = isEnemy && cell === 'ship' ? 'empty' : cell
              const isShipCell = !isEnemy && ships.some(s => s.positions.some(([sr, sc]) => sr === r && sc === c))
              return (
                <motion.div
                  key={`${r}-${c}`}
                  onClick={() => display !== 'hit' && display !== 'miss' && display !== 'sunk' && onFire?.(r, c)}
                  whileHover={isEnemy && canFire && display !== 'hit' && display !== 'miss' && display !== 'sunk' ? { scale: 1.15 } : {}}
                  className={`w-7 h-7 rounded-sm border transition-colors flex items-center justify-center relative ${getCellStyle(display, r, c)}`}
                >
                  {cell === 'hit' && <span className="text-[10px] font-black text-orange-300">✕</span>}
                  {cell === 'sunk' && <span className="text-[10px] font-black text-red-300">💥</span>}
                  {cell === 'miss' && <span className="text-[11px] text-blue-400/80">·</span>}
                  {isShipCell && cell === 'ship' && <div className="w-3 h-3 rounded-sm bg-accent/60" />}
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function BattleshipPage() {
  const { playerName, avatarUrl, isAuthenticated, roomId, mode } = usePlayerInfo()
  const { user } = useAuthStore()
  const [myGrid, setMyGrid] = useState<Grid>(emptyGrid())
  const [myShips, setMyShips] = useState<Ship[]>([])
  const [enemyGrid, setEnemyGrid] = useState<Grid>(emptyGrid())
  const [enemyShips, setEnemyShips] = useState<Ship[]>([])
  const [myTurn, setMyTurn] = useState(true)
  const [winner, setWinner] = useState<'me' | 'enemy' | null>(null)
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [phase, setPhase] = useState<'place' | 'battle'>('place')
  const [opponentName] = useState('รอผู้เล่น...')
  const [aiThinking, setAiThinking] = useState(false)

  const { updateRoomState } = useGameRoom({
    roomId,
    onStateChange: useCallback((state: Record<string, unknown>) => {
      if (state.enemyFire) {
        const { row, col } = state.enemyFire as { row: number; col: number }
        handleIncomingFire(row, col)
      }
      if (state.started) { setPhase('battle') }
    }, [myGrid, myShips]), // eslint-disable-line react-hooks/exhaustive-deps
  })

  useEffect(() => {
    const ships = randomPlacement()
    const grid = emptyGrid()
    ships.forEach((s) => s.positions.forEach(([r, c]) => { grid[r][c] = 'ship' }))
    setMyShips(ships)
    setMyGrid(grid)

    const enemySh = randomPlacement()
    const enemyG = emptyGrid()
    enemySh.forEach((s) => s.positions.forEach(([r, c]) => { enemyG[r][c] = 'ship' }))
    setEnemyShips(enemySh)
    setEnemyGrid(enemyG)

    if (mode === 'ai') {
      setTimeout(() => {
        setCoinWinner(Math.random() < 0.5 ? playerName : 'AI')
        setPhase('battle')
      }, 300)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // AI takes shot
  useEffect(() => {
    if (mode !== 'ai' || myTurn || winner || phase !== 'battle') return
    setAiThinking(true)
    setTimeout(() => {
      fetch('/api/ai/battleship', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid: myGrid }),
      })
        .then((r) => r.json())
        .then(({ row, col }: { row: number; col: number }) => handleIncomingFire(row, col))
        .catch(() => {
          const available: [number,number][] = []
          for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++)
            if (myGrid[r][c] === 'empty' || myGrid[r][c] === 'ship') available.push([r, c])
          if (available.length) { const [r,c] = available[Math.floor(Math.random()*available.length)]; handleIncomingFire(r,c) }
        })
        .finally(() => setAiThinking(false))
    }, 800)
  }, [myTurn, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleIncomingFire(row: number, col: number) {
    const { grid, ships, result } = fireShot(myGrid, myShips, row, col)
    if (result === 'already') return
    setMyGrid(grid)
    setMyShips(ships)
    if (result === 'hit' || result === 'sunk') sound.hit()
    else sound.miss()
    if (checkAllSunk(ships)) {
      setWinner('enemy'); sound.lose(); saveResult('loss')
    } else {
      setMyTurn(true)
    }
  }

  function handleMyFire(row: number, col: number) {
    if (!myTurn || winner || phase !== 'battle') return
    if (enemyGrid[row][col] === 'hit' || enemyGrid[row][col] === 'miss' || enemyGrid[row][col] === 'sunk') return

    const { grid, ships, result } = fireShot(enemyGrid, enemyShips, row, col)
    if (result === 'already') return
    setEnemyGrid(grid)
    setEnemyShips(ships)
    if (result === 'hit' || result === 'sunk') sound.hit()
    else sound.miss()

    if (checkAllSunk(ships)) {
      setWinner('me'); sound.win(); saveResult('win')
    } else {
      setMyTurn(false)
      if (roomId) updateRoomState({ enemyFire: { row, col } })
    }
  }

  async function saveResult(result: 'win' | 'loss') {
    if (!isAuthenticated || !user) return
    await supabase.from('game_results').insert({
      user_id: user.id, player_name: playerName, game: 'battleship',
      result, opponent: mode === 'ai' ? 'AI' : opponentName, score: 0, best_tile: 0, time_played: 0,
    })
  }

  const getStatus = () => {
    if (winner) return winner === 'me' ? '🎉 คุณชนะ!' : '💀 แพ้แล้ว...'
    if (aiThinking) return '🤖 AI กำลังยิง...'
    if (phase === 'battle') return myTurn ? '🎯 ตาของคุณ — เลือกยิง' : '⏳ รอผู้เล่นอีกฝั่ง'
    return '⚓ จัดเรือแล้ว กำลังรอเริ่ม...'
  }

  const getStatusColor = () => {
    if (winner) return winner === 'me' ? 'green' : 'red'
    if (myTurn && phase === 'battle') return 'accent'
    return 'default'
  }

  const opponent = mode === 'ai' ? 'AI (Claude)' : opponentName

  // Ship status summary
  const myShipsSunk = myShips.filter(s => s.positions.every(([r,c]) => myGrid[r][c] === 'sunk' || myGrid[r][c] === 'hit')).length
  const enemyShipsSunk = enemyShips.filter(s => s.positions.every(([r,c]) => enemyGrid[r][c] === 'sunk' || enemyGrid[r][c] === 'hit')).length

  return (
    <GameLayout
      title="Battle Ship"
      status={getStatus()}
      statusColor={getStatusColor()}
      topLeft={<PlayerCard name={playerName} avatar={avatarUrl} label="กองเรือของคุณ" active={!myTurn && !winner} />}
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard name={opponent} label="กองเรือศัตรู" active={myTurn && !winner} flip />
          {roomId && <RoomCode code={roomId} />}
        </div>
      }
    >
      {/* Ship counters */}
      <div className="flex gap-6 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-white/10 rounded-xl px-4 py-2">
          <span className="text-xs text-muted">เรือของคุณ</span>
          <span className="text-sm font-bold text-white">{myShips.length - myShipsSunk}</span>
          <span className="text-xs text-muted">/ {myShips.length}</span>
        </div>
        <div className="flex items-center gap-2 bg-surface border border-white/10 rounded-xl px-4 py-2">
          <span className="text-xs text-muted">เรือศัตรู</span>
          <span className="text-sm font-bold text-accent">{enemyShips.length - enemyShipsSunk}</span>
          <span className="text-xs text-muted">/ {enemyShips.length}</span>
        </div>
      </div>

      <div className="flex gap-8 flex-wrap justify-center items-start">
        {/* My grid */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            ⚓ กองเรือของคุณ
          </p>
          <BattleGrid
            grid={myGrid}
            ships={myShips}
            isEnemy={false}
            canFire={false}
          />
          {/* Legend */}
          <div className="flex gap-3 text-[9px] text-muted mt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent/60 inline-block" />เรือ</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500/60 inline-block" />โดนยิง</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-900/50 inline-block" />พลาด</span>
          </div>
        </div>

        {/* Enemy grid */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            🎯 กองเรือศัตรู
          </p>
          <BattleGrid
            grid={enemyGrid}
            ships={enemyShips}
            isEnemy={true}
            canFire={myTurn && !winner && phase === 'battle'}
            onFire={handleMyFire}
          />
          {myTurn && !winner && phase === 'battle' && (
            <p className="text-[10px] text-accent animate-pulse mt-1">คลิกที่ช่องเพื่อยิง</p>
          )}
        </div>
      </div>

      {winner && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          className="mt-6 flex flex-col items-center gap-3"
        >
          <p className="text-2xl font-display">{winner === 'me' ? '🏆 ชนะแล้ว!' : '💀 แพ้แล้ว...'}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-accent text-bg px-8 py-2.5 rounded-full font-bold text-sm hover:brightness-110"
          >
            เล่นอีกครั้ง
          </button>
        </motion.div>
      )}

      <CoinFlip winner={coinWinner} onDone={() => setCoinWinner(null)} />
      {roomId && <ChatBox roomId={roomId} playerName={playerName} />}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><BattleshipPage /></Suspense>
}
