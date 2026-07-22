<script setup lang="ts">
import { APP_NAME, GITHUB, Origin } from '@typewords/core/config/env.ts'
import { BaseIcon } from '@typewords/base'
import { getSystemTheme, listenToSystemThemeChange, setTheme, swapTheme } from '@typewords/core/hooks/theme.ts'

definePageMeta({ layout: 'empty' })

let theme = $ref('light')

onMounted(() => {
  listenToSystemThemeChange(val => {
    if (theme === val) return
    theme = val
    setTheme(theme)
  })
  theme = getSystemTheme()
  setTheme(theme)
  startBlink()
})

function toggleTheme() {
  theme = swapTheme((theme === 'auto' ? getSystemTheme() : theme) as any)
  setTheme(theme)
}

const { t: $t } = useI18n()

// 闪烁光标
let cursorOn = $ref(true)
function startBlink() {
  setInterval(() => {
    cursorOn = !cursorOn
  }, 530)
}

// 打字演示（自动循环）
const demoWords = $computed(() => [
  { word: 'hello', emoji: '👋', trans: '你好' },
  { word: 'learn', emoji: '📚', trans: '学习' },
  { word: 'smile', emoji: '😊', trans: '微笑' },
  { word: 'typing', emoji: '⌨️', trans: '打字' },
])
let demoIdx = $ref(0)
let demoInput = $ref('')
let demoDone = $ref(false)
const demoWord = $computed(() => demoWords[demoIdx])
const demoRemain = $computed(() => demoWord.word.slice(demoInput.length))

let demoTimer: ReturnType<typeof setTimeout> | null = null

function demoReset() {
  demoInput = ''
  demoDone = false
}

function demoNext() {
  demoReset()
  demoIdx = (demoIdx + 1) % demoWords.length
}

// 自动逐字输入演示
function autoTypeStep() {
  if (demoDone) {
    demoTimer = setTimeout(() => { demoNext(); autoTypeStep() }, 1500)
    return
  }
  const target = demoWord.word
  if (demoInput.length < target.length) {
    demoInput += target[demoInput.length]
    demoTimer = setTimeout(autoTypeStep, 280)
  } else {
    demoDone = true
    demoTimer = setTimeout(() => { demoNext(); autoTypeStep() }, 1500)
  }
}

function startAutoDemo() {
  if (demoTimer) clearTimeout(demoTimer)
  autoTypeStep()
}

onMounted(() => {
  startAutoDemo()
})

onUnmounted(() => {
  if (demoTimer) clearTimeout(demoTimer)
})

// 模块卡片
const modules = $computed(() => [
  {
    emoji: '🔤',
    title: '单词练习',
    desc: '50+ 词典，FSRS 智能复习，打字即可记忆',
    color: 'peach',
    to: '/words',
  },
  {
    emoji: '📖',
    title: '文章练习',
    desc: '新概念英语等真人录音，逐句打字逐句听',
    color: 'mint',
    to: '/articles',
  },
  {
    emoji: '💬',
    title: '句子练习',
    desc: '从文章提取的句子集，专注单句听说训练',
    color: 'sky',
    to: '/sentence-list',
  },
])

// 特色功能
const features = $computed(() => [
  { emoji: '🧠', title: 'FSRS 记忆算法', desc: '科学间隔重复，记得牢不遗忘' },
  { emoji: '⌨️', title: '打字即记忆', desc: '边打边记，肌肉记忆加深印象' },
  { emoji: '🎧', title: '真人发音', desc: '原文录音 + 词典发音双重支持' },
  { emoji: '🎯', title: '多种练习模式', desc: '跟打、默写、自测，随心切换' },
  { emoji: '💾', title: '离线可用', desc: '数据本地保存，无需联网也能学' },
  { emoji: '🆓', title: '完全免费', desc: '开源项目，无广告无内购' },
])

let mobileMenuOpen = $ref(false)

