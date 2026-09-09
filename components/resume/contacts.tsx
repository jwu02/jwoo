import { IoLogoWechat, IoMail } from "react-icons/io5"
import { FaMobile } from "react-icons/fa"
import { RxGithubLogo } from "react-icons/rx"

const CONTACT_ITEMS = [
  { key: "email", icon: IoMail, value: process.env.NEXT_PUBLIC_EMAIL ?? null },
  { key: "phone", icon: FaMobile, value: process.env.NEXT_PUBLIC_PHONE ?? null },
  { key: "github", icon: RxGithubLogo, value: process.env.NEXT_PUBLIC_GITHUB ?? null },
  { key: "wechat", icon: IoLogoWechat, value: process.env.NEXT_PUBLIC_WECHAT ?? null },
] as const

export function Contacts() {
  return (
    <div className="flex flex-wrap gap-x-4 font-medium">
      {CONTACT_ITEMS.filter((contact) => contact.value).map(
        ({ key, icon: Icon, value }) => (
          <div key={key} className="flex items-center gap-1 leading-none">
            <Icon size={16} />
            <span>{value}</span>
          </div>
        )
      )}
    </div>
  )
}
