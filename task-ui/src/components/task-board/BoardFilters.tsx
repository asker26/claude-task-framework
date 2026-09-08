import { useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, STATUS_ORDER } from './StatusBadge'
import type { Project, Sprint, TaskPriority, TaskStatus } from '@/lib/types'

const PRIORITY_ORDER: TaskPriority[] = ['high', 'medium', 'low']
const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

/** Sentinel item value for "no filter" selects — never a real id/enum value, so it can't collide. */
const ALL_VALUE = '__all__'

function parseId(searchParams: URLSearchParams, key: string): number | null {
  const raw = searchParams.get(key)
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null
}

export interface BoardFiltersProps {
  /** Full project list (from useProjects()) — used to derive the org options and, per
   *  selected org, the narrowed project options. */
  projects: Project[]
  /** Sprints already scoped by Board.tsx's useSprints(project_id) call; narrowed here to
   *  the selected org's projects so the sprint select can never cross an org boundary. */
  sprints: Sprint[]
  className?: string
}

export function BoardFilters({ projects, sprints, className }: BoardFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const orgId = parseId(searchParams, 'org_id')
  const projectId = parseId(searchParams, 'project_id')
  const sprintId = parseId(searchParams, 'sprint_id')
  const status = searchParams.get('status') ?? ''
  const priority = searchParams.get('priority') ?? ''
  const q = searchParams.get('q') ?? ''
  const dueFrom = searchParams.get('due_date_from') ?? ''
  const dueTo = searchParams.get('due_date_to') ?? ''
  const includeDone = searchParams.get('include_done') === '1'

  const orgs = useMemo(() => {
    const byId = new Map<number, string>()
    for (const p of projects) {
      if (p.org_id != null) byId.set(p.org_id, p.org_name ?? `Org ${p.org_id}`)
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [projects])

  // The board must never be queried without an org scope — explicit user feedback after
  // seeing an unfiltered board render every task in the system at once. Default to the
  // first org (by name) the moment the project list resolves, and never show unscoped.
  useEffect(() => {
    if (orgId !== null || orgs.length === 0) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('org_id', String(orgs[0].id))
        return next
      },
      { replace: true },
    )
  }, [orgId, orgs, setSearchParams])

  const orgProjects = useMemo(
    () => projects.filter((p) => p.org_id === orgId).sort((a, b) => a.name.localeCompare(b.name)),
    [projects, orgId],
  )
  const orgProjectIds = useMemo(() => new Set(orgProjects.map((p) => p.id)), [orgProjects])
  const sprintOptions = useMemo(
    () =>
      sprints
        .filter((s) => s.project_id != null && orgProjectIds.has(s.project_id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [sprints, orgProjectIds],
  )

  function update(patch: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null || value === '' || value === ALL_VALUE) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Organization</Label>
        <Select
          value={orgId != null ? String(orgId) : null}
          onValueChange={(v) => update({ org_id: v as string, project_id: null, sprint_id: null })}
        >
          <SelectTrigger className="w-40">
            {/* SelectValue shows the raw item value by default; a string value needs an
                explicit label lookup to render the org name instead of its bare id. */}
            <SelectValue placeholder="Select org">
              {(v: unknown) => orgs.find((org) => String(org.id) === v)?.name ?? 'Select org'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {orgs.map((org) => (
              <SelectItem key={org.id} value={String(org.id)}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Project</Label>
        <Select
          value={projectId != null ? String(projectId) : ALL_VALUE}
          onValueChange={(v) => update({ project_id: v === ALL_VALUE ? null : (v as string), sprint_id: null })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All projects">
              {(v: unknown) => orgProjects.find((p) => String(p.id) === v)?.name ?? 'All projects'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All projects</SelectItem>
            {orgProjects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Sprint</Label>
        <Select
          value={sprintId != null ? String(sprintId) : ALL_VALUE}
          onValueChange={(v) => update({ sprint_id: v === ALL_VALUE ? null : (v as string) })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All sprints">
              {(v: unknown) => sprintOptions.find((s) => String(s.id) === v)?.name ?? 'All sprints'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All sprints</SelectItem>
            {sprintOptions.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          value={status || ALL_VALUE}
          onValueChange={(v) => update({ status: v === ALL_VALUE ? null : (v as string) })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses">
              {(v: unknown) => (v === ALL_VALUE || v == null ? 'All statuses' : STATUS_LABEL[v as TaskStatus])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Priority</Label>
        <Select
          value={priority || ALL_VALUE}
          onValueChange={(v) => update({ priority: v === ALL_VALUE ? null : (v as string) })}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All">
              {(v: unknown) => (v === ALL_VALUE || v == null ? 'All priorities' : PRIORITY_LABEL[v as TaskPriority])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All priorities</SelectItem>
            {PRIORITY_ORDER.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Label htmlFor="board-search" className="text-xs text-muted-foreground">
          Search
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="board-search"
            className="pl-7"
            placeholder="Title or notes…"
            value={q}
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="board-due-from" className="text-xs text-muted-foreground">
          Due from
        </Label>
        <Input
          id="board-due-from"
          type="date"
          className="w-36"
          value={dueFrom}
          onChange={(e) => update({ due_date_from: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="board-due-to" className="text-xs text-muted-foreground">
          Due to
        </Label>
        <Input
          id="board-due-to"
          type="date"
          className="w-36"
          value={dueTo}
          onChange={(e) => update({ due_date_to: e.target.value })}
        />
      </div>

      <label className="flex items-center gap-2 pb-1.5 text-sm">
        <Switch
          checked={includeDone}
          onCheckedChange={(checked) => update({ include_done: checked ? '1' : null })}
        />
        Include done
      </label>
    </div>
  )
}
