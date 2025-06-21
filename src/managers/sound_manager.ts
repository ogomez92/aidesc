const soundPaths = import.meta.glob('@assets/sounds/*.m4a', { eager: true });

export default class SoundManager {
    private sounds;

    constructor() {
        this.sounds = {};
        this.loadSounds();
    }

    loadSounds() {
        for (const path in soundPaths) {
            // Get the URL of each sound
            this.sounds[path] = soundPaths[path].default;
        }
    }

    // Play sound asynchronously
    async playSound(path) {
        if (!this.sounds[path]) {
            throw new Error(`Sound at path "${path}" not found.`);
        }

        return new Promise((resolve, reject) => {
            const audio = new Audio(this.sounds[path]);
            audio.play().then(resolve).catch(reject);
        });
    }
}
