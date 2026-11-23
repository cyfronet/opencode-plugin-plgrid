# opencode-plugin-plgrid

An OpenCode V2 plugin that registers the PLGrid Forge (Cyfronet) LLM gateway as
a provider and keeps its model list in sync with the gateway.

## What it does

On startup the plugin:

1. registers the integration `plgrid` (display name `PLGrid Forge (Cyfronet)`)
   with a key login method, so `opencode auth login plgrid` works;
2. resolves an API key, first from `PLGRID_API_KEY`, then from the credential
   stored for that integration;
3. fetches `<apiBase>/models/opencode-config` once per setup;
4. registers the provider `plgrid` (package
   `@opencode/ai/providers/openai-compatible`, `settings.baseURL` = the same
   `apiBase`) with every model found in the response's
   `providers.plgrid.models` map.

Model metadata comes from the gateway: `capabilities.tools`, `capabilities.input`,
`capabilities.output`, `limit.context`, `limit.output`, `type`, `name` and
`compatibility`. Anything the response omits falls back to OpenCode's own defaults
(`tools: true`, `input: ["text"]`, `output: ["text"]`, context 200000,
output 32000). The response's `name`, `package` and `settings.baseURL` are ignored
on purpose, so a single environment variable points both the model listing and
inference at the same gateway.

## Requirements

- OpenCode v2 (verified against v2.1.2). The plugin uses the V2 `setup` hook and
  does not implement the 1.x `config`/`auth` hooks.
- A PLGrid/LLMLab API key (llmlab.plgrid.pl -> Grants -> Generate API key).
- Node.js >= 18 (the plugin uses `fetch` and `AbortSignal.timeout`).

## Install

### From git, through the CLI

```bash
opencode plugin add https://github.com/cyfronet/opencode-plugin-plgrid.git
```

This installs the package and appends the git spec to the `plugins` array of the
global OpenCode config.

### From git, by editing the config

Add the git spec to the `plugins` array in `opencode.json` (or `opencode.jsonc`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["https://github.com/cyfronet/opencode-plugin-plgrid.git"]
}
```

### From a local clone

```bash
git clone https://github.com/cyfronet/opencode-plugin-plgrid.git
```

Then point the config at the directory that contains `index.js`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/opencode-plugin-plgrid"]
}
```

## First run

```bash
opencode auth login plgrid
```

Paste the API key when prompted, then restart OpenCode
```bash
opencode service restart
```

so the plugin sets up with
the stored credential. `opencode models` should then list `plgrid/...` entries.

## Usage

After installing and running `opencode auth login plgrid`, restart OpenCode so the
plugin sets up.

List models with `opencode models` (or `/models` in the TUI); they appear under the
`PLGrid Forge (Cyfronet)` provider as `plgrid/<model-id>`.

Select one for a session: `/models` in the TUI, or from the shell:

```bash
opencode run -m plgrid/<model-id> "your prompt"
```

The plugin re-reads the model catalog from the gateway at each startup, so new models show up without reinstalling.

## Non-goals
- v2 only. OpenCode 1.x is not supported by this package.

