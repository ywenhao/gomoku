import { readFile, writeFile, readdir, copyFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
const root = process.argv[2];
if (!root)
  throw new Error(
    "Usage: node scripts/build-xiangqi-puzzles.mjs <xiangqi-pwa-offline checkout>",
  );
const source = stripTypeScriptTypes(
  await readFile("lib/royal.ts", "utf8"),
).replace(/^import .*gomoku.*;$/m, "const other=p=>p===1?2:1;");
const { fromFen, playRoyal, royalLegalMoves, inCheck } = await import(
  "data:text/javascript," + encodeURIComponent(source)
);
const files = [
  "basic-checkmates.json",
  "advanced-checkmates.json",
  ...(await readdir(join(root, "Chess Patterns")))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join("Chess Patterns", f)),
];
const rows = [],
  seen = new Set();
for (const file of files) {
  const data = JSON.parse(await readFile(join(root, file), "utf8"));
  for (const item of data) {
    if (!item.fen || seen.has(item.fen)) continue;
    const state = fromFen("xiangqi", item.fen);
    if (!state || !royalLegalMoves(state).length) continue;
    seen.add(item.fen);
    const title = (
      item.name ?? file.replace(/^.*\//, "").replace(".json", "")
    ).replace(/ - 基本杀法$/, "");
    rows.push({
      id: `xq-${rows.length + 1}`,
      name: title,
      fen: item.fen,
      category: file.includes("checkmates") ? "经典杀法" : "实用残局",
      proof: null,
    });
  }
}
const chosen = rows.slice(0, 900);
let solved = 0;
function prove(s, depth, attacker, deadline) {
  if (Date.now() > deadline) return null;
  if (s.result) return s.result.winner === attacker ? { end: true } : null;
  if (depth <= 0 || s.turn !== attacker) return null;
  for (const m of royalLegalMoves(s)) {
    const n = playRoyal(s, m);
    if (n.result?.winner === attacker) return { move: m, responses: [] };
    if (depth < 3 || !inCheck(n)) continue;
    const responses = [];
    let ok = true;
    for (const reply of royalLegalMoves(n)) {
      const after = playRoyal(n, reply),
        child = prove(after, depth - 2, attacker, deadline);
      if (!child) {
        ok = false;
        break;
      }
      responses.push({ move: reply, node: child });
    }
    if (ok && responses.length) return { move: m, responses };
    if (Date.now() > deadline) return null;
  }
  return null;
}
for (const row of chosen) {
  const s = fromFen("xiangqi", row.fen);
  row.proof = prove(s, 1, s.turn, Date.now() + 100);
  if (!row.proof && row.category === "经典杀法")
    row.proof = prove(s, 3, s.turn, Date.now() + 80);
  if (row.proof) {
    solved++;
    row.category = "杀法挑战";
  }
}
await writeFile(
  "lib/data/xiangqi-puzzles.ts",
  `/** Adapted from dffge552/xiangqi-pwa-offline (MIT). Generated; see XIANGQI-PROBLEMS-LICENSE.txt. */\nimport type {RoyalMove} from "../royal";\nexport interface MateProof {move:RoyalMove;responses:{move:RoyalMove;node:MateProof}[]}\nexport interface XiangqiPuzzle {id:string;name:string;fen:string;category:string;proof:MateProof|null}\nexport const XIANGQI_PUZZLES:readonly XiangqiPuzzle[]=${JSON.stringify(chosen)};\n`,
);
await copyFile(join(root, "LICENSE"), "lib/data/XIANGQI-PROBLEMS-LICENSE.txt");
console.log(
  `${chosen.length} validated positions, ${solved} with a verified forced mate, ${rows.length} valid source positions`,
);
