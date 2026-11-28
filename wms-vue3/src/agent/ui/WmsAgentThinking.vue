<template>
  <div class="thinking" aria-hidden="true">
    <span />
    <span />
    <span />
  </div>
</template>

<style scoped>
.thinking {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 16px;
}

.thinking span {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
  animation: agent-pulse 1s ease-in-out infinite;
}

.thinking span:nth-child(2) { animation-delay: 0.14s; }
.thinking span:nth-child(3) { animation-delay: 0.28s; }

@keyframes agent-pulse {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

@media (prefers-reduced-motion: reduce) {
  .thinking span { animation: none; opacity: 0.7; }
}
</style>
