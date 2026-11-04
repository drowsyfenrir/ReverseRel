const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(__dirname, "버전 정보 정리.txt");
const dataPath = path.join(root, "story-data.json");
const source = fs.readFileSync(sourcePath, "utf8").replace(/\r/g, "");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const blockPattern = /메인 버전\s+([^\n]+)\n챕터\s+(\d+)\n챕터명\s+([^\n]*)\n년도\s+([^\n]*)\n월\s+([^\n]*)\n일\s+([^\n]*)\n시간\s+([^\n]*)\n분\s+([^\n]*)/g;
const records = Array.from(source.matchAll(blockPattern), (match) => ({
  version: match[1].trim(),
  chapterNumber: Number(match[2]),
  chapterName: match[3].trim(),
  time: {
    year: match[4].trim(),
    month: normalizePart(match[5]),
    day: normalizePart(match[6]),
    hour: normalizePart(match[7]),
    minute: normalizePart(match[8])
  }
}));

const recordsByVersion = new Map();
records.forEach((record) => {
  if (!recordsByVersion.has(record.version)) recordsByVersion.set(record.version, []);
  recordsByVersion.get(record.version).push(record);
});

let updatedVersions = 0;
let addedChapters = 0;
for (const version of data.versions || []) {
  if (version.type !== "main") continue;
  const versionRecords = recordsByVersion.get(String(version.version));
  if (!versionRecords) continue;
  versionRecords.sort((left, right) => left.chapterNumber - right.chapterNumber);
  versionRecords.forEach((record) => {
    const index = record.chapterNumber - 1;
    if (!version.chapters[index]) {
      version.chapters[index] = {
        id: `${version.id}-chapter-${record.chapterNumber}`,
        chapterName: "",
        time: { year: "", month: "", day: "", hour: "", minute: "00" },
        body: "",
        characters: ["스크립트", "장면 전환", "장소", "선택지", "버틴", "레굴루스", "소네트"]
      };
      addedChapters += 1;
    }
    version.chapters[index].chapterName = record.chapterName;
    version.chapters[index].time = record.time;
  });
  updatedVersions += 1;
}

fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`${updatedVersions}개 버전에 ${records.length}개 챕터 정보를 반영하고 ${addedChapters}개 챕터를 추가했습니다.`);

function normalizePart(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 2);
  return digits ? digits.padStart(2, "0") : "";
}
