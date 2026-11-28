<template>
  <!-- 登录成功揭示转场的装饰层：不拦截点击，页面揭示由 App.vue 路由 Transition 的 clip-path 完成 -->
  <Teleport to="body">
    <div v-if="takeoverState !== 'hidden'" class="login-takeover" :class="'is-' + takeoverState">
      <!-- 覆盖完成后浮现的欢迎语 -->
      <div class="login-takeover__center">
        <p class="login-takeover__text">欢迎回来</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useLoginTakeover } from '@/composables/useLoginTakeover'

const { takeoverState } = useLoginTakeover()
</script>

<style scoped>
.login-takeover {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  pointer-events: none; /* 装饰层，绝不拦截底层交互 */
}

/* 中央欢迎语：覆盖后浮现、短暂停留再随整层消散 */
.login-takeover__center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.85);
}
.is-settled .login-takeover__center,
.is-fading .login-takeover__center {
  animation: takeoverTextIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.login-takeover__text {
  margin: 0;
  padding: 12px 28px;
  border-radius: 999px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #fff;
  background: rgba(146, 43, 33, 0.9);
  box-shadow: 0 8px 30px rgba(146, 43, 33, 0.4);
}

/* 整层在 settled→fading 时淡出 */
.is-fading {
  animation: takeoverFade 0.3s ease forwards;
}

@keyframes takeoverTextIn {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes takeoverFade {
  to { opacity: 0; visibility: hidden; }
}
</style>
