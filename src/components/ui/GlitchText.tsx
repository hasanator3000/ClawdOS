'use client'

import { useEffect, useState, useRef } from 'react'

interface GlitchTextProps {
  text: string
  className?: string
}

const GLITCH_CHARS = '#$@%&*!~+=?<>[]{}|/\\^`'

export default function GlitchText({ text, className = '' }: GlitchTextProps) {
  const [displayText, setDisplayText] = useState(text)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    if (!isAnimating) {
      setDisplayText(text)
      return
    }

    let iteration = 0
    const letters = text.split('')

    const animate = () => {
      setDisplayText(
        letters
          .map((letter, index) => {
            if (letter === ' ') return ' '

            if (index < iteration) {
              return letter
            }

            return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          })
          .join('')
      )

      iteration += 1 / 3

      if (iteration >= letters.length) {
        setDisplayText(text)
        setIsAnimating(false)
      }
    }

    intervalRef.current = setInterval(animate, 50)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [text, isAnimating])

  const handleMouseEnter = () => {
    setIsAnimating(true)
  }

  return (
    <span
      className={className}
      onMouseEnter={handleMouseEnter}
      style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
    >
      {displayText}
    </span>
  )
}
