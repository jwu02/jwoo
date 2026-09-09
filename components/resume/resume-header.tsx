import Image from "next/image"
import type { ResumeData } from "@/lib/resume/types"
import { Contacts } from "./contacts"

export function ResumeHeader({ data }: { data: ResumeData }) {
  return (
    <div className="flex items-center gap-5 p-3 bg-accent">
      <div className="w-[27%] flex justify-center shrink-0">
        <Image
          src="/pfp.jpg"
          width={125}
          height={125}
          className="rounded-full"
          alt={data.header.name}
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="text-5xl font-black">{data.header.name}</div>
        <div className="text-2xl text-muted-foreground font-bold">
          {data.header.profession}
        </div>
        <Contacts />
      </div>
    </div>
  )
}
