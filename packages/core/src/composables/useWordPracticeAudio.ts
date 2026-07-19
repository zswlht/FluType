import { ref, unref, type ComputedRef, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { Toast } from '@typewords/base'
import type { Word } from '../types'
import { getBrowserKey, registerActiveHumanAudio, usePlayWordAudio, useTTsPlayAudio } from '../hooks/sound'
import { useSettingStore } from '../stores/setting'
import { ENV } from '../config/env'

export enum WordPlayTrigger {
  NewWord = 'newWord',
  RepeatWord = 'repeatWord',
  ResetSameWord = 'resetSameWord',
  RevealUnknown = 'revealUnknown',
  DictationReveal = 'dictationReveal',
  IdentifyWrongKey = 'identifyWrongKey',
  Typo = 'typo',
  DelRetry = 'delRetry',
  Manual = 'manual',
  Shortcut = 'shortcut',
}

const CHAIN_FIRST_SENTENCE_TRIGGERS = new Set([
  WordPlayTrigger.NewWord,
  WordPlayTrigger.RepeatWord,
  WordPlayTrigger.ResetSameWord,
  WordPlayTrigger.RevealUnknown,
  WordPlayTrigger.DictationReveal,
  WordPlayTrigger.IdentifyWrongKey,
])

export interface WordPracticeAudioOptions {
  word: Ref<Word>
  volumeIconRef: Ref<{ animateOnly?: (reset?: boolean) => void } | undefined> | ComputedRef<{ animateOnly?: (reset?: boolean) => void } | undefined>
  canSeeSentences?: () => boolean
}

export function useWordPracticeAudio({ word, volumeIconRef, canSeeSentences }: WordPracticeAudioOptions) {
  const settingStore = useSettingStore()
  const router = useRouter()
  const playWordAudio = usePlayWordAudio()
  const ttsPlayAudio = useTTsPlayAudio()

  const highlightedSentenceIndex = ref(-1)
  let ttsVoiceHintShown = false

  //句子练习专用：用于播放来源于文章的真人录音
  let humanAudio: HTMLAudioElement | null = null
  let humanAudioTimer: ReturnType<typeof setTimeout> | null = null

  function ensureHumanAudio() {
    if (!humanAudio && typeof Audio !== 'undefined') {
      humanAudio = new Audio()
    }
    return humanAudio
  }

  //判断当前 word 是否有可用的真人录音（来源于文章的句子）
  function hasHumanAudio(w: Word): boolean {
    return !!(w.audioSrc && w.audioPosition?.length && w.audioPosition[1] > 0)
  }

  //播放真人录音片段，返回 true 表示已处理
  function playHumanAudio(w: Word, onEnd?: () => void): boolean {
    if (!hasHumanAudio(w)) return false
    const audio = ensureHumanAudio()
    if (!audio) return false
    if (humanAudioTimer) {
      clearTimeout(humanAudioTimer)
      humanAudioTimer = null
    }
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel()
    }
    audio.pause()
    audio.onended = null
    audio.onerror = null
    const fullSrc = ENV.RESOURCE_URL + w.audioSrc
    const start = w.audioPosition![0] ?? 0
    const end = w.audioPosition![1] ?? -1
    audio.volume = settingStore.wordSoundVolume / 100
    audio.playbackRate = settingStore.wordSoundSpeed
    const chainWord = w.word
    const finish = () => {
      if (word.value.word !== chainWord) return
      onEnd?.()
    }
    audio.onended = finish
    audio.onerror = finish

    const seekAndPlay = () => {
      try {
        audio.currentTime = start
      } catch (e) {
        //音频未加载时设置 currentTime 可能抛错，忽略
      }
      audio.play().catch(() => finish())
      if (end && end !== -1) {
        humanAudioTimer = setTimeout(
          () => {
            audio.pause()
            finish()
          },
          ((end - start) / (audio.playbackRate || 1)) * 1000
        )
      }
    }

    //如果 src 变了，需要等 loadedmetadata 才能 seek
    if (audio.src !== fullSrc) {
      audio.onloadedmetadata = () => {
        audio.onloadedmetadata = null
        seekAndPlay()
      }
      audio.src = fullSrc
      //触发加载（部分浏览器需要 load() 才会重新加载）
      try {
        audio.load()
      } catch (e) {}
    } else {
      seekAndPlay()
    }
    //注册到全局，cancelWordPracticeAudio 会统一停止
    registerActiveHumanAudio(audio, humanAudioTimer)
    return true
  }

  function shouldChainFirstSentence(trigger: WordPlayTrigger) {
    return (
      settingStore.autoPlayFirstSentence &&
      CHAIN_FIRST_SENTENCE_TRIGGERS.has(trigger) &&
      canSeeSentences?.() !== false &&
      !!word.value.sentences?.[0]?.c
    )
  }

  function playTtsWithGuide(text: string, onEnd?: () => void) {
    if (!ttsVoiceHintShown) {
      const browserKey = getBrowserKey()
      const hasVoice = settingStore.ttsVoiceMap?.some(v => v.key === browserKey && v.voice)
      if (!hasVoice) {
        ttsVoiceHintShown = true
        const ins = Toast.warning(
          '例句默认使用浏览器内置 TTS 发音，若无声请前往「设置 → 音效设置 → TTS 声色」选择可用声色',
          {
            duration: 15000000,
            action: {
              text: '设置',
              onClick: () => {
                router.push('/setting?index=4')
                ins.close()
              },
            },
          }
        )
      }
    }
    ttsPlayAudio(text, {
      onEnd,
      volume: settingStore.sentenceSoundVolume / 100,
      rate: settingStore.sentenceSoundSpeed,
    })
  }

  function playSentence(index: number, options?: { highlight?: boolean }) {
    const text = word.value.sentences?.[index]?.c
    if (!text) return

    const highlight = options?.highlight ?? false
    if (highlight) highlightedSentenceIndex.value = index

    playTtsWithGuide(text, () => {
      if (highlight && highlightedSentenceIndex.value === index) {
        highlightedSentenceIndex.value = -1
      }
    })
  }

  function playWord(
    trigger: WordPlayTrigger,
    options?: { resetIcon?: boolean; volumeRef?: { animateOnly?: (reset?: boolean) => void } }
  ) {
    // if (!settingStore.wordSound) return

    const handle =
      trigger === WordPlayTrigger.RepeatWord ||
      trigger === WordPlayTrigger.Manual ||
      trigger === WordPlayTrigger.Shortcut
    const chain = shouldChainFirstSentence(trigger)
    const chainWord = chain ? word.value.word : undefined
    const onEnd = chainWord
      ? () => {
        // 如果单词变化了，则不播放例句，防止快速切换单词时播放例句不正确
          if (word.value.word !== chainWord) return
          playSentence(0, { highlight: true })
        }
      : undefined

    //优先使用来源于文章的真人录音（句子练习）
    const w = word.value
    if (hasHumanAudio(w)) {
      if (playHumanAudio(w, onEnd)) {
        const iconRef = options?.volumeRef ?? unref(volumeIconRef)
        iconRef?.animateOnly?.(options?.resetIcon ?? false)
        return
      }
    }

    playWordAudio(w.word, handle, onEnd)

    const iconRef = options?.volumeRef ?? unref(volumeIconRef)
    iconRef?.animateOnly?.(options?.resetIcon ?? false)
  }

  return {
    highlightedSentenceIndex,
    playWord,
    playSentence,
    playTtsWithGuide,
    playHumanAudio,
    hasHumanAudio,
    WordPlayTrigger,
  }
}
