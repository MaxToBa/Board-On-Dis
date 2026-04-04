'use client'
import { useState } from 'react'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-20 h-20 text-2xl',
}

const COLORS = [
  'bg-purple/30 text-purple ring-purple/40',
  'bg-accent/30 text-accent ring-accent/40',
  'bg-green/30 text-green ring-green/40',
  'bg-red/30 text-red ring-red/40',
  'bg-blue-400/30 text-blue-400 ring-blue-400/40',
]

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false)

  const initial = name ? name[0].toUpperCase() : '?'
  const colorClass = COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length]
  const showImage = src && !imgError

  if (showImage) {
    return (
      <img
        src={src}
        alt={name ?? 'avatar'}
        referrerPolicy="no-referrer"
        className={`${sizes[size]} rounded-full object-cover ring-2 ring-white/10 flex-shrink-0 ${className}`}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div className={`${sizes[size]} rounded-full ring-2 flex items-center justify-center font-bold flex-shrink-0 ${colorClass} ${className}`}>
      {initial}
    </div>
  )
}
