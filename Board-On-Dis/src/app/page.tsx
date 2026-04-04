'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import GameCard from '@/components/lobby/GameCard'
import GameModal from '@/components/lobby/GameModal'
import { sound } from '@/lib/sound'
import { supabase } from '@/lib/supabase'
import type { GameInfo } from '@/components/lobby/GameCard'
import type { GameType } from '@/types'

const GAMES: GameInfo[] = [
  {
    id: 'tictactoe',
    name: 'โอ-ซี',
    emoji: '⭕',
    desc: 'Tic-Tac-Toe ง่าย เร็ว สนุก เล่นกับเพื่อนหรือ AI',
    tags: ['Multiplayer', 'New'],
    players: '2 คน',
    bg: 'linear-gradient(135deg, #0f2018 0%, #0a3d1f 100%)',
    filterTags: ['multi', 'classic'],
    featured: true,
  },
  {
    id: 'uno',
    name: 'UNO',
    emoji: '🃏',
    desc: 'เกมไพ่สุดฮิต เล่นได้ 2-6 คน ระวัง +4!',
    tags: ['Multiplayer', 'Hot'],
    players: '2-6 คน',
    bg: 'linear-gradient(135deg, #1f0f0f 0%, #4a1515 100%)',
    filterTags: ['multi'],
  },
  {
    id: 'battleship',
    name: 'Battle Ship',
    emoji: '🚢',
    desc: 'วางเรือ เดาตำแหน่ง จมเรือศัตรูให้หมดก่อน',
    tags: ['Multiplayer', 'Strategy'],
    players: '2 คน',
    bg: 'linear-gradient(135deg, #0f1a2f 0%, #0a2a4a 100%)',
    filterTags: ['multi', 'strategy'],
  },
  {
    id: '2048',
    name: '2048',
    emoji: '🔢',
    desc: 'รวมตัวเลขให้ถึง 2048 — เล่นคนเดียวสะสมคะแนนสูงสุด',
    tags: ['Solo'],
    players: '1 คน',
    bg: 'linear-gradient(135deg, #1a1500 0%, #3d3000 100%)',
    filterTags: ['solo'],
  },
  {
    id: 'gomoku',
    name: 'โกะ / Gomoku',
    emoji: '⚫',
    desc: 'วางหมากให้ได้ 5 ตัวในแนวเดียวกัน เกมกลยุทธ์ที่ลึกกว่าที่คิด',
    tags: ['Multiplayer', 'Classic'],
    players: '2 คน',
    bg: 'linear-gradient(135deg, #1a0f1a 0%, #3d1a3d 100%)',
    filterTags: ['multi', 'strategy', 'classic'],
  },
  {
    id: 'checkers',
    name: 'หมากฮอส',
    emoji: '🔴',
    desc: 'Checkers คลาสสิก กินหมากต่อเนื่อง ปั้นขุนให้ได้ก่อน',
    tags: ['Multiplayer', 'Classic'],
    players: '2 คน',
    bg: 'linear-gradient(135deg, #1a0d0d 0%, #3d1a00 100%)',
    filterTags: ['multi', 'strategy', 'classic'],
  },
  {
    id: 'connect-four',
    name: 'Connect Four',
    emoji: '🔵',
    desc: 'วางหมาก 4 ตัวในแนวเดียวกันก่อนฝ่ายตรงข้าม',
    tags: ['Multiplayer', 'Hot'],
    players: '2 คน',
    bg: 'linear-gradient(135deg, #0a1a3d 0%, #1a3a8a 100%)',
    filterTags: ['multi', 'strategy'],
  },
  {
    id: 'chess',
    name: 'หมากรุกสากล',
    emoji: '♟️',
    desc: 'Chess คลาสสิก เล่นกับ AI หรือแข่งกับเพื่อนออนไลน์',
    tags: ['Multiplayer', 'Coming Soon'],
    players: '2 คน',
    bg: 'linear-gradient(135deg, #1a1000 0%, #3d2e00 100%)',
    filterTags: ['multi', 'strategy', 'classic'],
  },
]

type Filter = 'all' | 'multi' | 'solo' | 'strategy' | 'classic'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'multi', label: 'หลายคน' },
  { id: 'solo', label: 'คนเดียว' },
  { id: 'strategy', label: 'กลยุทธ์' },
  { id: 'classic', label: 'คลาสสิก' },
]

export default function LobbyPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null)
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [liveCounts, setLiveCounts] = useState<Partial<Record<GameType, number>>>({})

  useEffect(() => {
    const channel = supabase.channel('lobby-presence', {
      config: { presence: { key: crypto.randomUUID() } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    async function fetchCounts() {
      const { data } = await supabase.from('rooms').select('game').eq('status', 'playing')
      if (data) {
        const counts: Partial<Record<GameType, number>> = {}
        data.forEach(({ game }) => {
          counts[game as GameType] = (counts[game as GameType] ?? 0) + 1
        })
        setLiveCounts(counts)
      }
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 15000)
    return () => clearInterval(interval)
  }, [])

  const filtered = GAMES.filter((g) => filter === 'all' || g.filterTags.includes(filter))

  return (
    <div className="min-h-screen bg-bg">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-purple/[0.12] blur-[120px] -top-40 -right-24" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-accent/[0.07] blur-[120px] bottom-0 -left-24" />
      </div>

      <div className="relative z-10">
        <Header />
        <main className="max-w-6xl mx-auto px-4 pb-20">
          <motion.section
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="pt-16 pb-12"
          >
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <p className="text-xs font-bold tracking-[3px] uppercase text-accent">
                ✦ Multi-player Board Games
              </p>
              {onlineCount !== null && (
                <div className="flex items-center gap-1.5 bg-green/10 border border-green/20 text-green text-xs font-bold px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                  {onlineCount} ออนไลน์
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 mb-4 flex-wrap">
              <img src="/logo.png" alt="Board On Dis" width={220} className="drop-shadow-2xl flex-shrink-0" />
              <div>
                <h1 className="text-[clamp(2.5rem,7vw,5rem)] leading-[1.05] tracking-tight text-white font-display">
                  เล่นเกม<br />
                  <span className="text-purple">กับเพื่อน</span><br />
                  ได้ทุกที่
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-2">
              <p className="text-muted max-w-md leading-relaxed text-base">
                เลือกเกมที่ชอบ สร้างห้อง แล้วส่ง code ให้เพื่อน หรือเล่นคนเดียวกับ AI ก็ได้
              </p>
              <Link
                href="/leaderboard"
                className="flex items-center gap-2 bg-surface border border-white/10 hover:border-accent/40 hover:bg-accent/5 text-white hover:text-accent rounded-xl px-4 py-2.5 text-sm font-bold transition-all"
                onClick={() => sound.click()}
              >
                🏆 ดูอันดับ
              </Link>
            </div>
          </motion.section>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex gap-2 flex-wrap mb-8"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => { sound.click(); setFilter(f.id) }}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  filter === f.id
                    ? 'bg-white text-bg'
                    : 'border border-white/10 text-muted hover:border-white/20 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filtered.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                liveCount={liveCounts[game.id]}
                onClick={() => { sound.click(); setSelectedGame(game) }}
              />
            ))}
          </motion.div>
        </main>
      </div>

      <GameModal game={selectedGame} onClose={() => setSelectedGame(null)} />
    </div>
  )
}
