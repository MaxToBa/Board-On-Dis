'use client'
import { useState } from 'react'

interface WaitingRoomProps {
  roomCode: string
}

export default function WaitingRoom({ roomCode }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      <div className="text-6xl animate-bounce">⏳</div>

      <div className="text-center space-y-1">
        <h2 className="font-display text-2xl text-white">รอเพื่อนเข้าห้อง</h2>
        <p className="text-muted text-sm">แชร์ Room Code ให้เพื่อน</p>
      </div>

      <div className="bg-surface2 border border-white/10 rounded-2xl p-8 text-center space-y-4">
        <div className="text-xs font-bold tracking-widest uppercase text-muted">Room Code</div>
        <div className="font-display text-5xl tracking-[0.3em] text-accent">{roomCode}</div>
        <button
          onClick={copy}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-surface border border-white/10
                   rounded-xl text-sm font-bold hover:border-white/30 transition-all"
        >
          {copied ? '✓ คัดลอกแล้ว!' : '📋 คัดลอก Code'}
        </button>
      </div>

      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 bg-accent rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
