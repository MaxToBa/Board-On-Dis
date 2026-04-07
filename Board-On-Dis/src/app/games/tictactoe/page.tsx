'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import PlayerCard from '@/components/game/PlayerCard'
import RoomCode from '@/components/game/RoomCode'
import CoinFlip from '@/components/game/CoinFlip'
import ChatBox from '@/components/game/ChatBox'
import WaitingRoom from '@/components/game/phases/WaitingRoom'
import SetupRoom from '@/components/game/phases/SetupRoom'
import GameResult from '@/components/game/phases/GameResult'
import AiGameResult from '@/components/game/AiGameResult'
import Confetti from '@/components/ui/Confetti'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom'
import { checkWinner, getAvailableMoves, getWinLine } from '@/lib/games/tictactoe'
import { sound } from '@/lib/sound'
import { saveGameResult } from '@/lib/saveGameResult'
import { COLOR_OPTIONS } from '@/types/room'
import type { Board, Winner } from '@/lib/games/tictactoe'

const CELL_SYMBOLS = { X: '✕', O: '◯' }

function TictactoePage() {
  const { playerName, avatarUrl, userId, isAuthenticated, roomId, mode, isHost, difficulty } = usePlayerInfo()

  const [board, setBoard] = useState<Board>(Array(9).fill(null))
  const [currentTurn, setCurrentTurn] = useState<'X' | 'O'>('X')
  const [winner, setWinner] = useState<Winner>(null)
  const [winLine, setWinLine] = useState<number[] | null>(null)
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [mySymbol, setMySymbol] = useState<'X' | 'O'>('X')
  const [aiThinking, setAiThinking] = useState(false)
  const [scores, setScores] = useState({ X: 0, O: 0 })
  const [selectedColor, setSelectedColor] = useState('purple')

  const isMultiplayer = mode === 'multiplayer' && !!roomId

  // Multiplayer room hook
  const {
    phase, hostInfo, guestInfo, myInfo, opponentInfo,
    firstTurn, currentTurn: roomTurn, winner: roomWinner,
    rematchVotes, isMyTurn: isMyRoomTurn, myPlayerNum,
    markReady, updateGameData, finishGame, requestRematch,
  } = useMultiplayerRoom({
    roomId: isMultiplayer ? roomId : '',
    isHost,
    playerName,
    avatarUrl,
    userId,
    onGameStateChange: useCallback((state: Record<string, unknown>) => {
      if (state.board) { setBoard(state.board as Board); setGameStarted(true) }
      if (state.currentGameTurn) setCurrentTurn(state.currentGameTurn as 'X' | 'O')
    }, []),
  })

  // Set mySymbol when firstTurn resolves
  useEffect(() => {
    if (!isMultiplayer) return
    if (firstTurn) {
      setMySymbol(myPlayerNum === 1 ? 'X' : 'O')
    }
  }, [firstTurn, myPlayerNum, isMultiplayer])

  // Show coin flip animation when phase changes to coin_flip
  useEffect(() => {
    if (!isMultiplayer || phase !== 'coin_flip') return
    if (!hostInfo || !guestInfo) return
    const firstPlayerName = roomTurn === 'host' ? hostInfo.name : guestInfo.name
    setCoinWinner(firstPlayerName)
  }, [phase, isMultiplayer]) // eslint-disable-line react-hooks/exhaustive-deps

  // When phase moves to playing (after coin flip), start game
  useEffect(() => {
    if (!isMultiplayer || phase !== 'playing') return
    if (!gameStarted && coinWinner) {
      // coinWinner is still shown, CoinFlip.onDone will set gameStarted
    }
  }, [phase, isMultiplayer]) // eslint-disable-line react-hooks/exhaustive-deps

  // AI: solo coin flip
  useEffect(() => {
    if (mode !== 'ai' || gameStarted) return
    const aiFirst = Math.random() < 0.5
    // If AI first → AI is X (goes first), player is O
    // If player first → player is X, AI is O
    setMySymbol(aiFirst ? 'O' : 'X')
    setTimeout(() => setCoinWinner(aiFirst ? 'AI' : playerName), 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // AI move — fires when it's NOT the player's turn
  useEffect(() => {
    if (mode !== 'ai' || currentTurn === mySymbol || winner || !gameStarted) return
    setAiThinking(true)
    const available = getAvailableMoves(board)
    if (!available.length) return

    fetch('/api/ai/tictactoe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, difficulty }),
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
  }, [currentTurn, gameStarted, mySymbol]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCellClick(index: number, isAI = false) {
    if (board[index] || winner) return
    if (!gameStarted) return
    if (isMultiplayer && !isMyRoomTurn) return
    if (!isAI && mode === 'ai' && currentTurn !== mySymbol) return

    const newBoard = [...board]
    newBoard[index] = currentTurn
    const w = checkWinner(newBoard)
    const wl = getWinLine(newBoard)

    setBoard(newBoard)
    setWinLine(wl)

    if (w) {
      setWinner(w)
      if (w !== 'draw') {
        setScores((s) => ({ ...s, [w]: (s[w as 'X' | 'O'] ?? 0) + 1 }))
        if (w === mySymbol) sound.win()
        else sound.lose()
      } else {
        sound.draw()
      }
      saveResult(w)
      if (isMultiplayer) {
        const roomWin = w === 'draw' ? 'draw' : w === mySymbol ? (isHost ? 'host' : 'guest') : (isHost ? 'guest' : 'host')
        finishGame(roomWin as 'host' | 'guest' | 'draw')
      }
    } else {
      sound.move()
      const nextTurn = currentTurn === 'X' ? 'O' : 'X'
      setCurrentTurn(nextTurn)
      if (isMultiplayer) {
        const nextRoomTurn = isHost ? 'guest' : 'host'
        updateGameData({
          board: newBoard,
          currentGameTurn: nextTurn,
          currentTurn: nextRoomTurn,
        })
      }
    }
  }

  function saveResult(w: Winner) {
    if (!isAuthenticated || !userId || !w) return
    const result = w === 'draw' ? 'draw' : w === mySymbol ? 'win' : 'loss'
    const opponent = mode === 'ai' ? 'AI' : (opponentInfo?.name ?? 'เพื่อน')
    saveGameResult({ userId, playerName, game: 'tictactoe', result, opponent })
  }

  function resetAiGame() {
    setBoard(Array(9).fill(null))
    setWinner(null)
    setWinLine(null)
    setCurrentTurn('X')
    setGameStarted(false)
    const aiFirst = Math.random() < 0.5
    setMySymbol(aiFirst ? 'O' : 'X')
    setTimeout(() => setCoinWinner(aiFirst ? 'AI' : playerName), 300)
  }

  function handleRematch() {
    requestRematch({ board: Array(9).fill(null), currentGameTurn: 'X', currentTurn: 'host' })
  }

  // Compute status text
  const isMyActiveTurn = isMultiplayer ? isMyRoomTurn : currentTurn === mySymbol
  const diffLabel: Record<string, string> = { easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก' }
  const opponentName = isMultiplayer ? (opponentInfo?.name ?? 'รอผู้เล่น...') : `AI (${diffLabel[difficulty] ?? 'กลาง'})`
  const aiSymbol = mySymbol === 'X' ? 'O' : 'X'
  const statusText = winner
    ? winner === 'draw' ? 'เสมอ!' : winner === mySymbol ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...'
    : aiThinking ? 'AI กำลังคิด...'
    : isMyActiveTurn ? 'ตาของคุณ'
    : 'รอผู้เล่นอีกฝั่ง'

  // ---- MULTIPLAYER PHASE RENDERING ----
  if (isMultiplayer) {
    // Waiting room
    if (phase === 'waiting' && isHost) {
      return (
        <GameLayout title="โอ-ซี">
          <WaitingRoom roomCode={roomId} />
        </GameLayout>
      )
    }

    // Setup (both players present, choose color)
    if (phase === 'setup' || (phase === 'waiting' && !isHost)) {
      return (
        <GameLayout title="โอ-ซี">
          <SetupRoom
            myInfo={myInfo ?? null}
            opponentInfo={opponentInfo ?? null}
            colorOptions={COLOR_OPTIONS}
            selectedColor={selectedColor}
            onSelectColor={setSelectedColor}
            onReady={() => markReady(selectedColor)}
          />
        </GameLayout>
      )
    }

    // Coin flip phase
    if (phase === 'coin_flip') {
      const firstPlayerName = roomTurn === 'host' ? (hostInfo?.name ?? '') : (guestInfo?.name ?? '')
      return (
        <GameLayout title="โอ-ซี">
          <CoinFlip
            winner={firstPlayerName}
            onDone={() => { setCoinWinner(null); setGameStarted(true) }}
          />
          {/* Show blank board behind */}
          <div className="opacity-0 pointer-events-none grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
            {Array(9).fill(null).map((_, i) => (
              <div key={i} className="aspect-square" />
            ))}
          </div>
        </GameLayout>
      )
    }
  }

  // ---- GAME BOARD RENDERING (playing + finished + AI) ----
  const confettiWinner = isMultiplayer
    ? roomWinner !== 'draw' && roomWinner === (isHost ? 'host' : 'guest')
    : winner !== 'draw' && winner === mySymbol

  return (
    <GameLayout
      title="โอ-ซี"
      status={statusText}
      statusColor={
        winner
          ? winner === mySymbol ? 'green' : winner === 'draw' ? 'default' : 'red'
          : 'accent'
      }
      topLeft={
        <PlayerCard
          name={isMultiplayer ? (hostInfo?.name ?? playerName) : playerName}
          avatar={isMultiplayer ? hostInfo?.avatarUrl : avatarUrl}
          label={`ผู้เล่น (${isMultiplayer ? (isHost ? mySymbol : aiSymbol) : mySymbol})`}
          active={isMultiplayer ? roomTurn === 'host' && !winner : currentTurn === mySymbol && !winner}
          score={isMultiplayer ? hostInfo?.score : scores[mySymbol]}
        />
      }
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard
            name={isMultiplayer ? (guestInfo?.name ?? 'รอผู้เล่น...') : opponentName}
            avatar={isMultiplayer ? guestInfo?.avatarUrl : undefined}
            label={`ฝ่ายตรงข้าม (${isMultiplayer ? (isHost ? aiSymbol : mySymbol) : aiSymbol})`}
            active={isMultiplayer ? roomTurn === 'guest' && !winner : currentTurn !== mySymbol && !winner}
            score={isMultiplayer ? guestInfo?.score : scores[aiSymbol]}
            flip
          />
          {isMultiplayer && roomId && <RoomCode code={roomId} />}
        </div>
      }
    >
      {/* Game Result Overlay */}
      {isMultiplayer && phase === 'finished' && roomWinner && hostInfo && guestInfo && (
        <GameResult
          winner={roomWinner}
          hostInfo={hostInfo}
          guestInfo={guestInfo}
          myName={playerName}
          rematchVotes={rematchVotes}
          onRematch={handleRematch}
        />
      )}
      <Confetti active={!!winner && confettiWinner && (mode === 'ai' || phase === 'finished')} />

      {/* Board */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
        {board.map((cell, i) => {
          const isWinCell = winLine?.includes(i)
          const canClick = !cell && !winner && gameStarted && (isMultiplayer ? isMyRoomTurn : currentTurn === mySymbol)
          return (
            <motion.button
              key={i}
              whileHover={canClick ? { scale: 1.05 } : {}}
              whileTap={canClick ? { scale: 0.95 } : {}}
              onClick={() => handleCellClick(i)}
              className={`aspect-square rounded-2xl border-2 text-4xl font-bold flex items-center justify-center transition-all ${
                isWinCell
                  ? 'border-accent bg-accent/20'
                  : cell
                  ? 'border-white/20 bg-surface'
                  : canClick
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

      {winner && mode === 'ai' && (
        <AiGameResult
          result={winner === 'draw' ? 'draw' : winner === mySymbol ? 'win' : 'loss'}
          playerName={playerName}
          aiName={opponentName}
          onRestart={resetAiGame}
        />
      )}

      <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
      {isMultiplayer && roomId && <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />}
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
