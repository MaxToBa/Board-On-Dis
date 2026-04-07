'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import PlayerCard from '@/components/game/PlayerCard'
import CoinFlip from '@/components/game/CoinFlip'
import ChatBox from '@/components/game/ChatBox'
import WaitingRoom from '@/components/game/phases/WaitingRoom'
import SetupRoom from '@/components/game/phases/SetupRoom'
import GameResult from '@/components/game/phases/GameResult'
import AiGameResult from '@/components/game/AiGameResult'
import Confetti from '@/components/ui/Confetti'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom'
import { createDeck, canPlay, getPlayableCards } from '@/lib/games/uno'
import { sound } from '@/lib/sound'
import { saveGameResult } from '@/lib/saveGameResult'
import { COLOR_OPTIONS } from '@/types/room'
import type { Card, Color } from '@/lib/games/uno'

const COLOR_BG: Record<Color, string> = {
  red: 'bg-red border-red/60',
  yellow: 'bg-accent border-accent/60 text-bg',
  green: 'bg-green border-green/60 text-bg',
  blue: 'bg-blue-500 border-blue-400',
  wild: 'bg-surface2 border-white/20',
}
const COLOR_RING: Record<Color, string> = {
  red: 'ring-red', yellow: 'ring-accent', green: 'ring-green', blue: 'ring-blue-400', wild: 'ring-white/30',
}

function cardDisplay(card: Card): string {
  if (card.value !== null) return String(card.value)
  if (card.type === 'wild4') return '+4'
  if (card.type === 'wild')  return '★'
  if (card.type === 'draw2') return '+2'
  if (card.type === 'skip')  return '⊘'
  if (card.type === 'reverse') return '↺'
  return '?'
}

