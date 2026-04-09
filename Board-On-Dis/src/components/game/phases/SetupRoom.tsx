'use client'
import { useState, useRef } from 'react'
import Avatar from '@/components/ui/Avatar'
import type { PlayerInRoom, ColorOption } from '@/types/room'

interface SetupRoomProps {
  myInfo: PlayerInRoom | null
  opponentInfo: PlayerInRoom | null
  colorOptions: ColorOption[]
  selectedColor: string
  onSelectColor: (color: string) => void
  onReady: () => void
  onUnready?: () => void
  showColorPicker?: boolean   // default true — set false for games that don't use piece colors
}

export default function SetupRoom({
  myInfo,
  opponentInfo,
  colorOptions,
  selectedColor,
  onSelectColor,
  onReady,
  onUnready,
  showColorPicker = true,
}: SetupRoomProps) {
  const iAmReady = myInfo?.ready ?? false
  const opponentReady = opponentInfo?.ready ?? false
  const [showCustom, setShowCustom] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)

  // Derive the display bg for the current selection
  const selectedBg = selectedColor.startsWith('#')
    ? selectedColor
    : colorOptions.find((c) => c.value === selectedColor)?.bg ?? selectedColor

  return (
    <div className="max-w-sm mx-auto space-y-6 py-4">
      <div className="text-center">
        <h2 className="font-display text-2xl text-white">ตั้งค่าก่อนเริ่ม</h2>
        <p className="text-muted text-sm mt-1">
          {showColorPicker ? 'เลือกสีของคุณแล้วกด Ready' : 'กด Ready เมื่อพร้อม'}
        </p>
      </div>

      {/* Both players */}
      <div className="grid grid-cols-2 gap-4">
        {/* Me */}
        <div className={`bg-surface border rounded-2xl p-4 text-center transition-all ${iAmReady ? 'border-green/50' : 'border-accent/40'}`}>
          <div className="flex justify-center mb-2">
            <Avatar src={myInfo?.avatarUrl} name={myInfo?.name ?? ''} size="lg" />
          </div>
          <div className="font-bold text-sm text-white truncate">{myInfo?.name}</div>
          <div className="text-xs text-muted mt-0.5">คุณ</div>
          {showColorPicker && (
            <div className="w-5 h-5 rounded-full mx-auto mt-2 border border-white/20" style={{ background: iAmReady ? (myInfo?.colorBg ?? selectedBg) : selectedBg }} />
          )}
          {iAmReady && (
            <div className="mt-2 text-xs font-bold" style={{ color: '#4fcf8e' }}>✓ Ready!</div>
          )}
        </div>

        {/* Opponent */}
        <div className={`bg-surface border rounded-2xl p-4 text-center transition-all ${
          opponentInfo
            ? opponentReady ? 'border-green/50' : 'border-white/10'
            : 'border-dashed border-white/15'
        }`}>
          {opponentInfo ? (
            <>
              <div className="flex justify-center mb-2">
                <Avatar src={opponentInfo.avatarUrl} name={opponentInfo.name} size="lg" />
              </div>
              <div className="font-bold text-sm text-white truncate">{opponentInfo.name}</div>
              {showColorPicker && opponentInfo.colorBg && (
                <div className="w-5 h-5 rounded-full mx-auto mt-2 border border-white/20" style={{ background: opponentInfo.colorBg }} />
              )}
              {opponentReady && (
                <div className="mt-2 text-xs font-bold" style={{ color: '#4fcf8e' }}>✓ Ready!</div>
              )}
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-surface2 border-2 border-dashed border-white/20 mx-auto mb-2 flex items-center justify-center text-2xl text-muted">?</div>
              <div className="text-muted text-sm">รอเพื่อน...</div>
            </>
          )}
        </div>
      </div>

      {/* Color picker — only shown when showColorPicker=true */}
      {showColorPicker && (
        <div className="bg-surface border border-white/7 rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
            🎨 เลือกสีของคุณ
          </div>

          {/* Preset colors */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {colorOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSelectColor(opt.value)}
                className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                  selectedColor === opt.value
                    ? 'border-white/40 bg-white/10 scale-105'
                    : 'border-white/10 hover:border-white/25 hover:scale-[1.03]'
                }`}
              >
                <div className="w-6 h-6 rounded-full border border-white/20" style={{ background: opt.bg }} />
                <span className="text-xs text-muted font-ui">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Custom color row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowCustom(true)
                setTimeout(() => colorInputRef.current?.click(), 50)
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all flex-1 ${
                selectedColor.startsWith('#')
                  ? 'border-white/40 bg-white/10'
                  : 'border-white/10 hover:border-white/25'
              }`}
            >
              <div
                className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0"
                style={{ background: selectedColor.startsWith('#') ? selectedColor : '#888' }}
              />
              <span className="text-muted">
                {selectedColor.startsWith('#') ? selectedColor : '🎨 กำหนดเอง'}
              </span>
            </button>

            {/* Hidden native color input */}
            <input
              ref={colorInputRef}
              type="color"
              className="sr-only"
              value={selectedColor.startsWith('#') ? selectedColor : '#7c6af5'}
              onChange={(e) => onSelectColor(e.target.value)}
            />

            {/* Preview dot */}
            {selectedColor.startsWith('#') && (
              <div
                className="w-8 h-8 rounded-full border-2 border-white/30 flex-shrink-0"
                style={{ background: selectedColor }}
              />
            )}
          </div>
        </div>
      )}

      {/* Ready / Unready buttons */}
      {iAmReady && onUnready ? (
        <div className="flex gap-3">
          <button
            onClick={onUnready}
            className="flex-1 py-4 bg-surface2 border border-white/15 text-muted rounded-2xl font-bold text-lg hover:border-white/30 transition-all"
          >
            ✕ ยกเลิก
          </button>
          <div className="flex-1 py-4 bg-green/10 border border-green/30 text-green rounded-2xl font-bold text-lg text-center">
            ✓ รอเพื่อน...
          </div>
        </div>
      ) : (
        <button
          onClick={onReady}
          disabled={!opponentInfo || iAmReady}
          className="w-full py-4 bg-accent text-bg rounded-2xl font-bold text-lg hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {iAmReady ? '✓ รอเพื่อน...' : !opponentInfo ? 'รอเพื่อนเข้าห้อง...' : '🎮 Ready!'}
        </button>
      )}
    </div>
  )
}
