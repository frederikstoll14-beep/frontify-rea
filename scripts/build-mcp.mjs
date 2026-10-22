// Bündelt den MCP-Server zu einer einzigen Datei für Vercel (api/mcp.js).
// Hintergrund: Vercel baut Funktionen aus dem Git-Stand. Ein fertiges Bündel braucht keine
// zusätzlichen Build-Schritte und hat keine Abhängigkeit von Import-Endungen oder Pfad-Aliassen.
import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const outfile = `${root}api/mcp.js`
mkdirSync(`${root}api`, { recursive: true })

await build({
  entryPoints: [`${root}mcp/entry-vercel.ts`],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // sharp bringt native Dateien mit und wird zur Laufzeit nachgeladen (optional).
  external: ['sharp'],
  alias: { '@': `${root}src` },
  banner: {
    js: [
      '// GENERIERT von scripts/build-mcp.mjs – nicht von Hand ändern (npm run build:mcp).',
      "import { createRequire as __createRequire } from 'node:module';",
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
  legalComments: 'none',
  minify: false,
  sourcemap: false,
  logLevel: 'info',
})

const size = readFileSync(outfile).length
console.log(`api/mcp.js: ${(size / 1024 / 1024).toFixed(2)} MB`)
