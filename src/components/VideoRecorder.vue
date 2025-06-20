<template>
    <div>
        <video ref="video" width="640" height="480"></video>
        <button @click="toggleRecording">{{ !recording ? t('button_record') : t('button_stop') }}</button>
        <button @click="finishRecording" :disabled="!videoUrl">{{ $t('button_finish') }}</button>
    </div>
    <div role="alert" v-if="videoError">{{ videoError }}</div>
</template>

<script setup lang="ts">
import EventType from '@enums/event_type';
import { ref, onMounted, onUnmounted, defineEmits } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const video = ref<HTMLVideoElement | null>(null);
const playback = ref<HTMLVideoElement | null>(null);
const recording = ref<boolean>(false);
const mediaRecorder = ref<MediaRecorder | null>(null);
const recordedChunks = ref<Blob[]>([]);
const videoUrl = ref<string>('');
const videoError = ref<string>('');

const emit = defineEmits([EventType.RecordingFinished]);

const startStream = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
        });

        if (video.value) {
            video.value.srcObject = stream;
        }

        setupRecorder(stream);
    } catch (error) {
        videoError.value = t('video_recorder_error', {error})
        console.error(`Error accessing media devices: ${error}`);
    }
};

const setupRecorder = (stream: MediaStream) => {
    try {
        mediaRecorder.value = new MediaRecorder(stream);

        mediaRecorder.value.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
                recordedChunks.value.push(event.data);
            }
        };

        mediaRecorder.value.onstop = () => {
            try {
                const blob = new Blob(recordedChunks.value, { type: 'video/webm' });
                videoUrl.value = URL.createObjectURL(blob);
                recordedChunks.value = [];
            } catch (error) {
                videoError.value = `Error processing recorded data: ${error}`;
                console.error(`Error processing recorded data: ${error}`);
            }
        };
    } catch (error) {
        videoError.value = `Error setting up media recorder: ${error}`;
        console.error(`Error setting up media recorder: ${error}`);
    }
};

const toggleRecording = () => {
    try {
        if (!recording.value && mediaRecorder.value) {
            // Start the recording
            recording.value = true;
            mediaRecorder.value.start();
        } else if (recording.value && mediaRecorder.value) {
            // Stop the recording
            recording.value = false;
            mediaRecorder.value.stop();
        }
    } catch (error) {
        videoError.value = `Error toggling recording: ${error}`;
        console.error(`Error toggling recording: ${error}`);
    }
};

const finishRecording = () => {
    if (videoUrl.value) {
        emit(EventType.RecordingFinished, videoUrl.value);
    }
};

onMounted(() => {
    startStream();
});

onUnmounted(() => {
    // Stop all tracks when the component is unmounted
    if (video.value?.srcObject) {
        const stream = video.value.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
    }
    // Clean up object URLs
    if (videoUrl.value) {
        URL.revokeObjectURL(videoUrl.value);
    }
});
</script>

<style scoped>
/* Styling for the container holding the video and controls */
div {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 20px;
}

/* Video element styling */
video {
    border: 2px solid #ccc;
    border-radius: 8px;
    margin-bottom: 20px;
}

/* Button styling */
button {
    font-size: 16px;
    padding: 10px 20px;
    margin: 5px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background-color: #007bff;
    color: white;
    transition: background-color 0.3s ease;
}

button:disabled {
    background-color: #aaa;
    cursor: not-allowed;
}

button:hover:not(:disabled) {
    background-color: #0056b3;
}

/* Alert message styling */
div[role="alert"] {
    color: red;
    margin-top: 15px;
    font-weight: bold;
}
</style>
