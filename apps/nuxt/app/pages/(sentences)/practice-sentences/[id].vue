<script setup lang="ts">
import { onMounted, onUnmounted, provide, watch } from 'vue'
import Statistics from '@typewords/core/components/word/Statistics.vue'
import { emitter, EventKey, useEvents } from '@typewords/core/utils/eventBus.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import type { Dict, PracticeData, TaskWords, Word } from '@typewords/core/types/types.ts'
import { useStartKeyboardEventListener } from '@typewords/core/hooks/event.ts'
import useTheme from '@typewords/core/hooks/theme.ts'
import {
  _getDictDataByUrl,
  _nextTick,
  cloneDeep,
  debounce,
  isMobile,
  loadJsLib,
  resourceWrap,
  shuffle,
  throttle,
} from '@typewords/core/utils'
import { useRoute, useRouter } from 'vue-router'
import Footer from '@typewords/core/components/word/Footer.vue'
import Panel from '@typewords/core/components/Panel.vue'
import { BaseIcon, Toast, ToastComponent, Tooltip } from '@typewords/base'
import WordList from '@typewords/core/components/list/WordList.vue'
import TypeWord from '@typewords/core/components/word/TypeWord.vue'
import Empty from '@typewords/core/components/Empty.vue'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { usePracticeStore } from '@typewords/core/stores/practice.ts'
import { getDefaultDict, getDefaultWord } from '@typewords/core/types/func.ts'
import ConflictNotice from '@typewords/core/components/dialog/ConflictNotice.vue'
import PracticeLayout from '@typewords/core/components/PracticeLayout.vue'
import { AppEnv, DICT_LIST, LIB_JS_URL, TourConfig } from '@typewords/core/config/env.ts'
import { watchOnce } from '@vueuse/core'
import { addStat, setUserDictProp } from '@typewords/core/apis'
import { getPracticeSentenceCacheLocal } from '@typewords/core/utils/cache.ts'
import { useDataSyncPersistence } from '@typewords/core/composables/useDataSyncPersistence.ts'
import { flushStatToSentenceStore, usePracticeSentencePersistence } from '@typewords/core/composables/usePracticePersistence.ts'
import { ShortcutKey, WordPracticeMode, WordPracticeStage, WordPracticeType } from '@typewords/core/types/enum.ts'
import ConflictNotice2 from '@typewords/core/components/dialog/ConflictNotice2.vue'
import CollectNotice from '@typewords/core/components/dialog/CollectNotice.vue'
import { APP_NAME } from '@typewords/core/config/env.ts'
import { DictType } from '@typewords/core/types/enum.ts'

useHead({
  title: APP_NAME + ' 句子练习',
})

const settingStore = useSettingStore()
const runtimeStore = useRuntimeStore()
const { toggleTheme } = useTheme()
const router = useRouter()
const route = useRoute()
const store = useBaseStore()
const statStore = usePracticeStore()
const dataSync = useDataSyncPersistence()
const sentencePersistence = usePracticeSentencePersistence()

// 句子练习默认使用 Free 模式（线性练习）
settingStore.wordPracticeMode = WordPracticeMode.Free
settingStore.wordPracticeType = WordPracticeType.FollowWrite

const typingRef: any = $ref()
let showConflictNotice = $ref(false)
let showCollectNotice = $ref(false)
let showConflictNotice2 = $ref(false)
let isComplete = $ref(false)
let loading = $ref(false)
let settling = $ref(false)
let timer = $ref<any>(-1)
let isFocus = true
const IDLE_MS = 3 * 60 * 1000
let lastKeyActivity = Date.now()
let taskWords = $ref<TaskWords>({
  new: [],
  review: [],
})

let watchRefList = []

