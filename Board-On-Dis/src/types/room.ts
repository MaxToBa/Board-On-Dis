export type RoomPhase =
  | 'waiting'      // host waiting for guest
  | 'setup'        // both in, choosing colors + ready
  | 'coin_flip'    // random who goes first (3s animation)
  | 'playing'      // game in progress
  | 'finished'     // game over, showing result

export interface PlayerInRoom {
  userId: string | null
  name: string
  avatarUrl: string | null
  ready: boolean
  color: string       // selected color value e.g. 'purple'
  colorBg: string     // hex e.g. '#7c6af5'
  score: number
}

/** Everything stored in rooms.state JSON column */
export interface RoomState {
  phase: RoomPhase
  host: PlayerInRoom
  guest: PlayerInRoom | null
  firstTurn: 'host' | 'guest' | null   // set after coin flip
  currentTurn: 'host' | 'guest'
  winner: 'host' | 'guest' | 'draw' | null
  rematchVotes: string[]                // player names who voted rematch
  [key: string]: unknown               // game-specific fields mixed in
}

export interface ColorOption {
  value: string
  label: string
  bg: string
}

export const COLOR_OPTIONS: ColorOption[] = [
  { value: 'purple', label: 'ม่วง',     bg: '#7c6af5' },
  { value: 'amber',  label: 'ทอง',      bg: '#e8c547' },
  { value: 'red',    label: 'แดง',      bg: '#f05a5a' },
  { value: 'blue',   label: 'น้ำเงิน',  bg: '#3b82f6' },
  { value: 'green',  label: 'เขียว',    bg: '#4fcf8e' },
  { value: 'pink',   label: 'ชมพู',     bg: '#ec4899' },
  { value: 'white',  label: 'ขาว',      bg: '#f0ede8' },
  { value: 'black',  label: 'ดำ',       bg: '#2a2a3a' },
]

export function colorBgFromValue(value: string): string {
  return COLOR_OPTIONS.find((c) => c.value === value)?.bg ?? '#7c6af5'
}
