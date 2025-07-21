import VisionSegment from "@interfaces/vision_segment";

export default class SubtitleHelper {
    public static createSubtitlesFromDescription = (segments: VisionSegment[]): string => {
        let subtitles = '';
        segments.forEach((segment: VisionSegment, index) => {
            const nextStartTime = segments[index + 1]?.startTime.toFixed(2) || (segment.startTime + 2).toFixed(2); // Use next segment or add 2 seconds if none.
            const descriptionText = segment.description.trim();

            if (descriptionText) {
                const formattedStartTime = SubtitleHelper.formatTime(segment.startTime);
                const formattedEndTime = SubtitleHelper.formatTime(Number(nextStartTime));

                subtitles += `${index + 1}\n`;
                subtitles += `${formattedStartTime} --> ${formattedEndTime}\n`;
                subtitles += `${descriptionText}\n\n`;
            }
        });
        return subtitles.trim();
    }

    // Helper function to format the time in "hh:mm:ss,ms" format
    public static formatTime = (timeInSeconds: number): string => {
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        const milliseconds = Math.floor((timeInSeconds % 1) * 1000);

        const pad = (num: number, size: number) => ('000' + num).slice(size * -1);

        return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
    }
}
