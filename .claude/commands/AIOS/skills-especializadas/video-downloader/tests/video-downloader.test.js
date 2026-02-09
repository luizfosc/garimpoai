/**
 * Tests for Video Downloader
 */

const VideoDownloader = require('../scripts/video-downloader');
const YtDlpInstaller = require('../scripts/yt-dlp-installer');
const { QualitySelector } = require('../scripts/quality-selector');
const { VideoDownloaderError } = require('../scripts/error-codes');

// Mock child_process and fs
jest.mock('child_process');
jest.mock('fs');

describe('VideoDownloader', () => {
  describe('Initialization', () => {
    test('should initialize with default options', () => {
      const downloader = new VideoDownloader();

      expect(downloader.options.outputPath).toBeDefined();
      expect(downloader.options.maxConcurrent).toBe(3);
      expect(downloader.options.retries).toBe(3);
    });

    test('should accept custom options', () => {
      const downloader = new VideoDownloader({
        outputPath: '/custom/path',
        maxConcurrent: 5,
        retries: 5
      });

      expect(downloader.options.outputPath).toBe('/custom/path');
      expect(downloader.options.maxConcurrent).toBe(5);
      expect(downloader.options.retries).toBe(5);
    });

    test('should initialize quality selector', () => {
      const downloader = new VideoDownloader();

      expect(downloader.qualitySelector).toBeInstanceOf(QualitySelector);
    });

    test('should initialize installer', () => {
      const downloader = new VideoDownloader();

      expect(downloader.installer).toBeInstanceOf(YtDlpInstaller);
    });

    test('should initialize stats', () => {
      const downloader = new VideoDownloader();

      expect(downloader.stats).toEqual({
        total: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      });
    });
  });

  describe('URL Validation', () => {
    let downloader;

    beforeEach(() => {
      downloader = new VideoDownloader();
    });

    test('should accept valid YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(() => downloader.validateUrl(url)).not.toThrow();
    });

    test('should accept valid Vimeo URL', () => {
      const url = 'https://vimeo.com/123456789';
      expect(() => downloader.validateUrl(url)).not.toThrow();
    });

    test('should reject invalid URL', () => {
      const url = 'not-a-url';
      expect(() => downloader.validateUrl(url)).toThrow(VideoDownloaderError);
    });

    test('should reject null URL', () => {
      expect(() => downloader.validateUrl(null)).toThrow(VideoDownloaderError);
    });

    test('should reject empty string', () => {
      expect(() => downloader.validateUrl('')).toThrow(VideoDownloaderError);
    });

    test('should reject non-string URL', () => {
      expect(() => downloader.validateUrl(123)).toThrow(VideoDownloaderError);
    });
  });

  describe('buildYtDlpArgs', () => {
    let downloader;

    beforeEach(() => {
      downloader = new VideoDownloader({
        outputPath: '/test/path',
        outputTemplate: '%(title)s.%(ext)s'
      });
    });

    test('should build basic args', () => {
      const options = downloader.qualitySelector.buildDownloadOptions({
        quality: 'best'
      });

      const args = downloader.buildYtDlpArgs('https://youtube.com/watch?v=test', options);

      expect(args).toContain('-o');
      expect(args).toContain('/test/path/%(title)s.%(ext)s');
      expect(args).toContain('--newline');
      expect(args).toContain('https://youtube.com/watch?v=test');
    });

    test('should include format args', () => {
      const options = downloader.qualitySelector.buildDownloadOptions({
        quality: '720p'
      });

      const args = downloader.buildYtDlpArgs('https://youtube.com/watch?v=test', options);

      expect(args).toContain('-f');
      expect(args).toContain('bestvideo[height<=720]+bestaudio/best[height<=720]');
    });

    test('should include audio extraction args', () => {
      const options = downloader.qualitySelector.buildDownloadOptions({
        audioOnly: true,
        audioFormat: 'mp3'
      });

      const args = downloader.buildYtDlpArgs('https://youtube.com/watch?v=test', options);

      expect(args).toContain('--extract-audio');
      expect(args).toContain('--audio-format');
      expect(args).toContain('mp3');
    });

    test('should include thumbnail args', () => {
      const options = downloader.qualitySelector.buildDownloadOptions({
        downloadThumbnail: true,
        convertThumbnail: 'jpg'
      });

      const args = downloader.buildYtDlpArgs('https://youtube.com/watch?v=test', options);

      expect(args).toContain('--write-thumbnail');
      expect(args).toContain('--convert-thumbnails');
      expect(args).toContain('jpg');
    });

    test('should include subtitle args', () => {
      const options = downloader.qualitySelector.buildDownloadOptions({
        writeSubtitles: true,
        subtitleLanguages: ['pt', 'en']
      });

      const args = downloader.buildYtDlpArgs('https://youtube.com/watch?v=test', options);

      expect(args).toContain('--write-subs');
      expect(args).toContain('--sub-langs');
      expect(args).toContain('pt,en');
    });

    test('should include metadata args', () => {
      const options = downloader.qualitySelector.buildDownloadOptions({
        writeMetadata: true
      });

      const args = downloader.buildYtDlpArgs('https://youtube.com/watch?v=test', options);

      expect(args).toContain('--write-info-json');
      expect(args).toContain('--embed-metadata');
    });

    test('should include rate limit if specified', () => {
      downloader.options.rateLimit = '1M';

      const options = downloader.qualitySelector.buildDownloadOptions({});
      const args = downloader.buildYtDlpArgs('https://youtube.com/watch?v=test', options);

      expect(args).toContain('--limit-rate');
      expect(args).toContain('1M');
    });
  });

  describe('generateSummary', () => {
    let downloader;

    beforeEach(() => {
      downloader = new VideoDownloader();
    });

    test('should generate summary with no downloads', () => {
      const summary = downloader.generateSummary();

      expect(summary).toEqual({
        total: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        successRate: 0
      });
    });

    test('should calculate success rate correctly', () => {
      downloader.stats = {
        total: 10,
        completed: 7,
        failed: 2,
        cancelled: 1
      };

      const summary = downloader.generateSummary();

      expect(summary.successRate).toBe('70.00');
    });

    test('should handle 100% success rate', () => {
      downloader.stats = {
        total: 5,
        completed: 5,
        failed: 0,
        cancelled: 0
      };

      const summary = downloader.generateSummary();

      expect(summary.successRate).toBe('100.00');
    });
  });
});

