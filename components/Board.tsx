import {
  Canvas,
  Text,
  View,
  computed,
  type Accessor,
  type CanvasRenderingContext2D,
  type CanvasSize,
} from "nsh";
import { SIZE, type Player } from "../lib/gomoku";

const C_INK = "#2b241c";
const C_ACCENT = "#c0442c";

export const stoneDiameter = (boardSize: number, n = SIZE) => (boardSize / n) * 0.84;

export function stoneAppearance(value: number) {
  return {
    backgroundColor: value === 1 ? "#17130f" : "#fcfaf5",
    borderWidth: value === 2 ? 1 : 0,
    borderColor: "#d3cabb",
    backgroundImage:
      value === 1
        ? "radial-gradient(circle at 34% 27%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 44%), linear-gradient(150deg, #4a453f 0%, #17130f 45%, #060404 100%)"
        : "radial-gradient(circle at 34% 27%, #ffffff 0%, rgba(255,255,255,0) 54%), linear-gradient(150deg, #fdfbf6 0%, #efeade 55%, #d6cebd 100%)",
    boxShadow:
      value === 1
        ? "0 2px 4px rgba(50,32,14,0.40)"
        : "0 2px 4px rgba(50,32,14,0.28)",
  };
}

export interface BoardMark {
  i: number;
  label?: string;
  tone?: "accent" | "ink" | "white";
}

const STARS: readonly [number, number][] = [
  [3, 3],
  [11, 3],
  [3, 11],
  [11, 11],
  [7, 7],
];

/** 棋盘表面：木纹、网格、星位（只画一次，尺寸变化时重画） */
function surface(n: number, stars: readonly [number, number][]) {
  return (cx: CanvasRenderingContext2D, size: CanvasSize) => {
  const s = Math.min(size.width, size.height);
  if (s <= 0) return;
  const cell = s / n;
  const pad = cell / 2;

  const wood = cx.createLinearGradient(0, 0, s, s);
  wood.addColorStop(0, "#f3d5a3");
  wood.addColorStop(0.45, "#eac189");
  wood.addColorStop(1, "#d9a96b");
  cx.fillStyle = wood;
  cx.fillRect(0, 0, s, s);

  // 木纹
  cx.strokeStyle = "rgba(150,102,48,0.10)";
  cx.lineWidth = 1;
  for (let i = 0; i < 36; i++) {
    const y = ((i + 0.5) * s) / 36;
    cx.beginPath();
    cx.moveTo(0, y);
    cx.bezierCurveTo(s * 0.3, y + 2.4, s * 0.66, y - 2.4, s, y + 0.8);
    cx.stroke();
  }

  // 暗角
  const vignette = cx.createRadialGradient(s / 2, s / 2, s * 0.24, s / 2, s / 2, s * 0.78);
  vignette.addColorStop(0, "rgba(120,72,20,0)");
  vignette.addColorStop(1, "rgba(120,72,20,0.15)");
  cx.fillStyle = vignette;
  cx.fillRect(0, 0, s, s);

  // 网格
  cx.strokeStyle = "rgba(92,62,28,0.60)";
  cx.lineWidth = Math.max(0.75, s / 900);
  cx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pad + i * cell;
    cx.moveTo(pad, p);
    cx.lineTo(s - pad, p);
    cx.moveTo(p, pad);
    cx.lineTo(p, s - pad);
  }
  cx.stroke();

  // 外框
  cx.strokeStyle = "rgba(80,52,22,0.78)";
  cx.lineWidth = Math.max(1.5, s / 420);
  cx.strokeRect(pad, pad, s - pad * 2, s - pad * 2);

  // 星位
  cx.fillStyle = "rgba(70,44,18,0.88)";
  const r = Math.max(1.8, cell * 0.072);
  for (const [sx, sy] of stars) {
    cx.beginPath();
    cx.arc(pad + sx * cell, pad + sy * cell, r, 0, Math.PI * 2);
    cx.fill();
  }
  };
}

interface CellProps {
  i: number;
  n: number;
  cell: Accessor<number>;
  stone: Accessor<number>;
  board: Accessor<number[]>;
  last: Accessor<number>;
  winLine: Accessor<number[]>;
  dead: Accessor<number[]>;
  marks: Accessor<BoardMark[]>;
  hover: Accessor<number>;
  canPlay: Accessor<boolean>;
  turn: Accessor<Player>;
  onPlay: (i: number) => void;
  setHover: (i: number) => void;
  clearHover: (i: number) => void;
}

