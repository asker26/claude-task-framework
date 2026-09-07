import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ListTodo } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useProjects, useSprints } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Project, Sprint } from '@/lib/types'

const NO_ORG_KEY = '__no_org__'
const ROW_CLASS = 'h-auto flex-col items-start gap-0.5 py-1.5'

interface OrgGroup {
  key: string
  label: string
  projects: Project[]
}

function groupByOrg(projects: Project[]): OrgGroup[] {
  const groups = new Map<string, OrgGroup>()
  for (const project of projects) {
    const key = project.org_id != null ? String(project.org_id) : NO_ORG_KEY
    const label = project.org_id != null ? (project.org_name ?? `Org ${project.org_id}`) : 'No org'
    if (!groups.has(key)) groups.set(key, { key, label, projects: [] })
    groups.get(key)!.projects.push(project)
  }
  for (const group of groups.values()) {
    group.projects.sort((a, b) => a.name.localeCompare(b.name))
  }
  const named = [...groups.values()]
    .filter((group) => group.key !== NO_ORG_KEY)
    .sort((a, b) => a.label.localeCompare(b.label))
  const noOrg = groups.get(NO_ORG_KEY)
  return noOrg ? [...named, noOrg] : named
}

function ProjectRowContent({ project, sprint }: { project: Project; sprint: Sprint | undefined }) {
  return (
    <>
      <span className="w-full truncate">{project.name}</span>
      {project.active_sprint_name && (
        <span className="flex w-full items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="truncate">{project.active_sprint_name}</span>
          {sprint && (
            <span className="ml-auto shrink-0 rounded-md bg-muted px-1.5 py-0.5 tabular-nums">
              {sprint.done}/{sprint.total}
            </span>
          )}
        </span>
      )}
    </>
  )
}

function ProjectRow({
  project,
  sprint,
  isActive,
}: {
  project: Project
  sprint: Sprint | undefined
  isActive: boolean
}) {
  if (project.org_id == null) {
    return (
      <SidebarMenuItem>
        {/* No org_id to pair with project_id, and the board's org filter is mandatory
            (never "all orgs") — a working link here could only ever produce an
            inconsistent org/project URL, so this row is display-only. */}
        <div className={cn(ROW_CLASS, 'flex w-full cursor-default rounded-md p-2 opacity-60')}>
          <ProjectRowContent project={project} sprint={sprint} />
        </div>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to={`/?org_id=${project.org_id}&project_id=${project.id}`} />}
        isActive={isActive}
        className={ROW_CLASS}
      >
        <ProjectRowContent project={project} sprint={sprint} />
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const { data: projects, isLoading } = useProjects()
  const { data: sprints } = useSprints()
  const [searchParams] = useSearchParams()
  const currentProjectId = searchParams.get('project_id')

  const sprintById = useMemo(() => new Map((sprints ?? []).map((sprint) => [sprint.id, sprint])), [sprints])
  const groups = useMemo(() => groupByOrg(projects ?? []), [projects])

  return (
    <Sidebar>
      <SidebarHeader className="flex-row items-center gap-2 px-3 py-2.5">
        <ListTodo className="size-4 text-primary" />
        <span className="text-sm font-semibold">Task Board</span>
      </SidebarHeader>
      <SidebarContent>
        {isLoading && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {!isLoading &&
          groups.map((group) => (
            <SidebarGroup key={group.key}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.projects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      sprint={project.active_sprint_id != null ? sprintById.get(project.active_sprint_id) : undefined}
                      isActive={currentProjectId === String(project.id)}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
