/**
 * 会话主链路接口封装（M0 三个端点）。
 *
 * 契约依据 contracts/API.md §4.4 与 WebClient/README §六：
 *  - POST /api/v1/sessions                                创建会话并签发匿名凭证
 *  - POST /api/v1/sessions/{session_id}/images            上传单张实拍图并取得决策
 *  - GET  /api/v1/sessions/{session_id}                   查询会话全景
 */
import type { Decision, Evidence, Observation } from '@/types/contract'

import { buildMockResult, resolveMockScenario } from '@/mocks/scenarios'
import { createIdempotencyKey } from '@/utils/idempotency'

import { requestJson } from './http'

export type ClientType = 'web' | 'mobile' | 'wx'

/** 服务端会话状态；M0 只依赖 AWAITING_INPUT 与处理完成态 */
export type SessionStatus = 'AWAITING_INPUT' | 'PROCESSING' | 'RESULT_READY' | 'FAILED' | (string & {})

export interface CreateSessionPayload {
  client_type?: ClientType
  notes?: string
}

export interface SessionCredential {
  session_id: string
  session_token: string
  created_at: string
  status: SessionStatus
}

export interface SessionImageSummary {
  image_id: string
  created_at?: string
  image_role?: string | null
  auxiliary_barcode?: string | null
}

export interface SessionDetail {
  session_id: string
  created_at: string
  status: SessionStatus
  images: SessionImageSummary[]
  observations: Observation[]
  evidence: Evidence | null
  decision: Decision | null
}

export interface UploadImageOptions {
  imageRole?: string
  /** 13 位数字 GTIN，仅作辅助线索，严禁用通用保质期库覆盖实际喷码 */
  auxiliaryBarcode?: string
}

export interface UploadImageResult {
  image_id: string
  observation: Observation
  evidence: Evidence
  decision: Decision
}

/** 后端视觉管线未就绪（503/5002）时用 mock 打通交互 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function createSession(
  payload: CreateSessionPayload = { client_type: 'web' },
  idempotencyKey: string = createIdempotencyKey(),
): Promise<SessionCredential> {
  if (USE_MOCK) {
    await delay(180)
    return {
      session_id: 'sess_mock_20261021_001',
      session_token: 'mock-token-not-for-production',
      created_at: new Date().toISOString(),
      status: 'AWAITING_INPUT',
    }
  }

  return requestJson<SessionCredential>('/api/v1/sessions', {
    method: 'POST',
    idempotencyKey,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function uploadImage(
  sessionId: string,
  token: string,
  file: File,
  idempotencyKey: string,
  options: UploadImageOptions = {},
): Promise<UploadImageResult> {
  if (USE_MOCK) {
    await delay(900)
    // 注意：mock 分支刻意不使用 file 的内容 —— 上传的图与返回结果无关，
    // 场景由 ?scenario= 或 VITE_MOCK_SCENARIO 决定，见 src/mocks/scenarios.ts。
    const { observation, evidence, decision } = buildMockResult(resolveMockScenario())
    return {
      image_id: observation.image_id,
      observation,
      evidence,
      decision,
    }
  }

  const form = new FormData()
  form.append('file', file, file.name)
  if (options.imageRole) form.append('image_role', options.imageRole)
  if (options.auxiliaryBarcode) form.append('auxiliary_barcode', options.auxiliaryBarcode)

  return requestJson<UploadImageResult>(`/api/v1/sessions/${sessionId}/images`, {
    method: 'POST',
    token,
    idempotencyKey,
    body: form,
    // 15MB 上限下，上传 + 推理需更长窗口；推理 SLA 仍以服务端 1000ms 计
    timeoutMs: 30_000,
  })
}

export async function getSession(sessionId: string, token: string): Promise<SessionDetail> {
  if (USE_MOCK) {
    await delay(200)
    const { observation, evidence, decision } = buildMockResult(resolveMockScenario())
    return {
      session_id: sessionId,
      created_at: new Date().toISOString(),
      status: 'RESULT_READY',
      images: [{ image_id: observation.image_id, image_role: 'package_back' }],
      observations: [observation],
      evidence,
      decision,
    }
  }

  return requestJson<SessionDetail>(`/api/v1/sessions/${sessionId}`, { token })
}
