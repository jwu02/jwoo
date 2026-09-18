import { Badge } from "@/components/ui/badge"
import { SectionTitle } from "./section-title"

export function Interests({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <div>
      <SectionTitle title={title} />
      <div className="flex flex-wrap gap-0.5">
        {items.map((interest, index) => (
          <Badge key={index} variant="outline">
            {interest}
          </Badge>
        ))}
      </div>
    </div>
  )
}
