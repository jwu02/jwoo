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
      <div className="flex-1 min-w-0 flex items-center justify-between gap-5">
        <div className="min-w-0">
          <div className="text-5xl font-black">{data.header.name}</div>
          <div className="text-2xl text-muted-foreground font-bold">
            {data.header.profession}
          </div>
        </div>
        <div className="shrink-0 mr-6">
          <Contacts />
        </div>
      </div>
    </div>
  )
}
