#!/usr/bin/env node
// 自动升级版本、校验、创建发布提交与标签，并原子推送 main 和标签。
// GitHub Actions 负责五个平台的构建和 Release 附件上传。
//
// npm run release                   默认 patch
// npm run release -- minor          minor / major / 指定版本号
// npm run release:dry               预览，不修改文件、Git 或远端
// npm run release -- --retry        重试已经创建的发布提交，不再次升版

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const releaseFiles = ["package.json", "nsh.json", "CHANGELOG.md"];
const help = `用法：npm run release -- [patch|minor|major|版本号] [--dry-run]
      npm run release -- --retry [--dry-run]

默认升级 patch；同步两处版本号，构建号加一，更新 CHANGELOG。
功能代码须先提交到 main。正式发布会运行类型检查、全部测试和发布编译，
然后创建发布提交和标签，一次推送 main 与标签。--retry 不再次升版。`;

function run(command, args, inherit = false) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })?.trim() ?? "";
}

const git = (...args) => run("git", args);
const read = (file) => readFileSync(path.join(root, file), "utf8");
const write = (file, text) => writeFileSync(path.join(root, file), text, "utf8");

function fail(message) {
  throw new Error(message);
}

function versionParts(version) {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    fail(`无效版本号：${version}，请使用如 1.5.15 的正式版本号`);
  }
  const parts = version.split(".").map(Number);
  if (!parts.every(Number.isSafeInteger)) fail(`版本号过大：${version}`);
  return parts;
}

function nextVersion(current, bump) {
  const before = versionParts(current);
  const index = ["major", "minor", "patch"].indexOf(bump);
  const after = index < 0
    ? versionParts(bump.replace(/^v/, ""))
    : before.map((n, i) => i < index ? n : i === index ? n + 1 : 0);
  const next = after.join(".");
  versionParts(next);
  const changed = after.findIndex((n, i) => n !== before[i]);
  if (changed < 0 || after[changed] < before[changed]) fail(`新版本 ${next} 必须大于 ${current}`);
  return next;
}

function assertClean() {
  const dirty = git("status", "--porcelain");
  if (dirty) fail(`工作区有未提交的改动，请先提交功能代码：\n${dirty}`);
}

function hasTag(tag) {
  return git("tag", "--list", tag) === tag;
}

function changelogFor(text, current, next) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const normalized = text.replace(/\r\n/g, "\n");
  if (normalized.split("\n").some((line) => line.trim() === `## ${next}`)) {
    fail(`CHANGELOG.md 已有 ${next}，请把待发布说明放在「## 未发布」下`);
  }
  const unreleased = /^## (?:未发布|Unreleased)[ \t]*$/mi;
  const heading = unreleased.exec(normalized);
  if (heading) {
    const body = normalized.slice(heading.index + heading[0].length).split(/^## /m)[0].trim();
    if (!body) fail("CHANGELOG.md 的未发布说明为空，请先补充并提交");
    return normalized.replace(unreleased, `## ${next}`).replace(/\n/g, eol);
  }
  const range = hasTag(`v${current}`) ? `v${current}..HEAD` : "HEAD";
  const notes = git("log", "--no-merges", "--reverse", "--format=%s", range)
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("chore(release):"));
  if (notes.length === 0) fail("当前版本发布后没有新的提交，无需重复发布");
  const section = `## ${next}\n\n${notes.map((line) => `- ${line}`).join("\n")}\n\n`;
  const first = normalized.search(/^## /m);
  const updated = first < 0
    ? `${normalized.trimEnd()}\n\n${section}`
    : normalized.slice(0, first) + section + normalized.slice(first);
  return updated.replace(/\n/g, eol);
}

function verify() {
  // 用 npm 的 JS 入口跨平台执行，不经过 Windows 的 .cmd / shell 转义。
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, "run", "verify"], true);
    run(process.execPath, [process.env.npm_execpath, "run", "build:release"], true);
  } else {
    run("nsh", ["check"], true);
    run("nsh", ["test"], true);
    run("nsh", ["build", ".", "--release"], true);
  }
}