describe('YtDlpInstaller', () => {
  describe('getInstallationMethods', () => {
    test('should return methods for macOS', () => {
      const installer = new YtDlpInstaller();
      // Mock platform
      installer.platform = 'darwin';

      const methods = installer.getInstallationMethods();

      expect(methods).toBeInstanceOf(Array);
      expect(methods.length).toBeGreaterThan(0);

      const homebrew = methods.find(m => m.name === 'Homebrew');
      expect(homebrew).toBeDefined();
      expect(homebrew.recommended).toBe(true);
    });

    test('should return methods for Linux', () => {
      const installer = new YtDlpInstaller();
      installer.platform = 'linux';

      const methods = installer.getInstallationMethods();

      const pip = methods.find(m => m.name === 'pip');
      expect(pip).toBeDefined();
      expect(pip.recommended).toBe(true);
    });

    test('should return methods for Windows', () => {
      const installer = new YtDlpInstaller();
      installer.platform = 'win32';

      const methods = installer.getInstallationMethods();

      const winget = methods.find(m => m.name === 'winget');
      expect(winget).toBeDefined();
      expect(winget.recommended).toBe(true);
    });
  });

  describe('getFfmpegInstallCommand', () => {
    test('should return correct command for macOS', () => {
      const installer = new YtDlpInstaller();
      installer.platform = 'darwin';

      const command = installer.getFfmpegInstallCommand();

      expect(command).toBe('brew install ffmpeg');
    });

    test('should return correct command for Linux', () => {
      const installer = new YtDlpInstaller();
      installer.platform = 'linux';

      const command = installer.getFfmpegInstallCommand();

      expect(command).toBe('sudo apt install ffmpeg');
    });

    test('should return correct command for Windows', () => {
      const installer = new YtDlpInstaller();
      installer.platform = 'win32';

      const command = installer.getFfmpegInstallCommand();

      expect(command).toBe('winget install ffmpeg');
    });
  });
});

