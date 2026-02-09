# Troubleshooting Guide

Common issues and solutions for the Video Downloader skill.

## Installation Issues

### yt-dlp Not Found (VD001)

**Symptoms:**
```
[VD001] yt-dlp not found
💡 Install yt-dlp using: brew install yt-dlp (macOS)
```

**Solutions:**

**macOS:**
```bash
# Via Homebrew (recommended)
brew install yt-dlp

# Via pip
pip3 install yt-dlp

# Via pipx (isolated)
pipx install yt-dlp
```

**Linux:**
```bash
# Via pip (recommended)
pip3 install yt-dlp

# Via apt (Ubuntu/Debian)
sudo apt install yt-dlp

# Via binary
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod +x /usr/local/bin/yt-dlp
```

**Windows:**
```powershell
# Via winget
winget install yt-dlp

# Via scoop
scoop install yt-dlp

# Via pip
pip install yt-dlp
```

**Verification:**
```bash
yt-dlp --version
```

### ffmpeg Not Found (VD012)

**Symptoms:**
```
WARNING: ffmpeg not found. Audio extraction may not work.
```

**Solutions:**

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

**Verification:**
```bash
ffmpeg -version
```

## Download Issues

### Video Unavailable (VD003)

**Symptoms:**
```
[VD003] Video unavailable
💡 Video may be private, deleted, or region-restricted
```

**Causes:**
1. Video is private
2. Video was deleted
3. Video is region-restricted
4. Age-restricted content
5. Copyright claim

**Solutions:**

1. **Verify in Browser:**
   - Open URL in web browser
   - Check if you can watch it

2. **Private Videos:**
   - Use share link if available
   - Login to account (not supported by default)

3. **Region Restrictions:**
   - Use VPN to access from allowed region
   - Note: May violate terms of service

4. **Age-Restricted:**
   - Some videos work without login
   - Others require YouTube account

### Network Error (VD004)

**Symptoms:**
```
[VD004] Network error
💡 Check your internet connection and try again
```

**Solutions:**

1. **Check Connection:**
   ```bash
   ping google.com
   ```

2. **Check Proxy Settings:**
   ```bash
   echo $HTTP_PROXY
   echo $HTTPS_PROXY
   ```

3. **Firewall/VPN Issues:**
   - Disable VPN temporarily
   - Check firewall rules
   - Try different network

4. **DNS Issues:**
   ```bash
   # macOS/Linux
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   ```

5. **Retry with Delay:**
   - Automatic retry is enabled
   - Wait and try again

### Format Unavailable (VD006)

**Symptoms:**
```
[VD006] Format unavailable
💡 The requested quality/format is not available
```

**Solutions:**

1. **Try Lower Quality:**
   ```javascript
   // Instead of 4k
   { quality: '1080p' }

   // Instead of 1080p
   { quality: '720p' }
   ```

2. **Use "best" Quality:**
   ```javascript
   { quality: 'best' }
   ```

3. **Check Available Formats:**
   ```bash
   yt-dlp -F <URL>
   ```
   This lists all available formats.

4. **Audio Issues:**
   ```javascript
   // If MP3 fails, try M4A
   { audioOnly: true, audioFormat: 'm4a' }
   ```

### Disk Space Error (VD005)

**Symptoms:**
```
[VD005] Insufficient disk space
💡 Free up disk space or choose a different output directory
```

**Solutions:**

1. **Check Disk Space:**
   ```bash
   df -h
   ```

2. **Free Up Space:**
   - Delete old downloads
   - Empty trash
   - Use disk cleanup tools

3. **Change Output Directory:**
   ```javascript
   const downloader = new VideoDownloader({
     outputPath: '/path/with/more/space'
   });
   ```

4. **Lower Quality:**
   ```javascript
   { quality: '480p' }  // Smaller file size
   ```

### Output Path Error (VD011)

**Symptoms:**
```
[VD011] Output path error
💡 Cannot write to output directory
```

**Solutions:**

1. **Check Permissions:**
   ```bash
   ls -la /Users/luizfosc/Dropbox/Downloads/YT/
   ```

2. **Create Directory:**
   ```bash
   mkdir -p /Users/luizfosc/Dropbox/Downloads/YT
   ```

3. **Fix Permissions:**
   ```bash
   chmod 755 /Users/luizfosc/Dropbox/Downloads/YT
   ```

4. **Change Path:**
   ```javascript
   const downloader = new VideoDownloader({
     outputPath: '/Users/username/Downloads'
   });
   ```

## Playlist Issues

### Playlist Error (VD009)

**Symptoms:**
```
[VD009] Playlist error
💡 Failed to process playlist
```

**Solutions:**

1. **Try Individual Videos:**
   - Extract URLs from playlist manually
   - Download one by one

2. **Check Playlist Privacy:**
   - Ensure playlist is public
   - Private playlists require authentication

3. **Large Playlists:**
   - Split into smaller batches
   - Use `maxConcurrent: 1` for sequential

4. **Playlist URL Format:**
   ```
   ✅ https://youtube.com/playlist?list=PLxxxxx
   ❌ https://youtube.com/watch?v=xxxxx&list=PLxxxxx
   ```

## Performance Issues

### Slow Downloads

**Symptoms:**
- Download speed is very slow
- Progress bar barely moves

**Solutions:**

1. **Remove Rate Limit:**
   ```javascript
   const downloader = new VideoDownloader({
     rateLimit: null  // Remove speed limit
   });
   ```

