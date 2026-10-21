<script setup lang="ts">
import { computed } from 'vue'

import { USE_MOCK } from '@/api/sessions'
import ImageDropzone from '@/features/upload/ImageDropzone.vue'
import { useUploadFlow } from '@/features/upload/useUploadFlow'
import { useSessionStore } from '@/stores/session'

const store = useSessionStore()
const { prepared, isPreparing, selectFile, clearImage, submit, startOver } = useUploadFlow()

const STEPS = ['CREATING_SESSION', 'UPLOADING', 'PROCESSING', 'RESULT_READY'] as const

const MARKED_LABEL: Record<string, string> = {
  WITHIN_MARKED_PERIOD: '在期',
  NEAR_EXPIRY: '临期',
  PAST_MARKED_PERIOD: '超期',
  UNDETERMINED: '未决待核',
}

const REVIEW_LABEL: Record<string, string> = {
  EVIDENCE_COMPLETE: '证据完备',
  INFORMATION_MISSING: '信息缺失',
  EVIDENCE_CONFLICT: '证据冲突',
  LOW_CONFIDENCE: '低置信度',
}

const decision = computed(() => store.result?.decision ?? null)

const markedStatus = computed(() => {
  const status = decision.value?.marked_status
  if (!status) return null
  return {
    key: status,
    label: MARKED_LABEL[status] ?? status,
    className: `status-${status.toLowerCase()}`,
  }
})

const reviewStatus = computed(() => {
  const status = decision.value?.review_status
  return status ? (REVIEW_LABEL[status] ?? status) : null
})

const stepIndex = computed(() => {
  const index = STEPS.indexOf(store.state as (typeof STEPS)[number])
  return index < 0 ? -1 : index
})

const canSubmit = computed(() => !!prepared.value && !store.isBusy)
const showFailure = computed(() => store.state === 'FAILED' && !!store.failure)
</script>

<template>
  <div class="page">
    <header class="masthead">
      <div>
        <h1>轻眸识刻</h1>
        <p class="subtitle">包装印刷日期识读与标示状态推导</p>
      </div>
      <span v-if="USE_MOCK" class="mock-badge">MOCK 数据</span>
    </header>

    <main class="panel">
      <ImageDropzone
        :prepared="prepared"
        :disabled="store.isBusy"
        :preparing="isPreparing"
        @select="selectFile"
        @clear="clearImage"
      />

      <div class="submit-row">
        <button type="button" class="btn btn-primary" :disabled="!canSubmit" @click="submit">
          开始查验
        </button>
        <button
          v-if="store.requiresNewSession || store.state === 'FAILED'"
          type="button"
          class="btn"
          @click="startOver"
        >
          新建会话
        </button>
        <span class="state-chip" :data-state="store.state">{{ store.statusLabel }}</span>
      </div>

      <ol v-if="stepIndex >= 0" class="steps">
        <li v-for="(step, index) in STEPS" :key="step" :class="{ done: index <= stepIndex }">
          <span class="dot" aria-hidden="true"></span>
        </li>
      </ol>

      <p v-if="showFailure" class="banner" :class="{ technical: store.failure?.technicalFault }">
        {{ store.failure?.message }}
        <span class="banner-code">code {{ store.failure?.code }}</span>
      </p>

      <section v-if="decision && markedStatus" class="result">
        <p class="result-head">
          识别结果已就绪
          <span class="mount-note">决策卡片（T-M0-17）在此挂载</span>
        </p>
        <div class="result-grid">
          <div>
            <span class="result-label">标示状态</span>
            <span class="result-value" :class="markedStatus.className">{{ markedStatus.label }}</span>
          </div>
          <div>
            <span class="result-label">剩余天数</span>
            <span class="result-value">{{ decision.evidence_snapshot.remaining_days ?? '—' }}</span>
          </div>
          <div>
            <span class="result-label">证据复核</span>
            <span class="result-value">{{ reviewStatus }}</span>
          </div>
          <div>
            <span class="result-label">观测到</span>
            <span class="result-value small">
              {{ decision.evidence_snapshot.mfg_date ?? '—' }} 生产 ·
              {{ decision.evidence_snapshot.exp_date ?? '—' }} 到期
            </span>
          </div>
        </div>
        <p v-if="decision.warnings.length" class="warning">
          {{ decision.warnings.join('；') }}
        </p>
      </section>
    </main>

    <footer class="foot">
      <p>本系统仅推导包装印刷标示状态，不对食品是否可食用作出判断。</p>
      <p class="foot-dim">临期阈值为系统配置值（默认 30 天），非国家强制标准。</p>
    </footer>
  </div>
