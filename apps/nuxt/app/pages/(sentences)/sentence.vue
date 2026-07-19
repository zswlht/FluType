<script setup lang="ts">
import {
  BackIcon,
  BaseButton,
  BaseIcon,
  BaseInput,
  BasePage,
  DeleteIcon,
  Form,
  FormItem,
  PopConfirm,
  Textarea,
  Toast,
} from '@typewords/base'
import { detail } from '@typewords/core/apis'
import { copyOfficialDict } from '@typewords/core/apis/dict.ts'
import EditBook from '@typewords/core/components/article/EditBook.vue'
import BaseTable from '@typewords/core/components/BaseTable.vue'
import WordItem from '@typewords/core/components/word/WordItem.vue'
import { flushStatToSentenceStore, usePracticeSentencePersistence } from '@typewords/core/composables/usePracticePersistence'
import { AppEnv, DICT_LIST, LIB_JS_URL, TourConfig } from '@typewords/core/config/env.ts'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { Sort } from '@typewords/core/types/enum.ts'
import { getDefaultDict, getDefaultWord } from '@typewords/core/types/func.ts'
import type { Dict, Word } from '@typewords/core/types/types.ts'
import {
  _getDictDataByUrl,
  _nextTick,
  convertToWord,
  ensureCustomDictCopy,
  isMobile,
  loadJsLib,
  resourceWrap,
  reverse,
  shuffle,
  useNav,
} from '@typewords/core/utils'
import { getPracticeSentenceCacheLocal } from '@typewords/core/utils/cache.ts'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DictType } from '@typewords/core/types/enum.ts'
import { APP_NAME } from '@typewords/core/config/env.ts'

useHead({
  title: APP_NAME + ' 句子集',
})

const runtimeStore = useRuntimeStore()
const sentencePersistence = usePracticeSentencePersistence()
const base = useBaseStore()
const router = useRouter()
const route = useRoute()
const isMob = isMobile()
let loading = $ref(false)
let allList = $ref([])

const getDefaultFormWord = () => {
  return {
    id: '',
    word: '',
    phonetic0: '',
    phonetic1: '',
    note: '',
    trans: '',
  }
}
let isOperate = $ref(false)
let wordForm = $ref(getDefaultFormWord())
let wordFormRef = $ref()
const wordRules = reactive({
  word: [
    { required: true, message: '请输入句子', trigger: 'blur' },
    { max: 500, message: '句子不能超过500个字符', trigger: 'blur' },
  ],
})
let studyLoading = $ref(false)
let officialWordSnapshot = $ref<Word | null>(null)

function resetWordForm() {
  wordForm = getDefaultFormWord()
  officialWordSnapshot = null
}

function word2Str(word: Word) {
  let res = getDefaultFormWord()
  res.id = word.id
  res.word = word.word
  res.phonetic1 = word.phonetic1
  res.phonetic0 = word.phonetic0
  res.note = base.noteData[word.word] ?? ''
  res.trans = word.trans.map(v => (v.pos + v.cn).replaceAll('"', '')).join('\n')
  return res
}

function editWord(word) {
  isOperate = true
  wordForm = word2Str(word)
  officialWordSnapshot = word.custom ? null : convertToWord({ ...wordForm, id: word.id })
  if (isMob) activeTab = 'edit'
}

function addWord() {
  isOperate = true
  resetWordForm()
  if (isMob) activeTab = 'edit'
}

function closeWordForm() {
  isOperate = false
  resetWordForm()
  if (isMob) activeTab = 'list'
}

let isEdit = $ref(false)
let isAdd = $ref(false)
let activeTab = $ref<'list' | 'edit'>('list')
let _copyData: Dict | null = null

const showBookDetail = computed(() => {
  return !(isAdd || isEdit)
})

function createCopy() {
  const copy = ensureCustomDictCopy(runtimeStore.editDict)
  copy.name = runtimeStore.editDict.name + ' (副本)'
  _copyData = copy
  isAdd = true
}