describe('QualitySelector', () => {
  describe('buildFormatArgs', () => {
    let selector;

    beforeEach(() => {
      selector = new QualitySelector();
    });

    test('should build args for video quality', () => {
      const args = selector.buildFormatArgs({
        quality: '720p',
        container: 'mp4'
      });

      expect(args).toContain('-f');
      expect(args).toContain('bestvideo[height<=720]+bestaudio/best[height<=720]');
      expect(args).toContain('--merge-output-format');
      expect(args).toContain('mp4');
    });

    test('should build args for audio only', () => {
      const args = selector.buildFormatArgs({
        audioOnly: true,
        audioFormat: 'mp3'
      });

      expect(args).toContain('-f');
      expect(args).toContain('bestaudio');
      expect(args).toContain('--extract-audio');
      expect(args).toContain('--audio-format');
      expect(args).toContain('mp3');
    });

    test('should default to best quality', () => {
      const args = selector.buildFormatArgs({});

      expect(args).toContain('bestvideo+bestaudio/best');
    });
  });

  describe('parseQuality', () => {
    let selector;

    beforeEach(() => {
      selector = new QualitySelector();
    });

    test('should parse quality with p suffix', () => {
      expect(selector.parseQuality('720p')).toBe('720p');
      expect(selector.parseQuality('1080p')).toBe('1080p');
    });

    test('should parse quality without p suffix', () => {
      expect(selector.parseQuality('720')).toBe('720p');
      expect(selector.parseQuality('1080')).toBe('1080p');
    });

    test('should parse special qualities', () => {
      expect(selector.parseQuality('best')).toBe('best');
      expect(selector.parseQuality('worst')).toBe('worst');
      expect(selector.parseQuality('4k')).toBe('4k');
    });

    test('should default to best for unknown', () => {
      expect(selector.parseQuality('unknown')).toBe('best');
      expect(selector.parseQuality('9999p')).toBe('best');
    });

    test('should handle null/undefined', () => {
      expect(selector.parseQuality(null)).toBe('best');
      expect(selector.parseQuality(undefined)).toBe('best');
    });
  });

  describe('validateOptions', () => {
    let selector;

    beforeEach(() => {
      selector = new QualitySelector();
    });

    test('should validate correct options', () => {
      const result = selector.validateOptions({
        quality: '720p',
        audioFormat: 'mp3',
        container: 'mp4'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid quality', () => {
      const result = selector.validateOptions({
        quality: 'invalid'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid quality: invalid');
    });

    test('should reject invalid audio format', () => {
      const result = selector.validateOptions({
        audioFormat: 'invalid'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid audio format: invalid');
    });

    test('should reject invalid container', () => {
      const result = selector.validateOptions({
        container: 'invalid'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid container: invalid');
    });
  });

  describe('getFormatDescription', () => {
    let selector;

    beforeEach(() => {
      selector = new QualitySelector();
    });

    test('should describe video format', () => {
      const desc = selector.getFormatDescription({
        quality: '720p',
        container: 'mp4'
      });

      expect(desc).toContain('720p');
      expect(desc).toContain('MP4');
    });

    test('should describe audio format', () => {
      const desc = selector.getFormatDescription({
        audioOnly: true,
        audioFormat: 'mp3'
      });

      expect(desc).toContain('Audio only');
      expect(desc).toContain('MP3');
    });
  });
});

describe('Error Handling', () => {
  describe('VideoDownloaderError', () => {
    test('should create error with code', () => {
      const error = new VideoDownloaderError('VD001');

      expect(error.code).toBe('VD001');
      expect(error.message).toBe('yt-dlp not found');
      expect(error.severity).toBe('critical');
    });

    test('should include details', () => {
      const error = new VideoDownloaderError('VD002', { url: 'invalid' });

      expect(error.details).toEqual({ url: 'invalid' });
    });

    test('should format error', () => {
      const error = new VideoDownloaderError('VD003');
      const formatted = error.format();

      expect(formatted.code).toBe('VD003');
      expect(formatted.message).toBe('Video unavailable');
      expect(formatted.suggestion).toBeDefined();
    });

    test('should get user message', () => {
      const error = new VideoDownloaderError('VD004');
      const message = error.getUserMessage();

      expect(message).toContain('[VD004]');
      expect(message).toContain('Network error');
      expect(message).toContain('💡');
    });
  });
});
