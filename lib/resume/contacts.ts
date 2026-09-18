import type { ContactItem } from "./types"

// The contact details are deployment configuration rather than resume copy: the
// values come from the environment and stay out of git. Reading them here, at
// the seam, keeps every component free of process.env. Next inlines
// `process.env.NEXT_PUBLIC_*` only where it is written literally, so each read
// is a static member access rather than a loop over key names.
//
// Only the values live here. How a contact *reads* — its label — is copy, and
// would localize like the rest of the resume: this is the shared half that a
// localized label map would join, the way LANGUAGE_ITEMS meets LANGUAGE_LABELS.
export function getContacts(): ContactItem[] {
  const configured: { key: ContactItem["key"]; value: string | undefined }[] = [
    { key: "email", value: process.env.NEXT_PUBLIC_EMAIL },
    { key: "phone", value: process.env.NEXT_PUBLIC_PHONE },
    { key: "github", value: process.env.NEXT_PUBLIC_GITHUB },
    { key: "wechat", value: process.env.NEXT_PUBLIC_WECHAT },
  ]

  // An unset variable means "this contact is not published", not "render it
  // blank": the header shows only the details that are configured.
  return configured.flatMap(({ key, value }) => (value ? [{ key, value }] : []))
}
