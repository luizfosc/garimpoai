/**
 * Quality and format selection for video downloads
 */

const QUALITY_PRESETS = {
  '4k': {
    height: 2160,
    format: 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
    description: '4K (2160p) - Highest quality'
  },
  '1080p': {
    height: 1080,
    format: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    description: 'Full HD (1080p)'
  },
  '720p': {
    height: 720,
    format: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    description: 'HD (720p)'
  },
  '480p': {
    height: 480,
    format: 'bestvideo[height<=480]+bestaudio/best[height<=480]',
    description: 'SD (480p)'
  },
  '360p': {
    height: 360,
    format: 'bestvideo[height<=360]+bestaudio/best[height<=360]',
    description: 'Low quality (360p)'
  },
  'best': {
    height: null,
    format: 'bestvideo+bestaudio/best',
    description: 'Best available quality'
  },
  'worst': {
    height: null,
    format: 'worstvideo+worstaudio/worst',
    description: 'Lowest available quality'
  }
};

const AUDIO_FORMATS = {
  'mp3': {
    format: 'bestaudio',
    extractAudio: true,
    audioFormat: 'mp3',
    description: 'MP3 audio'
  },
  'm4a': {
    format: 'bestaudio',
    extractAudio: true,
    audioFormat: 'm4a',
    description: 'M4A audio'
  },
  'wav': {
    format: 'bestaudio',
    extractAudio: true,
    audioFormat: 'wav',
    description: 'WAV audio (uncompressed)'
  },
  'opus': {
    format: 'bestaudio',
    extractAudio: true,
    audioFormat: 'opus',
    description: 'Opus audio'
  },
  'flac': {
    format: 'bestaudio',
    extractAudio: true,
    audioFormat: 'flac',
    description: 'FLAC audio (lossless)'
  }
};

const VIDEO_CONTAINERS = {
  'mp4': 'mp4',
  'mkv': 'mkv',
  'webm': 'webm',
  'avi': 'avi',
  'mov': 'mov'
};

class QualitySelector {
  constructor(options = {}) {
    this.defaultQuality = options.defaultQuality || 'best';
    this.defaultFormat = options.defaultFormat || 'mp4';
  }

  /**
   * Build format arguments for yt-dlp
   */
  buildFormatArgs(options = {}) {
    const args = [];

    // Audio-only download
    if (options.audioOnly) {
      const audioFormat = options.audioFormat || 'mp3';
      const audioConfig = AUDIO_FORMATS[audioFormat] || AUDIO_FORMATS.mp3;

      args.push('-f', audioConfig.format);

      if (audioConfig.extractAudio) {
        args.push('--extract-audio');
        args.push('--audio-format', audioConfig.audioFormat);
      }

      // Audio quality
      if (options.audioQuality) {
        args.push('--audio-quality', options.audioQuality);
      }

      return args;
    }

    // Video download with quality selection
    const quality = options.quality || this.defaultQuality;
    const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.best;

    args.push('-f', preset.format);

    // Merge format (container)
    const container = options.container || this.defaultFormat;
    if (VIDEO_CONTAINERS[container]) {
      args.push('--merge-output-format', container);
    }

    return args;
  }

  /**
   * Get available quality presets
   */
  getQualityPresets() {
    return Object.entries(QUALITY_PRESETS).map(([key, value]) => ({
      key,
      ...value
    }));
  }

  /**
   * Get available audio formats
   */
  getAudioFormats() {
    return Object.entries(AUDIO_FORMATS).map(([key, value]) => ({
      key,
      ...value
    }));
  }

  /**
   * Get available video containers
   */
  getVideoContainers() {
    return Object.keys(VIDEO_CONTAINERS);
  }

  /**
   * Parse quality from string (e.g., "1080p", "720", "best")
   */
  parseQuality(qualityStr) {
    if (!qualityStr) {
      return this.defaultQuality;
    }

    const normalized = qualityStr.toLowerCase().replace(/p$/, '');

    // Check if it matches a preset
    if (QUALITY_PRESETS[normalized]) {
      return normalized;
    }

    // Check with 'p' suffix
    const withSuffix = `${normalized}p`;
    if (QUALITY_PRESETS[withSuffix]) {
      return withSuffix;
    }

    // Default to best if unknown
    return this.defaultQuality;
  }

  /**
   * Build complete download options
   */
  buildDownloadOptions(userOptions = {}) {
    const options = {
      quality: this.parseQuality(userOptions.quality),
      container: userOptions.container || this.defaultFormat,
      audioOnly: userOptions.audioOnly || false,
      audioFormat: userOptions.audioFormat || 'mp3',
      audioQuality: userOptions.audioQuality || '0', // 0 = best
      downloadThumbnail: userOptions.downloadThumbnail !== false,
      convertThumbnail: userOptions.convertThumbnail || 'jpg',
      writeSubtitles: userOptions.writeSubtitles || false,
      autoSubtitles: userOptions.autoSubtitles || false,
      embedSubtitles: userOptions.embedSubtitles || false,
      subtitleLanguages: userOptions.subtitleLanguages || ['pt', 'en'],
      writeMetadata: userOptions.writeMetadata !== false
    };

    return options;
  }

  /**
   * Get format description for display
   */
  getFormatDescription(options) {
    if (options.audioOnly) {
      const audioFormat = options.audioFormat || 'mp3';
      return `Audio only (${audioFormat.toUpperCase()})`;
    }

    const quality = options.quality || this.defaultQuality;
    const preset = QUALITY_PRESETS[quality];
    const container = options.container || this.defaultFormat;

    return `${preset.description} (${container.toUpperCase()})`;
  }

  /**
   * Validate format options
   */
  validateOptions(options) {
    const errors = [];

    if (options.quality && !QUALITY_PRESETS[options.quality]) {
      errors.push(`Invalid quality: ${options.quality}`);
    }

    if (options.audioFormat && !AUDIO_FORMATS[options.audioFormat]) {
      errors.push(`Invalid audio format: ${options.audioFormat}`);
    }

    if (options.container && !VIDEO_CONTAINERS[options.container]) {
      errors.push(`Invalid container: ${options.container}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = {
  QualitySelector,
  QUALITY_PRESETS,
  AUDIO_FORMATS,
  VIDEO_CONTAINERS
};
