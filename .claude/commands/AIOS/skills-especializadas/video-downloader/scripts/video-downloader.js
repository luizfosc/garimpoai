/**
 * Core video downloader using yt-dlp
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const path = require('path');
const os = require('os');

const YtDlpInstaller = require('./yt-dlp-installer');
const { QualitySelector } = require('./quality-selector');
const { VideoDownloaderError, parseYtDlpError, shouldRetry, getRetryDelay } = require('./error-codes');

// Default output path
const DEFAULT_OUTPUT_PATH = path.join(os.homedir(), 'Dropbox', 'Downloads', 'YT');

class VideoDownloader extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      outputPath: options.outputPath || DEFAULT_OUTPUT_PATH,
      outputTemplate: options.outputTemplate || '%(title)s.%(ext)s',
      maxConcurrent: options.maxConcurrent || 3,
      retries: options.retries || 3,
      rateLimit: options.rateLimit || null,
      verbose: options.verbose || false,
      ...options
    };

    this.installer = new YtDlpInstaller({ verbose: this.options.verbose });
    this.qualitySelector = new QualitySelector({
      defaultQuality: this.options.defaultQuality || 'best',
      defaultFormat: this.options.defaultFormat || 'mp4'
    });

    this.activeDownloads = new Map();
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };
  }

  /**
   * Download one or more videos
   */
  async download(urls, downloadOptions = {}) {
    // Ensure yt-dlp is installed
    await this.ensureYtDlpInstalled();

    // Ensure output directory exists
    this.ensureOutputDirectory();

    // Convert single URL to array
    const urlList = Array.isArray(urls) ? urls : [urls];

    // Validate all URLs
    for (const url of urlList) {
      this.validateUrl(url);
    }

    this.stats.total = urlList.length;
    this.emit('download:started', { total: urlList.length, urls: urlList });

    const results = [];

    // Download sequentially for now (can be parallelized later)
    for (const url of urlList) {
      try {
        const result = await this.downloadSingle(url, downloadOptions);
        results.push(result);
        this.stats.completed++;
        this.emit('video:completed', result);
      } catch (error) {
        this.stats.failed++;
        const errorResult = {
          url,
          success: false,
          error: error.message,
          code: error.code
        };
        results.push(errorResult);
        this.emit('video:failed', errorResult);

        // Continue with other downloads even if one fails
        if (this.options.verbose) {
          console.error(`Failed to download ${url}:`, error.message);
        }
      }
    }

    this.emit('download:completed', {
      results,
      stats: this.generateSummary()
    });

    return {
      results,
      stats: this.generateSummary()
    };
  }

  /**
   * Download a single video
   */
  async downloadSingle(url, downloadOptions = {}, attemptNumber = 1) {
    const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Build download options
      const options = this.qualitySelector.buildDownloadOptions({
        ...this.options,
        ...downloadOptions
      });

      // Emit start event
      this.emit('video:started', {
        downloadId,
        url,
        options
      });

      // Extract metadata first
      let metadata = null;
      try {
        metadata = await this.extractMetadata(url);
        this.emit('metadata:extracted', { downloadId, url, metadata });
      } catch (error) {
        // Continue without metadata
        this.emit('metadata:failed', { downloadId, url, error: error.message });
      }

      // Build yt-dlp arguments
      const args = this.buildYtDlpArgs(url, options);

      if (this.options.verbose) {
        console.log('yt-dlp command:', 'yt-dlp', args.join(' '));
      }

      // Execute download
      const result = await this.executeDownload(downloadId, args, url, metadata);

      return {
        downloadId,
        url,
        success: true,
        metadata,
        ...result
      };

    } catch (error) {
      // Retry logic
      if (shouldRetry(error, attemptNumber, this.options.retries)) {
        const delay = getRetryDelay(attemptNumber);

        this.emit('download:retrying', {
          downloadId,
          url,
          attemptNumber,
          maxRetries: this.options.retries,
          delay
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.downloadSingle(url, downloadOptions, attemptNumber + 1);
      }

      // Cleanup on failure
      this.activeDownloads.delete(downloadId);

      throw error;
    }
  }

  /**
   * Extract metadata from video URL
   */
  async extractMetadata(url) {
    return new Promise((resolve, reject) => {
      const ytdlpPath = this.installer.getExecutablePath();
      const args = [
        '--dump-json',
        '--no-playlist',
        url
      ];

      const process = spawn(ytdlpPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          const errorCode = parseYtDlpError(stderr);
          reject(new VideoDownloaderError(errorCode, { stderr, code }));
          return;
        }

        try {
          const metadata = JSON.parse(stdout);
          resolve({
            title: metadata.title,
            uploader: metadata.uploader,
            duration: metadata.duration,
            thumbnail: metadata.thumbnail,
            description: metadata.description,
            uploadDate: metadata.upload_date,
            viewCount: metadata.view_count,
            likeCount: metadata.like_count,
            formats: metadata.formats?.length || 0
          });
        } catch (error) {
          reject(new VideoDownloaderError('VD010', { error: error.message }));
        }
      });
    });
  }

  /**
   * Build yt-dlp arguments
   */
  buildYtDlpArgs(url, options) {
    const outputPath = path.join(
      this.options.outputPath,
      this.options.outputTemplate
    );

    const args = [
      '-o', outputPath
    ];

    // Format selection
    const formatArgs = this.qualitySelector.buildFormatArgs(options);
    args.push(...formatArgs);

    // Metadata
    if (options.writeMetadata) {
      args.push('--write-info-json');
      args.push('--embed-metadata');
    }

    // Thumbnail
    if (options.downloadThumbnail) {
      args.push('--write-thumbnail');
      if (options.convertThumbnail) {
        args.push('--convert-thumbnails', options.convertThumbnail);
      }
    }

    // Subtitles
    if (options.writeSubtitles) {
      args.push('--write-subs');
      if (options.subtitleLanguages && options.subtitleLanguages.length > 0) {
        args.push('--sub-langs', options.subtitleLanguages.join(','));
      }
    }

    if (options.autoSubtitles) {
      args.push('--write-auto-subs');
    }

    if (options.embedSubtitles) {
      args.push('--embed-subs');
    }

    // Rate limiting
    if (this.options.rateLimit) {
      args.push('--limit-rate', this.options.rateLimit);
    }

    // Progress
    args.push('--newline'); // Force newlines for progress parsing

    // URL
    args.push(url);

    return args;
  }

  /**
   * Execute yt-dlp download with progress tracking
   */
  async executeDownload(downloadId, args, url, metadata) {
    return new Promise((resolve, reject) => {
      const ytdlpPath = this.installer.getExecutablePath();

      const process = spawn(ytdlpPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.activeDownloads.set(downloadId, process);

      let stderr = '';
      let lastProgress = null;

      process.stdout.on('data', (data) => {
        const output = data.toString();

        // Parse progress
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (progressMatch) {
          const percentage = parseFloat(progressMatch[1]);
          if (percentage !== lastProgress) {
            lastProgress = percentage;
            this.emit('progress', {
              downloadId,
              url,
              percentage,
              metadata
            });
          }
        }

        // Check for completion
        if (output.includes('[download] 100%') || output.includes('has already been downloaded')) {
          this.emit('progress', {
            downloadId,
            url,
            percentage: 100,
            metadata
          });
        }
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        this.activeDownloads.delete(downloadId);

        if (code !== 0) {
          const errorCode = parseYtDlpError(stderr);
          reject(new VideoDownloaderError(errorCode, { stderr, code }));
          return;
        }

        resolve({
          outputPath: this.options.outputPath,
          filename: metadata?.title || 'Unknown'
        });
      });

      process.on('error', (error) => {
        this.activeDownloads.delete(downloadId);
        reject(new VideoDownloaderError('VD007', { error: error.message }));
      });
    });
  }

  /**
   * Validate URL
   */
  validateUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new VideoDownloaderError('VD002', { url });
    }

    try {
      new URL(url);
    } catch (error) {
      throw new VideoDownloaderError('VD002', { url });
    }

    return true;
  }

  /**
   * Ensure yt-dlp is installed
   */
  async ensureYtDlpInstalled() {
    const result = await this.installer.checkInstalled();

    if (!result.installed) {
      throw new VideoDownloaderError('VD001', {
        methods: this.installer.getInstallationMethods()
      });
    }

    return result;
  }

  /**
   * Ensure output directory exists
   */
  ensureOutputDirectory() {
    if (!existsSync(this.options.outputPath)) {
      try {
        mkdirSync(this.options.outputPath, { recursive: true });
      } catch (error) {
        throw new VideoDownloaderError('VD011', {
          path: this.options.outputPath,
          error: error.message
        });
      }
    }
  }

  /**
   * Cancel all active downloads
   */
  cancel() {
    for (const [downloadId, process] of this.activeDownloads.entries()) {
      process.kill('SIGTERM');
      this.stats.cancelled++;
      this.emit('download:cancelled', { downloadId });
    }

    this.activeDownloads.clear();
    throw new VideoDownloaderError('VD008');
  }

  /**
   * Generate download summary
   */
  generateSummary() {
    return {
      total: this.stats.total,
      completed: this.stats.completed,
      failed: this.stats.failed,
      cancelled: this.stats.cancelled,
      successRate: this.stats.total > 0
        ? ((this.stats.completed / this.stats.total) * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Get system diagnostics
   */
  async getDiagnostics() {
    const systemInfo = this.installer.getSystemInfo();
    const outputPathExists = existsSync(this.options.outputPath);

    return {
      system: systemInfo,
      config: {
        outputPath: this.options.outputPath,
        outputPathExists,
        defaultQuality: this.options.defaultQuality,
        defaultFormat: this.options.defaultFormat,
        maxConcurrent: this.options.maxConcurrent,
        retries: this.options.retries
      },
      stats: this.stats
    };
  }
}

module.exports = VideoDownloader;
