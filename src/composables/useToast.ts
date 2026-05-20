import { ref } from 'vue'

export type ToastKind = 'ok' | 'warn' | 'err'

export interface ToastMessage {
  kind: ToastKind
  text: string
}

const msg = ref<ToastMessage | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

function show(kind: ToastKind, text: string, ms = 2500): void {
  msg.value = { kind, text }
  if (timer)
    clearTimeout(timer)
  timer = setTimeout(() => {
    msg.value = null
    timer = null
  }, ms)
}

function clear(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  msg.value = null
}

export function useToast() {
  return { msg, show, clear }
}
