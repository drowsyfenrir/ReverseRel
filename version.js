const VERSION_DATA_URL = `version-data.json?v=${Date.now()}`;

const EVENT_TITLE_OFFSETS = {
  highCounter: false,
  ripples: true,
  photoscope: true
};

const versionState = {
  data: null,
  activeIndex: 0,
  preloadedImages: new Set()
};

fetch(VERSION_DATA_URL, { cache: "no-store" })
  .then((response) => response.json())
  .then((data) => {
    versionState.data = data;
    versionState.activeIndex = currentPageIndex(data);
    renderVersionPage();
  })
  .catch((error) => {
    console.error(error);
    const root = document.getElementById("versionRoot");
    if (root) {
      root.innerHTML = `<p class="version-error">version-data.json을 읽지 못했습니다. ${escapeHtml(error?.message || "")}</p>`;
    }
  });

function renderVersionPage() {
  const root = document.getElementById("versionRoot");
  if (!root) return;
  const pages = getPages();
  const page = pages[versionState.activeIndex];
  if (!page) {
    root.innerHTML = '<p class="version-error">표시할 버전 데이터가 없습니다.</p>';
    return;
  }

  root.innerHTML = `
    <div class="version-tabs" aria-label="버전 보기">
      <button class="version-tab is-active" type="button" data-version-current>현재 버전</button>
      <button class="version-tab" type="button" data-version-all>모든 버전</button>
    </div>
    <div class="version-stage">
      <button class="version-page-arrow version-page-arrow-prev" type="button" data-version-prev aria-label="이전 버전" ${versionState.activeIndex <= 0 ? "disabled" : ""}>&lt;</button>
      <section class="version-popup" aria-label="버전 요약">
        ${heroTemplate(page)}
        <div class="version-list">
          ${pickupTemplates(page)}
          ${eventTemplate(page, "highCounter")}
          ${eventTemplate(page, "ripples")}
          ${eventTemplate(page, "photoscope")}
        </div>
      </section>
      <button class="version-page-arrow version-page-arrow-next" type="button" data-version-next aria-label="다음 버전" ${versionState.activeIndex >= pages.length - 1 ? "disabled" : ""}>&gt;</button>
    </div>
  `;

  bindVersionControls();
  preloadNearbyVersionImages();
}

function bindVersionControls() {
  document.querySelector("[data-version-current]")?.addEventListener("click", () => {
    versionState.activeIndex = currentPageIndex(versionState.data);
    renderVersionPage();
  });
  document.querySelector("[data-version-prev]")?.addEventListener("click", () => {
    if (versionState.activeIndex > 0) {
      versionState.activeIndex -= 1;
      renderVersionPage();
    }
  });
  document.querySelector("[data-version-next]")?.addEventListener("click", () => {
    const pages = getPages();
    if (versionState.activeIndex < pages.length - 1) {
      versionState.activeIndex += 1;
      renderVersionPage();
    }
  });
}

function getPages() {
  return Array.isArray(versionState.data?.pages) ? versionState.data.pages : [];
}

function currentPageIndex(data) {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const index = pages.findIndex((page) => page.id === data.currentPageId);
  return Math.max(0, index);
}

function findCurrentPage(data) {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  return pages.find((page) => page.id === data.currentPageId) || pages[0];
}

function preloadNearbyVersionImages() {
  const pages = getPages();
  const nearbyPages = [
    pages[versionState.activeIndex - 1],
    pages[versionState.activeIndex + 1]
  ].filter(Boolean);

  const runPreload = () => {
    nearbyPages
      .flatMap((page) => collectPageImageUrls(page))
      .forEach(preloadImage);
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(runPreload, { timeout: 800 });
  } else {
    window.setTimeout(runPreload, 150);
  }
}

function collectPageImageUrls(page) {
  const urls = [];
  const version = clean(page.version || page.pageName || "");
  if (version) urls.push(`img/version/${version}.png`);

  Object.values(page.pickups || {}).forEach((pickup) => {
    if (!pickup || pickup.enabled === false) return;
    addProfileUrl(urls, pickup.name);
    (Array.isArray(pickup.profiles) ? pickup.profiles : []).forEach((name) => {
      addProfileUrl(urls, name);
    });
  });

  Object.values(page.events || {}).forEach((event) => {
    if (!event) return;
    if (event.icon) urls.push(event.icon);
    (Array.isArray(event.profiles) ? event.profiles : []).forEach((name) => {
      addProfileUrl(urls, name);
    });
  });

  return urls;
}

