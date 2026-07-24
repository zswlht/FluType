<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFetch } from '@vueuse/core'
import { BaseButton, BasePage } from '@typewords/base'
import Empty from '@typewords/core/components/Empty.vue'
import { APP_NAME } from '@typewords/core/config/env.ts'
import { withAppBaseURL } from '@typewords/core/utils'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { useI18n } from 'vue-i18n'

interface RootWord {
  word: string
  cn: string
}
interface RootsData {
  roots: { root: string; meaning: string; words: RootWord[] }[]
  prefixes: { prefix: string; meaning: string; words: RootWord[] }[]
  suffixes: { suffix: string; meaning: string; words: RootWord[] }[]
  meta: { source: string; total_roots: number; total_prefixes: number; total_suffixes: number }
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useBaseStore()

const name = computed(() => String(route.query.name || ''))
const type = computed(() => String(route.query.type || 'roots') as 'roots' | 'prefixes' | 'suffixes')

const { data: rootsData, isFetching } = useFetch<RootsData>(withAppBaseURL('/data/word-roots.json'), { server: false }).json()

const LEARNED_KEY = 'roots-learned'

const learnedSet = ref<Set<string>>(new Set())
onMounted(() => {
  try {
    const raw = localStorage.getItem(LEARNED_KEY)
    if (raw) learnedSet.value = new Set(JSON.parse(raw))
  } catch {}
})

function learnedKey() {
  return `${type.value}:${name.value}`
}
const isLearned = computed(() => learnedSet.value.has(learnedKey()))

function toggleLearned() {
  const k = learnedKey()
  if (learnedSet.value.has(k)) {
    learnedSet.value.delete(k)
  } else {
    learnedSet.value.add(k)
  }
  learnedSet.value = new Set(learnedSet.value)
  localStorage.setItem(LEARNED_KEY, JSON.stringify([...learnedSet.value]))
}

const currentItem = computed(() => {
  if (!rootsData.value) return null
  const n = name.value.toLowerCase()
  if (type.value === 'roots') {
    return rootsData.value.roots.find(v => v.root.toLowerCase() === n) ?? null
  }
  if (type.value === 'prefixes') {
    return rootsData.value.prefixes.find(v => v.prefix.toLowerCase() === n) ?? null
  }
  return rootsData.value.suffixes.find(v => v.suffix.toLowerCase() === n) ?? null
})

const typeName = computed(() => {
  if (type.value === 'roots') return t('roots')
  if (type.value === 'prefixes') return t('prefixes')
  return t('suffixes')
})

const typeIcon = computed(() => {
  if (type.value === 'roots') return '🧩'
  if (type.value === 'prefixes') return '➡️'
  return '⬅️'
})

const accentColor = computed(() => {
  if (type.value === 'roots') return '#ff6b6b'
  if (type.value === 'prefixes') return '#3b82f6'
  return '#10b981'
})

// 已掌握的同根词数量
const knownCount = computed(() => {
  if (!currentItem.value) return 0
  const known = store.allIgnoreWordsSet
  return currentItem.value.words.filter(w => known.has(w.word.toLowerCase())).length
})

// 高亮单词中的词根/词缀位置
function highlightSegments(word: string): { text: string; isMorpheme: boolean }[] {
  const w = word.toLowerCase()
  const m = name.value.toLowerCase().replace(/^-+|-+$/g, '')
  if (!m) return [{ text: word, isMorpheme: false }]
  const idx = w.indexOf(m)
  if (idx < 0) return [{ text: word, isMorpheme: false }]
  return [
    { text: word.slice(0, idx), isMorpheme: false },
    { text: word.slice(idx, idx + m.length), isMorpheme: true },
    { text: word.slice(idx + m.length), isMorpheme: false },
  ].filter(s => s.text)
}

// 相关词根/词缀推荐（同首字母）
const relatedItems = computed(() => {
  if (!rootsData.value) return []
  const n = name.value.toLowerCase()
  const first = n.charAt(0)
  let pool: { name: string; meaning: string }[] = []
  if (type.value === 'roots') {
    pool = rootsData.value.roots.map(v => ({ name: v.root, meaning: v.meaning }))
  } else if (type.value === 'prefixes') {
    pool = rootsData.value.prefixes.map(v => ({ name: v.prefix, meaning: v.meaning }))
  } else {
    pool = rootsData.value.suffixes.map(v => ({ name: v.suffix, meaning: v.meaning }))
  }
  return pool
    .filter(v => v.name.toLowerCase() !== n && v.name.toLowerCase().startsWith(first))
    .slice(0, 12)
})

function goRelated(item: { name: string }) {
  router.push({ path: '/root', query: { name: item.name, type: type.value } })
}

function back() {
  router.push('/roots')
}

useHead({
  title: () => APP_NAME + ' ' + (currentItem.value ? `${name.value} - ${currentItem.value.meaning}` : t('word_roots')),
})
</script>

<template>
  <BasePage>
    <div class="root-detail">
      <!-- 返回 -->
      <div class="back-bar">
        <BaseButton type="info" size="small" @click="back">
          <IconFluentArrowLeft20Regular />
          <span class="ml-1">{{ $t('back') }}</span>
        </BaseButton>
      </div>

