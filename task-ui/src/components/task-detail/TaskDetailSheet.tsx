import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useTask } from '@/lib/api'
import { useTaskSheet } from '@/lib/task-sheet-store'
import { fmt } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentIndicator } from '@/components/task-board/AgentIndicator'
import { PriorityBadge } from '@/components/task-board/PriorityBadge'
import { StatusBadge } from '@/components/task-board/StatusBadge'
import { RelatedTaskRow } from './RelatedTaskRow'
import type { AgentHistoryEntry, StatusHistoryEntry } from '@/lib/types'

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5">
      <code className="flex-1 overflow-x-auto font-mono text-xs whitespace-pre">{command}</code>
      <button
        type="button"
        title="Copy"
        onClick={async () => {
          await navigator.clipboard.writeText(command)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

function AgentHistoryRow({ entry }: { entry: AgentHistoryEntry }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 text-muted-foreground">{fmt(entry.created_at)}</span>
      <span className="font-medium">{entry.worker_name}</span>
      <span className="text-muted-foreground">{entry.status}</span>
      {entry.retry_count > 0 && <span className="text-muted-foreground">retry {entry.retry_count}</span>}
    </div>
  )
}

function StatusHistoryRow({ entry }: { entry: StatusHistoryEntry }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 text-muted-foreground">{fmt(entry.changed_at)}</span>
      {entry.from_status ? (
        <StatusBadge status={entry.from_status} />
      ) : (
        <span className="text-muted-foreground">new</span>
      )}
      <span className="text-muted-foreground">{'→'}</span>
      <StatusBadge status={entry.to_status} />
    </div>
  )
}

/**
 * Self-contained: reads the open task id from useTaskSheet() and fetches its own data.
 * Mounted once by TaskSheetProvider (lib/task-sheet-store.tsx) — never mount it directly.
 */
export function TaskDetailSheet() {
  const { currentId, isOpen, close, openById } = useTaskSheet()
  const { data: task, isLoading } = useTask(currentId)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-xl">
        {isLoading && (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!isLoading && task && (
          <>
            <SheetHeader>
              <SheetTitle>{task.title}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-mono text-xs text-muted-foreground">#{task.id}</span>
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                {task.running_agent && <AgentIndicator agent={task.running_agent} />}
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Project</div>
                  <div>{task.project?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sprint</div>
                  <div>{task.sprint?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Assigned</div>
                  <div>{task.assigned_agent?.name ?? 'Unassigned'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Due</div>
                  <div>{task.due_date ?? '—'}</div>
                </div>
              </div>

              {task.notes && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Notes</div>
                  <p className="text-sm whitespace-pre-wrap">{task.notes}</p>
                </div>
              )}

              {task.acceptance_criteria && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Acceptance Criteria</div>
                  <p className="text-sm whitespace-pre-wrap">{task.acceptance_criteria}</p>
                </div>
              )}

              {task.parent && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Parent</div>
                  <RelatedTaskRow task={task.parent} onClick={(t) => openById(t.id)} />
                </div>
              )}

              {task.subtasks.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Subtasks ({task.subtasks.length})
                  </div>
                  <div className="space-y-1">
                    {task.subtasks.map((t) => (
                      <RelatedTaskRow key={t.id} task={t} onClick={(x) => openById(x.id)} />
                    ))}
                  </div>
                </div>
              )}

              {task.depends_on_tasks.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Depends On</div>
                  <div className="space-y-1">
                    {task.depends_on_tasks.map((t) => (
                      <RelatedTaskRow key={t.id} task={t} onClick={(x) => openById(x.id)} />
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Status History</div>
                {task.status_history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No status changes recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {task.status_history.map((h, i) => (
                      <StatusHistoryRow key={i} entry={h} />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Agent History</div>
                {task.agent_history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No agent runs recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {task.agent_history.map((h) => (
                      <AgentHistoryRow key={h.id} entry={h} />
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Run in CLI</div>
                <CopyableCommand command={`scripts/taskctl set-status ${task.id} done`} />
                <CopyableCommand command={`scripts/taskctl set-status ${task.id} todo`} />
                <CopyableCommand command={`scripts/taskctl assign ${task.id} <agent-name>`} />
                <CopyableCommand command={`scripts/taskctl log ${task.id} <status> --notes "..."`} />
              </div>
            </div>
          </>
        )}

        {!isLoading && !task && currentId != null && (
          <div className="p-4 text-sm text-muted-foreground">Task not found.</div>
        )}
      </SheetContent>
    </Sheet>
  )
}
