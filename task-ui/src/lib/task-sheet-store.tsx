import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TaskDetailSheet } from '@/components/task-detail/TaskDetailSheet'

interface TaskSheetStore {
  /** The id in the current `?task=` param, or null when no task is selected. */
  currentId: number | null
  isOpen: boolean
  openById: (id: number) => void
  close: () => void
}

const Ctx = createContext<TaskSheetStore | null>(null)

export function useTaskSheet(): TaskSheetStore {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTaskSheet must be used inside <TaskSheetProvider>')
  return ctx
}

/**
 * Wrap the routed app in this once (see App.tsx). It syncs the open task to the `?task=`
 * URL param — shareable, and independent of whatever board/sprint filters are also in the
 * URL — and mounts <TaskDetailSheet/> itself, so nothing else needs to render it.
 */
export function TaskSheetProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('task')
  const currentId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null

  const openById = useCallback(
    (id: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('task', String(id))
        return next
      })
    },
    [setSearchParams],
  )

  const close = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('task')
      return next
    })
  }, [setSearchParams])

  const value = useMemo<TaskSheetStore>(
    () => ({ currentId, isOpen: currentId !== null, openById, close }),
    [currentId, openById, close],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <TaskDetailSheet />
    </Ctx.Provider>
  )
}
