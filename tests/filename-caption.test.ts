import { describe, it, expect } from 'vitest';
import { filenameToCaption } from '../src/utils/filename-caption.js';

describe('filenameToCaption', () => {
  it('should convert hyphenated filename to title case', () => {
    expect(filenameToCaption('hello-world.png')).toBe('Hello World');
  });

  it('should convert underscored filename to title case', () => {
    expect(filenameToCaption('my_screenshot.png')).toBe('My Screenshot');
  });

  it('should handle mixed hyphens and underscores', () => {
    expect(filenameToCaption('app-home_screen.PNG')).toBe('App Home Screen');
  });

  it('should normalize multiple spaces', () => {
    expect(filenameToCaption('hello--world__test.png')).toBe('Hello World Test');
  });

  it('should handle single word filename', () => {
    expect(filenameToCaption('screenshot.png')).toBe('Screenshot');
  });

  it('should handle uppercase input', () => {
    // Note: function only capitalizes first letter, preserves rest of case
    expect(filenameToCaption('MY-APP-SCREEN.png')).toBe('MY APP SCREEN');
  });

  it('should handle mixed case input', () => {
    expect(filenameToCaption('myApp-Screen.png')).toBe('MyApp Screen');
  });

  it('should handle different extensions', () => {
    expect(filenameToCaption('test-image.jpg')).toBe('Test Image');
    expect(filenameToCaption('test-image.jpeg')).toBe('Test Image');
    expect(filenameToCaption('test-image.PNG')).toBe('Test Image');
  });

  it('should handle path with directories', () => {
    expect(filenameToCaption('/path/to/hello-world.png')).toBe('Hello World');
  });

  it('should handle numbers in filename', () => {
    expect(filenameToCaption('screen-01.png')).toBe('Screen 01');
    expect(filenameToCaption('version_2_update.png')).toBe('Version 2 Update');
  });

  it('should trim leading and trailing spaces', () => {
    expect(filenameToCaption('-test-.png')).toBe('Test');
    expect(filenameToCaption('_test_.png')).toBe('Test');
  });

  it('should handle empty name after stripping', () => {
    expect(filenameToCaption('---.png')).toBe('');
    expect(filenameToCaption('___.png')).toBe('');
  });
});
