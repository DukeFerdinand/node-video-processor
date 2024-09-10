import { exec } from 'child_process';
import fs from 'node:fs/promises';
import * as path from 'path';

// Define the prefix path (change this to the directory where your video files are located)
const toBeProcessedPath = "\\\\192.168.1.5\\Storage\\storage\\vods\\to-be-processed";
const mixesPath = "\\\\192.168.1.5\\Storage\\storage\\mixes";
const defaultOutDir = "\\\\192.168.1.5\\Storage\\storage\\vods\\processed";

// Define the video names
const videoNames: string[] = [
  "2024-09-03_11-35-13",
  "2024-09-06_11-35-17"
];

// Video class
// -------------------

interface IVideo {
  resource: string;
  sourceDirectory?: string;
  outputDirectory?: string;
  remote?: boolean; // remote address, just pass resource to ffmpeg  resource: string;
  fileType?: string; // default mkv, does not affect remote
}

class Video {
  public videoData: Required<IVideo>;
  constructor(data: IVideo) {
    this.videoData = {
      ...data,
      remote: !!data.remote,
      fileType: data.fileType || 'mkv',
      sourceDirectory: data.sourceDirectory || toBeProcessedPath,
      outputDirectory: data.outputDirectory || defaultOutDir,
    }
  }

  get inputResource(): string {
    return this.videoData.remote ? this.videoData.resource : `${this.videoData.sourceDirectory}/${this.videoData.resource}.${this.videoData.fileType}`
  }

  get outputPath(): string {
    return this.videoData.outputDirectory
  }

  getOutputM3U8(filePrefix: string): string {
    return `${this.videoData.outputDirectory}/${filePrefix}.m3u8`
  }

  getOutputTsFile(filePrefix: string): string {
    return `${this.videoData.outputDirectory}/${filePrefix}_%03d.ts`
  }
}

const videos: Video[] = [
  new Video({
    resource: "2024-09-06_11-35-17",
  }),
  new Video({
    remote: true,
    resource: "https://cdn.seaside.fm/seasidefm/vod/2024-08-31_16-35-05/index.m3u8"
  })
]

// FFMpeg helper
// ---------------------
function getFFMpegCommand(video: Video) {
  const ffmpegCommand = `
    ffmpeg -i "${video.inputResource}" \
    -map 0:v -map 0:a -c:v:0 libx264 -b:v:0 3000k -c:a:0 aac -b:a:0 128k -s:v:0 1920x1080 -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${outputDir}/1080p_%03d.ts" "${output1080p}" \
    -map 0:v -map 0:a -c:v:1 libx264 -b:v:1 1000k -c:a:1 aac -b:a:1 128k -s:v:1 1280x720 -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${outputDir}/720p_%03d.ts" "${output720p}" \
    -map 0:a -c:a aac -b:a 128k -vn -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${outputDir}/audio_%03d.ts" "${outputAudio}"
  `.trim();
}

// Function to ensure a directory exists
const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.access(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Function to run a command
const runCommand = (command: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${stderr}`);
        reject(error);
      } else {
        console.log(`Output: ${stdout}`);
        resolve();
      }
    });
  });
};

// Function to generate HLS master playlist
const createMasterPlaylist = (outputDir: string, videoName: string): void => {
  const masterPlaylistContent = `
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080
${videoName}/1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720
${videoName}/720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=128000,AUDIO="audio"
${videoName}/audio.m3u8
    `.trim();

  const masterPlaylistPath = path.join(outputDir, 'index.m3u8');
  fs.writeFileSync(masterPlaylistPath, masterPlaylistContent);
};

// Loop through each video name and run the ffmpeg command
(async () => {
  for (const videoName of videoNames) {
    const inputFile = `${prefixPath}\\${videoName}.mkv`;
    const outputDir = path.join(outDir, videoName);
    const output1080p = path.join(outputDir, '1080p.m3u8');
    const output720p = path.join(outputDir, '720p.m3u8');
    const outputAudio = path.join(outputDir, 'audio.m3u8');

    // Ensure the output directory exists
    ensureDirectoryExists(outputDir);

    // Define the FFmpeg command with multiple output types
    const ffmpegCommand = `
            ffmpeg -i "${inputFile}" \
            -map 0:v -map 0:a -c:v:0 libx264 -b:v:0 3000k -c:a:0 aac -b:a:0 128k -s:v:0 1920x1080 -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${outputDir}/1080p_%03d.ts" "${output1080p}" \
            -map 0:v -map 0:a -c:v:1 libx264 -b:v:1 1000k -c:a:1 aac -b:a:1 128k -s:v:1 1280x720 -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${outputDir}/720p_%03d.ts" "${output720p}" \
            -map 0:a -c:a aac -b:a 128k -vn -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${outputDir}/audio_%03d.ts" "${outputAudio}"
        `.trim();

    // Run the FFmpeg command
    console.log(`Running: ${ffmpegCommand}`);
    try {
      await runCommand(ffmpegCommand);
    } catch (error) {
      console.error(`Error processing video: ${videoName}`, error);
      continue;
    }

    // Create the master playlist
    createMasterPlaylist(outDir, videoName);
    console.log(`Master playlist created for ${videoName}`);
  }
})();