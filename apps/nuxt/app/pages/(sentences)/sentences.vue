<script setup lang="ts">
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { useRouter } from 'vue-router'
import {
  BaseButton,
  BaseIcon,
  BasePage,
  Calendar,
  PopConfirm,
  Progress,
  Toast,
} from '@typewords/base'
import {
  _getAccomplishDate,
  _getDictDataByUrl,
  _nextTick,
  debounce,
  isMobile,
  loadJsLib,
  msToHourMinute,
  resourceWrap,
  total,
  useNav,
} from '@typewords/core/utils'
import type { DictResource, Statistics } from '@typewords/core/types/types.ts'
import { shallowReactive, watch } from 'vue'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import Book from '@typewords/core/components/Book.vue'
import { getDefaultDict } from '@typewords/core/types/func.ts'
import { DeleteIcon } from '@typewords/base'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { useFetch } from '@vueuse/core'
import {
  APP_NAME,
  AppEnv,
  DICT_LIST,
  LIB_JS_URL,
  TourConfig,
} from '@typewords/core/config/env.ts'
import { myDictList } from '@typewords/core/apis'
import ImportBanner from '@typewords/core/components/ImportBanner.vue'
import ReleaseBanner from '@typewords/core/components/ReleaseBanner.vue'
import { flushStatToSentenceStore, usePracticeSentencePersistence } from '@typewords/core/composables/usePracticePersistence'
import { useDataSyncPersistence } from '@typewords/core/composables/useDataSyncPersistence'
import { DictType } from '@typewords/core/types/enum.ts'
import type { PracticeSentenceCache } from '@typewords/core/utils/cache.ts'
import dayjs from 'dayjs'

const store = useBaseStore()
const settingStore = useSettingStore()
const sentencePersistence = usePracticeSentencePersistence()
const dataSync = useDataSyncPersistence()
const router = useRouter()
const { nav } = useNav()
const runtimeStore = useRuntimeStore()
let loading = $ref(true)
let isSaveData = $ref(false)

useHead({
  title: APP_NAME + ' 句子',
})

let practiceData = $ref<PracticeSentenceCache>({
  taskWords: {
    new: [],
    review: [],
  },
  practiceData: null,
  statStoreData: null,
} as any)

async function resetCacheData() {
  isSaveData && flushStatToSentenceStore(practiceData.statStoreData)
  isSaveData = false
  practiceData.practiceData = null
  practiceData.statStoreData = null
  await sentencePersistence.clear()
}

watch(
  [() => store.load, () => runtimeStore.globalLoading],
  debounce(([a, b]) => {
    if (a && !b) {
      init()
      _nextTick(async () => {
        const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
        const tour = new Shepherd.Tour(TourConfig)
        tour.on('cancel', () => {
          localStorage.setItem('tour-guide', '1')
        })
        tour.addStep({
          id: 'step1',
          text: '点击这里选择一本句子集开始学习',
          attachTo: {
            element: '#step1',
            on: 'bottom',
          },
          buttons: [
            {
              text: `下一步（1/${TourConfig.total}）`,
              action() {
                tour.next()
                router.push('/sentence-list')
              },
            },
          ],
        })
        const r = localStorage.getItem('tour-guide')
        if (settingStore.first && !r && !isMobile()) tour.start()
      }, 500)
    }
  }),
  { immediate: true }
)

async function onvisibilitychange() {
  if (!document.hidden) {
    const d = await sentencePersistence.fetch()
    if (d) {
      practiceData = d
      isSaveData = true
    }
  }
}

async function init() {
  if (AppEnv.CAN_REQUEST) {
    let res = await myDictList({ type: 'sentence' })
    if (res.success) {
      store.setState(Object.assign(store.$state, res.data))
    }
  }

  document.removeEventListener('visibilitychange', onvisibilitychange)
  document.addEventListener('visibilitychange', onvisibilitychange)

  let studyIndex = store.sentence.studyIndex
  if (studyIndex >= 1) {
    if (!store.ssentence.custom && !store.ssentence.sentences.length) {
      let dictList = await fetch(resourceWrap(DICT_LIST.SENTENCE.ALL)).then(r => r.json())
      let dict = await _getDictDataByUrl(store.ssentence, DictType.sentence)
      let r = dictList.find(v => [v.enName, v.id].includes(store.ssentence.id))
      if (r) {
        store.sentence.bookList[studyIndex].sentences = dict.sentences
        store.sentence.bookList[studyIndex].id = r.id
        store.sentence.bookList[studyIndex].enName = r.enName
        store.sentence.bookList[studyIndex].cover = r.cover
        store.sentence.bookList[studyIndex].category = r.category
        store.sentence.bookList[studyIndex].tags = r.tags
        store.sentence.bookList[studyIndex].url = r.url
        store.sentence.bookList[studyIndex].description = r.description
        store.sentence.bookList[studyIndex].name = r.name
      } else {
        store.sentence.bookList[studyIndex] = dict
      }
      store.sentence.bookList[studyIndex].length = dict.sentences.length
      let s = store.sentence.bookList[studyIndex]
      if (s.lastLearnIndex > s.length) {
        store.sentence.bookList[studyIndex].lastLearnIndex = s.length
        store.sentence.bookList[studyIndex].complete = true
        await resetCacheData()
      }
    }
  }

  if (!practiceData?.taskWords.new.length && store.ssentence.sentences.length) {
    const d = await sentencePersistence.load()
    if (d) {
      practiceData = d
      isSaveData = true
    } else {
      practiceData.taskWords = getCurrentStudySentence()
    }
  }
  loading = false
}

