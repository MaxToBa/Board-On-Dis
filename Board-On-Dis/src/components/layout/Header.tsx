'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import Avatar from '@/components/ui/Avatar'
import { supabase } from '@/lib/supabase'

export default function Header() {
  const { user, profile, signOut } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const key = crypto.randomUUID()
    const channel = supabase.channel('global-presence', {
      config: { presence: { key } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [])

  const displayName = profile?.username ?? user?.email?.split('@')[0] ?? 'Guest'

  return (
    <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Board On Dis" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-white hidden sm:block">Board On Dis</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Online count badge */}
          {onlineCount !== null && (
            <div className="hidden sm:flex items-center gap-1.5 bg-green/10 border border-green/20 text-green text-xs font-bold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
              {onlineCount} ออนไลน์
            </div>
          )}

          {/* Leaderboard button */}
          <Link
            href="/leaderboard"
            className="flex items-center gap-1.5 border border-white/10 hover:border-white/25 hover:bg-white/5 text-white/60 hover:text-white rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
          >
            🏆 <span className="hidden sm:inline ml-0.5">อันดับ</span>
          </Link>

          {user ? (
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <Avatar src={profile?.avatar_url ?? user?.user_metadata?.avatar_url} name={displayName} size="sm" />
                <span className="text-sm text-white/80 hidden sm:block">{displayName}</span>
                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-3 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    โปรไฟล์
                  </Link>
                  <div className="border-t border-white/10" />
                  <button
                    onClick={async () => { setOpen(false); await signOut(); window.location.href = '/login' }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red hover:bg-white/5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                // Clear guest cookie so proxy doesn't redirect back to /
                document.cookie = 'guestName=; path=/; max-age=0'
                window.location.href = '/login'
              }}
              className="text-sm text-accent hover:text-accent/80 font-semibold transition-colors"
            >
              เข้าสู่ระบบ
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
