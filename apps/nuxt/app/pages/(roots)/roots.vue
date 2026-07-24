<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFetch } from '@vueuse/core'
import { BaseInput, BasePage } from '@typewords/base'
import Empty from '@typewords/core/components/Empty.vue'
import { APP_NAME } from '@typewords/core/config/env.ts'
import { withAppBaseURL } from '@typewords/core/utils'
import { useI18n } from 'vue-i18n'

interface RootWord {
  word: string
  cn: string
}
interface RootItem {
  root: string
  meaning: string
  words: RootWord[]
}
interface PrefixItem {
  prefix: string
  meaning: string
  words: RootWord[]
}
interface SuffixItem {
  suffix: string
  meaning: string
  words: RootWord[]
}
interface RootsData {
  roots: RootItem[]
  prefixes: PrefixItem[]
  suffixes: SuffixItem[]
  meta: { source: string; total_roots: number; total_prefixes: number; total_suffixes: number }
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

useHead({
  title: APP_NAME + ' ' + t('word_roots'),
})

const { data: rootsData, isFetching } = useFetch<RootsData>(withAppBaseURL('/data/word-roots.json'), { server: false }).json()

type TabKey = 'roots' | 'prefixes' | 'suffixes'
const activeTab = ref<TabKey>((route.query.tab as TabKey) || 'roots')
const searchKey = ref('')
const activeLetter = ref<string>('')

watch(activeTab, v => {
  router.replace({ query: { ...route.query, tab: v } })
  activeLetter.value = ''
})

const tabList = computed(() => [
  { key: 'roots' as TabKey, label: t('roots'), count: rootsData.value?.meta?.total_roots ?? 0, icon: '🧩' },
  { key: 'prefixes' as TabKey, label: t('prefixes'), count: rootsData.value?.meta?.total_prefixes ?? 0, icon: '➡️' },
  { key: 'suffixes' as TabKey, label: t('suffixes'), count: rootsData.value?.meta?.total_suffixes ?? 0, icon: '⬅️' },
])

const currentList = computed<{ name: string; meaning: string; words: RootWord[] }[]>(() => {
  if (!rootsData.value) return []
  if (activeTab.value === 'roots') {
    return rootsData.value.roots.map(v => ({ name: v.root, meaning: v.meaning, words: v.words }))
  }
  if (activeTab.value === 'prefixes') {
    return rootsData.value.prefixes.map(v => ({ name: v.prefix, meaning: v.meaning, words: v.words }))
  }
  return rootsData.value.suffixes.map(v => ({ name: v.suffix, meaning: v.meaning, words: v.words }))
})

// 字母索引
const letters = computed(() => {
  const set = new Set<string>()
  for (const item of currentList.value) {
    const first = (item.name || '').charAt(0).toLowerCase()
    if (/[a-z]/.test(first)) set.add(first)
  }
  return [...set].sort()
})

const filteredList = computed(() => {
  let list = currentList.value
  if (activeLetter.value) {
    list = list.filter(v => v.name.toLowerCase().startsWith(activeLetter.value))
  }
  if (searchKey.value.trim()) {
    const s = searchKey.value.trim().toLowerCase()
    list = list.filter(v => {
      if (v.name.toLowerCase().includes(s)) return true
      if (v.meaning.toLowerCase().includes(s)) return true
      // 在关联单词里搜索
      return v.words.some(w => w.word.toLowerCase().includes(s))
    })
  }
  // 按单词数量降序
  return [...list].sort((a, b) => b.words.length - a.words.length)
})

function goDetail(item: { name: string; meaning: string; words: RootWord[] }) {
  router.push({
    path: '/root',
    query: { name: item.name, type: activeTab.value },
  })
}

function toggleLetter(letter: string) {
  activeLetter.value = activeLetter.value === letter ? '' : letter
}

// 颜色映射 - 根据名字 hash 分配稳定颜色
const palettes = [
  { bg: 'rgba(255, 107, 107, 0.08)', border: 'rgba(255, 107, 107, 0.3)', color: '#ff6b6b' },
  { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)', color: '#3b82f6' },
  { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', color: '#10b981' },
  { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.3)', color: '#8b5cf6' },
  { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' },
  { bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.3)', color: '#ec4899' },
]
function paletteOf(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return palettes[Math.abs(hash) % palettes.length]
}
</script>

<template>
  <BasePage>
    <div class="roots-page">
      <!-- 头部 -->
      <div class="page-header">
        <h1 class="title">
          <span class="icon">🧩</span>
          {{ $t('word_roots') }}
        </h1>
        <p class="subtitle">{{ $t('roots_subtitle') }}</p>
      </div>

      <!-- 标签切换 -->
      <div class="tabs">
        <div
          v-for="tab in tabList"
          :key="tab.key"
          class="tab-item"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
          <span class="tab-count">{{ tab.count }}</span>
        </div>
      </div>

      <!-- 搜索与筛选 -->
      <div class="toolbar">
        <div class="search-wrap">
          <BaseInput
            v-model="searchKey"
            :placeholder="$t('roots_search_placeholder')"
            class="search-input"
          />
        </div>
      </div>

      <!-- 字母索引 -->
      <div class="letter-index" v-if="letters.length">
        <span
          class="letter"
          :class="{ active: activeLetter === '' }"
          @click="activeLetter = ''"
        >{{ $t('all') }}</span>
        <span
          v-for="l in letters"
          :key="l"
          class="letter"
          :class="{ active: activeLetter === l }"
          @click="toggleLetter(l)"
        >{{ l.toUpperCase() }}</span>
      </div>

      <!-- 加载中 -->
      <div v-if="isFetching" class="loading">{{ $t('loading') }}</div>

      <!-- 列表 -->
      <div v-else-if="filteredList.length" class="roots-grid">
        <div
          v-for="item in filteredList"
          :key="item.name"
          class="root-card"
          :style="{
            '--card-bg': paletteOf(item.name).bg,
            '--card-border': paletteOf(item.name).border,
            '--card-color': paletteOf(item.name).color,
          }"
          @click="goDetail(item)"
        >
          <div class="card-head">
            <span class="root-name">{{ item.name }}</span>
            <span class="word-count">{{ item.words.length }} {{ $t('words_unit') }}</span>
          </div>
          <div class="root-meaning">{{ item.meaning }}</div>
          <div class="sample-words">
            <span
              v-for="(w, i) in item.words.slice(0, 4)"
              :key="i"
              class="sample-word"
            >{{ w.word }}</span>
            <span v-if="item.words.length > 4" class="more-words">+{{ item.words.length - 4 }}</span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <Empty v-else :text="$t('roots_empty')" />
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.roots-page {
  padding: 0 0.5rem 2rem;
}

.page-header {
  margin-bottom: 1.2rem;

  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-main-text);
    margin: 0;

    .icon {
      font-size: 1.6rem;
    }
  }

