export {}

declare global {
  type SidecarState = 'starting' | 'ready' | 'restarting' | 'stopped' | 'failed'

  interface SidecarInfo {
    state: SidecarState
    port: number | null
    token: string | null
    message: string
  }

  interface Window {
    aether: {
      platform: string
      getSidecarInfo: () => Promise<SidecarInfo>
      onSidecarStatus: (callback: (info: SidecarInfo) => void) => () => void
    }
  }
}