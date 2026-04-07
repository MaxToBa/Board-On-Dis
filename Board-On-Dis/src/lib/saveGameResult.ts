import { supabase } from '@/lib/supabase'
import type { GameType, GameResult } from '@/types'

interface SaveGameResultParams {
  userId: string
  playerName: string
  game: GameType
  result: GameResult
  opponent: string         // ชื่อคู่แข่ง
  isBot?: boolean          // true = AI/bot, false = ผู้เล่นจริง
  score?: number
  bestTile?: number
  timePlayed?: number
}

/**
 * บันทึกผลการเล่น — ถ้าไม่มี userId (guest) จะไม่บันทึก
 * opponent เป็น 'AI' หรือมีคำว่า AI/bot → is_bot = true อัตโนมัติ
 */
export async function saveGameResult({
  userId,
  playerName,
  game,
  result,
  opponent,
  isBot,
  score = 0,
  bestTile = 0,
  timePlayed = 0,
}: SaveGameResultParams): Promise<void> {
  if (!userId) return   // guest ไม่บันทึก

  const resolvedIsBot = isBot ?? /^(AI|bot|Claude)/i.test(opponent)

  const { error } = await supabase.from('game_results').insert({
    user_id: userId,
    player_name: playerName,
    game,
    result,
    opponent,
    is_bot: resolvedIsBot,
    score,
    best_tile: bestTile,
    time_played: timePlayed,
  })

  if (error) console.error('[saveGameResult]', error.message)
}
