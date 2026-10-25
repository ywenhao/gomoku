/**
 * 游戏音效：启动时用代码合成 WAV，不往仓库里放音频文件，也不加依赖。
 *
 * - 原生：写到应用数据目录，再交给隐藏的 <Video> 播放。桌面端使用裸路径；
 *   Android / iOS 使用百分号编码的单斜杠 file:/ URI，既满足 MediaPlayer
 *   对 scheme 的要求，也不会被 NSH 的媒体访问控制当成网络 URL 拒绝。
 * - Web：直接生成 data URI（浏览器不需要落地文件）。
 *
 * 采样统一为 22.05 kHz / 单声道 / 16-bit PCM —— AVPlayer、MediaPlayer、
 * Media Foundation、GStreamer 和 HTML5 都能直接播。
 */

import { exists, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { CHECK_VOICE } from "./data/check-voice";
import { platform } from "nsh/device";

export const SOUND_RATE = 22050;

export const SOUND_NAMES = [
  "place",
  "select",
  "tick",
  "timeout",
  "win",
  "loss",
  "draw",
  "check",
  "roll",
  "capture",
  "undo",
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

/** 每个音效的时长（秒），SoundPlayer 用它做播放超时兜底。 */
export const SOUND_SECONDS: Record<SoundName, number> = {
  place: 0.14,
  select: 0.12,
  tick: 0.08,
  timeout: 0.62,
  win: 0.78,
  loss: 0.82,
  draw: 0.6,
  check: 0.48086167800453516,
  roll: 0.35,
  capture: 0.24,
  undo: 0.28,
};

/** 每种音效的峰值音量：落子/胜利用力一点，倒计时滴答轻一点。 */
const SOUND_PEAK: Record<SoundName, number> = {
  place: 0.78,
  select: 0.28,
  tick: 0.42,
  timeout: 0.72,
  win: 0.8,
  loss: 0.68,
  draw: 0.6,
  check: 1.6,
  roll: 0.72,
  capture: 0.88,
  undo: 0.58,
};

const TAU = Math.PI * 2;
const FILE_VERSION = 4;

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

/** 确定性的伪噪声：每次启动生成的落子声完全一样，测试也能复现。 */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/** 起音很快、指数衰减的包络。 */
function decayEnv(t: number, attack: number, decay: number): number {
  return Math.min(1, t / attack) * Math.exp(-t * decay);
}

/** 落子：木头「嗒」的一声——短噪声 + 低频琴体。 */
function renderPlace(n: number): Float64Array {
  const out = new Float64Array(n);
  let low = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SOUND_RATE;
    const click = noise(i);
    low = low * 0.78 + click * 0.22;
    const body = Math.sin(TAU * 185 * t) * Math.exp(-t * 26) * 0.46;
    const wood = Math.sin(TAU * 372 * t) * Math.exp(-t * 42) * 0.2;
    out[i] =
      (low * Math.exp(-t * 52) * 0.9 + body + wood) * Math.min(1, t / 0.002);
  }
  return out;
}

/** 选子：轻柔的低音，缓慢起音，与倒计时区分。 */
function renderSelect(n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SOUND_RATE;
    const fade = Math.min(1, (n / SOUND_RATE - t) / 0.025);
    out[i] = (Math.sin(TAU * 220 * t) + Math.sin(TAU * 330 * t) * 0.15)
      * decayEnv(t, 0.012, 28) * fade;
  }
  return out;
}

/** 倒计时滴答：短促的高音，最后 5 秒每秒一下。 */
function renderTick(n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SOUND_RATE;
    const env = decayEnv(t, 0.003, 46);
    out[i] =
      (Math.sin(TAU * 1046.5 * t) * 0.5 + Math.sin(TAU * 2093 * t) * 0.14) *
      env;
  }
  return out;
}

/** 超时：往下掉的警报声，带一点颤动。 */
function renderTimeout(n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SOUND_RATE;
    const f = 470 - 260 * (t / 0.62);
    const phase = TAU * (470 * t - (260 / (2 * 0.62)) * t * t);
    const gate = 0.72 + 0.28 * Math.sin(TAU * 13 * t);
    const tone =
      Math.sin(phase) * 0.62 +
      Math.sin(phase * 2) * 0.2 +
      Math.sin(TAU * f * t) * 0.12;
    out[i] =
      tone * gate * Math.min(1, t / 0.012) * Math.min(1, (0.62 - t) / 0.09);
  }
  return out;
}

interface Note {
  freq: number;
  start: number;
  length: number;
  gain: number;
}

