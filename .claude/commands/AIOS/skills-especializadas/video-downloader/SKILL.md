---
name: video-downloader
description: Download videos from YouTube and 1000+ sites with quality selection, audio extraction, and metadata preservation
version: 1.0.0
category: media
tags:
  - video
  - download
  - youtube
  - media
  - audio
  - extraction
keywords:
  - download video
  - youtube download
  - extract audio
  - video quality
  - playlist download
  - thumbnail download
  - metadata extraction
priority: medium
author: AIOS Core Team
---

# Video Downloader Skill

Download videos from YouTube and over 1000+ supported sites using yt-dlp. Features quality selection (480p-4K), audio-only extraction, playlist support, metadata preservation, and thumbnail downloads.

## Overview

The Video Downloader skill provides a robust, production-ready solution for downloading videos from the web. Built on top of yt-dlp (the actively maintained fork of youtube-dl), it offers enterprise-grade reliability with progress tracking, automatic retries, and comprehensive error handling.

### Key Features

#### ✅ P0 Features (Core)
- ✅ Download single videos from 1000+ sites
- ✅ Quality selection (480p, 720p, 1080p, 4K, best, worst)
- ✅ Audio-only extraction (MP3, M4A, WAV, OPUS, FLAC)
- ✅ Auto-install yt-dlp with platform detection
- ✅ Robust error handling with recovery suggestions

#### ✅ P1 Features (Enhanced)
- ✅ Playlist download with batch processing
- ✅ Metadata extraction (title, uploader, duration, views)
- ✅ **Thumbnail download with format conversion (JPG)**
- ✅ Progress tracking with real-time updates
- ✅ Subtitle download (manual and auto-generated)
- ✅ EventEmitter for integration with dashboards

#### 🔮 P2 Features (Future)
- ⏳ Download caching and resume support
- ⏳ Post-processing (merge, crop, watermark)
- ⏳ Advanced format selection (codec, bitrate)

## When to Use This Skill

Use the Video Downloader skill when you need to:

- **Download videos** from YouTube, Vimeo, Dailymotion, or any supported site
- **Extract audio** from videos (e.g., music, podcasts, lectures)
- **Archive content** with metadata and thumbnails
- **Process playlists** or channels in bulk
- **Get specific quality** (save bandwidth with 480p or get 4K)
- **Download subtitles** in multiple languages

## Supported Sites

yt-dlp supports **1000+ sites** including:

### Popular Sites
- **YouTube** (videos, playlists, channels, live streams)
- **Vimeo** (videos, albums)
- **Dailymotion**
- **Facebook** (public videos)
- **Instagram** (posts, stories, IGTV)
- **Twitter/X** (video tweets)
- **TikTok** (videos)
- **Twitch** (videos, clips, VODs)
- **Reddit** (video posts)

### Educational
- **Coursera**
- **Udemy**
- **Khan Academy**
- **Ted Talks**

### Professional
- **LinkedIn Learning**
- **Skillshare**
- **MasterClass**

For the complete list, see [references/supported-sites.md](./references/supported-sites.md)

## Usage Examples

### Basic Download

Download a video with best available quality:

```bash
# Via AIOS skill invocation
"Download this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Via CLI (future)
npx aios-core download-video https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### Quality Selection

Download with specific quality:

```javascript
// 720p HD
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  quality: '720p'
});

// 4K
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  quality: '4k'
});

// Lowest quality (fastest)
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  quality: '360p'
});
```

### Audio Extraction

Extract audio only:

```javascript
// MP3 audio
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  audioOnly: true,
  audioFormat: 'mp3'
});

// High-quality FLAC
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  audioOnly: true,
  audioFormat: 'flac'
});
```

### Playlist Download

Download entire playlists:

```javascript
await downloader.download('https://youtube.com/playlist?list=PLAYLIST_ID', {
  quality: '720p',
  downloadThumbnail: true
});
```

### Thumbnail Download

Download video with thumbnail:

```javascript
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  downloadThumbnail: true,      // Download thumbnail
  convertThumbnail: 'jpg'       // Convert to JPG format
});
```

Thumbnails are saved in the same directory as the video with matching filename:
```
/Users/luizfosc/Dropbox/Downloads/YT/
  ├── Video Title.mp4
  └── Video Title.jpg          ← Thumbnail
```

### Subtitles Download

Download with subtitles:

```javascript
await downloader.download('https://youtube.com/watch?v=VIDEO_ID', {
  writeSubtitles: true,
  subtitleLanguages: ['pt', 'en'],
  embedSubtitles: true           // Embed in video file
});
```

### Custom Output Path

Specify custom download location:

```javascript
const downloader = new VideoDownloader({
  outputPath: '/Users/username/Videos/Downloads',
  outputTemplate: '%(uploader)s - %(title)s.%(ext)s'
});

await downloader.download('https://youtube.com/watch?v=VIDEO_ID');
```

### Progress Tracking

Track download progress:

```javascript
const downloader = new VideoDownloader();

downloader.on('metadata:extracted', ({ metadata }) => {
  console.log(`Downloading: ${metadata.title}`);
  console.log(`Duration: ${metadata.duration}s`);
});

