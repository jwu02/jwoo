import { PrototypeSwitcher } from "@/components/prototype/prototype-switcher"

import { TerminalVariant } from "./variants"

/** Keys and labels of the four looks below. Declared here rather than in the
 * client module: a Server Component cannot read a plain export out of a
 * `"use client"` module, and this route's page is a Server Component. */
const VARIANTS = [
  { key: "os", name: "OS Pane" },
  { key: "phosphor", name: "Phosphor CRT" },
  { key: "ansi", name: "Glass + ANSI" },
  { key: "workbench", name: "Workbench" },
]

/**
 * PROTOTYPE ROUTE — throwaway. jwoo issue #60, "The Terminal's look".
 *
 * Four variants of the Terminal application, switched with ?variant= and the
 * floating bar below. Nothing here ships: the winner's looks get folded into
 * the real Terminal when the spec is built, and the route dies with the rest.
 */
export default async function TerminalLookPrototype({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>
}) {
  const { variant } = await searchParams
  const keys = VARIANTS.map((v) => v.key)
  const current = variant && keys.includes(variant) ? variant : keys[0]

  return (
    <>
      {/* Keyed so switching variants remounts, rather than leaving one
          variant's input value or scroll position behind in another. */}
      <div key={current} className="h-full">
        <TerminalVariant variantKey={current} />
      </div>
      <PrototypeSwitcher
        variants={VARIANTS.map((v) => ({ key: v.key, name: v.name }))}
        current={current}
      />
    </>
  )
}
