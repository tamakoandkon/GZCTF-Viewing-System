import { cn } from "@/lib/utils"

export function CompetitionTitle({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  return (
    <div className={cn("event-title-wrap", className)}>
      <h1 className="event-title-text" title={title} data-title={title} dir="auto">
        {title}
      </h1>
    </div>
  )
}

