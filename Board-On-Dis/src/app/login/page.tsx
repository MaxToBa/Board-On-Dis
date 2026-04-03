'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'

type Tab = 'login' | 'register'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [guestName, setGuestName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showGuest, setShowGuest] = useState(false)
  const { add: toast } = useToast()
  const router = useRouter()

  async function handleEmailAuth() {
    if (!email || !password) return toast('กรุณากรอกอีเมลและรหัสผ่าน', 'error')
    setLoading(true)
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลของคุณ', 'success')
      }
    } catch (err: unknown) {
      toast((err as Error).message ?? 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  function handleGuest() {
    const name = guestName.trim()
    if (!name) return toast('กรุณาใส่ชื่อ', 'error')
    sessionStorage.setItem('guestName', name)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {/* Logo placeholder — replace with <Image src="/logo.png" .../> */}
          <div className="w-20 h-20 rounded-2xl bg-accent/20 border-2 border-accent/40 flex items-center justify-center mb-4">
            <span className="text-3xl">🎮</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Game Room</h1>
          <p className="text-sm text-white/50 mt-1">เล่นเกมกับเพื่อนได้ทุกที่</p>
        </div>

        {/* Tab */}
        <div className="flex bg-surface rounded-xl p-1 mb-5">
          {(['login', 'register'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === t ? 'bg-accent text-bg' : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="bg-surface border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <Input
            label="อีเมล"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="รหัสผ่าน"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
          />
          <Button onClick={handleEmailAuth} loading={loading} size="lg" className="w-full mt-1">
            {tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกฟรี'}
          </Button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30">หรือ</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="secondary" size="lg" className="w-full" onClick={handleGoogle}>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
                <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
              </svg>
              เข้าสู่ระบบด้วย Google
            </Button>
            <Button variant="secondary" size="lg" className="w-full" onClick={handleDiscord}>
              <svg className="w-4 h-4 text-[#5865F2]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              เข้าสู่ระบบด้วย Discord
            </Button>
          </div>

          <div className="border-t border-white/10 pt-3">
            {!showGuest ? (
              <button
                onClick={() => setShowGuest(true)}
                className="w-full text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                เล่นแบบ Guest (ไม่บันทึกสถิติ)
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  placeholder="ชื่อที่ใช้ในเกม"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuest()}
                />
                <Button variant="ghost" size="md" className="w-full" onClick={handleGuest}>
                  เข้าเล่นแบบ Guest
                </Button>
                <p className="text-xs text-center text-white/30">
                  เล่นแบบ Guest จะไม่บันทึกสถิติ สมัครฟรีเพื่อติดตามความก้าวหน้า
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
