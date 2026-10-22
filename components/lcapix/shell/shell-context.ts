'use client'

import { createContext } from 'react'

/** True inside the education shell: the old top bar steps aside (AppTopBar reads it). */
export const InShellContext = createContext(false)
