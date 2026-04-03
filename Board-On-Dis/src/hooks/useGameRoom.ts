'use client'
import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseGameRoomOptions {
  roomId: string
  onStateChange: (state: Record<string, unknown>) => void
}

export function useGameRoom({ roomId, onStateChange }: UseGameRoomOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!roomId) return
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => { onStateChange(payload.new.state as Record<string, unknown>) }
      )
      .subscribe()
    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateRoomState = useCallback(async (state: Record<string, unknown>) => {
    await supabase.from('rooms').update({ state }).eq('id', roomId)
  }, [roomId])

  const setRoomStatus = useCallback(async (status: 'waiting' | 'playing' | 'finished') => {
    await supabase.from('rooms').update({ status }).eq('id', roomId)
  }, [roomId])

  return { updateRoomState, setRoomStatus }
}
