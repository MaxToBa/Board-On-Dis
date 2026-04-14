'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import CoinFlip from '@/components/game/CoinFlip'
import ChatBox from '@/components/game/ChatBox'
import WaitingRoom from '@/components/game/phases/WaitingRoom'
import SetupRoom from '@/components/game/phases/SetupRoom'
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

// ── Color helpers ──────────────────────────────────────────────────────────────
const COLOR_BG: Record<Color, string> = {
  red: 'bg-red border-red/60',
  yellow: 'bg-accent border-accent/60 text-bg',
  green: 'bg-green border-green/60 text-bg',
  blue: 'bg-blue-500 border-blue-400',
  wild: 'bg-surface2 border-white/20',
}
const COLOR_RING: Record<Color, string> = {
  red: 'ring-red', yellow: 'ring-accent', green: 'ring-green',
  blue: 'ring-blue-400', wild: 'ring-white/30',
}

function cardDisplay(card: Card): string {
  if (card.value !== null) return String(card.value)
  if (card.type === 'wild4')   return '+4'
  if (card.type === 'wild')    return '★'
  if (card.type === 'draw2')   return '+2'
  if (card.type === 'skip')    return '⊘'
  if (card.type === 'reverse') return '↺'
  return '?'
}

// ── Settings ───────────────────────────────────────────────────────────────────
interface UnoSettings { turnTimer: number; startingCards: number }
const DEFAULT_SETTINGS: UnoSettings = { turnTimer: 15, startingCards: 7 }
const TIMER_OPTIONS   = [0, 3, 5, 10, 15, 20]
const CARDS_OPTIONS   = [5, 7, 10]

// ── PlayerSlot ─────────────────────────────────────────────────────────────────
function PlayerSlot({
  player, cardCount, isActive, timeLeft, hasUnoNeeded, direction = 'horizontal',
}: {
  player: PlayerInRoom; cardCount: number; isActive: boolean
  timeLeft?: number | null; hasUnoNeeded?: boolean
  direction?: 'horizontal' | 'vertical'
}) {
  const backs = Math.min(cardCount, 8)
  return (
    <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-2xl border transition-all
      ${isActive ? 'border-accent/60 bg-accent/8 shadow-lg shadow-accent/10' : 'border-white/8 bg-surface/50'}`}>
      <div className={`relative ${isActive ? 'ring-2 ring-accent rounded-full' : ''}`}>
        <Avatar src={player.avatarUrl} name={player.name} size="sm" />
        {isActive && <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border border-bg animate-pulse" />}
      </div>
      <span className="text-[10px] font-bold text-white truncate max-w-[60px]">{player.name}</span>
      {isActive && timeLeft != null && timeLeft > 0 && (
        <span className={`text-[9px] font-bold ${timeLeft <= 5 ? 'text-red animate-pulse' : 'text-accent'}`}>⏱ {timeLeft}s</span>
      )}
      {hasUnoNeeded && (
        <span className="text-[8px] font-bold text-yellow-400 border border-yellow-400/40 rounded-full px-1.5 py-0.5 animate-pulse bg-yellow-400/10">UNO?</span>
      )}
      <div className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row'} gap-0.5`}>
        {Array.from({ length: backs }).map((_, i) => (
          <div key={i} className="w-4 h-6 rounded-sm bg-gradient-to-br from-purple/70 to-purple/40 border border-purple/50 flex items-center justify-center text-[5px] font-black text-white/50 flex-shrink-0">U</div>
        ))}
        {cardCount > 8 && <span className="text-[9px] text-muted font-bold">+{cardCount - 8}</span>}
      </div>
      <span className="text-[9px] text-muted">{cardCount} ใบ</span>
    </div>
  )
}

