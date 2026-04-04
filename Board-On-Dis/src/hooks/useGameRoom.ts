'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseGameRoomOptions {
  roomId: string
  onStateChange: (state: Record<string, unknown>) => void
}

export function useGameRoom({ roomId, onStateChange }: UseGameRoomOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [connected, setConnected] = useState(false)

  // Use a ref for the callback to avoid stale closures without re-subscribing
  const callbackRef = useRef(onStateChange)
  useEffect(() => { callbackRef.current = onStateChange }, [onStateChange])

  useEffect(() => {
    if (!roomId) return

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload: { new: Record<string, unknown> }) => {
          const state = payload.new?.state as Record<string, unknown> | null
          if (state) callbackRef.current(state)
        }
      )
      .subscribe((status: string) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      setConnected(false)
    }
  }, [roomId])

  const updateRoomState = useCallback(async (state: Record<string, unknown>) => {
    if (!roomId) return
    const { error } = await supabase.from('rooms').update({ state }).eq('id', roomId)
    if (error) console.error('[useGameRoom] updateRoomState error:', error)
  }, [roomId])

  const setRoomStatus = useCallback(async (status: 'waiting' | 'playing' | 'finished') => {
    if (!roomId) return
    await supabase.from('rooms').update({ status }).eq('id', roomId)
  }, [roomId])

  return { connected, updateRoomState, setRoomStatus }
}
