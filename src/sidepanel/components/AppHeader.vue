<script setup lang="ts">
import running from '~/assets/running-48.png'
import stopping from '~/assets/stopping-48.png'

defineProps<{ active: boolean, version: string }>()
</script>

<template>
  <div class="p-4 border-b border-border">
    <div class="flex items-center gap-4">
      <div class="relative">
        <div
          class="w-14 h-14 rounded-full flex items-center justify-center border-2"
          :class="active ? 'border-primary bg-primary/10' : 'border-border bg-secondary'"
        >
          <img :src="active ? running : stopping" alt="" class="w-10 h-10 rounded-full">
        </div>
        <span
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-card px-2 rounded"
          :class="active ? 'text-primary' : 'text-muted-foreground'"
        >
          {{ active ? 'Active' : 'Inactive' }}
        </span>
      </div>
      <div class="flex-1">
        <h1 class="text-lg font-semibold text-foreground">
          RA2 Unit Display
        </h1>
        <p class="text-sm text-muted-foreground">
          for ra2web {{ version }}
        </p>
      </div>
    </div>
  </div>
</template>
