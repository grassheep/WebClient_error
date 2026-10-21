/**
 * 统一响应封装与请求管线。
 *
 * 契约依据 API.md §1：成功 `{code, message, data, request_id}`，
 * 失败 `{code, message, data: null, request_id}`，一律 UTF-8 JSON。
 */
import { ApiError } from './error'

export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T | null
  request_id: string
}

export interface RequestOptions {
  method?: 'GET' | 'POST'
  /** 会话凭据；仅在内存中流转，严禁落盘或拼进 URL */
  token?: string | null
  /** 16–256 字符，网络重试必须复用原键 */
  idempotencyKey?: string
  body?: BodyInit | null
  headers?: Record<string, string>
  timeoutMs?: number
  signal?: AbortSignal
}

/** 留空即同源相对路径：开发走 vite 代理，生产走 Nginx 反代 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')

/** 推理链路 SLA 阈值 1000ms，客户端等待上限留足余量 */
const DEFAULT_TIMEOUT_MS = 15_000

export function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalized}`
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  return Number.isFinite(seconds) ? seconds : null
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  let response: Response
  try {
    response = await fetch(resolveApiUrl(path), {
      method: options.method ?? 'GET',
      headers,
      body: options.body ?? null,
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError({
      httpStatus: 0,
      code: controller.signal.aborted ? -1 : -2,
      message: controller.signal.aborted ? '请求超时，请重试' : '网络不可达，请检查连接',
    })
  } finally {
    clearTimeout(timer)
  }

  const raw = await response.text()
  let envelope: ApiEnvelope<T> | null = null
  if (raw) {
    try {
      envelope = JSON.parse(raw) as ApiEnvelope<T>
    } catch {
      envelope = null
    }
  }

  if (!response.ok) {
    throw new ApiError({
      httpStatus: response.status,
      code: envelope?.code ?? response.status,
      message: envelope?.message ?? `请求失败（HTTP ${response.status}）`,
      requestId: envelope?.request_id ?? null,
      retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
    })
  }

  if (!envelope) {
    throw new ApiError({
      httpStatus: response.status,
      code: -3,
      message: '响应体不是合法的 JSON 封装',
    })
  }

  if (envelope.data === null) {
    throw new ApiError({
      httpStatus: response.status,
      code: envelope.code,
      message: envelope.message || '响应缺少 data 载荷',
      requestId: envelope.request_id,
    })
  }

  return envelope.data
}
