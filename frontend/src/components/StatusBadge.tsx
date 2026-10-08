import { CheckCircle2, CircleDashed, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_LABEL } from '@/lib/format'
import type { Status } from '@/lib/types'

const STYLE: Record<Status, { icon: typeof Clock; cls: string }> = {
  UPLOADED: { icon: CheckCircle2, cls: 'bg-ok/12 text-ok ring-ok/25' },
  OUTDATED: { icon: Clock, cls: 'bg-warn/12 text-warn ring-warn/25' },
  MISSING: { icon: CircleDashed, cls: 'bg-bad/12 text-bad ring-bad/25' },
}

export function StatusBadge({ status }: { status: Status }) {
  const { icon: Icon, cls } = STYLE[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', cls)}>
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  )
}
