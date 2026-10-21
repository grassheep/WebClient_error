/**
 * Mock 场景库（仅 mock 模式使用，绝不进入真实链路）。
 *
 * 为什么需要多套：单一 fixture 只能产出一个 marked_status，
 * 而 T-M0-17 的红/黄/绿三态 + 未决态必须四种可复现输入才能截图与自测。
 *
 * 切换方式（改完刷新页面即可，无需重启 dev server）：
 *   1) URL 查询参数（优先级最高）：http://localhost:5173/?scenario=expired
 *   2) 环境变量：.env.local 里加 VITE_MOCK_SCENARIO=expired
 *   3) 二者都不给：默认 near（与 fixtures.ts 的默认取值完全一致）
 *
 * ── 日期自洽铁律（改数据前必读）──
 *   exp_date        = mfg_date + shelf_life
 *   remaining_days  = exp_date − observed_at（按自然日计，负值表示已超期）
 * 基准观察时刻 OBSERVED_AT = 2026-10-21T18:40:00+08:00。
 * 三处日期必须同改，否则截图上「剩余天数」与「快照日期」互相矛盾，
 * 答辩时评委一按计算器就露。
 *
 *   场景            mfg          exp          剩余天数   校验
 *   near            2025-11-01   2026-11-01   +11       2026-10-21 → 11-01
 *   within          2026-09-01   2027-09-01   +315      365 − 50
 *   expired         2024-03-15   2025-03-15   −585      365 + 220
 *   undetermined    —            —             null      证据缺失，不做推断
 *
 * 所有 id / model_version 均带 `mock` 字样，确保截图与日志里一眼可辨，
 * 不会被误认为真实推理结果。
 */
import type {
  Decision,
  Evidence,
  MarkedStatus,
  Observation,
  ReviewStatus,
  ShelfLife,
} from '@/types/contract'

export type MockScenario = 'near' | 'within' | 'expired' | 'undetermined'

export const MOCK_SCENARIOS: readonly MockScenario[] = [
  'near',
  'within',
  'expired',
  'undetermined',
] as const

/** 固定的基准观察时刻：所有场景共用，保证剩余天数可手算复核 */
const OBSERVED_AT = '2026-10-21T18:40:00+08:00'

/** 临期阈值说明：契约要求界面标明这是系统配置值，非国家标准 */
const THRESHOLD_WARNING = '临期阈值为系统配置值（默认 30 天），非国家强制标准'

interface ScenarioSpec {
  /** 是否检出到日期相关文本行；false = 图上没有可读喷码 */
  detected: boolean
  mfg: string | null
  shelf: ShelfLife | null
  exp: string | null
  remaining: number | null
  marked: MarkedStatus
  review: ReviewStatus
  missing: string[]
  warnings: string[]
  guidance: string | null
  /** 占位哈希（按场景名做 SHA-256，四场景互不相同） */
  hash: string
}

const SPECS: Record<MockScenario, ScenarioSpec> = {
  // ── 在期（绿）────────────────────────────────────────────
  within: {
    detected: true,
    mfg: '2026-09-01',
    shelf: { value: 12, unit: 'MONTH' },
    exp: '2027-09-01',
    remaining: 315,
    marked: 'WITHIN_MARKED_PERIOD',
    review: 'EVIDENCE_COMPLETE',
    missing: [],
    warnings: [],
    guidance: null,
    hash: 'dd098fb8ca1ce0e9e9691e84ce730544167215037943040213b5e66a55a78d60',
  },

  // ── 临期（黄）—— 与 fixtures.ts 默认值逐字段一致 ─────────
  near: {
    detected: true,
    mfg: '2025-11-01',
    shelf: { value: 12, unit: 'MONTH' },
    exp: '2026-11-01',
    remaining: 11,
    marked: 'NEAR_EXPIRY',
    review: 'EVIDENCE_COMPLETE',
    missing: [],
    warnings: [THRESHOLD_WARNING],
    guidance: null,
    hash: '8d9aed46de228a08cd3d57ece5f27dfca6e2b3cae77f9897b1d04d1bcde3fca5',
  },

  // ── 超期（红）────────────────────────────────────────────
  expired: {
    detected: true,
    mfg: '2024-03-15',
    shelf: { value: 12, unit: 'MONTH' },
    exp: '2025-03-15',
    remaining: -585,
    marked: 'PAST_MARKED_PERIOD',
    review: 'EVIDENCE_COMPLETE',
    missing: [],
    warnings: ['到期日由生产日期与保质期推算，非包装直接喷印'],
    guidance: null,
    hash: 'a717ae2b10b8de6c5277999ba8f2ed04126f2ad541f99c6805bab28745656e55',
  },

  // ── 未决（灰）—— 证据缺失，不是"超期" ───────────────────
  undetermined: {
    detected: false,
    mfg: null,
    shelf: null,
    exp: null,
    remaining: null,
    marked: 'UNDETERMINED',
    review: 'INFORMATION_MISSING',
    missing: ['mfg_date', 'shelf_life', 'exp_date'],
    warnings: ['证据不足，未做期限推断'],
    guidance: '未在图像中找到可读的生产日期与保质期，请对准包装上的喷码区域重新拍摄。',
    hash: 'b9359b47ba2cebcfa5bbe284dc9e084604ba782428a290463307269917b8123a',
  },
}

