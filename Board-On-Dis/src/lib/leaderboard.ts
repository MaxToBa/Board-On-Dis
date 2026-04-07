import { supabase } from '@/lib/supabase'
import type { GameType } from '@/types'

export interface LeaderboardRow {
  userId: string
  playerName: string
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number
  bestScore: number
  bestTile: number
}

/** Leaderboard สำหรับ 2048 (เรียงตาม bestScore) */
export async function get2048Leaderboard(limit = 10): Promise<LeaderboardRow[]> {
  const { data } = await supabase
    .from('game_results')
    .select('user_id, player_name, result, score, best_tile')
    .eq('game', '2048')
    .eq('is_bot', false)
    .not('user_id', 'is', null)

  if (!data) return []

  const map: Record<string, LeaderboardRow> = {}
  for (const r of data) {
    const uid = r.user_id as string
    if (!map[uid]) map[uid] = { userId: uid, playerName: r.player_name, wins: 0, losses: 0, draws: 0, total: 0, winRate: 0, bestScore: 0, bestTile: 0 }
    map[uid].total++
    if (r.result === 'win') map[uid].wins++
    else if (r.result === 'loss') map[uid].losses++
    else map[uid].draws++
    if ((r.score ?? 0) > map[uid].bestScore) map[uid].bestScore = r.score ?? 0
    if ((r.best_tile ?? 0) > map[uid].bestTile) map[uid].bestTile = r.best_tile ?? 0
    map[uid].playerName = r.player_name  // latest name
  }

  return Object.values(map)
    .map(r => ({ ...r, winRate: r.total > 0 ? Math.round((r.wins / r.total) * 100) : 0 }))
    .sort((a, b) => b.bestScore - a.bestScore || b.bestTile - a.bestTile)
    .slice(0, limit)
}

/** Leaderboard สำหรับเกมอื่น (W/L/D aggregate ตาม user_id) */
export async function getGameLeaderboard(game: GameType | 'all', limit = 50): Promise<LeaderboardRow[]> {
  let q = supabase
    .from('game_results')
    .select('user_id, player_name, result, score')
    .eq('is_bot', false)
    .not('user_id', 'is', null)

  if (game !== 'all') q = q.eq('game', game)
  const { data } = await q
  if (!data) return []

  const map: Record<string, LeaderboardRow> = {}
  for (const r of data) {
    const uid = r.user_id as string
    if (!map[uid]) map[uid] = { userId: uid, playerName: r.player_name, wins: 0, losses: 0, draws: 0, total: 0, winRate: 0, bestScore: 0, bestTile: 0 }
    map[uid].total++
    if (r.result === 'win') map[uid].wins++
    else if (r.result === 'loss') map[uid].losses++
    else map[uid].draws++
    if ((r.score ?? 0) > map[uid].bestScore) map[uid].bestScore = r.score ?? 0
    map[uid].playerName = r.player_name
  }

  return Object.values(map)
    .map(r => ({ ...r, winRate: r.total > 0 ? Math.round((r.wins / r.total) * 100) : 0 }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)
    .slice(0, limit)
}
