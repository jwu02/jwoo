import Image from "next/image"
import type { ResumeData } from "@/lib/resume/types"
import { Contacts } from "./contacts"

export function ResumeHeader({ data }: { data: ResumeData }) {
  return (
    <div className="flex items-center justify-around gap-5 p-5 bg-accent">
      <div>
        <Image
          src="/pfp.jpg"
          width={125}
          height={125}
          className="rounded-full"
          alt="Tony Wu"
        />
      </div>
      <div>
        <div className="text-5xl font-black">{data.header.name}</div>
        <div className="text-3xl text-muted-foreground font-bold">
          {data.header.profession}
        </div>
      </div>
      <Contacts />
    </div>
  )
}
