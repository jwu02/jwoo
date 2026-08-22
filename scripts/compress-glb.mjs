// One-time Draco geometry compression for public/*.glb.
// Pristine originals are backed up into public/.glb-originals/ (git-ignored),
// and compression always runs from the backup, so re-running is idempotent.
import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const bin = join(root, "node_modules/.bin/gltf-transform")
const inputDir = join(root, "public")
const backupDir = join(root, "public/.glb-originals")

mkdirSync(backupDir, { recursive: true })

for (const file of readdirSync(inputDir)) {
  if (!file.endsWith(".glb")) continue
  const target = join(inputDir, file)
  const backup = join(backupDir, file)
  if (!existsSync(backup)) {
    console.log(`backing up ${file}`)
    copyFileSync(target, backup)
  }
  console.log(`compressing ${file}`)
  execFileSync(bin, ["draco", backup, target], { stdio: "inherit" })
}

console.log("done")