downloader.on('progress', ({ percentage, metadata }) => {
  console.log(`Progress: ${percentage}% - ${metadata.title}`);
});

downloader.on('video:completed', ({ url, metadata }) => {
  console.log(`✅ Completed: ${metadata.title}`);
});

downloader.on('video:failed', ({ url, error }) => {
  console.error(`❌ Failed: ${url} - ${error}`);
});

await downloader.download('https://youtube.com/watch?v=VIDEO_ID');
```

## Command Patterns

The skill recognizes these natural language patterns:

- "Download this video: [URL]"
- "Download [URL] in 720p"
- "Extract audio from [URL]"
- "Download [URL] as MP3"
- "Download this playlist: [URL]"
- "Get 4K version of [URL]"
- "Download [URL] with subtitles"
- "Download thumbnail for [URL]"

## Configuration

### Default Settings

Located at `assets/config/default-settings.json`:

```json
{
  "defaultQuality": "best",
  "defaultFormat": "mp4",
  "outputPath": "/Users/luizfosc/Dropbox/Downloads/YT",
  "outputTemplate": "%(title)s.%(ext)s",
  "maxConcurrent": 3,
  "retries": 3,
  "rateLimit": null,
  "writeMetadata": true,
  "downloadThumbnail": true,
  "convertThumbnail": "jpg",
  "writeSubtitles": false,
  "autoSubtitles": false,
  "embedSubtitles": false,
  "subtitleLanguages": ["pt", "en"]
}
```

### Output Templates

Customize filename format using yt-dlp template variables:

```javascript
// Default: Video title + extension
"%(title)s.%(ext)s"
// → "Amazing Video.mp4"

// Include uploader
"%(uploader)s - %(title)s.%(ext)s"
// → "ChannelName - Amazing Video.mp4"

// Include date
"%(upload_date)s - %(title)s.%(ext)s"
// → "20240115 - Amazing Video.mp4"

// Include ID (unique)
"%(title)s [%(id)s].%(ext)s"
// → "Amazing Video [dQw4w9WgXcQ].mp4"
```

Available variables: `title`, `id`, `ext`, `uploader`, `upload_date`, `duration`, `view_count`, etc.

## Quality Presets

| Preset | Resolution | Description |
|--------|-----------|-------------|
| `4k` | 2160p | Highest quality (large files) |
| `1080p` | 1080p | Full HD |
| `720p` | 720p | HD (good balance) |
| `480p` | 480p | SD (faster download) |
| `360p` | 360p | Low quality (smallest files) |
| `best` | Varies | Best available quality |
| `worst` | Varies | Lowest available quality |

## Audio Formats

| Format | Quality | Description |
|--------|---------|-------------|
| `mp3` | Good | Universal compatibility |
| `m4a` | Good | Better compression than MP3 |
| `opus` | Best | Best quality/size ratio |
| `flac` | Lossless | Highest quality (large) |
| `wav` | Uncompressed | Raw audio (very large) |

## Error Codes

The skill uses structured error codes for troubleshooting:

| Code | Error | Suggestion |
|------|-------|------------|
| `VD001` | yt-dlp not found | Install: `brew install yt-dlp` (macOS) |
| `VD002` | Invalid URL | Provide valid video URL |
| `VD003` | Video unavailable | Check if video is private/deleted |
| `VD004` | Network error | Check internet connection |
| `VD005` | Disk space | Free up disk space |
| `VD006` | Format unavailable | Try different quality |
| `VD007` | Process error | Check logs |
| `VD008` | Cancelled | Download cancelled by user |
| `VD009` | Playlist error | Try individual videos |
| `VD010` | Metadata failed | Extraction failed (continues) |
| `VD011` | Output path error | Check directory permissions |
| `VD012` | ffmpeg not found | Install: `brew install ffmpeg` (macOS) |

See [references/troubleshooting.md](./references/troubleshooting.md) for detailed solutions.

## Dependencies

### Required
- **yt-dlp** - Video download engine
  - macOS: `brew install yt-dlp`
  - Linux: `pip3 install yt-dlp`
  - Windows: `winget install yt-dlp`

### Optional
- **ffmpeg** - Required for audio extraction and format conversion
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`
  - Windows: `winget install ffmpeg`

The skill will auto-detect installation and provide instructions if missing.

## API Reference

### VideoDownloader Class

```javascript
const VideoDownloader = require('./scripts/video-downloader');

const downloader = new VideoDownloader({
  outputPath: '/path/to/downloads',
  outputTemplate: '%(title)s.%(ext)s',
  defaultQuality: 'best',
  defaultFormat: 'mp4',
  maxConcurrent: 3,
  retries: 3,
  rateLimit: '1M',              // Optional: limit download speed
  writeMetadata: true,
  downloadThumbnail: true,
  convertThumbnail: 'jpg',
  verbose: false
});
```

### Methods

#### `download(urls, options)`

Download one or more videos.

