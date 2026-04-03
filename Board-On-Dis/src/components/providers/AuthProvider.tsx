'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setSession, setProfile } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          loadProfile(session.user.id)
        }
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        }
      }
    )
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', userId)
      .single()

    if (data) {
      // ถ้าไม่มี avatar ใน DB ให้ดึงจาก OAuth metadata แล้วบันทึกลง DB
      if (!data.avatar_url) {
        const { data: { user } } = await supabase.auth.getUser()
        const metaAvatar = user?.user_metadata?.avatar_url ?? null
        if (metaAvatar) {
          data.avatar_url = metaAvatar
          await supabase.from('profiles').update({ avatar_url: metaAvatar }).eq('id', userId)
        }
      }
      setProfile(data)
    }
  }

  return <>{children}</>
}
