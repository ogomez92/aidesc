import ffmpeg from 'fluent-ffmpeg';

export class VideoService {
    public static async getDuration(filePath: string): Promise<number> {
        try {
            return new Promise((resolve) => {
                ffmpeg.ffprobe(filePath, (err, metadata) => {
                    if (err || !metadata || !metadata.format || !metadata.format.duration) {
                        resolve(0);
                        return;
                    }

                    const durationInSeconds = metadata.format.duration;
                    const durationInMilliseconds = Math.round(durationInSeconds * 1000);
                    resolve(durationInMilliseconds);
                });
            });
        } catch (error) {
            console.error(`Error converting to ffmpeg: ${error}`);
            return 0;
        }
    }

    public static async isFfmpegInstalled(): Promise<boolean> {
        try {
            // Check ffprobe
            await new Promise((resolve, reject) => {
                ffmpeg.ffprobe('-version', (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            });

            // Check ffmpeg
            await new Promise((resolve, reject) => {
                ffmpeg.getAvailableFormats((err, formats) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(formats);
                    }
                });
            });

            return true;
        } catch (error) {
            console.error(`FFmpeg installation check failed: ${error}`);
            return false;
        }
    }
}
