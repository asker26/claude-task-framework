import { Check, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSprints } from '@/lib/api'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { SprintStatusBadge } from './SprintHeader'
import type { Sprint } from '@/lib/types'

export interface SprintPickerProps {
  projectId: number
  currentSprintId?: number
  onSelect?: (sprint: Sprint) => void
  className?: string
}

/** Dropdown of one project's sprints. The active sprint stands out via its status pill;
 *  currentSprintId (if given) gets a checkmark. Selecting navigates to /sprints/:id unless
 *  onSelect is provided, in which case that's called instead. */
export function SprintPicker({ projectId, currentSprintId, onSelect, className }: SprintPickerProps) {
  const { data: sprints, isLoading } = useSprints(projectId)
  const navigate = useNavigate()
  const current = sprints?.find((s) => s.id === currentSprintId)

  function handleSelect(sprint: Sprint) {
    if (onSelect) onSelect(sprint)
    else navigate(`/sprints/${sprint.id}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'w-56 justify-between font-normal',
          className,
        )}
      >
        <span className="truncate">{current ? current.name : 'Select sprint…'}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {isLoading && <div className="px-1.5 py-1 text-xs text-muted-foreground">Loading…</div>}
        {!isLoading && (sprints?.length ?? 0) === 0 && (
          <div className="px-1.5 py-1 text-xs text-muted-foreground">No sprints.</div>
        )}
        {sprints?.map((sprint) => (
          <DropdownMenuItem
            key={sprint.id}
            onClick={() => handleSelect(sprint)}
            className={cn('justify-between gap-3', sprint.id === currentSprintId && 'bg-accent/60')}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {sprint.id === currentSprintId ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <span className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{sprint.name}</span>
            </span>
            <SprintStatusBadge status={sprint.status} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
