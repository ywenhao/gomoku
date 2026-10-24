import { expect, test } from "nsh/test";
import { EMPTY_STUDY, addStudyId, readStudy } from "./study";

test("空值、坏 JSON 和非对象都读成空进度", () => {
  expect(readStudy(null)).toEqual(EMPTY_STUDY);
  expect(readStudy("")).toEqual(EMPTY_STUDY);
  expect(readStudy("not json")).toEqual(EMPTY_STUDY);
  expect(readStudy("[]")).toEqual(EMPTY_STUDY);
  expect(readStudy("42")).toEqual(EMPTY_STUDY);
  expect(readStudy(JSON.stringify({ tsumego: "easy-001" }))).toEqual(
    EMPTY_STUDY,
  );
});

test("进度会去重，并丢掉空字符串与非字符串", () => {
  const progress = readStudy(
    JSON.stringify({
      tsumego: ["easy-001", "easy-001", "", 3, null, "easy-002"],
      lessons: ["b1", "b1", "  ", "n1"],
    }),
  );
  expect(progress.tsumego).toEqual(["easy-001", "easy-002"]);
  expect(progress.lessons).toEqual(["b1", "n1"]);
});

test("进度最多保留 2000 个 id", () => {
  const many = Array.from({ length: 2100 }, (_, i) => `p-${i}`);
  const progress = readStudy(JSON.stringify({ tsumego: many, lessons: many }));
  expect(progress.tsumego.length).toBe(2000);
  expect(progress.lessons.length).toBe(2000);
  expect(progress.tsumego[0]).toBe("p-0");
  expect(progress.tsumego[1999]).toBe("p-1999");
});

test("addStudyId 会忽略空 id 与重复 id，否则追加", () => {
  const list = ["b1", "b2"];
  expect(addStudyId(list, "")).toBe(list);
  expect(addStudyId(list, "b1")).toBe(list);
  expect(addStudyId(list, " b3 ")).toEqual(["b1", "b2", "b3"]);
  expect(list).toEqual(["b1", "b2"]);
});