// ── UNO Game Result (works for 2–6 players) ────────────────────────────────────
function UnoGameResult({
  winnerIdx, allPlayers, myPlayerIndex, myName, rematchVotes, onRematch,
}: {
  winnerIdx: number; allPlayers: PlayerInRoom[]; myPlayerIndex: number
  myName: string; rematchVotes: string[]; onRematch: () => void
}) {
  const winnerInfo = allPlayers[winnerIdx] ?? null
  const isWinner   = winnerIdx === myPlayerIndex
  const iVoted     = rematchVotes.includes(myName)
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-40" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="bg-surface border border-white/15 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }} className="text-8xl mb-4">
            {isWinner ? '🏆' : '😔'}
          </motion.div>
          <h2 className="font-display text-4xl text-white mb-2">{isWinner ? 'คุณชนะ!' : 'แพ้แล้ว!'}</h2>
          <p className="text-muted mb-6 text-sm">
            {isWinner ? `ยอดเยี่ยมมาก ${myName}! 🎉` : `${winnerInfo?.name ?? '?'} ชนะในครั้งนี้`}
          </p>
          {winnerInfo && (
            <div className={`flex justify-center mb-6 ${isWinner ? 'ring-4 ring-accent ring-offset-4 ring-offset-surface rounded-full' : ''}`}>
              <Avatar src={winnerInfo.avatarUrl} name={winnerInfo.name} size="xl" />
            </div>
          )}
          <div className="flex gap-2 justify-center mb-6 flex-wrap">
            {allPlayers.map((p, i) => (
              <div key={i} className={`text-center px-3 py-1.5 rounded-xl border text-xs
                ${i === winnerIdx ? 'border-accent/60 bg-accent/10 text-accent font-bold' : 'border-white/10 text-muted'}`}>
                {p.name} {i === winnerIdx ? '🏆' : ''}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <button onClick={onRematch} disabled={iVoted}
              className="w-full py-3.5 bg-accent text-bg rounded-2xl font-bold text-base hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {iVoted ? `⏳ รอเพื่อน... (${rematchVotes.length}/${allPlayers.length})` : '🔄 เล่นอีกครั้ง'}
            </button>
            <a href="/" className="block w-full py-3 border border-white/10 rounded-2xl font-bold text-sm text-muted hover:text-white hover:border-white/25 transition-all text-center">
              กลับหน้าหลัก
            </a>
          </div>
        </motion.div>
      </div>
    </>
  )
}

const HAND_KEYS = ['hostHand', 'guestHand', 'hand2', 'hand3', 'hand4', 'hand5']

// ── Main page ──────────────────────────────────────────────────────────────────
function UnoPage() {
  const { playerName, avatarUrl, userId, isAuthenticated, roomId, mode, isHost } = usePlayerInfo()

  const [deck,          setDeck]          = useState<Card[]>([])
  const [hand,          setHand]          = useState<Card[]>([])
  const [aiHand,        setAiHand]        = useState<Card[]>([])
  const [discard,       setDiscard]       = useState<Card[]>([])
  const [activeColor,   setActiveColor]   = useState<Color>('red')
  const [myTurn,        setMyTurn]        = useState(true)
  const [winner,        setWinner]        = useState<'me' | 'ai' | null>(null)
  const [coinWinner,    setCoinWinner]    = useState<string | null>(null)
  const [gameStarted,   setGameStarted]   = useState(false)
  const [pickingColor,  setPickingColor]  = useState(false)
  const [pendingCard,   setPendingCard]   = useState<Card | null>(null)
  const [aiThinking,    setAiThinking]    = useState(false)
  const [unoAlert,      setUnoAlert]      = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState('red')
  const [direction,     setDirection]     = useState<1 | -1>(1)
  const [unoPlayerIndex, setUnoPlayerIndex] = useState(0)
  const [allHands,      setAllHands]      = useState<(Card[] | null)[]>([null, null, null, null, null, null])
  // ── New state ──
  const [gameSettings,  setGameSettings]  = useState<UnoSettings>(DEFAULT_SETTINGS)
  const [unoNeeded,     setUnoNeeded]     = useState<number[]>([])
  const [timeLeft,      setTimeLeft]      = useState<number | null>(null)
  const [winnerIdx,     setWinnerIdx]     = useState(-1)
  const [humanCalledUno, setHumanCalledUno] = useState(false) // AI mode only

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastUnoMsg    = useRef<string | null>(null)
  const resultSaved   = useRef(false)

  const isMultiplayer = mode === 'multiplayer' && !!roomId
  const myIdxRef      = useRef(isHost ? 0 : 1)

  const {
    phase, hostInfo, guestInfo, myInfo, opponentInfo,
    allPlayers, currentTurn: roomTurn, winner: roomWinner,
    rematchVotes, isMyTurn: isMyRoomTurn, myPlayerIndex,
    markReady, markUnready, updateGameData, finishGame, requestRematch,
  } = useMultiplayerRoom({
    roomId: isMultiplayer ? roomId : '',
    isHost, playerName, avatarUrl, userId,
    onGameStateChange: useCallback((state: Record<string, unknown>) => {
      if (!isMultiplayer) return
      const myIdx = myIdxRef.current

      HAND_KEYS.forEach((key, idx) => {
        if (!state[key]) return
        const h = state[key] as Card[]
        if (idx === myIdx) setHand(h)
        else setAllHands(prev => { const a = [...prev]; a[idx] = h; return a })
      })

      if (state.deck)                      setDeck(state.deck as Card[])
      if (state.discard)                   setDiscard(state.discard as Card[])
      if (state.activeColor)               setActiveColor(state.activeColor as Color)
      if (state.unoPlayerIndex !== undefined) {
        const pi = state.unoPlayerIndex as number
        setUnoPlayerIndex(pi)
        setMyTurn(pi === myIdx)
      }
      if (state.direction !== undefined)   setDirection(state.direction as 1 | -1)
      if (state.gameStarted)               setGameStarted(true)
      if (state.gameSettings)              setGameSettings(state.gameSettings as UnoSettings)
      if (state.unoNeeded !== undefined)   setUnoNeeded(state.unoNeeded as number[])
      if (state.winnerIdx !== undefined)   setWinnerIdx(state.winnerIdx as number)

      // Show UNO/penalty alerts (deduplicated by ref)
      const msg = state.unoMsg as string | null | undefined
      if (msg && msg !== lastUnoMsg.current) {
        lastUnoMsg.current = msg
        setUnoAlert(msg)
        setTimeout(() => setUnoAlert(null), 2500)
      } else if (!msg) {
        lastUnoMsg.current = null
      }
    }, [isMultiplayer]),
  })

  useEffect(() => { myIdxRef.current = myPlayerIndex }, [myPlayerIndex])

  const isMyUnoTurn = isMultiplayer
    ? (gameStarted ? unoPlayerIndex === myPlayerIndex : isMyRoomTurn)
    : myTurn

  // ── Coin flip ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer || phase !== 'coin_flip' || !hostInfo || !guestInfo) return
    const iGoFirst = roomTurn === (isHost ? 'host' : 'guest')
    setCoinWinner(iGoFirst ? 'คุณ' : (isHost ? guestInfo.name : hostInfo.name))
  }, [phase, isMultiplayer, roomTurn]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isMultiplayer || phase === 'coin_flip') return
    setCoinWinner(null)
  }, [phase, isMultiplayer])

  // ── Host deals cards ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer || phase !== 'playing' || gameStarted || !isHost) return
    const d = createDeck()
    const playerCount = allPlayers.length || 2
    const hands: Card[][] = []
    for (let i = 0; i < playerCount; i++) hands.push(d.splice(0, gameSettings.startingCards))
    let topCard = d.splice(0, 1)[0]
    while (topCard.type === 'wild4') { d.push(topCard); topCard = d.splice(0, 1)[0] }
    const startIdx = roomTurn === 'host' ? 0 : 1
    const updates: Record<string, unknown> = {
      deck: d, discard: [topCard],
      activeColor: topCard.color === 'wild' ? 'red' : topCard.color,
      currentTurn: roomTurn, unoPlayerIndex: startIdx, direction: 1,
      gameStarted: true, gameSettings, unoNeeded: [], winnerIdx: -1, unoMsg: null,
    }
    hands.forEach((h, i) => { updates[HAND_KEYS[i]] = h })
    updateGameData(updates)
    setHand(hands[0])
    setAllHands(prev => { const a = [...prev]; hands.forEach((h, i) => { if (i !== 0) a[i] = h }); return a })
    setDeck(d); setDiscard([topCard])
    setActiveColor(topCard.color === 'wild' ? 'red' : topCard.color)
    setUnoPlayerIndex(startIdx); setDirection(1)
    setMyTurn(startIdx === 0); setGameStarted(true)
    setUnoNeeded([]); setWinnerIdx(-1)
  }, [phase, isMultiplayer, isHost, gameStarted, roomTurn, allPlayers.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Turn timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer || !gameStarted || gameSettings.turnTimer === 0 || phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current)
      setTimeLeft(null)
      return
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(gameSettings.turnTimer)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => (t !== null && t > 0) ? t - 1 : 0)
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [unoPlayerIndex, gameStarted, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-draw 2 on timeout ─────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft !== 0 || !isMyUnoTurn || !gameStarted || !isMultiplayer || phase !== 'playing') return
    if (timerRef.current) clearInterval(timerRef.current)
    const playerCount = allPlayers.length || 2
    const myIdx = myPlayerIndex
    const drawn   = deck.slice(0, 2)
    const rest    = deck.slice(2)
    const newHand = [...hand, ...drawn]
    setDeck(rest); setHand(newHand); setTimeLeft(null); sound.move()
    const nextIdx  = (myIdx + direction + playerCount * 6) % playerCount
    const nextTurn: 'host' | 'guest' = nextIdx === 0 ? 'host' : 'guest'
    setUnoPlayerIndex(nextIdx); setMyTurn(false)
    updateGameData({
      [HAND_KEYS[myIdx]]: newHand, deck: rest,
      currentTurn: nextTurn, unoPlayerIndex: nextIdx, unoMsg: null,
    })
  }, [timeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save result on multiplayer game end ────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer || phase !== 'finished' || !roomWinner || resultSaved.current) return
    resultSaved.current = true
    const iWon = winnerIdx >= 0 ? winnerIdx === myPlayerIndex : roomWinner === (isHost ? 'host' : 'guest')
    saveResult(iWon ? 'win' : 'loss')
  }, [phase, roomWinner]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI mode init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'ai') return
    dealAI(7)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function dealAI(cards: number) {
    const d = createDeck()
    const myCards = d.splice(0, cards); const aiCards = d.splice(0, cards)
    let topCard = d.splice(0, 1)[0]
    while (topCard.type === 'wild4') { d.push(topCard); topCard = d.splice(0, 1)[0] }
    setDeck(d); setHand(myCards); setAiHand(aiCards)
    setDiscard([topCard]); setActiveColor(topCard.color === 'wild' ? 'red' : topCard.color)
  }

  // ── AI turn ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted || myTurn || winner || aiThinking || mode !== 'ai') return
    setAiThinking(true)
    // Capture values to avoid stale closures inside setTimeout
    const snapHand = hand, snapDeck = deck, snapAiHand = aiHand
    const snapDiscard = discard, snapColor = activeColor
    const forgotUno = snapHand.length === 1 && !humanCalledUno
    setTimeout(() => {
      let curDeck = snapDeck
      let curHand = snapHand
      if (forgotUno) {
        const penalty = curDeck.slice(0, 2); curDeck = curDeck.slice(2)
        curHand = [...curHand, ...penalty]
        setHand(curHand); setDeck(curDeck)
        setUnoAlert('โดนจั่ว 2 ใบ! (ลืมกด UNO)'); setTimeout(() => setUnoAlert(null), 2500)
      }
      setHumanCalledUno(false)
      const topCard = snapDiscard[snapDiscard.length - 1]
      const playable = getPlayableCards(snapAiHand, topCard, snapColor)
      if (!playable.length) {
        const [drawn, ...rest] = curDeck
        if (drawn) { setAiHand(h => [...h, drawn]); setDeck(rest) }
        setMyTurn(true); setAiThinking(false); return
      }
      const card = playable[Math.floor(Math.random() * playable.length)]
      const newAiHand = snapAiHand.filter(c => c.id !== card.id)
      const newDiscard = [...snapDiscard, card]
      const newColor: Color = card.color === 'wild'
        ? (['red', 'yellow', 'green', 'blue'] as Color[])[Math.floor(Math.random() * 4)]
        : card.color
      setAiHand(newAiHand); setDiscard(newDiscard); setActiveColor(newColor); sound.cardPlay()
      if (newAiHand.length === 0) { setWinner('ai'); sound.lose(); saveResult('loss'); setAiThinking(false); return }
      if (newAiHand.length === 1) { setUnoAlert('AI ร้อง UNO!'); setTimeout(() => setUnoAlert(null), 2000) }
      let nextMyTurn = true
      if (card.type === 'skip' || card.type === 'reverse') nextMyTurn = false
      if (card.type === 'draw2') {
        const penalty = curDeck.slice(0, 2); curDeck = curDeck.slice(2)
        curHand = [...curHand, ...penalty]
        setHand(curHand); setDeck(curDeck); nextMyTurn = false
      }
      if (card.type === 'wild4') {
        const penalty = curDeck.slice(0, 4); curDeck = curDeck.slice(4)
        curHand = [...curHand, ...penalty]
        setHand(curHand); setDeck(curDeck); nextMyTurn = false
      }
      if (!nextMyTurn) {
        setTimeout(() => { setMyTurn(true); setTimeout(() => setMyTurn(false), 50); setAiThinking(false) }, 600)
      } else { setMyTurn(true); setAiThinking(false) }
    }, 900)
  }, [myTurn, gameStarted]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── UNO penalty helper (multiplayer) ──────────────────────────────────────
  function applyUnoPenalty(baseDeck: Card[], needed: number[]): {
    extraUpdates: Record<string, unknown>; newDeck: Card[]
  } {
    if (needed.length === 0) return { extraUpdates: {}, newDeck: baseDeck }
    const extraUpdates: Record<string, unknown> = {}
    let newDeck = [...baseDeck]
    const names: string[] = []
    for (const pIdx of needed) {
      const pHand = pIdx === myPlayerIndex ? hand : (allHands[pIdx] ?? [])
      if (pHand.length !== 1) continue
      const penalty = newDeck.slice(0, 2); newDeck = newDeck.slice(2)
      const newPHand = [...pHand, ...penalty]
      extraUpdates[HAND_KEYS[pIdx]] = newPHand
      if (pIdx === myPlayerIndex) setHand(newPHand)
      else setAllHands(prev => { const a = [...prev]; a[pIdx] = newPHand; return a })
      names.push(allPlayers[pIdx]?.name ?? '?')
    }
    extraUpdates.unoNeeded = []
    setUnoNeeded([])
    if (names.length > 0) {
      const msg = `${names.join(', ')} โดนจั่ว 2 ใบ! (ลืมกด UNO)`
      extraUpdates.unoMsg = msg
      lastUnoMsg.current = msg
      setUnoAlert(msg); setTimeout(() => setUnoAlert(null), 2500)
    }
    return { extraUpdates, newDeck }
  }

  // ── Turn logic ─────────────────────────────────────────────────────────────
  function computeNext(myIdx: number, pc: number, card: Card, dir: number) {
    let newDir = dir as 1 | -1; let skip = false; let drawCount = 0
    if (card.type === 'reverse') { pc === 2 ? (skip = true) : (newDir = (dir === 1 ? -1 : 1) as 1 | -1) }
    if (card.type === 'skip')  skip = true
    if (card.type === 'draw2') { drawCount = 2; skip = true }
    if (card.type === 'wild4') { drawCount = 4; skip = true }
    const victimIdx = drawCount > 0 ? (myIdx + newDir + pc * 6) % pc : null
    const nextIdx = skip
      ? (myIdx + newDir * 2 + pc * 6) % pc
      : (myIdx + newDir + pc * 6) % pc
    return { nextIdx, newDir, victimIdx, drawCount }
  }

  // ── Play card ──────────────────────────────────────────────────────────────
  function playCard(card: Card) {
    if (isMultiplayer ? (!isMyUnoTurn || !gameStarted) : (!myTurn || !gameStarted)) return
    const topCard = discard[discard.length - 1]
    if (!canPlay(card, topCard, activeColor)) return
    sound.cardPlay()
    const newHand = hand.filter(c => c.id !== card.id)

    // Win condition — single finishGame call fixes race condition
    if (newHand.length === 0) {
      setHand(newHand); setDiscard([...discard, card])
      if (isMultiplayer) {
        const myIdx = myPlayerIndex
        const w: 'host' | 'guest' = myIdx === 0 ? 'host' : 'guest'
        sound.win()
        finishGame(w, {
          [HAND_KEYS[myIdx]]: newHand,
          discard: [...discard, card],
          winnerIdx: myIdx, unoNeeded: [], unoMsg: null,
        })
        saveResult('win')
      } else {
        setWinner('me'); sound.win(); saveResult('win')
      }
      return
    }

    if (card.type === 'wild' || card.type === 'wild4') {
      setPendingCard(card); setPickingColor(true); setHand(newHand); return
    }
    applyCardEffect(card, newHand, [...discard, card], card.color)
  }

  function applyCardEffect(card: Card, newHand: Card[], newDiscard: Card[], color: Color) {
    setHand(newHand); setDiscard(newDiscard); setActiveColor(color)
    if (isMultiplayer) {
      const pc  = allPlayers.length || 2
      const myIdx = myPlayerIndex
      const { nextIdx, newDir, victimIdx, drawCount } = computeNext(myIdx, pc, card, direction)
      const nextTurn: 'host' | 'guest' = nextIdx === 0 ? 'host' : 'guest'

      // 1. UNO penalty for anyone who forgot
      const { extraUpdates, newDeck: deckAfterPenalty } = applyUnoPenalty(deck, unoNeeded)

      // 2. Determine new unoNeeded
      const nextUnoNeeded = newHand.length === 1 ? [myIdx] : []
      if (newHand.length === 1) setUnoNeeded([myIdx])

      // 3. Handle draw-card victims
      let finalDeck = deckAfterPenalty
      if (drawCount > 0 && victimIdx !== null) {
        const victimHand = allHands[victimIdx] ?? []
        const drawn = deckAfterPenalty.slice(0, drawCount)
        finalDeck = deckAfterPenalty.slice(drawCount)
        extraUpdates[HAND_KEYS[victimIdx]] = [...victimHand, ...drawn]
        setAllHands(prev => { const a = [...prev]; a[victimIdx!] = [...victimHand, ...drawn]; return a })
      }
      setDeck(finalDeck)

      setUnoPlayerIndex(nextIdx); setDirection(newDir); setMyTurn(nextIdx === myIdx)
      updateGameData({
        ...extraUpdates,
        [HAND_KEYS[myIdx]]: newHand, discard: newDiscard, activeColor: color,
        deck: finalDeck, currentTurn: nextTurn, unoPlayerIndex: nextIdx, direction: newDir,
        unoNeeded: nextUnoNeeded,
        ...(extraUpdates.unoMsg ? {} : { unoMsg: null }),
      })
    } else {
      if (card.type === 'skip' || card.type === 'reverse') return
      if (card.type === 'draw2') {
        setDeck(d => { const dr = d.slice(0, 2); const r = d.slice(2); setAiHand(h => [...h, ...dr]); return r })
        return
      }
      setMyTurn(false)
    }
  }

  // ── Call UNO button ────────────────────────────────────────────────────────
  function callUno() {
    if (isMultiplayer) {
      const newNeeded = unoNeeded.filter(i => i !== myPlayerIndex)
      setUnoNeeded(newNeeded)
      const msg = `${playerName} UNO!`
      lastUnoMsg.current = msg
      setUnoAlert(msg); setTimeout(() => setUnoAlert(null), 2000)
      updateGameData({ unoNeeded: newNeeded, unoMsg: msg })
    } else {
      setHumanCalledUno(true)
      setUnoAlert('UNO!'); setTimeout(() => setUnoAlert(null), 2000)
    }
  }

  // ── Pick color (after wild) ────────────────────────────────────────────────
  function pickColor(color: Color) {
    if (!pendingCard) return
    const newDiscard = [...discard, pendingCard]
    setDiscard(newDiscard); setActiveColor(color)
    setPendingCard(null); setPickingColor(false); sound.cardPlay()
    if (isMultiplayer) {
      const pc  = allPlayers.length || 2
      const myIdx = myPlayerIndex
      const skip = pendingCard.type === 'wild4'
      const victimIdx = skip ? (myIdx + direction + pc * 6) % pc : null
      const nextIdx   = skip
        ? (myIdx + direction * 2 + pc * 6) % pc
        : (myIdx + direction + pc * 6) % pc
      const nextTurn: 'host' | 'guest' = nextIdx === 0 ? 'host' : 'guest'

      const { extraUpdates, newDeck: deckAfterPenalty } = applyUnoPenalty(deck, unoNeeded)
      const nextUnoNeeded = hand.length === 1 ? [myIdx] : []
      if (hand.length === 1) setUnoNeeded([myIdx])

      let finalDeck = deckAfterPenalty
      if (skip && victimIdx !== null) {
        const victimHand = allHands[victimIdx] ?? []
        const drawn = deckAfterPenalty.slice(0, 4)
        finalDeck = deckAfterPenalty.slice(4)
        extraUpdates[HAND_KEYS[victimIdx]] = [...victimHand, ...drawn]
        setAllHands(prev => { const a = [...prev]; a[victimIdx!] = [...victimHand, ...drawn]; return a })
      }
      setDeck(finalDeck)
      setUnoPlayerIndex(nextIdx); setMyTurn(nextIdx === myIdx)
      updateGameData({
        ...extraUpdates,
        [HAND_KEYS[myIdx]]: hand, discard: newDiscard, activeColor: color,
        deck: finalDeck, currentTurn: nextTurn, unoPlayerIndex: nextIdx, direction,
        unoNeeded: nextUnoNeeded,
        ...(extraUpdates.unoMsg ? {} : { unoMsg: null }),
      })
    } else {
      if (pendingCard.type === 'wild4') {
        setDeck(d => { const dr = d.slice(0, 4); const r = d.slice(4); setAiHand(h => [...h, ...dr]); return r })
        return
      }
      setMyTurn(false)
    }
  }

  // ── Draw from deck ─────────────────────────────────────────────────────────
  function drawFromDeck() {
    if (isMultiplayer ? (!isMyUnoTurn || !gameStarted) : (!myTurn || !gameStarted)) return
    const [card, ...rest] = deck
    if (!card) return
    setHand(h => [...h, card]); sound.move()
    if (isMultiplayer) {
      const pc  = allPlayers.length || 2
      const myIdx = myPlayerIndex
      const { extraUpdates, newDeck: deckAfterPenalty } = applyUnoPenalty(rest, unoNeeded)
      const finalDeck = Object.keys(extraUpdates).some(k => k === 'deck') ? extraUpdates.deck as Card[] : deckAfterPenalty
      const nextIdx  = (myIdx + direction + pc * 6) % pc
      const nextTurn: 'host' | 'guest' = nextIdx === 0 ? 'host' : 'guest'
      setDeck(finalDeck as Card[]); setUnoPlayerIndex(nextIdx); setMyTurn(false)
      updateGameData({
        ...extraUpdates,
        [HAND_KEYS[myIdx]]: [...hand, card],
        deck: finalDeck, currentTurn: nextTurn, unoPlayerIndex: nextIdx,
        ...(extraUpdates.unoMsg ? {} : { unoMsg: null }),
      })
    } else {
      setDeck(rest); setMyTurn(false)
    }
  }

  function saveResult(result: 'win' | 'loss') {
    if (!isAuthenticated || !userId) return
    saveGameResult({ userId, playerName, game: 'uno', result, opponent: mode === 'ai' ? 'AI' : (opponentInfo?.name ?? 'เพื่อน') })
  }

  function handleRematch() {
    setDeck([]); setHand([]); setAiHand([]); setDiscard([])
    setWinner(null); setMyTurn(true); setGameStarted(false)
    setAllHands([null, null, null, null, null, null])
    setUnoNeeded([]); setWinnerIdx(-1); setTimeLeft(null); setHumanCalledUno(false)
    resultSaved.current = false
    if (timerRef.current) clearInterval(timerRef.current)
    requestRematch({ hostHand: [], guestHand: [], deck: [], discard: [], gameStarted: false, unoNeeded: [], winnerIdx: -1, unoMsg: null })
  }

  // ── Host settings updater (setup phase) ────────────────────────────────────
  function updateSettings(s: UnoSettings) {
    setGameSettings(s)
    updateGameData({ gameSettings: s })
  }

  // ── Derived layout values ──────────────────────────────────────────────────
  const topCard   = discard[discard.length - 1]
  const playable  = topCard ? getPlayableCards(hand, topCard, activeColor) : []
  const COLORS: Color[] = ['red', 'yellow', 'green', 'blue']

  const playerCount = allPlayers.length
  const others = allPlayers
    .map((p, i) => ({ ...p, playerIndex: i }))
    .filter((_, i) => i !== myPlayerIndex)
    .sort((a, b) => {
      const rA = (a.playerIndex - myPlayerIndex + playerCount) % playerCount
      const rB = (b.playerIndex - myPlayerIndex + playerCount) % playerCount
      return rA - rB
    })

  let rightPlayer: (PlayerInRoom & { playerIndex: number }) | null = null
  let leftPlayer:  (PlayerInRoom & { playerIndex: number }) | null = null
  let topPlayers:  (PlayerInRoom & { playerIndex: number })[] = []

  if (others.length <= 2) topPlayers = others
  else {
    rightPlayer = others[0]
    leftPlayer  = others[others.length - 1]
    topPlayers  = others.slice(1, -1)
  }

  function getHandCount(pIdx: number) { return allHands[pIdx]?.length ?? 7 }

  const isWinnerMe = isMultiplayer
    ? (winnerIdx >= 0 ? winnerIdx === myPlayerIndex : roomWinner === (isHost ? 'host' : 'guest'))
    : winner === 'me'

  // ── MULTIPLAYER PHASE RENDERING ────────────────────────────────────────────
  if (isMultiplayer) {
    if (phase === 'waiting' && isHost)
      return <GameLayout title="UNO"><WaitingRoom roomCode={roomId} /></GameLayout>

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
          {/* ── Game settings panel ── */}
          <div className="max-w-sm mx-auto bg-surface border border-white/8 rounded-2xl p-4 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted">
              ⚙️ ตั้งค่าเกม {!isHost && <span className="normal-case font-normal">(โดยเจ้าของห้อง)</span>}
            </div>
            {/* Turn timer */}
            <div>
              <div className="text-xs text-white/80 mb-2">⏱ เวลาต่อตา</div>
              <div className="flex gap-1.5 flex-wrap">
                {TIMER_OPTIONS.map(t => (
                  <button key={t} disabled={!isHost}
                    onClick={() => updateSettings({ ...gameSettings, turnTimer: t })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                      ${gameSettings.turnTimer === t ? 'border-accent bg-accent/20 text-accent' : 'border-white/10 text-muted'}
                      ${isHost ? 'hover:border-accent/50 cursor-pointer' : 'cursor-default opacity-70'}`}>
                    {t === 0 ? '∞' : `${t}s`}
                  </button>
                ))}
              </div>
            </div>
            {/* Starting cards */}
            <div>
              <div className="text-xs text-white/80 mb-2">🃏 ไพ่เริ่มต้น</div>
              <div className="flex gap-1.5">
                {CARDS_OPTIONS.map(n => (
                  <button key={n} disabled={!isHost}
                    onClick={() => updateSettings({ ...gameSettings, startingCards: n })}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all
                      ${gameSettings.startingCards === n ? 'border-accent bg-accent/20 text-accent' : 'border-white/10 text-muted'}
                      ${isHost ? 'hover:border-accent/50 cursor-pointer' : 'cursor-default opacity-70'}`}>
                    {n} ใบ
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />
        </GameLayout>
      )

    if (phase === 'coin_flip') {
      const iGoFirst = roomTurn === (isHost ? 'host' : 'guest')
      const fpName = iGoFirst ? 'คุณ' : (isHost ? guestInfo?.name : hostInfo?.name) ?? 'เพื่อน'
      return (
        <GameLayout title="UNO">
          <CoinFlip winner={fpName} onDone={() => setCoinWinner(null)} />
          <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />
        </GameLayout>
      )
    }
  }

  const currentPlayerName = isMultiplayer
    ? (allPlayers[unoPlayerIndex]?.name ?? '?')
    : (myTurn ? playerName : 'AI')

  const showUnoButton = isMultiplayer
    ? unoNeeded.includes(myPlayerIndex)
    : (hand.length === 1 && myTurn && !humanCalledUno)

  return (
    <GameLayout
      title="UNO"
      status={
        (isMultiplayer ? phase === 'finished' && !!roomWinner : !!winner)
          ? (isWinnerMe ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...')
          : aiThinking ? 'AI กำลังคิด...'
          : isMyUnoTurn ? 'ตาของคุณ'
          : `ตาของ ${currentPlayerName}`
      }
      statusColor={
        (isMultiplayer ? phase === 'finished' && !!roomWinner : !!winner)
          ? (isWinnerMe ? 'green' : 'red')
          : isMyUnoTurn ? 'accent' : 'default'
      }
    >
      {/* ── Multiplayer result overlay ── */}
      {isMultiplayer && phase === 'finished' && roomWinner && winnerIdx >= 0 && allPlayers.length > 0 && (
        <UnoGameResult
          winnerIdx={winnerIdx} allPlayers={allPlayers}
          myPlayerIndex={myPlayerIndex} myName={playerName}
          rematchVotes={rematchVotes} onRematch={handleRematch}
        />
      )}
      <Confetti active={isWinnerMe && (mode === 'ai' || phase === 'finished')} />

      {/* ── TABLE LAYOUT ── */}
      <div className="w-full flex flex-col items-center gap-3">

        {/* TOP ROW */}
        {(topPlayers.length > 0 || !isMultiplayer) && (
          <div className="flex gap-3 justify-center flex-wrap">
            {isMultiplayer ? topPlayers.map(p => (
              <PlayerSlot key={p.playerIndex} player={p}
                cardCount={getHandCount(p.playerIndex)}
                isActive={unoPlayerIndex === p.playerIndex && phase === 'playing'}
                timeLeft={unoPlayerIndex === p.playerIndex ? timeLeft : null}
                hasUnoNeeded={unoNeeded.includes(p.playerIndex)} />
            )) : (
              <div className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl border transition-all
                ${!myTurn && !winner ? 'border-accent/60 bg-accent/8' : 'border-white/8 bg-surface/50'}`}>
                <div className={`w-8 h-8 rounded-full bg-purple/30 border-2 flex items-center justify-center text-sm font-bold text-white
                  ${!myTurn && !winner ? 'border-accent ring-2 ring-accent' : 'border-white/20'}`}>🤖</div>
                <span className="text-[10px] font-bold text-white">AI</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(aiHand.length, 8) }).map((_, i) => (
                    <div key={i} className="w-4 h-6 rounded-sm bg-gradient-to-br from-purple/70 to-purple/40 border border-purple/50" />
                  ))}
                </div>
                <span className="text-[9px] text-muted">{aiHand.length} ใบ</span>
                {aiHand.length === 1 && (
                  <span className="text-[8px] font-bold text-accent border border-accent/30 rounded-full px-1.5 animate-pulse">UNO!</span>
                )}
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
              isActive={unoPlayerIndex === leftPlayer.playerIndex && phase === 'playing'}
              timeLeft={unoPlayerIndex === leftPlayer.playerIndex ? timeLeft : null}
              hasUnoNeeded={unoNeeded.includes(leftPlayer.playerIndex)}
              direction="vertical" />
          )}

          {/* CENTER */}
          <div className="flex flex-col items-center gap-2">
            {/* Color + direction + timer */}
            <div className="flex items-center gap-3 text-[10px] text-muted">
              <div className="flex items-center gap-1">
                <div className={`w-4 h-4 rounded-full border-2 ${COLOR_BG[activeColor]}`} />
                <span className="text-white font-bold">{activeColor}</span>
              </div>
              <span>{direction === 1 ? '↻ ตามเข็ม' : '↺ ทวนเข็ม'}</span>
              {timeLeft !== null && gameSettings.turnTimer > 0 && (
                <span className={`font-bold px-2 py-0.5 rounded-full border ${
                  timeLeft <= 5 ? 'text-red border-red/40 bg-red/10 animate-pulse' : 'text-accent border-accent/30 bg-accent/10'
                }`}>⏱ {timeLeft}s</span>
              )}
            </div>

            {/* Deck + Discard */}
            <div className="flex gap-4 items-center">
              <button onClick={drawFromDeck}
                disabled={!(isMultiplayer ? isMyUnoTurn : myTurn) || !gameStarted}
                className="flex flex-col items-center gap-1 group disabled:opacity-60">
                <div className="w-14 h-20 rounded-xl bg-gradient-to-br from-purple/60 to-purple/30 border-2 border-purple/40 flex items-center justify-center group-hover:border-purple/60 transition-colors shadow-lg">
                  <span className="text-[10px] font-black text-white/60 italic">UNO</span>
                </div>
                <span className="text-[9px] text-muted">{deck.length} ใบ</span>
              </button>

              {topCard && (
                <div className={`w-14 h-20 rounded-xl border-2 flex flex-col items-center justify-center text-white font-bold shadow-xl ring-4 ${COLOR_BG[activeColor]} ${COLOR_RING[activeColor]}`}>
                  <span className="text-2xl font-black">{cardDisplay(topCard)}</span>
                </div>
              )}
            </div>

            {/* AI UNO notice */}
            {!isMultiplayer && aiHand.length === 1 && (
              <span className="bg-red/20 border border-red/40 text-red text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">AI ร้อง UNO!</span>
            )}
          </div>

          {/* RIGHT PLAYER */}
          {rightPlayer && (
            <PlayerSlot player={rightPlayer}
              cardCount={getHandCount(rightPlayer.playerIndex)}
              isActive={unoPlayerIndex === rightPlayer.playerIndex && phase === 'playing'}
              timeLeft={unoPlayerIndex === rightPlayer.playerIndex ? timeLeft : null}
              hasUnoNeeded={unoNeeded.includes(rightPlayer.playerIndex)}
              direction="vertical" />
          )}
        </div>

        {/* MY HAND */}
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Avatar src={avatarUrl} name={playerName} size="sm"
              className={isMyUnoTurn && !winner ? 'ring-2 ring-accent' : ''} />
            <span className="text-xs font-bold text-white">{playerName}</span>
            <span className="text-[10px] text-muted">{hand.length} ใบ</span>
            {isMyUnoTurn && phase === 'playing' && !winner && (
              <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded-full font-bold animate-pulse">ตาคุณ!</span>
            )}
            {/* UNO button */}
            {showUnoButton && (
              <motion.button
                initial={{ scale: 0.8 }} animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                onClick={callUno}
                className="px-4 py-1.5 bg-red text-white text-sm font-black rounded-full border-2 border-red/60 shadow-lg shadow-red/30 cursor-pointer hover:brightness-110">
                UNO!
              </motion.button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center max-w-lg">
            {hand.map((card) => {
              const canPlayCard = playable.some(c => c.id === card.id)
              const active = canPlayCard && isMyUnoTurn
              return (
                <motion.button key={card.id}
                  whileHover={active ? { y: -10, scale: 1.08 } : {}}
                  onClick={() => playCard(card)}
                  className={`w-12 rounded-xl border-2 flex flex-col items-center justify-center font-bold transition-all shadow-md ${COLOR_BG[card.color]}
                    ${active ? 'cursor-pointer shadow-lg ring-2 ring-white/40' : 'opacity-50 cursor-default'}`}
                  style={{ height: '4.5rem' }}>
                  <span className="text-xl font-black leading-none">{cardDisplay(card)}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Color picker */}
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
            className="fixed top-1/3 left-1/2 -translate-x-1/2 bg-red text-white px-8 py-4 rounded-2xl text-2xl font-bold shadow-2xl z-40 text-center max-w-xs">
            {unoAlert}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI game result */}
      {winner && mode === 'ai' && (
        <AiGameResult result={winner === 'me' ? 'win' : 'loss'} playerName={playerName} aiName="AI"
          onRestart={() => {
            dealAI(7); setWinner(null); setPickingColor(false); setPendingCard(null)
            setUnoAlert(null); setHumanCalledUno(false)
            const aiFirst = Math.random() < 0.5
            setMyTurn(!aiFirst); setGameStarted(false)
            setTimeout(() => setCoinWinner(aiFirst ? 'AI' : 'คุณ'), 300)
          }}
        />
      )}

      {mode === 'ai' && <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />}
      {isMultiplayer && roomId && <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><UnoPage /></Suspense>
}
