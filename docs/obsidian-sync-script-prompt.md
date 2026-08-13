# Prompt: Obsidian Vault → MongoDB sync script

Use the text below (from the `---` markers) as a standalone prompt in a new session. It references this repo's design spec only as background; it does not require the site code to be checked out.

---

# Build an Obsidian vault sync script for a knowledge graph

## Goal

Write a standalone script (Node.js + TypeScript) that scans an Obsidian vault and syncs a minimal metadata snapshot into MongoDB, so a separate Next.js website can render an Obsidian-style knowledge graph from it. The script lives and runs OUTSIDE the website repo — it is a separate tool. Do not modify the website.

## Background / contract

The website reads a MongoDB collection named `notes` (database: env `ACTIVITY_DB_NAME`, default `activity-telemetry`) and treats it as a graph. Its exact expectations are:

- **Collection `notes`**, one document per markdown note.
- Document shape:
  ```ts
  { filename: string; createdAt: Date; links: string[] }
  ```
- `filename` — the note's path **relative to the vault root**, forward slashes, **with the `.md` extension**, e.g. `Projects/My Note.md`. This is the document's unique key and the graph node id.
- `createdAt` — the note file's **creation date** (filesystem birthtime). If birthtime is unavailable/invalid on the current filesystem, fall back to mtime, then ctime, and record which you used in a `--verbose` log.
- `links` — the note's **outgoing wikilinks, resolved to target filenames** in the same format as `filename`. If a link resolves to a file that does not exist in the vault, **drop it** (the graph never shows dangling nodes). Deduplicate (each target appears at most once).

Upsert by `filename` so re-running the script is **idempotent**. Also **delete** documents whose `filename` no longer exists in the vault, so deleting a note from Obsidian removes its node (run deletions only after the full scan, and report how many).

## Extraction rules

- Scan the vault recursively; only `.md` files are notes.
- Skip hidden entries (leading `.`), the vault's `.obsidian/` folder, and any non-markdown files.
- For each note, parse its body for **wikilinks** `[[...]]`:
  - Strip aliases: `[[Note|Display]]` → target `Note`.
  - Strip anchors: `[[Note#Heading]]` → target `Note`; `[[Note^block]]` → target `Note`.
  - Resolve the target to a vault-relative filename: append `.md` if missing, honor subfolder paths (`[[Folder/Note]]`), and match against the actual files found in the scan. Resolution should tolerate case differences the way Obsidian does on macOS (fall back to a case-insensitive match) and normalize to the on-disk filename.
  - Only keep targets that resolve to an existing `.md` file. Store the resolved filename in `links`.

## Explicitly OUT of scope (do not implement)

- Extracting tags, YAML frontmatter, aliases, modification dates, folder paths, or note content.
- Treating tags or folders as graph nodes.
- `![[...]]` embeds, `[text](path)` Markdown links, or links to non-markdown files. (If you want to also treat `![[Note]]` embeds of real notes as connections, say so in your report — but default to excluding them per this contract.)
- Editing the website, its schema, or its API.

## Requirements

- TypeScript, run with `tsx` or compiled with `tsc`. Only runtime dependency should be `mongodb` (dev dep `@types/mongodb`, `@types/node`).
- Reads config from env or CLI flags: `VAULT_PATH` (required), `MONGO_URI` (required), `ACTIVITY_DB_NAME` (default `activity-telemetry`).
- CLI: `--dry-run` prints exactly what would change (created/updated/removed counts, per-file summary in `--verbose`) without writing; `--help` documents flags.
- Robust to vaults with spaces in filenames, subfolders, and files with unusual characters in wikilinks.
- After the run, print a concise summary: notes scanned, notes upserted, notes removed, total links recorded.
- Do NOT crash on a single malformed file — log and continue.

## Verification (do this before you're done)

1. Build a small throwaway fixture vault (a temp dir with several `.md` files including: a note linking another by exact name, one linking with an alias, one linking a subfolder note, one linking a heading, one linking a **missing** file, and one file whose name has a space). Run the script against it with a local MongoDB (or a mocked driver for tests) and assert:
   - every existing note has a doc with the correct `filename` and `links`;
   - the missing-file link is absent;
   - aliases/anchors resolve to the target filename;
   - running twice changes nothing (idempotent);
   - deleting a note from the fixture and re-running removes its doc.
2. If you write automated tests, unit-test the wikilink parser and resolver against the fixture cases. If you verify manually with `--dry-run`, document the exact commands and output in your report.
3. Report: file structure, how to run it, the fixture/verification evidence, and any judgment calls (e.g. birthtime fallback, embed handling).

Do all of this work yourself — do not spawn subagents. Keep the script focused and small; no extra features beyond what's listed.
