'use client'

import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Stream-types a string word-by-word (LLM-style) at the given speed.
 * Restarts whenever `text` changes.
 */
export function useStreamText(text: string, wordsPerSecond = 12): { value: string; done: boolean } {
  const [value, setValue] = useState('')
  const [done, setDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (prefersReducedMotion()) {
      setValue(text)
      setDone(true)
      return
    }
    setValue('')
    setDone(false)
    const tokens = text.split(/(\s+)/)
    let i = 0
    const step = () => {
      if (i >= tokens.length) {
        setDone(true)
        return
      }
      setValue((v) => v + tokens[i])
      i++
      const delay = tokens[i - 1].match(/[.!?]\s/) ? 200 : 1000 / wordsPerSecond
      timerRef.current = setTimeout(step, delay)
    }
    step()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text, wordsPerSecond])

  return { value, done }
}
