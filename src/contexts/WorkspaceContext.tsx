'use client'

import { createContext, use, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { setActiveWorkspace } from '@/app/(app)/actions'
import type { Workspace } from '@/types/workspace'

interface WorkspaceContextValue {
  workspace: Workspace | null
  workspaces: Workspace[]
  switchWorkspace: (id: string) => Promise<void>
  isSwitching: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({
  children,
  initialWorkspace,
  initialWorkspaces,
}: {
  children: ReactNode
  initialWorkspace: Workspace | null
  initialWorkspaces: Workspace[]
}) {
  const router = useRouter()
  const [workspace, setWorkspace] = useState(initialWorkspace)
  const [workspaces, setWorkspaces] = useState(initialWorkspaces)
  const [isSwitching, setIsSwitching] = useState(false)
  const switchingRef = useRef(false)

  // Sync from SSR props when RSC re-renders (e.g. after router.refresh())
  useEffect(() => {
    setWorkspace(initialWorkspace)
  }, [initialWorkspace])

  useEffect(() => {
    setWorkspaces(initialWorkspaces)
  }, [initialWorkspaces])

  // Poll workspaces in background (moved from SidebarClient)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch('/api/workspaces', { cache: 'no-store' })
        if (!res.ok || !alive) return
        const data = (await res.json()) as { workspaces: Workspace[] }
        if (!alive) return
        setWorkspaces(data.workspaces)
      } catch {
        // ignore
      }
    }

    tick()
    const id = window.setInterval(tick, 30_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const switchWorkspace = useCallback(
    async (id: string) => {
      if (id === workspace?.id || switchingRef.current) return
      const prev = workspace
      const target = workspaces.find((w) => w.id === id)
      if (!target) return

      // 1. INSTANT context update — all consumers see new workspace immediately
      setWorkspace(target)
      setIsSwitching(true)
      switchingRef.current = true

      try {
        // 2. Cookie update (server-side, for RSC on next render)
        await setActiveWorkspace(id)
        // 3. RSC refresh (background, updates server-rendered parts)
        router.refresh()
      } catch {
        // Revert on error
        setWorkspace(prev)
      } finally {
        setIsSwitching(false)
        switchingRef.current = false
      }
    },
    [workspace, workspaces, router]
  )

  return (
    <WorkspaceContext value={{ workspace, workspaces, switchWorkspace, isSwitching }}>
      {children}
    </WorkspaceContext>
  )
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = use(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
