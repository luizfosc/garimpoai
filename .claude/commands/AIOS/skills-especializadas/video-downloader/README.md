# Video Downloader Skill

Download videos from YouTube and 1000+ sites with quality selection, audio extraction, and metadata preservation.

## Quick Start

### Via Natural Language (Claude Code)

```
"Download this video: https://www.youtube.com/watch?v=VIDEO_ID"
"Download [URL] in 720p"
"Extract audio from [URL] as MP3"
"Download [URL] with thumbnail"
```

### Via Code

```javascript
const VideoDownloader = require('./scripts/video-downloader');

const downloader = new VideoDownloader();
await downloader.download('https://www.youtube.com/watch?v=VIDEO_ID');
```

## Installation

### 1. Install yt-dlp

**macOS:**
```bash
brew install yt-dlp
```

**Linux:**
```bash
pip3 install yt-dlp
```

**Windows:**
```powershell
winget install yt-dlp
```

### 2. Install ffmpeg (Optional - for audio extraction)

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

**Windows:**
```powershell
winget install ffmpeg
```

### 3. Verify Installation

```bash
yt-dlp --version
ffmpeg -version
```

## Features

### Core Features (P0)
- ✅ Download videos from 1000+ sites
- ✅ Quality selection (480p, 720p, 1080p, 4K)
- ✅ Audio-only extraction (MP3, M4A, FLAC, etc.)
- ✅ Auto-detect yt-dlp installation
- ✅ Robust error handling

### Enhanced Features (P1)
- ✅ Playlist download
- ✅ Metadata extraction
- ✅ **Thumbnail download (JPG/PNG/WebP)**
- ✅ Progress tracking
- ✅ Subtitle download
- ✅ EventEmitter for integrations

## Usage Examples

### Basic Download

```javascript
const downloader = new VideoDownloader();
await downloader.download('https://youtube.com/watch?v=VIDEO_ID');
```

### Specific Quality

```javascript
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  quality: '720p'
});
```

### Audio Extraction

```javascript
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  audioOnly: true,
  audioFormat: 'mp3'
});
```

### With Thumbnail

```javascript
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  downloadThumbnail: true,
  convertThumbnail: 'jpg'
});
```

### Progress Tracking

```javascript
downloader.on('progress', ({ percentage, metadata }) => {
  console.log(`${percentage}% - ${metadata.title}`);
});

await downloader.download('https://youtube.com/watch?v=VIDEO_ID');
```

### Playlist Download

```javascript
await downloader.download('https://youtube.com/playlist?list=PLAYLIST_ID', {
  quality: '720p'
});
```

## Configuration

Default settings at `assets/config/default-settings.json`:

```json
{
  "defaultQuality": "best",
  "defaultFormat": "mp4",
  "outputPath": "/Users/luizfosc/Dropbox/Downloads/YT",
  "outputTemplate": "%(title)s.%(ext)s",
  "maxConcurrent": 3,
  "retries": 3,
  "downloadThumbnail": true,
  "convertThumbnail": "jpg"
}
```

## Quality Presets

| Preset | Resolution | Description |
|--------|-----------|-------------|
| `4k` | 2160p | Highest quality |
| `1080p` | 1080p | Full HD |
| `720p` | 720p | HD |
| `480p` | 480p | SD |
| `best` | Varies | Best available |

## Audio Formats

| Format | Quality | Use Case |
|--------|---------|----------|
| `mp3` | Good | Universal |
| `m4a` | Good | Apple devices |
| `opus` | Best | Best quality/size |
| `flac` | Lossless | Archival |

## Supported Sites

- **YouTube** (videos, playlists, live streams)
- **Vimeo**
- **Dailymotion**
- **Facebook** (public videos)
- **Instagram**
- **Twitter/X**
- **TikTok**
- **Twitch**
- And 1000+ more!

See [references/supported-sites.md](./references/supported-sites.md) for complete list.

## Error Codes

| Code | Error | Solution |
|------|-------|----------|
| `VD001` | yt-dlp not found | `brew install yt-dlp` |
| `VD003` | Video unavailable | Check URL |
| `VD004` | Network error | Check connection |
| `VD006` | Format unavailable | Try different quality |
| `VD012` | ffmpeg not found | `brew install ffmpeg` |

See [references/troubleshooting.md](./references/troubleshooting.md) for detailed solutions.

## API Reference

### VideoDownloader

```javascript
const downloader = new VideoDownloader(options);
```

**Options:**
- `outputPath` - Download directory
- `outputTemplate` - Filename template
- `defaultQuality` - Default quality preset
- `maxConcurrent` - Max simultaneous downloads
- `retries` - Number of retries on failure

**Methods:**
- `download(urls, options)` - Download video(s)
- `extractMetadata(url)` - Get video metadata
- `cancel()` - Cancel downloads
- `getDiagnostics()` - System diagnostics

**Events:**
- `metadata:extracted` - Metadata received
- `progress` - Download progress
- `video:completed` - Video completed
- `video:failed` - Video failed

## Testing

```bash
# Run tests
npm test -- .claude/commands/AIOS/skills-especializadas/video-downloader/tests/

# Run specific test
npm test -- video-downloader.test.js -t "URL Validation"

# Watch mode
npm test -- video-downloader.test.js --watch
```

## Examples

See `examples/basic-usage.js` for 10 complete examples:

```bash
# Run example 1 (basic download)
node examples/basic-usage.js 1

# Run example 3 (audio extraction)
node examples/basic-usage.js 3

# Run all safe examples
node examples/basic-usage.js all
```

## Project Structure

```
video-downloader/
├── SKILL.md                    # Full documentation
├── README.md                   # This file
├── scripts/
│   ├── video-downloader.js     # Main downloader
│   ├── yt-dlp-installer.js     # Installation manager
│   ├── quality-selector.js     # Quality/format selection
│   └── error-codes.js          # Error definitions
├── assets/
│   └── config/
│       └── default-settings.json
├── references/
│   ├── supported-sites.md      # Supported sites list
│   └── troubleshooting.md      # Common issues
├── examples/
│   └── basic-usage.js          # Usage examples
└── tests/
    └── video-downloader.test.js
```

## Requirements

- **Node.js** 16+
- **yt-dlp** (auto-detected, instructions provided)
- **ffmpeg** (optional, for audio extraction)

## Limitations

- DRM-protected content not supported (Netflix, Disney+, etc.)
- Some sites require authentication (not supported by default)
- Live streams download from current point
- Rate limiting may apply on some sites

## Contributing

Improvements welcome! Areas for contribution:

- Download resumption
- Authenticated downloads (cookies)
- Post-processing (crop, watermark)
- Better progress estimation

## License

Part of AIOS Core - MIT License

## Links

- **Full Documentation:** [SKILL.md](./SKILL.md)
- **Troubleshooting:** [references/troubleshooting.md](./references/troubleshooting.md)
- **Supported Sites:** [references/supported-sites.md](./references/supported-sites.md)
- **yt-dlp GitHub:** https://github.com/yt-dlp/yt-dlp

---

**Version:** 1.0.0
**Status:** ✅ Production Ready
**Last Updated:** 2026-02-04
