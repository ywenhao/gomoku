/**
 * 学棋进度：残局已解题目与教程已完成课程。
 *
 * 两者都是 id 列表，去重后存在同一个 JSON 里；数据损坏时当空进度，
 * 不影响残局和教程本身打开。
 */

export interface StudyProgress {
  /** 已解出的残局 id */
  tsumego: string[];
  /** 已完成的教程课程 id */
  lessons: string[];
}

export const EMPTY_STUDY: StudyProgress = { tsumego: [], lessons: [] };

const MAX_IDS = 2000;

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_IDS) break;
  }
  return out;
}

export function readStudy(raw: string | null): StudyProgress {
  if (!raw) return { tsumego: [], lessons: [] };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { tsumego: [], lessons: [] };
  }
  if (!value || typeof value !== "object") {
    return { tsumego: [], lessons: [] };
  }
  const data = value as Record<string, unknown>;
  return { tsumego: ids(data.tsumego), lessons: ids(data.lessons) };
}

/** 追加一个 id；已经存在时返回原数组，方便 signal 跳过无意义更新。 */
export function addStudyId(list: readonly string[], id: string): string[] {
  const next = id.trim();
  if (!next || list.includes(next)) return list as string[];
  return list.concat([next]);
}