useSeoMeta({
  title: 'FluType - 打字学英语，开口就流利',
  ogTitle: 'FluType - 打字学英语，开口就流利',
  description: '通过打字练习单词、文章、句子，结合 FSRS 记忆算法，让英语学习更高效、更有趣。',
  ogDescription: '通过打字练习单词、文章、句子，结合 FSRS 记忆算法，让英语学习更高效、更有趣。',
  ogUrl: 'https://zswlht.github.io/FluType/',
})
</script>

<template>
  <div class="ft min-h-screen overflow-x-hidden" :class="theme">
    <!-- NAV -->
    <header class="sticky top-0 z-100 backdrop-blur-md border-b border-[var(--ft-border)] bg-[var(--ft-bg-nav)]">
      <div class="max-w-[1200px] mx-auto px-4 sm:px-8 h-16 flex items-center gap-6">
        <!-- Logo - 卡通气泡风 -->
        <NuxtLink to="/" class="flex items-center gap-2 no-underline shrink-0">
          <span class="logo-bubble">⌨️</span>
          <span class="text-[1.3rem] font-black tracking-tight text-[var(--ft-text)]">{{ APP_NAME }}</span>
        </NuxtLink>

        <nav class="hidden md:flex gap-6 ml-4">
          <NuxtLink to="/words" class="nav-link">🔤 单词</NuxtLink>
          <NuxtLink to="/articles" class="nav-link">📖 文章</NuxtLink>
          <NuxtLink to="/sentence-list" class="nav-link">💬 句子</NuxtLink>
          <NuxtLink to="/help" class="nav-link">❓ 帮助</NuxtLink>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <BaseIcon :title="$t('toggle_theme')" @click="toggleTheme">
            <IconFluentWeatherMoon16Regular v-if="theme === 'light'" />
            <IconFluentWeatherSunny16Regular v-else />
          </BaseIcon>
          <a :href="GITHUB" target="_blank" class="flex items-center gap-1 text-[var(--ft-text-2)] no-underline" aria-label="GitHub">
            <BaseIcon title="GitHub" noBg><IconSimpleIconsGithub /></BaseIcon>
          </a>
          <button
            class="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--ft-bg-card)] border border-[var(--ft-border)] cursor-pointer text-[var(--ft-text)]"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <span class="text-[1.2rem] leading-none">☰</span>
          </button>
        </div>
      </div>
      <div v-show="mobileMenuOpen" class="md:hidden border-t border-[var(--ft-border)] bg-[var(--ft-bg-card)] px-4 py-3 flex flex-col gap-3 text-base">
        <NuxtLink to="/words" class="font-medium text-[var(--ft-text-2)] no-underline py-1" @click="mobileMenuOpen = false">🔤 单词</NuxtLink>
        <NuxtLink to="/articles" class="font-medium text-[var(--ft-text-2)] no-underline py-1" @click="mobileMenuOpen = false">📖 文章</NuxtLink>
        <NuxtLink to="/sentence-list" class="font-medium text-[var(--ft-text-2)] no-underline py-1" @click="mobileMenuOpen = false">💬 句子</NuxtLink>
        <NuxtLink to="/help" class="font-medium text-[var(--ft-text-2)] no-underline py-1" @click="mobileMenuOpen = false">❓ 帮助</NuxtLink>
      </div>
    </header>

    <main>
      <!-- ════════════ HERO ════════════ -->
      <section class="relative px-4 sm:px-8 pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        <!-- 装饰气泡 -->
        <div class="bubbles-bg pointer-events-none">
          <span class="bubble bubble-1">🎈</span>
          <span class="bubble bubble-2">⭐</span>
          <span class="bubble bubble-3">🌈</span>
          <span class="bubble bubble-4">☁️</span>
          <span class="bubble bubble-5">✏️</span>
          <span class="bubble bubble-6">🎈</span>
        </div>

        <div class="relative z-1 max-w-[1100px] mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
          <!-- 左：标题区 -->
          <div class="flex-1 text-center lg:text-left">
            <div class="inline-flex items-center gap-2 bg-[var(--ft-bg-card)] border-2 border-[var(--ft-border)] rounded-full px-4 py-1.5 mb-5 text-[.88rem] font-bold text-[var(--ft-text-2)] shadow-sm">
              <span class="wave-hand">👋</span>
              <span>打字也能学英语，更有趣、更高效</span>
            </div>

            <h1 class="hero-title">
              <span class="hero-letter" style="--i: 0">F</span><span class="hero-letter" style="--i: 1">l</span><span class="hero-letter" style="--i: 2">u</span><span class="hero-letter hero-letter--accent" style="--i: 3">T</span><span class="hero-letter" style="--i: 4">y</span><span class="hero-letter" style="--i: 5">p</span><span class="hero-letter" style="--i: 6">e</span>
              <span class="hero-cursor" :class="{ on: cursorOn }">|</span>
            </h1>

            <p class="text-[clamp(1rem,2vw,1.2rem)] text-[var(--ft-text-2)] font-semibold mb-3 leading-[1.6]">
              打字学英语，开口就流利
            </p>
            <p class="text-[clamp(.9rem,1.8vw,1rem)] text-[var(--ft-text-3)] mb-7 leading-[1.7] max-w-[480px] mx-auto lg:mx-0">
              结合 FSRS 记忆算法 + 真人录音 + 打字肌肉记忆，让每一次按键都成为学习的一部分。
            </p>

            <div class="flex gap-3 justify-center lg:justify-start flex-col sm:flex-row items-stretch sm:items-center">
              <button
                class="btn-primary"
                @click="navigateTo('/words')"
              >
                <span class="text-[1.1rem]">🚀</span>
                <span>立即开始</span>
              </button>
              <a :href="GITHUB" target="_blank" class="btn-ghost">
                <span>⭐</span>
                <span>GitHub</span>
              </a>
            </div>
          </div>

          <!-- 右：演示卡片 -->
          <div class="w-full lg:w-[420px] shrink-0">
            <div class="demo-card">
              <div class="demo-header">
                <span class="demo-dot dot-r"></span>
                <span class="demo-dot dot-y"></span>
                <span class="demo-dot dot-g"></span>
                <span class="demo-label">● 自动演示中</span>
              </div>
              <div class="demo-body">
                <div class="demo-emoji">{{ demoWord.emoji }}</div>
                <div class="demo-word">
                  <span class="text-done">{{ demoInput }}</span><span class="text-rest">{{ demoRemain }}</span>
                </div>
                <div class="demo-trans">{{ demoWord.trans }}</div>
                <div v-if="demoDone" class="demo-success">
                  <span>🎉 完成！</span>
                </div>
                <div class="demo-progress">
                  <span
                    v-for="(_, i) in demoWords"
                    :key="i"
                    class="demo-pip"
                    :class="{ active: i === demoIdx }"
                  ></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════ MODULES ════════════ -->
      <section class="px-4 sm:px-8 pb-20">
        <div class="max-w-[1100px] mx-auto">
          <div class="text-center mb-10">
            <div class="text-[1.2rem] mb-2">🎯</div>
            <h2 class="section-title">三大模块，覆盖你的学习场景</h2>
            <p class="section-desc">从单词到文章到句子，循序渐进，全面提升</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              v-for="m in modules"
              :key="m.title"
              class="module-card"
              :class="`module-card--${m.color}`"
              @click="navigateTo(m.to)"
            >
              <div class="module-emoji">{{ m.emoji }}</div>
              <div class="module-title">{{ m.title }}</div>
              <div class="module-desc">{{ m.desc }}</div>
              <div class="module-arrow">→</div>
            </button>
          </div>
        </div>
      </section>

      <!-- ════════════ FEATURES ════════════ -->
      <section class="px-4 sm:px-8 pb-20">
        <div class="max-w-[1100px] mx-auto">
          <div class="text-center mb-10">
            <div class="text-[1.2rem] mb-2">✨</div>
            <h2 class="section-title">为什么选择 FluType？</h2>
            <p class="section-desc">六大特色，让学习更高效</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div v-for="f in features" :key="f.title" class="feature-card">
              <div class="feature-emoji">{{ f.emoji }}</div>
              <div class="feature-title">{{ f.title }}</div>
              <div class="feature-desc">{{ f.desc }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════ CTA ════════════ -->
      <section class="px-4 sm:px-8 pb-20">
        <div class="max-w-[800px] mx-auto">
          <div class="cta-box">
            <div class="text-[2.5rem] mb-3">🎨</div>
            <h2 class="text-[clamp(1.5rem,3vw,2rem)] font-black text-white mb-3 leading-tight">现在就开始你的打字学习之旅</h2>
            <p class="text-white/85 mb-7 text-[1rem]">完全免费，无需注册，打开即用</p>
            <button
              class="btn-white"
              @click="navigateTo('/words')"
            >
              <span>🚀</span>
              <span>立即开始</span>
            </button>
          </div>
        </div>
      </section>
    </main>

    <!-- ════════════ FOOTER ════════════ -->
    <footer class="border-t border-[var(--ft-border)] px-4 sm:px-8 py-10">
      <div class="max-w-[1100px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div>
          <span class="text-[1.1rem] font-black text-[var(--ft-text)]">{{ APP_NAME }}</span>
          <span class="ml-2 text-[.85rem] text-[var(--ft-text-3)]">打字学英语，开口就流利</span>
        </div>
        <div class="flex gap-5 text-[.88rem] text-[var(--ft-text-2)] flex-wrap justify-center">
          <NuxtLink to="/words" class="footer-link">单词</NuxtLink>
          <NuxtLink to="/articles" class="footer-link">文章</NuxtLink>
          <NuxtLink to="/sentence-list" class="footer-link">句子</NuxtLink>
          <NuxtLink to="/help" class="footer-link">帮助</NuxtLink>
          <a :href="GITHUB" target="_blank" class="footer-link">GitHub</a>
          <a :href="Origin" target="_blank" class="footer-link">{{ Origin }}</a>
        </div>
      </div>
      <div class="max-w-[1100px] mx-auto mt-5 pt-5 border-t border-[var(--ft-border)] text-center text-[.8rem] text-[var(--ft-text-3)]">
        © 2026 {{ APP_NAME }}. All rights reserved.
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ── 主题变量 ── */
.ft {
  --ft-bg: #fff8f0;
  --ft-bg-card: #ffffff;
  --ft-bg-nav: rgba(255, 248, 240, 0.9);
  --ft-border: #ffe0c2;
  --ft-text: #2d2418;
  --ft-text-2: #6b5d4f;
  --ft-text-3: #a89580;
  --ft-shadow-sm: 0 2px 8px rgba(255, 167, 38, 0.08);
  --ft-shadow-md: 0 6px 24px rgba(255, 167, 38, 0.12);
  --ft-shadow-lg: 0 16px 48px rgba(255, 167, 38, 0.18);
  background: var(--ft-bg);
  color: var(--ft-text);
  font-family: 'Comic Sans MS', 'Marker Felt', 'Quicksand', system-ui, -apple-system, sans-serif;
}
.ft.dark {
  --ft-bg: #1a1410;
  --ft-bg-card: #2a1f17;
  --ft-bg-nav: rgba(26, 20, 16, 0.92);
  --ft-border: #3d2f24;
  --ft-text: #f5e6d3;
  --ft-text-2: #b8a589;
  --ft-text-3: #7a6651;
  --ft-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --ft-shadow-md: 0 6px 24px rgba(0, 0, 0, 0.4);
  --ft-shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.5);
}

