/**
 * Basic Video Downloader Usage Examples
 */

const VideoDownloader = require('../scripts/video-downloader');

/**
 * Example 1: Simple download with default settings
 */
async function example1_basicDownload() {
  console.log('\n=== Example 1: Basic Download ===\n');

  const downloader = new VideoDownloader();

  try {
    const result = await downloader.download('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log('Download completed:', result);
  } catch (error) {
    console.error('Download failed:', error.getUserMessage());
  }
}

/**
 * Example 2: Download with specific quality
 */
async function example2_qualitySelection() {
  console.log('\n=== Example 2: Quality Selection ===\n');

  const downloader = new VideoDownloader();

  try {
    const result = await downloader.download(
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      { quality: '720p' }
    );
    console.log('720p download completed:', result);
  } catch (error) {
    console.error('Download failed:', error.getUserMessage());
  }
}

/**
 * Example 3: Audio extraction
 */
async function example3_audioExtraction() {
  console.log('\n=== Example 3: Audio Extraction ===\n');

  const downloader = new VideoDownloader();

  try {
    const result = await downloader.download(
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      {
        audioOnly: true,
        audioFormat: 'mp3'
      }
    );
    console.log('Audio extraction completed:', result);
  } catch (error) {
    console.error('Audio extraction failed:', error.getUserMessage());
  }
}

/**
 * Example 4: Download with progress tracking
 */
async function example4_progressTracking() {
  console.log('\n=== Example 4: Progress Tracking ===\n');

  const downloader = new VideoDownloader();

  // Listen to events
  downloader.on('metadata:extracted', ({ metadata }) => {
    console.log(`\n📹 ${metadata.title}`);
    console.log(`👤 ${metadata.uploader}`);
    console.log(`⏱️  Duration: ${Math.floor(metadata.duration / 60)}:${(metadata.duration % 60).toString().padStart(2, '0')}`);
  });

  downloader.on('progress', ({ percentage, metadata }) => {
    process.stdout.write(`\rProgress: ${percentage.toFixed(1)}%`);
  });

  downloader.on('video:completed', ({ metadata }) => {
    console.log(`\n✅ Download completed: ${metadata.title}`);
  });

  try {
    await downloader.download('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  } catch (error) {
    console.error('\n❌ Download failed:', error.getUserMessage());
  }
}

/**
 * Example 5: Download with thumbnail
 */
async function example5_withThumbnail() {
  console.log('\n=== Example 5: Download with Thumbnail ===\n');

  const downloader = new VideoDownloader();

  try {
    const result = await downloader.download(
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      {
        quality: '720p',
        downloadThumbnail: true,
        convertThumbnail: 'jpg'
      }
    );
    console.log('Download with thumbnail completed:', result);
  } catch (error) {
    console.error('Download failed:', error.getUserMessage());
  }
}

/**
 * Example 6: Batch download (multiple videos)
 */
async function example6_batchDownload() {
  console.log('\n=== Example 6: Batch Download ===\n');

  const downloader = new VideoDownloader();

  const urls = [
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  ];

  downloader.on('video:completed', ({ metadata }) => {
    console.log(`✅ Completed: ${metadata.title}`);
  });

  downloader.on('video:failed', ({ url, error }) => {
    console.error(`❌ Failed: ${url} - ${error}`);
  });

  try {
    const result = await downloader.download(urls, { quality: '480p' });
    console.log('\nBatch download stats:', result.stats);
  } catch (error) {
    console.error('Batch download failed:', error.getUserMessage());
  }
}

/**
 * Example 7: Custom output path
 */
async function example7_customOutput() {
  console.log('\n=== Example 7: Custom Output Path ===\n');

  const downloader = new VideoDownloader({
    outputPath: '/Users/username/Downloads',
    outputTemplate: '%(uploader)s - %(title)s.%(ext)s'
  });

  try {
    const result = await downloader.download('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log('Download to custom path completed:', result);
  } catch (error) {
    console.error('Download failed:', error.getUserMessage());
  }
}

/**
 * Example 8: Extract metadata without downloading
 */
async function example8_metadataOnly() {
  console.log('\n=== Example 8: Metadata Extraction ===\n');

  const downloader = new VideoDownloader();

  try {
    const metadata = await downloader.extractMetadata('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('Metadata extraction failed:', error.getUserMessage());
  }
}

/**
 * Example 9: System diagnostics
 */
async function example9_diagnostics() {
  console.log('\n=== Example 9: System Diagnostics ===\n');

  const downloader = new VideoDownloader();

  try {
    const diagnostics = await downloader.getDiagnostics();
    console.log('System diagnostics:', JSON.stringify(diagnostics, null, 2));
  } catch (error) {
    console.error('Diagnostics failed:', error.message);
  }
}

/**
 * Example 10: Download with subtitles
 */
async function example10_withSubtitles() {
  console.log('\n=== Example 10: Download with Subtitles ===\n');

  const downloader = new VideoDownloader();

  try {
    const result = await downloader.download(
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      {
        quality: '720p',
        writeSubtitles: true,
        subtitleLanguages: ['pt', 'en'],
        embedSubtitles: true
      }
    );
    console.log('Download with subtitles completed:', result);
  } catch (error) {
    console.error('Download failed:', error.getUserMessage());
  }
}

// Run examples
async function main() {
  const args = process.argv.slice(2);
  const exampleNum = args[0] || '1';

  switch (exampleNum) {
    case '1':
      await example1_basicDownload();
      break;
    case '2':
      await example2_qualitySelection();
      break;
    case '3':
      await example3_audioExtraction();
      break;
    case '4':
      await example4_progressTracking();
      break;
    case '5':
      await example5_withThumbnail();
      break;
    case '6':
      await example6_batchDownload();
      break;
    case '7':
      await example7_customOutput();
      break;
    case '8':
      await example8_metadataOnly();
      break;
    case '9':
      await example9_diagnostics();
      break;
    case '10':
      await example10_withSubtitles();
      break;
    case 'all':
      await example1_basicDownload();
      await example2_qualitySelection();
      await example3_audioExtraction();
      await example8_metadataOnly();
      await example9_diagnostics();
      break;
    default:
      console.log('Usage: node basic-usage.js [1-10|all]');
      console.log('\nAvailable examples:');
      console.log('  1  - Basic download');
      console.log('  2  - Quality selection');
      console.log('  3  - Audio extraction');
      console.log('  4  - Progress tracking');
      console.log('  5  - Download with thumbnail');
      console.log('  6  - Batch download');
      console.log('  7  - Custom output path');
      console.log('  8  - Metadata extraction');
      console.log('  9  - System diagnostics');
      console.log('  10 - Download with subtitles');
      console.log('  all - Run safe examples (1,2,3,8,9)');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  example1_basicDownload,
  example2_qualitySelection,
  example3_audioExtraction,
  example4_progressTracking,
  example5_withThumbnail,
  example6_batchDownload,
  example7_customOutput,
  example8_metadataOnly,
  example9_diagnostics,
  example10_withSubtitles
};
