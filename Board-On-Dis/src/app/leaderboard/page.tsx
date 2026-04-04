'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { GameResultRecord, GameType } from '@/types'

const GAMES: { id: GameType | 'all'; label: string; emoji: string }[] = [
  { id: 'all', label: 'ทุกเกม', emoji: '🎮' },
  { id: 'tictactoe', label: 'โอ-ซี', emoji: '⭕' },
  { id: 'gomoku', label: 'Gomoku', emoji: '⚫' },
  { id: 'connect-four', label: 'Connect 4', emoji: '🔵' },
  { id: 'checkers', label: 'หมากฮอส', emoji: '🔴' },
  { id: 'battleship', label: 'Battleship', emoji: '🚢' },
  { id: '2048', label: '2048', emoji: '🔢' },
  { id: 'uno', label: 'UNO', emoji: '🃏' },
]

const GAME_LABELS: Record<string, string> = {
  tictactoe: 'โอ-ซี', gomoku: 'Gomoku', 'connect-four': 'Connect 4',
  checkers: 'หมากฮอส', battleship: 'Battleship', '2048': '2048', uno: 'UNO',
}

type Tab = 'ranking' | 'history'

interface RankRow {
  player_name: string
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number
  bestScore: number
}

function LeaderboardPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('ranking')
  const [game, setGame] = useState<GameType | 'all'>('all')
  const [rankings, setRankings] = useState<RankRow[]>([])
  const [history, setHistory] = useState<GameResultRecord[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [tab, game]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    if (tab === 'ranking') {
      let q = supabase.from('game_results').select('player_name, result, score')
      if (game !== 'all') q = q.eq('game', game)
      const { data } = await q
      if (data) {
        const map: Record<string, RankRow> = {}
        for (const r of data) {
          if (!map[r.player_name]) map[r.player_name] = { player_name: r.player_name, wins: 0, losses: 0, draws: 0, total: 0, winRate: 0, bestScore: 0 }
          map[r.player_name].total++
          if (r.result === 'win') map[r.player_name].wins++
          else if (r.result === 'loss') map[r.player_name].losses++
          else map[r.player_name].draws++
          if ((r.score ?? 0) > map[r.player_name].bestScore) map[r.player_name].bestScore = r.score ?? 0
        }
        const rows = Object.values(map).map(r => ({
          ...r,
          winRate: r.total > 0 ? Math.round((r.wins / r.total) * 100) : 0,
        })).sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)
        setRankings(rows)
      }
    } else {
      if (!user) { setLoading(false); return }
      let q = supabase.from('game_results').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
      if (game !== 'all') q = q.eq('game', game)
      const { data } = await q
      if (data) setHistory(data as GameResultRecord[])
    }
    setLoading(false)
  }

  const TROPHY = ['🥇', '🥈', '🥉']
  const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
    win:  { label: 'ชนะ', cls: 'bg-green/15 text-green border-green/25' },
    loss: { label: 'แพ้', cls: 'bg-red/15 text-red border-red/25' },
    draw: { label: 'เสมอ', cls: 'bg-white/10 text-white/60 border-white/15' },
  }

  const filteredRankings = rankings.filter(r =>
    !search || r.player_name.toLowerCase().includes(search.toLowerCase())
  )

  // My stats summary for history tab
  const myStats = tab === 'history' && history.length > 0 ? {
    wins: history.filter(h => h.result === 'win').length,
    losses: history.filter(h => h.result === 'loss').length,
    draws: history.filter(h => h.result === 'draw').length,
    winRate: Math.round((history.filter(h => h.result === 'win').length / history.length) * 100),
    bestScore: Math.max(...history.map(h => h.score ?? 0)),
  } : null

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">🏆 อันดับ &amp; สถิติ</h1>
            <p className="text-sm text-muted mt-1">ติดตามผลการเล่นและเปรียบเทียบกับผู้เล่นอื่น</p>
          </div>
          <Link href="/" className="text-sm text-muted hover:text-white border border-white/10 hover:border-white/20 rounded-xl px-4 py-2 transition-colors">
            ← กลับหน้าหลัก
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex bg-surface rounded-xl p-1 mb-5 w-fit gap-1">
          {(['ranking', 'history'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === t ? 'bg-accent text-bg shadow-lg' : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'ranking' ? '🏆 อันดับรวม' : '📋 ประวัติของฉัน'}
            </button>
          ))}
        </div>

        {/* Game filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          {GAMES.map((g) => (
            <button key={g.id} onClick={() => setGame(g.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                game === g.id ? 'bg-white text-bg shadow' : 'border border-white/10 text-muted hover:text-white hover:border-white/25'
              }`}
            >
              <span>{g.emoji}</span> {g.label}
            </button>
          ))}
        </div>

        {/* Search (ranking only) */}
        {tab === 'ranking' && (
          <div className="relative mb-5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
            <input
              placeholder="ค้นหาชื่อผู้เล่น..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface2 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-accent/50"
            />
          </div>
        )}

        {/* My stats summary */}
        {tab === 'history' && myStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'ชนะ', value: myStats.wins, cls: 'text-green' },
              { label: 'แพ้', value: myStats.losses, cls: 'text-red' },
              { label: 'เสมอ', value: myStats.draws, cls: 'text-muted' },
              { label: 'อัตราชนะ', value: `${myStats.winRate}%`, cls: 'text-accent' },
            ].map(stat => (
              <div key={stat.label} className="bg-surface border border-white/10 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-muted mb-1">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.cls}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted text-sm">กำลังโหลด...</p>
          </div>
        ) : tab === 'ranking' ? (
          <div className="flex flex-col gap-2">
            {filteredRankings.length === 0 ? (
              <div className="text-center py-16 text-muted">ยังไม่มีข้อมูล</div>
            ) : (
              <>
                {/* Column headers */}
                <div className="flex items-center gap-2 px-4 py-1 text-[10px] uppercase tracking-widest text-muted">
                  <span className="w-8" />
                  <span className="flex-1">ผู้เล่น</span>
                  <span className="w-10 text-center text-green">ชนะ</span>
                  <span className="w-10 text-center text-red">แพ้</span>
                  <span className="w-10 text-center">เสมอ</span>
                  <span className="w-12 text-center text-accent">อัตรา%</span>
                  <span className="w-14 text-center">เกมรวม</span>
                </div>
                {filteredRankings.map((row, i) => (
                  <div key={row.player_name}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                      i === 0 ? 'border-yellow-500/30 bg-yellow-500/5' :
                      i === 1 ? 'border-gray-400/30 bg-gray-400/5' :
                      i === 2 ? 'border-orange-700/30 bg-orange-700/5' :
                      'border-white/8 bg-surface hover:border-white/15'
                    }`}
                  >
                    <span className="text-xl w-8 text-center flex-shrink-0">
                      {TROPHY[i] ?? <span className="text-sm text-muted">{i + 1}</span>}
                    </span>
                    <p className="flex-1 text-sm font-semibold text-white truncate">{row.player_name}</p>
                    <span className="w-10 text-center text-sm font-bold text-green">{row.wins}</span>
                    <span className="w-10 text-center text-sm text-red/80">{row.losses}</span>
                    <span className="w-10 text-center text-sm text-muted">{row.draws}</span>
                    <span className={`w-12 text-center text-sm font-bold ${row.winRate >= 60 ? 'text-accent' : 'text-white/60'}`}>
                      {row.winRate}%
                    </span>
                    <span className="w-14 text-center text-xs text-muted">{row.total} เกม</span>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : !user ? (
          <div className="text-center py-16">
            <p className="text-muted mb-4">เข้าสู่ระบบเพื่อดูประวัติการเล่น</p>
            <Link href="/login" className="bg-accent text-bg px-6 py-2 rounded-full font-bold text-sm hover:brightness-110">
              เข้าสู่ระบบ
            </Link>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 text-muted">ยังไม่มีประวัติการเล่น</div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((h) => {
              const badge = RESULT_BADGE[h.result]
              return (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-surface hover:border-white/15 transition-colors">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex-shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{GAME_LABELS[h.game] ?? h.game}</p>
                    <p className="text-xs text-muted">vs {h.opponent}</p>
                  </div>
                  {(h.score ?? 0) > 0 && (
                    <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-lg">
                      {h.score.toLocaleString()} pts
                    </span>
                  )}
                  <span className="text-xs text-muted flex-shrink-0">
                    {new Date(h.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><LeaderboardPage /></Suspense>
}
