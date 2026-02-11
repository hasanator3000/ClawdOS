'use client'

import { useEffect, useState, useRef, useId } from 'react'

interface GlitchTextProps {
  text: string
  className?: string
}

const GLITCH_CHARS = '#$@%&*!~+=?<>[]{}|/\\^`'

export default function GlitchText({ text, className = '' }: GlitchTextProps) {
  const [chars, setChars] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const maskId = useId()

  useEffect(() => {
    const len = GLITCH_CHARS.length
    const buf = new Array<string>(200)
    const animate = () => {
      for (let i = 0; i < 200; i++) {
        buf[i] = GLITCH_CHARS[Math.floor(Math.random() * len)]
      }
      setChars(buf.join(''))
    }

    animate()
    // 250ms is still visually glitchy but halves the CPU cost vs 100ms
    intervalRef.current = setInterval(animate, 250)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const safeMaskId = maskId.replace(/:/g, '')

  return (
    <span className={`relative inline-block ${className}`} style={{ lineHeight: 1.4 }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} viewBox="0 0 120 30">
        <defs>
          <mask id={safeMaskId}>
            <rect x="0" y="0" width="120" height="30" fill="black" />
            <text
              x="2"
              y="24"
              fontFamily="monospace"
              fontSize="22"
              fontWeight="800"
              fill="white"
              letterSpacing="3"
            >
              {text}
            </text>
          </mask>
        </defs>
      </svg>

      {/* Основной текст - невидимый, для размера */}
      <span
        style={{
          fontFamily: 'monospace',
          fontWeight: 700,
          letterSpacing: '0.15em',
          opacity: 0,
        }}
      >
        {text}
      </span>

      {/* Слой с мелкими символами с SVG маской */}
      <span
        className="absolute overflow-hidden"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          fontFamily: 'monospace',
          fontSize: '0.2em',
          lineHeight: '0.25',
          letterSpacing: '0.03em',
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
          color: 'currentColor',
          maskImage: `url(#${safeMaskId})`,
          WebkitMaskImage: `url(#${safeMaskId})`,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
        aria-hidden="true"
      >
        {chars}
      </span>
    </span>
  )
}
