# Homunculi

A responsive, dependency-free landing page for the Homunculi research model. The page introduces the original model, next candidate, and Ultra mode, and displays a published comparison of pilot and extended training runs.

## Files

- `index.html`: accessible page structure and honest pending states.
- `styles.css`: responsive cream/forest design, editorial typography, and reduced-motion support.
- `site.js`: safe endpoint discovery and optional training-report rendering. Report text uses `textContent`; remote HTML is never inserted.
- `endpoint.json`: current chat addresses, updated when tunnel addresses change.
- `training-status.example.json`: expected report schema. Publish verified run data as `training-status.json` to show progress.

No build step or external fonts are required. Serve this directory over HTTP for the JSON files to load. Local preview: `python -m http.server 8766`, then open `http://localhost:8766/`.

## Chat addresses

Existing `chat_url` and `ultra_url` fields remain supported. Optional fields:

```json
{
  "chat_url": "https://your-gateway.example/",
  "old_url": "https://your-gateway.example/chat?model=old",
  "new_url": "https://your-gateway.example/chat?model=new",
  "ultra_url": "https://your-gateway.example/ultra",
  "repository_url": "https://github.com/enderPeer/homunculi",
  "training_status_url": "https://your-gateway.example/api/training",
  "model_status_url": "https://your-gateway.example/api/models"
}
```

Original falls back to `chat_url` if `old_url` is absent. Next remains disabled until a valid `new_url` is published; a configured candidate link can open the gateway's pending screen. The hero action uses `chat_url`, which may open a gateway with a model selector. URLs must use HTTP or HTTPS. A configured endpoint is not a live health check. When provided, `model_status_url` supplies current readiness from `modes: [{ id: "old" | "new" | "ultra", status: "ready" | "pending" | "offline" }]`; otherwise the page keeps neutral endpoint/preview labels.

## Publishing training results

When `training_status_url` is configured in `endpoint.json`, the page first fetches that report (the server must allow this site's origin via CORS). The optional static `training-status.json` is the fallback. Reports are fetched without cache each time the page opens. A missing report leaves the comparison pending. Publish only measured results; the example is a plan, not evidence a run has started. ISO dates are always displayed in UTC.

The status schema uses `updatedAt`, `status`, optional `summary`, `pilot`, `overnight`, and `comparison`. The pilot can also have `trainCharacters`. Comparisons use shared evaluation sources with `name`, `pilotBpc`, `overnightBpc`, optional `deltaBpc`, and optional `ci95: [lower, upper]`. Only finite measured pairs are rendered. A negative delta means lower bits per character for the extended run. The longer run continues from the pilot with a larger corpus; this comparison does not isolate the effects of added data and added training.

Keep training logs, private corpus contents, credentials, and local filesystem paths out of the public JSON files.
