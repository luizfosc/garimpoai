/**
 * Error codes and handling for video downloader
 */

const ERROR_CODES = {
  VD001: {
    code: 'VD001',
    message: 'yt-dlp not found',
    suggestion: 'Install yt-dlp using: brew install yt-dlp (macOS) or pip install yt-dlp',
    severity: 'critical',
    recoverable: true,
    retryable: false
  },
  VD002: {
    code: 'VD002',
    message: 'Invalid URL',
    suggestion: 'Provide a valid video URL from a supported site (e.g., YouTube, Vimeo)',
    severity: 'error',
    recoverable: false,
    retryable: false
  },
  VD003: {
    code: 'VD003',
    message: 'Video unavailable',
    suggestion: 'Video may be private, deleted, or region-restricted. Verify the URL in a browser',
    severity: 'error',
    recoverable: false,
    retryable: false
  },
  VD004: {
    code: 'VD004',
    message: 'Network error',
    suggestion: 'Check your internet connection and try again',
    severity: 'error',
    recoverable: true,
    retryable: true
  },
  VD005: {
    code: 'VD005',
    message: 'Insufficient disk space',
    suggestion: 'Free up disk space or choose a different output directory',
    severity: 'critical',
    recoverable: true,
    retryable: false
  },
  VD006: {
    code: 'VD006',
    message: 'Format unavailable',
    suggestion: 'The requested quality/format is not available. Try "best" or a lower quality',
    severity: 'error',
    recoverable: true,
    retryable: false
  },
  VD007: {
    code: 'VD007',
    message: 'Process error',
    suggestion: 'yt-dlp process failed unexpectedly. Check logs for details',
    severity: 'error',
    recoverable: true,
    retryable: true
  },
  VD008: {
    code: 'VD008',
    message: 'Download cancelled',
    suggestion: 'Download was cancelled by user',
    severity: 'warning',
    recoverable: true,
    retryable: true
  },
  VD009: {
    code: 'VD009',
    message: 'Playlist error',
    suggestion: 'Failed to process playlist. Try downloading individual videos',
    severity: 'error',
    recoverable: true,
    retryable: false
  },
  VD010: {
    code: 'VD010',
    message: 'Metadata extraction failed',
    suggestion: 'Could not extract video metadata. Download may still work',
    severity: 'warning',
    recoverable: true,
    retryable: true
  },
  VD011: {
    code: 'VD011',
    message: 'Output path error',
    suggestion: 'Cannot write to output directory. Check permissions',
    severity: 'critical',
    recoverable: true,
    retryable: false
  },
  VD012: {
    code: 'VD012',
    message: 'ffmpeg not found',
    suggestion: 'Install ffmpeg for audio extraction and format conversion: brew install ffmpeg (macOS)',
    severity: 'error',
    recoverable: true,
    retryable: false
  }
};

/**
 * Create a VideoDownloaderError with structured information
 */
class VideoDownloaderError extends Error {
  constructor(code, details = {}) {
    const errorInfo = ERROR_CODES[code] || {
      code: 'VD999',
      message: 'Unknown error',
      suggestion: 'An unexpected error occurred',
      severity: 'error',
      recoverable: false,
      retryable: false
    };

    super(errorInfo.message);
    this.name = 'VideoDownloaderError';
    this.code = code;
    this.severity = errorInfo.severity;
    this.suggestion = errorInfo.suggestion;
    this.recoverable = errorInfo.recoverable;
    this.retryable = errorInfo.retryable;
    this.details = details;

    // Capture stack trace
    Error.captureStackTrace(this, VideoDownloaderError);
  }

  /**
   * Format error for user display
   */
  format() {
    return {
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
      severity: this.severity,
      recoverable: this.recoverable,
      retryable: this.retryable,
      details: this.details
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    return `[${this.code}] ${this.message}\n💡 ${this.suggestion}`;
  }
}

/**
 * Parse yt-dlp error output and map to error codes
 */
function parseYtDlpError(stderr) {
  const lowerError = stderr.toLowerCase();

  // Network errors
  if (lowerError.includes('unable to download') ||
      lowerError.includes('connection') ||
      lowerError.includes('timeout')) {
    return 'VD004';
  }

  // Video unavailable
  if (lowerError.includes('video unavailable') ||
      lowerError.includes('private video') ||
      lowerError.includes('this video is not available') ||
      lowerError.includes('removed by the uploader')) {
    return 'VD003';
  }

  // Format errors
  if (lowerError.includes('requested format not available') ||
      lowerError.includes('no video formats found')) {
    return 'VD006';
  }

  // Disk space
  if (lowerError.includes('no space left') ||
      lowerError.includes('disk full')) {
    return 'VD005';
  }

  // Playlist errors
  if (lowerError.includes('playlist') && lowerError.includes('error')) {
    return 'VD009';
  }

  // ffmpeg errors
  if (lowerError.includes('ffmpeg') && lowerError.includes('not found')) {
    return 'VD012';
  }

  // Generic process error
  return 'VD007';
}

/**
 * Handle error with retry logic
 */
function shouldRetry(error, attemptNumber, maxRetries = 3) {
  if (attemptNumber >= maxRetries) {
    return false;
  }

  if (error instanceof VideoDownloaderError) {
    return error.retryable;
  }

  return false;
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attemptNumber, baseDelay = 1000) {
  return Math.min(baseDelay * Math.pow(2, attemptNumber - 1), 10000);
}

module.exports = {
  ERROR_CODES,
  VideoDownloaderError,
  parseYtDlpError,
  shouldRetry,
  getRetryDelay
};
