class SoundSystem {
  private audioCtx: AudioContext | null = null
  private muted: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem('gameMuted') === 'true'
    }
  }

  private getCtx(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext()
    }
    return this.audioCtx
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.3
  ) {
    if (this.muted || typeof window === 'undefined') return
    try {
      const ctx = this.getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = type
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    } catch {
      // ignore audio errors
    }
  }

  move = () => this.playTone(440, 0.1)
  win = () =>
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 0.3, 'sine', 0.4), i * 150)
    )
  lose = () => {
    this.playTone(300, 0.2)
    setTimeout(() => this.playTone(200, 0.4, 'sawtooth'), 200)
  }
  draw = () => this.playTone(330, 0.4, 'triangle')
  click = () => this.playTone(600, 0.05)
  capture = () => this.playTone(350, 0.2, 'square')
  drop = () => this.playTone(300, 0.15)
  merge = () => this.playTone(660, 0.15)
  cardPlay = () => this.playTone(520, 0.1)
  chat = () => this.playTone(880, 0.08)
  hit = () => this.playTone(200, 0.3, 'sawtooth', 0.35)
  miss = () => this.playTone(150, 0.2)
  join = () =>
    [800, 1000, 1200].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 0.2), i * 100)
    )

  toggleMute() {
    this.muted = !this.muted
    if (typeof window !== 'undefined') {
      localStorage.setItem('gameMuted', String(this.muted))
    }
    return this.muted
  }

  isMuted() {
    return this.muted
  }
}

export const sound = new SoundSystem()
