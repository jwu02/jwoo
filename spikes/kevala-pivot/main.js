// Driver for the kevala latency spike (jwu02/jwoo#53). Runs in Chrome, posts
// progress and one final report back to the local server in run.mjs.

const status = document.getElementById("status")

const send = (path, body) =>
  fetch(path, { method: "POST", body: JSON.stringify(body) })

async function environment() {
  const gpu = navigator.gpu
  let adapter = null
  if (gpu) {
    const acquired = await gpu.requestAdapter()
    const info = acquired?.info
    adapter = info
      ? {
          vendor: info.vendor,
          architecture: info.architecture,
          device: info.device,
          description: info.description,
        }
      : acquired
        ? {}
        : null
  }
  return {
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory ?? null,
    webgpu: Boolean(gpu),
    adapter,
  }
}

async function report(payload) {
  status.textContent = payload.type
  await send("/report", payload)
}

// Probe first: a missing WebGPU is not worth an 0.85 GB download.
const environmentNow = await environment()
send(
  "/progress",
  `webgpu=${environmentNow.webgpu} adapter=${JSON.stringify(environmentNow.adapter)} ${environmentNow.userAgent}`
).catch(() => {})

if (!environmentNow.webgpu) {
  await report({ type: "error", error: "navigator.gpu missing" })
} else {
  const worker = new Worker(`./worker.js${location.search}`, {
    type: "module",
  })

  worker.onmessage = async (event) => {
    const message = event.data
    if (message.type === "progress") {
      status.textContent = message.line
      send("/progress", message.line).catch(() => {})
      return
    }
    if (message.type === "done") {
      await report({
        type: "done",
        environment: environmentNow,
        report: message.report,
      })
      return
    }
    await report({ type: "error", error: message.error })
  }

  worker.onerror = (event) => {
    report({
      type: "error",
      error: `${event.message} @ ${event.filename}:${event.lineno}`,
    })
  }

  window.addEventListener("unhandledrejection", (event) => {
    report({
      type: "error",
      error: String(event.reason?.stack ?? event.reason),
    })
  })

  // Nothing should take anywhere near this long; the server waits regardless.
  setTimeout(
    () => report({ type: "error", error: "harness timed out" }),
    25 * 60 * 1000
  )
}
