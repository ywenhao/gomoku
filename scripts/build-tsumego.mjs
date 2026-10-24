#!/usr/bin/env node
/**
 * 把 Go Game Guru 的每周死活题（SGF，含解答树）压成应用内使用的数据。
 *
 * 原始题集：https://github.com/gogameguru/go-problems
 * 许可：CC BY-NC-SA 4.0（见 lib/data/GO-PROBLEMS-LICENSE.txt）
 *
 * 只保留「正解」分支：黑棋的分支全部保留，白棋只保留第一条正解应手，
 * 这样应用里玩家每手都有明确的判定，同时数据不会太大。
 *
 *   git clone --depth 1 https://github.com/gogameguru/go-problems.git /tmp/ggg
 *   node scripts/build-tsumego.mjs /tmp/ggg
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const source = process.argv[2] || "/tmp/opencode/ggg";
const outFile = join(root, "lib/data/tsumego.ts");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/* ---------------------------- SGF 解析 ---------------------------- */

function parseSGF(text) {
  let at = 0;
  const fail = (msg) => {
    throw new Error(`${msg} @ ${at}`);
  };
  const skip = () => {
    while (at < text.length && /\s/.test(text[at])) at++;
  };
  function value() {
    if (text[at] !== "[") fail("expected [");
    at++;
    let out = "";
    while (at < text.length) {
      const ch = text[at++];
      if (ch === "\\") {
        if (at < text.length) out += text[at++];
      } else if (ch === "]") {
        return out;
      } else {
        out += ch;
      }
    }
    fail("unterminated value");
  }
  function props() {
    if (text[at] !== ";") fail("expected ;");
    at++;
    const out = {};
    for (;;) {
      skip();
      if (!/[A-Za-z]/.test(text[at] ?? "")) break;
      let id = "";
      while (/[A-Za-z]/.test(text[at] ?? "")) id += text[at++];
      skip();
      out[id] = [];
      while (text[at] === "[") out[id].push(value());
    }
    return out;
  }
  /** 一棵 SGF 树 = 顺序节点 + 末尾的分支树。 */
  function tree() {
    skip();
    if (text[at] !== "(") fail("expected (");
    at++;
    const nodes = [];
    for (;;) {
      skip();
      if (text[at] !== ";") break;
      nodes.push(props());
    }
    const children = [];
    for (;;) {
      skip();
      if (text[at] !== "(") break;
      children.push(tree());
    }
    skip();
    if (text[at] !== ")") fail("expected )");
    at++;
    if (nodes.length === 0) fail("empty tree");
    return { nodes, children };
  }
  const root = tree();
  skip();
  return root;
}

/* ---------------------------- 围棋规则（与 lib/go.ts 对齐） ---------------------------- */

const KOMI = 7.5;
const SIZE = 19;

function neighbors(i) {
  const x = i % SIZE;
  const y = (i - x) / SIZE;
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < SIZE - 1) out.push(i + 1);
  if (y > 0) out.push(i - SIZE);
  if (y < SIZE - 1) out.push(i + SIZE);
  return out;
}

function group(board, i) {
  const p = board[i];
  if (!p) return null;
  const seen = new Uint8Array(SIZE * SIZE);
  const stones = [i];
  const libs = [];
  const libSeen = new Uint8Array(SIZE * SIZE);
  seen[i] = 1;
  for (let h = 0; h < stones.length; h++) {
    for (const n of neighbors(stones[h])) {
      if (board[n] === 0) {
        if (!libSeen[n]) {
          libSeen[n] = 1;
          libs.push(n);
        }
      } else if (board[n] === p && !seen[n]) {
        seen[n] = 1;
        stones.push(n);
      }
    }
  }
  return { stones, liberties: libs };
}