export interface MockResult {
  observation: Observation
  evidence: Evidence
  decision: Decision
}

/** 按场景构建一套结构完整、字段自洽的 DTO 三件套 */
export function buildMockResult(scenario: MockScenario): MockResult {
  const spec = SPECS[scenario]
  const tag = `mock_${scenario}`
  const imageId = `img_${tag}`
  const observationId = `obs_${tag}`
  const evidenceId = `ev_${tag}`
  const facts: Evidence['facts'] = []

  const detections: Observation['detections'] = spec.detected
    ? [
        {
          box_id: `box_${tag}_mfg`,
          category: 'mfg_line',
          bbox: [412, 747, 986, 803],
          bbox_format: 'xyxy',
          coordinate_space: 'original_image',
          confidence: 0.962,
          transcription: `生产日期 ${spec.mfg?.replace(/-/g, '/')}`,
          text_confidence: 0.947,
          polygon: [
            [412, 747],
            [986, 747],
            [986, 803],
            [412, 803],
          ],
          line_role: 'mfg_line',
        },
        {
          box_id: `box_${tag}_shelf`,
          category: 'shelf_life_line',
          bbox: [412, 812, 902, 864],
          bbox_format: 'xyxy',
          coordinate_space: 'original_image',
          confidence: 0.918,
          transcription: `保质期 ${spec.shelf?.value} 个月`,
          text_confidence: 0.902,
          polygon: [
            [412, 812],
            [902, 812],
            [902, 864],
            [412, 864],
          ],
          line_role: 'shelf_life_line',
        },
      ]
    : []

  if (spec.detected && spec.mfg && spec.shelf) {
    facts.push(
      {
        fact_id: `fact_${tag}_mfg`,
        field: 'mfg_date',
        value: spec.mfg,
        raw_text: `生产日期 ${spec.mfg.replace(/-/g, '/')}`,
        source_type: 'MODEL',
        source_image_id: imageId,
        source_observation_id: observationId,
        source_box_id: `box_${tag}_mfg`,
        source_correction_id: null,
        confidence: 0.947,
        eligible_for_decision: true,
      },
      {
        fact_id: `fact_${tag}_shelf`,
        field: 'shelf_life',
        value: spec.shelf,
        raw_text: `保质期 ${spec.shelf.value} 个月`,
        source_type: 'MODEL',
        source_image_id: imageId,
        source_observation_id: observationId,
        source_box_id: `box_${tag}_shelf`,
        source_correction_id: null,
        confidence: 0.902,
        eligible_for_decision: true,
      },
    )
  }

  const observation: Observation = {
    schema_version: 'observation',
    observation_id: observationId,
    image_id: imageId,
    session_id: 'sess_mock_20261021_001',
    model_version: 'mock-detect-ocr-0.0.0',
    generated_at: OBSERVED_AT,
    image_size: { width: 1600, height: 1200 },
    quality_passed: true,
    quality_metrics: { blurriness_score: 186.42, overexposure_ratio: 0.013 },
    detections,
    global_texts: [{ transcription: '净含量 500g', confidence: 0.887 }],
  }

  const evidence: Evidence = {
    schema_version: 'evidence',
    evidence_id: evidenceId,
    session_id: 'sess_mock_20261021_001',
    generated_at: OBSERVED_AT,
    parser_version: 'mock-parser-0.0.0',
    facts,
    conflicts: [],
    missing_fields: spec.missing,
    evidence_hash: spec.hash,
  }

  const decision: Decision = {
    schema_version: 'decision',
    decision_id: `dec_${tag}`,
    session_id: 'sess_mock_20261021_001',
    marked_status: spec.marked,
    review_status: spec.review,
    observed_at: OBSERVED_AT,
    generated_at: OBSERVED_AT,
    timezone: 'Asia/Shanghai',
    calculation_rule_version: 'date-rules',
    calculation_profile_id: 'profile_default_cn_30d',
    evidence_schema_version: 'evidence',
    evidence_id: evidenceId,
    evidence_hash: spec.hash,
    evidence_snapshot: {
      mfg_date: spec.mfg,
      shelf_life: spec.shelf,
      exp_date: spec.exp,
      exp_date_is_derived: spec.exp !== null,
      remaining_days: spec.remaining,
    },
    used_fact_ids: facts.map((f) => f.fact_id),
    missing_fields: spec.missing,
    warnings: spec.warnings,
    guidance: spec.guidance,
  }

  return { observation, evidence, decision }
}

/** 当前生效的场景：URL 参数 > 环境变量 > 默认 near */
export function resolveMockScenario(): MockScenario {
  const fromUrl =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('scenario')
      : null
  const fromEnv = import.meta.env.VITE_MOCK_SCENARIO ?? null
  const candidate = (fromUrl ?? fromEnv ?? 'near').trim()

  return (MOCK_SCENARIOS as readonly string[]).includes(candidate)
    ? (candidate as MockScenario)
    : 'near'
}
