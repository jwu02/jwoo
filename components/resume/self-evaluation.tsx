import { SectionTitle } from "./section-title"

export function SelfEvaluation({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <div>
      <SectionTitle title={title} />
      <ul className="flex flex-col list-[square] pl-5">
        {items.map((evaluation, index) => (
          <li key={index}>{evaluation}</li>
        ))}
      </ul>
    </div>
  )
}