function syncDictInMyStudyList(study = false) {
  _nextTick(() => {
    const originalId = runtimeStore.editDict.id

    runtimeStore.editDict.sentences = allList
    let temp = ensureCustomDictCopy(runtimeStore.editDict)
    let rIndex = base.sentence.bookList.findIndex(v => v.id === originalId)
    temp.length = temp.sentences.length
    runtimeStore.editDict = temp
    if (rIndex > -1) {
      base.sentence.bookList[rIndex] = getDefaultDict(temp)
      if (study) base.sentence.studyIndex = rIndex
    } else {
      base.sentence.bookList.push(getDefaultDict(temp))
      if (study) base.sentence.studyIndex = base.sentence.bookList.length - 1
    }
    tableRef.value.getData()
  }, 100)
}

async function onSubmitWord() {
  await wordFormRef.validate(valid => {
    if (valid) {
      let data: any = convertToWord(wordForm)
      data.custom = !officialWordSnapshot || data.word !== officialWordSnapshot.word
      const noteVal = wordForm.note?.trim()
      const wordKey = wordForm.word
      if (noteVal) {
        base.noteData[wordKey] = noteVal
      } else {
        delete base.noteData[wordKey]
      }
      if (data.id) {
        let r = allList.find(v => v.id === data.id)
        if (r) {
          Object.assign(r, data)
          Toast.success('修改成功')
        } else {
          Toast.success('修改失败，未找到句子')
          return
        }
      } else {
        data.id = allList.length + 1
        data.checked = false
        let r = allList.find(v => v.word === wordForm.word)
        if (r) {
          Toast.warning('已有相同句子！')
          return
        } else allList.push(data)
        Toast.success('添加成功')
        resetWordForm()
      }
      syncDictInMyStudyList()
    } else {
      Toast.warning('请填写完整')
    }
  })
}

async function batchDel(ids: string[]) {
  let localHandle = () => {
    ids.map(id => {
      let rIndex2 = allList.findIndex(v => v.id === id)
      if (rIndex2 > -1) {
        if (id === wordForm.id) {
          resetWordForm()
        }
        allList.splice(rIndex2, 1)
      }
    })
    tableRef.value.getData()
    syncDictInMyStudyList()
  }

  if (AppEnv.CAN_REQUEST) {
    if (dict.custom) {
      if (dict.sync) {
        // 句子集删除暂未支持后端接口，仅本地删除
        localHandle()
      } else {
        localHandle()
      }
    } else {
      let r = await copyOfficialDict(null, { id: dict.id })
      if (r.success) {
        localHandle()
      } else {
        return Toast.error(r.msg)
      }
    }
  } else {
    localHandle()
  }
}

onMounted(async () => {
  if (route.query?.isAdd) {
    isAdd = true
    runtimeStore.editDict = getDefaultDict()
    runtimeStore.editDict.type = DictType.sentence
  } else {
    if (!runtimeStore.editDict.id) {
      return router.push('/sentences')
    } else {
      if (
        !runtimeStore.editDict.sentences.length &&
        !runtimeStore.editDict.custom &&
        !runtimeStore.editDict.system
      ) {
        loading = true
        let dictList = await fetch(resourceWrap(DICT_LIST.SENTENCE.ALL)).then(r => r.json())
        let dict = await _getDictDataByUrl(runtimeStore.editDict, DictType.sentence)
        let r = dictList.find(v => [v.enName, v.id].includes(runtimeStore.editDict.id))
        if (r) {
          runtimeStore.editDict.sentences = dict.sentences
          runtimeStore.editDict.id = r.id
          runtimeStore.editDict.enName = r.enName
          runtimeStore.editDict.cover = r.cover
          runtimeStore.editDict.category = r.category
          runtimeStore.editDict.tags = r.tags
          runtimeStore.editDict.url = r.url
          runtimeStore.editDict.description = r.description
          runtimeStore.editDict.name = r.name
        } else {
          runtimeStore.editDict = dict
        }
        runtimeStore.editDict.length = dict.sentences.length
      }
      if (base.sentence.bookList.find(book => book.id === runtimeStore.editDict.id)) {
        if (AppEnv.CAN_REQUEST) {
          getDetail(runtimeStore.editDict.id)
        }
      }
      loading = false
    }
  }

  allList = runtimeStore.editDict.sentences
  tableRef.value.getData()
})

