import type { IconType } from "react-icons"
import { IoLogoWechat, IoMail } from "react-icons/io5"
import { FaMobile } from "react-icons/fa"
import { RxGithubLogo } from "react-icons/rx"

import type { ContactItem, ContactKey } from "@/lib/resume/types"

const CONTACT_ICONS: Record<ContactKey, IconType> = {
  email: IoMail,
  phone: FaMobile,
  github: RxGithubLogo,
  wechat: IoLogoWechat,
}

export function Contacts({ items }: { items: ContactItem[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 font-medium">
      {items.map(({ key, value }) => {
        const Icon = CONTACT_ICONS[key]
        return (
          <div key={key} className="flex items-center gap-1 leading-none">
            <Icon size={16} />
            <span>{value}</span>
          </div>
        )
      })}
    </div>
  )
}
