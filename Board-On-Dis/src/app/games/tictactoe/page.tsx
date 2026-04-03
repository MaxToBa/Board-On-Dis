'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import PlayerCard from '@/components/game/PlayerCard'
import RoomCode from '@/components/game/RoomCode'
import CoinFlip from '@/components/game/CoinFlip'
import ChatBox from '@/components/game/ChatBox'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { useGameRoom } from '@/hooks/useGameRoom'
import { checkWinner, getAvailableMoves, getWinLine } from '@/lib/games/tictactoe'
import { sound } from '@/lib/sound'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { Board, Winner } from '@/lib/games/tictactoe'

const CELL_SYMBOLS = { X: '✕', O: '◯' }

function TictactoePage() {
  const { playerName, avatarUrl, isAuthenticated, roomId, mode, isHost } = usePlayerInfo()
  const { user } = useAuthStore()
  const params = useSearchParams()

  const [board, setBoard] = useState<Board>(Array(9).fill(null))
  const [currentTurn, setCurrentTurn] = useState<'X' | 'O'>('X')
  const [winner, setWinner] = useState<Winner>(null)
  const [winLine, setWinLine] = useState<number[] | null>(null)
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [mySymbol, setMySymbol] = useState<'X' | 'O'>('X')
  const [opponentName, setOpponentName] = useState('รอผู้เล่น...')
  const [aiThinking, setAiThinking] = useState(false)
  const [scores, setScores] = useState({ X: 0, O: 0 })

  const isMultiplayer = mode === 'multiplayer' && !!roomId
  const isMyTurn = !winner && (mode === 'ai' ? currentTurn === 'X' : currentTurn === mySymbol)

  // Multiplayer room sync
  const { updateRoomState, setRoomStatus } = useGameRoom({
    roomId,
    onStateChange: useCallback((state: Record<string, unknown>) => {
      if (state.board) setBoard(state.board as Board)
      if (state.turn) setCurrentTurn(state.turn as 'X' | 'O')
      if (state.opponent && opponentName === 'รอผู้เล่น...') setOpponentName(state.opponent as string)
      if (state.started) { setGameStarted(true) }
    }, [opponentName]),
  })

  // Coin flip on start
  useEffect(() => {
    if (gameStarted) return
    const flip = Math.random() < 0.5
    if (mode === 'ai') {
      const first = flip ? playerName : 'AI'
      setMySymbol('X')
      setTimeout(() => { setCoinWinner(first) }, 300)
    } else if (isHost) {
      const myFirst = flip
      setMySymbol(myFirst ? 'X' : 'O')
      setTimeout(() => { setCoinWinner(playerName) }, 300)
    } else {
      setMySymbol('O')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load room opponent name
  useEffect(() => {
    if (!isMultiplayer) return
    supabase.from('rooms').select('players').eq('id', roomId).single().then(({ data }) => {
      if (data?.players) {
        const opp = data.players.find((p: string) => p !== playerName)
        if (opp) setOpponentName(opp)
      }
    })
  }, [roomId, playerName, isMultiplayer])

  // AI move
  useEffect(() => {
    if (mode !== 'ai' || currentTurn !== 'O' || winner || !gameStarted) return
    setAiThinking(true)
    const available = getAvailableMoves(board)
    if (!available.length) return

    fetch('/api/ai/tictactoe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board }),
    })
      .then((r) => r.json())
      .then(({ index }: { index: number }) => {
        const move = available.includes(index) ? index : available[Math.floor(Math.random() * available.length)]
        handleCellClick(move, true)
      })
      .catch(() => {
        const move = available[Math.floor(Math.random() * available.length)]
        handleCellClick(move, true)
      })
      .finally(() => setAiThinking(false))
  }, [currentTurn, gameStarted]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCellClick(index: number, isAI = false) {
    if (board[index] || winner) return
    if (!isAI && !isMyTurn) return
    if (!gameStarted && mode !== 'ai') return

    const newBoard = [...board]
    newBoard[index] = currentTurn
    const w = checkWinner(newBoard)
    const wl = getWinLine(newBoard)

    setBoard(newBoard)
    setWinLine(wl)
    if (w) {
      setWinner(w)
      if (w !== 'draw') {
        setScores((s) => ({ ...s, [w]: s[w as 'X' | 'O'] + 1 }))
        if (w === mySymbol) sound.win()
        else sound.lose()
      } else {
        sound.draw()
      }
      saveResult(w)
    } else {
      sound.move()
      setCurrentTurn(currentTurn === 'X' ? 'O' : 'X')
    }

    if (isMultiplayer) {
      updateRoomState({ board: newBoard, turn: currentTurn === 'X' ? 'O' : 'X', opponent: playerName })
      if (w) setRoomStatus('finished')
    }
  }

  async function saveResult(w: Winner) {
    if (!isAuthenticated || !user) return
    const result = w === 'draw' ? 'draw' : w === mySymbol ? 'win' : 'loss'
    await supabase.from('game_results').insert({
      user_id: user.id,
      player_name: playerName,
      game: 'tictactoe',
      result,
      opponent: mode === 'ai' ? 'AI' : opponentName,
      score: 0,
      best_tile: 0,
      time_played: 0,
    })
  }

  function resetGame() {
    setBoard(Array(9).fill(null))
    setWinner(null)
    setWinLine(null)
    setCurrentTurn('X')
    if (isMultiplayer) updateRoomState({ board: Array(9).fill(null), turn: 'X' })
  }

  const statusText = winner
    ? winner === 'draw'
      ? 'เสมอ!'
      : winner === mySymbol
      ? 'คุณชนะ! 🎉'
      : 'แพ้แล้ว...'
    : aiThinking
    ? 'AI กำลังคิด...'
    : isMyTurn
    ? 'ตาของคุณ'
    : 'รอผู้เล่นอีกฝั่ง'

  const opponent = mode === 'ai' ? 'AI (Claude)' : opponentName

  return (
    <GameLayout
      title="โอ-ซี"
      status={statusText}
      statusColor={winner ? (winner === mySymbol ? 'green' : winner === 'draw' ? 'default' : 'red') : 'accent'}
      topLeft={
        <PlayerCard
          name={playerName}
          avatar={avatarUrl}
          label={`ผู้เล่น (${mySymbol})`}
          active={currentTurn === mySymbol && !winner}
          score={scores[mySymbol]}
        />
      }
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard
            name={opponent}
            label={`ฝ่ายตรงข้าม (${mySymbol === 'X' ? 'O' : 'X'})`}
            active={currentTurn !== mySymbol && !winner}
            score={scores[mySymbol === 'X' ? 'O' : 'X']}
            flip
          />
          {isMultiplayer && roomId && <RoomCode code={roomId} />}
        </div>
      }
    >
      {/* Board */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
        {board.map((cell, i) => {
          const isWinCell = winLine?.includes(i)
          return (
            <motion.button
              key={i}
              whileHover={!cell && isMyTurn && !winner ? { scale: 1.05 } : {}}
              whileTap={!cell && isMyTurn && !winner ? { scale: 0.95 } : {}}
              onClick={() => handleCellClick(i)}
              className={`aspect-square rounded-2xl border-2 text-4xl font-bold flex items-center justify-center transition-all ${
                isWinCell
                  ? 'border-accent bg-accent/20'
                  : cell
                  ? 'border-white/20 bg-surface'
                  : isMyTurn && !winner
                  ? 'border-white/10 bg-surface hover:border-white/30 hover:bg-surface2 cursor-pointer'
                  : 'border-white/10 bg-surface cursor-default'
              }`}
            >
              <AnimatePresence>
                {cell && (
                  <motion.span
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className={cell === 'X' ? 'text-red' : 'text-purple'}
                  >
                    {CELL_SYMBOLS[cell]}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </div>

      {/* Result actions */}
      {winner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex gap-3"
        >
          <button
            onClick={resetGame}
            className="bg-accent text-bg px-6 py-2 rounded-full font-bold text-sm hover:brightness-110 transition-all"
          >
            เล่นอีกครั้ง
          </button>
        </motion.div>
      )}

      <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
      {isMultiplayer && roomId && <ChatBox roomId={roomId} playerName={playerName} />}
    </GameLayout>
  )
}

export default function Page() {
  return (
    <Suspense>
      <TictactoePage />
    </Suspense>
  )
}
