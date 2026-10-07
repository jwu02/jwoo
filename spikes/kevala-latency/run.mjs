// Runner for the kevala latency spike (jwu02/jwoo#53).
//
// Serves this directory, opens Chrome on the harness page with a persistent
// profile (so the second run's weights come from Cache Storage), waits for the
// report, writes report.json and fires the pre-committed model rule.
//
//   node run.mjs
//
//   node run.mjs           full measurement
//   node run.mjs --tokens  tokenizer only: print the resolved special-token ids
//
// CHROME=<path> overrides the browser binary.

import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { readFile, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { fileURLToPath } from "node:url"

const DIR = fileURLToPath(new URL(".", import.meta.url))
const CHROME =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const PROFILE = "/tmp/kevala-spike-chrome-profile"
const BUDGET_MS = 4000 // the pre-committed rule: ≤ ~4 s → Laya proper, miss → pivot

// A tokenizer-only probe writes its own file; it is not the timed run.
const TOKENS_ONLY = process.argv.includes("--tokens")
const REPORT = join(DIR, TOKENS_ONLY ? "probe-tokens.json" : "report.json")

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".wasm": "application/wasm",
}

const stamp = () => new Date().toISOString().slice(11, 19)
const log = (line) => console.log(`${stamp()} ${line}`)

let finish
const reported = new Promise((resolve) => (finish = resolve))

const server = createServer(async (request, response) => {
  if (request.method === "POST") {
    let body = ""
    for await (const chunk of request) body += chunk
    if (request.url === "/progress") {
      log(`  ${body}`)
      response.end("ok")
      return
    }
    if (request.url === "/report") {
      log("report received")
      const parsed = JSON.parse(body)
      await writeFile(REPORT, `${JSON.stringify(parsed, null, 2)}\n`)
      finish(parsed)
      response.end("ok")
      return
    }
    response.statusCode = 404
    response.end()
    return
  }

  const path = decodeURIComponent(request.url.split("?")[0])
  const file = join(DIR, path === "/" ? "index.html" : path)
  if (!file.startsWith(DIR)) {
    response.statusCode = 403
    response.end()
    return
  }
  try {
    const data = await readFile(file)
    response.setHeader(
      "content-type",
      TYPES[extname(file)] ?? "application/octet-stream"
    )
    response.end(data)
  } catch {
    response.statusCode = 404
    response.end("not found")
  }
})

const tokensOnly = TOKENS_ONLY
const port = await new Promise((resolve) =>
  server.listen(0, "127.0.0.1", () => resolve(server.address().port))
)
const url = `http://localhost:${port}/${tokensOnly ? "?tokens=1" : ""}`
log(`serving ${DIR} on ${url}`)
log(`launching ${CHROME}`)

const chrome = spawn(
  CHROME,
  [
    `--user-data-dir=${PROFILE}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--enable-unsafe-webgpu",
    url,
  ],
  { stdio: ["ignore", "ignore", "pipe"] }
)
chrome.stderr.on("data", (data) => process.stderr.write(`[chrome] ${data}`))

const result = await Promise.race([
  reported,
  new Promise((resolve) =>
    setTimeout(
      () => resolve({ type: "error", error: "runner timed out after 30 min" }),
      30 * 60 * 1000
    )
  ),
])

chrome.kill("SIGTERM")
server.close()

if (result.type === "error") {
  log(`FAILED: ${result.error}`)
  process.exit(1)
}

const { environment, report } = result
const byName = Object.fromEntries(
  report.results.map((shape) => [shape.name, shape])
)
const target = byName["b40x512"]

log("")
log(`model        ${report.model}`)
log(
  `gpu          ${JSON.stringify(environment.adapter)} (${environment.userAgent.match(/Chrome\/[\d.]+/)?.[0]})`
)
log(`specials     ${JSON.stringify(report.specials)}`)
if (report.wrapped) {
  log(
    `naive        ${JSON.stringify(report.wrapped)}  <- what encode(token)[0] gave`
  )
}
log(
  `load         tokenizer ${report.load.tokenizerMs} ms + model ${report.load.modelMs} ms = ${report.load.totalMs} ms ` +
    `(${report.load.fetched.length} files fetched)`
)
for (const shape of report.results) {
  log(
    `forward      ${shape.name.padEnd(13)} [${shape.batch}, ${shape.tokens}] n_opt=${shape.optionSlots}  ` +
      `first ${shape.firstMs} ms  median ${shape.medianMs} ms  min ${shape.minMs} ms  ` +
      `runs ${JSON.stringify(shape.runs)}  finite ${shape.finite}`
  )
}
if (!target) {
  log("")
  log(
    "TOKENIZER ONLY — nothing timed; the ids above are what the harness resolves."
  )
} else {
  log("")
  log(
    `DECISION     batched-40 median at the 512-token context: ${target.medianMs} ms ` +
      `vs budget ${BUDGET_MS} ms → ${target.medianMs <= BUDGET_MS ? "LAYA PROPER" : "MODERNBERT PIVOT"}`
  )
  log(
    `             (b40 at kevala's natural state length: ${byName["b40xnatural"].medianMs} ms)`
  )
}
log(`             wrote ${REPORT}`)

// Chrome's stdio pipes keep this process alive; the run is over.
chrome.kill("SIGKILL")
server.close()
process.exit(0)