2. **Check Network Speed:**
   ```bash
   # Run speed test
   curl -o /dev/null http://speedtest.wdc01.softlayer.com/downloads/test100.zip
   ```

3. **Lower Quality:**
   ```javascript
   { quality: '480p' }  // Faster download
   ```

4. **Server-Side Throttling:**
   - YouTube may throttle downloads
   - Try again later
   - Space out downloads

### Stalled Downloads

**Symptoms:**
- Download starts but freezes
- No progress for long time

**Solutions:**

1. **Cancel and Retry:**
   - Press Ctrl+C to cancel
   - Try again (automatic retry)

2. **Check Process:**
   ```bash
   ps aux | grep yt-dlp
   kill <PID>  # If stuck
   ```

3. **Network Issue:**
   - Check if network is stable
   - Switch networks if possible

## Metadata Issues

### Metadata Extraction Failed (VD010)

**Symptoms:**
```
[VD010] Metadata extraction failed
💡 Could not extract video metadata
```

**Impact:**
- Warning only (not critical)
- Download continues without metadata
- Progress tracking may be limited

**Solutions:**

1. **Ignore if Download Works:**
   - Metadata is optional
   - Download should complete

2. **Update yt-dlp:**
   ```bash
   brew upgrade yt-dlp  # macOS
   pip3 install -U yt-dlp  # Linux/pip
   ```

3. **Check URL:**
   - Ensure URL is correct
   - Try in browser first

## Authentication Issues

### Private/Member Content

**Symptoms:**
- "Sign in to confirm your age"
- "This video is private"
- "Join this channel to access"

**Status:**
- Authentication not supported by default
- Requires cookie file (advanced)

**Solutions:**

1. **Public Alternative:**
   - Find public version
   - Request uploader to make public

2. **Cookie Authentication (Advanced):**
   ```bash
   # Export cookies from browser
   # Use cookie file with yt-dlp
   yt-dlp --cookies cookies.txt <URL>
   ```
   Note: Not integrated in skill yet

## Platform-Specific Issues

### YouTube

**Issue: Age-Restricted Content**
- Some videos work without login
- Others require account

**Issue: Live Streams**
- Downloads from current point
- Cannot download from beginning

**Issue: 4K/8K Not Available**
- Ensure ffmpeg is installed
- YouTube Premium may affect availability

### Instagram

**Issue: Rate Limiting**
- Instagram blocks after multiple downloads
- Wait 15-30 minutes
- Use different IP/account

**Issue: Stories Expired**
- Stories disappear after 24 hours
- Download quickly

### TikTok

**Issue: Watermark Present**
- TikTok adds watermark to videos
- Cannot remove without violating TOS

### Twitch

**Issue: VODs Deleted**
- Twitch deletes VODs after 7-60 days
- Download soon after stream

## General Troubleshooting Steps

### 1. Update yt-dlp

**Most issues are fixed in newer versions:**

```bash
# macOS (Homebrew)
brew upgrade yt-dlp

# Linux/macOS (pip)
pip3 install -U yt-dlp

# Windows (winget)
winget upgrade yt-dlp
```

### 2. Test with yt-dlp Directly

**Isolate if issue is with skill or yt-dlp:**

```bash
yt-dlp <URL>
```

If this works but skill doesn't, report to AIOS.

### 3. Check yt-dlp Issues

**Search existing issues:**

https://github.com/yt-dlp/yt-dlp/issues

### 4. Enable Verbose Mode

**Get detailed logs:**

```javascript
const downloader = new VideoDownloader({
  verbose: true
});
```

### 5. Check System Diagnostics

```javascript
const diagnostics = await downloader.getDiagnostics();
console.log(diagnostics);
```

## Getting Help

### Report to AIOS

If issue persists after troubleshooting:

1. **Gather Information:**
   - Error code (VD001, VD003, etc.)
   - Full error message
   - URL (remove identifying info)
   - Platform (macOS, Linux, Windows)
   - yt-dlp version: `yt-dlp --version`

2. **Include Diagnostics:**
   ```javascript
   const diagnostics = await downloader.getDiagnostics();
   ```

3. **Report to:**
   - AIOS GitHub Issues
   - Include all information above

### Report to yt-dlp

If issue is with yt-dlp itself:

1. Test with yt-dlp directly
2. Report to: https://github.com/yt-dlp/yt-dlp/issues
3. Follow their issue template

## FAQ

**Q: Why is my download slow?**
A: Check network speed, remove rate limit, or try lower quality.

**Q: Can I download Netflix/Disney+?**
A: No, these use DRM protection and cannot be downloaded.

**Q: Can I download private videos?**
A: Not by default. Requires authentication (not supported yet).

**Q: Why is the file format wrong?**
A: Specify container: `{ container: 'mp4' }`

**Q: Can I resume interrupted downloads?**
A: Not yet (planned for P2 features).

**Q: How do I download entire channel?**
A: Get channel videos URL, then download as playlist.

**Q: Why no audio in MP4?**
A: Install ffmpeg: `brew install ffmpeg` (macOS)

**Q: Can I download subtitles?**
A: Yes: `{ writeSubtitles: true, subtitleLanguages: ['en'] }`

**Q: How do I download thumbnail?**
A: `{ downloadThumbnail: true, convertThumbnail: 'jpg' }`

---

**Last Updated:** 2026-02-04
**Need More Help?** Report issue to AIOS GitHub
