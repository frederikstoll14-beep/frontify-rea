import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { z } from 'zod'
import type { Ctx } from './context'
import { describeError } from './errors'
import { toErrorResult, toResult, type ToolOutput } from './result'

export type ToolKind = 'read' | 'write' | 'destructive'

export interface ToolDef<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string
  title: string
  description: string
  input: S
  kind: ToolKind
  /** Mehrfach ausführen verändert nichts zusätzlich (z. B. Werte setzen). */
  idempotent?: boolean
  run: (args: z.infer<z.ZodObject<S>>, ctx: Ctx) => Promise<ToolOutput>
}

export function defineTool<S extends z.ZodRawShape>(def: ToolDef<S>): ToolDef {
  return def as unknown as ToolDef
}

export function registerTools(server: McpServer, ctx: Ctx, tools: ToolDef[]): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: {
          title: tool.title,
          readOnlyHint: tool.kind === 'read',
          destructiveHint: tool.kind === 'destructive',
          idempotentHint: tool.kind === 'read' ? true : (tool.idempotent ?? false),
          openWorldHint: false,
        },
      },
      (async (args: never) => {
        try {
          return toResult(await tool.run(args, ctx))
        } catch (error) {
          return toErrorResult(describeError(error))
        }
      }) as never,
    )
  }
}
