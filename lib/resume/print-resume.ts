// Print the resume from a hidden iframe instead of the live document.
//
// Raising the print dialog for the live document makes browsers apply the
// site's @media print rules (globals.css) to the visible page while the
// dialog is open — the dark site flashes to the light print theme. Printing
// an iframe keeps those styles confined to the cloned document; the parent
// page is never restyled and the printed output is unchanged.

// If the browser never fires `afterprint`, drop the iframe anyway.
const CLEANUP_FALLBACK_MS = 60_000

export function printResume(sourceDocument: Document = window.document): void {
  const iframe = sourceDocument.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.setAttribute("title", "Print resume")
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  } as Partial<CSSStyleDeclaration>)
  sourceDocument.body.appendChild(iframe)

  // Clone the whole document (stylesheets, @page rules, fonts) so the printed
  // output is identical to printing the page directly. Scripts are stripped:
  // re-running the app bundle in the iframe would only error.
  const clone = sourceDocument.documentElement.cloneNode(true) as HTMLElement
  clone.querySelectorAll("script").forEach((script) => script.remove())

  const doc = iframe.contentDocument
  if (!doc) return
  doc.open()
  doc.write(`<!DOCTYPE html>${clone.outerHTML}`)
  doc.close()

  const win = iframe.contentWindow
  if (!win) return
  const cleanup = () => iframe.remove()
  win.addEventListener("afterprint", cleanup, { once: true })
  sourceDocument.defaultView?.setTimeout(cleanup, CLEANUP_FALLBACK_MS)

  // Wait for the cloned document to load and its fonts to be ready so the
  // sheet is laid out with its real styles before printing.
  const loaded =
    doc.readyState === "complete"
      ? Promise.resolve()
      : new Promise<void>((resolve) => iframe.addEventListener("load", () => resolve(), { once: true }))
  const fontsReady = (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve()
  void Promise.all([loaded, fontsReady]).then(() => win.print())
}
