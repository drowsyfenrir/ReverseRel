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

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-download-pickup-deck]");
  if (!button) return;
  const deck = button.closest(".pickup-schedule-deck");
  if (!deck) return;
  button.disabled = true;
  try {
    const blob = await renderElementToPng(deck);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${safeFileName(button.dataset.deckName || "pickup-schedule")}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error(error);
    alert("이미지 다운로드에 실패했습니다.");
  } finally {
    button.disabled = false;
  }
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
    names: Array.isArray(block.names) ? block.names.map(normalizeScheduleName) : ["", "", "", ""].map(normalizeScheduleName),
    visible: block.visible !== false
  })) : [];
}

function normalizeScheduleName(entry) {
  if (entry && typeof entry === "object") {
    return {
      name: entry.name || "",
      rhiannon: entry.rhiannon === true
    };
  }
  return {
    name: entry || "",
    rhiannon: false
  };
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
    return (Array.isArray(block.names) ? block.names : []).some((entry) => cleanText(scheduleEntryName(entry)));
  });
  if (!visibleDecks.length) return '<div class="pickup-empty">마도학자 일정 컨텐츠를 추가하세요.</div>';
  return `<div class="pickup-schedule-content">${visibleDecks.map(renderScheduleDeck).join("")}</div>`;
}

function renderScheduleDeck(block) {
  const entries = (Array.isArray(block.names) ? block.names : []).map(normalizeScheduleName).filter((entry) => cleanText(entry.name));
  if (!entries.length) return "";
  const deckName = cleanText(block.name);
  return `
    <section class="pickup-schedule-deck">
      ${deckName ? `
        <div class="pickup-schedule-deck-label">
          <span>${escapeHtml(deckName)}</span>
          <button class="pickup-schedule-download" type="button" data-download-pickup-deck data-deck-name="${escapeAttr(deckName)}" aria-label="${escapeAttr(deckName)} 이미지 다운로드">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
            </svg>
          </button>
        </div>
      ` : ""}
      <div class="pickup-schedule-deck-body">
        ${entries.map(renderScheduleProfile).join("")}
      </div>
    </section>
  `;
}

function renderScheduleProfile(entry) {
  const name = scheduleEntryName(entry);
  const schedules = findScheduleForName(name);
  const displayName = scheduleDisplayName(name);
  return `
    <article class="pickup-schedule-profile">
      <div class="pickup-schedule-image" style="background-image: url('profile/${encodeURIComponent(name)}.png');">
        ${entry.rhiannon ? '<img class="pickup-schedule-overlay" src="img/pickup/리아논.png" alt="" />' : ""}
      </div>
      <h3>${escapeHtml(displayName)}</h3>
      <div class="pickup-schedule-list">
        ${schedules.length ? schedules.map((item) => `<p>[${escapeHtml(item.category)}] ${escapeHtml(item.version)}</p>`).join("") : "<p>예정 없음</p>"}
      </div>
    </article>
  `;
}

function scheduleEntryName(entry) {
  return cleanText(entry && typeof entry === "object" ? entry.name : entry);
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

async function renderElementToPng(element) {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  context.setTransform(scale, 0, 0, scale, 0, 0);
  if (document.fonts?.ready) await document.fonts.ready;

  await drawElementBox(context, element, rect, 0, 0, width, height);
  for (const profile of element.querySelectorAll(".pickup-schedule-profile")) {
    await drawScheduleProfile(context, profile, rect);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG 생성 실패")), "image/png");
  });
}

async function drawScheduleProfile(context, profile, rootRect) {
  const imageBox = profile.querySelector(".pickup-schedule-image");
  const nameLabel = profile.querySelector("h3");
  if (imageBox) await drawElementBoxFromDom(context, imageBox, rootRect);
  for (const overlay of imageBox?.querySelectorAll("img") || []) {
    await drawImgElement(context, overlay, rootRect);
  }
  if (nameLabel) {
    await drawElementBoxFromDom(context, nameLabel, rootRect);
    drawCenteredText(context, nameLabel, rootRect);
  }
  profile.querySelectorAll(".pickup-schedule-list p").forEach((line) => drawCenteredText(context, line, rootRect));
}

async function drawElementBoxFromDom(context, element, rootRect) {
  const rect = element.getBoundingClientRect();
  await drawElementBox(
    context,
    element,
    rootRect,
    rect.left - rootRect.left,
    rect.top - rootRect.top,
    rect.width,
    rect.height
  );
}

