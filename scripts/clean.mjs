#!/usr/bin/env node
// 清理构建产物。
//
//   npm run clean        # 只删 dist/（打包结果）
//   npm run clean:all    # 连 .nsh/（编译缓存）和 .shots/（截图）一起删
//
// 用 Node 而不是 rm -rf / rd /s，是为了在三个系统上是同一条命令。

import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const all = process.argv.includes("--all");
const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

const targets = all ? ["dist", ".nsh", ".shots"] : ["dist"];
let removed = 0;

for (const name of targets) {
  const dir = path.join(root, name);
  if (!existsSync(dir)) {
    console.log(`- ${name}/ 不存在，跳过`);
    continue;
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(`✓ 删除 ${name}/`);
  removed++;
}

// .nsh/ 里是 bundle 与字节码缓存，删掉后下一次 nsh 命令会重新编译（多几秒）。
if (all && removed > 0) {
  console.log("\n  .nsh/ 已清空，下次运行 nsh 会重新编译。\n");
}
