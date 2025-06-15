export default class SoundManager {
    private soundFiles: string[] = [];

    async initializeSounds() {
        this.soundFiles = await Promise.all(
            Object.entries(import.meta.glob('@assets/sounds/*.mp3')).map(async ([, value]) => {
                const module = await value() as { default: string };
                return module.default;
            })
        );

        console.log(this.soundFiles[0]);
    }
}