function getDefaultPracticeData(origin?: Partial<PracticeData>, val?: Partial<PracticeData>): PracticeData {
  return Object.assign(origin, {
    index: 0,
    words: [],
    wrongWords: [],
    excludeWords: [],
    allWrongWords: [],
    wrongTimesMap: {},
    ratingMap: {},
    wrongTimes: 0,
    isTypingWrongWord: false,
    question: null,
    ...val,
  })
}
let data = $ref<PracticeData>(getDefaultPracticeData({}))

watch(
  () => data.words,
  () => {
    handleResumeTimer()
  }
)
watch(
  () => data.index,
  () => {
    handleResumeTimer()
  }
)

provide('practiceData', data)
provide('practiceTaskWords', taskWords)

function bumpPracticeTimerActivity() {
  lastKeyActivity = Date.now()
}
provide('bumpPracticeTimerActivity', bumpPracticeTimerActivity)

function handleResumeTimer() {
  if (!isFocus) return
  if (statStore.timerPaused) {
    statStore.resumeTimer()
    Toast.success('已恢复计时')
  }
  bumpPracticeTimerActivity()
}

async function loadDict() {
  let dict = getDefaultDict()
  let dictId = route.params.id
  if (dictId) {
    dict = store.sentence.bookList.find(v => v.id === dictId)
    let r = await fetch(resourceWrap(DICT_LIST.SENTENCE.ALL))
    let dict_list = await r.json()
    if (!dict) dict = dict_list.flat().find(v => v.id === dictId) as Dict
    if (dict && dict.id) {
      if (!dict.custom) dict = await _getDictDataByUrl(dict, DictType.sentence)
      if (!dict.sentences.length) {
        router.push('/sentences')
        return Toast.warning('没有句子可学习！')
      }
      store.changeSentenceDict(dict)
      await initData(null, true)
      loading = false
    } else {
      router.push('/sentences')
    }
  } else {
    router.push('/sentences')
  }
}

watch(
  [() => store.load, () => loading],
  ([a, b]) => {
    if (a && b) loadDict()
  },
  { immediate: true }
)

const onvisibilitychange = async () => {
  isFocus = !document.hidden
  if (isFocus) {
    bumpPracticeTimerActivity()
    if (statStore.timerPaused && statStore.timerPauseReason === 'auto_visibility') {
      setTimeout(() => {
        statStore.resumeTimer()
        Toast.success('已自动恢复计时')
      }, 1500)
    }
    if (runtimeStore.globalLoading) return
    runtimeStore.globalLoading = true
    try {
      const d = await sentencePersistence.fetch()
      if (d) {
        taskWords = Object.assign(taskWords, d.taskWords)
        data = Object.assign(data, d.practiceData)
        statStore.$patch(d.statStoreData)
        if (!statStore.timerPaused) {
          const now = Date.now()
          statStore.segments.push([now, now])
        }
      }
    } finally {
      runtimeStore.globalLoading = false
    }
  } else {
    statStore.pauseTimer('auto_visibility')
  }
}

