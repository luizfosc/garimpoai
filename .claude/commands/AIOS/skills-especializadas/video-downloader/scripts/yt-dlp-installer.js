/**
 * yt-dlp installation and detection utilities
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');
const os = require('os');
const { VideoDownloaderError } = require('./error-codes');

class YtDlpInstaller {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.platform = os.platform();
  }

  /**
   * Check if yt-dlp is installed
   */
  async checkInstalled() {
    try {
      const path = this.getExecutablePath();
      if (path) {
        const version = this.getVersion();
        return {
          installed: true,
          path,
          version
        };
      }
      return { installed: false };
    } catch (error) {
      return { installed: false };
    }
  }

  /**
   * Get yt-dlp executable path
   */
  getExecutablePath() {
    // Check common paths
    const commonPaths = [
      '/opt/homebrew/bin/yt-dlp',           // Homebrew Apple Silicon
      '/usr/local/bin/yt-dlp',              // Homebrew Intel
      '/usr/bin/yt-dlp',                    // Linux system
      join(os.homedir(), '.local/bin/yt-dlp'), // pip user install
      join(os.homedir(), 'bin/yt-dlp')      // Manual install
    ];

    for (const path of commonPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    // Try to find in PATH
    try {
      const path = execSync('which yt-dlp', { encoding: 'utf8' }).trim();
      if (path && existsSync(path)) {
        return path;
      }
    } catch (error) {
      // Not in PATH
    }

    return null;
  }

  /**
   * Get yt-dlp version
   */
  getVersion() {
    try {
      const version = execSync('yt-dlp --version', { encoding: 'utf8' }).trim();
      return version;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get installation methods for current platform
   */
  getInstallationMethods() {
    const methods = {
      darwin: [
        {
          name: 'Homebrew',
          command: 'brew install yt-dlp',
          recommended: true,
          description: 'Install via Homebrew (recommended for macOS)'
        },
        {
          name: 'pip',
          command: 'pip3 install yt-dlp',
          recommended: false,
          description: 'Install via Python pip'
        },
        {
          name: 'pipx',
          command: 'pipx install yt-dlp',
          recommended: false,
          description: 'Install via pipx (isolated environment)'
        },
        {
          name: 'Binary',
          command: 'curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp',
          recommended: false,
          description: 'Download binary directly'
        }
      ],
      linux: [
        {
          name: 'pip',
          command: 'pip3 install yt-dlp',
          recommended: true,
          description: 'Install via Python pip'
        },
        {
          name: 'apt',
          command: 'sudo apt install yt-dlp',
          recommended: false,
          description: 'Install via apt (Ubuntu/Debian)'
        },
        {
          name: 'pipx',
          command: 'pipx install yt-dlp',
          recommended: false,
          description: 'Install via pipx (isolated environment)'
        },
        {
          name: 'Binary',
          command: 'curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp',
          recommended: false,
          description: 'Download binary directly'
        }
      ],
      win32: [
        {
          name: 'winget',
          command: 'winget install yt-dlp',
          recommended: true,
          description: 'Install via Windows Package Manager'
        },
        {
          name: 'scoop',
          command: 'scoop install yt-dlp',
          recommended: false,
          description: 'Install via Scoop'
        },
        {
          name: 'pip',
          command: 'pip install yt-dlp',
          recommended: false,
          description: 'Install via Python pip'
        }
      ]
    };

    return methods[this.platform] || methods.linux;
  }

  /**
   * Auto-install yt-dlp using the best method for current platform
   */
  async install() {
    const methods = this.getInstallationMethods();
    const recommendedMethod = methods.find(m => m.recommended);

    if (!recommendedMethod) {
      throw new VideoDownloaderError('VD001', {
        platform: this.platform,
        methods: methods.map(m => m.command)
      });
    }

    if (this.verbose) {
      console.log(`Installing yt-dlp using: ${recommendedMethod.name}`);
      console.log(`Command: ${recommendedMethod.command}`);
    }

    try {
      // Try recommended method
      execSync(recommendedMethod.command, {
        encoding: 'utf8',
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      // Verify installation
      const result = await this.checkInstalled();
      if (!result.installed) {
        throw new Error('Installation completed but yt-dlp not found');
      }

      return result;
    } catch (error) {
      throw new VideoDownloaderError('VD001', {
        platform: this.platform,
        method: recommendedMethod.name,
        error: error.message,
        allMethods: methods
      });
    }
  }

  /**
   * Check if ffmpeg is installed (required for some operations)
   */
  checkFfmpegInstalled() {
    try {
      execSync('ffmpeg -version', { encoding: 'utf8', stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get ffmpeg installation command
   */
  getFfmpegInstallCommand() {
    const commands = {
      darwin: 'brew install ffmpeg',
      linux: 'sudo apt install ffmpeg',
      win32: 'winget install ffmpeg'
    };

    return commands[this.platform] || 'Install ffmpeg for your platform';
  }

  /**
   * Ensure yt-dlp is installed, prompt user if not
   */
  async ensureInstalled() {
    const result = await this.checkInstalled();

    if (!result.installed) {
      const methods = this.getInstallationMethods();
      const methodsList = methods
        .map(m => `  ${m.recommended ? '→' : ' '} ${m.command}`)
        .join('\n');

      throw new VideoDownloaderError('VD001', {
        platform: this.platform,
        methods: methodsList
      });
    }

    return result;
  }

  /**
   * Get system information for diagnostics
   */
  getSystemInfo() {
    const ytdlp = this.checkInstalled();
    const ffmpeg = this.checkFfmpegInstalled();

    return {
      platform: this.platform,
      arch: os.arch(),
      ytdlp: ytdlp.installed ? {
        installed: true,
        path: ytdlp.path,
        version: ytdlp.version
      } : { installed: false },
      ffmpeg: {
        installed: ffmpeg,
        installCommand: this.getFfmpegInstallCommand()
      }
    };
  }
}

module.exports = YtDlpInstaller;
