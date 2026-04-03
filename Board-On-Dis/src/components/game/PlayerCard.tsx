'use client'
import Avatar from '@/components/ui/Avatar'

interface PlayerCardProps {
  name: string
  avatar?: string | null
  label?: string
  active?: boolean
  score?: number | string
  extra?: string
  flip?: boolean
}

export default function PlayerCard({ name, avatar, label, active, score, extra, flip }: PlayerCardProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${
        active
          ? 'border-accent/40 bg-accent/5 shadow-[0_0_16px_rgba(232,197,71,0.15)]'
          : 'border-white/10 bg-surface'
      } ${flip ? 'flex-row-reverse' : ''}`}
    >
      <Avatar src={avatar} name={name} size="md" />
      <div className={`flex-1 min-w-0 ${flip ? 'text-right' : ''}`}>
        {label && <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-0.5">{label}</p>}
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        {extra && <p className="text-xs text-muted">{extra}</p>}
      </div>
      {score !== undefined && (
        <p className="text-lg font-bold text-accent tabular-nums">{score}</p>
      )}
      {active && (
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0" />
      )}
    </div>
  )
}
