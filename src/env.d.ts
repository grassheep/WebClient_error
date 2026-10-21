/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 业务 API 基地址，留空使用同源相对路径 */
  readonly VITE_API_BASE?: string
  /** 'true' 时启用本地 mock 数据 */
  readonly VITE_USE_MOCK?: string
  /** mock 场景：near | within | expired | undetermined（URL ?scenario= 优先级更高） */
  readonly VITE_MOCK_SCENARIO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
