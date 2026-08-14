import { IoLogoWechat } from "react-icons/io5"
import { RxEnvelopeClosed, RxGithubLogo, RxMobile } from "react-icons/rx"

const CONTACT_ITEMS = [
  { key: "email", icon: RxEnvelopeClosed, value: process.env.NEXT_PUBLIC_EMAIL ?? null },
  { key: "phone", icon: RxMobile, value: process.env.NEXT_PUBLIC_PHONE ?? null },
  { key: "github", icon: RxGithubLogo, value: process.env.NEXT_PUBLIC_GITHUB ?? null },
  { key: "wechat", icon: IoLogoWechat, value: process.env.NEXT_PUBLIC_WECHAT ?? null },
] as const

export function Contacts() {
  return (
    <div className="flex flex-col gap-1 py-2 font-medium">
      {CONTACT_ITEMS.filter((contact) => contact.value).map(
        ({ key, icon: Icon, value }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-background bg-theme-1 p-1.5 rounded-full">
              <Icon size={16} />
            </span>
            <span>{value}</span>
          </div>
        )
      )}
    </div>
  )
}