onMounted(async () => {
  if (runtimeStore.routeData) {
    await initData(null, true)
  } else {
    loading = true
  }
  if (!route.query.guide) {
    showConflictNotice = true
    setTimeout(() => {
      showCollectNotice = true
    }, 10000)
  }
  document.removeEventListener('visibilitychange', onvisibilitychange)
  document.addEventListener('visibilitychange', onvisibilitychange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  if (getPracticeSentenceCacheLocal()) {
    savePracticeDataIns('onUnmounted')
  }
  timer && clearInterval(timer)
  watchRefList.map(v => v?.stop())
})

watchOnce(
  () => data.words.length,
  (newVal, oldVal) => {
    if (!oldVal && newVal) {
      _nextTick(async () => {
        const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
        const tour = new Shepherd.Tour(TourConfig)
        tour.on('cancel', () => {
          localStorage.setItem('tour-guide', '1')
        })
        tour.addStep({
          id: 'step5',
          text: '这里可以练习输入句子，只需要按下键盘上对应的按键即可，没有输入框！',
          attachTo: { element: '#word', on: 'bottom' },
          buttons: [
            {
              text: `关闭`,
              action() {
                settingStore.first = false
                tour.next()
                setTimeout(() => {
                  showConflictNotice = true
                }, 1500)
                setTimeout(() => {
                  showCollectNotice = true
                }, 10000)
              },
            },
          ],
        })

        const r = localStorage.getItem('tour-guide')
        if (settingStore.first && !r && !isMobile()) {
          tour.start()
        }
      }, 500)
    }
  }
)

let allWords: Word[] = []
let isIniting = ref(true)

async function initData(initVal?: TaskWords, init: boolean = false) {
  isIniting.value = true
  if (init) {
    let d = runtimeStore.routeData
    if (!d) {
      d = await sentencePersistence.load()
    }
    if (!d) {
      initData(getCurrentStudySentence())
      return
    }
    if (!(d.practiceData && d.statStoreData)) {
      initData(d.taskWords)
      return
    }
    console.log('initData')
    taskWords = Object.assign(taskWords, d.taskWords)
    data = getDefaultPracticeData(data, d.practiceData)
    statStore.$patch(d.statStoreData)
    if (!statStore.timerPaused) {
      const now = Date.now()
      statStore.segments.push([now, now])
    }
  } else {
    console.log('initData')
    taskWords = Object.assign(taskWords, initVal)
    // 句子练习为线性练习，只有 new，没有 review
    data = getDefaultPracticeData(data, { words: taskWords.new })
    statStore.stage = WordPracticeStage.FollowWriteNewWord
    statStore.total = taskWords.new.length
    statStore.newWordNumber = taskWords.new.length
    statStore.reviewWordNumber = 0

    statStore.startDate = Date.now()
    statStore.inputWordNumber = 0
    statStore.wrong = 0
    statStore.spend = 0
    statStore.segments = []
    statStore.resumeTimer()
  }

  let dictId: any = route.params.id
  let d = store.sentence.bookList.find(v => v.id === dictId)
  if (!d) d = store.ssentence
  if (!d?.id) return router.push('/sentences')
  allWords = shuffle(d.sentences)

  clearInterval(timer)
  bumpPracticeTimerActivity()
  timer = setInterval(() => {
    if (!isFocus) return
    if (statStore.timerPaused) return

    const now = Date.now()
    if (now - lastKeyActivity >= IDLE_MS) {
      return statStore.pauseTimer('auto_idle')
    }
    statStore.spend += 1000
  }, 1000)
  isIniting.value = false
  settling = isComplete = false
}

function getCurrentStudySentence(): TaskWords {
  const dict = store.ssentence
  const perDay = dict.perDayStudyNumber
  const start = dict.lastLearnIndex
  return {
    new: dict.sentences.slice(start, start + perDay),
    review: [],
  }
}

const word = $computed<Word>(() => {
  return data.words[data.index] ?? getDefaultWord()
})
const prevWord: Word = $computed(() => {
  return data.words?.[data.index - 1] ?? undefined
})
const nextWord: Word = $computed(() => {
  return data.words?.[data.index + 1] ?? undefined
})

async function complete() {
  if (!isComplete) {
    let start = Date.now()
    console.log('句子全部学完')
    isComplete = true
    settling = true
    runtimeStore.globalLoading = true
    clearInterval(timer)

    // 推进 lastLearnIndex
    store.ssentence.lastLearnIndex = store.ssentence.lastLearnIndex + statStore.newWordNumber
    if (store.ssentence.lastLearnIndex >= store.ssentence.length) {
      store.ssentence.complete = true
      store.ssentence.lastLearnIndex = store.ssentence.length
    }

    // 结算前先将最后一条片段的 end 定格为当前时刻
    if (!statStore.timerPaused && statStore.segments.length > 0) {
      statStore.segments[statStore.segments.length - 1][1] = Date.now()
    }

    flushStatToSentenceStore(statStore.$state)

    if (AppEnv.CAN_REQUEST) {
      let res = await addStat({
        ...data,
        type: 'sentence',
        perDayStudyNumber: store.ssentence.perDayStudyNumber,
        lastLearnIndex: store.ssentence.lastLearnIndex,
        complete: store.ssentence.complete,
      })
      if (!res.success) {
        Toast.error(res.msg)
      }
    }

    await dataSync.saveDictState(store.$state, { pullWhenRemoteNewer: false })
    await sentencePersistence.clear()

    let trackData = {
      funSpend: Date.now() - start,
      name: store.ssentence.name,
      spend: Number(statStore.spend / 1000 / 60).toFixed(1),
      index: store.ssentence.lastLearnIndex,
      per: store.ssentence.perDayStudyNumber,
      custom: store.ssentence.custom,
      complete: store.ssentence.complete,
      str: '',
    }
    trackData.str = `name:${trackData.name},per:${trackData.per},spend:${trackData.spend},index:${trackData.index},funSpend:${trackData.funSpend}`
    window.umami?.track('endStudySentence', trackData)
    settling = false
    runtimeStore.globalLoading = false
  }
}

function next(isTyping: boolean = true, ignoreLoop = false) {
  let temp = word.word.toLowerCase()
  let preTimes = data.wrongTimesMap[temp] ?? 0

  data.wrongTimesMap[temp] = preTimes + data.wrongTimes
  data.wrongTimes = 0

  if (isTyping) statStore.inputWordNumber++

  // 句子练习为线性流程，无多阶段切换
  if (data.index === data.words.length - 1) {
    data.wrongWords = data.wrongWords.filter(v => !data.excludeWords.includes(v.word))
    if (data.wrongWords.length) {
      data.isTypingWrongWord = true
      console.log('当前学完了，但还有错句')
      data.words = shuffle(cloneDeep(data.wrongWords))
      data.index = 0
      data.wrongWords = []
    } else {
      data.isTypingWrongWord = false
      complete()
    }
  } else {
    data.index++
  }

  if (data.words.length > 0 && checkWordIsNeedNext(word)) next(false, ignoreLoop)
}

function checkWordIsNeedNext(word: Word) {
  if (!word.word) return false
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  return rIndex > -1
}

function skipStep() {
  data.index = data.words.length - 1
  data.wrongWords = []
  next(false, true)
}

function addExcludeWord() {
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex < 0) {
    data.excludeWords.push(word.word)
  }
}

