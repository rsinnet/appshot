import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';
import { APP_VERSION } from '../version.js';
import { detectLanguagesFromCaptions } from '../utils/language.js';
import { filenameToCaption } from '../utils/filename-caption.js';
import {
  createBuildArgs,
  createFrameArgs,
  createExportArgs,
  createInitArgs,
  createSpecsArgs,
  createValidateArgs,
  createCleanArgs,
  createLocalizeArgs,
  createPresetsArgs,
  createFontsArgs,
  createTemplateArgs,
  createQuickstartArgs,
  type BuildToolArgs,
  type FrameToolArgs,
  type ExportToolArgs,
  type InitToolArgs,
  type SpecsToolArgs,
  type ValidateToolArgs,
  type CleanToolArgs,
  type LocalizeToolArgs,
  type PresetsToolArgs,
  type FontsToolArgs,
  type TemplateToolArgs,
  type QuickstartToolArgs
} from './cli-options.js';
import {
  gradientPresets,
  getGradientPreset,
  getGradientsByCategory
} from '../core/gradient-presets.js';

type CliRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  command: string;
};

// Resolve CLI entry point - handles both dist (cli.js) and dev (cli.ts via tsx) builds
function resolveCliEntry(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const dir = path.dirname(currentFile);

  // Check if we're in src/ (dev) or dist/ (prod) - cross-platform
  const pathParts = dir.split(path.sep);
  const isDevMode = pathParts.includes('src');

  if (isDevMode) {
    // Dev mode: use tsx to run TypeScript directly
    const tsEntry = path.resolve(dir, '../cli.ts');
    return tsEntry;
  }

  // Prod mode: use compiled JS
  return path.resolve(dir, '../cli.js');
}

const CLI_ENTRY = resolveCliEntry();

// In dev mode, we need to use tsx to run TypeScript
function getCliCommand(): { execPath: string; args: string[] } {
  if (CLI_ENTRY.endsWith('.ts')) {
    // Use tsx for TypeScript files
    return {
      execPath: process.execPath,
      args: [path.resolve(path.dirname(CLI_ENTRY), '../node_modules/.bin/tsx'), CLI_ENTRY]
    };
  }
  return {
    execPath: process.execPath,
    args: [CLI_ENTRY]
  };
}

function runAppshotCli(args: string[], options?: { cwd?: string }): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const command = ['appshot', ...args].join(' ');
    const cli = getCliCommand();
    const child = spawn(cli.execPath, [...cli.args, ...args], {
      cwd: options?.cwd ?? process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: '0'
        // Note: APPSHOT_DISABLE_FONT_SCAN is passed through from environment if set
        // This allows accurate font validation while CI can still disable scanning
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => reject(error));
    child.once('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
        durationMs: Date.now() - start,
        command
      });
    });
  });
}

function cliResultToToolResponse(action: string, run: CliRunResult) {
  const duration = (run.durationMs / 1000).toFixed(1);
  const status = run.exitCode === 0 ? 'succeeded' : `failed (code ${run.exitCode})`;
  return {
    content: [
      {
        type: 'text' as const,
        text: `${action} ${status} in ${duration}s\nCommand: ${run.command}`
      }
    ],
    structuredContent: {
      stdout: run.stdout,
      stderr: run.stderr,
      exitCode: run.exitCode,
      durationMs: run.durationMs,
      command: run.command
    },
    isError: run.exitCode !== 0
  };
}

async function readAppshotConfig(configPath?: string) {
  let target = path.resolve(process.cwd(), configPath ?? '.appshot/config.json');

  // If path is a directory, append .appshot/config.json
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      target = path.join(target, '.appshot', 'config.json');
    }
  } catch {
    // Path doesn't exist yet, continue with original target
  }

  const data = await fs.readFile(target, 'utf8');
  const config = JSON.parse(data);
  return { path: target, config };
}

export async function startMcpServer() {
  const server = new McpServer({
    name: 'appshot-mcp',
    version: APP_VERSION
  });

  registerProjectInfoTool(server);
  registerDoctorTool(server);
  registerBuildTool(server);
  registerFrameTool(server);
  registerExportTool(server);
  registerInitTool(server);
  registerSpecsTool(server);
  registerValidateTool(server);
  registerCleanTool(server);
  registerLocalizeTool(server);
  registerPresetsTool(server);
  registerLanguagesTool(server);
  registerConfigTool(server);
  registerCaptionsTool(server);
  registerGradientsTool(server);
  registerBackgroundsTool(server);
  registerFontsTool(server);
  registerTemplateTool(server);
  registerQuickstartTool(server);

  const transport = new StdioServerTransport();
  const cleanup = async () => {
    await transport.close();
    process.exit(0);
  };
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  await server.connect(transport);
}

