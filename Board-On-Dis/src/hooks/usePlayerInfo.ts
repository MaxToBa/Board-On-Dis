'use client'
import { useAuthStore } from '@/store/auth'
import { useSearchParams } from 'next/navigation'

export function usePlayerInfo() {
  const { user, profile } = useAuthStore()
  const params = useSearchParams()

  const nameFromUrl = params.get('name')
  const guestName = typeof window !== 'undefined' ? sessionStorage.getItem('guestName') : null

  const playerName =
    profile?.username ??
    user?.email?.split('@')[0] ??
    nameFromUrl ??
    guestName ??
    'Player'

  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null
  const userId = user?.id ?? null
  const isAuthenticated = !!user
  const roomId = params.get('room') ?? ''
  const mode = (params.get('mode') ?? 'multiplayer') as 'ai' | 'solo' | 'multiplayer'
  const isHost = params.get('host') === '1'
  const difficulty = (params.get('difficulty') ?? 'medium') as 'easy' | 'medium' | 'hard'

  return { playerName, avatarUrl, userId, isAuthenticated, roomId, mode, isHost, difficulty }
}
