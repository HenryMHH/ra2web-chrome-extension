<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ImportSummary } from '~/logic/configTransfer'

const props = withDefaults(defineProps<{
  pending: ImportSummary | null
  busy?: boolean
}>(), { busy: false })
const emit = defineEmits<{
  export: []
  pick: [file: File]
  confirm: []
  cancel: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)

const pendingParts = computed(() => {
  const p = props.pending
  if (!p)
    return []
  const parts: string[] = []
  if (p.settings)
    parts.push('設定')
  if (p.snapshotCount !== null)
    parts.push(`${p.snapshotCount} 個快照`)
  if (p.playerTagCount !== null)
    parts.push(`${p.playerTagCount} 個玩家標記`)
  if (p.customTagCount !== null)
    parts.push(`${p.customTagCount} 個自訂標籤`)
  return parts
})

function onChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset so picking the same file again still fires change.
  input.value = ''
  if (file)
    emit('pick', file)
}

const btn = 'px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-sm text-secondary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-foreground">
          設定檔
        </p>
        <p class="text-xs text-muted-foreground">
          匯出 / 匯入設定、快照、玩家標記與自訂標籤
        </p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          data-testid="config-export"
          :class="btn"
          :disabled="busy || !!pending"
          @click="emit('export')"
        >
          匯出
        </button>
        <button
          type="button"
          data-testid="config-import"
          :class="btn"
          :disabled="busy || !!pending"
          @click="fileInput?.click()"
        >
          匯入
        </button>
        <input
          ref="fileInput"
          data-testid="config-file-input"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="onChange"
        >
      </div>
    </div>
    <div
      v-if="pending"
      data-testid="config-pending"
      class="p-3 rounded-lg border border-border bg-secondary/40 space-y-2"
    >
      <p class="text-xs text-foreground">
        將覆寫目前的:{{ pendingParts.join('、') }}
      </p>
      <div class="flex gap-2 justify-end">
        <button type="button" data-testid="config-cancel" :class="btn" :disabled="busy" @click="emit('cancel')">
          取消
        </button>
        <button
          type="button"
          data-testid="config-confirm"
          class="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-sm text-primary-foreground font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="busy"
          @click="emit('confirm')"
        >
          確認匯入
        </button>
      </div>
    </div>
  </div>
</template>
