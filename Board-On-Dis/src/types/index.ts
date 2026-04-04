export type GameType =
  | 'tictactoe'
  | 'gomoku'
  | 'battleship'
  | 'uno'
  | 'checkers'
  | 'connect-four'
  | '2048'
  | 'chess'

export type GameResult = 'win' | 'loss' | 'draw'

export interface Room {
  id: string
  game: GameType
  state: Record<string, unknown>
  players: string[]
  status: 'waiting' | 'playing' | 'finished'
  created_at: string
}

export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  updated_at: string
}

export interface GameResultRecord {
  id: string
  user_id: string | null
  player_name: string
  game: GameType
  result: GameResult
  opponent: string
  score: number
  best_tile: number
  time_played: number
  created_at: string
}

export interface Message {
  id: string
  room_id: string
  player_name: string
  player_avatar?: string | null
  message: string
  created_at: string
}