**Parameters:**
- `urls` (string|string[]): Video URL(s)
- `options` (object): Download options
  - `quality` (string): Quality preset (480p, 720p, 1080p, 4k, best)
  - `audioOnly` (boolean): Extract audio only
  - `audioFormat` (string): Audio format (mp3, m4a, flac, opus, wav)
  - `container` (string): Video container (mp4, mkv, webm)
  - `downloadThumbnail` (boolean): Download thumbnail
  - `convertThumbnail` (string): Thumbnail format (jpg, png, webp)
  - `writeSubtitles` (boolean): Download subtitles
  - `subtitleLanguages` (string[]): Subtitle languages

**Returns:** Promise<{ results, stats }>

#### `extractMetadata(url)`

Extract video metadata without downloading.

**Returns:** Promise<{ title, uploader, duration, thumbnail, description, ... }>

#### `cancel()`

Cancel all active downloads.

#### `getDiagnostics()`

Get system diagnostics and configuration.

**Returns:** Promise<{ system, config, stats }>

### Events

```javascript
downloader.on('download:started', ({ total, urls }) => {});
downloader.on('metadata:extracted', ({ downloadId, url, metadata }) => {});
downloader.on('video:started', ({ downloadId, url, options }) => {});
downloader.on('progress', ({ downloadId, url, percentage, metadata }) => {});
downloader.on('video:completed', ({ downloadId, url, metadata }) => {});
downloader.on('video:failed', ({ url, error, code }) => {});
downloader.on('download:cancelled', ({ downloadId }) => {});
downloader.on('download:completed', ({ results, stats }) => {});
```

## Integration with AIOS

### Skill Invocation

The skill is automatically registered with AIOS and can be invoked via:

1. **Natural language** (via Claude Code Skill tool)
   ```
   "Download this video: https://youtube.com/watch?v=VIDEO_ID"
   ```

2. **SkillDispatcher** (programmatic)
   ```javascript
   dispatcher.invoke('video-downloader', {
     url: 'https://youtube.com/watch?v=VIDEO_ID',
     quality: '720p'
   });
   ```

3. **CLI** (future feature)
   ```bash
   npx aios-core download-video [URL] --quality 720p
   ```

### EventEmitter Integration

The downloader emits events that can be consumed by:

- **Dashboard** (via WebSocket for real-time progress)
- **Logging system** (for audit trails)
- **Notification system** (for completion alerts)

Example dashboard integration:

```javascript
// In dashboard WebSocket handler
downloader.on('progress', (data) => {
  websocket.broadcast('video:progress', data);
});

downloader.on('video:completed', (data) => {
  websocket.broadcast('video:completed', data);
  notifications.send(`Downloaded: ${data.metadata.title}`);
});
```

## Testing

Unit tests available at `tests/video-downloader.test.js`:

```bash
# Run all tests
npm test -- tests/video-downloader.test.js

# Run specific test suite
npm test -- tests/video-downloader.test.js -t "URL Validation"

# Watch mode
npm test -- tests/video-downloader.test.js --watch
```

Integration tests at `tests/integration.test.js` (requires network):

```bash
npm test -- tests/integration.test.js
```

## Examples

See `examples/` directory for complete usage examples:

- `basic-download.js` - Simple video download
- `audio-extraction.js` - Extract audio from videos
- `playlist-download.js` - Batch playlist processing
- `progress-tracking.js` - CLI progress bar implementation
- `thumbnail-download.js` - Download with thumbnail

## Architecture

```
video-downloader/
├── SKILL.md                    # This file
├── scripts/
│   ├── video-downloader.js     # Main downloader (EventEmitter)
│   ├── yt-dlp-installer.js     # Auto-installer and detector
│   ├── quality-selector.js     # Format/quality selection
│   └── error-codes.js          # Error definitions
├── assets/
│   └── config/
│       └── default-settings.json
├── references/
│   ├── supported-sites.md      # List of supported sites
│   └── troubleshooting.md      # Common issues and solutions
└── tests/
    ├── video-downloader.test.js
    └── integration.test.js
```

## Performance Considerations

- **Network bandwidth**: Use `rateLimit` option to avoid saturating connection
- **Disk space**: Check available space before batch downloads
- **Concurrent downloads**: Default is 3 simultaneous downloads (configurable)
- **Retry logic**: Automatic retries with exponential backoff for transient failures

## Security Considerations

- **URL validation**: All URLs are validated before processing
- **Shell safety**: Arguments are properly escaped to prevent injection
- **File permissions**: Output directory permissions are checked
- **No cookies by default**: Avoid downloading private/authenticated content

## Limitations

- Some sites require cookies/authentication (not supported by default)
- Age-restricted content may require account
- Live streams download from current point (not from beginning)
- Some sites have rate limiting or anti-bot measures

## License

Part of AIOS Core - MIT License

## Contributing

Improvements welcome! Areas for contribution:

- Add support for authenticated downloads (cookies)
- Implement download resumption
- Add post-processing features (crop, watermark)
- Improve progress estimation
- Add support for more metadata fields

---

**Version:** 1.0.0
**Last Updated:** 2026-02-04
**Status:** ✅ Production Ready (P0 + P1 features complete)
