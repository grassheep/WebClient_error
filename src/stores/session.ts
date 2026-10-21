/**
 * 会话交互状态机（契约依据 WebClient/README §五.1）。
 *
 * IDLE → CREATING_SESSION → UPLOADING → PROCESSING → RESULT_READY
 * 任一环节失败落 FAILED，用户核对后可回到 IDLE 重试。
 *
 * 安全约束：session_token 只存在于本 store 的内存中，禁止 localStorage /
 * sessionStorage / URL 参数 / console 输出。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { SessionStatus, UploadImageResult } from '@/api/sessions'
import type { ApiError } from '@/api/error'

export type ClientState =
  | 'IDLE'
  | 'CREATING_SESSION'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'RESULT_READY'
  | 'FAILED'

export interface SessionFailure {
  /** 面向用户的中文提示 */
  message: string
  /** 业务错误码或 HTTP 状态码，便于排查时对照 API.md §6 */
  code: number
  /** true = 技术故障横幅；false = 业务侧结论或业务拒绝 */
  technicalFault: boolean
  needsRetake: boolean
  needsNewSession: boolean
  requestId: string | null
}

const STATE_LABELS: Record<ClientState, string> = {
  IDLE: '待上传',
  CREATING_SESSION: '建立会话',
  UPLOADING: '上传图像',
  PROCESSING: '识别与推导',
  RESULT_READY: '结果就绪',
  FAILED: '处理失败',
}

export const useSessionStore = defineStore('session', () => {
  const state = ref<ClientState>('IDLE')
  const sessionId = ref<string | null>(null)
  const sessionToken = ref<string | null>(null)
  const serverStatus = ref<SessionStatus | null>(null)
  const result = ref<UploadImageResult | null>(null)
  const failure = ref<SessionFailure | null>(null)

  const isBusy = computed(
    () => state.value === 'CREATING_SESSION' || state.value === 'UPLOADING' || state.value === 'PROCESSING',
  )

  /** M0 单图会话：已出结果后必须新建会话才能换图 */
  const requiresNewSession = computed(() => result.value !== null)

  const statusLabel = computed(() => STATE_LABELS[state.value])

  const hasSession = computed(() => sessionId.value !== null && sessionToken.value !== null)

  function setCredential(id: string, token: string): void {
    sessionId.value = id
    sessionToken.value = token
    state.value = 'UPLOADING'
  }

  function markState(next: ClientState): void {
    state.value = next
  }

  function succeed(payload: UploadImageResult): void {
    result.value = payload
    serverStatus.value = payload.decision.marked_status
    failure.value = null
    state.value = 'RESULT_READY'
  }

  function fail(error: ApiError, message: string): void {
    failure.value = {
      message,
      code: error.code,
      technicalFault: error.isTechnicalFault,
      needsRetake: error.needsRetake,
      needsNewSession: error.needsNewSession,
      requestId: error.requestId,
    }
    state.value = 'FAILED'
  }

  function failLocal(message: string, needsRetake = false): void {
    failure.value = {
      message,
      code: -1000,
      technicalFault: false,
      needsRetake,
      needsNewSession: false,
      requestId: null,
    }
    state.value = 'FAILED'
  }

  /** 回到待上传态，保留会话凭据（同会话重试同一张图） */
  function retry(): void {
    failure.value = null
    state.value = sessionToken.value ? 'UPLOADING' : 'IDLE'
  }

  /** 丢弃会话重新开始（换图 / 会话过期 / 单图会话已满） */
  function resetSession(): void {
    sessionId.value = null
    sessionToken.value = null
    serverStatus.value = null
    result.value = null
    failure.value = null
    state.value = 'IDLE'
  }

  return {
    state,
    sessionId,
    sessionToken,
    serverStatus,
    result,
    failure,
    isBusy,
    requiresNewSession,
    statusLabel,
    hasSession,
    setCredential,
    markState,
    succeed,
    fail,
    failLocal,
    retry,
    resetSession,
  }
})
