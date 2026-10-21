/**
 * 客户端图像预处理：格式/体积门禁 + 压缩到约 1MB + 预览。
 *
 * 契约依据 WebClient/README §八：客户端在上传前将图像压缩至约 1MB，
 * 规避低带宽环境下的传输尾延迟；服务端上限 15MB（API.md §4.4）。
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
export const TARGET_UPLOAD_BYTES = 1024 * 1024
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png'] as const

/** 长边上限，兼顾日期区域可辨识度与传输体积 */
const MAX_EDGE = 1920
const QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]

export type ImageValidationCode = 'UNSUPPORTED_TYPE' | 'TOO_LARGE' | 'DECODE_FAILED'

export class ImageValidationError extends Error {
  readonly code: ImageValidationCode

  constructor(code: ImageValidationCode, message: string) {
    super(message)
    this.name = 'ImageValidationError'
    this.code = code
  }
}

export interface PreparedImage {
  /** 实际用于上传的文件（可能已压缩） */
  file: File
  previewUrl: string
  width: number
  height: number
  originalBytes: number
  finalBytes: number
  compressed: boolean
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve(image)
    }
    image.onerror = () => {
      reject(new ImageValidationError('DECODE_FAILED', '图片解码失败，请更换图片'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new ImageValidationError('DECODE_FAILED', '图像压缩失败，请重试'))
        }
      },
      'image/jpeg',
      quality,
    )
  })
}

function drawToCanvas(source: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new ImageValidationError('DECODE_FAILED', '当前浏览器不支持 Canvas 压缩')
  }
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return canvas
}

/**
 * 校验并压缩图片。已是小体积 JPEG 时直接透传，避免无谓重编码造成 OCR 细节损失。
 */
export async function prepareImage(input: File): Promise<PreparedImage> {
  if (!ACCEPTED_MIME_TYPES.includes(input.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    throw new ImageValidationError('UNSUPPORTED_TYPE', '仅支持 JPEG / PNG 格式的实拍图')
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError('TOO_LARGE', `文件超过 15 MB 上限（当前 ${formatBytes(input.size)}）`)
  }

  const objectUrl = URL.createObjectURL(input)
  let source: HTMLImageElement
  try {
    source = await loadImageElement(objectUrl)
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }

  const naturalWidth = source.naturalWidth
  const naturalHeight = source.naturalHeight
  const scale = Math.min(1, MAX_EDGE / Math.max(naturalWidth, naturalHeight))
  const targetWidth = Math.max(1, Math.round(naturalWidth * scale))
  const targetHeight = Math.max(1, Math.round(naturalHeight * scale))

  const keepOriginal = input.size <= TARGET_UPLOAD_BYTES && input.type === 'image/jpeg'

  if (keepOriginal) {
    URL.revokeObjectURL(objectUrl)
    return {
      file: input,
      previewUrl: URL.createObjectURL(input),
      width: naturalWidth,
      height: naturalHeight,
      originalBytes: input.size,
      finalBytes: input.size,
      compressed: false,
    }
  }

  let canvas = drawToCanvas(source, targetWidth, targetHeight)
  let blob = await canvasToBlob(canvas, QUALITY_STEPS[0] ?? 0.9)

  for (const quality of QUALITY_STEPS.slice(1)) {
    if (blob.size <= TARGET_UPLOAD_BYTES) break
    blob = await canvasToBlob(canvas, quality)
  }

  // 极端情况（高噪点照片）：继续按比例缩边，最多再缩三轮
  let guard = 0
  while (blob.size > TARGET_UPLOAD_BYTES && guard < 3) {
    guard += 1
    const nextWidth = Math.max(1, Math.round(canvas.width * 0.85))
    const nextHeight = Math.max(1, Math.round(canvas.height * 0.85))
    canvas = drawToCanvas(source, nextWidth, nextHeight)
    blob = await canvasToBlob(canvas, QUALITY_STEPS[QUALITY_STEPS.length - 1] ?? 0.5)
  }

  URL.revokeObjectURL(objectUrl)

  const baseName = input.name.replace(/\.[^.]+$/, '')
  const output = new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: input.lastModified,
  })

  return {
    file: output,
    previewUrl: URL.createObjectURL(output),
    width: canvas.width,
    height: canvas.height,
    originalBytes: input.size,
    finalBytes: output.size,
    compressed: true,
  }
}

export function revokePreparedImage(prepared: PreparedImage | null): void {
  if (prepared) {
    URL.revokeObjectURL(prepared.previewUrl)
  }
}
