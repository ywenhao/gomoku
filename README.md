# 五子棋 · Gomoku

用 [Native Shell（nsh.dev）](https://nsh.dev/) 写的原生五子棋。一套 TSX 代码，跑在
**Windows 桌面、Android、iOS 和 Web** 上，每个平台用各自的系统控件与绘制（Win32 +
Direct2D / Android View / UIKit / HTML），不是 WebView 套壳。

## 玩法

- 15×15 棋盘，无禁手，五子连珠即胜（横、竖、两条斜线）。
- **人机对战**：你执黑先行，AI 执白。难度分「简单 / 普通 / 困难」。
- **双人对战**：同一台设备轮流落子（不计分，只记战绩）。
- 悔棋、重新开始；人机模式下悔棋会一次退回「你 + AI」两步。
- 最后一手有红点标记，五连的子会红圈脉冲提示。
- 桌面端鼠标悬停显示半透明落子预览；快捷键 `U` 悔棋、`R` 重开、`M` 菜单、`Esc` 关闭浮层。

## 菜单、计分与结算

**菜单**（右上角「菜单」，或 `M`）里能看到总分、单局最高、连胜、总局数与胜平负，
也能改对战模式 / AI 难度 / 限时开关，并查看最近 40 局的战绩（结果、难度、手数、用时、
时间、单局得分、星级）。「清空全部记录」需要连点两次确认，4 秒不点自动取消，清空后
总分、最高分、连胜一起归零。

**单局得分**（`lib/score.ts`，纯函数、可单测）：

| 项 | 分值 |
| --- | --- |
| 胜利基础 | 简单 100 / 普通 180 / 困难 300 |
| 速度奖励 | 用时越短越高，最高 +120（120 秒内线性衰减） |
| 效率奖励 | 手数越少越高，最高 +90（55 手内每少一手 +3） |
| 连胜奖励 | 第 2 连胜起每连胜 +15，封顶 +50 |
| 和棋 | +30 |
| 落败 | −60 |
| 悔棋 | 每次 −15 |
| 超时 | 每次 −10 |

星级：赢棋且全程没悔棋没超时、用时 ≤ 72 秒 → ★★★；没悔棋没超时 → ★★；否则 ★。
总分只增不减到 0 为止（扣成负数会让分数失去意义）。

**落子倒计时**：默认开启，每手 30 秒。选 30 秒是因为五子棋绝大多数落子都在 15 秒内
完成，30 秒足够想清楚一手，又不会让人干等；最后 8 秒进度条转红。
**超时的惩罚是「扣 10 分 + 系统替你落一手弱棋」，而不是直接判负**——既能止住拖时间，
又不至于因为一次走神毁掉整局。菜单打开时计时暂停，关掉后接着走，不会靠开关菜单刷新时间。
不想被催可以关掉限时。

**结算浮层**：卡片从 0.86 缩放到 1 弹入，星星逐颗弹跳出现，得分从 0 滚动到实际分数，
按结果给一句情绪文案，再列出计分明细、本局得分、累计总分与连胜徽章。
「看看棋盘」收起浮层保留终局，「再来一局」直接开新局。终局后不能悔棋（避免靠悔棋
翻掉已经结算的胜负）。

## 目录结构

```
gomoku/
├── App.tsx              入口：状态、计分、倒计时、AI 调度、页面布局
├── components/
│   ├── Board.tsx        棋盘：Canvas 画木纹/网格/星位 + 225 个可点击交叉点
│   ├── Menu.tsx         菜单：统计、设置、历史战绩、清空记录
│   ├── Result.tsx       结算浮层：星级/分数滚动/计分明细/连胜徽章
│   └── ui.tsx           按钮、分段控件、棋子圆点
├── lib/
│   ├── gomoku.ts        纯规则：落子、胜负判定、和棋
│   ├── score.ts         计分规则、格式化、战绩类型
│   ├── ai.ts            AI：启发式评分 + alpha-beta 搜索
│   ├── ai.test.ts       规则与 AI 单元测试
│   ├── score.test.ts    计分规则单元测试
│   └── match.test.ts    自对弈回归（强度与单步耗时）
├── App.test.tsx         界面流程测试（落子、悔棋、重开、判胜、菜单、计分、倒计时）
├── nsh.json             应用名、id、版本、图标、亮色外观
├── icon.png             应用图标（用 nsh 的 Canvas 绘制导出）
├── .github/
│   ├── workflows/build.yml    CI：检查 + 四平台打包 + tag 发 Release
│   └── actions/setup-nsh/     安装并缓存 nsh 发行包
└── dist/                打包产物（web / windows）
```

## 运行

先装 nsh（本机已通过 mise 安装）：

```sh
nsh --version          # 0.2.0
```

```sh
cd gomoku

nsh run .                    # 当前系统（Windows 上是 Win32 原生窗口）
nsh run . --target web       # 浏览器，终端会打印地址
nsh run . --target android   # 需要已启动的模拟器或已连接的设备
nsh run . --target ios       # 仅 macOS + Xcode 可用
```

保存文件会热更新，终端同时打印日志与报错。

## 测试

```sh
nsh test                 # 全部：规则、AI、计分、界面流程、自对弈
nsh test lib/score.test.ts
nsh check                # TypeScript 类型检查
```

界面测试通过 `testID` 驱动：`cell-x-y`、`stone-x-y-b`、`undo`、`restart`、
`open-menu`、`menu-close`、`seg-pve` / `seg-hard` / `seg-on`、`clear-history`、
`timer-text`、`result-restart`、`result-close`。倒计时用 `open(..., { clock: {} })`
的手动时钟 + `app.clock.fastForward(30000)` 测，不需要真等 30 秒。
`--target windows` / `--target web` 还能在真实平台上跑并截图。

## 打包

```sh
nsh package --target windows -o dist/windows   # dist/windows/五子棋/五子棋.exe + .zip
nsh package --target web     -o dist/web       # 静态站点，丢给任意服务器/CDN
nsh package --target android -o dist/android   # .apk（需 Android SDK + JDK）
nsh package --target ios     -o dist/ios       # .ipa（需 macOS + Xcode + 签名）
```

Windows 包解压后直接双击 `五子棋.exe` 即可运行（运行时在同目录的 `nsh/` 里，别分开）。

## 持续集成

`.github/workflows/build.yml` 在 `main` 的 push、PR 和手动触发时跑五个 job，推送 `v*`
tag 时额外把四个平台包发成 GitHub Release：

| Job | Runner | 产物 |
| --- | --- | --- |
| 类型检查与测试 | `ubuntu-latest` | `nsh check` + 38 个测试 |
| Windows x64 | `windows-latest` | `gomoku-windows-x64.zip` |
| Linux x64 | `ubuntu-latest` | `gomoku-linux-x64.tar.gz` |
| macOS arm64 | `macos-latest` | `gomoku-macos-arm64.zip` |
| Android | `ubuntu-latest` | `gomoku-android.apk` |

几个和 nsh 有关的注意点：

- **每个 job 只能打自己系统的包**。nsh 每个宿主系统发一份发行包，里面只有该系统
  的 runner（`runtime/<platform>/nsh-*-app`），所以 Linux 的包必须在 Linux 上打、
  macOS 的必须在 macOS 上打。`.github/actions/setup-nsh` 负责按 runner 系统装对应
  那份并缓存 `~/.nsh`。
- **macOS 只有 arm64 版**，所以用 `macos-latest`（Apple Silicon）并断言 `uname -m`；
  要 Intel 包得从源码编 nsh。产物用 `ditto` 打包，保留 bundle 里的软链与权限位。
- **Linux 包运行需要 GTK 4.14+**（Ubuntu 24.04 及以上）；打包本身只用到 `tar`。
- **Android 签名**：仓库里配好 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEY_ALIAS`、
  `ANDROID_KEYSTORE_PASSWORD` 三个 secret 就走正式签名，否则用标准 debug key
  （能装到设备上试玩，上不了商店）。
- **iOS 没放进来**：`nsh package --target ios` 需要 Apple 开发者证书与
  `.mobileprovision`，得有账号才能签，不适合默认跑在公开仓库里。要加的话在
  macOS job 里补一步 `--sign <identity> --profile <file>` 即可。

## 实现要点

**AI**（`lib/ai.ts`）
- 单点评分：以落点为中心向四个方向数连子与活端，识别活四/冲四/活三/眠三/跳型，
  双威胁加权。
- 候选点只取已有棋子周围 1~2 格，按「进攻分 + 0.92 × 防守分」排序后取前若干个，
  再做 alpha-beta 负极大值搜索：普通 2 层、困难 4 层。
- 先判「能赢就赢 / 对手成五必堵」，叶子节点对「可堵的四」做一次静态延伸，
  避免把可救的局面当成必败（这是早期版本输棋的主因）。
- 有节点数（24k）与时间（320ms）双预算，每 32 个节点检查一次；超预算立刻返回当前最优。
- 单步实测最坏约 260ms（QuickJS），远低于运行时 2s 的单次调用上限；
  即使抛错也有 `fallbackMove` 兜底，对局不会卡死。

**性能与内存**
- 棋盘用一维 `number[]`，每次落子生成新数组（不可变），每个交叉点的棋子值用
  `computed` 单独订阅，落一子只更新受影响的节点，不是整盘重绘。
- 木纹与网格用 `Canvas` 一次记录、平台原生重放，不参与每帧 JS。
- 225 个交叉点 + 最多 225 个棋子，节点数量恒定；重开/悔棋只增减棋子节点。
- 棋盘尺寸以 accessor 下传，窗口缩放时格子与棋子跟着重算，不重建 225 个节点。
- 没有全局事件监听：定时器（AI 思考、倒计时、提示条、结算滚动）都在 effect 清理函数里
  清掉，快捷键绑定随组件销毁自动解绑；AI 任务用 `round` 计数器作废旧任务。
- 每子最多 225 手，`moves` 数组有上界；战绩最多 40 条，存档一次写一个 JSON。

**存档**
- `nsh/storage` 里一个 key（`gomoku.v2`）：分数、最高分、连胜、胜平负、战绩、模式、
  难度、限时开关。加载完成后才允许写入，避免开局用默认值覆盖旧记录；坏档直接忽略。

**跨平台**
- 只用 `nsh` / `nsh/base` / `nsh/storage` / `nsh/keymap` / `nsh/device` 的跨平台 API，
  无平台分支。
- 棋盘尺寸由 `onLayout` 实测可用空间后取 `min(宽, 高, 620)`，手机竖屏、平板、
  桌面窗口自适应；`SafeAreaView` 处理刘海与状态栏。
- 菜单面板高度按 `windowSize().height` 计算并整体可滚动，小屏（320×568）也放得下。
- 悬停预览仅在鼠标平台触发（`onHoverIn` 在触摸设备上不会触发）。