function onTypeWrong() {
  data.wrongTimes++
  let temp = word.word.toLowerCase()
  if (!data.allWrongWords.find(v => v === temp)) {
    data.allWrongWords.push(temp)
    statStore.wrong++
  }
  if (!data.wrongWords.find((v: Word) => v.word.toLowerCase() === temp)) {
    data.wrongWords.push(word)
  }
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex > -1) {
    data.excludeWords.splice(rIndex, 1)
  }
  savePracticeData('wrong')
}

async function savePracticeDataIns(where?) {
  if (data.index === 0 && statStore.spend === 0) {
    return
  }
  if (isComplete) return
  if (runtimeStore.globalLoading) return
  runtimeStore.globalLoading = true
  if (!statStore.timerPaused && statStore.segments.length > 0) {
    statStore.segments[statStore.segments.length - 1][1] = Date.now()
  }
  await sentencePersistence.save({
    taskWords,
    practiceData: data,
    statStoreData: statStore.$state,
  })
  runtimeStore.globalLoading = false
}

const savePracticeData = debounce(savePracticeDataIns, 500)

function repeat() {
  console.log('重学一遍')
  sentencePersistence.clear()
  let temp = cloneDeep(taskWords)
  emitter.emit(EventKey.resetWord)
  initData(temp)
}

function prev() {
  if (data.index === 0) {
    Toast.warning('已经是第一个了~')
  } else {
    data.index--
  }
}

function skip() {
  addExcludeWord()
  next(false)
}

