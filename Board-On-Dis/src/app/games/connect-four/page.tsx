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
import AiGameResult from '@/components/game/AiGameResult'
import Confetti from '@/components/ui/Confetti'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom'
import { emptyBoard, dropPiece, checkWinner, getAvailableCols, ROWS, COLS } from '@/lib/games/connect-four'
import { sound } from '@/lib/sound'
import { saveGameResult } from '@/lib/saveGameResult'
import { COLOR_OPTIONS } from '@/types/room'
import type { Board, Winner } from '@/lib/games/connect-four'

function ConnectFourPage() {
  const { playerName, avatarUrl, userId, isAuthenticated, roomId, mode, isHost, difficulty } = usePlayerInfo()
  const [board, setBoard] = useState<Board>(emptyBoard())
  const [currentTurn, setCurrentTurn] = useState<1 | 2>(1)
  const [winner, setWinner] = useState<Winner>(null)
  const [myPlayer, setMyPlayer] = useState<1 | 2>(1)
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [selectedColor, setSelectedColor] = useState('red')

  const isMultiplayer = mode === 'multiplayer' && !!roomId

  const {
    phase, hostInfo, guestInfo, myInfo, opponentInfo,
    firstTurn, currentTurn: roomTurn, winner: roomWinner,
    rematchVotes, isMyTurn: isMyRoomTurn, myPlayerNum,
    markReady, markUnready, updateGameData, finishGame, requestRematch,
  } = useMultiplayerRoom({
    roomId: isMultiplayer ? roomId : '',
    isHost,
    playerName,
    avatarUrl,
    userId,
    onGameStateChange: useCallback((state: Record<string, unknown>) => {
      if (state.board) { setBoard(state.board as Board); setGameStarted(true); setWinner(null) }
      if (state.currentGameTurn) setCurrentTurn(state.currentGameTurn as 1 | 2)
    }, []),
  })

  useEffect(() => {
    if (!isMultiplayer || !firstTurn) return
    setMyPlayer(myPlayerNum)
  }, [firstTurn, myPlayerNum, isMultiplayer])

  useEffect(() => {
    if (!isMultiplayer || phase !== 'coin_flip' || !hostInfo || !guestInfo) return
    const iGoFirst = roomTurn === (isHost ? 'host' : 'guest')
    setCoinWinner(iGoFirst ? 'คุณ' : (isHost ? guestInfo.name : hostInfo.name))
  }, [phase, isMultiplayer, roomTurn]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isMultiplayer || phase === 'coin_flip') return
    setCoinWinner(null)
  }, [phase, isMultiplayer])

  // AI mode: coin flip
  useEffect(() => {
    if (mode !== 'ai' || gameStarted) return
    const aiFirst = Math.random() < 0.5
    setMyPlayer(1)
    if (aiFirst) setCurrentTurn(2)
    setTimeout(() => setCoinWinner(aiFirst ? 'AI' : 'คุณ'), 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // AI move — fires when it's AI's turn (player 2)
  useEffect(() => {
    if (mode !== 'ai' || currentTurn !== 2 || winner || !gameStarted) return
    setAiThinking(true)
    fetch('/api/ai/connect-four', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, difficulty }),
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
    if (!gameStarted) return
    if (isMultiplayer && !isMyRoomTurn) return
    if (!isAI && mode === 'ai' && currentTurn !== myPlayer) return

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
      if (isMultiplayer) {
        const roomWin = w === 'draw' ? 'draw' : w === myPlayer ? (isHost ? 'host' : 'guest') : (isHost ? 'guest' : 'host')
        finishGame(roomWin as 'host' | 'guest' | 'draw')
      }
    } else {
      const nextTurn: 1 | 2 = currentTurn === 1 ? 2 : 1
      setCurrentTurn(nextTurn)
      if (isMultiplayer) {
        const nextRoomTurn = isHost ? 'guest' : 'host'
        updateGameData({ board: newBoard, currentGameTurn: nextTurn, currentTurn: nextRoomTurn })
      }
    }
  }

  function saveResult(w: Winner) {
    if (!isAuthenticated || !userId || !w) return
    saveGameResult({
      userId, playerName, game: 'connect-four',
      result: w === 'draw' ? 'draw' : w === myPlayer ? 'win' : 'loss',
      opponent: mode === 'ai' ? 'AI' : (opponentInfo?.name ?? 'เพื่อน'),
    })
  }

  function handleRematch() {
    requestRematch({ board: emptyBoard(), currentGameTurn: 1, currentTurn: 'host' })
  }

  // Color dots: player1 = red, player2 = yellow
  const myColor = myPlayer === 1 ? 'bg-red' : 'bg-accent'
  const oppColor = myPlayer === 1 ? 'bg-accent' : 'bg-red'
  const isMyActiveTurn = isMultiplayer ? isMyRoomTurn : !winner && currentTurn === myPlayer
  const diffLabel: Record<string, string> = { easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก' }
  const opponentName = isMultiplayer ? (opponentInfo?.name ?? 'รอผู้เล่น...') : `AI (${diffLabel[difficulty] ?? 'กลาง'})`

  // ---- MULTIPLAYER PHASE RENDERING ----
  if (isMultiplayer) {
    if (phase === 'waiting' && isHost) {
      return <GameLayout title="Connect Four"><WaitingRoom roomCode={roomId} /></GameLayout>
    }
    if (phase === 'setup' || (phase === 'waiting' && !isHost)) {
      return (
        <GameLayout title="Connect Four">
          <SetupRoom
            myInfo={myInfo ?? null} opponentInfo={opponentInfo ?? null}
            colorOptions={COLOR_OPTIONS} selectedColor={selectedColor}
            onSelectColor={setSelectedColor} onReady={() => markReady(selectedColor)} onUnready={markUnready}
          />
          <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />
        </GameLayout>
      )
    }
    if (phase === 'coin_flip') {
      const iGoFirst = roomTurn === (isHost ? 'host' : 'guest')
      const fpName = iGoFirst ? 'คุณ' : (isHost ? guestInfo?.name : hostInfo?.name) ?? 'เพื่อน'
      return (
        <GameLayout title="Connect Four">
          <CoinFlip winner={fpName} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
          <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />
        </GameLayout>
      )
    }
  }

  const confettiWinner = isMultiplayer
    ? roomWinner !== 'draw' && roomWinner === (isHost ? 'host' : 'guest')
    : winner !== null && winner !== 'draw' && winner === myPlayer

  return (
    <GameLayout
      title="Connect Four"
      status={
        winner
          ? winner === 'draw' ? 'เสมอ!' : winner === myPlayer ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...'
          : aiThinking ? 'AI กำลังคิด...'
          : isMyActiveTurn ? 'ตาของคุณ' : 'รอคู่ต่อสู้'
      }
      statusColor={winner ? (winner === 'draw' ? 'default' : winner === myPlayer ? 'green' : 'red') : 'accent'}
      topLeft={
        <PlayerCard
          name={isMultiplayer ? (hostInfo?.name ?? playerName) : playerName}
          avatar={isMultiplayer ? hostInfo?.avatarUrl : avatarUrl}
          label={`คุณ (${myPlayer === 1 ? '🔴' : '🟡'})`}
          active={isMultiplayer ? roomTurn === 'host' && !winner : currentTurn === myPlayer && !winner}
        />
      }
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard
            name={isMultiplayer ? (guestInfo?.name ?? 'รอผู้เล่น...') : opponentName}
            avatar={isMultiplayer ? guestInfo?.avatarUrl : undefined}
            label={`ฝ่ายตรงข้าม (${myPlayer === 1 ? '🟡' : '🔴'})`}
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

      <div className="bg-surface2 border border-white/10 rounded-2xl p-3 overflow-auto">
        {/* Drop indicators */}
        <div className="flex gap-2 mb-1">
          {Array.from({ length: COLS }).map((_, c) => (
            <div key={c} className="w-10 h-4 flex items-center justify-center">
              {hoverCol === c && isMyActiveTurn && !winner && (
                <motion.div initial={{ y: -4 }} animate={{ y: 0 }} className={`w-4 h-4 rounded-full ${myColor}`} />
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
                    cell === 1 ? 'bg-red border-transparent'
                    : cell === 2 ? 'bg-accent border-transparent'
                    : 'border-white/10 bg-surface hover:border-white/20'
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

      {winner && mode === 'ai' && (
        <AiGameResult
          result={winner === 'draw' ? 'draw' : winner === myPlayer ? 'win' : 'loss'}
          playerName={playerName}
          aiName={opponentName}
          onRestart={() => {
            const aiFirst = Math.random() < 0.5
            setBoard(emptyBoard()); setWinner(null); setCurrentTurn(aiFirst ? 2 : 1); setGameStarted(false)
            setTimeout(() => setCoinWinner(aiFirst ? 'AI' : 'คุณ'), 300)
          }}
        />
      )}

      <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
      {isMultiplayer && roomId && <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><ConnectFourPage /></Suspense>
}
