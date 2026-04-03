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

function BattleshipPage() {
  const { playerName, avatarUrl, isAuthenticated, roomId, mode, isHost } = usePlayerInfo()
  const { user } = useAuthStore()
  const [myGrid, setMyGrid] = useState<Grid>(emptyGrid())
  const [myShips, setMyShips] = useState<Ship[]>([])
  const [enemyGrid, setEnemyGrid] = useState<Grid>(emptyGrid())
  const [enemyShips, setEnemyShips] = useState<Ship[]>([])
  const [myTurn, setMyTurn] = useState(true)
  const [winner, setWinner] = useState<'me' | 'enemy' | null>(null)
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [phase, setPhase] = useState<'place' | 'battle'>('place')
  const [opponentName, setOpponentName] = useState('รอผู้เล่น...')
  const [aiThinking, setAiThinking] = useState(false)

  const { updateRoomState } = useGameRoom({
    roomId,
    onStateChange: useCallback((state: Record<string, unknown>) => {
      if (state.enemyFire) {
        const { row, col } = state.enemyFire as { row: number; col: number }
        handleIncomingFire(row, col)
      }
      if (state.started) { setGameStarted(true); setPhase('battle') }
    }, [myGrid, myShips]), // eslint-disable-line react-hooks/exhaustive-deps
  })

  useEffect(() => {
    // Auto-place ships
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
      setTimeout(() => { setCoinWinner(Math.random() < 0.5 ? playerName : 'AI'); setGameStarted(true); setPhase('battle') }, 300)
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
        .finally(() => { setAiThinking(false) })
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

  const cellColor: Record<string, string> = {
    empty: 'bg-surface2 hover:bg-surface border border-white/10',
    ship: 'bg-surface2 border border-white/10',
    hit: 'bg-red/30 border border-red/40',
    miss: 'bg-blue-900/30 border border-blue-900/40',
    sunk: 'bg-red/60 border border-red/60',
  }

  const opponent = mode === 'ai' ? 'AI (Claude)' : opponentName

  return (
    <GameLayout
      title="Battle Ship"
      status={winner ? (winner === 'me' ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...') : aiThinking ? 'AI กำลังยิง...' : myTurn ? 'ตาของคุณ — เลือกยิง' : 'รอผู้เล่นอีกฝั่ง'}
      statusColor={winner ? (winner === 'me' ? 'green' : 'red') : myTurn ? 'accent' : 'default'}
      topLeft={<PlayerCard name={playerName} avatar={avatarUrl} label="กองเรือของคุณ" active={!myTurn && !winner} />}
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard name={opponent} label="กองเรือศัตรู" active={myTurn && !winner} flip />
          {roomId && <RoomCode code={roomId} />}
        </div>
      }
    >
      <div className="flex gap-6 flex-wrap justify-center">
        {/* My grid */}
        <div>
          <p className="text-xs text-muted mb-2 text-center font-bold uppercase tracking-widest">กองเรือของคุณ</p>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(10, 1.75rem)' }}>
            {myGrid.flat().map((cell, i) => (
              <div key={i} className={`w-7 h-7 rounded-sm transition-colors ${cellColor[cell]}`}>
                {cell === 'hit' && <span className="text-xs flex items-center justify-center h-full text-red">✕</span>}
                {cell === 'sunk' && <span className="text-xs flex items-center justify-center h-full text-red">✕</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Enemy grid */}
        <div>
          <p className="text-xs text-muted mb-2 text-center font-bold uppercase tracking-widest">กองเรือศัตรู</p>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(10, 1.75rem)' }}>
            {enemyGrid.map((row, r) =>
              row.map((cell, c) => {
                const display = cell === 'ship' ? 'empty' : cell
                return (
                  <motion.div
                    key={`${r}-${c}`}
                    onClick={() => handleMyFire(r, c)}
                    whileHover={myTurn && !winner && (cell === 'empty' || cell === 'ship') ? { scale: 1.1 } : {}}
                    className={`w-7 h-7 rounded-sm cursor-pointer transition-colors ${cellColor[display]}`}
                  >
                    {display === 'hit' && <span className="text-xs flex items-center justify-center h-full text-red">✕</span>}
                    {display === 'sunk' && <span className="text-xs flex items-center justify-center h-full text-red">✕</span>}
                    {display === 'miss' && <span className="text-xs flex items-center justify-center h-full text-blue-400">·</span>}
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {winner && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => window.location.reload()}
          className="mt-4 bg-accent text-bg px-6 py-2 rounded-full font-bold text-sm hover:brightness-110"
        >
          เล่นอีกครั้ง
        </motion.button>
      )}

      <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null) }} />
      {roomId && <ChatBox roomId={roomId} playerName={playerName} />}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><BattleshipPage /></Suspense>
}