function renderNotes(seconds: number, notes: readonly Note[]): Float64Array {
  const n = Math.round(seconds * SOUND_RATE);
  const out = new Float64Array(n);
  for (const note of notes) {
    const first = Math.max(0, Math.floor(note.start * SOUND_RATE));
    const last = Math.min(
      n,
      Math.ceil((note.start + note.length) * SOUND_RATE),
    );
    for (let i = first; i < last; i++) {
      const t = i / SOUND_RATE - note.start;
      const env =
        Math.min(1, t / 0.008) *
        Math.exp(-t * 5.2) *
        Math.min(1, (note.start + note.length - i / SOUND_RATE) / 0.04);
      out[i] +=
        (Math.sin(TAU * note.freq * t) * 0.72 +
          Math.sin(TAU * note.freq * 2 * t) * 0.2 +
          Math.sin(TAU * note.freq * 3 * t) * 0.08) *
        env *
        note.gain;
    }
  }
  return out;
}

/** 胜利：往上走的琶音。 */
function renderWin(): Float64Array {
  return renderNotes(SOUND_SECONDS.win, [
    { freq: 523.25, start: 0, length: 0.24, gain: 0.27 },
    { freq: 659.25, start: 0.1, length: 0.26, gain: 0.27 },
    { freq: 783.99, start: 0.2, length: 0.28, gain: 0.27 },
    { freq: 1046.5, start: 0.3, length: 0.48, gain: 0.34 },
    { freq: 1568, start: 0.34, length: 0.3, gain: 0.1 },
  ]);
}

/** 落败：往下沉的两声，不刺耳。 */
function renderLoss(): Float64Array {
  return renderNotes(SOUND_SECONDS.loss, [
    { freq: 392, start: 0, length: 0.34, gain: 0.3 },
    { freq: 329.63, start: 0.16, length: 0.36, gain: 0.3 },
    { freq: 261.63, start: 0.32, length: 0.5, gain: 0.34 },
    { freq: 130.81, start: 0.32, length: 0.5, gain: 0.16 },
  ]);
}


/** 掷骰：木骰在桌面上的连续碰撞。 */
function renderRoll(n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SOUND_RATE;
    const first = Math.exp(-Math.pow((t - 0.018) / 0.018, 2));
    const second = 0.72 * Math.exp(-Math.pow((t - 0.105) / 0.022, 2));
    const third = 0.48 * Math.exp(-Math.pow((t - 0.205) / 0.028, 2));
    const knocks = first + second + third;
    out[i] =
      (noise(i * 3) * 0.62 + Math.sin(TAU * 235 * t) * 0.32) *
      knocks *
      Math.min(1, t / 0.002);
  }
  return out;
}

/** 吃子：短促木击后接一声低沉的碰撞。 */
function renderCapture(n: number): Float64Array {
  const out = new Float64Array(n);
  let low = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SOUND_RATE;
    const click = noise(i);
    low = low * 0.84 + click * 0.16;
    out[i] =
      low * Math.exp(-t * 34) * 1.25 +
      Math.sin(TAU * 132 * t) * Math.exp(-t * 22) * 0.48 +
      Math.sin(TAU * 690 * t) * Math.exp(-t * 58) * 0.2;
  }
  return out;
}

/** 悔棋：短促的回落音，提示动作已经撤回。 */
function renderUndo(): Float64Array {
  const out = new Float64Array(SOUND_SECONDS.undo * SOUND_RATE);
  const seconds = SOUND_SECONDS.undo;
  for (let i = 0; i < out.length; i++) {
    const t = i / SOUND_RATE;
    const phase = TAU * (620 * t - (310 / (2 * seconds)) * t * t);
    const env = Math.min(1, t / 0.008) * Math.min(1, (seconds - t) / 0.055);
    out[i] =
      (Math.sin(phase) * 0.6 + Math.sin(phase * 2) * 0.14) * env;
  }
  return out;
}

/** 和棋：两声平缓的中音，不带胜负倾向。 */
function renderDraw(): Float64Array {
  return renderNotes(SOUND_SECONDS.draw, [
    { freq: 523.25, start: 0, length: 0.3, gain: 0.3 },
    { freq: 392, start: 0.14, length: 0.46, gain: 0.32 },
  ]);
}

