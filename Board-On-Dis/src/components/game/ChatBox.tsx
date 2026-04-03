'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { sound } from '@/lib/sound'
import type { Message } from '@/types'

interface ChatBoxProps {
  roomId: string
  playerName: string
}

export default function ChatBox({ roomId, playerName }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at')
      .then(({ data }) => { if (data) setMessages(data as Message[]) })

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          sound.chat()
          if (!open) setUnread((u) => u + 1)
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function sendMessage() {
    const msg = input.trim()
    if (!msg) return
    setInput('')
    await supabase.from('messages').insert({ room_id: roomId, player_name: playerName, message: msg })
  }

  return (
    <div className="fixed bottom-4 right-4 z-30">
      {/* Chat panel */}
      {open && (
        <div className="mb-2 w-72 bg-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: 360 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-semibold text-white">แชท</span>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-sm">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.player_name === playerName ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-muted mb-0.5">{m.player_name}</span>
                <div
                  className={`text-sm px-3 py-1.5 rounded-xl max-w-[85%] break-words ${
                    m.player_name === playerName
                      ? 'bg-purple/30 text-white'
                      : m.player_name === '🤖 AI'
                      ? 'bg-accent/10 text-accent/90 border border-accent/20'
                      : 'bg-surface2 text-white'
                  }`}
                >
                  {m.message}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-white/10 flex gap-2">
            <input
              className="flex-1 bg-surface2 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-accent/50"
              placeholder="พิมพ์ข้อความ..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="bg-purple text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-purple/80 transition-colors"
            >
              ส่ง
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => { setOpen(!open); setUnread(0) }}
        className="w-12 h-12 bg-purple rounded-full flex items-center justify-center shadow-lg hover:bg-purple/80 transition-colors relative"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </div>
  )
}
