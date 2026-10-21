/**
 * 默认场景（near）的静态导出，保留给需要"直接 import 一份固定 DTO"的组件使用。
 *
 * 数据源已统一到 src/mocks/scenarios.ts —— 本文件只是薄封装，不再重复维护数值，
 * 避免出现"fixtures 说剩余 11 天、scenarios 说剩余 20 天"这种自相矛盾。
 *
 * 需要其他状态（在期/超期/未决）请用：
 *   import { buildMockResult } from '@/mocks/scenarios'
 *   const { observation, evidence, decision } = buildMockResult('expired')
 *
 * 字段名严格遵循 contracts/*.json，不得自行改写，否则会掩盖契约不一致问题。
 */
import { buildMockResult } from './scenarios'

const DEFAULT = buildMockResult('near')

export const mockObservation = DEFAULT.observation
export const mockEvidence = DEFAULT.evidence
export const mockDecision = DEFAULT.decision
