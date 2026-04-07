'use client'
import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Avatar from '@/components/ui/Avatar'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { GameResultRecord, GameType } from '@/types'

const GAME_LABELS: Record<string, string> = {
  tictactoe: 'โอ-ซี', gomoku: 'Gomoku', 'connect-four': 'Connect 4',
  checkers: 'หมากฮอส', battleship: 'Battleship', '2048': '2048', uno: 'UNO',
}
const GAME_EMOJI: Record<string, string> = {
  tictactoe: '⭕', gomoku: '⚫', 'connect-four': '🔵',
  checkers: '🔴', battleship: '🚢', '2048': '🔢', uno: '🃏',
}

interface ProfileData {
  id: string
  username: string | null
  avatar_url: string | null
  created_at: string
}

interface GameStats {
  game: GameType
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number
  bestScore: number
}

function PublicProfilePage() {
  const params = useParams()
  const targetUserId = params.userId as string
  const { user } = useAuthStore()
  const isOwnProfile = user?.id === targetUserId

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [gameStats, setGameStats] = useState<GameStats[]>([])
  const [recentGames, setRecentGames] = useState<GameResultRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [targetUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    setLoading(true)

    // Load profile (from profiles table, joined with auth for created_at)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, updated_at')
      .eq('id', targetUserId)
      .single()

    if (!profileData) {
      // Try to get basic info from game_results if no profile row exists
      const { data: resultData } = await supabase
        .from('game_results')
        .select('player_name, user_id')
        .eq('user_id', targetUserId)
        .limit(1)
        .single()

      if (!resultData) { setNotFound(true); setLoading(false); return }

      setProfile({
        id: targetUserId,
        username: resultData.player_name,
        avatar_url: null,
        created_at: '',
      })
    } else {
      setProfile({
        id: profileData.id,
        username: profileData.username,
        avatar_url: profileData.avatar_url,
        created_at: profileData.updated_at ?? '',
      })
    }

    // Load game results (PvP only: is_bot = false)
    const { data: results } = await supabase
      .from('game_results')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('is_bot', false)
      .order('created_at', { ascending: false })

    if (results) {
      // Aggregate per game
      const map: Record<string, GameStats> = {}
      for (const r of results) {
        if (!map[r.game]) map[r.game] = { game: r.game as GameType, wins: 0, losses: 0, draws: 0, total: 0, winRate: 0, bestScore: 0 }
        map[r.game].total++
        if (r.result === 'win') map[r.game].wins++
        else if (r.result === 'loss') map[r.game].losses++
        else map[r.game].draws++
        if ((r.score ?? 0) > map[r.game].bestScore) map[r.game].bestScore = r.score ?? 0
      }
      const stats = Object.values(map)
        .map(s => ({ ...s, winRate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0 }))
        .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
      setGameStats(stats)
      setRecentGames(results.slice(0, 10) as GameResultRecord[])
    }

    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-2xl">😕</p>
        <p className="text-white font-bold">ไม่พบผู้เล่นนี้</p>
        <Link href="/" className="text-sm text-muted hover:text-white transition-colors">← กลับหน้าหลัก</Link>
      </div>
    </div>
  )

  const displayName = profile?.username ?? 'ผู้เล่น'
  const bestGame = gameStats[0]
  const totalWins = gameStats.reduce((s, g) => s + g.wins, 0)
  const totalGames = gameStats.reduce((s, g) => s + g.total, 0)
  const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
    win:  { label: 'ชนะ', cls: 'bg-green/15 text-green border-green/25' },
    loss: { label: 'แพ้', cls: 'bg-red/15 text-red border-red/25' },
    draw: { label: 'เสมอ', cls: 'bg-white/10 text-white/60 border-white/15' },
  }

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back */}
        <Link href="/leaderboard" className="text-sm text-muted hover:text-white transition-colors mb-6 inline-block">
          ← กลับ Leaderboard
        </Link>

        {/* Profile header */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 mb-5 flex items-center gap-5">
          <Avatar src={profile?.avatar_url} name={displayName} size="xl" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{displayName}</h1>
            {profile?.created_at && (
              <p className="text-xs text-muted mt-1">
                เข้าร่วมเมื่อ {new Date(profile.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}
              </p>
            )}
            <div className="flex gap-4 mt-3">
              <div className="text-center">
                <div className="text-lg font-bold text-accent">{totalWins}</div>
                <div className="text-[10px] text-muted uppercase tracking-wide">ชนะ</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">{totalGames}</div>
                <div className="text-[10px] text-muted uppercase tracking-wide">เกมรวม</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${overallWinRate >= 60 ? 'text-green' : 'text-white/70'}`}>{overallWinRate}%</div>
                <div className="text-[10px] text-muted uppercase tracking-wide">อัตราชนะ</div>
              </div>
            </div>
          </div>
          {isOwnProfile && (
            <Link href="/profile"
              className="px-4 py-2 border border-white/15 rounded-xl text-xs font-bold text-muted hover:text-white hover:border-white/30 transition-all flex-shrink-0">
              แก้ไข
            </Link>
          )}
        </div>

        {/* Best game highlight */}
        {bestGame && (
          <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 mb-5 flex items-center gap-4">
            <span className="text-3xl">{GAME_EMOJI[bestGame.game] ?? '🎮'}</span>
            <div>
              <p className="text-xs text-accent font-bold uppercase tracking-wide">เกมที่เก่งที่สุด</p>
              <p className="text-white font-bold">{GAME_LABELS[bestGame.game] ?? bestGame.game}</p>
              <p className="text-xs text-muted mt-0.5">{bestGame.wins}W / {bestGame.losses}L · {bestGame.winRate}% winrate</p>
            </div>
          </div>
        )}

        {/* Per-game stats */}
        {gameStats.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-wide mb-3">สถิติ PvP แต่ละเกม</h2>
            <div className="flex flex-col gap-2">
              {gameStats.map((g) => (
                <div key={g.game} className="bg-surface border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-xl flex-shrink-0">{GAME_EMOJI[g.game] ?? '🎮'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">{GAME_LABELS[g.game] ?? g.game}</span>
                      <span className={`text-sm font-bold ${g.winRate >= 60 ? 'text-accent' : 'text-white/60'}`}>{g.winRate}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${g.winRate}%` }} />
                    </div>
                    <div className="flex gap-3 mt-1.5 text-[10px] text-muted">
                      <span className="text-green">{g.wins}W</span>
                      <span className="text-red/70">{g.losses}L</span>
                      {g.draws > 0 && <span>{g.draws}D</span>}
                      <span>{g.total} เกม</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent 10 games */}
        {recentGames.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-wide mb-3">ประวัติ 10 เกมล่าสุด (PvP)</h2>
            <div className="flex flex-col gap-2">
              {recentGames.map((h) => {
                const badge = RESULT_BADGE[h.result]
                return (
                  <div key={h.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-surface">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex-shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{GAME_LABELS[h.game] ?? h.game}</p>
                      <p className="text-xs text-muted">vs {h.opponent}</p>
                    </div>
                    {(h.score ?? 0) > 0 && (
                      <span className="text-xs font-bold text-accent">{h.score.toLocaleString()} pts</span>
                    )}
                    <span className="text-xs text-muted flex-shrink-0">
                      {new Date(h.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {gameStats.length === 0 && !loading && (
          <div className="text-center py-12 text-muted">ยังไม่มีประวัติ PvP</div>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><PublicProfilePage /></Suspense>
}
