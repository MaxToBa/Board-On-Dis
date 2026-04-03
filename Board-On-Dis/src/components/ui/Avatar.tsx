'use client'

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

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const initial = name ? name[0].toUpperCase() : '?'

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'avatar'}
        className={`${sizes[size]} rounded-full object-cover ring-2 ring-white/10 ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-purple/30 ring-2 ring-purple/40 flex items-center justify-center font-bold text-purple ${className}`}
    >
      {initial}
    </div>
  )
}
