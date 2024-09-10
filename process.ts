import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import * as path from 'node:path';

import * as dotenv from 'dotenv'
import {z} from 'zod';

dotenv.config()

const DEBUG = Boolean(JSON.parse(process.env.DEBUG || 'false'))

// Define the prefix path (change this to the directory where your video files are located)
const toBeProcessedPath = process.env.DEFAULT_SOURCE_PATH || './source'
const mixesPath = process.env.DEFAULT_MIXES_PATH || './mixes'
const defaultOutDir = process.env.DEFAULT_OUT_DIR || './output'

// Utilities
// ----------------------------

// Function to ensure a directory exists
const ensureDirectoryExists = async (dirPath: string) => {
  try  {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath)
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


// Video class
// -------------------

const VideoConfig = z.object({
  resource: z.string(),
  sourceDirectory: z.string().default(toBeProcessedPath),
  outputDirectory: z.string().default(defaultOutDir),
  remote: z.boolean().default(false),
  fileType: z.string().default("mkv")
})

type VideoConfig = z.infer<typeof VideoConfig>

const ExpectedVideoConfig = z.array(VideoConfig)
type ExpectedVideoConfig = z.infer<typeof ExpectedVideoConfig>

class Video {
  public videoData: Required<VideoConfig>;
  constructor(data: VideoConfig) {
    this.videoData = data
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

  get ffMpegCommand() {
    const fullRes = "1920x1080"
    const m3u81080p = this.getOutputM3U8("1080p")
    const ts1080p = this.getOutputTsFile("1080p")

    const lowerRes = "1280x720"
    const m3u8720p = this.getOutputM3U8("720p")
    const ts720p = this.getOutputTsFile("720p")

    const m3u8Audio = this.getOutputM3U8("audio")
    const tsAudio = this.getOutputTsFile("audio")

    return `
      ffmpeg -i "${this.inputResource}" \
        -map 0:v -map 0:a -c:v:0 libx264 -b:v:0 3000k -c:a:0 aac -b:a:0 128k -s:v:0 ${fullRes} -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${ts1080p}" "${m3u81080p}" \
        -map 0:v -map 0:a -c:v:1 libx264 -b:v:1 1000k -c:a:1 aac -b:a:1 128k -s:v:1 ${lowerRes} -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${ts720p}" "${m3u8720p}" \
        -map 0:a -c:a aac -b:a 128k -vn -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${tsAudio}" "${m3u8Audio}"
    `.trim();
  }

  async process() {
    if (DEBUG) {
      console.log(`Processing ${this.videoData.resource} with data ->`)
      console.log(JSON.stringify(this.videoData, null, 2))
    } else {
      await runCommand(this.ffMpegCommand)

    }
  }

  async createIndexPlaylistFile(): Promise<void> {
    const masterPlaylistContent = `
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080
${this.videoData.resource}/1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720
${this.videoData.resource}/720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=128000,AUDIO="audio"
${this.videoData.resource}/audio.m3u8
    `.trim();

    const masterPlaylistPath = path.join(this.outputPath, 'index.m3u8');
    await fs.writeFile(masterPlaylistPath, masterPlaylistContent);
  };
}

// Init videos
// -----------------------------

const videoArray = await ExpectedVideoConfig.parseAsync(
  JSON.parse(await fs.readFile("videos.json", {encoding: 'utf-8'}))
)

const videos = videoArray.map((v: VideoConfig) => new Video(v))

// Process videos
// -----------------------------

// Loop through each video name and run the ffmpeg command
for (const video of videos) {
  await ensureDirectoryExists(video.outputPath)

  console.log(`Processing -> ${video.videoData.resource}`)
  await video.process()

  console.log(`Creating unified m3u8 playlist...`)
  await video.createIndexPlaylistFile()

  console.log(`${video.videoData.resource} -> Done. Please upload to cyberduck!`)
}
