import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { AccountCard } from '@/components/AccountCard'
import type { Account } from '@/lib/types'

type CardProps = Omit<React.ComponentProps<typeof AccountCard>, 'dragHandle' | 'innerRef' | 'dragging'>

export function DraggableAccount(props: CardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: props.account.id })
  const name = props.account.provider.name

  return (
    <AccountCard
      {...props}
      innerRef={setNodeRef}
      dragging={isDragging}
      dragHandle={
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Move ${name} to another category`}
          title="Drag to another category"
          className="-ml-1 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      }
    />
  )
}

export function DragPreview({ account }: { account: Account }) {
  return (
    <div className="flex w-fit max-w-[22rem] items-center gap-3 rounded-2xl border border-primary/60 bg-card px-4 py-3 text-sm shadow-2xl">
      <GripVertical className="size-4 text-primary" aria-hidden />
      <span className="font-medium">{account.provider.name}</span>
      <span className="text-muted-foreground">Drop on a category</span>
    </div>
  )
}
