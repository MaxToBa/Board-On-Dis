'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { emptyBoard, addRandomTile, move as moveBoard, isGameOver, getBestTile } from '@/lib/games/game-2048'
import { sound } from '@/lib/sound'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { Board, Direction } from '@/lib/games/game-2048'

const TILE_COLORS: Record<number, string> = {
  0: 'bg-surface2 text-transparent',
  2: 'bg-[#eee4da] text-[#776e65]',
  4: 'bg-[#ede0c8] text-[#776e65]',
  8: 'bg-[#f2b179] text-white',
  16: 'bg-[#f59563] text-white',
  32: 'bg-[#f67c5f] text-white',
  64: 'bg-[#f65e3b] text-white',
  128: 'bg-[#edcf72] text-white',
  256: 'bg-[#edcc61] text-white',
  512: 'bg-[#edc850] text-white',
  1024: 'bg-[#edc53f] text-white',
  2048: 'bg-[#edc22e] text-white',
}

function Game2048Page() {
  const { playerName, isAuthenticated } = usePlayerInfo()
  const { user } = useAuthStore()
  const [board, setBoard] = useState<Board>(() => addRandomTile(addRandomTile(emptyBoard())))
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [startTime] = useState(Date.now())

  const handleKey = useCallback((dir: Direction) => {
    if (gameOver) return
    const { board: newBoard, score: gained, moved } = moveBoard(board, dir)
    if (!moved) return
    const withTile = addRandomTile(newBoard)
    setBoard(withTile)
    setScore((s) => {
      const next = s + gained
      setBest((b) => Math.max(b, next))
      return next
    })
    if (gained > 0) sound.merge()
    else sound.move()
    if (isGameOver(withTile)) {
      setGameOver(true)
      sound.lose()
      saveResult(withTile, score + gained)
    }
  }, [board, gameOver, score]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
      }
      if (map[e.key]) { e.preventDefault(); handleKey(map[e.key]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleKey])

  // Swipe support
  useEffect(() => {
    let startX = 0, startY = 0
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) > Math.abs(dy)) handleKey(dx > 0 ? 'right' : 'left')
      else handleKey(dy > 0 ? 'down' : 'up')
    }
    window.addEventListener('touchstart', onStart)
    window.addEventListener('touchend', onEnd)
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd) }
  }, [handleKey])

  async function saveResult(b: Board, finalScore: number) {
    if (!isAuthenticated || !user) return
    await supabase.from('game_results').insert({
      user_id: user.id, player_name: playerName, game: '2048',
      result: getBestTile(b) >= 2048 ? 'win' : 'loss',
      opponent: 'Solo', score: finalScore, best_tile: getBestTile(b),
      time_played: Math.floor((Date.now() - startTime) / 1000),
    })
  }

  function restart() {
    setBoard(addRandomTile(addRandomTile(emptyBoard())))
    setScore(0)
    setGameOver(false)
  }

  const tileColor = (v: number) => TILE_COLORS[v] ?? 'bg-[#edc22e] text-white'

  return (
    <GameLayout
      title="2048"
      status={gameOver ? 'เกมจบแล้ว' : `คะแนน ${score}`}
      statusColor={gameOver ? 'red' : 'accent'}
    >
      {/* Scores */}
      <div className="flex gap-4 mb-4">
        <div className="bg-surface border border-white/10 rounded-xl px-5 py-2 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted">คะแนน</p>
          <p className="text-xl font-bold text-accent">{score}</p>
        </div>
        <div className="bg-surface border border-white/10 rounded-xl px-5 py-2 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted">ดีสุด</p>
          <p className="text-xl font-bold text-white">{best}</p>
        </div>
      </div>

      {/* Board */}
      <div className="bg-[#bbada0] rounded-2xl p-3 grid grid-cols-4 gap-3 select-none" style={{ width: 320 }}>
        {board.flat().map((v, i) => (
          <motion.div
            key={i}
            layout
            className={`w-[66px] h-[66px] rounded-xl flex items-center justify-center font-bold text-lg ${tileColor(v)}`}
          >
            {v > 0 ? v : ''}
          </motion.div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted">ใช้ลูกศร หรือ WASD หรือ swipe</p>

      {/* Directional buttons for mobile */}
      <div className="grid grid-cols-3 gap-2 mt-4 w-32">
        <div />
        <button onClick={() => handleKey('up')} className="bg-surface2 border border-white/10 rounded-xl p-2 text-white hover:bg-white/10">↑</button>
        <div />
        <button onClick={() => handleKey('left')} className="bg-surface2 border border-white/10 rounded-xl p-2 text-white hover:bg-white/10">←</button>
        <button onClick={() => handleKey('down')} className="bg-surface2 border border-white/10 rounded-xl p-2 text-white hover:bg-white/10">↓</button>
        <button onClick={() => handleKey('right')} className="bg-surface2 border border-white/10 rounded-xl p-2 text-white hover:bg-white/10">→</button>
      </div>

      {gameOver && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={restart}
          className="mt-4 bg-accent text-bg px-6 py-2 rounded-full font-bold text-sm hover:brightness-110"
        >
          เล่นอีกครั้ง
        </motion.button>
      )}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><Game2048Page /></Suspense>
}
