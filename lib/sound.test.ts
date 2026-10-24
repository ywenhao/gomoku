import { expect, test } from "nsh/test";
import {
  SOUND_NAMES,
  SOUND_RATE,
  SOUND_SECONDS,
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

test("每个音效都是可播放的单声道 16-bit WAV", () => {
  expect(SOUND_NAMES.length).toBe(6);
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
