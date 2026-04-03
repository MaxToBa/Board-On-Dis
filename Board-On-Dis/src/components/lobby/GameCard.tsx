'use client'
import { motion } from 'framer-motion'
import type { GameType } from '@/types'

export interface GameInfo {
  id: GameType
  name: string
  emoji: string
  desc: string
  tags: ('Multiplayer' | 'Solo' | 'Hot' | 'New' | 'Strategy' | 'Classic' | 'Coming Soon')[]
  players: string
  bg: string
  filterTags: string[]
  featured?: boolean
}

interface GameCardProps {
  game: GameInfo
  liveCount?: number
  onClick: () => void
}

const tagStyle: Record<string, string> = {
  Multiplayer: 'text-purple border-purple/30 bg-purple/10',
  Solo: 'text-accent border-accent/30 bg-accent/10',
  Hot: 'text-red border-red/30 bg-red/10',
  New: 'text-green border-green/30 bg-green/10',
  Strategy: 'text-green border-green/30 bg-green/10',
  Classic: 'text-accent border-accent/30 bg-accent/10',
  'Coming Soon': 'text-muted border-white/10 bg-white/5',
}

export default function GameCard({ game, liveCount, onClick }: GameCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className={`bg-surface border border-white/7 rounded-2xl overflow-hidden cursor-pointer group ${
        game.featured ? 'md:col-span-2' : ''
      }`}
      onClick={onClick}
    >
      {/* Visual */}
      <div
        className={`relative flex items-center justify-center overflow-hidden ${
          game.featured ? 'h-60' : 'h-44'
        }`}
        style={{ background: game.bg }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface" />
        <span className="relative z-10 text-6xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 drop-shadow-2xl">
          {game.emoji}
        </span>
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {game.tags.map((tag) => (
            <span
              key={tag}
              className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full border ${tagStyle[tag] ?? 'text-muted border-white/10'}`}
            >
              {tag === 'Hot' ? '🔥 ' : tag === 'New' ? '✦ ' : ''}
              {tag}
            </span>
          ))}
          {liveCount !== undefined && liveCount > 0 && (
            <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full border text-green border-green/20 bg-green/10">
              {liveCount} กำลังเล่น
            </span>
          )}
        </div>

        <h3 className={`font-display text-white mb-1.5 ${game.featured ? 'text-2xl' : 'text-xl'}`}>
          {game.name}
        </h3>
        <p className="text-sm text-muted leading-relaxed mb-4">{game.desc}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="flex">
              {Array.from({ length: Math.min(parseInt(game.players[0]) || 2, 3) }).map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-surface2 border-2 border-surface flex items-center justify-center text-xs -ml-1.5 first:ml-0"
                >
                  👤
                </div>
              ))}
            </div>
            {game.players}
          </div>
          <button className="text-sm font-bold bg-white text-bg px-5 py-1.5 rounded-full hover:bg-accent transition-colors">
            เล่นเลย →
          </button>
        </div>
      </div>
    </motion.div>
  )
}
