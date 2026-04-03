'use client'
import { useState, useEffect, Suspense } from 'react'
import Header from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { GameResultRecord, GameType } from '@/types'

const GAMES: { id: GameType | 'all'; label: string }[] = [
  { id: 'all', label: 'ทุกเกม' },
  { id: 'tictactoe', label: 'โอ-ซี' },
  { id: 'gomoku', label: 'Gomoku' },
  { id: 'connect-four', label: 'Connect 4' },
  { id: 'checkers', label: 'หมากฮอส' },
  { id: 'battleship', label: 'Battleship' },
  { id: '2048', label: '2048' },
  { id: 'uno', label: 'UNO' },
]

type Tab = 'ranking' | 'history'

interface RankRow {
  player_name: string
  wins: number
  losses: number
  draws: number
}

function LeaderboardPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('ranking')
  const [game, setGame] = useState<GameType | 'all'>('all')
  const [rankings, setRankings] = useState<RankRow[]>([])
  const [history, setHistory] = useState<GameResultRecord[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [tab, game]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    if (tab === 'ranking') {
      let q = supabase.from('game_results').select('player_name, result')
      if (game !== 'all') q = q.eq('game', game)
      const { data } = await q
      if (data) {
        const map: Record<string, RankRow> = {}
        for (const r of data) {
          if (!map[r.player_name]) map[r.player_name] = { player_name: r.player_name, wins: 0, losses: 0, draws: 0 }
          if (r.result === 'win') map[r.player_name].wins++
          else if (r.result === 'loss') map[r.player_name].losses++
          else map[r.player_name].draws++
        }
        const rows = Object.values(map).sort((a, b) => b.wins - a.wins)
        setRankings(rows)
      }
    } else {
      if (!user) { setLoading(false); return }
      let q = supabase.from('game_results').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      if (game !== 'all') q = q.eq('game', game)
      const { data } = await q
      if (data) setHistory(data as GameResultRecord[])
    }
    setLoading(false)
  }

  const TROPHY = ['🥇', '🥈', '🥉']
  const RESULT_COLOR: Record<string, string> = { win: 'text-green', loss: 'text-red', draw: 'text-muted' }
  const RESULT_LABEL: Record<string, string> = { win: 'ชนะ', loss: 'แพ้', draw: 'เสมอ' }

  const filteredRankings = rankings.filter((r) =>
    !search || r.player_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">อันดับ & ประวัติ</h1>

        {/* Tabs */}
        <div className="flex bg-surface rounded-xl p-1 mb-5 w-fit">
          {(['ranking', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === t ? 'bg-accent text-bg' : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'ranking' ? '🏆 อันดับ' : '📋 ประวัติของฉัน'}
            </button>
          ))}
        </div>

        {/* Game filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => setGame(g.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                game === g.id ? 'bg-white text-bg' : 'border border-white/10 text-muted hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Search (ranking only) */}
        {tab === 'ranking' && (
          <input
            placeholder="ค้นหาชื่อผู้เล่น..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-accent/50 mb-5"
          />
        )}

        {loading ? (
          <div className="text-center py-16 text-muted">กำลังโหลด...</div>
        ) : tab === 'ranking' ? (
          <div className="flex flex-col gap-2">
            {filteredRankings.length === 0 ? (
              <div className="text-center py-16 text-muted">ยังไม่มีข้อมูล</div>
            ) : (
              filteredRankings.map((row, i) => (
                <div
                  key={row.player_name}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all ${
                    i < 3 ? 'border-accent/20 bg-accent/5' : 'border-white/10 bg-surface'
                  }`}
                >
                  <span className="text-xl w-8 text-center">{TROPHY[i] ?? `${i + 1}.`}</span>
                  <p className="flex-1 text-sm font-semibold text-white">{row.player_name}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green">{row.wins}W</span>
                    <span className="text-red">{row.losses}L</span>
                    <span className="text-muted">{row.draws}D</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : !user ? (
          <div className="text-center py-16 text-muted">เข้าสู่ระบบเพื่อดูประวัติ</div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 text-muted">ยังไม่มีประวัติการเล่น</div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/10 bg-surface">
                <span className={`text-sm font-bold w-12 ${RESULT_COLOR[h.result]}`}>{RESULT_LABEL[h.result]}</span>
                <div className="flex-1">
                  <p className="text-sm text-white">{h.game}</p>
                  <p className="text-xs text-muted">vs {h.opponent}</p>
                </div>
                {h.score > 0 && <span className="text-xs text-accent">{h.score.toLocaleString()} pts</span>}
                <span className="text-xs text-muted">{new Date(h.created_at).toLocaleDateString('th-TH')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><LeaderboardPage /></Suspense>
}
