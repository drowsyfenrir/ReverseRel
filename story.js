const storyTimeline = document.getElementById("storyTimeline");
const storyDetailPanel = document.getElementById("storyDetailPanel");
const storyDetailContent = document.getElementById("storyDetailContent");
const storyTabs = Array.from(document.querySelectorAll("[data-story-type]"));

const STORY_TYPE_LABELS = {
  main: "메인",
  event: "이벤트",
  character: "캐릭터",
  anecdote: "일화",
  other: "기타"
};
const STORY_TYPE_FOLDERS = {
  main: "main",
  event: "event",
  character: "character",
  anecdote: "anecdote",
  other: "etc"
};
const STORY_MAIN_ROW_RANGES = [
  [0, 7],
  [8, 10],
  [11, 13]
];
const STORY_MAIN_ROW_NAMES = [
  "생존자와 나머지",
  "여행의 귀환",
  "이야기의 뿌리"
];

const storyState = {
  data: { schema: "reverse-rel-story-data", versions: [] },
  activeType: "main",
  detailVersionId: null,
  detailChapterIndex: 0
};

bindStoryPageEvents();

fetch(`story-data.json?v=${Date.now()}`, { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error("story-data.json을 불러오지 못했습니다.");
    return response.json();
  })
  .then((data) => {
    storyState.data = normalizeStoryData(data);
    renderStoryView();
  })
  .catch((error) => {
    console.error(error);
    storyTimeline.innerHTML = '<p class="story-empty">연표 데이터를 불러오지 못했습니다.</p>';
  });

function normalizeStoryData(data) {
  const versions = Array.isArray(data?.versions)
    ? data.versions.map((version, index) => normalizeStoryVersion(version, index + 1))
    : migrateLegacyStoryVersions(data?.chapters);
  return { schema: "reverse-rel-story-data", versions };
}

function migrateLegacyStoryVersions(chapters) {
  const grouped = new Map();
  (Array.isArray(chapters) ? chapters : []).forEach((chapter, index) => {
    const type = STORY_TYPE_LABELS[chapter?.type] ? chapter.type : "main";
    const version = cleanStoryText(chapter?.version);
    const versionName = cleanStoryText(chapter?.versionName);
    const key = `${type}\u0000${version}\u0000${versionName}`;
    if (!grouped.has(key)) {
      grouped.set(key, normalizeStoryVersion({ type, version, versionName, chapters: [] }, grouped.size + 1));
    }
    grouped.get(key).chapters.push(normalizeStoryChapter(chapter, index + 1));
  });
  return Array.from(grouped.values());
}

function normalizeStoryVersion(version, index) {
  return {
    id: version?.id || `story-version-${index}`,
    type: STORY_TYPE_LABELS[version?.type] ? version.type : "main",
    version: cleanStoryText(version?.version),
    versionName: cleanStoryText(version?.versionName),
    chapters: Array.isArray(version?.chapters)
      ? version.chapters.map((chapter, chapterIndex) => normalizeStoryChapter(chapter, chapterIndex + 1))
      : []
  };
}

function normalizeStoryChapter(chapter, index) {
  return {
    id: chapter?.id || `story-chapter-${index}`,
    chapterName: cleanStoryText(chapter?.chapterName),
    time: normalizeStoryTime(chapter?.time),
    body: String(chapter?.body || ""),
    characters: Array.isArray(chapter?.characters) ? chapter.characters.map(cleanStoryText).filter(Boolean) : []
  };
}

function normalizeStoryTime(time) {
  return {
    year: cleanStoryText(time?.year),
    month: cleanStoryText(time?.month),
    day: cleanStoryText(time?.day),
    hour: cleanStoryText(time?.hour),
    minute: cleanStoryText(time?.minute)
  };
}

function bindStoryPageEvents() {
  storyTabs.forEach((button) => {
    button.addEventListener("click", () => {
      storyState.activeType = button.dataset.storyType;
      storyTabs.forEach((tab) => tab.classList.toggle("is-active", tab === button));
      closeStoryDetail();
      renderStoryView();
    });
  });

  storyTimeline.addEventListener("click", (event) => {
    const card = event.target.closest("[data-story-version-id]");
    if (!card || card.closest(".story-row-scroll")?.dataset.dragged === "true") return;
    openStoryDetail(card.dataset.storyVersionId);
  });

  document.getElementById("closeStoryDetail").addEventListener("click", closeStoryDetail);
  storyDetailPanel.addEventListener("click", (event) => event.stopPropagation());
  storyDetailContent.addEventListener("click", (event) => {
    const chapterButton = event.target.closest("[data-story-chapter-index]");
    if (chapterButton && chapterButton.closest(".story-detail-chapters")?.dataset.dragged !== "true") {
      storyState.detailChapterIndex = Number(chapterButton.dataset.storyChapterIndex) || 0;
      renderStoryDetail();
      return;
    }
    const choiceButton = event.target.closest("[data-story-choice-index]");
    if (!choiceButton) return;
    const group = choiceButton.closest("[data-story-choice-group]");
    if (!group) return;
    const selectedIndex = choiceButton.dataset.storyChoiceIndex;
    group.querySelectorAll("[data-story-choice-index]").forEach((button) => {
      button.classList.toggle("is-active", button === choiceButton);
    });
    group.querySelectorAll("[data-story-choice-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.storyChoicePanel !== selectedIndex;
    });
  });
  document.addEventListener("click", (event) => {
    if (storyDetailPanel.hidden || storyDetailPanel.contains(event.target)) return;
    if (event.target.closest("[data-story-version-id]")) return;
    closeStoryDetail();
  });
}

