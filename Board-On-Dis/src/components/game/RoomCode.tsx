'use client'
import { useToast } from '@/components/ui/Toast'

interface RoomCodeProps {
  code: string
}

export default function RoomCode({ code }: RoomCodeProps) {
  const { add: toast } = useToast()

  function copy() {
    navigator.clipboard.writeText(code)
    toast('คัดลอก Room Code แล้ว!', 'success')
  }

  return (
    <div className="flex items-center gap-2 bg-surface2 border border-white/10 rounded-xl px-3 py-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Room</p>
        <p className="text-base font-display tracking-[0.2em] text-accent leading-none">{code}</p>
      </div>
      <button
        onClick={copy}
        className="ml-1 text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
        title="คัดลอก"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  )
}
