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
  allPlayers: PlayerInRoom[]           // all players including extras (2-4)
  currentPlayerIndex: number           // index in allPlayers whose turn it is
  firstTurn: 'host' | 'guest' | null
  currentTurn: 'host' | 'guest'
  winner: 'host' | 'guest' | 'draw' | null
  rematchVotes: string[]
  connected: boolean

  markReady: (color: string) => Promise<void>
  markUnready: () => Promise<void>
  updateGameData: (data: Record<string, unknown>) => Promise<void>
  finishGame: (winner: 'host' | 'guest' | 'draw') => Promise<void>
  requestRematch: (resetData: Record<string, unknown>) => Promise<void>

  isMyTurn: boolean
  myPlayerNum: 1 | 2   // 1 = goes first, 2 = goes second
  myPlayerIndex: number // index in allPlayers (0-3)
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
  const initializedRef = useRef(false)

  // Use ref for the callback to avoid stale closures
  const callbackRef = useRef(onGameStateChange)
  useEffect(() => { callbackRef.current = onGameStateChange }, [onGameStateChange])

  const roomStateRef = useRef<RoomState | null>(null)

  // Keep ref in sync with state for use inside callbacks
  const applyState = useCallback((state: RoomState) => {
    roomStateRef.current = state
    setRoomState(state)
    callbackRef.current(state as unknown as Record<string, unknown>)
  }, [])

  // Push state to DB
  const pushState = useCallback(async (state: RoomState) => {
    if (!roomIdRef.current) return
    roomStateRef.current = state
    setRoomState(state)
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

  // Fetch latest state from DB (used by polling and init)
  const fetchAndApply = useCallback(async () => {
    if (!roomIdRef.current) return
    const { data } = await supabase.from('rooms').select('state').eq('id', roomIdRef.current).single()
    if (!data?.state) return
    const state = data.state as RoomState
    // Only apply if different from current local state
    if (JSON.stringify(roomStateRef.current) !== JSON.stringify(state)) {
      applyState(state)
    }
  }, [applyState])

  // Load initial room state from DB
  const loadRoom = useCallback(async () => {
    if (!roomId || initializedRef.current) return
    initializedRef.current = true

    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single()
    if (!data) return

    const state = data.state as RoomState | null

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
        // First time init
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
      } else {
        // Already initialized — sync host info but preserve existing state
        const updated: RoomState = {
          ...(state as RoomState),
          host: { ...(state as RoomState).host, name: playerName, avatarUrl, userId },
        }
        await pushState(updated)
        callbackRef.current(updated as unknown as Record<string, unknown>)
      }
    } else {
      // Guest: read existing state
      if (state) {
        applyState(state)
        // If we haven't joined yet, join as guest or extra player
        const alreadyIn = state.guest?.userId === userId ||
          (state.players ?? []).some((p) => p.userId === userId)
        if (!alreadyIn) {
          await joinAsGuest(state)
        }
      }
    }
  }, [roomId, isHost, playerName, avatarUrl, userId, pushState, applyState]) // eslint-disable-line react-hooks/exhaustive-deps

  async function joinAsGuest(currentState: RoomState) {
    if (!roomIdRef.current) return
    // Don't allow joining after the game has started
    if (currentState.phase !== 'waiting' && currentState.phase !== 'setup') return

    const EXTRA_COLORS = [
      { color: 'amber',  colorBg: '#e8c547' },
      { color: 'green',  colorBg: '#4fcf8e' },
      { color: 'pink',   colorBg: '#ec4899' },
      { color: 'blue',   colorBg: '#3b82f6' },
      { color: 'white',  colorBg: '#f0ede8' },
    ]

    const newPlayer: PlayerInRoom = {
      userId,
      name: playerName,
      avatarUrl,
      ready: false,
      color: 'amber',
      colorBg: '#e8c547',
      score: 0,
    }

    let newState: RoomState
    if (!currentState.guest) {
      // Slot 1: become the guest
      newState = { ...currentState, phase: 'setup', guest: newPlayer }
    } else {
      // Slots 2-3: join as extra player
      // Always use live host/guest for indices 0 and 1 to avoid stale snapshots
      const existing = currentState.players
        ? [currentState.host, currentState.guest ?? currentState.players[1], ...currentState.players.slice(2)]
        : [currentState.host, currentState.guest]
      const slotIndex = existing.length  // 2 = 3rd player, 3 = 4th player
      if (slotIndex >= 6) return         // max 6 players
      const colorSlot = EXTRA_COLORS[slotIndex - 2] ?? EXTRA_COLORS[0]
      newPlayer.color = colorSlot.color
      newPlayer.colorBg = colorSlot.colorBg
      newState = {
        ...currentState,
        phase: 'setup',
        players: [...existing, newPlayer],
      }
    }

    const allNames = [currentState.host.name, ...(newState.players ?? [newState.guest]).filter(Boolean).map((p) => (p as PlayerInRoom).name)]
    await supabase.from('rooms').update({
      state: newState,
      status: 'setup',
      players: allNames,
      updated_at: new Date().toISOString(),
    }).eq('id', roomIdRef.current)
    applyState(newState)
  }

  // Subscribe to realtime changes
  useEffect(() => {
    if (!roomId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`room-mp-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload: { new: Record<string, unknown> }) => {
          const state = payload.new?.state as RoomState | null
          if (state) {
            applyState(state)
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
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling fallback every 2s — ensures sync even when realtime misses an event
  useEffect(() => {
    if (!roomId) return
    const interval = setInterval(fetchAndApply, 2000)
    return () => clearInterval(interval)
  }, [roomId, fetchAndApply])

  // When phase becomes coin_flip and I'm host → start 3s timer to move to playing
  useEffect(() => {
    if (roomState?.phase !== 'coin_flip' || !isHost) return
    const timer = setTimeout(async () => {
      if (!roomIdRef.current || !roomStateRef.current) return
      const { data } = await supabase.from('rooms').select('state').eq('id', roomIdRef.current).single()
      const latest = (data?.state as RoomState) ?? roomStateRef.current
      if (latest.phase !== 'coin_flip') return
      const playState: RoomState = { ...latest, phase: 'playing' }
      await pushState(playState)
    }, 3000)
    return () => clearTimeout(timer)
  }, [roomState?.phase, isHost, pushState])

  const markUnready = useCallback(async () => {
    if (!roomIdRef.current) return
    const { data } = await supabase.from('rooms').select('state').eq('id', roomIdRef.current).single()
    const current = (data?.state as RoomState) ?? roomStateRef.current
    if (!current) return

    let updated: RoomState
    if (isHost) {
      updated = { ...current, host: { ...current.host, ready: false } }
    } else if (current.players) {
      const myIdx = current.players.findIndex((p) => p.userId === userId || p.name === playerName)
      const newPlayers = current.players.map((p, i) => i === myIdx ? { ...p, ready: false } : p)
      updated = { ...current, players: newPlayers }
    } else {
      updated = { ...current, guest: current.guest ? { ...current.guest, ready: false } : current.guest }
    }

    // Keep players[] in sync with live host/guest fields
    if (updated.players) {
      updated = {
        ...updated,
        players: updated.players.map((p, i) => {
          if (i === 0) return updated.host
          if (i === 1) return updated.guest ?? p
          return p
        }),
      }
    }

    await pushState(updated)
  }, [isHost, userId, playerName, pushState]) // eslint-disable-line react-hooks/exhaustive-deps

  const markReady = useCallback(async (color: string) => {
    if (!roomIdRef.current) return
    const { data } = await supabase.from('rooms').select('state').eq('id', roomIdRef.current).single()
    const current = (data?.state as RoomState) ?? roomStateRef.current
    if (!current) return

    // Find and update my player record
    const allPlayers = current.players ?? [current.host, ...(current.guest ? [current.guest] : [])]
    const myIdx = allPlayers.findIndex((p) => p.userId === userId || p.name === playerName)
    const updatedPlayer: PlayerInRoom = {
      ...(myIdx >= 0 ? allPlayers[myIdx] : (isHost ? current.host : current.guest ?? current.host)),
      ready: true,
      color,
      colorBg: colorBgFromValue(color),
    }

    let updated: RoomState
    if (isHost) {
      updated = { ...current, host: updatedPlayer }
    } else if (current.players) {
      const newPlayers = current.players.map((p, i) => i === myIdx ? updatedPlayer : p)
      updated = { ...current, players: newPlayers, guest: myIdx === 1 ? updatedPlayer : current.guest }
    } else {
      updated = { ...current, guest: updatedPlayer }
    }

    // Keep players[] in sync with live host/guest fields
    if (updated.players) {
      updated = {
        ...updated,
        players: updated.players.map((p, i) => {
          if (i === 0) return updated.host
          if (i === 1) return updated.guest ?? p
          return p
        }),
      }
    }

    // Check if ALL players are ready
    const playersToCheck = updated.players ?? [updated.host, ...(updated.guest ? [updated.guest] : [])]
    const allReady = playersToCheck.length >= 2 && playersToCheck.every((p) => p.ready)

    if (allReady) {
      const firstTurn: 'host' | 'guest' = Math.random() < 0.5 ? 'host' : 'guest'
      const firstIndex = firstTurn === 'host' ? 0 : 1
      updated.phase = 'coin_flip'
      updated.firstTurn = firstTurn
      updated.currentTurn = firstTurn
      updated.currentPlayerIndex = firstIndex
    }

    await pushState(updated)
  }, [isHost, userId, playerName, pushState]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateGameData = useCallback(async (data: Record<string, unknown>) => {
    if (!roomIdRef.current || !roomStateRef.current) return
    const newState = { ...roomStateRef.current, ...data } as RoomState
    await pushState(newState)
  }, [pushState])

  const finishGame = useCallback(async (winner: 'host' | 'guest' | 'draw') => {
    if (!roomIdRef.current || !roomStateRef.current) return
    const current = roomStateRef.current
    const newState: RoomState = {
      ...current,
      phase: 'finished',
      winner,
      host: {
        ...current.host,
        score: current.host.score + (winner === 'host' ? 1 : 0),
      },
      guest: current.guest ? {
        ...current.guest,
        score: current.guest.score + (winner === 'guest' ? 1 : 0),
      } : null,
    }
    await pushState(newState)
  }, [pushState])

  const requestRematch = useCallback(async (resetData: Record<string, unknown>) => {
    if (!roomIdRef.current || !roomStateRef.current) return
    const current = roomStateRef.current

    const votes = [...new Set([...current.rematchVotes, playerName])]
    const guestName = current.guest?.name ?? ''
    const bothVoted = votes.includes(current.host.name) && !!guestName && votes.includes(guestName)

    if (bothVoted && current.guest) {
      const firstTurn: 'host' | 'guest' = Math.random() < 0.5 ? 'host' : 'guest'
      const resetState = {
        ...current,
        ...resetData,
        phase: 'coin_flip' as const,
        winner: null,
        firstTurn,
        currentTurn: firstTurn,
        rematchVotes: [],
        host: { ...current.host, ready: true },
        guest: { ...current.guest, ready: true },
      } as RoomState
      await pushState(resetState)
    } else {
      await pushState({ ...current, rematchVotes: votes })
    }
  }, [playerName, pushState])

  // Derived values
  const phase = roomState?.phase ?? 'waiting'
  const hostInfo = roomState?.host ?? null
  const guestInfo = roomState?.guest ?? null
  const allPlayers: PlayerInRoom[] = roomState?.players
    ? [roomState.host, ...(roomState.guest ? [roomState.guest] : []), ...roomState.players.slice(2)]
    : [hostInfo, ...(guestInfo ? [guestInfo] : [])].filter(Boolean) as PlayerInRoom[]
  const myInfo = isHost ? hostInfo : (roomState?.players
    ? roomState.players.find((p) => p.userId === userId || p.name === playerName) ?? guestInfo
    : guestInfo)
  const opponentInfo = isHost ? guestInfo : hostInfo
  const firstTurn = roomState?.firstTurn ?? null
  const currentTurn = roomState?.currentTurn ?? 'host'
  const currentPlayerIndex = roomState?.currentPlayerIndex ?? (currentTurn === 'host' ? 0 : 1)
  const winner = roomState?.winner ?? null
  const rematchVotes = roomState?.rematchVotes ?? []
  const isMyTurn = currentTurn === (isHost ? 'host' : 'guest')

  const myRole = isHost ? 'host' : 'guest'
  const myPlayerNum: 1 | 2 = firstTurn === null
    ? (isHost ? 1 : 2)
    : firstTurn === myRole ? 1 : 2
  const myPlayerIndex = allPlayers.findIndex((p) => p.userId === userId || p.name === playerName)

  return {
    phase,
    hostInfo,
    guestInfo,
    myInfo,
    opponentInfo,
    allPlayers,
    currentPlayerIndex,
    firstTurn,
    currentTurn,
    winner,
    rematchVotes,
    connected,
    markReady,
    markUnready,
    updateGameData,
    finishGame,
    requestRematch,
    isMyTurn,
    myPlayerNum,
    myPlayerIndex: myPlayerIndex >= 0 ? myPlayerIndex : (isHost ? 0 : 1),
  }
}
