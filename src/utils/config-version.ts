import type { AppshotConfigV2 } from '../types.js';

export type ConfigVersion = 1 | 2;

export function detectConfigVersion(config: unknown): ConfigVersion {
  if (config && typeof config === 'object' && (config as AppshotConfigV2).version === 2) {
    return 2;
  }
  return 1;
}

export function isV2Config(config: unknown): config is AppshotConfigV2 {
  return detectConfigVersion(config) === 2;
}
