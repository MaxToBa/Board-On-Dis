'use client'
import { useState, useRef } from 'react'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import ToastContainer from '@/components/ui/Toast'

export default function ProfilePage() {
  const { user, profile, setProfile } = useAuthStore()
  const [username, setUsername] = useState(profile?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { add: toast } = useToast()

  async function saveUsername() {
    if (!user || !username.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username: username.trim(), updated_at: new Date().toISOString() })
      if (error) throw error
      setProfile({ ...profile!, username: username.trim() })
      toast('บันทึกชื่อสำเร็จ', 'success')
    } catch (err: unknown) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(file: File) {
    if (!user) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = data.publicUrl + `?t=${Date.now()}`

      await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() })

      setProfile({ ...profile!, avatar_url: avatarUrl })
      toast('อัปโหลดรูปสำเร็จ', 'success')
    } catch (err: unknown) {
      toast((err as Error).message, 'error')
    } finally {
      setUploading(false)
    }
  }

  if (!user) return null

  const displayName = profile?.username ?? user.email?.split('@')[0] ?? 'User'

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-white mb-8">โปรไฟล์</h1>

        {/* Avatar section */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">รูปโปรไฟล์</h2>
          <div className="flex items-center gap-4">
            <Avatar src={profile?.avatar_url} name={displayName} size="xl" />
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                เปลี่ยนรูป
              </Button>
              <p className="text-xs text-white/30">JPG, PNG ขนาดไม่เกิน 2MB</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadAvatar(file)
                }}
              />
            </div>
          </div>
        </div>

        {/* Username section */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">ชื่อในเกม</h2>
          <div className="flex gap-3">
            <Input
              placeholder="ชื่อที่แสดงในเกม"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveUsername()}
              className="flex-1"
            />
            <Button onClick={saveUsername} loading={saving}>บันทึก</Button>
          </div>
        </div>

        {/* Account info */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">ข้อมูลบัญชี</h2>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm text-white/50">อีเมล</span>
              <span className="text-sm text-white">{user.email}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-white/50">เข้าร่วมเมื่อ</span>
              <span className="text-sm text-white">
                {new Date(user.created_at).toLocaleDateString('th-TH')}
              </span>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
