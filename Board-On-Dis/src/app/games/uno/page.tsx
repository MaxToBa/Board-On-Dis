'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import CoinFlip from '@/components/game/CoinFlip'
import ChatBox from '@/components/game/ChatBox'
import WaitingRoom from '@/components/game/phases/WaitingRoom'
import SetupRoom from '@/components/game/phases/SetupRoom'
import GameResult from '@/components/game/phases/GameResult'
import AiGameResult from '@/components/game/AiGameResult'
import Confetti from '@/components/ui/Confetti'
import Avatar from '@/components/ui/Avatar'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom'
import { createDeck, canPlay, getPlayableCards } from '@/lib/games/uno'
import { sound } from '@/lib/sound'
import { saveGameResult } from '@/lib/saveGameResult'
import { COLOR_OPTIONS } from '@/types/room'
import type { PlayerInRoom } from '@/types/room'
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

// ── PlayerSlot: shows one opponent's avatar + name + card backs ──
function PlayerSlot({
  player, cardCount, isActive, direction = 'horizontal',
}: {
  player: PlayerInRoom
  cardCount: number
  isActive: boolean
  direction?: 'horizontal' | 'vertical'
}) {
  const cardBacks = Math.min(cardCount, 8)
  return (
    <div className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-2xl border transition-all
      ${isActive ? 'border-accent/60 bg-accent/8 shadow-lg shadow-accent/10' : 'border-white/8 bg-surface/50'}`}>
      <div className={`relative ${isActive ? 'ring-2 ring-accent rounded-full' : ''}`}>
        <Avatar src={player.avatarUrl} name={player.name} size="sm" />
        {isActive && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border border-bg animate-pulse" />
        )}
      </div>
      <span className="text-[10px] font-bold text-white truncate max-w-[60px]">{player.name}</span>
      {/* Card backs */}
      <div className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row'} gap-0.5`}>
        {Array.from({ length: cardBacks }).map((_, i) => (
          <div key={i}
            className="w-4 h-6 rounded-sm bg-gradient-to-br from-purple/70 to-purple/40 border border-purple/50 flex items-center justify-center text-[5px] font-black text-white/50 flex-shrink-0">
            U
          </div>
        ))}
        {cardCount > 8 && <span className="text-[9px] text-muted font-bold">+{cardCount - 8}</span>}
      </div>
      <span className="text-[9px] text-muted">{cardCount} ใบ</span>
    </div>
  )
}

// ── UNO Card backs mini row ──
const HAND_KEYS = ['hostHand', 'guestHand', 'hand2', 'hand3', 'hand4', 'hand5']

