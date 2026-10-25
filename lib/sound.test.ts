import { expect, test } from "nsh/test";
import {
  SOUND_NAMES,
  SOUND_RATE,
  SOUND_SECONDS,
  soundFileUri,
  synthesizeSound,
} from "./sound";

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let text = "";
  for (let i = 0; i < length; i++) text += String.fromCharCode(bytes[start + i]);
  return text;
}

function peakOf(wav: Uint8Array): number {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let peak = 0;
  for (let i = 44; i < wav.length; i += 2) {
    const v = Math.abs(view.getInt16(i, true));
    if (v > peak) peak = v;
  }
  return peak;
}

function pcmSamples(wav: Uint8Array): Float64Array {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const count = view.getUint32(40, true) / 2;
  const samples = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = view.getInt16(44 + i * 2, true) / 32768;
  }
  return samples;
}

function windowRms(
  samples: Float64Array,
  start: number,
  length: number,
): number {
  let energy = 0;
  for (let i = 0; i < length; i++) energy += samples[start + i] ** 2;
  return Math.sqrt(energy / length);
}

/** 用归一化自相关估计指定时刻的基频，避免声调回归问题漏测。 */
function pitchAt(samples: Float64Array, seconds: number): number {
  const size = Math.round(SOUND_RATE * 0.04);
  const center = Math.round(seconds * SOUND_RATE);
  const start = Math.max(
    0,
    Math.min(samples.length - size, center - Math.floor(size / 2)),
  );
  let mean = 0;
  for (let i = 0; i < size; i++) mean += samples[start + i];
  mean /= size;

  const frame = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const hamming = 0.54 - 0.46 * Math.cos((Math.PI * 2 * i) / (size - 1));
    frame[i] = (samples[start + i] - mean) * hamming;
  }

  let bestLag = 0;
  let bestCorrelation = -Infinity;
  for (let lag = Math.floor(SOUND_RATE / 400); lag <= SOUND_RATE / 100; lag++) {
    let dot = 0;
    let left = 0;
    let right = 0;
    for (let i = 0; i < size - lag; i++) {
      dot += frame[i] * frame[i + lag];
      left += frame[i] ** 2;
      right += frame[i + lag] ** 2;
    }
    const correlation = dot / Math.sqrt(left * right + 1e-12);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }
  return SOUND_RATE / bestLag;
}

test("每个音效都是可播放的单声道 16-bit WAV", () => {
  expect(SOUND_NAMES.length).toBe(11);
  for (const name of SOUND_NAMES) {
    const wav = synthesizeSound(name);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(ascii(wav, 0, 4)).toBe("RIFF");
    expect(ascii(wav, 8, 4)).toBe("WAVE");
    expect(ascii(wav, 12, 4)).toBe("fmt ");
    expect(ascii(wav, 36, 4)).toBe("data");
    expect(view.getUint32(4, true)).toBe(wav.length - 8);
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // 单声道
    expect(view.getUint32(24, true)).toBe(SOUND_RATE);
    expect(view.getUint32(28, true)).toBe(SOUND_RATE * 2);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);

    const data = view.getUint32(40, true);
    expect(data).toBe(wav.length - 44);
    expect(data / 2).toBe(Math.round(SOUND_SECONDS[name] * SOUND_RATE));
    expect(peakOf(wav)).toBeGreaterThan(3000);
  }
});

test("将军语音连续，两个字都保持高平一声", () => {
  const samples = pcmSamples(synthesizeSound("check"));
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));

  const frameSize = Math.round(SOUND_RATE * 0.01);
  const levels: number[] = [];
  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    levels.push(windowRms(samples, start, frameSize));
  }
  let firstVoiced = -1;
  let lastVoiced = -1;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] < peak * 0.02) continue;
    if (firstVoiced < 0) firstVoiced = i;
    lastVoiced = i;
  }
  expect(firstVoiced).toBeGreaterThan(0);
  expect(lastVoiced).toBeLessThan(levels.length - 1);
  for (let i = firstVoiced + 1; i < lastVoiced; i++) {
    expect(levels[i]).toBeGreaterThan(peak * 0.01);
  }

  const firstTone = pitchAt(samples, 0.13);
  const secondTone = pitchAt(samples, 0.5);
  expect(firstTone).toBeGreaterThan(180);
  expect(firstTone).toBeLessThan(220);
  expect(secondTone).toBeGreaterThan(180);
  expect(secondTone).toBeLessThan(220);
  expect(Math.abs(firstTone - secondTone)).toBeLessThan(12);
});

test("音效合成可复现，并且做了峰值归一化", () => {
  const first = synthesizeSound("win");
  const second = synthesizeSound("win");
  expect(first.length).toBe(second.length);

  let same = true;
  for (let i = 0; i < first.length; i++) {
    if (first[i] !== second[i]) same = false;
  }
  expect(same).toBe(true);

  // 目标峰值 0.8，量化后应接近 26214，但不能削波
  expect(peakOf(first)).toBeGreaterThan(24000);
  expect(peakOf(first)).toBeLessThanOrEqual(32767);
});

test("移动端音效文件地址使用 NSH 允许的单斜杠 file URI", () => {
  expect(soundFileUri("/home/a b/棋.wav")).toBe(
    "file:/home/a%20b/%E6%A3%8B.wav",
  );
  expect(soundFileUri("C:\\a b\\x.wav")).toBe("file:/C:/a%20b/x.wav");
  expect(soundFileUri("file:///home/a%20b/x.wav")).toBe(
    "file:/home/a%2520b/x.wav",
  );
});
