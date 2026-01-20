import { Command } from 'commander';
import pc from 'picocolors';
import { startMcpServer } from '../mcp/server.js';

export default function mcpCmd() {
  return new Command('mcp')
    .description('Start the Appshot Model Context Protocol (MCP) server')
    .option('--stdio', 'Use stdio transport (default)', true)
    .action(async () => {
      console.error(pc.dim('Starting Appshot MCP server on stdio transport...'));
      try {
        await startMcpServer();
      } catch (error) {
        console.error(pc.red('MCP server failed:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