  .subtitle {
    margin: 0.4rem 0 0;
    font-size: 0.85rem;
    color: var(--color-font-2);
    opacity: 0.75;
  }
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;

  .tab-item {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border-radius: 999px;
    cursor: pointer;
    background: var(--color-second);
    border: 1px solid var(--color-item-border);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-main-text);
    transition: all 0.2s;

    .tab-icon {
      font-size: 1rem;
    }

    .tab-count {
      padding: 0.05rem 0.45rem;
      border-radius: 999px;
      background: var(--color-fourth);
      font-size: 0.75rem;
      color: var(--color-font-2);
    }

    &:hover {
      transform: translateY(-1px);
    }

    &.active {
      background: linear-gradient(135deg, #ffd166, #ff6b6b);
      color: white;
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(255, 107, 107, 0.25);

      .tab-count {
        background: rgba(255, 255, 255, 0.25);
        color: white;
      }
    }
  }
}

.toolbar {
  margin-bottom: 0.8rem;

  .search-wrap {
    max-width: 24rem;

    .search-input {
      width: 100%;
    }
  }
}

.letter-index {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 1.2rem;
  padding: 0.5rem 0;
  border-bottom: 1px dashed var(--color-item-border);

  .letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.8rem;
    height: 1.8rem;
    padding: 0 0.4rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-font-2);
    background: var(--color-second);
    transition: all 0.15s;

    &:hover {
      background: var(--color-fourth);
      color: var(--color-main-text);
    }

    &.active {
      background: #ff6b6b;
      color: white;
    }
  }
}

.loading {
  padding: 3rem 0;
  text-align: center;
  color: var(--color-font-2);
}

.roots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.8rem;
}

.root-card {
  position: relative;
  padding: 0.9rem 1rem;
  border-radius: 0.75rem;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    border-color: var(--card-color);
  }

  .card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;

    .root-name {
      font-family: var(--en-article-family);
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--card-color);
      letter-spacing: 0.02rem;
    }

    .word-count {
      font-size: 0.72rem;
      color: var(--color-font-2);
      opacity: 0.75;
      flex-shrink: 0;
    }
  }

  .root-meaning {
    font-size: 0.85rem;
    color: var(--color-main-text);
    line-height: 1.4;
  }

  .sample-words {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.2rem;

    .sample-word {
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      background: var(--color-second);
      font-family: var(--en-article-family);
      font-size: 0.75rem;
      color: var(--color-font-2);
    }

    .more-words {
      padding: 0.1rem 0.4rem;
      font-size: 0.72rem;
      color: var(--card-color);
      font-weight: 600;
    }
  }
}

// 移动端适配
@media (max-width: 768px) {
  .page-header .title {
    font-size: 1.25rem;
  }

  .roots-grid {
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.6rem;
  }

  .root-card {
    padding: 0.7rem 0.8rem;

    .card-head .root-name {
      font-size: 1.05rem;
    }
  }

  .letter-index .letter {
    min-width: 1.6rem;
    height: 1.6rem;
    font-size: 0.75rem;
  }
}
</style>
