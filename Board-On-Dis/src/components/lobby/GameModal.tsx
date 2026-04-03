'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { sound } from '@/lib/sound'
import type { GameInfo } from './GameCard'
import type { GameType } from '@/types'

interface GameModalProps {
  game: GameInfo | null
  onClose: () => void
}

const SOLO_ONLY: GameType[] = ['2048']
const COMING_SOON: GameType[] = ['chess']

export default function GameModal({ game, onClose }: GameModalProps) {
  const [step, setStep] = useState<'select' | 'create' | 'join'>('select')
  const [roomCode, setRoomCode] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, profile } = useAuthStore()
  const { add: toast } = useToast()
  const router = useRouter()

  const playerName =
    profile?.username ??
    user?.email?.split('@')[0] ??
    (typeof window !== 'undefined' ? sessionStorage.getItem('guestName') : null) ??
    'Guest'

  function handleClose() {
    setStep('select')
    setRoomCode('')
    setCreatedCode('')
    onClose()
  }

  async function createRoom() {
    if (!game) return
    setLoading(true)
    try {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase()
      const { error } = await supabase.from('rooms').insert({
        id: code,
        game: game.id,
        state: {},
        players: [playerName],
        status: 'waiting',
      })
      if (error) throw error
      setCreatedCode(code)
      setStep('create')
      sound.join()
    } catch (err: unknown) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function joinRoom() {
    if (!game || !roomCode.trim()) return
    setLoading(true)
    try {
      const code = roomCode.trim().toUpperCase()
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', code)
        .eq('game', game.id)
        .single()
      if (error || !data) throw new Error('ไม่พบห้องนี้')
      if (data.status !== 'waiting') throw new Error('ห้องนี้เริ่มเล่นไปแล้ว')
      router.push(`/games/${game.id}?room=${code}&name=${encodeURIComponent(playerName)}`)
      handleClose()
    } catch (err: unknown) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function startVsAI() {
    if (!game) return
    sound.click()
    router.push(`/games/${game.id}?mode=ai&name=${encodeURIComponent(playerName)}`)
    handleClose()
  }

  function startSolo() {
    if (!game) return
    sound.click()
    router.push(`/games/${game.id}?mode=solo&name=${encodeURIComponent(playerName)}`)
    handleClose()
  }

  if (!game) return null
  const isSolo = SOLO_ONLY.includes(game.id)
  const isComingSoon = COMING_SOON.includes(game.id)

  return (
    <Modal open={!!game} onClose={handleClose} className="max-w-sm">
      {step === 'select' && (
        <>
          <div className="text-center mb-5">
            <span className="text-5xl block mb-3">{game.emoji}</span>
            <h2 className="text-2xl font-display text-white">{game.name}</h2>
            <p className="text-sm text-muted mt-1">{game.desc}</p>
          </div>

          {isComingSoon ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-3">🚧</p>
              <p className="text-white font-semibold">Coming Soon</p>
              <p className="text-sm text-muted mt-1">กำลังพัฒนาอยู่นะครับ</p>
            </div>
          ) : isSolo ? (
            <div className="flex flex-col gap-3">
              <ModeButton
                icon="🎮"
                title="เริ่มเล่น"
                sub="เล่นคนเดียว สะสมคะแนน"
                onClick={startSolo}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <ModeButton icon="🤖" title="เล่นกับ AI" sub="ฝึกฝีมือกับ Claude AI" onClick={startVsAI} />
              <ModeButton
                icon="👥"
                title="สร้างห้อง"
                sub="สร้างห้อง แล้วส่ง code ให้เพื่อน"
                onClick={createRoom}
                loading={loading}
              />
              <ModeButton
                icon="🔑"
                title="เข้าร่วมห้อง"
                sub="มี room code แล้ว"
                onClick={() => setStep('join')}
              />
            </div>
          )}
        </>
      )}

      {step === 'create' && (
        <>
          <h2 className="text-xl font-display text-white mb-4">ห้องถูกสร้างแล้ว!</h2>
          <div className="bg-surface2 border border-white/10 rounded-xl p-5 text-center mb-4">
            <p className="text-xs font-bold tracking-widest uppercase text-muted mb-2">Room Code</p>
            <p className="text-4xl font-display tracking-[0.3em] text-accent">{createdCode}</p>
            <p className="text-xs text-muted mt-2">ส่ง code นี้ให้เพื่อนเข้าร่วม</p>
          </div>
          <Button
            variant="secondary"
            className="w-full mb-3"
            onClick={() => {
              navigator.clipboard.writeText(createdCode)
              toast('คัดลอกแล้ว!', 'success')
            }}
          >
            คัดลอก Code
          </Button>
          <Button
            className="w-full"
            onClick={() => {
              router.push(
                `/games/${game.id}?room=${createdCode}&name=${encodeURIComponent(playerName)}&host=1`
              )
              handleClose()
            }}
          >
            เข้าห้อง →
          </Button>
        </>
      )}

      {step === 'join' && (
        <>
          <h2 className="text-xl font-display text-white mb-4">เข้าร่วมห้อง</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="Room Code"
              placeholder="เช่น AB12C"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              className="text-center tracking-widest text-lg"
            />
            <Button onClick={joinRoom} loading={loading} className="w-full">
              เข้าร่วม →
            </Button>
            <Button variant="ghost" onClick={() => setStep('select')} className="w-full">
              ← กลับ
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

function ModeButton({
  icon,
  title,
  sub,
  onClick,
  loading,
}: {
  icon: string
  title: string
  sub: string
  onClick: () => void
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full bg-surface2 border border-white/10 rounded-xl p-4 text-left hover:border-white/20 hover:bg-white/5 transition-all disabled:opacity-50"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{loading ? '⏳' : icon}</span>
        <div>
          <p className="font-semibold text-white text-sm">{title}</p>
          <p className="text-xs text-muted mt-0.5">{sub}</p>
        </div>
      </div>
    </button>
  )
}
