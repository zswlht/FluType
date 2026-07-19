<script setup lang="ts">
import { _nextTick, groupBy, isMobile, loadJsLib, resourceWrap, useNav } from '@typewords/core/utils'
import { BackIcon, BaseButton, BaseIcon, BaseInput, BasePage } from '@typewords/base'
import type { DictResource } from '@typewords/core/types/types.ts'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import Empty from '@typewords/core/components/Empty.vue'
import DictList from '@typewords/core/components/list/DictList.vue'
import DictGroup from '@typewords/core/components/list/DictGroup.vue'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { useRouter } from 'vue-router'
import { computed, watch } from 'vue'
import { getDefaultDict } from '@typewords/core/types/func.ts'
import { useFetch } from '@vueuse/core'
import { APP_NAME, DICT_LIST, LIB_JS_URL, TourConfig } from '@typewords/core/config/env.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'

useHead({
  title: APP_NAME + ' 句子库',
})

const { nav } = useNav()
const runtimeStore = useRuntimeStore()
const settingStore = useSettingStore()
const store = useBaseStore()
const router = useRouter()

function selectDict(e) {
  console.log(e.dict)
  getDictDetail(e.dict)
}

async function getDictDetail(val: DictResource) {
  runtimeStore.editDict = getDefaultDict(val as any)
  nav('/sentence', { from: 'list' })
}

function groupByDictTags(dictList: DictResource[]) {
  return dictList.reduce<Record<string, DictResource[]>>((result, dict) => {
    dict.tags.forEach(tag => {
      if (result[tag]) {
        result[tag].push(dict)
      } else {
        result[tag] = [dict]
      }
    })
    return result
  }, {})
}

const { data: sentenceRawList, isFetching: isFetchingSentence } = useFetch(resourceWrap(DICT_LIST.SENTENCE.ALL), { server: false }).json()
const { data: articleRawList, isFetching: isFetchingArticle } = useFetch(resourceWrap(DICT_LIST.ARTICLE.ALL), { server: false }).json()
// 注：使用 server: false 避免在 SSR 时阻塞（CDN 资源在网络受限环境下会超时）

const isFetching = computed(() => isFetchingSentence.value || isFetchingArticle.value)

// 合并：CDN 上的句子集 + 从文章复用的新概念英语 1-4（非 hidden 的 nce1-4）
const dict_list = computed<DictResource[]>(() => {
  const list: DictResource[] = [...(sentenceRawList.value || [])]
  const articles: any[] = (articleRawList.value || []).filter(v =>
    Array.isArray(v?.tags) && v.tags.includes('新概念英语') && !v.hidden
  )
  for (const a of articles) {
    if (list.find(v => v.url === a.url)) continue
    list.push({
      id: a.id,
      enName: a.enName,
      name: a.name,
      description: a.description,
      category: a.category,
      tags: a.tags,
      url: a.url,
      length: a.length,
      language: a.language,
      translateLanguage: a.translateLanguage,
      cover: a.cover,
      sourceArticle: true,
    } as DictResource)
  }
  return list
})

const groupedByCategoryAndTag = $computed(() => {
  let data = []
  if (!dict_list.value?.length) return data
  const groupByCategory = groupBy(dict_list.value, 'category')
  for (const [key, value] of Object.entries(groupByCategory)) {
    data.push([key, groupByDictTags(value)])
  }
  return data
})

let showSearchInput = $ref(false)
let searchKey = $ref('')

const searchList = computed<any[]>(() => {
  if (searchKey) {
    let s = searchKey.toLowerCase()
    return (dict_list.value || []).filter(item => {
      return (
        (item.enName || '').toLowerCase().includes(s) ||
        item.name.toLowerCase().includes(s) ||
        item.category.toLowerCase().includes(s) ||
        item.tags.join('').replace('所有', '').toLowerCase().includes(s) ||
        item?.url?.toLowerCase?.().includes?.(s)
      )
    })
  }
  return []
})

watch(dict_list, val => {
  if (!val?.length) return
  let first = val.find(v => v.id === 1) ?? val[0]
  if (!first) return
  _nextTick(async () => {
    const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
    const tour = new Shepherd.Tour(TourConfig)
    tour.on('cancel', () => {
      localStorage.setItem('tour-guide', '1')
    })
    tour.addStep({
      id: 'step2',
      text: '选一本自己准备学习的句子集',
      attachTo: { element: '#dict-' + first.id, on: 'bottom' },
      buttons: [
        {
          text: `下一步（2/${TourConfig.total}）`,
          action() {
            tour.next()
            selectDict({ dict: first })
          },
        },
      ],
    })

    const r = localStorage.getItem('tour-guide')
    if (settingStore.first && !r && !isMobile()) {
      tour.start()
    }
  }, 500)
})
</script>

<template>
  <BasePage>
    <div class="card min-h-200 dict-list-page" v-loading="isFetching">
      <div class="flex items-center relative gap-2 header-section">
        <BackIcon class="z-2" @click="router.back" />
        <div class="flex flex-1 gap-4" v-if="showSearchInput">
          <BaseInput clearable placeholder="请输入句子集名称/缩写/类别" v-model="searchKey" class="flex-1" autofocus />
          <BaseButton @click="((showSearchInput = false), (searchKey = ''))">{{ '取消' }}</BaseButton>
        </div>
        <div class="py-1 flex flex-1 justify-end" v-else>
          <span class="page-title absolute w-full center">{{ '句子库' }}</span>
          <BaseIcon :title="'搜索'" @click="showSearchInput = true" class="z-1" icon="fluent:search-24-regular">
            <IconFluentSearch24Regular />
          </BaseIcon>
        </div>
      </div>
      <div class="mt-4" v-if="searchKey">
        <DictList
          v-if="searchList.length"
          @selectDict="selectDict"
          :list="searchList"
          quantifier="句"
          :select-id="'-1'"
        />
        <Empty v-else text="没有相关句子集" />
      </div>
      <div class="w-full" v-else>
        <DictGroup
          v-for="item in groupedByCategoryAndTag"
          :select-id="store.ssentence.id"
          @selectDict="selectDict"
          quantifier="句"
          :groupByTag="item[1]"
          :category="item[0]"
        />
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
// 移动端适配
@media (max-width: 768px) {
  .dict-list-page {
    padding: 0.8rem;
    margin-bottom: 1rem;

    .header-section {
      flex-direction: column;
      gap: 0.5rem;

      .flex.flex-1.gap-4 {
        width: 100%;

        .base-input {
          font-size: 0.9rem;
        }

        .base-button {
          padding: 0.5rem 0.8rem;
          font-size: 0.9rem;
        }
      }

      .py-1.flex.flex-1.justify-end {
        width: 100%;

        .page-title {
          font-size: 1.2rem;
        }

        .base-icon {
          font-size: 1.2rem;
        }
      }
    }

    .mt-4 {
      margin-top: 0.8rem;
    }
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .dict-list-page {
    padding: 0.5rem;

    .header-section {
      .flex.flex-1.gap-4 {
        .base-input {
          font-size: 0.8rem;
        }

        .base-button {
          padding: 0.4rem 0.6rem;
          font-size: 0.8rem;
        }
      }

      .py-1.flex.flex-1.justify-end {
        .page-title {
          font-size: 1rem;
        }

        .base-icon {
          font-size: 1rem;
        }
      }
    }
  }
}
</style>
