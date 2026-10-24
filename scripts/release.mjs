#!/usr/bin/env node
// 打 tag 并推送，剩下的交给 CI：build 会跑六个平台的打包，release.yml 接在
// 后面把产物挂到 Releases。这里只做三件事 —— 校验版本、校验工作区、打 tag。
//
// 用 Node 写而不是塞进 npm script，是因为要读 nsh.json 的版本号、判断 tag 是否
// 已存在，纯 shell 在 Windows 的 cmd 下跑不通。
//
//   npm run release          # 打 tag 并推送
//   npm run release:dry      # 只检查，不落任何改动

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");
const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(path.join(root, file), "utf8"));
  } catch (err) {
    fail(`读不了 ${file}：${err.message}`);
  }
}

function git(...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const app = readJson("nsh.json");
const pkg = readJson("package.json");

if (!app.version) fail("nsh.json 里没有 version");

// 两处版本号必须一致，否则打出来的包（读 nsh.json）和仓库标签（读这里）会错位。
if (pkg.version !== app.version) {
  fail(
    `版本号不一致：nsh.json 是 ${app.version}，package.json 是 ${pkg.version}\n` +
      `  改 package.json 的 version，让它跟 nsh.json 对齐`,
  );
}

const tag = `v${app.version}`;
const message = `弈境 ${app.version}`;

const dirty = git("status", "--porcelain");
if (dirty) {
  fail(`工作区有未提交的改动，先提交或 stash：\n${dirty}`);
}

if (git("tag", "--list", tag)) {
  fail(`tag ${tag} 已存在。要重发的话先删掉它：git tag -d ${tag} && git push origin :${tag}`);
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const commit = git("rev-parse", "--short", "HEAD");

console.log(`\n  版本    ${app.version}  (nsh.json / package.json 一致)`);
console.log(`  tag     ${tag}`);
console.log(`  分支    ${branch} @ ${commit}`);
console.log(`  构建号  ${app.build ?? 1}`);

if (dryRun) {
  console.log(`\n  --dry-run：什么都没做。去掉这个参数才会打 tag 并推送。\n`);
  process.exit(0);
}

git("tag", "-a", tag, "-m", message);
console.log(`\n✓ 已创建 tag ${tag}`);

git("push", "origin", tag);
console.log(`✓ 已推送，CI 会自动构建并发布：`);
console.log(`  https://github.com/${git("remote", "get-url", "origin")
  .replace(/^git@github\.com:/, "")
  .replace(/^https:\/\/github\.com\//, "")
  .replace(/\.git$/, "")}/releases/tag/${tag}\n`);