function registerProjectInfoTool(server: McpServer) {
  const inputSchema = z.object({
    configPath: z.string().optional().describe('Path to appshot.json config file')
  });

  server.registerTool('appshot_projectInfo', {
    title: 'Read project configuration',
    description: 'Loads appshot.json and returns device + language metadata',
    inputSchema,
    outputSchema: z.object({
      path: z.string(),
      deviceCount: z.number(),
      languages: z.array(z.string()).optional(),
      summary: z.record(z.string(), z.any()),
      config: z.record(z.string(), z.any())
    })
  }, async (args) => {
    const { path: resolvedPath, config } = await readAppshotConfig(args.configPath);
    const devices = Object.keys(config.devices ?? {});
    const languages = config.languages ?? (config.defaultLanguage ? [config.defaultLanguage] : undefined);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Loaded ${path.basename(resolvedPath)} with ${devices.length} device(s)`
        }
      ],
      structuredContent: {
        path: resolvedPath,
        deviceCount: devices.length,
        languages,
        summary: {
          output: config.output ?? 'final',
          templates: Object.keys(config.templates ?? {})
        },
        config
      }
    };
  });
}

function registerDoctorTool(server: McpServer) {
  server.registerTool('appshot_doctor', {
    title: 'Run doctor checks',
    description: 'Runs appshot doctor to validate the current project'
  }, async () => {
    const result = await runAppshotCli(['doctor']);
    return cliResultToToolResponse('Doctor', result);
  });
}

function registerBuildTool(server: McpServer) {
  const inputSchema = z.object({
    devices: z.array(z.string()).optional().describe('Device types to build (e.g., ["iphone", "ipad"])'),
    presets: z.array(z.string()).optional().describe('App Store presets (e.g., ["iphone-6-9", "ipad-13"])'),
    languages: z.array(z.string()).optional().describe('Languages to build (e.g., ["en", "es", "fr"])'),
    configPath: z.string().optional().describe('Path to appshot.json config file'),
    dryRun: z.boolean().optional().describe('Show what would be built without actually building'),
    preview: z.boolean().optional().describe('Generate preview images'),
    noFrame: z.boolean().optional().describe('Skip device frame overlay'),
    noGradient: z.boolean().optional().describe('Skip gradient background'),
    noCaption: z.boolean().optional().describe('Skip caption text'),
    autoCaption: z.boolean().optional().describe('Auto-generate captions from filenames'),
    backgroundImage: z.string().optional().describe('Path to background image'),
    backgroundFit: z.enum(['cover', 'contain', 'fill', 'scale-down']).optional().describe('Background image fit mode'),
    autoBackground: z.boolean().optional().describe('Auto-detect background images'),
    noBackground: z.boolean().optional().describe('Skip background entirely'),
    outputDir: z.string().optional().describe('Output directory for built screenshots'),
    verbose: z.boolean().optional().describe('Show detailed output'),
    concurrency: z.number().int().positive().optional().describe('Number of parallel builds')
  });

  server.registerTool('appshot_build', {
    title: 'Run appshot build',
    description: 'Generates screenshots for the configured devices and languages',
    inputSchema
  }, async (args) => {
    const typedArgs = args as BuildToolArgs;
    let cwd: string | undefined;
    if (typedArgs.configPath) {
      // Set cwd to project directory for relative path resolution
      const isDir = !typedArgs.configPath.endsWith('.json');
      if (isDir) {
        // Directory path: set cwd and convert to full config path for CLI
        cwd = typedArgs.configPath;
        typedArgs.configPath = path.join(typedArgs.configPath, '.appshot', 'config.json');
      } else {
        // Full config.json path: derive cwd from it
        cwd = path.dirname(path.dirname(typedArgs.configPath));
      }
    }
    const buildArgs = createBuildArgs(typedArgs);
    const result = await runAppshotCli(buildArgs, { cwd });
    return cliResultToToolResponse('Build', result);
  });
}

function registerFrameTool(server: McpServer) {
  const inputSchema = z.object({
    input: z.string().describe('Path to screenshot file or directory'),
    outputDir: z.string().optional().describe('Output directory for framed screenshots'),
    device: z.string().optional().describe('Device type override (e.g., "iphone", "ipad")'),
    recursive: z.boolean().optional().describe('Process directories recursively'),
    format: z.enum(['png', 'jpeg']).optional().describe('Output image format'),
    suffix: z.string().optional().describe('Suffix to add to output filenames'),
    overwrite: z.boolean().optional().describe('Overwrite existing output files'),
    dryRun: z.boolean().optional().describe('Show what would be processed without doing it'),
    verbose: z.boolean().optional().describe('Show detailed output'),
    frameTone: z.enum(['original', 'neutral']).optional().describe('Frame color tone')
  });

  server.registerTool('appshot_frame', {
    title: 'Apply device frames',
    description: 'Wraps the frame CLI for MCP clients',
    inputSchema
  }, async (args) => {
    const frameArgs = createFrameArgs(args as FrameToolArgs);
    const result = await runAppshotCli(frameArgs);
    return cliResultToToolResponse('Frame', result);
  });
}

function registerExportTool(server: McpServer) {
  const inputSchema = z.object({
    format: z.string().optional().describe('Export format (e.g., "fastlane")'),
    sourceDir: z.string().optional().describe('Source directory with built screenshots'),
    outputDir: z.string().optional().describe('Output directory for exported files'),
    languages: z.array(z.string()).optional().describe('Languages to export'),
    devices: z.array(z.string()).optional().describe('Devices to export'),
    copy: z.boolean().optional().describe('Copy files instead of moving'),
    flatten: z.boolean().optional().describe('Flatten directory structure'),
    prefixDevice: z.boolean().optional().describe('Prefix filenames with device name'),
    order: z.boolean().optional().describe('Apply screenshot ordering'),
    clean: z.boolean().optional().describe('Clean output directory first'),
    generateConfig: z.boolean().optional().describe('Generate Fastlane config'),
    dryRun: z.boolean().optional().describe('Show what would be exported'),
    verbose: z.boolean().optional().describe('Show detailed output'),
    json: z.boolean().optional().describe('Output as JSON'),
    configPath: z.string().optional().describe('Path to appshot.json config file')
  });

  server.registerTool('appshot_export', {
    title: 'Export screenshots',
    description: 'Runs appshot export fastlane with optional filters',
    inputSchema
  }, async (args) => {
    const exportArgs = createExportArgs(args as ExportToolArgs);
    const result = await runAppshotCli(exportArgs);
    return cliResultToToolResponse('Export', result);
  });
}

function registerInitTool(server: McpServer) {
  const inputSchema = z.object({
    force: z.boolean().optional().describe('Overwrite existing configuration files'),
    projectDir: z.string().optional().describe('Directory to initialize the project in')
  });

  server.registerTool('appshot_init', {
    title: 'Initialize project',
    description: 'Scaffold a new appshot project with default configuration',
    inputSchema
  }, async (args) => {
    const typedArgs = args as InitToolArgs & { projectDir?: string };
    const cwd = typedArgs.projectDir;
    delete typedArgs.projectDir;
    const initArgs = createInitArgs(typedArgs);
    const result = await runAppshotCli(initArgs, { cwd });
    return cliResultToToolResponse('Init', result);
  });
}

function registerSpecsTool(server: McpServer) {
  const inputSchema = z.object({
    device: z.string().optional().describe('Filter by device type: iphone, ipad, mac, watch, appletv, visionpro'),
    required: z.boolean().optional().describe('Show only required App Store presets')
  });

  server.registerTool('appshot_specs', {
    title: 'App Store specifications',
    description: 'Get Apple App Store screenshot requirements and specifications (returns JSON)',
    inputSchema
  }, async (args) => {
    const specsArgs = createSpecsArgs(args as SpecsToolArgs);
    const result = await runAppshotCli(specsArgs);
    return cliResultToToolResponse('Specs', result);
  });
}

function registerValidateTool(server: McpServer) {
  const inputSchema = z.object({
    strict: z.boolean().optional().describe('Validate against required presets only'),
    fix: z.boolean().optional().describe('Suggest fixes for invalid screenshots')
  });

  server.registerTool('appshot_validate', {
    title: 'Validate screenshots',
    description: 'Validate screenshots against App Store requirements (returns JSON)',
    inputSchema
  }, async (args) => {
    const validateArgs = createValidateArgs(args as ValidateToolArgs);
    const result = await runAppshotCli(validateArgs);
    return cliResultToToolResponse('Validate', result);
  });
}

function registerCleanTool(server: McpServer) {
  const inputSchema = z.object({
    outputDir: z.string().optional().describe('Directory to clean (default: "final")'),
    all: z.boolean().optional().describe('Clean all generated files including processed cache'),
    history: z.boolean().optional().describe('Clear caption autocomplete history'),
    keepHistory: z.boolean().optional().describe('Keep history when using --all'),
    configPath: z.string().optional().describe('Path to appshot config file or project directory')
  });

  server.registerTool('appshot_clean', {
    title: 'Clean generated files',
    description: 'Remove generated screenshots and optionally clear caches (auto-confirms)',
    inputSchema
  }, async (args) => {
    const typedArgs = args as CleanToolArgs & { configPath?: string };
    let cwd: string | undefined;
    if (typedArgs.configPath) {
      const isDir = !typedArgs.configPath.endsWith('.json');
      cwd = isDir ? typedArgs.configPath : path.dirname(path.dirname(typedArgs.configPath));
      delete typedArgs.configPath;
    }
    const cleanArgs = createCleanArgs(typedArgs);
    const result = await runAppshotCli(cleanArgs, { cwd });
    return cliResultToToolResponse('Clean', result);
  });
}

function registerLocalizeTool(server: McpServer) {
  const inputSchema = z.object({
    languages: z.array(z.string()).describe('Language codes to translate to (e.g., ["es", "fr", "de"])'),
    device: z.string().optional().describe('Specific device to localize, or "all" for all devices'),
    model: z.string().optional().describe('OpenAI model to use (default: gpt-4o-mini)'),
    sourceLanguage: z.string().optional().describe('Source language code (default: en)'),
    overwrite: z.boolean().optional().describe('Overwrite existing translations')
  });

  server.registerTool('appshot_localize', {
    title: 'Batch translate captions',
    description: 'Translate captions to multiple languages using AI. Requires OPENAI_API_KEY environment variable.',
    inputSchema
  }, async (args) => {
    const localizeArgs = createLocalizeArgs(args as LocalizeToolArgs);
    const result = await runAppshotCli(localizeArgs);
    return cliResultToToolResponse('Localize', result);
  });
}

function registerPresetsTool(server: McpServer) {
  const inputSchema = z.object({
    list: z.boolean().optional().describe('List all available presets'),
    required: z.boolean().optional().describe('List only required App Store presets'),
    category: z.string().optional().describe('Filter by category: iphone, ipad, mac, appletv, visionpro, watch'),
    generate: z.array(z.string()).optional().describe('Generate config for specific preset IDs'),
    outputFile: z.string().optional().describe('Output file for generated config')
  });

  server.registerTool('appshot_presets', {
    title: 'List presets',
    description: 'List available App Store presets and generate configuration (returns JSON)',
    inputSchema
  }, async (args) => {
    const presetsArgs = createPresetsArgs(args as PresetsToolArgs);
    const result = await runAppshotCli(presetsArgs);
    return cliResultToToolResponse('Presets', result);
  });
}

function registerLanguagesTool(server: McpServer) {
  const inputSchema = z.object({
    device: z.string().optional().describe('Specific device to check (iphone/ipad/mac/watch), or omit for all devices'),
    configPath: z.string().optional().describe('Path to appshot config file or project directory')
  });

  server.registerTool('appshot_languages', {
    title: 'Discover available languages',
    description: 'Scans caption files to discover which languages have translations available',
    inputSchema
  }, async (args) => {
    let projectDir = process.cwd();
    if (args.configPath) {
      projectDir = args.configPath.endsWith('.json')
        ? path.dirname(path.dirname(args.configPath))
        : args.configPath;
    }
    const captionsDir = path.join(projectDir, '.appshot', 'captions');
    const byDevice: Record<string, string[]> = {};
    const allLanguages = new Set<string>();
    let captionCount = 0;

    const devices = args.device ? [args.device] : ['iphone', 'ipad', 'mac', 'watch'];

    for (const device of devices) {
      const captionPath = path.join(captionsDir, `${device}.json`);
      try {
        const data = await fs.readFile(captionPath, 'utf8');
        const captions = JSON.parse(data);
        const langs = detectLanguagesFromCaptions(captions);
        if (langs.length > 0) {
          byDevice[device] = langs;
          langs.forEach(l => allLanguages.add(l));
        }
        captionCount += Object.keys(captions).length;
      } catch {
        // File doesn't exist or is invalid - skip
      }
    }

    const languages = Array.from(allLanguages).sort();

    return {
      content: [{
        type: 'text' as const,
        text: `Found ${languages.length} language(s) across ${Object.keys(byDevice).length} device(s)`
      }],
      structuredContent: {
        languages,
        byDevice,
        captionCount
      }
    };
  });
}

function registerConfigTool(server: McpServer) {
  const inputSchema = z.object({
    configPath: z.string().optional().describe('Path to appshot config file or project directory'),
    device: z.string().describe('Device to configure (iphone/ipad/mac/watch)'),
    frameScale: z.number().optional().describe('Scale of device frame (0.1-1.5)'),
    framePosition: z.number().optional().describe('Vertical position of device (0-100, or negative for offset)'),
    captionPosition: z.enum(['above', 'below', 'overlay']).optional().describe('Caption position relative to device'),
    captionSize: z.number().optional().describe('Font size for captions'),
    marginTop: z.number().optional().describe('Top margin for caption box'),
    marginBottom: z.number().optional().describe('Bottom margin for caption box')
  });

  server.registerTool('appshot_config', {
    title: 'Update device configuration',
    description: 'Modifies device-specific settings in the appshot config file',
    inputSchema
  }, async (args) => {
    let configFile: string;
    if (args.configPath) {
      configFile = args.configPath.endsWith('.json')
        ? args.configPath
        : path.join(args.configPath, '.appshot', 'config.json');
    } else {
      configFile = path.join(process.cwd(), '.appshot', 'config.json');
    }

    let config: Record<string, unknown>;
    try {
      const data = await fs.readFile(configFile, 'utf8');
      config = JSON.parse(data);
    } catch (err) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error reading config: ${err instanceof Error ? err.message : String(err)}`
        }],
        isError: true
      };
    }

    const devices = config.devices as Record<string, Record<string, unknown>> | undefined;
    if (!devices || !devices[args.device]) {
      return {
        content: [{
          type: 'text' as const,
          text: `Device "${args.device}" not found in config. Available: ${devices ? Object.keys(devices).join(', ') : 'none'}`
        }],
        isError: true
      };
    }

    const deviceConfig = devices[args.device];
    const changes: string[] = [];

    if (args.frameScale !== undefined) {
      deviceConfig.frameScale = args.frameScale;
      changes.push(`frameScale: ${args.frameScale}`);
    }
    if (args.framePosition !== undefined) {
      deviceConfig.framePosition = args.framePosition;
      changes.push(`framePosition: ${args.framePosition}`);
    }
    if (args.captionPosition !== undefined) {
      deviceConfig.captionPosition = args.captionPosition;
      changes.push(`captionPosition: ${args.captionPosition}`);
    }
    if (args.captionSize !== undefined) {
      deviceConfig.captionSize = args.captionSize;
      changes.push(`captionSize: ${args.captionSize}`);
    }

    if (args.marginTop !== undefined || args.marginBottom !== undefined) {
      const captionBox = (deviceConfig.captionBox as Record<string, unknown>) ?? {};
      if (args.marginTop !== undefined) {
        captionBox.marginTop = args.marginTop;
        changes.push(`captionBox.marginTop: ${args.marginTop}`);
      }
      if (args.marginBottom !== undefined) {
        captionBox.marginBottom = args.marginBottom;
        changes.push(`captionBox.marginBottom: ${args.marginBottom}`);
      }
      deviceConfig.captionBox = captionBox;
    }

    if (changes.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: 'No changes specified'
        }]
      };
    }

    try {
      await fs.writeFile(configFile, JSON.stringify(config, null, 2) + '\n', 'utf8');
    } catch (err) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error writing config: ${err instanceof Error ? err.message : String(err)}`
        }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: `Updated ${args.device} config:\n${changes.map(c => `  • ${c}`).join('\n')}`
      }],
      structuredContent: {
        device: args.device,
        changes,
        configFile
      }
    };
  });
}

function registerCaptionsTool(server: McpServer) {
  const inputSchema = z.object({
    configPath: z.string().optional().describe('Path to appshot config file or project directory'),
    device: z.string().describe('Device to manage captions for (iphone/ipad/mac/watch)'),
    action: z.enum(['list', 'get', 'set', 'bulk-set', 'auto']).describe('Action to perform'),
    filename: z.string().optional().describe('Screenshot filename (required for get/set)'),
    language: z.string().optional().describe('Language code (default: en)'),
    caption: z.string().optional().describe('Caption text (required for set action)'),
    captions: z.string().optional().describe('JSON object of filename:caption pairs for bulk-set (e.g., {"file1.png": "Caption 1", "file2.png": "Caption 2"})'),
    overwrite: z.boolean().optional().describe('Overwrite existing captions (for auto action, default: false)')
  });

  server.registerTool('appshot_captions', {
    title: 'Manage captions',
    description: 'Read and write caption text for screenshots',
    inputSchema
  }, async (args) => {
    let projectDir = process.cwd();
    if (args.configPath) {
      projectDir = args.configPath.endsWith('.json')
        ? path.dirname(path.dirname(args.configPath))
        : args.configPath;
    }

    const captionFile = path.join(projectDir, '.appshot', 'captions', `${args.device}.json`);
    let captions: Record<string, Record<string, string> | string> = {};

    try {
      const data = await fs.readFile(captionFile, 'utf8');
      captions = JSON.parse(data);
    } catch {
      // Write actions (set, bulk-set, auto) can proceed with empty captions
      // Read actions (list, get) should report no file found
      const writeActions = ['set', 'bulk-set', 'auto'];
      if (!writeActions.includes(args.action)) {
        return {
          content: [{
            type: 'text' as const,
            text: `No captions file found for ${args.device}`
          }],
          structuredContent: { device: args.device, captions: {} }
        };
      }
    }

    if (args.action === 'list') {
      const captionCount = Object.keys(captions).length;
      return {
        content: [{
          type: 'text' as const,
          text: `Found ${captionCount} caption(s) for ${args.device}`
        }],
        structuredContent: {
          device: args.device,
          captions
        }
      };
    }

    if (args.action === 'get') {
      if (!args.filename) {
        return {
          content: [{
            type: 'text' as const,
            text: 'filename is required for get action'
          }],
          isError: true
        };
      }
      const captionData = captions[args.filename];
      return {
        content: [{
          type: 'text' as const,
          text: captionData ? `Caption for ${args.filename}` : `No caption found for ${args.filename}`
        }],
        structuredContent: {
          filename: args.filename,
          captions: typeof captionData === 'string' ? { en: captionData } : (captionData ?? {})
        }
      };
    }

    if (args.action === 'set') {
      if (!args.filename) {
        return {
          content: [{
            type: 'text' as const,
            text: 'filename is required for set action'
          }],
          isError: true
        };
      }
      if (args.caption === undefined) {
        return {
          content: [{
            type: 'text' as const,
            text: 'caption is required for set action'
          }],
          isError: true
        };
      }

      const lang = args.language ?? 'en';
      const existing = captions[args.filename];

      if (typeof existing === 'string') {
        captions[args.filename] = { en: existing, [lang]: args.caption };
      } else if (existing) {
        existing[lang] = args.caption;
      } else {
        captions[args.filename] = { [lang]: args.caption };
      }

      const captionsDir = path.dirname(captionFile);
      await fs.mkdir(captionsDir, { recursive: true });
      await fs.writeFile(captionFile, JSON.stringify(captions, null, 2) + '\n', 'utf8');

      return {
        content: [{
          type: 'text' as const,
          text: `Updated caption for ${args.filename} (${lang})`
        }],
        structuredContent: {
          filename: args.filename,
          language: lang,
          caption: args.caption,
          updated: true
        }
      };
    }

    if (args.action === 'bulk-set') {
      if (!args.captions) {
        return {
          content: [{
            type: 'text' as const,
            text: 'captions JSON is required for bulk-set action'
          }],
          isError: true
        };
      }

      let captionsToSet: Record<string, string>;
      try {
        captionsToSet = JSON.parse(args.captions);
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: 'Invalid JSON in captions parameter'
          }],
          isError: true
        };
      }

      const lang = args.language ?? 'en';
      let count = 0;

      for (const [filename, captionText] of Object.entries(captionsToSet)) {
        const existing = captions[filename];
        if (typeof existing === 'string') {
          captions[filename] = { en: existing, [lang]: captionText };
        } else if (existing) {
          existing[lang] = captionText;
        } else {
          captions[filename] = { [lang]: captionText };
        }
        count++;
      }

      const captionsDir = path.dirname(captionFile);
      await fs.mkdir(captionsDir, { recursive: true });
      await fs.writeFile(captionFile, JSON.stringify(captions, null, 2) + '\n', 'utf8');

      return {
        content: [{
          type: 'text' as const,
          text: `Set ${count} caption(s) for ${args.device} (${lang})`
        }],
        structuredContent: {
          device: args.device,
          language: lang,
          count,
          captions: captionsToSet,
          updated: true
        }
      };
    }

    if (args.action === 'auto') {
      // Use provided config path or default to .appshot/config.json
      const configFile = args.configPath?.endsWith('.json')
        ? args.configPath
        : path.join(projectDir, '.appshot', 'config.json');
      let config: Record<string, unknown>;
      try {
        const data = await fs.readFile(configFile, 'utf8');
        config = JSON.parse(data);
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: 'Could not read config file. Run appshot init first.'
          }],
          isError: true
        };
      }

      const devices = config.devices as Record<string, { input?: string }> | undefined;
      const deviceConfig = devices?.[args.device];
      const inputDir = deviceConfig?.input ?? `./screenshots/${args.device}`;
      const screenshotsDir = path.resolve(projectDir, inputDir);

      let files: string[];
      try {
        const entries = await fs.readdir(screenshotsDir);
        files = entries.filter(f => /\.(png|jpg|jpeg)$/i.test(f));
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: `Could not read screenshots directory: ${screenshotsDir}`
          }],
          isError: true
        };
      }

      if (files.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `No screenshots found in ${screenshotsDir}`
          }],
          structuredContent: { device: args.device, count: 0, captions: {} }
        };
      }

      const lang = args.language ?? 'en';
      const overwrite = args.overwrite ?? false;
      let count = 0;
      const generated: Record<string, string> = {};

      for (const filename of files) {
        const existing = captions[filename];
        const hasCaption = existing && (
          typeof existing === 'string' ||
          (typeof existing === 'object' && existing[lang])
        );

        if (hasCaption && !overwrite) {
          continue;
        }

        const captionText = filenameToCaption(filename);
        if (typeof existing === 'string') {
          captions[filename] = { en: existing, [lang]: captionText };
        } else if (existing) {
          existing[lang] = captionText;
        } else {
          captions[filename] = { [lang]: captionText };
        }
        generated[filename] = captionText;
        count++;
      }

      if (count > 0) {
        const captionsDir = path.dirname(captionFile);
        await fs.mkdir(captionsDir, { recursive: true });
        await fs.writeFile(captionFile, JSON.stringify(captions, null, 2) + '\n', 'utf8');
      }

      return {
        content: [{
          type: 'text' as const,
          text: count > 0
            ? `Generated ${count} caption(s) from filenames for ${args.device}`
            : `No new captions generated (${files.length} files already have captions)`
        }],
        structuredContent: {
          device: args.device,
          language: lang,
          count,
          totalFiles: files.length,
          captions: generated,
          updated: count > 0
        }
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: `Unknown action: ${args.action}`
      }],
      isError: true
    };
  });
}

function registerGradientsTool(server: McpServer) {
  const inputSchema = z.object({
    configPath: z.string().optional().describe('Path to appshot config file or project directory'),
    action: z.enum(['list', 'apply']).describe('Action to perform'),
    category: z.enum(['warm', 'cool', 'vibrant', 'subtle', 'monochrome', 'brand']).optional().describe('Filter by category (for list action)'),
    preset: z.string().optional().describe('Preset ID to apply (required for apply action)')
  });

  server.registerTool('appshot_gradients', {
    title: 'Manage gradients',
    description: 'List available gradient presets and apply them to config',
    inputSchema
  }, async (args) => {
    if (args.action === 'list') {
      const presets = args.category
        ? getGradientsByCategory(args.category)
        : gradientPresets;

      return {
        content: [{
          type: 'text' as const,
          text: `Found ${presets.length} gradient preset(s)${args.category ? ` in category "${args.category}"` : ''}`
        }],
        structuredContent: {
          presets: presets.map(p => ({
            id: p.id,
            name: p.name,
            colors: p.colors,
            direction: p.direction,
            category: p.category
          }))
        }
      };
    }

    if (args.action === 'apply') {
      if (!args.preset) {
        return {
          content: [{
            type: 'text' as const,
            text: 'preset is required for apply action'
          }],
          isError: true
        };
      }

      const preset = getGradientPreset(args.preset);
      if (!preset) {
        return {
          content: [{
            type: 'text' as const,
            text: `Gradient preset "${args.preset}" not found. Use action: list to see available presets.`
          }],
          isError: true
        };
      }

      let configFile: string;
      if (args.configPath) {
        configFile = args.configPath.endsWith('.json')
          ? args.configPath
          : path.join(args.configPath, '.appshot', 'config.json');
      } else {
        configFile = path.join(process.cwd(), '.appshot', 'config.json');
      }

      let config: Record<string, unknown>;
      try {
        const data = await fs.readFile(configFile, 'utf8');
        config = JSON.parse(data);
      } catch (err) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error reading config: ${err instanceof Error ? err.message : String(err)}`
          }],
          isError: true
        };
      }

      config.gradient = {
        colors: preset.colors,
        direction: preset.direction
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2) + '\n', 'utf8');

      return {
        content: [{
          type: 'text' as const,
          text: `Applied gradient preset "${preset.name}"`
        }],
        structuredContent: {
          preset: preset.id,
          colors: preset.colors,
          direction: preset.direction,
          applied: true
        }
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: `Unknown action: ${args.action}`
      }],
      isError: true
    };
  });
}

