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
import { emptyBoard, dropPiece, checkWinner, getAvailableCols, ROWS, COLS } from '@/lib/games/connect-four'
import { sound } from '@/lib/sound'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { Board, Winner } from '@/lib/games/connect-four'

function ConnectFourPage() {
  const { playerName, avatarUrl, isAuthenticated, roomId, mode, isHost } = usePlayerInfo()
  const { user } = useAuthStore()
  const [board, setBoard] = useState<Board>(emptyBoard())
  const [currentTurn, setCurrentTurn] = useState<1 | 2>(1)
  const [winner, setWinner] = useState<Winner>(null)
  const [myPlayer, setMyPlayer] = useState<1 | 2>(1)
  const [opponentName, setOpponentName] = useState('รอผู้เล่น...')
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  const [aiThinking, setAiThinking] = useState(false)

  const isMyTurn = !winner && (mode === 'ai' ? currentTurn === 1 : currentTurn === myPlayer)

  const { updateRoomState } = useGameRoom({
    roomId,
    onStateChange: useCallback((state: Record<string, unknown>) => {
      if (state.board) { setBoard(state.board as Board); setGameStarted(true) }
      if (state.turn) setCurrentTurn(state.turn as 1 | 2)
      if (state.opponent) setOpponentName((prev) => prev === 'รอผู้เล่น...' ? state.opponent as string : prev)
    }, []),
  })

  useEffect(() => {
    if (gameStarted) return
    const flip = Math.random() < 0.5
    if (mode === 'ai') { setMyPlayer(1); setTimeout(() => setCoinWinner(flip ? playerName : 'AI'), 300) }
    else if (isHost) { setMyPlayer(flip ? 1 : 2); setTimeout(() => setCoinWinner(playerName), 300) }
    else setMyPlayer(2)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'ai' || currentTurn !== 2 || winner || !gameStarted) return
    setAiThinking(true)
    fetch('/api/ai/connect-four', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board }),
    })
      .then((r) => r.json())
      .then(({ col }: { col: number }) => {
        const available = getAvailableCols(board)
        handleDrop(available.includes(col) ? col : available[Math.floor(Math.random() * available.length)], true)
      })
      .catch(() => {
        const a = getAvailableCols(board)
        if (a.length) handleDrop(a[Math.floor(Math.random() * a.length)], true)
      })
      .finally(() => setAiThinking(false))
  }, [currentTurn, gameStarted]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDrop(col: number, isAI = false) {
    if (winner) return
    if (!isAI && !isMyTurn) return
    if (!gameStarted && mode !== 'ai') return
    const newBoard = dropPiece(board, col, currentTurn)
    if (!newBoard) return
    const w = checkWinner(newBoard)
    setBoard(newBoard)
    sound.drop()
    if (w) {
      setWinner(w)
      if (w !== 'draw') { if (w === myPlayer) sound.win(); else sound.lose() }
      else sound.draw()
      saveResult(w)
    } else {
      setCurrentTurn(currentTurn === 1 ? 2 : 1)
    }
    if (roomId) updateRoomState({ board: newBoard, turn: currentTurn === 1 ? 2 : 1, opponent: playerName })
  }

  async function saveResult(w: Winner) {
    if (!isAuthenticated || !user || !w) return
    await supabase.from('game_results').insert({
      user_id: user.id, player_name: playerName, game: 'connect-four',
      result: w === 'draw' ? 'draw' : w === myPlayer ? 'win' : 'loss',
      opponent: mode === 'ai' ? 'AI' : opponentName, score: 0, best_tile: 0, time_played: 0,
    })
  }

  const colors = ['', 'bg-red', 'bg-accent']
  const opponent = mode === 'ai' ? 'AI (Claude)' : opponentName

  return (
    <GameLayout
      title="Connect Four"
      status={winner ? (winner === 'draw' ? 'เสมอ!' : winner === myPlayer ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...') : aiThinking ? 'AI กำลังคิด...' : isMyTurn ? 'ตาของคุณ' : 'รอคู่ต่อสู้'}
      statusColor={winner ? (winner === 'draw' ? 'default' : winner === myPlayer ? 'green' : 'red') : 'accent'}
      topLeft={<PlayerCard name={playerName} avatar={avatarUrl} label={`คุณ (${myPlayer === 1 ? '🔴' : '🟡'})`} active={currentTurn === myPlayer && !winner} />}
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard name={opponent} label={`ฝ่ายตรงข้าม (${myPlayer === 1 ? '🟡' : '🔴'})`} active={currentTurn !== myPlayer && !winner} flip />
          {roomId && <RoomCode code={roomId} />}
        </div>
      }
    >
      <div className="bg-surface2 border border-white/10 rounded-2xl p-3 overflow-auto">
        {/* Column hover indicators */}
        <div className="flex gap-2 mb-1">
          {Array.from({ length: COLS }).map((_, c) => (
            <div key={c} className="w-10 h-4 flex items-center justify-center">
              {hoverCol === c && isMyTurn && (
                <motion.div initial={{ y: -4 }} animate={{ y: 0 }} className={`w-4 h-4 rounded-full ${myPlayer === 1 ? 'bg-red' : 'bg-accent'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${COLS}, 2.5rem)` }}>
          {Array.from({ length: ROWS }).map((_, r) =>
            Array.from({ length: COLS }).map((_, c) => {
              const cell = board[r][c]
              return (
                <motion.div
                  key={`${r}-${c}`}
                  className={`w-10 h-10 rounded-full border-2 cursor-pointer transition-colors ${
                    cell ? `${colors[cell]} border-transparent` : 'border-white/10 bg-surface hover:border-white/20'
                  }`}
                  onMouseEnter={() => setHoverCol(c)}
                  onMouseLeave={() => setHoverCol(null)}
                  onClick={() => handleDrop(c)}
                  initial={cell ? { scale: 0 } : false}
                  animate={cell ? { scale: 1 } : {}}
                />
              )
            })
          )}
        </div>
      </div>

      {winner && (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => { setBoard(emptyBoard()); setWinner(null); setCurrentTurn(1) }}
          className="mt-4 bg-accent text-bg px-6 py-2 rounded-full font-bold text-sm hover:brightness-110"
        >
          เล่นอีกครั้ง
        </motion.button>
      )}

      <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
      {roomId && <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><ConnectFourPage /></Suspense>
}