async function getDetail(id) {
  let res = await detail({ id })
  if (res.success) {
    runtimeStore.editDict = res.data
  }
}

function formClose() {
  if (isEdit) {
    isEdit = false
  } else if (isAdd) {
    _copyData = null
    isAdd = false
  } else {
    router.back()
  }
}

function handleSubmit() {
  _copyData = null
  isEdit = false
  isAdd = false
}

const store = useBaseStore()
const settingStore = useSettingStore()
const { nav } = useNav()

async function startPractice(query = {}) {
  // 切换句子集前，先将进行中的练习统计落库，避免学习记录丢失
  const cache = await getPracticeSentenceCacheLocal()
  if (cache) {
    flushStatToSentenceStore((cache as any)?.statStoreData)
    await sentencePersistence.clear()
  }
  await base.changeSentenceDict(runtimeStore.editDict)
  window.umami?.track('startStudySentence', {
    name: store.ssentence.name,
    index: store.ssentence.lastLearnIndex,
    perDayStudyNumber: store.ssentence.perDayStudyNumber,
    custom: store.ssentence.custom,
    complete: store.ssentence.complete,
  })
  let perDay = store.ssentence.perDayStudyNumber
  let start = store.ssentence.lastLearnIndex
  let currentStudy = {
    new: store.ssentence.sentences.slice(start, start + perDay),
    review: [],
  }
  nav('practice-sentences/' + store.ssentence.id, query, { taskWords: currentStudy })
}

async function addMyStudyList() {
  if (!runtimeStore.editDict.sentences.length) {
    return Toast.warning('没有句子可学习！')
  }
  await startPractice()
}

let tableRef = ref()

const dict = $computed(() => runtimeStore.editDict)

function getLocalList({ pageNo, pageSize, searchKey }) {
  let list = allList
  let total = allList.length
  if (searchKey.trim()) {
    list = allList.filter(v => v.word.toLowerCase().includes(searchKey.trim().toLowerCase()))
    total = list.length
  }
  list = list.slice((pageNo - 1) * pageSize, (pageNo - 1) * pageSize + pageSize)
  return { list, total }
}

async function requestList({ pageNo, pageSize, searchKey }) {
  if (!dict.custom && !dict.system) {
    if (!allList.length) {
      let r = await _getDictDataByUrl(dict, DictType.sentence)
      allList = r.sentences
    }
    return getLocalList({ pageNo, pageSize, searchKey })
  } else {
    if (AppEnv.CAN_REQUEST) {
      if (dict.sync || true) {
        let res = await detail({ id: dict.id, pageNo, pageSize })
        if (res.success) {
          return { list: res.data.sentences, total: res.data.length }
        }
        return { list: [], total: 0 }
      }
    } else {
      allList = dict.sentences
    }
    return getLocalList({ pageNo, pageSize, searchKey })
  }
}

function onSort(type: Sort, pageNo: number, pageSize: number) {
  if (AppEnv.CAN_REQUEST) {
  } else {
    let fun = reverse
    if ([Sort.reverse, Sort.reverseAll].includes(type)) {
      fun = reverse
    } else if ([Sort.random, Sort.randomAll].includes(type)) {
      fun = shuffle
    }
    allList = allList
      .slice(0, pageSize * (pageNo - 1))
      .concat(fun(allList.slice(pageSize * (pageNo - 1), pageSize * (pageNo - 1) + pageSize)))
      .concat(allList.slice(pageSize * (pageNo - 1) + pageSize))
    runtimeStore.editDict.sentences = allList
    Toast.success('操作成功')
    tableRef.value.getData()
    syncDictInMyStudyList()
  }
}

