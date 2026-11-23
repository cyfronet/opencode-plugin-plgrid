const PROVIDER_ID = "plgrid"
const PROVIDER_NAME = "PLGrid Forge (Cyfronet)"
const PROVIDER_PACKAGE = "@opencode/ai/providers/openai-compatible"
const DEFAULT_API_BASE_URL = "https://llmlab.plgrid.pl/api/v1"
const FETCH_TIMEOUT_MS = 10000
const CONFIG_PATH = "models/opencode-config"
const KEY_LABEL = "API key"
const DEFAULT_CAPABILITIES = { tools: true, input: ["text"], output: ["text"] }
const DEFAULT_LIMIT = { context: 200000, output: 32000 }

const resolveApiBaseUrl = () => {
  const configured = process.env.PLGRID_API_BASE_URL || DEFAULT_API_BASE_URL
  return configured.replace(/\/+$/, "")
}

const resolveApiKey = async (ctx) => {
  if (process.env.PLGRID_API_KEY) return process.env.PLGRID_API_KEY
  const connection = await ctx.integration.connection.active(PROVIDER_ID)
  if (!connection) return undefined
  const credential = await ctx.integration.connection.resolve(connection)
  if (credential?.type !== "key") return undefined
  return credential.key
}

const buildModel = (providerID, id, entry) => {
  const capabilities = entry?.capabilities ?? {}
  const limit = entry?.limit ?? {}
  const info = {
    id,
    modelID: id,
    providerID,
    name: typeof entry?.name === "string" ? entry.name : id,
    capabilities: {
      tools: typeof capabilities.tools === "boolean" ? capabilities.tools : DEFAULT_CAPABILITIES.tools,
      input: Array.isArray(capabilities.input) ? capabilities.input : DEFAULT_CAPABILITIES.input,
      output: Array.isArray(capabilities.output) ? capabilities.output : DEFAULT_CAPABILITIES.output,
    },
    variants: [],
    time: { released: 0 },
    cost: [],
    status: "active",
    enabled: true,
    limit: {
      context: Number.isFinite(limit.context) ? limit.context : DEFAULT_LIMIT.context,
      output: Number.isFinite(limit.output) ? limit.output : DEFAULT_LIMIT.output,
    },
  }
  if (typeof entry?.type === "string") info.type = entry.type
  if (entry?.compatibility && typeof entry.compatibility === "object") info.compatibility = entry.compatibility
  if (capabilities.reasoning && typeof capabilities.reasoning === "object") info.capabilities.reasoning = capabilities.reasoning
  return info
}

const buildModels = (providerID, body) => {
  const entries = body?.providers?.[providerID]?.models
  if (!entries || typeof entries !== "object") return []
  return Object.entries(entries).map(([id, entry]) => buildModel(providerID, id, entry))
}

const registerIntegration = async (ctx) => {
  await ctx.integration.transform((editor) => {
    editor.update(PROVIDER_ID, (integration) => {
      integration.name = PROVIDER_NAME
    })
    editor.method.update({
      integrationID: PROVIDER_ID,
      method: { type: "key", label: KEY_LABEL },
    })
  })
}

const registerProvider = async (ctx, baseURL, models) => {
  await ctx.provider.transform((editor) => {
    editor.add({
      info: {
        id: PROVIDER_ID,
        name: PROVIDER_NAME,
        activation: "enabled",
        package: PROVIDER_PACKAGE,
        integrationID: PROVIDER_ID,
        settings: { baseURL },
      },
      models,
    })
  })
}

const setup = async (ctx) => {
  await registerIntegration(ctx)

  const baseURL = resolveApiBaseUrl()
  const apiKey = await resolveApiKey(ctx)
  if (!apiKey) {
    console.error("[plgrid] no API key found; run `opencode auth login plgrid`")
    return
  }

  const url = `${baseURL}/${CONFIG_PATH}`
  let body
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      console.error(`[plgrid] could not fetch ${url}: HTTP ${response.status}`)
      return
    }
    body = await response.json()
  } catch (error) {
    console.error(`[plgrid] could not fetch ${url}: ${error instanceof Error ? error.message : String(error)}`)
    return
  }

  const models = buildModels(PROVIDER_ID, body)
  if (models.length === 0) {
    console.error(`[plgrid] no models returned by ${url}`)
    return
  }

  await registerProvider(ctx, baseURL, models)
}

export default { id: PROVIDER_ID, setup }