function addProfileUrl(urls, name) {
  const cleanName = clean(name);
  if (cleanName) urls.push(`profile/${cleanName}.png`);
}

function preloadImage(url) {
  if (!url || versionState.preloadedImages.has(url)) return;
  versionState.preloadedImages.add(url);
  const image = new Image();
  image.decoding = "async";
  image.src = encodeURI(url);
}

function heroTemplate(page) {
  const version = clean(page.version || page.pageName || "");
  return `
    <section class="version-hero">
      <img src="${escapeAttr(`img/version/${version}.png`)}" alt="" />
      <div class="version-hero-text">
        <span class="version-number">${escapeHtml(version)}</span>
        <h1>${escapeHtml(page.versionName || "")}</h1>
        <p>${escapeHtml(versionDateRange(page))}</p>
      </div>
    </section>
  `;
}

function pickupTemplates(page) {
  const pickups = page.pickups || {};
  return ["first", "middle", "last"]
    .map((key) => pickupTemplate(page, pickups[key]))
    .join("");
}

function pickupTemplate(page, pickup) {
  if (!pickup || pickup.enabled === false) return "";
  const label = pickup.label || "";
  const name = pickup.name || "";
  const profiles = (Array.isArray(pickup.profiles) ? pickup.profiles.slice(0, 2) : [])
    .filter((profile) => clean(profile));
  const tabImage = name ? `img/tab/${name}.webp` : "";
  const style = tabImage
    ? ` style="background-image: linear-gradient(90deg, rgba(0, 0, 0, .82), rgba(0, 0, 0, .36) 42%, rgba(0, 0, 0, 0) 60%), url('${escapeAttr(encodeURI(tabImage))}')"`
    : "";
  return `
    <article class="version-card pickup-card"${style}>
      <div class="version-card-copy">
        <h2>[${escapeHtml(label)}] ${escapeHtml(name)}</h2>
        <p>${escapeHtml(pickupDateRange(pickup, page))}</p>
      </div>
      ${profiles.length ? `
        <div class="version-profile-row" aria-hidden="true">
          ${profiles.map((profile) => profileSlot(profile, "version-image-slot-small")).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function eventTemplate(page, key) {
  const event = page.events?.[key];
  if (!event) return "";
  const profiles = Array.isArray(event.profiles) ? event.profiles : [];
  if ((key === "ripples" || key === "photoscope") && profiles.length === 0) return "";
  const offsetClass = EVENT_TITLE_OFFSETS[key] ? " event-card-offset-title" : "";
  return `
    <article class="version-card event-card${offsetClass}">
      <div class="version-event-header">
        <img class="version-event-icon" src="${escapeAttr(event.icon || "")}" alt="" />
        <h2>[${escapeHtml(event.label || "")}]</h2>
        <p>${escapeHtml(event.dateMode === "none" ? "기간 제한 없음" : versionDateRange(page))}</p>
      </div>
      <div class="version-event-profiles" aria-hidden="true">
        ${profiles.map((name) => profileSlot(name, "version-image-slot-large")).join("")}
      </div>
    </article>
  `;
}

function profileSlot(name, sizeClass) {
  const cleanName = clean(name);
  const image = cleanName ? `profile/${cleanName}.png` : "";
  const style = image ? ` style="background-image: url('${escapeAttr(encodeURI(image))}')"` : "";
  return `<div class="version-image-slot ${sizeClass}"${style}></div>`;
}

function versionDateRange(page) {
  return `${dateStart(page.start)} → ${dateEnd(page.end)}`;
}

function pickupDateRange(pickup, page) {
  return `${pickupDateStart(pickup.start || page.start)} → ${pickupDateEnd(pickup.end || page.end)}`;
}

function dateStart(date) {
  return `${date?.year || ""}년 ${date?.month || ""}월 ${date?.day || ""}일 오전 05:00`;
}

function dateEnd(date) {
  return `${date?.year || ""}년 ${date?.month || ""}월 ${date?.day || ""}일 오전 04:59`;
}

function pickupDateStart(date) {
  return `${date?.year || ""}년 ${date?.month || ""}월 ${date?.day || ""}일 05:00`;
}

function pickupDateEnd(date) {
  return `${date?.year || ""}년 ${date?.month || ""}월 ${date?.day || ""}일 04:59`;
}

function clean(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
