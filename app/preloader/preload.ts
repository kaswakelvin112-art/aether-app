import { contextBridge, ipcRenderer } from 'electron'

type SidecarInfo = {
  state: 'starting' | 'ready' | 'restarting' | 'stopped' | 'failed'
  port: number | null
  token: string | null
  message: string
}

contextBridge.exposeInMainWorld('aether', {
  platform: process.platform,
  getSidecarInfo: (): Promise<SidecarInfo> => ipcRenderer.invoke('sidecar:get-info'),
  onSidecarStatus: (callback: (info: SidecarInfo) => void): (() => void) => {
    const listener = (_event: unknown, info: SidecarInfo): void => callback(info)
    ipcRenderer.on('sidecar:status', listener)
    return () => ipcRenderer.removeListener('sidecar:status', listener)
  }
})