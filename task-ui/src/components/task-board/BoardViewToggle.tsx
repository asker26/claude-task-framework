import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type BoardView = 'table' | 'kanban'

const VIEW_PARAM = 'view'

function parseView(searchParams: URLSearchParams): BoardView {
  return searchParams.get(VIEW_PARAM) === 'kanban' ? 'kanban' : 'table'
}

/** Shared by BoardViewToggle and Board.tsx so both read/write the same `?view=` param. */
export function useBoardView(): [BoardView, (view: BoardView) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = parseView(searchParams)

  const setView = useCallback(
    (next: BoardView) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === 'table') params.delete(VIEW_PARAM)
          else params.set(VIEW_PARAM, next)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return [view, setView]
}

export interface BoardViewToggleProps {
  className?: string
}

export function BoardViewToggle({ className }: BoardViewToggleProps) {
  const [view, setView] = useBoardView()

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as BoardView)} className={cn('shrink-0', className)}>
      <TabsList>
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="kanban">Kanban</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
