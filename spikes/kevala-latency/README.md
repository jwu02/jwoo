# kevala latency spike

Throwaway harness for the kevala spec (jwu02/jwoo#53). It exists to fire one
pre-committed decision — Laya proper vs the ModernBERT pivot — and nothing in
the app imports it. Evidence: [`run-log.txt`](./run-log.txt) (the runner's
summary for the deciding run) and [`probe-tokens.json`](./probe-tokens.json).

## What it does

Loads `onnx-community/laya-ONNX` fp16 (`onnx/model_fp16.onnx` + `_data`,
846.7 MB) through transformers.js inside a module worker on WebGPU, then times
batched forwards whose token shapes mirror laya's own `build_sequence`
(reconstructed here, not vendored from `laya-family`): one sequence per
candidate placement, `[CLS] head [SEP] [MASK] option… [SEP] state [SEP]`,
padded to the batch's longest row and cut at the artifact's 512-token context.
Only the shapes matter for a latency measurement — the token values cost
nothing.

| shape         | batch × tokens | what it stands for                                                  |
| ------------- | -------------- | ------------------------------------------------------------------- |
| `b40x512`     | 40 × 512       | the decision rule's batch at the artifact's full context            |
| `b5x512`      | 5 × 512        | cross-check against the artifact's published 0.96 s/state benchmark |
| `b40xnatural` | 40 × 213       | 40 candidates at a natural (unfilled) board-dump length             |

The two extra shapes were not asked for; they exist to test whether the miss
depends on the encoding question #49 took with it. It does not.

## Run it

```sh
npm install             # @huggingface/transformers 3.8.1
node run.mjs            # serves this dir, opens Chrome, writes report.json
node run.mjs --tokens   # tokenizer only: writes probe-tokens.json, times nothing
```

Chrome needs WebGPU (any current Chrome on macOS/Windows). The first run
fetches 846.7 MB and takes about as long as your connection needs; the harness
picks a fresh port each run and Cache Storage is keyed by origin, so **every run
here was a cold fetch** — a returning kevala visitor's cached load is not
measured by this.

## Recorded — 2026-10-07, Apple M3 (10-core GPU, 16 GB), Chrome 154.0.0.0, WebGPU `metal-3`

**Load.** tokenizer 861 ms; model 437 019 ms (the 846.7 MB fetch at ~2 MB/s
dominates, session init is the remainder); 437 881 ms total, cold.

**Forward, warm median of 5.** Every forward finite, `logits` `[batch, 4]`.

| shape         | runs (ms)                                  | median        |
| ------------- | ------------------------------------------ | ------------- |
| `b40x512`     | 47 536 / 48 714 / 51 070 / 48 582 / 48 109 | **48 582 ms** |
| `b5x512`      | 5 509 / 5 585 / 5 531 / 5 547 / 5 978      | 5 547 ms      |
| `b40xnatural` | 16 041 / 16 556 / 16 552 / 15 821 / 16 755 | 16 552 ms     |

The first forward at `b40x512` (untimed, shader compilation) took 52 368 ms and
warm runs never fall below 47.5 s, so 48.6 s is real work, not warm-up.

**Second run** (the fixed harness, same machine, stopped on request during the
last shape) confirms it: `b40x512` 56 846 / 51 730 / 50 783 / 49 089 / 49 544 ms
→ median **50 783 ms**; `b5x512` 5 294 / 5 551 / 5 747 / 5 984 / 5 589 →
median 5 589 ms.

**Smoke check.** No NaN/Inf on any timed forward, with a real spread per row
(`b40x512` min 0.242, max 2.877). The head ran and returned a distribution;
nothing here reads its quality (#49 was dropped).

## Fired decision

Rule (#50): batched-40 median ≤ ~4 s → Laya proper, miss → the pivot.

`b40x512` median **48 582 ms** — 12× over budget, confirmed at 50 783 ms on the
re-run. Even 40 candidates at a natural 213-token state cost 16 552 ms, 4×
over. **The ModernBERT pivot (~140 MB) ships**; the vendored laya encoding and
the batch collation die with it. Recorded on the spec:
[jwu02/jwoo#51](https://github.com/jwu02/jwoo/issues/51#issuecomment-6032520929).

The `b5x512` cross-check says why: ~1.1 s per 512-token sequence (the artifact's
own benchmark reports 0.96 s/state on an M3 Pro), and batching to 40 amortizes
almost nothing — 8× the batch for 8.8× the time. #45's "≈1.5–4 s batched"
extrapolation assumed the GPU would amortize; it is compute-bound, so 40
candidates cost ~40 sequence-forwards.

**The owner's bar is now tighter than the rule's:** a decision must land in
under 5 s. 48.6 s fails it by 10×, and the pivot has not been measured against
it — the next ticket must measure the pivot's own per-decision cost before
assuming it clears 5 s.

## Caveats

- The deciding run's marker slots were filled with the naive `encode(token)[0]`
  id, which the ModernBERT tokenizer wraps in `[CLS]` — so all four specials
  collapsed to 50 281. Shapes, positions and batch sizes were unaffected, so
  the timings stand; the fix (`add_special_tokens: false`, with an invariant
  that now throws on collapse) is verified by `probe-tokens.json`:
  `cls 50281, sep 50282, pad 50283, mask 50284`, against
  `{cls: 50281, sep: 50281, mask: 50281, pad: 50281}` for the naive read.
- That early probe overwrote the deciding run's raw `report.json`, which is why
  the numbers above are the runner's own summary (`run-log.txt`) rather than
  the JSON.
