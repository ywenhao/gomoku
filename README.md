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
- 落子、最后 5 秒滴答、超时、胜 / 负 / 和结算都有音效；音频由代码合成，不打包音频资源。
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
完成，30 秒足够想清楚一手，又不会让人干等；最后 5 秒进度条边框转红并闪烁、每秒滴答
一声，让人知道该落子了。
**超时的惩罚是「扣 10 分 + 系统替你落一手弱棋」，而不是直接判负**——既能止住拖时间，
又不至于因为一次走神毁掉整局。人机 / 双人这类本地对局在菜单打开时计时暂停，关掉后接着
走，不会靠开关菜单刷新时间；将来接入联网对局时，菜单不会暂停计时。不想被催可以关掉限时。

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
│   ├── Sound.tsx        隐藏的音效播放器（每个音效一个 Video）
│   └── ui.tsx           按钮、分段控件、棋子圆点
├── lib/
│   ├── gomoku.ts        纯规则：落子、胜负判定、和棋
│   ├── score.ts         计分规则、格式化、战绩类型
│   ├── ai.ts            AI：启发式评分 + alpha-beta 搜索
│   ├── sound.ts         代码合成 WAV 音效（落子/滴答/超时/胜负和）
│   ├── ai.test.ts       规则与 AI 单元测试
│   ├── score.test.ts    计分规则单元测试
│   ├── sound.test.ts    WAV 头、时长与峰值测试
│   └── match.test.ts    自对弈回归（强度与单步耗时）
├── App.test.tsx         界面流程测试（落子、悔棋、重开、判胜、菜单、计分、倒计时、音效）
├── nsh.json             应用名、id、版本、图标、亮色外观与能力（版本号的唯一来源）
├── package.json         只有 scripts，没有依赖：命令别名 + 版本号镜像
├── scripts/
│   ├── release.mjs      校验版本 / 工作区 / tag，然后打 tag 并推送
│   └── clean.mjs        删 dist/（--all 连 .nsh/、.shots/ 一起）
├── icon.png             应用图标（用 nsh 的 Canvas 绘制导出）
├── .github/
│   ├── workflows/build.yml    CI：检查 + 六平台打包，上传 artifact
│   ├── workflows/release.yml  把 tag 的构建产物发到 Releases
│   └── actions/setup-nsh/     安装并缓存 nsh 发行包
└── dist/                本地打包产物（CI 的产物在 Releases）
```

## 命令

常用命令都收在 `package.json` 里，`npm run <name>` 就行；右列是它实际执行的
nsh 命令 —— **`npm` 只是别名，不是依赖**，项目没有 `dependencies`，不装 Node
也能直接用右边的命令。

| script | 实际执行 | 用途 |
| --- | --- | --- |
| `npm run dev` | `nsh run .` | 当前系统的原生窗口（Windows 上是 Win32），热更新 |
| `npm run dev:web` | `nsh run . --target web` | 浏览器，终端会打印地址 |
| `npm run dev:android` | `nsh run . --target android` | 需要已启动的模拟器或已连接的设备 |
| `npm run dev:ios` | `nsh run . --target ios` | 仅 macOS + Xcode 可用 |
| `npm run check` | `nsh check` | TypeScript 类型检查 |
| `npm test` | `nsh test` | 全部 43 个测试 |
| `npm test -- lib/score.test.ts` | `nsh test lib/score.test.ts` | 只跑一个文件 |
| `npm run verify` | `nsh check` + `nsh test` | 提交前跑一遍 |
| `npm run build` | `nsh build .` | 编译成 QuickJS 字节码，不打包 |
| `npm run build:release` | `nsh build . --release` | 同上，压缩并去掉调试信息 |
| `npm run package:windows` | `nsh package --target windows -o dist/windows` | `五子棋/` + `五子棋.zip` |
| `npm run package:linux` | `nsh package --target linux -o dist/linux` | `五子棋/` + `五子棋.tar.gz` |
| `npm run package:macos` | `nsh package --target macos -o dist/macos` | ad hoc 签名的 `五子棋.app` |
| `npm run package:android` | `nsh package --target android -o dist/android` | `.apk`（需 Android SDK + JDK） |
| `npm run package:web` | `nsh package --target web -o dist/web` | 静态站点，丢给任意服务器 / CDN |
| `npm run package:ios` | `nsh package --target ios -o dist/ios` | `.ipa`（需 macOS + Xcode + 签名） |
| `npm run clean` | — | 删 `dist/` |
| `npm run clean:all` | — | 连 `.nsh/`（编译缓存）、`.shots/` 一起删 |
| `npm run release:dry` | — | 只检查版本、tag、工作区，不落改动 |
| `npm run release` | — | 打 tag 并推送，CI 自动构建 + 发 Release |

前提是 `nsh` 在 PATH 里（`nsh --version` 应输出 `0.2.0`）。本机是 `mise use -g
github:longbridge/nsh` 装的，shim 在 `~/.local/share/mise/shims`，没进 PATH 的话
`npm run` 会报 `nsh: command not found`。

`release` 与 `clean` 是 `scripts/` 下的 Node 脚本：前者要读 `nsh.json` 的版本、
核对 `package.json` 是否一致、判断 tag 有没有被占，纯 shell 在 Windows 的 cmd
下跑不通；后者只是为了让三个系统共用一条删除命令。

保存文件会热更新，终端同时打印日志与报错。

## 测试

```sh
npm run verify           # check + test
nsh test                 # 只跑测试：规则、AI、计分、音效、界面流程、自对弈
nsh test lib/score.test.ts
nsh check                # TypeScript 类型检查
```

界面测试通过 `testID` 驱动：`cell-x-y`、`stone-x-y-b`、`undo`、`restart`、
`open-menu`、`menu-close`、`seg-pve` / `seg-hard` / `seg-on`、`clear-history`、
`timer-text`、`timer-track` / `timer-urgent`、`sound-place` 等、`result-restart`、
`result-close`。倒计时用 `open(..., { clock: {} })` 的手动时钟 +
`app.clock.fastForward(30000)` 测，不需要真等 30 秒。
`--target windows` / `--target web` 还能在真实平台上跑并截图。

## 打包

```sh
npm run package:windows   # → dist/windows/五子棋/五子棋.exe 和 五子棋.zip
npm run package:web       # → dist/web/五子棋/（index.html + 内容哈希资源）
npm run package:android   # → dist/android/五子棋.apk（需 Android SDK + JDK）
npm run package:ios       # → dist/ios/五子棋.ipa（需 macOS + Xcode + 签名）
```

**只能在目标系统上打对应的包**：nsh 每个宿主系统发一份发行包，里面只有该系统的
runner，所以在 Windows 上 `package:linux` 会报 `nsh-linux-app not found`。跨平台
构建交给 CI（见下）。

Windows 包解压后直接双击 `五子棋.exe` 即可运行（运行时在同目录的 `nsh/` 里，别分开）。
懒得自己打的话，直接去 [Releases](https://github.com/ywenhao/gomoku/releases) 下现成的：
五个平台的包都在那儿，`gomoku-web.zip` 解压后随便起个静态服务器就能在浏览器里玩
（需要 http，双击 `index.html` 不行）。

## 持续集成

两个 workflow：`build.yml` 只负责构建并上传 artifact，`release.yml` 负责发到
[Releases](https://github.com/ywenhao/gomoku/releases)。`build.yml` 在 `main` 的 push、
PR 和手动触发时跑六个 job：

| Job | Runner | 产物 |
| --- | --- | --- |
| 类型检查与测试 | `ubuntu-24.04` | `nsh check` + 43 个测试 |
| Windows x64 | `windows-2025` | `gomoku-windows-x64.zip` |
| Linux x64 | `ubuntu-24.04` | `gomoku-linux-x64.tar.gz` |
| macOS arm64 | `macos-26` | `gomoku-macos-arm64.zip` |
| Android | `ubuntu-24.04` | `gomoku-android.apk` |
| Web | `ubuntu-24.04` | `gomoku-web.zip`（静态站点） |

**发版**：推一个 `v*` tag，`build` 会跑完六个 job，`release.yml` 通过 `workflow_run`
接在它后面，用那次 build 的 run-id 跨 run 取回 artifact，挂到同名 tag 的 Release 上
（`generate_release_notes` 自动生成说明）。非 tag 的构建跑完也会触发 `release.yml`，
但 `if` 判断 `head_branch` 不是 `v*` 就直接跳过，不会误发。

```sh
# 改 nsh.json 和 package.json 里的 version，提交，然后：
npm run release:dry      # 只检查：版本是否一致、工作区是否干净、tag 是否被占
npm run release          # 打 tag 并推送，剩下的交给 CI
```

等价的手动命令是 `git tag -a v1.0.1 -m "五子棋 1.0.1" && git push origin v1.0.1`。

要补发历史版本时，用 `workflow_dispatch` 手动填 build 的 run id 和 tag 名
（artifact 只保留 90 天，过期了得重新推 tag）。

几个和 nsh 有关的注意点：

- **版本都钉死了**。runner 镜像写具体版本而不是 `-latest`（`ubuntu-latest` 正要从
  24.04 迁到 26.04，Android SDK 路径和预装组件都会跟着变），action 用声明 `node24`
  的大版本：`checkout@v7`、`cache@v6`、`upload-artifact@v7`、`download-artifact@v8`、
  `setup-java@v6`、`action-gh-release@v3`（注意 upload-artifact 要到 v7、
  download-artifact 要到 v8 才换掉 node20）。
- **项目本身不跑 Node**，没有 `package.json`，打包 / 类型检查 / 测试全在 nsh 这一个
  二进制里，所以 workflow 里没有 `actions/setup-node`。CI 日志里出现的 Node 是各个
  action 自己的运行时，不是本项目的依赖。
- **每个 job 只能打自己系统的包**。nsh 每个宿主系统发一份发行包，里面只有该系统
  的 runner（`runtime/<platform>/nsh-*-app`），所以 Linux 的包必须在 Linux 上打、
  macOS 的必须在 macOS 上打。`.github/actions/setup-nsh` 负责按 runner 系统装对应
  那份并缓存 `~/.nsh`。
- **macOS 只有 arm64 版**，所以用 `macos-26`（Apple Silicon）并断言 `uname -m`；
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

**音效**（`lib/sound.ts` + `components/Sound.tsx`）
- 不打包音频、不加依赖：启动时用代码合成 6 段 22.05kHz / 单声道 / 16-bit PCM WAV
  （落子、滴答、超时、胜、负、和），每段按峰值归一化，再缓存起来。
- 原生把 WAV 写到 `<dataDir>/sounds/gomoku-<name>-v1.wav`，把**绝对路径**交给
  1×1 的隐藏 `Video` 播放；Web 直接生成 Blob URL。某个文件写失败只会少了那个音效。
  这里不能用 `file://`：声明了 `capabilities` 后，nsh 的媒体地址检查只放行
  http(s)、`asset:`、`data:` 和相对/绝对路径，`file://` 会被拒绝且没有声音。
