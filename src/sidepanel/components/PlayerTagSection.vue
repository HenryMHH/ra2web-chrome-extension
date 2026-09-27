<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { PlayerTagDef } from '~/constants/playerTags'
import {
  CUSTOM_TAG_LABEL_MAX,
  CUSTOM_TAG_PALETTE,
  PLAYER_TAGS,
  tagTextColor,
  validateCustomTag,
} from '~/constants/playerTags'
import { useCustomPlayerTags } from '~/composables/useCustomPlayerTags'
import { useToast } from '~/composables/useToast'

const { customTags, load, upsert, remove, countAssignments } = useCustomPlayerTags()
const toast = useToast()

const draftId = ref('')
const draftLabel = ref('')
const draftColor = ref<string>(CUSTOM_TAG_PALETTE[0])
const editingId = ref<string | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const pendingRemove = ref<{ id: string, label: string, count: number } | null>(null)

onMounted(() => {
  load().catch(e => toast.show('err', `讀取自訂標籤失敗:${(e as Error)?.message ?? 'unknown'}`))
})

function chipStyle(bg: string) {
  return { background: bg, color: tagTextColor(bg) }
}

function resetForm() {
  draftId.value = ''
  draftLabel.value = ''
  draftColor.value = CUSTOM_TAG_PALETTE[0]
  editingId.value = null
  error.value = null
}

function startEdit(t: PlayerTagDef) {
  pendingRemove.value = null
  draftId.value = t.id
  draftLabel.value = t.label
  draftColor.value = t.bg
  editingId.value = t.id
  error.value = null
}

async function submit() {
  const def: PlayerTagDef = {
    id: draftId.value.trim(),
    label: draftLabel.value.trim(),
    bg: draftColor.value.toLowerCase(),
  }
  const err = validateCustomTag(def, customTags.value, editingId.value ?? undefined)
  if (err) {
    error.value = err
    return
  }
  const wasEditing = editingId.value !== null
  busy.value = true
  try {
    await upsert(def)
    toast.show('ok', wasEditing ? '已更新標籤' : '已新增標籤')
    resetForm()
  }
  catch (e) {
    toast.show('err', `儲存標籤失敗:${(e as Error)?.message ?? 'unknown'}`)
  }
  finally {
    busy.value = false
  }
}

async function askRemove(t: PlayerTagDef) {
  busy.value = true
  try {
    pendingRemove.value = { id: t.id, label: t.label, count: await countAssignments(t.id) }
  }
  catch (e) {
    toast.show('err', `讀取玩家標記失敗:${(e as Error)?.message ?? 'unknown'}`)
  }
  finally {
    busy.value = false
  }
}

async function confirmRemove() {
  const p = pendingRemove.value
  if (!p)
    return
  busy.value = true
  try {
    await remove(p.id)
    if (editingId.value === p.id)
      resetForm()
    pendingRemove.value = null
    toast.show('ok', '已刪除標籤')
  }
  catch (e) {
    toast.show('err', `刪除標籤失敗:${(e as Error)?.message ?? 'unknown'}`)
  }
  finally {
    busy.value = false
  }
}

const btn = 'px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-xs text-secondary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const primaryBtn = 'px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-xs text-primary-foreground font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const input = 'w-full rounded-md border border-border bg-input/30 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60'
const chip = 'text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap'
</script>

<template>
  <div class="space-y-3" data-testid="ptag-section">
    <div>
      <p class="text-sm font-medium text-foreground">
        玩家標籤
      </p>
      <p class="text-xs text-muted-foreground">
        內建標籤固定不可修改;可新增自訂標籤
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <span
        v-for="t in PLAYER_TAGS"
        :key="t.id"
        data-testid="ptag-builtin"
        :class="chip"
        :style="chipStyle(t.bg)"
        :title="`${t.id}(內建)`"
      >{{ t.label }}</span>
    </div>

    <ul v-if="customTags.length" class="space-y-1">
      <li
        v-for="t in customTags"
        :key="t.id"
        data-testid="ptag-custom-row"
        :data-id="t.id"
        class="flex items-center gap-2"
      >
        <span :class="chip" :style="chipStyle(t.bg)">{{ t.label }}</span>
        <code class="flex-1 truncate text-xs text-muted-foreground">{{ t.id }}</code>
        <button type="button" data-testid="ptag-edit" :class="btn" :disabled="busy" @click="startEdit(t)">
          編輯
        </button>
        <button type="button" data-testid="ptag-delete" :class="btn" :disabled="busy" @click="askRemove(t)">
          刪除
        </button>
      </li>
    </ul>

    <div
      v-if="pendingRemove"
      data-testid="ptag-remove-pending"
      class="p-3 rounded-lg border border-border bg-secondary/40 space-y-2"
    >
      <p class="text-xs text-foreground">
        刪除「{{ pendingRemove.label }}」<template v-if="pendingRemove.count > 0">
          ,並移除 {{ pendingRemove.count }} 位玩家的此標記
        </template>?
      </p>
      <div class="flex gap-2 justify-end">
        <button type="button" data-testid="ptag-remove-cancel" :class="btn" :disabled="busy" @click="pendingRemove = null">
          取消
        </button>
        <button type="button" data-testid="ptag-remove-confirm" :class="primaryBtn" :disabled="busy" @click="confirmRemove">
          確認刪除
        </button>
      </div>
    </div>

    <form
      data-testid="ptag-form"
      class="p-3 rounded-lg border border-border space-y-2"
      @submit.prevent="submit"
    >
      <div class="grid grid-cols-2 gap-2">
        <label class="space-y-1 text-xs text-muted-foreground">
          <span>ID</span>
          <input
            v-model="draftId"
            data-testid="ptag-id-input"
            maxlength="24"
            placeholder="例如 camper"
            :disabled="editingId !== null || busy"
            :class="input"
          >
        </label>
        <label class="space-y-1 text-xs text-muted-foreground">
          <span>顯示文字</span>
          <input
            v-model="draftLabel"
            data-testid="ptag-label-input"
            :maxlength="CUSTOM_TAG_LABEL_MAX"
            placeholder="例如 蹲家"
            :disabled="busy"
            :class="input"
          >
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-muted-foreground">顏色</span>
        <button
          v-for="c in CUSTOM_TAG_PALETTE"
          :key="c"
          type="button"
          data-testid="ptag-swatch"
          :data-color="c"
          :aria-label="c"
          class="size-5 rounded border-2 transition-colors"
          :class="draftColor === c ? 'border-foreground' : 'border-transparent'"
          :style="{ background: c }"
          @click="draftColor = c"
        />
        <input
          v-model="draftColor"
          type="color"
          data-testid="ptag-color-input"
          title="自訂顏色"
          class="size-6 cursor-pointer border-0 bg-transparent p-0"
        >
        <span data-testid="ptag-preview" class="ml-auto" :class="chip" :style="chipStyle(draftColor)">{{ draftLabel.trim() || '預覽' }}</span>
      </div>
      <p v-if="error" data-testid="ptag-error" class="text-xs text-red-400">
        {{ error }}
      </p>
      <div class="flex gap-2 justify-end">
        <button v-if="editingId" type="button" data-testid="ptag-cancel-edit" :class="btn" :disabled="busy" @click="resetForm">
          取消編輯
        </button>
        <button type="submit" data-testid="ptag-submit" :class="primaryBtn" :disabled="busy">
          {{ editingId ? '儲存' : '新增' }}
        </button>
      </div>
    </form>
  </div>
</template>
