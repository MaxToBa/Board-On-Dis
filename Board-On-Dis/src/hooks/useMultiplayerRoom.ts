'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { colorBgFromValue } from '@/types/room'
import type { RoomState, RoomPhase, PlayerInRoom } from '@/types/room'

interface UseMultiplayerRoomOptions {
  roomId: string
  isHost: boolean
  playerName: string
  avatarUrl: string | null
  userId: string | null
  /** Called when game-specific state changes (board, turn, etc.) */
  onGameStateChange: (state: Record<string, unknown>) => void
}

interface UseMultiplayerRoomReturn {
  phase: RoomPhase
  hostInfo: PlayerInRoom | null
  guestInfo: PlayerInRoom | null
  myInfo: PlayerInRoom | null
  opponentInfo: PlayerInRoom | null
  firstTurn: 'host' | 'guest' | null
  currentTurn: 'host' | 'guest'
  winner: 'host' | 'guest' | 'draw' | null
  rematchVotes: string[]
  connected: boolean

  markReady: (color: string) => Promise<void>
  updateGameData: (data: Record<string, unknown>) => Promise<void>
  finishGame: (winner: 'host' | 'guest' | 'draw') => Promise<void>
  requestRematch: (resetData: Record<string, unknown>) => Promise<void>

  isMyTurn: boolean
  myPlayerNum: 1 | 2   // 1 = goes first, 2 = goes second
}

