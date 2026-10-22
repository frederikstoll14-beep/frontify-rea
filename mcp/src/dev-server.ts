import { createServer } from 'node:http'
import { createHandler } from './http'
import { toNodeListener } from './node'

// Lokaler MCP-Server: npm run mcp:dev   (liest SUPABASE_URL / SUPABASE_ANON_KEY aus der Umgebung)
const port = Number(process.env.PORT ?? 8787)
createServer(toNodeListener(createHandler())).listen(port, () => {
  console.log(`Brandbench MCP läuft auf http://127.0.0.1:${port}/mcp`)
})
