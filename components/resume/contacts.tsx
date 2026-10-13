import type { IconType } from "react-icons"
import { IoGlobeOutline, IoLogoWechat, IoMail } from "react-icons/io5"
import { FaMobile } from "react-icons/fa"
import { RxGithubLogo } from "react-icons/rx"

import type { ContactItem, ContactKey } from "@/lib/resume/types"

const CONTACT_ICONS: Record<ContactKey, IconType> = {
  email: IoMail,
  phone: FaMobile,
  github: RxGithubLogo,
  wechat: IoLogoWechat,
  website: IoGlobeOutline,
}

export function Contacts({ items }: { items: ContactItem[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 font-medium">
      {items.map(({ key, value }) => {
        const Icon = CONTACT_ICONS[key]
        return (
          <div
            key={key}
            className="flex min-w-0 items-center gap-1 leading-snug"
          >
            <Icon size={16} className="shrink-0" />
            {/* A website is the one contact whose value can outgrow its line:
                the URL breaks rather than pushing the row past the header, and
                `leading-snug` keeps its broken lines from touching. */}
            <span className="break-all">{value}</span>
          </div>
        )
      })}
    </div>
  )
}