function show(e: KeyboardEvent) {
  typingRef.showWord()
}

function collect(e: KeyboardEvent) {
  const anchor = typingRef?.getCollectAnchor?.() as HTMLElement | null | undefined
  // 句子集收藏暂不支持，先调用空函数保持兼容
}

function play() {
  typingRef.play()
}

function toggleConciseMode() {
  settingStore.showToolbar = !settingStore.showToolbar
  settingStore.showPanel = settingStore.showToolbar
}

async function continueStudy() {
  sentencePersistence.clear()
  let temp = cloneDeep(taskWords)
  if (!isComplete) {
    console.log('没学完，强行跳过')
    store.ssentence.lastLearnIndex = store.ssentence.lastLearnIndex + statStore.newWordNumber
    if (store.ssentence.lastLearnIndex >= store.ssentence.length) {
      store.ssentence.complete = true
      store.ssentence.lastLearnIndex = store.ssentence.length
    }
  } else {
    console.log('学完了，正常下一组')
  }
  temp = getCurrentStudySentence()
  emitter.emit(EventKey.resetWord)
  initData(temp)

  if (AppEnv.CAN_REQUEST) {
    let res = await setUserDictProp(null, { ...store.ssentence, type: 'sentence' })
    if (!res.success) {
      Toast.error(res.msg)
    }
  }
}

function randomWrite() {
  window?.umami?.track('randomWriteSentence')
  console.log('随机默写')
  data.words = shuffle(data.words)
  data.index = 0
  settingStore.dictation = true
}

useStartKeyboardEventListener()

watch(isIniting, n => {
  if (!n) {
    watchRefList = [
      watch(() => data.index, savePracticeData),
      watch(
        () => statStore.spend,
        curr => {
          if (curr % (30 * 1000) === 0 && curr !== 0) {
            savePracticeData('spend')
          }
        }
      ),
    ]
  }
})

useEvents([
  [EventKey.onTyping, handleResumeTimer],
  [EventKey.repeatStudy, repeat],
  [EventKey.continueStudy, continueStudy],
  [ShortcutKey.ShowWord, throttle(show, 300)],
  [ShortcutKey.Previous, prev],
  [ShortcutKey.Next, throttle(() => next(false), 300)],
  [ShortcutKey.Ignore, throttle(skip, 300)],
  [ShortcutKey.ToggleCollect, collect],
  [ShortcutKey.PlayWordPronunciation, play],

  [ShortcutKey.RepeatChapter, repeat],
  [ShortcutKey.NextChapter, continueStudy],
  [ShortcutKey.NextStep, skipStep],
  [ShortcutKey.ToggleShowTranslate, () => (settingStore.translate = !settingStore.translate)],
  [ShortcutKey.ToggleDictation, () => (settingStore.dictation = !settingStore.dictation)],
  [ShortcutKey.ToggleTheme, toggleTheme],
  [ShortcutKey.ToggleConciseMode, toggleConciseMode],
  [ShortcutKey.ToggleToolbar, () => (settingStore.showToolbar = !settingStore.showToolbar)],
  [ShortcutKey.TogglePanel, () => (settingStore.showPanel = !settingStore.showPanel)],
  [ShortcutKey.RandomWrite, randomWrite],
])
</script>

