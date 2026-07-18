/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_APP_SWITCHER?: string
  readonly VITE_AUTH_ENABLED?: string
  readonly VITE_AUTH_PORTAL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
