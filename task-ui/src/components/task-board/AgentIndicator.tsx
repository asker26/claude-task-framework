import { cn } from '@/lib/utils'
import type { RunningAgentInfo } from '@/lib/types'

function formatAge(seconds: number | null): string {
  if (seconds == null) return ''
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

export function AgentIndicator({ agent, className }: { agent: RunningAgentInfo | null; className?: string }) {
  if (!agent) return null

  if (agent.stuck) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400',
          className,
        )}
        title={`${agent.worker_name} stuck — no heartbeat for ${formatAge(agent.heartbeat_age_s)}`}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-red-500" />
        stuck {formatAge(agent.heartbeat_age_s)}
      </span>
    )
  }

  if (agent.status === 'pending') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-gray-500/15 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400',
          className,
        )}
        title={`${agent.worker_name} starting`}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-gray-400" />
        starting
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400',
        className,
      )}
      title={`${agent.worker_name} running`}
    >
      <span className="relative flex size-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
      </span>
      {agent.worker_name}
    </span>
  )
}
