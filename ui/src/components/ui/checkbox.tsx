import * as React from 'react'
import { cn } from '@/lib/utils'

export function CheckboxLabel({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none', className)}>
      <input type="checkbox" className="size-3.5 accent-[var(--primary)]" {...props} />
      {label}
    </label>
  )
}
