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

  // Poll workspaces in background — 90s interval, skip if data unchanged
  const prevWorkspacesJson = useRef('')
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch('/api/workspaces', { cache: 'no-store' })
        if (!res.ok || !alive) return
        const data = (await res.json()) as { workspaces: Workspace[] }
        if (!alive) return
        const json = JSON.stringify(data.workspaces.map((w) => w.id).sort())
        if (json !== prevWorkspacesJson.current) {
          prevWorkspacesJson.current = json
          setWorkspaces(data.workspaces)
        }
      } catch {
        // ignore
      }
    }

    tick()
    const id = window.setInterval(tick, 90_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  // Use refs for stable callback — avoids recreating on every workspace/workspaces change
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  const workspacesRef = useRef(workspaces)
  workspacesRef.current = workspaces

  const switchWorkspace = useCallback(
    async (id: string) => {
      if (id === workspaceRef.current?.id || switchingRef.current) return
      const prev = workspaceRef.current
      const target = workspacesRef.current.find((w) => w.id === id)
      if (!target) return

      // 1. INSTANT context update — all consumers see new workspace immediately
      setWorkspace(target)
      setIsSwitching(true)
      switchingRef.current = true

      try {
        // 2. Cookie update (server-side, for RSC on next render)
        await setActiveWorkspace(id)
        // 3. RSC refresh — fire and forget, don't block UI
        router.refresh()
      } catch {
        // Revert on error
        setWorkspace(prev)
      } finally {
        setIsSwitching(false)
        switchingRef.current = false
      }
    },
    [router]
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
