export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline text-xl font-extrabold tracking-[-0.04em] ${className}`} aria-label="FINON">
      FINON<span className="text-primary">.</span>
    </span>
  )
}