function getCurrentStudySentence() {
  const dict = store.ssentence
  const perDay = dict.perDayStudyNumber
  const start = dict.lastLearnIndex
  return {
    new: dict.sentences.slice(start, start + perDay),
    review: [],
  }
}

async function startPractice(): void {
  if (store.ssentence.id) {
    if (!store.ssentence.sentences.length) {
      Toast.warning('没有句子可学习！')
      return
    }

    if (settingStore.first) settingStore.first = false

    window.umami?.track('startStudySentence', {
      name: store.ssentence.name,
      index: store.ssentence.lastLearnIndex,
      perDayStudyNumber: store.ssentence.perDayStudyNumber,
      custom: store.ssentence.custom,
      complete: store.ssentence.complete,
    })

    nav('/practice-sentences/' + store.ssentence.id, {}, practiceData)
  } else {
    window.umami?.track('no-sentence-dict')
    Toast.warning('请先选择一本句子集')
  }
}

function freePractice() {
  startPractice()
}

let isManageDict = $ref(false)
let selectIds = $ref([])

function handleBatchDel() {
  if (AppEnv.CAN_REQUEST) {
    // 句子集删除暂未支持后端接口，仅本地删除
    selectIds.forEach(id => {
      let r = store.sentence.bookList.findIndex(v => v.id === id)
      if (r !== -1) {
        if (store.sentence.studyIndex === r) {
          store.sentence.studyIndex = -1
        }
        if (store.sentence.studyIndex > r) {
          store.sentence.studyIndex--
        }
        store.sentence.bookList.splice(r, 1)
      }
    })
    selectIds = []
    Toast.success('删除成功！')
  } else {
    selectIds.forEach(id => {
      let r = store.sentence.bookList.findIndex(v => v.id === id)
      if (r !== -1) {
        if (store.sentence.studyIndex === r) {
          store.sentence.studyIndex = -1
        }
        if (store.sentence.studyIndex > r) {
          store.sentence.studyIndex--
        }
        store.sentence.bookList.splice(r, 1)
      }
    })
    selectIds = []
    Toast.success('删除成功！')
  }
}

function toggleSelect(item) {
  let rIndex = selectIds.findIndex(v => v === item.id)
  if (rIndex > -1) {
    selectIds.splice(rIndex, 1)
  } else {
    selectIds.push(item.id)
  }
}

const progressTextLeft = $computed(() => {
  if (store.ssentence.complete) return '已学完'
  return '当前进度：已学' + store.currentSentenceProgress + '%'
})

async function goDictDetail(val: DictResource) {
  if (!val.id) return nav('sentence-list')
  runtimeStore.editDict = getDefaultDict(val)
  nav('/sentence', {})
}

type StudyDayRow = Statistics & { dictName: string }

const allSentenceStatistics = $computed(() => store.sentence.bookList.flatMap(book => book.statistics ?? []))

const cacheSpendMs = $computed(() => practiceData.statStoreData?.spend ?? 0)

const todayDateKey = $computed(() => dayjs().format('YYYY-MM-DD'))

const cacheDaySpendMap = $computed((): Map<string, number> => {
  const st = practiceData.statStoreData
  const map = new Map<string, number>()
  if (!st?.spend) return map
  if (Array.isArray(st.segments) && st.segments.length > 0) {
    for (const [segStart, segEnd] of st.segments) {
      const key = dayjs(segStart).format('YYYY-MM-DD')
      map.set(key, (map.get(key) ?? 0) + (segEnd - segStart))
    }
  } else {
    map.set(dayjs(st.startDate).format('YYYY-MM-DD'), st.spend)
  }
  return map
})

