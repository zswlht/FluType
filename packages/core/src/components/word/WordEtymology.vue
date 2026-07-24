<script setup lang="ts">
import { computed } from 'vue'
import ClickableWord from './ClickableWord.vue'

interface EtymologyItem {
  t: string
  d: string
}

interface RelWords {
  root: string
  rels: {
    pos: string
    words: { c: string; cn: string }[]
  }[]
}

const props = defineProps<{
  etymology?: EtymologyItem[]
  relWords?: RelWords
  word: string
}>()

// 词素类型
type MorphemeType = 'prefix' | 'root' | 'suffix'
interface Morpheme {
  morpheme: string
  meaning: string
  type: MorphemeType
}

// 解析单个 etymology 条目
interface ParsedEntry {
  kind: 'morphemes' | 'story' | 'empty'
  title?: string
  morphemes?: Morpheme[]
  story?: string
}

function parseEntry(item: EtymologyItem): ParsedEntry {
  const d = (item.d || '').trim()
  // 标题：去掉 "单词:" 前缀
  let title = (item.t || '').trim()
  const colonIdx = title.indexOf(':')
  if (colonIdx >= 0) title = title.slice(colonIdx + 1).trim()

  if (!d) return { kind: 'empty', title }

  // 词根词缀拆解格式
  const prefix = '词根词缀：'
  if (d.startsWith(prefix)) {
    const body = d.slice(prefix.length).trim()
    const parts = body.split('+').map(s => s.trim()).filter(Boolean)
    const morphemes: Morpheme[] = parts.map(p => {
      let morpheme = p
      let meaning = ''
      // 分离英文词素和中文释义
      const m = p.match(/^([A-Za-z\-]+)\s*([\u4e00-\u9fa5].*)$/)
      if (m) {
        morpheme = m[1].trim()
        meaning = m[2].trim()
      } else {
        // 只有英文或只有中文的情况
        const m2 = p.match(/^([A-Za-z\-]+)$/)
        if (m2) {
          morpheme = m2[1]
        }
      }
      let type: MorphemeType = 'root'
      if (morpheme.startsWith('-') && morpheme.endsWith('-')) type = 'root'
      else if (morpheme.startsWith('-')) type = 'suffix'
      else if (morpheme.endsWith('-')) type = 'prefix'
      return { morpheme, meaning, type }
    }).filter(m => m.morpheme)
    return { kind: 'morphemes', title, morphemes }
  }

  // 其他文本：当作词源故事
  return { kind: 'story', title, story: d }
}

const parsedEntries = computed<ParsedEntry[]>(() => {
  if (!props.etymology?.length) return []
  return props.etymology.map(parseEntry).filter(e => e.kind !== 'empty')
})

const hasMorphemes = computed(() => parsedEntries.value.some(e => e.kind === 'morphemes'))
const hasStory = computed(() => parsedEntries.value.some(e => e.kind === 'story'))
const hasRelWords = computed(() => props.relWords?.rels?.length)

// 在原单词中高亮词素位置
const highlightedWord = computed(() => {
  if (!props.word) return null
  const w = props.word.toLowerCase()
  const morphemes: { text: string; type: MorphemeType }[] = []
  // 收集所有词素并去掉连字符
  const allMorphs: { text: string; type: MorphemeType }[] = []
  for (const e of parsedEntries.value) {
    if (e.kind === 'morphemes' && e.morphemes) {
      for (const m of e.morphemes) {
        const text = m.morpheme.replace(/^-+|-+$/g, '')
        if (text) allMorphs.push({ text, type: m.type })
      }
    }
  }
  if (!allMorphs.length) return null

  // 按长度降序匹配，避免短词素先匹配
  allMorphs.sort((a, b) => b.text.length - a.text.length)
  const used = new Array(w.length).fill(false)
  const matches: { start: number; end: number; type: MorphemeType }[] = []
  for (const m of allMorphs) {
    const lower = m.text.toLowerCase()
    let idx = w.indexOf(lower)
    while (idx >= 0) {
      // 检查未占用
      let overlap = false
      for (let i = idx; i < idx + lower.length; i++) {
        if (used[i]) { overlap = true; break }
      }
      if (!overlap) {
        for (let i = idx; i < idx + lower.length; i++) used[i] = true
        matches.push({ start: idx, end: idx + lower.length, type: m.type })
        break
      }
      idx = w.indexOf(lower, idx + 1)
    }
  }
  if (!matches.length) return null
  matches.sort((a, b) => a.start - b.start)
  // 构建分段
  const segments: { text: string; type: MorphemeType | null }[] = []
  let cur = 0
  for (const mt of matches) {
    if (mt.start > cur) {
      segments.push({ text: w.slice(cur, mt.start), type: null })
    }
    segments.push({ text: w.slice(mt.start, mt.end), type: mt.type })
    cur = mt.end
  }
  if (cur < w.length) segments.push({ text: w.slice(cur), type: null })
  return segments
})
</script>

