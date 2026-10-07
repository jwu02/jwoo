// Runner for the kevala pivot spike (jwu02/jwoo#55).
//
// Serves this directory, opens Chrome on the harness page with a persistent
// profile (so a second run's weights come from Cache Storage), waits for the
// report, writes report.json and prints the per-decision cost against the
// owner's <5 s bar.
//
//   node run.mjs                 # AutoModel control first
//   node run.mjs --pipeline      # pipeline first
//   ARGS=local node run.mjs --local  # read ./models instead of fetching
//
// CHROME=<path> overrides the browser binary.

import { spawn } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join } from "node:path"
import { Readable } from "node:stream"
import { fileURLToPath } from "node:url"

const DIR = fileURLToPath(new URL(".", import.meta.url))
const CHROME =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const PROFILE = "/tmp/kevala-pivot-chrome-profile"
const BUDGET_MS = 5000 // the owner's bar: a decision must land under 5 s
const REPORT = join(DIR, "report.json")

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
  // The artifact proxy. huggingface.co does not resolve on the machine this ran
  // on, and hf-mirror.com only sends `access-control-allow-origin:` for itself,
  // so the harness reads the mirror through here — same bytes at the same
  // revision, origin-allowed. The shipped runtime reads huggingface.co direct.
  if (request.url.startsWith("/hf/")) {
    const upstream = await fetch(`https://hf-mirror.com${request.url.slice(3)}`, {
      redirect: "follow",
    })
    const encoded = upstream.headers.get("content-encoding")
    response.statusCode = upstream.status
    upstream.headers.forEach((value, key) => {
      const name = key.toLowerCase()
      if (
        name === "content-encoding" ||
        name === "content-length" ||
        name === "transfer-encoding"
      )
        return
      response.setHeader(key, value)
    })
    response.setHeader("access-control-allow-origin", "*")
    if (!encoded) {
      const length = upstream.headers.get("content-length")
      if (length) response.setHeader("content-length", length)
    }
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(response)
    else response.end()
    return
  }

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
    if (path.startsWith("/node_modules/"))
      log(`  served ${path.slice(path.indexOf("dist"))} (${data.length} B)`)
    response.end(data)
  } catch {
    if (path.startsWith("/node_modules/")) log(`  MISSING ${path}`)
    response.statusCode = 404
    response.end("not found")
  }
})

const port = await new Promise((resolve) =>
  server.listen(0, "127.0.0.1", () => resolve(server.address().port))
)
const url =
  `http://localhost:${port}/?remote=${encodeURIComponent(`http://localhost:${port}/hf`)}` +
  (process.argv.includes("--local") ? "&local=1" : "") +
  (process.argv.includes("--pipeline") ? "&pipeline=1" : "") +
  (process.argv.find((arg) => arg.startsWith("--model="))
    ? `&model=${process.argv.find((arg) => arg.startsWith("--model=")).slice(8)}`
    : "")
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
      () => resolve({ type: "error", error: "runner timed out after 20 min" }),
      20 * 60 * 1000
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
const decision = report.results[0]

log("")
log(`model        ${report.model}`)
log(`ort          ${JSON.stringify(report.ort)}`)
log(
  `gpu          ${JSON.stringify(environment.adapter)} (${environment.userAgent.match(/Chrome\/[\d.]+/)?.[0]})`
)
log(`load         ${report.load.modelMs} ms (${report.load.fetched.length} files)`)
for (const attempt of report.attempts) {
  log(
    `opened       ${attempt.dtype} → ${attempt.ok ? `ok in ${attempt.ms} ms` : `FAILED in ${attempt.ms} ms: ${attempt.error}`}`
  )
}
if (!decision) {
  log("")
  log("VERDICT      nothing measured: no dtype opened")
  log(`             wrote ${REPORT}`)
  chrome.kill("SIGKILL")
  server.close()
  process.exit(1)
}
log(
  `decision     ${decision.batch} premise x ${decision.options} candidates  ` +
    `first ${decision.firstMs} ms  median ${decision.medianMs} ms  min ${decision.minMs} ms  ` +
    `runs ${JSON.stringify(decision.runs)}`
)
log(
  `smoke        finite ${decision.finite}  probabilities sum ${decision.probabilitySum.toFixed(3)}  ` +
    `top "${decision.top}" ${decision.topScore.toFixed(3)}`
)
log("")
log(
  `VERDICT      one decision ${decision.medianMs} ms vs bar ${BUDGET_MS} ms → ` +
    `${decision.medianMs <= BUDGET_MS ? "CLEARS" : "MISSES"}`
)
log(`             wrote ${REPORT}`)

// Chrome's stdio pipes keep this process alive; the run is over.
chrome.kill("SIGKILL")
server.close()
process.exit(0)
