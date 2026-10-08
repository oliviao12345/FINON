import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const zoneId = (category: string) => `cat:${category}`
export const categoryOfZone = (id: unknown) =>
  typeof id === 'string' && id.startsWith('cat:') ? id.slice(4) : null

interface Props {
  category: string
  testId: string
  droppable: boolean
  children: ReactNode
  labelledBy: string
}

export function CategoryZone({ category, testId, droppable, children, labelledBy }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId(category), disabled: !droppable })
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={labelledBy}
      data-testid={testId}
      className={cn(
        'grid gap-3 rounded-2xl transition-[box-shadow,background-color] duration-150',
        droppable && isOver && 'bg-primary/8 ring-2 ring-primary/60 ring-offset-8 ring-offset-background',
      )}
    >
      {children}
    </section>
  )
}