function play(board, x, y, p, ko) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
  const i = y * SIZE + x;
  if (board[i] !== 0 || i === ko) return null;
  const next = board.slice();
  next[i] = p;
  const opp = 3 - p;
  const captured = [];
  const checked = new Uint8Array(SIZE * SIZE);
  for (let j = 0; j < next.length; j++) {
    if (next[j] !== opp || checked[j]) continue;
    const g = group(next, j);
    for (const s of g.stones) checked[s] = 1;
    if (g.liberties.length === 0) {
      for (const s of g.stones) {
        next[s] = 0;
        captured.push(s);
      }
    }
  }
  const own = group(next, i);
  if (!own || own.liberties.length === 0) return null;
  const koPoint =
    captured.length === 1 && own.stones.length === 1 && own.liberties.length === 1
      ? captured[0]
      : -1;
  return { board: next, captured, ko: koPoint };
}

function point(value) {
  if (!value || value === "tt" || value.length < 2) return null;
  const x = value.charCodeAt(0) - 97;
  const y = value.charCodeAt(1) - 97;
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return null;
  return { x, y, sgf: value.slice(0, 2) };
}

/* ---------------------------- 解答树 ---------------------------- */

function hasCorrect(node) {
  const c = node.C?.[0] ?? "";
  return /(?<!not )correct/i.test(c) && !/incorrect/i.test(c);
}

/** 标记整棵树里是否至少有一条「Correct」的解答。 */
function mark(tree) {
  let ok = false;
  for (const node of tree.nodes) {
    node.ok = hasCorrect(node);
    if (node.ok) ok = true;
  }
  for (const child of tree.children) {
    if (mark(child)) ok = true;
  }
  tree.ok = ok;
  return ok;
}

/** 从一棵分支树构造可玩的正解链。 */
function buildTree(tree, turn, board, ko) {
  if (!tree.ok || tree.nodes.length === 0) return null;

  function buildAt(index, atBoard, atKo, atTurn) {
    const node = tree.nodes[index];
    const moveValue = node.B?.[0] ?? node.W?.[0] ?? "";
    const p = node.B ? 1 : node.W ? 2 : atTurn;
    if (!moveValue) return null;
    const pt = point(moveValue);
    if (!pt) return null;
    const r = play(atBoard, pt.x, pt.y, p, atKo);
    if (!r) return null;

    const nextTurn = 3 - p;
    const children = [];
    if (index + 1 < tree.nodes.length) {
      const next = buildAt(index + 1, r.board, r.ko, nextTurn);
      if (!next) return null;
      children.push(next);
    } else if (p === 2) {
      const first = tree.children.find((c) => c.ok);
      if (first) {
        const child = buildTree(first, nextTurn, r.board, r.ko);
        if (child) children.push(child);
      }
    } else {
      for (const c of tree.children) {
        if (!c.ok) continue;
        const child = buildTree(c, nextTurn, r.board, r.ko);
        if (child) children.push(child);
      }
    }

    return { m: pt.sgf, p, c: children };
  }

  return buildAt(0, board, ko, turn);
}

function regionOf(black, white) {
  const all = black.concat(white).map(point).filter(Boolean);
  if (all.length === 0) return "中腹";
  let minX = SIZE;
  let maxX = 0;
  let minY = SIZE;
  let maxY = 0;
  for (const p of all) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const corner =
    (maxX <= 8 && maxY <= 8) ||
    (minX >= SIZE - 9 && maxY <= 8) ||
    (maxX <= 8 && minY >= SIZE - 9) ||
    (minX >= SIZE - 9 && minY >= SIZE - 9);
  if (corner) return "角部";
  if (minX <= 3 || maxX >= SIZE - 4 || minY <= 3 || maxY >= SIZE - 4) return "边上";
  return "中腹";
}

function collectFiles() {
  const dirs = ["easy", "intermediate", "hard"];
  const files = [];
  for (const d of dirs) {
    const list = walk(join(source, "weekly-go-problems", d)).filter((f) =>
      f.endsWith(".sgf"),
    );
    files.push([d, list]);
  }
  return files;
}

