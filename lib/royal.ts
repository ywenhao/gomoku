import { other, type Player, type Difficulty } from "./gomoku";

export type RoyalKind = "chess" | "xiangqi";
export interface RoyalMove {
  from: number;
  to: number;
  promotion?: number;
}
export interface RoyalResult {
  winner: Player | 0;
  reason: string;
}
export interface RoyalState {
  kind: RoyalKind;
  board: number[];
  turn: Player;
  castle: string;
  ep: number;
  halfmove: number;
  fullmove: number;
  history: string[];
  checks: (Player | 0)[];
  result: RoyalResult | null;
  /** Repeated Xiangqi positions whose chasing case requires a referee's ruling. */
  adjudication?: boolean;
}
export const owner = (v: number): Player | 0 => (v > 0 ? 1 : v < 0 ? 2 : 0);
export const widthOf = (kind: RoyalKind) => (kind === "chess" ? 8 : 9);
export const heightOf = (kind: RoyalKind) => (kind === "chess" ? 8 : 10);
const sign = (p: Player) => (p === 1 ? 1 : -1);
const CHESS_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const XQ_FEN =
  "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR w - - 0 1";
const letters = (kind: RoyalKind) => (kind === "chess" ? "pnbrqk" : "phercka");
export function squareName(i: number, kind: RoyalKind): string {
  return (
    String.fromCharCode(97 + (i % widthOf(kind))) +
    (heightOf(kind) - Math.floor(i / widthOf(kind)))
  );
}
export function parseSquare(s: string, kind: RoyalKind): number {
  if (!(kind === "chess" ? /^[a-h][1-8]$/ : /^[a-i](?:10|[1-9])$/).test(s))
    return -1;
  const x = s.charCodeAt(0) - 97,
    y = heightOf(kind) - Number(s.slice(1));
  return x >= 0 && x < widthOf(kind) && y >= 0 && y < heightOf(kind)
    ? y * widthOf(kind) + x
    : -1;
}
export function positionKey(s: RoyalState): string {
  // An en-passant target affects repetition only if a legal capture exists.
  const ep =
    s.kind === "chess" &&
    s.ep >= 0 &&
    rawLegal(s).some((m) => Math.abs(s.board[m.from]) === 1 && m.to === s.ep)
      ? s.ep
      : -1;
  return `${s.board.join(",")}|${s.turn}|${s.castle}|${ep}`;
}
export function fromFen(kind: RoyalKind, fen: string): RoyalState | null {
  const fields = fen.trim().split(/\s+/),
    rows = fields[0]?.split("/") ?? [];
  if (rows.length !== heightOf(kind) || !["w", "b"].includes(fields[1]))
    return null;
  const board: number[] = [];
  for (const row of rows) {
    const cells: number[] = [];
    for (const c of row) {
      if (/[1-9]/.test(c)) cells.push(...new Array<number>(Number(c)).fill(0));
      else {
        const alias =
          kind === "xiangqi"
            ? c.toLowerCase().replace("n", "h").replace("b", "e")
            : c.toLowerCase();
        const t = letters(kind).indexOf(alias) + 1;
        if (!t) return null;
        cells.push(t * (c === c.toUpperCase() ? 1 : -1));
      }
    }
    if (cells.length !== widthOf(kind)) return null;
    board.push(...cells);
  }
  if (
    board.filter((v) => v === 6).length !== 1 ||
    board.filter((v) => v === -6).length !== 1
  )
    return null;
  const castle = fields[2] === "-" ? "" : (fields[2] ?? "");
  if (!/^[KQkq]*$/.test(castle) || new Set(castle).size !== castle.length)
    return null;
  const ep =
    fields[3] === "-" || !fields[3] ? -1 : parseSquare(fields[3], kind);
  if (fields[3] !== "-" && fields[3] && ep < 0) return null;
  const halfmove = Number(fields[4] ?? 0),
    fullmove = Number(fields[5] ?? 1);
  if (
    !Number.isInteger(halfmove) ||
    halfmove < 0 ||
    !Number.isInteger(fullmove) ||
    fullmove < 1
  )
    return null;
  const s: RoyalState = {
    kind,
    board,
    turn: fields[1] === "w" ? 1 : 2,
    castle,
    ep,
    halfmove,
    fullmove,
    history: [],
    checks: [],
    result: null,
  };
  if (kind === "chess") {
    if (ep >= 0) {
      const direction = s.turn === 1 ? 8 : -8;
      if (
        Math.floor(ep / 8) !== (s.turn === 1 ? 2 : 5) ||
        board[ep] !== 0 ||
        board[ep + direction] !== -sign(s.turn) ||
        board[ep - direction] !== 0
      )
        return null;
    }
    for (const [right, k, r, p] of [
      ["K", 60, 63, 1],
      ["Q", 60, 56, 1],
      ["k", 4, 7, -1],
      ["q", 4, 0, -1],
    ] as const) {
      if (castle.includes(right) && (board[k] !== 6 * p || board[r] !== 4 * p))
        return null;
    }
  } else {
    if (castle || ep >= 0) return null;
    for (const p of [1, 2] as Player[]) {
      const k = board.indexOf(6 * sign(p)),
        x = k % 9,
        y = Math.floor(k / 9);
      if (x < 3 || x > 5 || (p === 1 ? y < 7 : y > 2)) return null;
    }
  }
  if (
    kind === "chess" &&
    board.some((v, i) => Math.abs(v) === 1 && (i < 8 || i >= 56))
  )
    return null;
  if (inCheck(s, other(s.turn))) return null;
  s.history = [positionKey(s)];
  return s;
}
export function createRoyal(kind: RoyalKind): RoyalState {
  return fromFen(kind, kind === "chess" ? CHESS_FEN : XQ_FEN)!;
}

