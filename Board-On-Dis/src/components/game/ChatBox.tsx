'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/ui/Avatar'
import { sound } from '@/lib/sound'
import type { Message } from '@/types'

interface ChatBoxProps {
  roomId: string
  playerName: string
  playerAvatar?: string | null
}

export default function ChatBox({ roomId, playerName, playerAvatar }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [popup, setPopup] = useState<Message | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const popupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => {
    if (!roomId) return

    // Load existing messages
    supabase.from('messages').select('*').eq('room_id', roomId).order('created_at')
      .then(({ data }: { data: Message[] | null }) => { if (data) setMessages(data) })

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload: { new: Message }) => {
          const msg = payload.new
          setMessages((prev) => [...prev, msg])
          if (msg.player_name !== playerName) {
            sound.chat()
            if (!openRef.current) {
              setUnread((u) => u + 1)
              setPopup(msg)
              clearTimeout(popupTimer.current)
              popupTimer.current = setTimeout(() => setPopup(null), 4000)
            }
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, playerName])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function sendMessage() {
    const msg = input.trim()
    if (!msg) return
    setInput('')
    await supabase.from('messages').insert({
      room_id: roomId,
      player_name: playerName,
      player_avatar: playerAvatar ?? null,
      message: msg,
    })
  }

  function handleOpen() {
    setOpen(true)
    setUnread(0)
    setPopup(null)
    clearTimeout(popupTimer.current)
    setTimeout(() => bottomRef.current?.scrollIntoView(), 100)
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {/* Popup preview */}
      {popup && !open && (
        <div
          onClick={handleOpen}
          className="w-64 bg-surface border border-white/15 rounded-2xl p-3 shadow-2xl cursor-pointer hover:border-accent/30 transition-all animate-in slide-in-from-bottom-4"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Avatar src={(popup as Message & { player_avatar?: string | null }).player_avatar} name={popup.player_name} size="sm" />
            <span className="text-xs font-bold text-accent">{popup.player_name}</span>
          </div>
          <p className="text-sm text-white/90 line-clamp-2">{popup.message}</p>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div className="w-72 bg-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: 380 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="text-sm font-bold text-white">💬 แชท</span>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-lg transition-colors">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-center text-muted text-xs py-6">เริ่มการสนทนา...</p>
            )}
            {messages.map((m) => {
              const isMe = m.player_name === playerName
              const msgWithAvatar = m
              return (
                <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMe && (
                    <Avatar src={msgWithAvatar.player_avatar} name={m.player_name} size="sm" className="flex-shrink-0 mt-0.5" />
                  )}
                  <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && (
                      <span className="text-[10px] text-muted mb-1">{m.player_name}</span>
                    )}
                    <div className={`text-sm px-3 py-2 rounded-2xl break-words ${
                      isMe
                        ? 'bg-purple/40 text-white rounded-tr-sm'
                        : 'bg-surface2 text-white rounded-tl-sm'
                    }`}>
                      {m.message}
                    </div>
                    <span className="text-[10px] text-muted mt-1">
                      {new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-white/8 flex gap-2">
            <input
              className="flex-1 bg-surface2 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-accent/50 transition-colors"
              placeholder="พิมพ์ข้อความ..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="bg-purple text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="w-12 h-12 bg-purple rounded-full flex items-center justify-center shadow-lg hover:bg-purple/80 transition-all hover:scale-105 relative"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-bounce">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}
