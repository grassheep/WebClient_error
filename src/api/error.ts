/**
 * 传输层错误分类。
 *
 * 契约红线（API.md §6）：技术故障（5xx / 超时 / 限流）必须与业务推导结论分离，
 * 严禁把技术崩溃包装成「无法判定」—— 那会污染标示状态的语义。
 */
export interface ApiErrorInit {
  httpStatus: number
  code: number
  message: string
  requestId?: string | null
  retryAfterSeconds?: number | null
}

/** 业务侧需要用户重拍的图像质量门禁错误码 */
const RETAKE_CODES = new Set([4001, 4002, 4003])

/** 业务侧需要重建会话的错误码（会话过期 / 不存在 / 单图重复上传） */
const NEW_SESSION_CODES = new Set([4004, 409, 410])

export class ApiError extends Error {
  readonly httpStatus: number
  readonly code: number
  readonly requestId: string | null
  readonly retryAfterSeconds: number | null

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = 'ApiError'
    this.httpStatus = init.httpStatus
    this.code = init.code
    this.requestId = init.requestId ?? null
    this.retryAfterSeconds = init.retryAfterSeconds ?? null
  }

  /** httpStatus === 0 表示请求被本地中止（超时 / 主动取消） */
  get isTimeout(): boolean {
    return this.httpStatus === 0 && this.code === -1
  }

  /** 技术故障：只能提示重试，绝不能显示成业务结论 */
  get isTechnicalFault(): boolean {
    if (this.httpStatus === 0) return true
    return this.httpStatus >= 500 || this.httpStatus === 429
  }

  /** 图像质量不达标，需要用户重拍 */
  get needsRetake(): boolean {
    return RETAKE_CODES.has(this.code)
  }

  /** 会话已不可用，需要新建会话 */
  get needsNewSession(): boolean {
    return NEW_SESSION_CODES.has(this.code)
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}
