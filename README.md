# Homunculi chatbots

One page that lists every Homunculi and Haishool chatbot with a link to its chat; each chat opens in its own window.

- `index.html`: the page (no build step, no external files). It holds a fallback list of the bots.
- `endpoint.json`: the live list (`bots`: `id`, `name`, `tag`, `desc`, `url`). The page renders it when it loads. An empty `url` shows "Soon".

Quick-tunnel addresses change when a tunnel restarts: update the `url` in `endpoint.json` (and the fallback in `index.html`), commit, push. `chat_url`, `old_url`, `new_url` are kept for older tools that read them.

## Haishool v5 / Atoms

The Atoms placeholder now links to the live 8x512 selected v5 checkpoint through its own HTTPS quick tunnel. `v5_url` is also available in `endpoint.json`. The existing Classic/A/v4b URLs are preserved. This tunnel runs on the Berlin PC and its address must be updated if it restarts.

V5 ran the unchanged public easy-v1 question set once on 1 October 2026. Only the chat's model answer was graded, never the separate rule correction. Raw responses, automatic grades and reviewed changes are in `benchmark-v5.json`; the benchmark page includes all five chat interfaces. The 16/40 score measures the current English router plus model, not the separate sealed science evaluation. Research scores on the landing page refer to the selected checkpoint, not a later production refinement.
