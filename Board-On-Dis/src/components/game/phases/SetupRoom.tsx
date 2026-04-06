'use client'
import Avatar from '@/components/ui/Avatar'
import type { PlayerInRoom, ColorOption } from '@/types/room'

interface SetupRoomProps {
  myInfo: PlayerInRoom | null
  opponentInfo: PlayerInRoom | null
  colorOptions: ColorOption[]
  selectedColor: string
  onSelectColor: (color: string) => void
  onReady: () => void
}

export default function SetupRoom({
  myInfo,
  opponentInfo,
  colorOptions,
  selectedColor,
  onSelectColor,
  onReady,
}: SetupRoomProps) {
  const iAmReady = myInfo?.ready ?? false
  const opponentReady = opponentInfo?.ready ?? false

  return (
    <div className="max-w-sm mx-auto space-y-6 py-4">
      <div className="text-center">
        <h2 className="font-display text-2xl text-white">ตั้งค่าก่อนเริ่ม</h2>
        <p className="text-muted text-sm mt-1">เลือกสีของคุณแล้วกด Ready</p>
      </div>

      {/* Both players */}
      <div className="grid grid-cols-2 gap-4">
        {/* Me */}
        <div
          className={`bg-surface border rounded-2xl p-4 text-center transition-all
            ${iAmReady ? 'border-green/50' : 'border-accent/40'}`}
        >
          <div className="flex justify-center mb-2">
            <Avatar src={myInfo?.avatarUrl} name={myInfo?.name ?? ''} size="lg" />
          </div>
          <div className="font-bold text-sm text-white truncate">{myInfo?.name}</div>
          <div className="text-xs text-muted mt-0.5">คุณ</div>
          {myInfo?.colorBg && (
            <div
              className="w-5 h-5 rounded-full mx-auto mt-2 border border-white/20"
              style={{ background: myInfo.colorBg }}
            />
          )}
          {iAmReady && (
            <div className="mt-2 text-xs font-bold" style={{ color: '#4fcf8e' }}>
              ✓ Ready!
            </div>
          )}
        </div>

        {/* Opponent */}
        <div
          className={`bg-surface border rounded-2xl p-4 text-center transition-all
            ${opponentInfo
              ? opponentReady ? 'border-green/50' : 'border-white/10'
              : 'border-dashed border-white/15'}`}
        >
          {opponentInfo ? (
            <>
              <div className="flex justify-center mb-2">
                <Avatar src={opponentInfo.avatarUrl} name={opponentInfo.name} size="lg" />
              </div>
              <div className="font-bold text-sm text-white truncate">{opponentInfo.name}</div>
              {opponentInfo.colorBg && (
                <div
                  className="w-5 h-5 rounded-full mx-auto mt-2 border border-white/20"
                  style={{ background: opponentInfo.colorBg }}
                />
              )}
              {opponentReady && (
                <div className="mt-2 text-xs font-bold" style={{ color: '#4fcf8e' }}>
                  ✓ Ready!
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-surface2 border-2 border-dashed border-white/20
                           mx-auto mb-2 flex items-center justify-center text-2xl text-muted">
                ?
              </div>
              <div className="text-muted text-sm">รอเพื่อน...</div>
            </>
          )}
        </div>
      </div>

      {/* Color picker */}
      <div className="bg-surface border border-white/7 rounded-2xl p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
          🎨 เลือกสีของคุณ
        </div>
        <div className="grid grid-cols-4 gap-2">
          {colorOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSelectColor(opt.value)}
              className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5
                ${selectedColor === opt.value
                  ? 'border-white/40 bg-white/10 scale-105'
                  : 'border-white/10 hover:border-white/25 hover:scale-[1.03]'}`}
            >
              <div
                className="w-6 h-6 rounded-full border border-white/20"
                style={{ background: opt.bg }}
              />
              <span className="text-xs text-muted font-ui">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ready button */}
      <button
        onClick={onReady}
        disabled={!opponentInfo || iAmReady}
        className="w-full py-4 bg-accent text-bg rounded-2xl font-bold text-lg
                 hover:brightness-110 transition-all
                 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {iAmReady
          ? '✓ รอเพื่อน...'
          : !opponentInfo
          ? 'รอเพื่อนเข้าห้อง...'
          : '🎮 Ready!'}
      </button>
    </div>
  )
}
