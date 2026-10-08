import { Copy, ExternalLink, Phone } from 'lucide-react'
import { toast } from 'sonner'
import type { Provider } from '@/lib/types'

export function statementLink(provider: Provider) {
  const { statementHelpUrl, websiteUrl, name } = provider
  if (statementHelpUrl) return { href: statementHelpUrl, label: 'How to get your statement', kind: 'help' as const }
  if (websiteUrl) return { href: websiteUrl, label: `Visit ${name}'s website`, kind: 'website' as const }
  return {
    href: `https://www.google.com/search?q=${encodeURIComponent(`${name} how to get a statement`)}`,
    label: 'Search how to get your statement',
    kind: 'search' as const,
  }
}

export function StatementHelp({ provider }: { provider: Provider }) {
  const { supportPhone, name } = provider
  const link = statementLink(provider)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(supportPhone!)
      toast.success(`${name} number copied`)
    } catch {
      toast.error("Couldn't copy the number. You can select it instead.")
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        data-link-kind={link.kind}
        className="inline-flex items-center gap-1 rounded font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {link.label}
        <ExternalLink className="size-3" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {supportPhone && (
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <a
            href={`tel:${supportPhone.replace(/\s+/g, '')}`}
            className="inline-flex items-center gap-1 rounded underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Phone className="size-3" aria-hidden />
            <span className="sr-only">Call {name} on </span>
            {supportPhone}
          </a>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${name} phone number`}
            className="inline-flex items-center gap-1 rounded px-1 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Copy className="size-3" aria-hidden />
            Copy
          </button>
        </span>
      )}
    </div>
  )
}
