/**
 * 上传主流程编排（T-M0-16 核心逻辑）。
 *
 * 覆盖契约中的四条工程约束：
 *  1. 幂等：超时重试复用原 Idempotency-Key，换图必须换新键；
 *  2. 超时先查后传：上传超时先 GET 会话，避免把已成功的请求重复提交；
 *  3. 单图会话：409 表示该会话已有图像，先查会话再决定是否新建；
 *  4. 故障分层：技术故障只提示重试，不落入业务「无法判定」。
 */
import { onBeforeUnmount, ref } from 'vue'

import { isApiError } from '@/api/error'
import { createSession, getSession, uploadImage } from '@/api/sessions'
import { prepareImage, revokePreparedImage } from '@/services/image'
import type { PreparedImage } from '@/services/image'
import { useSessionStore } from '@/stores/session'
import { createIdempotencyKey } from '@/utils/idempotency'

interface PendingUpload {
  key: string
  signature: string
}

function signatureOf(prepared: PreparedImage): string {
  const { file } = prepared
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function useUploadFlow() {
  const store = useSessionStore()
  const prepared = ref<PreparedImage | null>(null)
  const isPreparing = ref(false)

  let sessionKey: string | null = null
  let pendingUpload: PendingUpload | null = null

  async function selectFile(file: File): Promise<void> {
    if (store.isBusy) return

    revokePreparedImage(prepared.value)
    prepared.value = null
    pendingUpload = null
    isPreparing.value = true

    try {
      prepared.value = await prepareImage(file)
      if (store.state === 'FAILED') store.retry()
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片预处理失败'
      prepared.value = null
      store.failLocal(message, true)
    } finally {
      isPreparing.value = false
    }
  }

  function clearImage(): void {
    if (store.isBusy) return
    revokePreparedImage(prepared.value)
    prepared.value = null
    pendingUpload = null
    store.resetSession()
  }

  async function ensureSession(): Promise<{ id: string; token: string }> {
    if (store.sessionId && store.sessionToken) {
      return { id: store.sessionId, token: store.sessionToken }
    }

    store.markState('CREATING_SESSION')
    sessionKey = sessionKey ?? createIdempotencyKey()
    const credential = await createSession({ client_type: 'web' }, sessionKey)
    store.setCredential(credential.session_id, credential.session_token)
    return { id: credential.session_id, token: credential.session_token }
  }

  /** 上传超时 / 冲突时的兜底：查询会话是否已产出决策 */
  async function recoverFromServer(id: string, token: string): Promise<boolean> {
    try {
      const detail = await getSession(id, token)
      if (detail.decision && detail.evidence && detail.observations.length > 0) {
        const observation = detail.observations[detail.observations.length - 1]
        if (observation) {
          store.succeed({
            image_id: observation.image_id,
            observation,
            evidence: detail.evidence,
            decision: detail.decision,
          })
          return true
        }
      }
      return false
    } catch {
      return false
    }
  }

  async function submit(): Promise<void> {
    if (store.isBusy) return
    if (!prepared.value) {
      store.failLocal('请先选择一张包装实拍图')
      return
    }

    if (store.requiresNewSession) {
      store.failLocal('M0 为单图会话，换图请先点击「新建会话」', false)
      return
    }

    const image = prepared.value
    let session: { id: string; token: string }

    try {
      session = await ensureSession()
    } catch (error) {
      if (isApiError(error)) {
        const message = error.isTechnicalFault
          ? '服务暂时不可用（技术故障），请稍后重试，这不代表包装无法判定'
          : error.message
        store.fail(error, message)
      } else {
        store.failLocal('创建会话失败，请重试')
      }
      return
    }

    const signature = signatureOf(image)
    if (!pendingUpload || pendingUpload.signature !== signature) {
      pendingUpload = { key: createIdempotencyKey(), signature }
    }
    const idempotencyKey = pendingUpload.key

    store.markState('UPLOADING')
    const processingTimer = setTimeout(() => {
      if (store.state === 'UPLOADING') store.markState('PROCESSING')
    }, 500)

    try {
      const result = await uploadImage(session.id, session.token, image.file, idempotencyKey)
      store.succeed(result)
      pendingUpload = null
    } catch (error) {
      if (!isApiError(error)) {
        store.failLocal('上传失败，请重试')
        return
      }

      if (error.isTimeout) {
        const recovered = await recoverFromServer(session.id, session.token)
        if (!recovered) {
          store.fail(error, '上传超时，未取回结果，请重试（同一张图重试不会重复上传）')
        }
        return
      }

      if (error.needsNewSession) {
        const recovered = await recoverFromServer(session.id, session.token)
        if (recovered) return
        store.resetSession()
        store.fail(error, '当前会话已失效或已有图像，请重新选择图片发起新会话')
        return
      }

      if (error.needsRetake) {
        store.fail(error, `图像质量未达标：${error.message}，请调整光线与角度后重拍`)
        return
      }

      const message = error.isTechnicalFault
        ? '识别服务暂时不可用（技术故障），请稍后重试；不代表该包装无法判定'
        : error.message
      store.fail(error, message)
    } finally {
      clearTimeout(processingTimer)
    }
  }

  function startOver(): void {
    revokePreparedImage(prepared.value)
    prepared.value = null
    pendingUpload = null
    sessionKey = null
    store.resetSession()
  }

  onBeforeUnmount(() => {
    revokePreparedImage(prepared.value)
  })

  return {
    prepared,
    isPreparing,
    selectFile,
    clearImage,
    submit,
    startOver,
  }
}
