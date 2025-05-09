'use client'

import React from 'react'

import { AudioPlayer } from 'react-audio-play'

export default function SpeechAudio(props: { src: string }) {
  return (
    <AudioPlayer
      src={props.src}
      color='#A379FF'
      autoPlay
      sliderColor='#8C57FF'
      style={{ borderRadius: '15px', width: '100%' }}
    />
  )
}
