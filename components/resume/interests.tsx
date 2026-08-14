import { Badge } from "@/components/ui/badge"
import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function Interests({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.interests} />
      <div>
        {data.interests.map((interest, index) => (
          <Badge key={index} variant="outline" className="text-base">
            {interest}
          </Badge>
        ))}
      </div>
    </div>
  )
}
