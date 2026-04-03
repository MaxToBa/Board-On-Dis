'use client'
import { motion, AnimatePresence } from 'framer-motion'

interface CoinFlipProps {
  winner: string | null
  onDone: () => void
}

export default function CoinFlip({ winner, onDone }: CoinFlipProps) {
  return (
    <AnimatePresence>
      {winner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, rotateY: 0 }}
            animate={{ scale: 1, rotateY: 720 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="text-6xl mb-6"
          >
            🪙
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="text-center"
          >
            <p className="text-white/60 text-sm mb-2">โยนเหรียญแล้ว!</p>
            <p className="text-2xl font-bold text-accent">{winner} ได้ไปก่อน</p>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              onClick={onDone}
              className="mt-6 bg-accent text-bg px-6 py-2 rounded-full font-bold text-sm hover:brightness-110 transition-all"
            >
              เริ่มเล่น →
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
