import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('aether', {
  platform: process.platform
})