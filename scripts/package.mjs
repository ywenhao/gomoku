#!/usr/bin/env node
// 统一各平台的打包输出目录。
//
//   node scripts/package.mjs <target> [nsh package 的额外参数...]
//
// nsh 默认输出 <out>/<应用名>/（Windows 和 Linux 还会多一个同名的归档），
// 这里先在 dist 内的临时目录完成打包，再把真正的应用内容移到 dist/<target>。
// web/windows/linux 去掉应用名这一层；macOS、Android、iOS 则把 .app/.apk/.ipa
// 作为文件直接放进对应平台目录。临时目录只在全部成功后才替换正式输出，因此
// 构建失败不会破坏上一次可用的 dist。

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const targets = new Set([
  "windows",
  "linux",
  "macos",
  "android",
  "ios",
  "ios-simulator",
  "web",
]);
const flatTargets = new Set(["windows", "linux", "web"]);

function fail(message) {
  throw new Error(message);
}

function moveChildren(from, to) {
  const entries = readdirSync(from);
  for (const entry of entries) {
    renameSync(path.join(from, entry), path.join(to, entry));
  }
  return entries;
}

const [target, ...extraArgs] = process.argv.slice(2);
if (!target || !targets.has(target)) {
  console.error(
    `用法：node scripts/package.mjs <${[...targets].join("|")}> [nsh package 的额外参数...]`,
  );
  process.exit(1);
}

const app = JSON.parse(readFileSync(path.join(root, "nsh.json"), "utf8"));
if (typeof app.name !== "string" || !app.name) {
  fail("nsh.json 里没有可用的 name");
}

const dist = path.join(root, "dist");
mkdirSync(dist, { recursive: true });
const stage = mkdtempSync(path.join(dist, `.package-${target}-`));

try {
  const raw = path.join(stage, "raw");
  const prepared = path.join(stage, "prepared");
  mkdirSync(raw);
  mkdirSync(prepared);

  const result = spawnSync(
    "nsh",
    ["package", "--target", target, "-o", raw, ...extraArgs, "."],
    { cwd: root, env: process.env, stdio: "inherit" },
  );
  if (result.error) {
    fail(`无法运行 nsh：${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`nsh package 失败（退出码 ${result.status ?? "unknown"}）`);
  }

  let moved;
  if (flatTargets.has(target)) {
    const generated = path.join(raw, app.name);
    if (!existsSync(generated) || !statSync(generated).isDirectory()) {
      fail(`nsh 没有在临时输出中创建 ${app.name}/`);
    }
    moved = moveChildren(generated, prepared);
  } else {
    moved = moveChildren(raw, prepared);
  }
  if (moved.length === 0) {
    fail("nsh 没有生成任何打包产物");
  }

  const output = path.join(dist, target);
  rmSync(output, { recursive: true, force: true });
  renameSync(prepared, output);

  const relative = path.relative(root, output).split(path.sep).join("/");
  const entries = readdirSync(output).sort();
  const shown = entries.slice(0, 6).join("  ");
  console.log(`✓ 打包输出：${relative}/`);
  console.log(`  ${shown}${entries.length > 6 ? `  …（共 ${entries.length} 项）` : ""}`);
} catch (error) {
  rmSync(stage, { recursive: true, force: true });
  console.error(`\n✗ ${error.message}\n`);
  process.exit(1);
}

rmSync(stage, { recursive: true, force: true });
