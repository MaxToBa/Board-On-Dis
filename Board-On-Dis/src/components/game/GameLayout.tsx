'use client'
import Link from 'next/link'
import MuteButton from '@/components/layout/MuteButton'

interface GameLayoutProps {
  title: string
  status?: string
  statusColor?: 'default' | 'green' | 'red' | 'accent'
  topLeft?: React.ReactNode
  topRight?: React.ReactNode
  children: React.ReactNode
}

const statusColors = {
  default: 'bg-surface2 text-white/70 border-white/10',
  green: 'bg-green/10 text-green border-green/20',
  red: 'bg-red/10 text-red border-red/20',
  accent: 'bg-accent/10 text-accent border-accent/20',
}

export default function GameLayout({
  title,
  status,
  statusColor = 'default',
  topLeft,
  topRight,
  children,
}: GameLayoutProps) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[400px] h-[400px] rounded-full bg-purple/[0.06] blur-[100px] -top-20 -right-20" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-accent/[0.05] blur-[100px] bottom-0 -left-10" />
      </div>

      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-bg/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5 text-sm"
          >
            ← กลับ
          </Link>
          <div className="flex-1 flex items-center gap-3">
            <h1 className="font-display text-lg text-white">{title}</h1>
            {status && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusColors[statusColor]}`}>
                {status}
              </span>
            )}
          </div>
          <MuteButton />
        </div>
      </div>

      {/* Player bars */}
      {(topLeft || topRight) && (
        <div className="max-w-4xl mx-auto w-full px-4 py-3 grid grid-cols-2 gap-3 relative z-10">
          <div>{topLeft}</div>
          <div className="flex justify-end">{topRight}</div>
        </div>
      )}

      {/* Game content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6">
        {children}
      </div>
    </div>
  )
}
