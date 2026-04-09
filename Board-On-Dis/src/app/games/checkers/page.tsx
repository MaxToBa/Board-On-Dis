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
import { initialBoard, getValidMoves, getChainJumps, applyMove, checkWinner } from '@/lib/games/checkers'
import { sound } from '@/lib/sound'
import { saveGameResult } from '@/lib/saveGameResult'
import { COLOR_OPTIONS } from '@/types/room'
import type { Board, Move } from '@/lib/games/checkers'

function CheckersPage() {
  const { playerName, avatarUrl, userId, isAuthenticated, roomId, mode, isHost, difficulty } = usePlayerInfo()
  const [board, setBoard] = useState<Board>(initialBoard())
  const [currentTurn, setCurrentTurn] = useState<1 | 2>(1)
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [validMoves, setValidMoves] = useState<Move[]>([])
  const [winner, setWinner] = useState<1 | 2 | null>(null)
  const [myPlayer, setMyPlayer] = useState<1 | 2>(1)
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [selectedColor, setSelectedColor] = useState('red')
  const [chainJump, setChainJump] = useState<[number, number] | null>(null)

  const isMultiplayer = mode === 'multiplayer' && !!roomId
  const isFlipped = myPlayer === 2

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
      if (state.board) {
        setBoard(state.board as Board)
        setGameStarted(true)
        setWinner(null)
        setSelected(null)
        setValidMoves([])
      }
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

  useEffect(() => {
    if (mode !== 'ai' || gameStarted) return
    const aiFirst = Math.random() < 0.5
    setMyPlayer(1)
    if (aiFirst) setCurrentTurn(2)
    setTimeout(() => setCoinWinner(aiFirst ? 'AI' : 'คุณ'), 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'ai' || currentTurn !== 2 || winner || !gameStarted) return
    setAiThinking(true)
    fetch('/api/ai/checkers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, difficulty }),
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
    setBoard(newBoard)
    setSelected(null)
    sound.capture()

    // Chain jump: if this was a capture, check for follow-up jumps
    if (mv.captures.length > 0) {
      const chains = getChainJumps(newBoard, mv.to, currentTurn)
      if (chains.length > 0) {
        setChainJump(mv.to)
        setSelected(mv.to)
        setValidMoves(chains)
        if (isMultiplayer) {
          updateGameData({ board: newBoard, currentGameTurn: currentTurn, currentTurn: isHost ? 'host' : 'guest' })
        }
        return
      }
    }

    setChainJump(null)
    setValidMoves([])
    const w = checkWinner(newBoard)
    if (w) {
      setWinner(w)
      if (w === myPlayer) sound.win(); else sound.lose()
      saveResult(w)
      if (isMultiplayer) {
        const roomWin = w === myPlayer ? (isHost ? 'host' : 'guest') : (isHost ? 'guest' : 'host')
        finishGame(roomWin as 'host' | 'guest')
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

  function handleCellClick(r: number, c: number) {
    if (!gameStarted) return
    if (isMultiplayer && !isMyRoomTurn) return
    if (!isMultiplayer && mode === 'ai' && currentTurn !== myPlayer) return
    if (winner) return

    // During chain jump: only allow clicking valid chain targets
    if (chainJump) {
      const mv = validMoves.find((m) => m.to[0] === r && m.to[1] === c)
      if (mv) { applyMoveAndUpdate(mv); return }
      return
    }

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

  function saveResult(w: 1 | 2) {
    if (!isAuthenticated || !userId) return
    saveGameResult({
      userId, playerName, game: 'checkers',
      result: w === myPlayer ? 'win' : 'loss',
      opponent: mode === 'ai' ? 'AI' : (opponentInfo?.name ?? 'เพื่อน'),
    })
  }

  function handleRematch() {
    setChainJump(null)
    requestRematch({ board: initialBoard(), currentGameTurn: 1, currentTurn: 'host' })
  }

  const rows = isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7]
  const cols = isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7]
  const isValidDest = (r: number, c: number) => validMoves.some((m) => m.to[0] === r && m.to[1] === c)
  const isMyActiveTurn = isMultiplayer ? isMyRoomTurn : currentTurn === myPlayer
  const diffLabel: Record<string, string> = { easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก' }
  const opponentName = isMultiplayer ? (opponentInfo?.name ?? 'รอผู้เล่น...') : `AI (${diffLabel[difficulty] ?? 'กลาง'})`

  // ---- MULTIPLAYER PHASE RENDERING ----
  if (isMultiplayer) {
    if (phase === 'waiting' && isHost) {
      return <GameLayout title="หมากฮอส"><WaitingRoom roomCode={roomId} /></GameLayout>
    }
    if (phase === 'setup' || (phase === 'waiting' && !isHost)) {
      return (
        <GameLayout title="หมากฮอส">
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
        <GameLayout title="หมากฮอส">
          <CoinFlip winner={fpName} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
          <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />
        </GameLayout>
      )
    }
  }

  const confettiWinner = isMultiplayer
    ? roomWinner !== 'draw' && roomWinner === (isHost ? 'host' : 'guest')
    : winner !== null && winner === myPlayer

  return (
    <GameLayout
      title="หมากฮอส"
      status={winner ? (winner === myPlayer ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...') : aiThinking ? 'AI กำลังคิด...' : isMyActiveTurn ? 'ตาของคุณ' : 'รอคู่ต่อสู้'}
      statusColor={winner ? (winner === myPlayer ? 'green' : 'red') : 'accent'}
      topLeft={
        <PlayerCard
          name={isMultiplayer ? (hostInfo?.name ?? playerName) : playerName}
          avatar={isMultiplayer ? hostInfo?.avatarUrl : avatarUrl}
          label="คุณ (แดง)"
          active={isMultiplayer ? roomTurn === 'host' && !winner : currentTurn === myPlayer && !winner}
        />
      }
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard
            name={isMultiplayer ? (guestInfo?.name ?? 'รอผู้เล่น...') : opponentName}
            avatar={isMultiplayer ? guestInfo?.avatarUrl : undefined}
            label="ฝ่ายตรงข้าม (ดำ)"
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

      {winner && mode === 'ai' && (
        <AiGameResult
          result={winner === myPlayer ? 'win' : 'loss'}
          playerName={playerName}
          aiName={opponentName}
          onRestart={() => {
            const aiFirst = Math.random() < 0.5
            setBoard(initialBoard()); setWinner(null); setCurrentTurn(aiFirst ? 2 : 1); setSelected(null); setValidMoves([]); setChainJump(null); setGameStarted(false)
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
  return <Suspense><CheckersPage /></Suspense>
}
