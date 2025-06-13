import { Settings } from '../interfaces/settings';
import CliHelper from '@helpers/cli';
import DependencyCheckResult from '@interfaces/dependency_check_result';

export class VideoService {
    public static async getDuration(filePath: string): Promise<number> {
        const cliHelper = new CliHelper('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);
        try {
            const result: string = cliHelper.executeSync();
            return parseFloat(result.trim());
        } catch (error) {
            throw new Error(`Failed to get duration for file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    
    public static calculateNumberOfSegments(duration: number, settings: Settings) {
        const batchWindowDuration = settings.batchWindowDuration || 15;
        const totalBatches = Math.ceil(duration/ batchWindowDuration);
        return totalBatches;
    }

    public static async isFfmpegInstalled(): Promise<DependencyCheckResult> {
        const cliHelper = new CliHelper('ffmpeg', ['-version']);
        try {
            const result: string = cliHelper.executeSync();
            return {
                status: true,
                stdout: result,
            };
        } catch (error) {
            return {
                status: false,
                stdout: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    public static async isFfprobeInstalled(): Promise<DependencyCheckResult> {
        const cliHelper = new CliHelper('ffprobe', ['-version']);
        try {
            const result: string = cliHelper.executeSync();
            return {
                status: true,
                stdout: result,
            };
        } catch (error) {
            return {
                status: false,
                stdout: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
