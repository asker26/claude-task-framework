import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full rounded-md border border-border bg-card px-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary/50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
