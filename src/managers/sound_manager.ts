const soundPaths = import.meta.glob('@assets/sounds/*.m4a', { eager: true });

export default class SoundManager {
    private sounds;

    constructor() {
        this.sounds = {};
        this.loadSounds();
    }

    loadSounds() {
        for (const fullPath in soundPaths) {
            // Extract filename without extension from the full path
            const fileName = fullPath.split('/').pop().replace('.m4a', '');
            this.sounds[fileName] = soundPaths[fullPath].default;
        }
    }

    async playSound(name) {
        if (!this.sounds[name]) {
            throw new Error(`Sound named "${name}" not found.`);
        }

        return new Promise((resolve, reject) => {
            const audio = new Audio(this.sounds[name]);
            audio.play().then(resolve).catch(reject);
        });
    }
}