function renderStoryView() {
  if (storyState.activeType === "main") {
    renderMainStoryRows();
    return;
  }
  renderOtherStoryType();
}

function renderMainStoryRows() {
  const mainVersions = storyState.data.versions.filter((version) => version.type === "main");
  const versionByNumber = new Map(mainVersions.map((version) => [version.version, version]));
  storyTimeline.innerHTML = STORY_MAIN_ROW_RANGES.map(([start, end], rowIndex) => {
    const cards = [];
    for (let number = start; number <= end; number += 1) {
      cards.push(renderMainStoryCard(String(number), versionByNumber.get(String(number))));
      mainVersions
        .filter((version) => version.version.startsWith(`${number}_`))
        .sort((a, b) => compareStoryVersion(a.version, b.version))
        .forEach((version) => cards.push(renderMainStoryCard(version.version, version, true)));
    }
    return `
      <section class="story-main-row" aria-label="메인 스토리 ${rowIndex + 1}행">
        <div class="story-row-cover">
          <span class="story-row-cover-image">
            <img src="img/story/version/${rowIndex + 1}.png" alt="" draggable="false" />
          </span>
          <span class="story-row-cover-name">${STORY_MAIN_ROW_NAMES[rowIndex]}</span>
        </div>
        <div class="story-row-viewport">
          <div class="story-row-scroll ${rowIndex === 0 ? "is-draggable" : ""}" data-story-row="${rowIndex + 1}">
            <div class="story-row-track">
              ${cards.join("")}
            </div>
          </div>
        </div>
        <span class="story-row-edge-fade" aria-hidden="true"></span>
      </section>
    `;
  }).join("");
  setupStoryRowDragging();
}

function renderMainStoryCard(versionNumber, version, compact = false) {
  const name = version?.versionName || `메인 ${versionNumber}`;
  const isAvailable = Boolean(version);
  return `
    <button class="story-version-card ${compact ? "is-compact" : ""} ${isAvailable ? "" : "is-unavailable"}" type="button" ${isAvailable ? `data-story-version-id="${escapeStoryAttr(version.id)}"` : "disabled"}>
      <span class="story-version-image-wrap">
        <img src="img/story/main/${encodeURIComponent(versionNumber)}.png" alt="${escapeStoryAttr(name)}" draggable="false" />
      </span>
      <span class="story-version-name">${escapeStoryHtml(name)}</span>
    </button>
  `;
}

