const pickupState = {
  data: { panels: { banner: { blocks: [] }, schedule: { blocks: [] } } },
  versionData: { currentPageId: "", pages: [] }
};

const PICKUP_SCHEMA = "reverse-rel-pickup-data";
const pickupTabs = document.querySelector(".pickup-tabs");
const pickupButtons = Array.from(document.querySelectorAll("[data-pickup-view]"));
const pickupPanels = Array.from(document.querySelectorAll("[data-pickup-panel]"));

Promise.all([
  fetch(`pickup-data.json?v=${Date.now()}`, { cache: "no-store" }).then((response) => response.json()).catch(() => null),
  fetch(`version-data.json?v=${Date.now()}`, { cache: "no-store" }).then((response) => response.json()).catch(() => null)
]).then(([pickupData, versionData]) => {
  if (pickupData) pickupState.data = normalizePickupData(pickupData);
  pickupState.versionData = normalizeVersionData(versionData);
  renderPickupPanels();
}).catch(() => {
  renderPickupPanels();
});

pickupButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.pickupView;
    pickupTabs.classList.toggle("is-schedule", view === "schedule");
    pickupTabs.classList.toggle("is-banner", view !== "schedule");
    pickupButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    pickupPanels.forEach((panel) => {
      const isActive = panel.dataset.pickupPanel === view;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });
  });
});

function normalizePickupData(data) {
  const panels = data?.panels || {};
  return {
    schema: PICKUP_SCHEMA,
    conditions: normalizeConditions(data?.conditions),
    panels: {
      banner: { blocks: normalizeBlocks(panels.banner?.blocks) },
      schedule: { blocks: normalizeBlocks(panels.schedule?.blocks) }
    }
  };
}

function normalizeConditions(conditions) {
  return Array.isArray(conditions) ? conditions.map((condition) => ({
    version: condition?.version || "",
    label: condition?.label || "",
    names: condition?.names || ""
  })) : [];
}

