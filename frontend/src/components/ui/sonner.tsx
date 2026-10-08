import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    position="top-right"
    offset={{ top: 24, right: 24 }}
    mobileOffset={{ top: 16, right: 16, left: 16 }}
    duration={5000}
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-6 text-ok" />,
      info: <InfoIcon className="size-6" />,
      warning: <TriangleAlertIcon className="size-6 text-warn" />,
      error: <OctagonXIcon className="size-6 text-bad" />,
      loading: <Loader2Icon className="size-6 animate-spin" />,
    }}
    toastOptions={{
      classNames: {
        toast: "!gap-3 !rounded-2xl !border-primary/40 !px-5 !py-4 !text-base !font-medium !shadow-2xl",
      },
    }}
    style={
      {
        "--width": "min(26rem, calc(100vw - 2rem))",
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
      } as React.CSSProperties
    }
    {...props}
  />
)

export { Toaster }
