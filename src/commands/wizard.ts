import { Command } from 'commander';
import pc from 'picocolors';
import inquirer from 'inquirer';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { loadConfig, saveConfig, fileExists } from '../core/files.js';
import type { AppshotConfigV2 } from '../types.js';
import { detectConfigVersion } from '../utils/config-version.js';
import { showV1DeprecationBanner } from '../utils/v2-banner.js';
import { translationService } from '../services/translation.js';
import { applyTemplateToConfig, getTemplate, resolveTemplateId, templates } from '../templates/registry.js';
import { getImageDimensions } from '../core/devices.js';

type CaptionSource = 'filenames' | 'manual';

export type WizardOptions = {
  devices?: string;
  layout?: 'header' | 'footer' | 'screenshot-only';
  template?: string;
  captionSource?: CaptionSource;
  langs?: string;
  model?: string;
  enhance?: boolean;
  noEnhance?: boolean;
  noInteractive?: boolean;
  dryRun?: boolean;
  migrate?: boolean;
  requireAi?: boolean;
};

type WizardDeps = {
  runner?: (args: string[], opts?: { cwd?: string }) => Promise<void>;
};

const DEFAULT_LANGS = 'en,es,fr';
const DEFAULT_MODEL = 'gpt-5-mini';

export default function wizardCmd() {
  const cmd = new Command('wizard')
    .description('One-shot v2 setup and build flow')
    .option('--devices <list>', 'comma-separated device list (iphone,ipad,mac,watch)')
    .option('--layout <mode>', 'layout mode (header, footer, screenshot-only)')
    .option('--template <id>', 'apply a v2 template (ocean-header, sunset-footer, clean-screenshot, etc.)')
    .option('--caption-source <mode>', 'filenames or manual')
    .option('--langs <codes>', 'language codes (comma-separated)')
    .option('--model <name>', 'OpenAI model to use', DEFAULT_MODEL)
    .option('--enhance', 'enhance captions after translation')
    .option('--no-enhance', 'skip caption enhancement')
    .option('--no-interactive', 'run without prompts (use flags)')
    .option('--dry-run', 'print actions without executing')
    .option('--migrate', 'auto-migrate v1 config to v2')
    .option('--require-ai', 'fail if AI steps are requested but no API key is set')
    .addHelpText('after', `
${pc.bold('Examples:')}
  ${pc.dim('# Interactive wizard')}
  $ appshot wizard

  ${pc.dim('# Interactive with template')}
  $ appshot wizard --template ocean-header

  ${pc.dim('# Non-interactive (CI)')}
  $ appshot wizard --no-interactive --devices iphone --template ocean-header --caption-source filenames --langs en,es,fr --model gpt-5-mini

${pc.bold('Notes:')}
  • If OPENAI_API_KEY is missing, translation/enhance steps are skipped unless --require-ai is set.
  • Manual captions require interactive entry per file.`)
    .action(async (opts: WizardOptions) => {
      try {
        await runWizard(opts);
      } catch (error) {
        console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return cmd;
}

export async function runWizard(options: WizardOptions, deps: WizardDeps = {}): Promise<void> {
  const runner = deps.runner ?? runCli;
  const interactive = !options.noInteractive;

  const plan = {
    devices: [] as string[],
    layout: (options.layout as 'header' | 'footer' | 'screenshot-only') ?? 'header',
    templateId: options.template,
    captionSource: (options.captionSource as CaptionSource) ?? 'filenames',
    langs: options.langs ?? DEFAULT_LANGS,
    model: options.model ?? DEFAULT_MODEL,
    enhance: options.noEnhance ? false : (options.enhance ?? true)
  };

  if (interactive) {
    const answers = await inquirer.prompt<any>([
      {
        type: 'checkbox',
        name: 'devices',
        message: 'Which devices?',
        choices: [
          { name: 'iPhone', value: 'iphone', checked: true },
          { name: 'iPad', value: 'ipad' },
          { name: 'Mac', value: 'mac' },
          { name: 'Watch', value: 'watch' }
        ],
        validate: (values: string[]) => (values.length > 0 ? true : 'Select at least one device')
      },
      {
        type: 'list',
        name: 'templateId',
        message: 'Use a template preset?',
        choices: [
          { name: 'No template (custom)', value: '' },
          ...templates.map(template => ({
            name: `${template.name} — ${template.description}`,
            value: template.id
          }))
        ],
        default: plan.templateId || ''
      },
      {
        type: 'list',
        name: 'layout',
        message: 'Layout mode:',
        choices: [
          { name: 'Header (caption on top)', value: 'header' },
          { name: 'Footer (caption on bottom)', value: 'footer' },
          { name: 'Screenshot-only', value: 'screenshot-only' }
        ],
        default: plan.layout,
        when: (answers: { templateId?: string }) => !answers.templateId
      },
      {
        type: 'list',
        name: 'captionSource',
        message: 'Caption source:',
        choices: [
          { name: 'Filenames (auto)', value: 'filenames' },
          { name: 'Manual entry', value: 'manual' }
        ],
        default: plan.captionSource
      },
      {
        type: 'confirm',
        name: 'localize',
        message: 'Localize captions to other languages?',
        default: true
      },
      {
        type: 'checkbox',
        name: 'langs',
        message: 'Select languages:',
        choices: translationService.getSupportedLanguages().map(lang => ({
          name: `${lang.code} — ${lang.name}`,
          value: lang.code,
          checked: DEFAULT_LANGS.split(',').includes(lang.code)
        })),
        when: (answers: { localize?: boolean }) => answers.localize,
        validate: (values: unknown[]) => {
          const normalized = (values || []).map(value => {
            if (typeof value === 'string') return value.toLowerCase();
            if (value && typeof value === 'object' && 'value' in value) {
              return String((value as { value?: unknown }).value ?? '').toLowerCase();
            }
            return String(value ?? '').toLowerCase();
          }).filter(Boolean);
          if (normalized.length === 0) {
            return 'Select at least one language';
          }
          if (!normalized.some(code => code === 'en' || code.startsWith('en-'))) {
            return 'English (en) is required as the base language';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'enhance',
        message: 'Enhance captions (rewrite to be shorter/clearer and fit layout limits)?',
        default: plan.enhance
      },
      {
        type: 'input',
        name: 'model',
        message: 'OpenAI model:',
        default: plan.model,
        when: (answers: { localize?: boolean; enhance?: boolean }) =>
          Boolean(answers.localize) || Boolean(answers.enhance)
      }
    ] as any);

    plan.devices = answers.devices;
    plan.templateId = answers.templateId || undefined;
    plan.layout = answers.layout || plan.layout;
    plan.captionSource = answers.captionSource;
    plan.langs = answers.localize ? (answers.langs as string[]).join(',') : 'en';
    plan.enhance = answers.enhance;
    plan.model = answers.model || plan.model;
  } else {
    plan.devices = options.devices ? options.devices.split(',').map(d => d.trim()).filter(Boolean) : ['iphone'];
  }

  if (plan.devices.length === 0) {
    throw new Error('No devices selected.');
  }

  if (plan.templateId) {
    const resolved = resolveTemplateId(plan.templateId);
    const template = getTemplate(resolved.id);
    if (!template) {
      throw new Error(`Template "${plan.templateId}" not found.`);
    }
    plan.templateId = resolved.id;
    plan.layout = template.layout;
    if (options.layout) {
      console.log(pc.yellow('⚠'), `Template "${template.name}" sets layout to "${template.layout}" (ignoring --layout).`);
    }
  }

  const needsAi = plan.langs.split(',').length > 1 || plan.enhance;
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (needsAi && !hasApiKey) {
    if (options.requireAi) {
      throw new Error('OPENAI_API_KEY is required for translation/enhancement.');
    }
    console.log(pc.yellow('⚠'), 'OPENAI_API_KEY not found. Skipping translation/enhancement.');
    plan.langs = 'en';
    plan.enhance = false;
  }

  const configExists = await fileExists(path.join(process.cwd(), '.appshot', 'config.json'));
  if (!configExists) {
    await maybeRun(runner, ['init'], options.dryRun);
  }

  let config: any;
  try {
    config = await loadConfig();
  } catch {
    throw new Error('Could not load config. Run "appshot init" first.');
  }

  const version = detectConfigVersion(config);
  if (version === 1) {
    if (interactive && !options.migrate) {
      showV1DeprecationBanner();
      const confirm = await inquirer.prompt([{
        type: 'confirm',
        name: 'migrate',
        message: 'Migrate v1 config to v2 now?',
        default: true
      }]);
      if (!confirm.migrate) {
        throw new Error('Wizard canceled. Run "appshot migrate" to upgrade.');
      }
    } else if (!options.migrate) {
      throw new Error('v1 config detected. Run "appshot migrate" or pass --migrate.');
    }
    await maybeRun(runner, ['migrate', '--yes'], options.dryRun);
    config = await loadConfig();
  }

  if ((config as { version?: number }).version === 2) {
    let nextConfig = config as AppshotConfigV2;
    if (plan.templateId) {
      nextConfig = applyTemplateToConfig(plan.templateId, nextConfig);
    } else {
      nextConfig.layout = plan.layout;
    }
    await applyDetectedResolutions(nextConfig, plan.devices);
    await saveConfig(nextConfig);
  }

  const langs = plan.langs;
  const langList = langs.split(',').map(l => l.trim()).filter(Boolean);
  const targetLangs = langList.filter(l => l !== 'en');

  for (const device of plan.devices) {
    if (plan.captionSource === 'filenames') {
      const args = ['caption', '--device', device, '--auto-caption'];
      if (targetLangs.length > 0) {
        args.push('--translate', '--langs', targetLangs.join(','), '--model', plan.model);
      }
      await maybeRun(runner, args, options.dryRun);
    } else {
      const args = ['caption', '--device', device];
      if (targetLangs.length > 0) {
        args.push('--translate', '--langs', targetLangs.join(','), '--model', plan.model);
      }
      await maybeRun(runner, args, options.dryRun);
    }

    if (plan.enhance) {
      const enhanceArgs = ['caption', 'enhance', '--device', device, '--model', plan.model];
      if (langList.length > 0) {
        enhanceArgs.push('--langs', langList.join(','));
      }
      await maybeRun(runner, enhanceArgs, options.dryRun);
    }
  }

  const buildArgs = ['build', '--devices', plan.devices.join(',')];
  if (langList.length > 0) {
    buildArgs.push('--langs', langList.join(','));
  }
  await maybeRun(runner, buildArgs, options.dryRun);
}

async function applyDetectedResolutions(config: AppshotConfigV2, devices: string[]): Promise<void> {
  const targetDevices = devices.length > 0 ? devices : Object.keys(config.devices);

  for (const device of targetDevices) {
    const entry = config.devices[device];
    if (!entry) continue;

    const input = typeof entry === 'string' ? entry : entry.input;
    const inputDir = path.resolve(process.cwd(), input);

    try {
      const files = (await fs.readdir(inputDir))
        .filter(f => f.match(/\.(png|jpg|jpeg)$/i))
        .sort();
      if (files.length === 0) {
        if (typeof entry === 'object' && 'resolution' in entry) {
          delete entry.resolution;
        }
        continue;
      }

      const sample = path.join(inputDir, files[0]);
      const { width, height } = await getImageDimensions(sample);
      if (!width || !height) {
        continue;
      }

      const resolution = `${width}x${height}`;
      if (typeof entry === 'string') {
        config.devices[device] = { input, resolution };
      } else {
        entry.resolution = resolution;
      }
      console.log(pc.dim(`Detected ${device} resolution: ${resolution}`));
    } catch {
      if (typeof entry === 'object' && 'resolution' in entry) {
        delete entry.resolution;
      }
    }
  }
}

async function maybeRun(runner: (args: string[]) => Promise<void>, args: string[], dryRun?: boolean) {
  if (dryRun) {
    console.log(pc.dim(`• Would run: appshot ${args.join(' ')}`));
    return;
  }
  await runner(args);
}

function resolveCliEntry(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const dir = path.dirname(currentFile);
  const pathParts = dir.split(path.sep);
  const isDevMode = pathParts.includes('src');
  if (isDevMode) {
    return path.resolve(dir, '../cli.ts');
  }
  return path.resolve(dir, '../cli.js');
}

function getCliCommand(): { execPath: string; args: string[] } {
  const entry = resolveCliEntry();
  if (entry.endsWith('.ts')) {
    return {
      execPath: process.execPath,
      args: [path.resolve(path.dirname(entry), '../node_modules/.bin/tsx'), entry]
    };
  }
  return {
    execPath: process.execPath,
    args: [entry]
  };
}

function runCli(args: string[], opts?: { cwd?: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const cli = getCliCommand();
    const child = spawn(cli.execPath, [...cli.args, ...args], {
      cwd: opts?.cwd ?? process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        FORCE_COLOR: '1'
      }
    });
    child.once('error', (error) => reject(error));
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: appshot ${args.join(' ')}`));
      }
    });
  });
}
