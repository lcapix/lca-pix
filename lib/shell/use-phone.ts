'use client'

// A phone (600 px wide and below): Home, the case outline and Results read
// only there (stage 8.3), with "Open on a larger screen to edit".

import { useEffect, useState } from 'react'

export const PHONE_QUERY = '(max-width: 600px)'

export function usePhone(): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(PHONE_QUERY)
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return phone
}
