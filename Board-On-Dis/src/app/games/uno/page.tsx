'use client'
import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import PlayerCard from '@/components/game/PlayerCard'
import CoinFlip from '@/components/game/CoinFlip'
import ChatBox from '@/components/game/ChatBox'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { createDeck, canPlay, getPlayableCards, cardLabel } from '@/lib/games/uno'
import { sound } from '@/lib/sound'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
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

function UnoPage() {
  const { playerName, avatarUrl, isAuthenticated, roomId } = usePlayerInfo()
  const { user } = useAuthStore()
  const [deck, setDeck] = useState<Card[]>([])
  const [hand, setHand] = useState<Card[]>([])
  const [aiHand, setAiHand] = useState<Card[]>([])
  const [discard, setDiscard] = useState<Card[]>([])
  const [activeColor, setActiveColor] = useState<Color>('red')
  const [myTurn, setMyTurn] = useState(true)
  const [winner, setWinner] = useState<'me' | 'ai' | null>(null)
  const [coinWinner, setCoinWinner] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [pickingColor, setPickingColor] = useState(false)
  const [pendingCard, setPendingCard] = useState<Card | null>(null)
  const [drawCount, setDrawCount] = useState(0)
  const [aiThinking, setAiThinking] = useState(false)
  const [unoAlert, setUnoAlert] = useState<string | null>(null)

  useEffect(() => {
    const d = createDeck()
    const myCards = d.splice(0, 7)
    const aiCards = d.splice(0, 7)
    let topCard = d.splice(0, 1)[0]
    while (topCard.type === 'wild4') { d.push(topCard); topCard = d.splice(0, 1)[0] }
    setDeck(d)
    setHand(myCards)
    setAiHand(aiCards)
    setDiscard([topCard])
    setActiveColor(topCard.color === 'wild' ? 'red' : topCard.color)
    setTimeout(() => setCoinWinner(Math.random() < 0.5 ? playerName : 'AI'), 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // AI turn
  useEffect(() => {
    if (!gameStarted || myTurn || winner || aiThinking) return
    setAiThinking(true)
    setTimeout(() => {
      const topCard = discard[discard.length - 1]
      const playable = getPlayableCards(aiHand, topCard, activeColor)

      if (!playable.length) {
        // Draw
        const [drawn, ...restDeck] = deck
        if (drawn) {
          setAiHand((h) => [...h, drawn])
          setDeck(restDeck)
        }
        setMyTurn(true)
        setAiThinking(false)
        return
      }

      const card = playable[Math.floor(Math.random() * playable.length)]
      const newAiHand = aiHand.filter((c) => c.id !== card.id)
      const newDiscard = [...discard, card]
      let newColor = card.color === 'wild' ? (['red','yellow','green','blue'] as Color[])[Math.floor(Math.random() * 4)] : card.color
      setAiHand(newAiHand)
      setDiscard(newDiscard)
      setActiveColor(newColor)
      sound.cardPlay()

      if (newAiHand.length === 0) { setWinner('ai'); sound.lose(); saveResult('loss'); setAiThinking(false); return }
      if (newAiHand.length === 1) { setUnoAlert('AI ร้อง UNO!'); setTimeout(() => setUnoAlert(null), 2000) }

      let nextMyTurn = true
      if (card.type === 'skip') nextMyTurn = false
      if (card.type === 'reverse') nextMyTurn = false
      if (card.type === 'draw2') { drawCards(2, true); nextMyTurn = false }
      if (card.type === 'wild4') { drawCards(4, true); nextMyTurn = false }

      if (!nextMyTurn) setTimeout(() => { setAiThinking(false) }, 400)
      else { setMyTurn(true); setAiThinking(false) }
    }, 900)
  }, [myTurn, gameStarted]) // eslint-disable-line react-hooks/exhaustive-deps

  function drawCards(count: number, forMe: boolean) {
    setDeck((d) => {
      const drawn = d.slice(0, count)
      const rest = d.slice(count)
      if (forMe) setHand((h) => [...h, ...drawn])
      else setAiHand((h) => [...h, ...drawn])
      return rest
    })
  }

  function playCard(card: Card) {
    if (!myTurn || !gameStarted) return
    const topCard = discard[discard.length - 1]
    if (!canPlay(card, topCard, activeColor)) return
    sound.cardPlay()

    const newHand = hand.filter((c) => c.id !== card.id)
    if (newHand.length === 0) { setHand(newHand); setDiscard([...discard, card]); setWinner('me'); sound.win(); saveResult('win'); return }
    if (newHand.length === 1) { setUnoAlert('UNO!'); setTimeout(() => setUnoAlert(null), 2000) }

    if (card.type === 'wild' || card.type === 'wild4') {
      setPendingCard(card)
      setPickingColor(true)
      setHand(newHand)
      return
    }

    setHand(newHand)
    setDiscard([...discard, card])
    setActiveColor(card.color)

    if (card.type === 'skip' || card.type === 'reverse') { /* skip AI turn */ return }
    if (card.type === 'draw2') { drawCards(2, false); return }
    setMyTurn(false)
  }

  function pickColor(color: Color) {
    if (!pendingCard) return
    const newDiscard = [...discard, pendingCard]
    setDiscard(newDiscard)
    setActiveColor(color)
    setPendingCard(null)
    setPickingColor(false)
    if (pendingCard.type === 'wild4') drawCards(4, false)
    setMyTurn(false)
  }

  function drawFromDeck() {
    if (!myTurn || !gameStarted) return
    const [card, ...rest] = deck
    if (!card) return
    setDeck(rest)
    setHand([...hand, card])
    sound.move()
    setMyTurn(false)
  }

  async function saveResult(result: 'win' | 'loss') {
    if (!isAuthenticated || !user) return
    await supabase.from('game_results').insert({
      user_id: user.id, player_name: playerName, game: 'uno',
      result, opponent: 'AI', score: 0, best_tile: 0, time_played: 0,
    })
  }

  const topCard = discard[discard.length - 1]
  const playable = topCard ? getPlayableCards(hand, topCard, activeColor) : []
  const COLORS: Color[] = ['red', 'yellow', 'green', 'blue']

  return (
    <GameLayout
      title="UNO"
      status={winner ? (winner === 'me' ? 'คุณชนะ! 🎉' : 'แพ้แล้ว...') : aiThinking ? 'AI กำลังคิด...' : myTurn ? 'ตาของคุณ' : 'ตาของ AI'}
      statusColor={winner ? (winner === 'me' ? 'green' : 'red') : myTurn ? 'accent' : 'default'}
      topLeft={<PlayerCard name={playerName} avatar={avatarUrl} label={`ไพ่ในมือ ${hand.length} ใบ`} active={myTurn && !winner} />}
      topRight={<PlayerCard name="AI" label={`ไพ่ AI ${aiHand.length} ใบ`} active={!myTurn && !winner} flip />}
    >
      {/* AI card backs (opponent hand) */}
      <div className="flex justify-center mb-3">
        <div className="flex flex-wrap gap-1 max-w-xs justify-center">
          {aiHand.map((_, i) => (
            <div key={i} className="w-8 h-12 rounded-lg bg-gradient-to-br from-purple/60 to-purple/30 border border-purple/40 flex items-center justify-center text-[9px] font-black text-white/60 shadow-sm flex-shrink-0">
              UNO
            </div>
          ))}
        </div>
      </div>
      {aiHand.length === 1 && (
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

      {/* Discard pile */}
      <div className="flex gap-6 items-center mb-5">
        <button
          onClick={drawFromDeck}
          disabled={!myTurn || !gameStarted}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-16 h-24 rounded-xl bg-gradient-to-br from-purple/60 to-purple/30 border-2 border-purple/40 flex items-center justify-center group-hover:border-purple/60 transition-colors shadow-lg">
            <span className="text-2xl font-black text-white/60 text-sm italic">UNO</span>
          </div>
          <span className="text-xs text-muted">{deck.length} ใบ</span>
        </button>

        {topCard && (
          <div className={`w-16 h-24 rounded-xl border-2 flex flex-col items-center justify-center text-white font-bold shadow-xl ring-4 ${COLOR_BG[activeColor]} ${COLOR_RING[activeColor]}`}>
            <span className="text-3xl font-black">{topCard.value !== null ? topCard.value : topCard.type === 'wild4' ? '+4' : topCard.type === 'wild' ? '★' : topCard.type === 'draw2' ? '+2' : topCard.type === 'skip' ? '⊘' : '↺'}</span>
          </div>
        )}
      </div>

      {/* Player hand */}
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {hand.map((card) => {
          const canPlayCard = playable.some((c) => c.id === card.id)
          return (
            <motion.button
              key={card.id}
              whileHover={canPlayCard && myTurn ? { y: -10, scale: 1.08 } : {}}
              onClick={() => playCard(card)}
              className={`w-14 h-20 rounded-xl border-2 flex flex-col items-center justify-center font-bold transition-all shadow-md ${
                COLOR_BG[card.color]
              } ${canPlayCard && myTurn ? 'cursor-pointer shadow-lg ring-2 ring-white/30' : 'opacity-50 cursor-default'}`}
            >
              <span className="text-2xl font-black">{card.value !== null ? card.value : card.type === 'wild4' ? '+4' : card.type === 'draw2' ? '+2' : card.type === 'skip' ? '⊘' : card.type === 'reverse' ? '↺' : '★'}</span>
            </motion.button>
          )
        })}
      </div>

      {/* Color picker */}
      <AnimatePresence>
        {pickingColor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="bg-surface border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-white font-bold mb-4">เลือกสี</p>
              <div className="grid grid-cols-2 gap-3">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => pickColor(c)} className={`w-16 h-16 rounded-xl border-2 ${COLOR_BG[c]} hover:scale-105 transition-transform`} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UNO alert */}
      <AnimatePresence>
        {unoAlert && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            className="fixed top-1/3 left-1/2 -translate-x-1/2 bg-red text-white px-8 py-4 rounded-2xl text-3xl font-bold shadow-2xl z-40"
          >
            {unoAlert}
          </motion.div>
        )}
      </AnimatePresence>

      <CoinFlip winner={coinWinner} onDone={() => { setCoinWinner(null); setGameStarted(true) }} />
      {roomId && <ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl} />}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><UnoPage /></Suspense>
}
