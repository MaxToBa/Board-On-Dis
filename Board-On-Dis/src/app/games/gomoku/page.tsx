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
import { checkWinner, emptyBoard } from '@/lib/games/gomoku'
import { sound } from '@/lib/sound'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { Board, Winner } from '@/lib/games/gomoku'

const SIZE = 15

function GomokuPage() {
  const { playerName, avatarUrl, isAuthenticated, roomId, mode, isHost } = usePlayerInfo()
  const { user } = useAuthStore()
  const [board, setBoard] = useState<Board>(emptyBoard())
  const [currentTurn, setCurrentTurn] = useState<1 | 2>(1)
  const [winner, setWinner] = useState<Winner>(null)
  const [myPlayer, setMyPlayer] = useState<1 | 2>(1)
  const [opponentName, setOpponentName] = useState('รอผู้เล่น...')
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [lastMove, setLastMove] = useState<[number, number] | null>(null)

  const isMyTurn = !winner && (mode === 'ai' ? currentTurn === 1 : currentTurn === myPlayer)

  const { updateRoomState } = useGameRoom({
    roomId,
    onStateChange: useCallback((state: Record<string, unknown>) => {
      if (state.board) setBoard(state.board as Board)
      if (state.turn) setCurrentTurn(state.turn as 1 | 2)
      if (state.lastMove) setLastMove(state.lastMove as [number, number])
      if (state.started) setGameStarted(true)
    }, []),
  })

  useEffect(() => {
    if (gameStarted) return
    const flip = Math.random() < 0.5
    if (mode === 'ai') {
      setMyPlayer(1)
      setTimeout(() => setCoinWinner(flip ? playerName : 'AI'), 300)
    } else if (isHost) {
      setMyPlayer(flip ? 1 : 2)
      setTimeout(() => setCoinWinner(playerName), 300)
    } else {
      setMyPlayer(2)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'ai' || currentTurn !== 2 || winner || !gameStarted) return
    setAiThinking(true)
    fetch('/api/ai/gomoku', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, lastMove }),
    })
      .then((r) => r.json())
      .then(({ move }: { move: [number, number] }) => handlePlace(move[0], move[1], true))
      .catch(() => {
        const empty: [number, number][] = []
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!board[r][c]) empty.push([r, c])
        if (empty.length) { const m = empty[Math.floor(Math.random() * empty.length)]; handlePlace(m[0], m[1], true) }
      })
      .finally(() => setAiThinking(false))
  }, [currentTurn, gameStarted]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePlace(r: number, c: number, isAI = false) {
    if (board[r][c] || winner) return
    if (!isAI && !isMyTurn) return
    if (!gameStarted && mode !== 'ai') return

    const newBoard = board.map((row) => [...row]) as Board
    newBoard[r][c] = currentTurn
    const w = checkWinner(newBoard)
    setBoard(newBoard)
    setLastMove([r, c])
    if (w) {
      setWinner(w)
      if (w === myPlayer) sound.win(); else sound.lose()
      saveResult(w)
    } else {
      sound.move()
      setCurrentTurn(currentTurn === 1 ? 2 : 1)
    }
    if (roomId) updateRoomState({ board: newBoard, turn: currentTurn === 1 ? 2 : 1, lastMove: [r, c] })
  }

  async function saveResult(w: Winner) {
    if (!isAuthenticated || !user || !w) return
    await supabase.from('game_results').insert({
      user_id: user.id, player_name: playerName, game: 'gomoku',
      result: w === myPlayer ? 'win' : 'loss',
      opponent: mode === 'ai' ? 'AI' : opponentName, score: 0, best_tile: 0, time_played: 0,
    })
  }

  const CELL = 28
  const opponent = mode === 'ai' ? 'AI (Claude)' : opponentName

  return (
    <GameLayout
      title="โกะ / Gomoku"
      status={winner ? (winner === myPlayer ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...') : aiThinking ? 'AI กำลังคิด...' : isMyTurn ? 'ตาของคุณ' : 'รอคู่ต่อสู้'}
      statusColor={winner ? (winner === myPlayer ? 'green' : 'red') : 'accent'}
      topLeft={<PlayerCard name={playerName} avatar={avatarUrl} label={`ผู้เล่น (●)`} active={currentTurn === myPlayer && !winner} />}
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard name={opponent} label="ฝ่ายตรงข้าม (○)" active={currentTurn !== myPlayer && !winner} flip />
          {roomId && <RoomCode code={roomId} />}
        </div>
      }
    >
      <div className="overflow-auto max-w-full">
        <div
          className="relative bg-surface2 border border-white/10 rounded-xl"
          style={{ width: SIZE * CELL + 20, height: SIZE * CELL + 20, padding: 10 }}
        >
          {/* Grid lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={SIZE * CELL + 20}
            height={SIZE * CELL + 20}
          >
            {Array.from({ length: SIZE }).map((_, i) => (
              <g key={i}>
                <line x1={10 + i * CELL + CELL/2} y1={10 + CELL/2} x2={10 + i * CELL + CELL/2} y2={10 + (SIZE-1) * CELL + CELL/2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <line x1={10 + CELL/2} y1={10 + i * CELL + CELL/2} x2={10 + (SIZE-1) * CELL + CELL/2} y2={10 + i * CELL + CELL/2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              </g>
            ))}
          </svg>

          {/* Cells */}
          {Array.from({ length: SIZE }).map((_, r) =>
            Array.from({ length: SIZE }).map((_, c) => {
              const cell = board[r][c]
              const isLast = lastMove?.[0] === r && lastMove?.[1] === c
              return (
                <div
                  key={`${r}-${c}`}
                  className="absolute flex items-center justify-center cursor-pointer group"
                  style={{ width: CELL, height: CELL, left: 10 + c * CELL, top: 10 + r * CELL }}
                  onClick={() => handlePlace(r, c)}
                >
                  {cell ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`w-5 h-5 rounded-full ${cell === 1 ? 'bg-white' : 'bg-gray-800 border border-white/30'} ${isLast ? 'ring-2 ring-accent' : ''}`}
                    />
                  ) : isMyTurn && !winner ? (
                    <div className="w-5 h-5 rounded-full bg-white/0 group-hover:bg-white/20 transition-colors" />
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>

      {winner && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => { setBoard(emptyBoard()); setWinner(null); setCurrentTurn(1); setLastMove(null) }}
          className="mt-4 bg-accent text-bg px-6 py-2 rounded-full font-bold text-sm hover:brightness-110"
        >
          เล่นอีกครั้ง
        </motion.button>
      )}

      <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
      {roomId && <ChatBox roomId={roomId} playerName={playerName} />}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><GomokuPage /></Suspense>
}
