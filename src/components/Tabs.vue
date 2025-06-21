<template>
  <div class="tabs-container">
    <div role="tablist" aria-label="Video and Settings Tabs">
      <button
        v-for="(tab, index) in tabs"
        :key="index"
        :id="`tab-${index}`"
        role="tab"
        :aria-selected="selectedTab === index"
        :aria-controls="`tabpanel-${index}`"
        @click="selectTab(index)"
        @keydown.right.prevent="selectNextTab"
        @keydown.left.prevent="selectPreviousTab"
        :tabindex="selectedTab === index ? 0 : -1"
        ref="tabRefs"
      >
        {{ tab.title }}
      </button>
    </div>
    <div
      v-for="(tab, index) in tabs"
      :key="index"
      :id="`tabpanel-${index}`"
      role="tabpanel"
      :aria-labelledby="`tab-${index}`"
      v-show="selectedTab === index"
    >
      <component :is="tab.component" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';

const props = defineProps<{ tabs: { title: string; component: any }[] }>();

const selectedTab = ref(0);
const tabRefs = ref<HTMLButtonElement[]>([]);

const selectTab = (index: number) => {
  selectedTab.value = index;
  nextTick(() => {
    tabRefs.value[index]?.focus();
  });
};

const selectNextTab = () => {
  const nextTabIndex = (selectedTab.value + 1) % props.tabs.length;
  selectTab(nextTabIndex);
};

const selectPreviousTab = () => {
  const previousTabIndex =
    (selectedTab.value - 1 + props.tabs.length) % props.tabs.length;
  selectTab(previousTabIndex);
};

onMounted(() => {
  if (tabRefs.value[0]) {
    tabRefs.value[0].focus();
  }
});
</script>

<style scoped>
.tabs-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 2rem auto;
  font-family: sans-serif;
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
}

[role="tablist"] {
  display: flex;
  background-color: #f0f0f0;
  border-bottom: 1px solid #ccc;
}

[role="tab"] {
  padding: 1rem 1.5rem;
  border: none;
  background-color: transparent;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  color: #333;
  transition: background-color 0.2s ease, color 0.2s ease;
  flex-grow: 1;
  text-align: center;
}

[role="tab"]:hover,
[role="tab"]:focus {
  background-color: #e0e0e0;
  outline: none;
}

[role="tab"][aria-selected="true"] {
  background-color: #fff;
  color: #007bff; /* Or your primary color */
  border-bottom: 2px solid #007bff; /* Or your primary color */
}

[role="tabpanel"] {
  padding: 1.5rem;
  background-color: #fff;
}
</style>
