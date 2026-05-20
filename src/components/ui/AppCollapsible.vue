<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

defineProps<{ open: boolean, title: string }>()
defineEmits<{ 'update:open': [v: boolean] }>()
</script>

<template>
  <CollapsibleRoot
    :open="open"
    @update:open="$emit('update:open', $event)"
  >
    <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-secondary/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
      <h2 class="text-sm font-semibold text-foreground uppercase tracking-wider">
        {{ title }}
      </h2>
      <svg
        class="size-4 text-muted-foreground transition-transform"
        :class="open ? 'rotate-180' : ''"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path d="m18 15-6-6-6 6" /></svg>
    </CollapsibleTrigger>
    <CollapsibleContent class="px-4 pb-4">
      <slot />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