/* ── 导航 ── */
.nav-link {
  font-size: .92rem;
  font-weight: 600;
  color: var(--ft-text-2);
  text-decoration: none;
  padding: .4rem .8rem;
  border-radius: 999px;
  transition: all .2s;
}
.nav-link:hover {
  color: var(--ft-text);
  background: var(--ft-bg-card);
}
.logo-bubble {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 1.2rem;
  background: linear-gradient(135deg, #ffd166, #ff6b6b);
  border-radius: 50%;
  box-shadow: var(--ft-shadow-sm);
  animation: bounce-soft 2.5s ease-in-out infinite;
}
@keyframes bounce-soft {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* ── Hero ── */
.bubbles-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.bubble {
  position: absolute;
  font-size: 2rem;
  opacity: .35;
  animation: float 8s ease-in-out infinite;
}
.bubble-1 { top: 15%; left: 8%; animation-delay: 0s; }
.bubble-2 { top: 25%; right: 12%; animation-delay: 1.5s; font-size: 1.6rem; }
.bubble-3 { top: 60%; left: 5%; animation-delay: 3s; font-size: 2.4rem; }
.bubble-4 { top: 70%; right: 8%; animation-delay: 4.5s; font-size: 1.8rem; }
.bubble-5 { top: 10%; left: 50%; animation-delay: 2s; font-size: 1.4rem; }
.bubble-6 { top: 50%; right: 30%; animation-delay: 5s; font-size: 1.5rem; }
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(8deg); }
}

