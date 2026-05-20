<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

defineProps<{
  modelValue: string
  tabs: Array<{ value: string, label: string }>
}>()
defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    class="w-full"
    @update:model-value="$emit('update:modelValue', String($event))"
  >
    <TabsList class="flex p-1 bg-secondary rounded-lg">
      <TabsTrigger
        v-for="t in tabs"
        :key="t.value"
        :value="t.value"
        class="flex-1 text-xs py-2 px-3 rounded-md transition-colors outline-none data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-secondary-foreground"
      >
        {{ t.label }}
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="t in tabs"
      :key="t.value"
      :value="t.value"
      class="mt-3 outline-none"
    >
      <slot :name="t.value" />
    </TabsContent>
  </TabsRoot>
</template>
