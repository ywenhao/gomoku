#!/usr/bin/env node
// Cloudflare Pages 的构建镜像没有 nsh，而且 nsh 的 Linux runtime 要求 GTK 4.14+。
// 因此不在 Cloudflare 重复编译：直接取 GitHub Actions 为当前 package.json 版本
// 发布到 GitHub Releases 的 yijing-web.zip，再解压到 Pages 的 dist/web。
//
// 版本提交通常先推送 main，随后才创建 tag/Release。Cloudflare 被 main 推送触发
// 时资产可能还没上传，所以默认等待 10 分钟；Release 完成后 release.yml 也会
// 主动触发部署钩子，确保正式站最终指向新版本。

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const waitMs = Number(process.env.CLOUDFLARE_RELEASE_WAIT_MS ?? 10 * 60 * 1000);
const pollMs = Number(process.env.CLOUDFLARE_RELEASE_POLL_MS ?? 10 * 1000);

function fail(message) {
  throw new Error(message);
}

function positiveNumber(value, name) {
  if (!Number.isFinite(value) || value < 0) fail(`${name} 必须是非负数字`);
  return value;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    fail(`读不了 ${file}：${error.message}`);
  }
}

async function download(url, timeoutMs) {
  positiveNumber(timeoutMs, "CLOUDFLARE_RELEASE_WAIT_MS");
  positiveNumber(pollMs, "CLOUDFLARE_RELEASE_POLL_MS");
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;

  for (;;) {
    const response = await fetch(url, { redirect: "follow" });
    lastStatus = response.status;
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status !== 404) {
      fail(`下载 ${url} 失败：HTTP ${response.status}`);
    }
    if (Date.now() >= deadline) {
      fail(`等待 ${url} 超时（最后一次 HTTP ${lastStatus}）`);
    }
    console.log(`Release 资产尚未生成，${Math.round(pollMs / 1000)} 秒后重试…`);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(pollMs, Math.max(0, deadline - Date.now()))),
    );
  }
}

const pkg = readJson("package.json");
if (typeof pkg.version !== "string" || !pkg.version) {
  fail("package.json 里没有可用的 version");
}
const repo = process.env.YIJING_GITHUB_REPO ?? "ywenhao/gomoku";
const tag = `v${pkg.version}`;
const url = `https://github.com/${repo}/releases/download/${tag}/yijing-web.zip`;
const dist = path.join(root, "dist");
const output = path.join(dist, "web");
const temp = mkdtempSync(path.join(tmpdir(), "yijing-cloudflare-"));

try {
  console.log(`从 GitHub Release 获取 Web 构建：${tag}`);
  const archive = await download(url, waitMs);
  if (archive.length === 0) fail("下载到的 yijing-web.zip 为空");

  const zip = path.join(temp, "yijing-web.zip");
  const extracted = path.join(temp, "web");
  writeFileSync(zip, archive);
  mkdirSync(extracted);

  const unzip = spawnSync("unzip", ["-q", zip, "-d", extracted], {
    stdio: "inherit",
  });
  if (unzip.error) fail(`无法运行 unzip：${unzip.error.message}`);
  if (unzip.status !== 0) fail(`unzip 失败（退出码 ${unzip.status ?? "unknown"}）`);

  const index = path.join(extracted, "index.html");
  if (!existsSync(index) || !statSync(index).isFile()) {
    fail("yijing-web.zip 中没有 index.html");
  }

  rmSync(output, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(extracted, output, { recursive: true });
  console.log(`✓ Web 构建已就绪：dist/web（${tag}）`);
} catch (error) {
  console.error(`\n✗ ${error.message}\n`);
  process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
