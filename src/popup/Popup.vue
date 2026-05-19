<script setup lang="ts">
import { storageDemo } from '~/logic/storage'

function openOptionsPage() {
  browser.runtime.openOptionsPage()
}
</script>

<template>
  <main class="w-[100px] px-4 py-5 text-center text-gray-700 border-red">
    <Logo />
    <div>Popup</div>
    <SharedSubtitle />
    jieowfjiowefjoiwjfo

    <button class="btn mt-2" @click="openOptionsPage">
      Open Optionsjeiowjfwofi
    </button>
    <div class="mt-2">
      <span class="opacity-50">Storage:</span> {{ storageDemo }}
    </div>
  </main>
</template>
