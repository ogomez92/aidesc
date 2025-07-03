<template>
  <div class="player-controls">
    <video ref="videoPlayer" :src="video" @loadedmetadata="onLoadedMetadata" @timeupdate="onTimeUpdate" @play="onPlay"
      @pause="onPause" @ended="onEnded" class="video-player"></video>
    <div class="controls">
      <button @click="togglePlay">{{ isPlaying ? $t('vp_pause') : $t('vp_play') }}</button>
      <input type="range" min="0" :max="duration" v-model="currentTime" @input="onSliderChange" class="slider" />
      <span>{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
    </div>
  </div>
  <NotificationBar :message="notificationMessage" visible="true" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import NotificationBar from '@components/NotificationBar.vue';
import fs from 'fs';
const notificationMessage = ref('Player Loaded. Description will be displayed here.');

const props = defineProps({
  video: {
    type: String,
    required: true,
  },
  segments: {
    type: Array,
    required: true
  },
});

const videoPlayer = ref(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);

const onLoadedMetadata = () => {
  if (videoPlayer.value) {
    duration.value = videoPlayer.value.duration;
  }
};

const onTimeUpdate = () => {
  if (videoPlayer.value) {
    const currentTime = videoPlayer.value.currentTime;

    let currentSegment = null;

    for (let i = 0; i < props.segments.length; i++) {
      const segment = props.segments[i];
      const nextSegment = props.segments[i + 1];

      // Check if current time is within the current segment bounds
      if (currentTime >= segment.startTime && (!nextSegment || currentTime < nextSegment.startTime)) {
        currentSegment = segment;
        break;
      }
    }

    if (currentSegment) {
      // use settings to see what we want
      notificationMessage.value = currentSegment.description;
    }
  }
};

const onPlay = () => {
  isPlaying.value = true;
};

const onPause = () => {
  isPlaying.value = false;
};

const onEnded = () => {
  isPlaying.value = false;
  currentTime.value = 0;
};

const togglePlay = () => {
  if (videoPlayer.value) {
    if (isPlaying.value) {
      videoPlayer.value.pause();
    } else {
      videoPlayer.value.play();
    }
  }
};

const onSliderChange = (event) => {
  if (videoPlayer.value) {
    const time = parseFloat(event.target.value);
    videoPlayer.value.currentTime = time;
    currentTime.value = time;
  }
};

const formatTime = (timeInSeconds) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const handleKeydown = (event) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    togglePlay();
  } else if (event.code === 'ArrowRight') {
    event.preventDefault();
    seek(5);
  } else if (event.code === 'ArrowLeft') {
    event.preventDefault();
    seek(-5);
  } else if (event.code.startsWith('Digit')) {
    event.preventDefault();
    const digit = parseInt(event.code.replace('Digit', ''));
    if (!isNaN(digit) && digit >= 0 && digit <= 9) {
      seekToPercentage(digit * 10);
    }
  }
};

const seek = (seconds) => {
  if (videoPlayer.value) {
    videoPlayer.value.currentTime = Math.max(0, Math.min(duration.value, videoPlayer.value.currentTime + seconds));
  }
};

const seekToPercentage = (percentage) => {
  if (videoPlayer.value) {
    videoPlayer.value.currentTime = (duration.value * percentage) / 100;
  }
};

onMounted(async () => {
  const videoData = fs.readFileSync(props.video);
  const extension = props.video.split('.').pop().toLowerCase();
  const blob = new Blob([videoData], { type: `video/${extension}` });
  const videoUrl = URL.createObjectURL(blob);

  window.addEventListener('keydown', handleKeydown);
  console.log('url made');

  if (videoPlayer.value) {
    console.log('loading player')

    videoPlayer.value.src = videoUrl;
    videoPlayer.value.load();

    videoPlayer.value.volume = 1;
  }

  props.segments.sort((a, b) => a.startTime - b.startTime);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

</script>

<style scoped>
.player-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.video-player {
  width: 100%;
  max-width: 800px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.slider {
  width: 400px;
}
</style>
