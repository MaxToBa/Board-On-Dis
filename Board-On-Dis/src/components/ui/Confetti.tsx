'use client'
import { useEffect, useRef } from 'react'

interface ConfettiProps {
  active: boolean
}

export default function Confetti({ active }: ConfettiProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | undefined>(undefined)
  const aliveRef = useRef(false)

  useEffect(() => {
    if (!active || !ref.current) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const COLORS = ['#e8c547', '#7c6af5', '#4fcf8e', '#f05a5a', '#ffffff', '#60a5fa']
    const particles = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 150,
      vx: (Math.random() - 0.5) * 5,
      vy: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 10 + 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }))

    aliveRef.current = true

    function draw() {
      if (!aliveRef.current) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let any = false
      particles.forEach((p) => {
        if (p.y > canvas.height + 20) return
        any = true
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.06
        p.rotation += p.rotSpeed
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      })
      if (any && aliveRef.current) {
        animRef.current = requestAnimationFrame(draw)
      }
    }

    draw()

    return () => {
      aliveRef.current = false
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 pointer-events-none z-[60]"
    />
  )
}
