import path from 'path';

/**
 * Convert a filename to a human-readable caption.
 * Examples:
 *   "hello-world.png" → "Hello World"
 *   "my_screenshot.png" → "My Screenshot"
 *   "app-home_screen.PNG" → "App Home Screen"
 */
export function filenameToCaption(filename: string): string {
  const name = path.basename(filename, path.extname(filename));
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
