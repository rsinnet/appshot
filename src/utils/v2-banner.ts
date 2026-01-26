import pc from 'picocolors';

export function showV1DeprecationBanner(): void {
  console.log(
    pc.yellow('\n╔══════════════════════════════════════════════════════════════╗') +
    pc.yellow('\n║ ⚠️  Deprecated config format detected                         ║') +
    pc.yellow('\n║                                                              ║') +
    pc.yellow('\n║ Your .appshot/config.json uses v1 layout settings. v1 is      ║') +
    pc.yellow('\n║ deprecated in 2.x and will be removed in 3.0.                 ║') +
    pc.yellow('\n║                                                              ║') +
    pc.yellow('\n║ Run: appshot migrate                                          ║') +
    pc.yellow('\n║                                                              ║') +
    pc.yellow('\n║ This will convert your config to the new v2 layout format.    ║') +
    pc.yellow('\n╚══════════════════════════════════════════════════════════════╝\n')
  );
}