function Cell(props: CellProps) {
  const x = props.i % props.n;
  const y = (props.i - x) / props.n;

  const v = computed(() => props.board()[props.i]);
  const isLast = computed(() => props.last() === props.i);
  const isWin = computed(() => props.winLine().indexOf(props.i) !== -1);
  const isDead = computed(() => props.dead().indexOf(props.i) !== -1);
  const mark = computed(() => props.marks().find((m) => m.i === props.i));
  const ghost = computed(
    () => v() === 0 && props.hover() === props.i && props.canPlay(),
  );

  const stone = props.stone;

  return (
    <View
      testID={`cell-${x}-${y}`}
      role="button"
      accessibilityLabel={`第${y + 1}行第${x + 1}列${
        v() === 0 ? "空" : v() === 1 ? "黑棋" : "白棋"
      }`}
      onPress={() => props.onPlay(props.i)}
      onHoverIn={() => props.setHover(props.i)}
      onHoverOut={() => props.clearHover(props.i)}
      style={{
        position: "absolute",
        left: x * props.cell(),
        top: y * props.cell(),
        width: props.cell(),
        height: props.cell(),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <If when={v() !== 0}>
        <View
          style={{
            width: stone(),
            height: stone(),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            testID={`stone-${x}-${y}-${v() === 1 ? "b" : "w"}`}
            style={{
              width: stone(),
              height: stone(),
              borderRadius: stone() / 2,
              ...stoneAppearance(v()),
            }}
          />
          <If when={isLast()}>
            <View
              style={{
                position: "absolute",
                width: Math.max(3, stone() * 0.18),
                height: Math.max(3, stone() * 0.18),
                borderRadius: Math.max(3, stone() * 0.18) / 2,
                backgroundColor: "#e04a35",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.75)",
              }}
            />
          </If>
          <If when={isWin()}>
            <View
              style={{
                position: "absolute",
                width: stone() * 1.06,
                height: stone() * 1.06,
                borderRadius: stone() * 0.53,
                borderWidth: 2,
                borderColor: "#e04a35",
                animationName: "pulse",
                animationDuration: 1000,
                animationIterationCount: "infinite",
              }}
            />
          </If>
          <If when={isDead()}>
            <View
              style={{
                position: "absolute",
                width: stone() * 0.72,
                height: stone() * 0.72,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: stone() * 0.7,
                  height: 2,
                  backgroundColor: "#c0442c",
                  transform: [{ rotate: "45deg" }],
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: stone() * 0.7,
                  height: 2,
                  backgroundColor: "#c0442c",
                  transform: [{ rotate: "-45deg" }],
                }}
              />
            </View>
          </If>
        </View>
      </If>

      <If when={ghost()}>
        <View
          style={{
            width: stone(),
            height: stone(),
            borderRadius: stone() / 2,
            backgroundColor: props.turn() === 1 ? "#17130f" : "#fdfbf6",
            opacity: 0.3,
            borderWidth: props.turn() === 2 ? 1 : 0,
            borderColor: "#bdb3a3",
          }}
        />
      </If>

      <If when={mark() !== undefined}>
        <View
          style={{
            position: "absolute",
            width: Math.max(9, stone() * 0.48),
            height: Math.max(9, stone() * 0.48),
            borderRadius: Math.max(9, stone() * 0.48) / 2,
            borderWidth: 2,
            borderColor:
              mark()?.tone === "white"
                ? "#fdfbf6"
                : mark()?.tone === "ink"
                  ? "#2b241c"
                  : "#c0442c",
            backgroundColor:
              mark()?.label !== undefined ? "rgba(255,253,249,0.92)" : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <If when={mark()?.label !== undefined}>
            <Text
              style={{
                fontSize: Math.max(8, stone() * 0.3),
                fontWeight: "700",
                color:
                  mark()?.tone === "white"
                    ? C_INK
                    : mark()?.tone === "ink"
                      ? C_INK
                      : C_ACCENT,
              }}
            >
              {mark()?.label ?? ""}
            </Text>
          </If>
        </View>
      </If>
    </View>
  );
}

export function Board(props: {
  size: Accessor<number>;
  n?: number;
  stars?: readonly [number, number][];
  board: Accessor<number[]>;
  last: Accessor<number>;
  winLine: Accessor<number[]>;
  dead?: Accessor<number[]>;
  marks?: Accessor<BoardMark[]>;
  hover: Accessor<number>;
  canPlay: Accessor<boolean>;
  turn: Accessor<Player>;
  onPlay: (i: number) => void;
  setHover: (i: number) => void;
  clearHover: (i: number) => void;
}) {
  const n = props.n ?? SIZE;
  const stars = props.stars ?? STARS;
  const cells: number[] = [];
  for (let i = 0; i < n * n; i++) cells.push(i);
  const noDead = computed<number[]>(() => []);
  const noMarks = computed<BoardMark[]>(() => []);
  const cell = computed(() => props.size() / n);
  const stone = computed(() => stoneDiameter(props.size(), n));

  return (
    <View
      style={{
        width: props.size(),
        height: props.size(),
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#e9c087",
        boxShadow:
          "0 12px 28px rgba(74,48,20,0.22), 0 2px 6px rgba(74,48,20,0.14)",
      }}
    >
      <Canvas
        draw={surface(n, stars)}
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: props.size(),
          height: props.size(),
        }}
      />
      <Each of={cells} key="index">
        {(i) => (
          <Cell
            i={i()}
            n={n}
            cell={cell}
            stone={stone}
            board={props.board}
            last={props.last}
            winLine={props.winLine}
            dead={props.dead ?? noDead}
            marks={props.marks ?? noMarks}
            hover={props.hover}
            canPlay={props.canPlay}
            turn={props.turn}
            onPlay={props.onPlay}
            setHover={props.setHover}
            clearHover={props.clearHover}
          />
        )}
      </Each>
    </View>
  );
}
