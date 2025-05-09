// @ts-nocheck
'use client'
import React, { useState, useRef, useEffect } from 'react'

import { Box, Button, CircularProgress, Stack, TextField, Typography, useTheme } from '@mui/material'

import convertWebMToWav from '../../utils/convertWebMToWav'
import SelectLang from '@/components/speech/languages'
import SpeechAudio from '@/components/speech/SpeechAudio'

export default function Speech() {
  const theme = useTheme()
  const [recording, setRecording] = useState(false)
  const [translatedAudioUrl, setTranslatedAudioUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [sourceLang, setSourceLang] = useState('uzn')
  const [selectedLang, setSelectedLang] = useState('eng')

  const mediaRecorderRef = useRef<MediaRecorder>()
  const audioChunks = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode>()
  const animationFrameRef = useRef<number>()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [text, setText] = useState('')
  const [tranlatedText, setTranslatedText] = useState('')

  const startRecording = async () => {
    try {
      setRecording(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)

      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunks.current = []

      mediaRecorderRef.current.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.current.push(e.data)
      }

      mediaRecorderRef.current.start()
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

      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      audioContextRef.current?.close()
    }
  }

  const handleSendAudio = async () => {
    const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' })

    try {
      setLoading(true)
      const wavBlob = await convertWebMToWav(audioBlob)
      const formData = new FormData()

      formData.append('file', wavBlob, 'recording.wav')
      formData.append('target_lang', selectedLang)
      formData.append('source_lang', sourceLang)

      const textResponse = await fetch('https://api.enix.uz/process-text/', {
        method: 'POST',
        body: formData
      })

      if (!textResponse.ok) throw new Error('Ошибка при отправке аудио')

      const textResult = await textResponse.json()

      setTranslatedText(textResult.translated_text)

      const response = await fetch('https://api.enix.uz/process-audio/', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Ошибка при отправке аудио')

      const resultBlob = await response.blob()
      const audioUrlResponse = URL.createObjectURL(resultBlob)

      setTranslatedAudioUrl(audioUrlResponse)
    } catch (error) {
      console.error('Ошибка отправки аудио:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendText = async () => {
    if (!text) {
      return
    }

    try {
      setLoading(true)

      const textResponse = await fetch('https://api.enix.uz/generate-text/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          target_lang: selectedLang,
          source_lang: sourceLang
        })
      })

      if (!textResponse.ok) throw new Error('Ошибка при отправке текста')
      const textResult = await textResponse.json()

      setTranslatedText(textResult.translated_text)

      const response = await fetch('https://api.enix.uz/generate-audio/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          target_lang: selectedLang,
          source_lang: sourceLang
        })
      })

      if (!response.ok) throw new Error('Ошибка при отправке аудио')

      const resultBlob = await response.blob()
      const audioUrlResponse = URL.createObjectURL(resultBlob)

      setTranslatedAudioUrl(audioUrlResponse)
    } catch (error) {
      console.error('Ошибка отправки аудио:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) return

    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const renderRecordButton = () => (
    <Button
      variant='contained'
      color={recording ? 'secondary' : 'primary'}
      size='large'
      onClick={recording ? stopRecording : startRecording}
      sx={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        boxShadow: theme.shadows[3],
        fontSize: 28
      }}
    >
      <i className={recording ? 'ri-stop-circle-line' : 'ri-mic-ai-line'} />
    </Button>
  )

  return (
    <Box p={3} maxWidth={600} margin='0 auto'>
      <Stack spacing={4} alignItems='center'>
        <Typography variant='h5' color='text.secondary'>
          {tranlatedText ? (
            <span>
              Переведенный текст: <strong>{tranlatedText}</strong>
            </span>
          ) : (
            'Нажмите на кнопку записи, чтобы начать запись речи. После завершения записи вы можете прослушать переведенный аудиофайл.'
          )}
        </Typography>
        {loading && <CircularProgress color='secondary' />}
        {translatedAudioUrl && <SpeechAudio src={translatedAudioUrl} />}
        {renderRecordButton()}
        <Typography variant='body2' color='text.secondary'>
          Выберите язык, на котором вы хотите говорить:
        </Typography>
        <SelectLang setSelectedLang={setSourceLang} selectedLang={sourceLang} />
        <Typography variant='body2' color='text.secondary'>
          Выберите язык, на который вы хотите переводить:
        </Typography>
        <SelectLang setSelectedLang={setSelectedLang} selectedLang={selectedLang} />
        <Stack direction='row' spacing={2} alignItems='center' sx={{ width: '100%', height: 56 }}>
          <TextField
            label='Введите текст'
            variant='outlined'
            fullWidth
            sx={{ flexGrow: 1 }}
            onChange={e => setText(e.target.value)}
          />
          <Button
            variant='contained'
            color={recording ? 'secondary' : 'primary'}
            size='small'
            onClick={handleSendText}
            disableElevation
            sx={{
              minWidth: 54,
              minHeight: 54,
              padding: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 24
            }}
          >
            <i className='ri-send-plane-2-fill' />
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