<template>
  <div class="word-etymology" v-if="parsedEntries.length || hasRelWords">
    <!-- 词根拆解区 -->
    <div v-if="hasMorphemes" class="etymology-section">
      <div class="section-title">
        <span class="icon">🧩</span>
        <span>词根拆解</span>
      </div>

      <!-- 单词高亮显示 -->
      <div class="word-highlight" v-if="highlightedWord">
        <template v-for="(seg, i) in highlightedWord" :key="i">
          <span
            class="seg"
            :class="seg.type"
            v-if="seg.type"
          >{{ seg.text }}</span>
          <span v-else>{{ seg.text }}</span>
        </template>
      </div>

      <!-- 词素 chips -->
      <div class="morphemes-list">
        <template v-for="(entry, ei) in parsedEntries" :key="ei">
          <template v-if="entry.kind === 'morphemes' && entry.morphemes">
            <div class="morphemes-row">
              <span
                v-for="(m, mi) in entry.morphemes"
                :key="mi"
                class="morpheme-chip"
                :class="m.type"
              >
                <span class="morpheme">{{ m.morpheme }}</span>
                <span class="meaning" v-if="m.meaning">{{ m.meaning }}</span>
              </span>
              <span v-if="entry.morphemes.length > 1" class="plus-sign">组合</span>
            </div>
          </template>
        </template>
      </div>
    </div>

    <!-- 词源故事 -->
    <div v-if="hasStory" class="etymology-section">
      <div class="section-title">
        <span class="icon">📖</span>
        <span>词源</span>
      </div>
      <div class="story-list">
        <template v-for="(entry, ei) in parsedEntries" :key="ei">
          <p v-if="entry.kind === 'story'" class="story-text">{{ entry.story }}</p>
        </template>
      </div>
    </div>

    <!-- 同根词 -->
    <div v-if="hasRelWords" class="etymology-section">
      <div class="section-title">
        <span class="icon">🌐</span>
        <span>同根词</span>
        <span class="root-tag" v-if="relWords?.root">词根：{{ relWords.root }}</span>
      </div>
      <div class="rel-words">
        <div v-for="(rel, ri) in relWords?.rels" :key="ri" class="rel-group">
          <span class="pos">{{ rel.pos }}</span>
          <div class="rel-items">
            <span v-for="(w, wi) in rel.words" :key="wi" class="rel-word">
              <ClickableWord :word="w.c" />
              <span class="rel-cn">{{ w.cn }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.word-etymology {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0;
}

.etymology-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-font-2);
  opacity: 0.85;

  .icon {
    font-size: 1rem;
  }

  .root-tag {
    margin-left: 0.5rem;
    padding: 0.1rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 400;
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
    border-radius: 999px;
  }
}

.word-highlight {
  font-family: var(--en-article-family);
  font-size: 1.4rem;
  letter-spacing: 0.1rem;
  padding: 0.3rem 0;

  .seg {
    border-radius: 4px;
    padding: 0 1px;
    transition: all 0.2s;

    &.prefix {
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.12);
    }

    &.root {
      color: #ff6b6b;
      background: rgba(255, 107, 107, 0.12);
      font-weight: 600;
    }

    &.suffix {
      color: #10b981;
      background: rgba(16, 185, 129, 0.12);
    }
  }
}

.morphemes-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.morphemes-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.morpheme-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 0.85rem;
  border: 1px solid;

  .morpheme {
    font-family: var(--en-article-family);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .meaning {
    font-size: 0.75rem;
    opacity: 0.75;
  }

  &.prefix {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.3);
  }

  &.root {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.08);
    border-color: rgba(255, 107, 107, 0.3);
  }

  &.suffix {
    color: #10b981;
    background: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.3);
  }
}

.plus-sign {
  font-size: 0.7rem;
  opacity: 0.5;
  margin-left: 0.2rem;
}

.story-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.story-text {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--color-font-2);
  opacity: 0.85;
  margin: 0;
  text-align: justify;
}

.rel-words {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rel-group {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.pos {
  flex-shrink: 0;
  min-width: 2.5rem;
  padding: 0.15rem 0.4rem;
  font-size: 0.75rem;
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 4px;
  text-align: center;
}

.rel-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.8rem;
}

.rel-word {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  font-size: 0.85rem;

  .rel-cn {
    font-size: 0.75rem;
    opacity: 0.6;
  }
}

// 移动端适配
@media (max-width: 768px) {
  .word-highlight {
    font-size: 1.2rem;
  }

  .morpheme-chip {
    padding: 0.2rem 0.45rem;
    font-size: 0.8rem;

    .morpheme {
      font-size: 0.85rem;
    }
  }

  .rel-group {
    flex-direction: column;
    gap: 0.3rem;
  }
}
</style>
