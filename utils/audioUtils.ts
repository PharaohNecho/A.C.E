import { Blob } from '@google/genai';

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function float32To16BitPCM(float32Arr: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Arr.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Arr.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Arr[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // Little-endian
  }
  return buffer;
}

export function pcmToBlob(data: Float32Array, sampleRate: number): Blob {
  const pcmBuffer = float32To16BitPCM(data);
  return {
    data: arrayBufferToBase64(pcmBuffer),
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const audioBuffer = ctx.createBuffer(numChannels, data.length / 2, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  const dataView = new DataView(data.buffer);
  
  for (let i = 0; i < channelData.length; i++) {
    const int16 = dataView.getInt16(i * 2, true);
    channelData[i] = int16 / 32768.0;
  }
  
  return audioBuffer;
}