<template>
  <PracticeLayout v-loading="loading" panelLeft="var(--word-panel-margin-left)">
    <template v-slot:practice>
      <div class="practice-word">
        <div class="fixed z-99999 center mt-3" v-if="statStore.timerPaused">
          <ToastComponent
            :duration="0"
            :anim="statStore.timerPauseReason !== 'auto_visibility'"
            :shadow="false"
            :showClose="true"
            :message="statStore.timerPauseReason === 'auto_idle' ? '已连续 3 分钟无键盘操作，计时已暂停' : '计时已暂停'"
            @close="statStore.resumeTimer"
          />
        </div>

        <div class="mb-50 w-full">
          <div
            class="fixed z-1 top-4 w-full hidden md:block"
            style="left: calc(50vw + var(--aside-width) / 2 - var(--toolbar-width) / 2); width: var(--toolbar-width)"
            v-if="settingStore.showNearWord"
          >
            <Tooltip :title="`上一个(${settingStore.shortcutKeyMap[ShortcutKey.Previous]})`">
              <div class="relative z-2 center gap-2 cp float-left" @click="prev" v-if="prevWord">
                <IconFluentArrowLeft16Regular class="arrow" width="22" />
                <div class="word">{{ prevWord.word }}</div>
              </div>
            </Tooltip>

            <div
              class="center gap-1 absolute w-full cp"
              v-if="settingStore.showConflictNotice2"
              @click="showConflictNotice2 = true"
            >
              <IconFluentQuestionCircle20Regular />
              <span class="">无法输入？</span>
            </div>

            <Tooltip :title="`下一个(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`">
              <div class="relative center gap-2 cp float-right mr-3" @click="next(false)" v-if="nextWord">
                <div class="word" :class="settingStore.dictation && 'word-shadow'">
                  {{ nextWord.word }}
                </div>
                <IconFluentArrowRight16Regular class="arrow" width="22" />
              </div>
            </Tooltip>
          </div>
          <TypeWord
            ref="typingRef"
            :word="word"
            @wrong="onTypeWrong"
            @complete="next"
            @skip="skip"
          />
        </div>
      </div>
    </template>
    <template v-slot:panel>
      <Panel>
        <template v-slot:title>
          <div class="center gap-1">
            <span>{{ store.ssentence.name }}</span>

            <BaseIcon
              @click="continueStudy"
              :title="`下一组(${settingStore.shortcutKeyMap[ShortcutKey.NextChapter]})`"
            >
              <IconFluentArrowRight16Regular class="arrow" width="22" />
            </BaseIcon>

            <BaseIcon @click="randomWrite" :title="`随机默写(${settingStore.shortcutKeyMap[ShortcutKey.RandomWrite]})`">
              <IconFluentArrowShuffle16Regular class="arrow" width="22" />
            </BaseIcon>
          </div>
        </template>
        <div class="panel-page-item pl-4">
          <WordList
            v-if="data.words.length"
            :is-active="settingStore.showPanel"
            :static="false"
            :show-word="!settingStore.dictation"
            :show-translate="settingStore.translate"
            :list="data.words"
            :activeIndex="data.index"
            :excludeWords="data.excludeWords"
            :exclude-dict-id="store.ssentence.id ? String(store.ssentence.id) : undefined"
            @click="(val: any) => (data.index = val.index)"
          >
          </WordList>
          <Empty v-else />
        </div>
      </Panel>
    </template>
    <template v-slot:footer>
      <Footer setting-type="sentence" @skipStep="skipStep" />
    </template>
  </PracticeLayout>
  <Statistics v-model="isComplete" :loading="settling" />
  <ConflictNotice v-if="showConflictNotice" />
  <CollectNotice v-model="showCollectNotice" />
  <ConflictNotice2 v-model="showConflictNotice2" />
</template>

<style scoped lang="scss">
.practice-wrapper {
  @apply w-full h-full flex justify-center overflow-hidden;
}

.practice-word {
  @apply h-full flex flex-col justify-between items-center relative;
  width: var(--toolbar-width);
}

// 移动端适配
@media (max-width: 768px) {
  .practice-word {
    width: 100%;

    .absolute.z-1.top-4 {
      z-index: 100;

      .center.gap-2.cursor-pointer {
        min-height: 44px;
        min-width: 44px;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;

        .word {
          pointer-events: none;
        }

        .arrow {
          pointer-events: none;
        }
      }
    }
  }
}

.word-panel-wrapper {
  position: absolute;
  left: var(--panel-margin-left);
  top: 0.8rem;
  z-index: 1;
  height: calc(100% - 1.5rem);
}
</style>
