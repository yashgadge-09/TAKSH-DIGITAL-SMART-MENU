import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  // bg-accent (a saturated gold token) reads as a solid, alarming block on
  // this app's dark surfaces — every current skeleton use is on a dark
  // background, so a faint translucent fill is the right default here.
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-white/[0.06] animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
