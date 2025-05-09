export default async function convertWebMToWav(webmBlob: Blob) {
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