const todayCacheMs = $computed(() => cacheDaySpendMap.get(todayDateKey) ?? 0)

const calendarHighlightDates = $computed(() => {
  const set = new Set<string>()
  for (const s of allSentenceStatistics) {
    set.add(dayjs(s.startDate).format('YYYY-MM-DD'))
  }
  for (const key of cacheDaySpendMap.keys()) {
    set.add(key)
  }
  return [...set]
})

const persistedTotalMs = $computed(() => total(allSentenceStatistics, 'spend'))

const totalSpend = $computed(() => {
  const sum = persistedTotalMs + cacheSpendMs
  if (!sum) return 0
  return msToHourMinute(sum)
})

const todayTotalSpend = $computed(() => {
  const todayPersistedMs = total(
    allSentenceStatistics.filter(v => dayjs(v.startDate).isSame(dayjs(), 'day')),
    'spend'
  )
  const sum = todayPersistedMs + todayCacheMs
  if (!sum) return 0
  return msToHourMinute(sum)
})

const totalDay = $computed(() => {
  const set = new Set(allSentenceStatistics.map(v => dayjs(v.startDate).format('YYYY-MM-DD')))
  for (const key of cacheDaySpendMap.keys()) {
    set.add(key)
  }
  return set.size
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
})

const { data: recommendDictList, isFetching } = useFetch(resourceWrap(DICT_LIST.SENTENCE.RECOMMENDED)).json()
</script>