function UnoPage() {
  const { playerName, avatarUrl, userId, isAuthenticated, roomId, mode, isHost } = usePlayerInfo()

  // Shared game state (both AI and multiplayer)
  const [deck,      setDeck]      = useState<Card[]>([])
  const [hand,      setHand]      = useState<Card[]>([])
  const [aiHand,    setAiHand]    = useState<Card[]>([])
  const [discard,   setDiscard]   = useState<Card[]>([])
  const [activeColor, setActiveColor] = useState<Color>('red')
  const [myTurn,    setMyTurn]    = useState(true)
  const [winner,    setWinner]    = useState<'me'|'ai'|'host'|'guest'|null>(null)
  const [coinWinner, setCoinWinner] = useState<string|null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [pickingColor, setPickingColor] = useState(false)
  const [pendingCard, setPendingCard]   = useState<Card|null>(null)
  const [aiThinking,  setAiThinking]    = useState(false)
  const [unoAlert,    setUnoAlert]      = useState<string|null>(null)
  const [selectedColor, setSelectedColor] = useState('red')

  const isMultiplayer = mode === 'multiplayer' && !!roomId

  // Multiplayer: track both hands (storing full arrays from DB)
  const [opponentHandCount, setOpponentHandCount] = useState(7)
  const [opponentHand, setOpponentHand] = useState<Card[]>([])

  // ── Multiplayer room hook ──
  const {
    phase, hostInfo, guestInfo, myInfo, opponentInfo,
    currentTurn: roomTurn, winner: roomWinner,
    rematchVotes,
    markReady, updateGameData, finishGame, requestRematch,
  } = useMultiplayerRoom({
    roomId: isMultiplayer ? roomId : '',
    isHost,
    playerName,
    avatarUrl,
    userId,
    onGameStateChange: useCallback((state: Record<string, unknown>) => {
      if (!isMultiplayer) return
      // Sync shared game state from DB
      const myHandKey  = isHost ? 'hostHand'  : 'guestHand'
      const oppHandKey = isHost ? 'guestHand' : 'hostHand'

      if (state[myHandKey]) setHand(state[myHandKey] as Card[])
      if (state[oppHandKey]) {
        const oppH = state[oppHandKey] as Card[]
        setOpponentHand(oppH)
        setOpponentHandCount(oppH.length)
      }
      if (state.deck)        setDeck(state.deck as Card[])
      if (state.discard)     setDiscard(state.discard as Card[])
      if (state.activeColor) setActiveColor(state.activeColor as Color)
      if (state.currentTurn) setMyTurn(state.currentTurn === (isHost ? 'host' : 'guest'))
      if (state.gameStarted) setGameStarted(true)
    }, [isMultiplayer, isHost]),
  })

  // ── Show coin flip when phase changes to coin_flip ──
  useEffect(() => {
    if (!isMultiplayer || phase !== 'coin_flip' || !hostInfo || !guestInfo) return
    const firstPlayerName = roomTurn === 'host' ? hostInfo.name : guestInfo.name
    setCoinWinner(firstPlayerName)
  }, [phase, isMultiplayer]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── When playing phase starts: host deals cards ──
  useEffect(() => {
    if (!isMultiplayer || phase !== 'playing' || gameStarted) return
    if (!isHost) return  // only host deals
    const d = createDeck()
    const hostCards  = d.splice(0, 7)
    const guestCards = d.splice(0, 7)
    let topCard = d.splice(0, 1)[0]
    while (topCard.type === 'wild4') { d.push(topCard); topCard = d.splice(0, 1)[0] }
    const firstTurnRole = roomTurn  // from coin flip

    // Store in DB
    updateGameData({
      hostHand:    hostCards,
      guestHand:   guestCards,
      deck:        d,
      discard:     [topCard],
      activeColor: topCard.color === 'wild' ? 'red' : topCard.color,
      currentTurn: firstTurnRole,
      gameStarted: true,
    })
    // Set local state for host
    setHand(hostCards)
    setOpponentHandCount(guestCards.length)
    setDeck(d)
    setDiscard([topCard])
    setActiveColor(topCard.color === 'wild' ? 'red' : topCard.color)
    setMyTurn(firstTurnRole === 'host')
    setGameStarted(true)
  }, [phase, isMultiplayer, isHost, gameStarted, roomTurn]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI mode: init game ──
  useEffect(() => {
    if (mode !== 'ai') return
    const d = createDeck()
    const myCards  = d.splice(0, 7)
    const aiCards  = d.splice(0, 7)
    let topCard    = d.splice(0, 1)[0]
    while (topCard.type === 'wild4') { d.push(topCard); topCard = d.splice(0, 1)[0] }
    setDeck(d); setHand(myCards); setAiHand(aiCards)
    setDiscard([topCard]); setActiveColor(topCard.color === 'wild' ? 'red' : topCard.color)
    const aiFirst = Math.random() < 0.5
    setMyTurn(!aiFirst) // if AI first, player doesn't go first
    setTimeout(() => setCoinWinner(aiFirst ? 'AI' : playerName), 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI turn ──
  useEffect(() => {
    if (!gameStarted || myTurn || winner || aiThinking || mode !== 'ai') return
    setAiThinking(true)
    setTimeout(() => {
      const topCard = discard[discard.length - 1]
      const playable = getPlayableCards(aiHand, topCard, activeColor)

      if (!playable.length) {
        const [drawn, ...restDeck] = deck
        if (drawn) { setAiHand(h => [...h, drawn]); setDeck(restDeck) }
        setMyTurn(true); setAiThinking(false); return
      }

      const card = playable[Math.floor(Math.random() * playable.length)]
      const newAiHand = aiHand.filter(c => c.id !== card.id)
      const newDiscard = [...discard, card]
      const newColor = card.color === 'wild' ? (['red','yellow','green','blue'] as Color[])[Math.floor(Math.random()*4)] : card.color
      setAiHand(newAiHand); setDiscard(newDiscard); setActiveColor(newColor); sound.cardPlay()

      if (newAiHand.length === 0) { setWinner('ai'); sound.lose(); saveResult('loss'); setAiThinking(false); return }
      if (newAiHand.length === 1) { setUnoAlert('AI ร้อง UNO!'); setTimeout(() => setUnoAlert(null), 2000) }

      let nextMyTurn = true
      if (card.type === 'skip') nextMyTurn = false
      if (card.type === 'reverse') nextMyTurn = false
      if (card.type === 'draw2') { drawCards(2, true); nextMyTurn = false }
      if (card.type === 'wild4') { drawCards(4, true); nextMyTurn = false }

      if (!nextMyTurn) {
        // AI gets another turn (skip/draw2/wild4): re-trigger by toggling myTurn briefly
        setTimeout(() => { setMyTurn(true); setTimeout(() => setMyTurn(false), 50); setAiThinking(false) }, 600)
      } else {
        setMyTurn(true); setAiThinking(false)
      }
    }, 900)
  }, [myTurn, gameStarted]) // eslint-disable-line react-hooks/exhaustive-deps

  function drawCards(count: number, forMe: boolean) {
    setDeck(d => {
      const drawn = d.slice(0, count); const rest = d.slice(count)
      if (forMe) setHand(h => [...h, ...drawn]); else setAiHand(h => [...h, ...drawn])
      return rest
    })
  }

  function playCard(card: Card) {
    if (!myTurn || !gameStarted) return
    const topCard = discard[discard.length - 1]
    if (!canPlay(card, topCard, activeColor)) return
    sound.cardPlay()

    const newHand = hand.filter(c => c.id !== card.id)

    if (newHand.length === 0) {
      setHand(newHand); setDiscard([...discard, card])
      if (isMultiplayer) {
        const myHandKey = isHost ? 'hostHand' : 'guestHand'
        const w = isHost ? 'host' : 'guest'
        updateGameData({ [myHandKey]: newHand, discard: [...discard, card] })
        finishGame(w)
      } else {
        setWinner('me'); sound.win(); saveResult('win')
      }
      return
    }
    if (newHand.length === 1) { setUnoAlert('UNO!'); setTimeout(() => setUnoAlert(null), 2000) }

    if (card.type === 'wild' || card.type === 'wild4') {
      setPendingCard(card); setPickingColor(true); setHand(newHand); return
    }

    applyCardEffect(card, newHand, [...discard, card], card.color)
  }

  function applyCardEffect(card: Card, newHand: Card[], newDiscard: Card[], color: Color) {
    setHand(newHand); setDiscard(newDiscard); setActiveColor(color)

    if (isMultiplayer) {
      const myHandKey  = isHost ? 'hostHand' : 'guestHand'
      const oppHandKey = isHost ? 'guestHand' : 'hostHand'
      let nextTurn: 'host' | 'guest' = isHost ? 'guest' : 'host'

      if (card.type === 'skip' || card.type === 'reverse') {
        nextTurn = isHost ? 'host' : 'guest'  // skip opponent's turn
      }

      const updates: Record<string, unknown> = {
        [myHandKey]: newHand,
        discard: newDiscard,
        activeColor: color,
        currentTurn: nextTurn,
      }

      if (card.type === 'draw2') {
        // Draw 2 from deck for opponent, skip their turn
        const drawn = deck.slice(0, 2)
        const newDeck = deck.slice(2)
        updates.deck = newDeck
        updates[oppHandKey] = [...opponentHand, ...drawn]
        updates.currentTurn = isHost ? 'host' : 'guest'  // opponent turn skipped
        setDeck(newDeck)
      }

      setMyTurn(nextTurn === (isHost ? 'host' : 'guest'))
      updateGameData(updates)
      return
    }

    // AI mode
    if (card.type === 'skip' || card.type === 'reverse') return  // skip AI
    if (card.type === 'draw2') { drawCards(2, false); return }
    setMyTurn(false)
  }

  function pickColor(color: Color) {
    if (!pendingCard) return
    const newDiscard = [...discard, pendingCard]
    setDiscard(newDiscard); setActiveColor(color)
    setPendingCard(null); setPickingColor(false)
    sound.cardPlay()

    if (isMultiplayer) {
      const myHandKey = isHost ? 'hostHand' : 'guestHand'
      const oppHandKey = isHost ? 'guestHand' : 'hostHand'
      const nextTurn: 'host' | 'guest' = pendingCard.type === 'wild4'
        ? (isHost ? 'host' : 'guest')  // wild4 skips opponent
        : (isHost ? 'guest' : 'host')
      const updates: Record<string, unknown> = {
        [myHandKey]: hand,
        discard: newDiscard,
        activeColor: color,
        currentTurn: nextTurn,
      }
      if (pendingCard.type === 'wild4') {
        const drawn = deck.slice(0, 4)
        const newDeck = deck.slice(4)
        updates.deck = newDeck
        updates[oppHandKey] = [...opponentHand, ...drawn]
        setDeck(newDeck)
      }
      setMyTurn(nextTurn === (isHost ? 'host' : 'guest'))
      updateGameData(updates)
    } else {
      if (pendingCard.type === 'wild4') drawCards(4, false)
      setMyTurn(false)
    }
  }

  function drawFromDeck() {
    if (!myTurn || !gameStarted) return
    const [card, ...rest] = deck
    if (!card) return
    setDeck(rest); setHand([...hand, card]); sound.move()

    if (isMultiplayer) {
      const myHandKey = isHost ? 'hostHand' : 'guestHand'
      const nextTurn: 'host' | 'guest' = isHost ? 'guest' : 'host'
      updateGameData({ [myHandKey]: [...hand, card], deck: rest, currentTurn: nextTurn })
      setMyTurn(false)
    } else {
      setMyTurn(false)
    }
  }

  function saveResult(result: 'win' | 'loss') {
    if (!isAuthenticated || !userId) return
    saveGameResult({
      userId, playerName, game: 'uno', result,
      opponent: mode === 'ai' ? 'AI' : (opponentInfo?.name ?? 'เพื่อน'),
    })
  }

  function handleRematch() {
    setDeck([]); setHand([]); setAiHand([]); setDiscard([])
    setWinner(null); setMyTurn(true); setGameStarted(false)
    requestRematch({ hostHand: [], guestHand: [], deck: [], discard: [], gameStarted: false })
  }

  const topCard  = discard[discard.length - 1]
  const playable = topCard ? getPlayableCards(hand, topCard, activeColor) : []
  const COLORS: Color[] = ['red', 'yellow', 'green', 'blue']

  // ── MULTIPLAYER PHASE RENDERING ──
  if (isMultiplayer) {
    if (phase === 'waiting' && isHost)
      return <GameLayout title="UNO"><WaitingRoom roomCode={roomId}/></GameLayout>
    if (phase === 'setup' || (phase === 'waiting' && !isHost))
      return (
        <GameLayout title="UNO">
          <SetupRoom
            myInfo={myInfo ?? null} opponentInfo={opponentInfo ?? null}
            colorOptions={COLOR_OPTIONS} selectedColor={selectedColor}
            onSelectColor={setSelectedColor} onReady={() => markReady(selectedColor)}
          />
        </GameLayout>
      )
    if (phase === 'coin_flip') {
      const fpName = roomTurn === 'host' ? (hostInfo?.name ?? '') : (guestInfo?.name ?? '')
      return (
        <GameLayout title="UNO">
          <CoinFlip winner={fpName} onDone={() => setCoinWinner(null)}/>
        </GameLayout>
      )
    }
  }

  const isWinnerMe = isMultiplayer
    ? roomWinner === (isHost ? 'host' : 'guest')
    : winner === 'me'

  return (
    <GameLayout
      title="UNO"
      status={
        winner
          ? (isWinnerMe ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...')
          : aiThinking ? 'AI กำลังคิด...'
          : myTurn ? 'ตาของคุณ'
          : `ตาของ${isMultiplayer ? (opponentInfo?.name ?? 'เพื่อน') : 'AI'}`
      }
      statusColor={winner ? (isWinnerMe ? 'green' : 'red') : myTurn ? 'accent' : 'default'}
      topLeft={
        <PlayerCard
          name={isMultiplayer ? (hostInfo?.name ?? playerName) : playerName}
          avatar={isMultiplayer ? hostInfo?.avatarUrl : avatarUrl}
          label={`ไพ่ ${isMultiplayer ? (isHost ? hand.length : opponentHandCount) : hand.length} ใบ`}
          active={isMultiplayer ? roomTurn === 'host' && !winner : myTurn && !winner}
        />
      }
      topRight={
        <PlayerCard
          name={isMultiplayer ? (guestInfo?.name ?? 'รอผู้เล่น...') : 'AI'}
          avatar={isMultiplayer ? guestInfo?.avatarUrl : undefined}
          label={`ไพ่ ${isMultiplayer ? (isHost ? opponentHandCount : hand.length) : aiHand.length} ใบ`}
          active={isMultiplayer ? roomTurn === 'guest' && !winner : !myTurn && !winner}
          flip
        />
      }
    >
      {isMultiplayer && phase === 'finished' && roomWinner && hostInfo && guestInfo && (
        <GameResult winner={roomWinner} hostInfo={hostInfo} guestInfo={guestInfo}
          myName={playerName} rematchVotes={rematchVotes} onRematch={handleRematch}/>
      )}
      <Confetti active={isWinnerMe && (mode === 'ai' || phase === 'finished')}/>

      {/* Opponent card backs */}
      <div className="flex justify-center mb-3">
        <div className="flex flex-wrap gap-1 max-w-xs justify-center">
          {Array.from({ length: isMultiplayer ? opponentHandCount : aiHand.length }).map((_, i) => (
            <div key={i} className="w-8 h-12 rounded-lg bg-gradient-to-br from-purple/60 to-purple/30 border border-purple/40 flex items-center justify-center text-[9px] font-black text-white/60 shadow-sm flex-shrink-0">
              UNO
            </div>
          ))}
        </div>
      </div>

      {/* UNO alert for AI opponent */}
      {!isMultiplayer && aiHand.length === 1 && (
        <div className="text-center mb-2">
          <span className="bg-red/20 border border-red/40 text-red text-xs font-bold px-3 py-1 rounded-full animate-pulse">AI ร้อง UNO!</span>
        </div>
      )}

      {/* Active color indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted uppercase tracking-widest">สีปัจจุบัน:</span>
        <div className={`w-5 h-5 rounded-full border-2 ${COLOR_BG[activeColor]}`} />
        <span className="text-xs text-white font-bold">{activeColor}</span>
      </div>

      {/* Discard + Deck */}
      <div className="flex gap-6 items-center mb-5">
        <button onClick={drawFromDeck} disabled={!myTurn || !gameStarted}
          className="flex flex-col items-center gap-1 group">
          <div className="w-16 h-24 rounded-xl bg-gradient-to-br from-purple/60 to-purple/30 border-2 border-purple/40 flex items-center justify-center group-hover:border-purple/60 transition-colors shadow-lg">
            <span className="text-2xl font-black text-white/60 text-sm italic">UNO</span>
          </div>
          <span className="text-xs text-muted">{deck.length} ใบ</span>
        </button>

        {topCard && (
          <div className={`w-16 h-24 rounded-xl border-2 flex flex-col items-center justify-center text-white font-bold shadow-xl ring-4 ${COLOR_BG[activeColor]} ${COLOR_RING[activeColor]}`}>
            <span className="text-3xl font-black">{cardDisplay(topCard)}</span>
          </div>
        )}
      </div>

      {/* My hand */}
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {hand.map((card) => {
          const canPlayCard = playable.some(c => c.id === card.id)
          return (
            <motion.button key={card.id}
              whileHover={canPlayCard && myTurn ? { y: -10, scale: 1.08 } : {}}
              onClick={() => playCard(card)}
              className={`w-14 h-20 rounded-xl border-2 flex flex-col items-center justify-center font-bold transition-all shadow-md ${COLOR_BG[card.color]} ${
                canPlayCard && myTurn ? 'cursor-pointer shadow-lg ring-2 ring-white/30' : 'opacity-50 cursor-default'}`}>
              <span className="text-2xl font-black">{cardDisplay(card)}</span>
            </motion.button>
          )
        })}
      </div>

      {/* Color picker (wild card) */}
      <AnimatePresence>
        {pickingColor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-surface border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-white font-bold mb-4">เลือกสี</p>
              <div className="grid grid-cols-2 gap-3">
                {COLORS.map(c => (
                  <button key={c} onClick={() => pickColor(c)}
                    className={`w-16 h-16 rounded-xl border-2 ${COLOR_BG[c]} hover:scale-105 transition-transform`} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UNO alert */}
      <AnimatePresence>
        {unoAlert && (
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}
            className="fixed top-1/3 left-1/2 -translate-x-1/2 bg-red text-white px-8 py-4 rounded-2xl text-3xl font-bold shadow-2xl z-40">
            {unoAlert}
          </motion.div>
        )}
      </AnimatePresence>

      {winner && mode === 'ai' && (
        <AiGameResult
          result={winner === 'me' ? 'win' : 'loss'}
          playerName={playerName}
          aiName="AI"
          onRestart={() => {
        const d = createDeck()
        const myCards = d.splice(0, 7)
        const aiCards = d.splice(0, 7)
        let topCard = d.splice(0, 1)[0]
        while (topCard.type === 'wild4') { d.push(topCard); topCard = d.splice(0, 1)[0] }
        setDeck(d); setHand(myCards); setAiHand(aiCards)
        setDiscard([topCard]); setActiveColor(topCard.color === 'wild' ? 'red' : topCard.color)
        setWinner(null); setPickingColor(false); setPendingCard(null); setUnoAlert(null)
        const aiFirst = Math.random() < 0.5
        setMyTurn(!aiFirst)
        setGameStarted(false)
        setTimeout(() => setCoinWinner(aiFirst ? 'AI' : playerName), 300)
      }}
        />
      )}

      <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(!isMultiplayer) }}/>
      {isMultiplayer && roomId && <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl}/>}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><UnoPage/></Suspense>
}
