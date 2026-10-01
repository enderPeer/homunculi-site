# Homunculi chatbots

One page that lists every Homunculi and Haishool chatbot with a link to its chat; each chat opens in its own window.

- `index.html`: the page (no build step, no external files). It holds a fallback list of the bots.
- `endpoint.json`: the live list (`bots`: `id`, `name`, `tag`, `desc`, `url`). The page renders it when it loads. An empty `url` shows "Soon".

Quick-tunnel addresses change when a tunnel restarts: update the `url` in `endpoint.json` (and the fallback in `index.html`), commit, push. `chat_url`, `old_url`, `new_url` are kept for older tools that read them.