.wave-hand {
  display: inline-block;
  animation: wave 2s ease-in-out infinite;
  transform-origin: 70% 70%;
}
@keyframes wave {
  0%, 60%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(15deg); }
  30% { transform: rotate(-8deg); }
  45% { transform: rotate(15deg); }
}

.hero-title {
  font-size: clamp(3.5rem, 9vw, 6rem);
  font-weight: 900;
  line-height: 1;
  margin: 0 0 1rem 0;
  letter-spacing: -0.02em;
  display: inline-flex;
  align-items: center;
}
.hero-letter {
  display: inline-block;
  color: var(--ft-text);
  animation: pop-in .5s cubic-bezier(.34, 1.56, .64, 1) backwards;
  animation-delay: calc(var(--i) * 0.08s);
}
.hero-letter--accent {
  color: #ff6b6b;
  transform: rotate(-5deg);
}
@keyframes pop-in {
  0% { opacity: 0; transform: translateY(20px) scale(0.5); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.hero-cursor {
  color: #ff6b6b;
  font-weight: 300;
  margin-left: 4px;
  opacity: 0;
  transition: opacity 0.1s;
}
.hero-cursor.on { opacity: 1; }

/* ── 按钮 ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 1.8rem;
  height: 3.2rem;
  border-radius: 999px;
  font-weight: 800;
  font-size: 1.05rem;
  color: white;
  background: linear-gradient(135deg, #ff6b6b, #ffa726);
  border: none;
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.35);
  cursor: pointer;
  transition: all .2s;
}
.btn-primary:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 10px 28px rgba(255, 107, 107, 0.45);
}
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 1.8rem;
  height: 3.2rem;
  border-radius: 999px;
  font-weight: 800;
  font-size: 1.05rem;
  color: var(--ft-text);
  background: var(--ft-bg-card);
  border: 2px solid var(--ft-border);
  text-decoration: none;
  cursor: pointer;
  transition: all .2s;
}
.btn-ghost:hover {
  border-color: #ff6b6b;
  color: #ff6b6b;
  transform: translateY(-2px);
}
.btn-white {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 2rem;
  height: 3.2rem;
  border-radius: 999px;
  font-weight: 800;
  font-size: 1.05rem;
  color: #ff6b6b;
  background: white;
  border: none;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all .2s;
}
.btn-white:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
}

/* ── Demo 卡片 ── */
.demo-card {
  background: var(--ft-bg-card);
  border: 3px solid var(--ft-border);
  border-radius: 28px;
  box-shadow: var(--ft-shadow-lg);
  overflow: hidden;
  outline: none;
  transition: all .25s;
}
.demo-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px;
  background: var(--ft-bg);
  border-bottom: 2px solid var(--ft-border);
}
.demo-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.dot-r { background: #ff5f57; }
.dot-y { background: #febc2e; }
.dot-g { background: #28c840; }
.demo-label {
  margin-left: auto;
  font-size: .82rem;
  font-weight: 600;
  color: var(--ft-text-3);
}
.demo-body {
  padding: 28px 24px 24px;
  text-align: center;
  cursor: text;
}
.demo-emoji {
  font-size: 2.5rem;
  margin-bottom: 8px;
}
.demo-word {
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: .08em;
  min-height: 3rem;
  display: flex;
  justify-content: center;
  align-items: center;
}
.text-done { color: #28c840; }
.text-rest { color: var(--ft-text-3); }
.demo-trans {
  margin-top: 6px;
  font-size: 1rem;
  color: var(--ft-text-2);
}
.demo-success {
  margin-top: 12px;
  padding: 8px 14px;
  background: rgba(40, 200, 64, 0.1);
  border-radius: 12px;
  color: #28c840;
  font-weight: 700;
  font-size: .92rem;
}
.demo-progress {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 14px;
}
.demo-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ft-border);
  transition: all .2s;
}
.demo-pip.active {
  background: #ff6b6b;
  width: 20px;
  border-radius: 999px;
}

/* ── 区块通用 ── */
.section-title {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 900;
  color: var(--ft-text);
  margin: 0 0 8px 0;
}
.section-desc {
  font-size: 1rem;
  color: var(--ft-text-3);
  margin: 0;
}

/* ── 模块卡片 ── */
.module-card {
  position: relative;
  display: block;
  width: 100%;
  text-align: left;
  padding: 28px 26px;
  border-radius: 28px;
  border: 3px solid transparent;
  background: var(--ft-bg-card);
  cursor: pointer;
  transition: all .25s;
  text-decoration: none;
}
.module-card:hover {
  transform: translateY(-6px) rotate(-1deg);
  box-shadow: var(--ft-shadow-lg);
}
.module-card--peach { background: linear-gradient(135deg, #fff5e6, #ffe0c2); border-color: #ffd9a8; }
.module-card--peach:hover { border-color: #ff9a3c; }
.module-card--mint { background: linear-gradient(135deg, #e8f9f0, #c5ecd9); border-color: #a8e0c2; }
.module-card--mint:hover { border-color: #4caf7d; }
.module-card--sky { background: linear-gradient(135deg, #e6f2ff, #c5deff); border-color: #a8c8ff; }
.module-card--sky:hover { border-color: #4c8bffb; }
.module-emoji {
  font-size: 3rem;
  margin-bottom: 12px;
}
.module-title {
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--ft-text);
  margin-bottom: 8px;
}
.module-desc {
  font-size: .92rem;
  color: var(--ft-text-2);
  line-height: 1.65;
  margin-bottom: 16px;
}
.module-arrow {
  display: inline-block;
  font-size: 1.4rem;
  font-weight: 900;
  color: #ff6b6b;
  transition: transform .2s;
}
.module-card:hover .module-arrow {
  transform: translateX(6px);
}

/* ── 特性卡片 ── */
.feature-card {
  background: var(--ft-bg-card);
  border: 2px solid var(--ft-border);
  border-radius: 24px;
  padding: 24px;
  transition: all .25s;
}
.feature-card:hover {
  transform: translateY(-4px);
  border-color: #ffa726;
  box-shadow: var(--ft-shadow-md);
}
.feature-emoji {
  font-size: 2rem;
  margin-bottom: 10px;
}
.feature-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--ft-text);
  margin-bottom: 6px;
}
.feature-desc {
  font-size: .9rem;
  color: var(--ft-text-2);
  line-height: 1.65;
}

/* ── CTA ── */
.cta-box {
  background: linear-gradient(135deg, #ff6b6b 0%, #ffa726 50%, #ffd166 100%);
  border-radius: 36px;
  padding: 48px 32px;
  text-align: center;
  box-shadow: 0 16px 48px rgba(255, 107, 107, 0.3);
  position: relative;
  overflow: hidden;
}
.cta-box::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 200px;
  height: 200px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
}
.cta-box::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 180px;
  height: 180px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 50%;
}

/* ── Footer ── */
.footer-link {
  text-decoration: none;
  transition: color .15s;
}
.footer-link:hover {
  color: #ff6b6b;
}
</style>
