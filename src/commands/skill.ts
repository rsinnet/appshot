import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import pc from 'picocolors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyDir(src: string, dest: string): Promise<number> {
  let count = 0;
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
      count++;
    }
  }
  return count;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export default function skillCmd() {
  const cmd = new Command('skill')
    .description('Install appshot skill for Claude Code')
    .option('--force', 'overwrite existing skill installation')
    .option('--uninstall', 'remove the skill')
    .option('--path <dir>', 'custom installation path')
    .addHelpText('after', `
${pc.bold('Examples:')}
  ${pc.dim('# Install skill to Claude Code')}
  $ appshot skill

  ${pc.dim('# Reinstall/update skill')}
  $ appshot skill --force

  ${pc.dim('# Uninstall skill')}
  $ appshot skill --uninstall

  ${pc.dim('# Install to custom path')}
  $ appshot skill --path ~/my-skills/appshot

${pc.bold('What the skill provides:')}
  • Tool documentation for AI assistants
  • Workflow guidance and best practices
  • Template recommendations by app type
  • Troubleshooting guides
  • Reference files for gradients, fonts, and templates

${pc.bold('Default installation path:')}
  ~/.claude/skills/appshot/`)
    .action(async (opts) => {
      try {
        // Determine paths
        const skillSource = path.resolve(__dirname, '../../skill');
        const defaultDest = path.join(os.homedir(), '.claude', 'skills', 'appshot');
        const skillDest = opts.path ? path.resolve(opts.path) : defaultDest;

        // Check if source exists
        if (!await fileExists(skillSource)) {
          console.error(pc.red('Error:'), 'Skill source not found. This may be a packaging issue.');
          process.exit(1);
        }

        // Handle uninstall
        if (opts.uninstall) {
          if (await fileExists(skillDest)) {
            await fs.rm(skillDest, { recursive: true });
            console.log(pc.green('✓'), `Uninstalled skill from ${pc.cyan(skillDest)}`);
          } else {
            console.log(pc.yellow('⚠'), 'Skill not installed at', pc.cyan(skillDest));
          }
          return;
        }

        // Check for existing installation
        if (await fileExists(skillDest) && !opts.force) {
          console.log(pc.yellow('⚠'), 'Skill already installed at', pc.cyan(skillDest));
          console.log(pc.dim('  Use --force to overwrite'));
          return;
        }

        // Remove existing if force
        if (await fileExists(skillDest)) {
          await fs.rm(skillDest, { recursive: true });
        }

        // Ensure parent directory exists
        await fs.mkdir(path.dirname(skillDest), { recursive: true });

        // Copy skill files
        const fileCount = await copyDir(skillSource, skillDest);

        console.log(pc.green('✓'), `Installed appshot skill (${fileCount} files)`);
        console.log(pc.dim('  Location:'), pc.cyan(skillDest));
        console.log();
        console.log(pc.bold('Skill contents:'));
        console.log(pc.dim('  • SKILL.md - Main documentation'));
        console.log(pc.dim('  • references/templates.md - 8 template styles'));
        console.log(pc.dim('  • references/gradients.md - 24 gradient presets'));
        console.log(pc.dim('  • references/fonts.md - 10 font families'));
        console.log(pc.dim('  • references/troubleshooting.md - Common fixes'));
        console.log();
        console.log(pc.green('Claude Code will now use the appshot skill for screenshot tasks.'));

      } catch (error) {
        console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return cmd;
}
