import pc from 'picocolors';

export type SpinnerOptions = {
  enabled?: boolean;
  stream?: NodeJS.WriteStream;
  intervalMs?: number;
};

const DEFAULT_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private enabled: boolean;
  private stream: NodeJS.WriteStream;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private text = '';

  constructor(options: SpinnerOptions = {}) {
    this.stream = options.stream ?? process.stdout;
    this.intervalMs = options.intervalMs ?? 80;
    this.enabled = options.enabled ?? this.stream.isTTY ?? false;
  }

  start(text: string) {
    if (!this.enabled || this.timer) {
      this.text = text;
      return;
    }
    this.text = text;
    this.timer = setInterval(() => this.render(), this.intervalMs);
  }

  update(text: string) {
    this.text = text;
    if (!this.enabled) {
      return;
    }
    this.render();
  }

  succeed(text: string) {
    this.stop();
    if (this.enabled) {
      this.stream.write(`${pc.green('✓')} ${text}\n`);
    }
  }

  fail(text: string) {
    this.stop();
    if (this.enabled) {
      this.stream.write(`${pc.red('✗')} ${text}\n`);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.enabled) {
      this.stream.write('\r' + ' '.repeat(80) + '\r');
    }
  }

  private render() {
    if (!this.enabled) return;
    const frame = DEFAULT_FRAMES[this.frameIndex % DEFAULT_FRAMES.length];
    this.frameIndex += 1;
    const line = `${pc.cyan(frame)} ${this.text}`;
    this.stream.write('\r' + line.padEnd(80));
  }
}
