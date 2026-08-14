# Resume Section: Exact A4 Resume with EN/中 Toggle

## Context

The personal site (`jwoo`) currently has three sidebar sections — Home,
Activity Telemetry, and Knowledge Graph. A standalone, archived resume site
(`TonyWuCV` at `../resume`) renders Tony's CV as an exact A4 sheet: a
`210mm × 297mm` white page with a header (photo / name+profession / contacts),
a `3/10` accent-tinted left column (Education, Languages, Technical Skills,
Interests) and a `7/10` right column (Work Experience, Projects, Personal
Evaluation). It ships bilingual data (`public/locales/en/resume.json` and
`zh/resume.json`) but the language switch was never wired up — `request.ts` is
hardcoded to `en`.

We are porting that exact A4 resume into the main site as a new `/resume`
section, with a working English/Chinese toggle. "Exact" means the styling and
positioning of elements *within* the A4 page area are reproduced class-for-class
from the archive.

## Goals

- Add a `/resume` route reachable from the sidebar and the home page.
- Reproduce the archived A4 resume's layout, spacing, typography, and colors
  within the page area.
- Support switching the resume between English and Chinese with a client-side
  toggle (default `en`, persisted to `localStorage`).
- Port the archived resume data (en + zh) and display the real photo and the
  real WeChat icon.
- Produce a clean single-A4 print (hide site chrome, strip shadows/margins).

## Non-Goals

- Introduce a site-wide i18n framework (`next-intl`, `[locale]` routing, or
  similar). The toggle is scoped to the resume page only.
- Restyle the rest of the site or change the sidebar/home-page sections.
- Translate anything outside the resume content.
- Rewrite the resume data model beyond what the port requires.

## Design

### Routing and shell

`app/resume/page.tsx` (server component) renders `<ResumeView />` inside the
existing sidebar layout, so the page keeps the site chrome. The resume sheet
itself is scrollable and centered, as in the archive.

### Data and language switching

New typed data modules under `lib/resume/`:

- `lib/resume/types.ts` — `Locale`, `HeaderData`, `EducationItem`,
  `TechnicalSkillItem`, `WorkExperienceItem`, `ProjectItem`, `LanguageItem`,
  `ResumeData`. Ported from the archive's `lib/types.ts` with a resolved
  `languages` array (label + proficiency label + value per locale) and a
  `titles` record.
- `lib/resume/locale-data.ts` — `en` and `zh` data objects (content ported
  verbatim from `resume/public/locales/{en,zh}/resume.json`) and
  `getResumeData(locale)`. The archive's `lib/constants.ts`
  `foreignLanguageItems` (key → value) is folded in, with labels resolved per
  locale.

