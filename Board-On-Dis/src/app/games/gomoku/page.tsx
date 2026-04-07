'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import PlayerCard from '@/components/game/PlayerCard'
import RoomCode from '@/components/game/RoomCode'
import CoinFlip from '@/components/game/CoinFlip'
import ChatBox from '@/components/game/ChatBox'
import WaitingRoom from '@/components/game/phases/WaitingRoom'
import SetupRoom from '@/components/game/phases/SetupRoom'
import GameResult from '@/components/game/phases/GameResult'
import Confetti from '@/components/ui/Confetti'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom'
import { checkWinner, emptyBoard } from '@/lib/games/gomoku'
import { sound } from '@/lib/sound'
import { saveGameResult } from '@/lib/saveGameResult'
import { COLOR_OPTIONS } from '@/types/room'
import type { Board, Winner } from '@/lib/games/gomoku'

const SIZE = 15

function GomokuPage() {
  const { playerName, avatarUrl, userId, isAuthenticated, roomId, mode, isHost } = usePlayerInfo()
  const [board, setBoard] = useState<Board>(emptyBoard())
  const [currentTurn, setCurrentTurn] = useState<1 | 2>(1)
  const [winner, setWinner] = useState<Winner>(null)
  const [myPlayer, setMyPlayer] = useState<1 | 2>(1)
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [lastMove, setLastMove] = useState<[number, number] | null>(null)
  const [selectedColor, setSelectedColor] = useState('purple')

  const isMultiplayer = mode === 'multiplayer' && !!roomId

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
      if (state.currentGameTurn) setCurrentTurn(state.currentGameTurn as 1 | 2)
      if (state.lastMove) setLastMove(state.lastMove as [number, number])
    }, []),
  })

  useEffect(() => {
    if (!isMultiplayer || !firstTurn) return
    setMyPlayer(myPlayerNum)
  }, [firstTurn, myPlayerNum, isMultiplayer])

  useEffect(() => {
    if (!isMultiplayer || phase !== 'coin_flip' || !hostInfo || !guestInfo) return
    const firstPlayerName = roomTurn === 'host' ? hostInfo.name : guestInfo.name
    setCoinWinner(firstPlayerName)
  }, [phase, isMultiplayer]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'ai' || gameStarted) return
    const flip = Math.random() < 0.5
    setMyPlayer(1)
    setTimeout(() => setCoinWinner(flip ? playerName : 'AI'), 300)
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
    if (!gameStarted) return
    if (isMultiplayer && !isMyRoomTurn) return
    if (!isAI && mode === 'ai' && currentTurn !== myPlayer) return

    const newBoard = board.map((row) => [...row]) as Board
    newBoard[r][c] = currentTurn
    const w = checkWinner(newBoard)
    setBoard(newBoard)
    setLastMove([r, c])

    if (w) {
      setWinner(w)
      if (w === myPlayer) sound.win(); else sound.lose()
      saveResult(w)
      if (isMultiplayer) {
        const roomWin = w === myPlayer ? (isHost ? 'host' : 'guest') : (isHost ? 'guest' : 'host')
        finishGame(roomWin as 'host' | 'guest')
      }
    } else {
      sound.move()
      const nextTurn: 1 | 2 = currentTurn === 1 ? 2 : 1
      setCurrentTurn(nextTurn)
      if (isMultiplayer) {
        const nextRoomTurn = isHost ? 'guest' : 'host'
        updateGameData({
          board: newBoard,
          currentGameTurn: nextTurn,
          currentTurn: nextRoomTurn,
          lastMove: [r, c],
        })
      }
    }
  }

  function saveResult(w: Winner) {
    if (!isAuthenticated || !userId || !w) return
    saveGameResult({
      userId, playerName, game: 'gomoku',
      result: w === myPlayer ? 'win' : 'loss',
      opponent: mode === 'ai' ? 'AI' : (opponentInfo?.name ?? 'เพื่อน'),
    })
  }

  function handleRematch() {
    requestRematch({ board: emptyBoard(), currentGameTurn: 1, currentTurn: 'host', lastMove: null })
  }

  const CELL = 28
  const isMyActiveTurn = isMultiplayer ? isMyRoomTurn : currentTurn === myPlayer
  const opponentName = isMultiplayer ? (opponentInfo?.name ?? 'รอผู้เล่น...') : 'AI (Claude)'

  // ---- MULTIPLAYER PHASE RENDERING ----
  if (isMultiplayer) {
    if (phase === 'waiting' && isHost) {
      return <GameLayout title="โกะ / Gomoku"><WaitingRoom roomCode={roomId} /></GameLayout>
    }
    if (phase === 'setup' || (phase === 'waiting' && !isHost)) {
      return (
        <GameLayout title="โกะ / Gomoku">
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
    if (phase === 'coin_flip') {
      const firstPlayerName = roomTurn === 'host' ? (hostInfo?.name ?? '') : (guestInfo?.name ?? '')
      return (
        <GameLayout title="โกะ / Gomoku">
          <CoinFlip winner={firstPlayerName} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
        </GameLayout>
      )
    }
  }

  const confettiWinner = isMultiplayer
    ? roomWinner !== 'draw' && roomWinner === (isHost ? 'host' : 'guest')
    : winner !== null && winner === myPlayer

  return (
    <GameLayout
      title="โกะ / Gomoku"
      status={winner ? (winner === myPlayer ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...') : aiThinking ? 'AI กำลังคิด...' : isMyActiveTurn ? 'ตาของคุณ' : 'รอคู่ต่อสู้'}
      statusColor={winner ? (winner === myPlayer ? 'green' : 'red') : 'accent'}
      topLeft={
        <PlayerCard
          name={isMultiplayer ? (hostInfo?.name ?? playerName) : playerName}
          avatar={isMultiplayer ? hostInfo?.avatarUrl : avatarUrl}
          label="ผู้เล่น (●)"
          active={isMultiplayer ? roomTurn === 'host' && !winner : currentTurn === (isHost ? myPlayer : (myPlayer === 1 ? 2 : 1)) && !winner}
        />
      }
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard
            name={isMultiplayer ? (guestInfo?.name ?? 'รอผู้เล่น...') : opponentName}
            avatar={isMultiplayer ? guestInfo?.avatarUrl : undefined}
            label="ฝ่ายตรงข้าม (○)"
            active={isMultiplayer ? roomTurn === 'guest' && !winner : currentTurn !== myPlayer && !winner}
            flip
          />
          {isMultiplayer && roomId && <RoomCode code={roomId} />}
        </div>
      }
    >
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

      <div className="overflow-auto max-w-full">
        <div
          className="relative bg-surface2 border border-white/10 rounded-xl"
          style={{ width: SIZE * CELL + 20, height: SIZE * CELL + 20, padding: 10 }}
        >
          <svg className="absolute inset-0 pointer-events-none" width={SIZE * CELL + 20} height={SIZE * CELL + 20}>
            {Array.from({ length: SIZE }).map((_, i) => (
              <g key={i}>
                <line x1={10 + i * CELL + CELL/2} y1={10 + CELL/2} x2={10 + i * CELL + CELL/2} y2={10 + (SIZE-1) * CELL + CELL/2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <line x1={10 + CELL/2} y1={10 + i * CELL + CELL/2} x2={10 + (SIZE-1) * CELL + CELL/2} y2={10 + i * CELL + CELL/2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              </g>
            ))}
          </svg>

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
                  ) : isMyActiveTurn && !winner ? (
                    <div className="w-5 h-5 rounded-full bg-white/0 group-hover:bg-white/20 transition-colors" />
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>

      {winner && mode === 'ai' && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => { setBoard(emptyBoard()); setWinner(null); setCurrentTurn(1); setLastMove(null); setGameStarted(false); setTimeout(() => setCoinWinner(Math.random() < 0.5 ? playerName : 'AI'), 300) }}
          className="mt-4 bg-accent text-bg px-6 py-2 rounded-full font-bold text-sm hover:brightness-110"
        >
          เล่นอีกครั้ง
        </motion.button>
      )}

      <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
      {isMultiplayer && roomId && <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><GomokuPage /></Suspense>
}
