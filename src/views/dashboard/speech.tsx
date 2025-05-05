'use client'
import React, { useState, useRef, useEffect } from 'react'

import { Box, Button, MenuItem, Select, Typography, CircularProgress, Stack, styled } from '@mui/material'

// 🌟 Анимация пульсации с учетом громкости
const RecordingIndicator = styled('div')<{ volume: number }>(({ theme, volume }) => ({
  width: 100,
  height: 100,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transform: `scale(${1 + volume * 0.5})`, // Увеличиваем масштаб в зависимости от громкости
  opacity: 0.8 + volume * 0.2, // Изменяем прозрачность в зависимости от громкости
  transition: 'transform 0.1s ease, opacity 0.1s ease' // Плавная анимация
}))

const languages = [
  { code: 'en', label: 'Английский' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Испанский' }
]

export default function Speech() {
  const [recording, setRecording] = useState(false)
  const [translatedText, setTranslatedText] = useState('')
  const [translatedAudioUrl, setTranslatedAudioUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedLang, setSelectedLang] = useState('en')
  const [volume, setVolume] = useState(0) // Состояние для громкости

  const mediaRecorderRef = useRef<MediaRecorder | undefined>(undefined)
  const audioChunks = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode | undefined>(undefined)
  const animationFrameRef = useRef<number | undefined>(undefined)

  const startRecording = async () => {
    try {
      setRecording(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Инициализация Web Audio API для анализа громкости
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)

      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      // Настройка MediaRecorder для записи
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunks.current = []

      mediaRecorderRef.current.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.current.push(e.data)
      }

      mediaRecorderRef.current.start()

      // Запуск анализа громкости
      const updateVolume = () => {
        if (!analyserRef.current) return

        const dataArray = new Uint8Array(analyserRef.current.fftSize)

        analyserRef.current.getByteTimeDomainData(dataArray)
        let sum = 0

        for (let i = 0; i < dataArray.length; i++) {
          const a = dataArray[i] / 128 - 1

          sum += a * a
        }

        const rms = Math.sqrt(sum / dataArray.length)

        setVolume(Math.min(rms * 10, 1)) // Нормализация громкости (0-1)
        animationFrameRef.current = requestAnimationFrame(updateVolume)
      }

      updateVolume()
    } catch (error) {
      console.error('Ошибка при начале записи:', error)
      setRecording(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      mediaRecorderRef.current.onstop = handleSendAudio

      // Остановка анализа громкости
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
      }

      setVolume(0) // Сбрасываем громкость
    }
  }

  async function convertWebMToWav(webmBlob: Blob) {
    const audioContext = new AudioContext({ sampleRate: 44100 })
    const arrayBuffer = await webmBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const numOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const numOfFrames = audioBuffer.length

    const wavBuffer = new ArrayBuffer(44 + numOfFrames * numOfChannels * 2)
    const view = new DataView(wavBuffer)

    function writeString(view: DataView<ArrayBuffer>, offset: number, string: string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    function write32(view: DataView<ArrayBuffer>, offset: number, value: number) {
      view.setUint32(offset, value, true)
    }

    function write16(view: DataView<ArrayBuffer>, offset: number, value: number) {
      view.setUint16(offset, value, true)
    }

    writeString(view, 0, 'RIFF')
    write32(view, 4, 36 + numOfFrames * numOfChannels * 2)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    write32(view, 16, 16)
    write16(view, 20, 1)
    write16(view, 22, numOfChannels)
    write32(view, 24, sampleRate)
    write32(view, 28, sampleRate * numOfChannels * 2)
    write16(view, 32, numOfChannels * 2)
    write16(view, 34, 16)
    writeString(view, 36, 'data')
    write32(view, 40, numOfFrames * numOfChannels * 2)

    let offset = 44

    for (let i = 0; i < numOfFrames; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        let sample = audioBuffer.getChannelData(channel)[i] * 0x7fff

        sample = Math.max(-0x8000, Math.min(0x7fff, sample))
        view.setInt16(offset, sample, true)
        offset += 2
      }
    }

    return new Blob([view], { type: 'audio/wav' })
  }

  const handleSendAudio = async () => {
    const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' })

    try {
      setLoading(true)
      const wavBlob = await convertWebMToWav(audioBlob)
      const formData = new FormData()

      formData.append('file', wavBlob, 'recording.wav')

      const response = await fetch('http://localhost:8000/process-audio/', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Ошибка при отправке аудио')
      }

      const resultBlob = await response.blob()
      const audioUrlResponse = URL.createObjectURL(resultBlob)

      setTranslatedAudioUrl(audioUrlResponse)

      // Предполагается, что сервер возвращает текст отдельно
      const resultText = await response.text() // или JSON, если сервер возвращает JSON

      setTranslatedText(resultText)
    } catch (error) {
      console.error('Ошибка отправки аудио:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      // Очистка при размонтировании компонента
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  return (
    <Box p={2}>
      <Stack spacing={3} alignItems='center'>
        <Select value={selectedLang} onChange={e => setSelectedLang(e.target.value)} fullWidth>
          {languages.map(lang => (
            <MenuItem key={lang.code} value={lang.code}>
              {lang.label}
            </MenuItem>
          ))}
        </Select>

        {/* 🌟 Управление записью */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {!recording ? (
            <Button
              variant='contained'
              color='primary'
              size='large'
              onClick={startRecording}
              sx={{ width: 120, height: 120, borderRadius: '50%' }}
            >
              🎤 Начать
            </Button>
          ) : (
            <>
              <RecordingIndicator volume={volume}>
                <Typography variant='caption' color='white'>
                  Запись
                </Typography>
              </RecordingIndicator>
              <Button
                variant='contained'
                color='secondary'
                size='large'
                onClick={stopRecording}
                sx={{ width: 120, height: 60, borderRadius: 30 }}
              >
                Стоп
              </Button>
            </>
          )}
        </Box>

        <Typography variant='caption' color='text.secondary'>
          {recording ? 'Идёт запись...' : 'Нажми для записи'}
        </Typography>

        {loading && <CircularProgress />}

        {translatedText && (
          <Typography variant='body1'>
            Перевод: <strong>{translatedText}</strong>
          </Typography>
        )}

        {translatedAudioUrl && <audio controls src={translatedAudioUrl} />}
      </Stack>
    </Box>
  )
}
