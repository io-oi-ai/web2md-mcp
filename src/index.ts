#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createConnection } from 'node:net'
import { fetchViaExtension, resolveExtensionId, closeBridgeServer } from './bridge-client.js'

const API_BASE = process.env.WEB2MD_API_URL || 'https://web2md.org/api'
const API_KEY = process.env.WEB2MD_API_KEY || ''

if (!API_KEY) {
  console.error('Warning: WEB2MD_API_KEY not set. Server will start but tool calls will fail without a valid key.')
}

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
}

const server = new McpServer({
  name: 'web2md',
  version: '0.8.0',
})

server.tool(
  'convert_url',
  'Convert a webpage URL to clean Markdown. Returns the Markdown content and metadata (title, word count, reading time).',
  {
    url: z.string().url().describe('The URL of the webpage to convert'),
    includeImages: z.boolean().optional().describe('Include image references (default: true)'),
    includeLinks: z.boolean().optional().describe('Include hyperlinks (default: true)'),
  },
  async ({ url, includeImages, includeLinks }) => {
    const resp = await fetch(`${API_BASE}/v1/convert`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        url,
        options: { includeImages: includeImages ?? true, includeLinks: includeLinks ?? true },
      }),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }))
      return { content: [{ type: 'text' as const, text: `Error: ${err.error || resp.statusText}` }] }
    }

    const data = await resp.json()
    const md = data.data.markdown
    const meta = data.data.metadata

    return {
      content: [
        {
          type: 'text' as const,
          text: `# ${meta.title}\n\n**Source:** ${meta.url}\n**Words:** ${meta.wordCount} | **Reading time:** ${meta.readingTime} min\n\n---\n\n${md}`,
        },
      ],
    }
  }
)

server.tool(
  'semantic_search',
  'Search your saved conversions using natural language. Works across languages.',
  {
    query: z.string().describe('Natural language search query'),
    limit: z.number().optional().describe('Max results (default: 5)'),
  },
  async ({ query, limit }) => {
    const params = new URLSearchParams({ q: query, limit: String(limit || 5) })
    const resp = await fetch(`${API_BASE}/search?${params}`, { headers: authHeaders })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }))
      return { content: [{ type: 'text' as const, text: `Error: ${err.error || resp.statusText}` }] }
    }

    const data = await resp.json()
    if (!data.results || data.results.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No results found.' }] }
    }

    const text = data.results
      .map((r: any, i: number) => `${i + 1}. **${r.title}** (${r.url})\n   ${r.summary || ''}`)
      .join('\n\n')

    return { content: [{ type: 'text' as const, text }] }
  }
)

server.tool(
  'get_conversion',
  'Retrieve the full Markdown content of a previously saved conversion by its ID.',
  {
    id: z.string().describe('The conversion ID'),
  },
  async ({ id }) => {
    const resp = await fetch(`${API_BASE}/history/${id}`, { headers: authHeaders })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }))
      return { content: [{ type: 'text' as const, text: `Error: ${err.error || resp.statusText}` }] }
    }

    const data = await resp.json()
    return {
      content: [
        {
          type: 'text' as const,
          text: `# ${data.title}\n\n**URL:** ${data.url}\n\n---\n\n${data.markdown}`,
        },
      ],
    }
  }
)

server.tool(
  'bridge_convert_url',
  'Convert a URL using your Chrome extension — required for Reddit, JS-rendered sites, or login-protected pages. The Web2MD extension must be installed and running in Chrome. Auto-discovers your extension ID via your API key.',
  {
    url: z.string().url().describe('The URL to convert (Reddit, paywalled, JS-rendered, etc.)'),
    extensionId: z.string().optional().describe('Override extension ID (auto-discovered if omitted)'),
  },
  async ({ url, extensionId: overrideId }) => {
    try {
      const eid = overrideId || await resolveExtensionId(API_BASE, API_KEY)
      const { html } = await fetchViaExtension(url, eid)

      // Convert HTML → Markdown via the API (reuse server-side converter)
      const resp = await fetch(`${API_BASE}/v1/convert`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ html, url, options: { includeImages: true, includeLinks: true } }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }))
        return { content: [{ type: 'text' as const, text: `Conversion failed: ${err.error || resp.statusText}` }] }
      }

      const data = await resp.json()
      const md = data.data.markdown
      const meta = data.data.metadata

      return {
        content: [
          {
            type: 'text' as const,
            text: `# ${meta.title}\n\n**Source:** ${meta.url}\n**Words:** ${meta.wordCount} | **Reading time:** ${meta.readingTime} min\n\n---\n\n${md}`,
          },
        ],
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: [{ type: 'text' as const, text: `Bridge error: ${msg}` }] }
    } finally {
      closeBridgeServer()
    }
  }
)

