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
import { initialBoard, getValidMoves, applyMove, checkWinner } from '@/lib/games/checkers'
import { sound } from '@/lib/sound'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { Board, Move } from '@/lib/games/checkers'

function CheckersPage() {
  const { playerName, avatarUrl, isAuthenticated, roomId, mode, isHost } = usePlayerInfo()
  const { user } = useAuthStore()
  const [board, setBoard] = useState<Board>(initialBoard())
  const [currentTurn, setCurrentTurn] = useState<1 | 2>(1)
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [validMoves, setValidMoves] = useState<Move[]>([])
  const [winner, setWinner] = useState<1 | 2 | null>(null)
  const [myPlayer, setMyPlayer] = useState<1 | 2>(1)
  const [opponentName, setOpponentName] = useState('รอผู้เล่น...')
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)

  const isMyTurn = !winner && (mode === 'ai' ? currentTurn === 1 : currentTurn === myPlayer)
  const isFlipped = myPlayer === 2

  const { updateRoomState } = useGameRoom({
    roomId,
    onStateChange: useCallback((state: Record<string, unknown>) => {
      if (state.board) setBoard(state.board as Board)
      if (state.turn) setCurrentTurn(state.turn as 1 | 2)
      if (state.started) setGameStarted(true)
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
    fetch('/api/ai/checkers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board }),
    })
      .then((r) => r.json())
      .then(({ moveIndex }: { moveIndex: number }) => {
        const moves = getValidMoves(board, 2)
        if (moves.length) applyMoveAndUpdate(moves[moveIndex >= 0 && moveIndex < moves.length ? moveIndex : 0])
      })
      .catch(() => { const m = getValidMoves(board, 2); if (m.length) applyMoveAndUpdate(m[0]) })
      .finally(() => setAiThinking(false))
  }, [currentTurn, gameStarted]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyMoveAndUpdate(mv: Move) {
    const newBoard = applyMove(board, mv)
    const w = checkWinner(newBoard)
    setBoard(newBoard)
    setSelected(null)
    setValidMoves([])
    sound.capture()
    if (w) { setWinner(w); if (w === myPlayer) sound.win(); else sound.lose(); saveResult(w) }
    else setCurrentTurn(currentTurn === 1 ? 2 : 1)
    if (roomId) updateRoomState({ board: newBoard, turn: currentTurn === 1 ? 2 : 1 })
  }

  function handleCellClick(r: number, c: number) {
    if (!isMyTurn || winner || (!gameStarted && mode !== 'ai')) return
    const piece = board[r][c]

    if (selected) {
      const mv = validMoves.find((m) => m.to[0] === r && m.to[1] === c)
      if (mv) { applyMoveAndUpdate(mv); return }
      setSelected(null); setValidMoves([])
    }

    if (piece && piece.player === currentTurn) {
      setSelected([r, c])
      const allMoves = getValidMoves(board, currentTurn)
      const pieceMoves = allMoves.filter((m) => m.from[0] === r && m.from[1] === c)
      setValidMoves(pieceMoves)
      sound.click()
    }
  }

  async function saveResult(w: 1 | 2) {
    if (!isAuthenticated || !user) return
    await supabase.from('game_results').insert({
      user_id: user.id, player_name: playerName, game: 'checkers',
      result: w === myPlayer ? 'win' : 'loss',
      opponent: mode === 'ai' ? 'AI' : opponentName, score: 0, best_tile: 0, time_played: 0,
    })
  }

  const rows = isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7]
  const cols = isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7]
  const isValidDest = (r: number, c: number) => validMoves.some((m) => m.to[0] === r && m.to[1] === c)
  const opponent = mode === 'ai' ? 'AI (Claude)' : opponentName

  return (
    <GameLayout
      title="หมากฮอส"
      status={winner ? (winner === myPlayer ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...') : aiThinking ? 'AI กำลังคิด...' : isMyTurn ? 'ตาของคุณ' : 'รอคู่ต่อสู้'}
      statusColor={winner ? (winner === myPlayer ? 'green' : 'red') : 'accent'}
      topLeft={<PlayerCard name={playerName} avatar={avatarUrl} label="คุณ (แดง)" active={currentTurn === myPlayer && !winner} />}
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard name={opponent} label="ฝ่ายตรงข้าม (ดำ)" active={currentTurn !== myPlayer && !winner} flip />
          {roomId && <RoomCode code={roomId} />}
        </div>
      }
    >
      <div className="border border-white/10 rounded-2xl overflow-hidden">
        {rows.map((r) => (
          <div key={r} className="flex">
            {cols.map((c) => {
              const isDark = (r + c) % 2 === 1
              const piece = board[r][c]
              const isSel = selected?.[0] === r && selected?.[1] === c
              const isDest = isValidDest(r, c)
              return (
                <div
                  key={c}
                  onClick={() => handleCellClick(r, c)}
                  className={`w-10 h-10 flex items-center justify-center cursor-pointer relative ${
                    isDark ? 'bg-[#769656]' : 'bg-[#eeeed2]'
                  } ${isSel ? 'ring-2 ring-inset ring-yellow-400' : ''}`}
                >
                  {isDest && isDark && (
                    <div className="absolute inset-0 bg-yellow-400/30 rounded-full m-2" />
                  )}
                  {piece && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: isSel ? 1.15 : 1 }}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 ${
                        piece.player === 1
                          ? 'bg-red border-red/60 text-white shadow-lg'
                          : 'bg-gray-900 border-gray-600 text-white shadow-lg'
                      }`}
                    >
                      {piece.king ? '♛' : ''}
                    </motion.div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {winner && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => { setBoard(initialBoard()); setWinner(null); setCurrentTurn(1); setSelected(null); setValidMoves([]) }}
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
  return <Suspense><CheckersPage /></Suspense>
}
