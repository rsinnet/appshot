import path from 'path';

export interface BuildToolArgs {
  devices?: string[];
  presets?: string[];
  languages?: string[];
  configPath?: string;
  dryRun?: boolean;
  preview?: boolean;
  noFrame?: boolean;
  noGradient?: boolean;
  noCaption?: boolean;
  autoCaption?: boolean;
  backgroundImage?: string;
  backgroundFit?: 'cover' | 'contain' | 'fill' | 'scale-down';
  autoBackground?: boolean;
  noBackground?: boolean;
  outputDir?: string;
  verbose?: boolean;
  concurrency?: number;
}

export interface FrameToolArgs {
  input: string;
  outputDir?: string;
  device?: string;
  recursive?: boolean;
  format?: 'png' | 'jpeg';
  suffix?: string;
  overwrite?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  frameTone?: 'original' | 'neutral';
}

export interface ExportToolArgs {
  format?: string;
  sourceDir?: string;
  outputDir?: string;
  languages?: string[];
  devices?: string[];
  copy?: boolean;
  flatten?: boolean;
  prefixDevice?: boolean;
  order?: boolean;
  clean?: boolean;
  generateConfig?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  json?: boolean;
  configPath?: string;
}

export interface InitToolArgs {
  force?: boolean;
}

export interface SpecsToolArgs {
  device?: string;
  required?: boolean;
}

export interface ValidateToolArgs {
  strict?: boolean;
  fix?: boolean;
}

export interface CleanToolArgs {
  outputDir?: string;
  all?: boolean;
  history?: boolean;
  keepHistory?: boolean;
}

export interface LocalizeToolArgs {
  languages: string[];
  device?: string;
  model?: string;
  sourceLanguage?: string;
  overwrite?: boolean;
}

export interface PresetsToolArgs {
  list?: boolean;
  required?: boolean;
  category?: string;
  generate?: string[];
  outputFile?: string;
}

export interface FontsToolArgs {
  action: 'list' | 'validate' | 'embedded';
  font?: string;
}

export interface TemplateToolArgs {
  template?: string;
  list?: boolean;
  preview?: string;
  caption?: string;
  captions?: string;
  device?: string;
  noBackup?: boolean;
  dryRun?: boolean;
}

export interface QuickstartToolArgs {
  template?: string;
  caption?: string;
  noInteractive?: boolean;
  force?: boolean;
}

function pushFlag(args: string[], flag: string, value?: string | number) {
  if (value === undefined || value === null) {
    return;
  }
  const stringValue = String(value);
  if (stringValue.length === 0) {
    return;
  }
  args.push(flag, stringValue);
}

function pushBoolean(args: string[], flag: string, enabled?: boolean) {
  if (enabled) {
    args.push(flag);
  }
}

function serializeList(values?: string[]) {
  return values && values.length > 0 ? values.join(',') : undefined;
}

export function createBuildArgs(input: BuildToolArgs): string[] {
  const args = ['build'];
  pushFlag(args, '--devices', serializeList(input.devices));
  pushFlag(args, '--preset', serializeList(input.presets));
  pushFlag(args, '--langs', serializeList(input.languages));
  pushFlag(args, '--config', input.configPath);
  pushFlag(args, '--background', input.backgroundImage);
  pushFlag(args, '--background-fit', input.backgroundFit);
  pushFlag(args, '--output', input.outputDir);
  if (input.concurrency && input.concurrency > 0) {
    pushFlag(args, '--concurrency', input.concurrency);
  }
  pushBoolean(args, '--dry-run', input.dryRun);
  pushBoolean(args, '--preview', input.preview);
  pushBoolean(args, '--no-frame', input.noFrame);
  pushBoolean(args, '--no-gradient', input.noGradient);
  pushBoolean(args, '--no-caption', input.noCaption);
  pushBoolean(args, '--auto-caption', input.autoCaption);
  pushBoolean(args, '--no-background', input.noBackground);
  pushBoolean(args, '--auto-background', input.autoBackground);
  pushBoolean(args, '--verbose', input.verbose);
  return args;
}

