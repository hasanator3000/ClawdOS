'use client'

import { useEffect, useState, useRef } from 'react'

interface GlitchTextProps {
  text: string
  className?: string
}

const GLITCH_CHARS = '#$@%&*!~+=?<>[]{}|/\\^`'

export default function GlitchText({ text, className = '' }: GlitchTextProps) {
  const [displayText, setDisplayText] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const letters = text.split('')

    const animate = () => {
      setDisplayText(
        letters
          .map((letter) => {
            if (letter === ' ') return ' '

            // 70% вероятность показать настоящую букву, 30% - случайный символ
            const showReal = Math.random() > 0.3

            if (showReal) {
              return letter
            } else {
              return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
            }
          })
          .join('')
      )
    }

    // Запускаем анимацию сразу
    animate()

    // Продолжаем менять символы постоянно (быстрее для эффекта)
    intervalRef.current = setInterval(animate, 80)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [text])

  return (
    <span
      className={className}
      style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontWeight: 600 }}
    >
      {displayText}
    </span>
  )
}
