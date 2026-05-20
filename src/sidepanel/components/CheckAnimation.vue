<script setup lang="ts">
// Pure-CSS checkmark adapted from SweetAlert (via Istiak Tridip).
// No props — caller controls visibility by mounting/unmounting.
</script>

<template>
  <div class="success-checkmark">
    <div class="check-icon">
      <span class="icon-line line-tip" />
      <span class="icon-line line-long" />
      <div class="icon-circle" />
      <div class="icon-fix" />
    </div>
  </div>
</template>

<style scoped>
.success-checkmark {
  width: 40px;
  height: 40px;
  margin: 0 auto;
}

.success-checkmark .check-icon {
  width: 40px;
  height: 40px;
  position: relative;
  border-radius: 50%;
  box-sizing: content-box;
  border: 2px solid #4caf50;
}

.success-checkmark .check-icon::before,
.success-checkmark .check-icon::after {
  content: '';
  height: 50px;
  position: absolute;
  background: transparent;
  transform: rotate(-45deg);
}

.success-checkmark .check-icon::before {
  top: 1px;
  left: -1px;
  width: 15px;
  transform-origin: 100% 50%;
  border-radius: 100px 0 0 100px;
}

.success-checkmark .check-icon::after {
  top: 0;
  left: 15px;
  width: 30px;
  transform-origin: 0 50%;
  border-radius: 0 100px 100px 0;
  animation: rotate-circle 4.25s ease-in;
}

.success-checkmark .icon-line {
  height: 3px;
  background-color: #4caf50;
  display: block;
  border-radius: 2px;
  position: absolute;
  z-index: 10;
}

.success-checkmark .icon-line.line-tip {
  top: 23px;
  left: 7px;
  width: 12px;
  transform: rotate(45deg);
  animation: icon-line-tip 0.75s;
}

.success-checkmark .icon-line.line-long {
  top: 19px;
  right: 4px;
  width: 23px;
  transform: rotate(-45deg);
  animation: icon-line-long 0.75s;
}

.success-checkmark .icon-circle {
  top: -2px;
  left: -2px;
  z-index: 10;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  position: absolute;
  box-sizing: content-box;
  border: 2px solid rgba(76, 175, 80, 0.5);
}

/* Mask div covers the seam left by the rotating ::before/::after circle halves during the rotate-circle animation. */
.success-checkmark .icon-fix {
  top: 4px;
  width: 3px;
  left: 13px;
  z-index: 1;
  height: 42px;
  position: absolute;
  transform: rotate(-45deg);
  background-color: transparent;
}

@keyframes rotate-circle {
  0% { transform: rotate(-45deg); }
  5% { transform: rotate(-45deg); }
  12% { transform: rotate(-405deg); }
  100% { transform: rotate(-405deg); }
}

@keyframes icon-line-tip {
  0% { width: 0; left: 0; top: 10px; }
  54% { width: 0; left: 0; top: 10px; }
  70% { width: 25px; left: -4px; top: 18px; }
  84% { width: 9px; left: 11px; top: 24px; }
  100% { width: 12px; left: 7px; top: 23px; }
}

@keyframes icon-line-long {
  0% { width: 0; right: 23px; top: 27px; }
  65% { width: 0; right: 23px; top: 27px; }
  84% { width: 27px; right: 0; top: 18px; }
  100% { width: 23px; right: 4px; top: 19px; }
}
</style>
