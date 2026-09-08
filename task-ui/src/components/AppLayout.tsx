import { Outlet } from 'react-router-dom'
import { ListTodo } from 'lucide-react'
import { StatStrip } from './StatStrip'
import { ThemeToggle } from './ThemeToggle'

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-2">
        <h1 className="inline-flex items-center gap-2 text-[15px] font-semibold">
          <span className="rounded-md bg-primary/15 p-1 text-primary">
            <ListTodo className="size-4" />
          </span>
          Task Board
        </h1>
        <span className="grow" />
        <StatStrip />
        <ThemeToggle />
      </header>
      <div className="flex-1 overflow-auto p-4">
        <Outlet />
      </div>
    </div>
  )
}