export function createFrameArgs(input: FrameToolArgs): string[] {
  const args = ['frame', path.normalize(input.input)];
  pushFlag(args, '--output', input.outputDir);
  pushFlag(args, '--device', input.device);
  pushFlag(args, '--format', input.format);
  pushFlag(args, '--suffix', input.suffix);
  pushBoolean(args, '--recursive', input.recursive);
  pushBoolean(args, '--overwrite', input.overwrite);
  pushBoolean(args, '--dry-run', input.dryRun);
  pushBoolean(args, '--verbose', input.verbose);
  if (input.frameTone && input.frameTone !== 'original') {
    pushFlag(args, '--frame-tone', input.frameTone);
  }
  return args;
}

export function createExportArgs(input: ExportToolArgs): string[] {
  const args = ['export'];
  if (input.format && input.format !== 'fastlane') {
    args.push(input.format);
  }
  pushFlag(args, '--source', input.sourceDir);
  pushFlag(args, '--output', input.outputDir);
  pushFlag(args, '--langs', serializeList(input.languages));
  pushFlag(args, '--devices', serializeList(input.devices));
  pushFlag(args, '--config', input.configPath);
  pushBoolean(args, '--copy', input.copy);
  pushBoolean(args, '--flatten', input.flatten);
  pushBoolean(args, '--prefix-device', input.prefixDevice);
  pushBoolean(args, '--order', input.order);
  pushBoolean(args, '--clean', input.clean);
  pushBoolean(args, '--generate-config', input.generateConfig);
  pushBoolean(args, '--dry-run', input.dryRun);
  pushBoolean(args, '--verbose', input.verbose);
  pushBoolean(args, '--json', input.json);
  return args;
}

export function createInitArgs(input: InitToolArgs): string[] {
  const args = ['init'];
  pushBoolean(args, '--force', input.force);
  return args;
}

export function createSpecsArgs(input: SpecsToolArgs): string[] {
  const args = ['specs'];
  pushFlag(args, '--device', input.device);
  pushBoolean(args, '--required', input.required);
  args.push('--json');
  return args;
}

export function createValidateArgs(input: ValidateToolArgs): string[] {
  const args = ['validate'];
  pushBoolean(args, '--strict', input.strict);
  pushBoolean(args, '--fix', input.fix);
  args.push('--json');
  return args;
}

export function createCleanArgs(input: CleanToolArgs): string[] {
  const args = ['clean'];
  pushFlag(args, '--output', input.outputDir);
  pushBoolean(args, '--all', input.all);
  pushBoolean(args, '--history', input.history);
  pushBoolean(args, '--keep-history', input.keepHistory);
  args.push('--yes');
  return args;
}

export function createLocalizeArgs(input: LocalizeToolArgs): string[] {
  const args = ['localize'];
  pushFlag(args, '--langs', serializeList(input.languages));
  pushFlag(args, '--device', input.device);
  pushFlag(args, '--model', input.model);
  pushFlag(args, '--source-language', input.sourceLanguage);
  pushBoolean(args, '--overwrite', input.overwrite);
  return args;
}

export function createPresetsArgs(input: PresetsToolArgs): string[] {
  const args = ['presets'];
  pushBoolean(args, '--list', input.list);
  pushBoolean(args, '--required', input.required);
  pushFlag(args, '--category', input.category);
  pushFlag(args, '--generate', serializeList(input.generate));
  pushFlag(args, '--output', input.outputFile);
  args.push('--json');
  return args;
}

export function createFontsArgs(input: FontsToolArgs): string[] {
  const args = ['fonts', '--json'];
  if (input.action === 'embedded') {
    args.push('--embedded');
  }
  if (input.action === 'validate' && input.font) {
    args.push('--validate', input.font);
  }
  return args;
}

export function createTemplateArgs(input: TemplateToolArgs): string[] {
  const args = ['template'];
  if (input.template) {
    args.push(input.template);
  }
  pushBoolean(args, '--list', input.list);
  pushFlag(args, '--preview', input.preview);
  pushFlag(args, '--caption', input.caption);
  pushFlag(args, '--captions', input.captions);
  pushFlag(args, '--device', input.device);
  pushBoolean(args, '--no-backup', input.noBackup);
  pushBoolean(args, '--dry-run', input.dryRun);
  return args;
}

export function createQuickstartArgs(input: QuickstartToolArgs): string[] {
  const args = ['quickstart'];
  pushFlag(args, '--template', input.template);
  pushFlag(args, '--caption', input.caption);
  pushBoolean(args, '--no-interactive', input.noInteractive);
  pushBoolean(args, '--force', input.force);
  return args;
}
