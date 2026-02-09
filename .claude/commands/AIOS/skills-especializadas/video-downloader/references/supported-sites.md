# Supported Sites

The Video Downloader skill uses yt-dlp, which supports **over 1000 sites**. Below is a curated list of popular and commonly used sites.

## Video Platforms

### General Video
- **YouTube** - Videos, playlists, channels, live streams, shorts
- **Vimeo** - Videos, albums, channels
- **Dailymotion** - Videos, playlists
- **Twitch** - Videos, clips, VODs, highlights
- **Facebook** - Public videos, watch videos
- **Instagram** - Posts, stories, IGTV, reels
- **Twitter/X** - Video tweets
- **TikTok** - Videos
- **Reddit** - Video posts (v.redd.it)

### Educational
- **Coursera** - Course videos
- **Udemy** - Course content (if you have access)
- **Khan Academy** - Educational videos
- **TED** - TED Talks
- **LinkedIn Learning** - Course videos (requires authentication)
- **Skillshare** - Classes (requires authentication)
- **MasterClass** - Classes (requires authentication)
- **edX** - Course videos

### Entertainment
- **Netflix** - Not supported (DRM protected)
- **Disney+** - Not supported (DRM protected)
- **Hulu** - Not supported (DRM protected)
- **Amazon Prime Video** - Not supported (DRM protected)
- **BBC iPlayer** - Limited support (region restrictions)
- **Crunchyroll** - Some support (free content)

### News & Media
- **CNN**
- **BBC**
- **NBC**
- **ABC News**
- **The Guardian**
- **Reuters**

### Sports
- **ESPN** - Some content
- **NBA** - Some content
- **NFL** - Some content
- **MLB** - Some content

### Music
- **SoundCloud** - Tracks, playlists
- **Bandcamp** - Tracks, albums
- **Mixcloud** - Mixes, shows
- **Spotify** - Not supported (DRM protected)

### Live Streaming
- **Twitch** - Live streams (current point onwards)
- **YouTube Live** - Live streams
- **Facebook Live** - Public live streams
- **Periscope/Twitter Live** - Live broadcasts

### Professional
- **LinkedIn** - Video posts
- **SlideShare** - Presentations with video
- **Vimeo Pro** - Professional content

### Regional Platforms

#### Asia
- **Bilibili** (China)
- **Niconico** (Japan)
- **Youku** (China)
- **Naver TV** (Korea)

#### Europe
- **Arte.tv** (France/Germany)
- **France.tv**
- **ZDF Mediathek** (Germany)
- **RAI** (Italy)

#### Latin America
- **Globo Play** (Brazil)
- **Caracol TV** (Colombia)

## Sites with Limitations

### Requires Authentication
These sites require login credentials (cookies):

- LinkedIn Learning
- Skillshare
- MasterClass
- Patreon
- OnlyFans (requires membership)
- Twitch subscriber content

### Age Restrictions
Some content may require:

- Account verification
- Age confirmation
- Region verification

### Rate Limiting
These sites may have aggressive rate limiting:

- Instagram (may block after multiple downloads)
- Facebook (may require login after threshold)
- Twitter/X (API rate limits)

## DRM Protected Content

The following sites use DRM protection and **cannot be downloaded**:

- Netflix
- Disney+
- Hulu
- Amazon Prime Video
- HBO Max
- Apple TV+
- Spotify
- Apple Music

> **Note:** Attempting to download DRM-protected content may violate terms of service and copyright laws.

## Complete List

For the complete and up-to-date list of all 1000+ supported sites, run:

```bash
yt-dlp --list-extractors
```

Or visit the official documentation:
- [yt-dlp supported sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)

## Testing Site Support

To check if a specific URL is supported:

```bash
yt-dlp --dump-json <URL>
```

If metadata is returned, the site is supported.

## Reporting Issues

If a supported site is not working:

1. Ensure yt-dlp is up to date: `brew upgrade yt-dlp` (macOS)
2. Test with yt-dlp directly: `yt-dlp <URL>`
3. Check yt-dlp issue tracker: https://github.com/yt-dlp/yt-dlp/issues
4. Report to AIOS: Include site URL (without identifying info) and error message

## Site-Specific Notes

### YouTube
- Supports 4K, 8K, HDR
- Supports age-restricted videos (without login for some)
- Supports live streams (from current point)
- Supports channel and playlist downloads
- Supports community posts (not videos)

### Vimeo
- Supports private videos (if you have access link)
- Supports password-protected videos (provide password)
- Download limits may apply to free accounts

### Instagram
- Public posts only
- Stories require account
- Reels supported
- IGTV supported

### TikTok
- Public videos only
- Watermark included (TikTok adds watermark)
- Some region restrictions

### Twitch
- Live streams from current point
- VODs (if not deleted)
- Clips
- Highlights

---

**Last Updated:** 2026-02-04
**yt-dlp Version:** Latest