</template>

<style scoped>
.page {
  max-width: 860px;
  margin: 0 auto;
  padding: 2.5rem 1.25rem calc(2rem + var(--qm-space-safe-bottom));
}

.masthead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.masthead h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: var(--qm-text-tertiary);
}

.mock-badge {
  flex: none;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--qm-border);
  background: var(--qm-surface-sunken);
  color: var(--qm-text-tertiary);
  font-size: 0.72rem;
}

.panel {
  background: var(--qm-surface);
  border: 1px solid var(--qm-border);
  border-radius: var(--qm-radius-lg);
  padding: 1.25rem;
}

.submit-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1.1rem;
  flex-wrap: wrap;
}

.btn {
  appearance: none;
  border: 1px solid var(--qm-border);
  background: var(--qm-surface);
  color: var(--qm-text-primary);
  border-radius: var(--qm-radius-md);
  padding: 0.5rem 0.95rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.btn-primary {
  background: var(--qm-accent);
  border-color: var(--qm-accent);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--qm-accent-strong);
}

.state-chip {
  margin-left: auto;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: var(--qm-surface-sunken);
  color: var(--qm-text-secondary);
  font-size: 0.76rem;
}

.state-chip[data-state='RESULT_READY'] {
  background: var(--qm-status-within-soft);
  color: var(--qm-status-within);
}

.state-chip[data-state='FAILED'] {
  background: var(--qm-status-past-soft);
  color: var(--qm-status-past);
}

.steps {
  list-style: none;
  display: flex;
  gap: 0.4rem;
  padding: 0;
  margin: 1rem 0 0;
}

.steps li {
  display: flex;
  align-items: center;
}

.steps .dot {
  display: block;
  width: 22px;
  height: 3px;
  border-radius: 2px;
  background: var(--qm-border);
}

.steps li.done .dot {
  background: var(--qm-accent);
}

.banner {
  margin: 1rem 0 0;
  padding: 0.65rem 0.8rem;
  border-radius: var(--qm-radius-md);
  background: var(--qm-status-near-soft);
  color: var(--qm-status-near);
  font-size: 0.83rem;
}

.banner.technical {
  background: var(--qm-status-past-soft);
  color: var(--qm-status-past);
}

.banner-code {
  margin-left: 0.5rem;
  font-family: var(--qm-font-mono);
  font-size: 0.72rem;
  opacity: 0.8;
}

.result {
  margin-top: 1.25rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--qm-border);
}

.result-head {
  margin: 0 0 0.8rem;
  font-size: 0.9rem;
  font-weight: 500;
}

.mount-note {
  margin-left: 0.5rem;
  font-weight: 400;
  font-size: 0.74rem;
  color: var(--qm-text-tertiary);
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.9rem;
}

.result-label {
  display: block;
  font-size: 0.75rem;
  color: var(--qm-text-tertiary);
}

.result-value {
  display: block;
  margin-top: 0.15rem;
  font-size: 1.15rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.result-value.small {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--qm-text-secondary);
}

.status-within_marked_period {
  color: var(--qm-status-within);
}

.status-near_expiry {
  color: var(--qm-status-near);
}

.status-past_marked_period {
  color: var(--qm-status-past);
}

.status-undetermined {
  color: var(--qm-status-undetermined);
}

.warning {
  margin: 0.9rem 0 0;
  font-size: 0.78rem;
  color: var(--qm-text-tertiary);
}

.foot {
  margin-top: 1.25rem;
  font-size: 0.76rem;
  color: var(--qm-text-secondary);
}

.foot p {
  margin: 0.15rem 0;
}

.foot-dim {
  color: var(--qm-text-tertiary);
}

@media (max-width: 560px) {
  .page {
    padding: 1.5rem 0.85rem calc(1.5rem + var(--qm-space-safe-bottom));
  }

  .masthead h1 {
    font-size: 1.15rem;
  }

  .state-chip {
    margin-left: 0;
  }
}
</style>
