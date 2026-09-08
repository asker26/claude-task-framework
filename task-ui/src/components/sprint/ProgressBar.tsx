import { cn } from '@/lib/utils'

export interface ProgressBarProps {
  done: number
  total: number
  showLabel?: boolean
  className?: string
}

export function ProgressBar({ done, total, showLabel = true, className }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${done} of ${total} tasks done`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-green-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {total > 0 ? `${done}/${total} · ${pct}%` : 'No tasks'}
        </span>
      )}
    </div>
  )
}