function pseudo(s: RoyalState, from: number, attacks = false): RoyalMove[] {
  const w = widthOf(s.kind),
    h = heightOf(s.kind),
    b = s.board,
    v = b[from],
    p = owner(v);
  if (!p) return [];
  const t = Math.abs(v),
    x = from % w,
    y = Math.floor(from / w),
    out: RoyalMove[] = [];
  const inside = (nx: number, ny: number) =>
    nx >= 0 && nx < w && ny >= 0 && ny < h;
  const add = (nx: number, ny: number) => {
    if (!inside(nx, ny)) return;
    const to = ny * w + nx;
    if (attacks || owner(b[to]) !== p) {
      if (!attacks && s.kind === "chess" && t === 1 && (ny === 0 || ny === 7)) {
        for (const promotion of [5, 4, 3, 2]) out.push({ from, to, promotion });
      } else out.push({ from, to });
    }
  };
  const ray = (dx: number, dy: number, cannon = false) => {
    let screen = false;
    for (let nx = x + dx, ny = y + dy; inside(nx, ny); nx += dx, ny += dy) {
      const to = ny * w + nx;
      if (!cannon) {
        add(nx, ny);
        if (b[to]) break;
      } else if (!screen) {
        if (b[to]) screen = true;
        else if (!attacks) add(nx, ny);
      } else if (b[to]) {
        add(nx, ny);
        break;
      } else if (attacks) add(nx, ny);
    }
  };
  if (s.kind === "chess") {
    if (t === 1) {
      const dy = p === 1 ? -1 : 1;
      if (attacks) {
        add(x - 1, y + dy);
        add(x + 1, y + dy);
      } else {
        if (inside(x, y + dy) && !b[(y + dy) * w + x]) {
          add(x, y + dy);
          if (y === (p === 1 ? 6 : 1) && !b[(y + 2 * dy) * w + x])
            add(x, y + 2 * dy);
        }
        for (const dx of [-1, 1]) {
          const to = (y + dy) * w + x + dx;
          if (
            inside(x + dx, y + dy) &&
            (owner(b[to]) === other(p) || to === s.ep)
          )
            add(x + dx, y + dy);
        }
      }
    } else if (t === 2) {
      for (const [dx, dy] of [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ])
        add(x + dx, y + dy);
    } else if (t === 6) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) if (dx || dy) add(x + dx, y + dy);
      if (!attacks && x === 4 && y === (p === 1 ? 7 : 0) && !inCheck(s, p)) {
        for (const [right, rookX, target, transit] of [
          [p === 1 ? "K" : "k", 7, 6, 5],
          [p === 1 ? "Q" : "q", 0, 2, 3],
        ] as const) {
          if (!s.castle.includes(right) || b[y * w + rookX] !== 4 * sign(p))
            continue;
          let clear = true;
          for (let cx = Math.min(x, rookX) + 1; cx < Math.max(x, rookX); cx++)
            if (b[y * w + cx]) clear = false;
          if (
            clear &&
            !attacked(s, y * w + transit, other(p)) &&
            !attacked(s, y * w + target, other(p))
          )
            add(target, y);
        }
      }
    } else {
      if (t === 3 || t === 5)
        for (const [dx, dy] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ])
          ray(dx, dy);
      if (t === 4 || t === 5)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          ray(dx, dy);
    }
  } else {
    const palace = (nx: number, ny: number) =>
      nx >= 3 && nx <= 5 && (p === 1 ? ny >= 7 : ny <= 2);
    if (t === 1) {
      add(x, y + (p === 1 ? -1 : 1));
      if (p === 1 ? y <= 4 : y >= 5) {
        add(x - 1, y);
        add(x + 1, y);
      }
    } else if (t === 2) {
      for (const [dx, dy] of [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ]) {
        const lx = x + (Math.abs(dx) === 2 ? dx / 2 : 0),
          ly = y + (Math.abs(dy) === 2 ? dy / 2 : 0);
        if (inside(lx, ly) && !b[ly * w + lx]) add(x + dx, y + dy);
      }
    } else if (t === 3) {
      for (const [dx, dy] of [
        [2, 2],
        [2, -2],
        [-2, 2],
        [-2, -2],
      ]) {
        const ny = y + dy;
        if (
          inside(x + dx, ny) &&
          (p === 1 ? ny >= 5 : ny <= 4) &&
          !b[(y + dy / 2) * w + x + dx / 2]
        )
          add(x + dx, ny);
      }
    } else if (t === 7) {
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        if (palace(x + dx, y + dy)) add(x + dx, y + dy);
    } else if (t === 6) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (palace(x + dx, y + dy)) add(x + dx, y + dy);
      const enemy = b.indexOf(-v);
      if (enemy >= 0 && enemy % w === x) {
        let blocked = false;
        for (
          let i = Math.min(from, enemy) + w;
          i < Math.max(from, enemy);
          i += w
        )
          if (b[i]) blocked = true;
        if (!blocked) out.push({ from, to: enemy });
      }
    } else
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        ray(dx, dy, t === 5);
  }
  return out;
}
export function attacked(s: RoyalState, square: number, by: Player): boolean {
  for (let i = 0; i < s.board.length; i++)
    if (
      owner(s.board[i]) === by &&
      pseudo(s, i, true).some((m) => m.to === square)
    )
      return true;
  return false;
}
export function inCheck(s: RoyalState, p = s.turn): boolean {
  const k = s.board.indexOf(6 * sign(p));
  return k < 0 || attacked(s, k, other(p));
}
function execute(s: RoyalState, m: RoyalMove): RoyalState {
  const b = s.board.slice(),
    v = b[m.from],
    captured = b[m.to],
    w = widthOf(s.kind);
  b[m.from] = 0;
  b[m.to] = (m.promotion ?? Math.abs(v)) * sign(s.turn);
  let castle = s.castle,
    ep = -1;
  if (s.kind === "chess") {
    if (Math.abs(v) === 1 && m.to === s.ep && !captured)
      b[m.to + (s.turn === 1 ? w : -w)] = 0;
    if (Math.abs(v) === 1 && Math.abs(m.to - m.from) === 16)
      ep = (m.to + m.from) / 2;
    if (Math.abs(v) === 6) {
      castle = castle.replace(s.turn === 1 ? /[KQ]/g : /[kq]/g, "");
      if (Math.abs(m.to - m.from) === 2) {
        const rook = m.to > m.from ? m.from + 3 : m.from - 4;
        b[m.to > m.from ? m.from + 1 : m.from - 1] = b[rook];
        b[rook] = 0;
      }
    }
    for (const [i, right] of [
      [0, "q"],
      [7, "k"],
      [56, "Q"],
      [63, "K"],
    ] as const)
      if (m.from === i || m.to === i) castle = castle.replace(right, "");
  }
  return {
    ...s,
    board: b,
    turn: other(s.turn),
    castle,
    ep,
    halfmove:
      captured || (s.kind === "chess" && Math.abs(v) === 1)
        ? 0
        : s.halfmove + 1,
    fullmove: s.fullmove + (s.turn === 2 ? 1 : 0),
    result: null,
  };
}
function rawLegal(s: RoyalState): RoyalMove[] {
  const out: RoyalMove[] = [];
  for (let i = 0; i < s.board.length; i++)
    if (owner(s.board[i]) === s.turn) {
      for (const m of pseudo(s, i)) {
        if (Math.abs(s.board[m.to]) === 6) continue;
        if (!inCheck(execute(s, m), s.turn)) out.push(m);
      }
    }
  return out;
}
function hasLegalMove(s: RoyalState): boolean {
  for (let i = 0; i < s.board.length; i++)
    if (owner(s.board[i]) === s.turn)
      for (const m of pseudo(s, i)) {
        if (Math.abs(s.board[m.to]) !== 6 && !inCheck(execute(s, m), s.turn))
          return true;
      }
  return false;
}
export function royalLegalMoves(s: RoyalState): RoyalMove[] {
  return s.result || s.adjudication ? [] : rawLegal(s);
}
export function deadMaterial(s: RoyalState): boolean {
  if (s.kind !== "chess") return false;
  const pieces = s.board
    .map((v, i) => ({ v: Math.abs(v), i }))
    .filter((x) => x.v && x.v !== 6);
  if (!pieces.length || (pieces.length === 1 && [2, 3].includes(pieces[0].v)))
    return true;
  return (
    pieces.every((x) => x.v === 3) &&
    new Set(pieces.map((x) => ((x.i % 8) + Math.floor(x.i / 8)) % 2)).size === 1
  );
}
export function timeoutRoyal(s: RoyalState, loser: Player): RoyalResult {
  if (s.kind === "chess") {
    const enemy = s.board.filter(
      (v) => owner(v) === other(loser) && Math.abs(v) !== 6,
    );
    if (!enemy.length || deadMaterial(s))
      return { winner: 0, reason: "超时，对方无法以任何合法走法将死，和棋" };
  }
  return { winner: other(loser), reason: "超时判负" };
}
export function drawClaim(s: RoyalState): string | null {
  if (s.kind === "xiangqi") {
    const quiet = s.checks.slice(-s.halfmove);
    const exempt =
      Math.min(10, quiet.filter((p) => p === 1).length) +
      Math.min(10, quiet.filter((p) => p === 2).length);
    return s.halfmove - exempt >= 120
      ? "六十回合自然限着（每方最多十次将军不计）"
      : null;
  }
  const key = positionKey(s);
  if (s.kind === "chess" && s.history.filter((k) => k === key).length >= 3)
    return "三次重复局面";
  if (s.kind === "chess" && s.halfmove >= 100) return "五十回合无吃子及兵移动";
  return null;
}
export function playRoyal(s: RoyalState, m: RoyalMove): RoyalState | null {
  if (!Number.isInteger(m.from) || !Number.isInteger(m.to)) return null;
  if (
    s.result ||
    s.adjudication ||
    owner(s.board[m.from]) !== s.turn ||
    Math.abs(s.board[m.to]) === 6
  )
    return null;
  const move = pseudo(s, m.from).find(
    (x) =>
      x.from === m.from &&
      x.to === m.to &&
      (x.promotion ?? 0) === (m.promotion ?? 0),
  );
  if (!move || inCheck(execute(s, move), s.turn)) return null;
  const n = execute(s, move),
    check = inCheck(n),
    key = positionKey(n);
  n.history = s.history.concat([key]);
  n.checks = s.checks.concat([check ? s.turn : 0]);
  if (!hasLegalMove(n))
    n.result = {
      winner: check || s.kind === "xiangqi" ? s.turn : 0,
      reason: check ? "将死" : s.kind === "xiangqi" ? "困毙" : "逼和",
    };
  else if (deadMaterial(n)) n.result = { winner: 0, reason: "无法将死的局面" };
  else if (s.kind === "chess") {
    if (n.history.filter((k) => k === key).length >= 5)
      n.result = { winner: 0, reason: "五次重复局面" };
    else if (n.halfmove >= 150)
      n.result = { winner: 0, reason: "七十五回合规则" };
  } else {
    const indices = n.history
      .map((k, i) => (k === key ? i : -1))
      .filter((i) => i >= 0);
    if (indices.length >= 3) {
      const first = indices[indices.length - 3],
        checks = n.checks.slice(first);
      const initialTurn: Player = n.history[0].split("|")[1] === "2" ? 2 : 1;
      const offenders = ([1, 2] as Player[]).filter((p) =>
        checks
          .filter(
            (_, i) =>
              ((first + i) % 2 === 0 ? initialTurn : other(initialTurn)) === p,
          )
          .every((c) => c === p),
      );
      if (offenders.length === 1)
        n.result = { winner: other(offenders[0]), reason: "单方长将判负" };
      else if (offenders.length === 2)
        n.result = { winner: 0, reason: "双方长将，和棋" };
      else n.adjudication = true;
    }
  }
  return n;
}
export function parseUci(s: RoyalState, uci: string): RoyalMove | null {
  const match = /^([a-i](?:10|[1-9]))([a-i](?:10|[1-9]))([qrbn])?$/.exec(uci);
  if (!match) return null;
  const from = parseSquare(match[1], s.kind),
    to = parseSquare(match[2], s.kind);
  const promotion = match[3] ? "pnbrqk".indexOf(match[3]) + 1 : undefined;
  return from < 0 || to < 0
    ? null
    : { from, to, ...(promotion ? { promotion } : {}) };
}
export function royalAi(s: RoyalState, level: Difficulty): RoyalMove | null {
  const moves = royalLegalMoves(s);
  if (!moves.length) return null;
  if (level === "easy") return moves[Math.floor(Math.random() * moves.length)];
  const values =
    s.kind === "chess"
      ? [0, 100, 320, 330, 500, 900, 20000]
      : [0, 100, 400, 200, 900, 450, 20000, 200];
  const evaluate = (b: RoyalState, p: Player) =>
    b.board.reduce(
      (sum, v) => sum + (owner(v) === p ? 1 : -1) * values[Math.abs(v)],
      0,
    );
  const started = Date.now(),
    budget = level === "hell" ? 600 : level === "hard" ? 300 : 100;
  let best = moves[0],
    high = -Infinity;
  for (const m of moves.sort(
    (a, b) => Math.abs(s.board[b.to]) - Math.abs(s.board[a.to]),
  )) {
    const n = execute(s, m);
    let score = evaluate(n, s.turn) + (inCheck(n) ? 35 : 0);
    if (!hasLegalMove(n)) score = inCheck(n) || s.kind === "xiangqi" ? 1e7 : 0;
    else if (level !== "normal" && Date.now() - started < budget) {
      let worst = Infinity;
      for (const reply of rawLegal(n)) {
        worst = Math.min(worst, evaluate(execute(n, reply), s.turn));
        if (Date.now() - started > budget) break;
      }
      score = worst;
    }
    if (score > high) {
      high = score;
      best = m;
    }
    if (Date.now() - started > budget) break;
  }
  return best;
}