// ── Agent Bridge via Native Messaging ────────────────────────

const AGENT_TCP_PORT = 12315
const AGENT_TIMEOUT = 30000

interface AgentResponse {
  id: string
  type: string
  url?: string
  title?: string
  markdown?: string
  error?: string
  index?: number
  total?: number
}

function agentRequest(msg: { id: string; type: string; [k: string]: unknown }): Promise<AgentResponse[]> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ port: AGENT_TCP_PORT, host: '127.0.0.1' })
    const results: AgentResponse[] = []
    let lineBuf = ''
    let done = false

    const urls = Array.isArray(msg.urls) ? msg.urls as string[] : []
    const timeout = setTimeout(() => {
      if (!done) {
        done = true
        socket.destroy()
        reject(new Error('Agent request timed out'))
      }
    }, AGENT_TIMEOUT * Math.max(urls.length, 1))

    socket.on('connect', () => {
      socket.write(JSON.stringify(msg) + '\n')
    })

    socket.on('data', (chunk) => {
      lineBuf += chunk.toString()
      let nl: number
      while ((nl = lineBuf.indexOf('\n')) !== -1) {
        const line = lineBuf.slice(0, nl).trim()
        lineBuf = lineBuf.slice(nl + 1)
        if (!line) continue
        try {
          const resp = JSON.parse(line) as AgentResponse
          results.push(resp)
          if (resp.type === 'convert_result' || resp.type === 'error' || resp.type === 'pong' || resp.type === 'batch_complete') {
            done = true
            clearTimeout(timeout)
            socket.end()
            resolve(results)
          }
        } catch { /* skip */ }
      }
    })

    socket.on('error', (err) => {
      if (!done) {
        done = true
        clearTimeout(timeout)
        reject(new Error(`Agent connection error: ${err.message}. Ensure Chrome is open with Web2MD extension and native host installed.`))
      }
    })

    socket.on('close', () => {
      if (!done) {
        done = true
        clearTimeout(timeout)
        resolve(results)
      }
    })
  })
}

server.tool(
  'agent_convert',
  'Convert a URL using the Chrome extension via native messaging. Best for Reddit, login-protected pages, and JS-rendered sites. Requires: Chrome running + Web2MD extension + native host installed.',
  {
    url: z.string().url().describe('The URL to convert'),
  },
  async ({ url }) => {
    try {
      const id = `mcp_${Date.now()}`
      const results = await agentRequest({ id, type: 'agent_convert', url })
      const result = results.find(r => r.type === 'convert_result')
      const error = results.find(r => r.type === 'error')

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.error}` }] }
      }
      if (result?.markdown) {
        return {
          content: [{
            type: 'text' as const,
            text: `# ${result.title || 'Untitled'}\n\n**Source:** ${url}\n\n---\n\n${result.markdown}`,
          }],
        }
      }
      return { content: [{ type: 'text' as const, text: 'No result returned from extension' }] }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Agent error: ${err instanceof Error ? err.message : String(err)}` }] }
    }
  }
)

server.tool(
  'agent_batch_convert',
  'Batch convert multiple URLs using the Chrome extension via native messaging. Ideal for converting many Reddit threads or JS-rendered pages. URLs are processed sequentially. Requires: Chrome running + Web2MD extension + native host installed.',
  {
    urls: z.array(z.string().url()).min(1).max(50).describe('Array of URLs to convert (max 50)'),
  },
  async ({ urls }) => {
    try {
      const id = `mcp_batch_${Date.now()}`
      const results = await agentRequest({ id, type: 'agent_batch_convert', urls })

      const items = results.filter(r => r.type === 'batch_item_result')
      const parts: string[] = []

      for (const item of items) {
        if (item.error) {
          parts.push(`## Error: ${item.url}\n\nError: ${item.error}\n`)
        } else {
          parts.push(`## ${item.title || item.url}\n\n**Source:** ${item.url}\n\n---\n\n${item.markdown}\n`)
        }
      }

      const summary = `Converted ${items.filter(i => !i.error).length}/${urls.length} URLs successfully.\n\n`
      return { content: [{ type: 'text' as const, text: summary + parts.join('\n---\n\n') }] }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Agent error: ${err instanceof Error ? err.message : String(err)}` }] }
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