export function useMultiplayerRoom({
  roomId,
  isHost,
  playerName,
  avatarUrl,
  userId,
  onGameStateChange,
}: UseMultiplayerRoomOptions): UseMultiplayerRoomReturn {
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [connected, setConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const roomIdRef = useRef(roomId)
  roomIdRef.current = roomId

  // Use ref for the callback to avoid stale closures
  const callbackRef = useRef(onGameStateChange)
  useEffect(() => { callbackRef.current = onGameStateChange }, [onGameStateChange])

  // Push state to DB
  const pushState = useCallback(async (state: RoomState) => {
    if (!roomIdRef.current) return
    const { error } = await supabase
      .from('rooms')
      .update({
        state,
        status: state.phase,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomIdRef.current)
    if (error) console.error('[useMultiplayerRoom] pushState error:', error)
  }, [])

  // Load initial room state from DB
  const loadRoom = useCallback(async () => {
    if (!roomId) return
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single()
    if (!data) return

    const state = data.state as RoomState | null

    // If host: initialize with new format if not yet done
    if (isHost) {
      const hostInfo: PlayerInRoom = {
        userId,
        name: playerName,
        avatarUrl,
        ready: false,
        color: 'purple',
        colorBg: '#7c6af5',
        score: state?.host?.score ?? 0,
      }
      if (!state?.phase) {
        const newState: RoomState = {
          phase: 'waiting',
          host: hostInfo,
          guest: null,
          firstTurn: null,
          currentTurn: 'host',
          winner: null,
          rematchVotes: [],
        }
        await pushState(newState)
        setRoomState(newState)
      } else {
        // Already initialized — just sync local state
        // But update host info in case avatar/name changed
        const updated: RoomState = {
          ...(state as RoomState),
          host: { ...(state as RoomState).host, name: playerName, avatarUrl, userId },
        }
        await pushState(updated)
        setRoomState(updated)
        callbackRef.current(updated as unknown as Record<string, unknown>)
      }
    } else {
      // Guest: read existing state
      if (state) {
        setRoomState(state)
        callbackRef.current(state as unknown as Record<string, unknown>)
        // If we haven't joined yet (guest is null), join now
        if (!state.guest || state.guest.name !== playerName) {
          await joinAsGuest(state)
        }
      }
    }
  }, [roomId, isHost, playerName, avatarUrl, userId, pushState]) // eslint-disable-line react-hooks/exhaustive-deps

  async function joinAsGuest(currentState: RoomState) {
    if (!roomIdRef.current) return
    const guestInfo: PlayerInRoom = {
      userId,
      name: playerName,
      avatarUrl,
      ready: false,
      color: 'amber',
      colorBg: '#e8c547',
      score: currentState.guest?.score ?? 0,
    }
    const newState: RoomState = {
      ...currentState,
      phase: 'setup',
      guest: guestInfo,
    }
    await supabase.from('rooms').update({
      state: newState,
      status: 'setup',
      players: [currentState.host.name, playerName],
      updated_at: new Date().toISOString(),
    }).eq('id', roomIdRef.current)
    setRoomState(newState)
  }

  // Subscribe to realtime changes
  useEffect(() => {
    if (!roomId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`room-mp-${roomId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload: { new: Record<string, unknown> }) => {
          const state = payload.new?.state as RoomState | null
          if (state) {
            setRoomState(state)
            callbackRef.current(state as unknown as Record<string, unknown>)
          }
        }
      )
      .subscribe((status: string) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel
    loadRoom()

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      setConnected(false)
    }
  }, [roomId, loadRoom])

  // When phase becomes coin_flip and I'm host → start 3s timer to move to playing
  useEffect(() => {
    if (roomState?.phase !== 'coin_flip' || !isHost) return
    const timer = setTimeout(async () => {
      if (!roomIdRef.current || !roomState) return
      const { data } = await supabase.from('rooms').select('state').eq('id', roomIdRef.current).single()
      const latest = (data?.state as RoomState) ?? roomState
      if (latest.phase !== 'coin_flip') return // already changed
      const playState: RoomState = { ...latest, phase: 'playing' }
      await pushState(playState)
    }, 3000)
    return () => clearTimeout(timer)
  }, [roomState?.phase, isHost, pushState]) // eslint-disable-line react-hooks/exhaustive-deps

  const markReady = useCallback(async (color: string) => {
    if (!roomIdRef.current) return
    // Read latest from DB to avoid race condition
    const { data } = await supabase.from('rooms').select('state').eq('id', roomIdRef.current).single()
    const current = (data?.state as RoomState) ?? roomState
    if (!current) return

    const currentPlayer = isHost ? current.host : (current.guest ?? current.host)
    const updatedPlayer: PlayerInRoom = {
      ...currentPlayer,
      ready: true,
      color,
      colorBg: colorBgFromValue(color),
    }
    const updated: RoomState = isHost
      ? { ...current, host: updatedPlayer }
      : { ...current, guest: updatedPlayer }

    const otherReady = isHost
      ? (updated.guest?.ready ?? false)
      : updated.host.ready

    if (otherReady && updated.guest) {
      // Both ready → trigger coin flip
      const firstTurn: 'host' | 'guest' = Math.random() < 0.5 ? 'host' : 'guest'
      updated.phase = 'coin_flip'
      updated.firstTurn = firstTurn
      updated.currentTurn = firstTurn
    }

    await pushState(updated)
    setRoomState(updated)
  }, [roomId, roomState, isHost, pushState]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateGameData = useCallback(async (data: Record<string, unknown>) => {
    if (!roomIdRef.current || !roomState) return
    const newState = { ...roomState, ...data } as RoomState
    await pushState(newState)
  }, [roomState, pushState])

  const finishGame = useCallback(async (winner: 'host' | 'guest' | 'draw') => {
    if (!roomIdRef.current || !roomState) return
    const newState: RoomState = {
      ...roomState,
      phase: 'finished',
      winner,
      host: {
        ...roomState.host,
        score: roomState.host.score + (winner === 'host' ? 1 : 0),
      },
      guest: roomState.guest ? {
        ...roomState.guest,
        score: roomState.guest.score + (winner === 'guest' ? 1 : 0),
      } : null,
    }
    await pushState(newState)
  }, [roomState, pushState])

  const requestRematch = useCallback(async (resetData: Record<string, unknown>) => {
    if (!roomIdRef.current || !roomState) return

    const votes = [...new Set([...roomState.rematchVotes, playerName])]
    const guestName = roomState.guest?.name ?? ''
    const bothVoted = votes.includes(roomState.host.name) && !!guestName && votes.includes(guestName)

    if (bothVoted && roomState.guest) {
      // Reset for new game
      const firstTurn: 'host' | 'guest' = Math.random() < 0.5 ? 'host' : 'guest'
      const resetState = {
        ...roomState,
        ...resetData,
        phase: 'coin_flip' as const,
        winner: null,
        firstTurn,
        currentTurn: firstTurn,
        rematchVotes: [],
        host: { ...roomState.host, ready: true },
        guest: { ...roomState.guest, ready: true },
      } as RoomState
      await pushState(resetState)
    } else {
      await pushState({ ...roomState, rematchVotes: votes })
    }
  }, [roomState, playerName, pushState])

  // Derived values
  const phase = roomState?.phase ?? 'waiting'
  const hostInfo = roomState?.host ?? null
  const guestInfo = roomState?.guest ?? null
  const myInfo = isHost ? hostInfo : guestInfo
  const opponentInfo = isHost ? guestInfo : hostInfo
  const firstTurn = roomState?.firstTurn ?? null
  const currentTurn = roomState?.currentTurn ?? 'host'
  const winner = roomState?.winner ?? null
  const rematchVotes = roomState?.rematchVotes ?? []
  const isMyTurn = currentTurn === (isHost ? 'host' : 'guest')

  // myPlayerNum: 1 = goes first (firstTurn matches my role), 2 = goes second
  const myRole = isHost ? 'host' : 'guest'
  const myPlayerNum: 1 | 2 = firstTurn === null
    ? (isHost ? 1 : 2)
    : firstTurn === myRole ? 1 : 2

  return {
    phase,
    hostInfo,
    guestInfo,
    myInfo,
    opponentInfo,
    firstTurn,
    currentTurn,
    winner,
    rematchVotes,
    connected,
    markReady,
    updateGameData,
    finishGame,
    requestRematch,
    isMyTurn,
    myPlayerNum,
  }
}