const problems = [];
let skipped = 0;
for (const [folder, files] of collectFiles()) {
  files.sort();
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    let tree;
    try {
      tree = parseSGF(readFileSync(file, "utf8"));
    } catch (err) {
      skipped++;
      continue;
    }
    mark(tree);
    const black = tree.nodes[0].AB ?? [];
    const white = tree.nodes[0].AW ?? [];
    const board = new Array(SIZE * SIZE).fill(0);
    let legalSetup = true;
    for (const c of black) {
      const p = point(c);
      if (!p || board[p.y * SIZE + p.x] !== 0) legalSetup = false;
      else board[p.y * SIZE + p.x] = 1;
    }
    for (const c of white) {
      const p = point(c);
      if (!p || board[p.y * SIZE + p.x] !== 0) legalSetup = false;
      else board[p.y * SIZE + p.x] = 2;
    }
    if (!legalSetup) {
      skipped++;
      continue;
    }

    const solutions = tree.children
      .filter((c) => c.ok && c.nodes[0].B)
      .map((c) => buildTree(c, 1, board, -1))
      .filter(Boolean);
    if (solutions.length === 0) {
      skipped++;
      continue;
    }

    const num = index + 1;
    const level =
      folder === "easy"
        ? "easy"
        : folder === "intermediate"
          ? "normal"
          : index < 90
            ? "hard"
            : "hell";
    const region = regionOf(black, white);
    problems.push({
      id: `${folder}-${String(num).padStart(3, "0")}`,
      no: problems.length + 1,
      level,
      region,
      name: `${region}死活 ${String(problems.length + 1).padStart(3, "0")}`,
      series: folder === "easy" ? "入门" : folder === "intermediate" ? "进阶" : "高阶",
      source: "Go Game Guru 每周死活",
      size: SIZE,
      black,
      white,
      solutions,
    });
  }
}

// 名称里带上稳定的序号，方便搜索、排序和记录进度。
mkdirSync(dirname(outFile), { recursive: true });
const header = `/**
 * 自动生成，请勿手改：node scripts/build-tsumego.mjs
 *
 * 题面与解答来自 Go Game Guru 的 Weekly Go Problems：
 * https://github.com/gogameguru/go-problems
 * 作者 An Younggil 8p / David Ormerod，许可 CC BY-NC-SA 4.0。
 * 本文件是题面与解答树的压缩改编版，同样按 CC BY-NC-SA 4.0 提供。
 * 详见 lib/data/GO-PROBLEMS-LICENSE.txt。
 */

export interface TsumegoNode {
  /** SGF 坐标，例如 rs；不表示虚手 */
  m: string;
  /** 1 黑 / 2 白 */
  p: 1 | 2;
  /** 正解后续；空数组表示解答结束 */
  c: TsumegoNode[];
}

export interface TsumegoProblem {
  id: string;
  no: number;
  level: "easy" | "normal" | "hard" | "hell";
  region: "角部" | "边上" | "中腹";
  name: string;
  series: string;
  source: string;
  size: 19;
  black: string[];
  white: string[];
  solutions: TsumegoNode[];
}

export const TSUMEGO_SOURCE = {
  name: "Go Game Guru Weekly Go Problems",
  author: "An Younggil 8p / David Ormerod",
  url: "https://github.com/gogameguru/go-problems",
  license: "CC BY-NC-SA 4.0",
} as const;

export const TSUMEGO_PROBLEMS: TsumegoProblem[] = `;
writeFileSync(
  outFile,
  header + "JSON.parse(" + JSON.stringify(JSON.stringify(problems)) + ") as TsumegoProblem[];\n",
);

const counts = problems.reduce((map, p) => {
  map[p.level] = (map[p.level] || 0) + 1;
  return map;
}, {});
console.log(
  `wrote ${problems.length} problems (${skipped} skipped) → ${outFile}`,
  counts,
);
