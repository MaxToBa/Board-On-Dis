'use client'
import { Suspense } from 'react'
import GameLayout from '@/components/game/GameLayout'
import Link from 'next/link'

function ChessPage() {
  return (
    <GameLayout title="หมากรุกสากล" status="Coming Soon" statusColor="default">
      <div className="text-center py-16">
        <p className="text-6xl mb-4">🚧</p>
        <h2 className="text-2xl font-display text-white mb-2">กำลังพัฒนา</h2>
        <p className="text-muted mb-6">หมากรุกสากลจะมาเร็วๆ นี้ครับ</p>
        <Link href="/" className="bg-accent text-bg px-6 py-2 rounded-full font-bold text-sm hover:brightness-110 transition-all">
          กลับ Lobby
        </Link>
      </div>
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><ChessPage /></Suspense>
}
