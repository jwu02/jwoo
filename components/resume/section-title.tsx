interface SectionTitleProps {
  title: string
}

export function SectionTitle({ title }: SectionTitleProps) {
  return (
    <div className="border-b-2 border-theme-1 w-full mb-2">
      <h2 className="bg-theme-1 text-background font-bold px-1.5 pt-1 pb-0.5 w-fit">{title}</h2>
    </div>
  )
}
