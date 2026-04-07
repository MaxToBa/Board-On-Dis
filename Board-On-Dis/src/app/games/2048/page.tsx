'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { emptyBoard, addRandomTile, move as moveBoard, isGameOver, getBestTile } from '@/lib/games/game-2048'
import { sound } from '@/lib/sound'
import { saveGameResult } from '@/lib/saveGameResult'
import { save2048Game, load2048Game, delete2048Save } from '@/lib/saveGame'
import { get2048Leaderboard } from '@/lib/leaderboard'
import type { LeaderboardRow } from '@/lib/leaderboard'
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
  const { playerName, userId, isAuthenticated } = usePlayerInfo()
  const [board, setBoard] = useState<Board>(() => addRandomTile(addRandomTile(emptyBoard())))
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const startTimeRef = useRef(Date.now())
  const elapsedRef = useRef(0)

  // Save resume popup
  const [resumeData, setResumeData] = useState<{ board: Board; score: number; best: number } | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  useEffect(() => {
    get2048Leaderboard(10).then(setLeaderboard)
  }, [])

  // Load save on mount
  useEffect(() => {
    if (!userId) return
    load2048Game(userId).then((saved) => {
      if (saved) setResumeData(saved)
    })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto save every 30s
  useEffect(() => {
    if (!userId || gameOver) return
    const interval = setInterval(() => {
      const elapsed = elapsedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000)
      save2048Game(userId, { board, score, best }, elapsed)
    }, 30000)
    return () => clearInterval(interval)
  }, [userId, board, score, best, gameOver]) // eslint-disable-line react-hooks/exhaustive-deps

  async function manualSave() {
    if (!userId) return
    setSaveStatus('saving')
    const elapsed = elapsedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000)
    await save2048Game(userId, { board, score, best }, elapsed)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  function resumeSave() {
    if (!resumeData) return
    setBoard(resumeData.board)
    setScore(resumeData.score)
    setBest(resumeData.best)
    setResumeData(null)
    startTimeRef.current = Date.now()
  }

  function discardSave() {
    if (userId) delete2048Save(userId)
    setResumeData(null)
  }

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
      const finalScore = score + gained
      const elapsed = elapsedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000)
      saveResult(withTile, finalScore, elapsed)
      if (userId) delete2048Save(userId)
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

  function saveResult(b: Board, finalScore: number, timePlayed: number) {
    if (!isAuthenticated || !userId) return
    saveGameResult({
      userId, playerName, game: '2048',
      result: getBestTile(b) >= 2048 ? 'win' : 'loss',
      opponent: 'Solo', isBot: false,
      score: finalScore, bestTile: getBestTile(b),
      timePlayed,
    })
  }

  function restart() {
    if (userId) delete2048Save(userId)
    setBoard(addRandomTile(addRandomTile(emptyBoard())))
    setScore(0)
    setGameOver(false)
    setWon(false)
    startTimeRef.current = Date.now()
    elapsedRef.current = 0
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

      {/* Resume popup */}
      <AnimatePresence>
        {resumeData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface border border-white/15 rounded-2xl p-6 max-w-xs w-full text-center"
            >
              <div className="text-4xl mb-3">💾</div>
              <h2 className="font-bold text-white text-lg mb-1">มีเกมที่บันทึกไว้</h2>
              <p className="text-muted text-sm mb-5">
                คะแนน <span className="text-accent font-bold">{resumeData.score.toLocaleString()}</span>
                {' '}· ไทล์สูงสุด <span className="text-white font-bold">{Math.max(...resumeData.board.flat())}</span>
              </p>
              <div className="flex gap-3">
                <button onClick={discardSave}
                  className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm font-bold text-muted hover:text-white hover:border-white/25 transition-all">
                  เริ่มใหม่
                </button>
                <button onClick={resumeSave}
                  className="flex-1 py-2.5 bg-accent text-bg rounded-xl text-sm font-bold hover:brightness-110 transition-all">
                  เล่นต่อ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
        <div className="ml-auto flex gap-2">
          {isAuthenticated && !gameOver && (
            <button onClick={manualSave} disabled={saveStatus === 'saving'}
              className="bg-surface2 border border-white/10 text-white rounded-xl px-3 py-2.5 text-xs font-bold hover:border-white/25 transition-all disabled:opacity-50"
              title="บันทึกเกม"
            >
              {saveStatus === 'saved' ? '✓' : saveStatus === 'saving' ? '...' : '💾'}
            </button>
          )}
          <button onClick={restart}
            className="bg-[#8f7a66] hover:bg-[#9f8a76] text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-colors"
          >
            เริ่มใหม่
          </button>
        </div>
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

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="mt-6 w-full max-w-xs">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">🏆 อันดับ 2048</h3>
          <div className="flex flex-col gap-1.5">
            {leaderboard.map((row, i) => {
              const isMe = row.userId === userId
              const TROPHY = ['🥇', '🥈', '🥉']
              return (
                <a
                  key={row.userId}
                  href={`/profile/${row.userId}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:border-white/25 ${
                    isMe
                      ? 'border-accent/40 bg-accent/5 ring-1 ring-accent/20'
                      : 'border-white/8 bg-surface hover:bg-surface2'
                  }`}
                >
                  <span className="text-sm w-6 text-center flex-shrink-0">
                    {TROPHY[i] ?? <span className="text-xs text-muted">{i + 1}</span>}
                  </span>
                  <span className={`flex-1 text-xs font-bold truncate ${isMe ? 'text-accent' : 'text-white'}`}>
                    {row.playerName} {isMe && '(คุณ)'}
                  </span>
                  <span className="text-xs font-bold text-accent">{row.bestScore.toLocaleString()}</span>
                  <span className="text-[10px] text-muted">{row.bestTile}</span>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><Game2048Page /></Suspense>
}
