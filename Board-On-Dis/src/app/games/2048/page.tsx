'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { emptyBoard, addRandomTile, move as moveBoard, isGameOver, getBestTile } from '@/lib/games/game-2048'
import { sound } from '@/lib/sound'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { Board, Direction } from '@/lib/games/game-2048'

const TILE_COLORS: Record<number, { bg: string; text: string; shadow?: string }> = {
  0:    { bg: '#1a1a26', text: 'transparent' },
  2:    { bg: '#eee4da', text: '#776e65' },
  4:    { bg: '#ede0c8', text: '#776e65' },
  8:    { bg: '#f2b179', text: '#fff' },
  16:   { bg: '#f59563', text: '#fff' },
  32:   { bg: '#f67c5f', text: '#fff' },
  64:   { bg: '#f65e3b', text: '#fff' },
  128:  { bg: '#edcf72', text: '#fff', shadow: '0 0 20px rgba(237,207,114,0.5)' },
  256:  { bg: '#edcc61', text: '#fff', shadow: '0 0 20px rgba(237,204,97,0.5)' },
  512:  { bg: '#edc850', text: '#fff', shadow: '0 0 24px rgba(237,200,80,0.6)' },
  1024: { bg: '#edc53f', text: '#fff', shadow: '0 0 28px rgba(237,197,63,0.7)' },
  2048: { bg: '#edc22e', text: '#fff', shadow: '0 0 32px rgba(237,194,46,0.8)' },
}

function Game2048Page() {
  const { playerName, isAuthenticated } = usePlayerInfo()
  const { user } = useAuthStore()
  const [board, setBoard] = useState<Board>(() => addRandomTile(addRandomTile(emptyBoard())))
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
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
    if (getBestTile(withTile) >= 2048 && !won) {
      setWon(true)
      sound.win()
    }
    if (isGameOver(withTile)) {
      setGameOver(true)
      sound.lose()
      saveResult(withTile, score + gained)
    }
  }, [board, gameOver, score, won]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
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
    setWon(false)
  }

  const getTileStyle = (v: number) => {
    const t = TILE_COLORS[v] ?? { bg: '#edc22e', text: '#fff', shadow: '0 0 32px rgba(237,194,46,0.9)' }
    return { backgroundColor: t.bg, color: t.text, boxShadow: t.shadow }
  }

  const getTileSize = (v: number) => {
    if (v >= 1024) return 'text-lg'
    if (v >= 128) return 'text-xl'
    return 'text-2xl'
  }

  const statusText = gameOver ? '💀 เกมจบแล้ว' : won ? '🏆 ถึง 2048 แล้ว!' : `คะแนน ${score}`
  const statusColor = gameOver ? 'red' : won ? 'green' : 'accent'

  return (
    <GameLayout title="2048" status={statusText} statusColor={statusColor}>
      {/* Score boxes */}
      <div className="flex gap-3 mb-5">
        <div className="bg-[#bbada0] rounded-xl px-5 py-2.5 text-center min-w-[90px]">
          <p className="text-[10px] uppercase tracking-widest text-white/70 font-bold">คะแนน</p>
          <p className="text-xl font-bold text-white">{score.toLocaleString()}</p>
        </div>
        <div className="bg-[#bbada0] rounded-xl px-5 py-2.5 text-center min-w-[90px]">
          <p className="text-[10px] uppercase tracking-widest text-white/70 font-bold">ดีสุด</p>
          <p className="text-xl font-bold text-white">{best.toLocaleString()}</p>
        </div>
        <button onClick={restart}
          className="ml-auto bg-[#8f7a66] hover:bg-[#9f8a76] text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-colors"
        >
          เริ่มใหม่
        </button>
      </div>

      {/* Board */}
      <div className="bg-[#bbada0] rounded-2xl p-3 shadow-2xl" style={{ width: 320 }}>
        <div className="grid grid-cols-4 gap-3">
          {board.flat().map((v, i) => (
            <motion.div
              key={i}
              layout
              animate={{ scale: v > 0 ? [1.05, 1] : 1 }}
              transition={{ duration: 0.1 }}
              style={getTileStyle(v)}
              className={`w-[66px] h-[66px] rounded-xl flex items-center justify-center font-black select-none ${getTileSize(v)}`}
            >
              {v > 0 ? v : ''}
            </motion.div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">ใช้ ↑↓←→ หรือ WASD หรือ swipe</p>

      {/* Direction buttons for mobile */}
      <div className="mt-4 grid grid-cols-3 gap-2 w-36">
        <div />
        <button onClick={() => handleKey('up')}
          className="bg-surface2/80 border border-white/10 rounded-xl p-3 text-white hover:bg-white/10 active:scale-95 transition-all text-lg">↑</button>
        <div />
        <button onClick={() => handleKey('left')}
          className="bg-surface2/80 border border-white/10 rounded-xl p-3 text-white hover:bg-white/10 active:scale-95 transition-all text-lg">←</button>
        <button onClick={() => handleKey('down')}
          className="bg-surface2/80 border border-white/10 rounded-xl p-3 text-white hover:bg-white/10 active:scale-95 transition-all text-lg">↓</button>
        <button onClick={() => handleKey('right')}
          className="bg-surface2/80 border border-white/10 rounded-xl p-3 text-white hover:bg-white/10 active:scale-95 transition-all text-lg">→</button>
      </div>

      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 flex flex-col items-center gap-3"
          >
            <p className="text-muted text-sm">คะแนนสุดท้าย: <span className="text-white font-bold">{score.toLocaleString()}</span></p>
            <button onClick={restart}
              className="bg-accent text-bg px-8 py-2.5 rounded-full font-bold hover:brightness-110 transition-all"
            >
              เล่นอีกครั้ง
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><Game2048Page /></Suspense>
}