<template>
  <BasePage>
    <ReleaseBanner />

    <div class="card flex flex-col md:flex-row gap-4">
      <div class="flex-1 flex flex-col justify-between">
        <div class="flex gap-3">
          <div class="p-1 center rounded-full bg-white">
            <IconFluentBookNumber20Filled class="text-xl color-link" />
          </div>
          <div @click="goDictDetail(store.ssentence)" class="text-2xl font-bold cursor-pointer">
            {{ store.ssentence.name || '未选择句子集' }}
          </div>
        </div>

        <template v-if="store.ssentence.id">
          <div class="mt-4 space-y-2">
            <div class="text-sm flex justify-between">
              <span v-opacity="store.ssentence.id && store.ssentence.lastLearnIndex < store.ssentence.length">
                {{ '预计完成日期' }}：{{
                  _getAccomplishDate(
                    store.ssentence.sentences.length - store.ssentence.lastLearnIndex,
                    store.ssentence.perDayStudyNumber
                  )
                }}
              </span>
            </div>
            <Progress size="large" :percentage="store.currentSentenceProgress" :show-text="false"></Progress>

            <div class="text-sm flex justify-between">
              <span>{{ progressTextLeft }}</span>
              <span> {{ store.ssentence?.lastLearnIndex }} / {{ store.ssentence.length }} 句</span>
            </div>
          </div>
          <div class="flex items-center mt-4 gap-4">
            <BaseButton type="info" size="small" @click="router.push('/sentence-list')">
              <div class="center gap-1">
                <IconFluentArrowSwap20Regular />
                <span>{{ '选择句子集' }}</span>
              </div>
            </BaseButton>
            <BaseButton type="info" size="small" @click="router.push('/fsrs')"> 学习记录</BaseButton>
          </div>
        </template>

        <div class="flex items-center gap-4 mt-2 flex-1" v-else>
          <div class="title">{{ '请选择句子集开始学习' }}</div>
          <BaseButton id="step1" type="primary" size="large" @click="router.push('/sentence-list')">
            <div class="center gap-1">
              <IconFluentAdd16Regular />
              <span>{{ '选择句子集' }}</span>
            </div>
          </BaseButton>
        </div>
      </div>
      <div class="flex-1 mt-4 md:mt-0" :class="!store.ssentence.id && 'opacity-30 cursor-not-allowed'">
        <div class="flex justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 center rounded-full bg-white">
              <IconFluentStar20Filled class="text-lg color-amber" />
            </div>
            <div class="text-xl font-bold">
              {{ isSaveData ? '上次任务' : '今日任务' }}
            </div>
          </div>
          <div class="flex gap-1 items-center" v-if="store.ssentence.id">
            {{ '每日目标' }}
            <div style="color: #ac6ed1" class="bg-third px-2 h-10 flex center text-2xl rounded">
              {{ store.ssentence.id ? store.ssentence.perDayStudyNumber : 0 }}
            </div>
            {{ '句' }}
          </div>
        </div>
        <div class="flex mt-4 justify-between">
          <div class="stat">
            <div class="num">{{ practiceData?.taskWords?.new?.length }}</div>
            <div class="txt">{{ '新学' }}</div>
          </div>
          <div class="stat">
            <div class="num">{{ practiceData?.taskWords?.review?.length }}</div>
            <div class="txt">{{ '复习' }}</div>
          </div>
        </div>
        <div class="flex items-end mt-4 gap-4 btn-no-margin">
          <BaseButton
            class="flex-1"
            type="primary"
            size="large"
            :disabled="!store.ssentence.id"
            :loading="loading"
            @click="startPractice"
          >
            <div class="flex items-center gap-2">
              <span class="line-height-[2]">{{ isSaveData ? '继续练习' : '开始练习' }}</span>
              <IconFluentArrowCircleRight16Regular class="text-xl" />
            </div>
          </BaseButton>

          <BaseButton class="flex-1" type="orange" size="large" :loading="loading" @click="freePractice()">
            <div class="flex items-center gap-2">
              <span class="line-height-[2]">{{ '自由练习' }}</span>
              <IconStreamlineColorPenDrawFlat class="text-xl" />
            </div>
          </BaseButton>
        </div>
      </div>
    </div>

    <div class="card flex flex-col md:flex-row gap-4 xl:gap-20 p-4 md:p-6">
      <div class="flex-1 flex flex-col gap-3 min-w-0">
        <div class="title">统计</div>
        <div class="flex gap-3 items-center w-full">
          <div class="stat2">
            <div class="num">{{ todayTotalSpend }}</div>
            <div class="txt">{{ '今日学习时长' }}</div>
          </div>
          <div class="stat2">
            <div class="num">{{ totalDay }}</div>
            <div class="txt">{{ '累计学习天数' }}</div>
          </div>
          <div class="stat2">
            <div class="num">{{ totalSpend }}</div>
            <div class="txt">{{ '累计学习时长' }}</div>
          </div>
        </div>
      </div>
      <div class="shrink-0 flex items-center">
        <Calendar
          :highlighted-dates="calendarHighlightDates"
          :weekHeaderTitle="'本周记录'"
        >
        </Calendar>
      </div>
    </div>

    <ImportBanner
      title="导入自己的句子"
      desc="支持 txt/json/xlsx 文件导入，或者手动输入句子导入"
      @click="nav('/import', { type: 'sentence' })"
    />

    <div class="card flex flex-col">
      <div class="flex justify-between">
        <div class="title">{{ '我的句子集' }}</div>
        <div class="flex gap-4 items-center">
          <PopConfirm title="确认删除所有选中的句子集？" @confirm="handleBatchDel" v-if="selectIds.length">
            <BaseIcon class="del" :title="'删除'">
              <DeleteIcon />
            </BaseIcon>
          </PopConfirm>

          <div
            class="color-link cursor-pointer"
            v-if="store.sentence.bookList.length > 1"
            @click="
              () => {
                isManageDict = !isManageDict
                selectIds = []
              }
            "
          >
            {{ isManageDict ? '取消' : '管理句子集' }}
          </div>
          <div class="color-link cursor-pointer" @click="nav('/sentence', { isAdd: true })">
            {{ '创建个人句子集' }}
          </div>
        </div>
      </div>
      <div class="flex gap-4 flex-wrap mt-4">
        <Book
          :is-add="false"
          quantifier="句"
          :item="item"
          :checked="selectIds.includes(item.id)"
          @check="() => toggleSelect(item)"
          :show-checkbox="isManageDict && j >= 1"
          v-for="(item, j) in store.sentence.bookList"
          @click="goDictDetail(item)"
        />
        <Book :is-add="true" @click="router.push('/sentence-list')" />
      </div>
    </div>

    <div class="card flex flex-col overflow-hidden" v-loading="isFetching">
      <div class="flex justify-between">
        <div class="title">{{ '推荐' }}</div>
        <div class="flex gap-4 items-center">
          <div class="color-link cursor-pointer" @click="router.push('/sentence-list')">{{ '更多' }}</div>
        </div>
      </div>

      <div class="flex gap-4 flex-wrap mt-4 min-h-50">
        <Book
          :is-add="false"
          quantifier="句"
          :item="item as any"
          v-for="(item, j) in recommendDictList"
          @click="goDictDetail(item as any)"
        />
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.stat {
  @apply w-49% box-border flex flex-col items-center justify-center rounded-xl p-2 bg-[var(--bg-history)];
  border: 1px solid gainsboro;

  .num {
    @apply color-[#409eff] text-4xl font-bold;
  }

  .txt {
    @apply color-gray-500;
  }
}

.stat2 {
  @extend .stat;
  @apply py-4 flex-1;
  width: unset;

  .num {
    @apply text-2xl break-keep;
  }
}
</style>