function render(name: SoundName): Float64Array {
  switch (name) {
    case "place":
      return renderPlace(Math.round(SOUND_SECONDS.place * SOUND_RATE));
    case "select":
      return renderSelect(Math.round(SOUND_SECONDS.select * SOUND_RATE));
    case "tick":
      return renderTick(Math.round(SOUND_SECONDS.tick * SOUND_RATE));
    case "timeout":
      return renderTimeout(Math.round(SOUND_SECONDS.timeout * SOUND_RATE));
    case "win":
      return renderWin();
    case "loss":
      return renderLoss();
    case "check":
      return renderTick(Math.round(SOUND_RATE * 0.1));
    case "draw":
      return renderDraw();
    case "roll":
      return renderRoll(Math.round(SOUND_SECONDS.roll * SOUND_RATE));
    case "capture":
      return renderCapture(Math.round(SOUND_SECONDS.capture * SOUND_RATE));
    case "undo":
      return renderUndo();
  }
}

function writeAscii(bytes: Uint8Array, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
}

/** Float 采样 → 16-bit PCM 的 WAV（44 字节标准头）。 */
function encodeWav(samples: Float64Array, peak: number): Uint8Array {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > max) max = v;
  }
  const scale = max > 0 ? peak / max : 0;

  const dataSize = samples.length * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SOUND_RATE, true);
  view.setUint32(28, SOUND_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(bytes, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.round(clamp(samples[i] * scale, -1, 1) * 32767);
    view.setInt16(44 + i * 2, s, true);
  }
  return bytes;
}

function decodeVoice(text: string): Uint8Array {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out: number[] = [];
  let bits = 0,
    value = 0;
  for (const c of text) {
    const n = alphabet.indexOf(c);
    if (n < 0) break;
    value = (value << 6) | n;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 255);
    }
  }
  return new Uint8Array(out);
}
const cache = new Map<SoundName, Uint8Array>();

/** 合成一个音效的完整 WAV 字节；同一个音效只算一次。 */
export function synthesizeSound(name: SoundName): Uint8Array {
  const hit = cache.get(name);
  if (hit) return hit;
  const wav =
    name === "check"
      ? decodeVoice(CHECK_VOICE)
      : encodeWav(render(name), SOUND_PEAK[name]);
  cache.set(name, wav);
  return wav;
}

/**
 * 可播放的地址，按平台只准备一次。某个音效准备失败只会少了那一个，
 * 不会影响游戏本身（静音也能玩）。
 */
export async function soundUrls(): Promise<Partial<Record<SoundName, string>>> {
  const urls: Partial<Record<SoundName, string>> = {};

  if (platform.os === "web") {
    for (const name of SOUND_NAMES) {
      // A data URI also works on nsh hosts that cannot transfer their QuickJS blob URLs to the browser.
      urls[name] =
        "data:audio/wav;base64," + encodeBase64(synthesizeSound(name));
    }
    return urls;
  }

  const dataDir = process.dataDir;
  if (!dataDir) return urls;

  const dir = join(dataDir, "sounds");
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    return urls;
  }

  for (const name of SOUND_NAMES) {
    try {
      const file = join(dir, `gomoku-${name}-v${FILE_VERSION}.wav`);
      if (!(await exists(file))) await writeFile(file, synthesizeSound(name));
      urls[name] =
        platform.os === "android" || platform.os === "ios"
          ? soundFileUri(file)
          : file;
    } catch {
      /* 没有写权限或文件系统不可用时，这个音效静默跳过 */
    }
  }
  return urls;
}

/**
 * 把移动端绝对路径转成 video 播放器可解析的 file:/ URI。
 * 盘符冒号和路径分隔符保留，其余每一段都做百分号编码，避免空格、中文
 * 和 Windows 反斜杠在不同平台上被当成参数或非法 URI。这里故意只写一个
 * 斜杠：NSH 不允许没有 network 能力时加载含 `://` 的地址，而 Android
 * MediaPlayer 又需要通过 scheme 知道这是本地文件。
 */
export function soundFileUri(file: string): string {
  let path = file.replace(/\\/g, "/");
  if (path.startsWith("file://")) path = path.slice(7);
  const encoded = path
    .split("/")
    .map((part) => (/^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part)))
    .join("/");
  if (encoded.startsWith("/")) return `file:${encoded}`;
  return `file:/${encoded}`;
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i],
      b = bytes[i + 1] ?? 0,
      c = bytes[i + 2] ?? 0;
    chunks.push(
      alphabet[a >> 2] +
        alphabet[((a & 3) << 4) | (b >> 4)] +
        (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >> 6)] : "=") +
        (i + 2 < bytes.length ? alphabet[c & 63] : "="),
    );
  }
  return chunks.join("");
}

let pending: Promise<Partial<Record<SoundName, string>>> | null = null;

/** 全局只准备一次音效文件 / data URI。 */
export function loadSounds(): Promise<Partial<Record<SoundName, string>>> {
  if (!pending) pending = soundUrls();
  return pending;
}
