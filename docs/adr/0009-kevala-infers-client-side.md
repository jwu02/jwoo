# Keep kevala's inference client-side, WebGPU-only, and consent-gated

Status: accepted

kevala's judgment runs on the visitor's machine or not at all — there is no server inference path, because zero per-inference cost is the point of the autopilot (locked on the map). WebGPU is its only execution provider: every runtime ships a WASM fallback and kevala ships none, because per-piece scoring serialized over WASM takes tens of seconds. The ready screen's dim `NEEDS WEBGPU` state (ADR 0008) is the honest fallback, not a slow path.

The ML runtime never enters a route's eager module graph, and it enters the tetris implementation's chunk only after consent. The ADR-0001 pattern — adapter, lazily loaded implementation, gate outside the lazy half — extends one layer down: a dynamic import fired by the consent screen's Enter loads the worker, the runtime and the vendored laya encoding, and they run in a module Web Worker so a multi-second batched forward never stalls the Ticker that drives the cabinet. The same eager-graph test that guards three and pixi also refuses the ML packages (`@huggingface/transformers`, `onnxruntime-web`).

The download budget the map first set (≤ ~250 MB) is superseded by measurement: no Laya artifact exists under ~650 MB — INT8 collapses the model's calibration and no int4 conversion exists — so the price of the product, calibrated probabilities, is a ~0.85 GB fp16 artifact fetched once from Hugging Face and kept in Cache Storage. The visitor is told the true size before consenting, not after: the consent screen reads the artifact's name and size from the Checkpoint being offered. Whether Laya proper or a ~140 MB pivot encoder ships is a pre-committed rule fired by evidence — the eval's quality bar and a measured batched-40 forward on real hardware — not by preference; the shape above holds for either, which is why it is recorded before the evidence lands.

## Considered options

**Server-side Laya** (`@receptron/laya`, ~140 ms/call warm). Rejected: it breaks the locked client-side-only constraint, puts a per-inference cost behind the demo, and needs a game backend the site deliberately does not have.

**laya-ts with its `predictBatch`** collation for free. Rejected: it targets its own split encoder/head export (~1.3 GB fp32) rather than the measured onnx-community artifact, and ships only as a GitHub dependency.

**Raw onnxruntime-web** without transformers.js. Rejected: it rebuilds tokenizer handling and Cache API caching the library already provides, for control nothing here uses.

**A WASM fallback** for non-WebGPU visitors. Rejected (with ADR 0008): it converts a broken experience into a slow one; the dim ready-screen state is the fallback.

**Pre-warming the runtime when the ready screen shows kevala.** Rejected: it pays the import cost before consent; the LOADING beat covers a cached session's hydration instead.

## Consequences

- The eager-graph test walks every route entry asserting no ML runtime is reachable; when it fails, the fix is to move the import below the consent boundary — never to relax the test.
- Inference lives in a stateless module worker behind the async `judge()` seam: the main thread posts an Observation and Placements and reads back an index and a Margin, and the autopilot's validation (#47) never learns a worker exists.
- The model session is warm while kevala is enabled and disposed on hand-off or app exit; the weights persist in Cache Storage keyed to the Checkpoint.
- The Checkpoint is a pinned revision in a repo constant — repo, path, sha, byte size, display name — and the consent record, the disclosure values and the cache key all read it. Bumping it re-offers on the ready screen and evicts the old weights. Weights fetch from `huggingface.co/resolve/` at the pinned sha; no mirror until a visitor needs one.
- kevala is offered wherever `navigator.gpu` exists, desktop or not; the consent disclosure is the size gate.
- If the pivot encoder fires, the shape is unchanged — same worker, same gate, same pinning; only the judge's internals change and the vendored encoding disappears.
