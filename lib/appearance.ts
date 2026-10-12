// The two appearances the OS is drawn in, as shared vocabulary.
//
// The appearance itself lives in `components/os/appearance.ts` — this is only
// the name of the choice, kept at the lib root so a feature's colour ramp can
// take it without reaching up into `components/`. That keeps `lib/telemetry`
// and `lib/ai-usage` siblings that share a type rather than one importing the
// other.
export type Appearance = "light" | "dark"
