import { supabase } from '@/lib/supabase'
import type { Board } from '@/lib/games/game-2048'

interface Save2048State {
  board: Board
  score: number
  best: number
}

export async function save2048Game(
  userId: string,
  state: Save2048State,
  timePlayed: number,
): Promise<void> {
  const { error } = await supabase.from('saved_games').upsert({
    user_id: userId,
    game: '2048',
    state: state as unknown as Record<string, unknown>,
    score: state.score,
    best_tile: Math.max(...state.board.flat()),
    time_played: timePlayed,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game' })
  if (error) console.error('[save2048Game]', error.message)
}

export async function load2048Game(userId: string): Promise<Save2048State | null> {
  const { data, error } = await supabase
    .from('saved_games')
    .select('state')
    .eq('user_id', userId)
    .eq('game', '2048')
    .single()
  if (error || !data) return null
  return data.state as Save2048State
}

export async function delete2048Save(userId: string): Promise<void> {
  await supabase
    .from('saved_games')
    .delete()
    .eq('user_id', userId)
    .eq('game', '2048')
}
