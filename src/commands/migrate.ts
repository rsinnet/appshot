import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import pc from 'picocolors';
import inquirer from 'inquirer';
import { loadConfig } from '../core/files.js';
import type { AppshotConfig } from '../types.js';
import { detectConfigVersion } from '../utils/config-version.js';
import { migrateConfigV1ToV2 } from '../utils/config-migration.js';

export default function migrateCmd() {
  const cmd = new Command('migrate')
    .description('Migrate v1 config to v2 layout format')
    .option('--config <file>', 'use specific config file', 'appshot.json')
    .option('--yes', 'skip confirmation prompt')
    .addHelpText('after', `
${pc.bold('Examples:')}
  ${pc.dim('# Migrate default config')}
  $ appshot migrate

  ${pc.dim('# Migrate a custom config path')}
  $ appshot migrate --config ./configs/appshot.json
`)
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config) as AppshotConfig;
        const version = detectConfigVersion(config);

        if (version === 2) {
          console.log(pc.green('Config is already v2. No migration needed.'));
          return;
        }

        const { config: v2Config, warnings } = migrateConfigV1ToV2(config);

        console.log(pc.bold('\nMigration preview:'));
        console.log(pc.dim(`  Layout: ${v2Config.layout}`));
        console.log(pc.dim(`  Devices: ${Object.keys(v2Config.devices).join(', ')}`));

        if (warnings.length > 0) {
          console.log(pc.yellow('\nNotes:'));
          for (const warning of warnings) {
            console.log(pc.dim(`  - ${warning}`));
          }
        }

        if (!opts.yes) {
          const confirm = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Proceed with migration?',
            default: true
          }]);
          if (!confirm.proceed) {
            console.log(pc.dim('Migration canceled.'));
            return;
          }
        }

        const root = process.cwd();
        const appshotDir = path.join(root, '.appshot');
        const configPath = opts.config && opts.config !== 'appshot.json'
          ? (path.isAbsolute(opts.config) ? opts.config : path.join(root, opts.config))
          : path.join(appshotDir, 'config.json');

        const backupPath = configPath.replace(/\.json$/i, '.v1.json');
        await fs.copyFile(configPath, backupPath);
        await fs.writeFile(configPath, JSON.stringify(v2Config, null, 2), 'utf8');

        console.log(pc.green('Migration complete.'));
        console.log(pc.dim(`  Backup saved to ${backupPath}`));
      } catch (error) {
        console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return cmd;
}