function renderOtherStoryType() {
  const versions = storyState.data.versions.filter((version) => version.type === storyState.activeType);
  if (!versions.length) {
    storyTimeline.innerHTML = `<p class="story-empty">등록된 ${escapeStoryHtml(STORY_TYPE_LABELS[storyState.activeType])} 스토리가 없습니다.</p>`;
    return;
  }
  const folder = STORY_TYPE_FOLDERS[storyState.activeType];
  storyTimeline.innerHTML = `
    <div class="story-generic-grid">
      ${versions.map((version) => `
        <button class="story-version-card" type="button" data-story-version-id="${escapeStoryAttr(version.id)}">
          <span class="story-version-image-wrap">
            <img src="img/story/${folder}/${encodeURIComponent(version.version)}.png" alt="${escapeStoryAttr(version.versionName)}" draggable="false" onerror="this.closest('.story-version-image-wrap').classList.add('is-missing')" />
          </span>
          <span class="story-version-name">${escapeStoryHtml(version.versionName || version.version || "이름 없는 버전")}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function setupStoryRowDragging() {
  document.querySelectorAll(".story-row-scroll.is-draggable").forEach((scroller) => {
    setupHorizontalDragging(scroller);
  });
}

function setupHorizontalDragging(scroller) {
  if (!scroller) return;
  let active = false;
  let startX = 0;
  let startScrollLeft = 0;
  let moved = false;
  scroller.addEventListener("pointerdown", (event) => {
    active = true;
    moved = false;
    startX = event.clientX;
    startScrollLeft = scroller.scrollLeft;
    scroller.classList.add("is-dragging");
  });
  scroller.addEventListener("pointermove", (event) => {
    if (!active) return;
    const delta = event.clientX - startX;
    if (Math.abs(delta) > 4 && !moved) {
      moved = true;
      scroller.setPointerCapture(event.pointerId);
    }
    scroller.scrollLeft = startScrollLeft - delta;
  });
  const finish = (event) => {
    if (!active) return;
    active = false;
    scroller.classList.remove("is-dragging");
    scroller.dataset.dragged = moved ? "true" : "false";
    if (scroller.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
    setTimeout(() => { scroller.dataset.dragged = "false"; }, 0);
  };
  scroller.addEventListener("pointerup", finish);
  scroller.addEventListener("pointercancel", finish);
}

function openStoryDetail(versionId) {
  storyState.detailVersionId = versionId;
  storyState.detailChapterIndex = 0;
  renderStoryDetail();
  storyDetailPanel.hidden = false;
}

function closeStoryDetail() {
  storyDetailPanel.hidden = true;
  storyState.detailVersionId = null;
  storyState.detailChapterIndex = 0;
}

function renderStoryDetail() {
  const version = storyState.data.versions.find((item) => item.id === storyState.detailVersionId);
  if (!version) {
    closeStoryDetail();
    return;
  }
  const chapter = version.chapters[storyState.detailChapterIndex] || null;
  const versionLabel = version.version ? `${version.version}장` : "장 미정";
  storyDetailContent.innerHTML = `
    <div class="story-detail-meta">
      <span>${escapeStoryHtml(STORY_TYPE_LABELS[version.type] || STORY_TYPE_LABELS.other)}</span>
      <span>${escapeStoryHtml(versionLabel)}</span>
      <strong>${escapeStoryHtml(version.versionName || "이름 없는 버전")}</strong>
    </div>
    <div class="story-detail-chapters" aria-label="챕터 선택">
      ${version.chapters.map((item, index) => `
        <button class="${index === storyState.detailChapterIndex ? "is-active" : ""}" type="button" data-story-chapter-index="${index}">${index + 1}</button>
      `).join("") || '<span class="story-detail-no-chapter">등록된 챕터가 없습니다.</span>'}
    </div>
    ${chapter ? renderStoryChapterDetail(version, chapter, storyState.detailChapterIndex) : ""}
  `;
  setupHorizontalDragging(storyDetailContent.querySelector(".story-detail-chapters"));
}

function renderStoryChapterDetail(version, chapter, chapterIndex) {
  const time = formatStoryTime(chapter.time);
  const imageContext = createStoryImageContext(version, chapterIndex);
  return `
    <article class="story-chapter-detail">
      <div class="story-chapter-heading">
        <h2>${escapeStoryHtml(chapter.chapterName || "이름 없는 챕터")}</h2>
        ${time ? `<time>${escapeStoryHtml(time)}</time>` : ""}
      </div>
      <div class="story-chapter-body">${chapter.body ? renderStoryDialogue(chapter.body, imageContext) : "등록된 스토리 본문이 없습니다."}</div>
    </article>
  `;
}

function createStoryImageContext(version, chapterIndex) {
  if (version.type !== "main" || !version.version) return null;
  const previousImageCount = version.chapters
    .slice(0, chapterIndex)
    .reduce((total, chapter) => total + countStoryImageMarkers(chapter.body), 0);
  return {
    basePath: `img/story/main/${encodeURIComponent(version.version)}`,
    nextIndex: previousImageCount + 1
  };
}

function countStoryImageMarkers(body) {
  return (String(body ?? "").match(/\{이미지\}/g) || []).length;
}

function renderStoryDialogue(body, imageContext = null) {
  return parseStoryContent(body).map((block, blockIndex) => {
    if (block.type === "choice") return renderStoryChoiceGroup(block.options, blockIndex, imageContext);
    return renderStoryDialogueEntries(block.entries, imageContext);
  }).join("");
}

function renderStoryDialogueEntries(entries, imageContext = null) {
  return entries.map((entry) => {
    if (entry.speaker === "__STORY_IMAGE__") {
      if (!imageContext) {
        return '<section class="story-dialogue-row is-script"><div class="story-dialogue-text">{이미지}</div></section>';
      }
      const imageIndex = imageContext.nextIndex;
      imageContext.nextIndex += 1;
      return `
        <section class="story-dialogue-image">
          <img src="${imageContext.basePath}/${imageIndex}.png" alt="스토리 이미지 ${imageIndex}" loading="lazy" />
        </section>
      `;
    }
    const text = escapeStoryHtml(entry.text);
    if (entry.speaker === "스크립트" || entry.speaker === "장면 전환") {
      const sceneClass = entry.speaker === "장면 전환" ? " is-scene-transition" : "";
      return `<section class="story-dialogue-row is-script${sceneClass}"><div class="story-dialogue-text">${text}</div></section>`;
    }
    if (entry.speaker === "장소") {
      return `
        <section class="story-dialogue-row is-script is-location">
          <div class="story-dialogue-text"><img src="img/story/location.png" alt="" />${text}</div>
        </section>
      `;
    }
    if (entry.speaker === "선택지") {
      return `<section class="story-choice-single-row"><button class="story-choice-single" type="button">${text}</button></section>`;
    }
    const isUnidentified = entry.speaker.endsWith("_미확인");
    const hasQuestionName = entry.speaker.endsWith("_물음표");
    const displayName = isUnidentified || hasQuestionName
      ? "???"
      : (entry.speaker.split("_")[0].split("-")[0].trim() || entry.speaker);
    const profileFileName = encodeURIComponent(entry.speaker).replace(/'/g, "%27");
    const profileUrl = `img/story/profile/${profileFileName}.png`;
    return `
      <section class="story-dialogue-row">
        <div class="story-dialogue-profile${isUnidentified ? " is-unidentified" : ""}" style="background-image: url('${profileUrl}');" role="img" aria-label="${escapeStoryAttr(displayName)}"></div>
        <strong class="story-dialogue-speaker">${escapeStoryHtml(displayName)}</strong>
        <div class="story-dialogue-text">${text}</div>
      </section>
    `;
  }).join("");
}

function renderStoryChoiceGroup(options, groupIndex, imageContext = null) {
  if (!options.length) return "";
  return `
    <section class="story-choice-group" data-story-choice-group="${groupIndex}">
      <div class="story-choice-buttons">
        ${options.map((option, index) => `
          <button class="story-choice-button ${index === 0 ? "is-active" : ""}" type="button" data-story-choice-index="${index}">
            ${escapeStoryHtml(option.label)}
          </button>
        `).join("")}
      </div>
      <div class="story-choice-results">
        ${options.map((option, index) => `
          <div data-story-choice-panel="${index}" ${index === 0 ? "" : "hidden"}>
            ${renderStoryDialogueEntries(option.entries, imageContext)}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function parseStoryContent(body) {
  const source = String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\{이미지\}/g, "\n__STORY_IMAGE__:\n");
  const blocks = [];
  const groupPattern = /^\s*\{\s*\n([\s\S]*?)^\s*\}\s*$/gm;
  let cursor = 0;
  for (const match of source.matchAll(groupPattern)) {
    const before = source.slice(cursor, match.index);
    const entries = parseStoryDialogue(before);
    if (entries.length) blocks.push({ type: "dialogue", entries });
    const options = parseStoryChoiceOptions(match[1]);
    if (options.length) blocks.push({ type: "choice", options });
    cursor = match.index + match[0].length;
  }
  const remainder = parseStoryDialogue(source.slice(cursor));
  if (remainder.length) blocks.push({ type: "dialogue", entries: remainder });
  return blocks;
}

function parseStoryChoiceOptions(source) {
  const entries = parseStoryDialogue(source);
  const options = [];
  let current = null;
  entries.forEach((entry) => {
    if (entry.speaker === "선택지") {
      current = { label: entry.text, entries: [] };
      options.push(current);
      return;
    }
    if (current) current.entries.push(entry);
  });
  return options;
}

function parseStoryDialogue(source) {
  const markerPattern = /(?:^|\n)[ \t]*([^\n:]+?)[ \t]*:[ \t]*/g;
  const markers = Array.from(source.matchAll(markerPattern));
  if (!markers.length) {
    const text = source.trim();
    return text ? [{ speaker: "스크립트", text }] : [];
  }

  const entries = [];
  const preface = source.slice(0, markers[0].index).trim();
  if (preface) entries.push({ speaker: "스크립트", text: preface });
  markers.forEach((marker, index) => {
    const textStart = marker.index + marker[0].length;
    const textEnd = markers[index + 1]?.index ?? source.length;
    entries.push({
      speaker: marker[1].trim(),
      text: source.slice(textStart, textEnd).trim()
    });
  });
  return entries;
}

function formatStoryTime(time) {
  if (!cleanStoryText(time?.year) || Number(time.year) === 0) return "날짜 미상";
  const parts = [
    time.year && `${time.year}년`,
    time.month && `${Number(time.month)}월`,
    time.day && `${Number(time.day)}일`,
    time.hour !== "" && `${String(time.hour).padStart(2, "0")}시`,
    time.minute !== "" && `${String(time.minute).padStart(2, "0")}분`
  ];
  return parts.filter(Boolean).join(" ");
}

function compareStoryVersion(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function cleanStoryText(value) {
  return String(value ?? "").trim();
}

function escapeStoryHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function escapeStoryAttr(value) {
  return escapeStoryHtml(value);
}