const editable = $computed(() => runtimeStore.editDict.custom || runtimeStore.editDict.system)

watch(
  () => loading,
  val => {
    if (!val) return
    _nextTick(async () => {
      const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
      const tour = new Shepherd.Tour(TourConfig)
      tour.on('cancel', () => {
        localStorage.setItem('tour-guide', '1')
      })
      tour.addStep({
        id: 'step3',
        text: '点击这里开始学习句子',
        attachTo: { element: '#study', on: 'bottom' },
        buttons: [
          {
            text: `下一步（3/${TourConfig.total}）`,
            action() {
              tour.next()
              addMyStudyList()
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
)
</script>

<template>
  <BasePage>
    <template v-if="showBookDetail">
      <div class="card mb-0 dict-detail-card flex flex-col">
        <div class="dict-header flex justify-between items-center relative">
          <BackIcon class="dict-back z-2" />
          <div class="dict-title absolute page-title text-align-center w-full">{{ runtimeStore.editDict.name }}</div>
          <div class="dict-actions flex">
            <BaseButton v-if="runtimeStore.editDict.custom" loading={studyLoading || loading} type="info" @click="isEdit = true">
              {{ '编辑' }}
            </BaseButton>
            <BaseButton v-else :loading="studyLoading || loading" type="info" @click="createCopy">
              {{ '创建副本' }}
            </BaseButton>
            <BaseButton id="study" :loading="studyLoading || loading" @click="addMyStudyList">
              {{ '学习' }}
            </BaseButton>
          </div>
        </div>
        <div v-if="dict.description" class="text-lg mt-2">
          {{ '简介' }}：{{ dict.description }}
        </div>
        <div v-if="dict.description" class="line my-3"></div>

        <div v-if="isMob && isOperate" class="tab-navigation mb-3">
          <div class="tab-item" :class="{ active: activeTab === 'list' }" @click="activeTab = 'list'">
            {{ '句子列表' }}
          </div>
          <div class="tab-item" :class="{ active: activeTab === 'edit' }" @click="activeTab = 'edit'">
            {{ wordForm.id ? '编辑' : '添加' }}{{ '句子' }}
          </div>
        </div>

        <div class="flex flex-1 overflow-hidden content-area">
          <div class="word-list-section" :class="{ 'mobile-hidden': isMob && isOperate && activeTab !== 'list' }">
            <BaseTable
              ref="tableRef"
              class="h-full"
              :request="requestList"
              @del="batchDel"
              @sort="onSort"
              @add="addWord"
              :readonly="!editable"
              :readonly-tip="'请创建副本后编辑'"
            >
              <template #default="val">
                <WordItem
                  showTransPop
                  :onClick="() => editable && editWord(val.item)"
                  :index="val.index"
                  :showCollectIcon="false"
                  :showMarkIcon="false"
                  :excludeDictId="runtimeStore.editDict.id"
                  :item="val.item"
                >
                  <template #prefix>
                    <component :is="val.checkbox(val.item)" />
                  </template>
                  <template #suffix>
                    <div class="flex flex-col">
                      <BaseIcon
                        class="option-icon"
                        :disabled="!editable"
                        :title="runtimeStore.editDict.custom ? '编辑' : '请创建副本后编辑'"
                        @click="() => runtimeStore.editDict.custom && editWord(val.item)"
                      >
                        <IconFluentTextEditStyle20Regular />
                      </BaseIcon>
                      <PopConfirm v-if="editable" title="确认删除？" @confirm="() => batchDel([val.item.id])">
                        <BaseIcon class="option-icon" :title="'删除'">
                          <DeleteIcon />
                        </BaseIcon>
                      </PopConfirm>
                      <BaseIcon v-else class="option-icon" :disabled="true" :title="'请创建副本后编辑'">
                        <DeleteIcon />
                      </BaseIcon>
                    </div>
                  </template>
                </WordItem>
              </template>
            </BaseTable>
          </div>
          <div v-if="isOperate" class="edit-section flex-1 flex flex-col" :class="{ 'mobile-hidden': isMob && activeTab !== 'edit' }">
            <div class="common-title">
              {{ wordForm.id ? '编辑' : '添加' }}{{ '句子' }}
            </div>
            <Form
              class="flex-1 overflow-auto pr-2"
              ref="e => (wordFormRef = e)"
              :rules="wordRules"
              :model="wordForm"
              label-width="7rem"
            >
              <FormItem label="句子" prop="word">
                <BaseInput
                  :modelValue="wordForm.word"
                  @update:modelValue="e => (wordForm.word = e)"
                  clearable
                />
              </FormItem>
              <FormItem label="翻译">
                <Textarea
                  :modelValue="wordForm.trans"
                  @update:modelValue="e => (wordForm.trans = e)"
                  placeholder="一行一个翻译，前面词性，后面内容（如n.取消）；多个翻译请换行"
                  :autosize="{ minRows: 6, maxRows: 10 }"
                />
              </FormItem>
              <FormItem label="笔记">
                <Textarea
                  :modelValue="wordForm.note"
                  @update:modelValue="e => (wordForm.note = e)"
                  placeholder="记录这个句子的个人笔记"
                  :autosize="{ minRows: 3, maxRows: 8 }"
                />
              </FormItem>
            </Form>
            <div class="center">
              <BaseButton type="info" @click="closeWordForm">{{ '关闭' }}</BaseButton>
              <BaseButton type="primary" @click="onSubmitWord">{{ '保存' }}</BaseButton>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="card mb-0 dict-detail-card">
        <div class="dict-header flex justify-between items-center relative">
          <BackIcon class="dict-back z-2" @click="formClose" />
          <div class="dict-title absolute page-title text-align-center w-full">
            {{ isAdd ? '创建句子集' : '编辑句子集' }}
          </div>
        </div>
        <div class="center">
          <EditBook
            :isAdd="isAdd"
            :isBook="false"
            :initialData="_copyData"
            @close="formClose"
            @submit="handleSubmit"
          />
        </div>
      </div>
    </template>
  </BasePage>
</template>

<style scoped lang="scss">
.dict-detail-card {
  height: calc(100vh - 3rem);
}

.dict-header {
  gap: 0.5rem;
}

.dict-actions {
  flex-wrap: wrap;
}

.word-list-section {
  width: 44%;
}

.edit-section {
  margin-left: 1rem;
}

.tab-navigation {
  display: none;
}

.mobile-hidden {
  display: none;
}

// 移动端适配
@media (max-width: 768px) {
  .dict-detail-card {
    height: unset;
    min-height: calc(100vh - 2rem);
    margin-bottom: 0 !important;
  }

  .dict-header {
    width: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.75rem;
  }

  .dict-header .dict-back {
    align-self: flex-start;
  }

  .dict-header .dict-title {
    position: static !important;
    width: 100%;
  }

  .dict-header .dict-actions {
    width: 100%;
    justify-content: center;
    gap: 0.75rem;
  }

  .tab-navigation {
    display: flex;
    border-bottom: 2px solid var(--color-item-border);
    margin-bottom: 1rem;
    gap: 0;

    .tab-item {
      flex: 1;
      padding: 0.75rem 1rem;
      text-align: center;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--color-sub-text);
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.3s ease;
      user-select: none;

      &:active {
        transform: scale(0.98);
      }

      &.active {
        color: var(--color-icon-hightlight);
        border-bottom-color: var(--color-icon-hightlight);
      }
    }
  }

  .content-area {
    flex-direction: column;

    .word-list-section,
    .edit-section {
      width: 100% !important;
      margin-left: 0 !important;
      max-width: 100%;
    }

    .edit-section {
      margin-top: 0;
    }
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .dict-detail-card {
    height: unset;
    min-height: calc(100vh - 1rem);
  }

  .tab-navigation {
    .tab-item {
      padding: 0.6rem 0.5rem;
      font-size: 0.9rem;
    }
  }
}
</style>
