'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface AiGameResultProps {
  result: 'win' | 'loss' | 'draw'
  playerName: string
  aiName?: string
  onRestart: () => void
}

const CONFIG = {
  win:  { emoji: '🏆', title: 'คุณชนะ!',  sub: (n: string) => `ยอดเยี่ยมมาก ${n}! 🎉`, bg: 'border-accent/30 bg-accent/5' },
  loss: { emoji: '😔', title: 'AI ชนะ!',  sub: (_: string) => 'ลองอีกครั้งนะ สู้ๆ!',   bg: 'border-red/20 bg-red/5' },
  draw: { emoji: '🤝', title: 'เสมอกัน!', sub: (_: string) => 'สูสีมาก ลองใหม่!',     bg: 'border-white/15 bg-surface' },
}

export default function AiGameResult({ result, playerName, aiName = 'AI', onRestart }: AiGameResultProps) {
  const cfg = CONFIG[result]

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-40"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className={`border rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl ${cfg.bg}`}
        >
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            className="text-8xl mb-4"
          >
            {cfg.emoji}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="font-display text-4xl text-white mb-2"
          >
            {cfg.title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-muted mb-2"
          >
            {cfg.sub(playerName)}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xs text-muted/60 mb-8"
          >
            {playerName} vs {aiName}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="space-y-3"
          >
            <button
              onClick={onRestart}
              className="w-full py-3.5 bg-accent text-bg rounded-2xl font-bold text-base hover:brightness-110 transition-all"
            >
              🔄 เล่นอีกครั้ง
            </button>
            <Link
              href="/"
              className="block w-full py-3 border border-white/10 rounded-2xl font-bold text-sm text-muted hover:text-white hover:border-white/25 transition-all text-center"
            >
              กลับหน้าหลัก
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}