function registerBackgroundsTool(server: McpServer) {
  const inputSchema = z.object({
    configPath: z.string().optional().describe('Path to appshot config file or project directory'),
    action: z.enum(['list', 'set', 'clear']).describe('Action to perform'),
    device: z.string().optional().describe('Device to configure (omit for global background)'),
    image: z.string().optional().describe('Path to background image (for set action)'),
    fit: z.enum(['cover', 'contain', 'fill', 'scale-down']).optional().describe('Background fit mode (for set action)')
  });

  server.registerTool('appshot_backgrounds', {
    title: 'Manage backgrounds',
    description: 'Configure background images for screenshots',
    inputSchema
  }, async (args) => {
    let configFile: string;
    if (args.configPath) {
      configFile = args.configPath.endsWith('.json')
        ? args.configPath
        : path.join(args.configPath, '.appshot', 'config.json');
    } else {
      configFile = path.join(process.cwd(), '.appshot', 'config.json');
    }

    let config: Record<string, unknown>;
    try {
      const data = await fs.readFile(configFile, 'utf8');
      config = JSON.parse(data);
    } catch (err) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error reading config: ${err instanceof Error ? err.message : String(err)}`
        }],
        isError: true
      };
    }

    if (args.action === 'list') {
      const globalBg = config.background as Record<string, unknown> | undefined;
      const devices = config.devices as Record<string, Record<string, unknown>> | undefined;
      const deviceBackgrounds: Record<string, unknown> = {};

      if (devices) {
        for (const [device, deviceConfig] of Object.entries(devices)) {
          if (deviceConfig.background) {
            deviceBackgrounds[device] = deviceConfig.background;
          }
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: 'Background configuration loaded'
        }],
        structuredContent: {
          global: globalBg ?? {},
          devices: deviceBackgrounds
        }
      };
    }

    if (args.action === 'set') {
      if (!args.image) {
        return {
          content: [{
            type: 'text' as const,
            text: 'image is required for set action'
          }],
          isError: true
        };
      }

      if (args.device) {
        const devices = (config.devices as Record<string, Record<string, unknown>>) ?? {};
        if (!devices[args.device]) {
          return {
            content: [{
              type: 'text' as const,
              text: `Device "${args.device}" not found in config`
            }],
            isError: true
          };
        }
        devices[args.device].background = {
          image: args.image,
          ...(args.fit && { fit: args.fit })
        };
      } else {
        config.background = {
          mode: 'image',
          image: args.image,
          ...(args.fit && { fit: args.fit })
        };
      }

      await fs.writeFile(configFile, JSON.stringify(config, null, 2) + '\n', 'utf8');

      return {
        content: [{
          type: 'text' as const,
          text: `Set background${args.device ? ` for ${args.device}` : ' (global)'}: ${args.image}`
        }],
        structuredContent: {
          device: args.device ?? 'global',
          image: args.image,
          fit: args.fit,
          updated: true
        }
      };
    }

    if (args.action === 'clear') {
      if (args.device) {
        const devices = (config.devices as Record<string, Record<string, unknown>>) ?? {};
        if (devices[args.device]) {
          delete devices[args.device].background;
        }
      } else {
        delete config.background;
      }

      await fs.writeFile(configFile, JSON.stringify(config, null, 2) + '\n', 'utf8');

      return {
        content: [{
          type: 'text' as const,
          text: `Cleared background${args.device ? ` for ${args.device}` : ' (global)'}`
        }],
        structuredContent: {
          device: args.device ?? 'global',
          cleared: true
        }
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: `Unknown action: ${args.action}`
      }],
      isError: true
    };
  });
}

function registerFontsTool(server: McpServer) {
  const inputSchema = z.object({
    action: z.enum(['list', 'validate', 'embedded']).describe('Action to perform'),
    font: z.string().optional().describe('Font name to validate (required for validate action)')
  });

  server.registerTool('appshot_fonts', {
    title: 'Manage fonts',
    description: 'List available fonts and check font availability',
    inputSchema
  }, async (args) => {
    if (args.action === 'validate' && !args.font) {
      return {
        content: [{
          type: 'text' as const,
          text: 'font is required for validate action'
        }],
        isError: true
      };
    }

    const fontsArgs = createFontsArgs(args as FontsToolArgs);
    const result = await runAppshotCli(fontsArgs);
    return cliResultToToolResponse('Fonts', result);
  });
}

function registerTemplateTool(server: McpServer) {
  const inputSchema = z.object({
    template: z.string().optional().describe('Template ID to apply (modern, minimal, bold, elegant, showcase, playful, corporate)'),
    list: z.boolean().optional().describe('List all available templates'),
    preview: z.string().optional().describe('Preview template configuration by ID'),
    caption: z.string().optional().describe('Add a single caption to all screenshots'),
    captions: z.string().optional().describe('Add multiple captions as JSON'),
    device: z.string().optional().describe('Apply template to specific device only'),
    noBackup: z.boolean().optional().describe('Skip creating backup of current config'),
    dryRun: z.boolean().optional().describe('Preview changes without applying'),
    projectDir: z.string().optional().describe('Project directory to apply template to')
  });

  server.registerTool('appshot_template', {
    title: 'Apply template',
    description: 'Apply professional screenshot templates for quick App Store setup',
    inputSchema
  }, async (args) => {
    const typedArgs = args as TemplateToolArgs & { projectDir?: string };
    const cwd = typedArgs.projectDir;
    delete typedArgs.projectDir;
    const templateArgs = createTemplateArgs(typedArgs);
    const result = await runAppshotCli(templateArgs, { cwd });
    return cliResultToToolResponse('Template', result);
  });
}

function registerQuickstartTool(server: McpServer) {
  const inputSchema = z.object({
    template: z.string().optional().describe('Template to use (default: modern)'),
    caption: z.string().optional().describe('Main caption for screenshots'),
    noInteractive: z.boolean().optional().describe('Skip interactive prompts'),
    force: z.boolean().optional().describe('Overwrite existing configuration'),
    projectDir: z.string().optional().describe('Directory to initialize the project in')
  });

  server.registerTool('appshot_quickstart', {
    title: 'Quickstart',
    description: 'Get started with App Store screenshots in seconds - initializes project, applies template, sets up captions',
    inputSchema
  }, async (args) => {
    const typedArgs = args as QuickstartToolArgs & { projectDir?: string };
    const cwd = typedArgs.projectDir;
    delete typedArgs.projectDir;
    const quickstartArgs = createQuickstartArgs(typedArgs);
    const result = await runAppshotCli(quickstartArgs, { cwd });
    return cliResultToToolResponse('Quickstart', result);
  });
}
