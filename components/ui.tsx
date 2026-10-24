import { Text, View, effect, signal, type Accessor } from "nsh";

/** 全局配色：暖木色棋盘 + 纸感背景 */
export const C = {
  bg: "#f7f2e8",
  panel: "#fffdf9",
  ink: "#2b241c",
  muted: "#8d8173",
  line: "#e7ddcc",
  accent: "#c0442c",
  accentSoft: "#f7e4de",
  white: "#ffffff",
} as const;

export function PressButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "default" | "primary";
  grow?: boolean;
  hint?: string;
  subLabel?: string;
  testID?: string;
}) {
  const primary = props.tone === "primary";
  return (
    <View
      role="button"
      testID={props.testID}
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={!!props.disabled}
      onPress={props.onPress}
      style={{
        flexGrow: props.grow ? 1 : 0,
        flexBasis: props.grow ? 0 : "auto",
        paddingVertical: 11,
        paddingHorizontal: 18,
        borderRadius: 12,
        backgroundColor: primary ? C.ink : C.panel,
        borderWidth: primary ? 0 : 1,
        borderColor: C.line,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: primary
          ? "0 3px 8px rgba(58,40,22,0.20)"
          : "0 1px 2px rgba(58,40,22,0.07)",
      }}
      activeStyle={{ opacity: 0.7 }}
      disabledStyle={{ opacity: 0.36 }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: primary ? "#fdfaf3" : C.ink,
        }}
      >
        {props.label}
      </Text>
      <If when={props.subLabel}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "500",
            color: primary ? "#e9dfd2" : C.muted,
            marginTop: 3,
            textAlign: "center",
            fontVariant: ["tabular-nums"],
          }}
        >
          {props.subLabel}
        </Text>
      </If>
    </View>
  );
}

/** 需要连点两次才执行的按钮，用来防误触退出 / 清空。 */
export function ConfirmButton(props: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  hint?: string;
  tone?: "default" | "primary";
  grow?: boolean;
  testID?: string;
  confirmMs?: number;
  disabled?: boolean;
}) {
  const confirming = signal(false);

  effect(() => {
    if (!confirming()) return;
    const timer = setTimeout(
      () => confirming.set(false),
      props.confirmMs ?? 4000,
    );
    return () => clearTimeout(timer);
  });

  return (
    <PressButton
      label={confirming() ? props.confirmLabel : props.label}
      disabled={props.disabled}
      hint={confirming() ? "再点一次确认" : props.hint}
      tone={props.tone}
      grow={props.grow}
      testID={props.testID}
      onPress={() => {
        if (props.disabled) return;
        if (!confirming()) {
          confirming.set(true);
          return;
        }
        confirming.set(false);
        props.onConfirm();
      }}
    />
  );
}

export function Segmented<T extends string>(props: {
  value: Accessor<T>;
  options: readonly { key: T; label: string }[];
  onChange: (key: T) => void;
  compact?: boolean;
  /** testID 前缀，默认 seg；同一屏放多组分段控件时用来避免重名 */
  idPrefix?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "rgba(58,40,22,0.07)",
        borderRadius: 11,
        padding: 3,
        gap: 2,
      }}
    >
      <Each of={props.options} key={(o) => o.key}>
        {(opt) => (
          <View
            role="button"
            testID={`${props.idPrefix ?? "seg"}-${opt().key}`}
            accessibilityLabel={opt().label}
            accessibilityState={{ selected: props.value() === opt().key }}
            onPress={() => props.onChange(opt().key)}
            style={{
              paddingVertical: props.compact ? 5 : 7,
              paddingHorizontal: props.compact ? 9 : 13,
              borderRadius: 9,
              backgroundColor:
                props.value() === opt().key ? C.panel : "transparent",
              boxShadow:
                props.value() === opt().key
                  ? "0 1px 3px rgba(58,40,22,0.16)"
                  : "none",
            }}
            activeStyle={{ opacity: 0.65 }}
          >
            <Text
              style={{
                fontSize: props.compact ? 12 : 13,
                fontWeight: "600",
                color: props.value() === opt().key ? C.ink : C.muted,
              }}
            >
              {opt().label}
            </Text>
          </View>
        )}
      </Each>
    </View>
  );
}

/** 棋子圆点（用于状态条、图例） */
export function StoneDot(props: {
  player: 1 | 2;
  size: number;
  dim?: boolean;
}) {
  return (
    <View
      style={{
        width: props.size,
        height: props.size,
        borderRadius: props.size / 2,
        backgroundColor: props.player === 1 ? "#17130f" : "#fbf9f4",
        borderWidth: props.player === 2 ? 1 : 0,
        borderColor: "#cfc6b6",
        opacity: props.dim ? 0.35 : 1,
      }}
    />
  );
}
