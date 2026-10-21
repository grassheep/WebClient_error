<script setup lang="ts">
import { computed, ref } from 'vue'

import type { PreparedImage } from '@/services/image'
import { ACCEPTED_MIME_TYPES, formatBytes } from '@/services/image'

const props = defineProps<{
  prepared: PreparedImage | null
  disabled: boolean
  preparing: boolean
}>()

const emit = defineEmits<{
  (event: 'select', file: File): void
  (event: 'clear'): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const acceptAttr = ACCEPTED_MIME_TYPES.join(',')

const hint = computed(() => {
  if (props.preparing) return '正在压缩与生成预览…'
  if (props.prepared) return '点击图片可重新选择，或重新拖入文件'
  return 'JPEG / PNG，单张上限 15MB，客户端自动压缩至约 1MB'
})

function pickFromDevice(): void {
  if (props.disabled) return
  fileInput.value?.click()
}

function handleFileInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('select', file)
  input.value = ''
}

function handleDrop(event: DragEvent): void {
  isDragging.value = false
  if (props.disabled) return
  const file = event.dataTransfer?.files?.[0]
  if (file) emit('select', file)
}

function handleDragOver(): void {
  if (!props.disabled) isDragging.value = true
}

function handleDragLeave(): void {
  isDragging.value = false
}
</script>

<template>
  <section
    class="dropzone"
    :class="{ 'is-dragging': isDragging, 'is-disabled': disabled, 'has-image': !!prepared }"
    role="button"
    tabindex="0"
    :aria-disabled="disabled"
    @click="pickFromDevice"
    @keydown.enter.prevent="pickFromDevice"
    @keydown.space.prevent="pickFromDevice"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      :accept="acceptAttr"
      :disabled="disabled"
      @change="handleFileInput"
    />

    <template v-if="prepared">
      <div class="preview">
        <img :src="prepared.previewUrl" :alt="`待识别图片预览，${prepared.width}×${prepared.height}`" />
      </div>
      <dl class="meta">
        <div>
          <dt>尺寸</dt>
          <dd>{{ prepared.width }} × {{ prepared.height }}</dd>
        </div>
        <div>
          <dt>原始体积</dt>
          <dd>{{ formatBytes(prepared.originalBytes) }}</dd>
        </div>
        <div>
          <dt>上传体积</dt>
          <dd>
            {{ formatBytes(prepared.finalBytes) }}
            <span v-if="prepared.compressed" class="tag">已压缩</span>
          </dd>
        </div>
      </dl>
    </template>

    <template v-else>
      <div class="placeholder">
        <svg viewBox="0 0 48 48" aria-hidden="true" class="icon">
          <path
            d="M24 32V12m0 0-7 7m7-7 7 7M10 32v4a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4v-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <p class="title">拖拽包装实拍图到这里</p>
        <p class="hint">{{ hint }}</p>
      </div>
    </template>
  </section>

  <div class="actions">
    <button type="button" class="btn btn-primary" :disabled="disabled" @click="pickFromDevice">
      选择图片
    </button>
    <button v-if="prepared" type="button" class="btn btn-ghost" :disabled="disabled" @click="emit('clear')">
      移除
    </button>
  </div>
</template>

<style scoped>
.dropzone {
  border: 1px dashed var(--qm-border-strong);
  border-radius: var(--qm-radius-lg);
  background: var(--qm-surface);
  padding: 1.5rem;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  outline: none;
}

.dropzone:focus-visible {
  border-color: var(--qm-accent);
  box-shadow: 0 0 0 3px var(--qm-accent-soft);
}

.dropzone.is-dragging {
  border-color: var(--qm-accent);
  background: var(--qm-accent-soft);
}

.dropzone.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1.5rem 0;
  text-align: center;
}

.icon {
  width: 40px;
  height: 40px;
  color: var(--qm-text-tertiary);
  margin-bottom: 0.5rem;
}

.title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--qm-text-primary);
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--qm-text-tertiary);
}

.preview {
  border-radius: var(--qm-radius-md);
  overflow: hidden;
  background: var(--qm-surface-sunken);
  display: flex;
  justify-content: center;
  max-height: 320px;
}

.preview img {
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
  display: block;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin: 0.9rem 0 0;
  font-size: 0.8rem;
}

.meta div {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.meta dt {
  color: var(--qm-text-tertiary);
  margin: 0;
}

.meta dd {
  margin: 0;
  color: var(--qm-text-secondary);
  font-variant-numeric: tabular-nums;
}

.tag {
  margin-left: 0.35rem;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  background: var(--qm-accent-soft);
  color: var(--qm-accent);
  font-size: 0.72rem;
}

.actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.9rem;
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
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn:hover:not(:disabled) {
  border-color: var(--qm-border-strong);
  background: var(--qm-surface-sunken);
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
  border-color: var(--qm-accent-strong);
}

.btn-ghost {
  border-color: transparent;
  color: var(--qm-text-tertiary);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