function publish(tag) {
  try {
    git("push", "--atomic", "origin", "HEAD:refs/heads/main", `refs/tags/${tag}`);
  } catch (error) {
    console.error("发布提交和标签已保留；解决推送错误后运行 npm run release -- --retry。");
    throw error;
  }
  const remote = git("remote", "get-url", "origin");
  const repo = remote.match(/^(?:git@github\.com:|https:\/\/github\.com\/)([^/]+\/.+?)(?:\.git)?$/)?.[1];
  console.log(`\n✓ 已原子推送 main 和 ${tag}，GitHub Actions 将构建并发布五个平台。`);
  if (repo) console.log(`  https://github.com/${repo}/releases/tag/${tag}`);
  console.log("  发布完成以 Release 出现且五个附件上传成功为准。\n");
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(help);
    return;
  }
  const dryRun = args.includes("--dry-run");
  const retry = args.includes("--retry");
  const positional = args.filter((arg) => !["--dry-run", "--retry"].includes(arg));
  if (positional.length > 1 || positional.some((arg) => arg.startsWith("-")) || (retry && positional.length)) {
    fail(help);
  }

  assertClean();
  if (git("branch", "--show-current") !== "main") fail("请切换到 main 后发布");
  const originals = Object.fromEntries(releaseFiles.map((file) => [file, read(file)]));
  const app = JSON.parse(originals["nsh.json"]);
  const pkg = JSON.parse(originals["package.json"]);
  versionParts(app.version);
  if (pkg.version !== app.version) fail("nsh.json 与 package.json 版本不一致，请先修正");
  if (!Number.isSafeInteger(app.build) || app.build < 1 || app.build > (retry ? 2100000000 : 2099999999)) {
    fail("nsh.json 的 build 必须是有效的 Android 构建号，且升级后不超过 2100000000");
  }
  const version = retry ? app.version : nextVersion(app.version, positional[0] ?? "patch");
  const tag = `v${version}`;
  const message = `chore(release): ${tag}`;
  const head = git("rev-parse", "HEAD");

  // 正式执行才 fetch；dry-run 不修改远端跟踪分支或本地标签。
  if (!dryRun) {
    git("fetch", "origin", "main", "--tags");
    git("merge-base", "--is-ancestor", "refs/remotes/origin/main", "HEAD");
  }
  const remoteRefs = git("ls-remote", "origin", "refs/heads/main", `refs/tags/${tag}`);
  if (!retry && (hasTag(tag) || remoteRefs.split("\n").some((line) => line.endsWith(`\trefs/tags/${tag}`)))) {
    fail(`标签 ${tag} 已存在，请选择更高版本；重试刚才的发布请使用 --retry`);
  }
  if (retry) {
    if (git("log", "-1", "--format=%s") !== message) fail("--retry 只能重试当前 HEAD 的自动发布提交");
    if (hasTag(tag) && git("rev-list", "-n", "1", tag) !== head) fail(`${tag} 未指向当前发布提交`);
  }
  const changes = retry ? {} : {
    "package.json": JSON.stringify({ ...pkg, version }, null, 2) + "\n",
    "nsh.json": JSON.stringify({ ...app, version, build: app.build + 1 }, null, 2) + "\n",
    "CHANGELOG.md": changelogFor(originals["CHANGELOG.md"], app.version, version),
  };

  console.log(`\n  版本    ${retry ? version : `${app.version} → ${version}`}`);
  console.log(`  构建号  ${retry ? app.build : `${app.build} → ${app.build + 1}`}`);
  console.log(`  分支    main @ ${head.slice(0, 7)}\n  标签    ${tag}`);
  if (dryRun) {
    console.log(retry ? "\n  将重试推送现有发布提交和标签。" : "\n  将更新版本与 CHANGELOG，校验、提交、打标签，再原子推送。");
    console.log("  --dry-run：未修改文件、提交、标签或远端。\n");
    return;
  }

  if (!retry) {
    let staged = false;
    let committed = false;
    try {
      for (const [file, content] of Object.entries(changes)) write(file, content);
      verify();
      if (git("rev-parse", "HEAD") !== head) fail("校验期间 HEAD 已变化，停止发布");
      const dirty = git("diff", "--name-only").split(/\r?\n/).filter(Boolean);
      if (dirty.some((file) => !releaseFiles.includes(file)) || git("diff", "--cached", "--name-only") || git("ls-files", "--others", "--exclude-standard")) {
        fail("校验期间出现其他改动，停止发布，请先检查工作区");
      }
      if (releaseFiles.some((file) => read(file) !== changes[file])) fail("校验期间发布文件被修改，停止发布");
      git("add", "--", ...releaseFiles);
      staged = true;
      git("commit", "-m", message);
      committed = true;
    } catch (error) {
      if (!committed) {
        if (staged) git("restore", "--staged", "--", ...releaseFiles);
        for (const file of releaseFiles) {
          // 不覆盖校验过程中用户或工具产生的额外修改。
          if (read(file) === changes[file]) write(file, originals[file]);
        }
      }
      throw error;
    }
  }
  try {
    if (!hasTag(tag)) git("tag", "-a", tag, "-m", `弈境 ${version}`);
  } catch (error) {
    console.error("发布提交已保留；解决标签错误后运行 npm run release -- --retry。");
    throw error;
  }
  publish(tag);
}

try {
  main();
} catch (error) {
  console.error(`\n✗ ${error.stderr?.toString().trim() || error.message}\n`);
  process.exitCode = 1;
}
