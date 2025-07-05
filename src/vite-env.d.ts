/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer & {
    openFileDialog: () => Promise<string | null>
    saveFileDialog: (defaultPath?: string) => Promise<string | null>
    getCaptureSources: () => Promise<CaptureSource[]>
    captureScreen: (source: string) => Promise<string>
    setClipboard: (text: string) => void
  }
}
