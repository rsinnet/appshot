import type { DeviceStrategyV2 } from '../../types.js';
import { iphoneStrategyV2 } from './iphone.js';
import { ipadStrategyV2 } from './ipad.js';
import { macStrategyV2 } from './mac.js';
import { watchStrategyV2 } from './watch.js';

export { iphoneStrategyV2, ipadStrategyV2, macStrategyV2, watchStrategyV2 };

export function getDeviceStrategyV2(deviceType: DeviceStrategyV2['deviceType']): DeviceStrategyV2 {
  switch (deviceType) {
  case 'iphone':
    return iphoneStrategyV2;
  case 'ipad':
    return ipadStrategyV2;
  case 'mac':
    return macStrategyV2;
  case 'watch':
    return watchStrategyV2;
  default: {
    const exhaustiveCheck: never = deviceType;
    return exhaustiveCheck;
  }
  }
}