`components/resume/resume-view.tsx` (client) owns `locale` state
(`useState`, initialized from `localStorage`, written back on change) and
passes `data={getResumeData(locale)}` down to presentational components as a
prop. Components take `data` props rather than `useTranslations` — no i18n
library, and components stay testable presentational units (consistent with the
site's component conventions).

`components/resume/language-toggle.tsx` (client) renders the EN / 中 control
above the sheet. It is excluded from print output.

### Contacts

`components/resume/contacts.tsx` reads `NEXT_PUBLIC_EMAIL`, `NEXT_PUBLIC_PHONE`,
`NEXT_PUBLIC_GITHUB`, `NEXT_PUBLIC_WECHAT` from the environment and renders each
present contact as an icon + label row, exactly as the archive does (env-keys
are inlined at build time; the four keys are added to `.env`, values ported
from the archive's `.env.local`).

Icons use the archive's exact set via a new `react-icons` dependency:
`RxEnvelopeClosed`, `RxMobile`, `RxGithubLogo` (from `react-icons/rx`) and
`IoLogoWechat` (from `react-icons/io5`).

### A4 sheet styling (ported verbatim from the archive)

`components/resume/resume-a4-page.tsx` renders the sheet:

```jsx
<div className="resume-page w-[210mm] h-[297mm] bg-white shadow-2xl mx-auto my-10 flex flex-col">
  <ResumeHeader data={data.header} contacts={...} />
  <div className="flex flex-grow">
    <div className="flex flex-col gap-4 m-3 p-4 w-3/10 bg-accent">
      <Education data={data} /> <Languages data={data} />
      <TechnicalSkills data={data} /> <Interests data={data} />
    </div>
    <div className="flex flex-col gap-4 m-3 p-4 w-7/10 ml-0 pl-2">
      <WorkExperience data={data} /> <PersonalProjects data={data} />
      <SelfEvaluation data={data} />
    </div>
  </div>
</div>
```

Header (`components/resume/resume-header.tsx`):
`flex items-center justify-around gap-5 p-5 bg-accent`. Photo
(`<Image src="/pfp.jpg" width={125} height={125} className="rounded-full" />`),
name `text-5xl font-black`, profession `text-3xl text-muted-foreground
font-bold`, then `<Contacts />` (`flex flex-col gap-1 py-2 font-medium`, each
row `flex items-center gap-2`, icon in `text-background bg-theme-1 p-1.5
rounded-full`, size 16).

Sections (`section-title.tsx` + the seven section components) keep the archive's
exact classes — e.g. section titles use `border-b-2 border-theme-1 w-full mb-2`
with a `bg-theme-1 text-background font-bold px-2 py-1 w-fit` band; experience
rows right-align dates via `flex justify-between`; bullets are
`list-disc pl-5`; language rows use a `Progress` bar + outline `Badge`;
interests render as outline `Badge`s with `text-base`.

### Scoped light theme + base type

The archive applied `text-[12px] leading-tight` and `border-border`/`outline-ring`
globally via `*`. To reproduce the sheet without affecting the rest of the
site, `app/globals.css` gains a scoped `.resume-page` rule that:

- forces the light color tokens (`--background`, `--accent`, `--muted-foreground`,
  `--border`, `--foreground`, `--card`, `--theme-1`) regardless of the site's
  dark mode, and
- sets `text-[12px] leading-tight`.

`--theme-1` (`oklch(0 0 0)`) is not defined in the main site's globals; it is
added inside `.resume-page` and mapped with `--color-theme-1: var(--theme-1)` in
`@theme inline` so the `bg-theme-1`/`border-theme-1` utilities resolve.

### Font

`next/font/google` `Geist` (sans) is loaded in `app/resume/page.tsx`, its
variable applied to the `.resume-page` container via `font-[family-name:var(--font-geist-sans)]`
— matching the archive's typography. The rest of the site keeps its Roboto Mono
default.

### Printing

In `app/globals.css`:

- `@page { size: A4; margin: 0 }`.
- `@media print`: hide the sidebar and top header (`aside`, `header`),
  zero the layout wrapper's padding, and strip the sheet's `shadow-2xl` and
  vertical margins so only the A4 sheet prints on one page.
- The language toggle and site chrome are excluded from the print output.

## Components

### New: `components/resume/`

- `resume-view.tsx` (client) — locale state, persistence, renders toggle + sheet
- `language-toggle.tsx` (client) — EN / 中 button group
- `resume-a4-page.tsx` — the `210×297mm` sheet shell, column layout
- `resume-header.tsx` — header row (photo, name, profession, contacts)
- `contacts.tsx` — env-driven contact rows
- `section-title.tsx` — black-banded section title
- `education.tsx`, `languages.tsx`, `technical-skills.tsx`, `interests.tsx`
- `work-experience.tsx`, `personal-projects.tsx`, `self-evaluation.tsx`

### New: `app/resume/page.tsx`

Server page loading Geist and rendering `<ResumeView />`.

### New: `lib/resume/`

- `types.ts`, `locale-data.ts`

### Modified

- `components/app-sidebar.tsx` — add `{ title: "Resume", url: "/resume", icon: FileText }`
- `app/page.tsx` — add a Resume card matching the existing two cards
- `app/globals.css` — `.resume-page` scoped colors/type, `--theme-1`, print rules
- `app/layout.tsx` — print-safe padding on the content wrapper
- `.env` — add `NEXT_PUBLIC_EMAIL/PHONE/GITHUB/WECHAT`
- `public/pfp.jpg` — copy the archive photo (1232×1232), displayed at 125×125
- `components/ui/badge.tsx`, `components/ui/progress.tsx` — added via the
  `shadcn` skill (base-nova / @base-ui), then styled to the archive's look
- `package.json` — add `react-icons`

## Error Handling

- Contacts render nothing for env keys that are unset (archive behavior).
- The resume forces light colors, so dark-mode CSS can never make text
  unreadable (e.g. light muted-foreground on the white sheet).
- Missing/broken photo: the sheet keeps its 125×125 slot regardless.

## Testing

Jest (mirrors under `tests/`):

- `tests/lib/resume/locale-data.test.ts` — en and zh expose the same top-level
  shape (keys/section arrays); `getResumeData("en" | "zh")` returns the right
  locale.
- `tests/components/resume/resume-a4-page.test.tsx` — renders all seven section
  titles and the header name.
- `tests/components/resume/resume-view.test.tsx` — toggling switches the header
  name from "Tony Wu" to "吴家聪" (and back); initial locale reads from
  `localStorage`.

Verification: `npm test`, `npm run typecheck`, `npm run lint`. Manual:
`npm run dev` → open `/resume`, toggle EN/中, verify A4 sheet matches the
archive, and test `window.print()` yields one A4 page with no chrome.

## Out of Scope

- Site-wide i18n / locale routing.
- Changing other sections or the shared theme.
- Editing resume content (it is ported as-is; content edits are future work).
- Mobile responsiveness of the sheet (it is a fixed A4 size, like the archive).
