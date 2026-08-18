import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary/50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        outline: 'border border-border bg-card hover:border-primary/60',
        ghost: 'hover:bg-muted',
        destructive: 'border border-destructive/50 text-destructive bg-card hover:bg-destructive/10',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-6 px-2 text-xs rounded',
        lg: 'h-9 px-4',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
)
Button.displayName = 'Button'
