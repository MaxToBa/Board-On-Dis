'use client'
import { motion } from 'framer-motion'
import Avatar from '@/components/ui/Avatar'
import type { PlayerInRoom } from '@/types/room'

interface GameResultProps {
  winner: 'host' | 'guest' | 'draw'
  hostInfo: PlayerInRoom
  guestInfo: PlayerInRoom
  myName: string
  rematchVotes: string[]
  onRematch: () => void
}

export default function GameResult({
  winner,
  hostInfo,
  guestInfo,
  myName,
  rematchVotes,
  onRematch,
}: GameResultProps) {
  const winnerInfo = winner === 'host' ? hostInfo : winner === 'guest' ? guestInfo : null
  const isWinner = winnerInfo?.name === myName
  const isDraw = winner === 'draw'
  const iVoted = rematchVotes.includes(myName)
  const totalVotes = rematchVotes.length

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="bg-surface border border-white/15 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
        >
          {/* Big emoji */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="text-8xl mb-4"
          >
            {isDraw ? '🤝' : isWinner ? '🏆' : '😔'}
          </motion.div>

          {/* Title */}
          <h2 className="font-display text-4xl text-white mb-2">
            {isDraw ? 'เสมอกัน!' : isWinner ? 'คุณชนะ!' : 'แพ้แล้ว!'}
          </h2>

          {/* Subtitle */}
          <p className="text-muted mb-6 text-sm">
            {isDraw
              ? 'สูสีมาก!'
              : isWinner
              ? `ยอดเยี่ยมมาก ${myName}! 🎉`
              : `${winnerInfo?.name} ชนะในครั้งนี้`}
          </p>

          {/* Winner avatar */}
          {winnerInfo && (
            <div className="flex justify-center mb-6">
              <div
                className={
                  isWinner
                    ? 'ring-4 ring-accent ring-offset-4 ring-offset-surface rounded-full'
                    : ''
                }
              >
                <Avatar src={winnerInfo.avatarUrl} name={winnerInfo.name} size="xl" />
              </div>
            </div>
          )}

          {/* Score */}
          <div className="flex items-center justify-center gap-6 mb-8 bg-surface2 rounded-2xl py-4 px-6">
            <div className="text-center">
              <div className="font-display text-3xl text-accent">{hostInfo.score}</div>
              <div className="text-xs text-muted max-w-[80px] truncate">{hostInfo.name}</div>
            </div>
            <div className="text-2xl text-muted font-display">:</div>
            <div className="text-center">
              <div className="font-display text-3xl text-purple">{guestInfo.score}</div>
              <div className="text-xs text-muted max-w-[80px] truncate">{guestInfo.name}</div>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={onRematch}
              disabled={iVoted}
              className="w-full py-3.5 bg-accent text-bg rounded-2xl font-bold text-base
                       hover:brightness-110 transition-all
                       disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {iVoted
                ? `⏳ รอเพื่อน... (${totalVotes}/2)`
                : '🔄 เล่นอีกครั้ง'}
            </button>
            <a
              href="/"
              className="block w-full py-3 border border-white/10 rounded-2xl font-bold text-sm
                       text-muted hover:text-white hover:border-white/25 transition-all text-center"
            >
              กลับหน้าหลัก
            </a>
          </div>
        </motion.div>
      </div>
    </>
  )
}
