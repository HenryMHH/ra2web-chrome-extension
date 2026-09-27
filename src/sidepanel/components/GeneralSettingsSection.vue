<script setup lang="ts">
import { ref } from 'vue'
import AppCollapsible from '~/components/ui/AppCollapsible.vue'
import ConfigTransferRow from '~/sidepanel/components/ConfigTransferRow.vue'
import PlayerTagSection from '~/sidepanel/components/PlayerTagSection.vue'
import type { ImportSummary } from '~/logic/configTransfer'

withDefaults(defineProps<{
  pending: ImportSummary | null
  busy?: boolean
}>(), { busy: false })
const emit = defineEmits<{
  export: []
  pick: [file: File]
  confirm: []
  cancel: []
}>()

// Collapsed by default: these are set-and-forget settings, tucked away below the per-game ones.
const open = ref(false)
</script>

<template>
  <div class="border-t border-border" data-testid="general-settings">
    <AppCollapsible v-model:open="open" title="一般設定">
      <div class="space-y-6">
        <PlayerTagSection />
        <div class="border-t border-border pt-4">
          <ConfigTransferRow
            :pending="pending"
            :busy="busy"
            @export="emit('export')"
            @pick="emit('pick', $event)"
            @confirm="emit('confirm')"
            @cancel="emit('cancel')"
          />
        </div>
      </div>
    </AppCollapsible>
  </div>
</template>
