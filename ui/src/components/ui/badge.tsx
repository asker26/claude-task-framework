import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0 text-[11px] font-medium leading-4 whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-border text-muted-foreground',
        warn: 'border-warn/60 text-warn',
        bad: 'border-destructive/60 text-destructive',
        ok: 'border-ok/60 text-ok',
        info: 'border-primary/60 text-primary',
        mine: 'border-accent2/60 text-accent2',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
