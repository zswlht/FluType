<script setup lang="ts">
import type { Dict } from '../types'
import { Checkbox, Progress } from '@typewords/base'

interface IProps {
  item?: Partial<Dict>
  quantifier?: string
  isAdd: boolean
  showCheckbox?: boolean
  checked?: boolean
  selected?: boolean
  showProgress?: boolean
  isUser?: boolean //是否是用户的词典
}

const props = withDefaults(defineProps<IProps>(), {
  showProgress: true,
  isUser: false,
})

const emit = defineEmits<{
  check: []
  click: []
}>()

const progress = $computed(() => {
  return Number(((props.item?.lastLearnIndex / props.item?.length) * 100).toFixed())
})

const studyProgress = $computed(() => {
  if (!props.showProgress) return
  return props.item?.lastLearnIndex ? props.item?.lastLearnIndex + '/' : ''
})

// withAppBaseURL 在 SSG 运行时可能取不到正确的 baseURL，这里用 Vite 构建时
// 静态替换的 import.meta.env.BASE_URL 作为可靠兜底，确保子路径部署下封面能拼对路径
let coverLoadFailed = $ref(false)
const coverSrc = $computed(() => {
  const cover = props.item?.cover
  if (!cover) return ''
  if (/^[a-z][a-z\d+.-]*:/i.test(cover) || cover.startsWith('//')) return cover
  if (!cover.startsWith('/')) return cover
  const base = import.meta.env.BASE_URL || '/'
  if (base === '/') return cover
  const basePath = base.endsWith('/') ? base.slice(0, -1) : base
  if (cover === basePath || cover.startsWith(basePath + '/')) return cover
  return basePath + cover
})
const showCover = $computed(() => props.item?.cover && !coverLoadFailed)

// 与暖色奶油主题协调的渐变色板，根据书名 hash 分配稳定颜色
const gradientPalettes = [
  'linear-gradient(135deg, #ff6b6b, #ee5a6f)',
  'linear-gradient(135deg, #ffd166, #ff6b6b)',
  'linear-gradient(135deg, #06beb6, #48b1bf)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #ff9a9e, #fad0c4)',
  'linear-gradient(135deg, #ff758c, #ff7eb3)',
  'linear-gradient(135deg, #84fab0, #8fd3f4)',
  'linear-gradient(135deg, #ffecd2, #fcb69f)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
]

const gradientStyle = $computed(() => {
  // 有封面且未加载失败时不使用渐变背景（让图片显示）
  if (showCover.value) return null
  const name = props.item?.name || props.item?.enName || String(props.item?.id ?? '')
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % gradientPalettes.length
  return { background: gradientPalettes[idx] }
})

function handleClick(e: MouseEvent) {
  if (props.showCheckbox) {
    e.stopPropagation()
    emit('check')
  } else {
    emit('click')
  }
}
</script>

<template>
  <div style="width: var(--book-width)" :id="`dict-${item?.id}`" v-if="!isAdd" @click="handleClick">
    <div
      class="book overflow-hidden relative"
      :class="[showCheckbox && 'book-selectable', (selected || checked) && 'book-selected']"
      :style="gradientStyle"
    >
      <img class="absolute top-0 left-0 w-full h-full object-cover" v-if="showCover" :src="coverSrc" alt="" @error="coverLoadFailed = true" />
      <template v-else>
        <div class="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
          <div class="text-base font-bold leading-tight text-white break-all" style="text-shadow: 0 1px 4px rgba(0,0,0,0.35)">{{ item?.name }}</div>
          <div v-if="item?.category" class="mt-2 text-xs text-white/85 px-2 py-0.5 rounded-full bg-black/15">{{ item?.category }}</div>
        </div>
        <div class="absolute bottom-4 right-3 z-1">
          <div class="text-white/90 text-sm">{{ studyProgress }}{{ item?.length }}{{ quantifier }}</div>
        </div>
      </template>
      <div class="absolute bottom-2 left-3 right-3">
        <Progress
          v-if="item?.lastLearnIndex && showProgress"
          class="mt-1"
          :percentage="progress"
          :show-text="false"
        ></Progress>
      </div>
      <Checkbox
        v-if="showCheckbox"
        :model-value="checked"
        @change="$emit('check')"
        class="absolute left-2 bottom-3 z-3"
      />
      <div class="custom z-1" v-if="item.custom">{{ $t('custom') }}</div>
      <div class="system z-1" v-else-if="item.system">内置</div>
      <!--      <div class="custom bg-red! color-white z-1" v-else-if="item.update">更新中</div>-->
      <!--      <div class="sync bg-red! color-white z-1" v-if="!item.sync && isUser && !showCheckbox">未同步</div>-->
    </div>
    <div class="flex justify-between text-base mt-1" v-if="showCover">
      <div class="w-6/10 truncate">{{ item?.name }}</div>
      <div>{{ studyProgress }}{{ item?.length }}{{ quantifier }}</div>
    </div>
  </div>
  <div v-else class="book" id="no-book" @click="handleClick">
    <div class="h-full center text-2xl">
      <IconFluentAdd16Regular />
    </div>
  </div>
</template>

<style scoped lang="scss">
.book-selectable {
  &:hover {
    border-color: var(--color-input-border);
  }
}

.book-selected {
  @apply bg-fifth;
  border-color: var(--color-select-bg) !important;
}

.custom {
  position: absolute;
  top: 4px;
  right: -22px;
  padding: 1px 20px;
  background: #409eff;
  color: white;
  font-size: 11px;
  transform: rotate(45deg);
}

.system {
  position: absolute;
  left: 10px;
  bottom: 18px;
  border-radius: 8px;
  padding: 2px 8px;
  // background: var(--color-link);
  background: #409eff;
  color: white;
  font-size: 11px;
}

.sync {
  @extend .custom;
  bottom: 4px;
  left: -22px;
  top: unset;
  right: unset;
}
</style>
