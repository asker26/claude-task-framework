import * as React from 'react'
import { cn } from '@/lib/utils'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn('h-8 rounded-md border border-border bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-primary/50', className)}
      {...props}
    />
  ),
)
Select.displayName = 'Select'
