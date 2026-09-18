// Display config for the by-project breakdown: which repository a session's
// working directory belongs to. It lives on its own rather than inside the
// aggregation file so business config is not buried in pipeline code.

/** Fallback project name for cwds that match no PROJECT_GROUPS key. */
const OTHERS_PROJECT = "others";

// Maps a cwd substring (matched case-insensitively) to the project name shown
// in the breakdown table. Keys are evaluated in order; the first substring
// contained in a cwd wins. Order longer, more specific keys before broader
// ones that their paths also contain — e.g. report-generator sits under
// kamkiu, so it must be checked first or its rows would fall into "work".
// Anything matching no key aggregates into the OTHERS_PROJECT row.
const PROJECT_GROUPS: Record<string, string> = {
  "training-management-system": "training-management-system",
  "assessment-management-system": "assessment-management-system",
  "report-generator": "report-generator",
  kamkiu: "work",
  "personal-website": "personal-website",
};

function findProjectGroup(cwd: string): string | null {
  const normalized = cwd.toLowerCase();
  for (const [substring, name] of Object.entries(PROJECT_GROUPS)) {
    if (normalized.includes(substring.toLowerCase())) return name;
  }
  return null;
}

/** The breakdown's project name for a session's working directory. */
export function projectForCwd(cwd: string | null): string {
  return findProjectGroup(cwd ?? "") ?? OTHERS_PROJECT;
}
