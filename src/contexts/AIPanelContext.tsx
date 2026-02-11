'use client'

import { createContext, useContext } from 'react'

interface AIPanelContextValue {
  isOpen: boolean
  toggle: () => void
  isHydrated: boolean
}

const AIPanelContext = createContext<AIPanelContextValue>({
  isOpen: false,
  toggle: () => {},
  isHydrated: false,
})

export const AIPanelProvider = AIPanelContext.Provider
export const useAIPanelContext = () => useContext(AIPanelContext)
