# Video Processing Script

This script processes video files into HLS playlists using FFmpeg. It supports multiple resolutions and generates `index.m3u8` files for the HLS stream. The script is written in TypeScript and requires [Bun.js](https://bun.sh) to run. It uses a `videos.json` configuration file for specifying video resources and related settings.

## Prerequisites

- [Bun.js](https://bun.sh/) installed
- FFmpeg installed and available in your system's `PATH`
- `.env` file with optional environment variables

## Setup

1. Install Bun.js:  
   Follow the [installation instructions](https://bun.sh/docs/install) on the official website.

2. Install project dependencies:
   ```bash
   bun install
   ```

3. Ensure FFmpeg is installed:
   Verify that `ffmpeg` is available in your system's `PATH`. You can check by running:
   ```bash
   ffmpeg -version
   ```

4. Create a `.env` file (optional):
   ```bash
   DEBUG=false
   DEFAULT_SOURCE_PATH=./source
   DEFAULT_MIXES_PATH=./mixes
   DEFAULT_OUT_DIR=./output
   ```

5. Create a `videos.json` file in the project root, specifying video details:
   ```json
   [
     {
       "resource": "example_video",
       "sourceDirectory": "./source",
       "outputDirectory": "./output",
       "remote": false,
       "fileType": "mkv"
     }
   ]
   ```

## How to Use

1. **Run the script**:
   Use Bun.js to execute the script.
   ```bash
   bun run script.ts
   ```

2. **Process the videos**:
   The script will:
    - Ensure the output directory exists
    - Process each video file using FFmpeg to create HLS streams in two resolutions (1080p and 720p) and an audio-only stream
    - Generate a master `index.m3u8` playlist file

3. **Upload**:
   After processing, you can upload the output HLS files using a tool like Cyberduck or any other file transfer method.

## Environment Variables

You can configure the script using the following environment variables in a `.env` file:

- `DEBUG`: Enables debug logging when set to `true` (default: `false`)
- `DEFAULT_SOURCE_PATH`: Path to the source video files (default: `./source`)
- `DEFAULT_MIXES_PATH`: Path to store mix files (default: `./mixes`)
- `DEFAULT_OUT_DIR`: Directory for the output HLS playlists (default: `./output`)

## Video Configuration (`videos.json`)

The `videos.json` file contains an array of video configurations. Each object in the array follows this structure:

```json
{
  "resource": "example_video",     // The base name of the video file (without extension)
  "sourceDirectory": "./source",   // Directory where the video file is located
  "outputDirectory": "./output",   // Directory where the HLS output will be stored
  "remote": false,                 // Whether the video is remote (false for local files)
  "fileType": "mkv"                // The file extension of the video file
}
```

## Example Command

This script internally generates an FFmpeg command similar to the following:

```bash
ffmpeg -i "./source/example_video.mkv" \
  -map 0:v -map 0:a -c:v:0 libx264 -b:v:0 3000k -c:a:0 aac -b:a:0 128k -s:v:0 1920x1080 -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "./output/1080p_%03d.ts" "./output/1080p.m3u8" \
  -map 0:v -map 0:a -c:v:1 libx264 -b:v:1 1000k -c:a:1 aac -b:a:1 128k -s:v:1 1280x720 -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "./output/720p_%03d.ts" "./output/720p.m3u8" \
  -map 0:a -c:a aac -b:a 128k -vn -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "./output/audio_%03d.ts" "./output/audio.m3u8"
```

## Notes

- Make sure the video files are present in the source directory before running the script.
- For remote videos, set `"remote": true` and ensure the `resource` field contains the full URL.

## License

This script is open source and freely available for use and modification.