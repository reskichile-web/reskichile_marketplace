'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface OtpInputProps {
  length?: number
  onComplete: (code: string) => void
  disabled?: boolean
  error?: boolean
}

export default function OtpInput({ length = 6, onComplete, disabled = false, error = false }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''))
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Focus first input on mount
  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  // Shake animation on error
  useEffect(() => {
    if (error) {
      setValues(Array(length).fill(''))
      setTimeout(() => inputsRef.current[0]?.focus(), 300)
    }
  }, [error, length])

  const handleComplete = useCallback((newValues: string[]) => {
    const code = newValues.join('')
    if (code.length === length) {
      onComplete(code)
    }
  }, [length, onComplete])

  function handleChange(index: number, value: string) {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)

    const newValues = [...values]
    newValues[index] = digit
    setValues(newValues)

    if (digit && index < length - 1) {
      inputsRef.current[index + 1]?.focus()
    }

    handleComplete(newValues)
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (!values[index] && index > 0) {
        const newValues = [...values]
        newValues[index - 1] = ''
        setValues(newValues)
        inputsRef.current[index - 1]?.focus()
      } else {
        const newValues = [...values]
        newValues[index] = ''
        setValues(newValues)
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return

    const newValues = [...values]
    for (let i = 0; i < pasted.length; i++) {
      newValues[i] = pasted[i]
    }
    setValues(newValues)

    // Focus last filled or next empty
    const focusIndex = Math.min(pasted.length, length - 1)
    inputsRef.current[focusIndex]?.focus()

    handleComplete(newValues)
  }

  return (
    <div className={`flex justify-center gap-2 sm:gap-3 ${error ? 'animate-shake' : ''}`}>
      {values.map((val, i) => (
        <input
          key={i}
          ref={el => { inputsRef.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={val}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          onFocus={e => e.target.select()}
          className={`
            w-11 h-14 sm:w-13 sm:h-16 text-center text-2xl font-black rounded-lg border-2 outline-none
            transition-all duration-200
            ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
            ${error
              ? 'border-red-400 bg-red-50 text-red-600'
              : val
                ? 'border-brand-500 bg-brand-50/30 text-gray-900 shadow-sm'
                : 'border-gray-200 bg-white text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
            }
          `}
        />
      ))}
    </div>
  )
}
