'use client'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-white/70">{label}</label>
        )}
        <input
          ref={ref}
          className={`w-full bg-surface2 border ${error ? 'border-red' : 'border-white/10'} rounded-xl px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-accent/60 transition-colors ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export default Input