function normalizeBlocks(blocks) {
  return Array.isArray(blocks) ? blocks.map((block) => ({
    id: block.id || `block-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: block.type || "text",
    text: block.text || "",
    banner: block.banner || "",
    name: block.name || "",
    kind: block.kind || "",
    category: block.category || "",
    content: block.content || "",
    note: block.note || "",
    names: Array.isArray(block.names) ? block.names.map((name) => name || "") : ["", "", "", ""],
    visible: block.visible !== false
  })) : [];
}

function normalizeVersionData(data) {
  return {
    currentPageId: data?.currentPageId || "",
    pages: Array.isArray(data?.pages) ? data.pages : []
  };
}

function renderPickupPanels() {
  const bannerPanel = document.querySelector('[data-pickup-panel="banner"]');
  const schedulePanel = document.querySelector('[data-pickup-panel="schedule"]');
  bannerPanel.innerHTML = renderBlocks(pickupState.data.panels.banner.blocks);
  schedulePanel.innerHTML = renderScheduleBlocks(pickupState.data.panels.schedule.blocks);
}

function renderBlocks(blocks) {
  const visibleBlocks = blocks.filter((block) => block.visible !== false);
  if (!visibleBlocks.length) return '<div class="pickup-empty">픽업 배너 컨텐츠를 추가하세요.</div>';
  return `<div class="pickup-content">${visibleBlocks.map(renderBlock).join("")}</div>`;
}

function renderBlock(block) {
  const kind = String(block.kind || "").trim();
  if (block.type === "header") {
    return `<h2 class="pickup-content-header"><span class="pickup-inline"><span class="pickup-emoji pickup-emoji--header">📌</span><span>${escapeHtml(block.text)}</span></span></h2>`;
  }
  if (block.type === "banner") {
    const image = block.banner ? `<img src="img/pickup/notice/${encodeURIComponent(block.banner)}.png" alt="" />` : "";
    return `
      <article class="pickup-banner-item">
        <div class="pickup-banner-image">${image}</div>
        <p class="pickup-banner-text">
          <span class="pickup-banner-name pickup-inline"><span class="pickup-emoji pickup-emoji--banner">💎</span><span>${escapeHtml(block.name)}</span></span>
          ${kind ? `<span class="pickup-banner-kind"><span>(</span>${escapeHtml(kind)}<span>)</span></span>` : ""}
          <span class="pickup-banner-category">${escapeHtml(block.category)}</span>
          <span class="pickup-banner-content">${escapeHtml(block.content)}</span>
          <span class="pickup-banner-note">${escapeHtml(block.note)}</span>
        </p>
      </article>
    `;
  }
  return `
    <div class="pickup-text-block">
      <div class="pickup-text-divider" aria-hidden="true"></div>
      <p class="pickup-content-text">${escapeHtml(block.text)}</p>
      <div class="pickup-text-divider" aria-hidden="true"></div>
    </div>
  `;
}

function renderScheduleBlocks(blocks) {
  const visibleDecks = blocks.filter((block) => {
    if (block.visible === false || block.type !== "deck") return false;
    return (Array.isArray(block.names) ? block.names : []).some((name) => cleanText(name));
  });
  if (!visibleDecks.length) return '<div class="pickup-empty">마도학자 일정 컨텐츠를 추가하세요.</div>';
  return `<div class="pickup-schedule-content">${visibleDecks.map(renderScheduleDeck).join("")}</div>`;
}

function renderScheduleDeck(block) {
  const names = (Array.isArray(block.names) ? block.names : []).map(cleanText).filter(Boolean);
  if (!names.length) return "";
  const deckName = cleanText(block.name);
  return `
    <section class="pickup-schedule-deck">
      ${deckName ? `<div class="pickup-schedule-deck-label">${escapeHtml(deckName)}</div>` : ""}
      <div class="pickup-schedule-deck-body">
        ${names.map(renderScheduleProfile).join("")}
      </div>
    </section>
  `;
}

function renderScheduleProfile(name) {
  const schedules = findScheduleForName(name);
  const displayName = scheduleDisplayName(name);
  return `
    <article class="pickup-schedule-profile">
      <div class="pickup-schedule-image" style="background-image: url('profile/${encodeURIComponent(name)}.png');"></div>
      <h3>${escapeHtml(displayName)}</h3>
      <div class="pickup-schedule-list">
        ${schedules.length ? schedules.map((item) => `<p>[${escapeHtml(item.category)}] ${escapeHtml(item.version)}</p>`).join("") : "<p>예정 없음</p>"}
      </div>
    </article>
  `;
}

function scheduleDisplayName(name) {
  return cleanText(name) === "로렌츠 버터플라이" ? "로렌츠" : name;
}

function findScheduleForName(name) {
  const pages = pagesFromCurrentVersion();
  const versionOrder = versionOrderMap(pages);
  const target = cleanText(name);
  const result = [];
  let sequence = 0;
  pages.forEach((page, pageIndex) => {
    const version = page.version || page.pageName || "";
    [
      ["전반기", page.pickups?.first],
      ["후반기", page.pickups?.last],
      ["배포", page.pickups?.middle]
    ].forEach(([category, pickup]) => {
      if (pickupContainsName(pickup, target)) result.push(scheduleItem(category, version, pageIndex, sequence++));
    });
    [
      ["고음 카운터", page.events?.highCounter],
      ["호수의 물결", page.events?.ripples]
    ].forEach(([category, event]) => {
      if (profileListContainsName(event?.profiles, target)) result.push(scheduleItem(category, version, pageIndex, sequence++));
    });
  });
  manualConditionsForName(target, versionOrder, sequence).forEach((condition) => result.push(condition));
  return result
    .sort((a, b) => a.order - b.order || a.sequence - b.sequence)
    .map(({ category, version }) => ({ category, version }));
}

function scheduleItem(category, version, order, sequence) {
  return {
    category,
    version,
    order,
    sequence
  };
}

function manualConditionsForName(target, versionOrder, baseSequence) {
  return (pickupState.data.conditions || [])
    .map((condition, index) => ({ condition, index }))
    .filter(({ condition }) => conditionContainsName(condition, target))
    .map(({ condition, index }) => ({
      category: cleanText(condition.label),
      version: cleanText(condition.version),
      order: versionSortOrder(cleanText(condition.version), versionOrder),
      sequence: baseSequence + index
    }))
    .filter((condition) => condition.category && condition.version);
}

function versionOrderMap(pages) {
  const orderMap = new Map();
  pages.forEach((page, index) => {
    [page.version, page.pageName].map(cleanText).filter(Boolean).forEach((version) => {
      if (!orderMap.has(version)) orderMap.set(version, index);
    });
  });
  return orderMap;
}

function versionSortOrder(version, orderMap) {
  if (orderMap.has(version)) return orderMap.get(version);
  const numeric = Number(version);
  return Number.isFinite(numeric) ? 10000 + numeric : Number.MAX_SAFE_INTEGER;
}

function conditionContainsName(condition, target) {
  return String(condition?.names || "")
    .split(",")
    .map(cleanText)
    .filter(Boolean)
    .some((name) => name === target);
}

function pagesFromCurrentVersion() {
  const pages = pickupState.versionData.pages || [];
  const currentIndex = pages.findIndex((page) => page.id === pickupState.versionData.currentPageId);
  return currentIndex >= 0 ? pages.slice(currentIndex) : pages;
}

function pickupContainsName(pickup, target) {
  if (!pickup || pickup.enabled === false) return false;
  return [pickup.name, ...(Array.isArray(pickup.profiles) ? pickup.profiles : [])].some((profile) => profileName(profile) === target);
}

function profileListContainsName(profiles, target) {
  return Array.isArray(profiles) && profiles.some((profile) => profileName(profile) === target);
}

function profileName(profile) {
  return cleanText(typeof profile === "object" && profile ? profile.name : profile);
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