- 最后 5 秒每秒滴答一次，菜单暂停期间不补响；Web 在第一次触摸时静音预播一次，
  避开浏览器的自动播放限制。

**性能与内存**
- 棋盘用一维 `number[]`，每次落子生成新数组（不可变），每个交叉点的棋子值用
  `computed` 单独订阅，落一子只更新受影响的节点，不是整盘重绘。
- 木纹与网格用 `Canvas` 一次记录、平台原生重放，不参与每帧 JS。
- 225 个交叉点 + 最多 225 个棋子，节点数量恒定；重开/悔棋只增减棋子节点。
- 棋盘尺寸以 accessor 下传，窗口缩放时格子与棋子跟着重算，不重建 225 个节点。
- 没有全局事件监听：定时器（AI 思考、倒计时、提示条、结算滚动）都在 effect 清理函数里
  清掉，快捷键绑定随组件销毁自动解绑；AI 任务用 `round` 计数器作废旧任务。
- 每子最多 225 手，`moves` 数组有上界；战绩最多 40 条，存档一次写一个 JSON。

**存档与权限**
- `nsh/storage` 里一个 key（`gomoku.v2`）：分数、最高分、连胜、胜平负、战绩、模式、
  难度、限时开关。加载完成后才允许写入，避免开局用默认值覆盖旧记录；坏档直接忽略。
- `nsh.json` 只声明两样能力：`fs.read` / `fs.write` 限定在 `${dataDir}`（写音效文件）
  和 `statusBar`（亮色状态栏）；没有网络权限。

**跨平台**
- 只用 `nsh` / `nsh/base` / `nsh/storage` / `nsh/keymap` / `nsh/device` 的跨平台 API；
  唯一的平台分支是音效地址（原生落地文件 / Web 用 Blob URL）。
- 棋盘尺寸由 `onLayout` 实测可用空间后取 `min(宽, 高, 620)`，手机竖屏、平板、
  桌面窗口自适应；`SafeAreaView` 处理刘海与状态栏。
- 菜单面板高度按 `windowSize().height` 计算并整体可滚动，小屏（320×568）也放得下。
- 悬停预览仅在鼠标平台触发（`onHoverIn` 在触摸设备上不会触发）。
