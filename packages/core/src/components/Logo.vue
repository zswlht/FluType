<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="logo-text center mb-2" @click="goHome">
    <span class="logo-flu">Flu</span><span class="logo-type">Type</span>
  </div>
</template>

<style scoped lang="scss">
.logo-text {
  cursor: pointer;
  font-family: 'Comic Sans MS', 'Marker Felt', 'Quicksand', -apple-system, system-ui, sans-serif;
  font-weight: 800;
  font-size: 1.5rem;
  letter-spacing: -0.5px;
  user-select: none;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }

  .logo-flu {
    background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .logo-type {
    color: var(--color-main-text);
  }
}
</style>