      <div v-if="isFetching" class="loading">{{ $t('loading') }}</div>

      <template v-else-if="currentItem">
        <!-- 头部信息卡 -->
        <div class="hero" :style="{ '--accent': accentColor }">
          <div class="hero-top">
            <span class="type-badge">
              <span class="type-icon">{{ typeIcon }}</span>
              {{ typeName }}
            </span>
            <BaseButton
              :type="isLearned ? 'primary' : 'info'"
              size="small"
              @click="toggleLearned"
            >
              <span v-if="isLearned">{{ $t('learned') }}</span>
              <span v-else>{{ $t('mark_learned') }}</span>
            </BaseButton>
          </div>
          <div class="hero-name">{{ name }}</div>
          <div class="hero-meaning">{{ currentItem.meaning }}</div>
          <div class="hero-stats">
            <div class="stat">
              <span class="stat-num">{{ currentItem.words.length }}</span>
              <span class="stat-label">{{ $t('related_words') }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-num">{{ knownCount }}</span>
              <span class="stat-label">{{ $t('mastered_count') }}</span>
            </div>
          </div>
        </div>

        <!-- 同根词列表 -->
        <div class="section">
          <div class="section-title">
            <span class="icon">🌐</span>
            <span>{{ $t('related_words') }}</span>
            <span class="count-tag">{{ currentItem.words.length }}</span>
          </div>
          <div class="words-list">
            <div
              v-for="(w, i) in currentItem.words"
              :key="i"
              class="word-row"
              :class="{ known: store.allIgnoreWordsSet.has(w.word.toLowerCase()) }"
            >
              <div class="word-main">
                <span class="word-text">
                  <template v-for="(seg, si) in highlightSegments(w.word)" :key="si">
                    <span v-if="seg.isMorpheme" class="hl">{{ seg.text }}</span>
                    <span v-else>{{ seg.text }}</span>
                  </template>
                </span>
                <span v-if="store.allIgnoreWordsSet.has(w.word.toLowerCase())" class="known-tag">{{ $t('mastered') }}</span>
              </div>
              <div class="word-cn">{{ w.cn }}</div>
            </div>
          </div>
        </div>

        <!-- 相关推荐 -->
        <div class="section" v-if="relatedItems.length">
          <div class="section-title">
            <span class="icon">🔗</span>
            <span>{{ $t('related_roots') }}</span>
          </div>
          <div class="related-grid">
            <div
              v-for="item in relatedItems"
              :key="item.name"
              class="related-card"
              @click="goRelated(item)"
            >
              <span class="r-name">{{ item.name }}</span>
              <span class="r-meaning">{{ item.meaning }}</span>
            </div>
          </div>
        </div>
      </template>

      <Empty v-else :text="$t('roots_not_found')" />
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.root-detail {
  padding: 0 0.5rem 2rem;
}

.back-bar {
  margin-bottom: 1rem;
}

.loading {
  padding: 3rem 0;
  text-align: center;
  color: var(--color-font-2);
}

.hero {
  position: relative;
  padding: 1.4rem 1.5rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--color-second)), var(--color-second));
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  margin-bottom: 1.5rem;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -30%;
    right: -10%;
    width: 12rem;
    height: 12rem;
    background: radial-gradient(circle, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%);
    pointer-events: none;
  }

  .hero-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.8rem;
    position: relative;

    .type-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 18%, transparent);
      color: var(--accent);
      font-size: 0.78rem;
      font-weight: 600;

      .type-icon {
        font-size: 0.9rem;
      }
    }
  }

  .hero-name {
    font-family: var(--en-article-family);
    font-size: 2.4rem;
    font-weight: 800;
    color: var(--accent);
    line-height: 1.1;
    margin-bottom: 0.4rem;
    letter-spacing: 0.02rem;
    position: relative;
  }

  .hero-meaning {
    font-size: 1.05rem;
    color: var(--color-main-text);
    margin-bottom: 1.2rem;
    position: relative;
  }

  .hero-stats {
    display: flex;
    align-items: center;
    gap: 1.2rem;
    position: relative;

    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;

      .stat-num {
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--accent);
        font-family: var(--en-article-family);
      }

      .stat-label {
        font-size: 0.72rem;
        color: var(--color-font-2);
        opacity: 0.8;
      }
    }

    .stat-divider {
      width: 1px;
      height: 1.8rem;
      background: var(--color-item-border);
    }
  }
}