async function drawElementBox(context, element, rootRect, x, y, width, height) {
  const style = window.getComputedStyle(element);
  const radius = parseFloat(style.borderTopLeftRadius) || 0;
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  const backgroundColor = style.backgroundColor;
  if (backgroundColor && backgroundColor !== "rgba(0, 0, 0, 0)" && backgroundColor !== "transparent") {
    context.fillStyle = backgroundColor;
    context.fillRect(x, y, width, height);
  }
  const backgroundUrl = extractCssUrl(style.backgroundImage);
  if (backgroundUrl) {
    const image = await loadImage(new URL(backgroundUrl, location.href).href);
    drawImageCover(context, image, x, y, width, height);
  }
  context.restore();
  drawBorder(context, style, x, y, width, height, radius);
}

async function drawImgElement(context, element, rootRect) {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const style = window.getComputedStyle(element);
  const x = rect.left - rootRect.left;
  const y = rect.top - rootRect.top;
  if (element.classList.contains("pickup-schedule-overlay")) {
    await drawCircleImage(context, element, x, y, rect.width, rect.height);
    return;
  }
  const radius = style.clipPath.startsWith("circle") ? Math.min(rect.width, rect.height) / 2 : parseFloat(style.borderTopLeftRadius) || 0;
  const image = await loadImage(element.currentSrc || element.src);
  context.save();
  roundedRect(context, x, y, rect.width, rect.height, radius);
  context.clip();
  if (style.objectFit === "cover") {
    drawImageCover(context, image, x, y, rect.width, rect.height);
  } else {
    context.drawImage(image, x, y, rect.width, rect.height);
  }
  context.restore();
  drawBorder(context, style, x, y, rect.width, rect.height, radius);
  drawOutline(context, style, x, y, rect.width, rect.height, radius);
}

async function drawCircleImage(context, element, x, y, width, height) {
  const image = await loadImage(element.currentSrc || element.src);
  const radius = Math.min(width, height) / 2;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  drawImageCover(context, image, x, y, width, height);
  context.restore();
  context.save();
  context.strokeStyle = "#fff";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(centerX, centerY, radius - 0.5, 0, Math.PI * 2);
  context.closePath();
  context.stroke();
  context.restore();
}

function drawCenteredText(context, element, rootRect) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const text = cleanText(element.textContent);
  if (!text) return;
  context.save();
  context.fillStyle = style.color || "#000";
  context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.textAlign = style.textAlign === "left" ? "left" : style.textAlign === "right" ? "right" : "center";
  context.textBaseline = "middle";
  const x = context.textAlign === "left"
    ? rect.left - rootRect.left
    : context.textAlign === "right"
      ? rect.right - rootRect.left
      : rect.left - rootRect.left + rect.width / 2;
  const y = rect.top - rootRect.top + rect.height / 2;
  context.fillText(text, x, y);
  context.restore();
}

function drawBorder(context, style, x, y, width, height, radius) {
  const borderWidth = parseFloat(style.borderTopWidth) || 0;
  if (!borderWidth) return;
  context.save();
  context.strokeStyle = style.borderTopColor || "#d7dde8";
  context.lineWidth = borderWidth;
  roundedRect(context, x + borderWidth / 2, y + borderWidth / 2, width - borderWidth, height - borderWidth, Math.max(0, radius - borderWidth / 2));
  context.stroke();
  context.restore();
}

function drawOutline(context, style, x, y, width, height, radius) {
  const outlineWidth = parseFloat(style.outlineWidth) || 0;
  if (!outlineWidth || style.outlineStyle === "none") return;
  context.save();
  context.strokeStyle = style.outlineColor || "#fff";
  context.lineWidth = outlineWidth;
  roundedRect(
    context,
    x - outlineWidth / 2,
    y - outlineWidth / 2,
    width + outlineWidth,
    height + outlineWidth,
    radius + outlineWidth / 2
  );
  context.stroke();
  context.restore();
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawImageCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function extractCssUrl(value) {
  const match = /url\((['"]?)(.*?)\1\)/.exec(value || "");
  return match ? match[2] : "";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function safeFileName(value) {
  return cleanText(value).replace(/[\\/:*?"<>|]/g, "_") || "pickup-schedule";
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

function escapeAttr(value) {
  return escapeHtml(value);
}
