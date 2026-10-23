import { Text, View, type Accessor } from "nsh";

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
    </View>
  );
}

export function Segmented<T extends string>(props: {
  value: Accessor<T>;
  options: readonly { key: T; label: string }[];
  onChange: (key: T) => void;
  compact?: boolean;
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
            testID={`seg-${opt().key}`}
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
export function StoneDot(props: { player: 1 | 2; size: number; dim?: boolean }) {
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