.section {
  margin-bottom: 1.5rem;

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-main-text);
    margin-bottom: 0.8rem;

    .icon {
      font-size: 1.1rem;
    }

    .count-tag {
      padding: 0.05rem 0.5rem;
      border-radius: 999px;
      background: var(--color-fourth);
      font-size: 0.72rem;
      color: var(--color-font-2);
      font-weight: 500;
    }
  }
}

.words-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 0.6rem;
}

.word-row {
  padding: 0.7rem 0.9rem;
  border-radius: 0.6rem;
  background: var(--color-second);
  border: 1px solid var(--color-item-border);
  transition: all 0.2s;

  &:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }

  &.known {
    background: color-mix(in srgb, #10b981 6%, var(--color-second));
    border-color: color-mix(in srgb, #10b981 25%, transparent);
  }

  .word-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.3rem;

    .word-text {
      font-family: var(--en-article-family);
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--color-main-text);

      .hl {
        color: var(--accent);
        font-weight: 700;
      }
    }

    .known-tag {
      padding: 0.05rem 0.4rem;
      border-radius: 4px;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      font-size: 0.68rem;
      font-weight: 600;
    }
  }

  .word-cn {
    font-size: 0.82rem;
    color: var(--color-font-2);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.5rem;
}

.related-card {
  padding: 0.6rem 0.8rem;
  border-radius: 0.5rem;
  background: var(--color-second);
  border: 1px solid var(--color-item-border);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  &:hover {
    transform: translateY(-1px);
    border-color: var(--accent);
  }

  .r-name {
    font-family: var(--en-article-family);
    font-weight: 700;
    color: var(--accent);
    font-size: 0.95rem;
  }

  .r-meaning {
    font-size: 0.75rem;
    color: var(--color-font-2);
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// 移动端适配
@media (max-width: 768px) {
  .hero {
    padding: 1rem 1.1rem;

    .hero-name {
      font-size: 1.8rem;
    }

    .hero-meaning {
      font-size: 0.95rem;
    }
  }

  .words-list {
    grid-template-columns: 1fr;
  }

  .related-grid {
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  }
}
</style>
