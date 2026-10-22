import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SERVER_NAME, SERVER_VERSION } from './config'
import type { Ctx } from './context'
import { SERVER_INSTRUCTIONS } from './instructions'
import { registerPrompts } from './prompts'
import { registerTools, type ToolDef } from './tool'
import { basicsTools } from './tools/basics'
import { brandTools } from './tools/brands'
import { collabTools } from './tools/collab'
import { guidelineTools } from './tools/guidelines'
import { libraryTools } from './tools/libraries'
import { memberTools } from './tools/members'
import { overviewTools } from './tools/overview'
import { workspaceTools } from './tools/workspaces'

export const ALL_TOOLS: ToolDef[] = [
  ...overviewTools,
  ...workspaceTools,
  ...brandTools,
  ...memberTools,
  ...guidelineTools,
  ...basicsTools,
  ...libraryTools,
  ...collabTools,
]

export function buildServer(ctx: Ctx): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, title: 'Brandbench', version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS, capabilities: { tools: {}, prompts: {} } },
  )
  registerTools(server, ctx, ALL_TOOLS)
  registerPrompts(server)
  return server
}
