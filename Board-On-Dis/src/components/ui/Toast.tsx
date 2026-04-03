'use client'
import { create } from 'zustand'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastStore {
  toasts: Toast[]
  add: (message: string, type?: ToastType) => void
  remove: (id: string) => void
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

const icons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

const colors: Record<ToastType, string> = {
  success: 'border-green/40 bg-green/10',
  error: 'border-red/40 bg-red/10',
  info: 'border-accent/40 bg-accent/10',
}

function ToastItem({ toast }: { toast: Toast }) {
  const { remove } = useToast()
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg ${colors[toast.type]}`}
    >
      <span className="text-sm font-bold">{icons[toast.type]}</span>
      <p className="text-sm text-white">{toast.message}</p>
      <button onClick={() => remove(toast.id)} className="ml-auto text-white/40 hover:text-white text-xs">✕</button>
    </motion.div>
  )
}

export default function ToastContainer() {
  const { toasts } = useToast()
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-80">
      <AnimatePresence>
        {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
      </AnimatePresence>
    </div>
  )
}