function UnoPage() {
  const { playerName, avatarUrl, userId, isAuthenticated, roomId, mode, isHost } = usePlayerInfo()

  const [deck,        setDeck]        = useState<Card[]>([])
  const [hand,        setHand]        = useState<Card[]>([])
  const [aiHand,      setAiHand]      = useState<Card[]>([])
  const [discard,     setDiscard]     = useState<Card[]>([])
  const [activeColor, setActiveColor] = useState<Color>('red')
  const [myTurn,      setMyTurn]      = useState(true)
  const [winner,      setWinner]      = useState<'me'|'ai'|'host'|'guest'|null>(null)
  const [coinWinner,  setCoinWinner]  = useState<string|null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [pickingColor, setPickingColor] = useState(false)
  const [pendingCard,  setPendingCard] = useState<Card|null>(null)
  const [aiThinking,   setAiThinking]  = useState(false)
  const [unoAlert,     setUnoAlert]    = useState<string|null>(null)
  const [selectedColor, setSelectedColor] = useState('red')
  const [direction,    setDirection]   = useState<1 | -1>(1)
  const [unoPlayerIndex, setUnoPlayerIndex] = useState(0)

  // All hands indexed by playerIndex (length 6)
  const [allHands, setAllHands] = useState<(Card[] | null)[]>([null, null, null, null, null, null])

  const isMultiplayer = mode === 'multiplayer' && !!roomId
  const myIdxRef = useRef(isHost ? 0 : 1)

  const {
    phase, hostInfo, guestInfo, myInfo, opponentInfo,
    allPlayers, currentTurn: roomTurn, winner: roomWinner,
    rematchVotes, isMyTurn: isMyRoomTurn,
    myPlayerIndex,
    markReady, markUnready, updateGameData, finishGame, requestRematch,
  } = useMultiplayerRoom({
    roomId: isMultiplayer ? roomId : '',
    isHost,
    playerName,
    avatarUrl,
    userId,
    onGameStateChange: useCallback((state: Record<string, unknown>) => {
      if (!isMultiplayer) return
      const myIdx = myIdxRef.current
      const myHandKey = HAND_KEYS[myIdx] ?? 'hostHand'

      HAND_KEYS.forEach((key, idx) => {
        if (!state[key]) return
        const h = state[key] as Card[]
        if (idx === myIdx) {
          setHand(h)
        } else {
          setAllHands(prev => { const a = [...prev]; a[idx] = h; return a })
        }
      })

      if (state.deck)         setDeck(state.deck as Card[])
      if (state.discard)      setDiscard(state.discard as Card[])
      if (state.activeColor)  setActiveColor(state.activeColor as Color)
      if (state.unoPlayerIndex !== undefined) {
        const pi = state.unoPlayerIndex as number
        setUnoPlayerIndex(pi)
        setMyTurn(pi === myIdx)
      }
      if (state.direction !== undefined) setDirection(state.direction as 1 | -1)
      if (state.gameStarted) setGameStarted(true)

      void myHandKey // used above
    }, [isMultiplayer]),
  })

  // Keep myIdx ref in sync
  useEffect(() => { myIdxRef.current = myPlayerIndex }, [myPlayerIndex])

  const isMyUnoTurn = isMultiplayer
    ? (gameStarted ? unoPlayerIndex === myPlayerIndex : isMyRoomTurn)
    : myTurn

  // ── Coin flip display ──
  useEffect(() => {
    if (!isMultiplayer || phase !== 'coin_flip' || !hostInfo || !guestInfo) return
    const iGoFirst = roomTurn === (isHost ? 'host' : 'guest')
    setCoinWinner(iGoFirst ? 'คุณ' : (isHost ? guestInfo.name : hostInfo.name))
  }, [phase, isMultiplayer, roomTurn]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isMultiplayer || phase === 'coin_flip') return
    setCoinWinner(null)
  }, [phase, isMultiplayer])

  // ── Host deals cards when playing starts ──
  useEffect(() => {
    if (!isMultiplayer || phase !== 'playing' || gameStarted || !isHost) return
    const d = createDeck()
    const playerCount = allPlayers.length || 2
    const hands: Card[][] = []
    for (let i = 0; i < playerCount; i++) hands.push(d.splice(0, 7))
    let topCard = d.splice(0, 1)[0]
    while (topCard.type === 'wild4') { d.push(topCard); topCard = d.splice(0, 1)[0] }
    const startIdx = roomTurn === 'host' ? 0 : 1
    const updates: Record<string, unknown> = {
      deck: d, discard: [topCard],
      activeColor: topCard.color === 'wild' ? 'red' : topCard.color,
      currentTurn: roomTurn, unoPlayerIndex: startIdx, direction: 1, gameStarted: true,
    }
    hands.forEach((h, i) => { updates[HAND_KEYS[i]] = h })
    updateGameData(updates)
    setHand(hands[0])
    setAllHands(prev => { const a = [...prev]; hands.forEach((h, i) => { if (i !== 0) a[i] = h }); return a })
    setDeck(d); setDiscard([topCard])
    setActiveColor(topCard.color === 'wild' ? 'red' : topCard.color)
    setUnoPlayerIndex(startIdx); setDirection(1)
    setMyTurn(startIdx === 0); setGameStarted(true)
  }, [phase, isMultiplayer, isHost, gameStarted, roomTurn, allPlayers.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI mode init ──
  useEffect(() => {
    if (mode !== 'ai') return
    const d = createDeck()
    const myCards = d.splice(0, 7); const aiCards = d.splice(0, 7)
    let topCard = d.splice(0, 1)[0]
    while (topCard.type === 'wild4') { d.push(topCard); topCard = d.splice(0, 1)[0] }
    setDeck(d); setHand(myCards); setAiHand(aiCards)
    setDiscard([topCard]); setActiveColor(topCard.color === 'wild' ? 'red' : topCard.color)
    const aiFirst = Math.random() < 0.5
    setMyTurn(!aiFirst)
    setTimeout(() => setCoinWinner(aiFirst ? 'AI' : 'คุณ'), 300)
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
      const newColor = card.color === 'wild'
        ? (['red','yellow','green','blue'] as Color[])[Math.floor(Math.random()*4)]
        : card.color
      setAiHand(newAiHand); setDiscard(newDiscard); setActiveColor(newColor); sound.cardPlay()
      if (newAiHand.length === 0) { setWinner('ai'); sound.lose(); saveResult('loss'); setAiThinking(false); return }
      if (newAiHand.length === 1) { setUnoAlert('AI ร้อง UNO!'); setTimeout(() => setUnoAlert(null), 2000) }
      let nextMyTurn = true
      if (card.type === 'skip' || card.type === 'reverse') nextMyTurn = false
      if (card.type === 'draw2') { drawCards(2, true); nextMyTurn = false }
      if (card.type === 'wild4') { drawCards(4, true); nextMyTurn = false }
      if (!nextMyTurn) {
        setTimeout(() => { setMyTurn(true); setTimeout(() => setMyTurn(false), 50); setAiThinking(false) }, 600)
      } else { setMyTurn(true); setAiThinking(false) }
    }, 900)
  }, [myTurn, gameStarted]) // eslint-disable-line react-hooks/exhaustive-deps

  function drawCards(count: number, forMe: boolean) {
    setDeck(d => {
      const drawn = d.slice(0, count); const rest = d.slice(count)
      if (forMe) setHand(h => [...h, ...drawn]); else setAiHand(h => [...h, ...drawn])
      return rest
    })
  }

  function computeNext(myIdx: number, playerCount: number, card: Card, dir: number): {
    nextIdx: number; newDirection: 1 | -1; victimIdx: number | null; drawCount: number
  } {
    let newDirection = dir as 1 | -1
    let skip = false; let drawCount = 0
    if (card.type === 'reverse') {
      if (playerCount === 2) skip = true
      else newDirection = (dir === 1 ? -1 : 1) as 1 | -1
    }
    if (card.type === 'skip') skip = true
    if (card.type === 'draw2') { drawCount = 2; skip = true }
    if (card.type === 'wild4') { drawCount = 4; skip = true }
    const victimIdx = drawCount > 0 ? (myIdx + newDirection + playerCount * 6) % playerCount : null
    const nextIdx = skip
      ? (myIdx + newDirection * 2 + playerCount * 6) % playerCount
      : (myIdx + newDirection + playerCount * 6) % playerCount
    return { nextIdx, newDirection, victimIdx, drawCount }
  }

  function playCard(card: Card) {
    if (isMultiplayer ? (!isMyUnoTurn || !gameStarted) : (!myTurn || !gameStarted)) return
    const topCard = discard[discard.length - 1]
    if (!canPlay(card, topCard, activeColor)) return
    sound.cardPlay()
    const newHand = hand.filter(c => c.id !== card.id)

    if (newHand.length === 0) {
      setHand(newHand); setDiscard([...discard, card])
      if (isMultiplayer) {
        const myIdx = myPlayerIndex
        const w = myIdx === 0 ? 'host' : 'guest'
        updateGameData({ [HAND_KEYS[myIdx]]: newHand, discard: [...discard, card] })
        finishGame(w as 'host' | 'guest')
      } else { setWinner('me'); sound.win(); saveResult('win') }
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
      const playerCount = allPlayers.length || 2
      const myIdx = myPlayerIndex
      const { nextIdx, newDirection, victimIdx, drawCount } = computeNext(myIdx, playerCount, card, direction)
      const nextTurn: 'host' | 'guest' = nextIdx === 0 ? 'host' : 'guest'
      const updates: Record<string, unknown> = {
        [HAND_KEYS[myIdx]]: newHand, discard: newDiscard, activeColor: color,
        currentTurn: nextTurn, unoPlayerIndex: nextIdx, direction: newDirection,
      }
      if (drawCount > 0 && victimIdx !== null) {
        const victimHand = allHands[victimIdx] ?? []
        const drawn = deck.slice(0, drawCount)
        const newDeck = deck.slice(drawCount)
        updates[HAND_KEYS[victimIdx]] = [...victimHand, ...drawn]
        updates.deck = newDeck
        setDeck(newDeck)
        setAllHands(prev => { const a = [...prev]; a[victimIdx!] = [...victimHand, ...drawn]; return a })
      }
      setUnoPlayerIndex(nextIdx); setDirection(newDirection); setMyTurn(nextIdx === myIdx)
      updateGameData(updates)
    } else {
      if (card.type === 'skip' || card.type === 'reverse') return
      if (card.type === 'draw2') { drawCards(2, false); return }
      setMyTurn(false)
    }
  }

  function pickColor(color: Color) {
    if (!pendingCard) return
    const newDiscard = [...discard, pendingCard]
    setDiscard(newDiscard); setActiveColor(color)
    setPendingCard(null); setPickingColor(false); sound.cardPlay()
    if (isMultiplayer) {
      const playerCount = allPlayers.length || 2
      const myIdx = myPlayerIndex
      const skip = pendingCard.type === 'wild4'
      const victimIdx = skip ? (myIdx + direction + playerCount * 6) % playerCount : null
      const nextIdx = skip
        ? (myIdx + direction * 2 + playerCount * 6) % playerCount
        : (myIdx + direction + playerCount * 6) % playerCount
      const nextTurn: 'host' | 'guest' = nextIdx === 0 ? 'host' : 'guest'
      const updates: Record<string, unknown> = {
        [HAND_KEYS[myIdx]]: hand, discard: newDiscard, activeColor: color,
        currentTurn: nextTurn, unoPlayerIndex: nextIdx, direction,
      }
      if (skip && victimIdx !== null) {
        const victimHand = allHands[victimIdx] ?? []
        const drawn = deck.slice(0, 4); const newDeck = deck.slice(4)
        updates[HAND_KEYS[victimIdx]] = [...victimHand, ...drawn]
        updates.deck = newDeck
        setDeck(newDeck)
        setAllHands(prev => { const a = [...prev]; a[victimIdx!] = [...victimHand, ...drawn]; return a })
      }
      setUnoPlayerIndex(nextIdx); setMyTurn(nextIdx === myIdx)
      updateGameData(updates)
    } else {
      if (pendingCard.type === 'wild4') { drawCards(4, false); return }
      setMyTurn(false)
    }
  }

  function drawFromDeck() {
    if (isMultiplayer ? (!isMyUnoTurn || !gameStarted) : (!myTurn || !gameStarted)) return
    const [card, ...rest] = deck
    if (!card) return
    setDeck(rest); setHand([...hand, card]); sound.move()
    if (isMultiplayer) {
      const playerCount = allPlayers.length || 2
      const myIdx = myPlayerIndex
      const nextIdx = (myIdx + direction + playerCount * 6) % playerCount
      const nextTurn: 'host' | 'guest' = nextIdx === 0 ? 'host' : 'guest'
      setUnoPlayerIndex(nextIdx); setMyTurn(false)
      updateGameData({ [HAND_KEYS[myIdx]]: [...hand, card], deck: rest, currentTurn: nextTurn, unoPlayerIndex: nextIdx })
    } else { setMyTurn(false) }
  }

  function saveResult(result: 'win' | 'loss') {
    if (!isAuthenticated || !userId) return
    saveGameResult({ userId, playerName, game: 'uno', result, opponent: mode === 'ai' ? 'AI' : (opponentInfo?.name ?? 'เพื่อน') })
  }

  function handleRematch() {
    setDeck([]); setHand([]); setAiHand([]); setDiscard([])
    setWinner(null); setMyTurn(true); setGameStarted(false)
    setAllHands([null, null, null, null, null, null])
    requestRematch({ hostHand: [], guestHand: [], deck: [], discard: [], gameStarted: false })
  }

  const topCard  = discard[discard.length - 1]
  const playable = topCard ? getPlayableCards(hand, topCard, activeColor) : []
  const COLORS: Color[] = ['red', 'yellow', 'green', 'blue']

  // ── Compute seat positions ──
  // Others go clockwise: right → top… → left
  const playerCount = allPlayers.length
  const others: (PlayerInRoom & { playerIndex: number })[] = allPlayers
    .map((p, i) => ({ ...p, playerIndex: i }))
    .filter((_, i) => i !== myPlayerIndex)
    // re-order clockwise from right
    .sort((a, b) => {
      const relA = (a.playerIndex - myPlayerIndex + playerCount) % playerCount
      const relB = (b.playerIndex - myPlayerIndex + playerCount) % playerCount
      return relA - relB
    })

  let rightPlayer: (PlayerInRoom & { playerIndex: number }) | null = null
  let leftPlayer:  (PlayerInRoom & { playerIndex: number }) | null = null
  let topPlayers:  (PlayerInRoom & { playerIndex: number })[] = []

  if (others.length === 0) {
    // AI mode / solo — handled separately
  } else if (others.length <= 2) {
    topPlayers = others   // 2p: [top], 3p: [top1, top2] (no sides)
  } else {
    rightPlayer = others[0]
    leftPlayer  = others[others.length - 1]
    topPlayers  = others.slice(1, -1)
  }

  function getHandCount(pIdx: number) {
    return allHands[pIdx]?.length ?? 7
  }

  // ── MULTIPLAYER PHASE RENDERING ──
  if (isMultiplayer) {
    if (phase === 'waiting' && isHost)
      return <GameLayout title="UNO"><WaitingRoom roomCode={roomId}/></GameLayout>
    if (phase === 'setup' || (phase === 'waiting' && !isHost))
      return (
        <GameLayout title="UNO">
          <SetupRoom
            myInfo={myInfo ?? null} opponentInfo={opponentInfo ?? null}
            allPlayers={allPlayers.length > 2 ? allPlayers : undefined}
            colorOptions={COLOR_OPTIONS} selectedColor={selectedColor}
            onSelectColor={setSelectedColor} onReady={() => markReady(selectedColor)} onUnready={markUnready}
            showColorPicker={false}
          />
          <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl}/>
        </GameLayout>
      )
    if (phase === 'coin_flip') {
      const iGoFirst = roomTurn === (isHost ? 'host' : 'guest')
      const fpName = iGoFirst ? 'คุณ' : (isHost ? guestInfo?.name : hostInfo?.name) ?? 'เพื่อน'
      return (
        <GameLayout title="UNO">
          <CoinFlip winner={fpName} onDone={() => setCoinWinner(null)}/>
          <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl}/>
        </GameLayout>
      )
    }
  }

  const isWinnerMe = isMultiplayer ? roomWinner === (isHost ? 'host' : 'guest') : winner === 'me'
  const currentPlayerName = isMultiplayer
    ? (allPlayers[unoPlayerIndex]?.name ?? '?')
    : (myTurn ? playerName : 'AI')

  return (
    <GameLayout
      title="UNO"
      status={
        winner ? (isWinnerMe ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...')
        : aiThinking ? 'AI กำลังคิด...'
        : isMyUnoTurn ? 'ตาของคุณ'
        : `ตาของ ${currentPlayerName}`
      }
      statusColor={winner ? (isWinnerMe ? 'green' : 'red') : isMyUnoTurn ? 'accent' : 'default'}
    >
      {isMultiplayer && phase === 'finished' && roomWinner && hostInfo && guestInfo && (
        <GameResult winner={roomWinner} hostInfo={hostInfo} guestInfo={guestInfo}
          myName={playerName} rematchVotes={rematchVotes} onRematch={handleRematch}/>
      )}
      <Confetti active={isWinnerMe && (mode === 'ai' || phase === 'finished')}/>

      {/* ── TABLE LAYOUT ── */}
      <div className="w-full flex flex-col items-center gap-3">

        {/* TOP ROW — opponents across the table */}
        {(topPlayers.length > 0 || !isMultiplayer) && (
          <div className="flex gap-3 justify-center flex-wrap">
            {isMultiplayer ? topPlayers.map(p => (
              <PlayerSlot key={p.playerIndex} player={p}
                cardCount={getHandCount(p.playerIndex)}
                isActive={unoPlayerIndex === p.playerIndex && !winner}/>
            )) : (
              /* AI mode: show AI as top opponent */
              <div className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl border transition-all
                ${!myTurn && !winner ? 'border-accent/60 bg-accent/8' : 'border-white/8 bg-surface/50'}`}>
                <div className={`w-8 h-8 rounded-full bg-purple/30 border-2 flex items-center justify-center text-sm font-bold text-white
                  ${!myTurn && !winner ? 'border-accent ring-2 ring-accent' : 'border-white/20'}`}>🤖</div>
                <span className="text-[10px] font-bold text-white">AI</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(aiHand.length, 8) }).map((_, i) => (
                    <div key={i} className="w-4 h-6 rounded-sm bg-gradient-to-br from-purple/70 to-purple/40 border border-purple/50"/>
                  ))}
                </div>
                <span className="text-[9px] text-muted">{aiHand.length} ใบ</span>
              </div>
            )}
          </div>
        )}

        {/* MIDDLE ROW — left | center | right */}
        <div className="flex items-center gap-4 w-full justify-center">

          {/* LEFT PLAYER */}
          {leftPlayer && (
            <PlayerSlot player={leftPlayer}
              cardCount={getHandCount(leftPlayer.playerIndex)}
              isActive={unoPlayerIndex === leftPlayer.playerIndex && !winner}
              direction="vertical"/>
          )}

          {/* CENTER: deck + discard + color + direction */}
          <div className="flex flex-col items-center gap-2">
            {/* Active color + direction */}
            <div className="flex items-center gap-3 text-[10px] text-muted">
              <div className="flex items-center gap-1">
                <div className={`w-4 h-4 rounded-full border-2 ${COLOR_BG[activeColor]}`}/>
                <span className="text-white font-bold">{activeColor}</span>
              </div>
              <span className="text-muted">{direction === 1 ? '↻ ตามเข็ม' : '↺ ทวนเข็ม'}</span>
            </div>

            {/* Deck + Discard */}
            <div className="flex gap-4 items-center">
              {/* Deck */}
              <button onClick={drawFromDeck}
                disabled={!(isMultiplayer ? isMyUnoTurn : myTurn) || !gameStarted}
                className="flex flex-col items-center gap-1 group disabled:opacity-60">
                <div className="w-14 h-20 rounded-xl bg-gradient-to-br from-purple/60 to-purple/30 border-2 border-purple/40 flex items-center justify-center group-hover:border-purple/60 transition-colors shadow-lg">
                  <span className="text-[10px] font-black text-white/60 italic">UNO</span>
                </div>
                <span className="text-[9px] text-muted">{deck.length} ใบ</span>
              </button>

              {/* Discard */}
              {topCard && (
                <div className={`w-14 h-20 rounded-xl border-2 flex flex-col items-center justify-center text-white font-bold shadow-xl ring-4 ${COLOR_BG[activeColor]} ${COLOR_RING[activeColor]}`}>
                  <span className="text-2xl font-black">{cardDisplay(topCard)}</span>
                </div>
              )}
            </div>

            {/* UNO alert for AI */}
            {!isMultiplayer && aiHand.length === 1 && (
              <span className="bg-red/20 border border-red/40 text-red text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">AI ร้อง UNO!</span>
            )}
          </div>

          {/* RIGHT PLAYER */}
          {rightPlayer && (
            <PlayerSlot player={rightPlayer}
              cardCount={getHandCount(rightPlayer.playerIndex)}
              isActive={unoPlayerIndex === rightPlayer.playerIndex && !winner}
              direction="vertical"/>
          )}
        </div>

        {/* MY HAND */}
        <div className="flex flex-col items-center gap-2 w-full">
          {/* Me label + avatar */}
          <div className="flex items-center gap-2">
            <Avatar src={avatarUrl} name={playerName} size="sm"
              className={isMyUnoTurn && !winner ? 'ring-2 ring-accent' : ''}/>
            <span className="text-xs font-bold text-white">{playerName}</span>
            <span className="text-[10px] text-muted">{hand.length} ใบ</span>
            {isMyUnoTurn && !winner && (
              <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded-full font-bold animate-pulse">ตาคุณ!</span>
            )}
          </div>

          {/* Cards */}
          <div className="flex flex-wrap gap-1.5 justify-center max-w-lg">
            {hand.map((card) => {
              const canPlayCard = playable.some(c => c.id === card.id)
              const active = canPlayCard && isMyUnoTurn
              return (
                <motion.button key={card.id}
                  whileHover={active ? { y: -10, scale: 1.08 } : {}}
                  onClick={() => playCard(card)}
                  className={`w-12 h-18 rounded-xl border-2 flex flex-col items-center justify-center font-bold transition-all shadow-md ${COLOR_BG[card.color]}
                    ${active ? 'cursor-pointer shadow-lg ring-2 ring-white/40' : 'opacity-50 cursor-default'}`}
                  style={{ height: '4.5rem' }}>
                  <span className="text-xl font-black leading-none">{cardDisplay(card)}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Color picker overlay */}
      <AnimatePresence>
        {pickingColor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-surface border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-white font-bold mb-4">เลือกสี</p>
              <div className="grid grid-cols-2 gap-3">
                {COLORS.map(c => (
                  <button key={c} onClick={() => pickColor(c)}
                    className={`w-16 h-16 rounded-xl border-2 ${COLOR_BG[c]} hover:scale-105 transition-transform`}/>
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
        <AiGameResult result={winner === 'me' ? 'win' : 'loss'} playerName={playerName} aiName="AI"
          onRestart={() => {
            const d = createDeck()
            const myCards = d.splice(0, 7); const aiCards = d.splice(0, 7)
            let topCard = d.splice(0, 1)[0]
            while (topCard.type === 'wild4') { d.push(topCard); topCard = d.splice(0, 1)[0] }
            setDeck(d); setHand(myCards); setAiHand(aiCards)
            setDiscard([topCard]); setActiveColor(topCard.color === 'wild' ? 'red' : topCard.color)
            setWinner(null); setPickingColor(false); setPendingCard(null); setUnoAlert(null)
            const aiFirst = Math.random() < 0.5
            setMyTurn(!aiFirst); setGameStarted(false)
            setTimeout(() => setCoinWinner(aiFirst ? 'AI' : 'คุณ'), 300)
          }}
        />
      )}

      {mode === 'ai' && <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(true) }}/>}
      {isMultiplayer && roomId && <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl}/>}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><UnoPage/></Suspense>
}
