const VERSION_DATA_URL = `version-data.json?v=${Date.now()}`;

const EVENT_TITLE_OFFSETS = {
  highCounter: false,
  ripples: true,
  photoscope: true
};

const versionState = {
  data: null,
  activeIndex: 0,
  viewMode: "current",
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
      <button class="version-tab ${versionState.viewMode === "current" ? "is-active" : ""}" type="button" data-version-current>현재 버전</button>
      <button class="version-tab ${versionState.viewMode === "all" ? "is-active" : ""}" type="button" data-version-all>모든 버전</button>
    </div>
    ${versionState.viewMode === "all" ? allVersionsTableTemplate(pages) : currentVersionTemplate(page, pages)}
  `;

  bindVersionControls();
  preloadNearbyVersionImages();
}

function bindVersionControls() {
  document.querySelector("[data-version-current]")?.addEventListener("click", () => {
    versionState.viewMode = "current";
    versionState.activeIndex = currentPageIndex(versionState.data);
    renderVersionPage();
  });
  document.querySelector("[data-version-all]")?.addEventListener("click", () => {
    versionState.viewMode = "all";
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
  document.querySelectorAll("[data-copy-code]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const value = button.dataset.copyCode || "";
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const field = document.createElement("textarea");
        field.value = value;
        document.body.append(field);
        field.select();
        document.execCommand("copy");
        field.remove();
      }
      showCopyToast("복사 완료.");
    });
  });
  document.querySelectorAll("[data-version-row-index]").forEach((row) => {
    row.addEventListener("click", () => {
      versionState.activeIndex = Number(row.dataset.versionRowIndex);
      versionState.viewMode = "current";
      renderVersionPage();
    });
  });
}

function currentVersionTemplate(page, pages) {
  return `
    <div class="version-stage">
      <button class="version-page-arrow version-page-arrow-prev" type="button" data-version-prev aria-label="이전 버전" ${versionState.activeIndex <= 0 ? "disabled" : ""}>&lt;</button>
      <section class="version-popup" aria-label="버전 요약">
        ${heroTemplate(page)}
        <div class="version-list">
          ${pickupTemplates(page)}
          ${highCounterTemplate(page)}
          ${eventTemplate(page, "ripples")}
          ${eventTemplate(page, "photoscope")}
        </div>
      </section>
      <button class="version-page-arrow version-page-arrow-next" type="button" data-version-next aria-label="다음 버전" ${versionState.activeIndex >= pages.length - 1 ? "disabled" : ""}>&gt;</button>
    </div>
  `;
}

function allVersionsTableTemplate(pages) {
  return `
    <section class="version-table-stage" aria-label="모든 버전 비교표">
      <div class="version-table-scroll">
        <table class="version-table">
          <thead>
            <tr>
              <th>버전</th>
              <th>버전명</th>
              <th>일정</th>
              <th>전반기</th>
              <th>후반기</th>
              <th>배포</th>
              <th>고음 카운터</th>
              <th>호수의 물결</th>
              <th>비구상 촬영기</th>
              <th class="version-table-duration">기간</th>
            </tr>
          </thead>
          <tbody>
            ${pages.map((page, index) => versionTableRowTemplate(page, index)).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function versionTableRowTemplate(page, index) {
  return `
    <tr data-version-row-index="${index}" title="클릭하면 해당 버전 상세로 이동">
      <th class="version-table-version" scope="row">${escapeHtml(page.version || "")}</th>
      <td>${tagList([page.versionName], "name")}</td>
      <td class="version-table-schedule">${versionTableSchedule(page)}</td>
      <td class="version-table-pickup-cell">${pickupTagList(page, "first")}</td>
      <td class="version-table-pickup-cell">${pickupTagList(page, "last")}</td>
      <td>${tagList(pickupNames(page, "middle"), "release")}</td>
      <td>${tagList(eventNames(page, "highCounter"), "event")}</td>
      <td>${tagList(eventNames(page, "ripples"), "ripples")}</td>
      <td>${tagList(eventNames(page, "photoscope"), "photoscope")}</td>
      <td class="version-table-duration">${escapeHtml(versionDurationWeeks(page))}</td>
    </tr>
  `;
}

function getPages() {
  return Array.isArray(versionState.data?.pages) ? versionState.data.pages : [];
}

function showCopyToast(message) {
  let toast = document.querySelector(".copy-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "copy-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.remove("is-visible");
  window.clearTimeout(showCopyToast.timer);
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });
  showCopyToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1600);
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
  return ["first", "last", "middle"]
    .map((key) => pickupTemplate(page, pickups[key], key))
    .join("");
}

function pickupTemplate(page, pickup, key) {
  if (!pickup || pickup.enabled === false) return "";
  const label = key === "middle" ? "배포" : pickup.label || "";
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

function highCounterTemplate(page) {
  const event = page.events?.highCounter;
  if (!event) return "";
  const profiles = Array.isArray(event.profiles) ? event.profiles : [];
  const codes = exchangeCodes(page);
  return `
    <article class="version-card event-card high-counter-card">
      <div class="high-counter-layout ${codes.length ? "has-exchange" : ""}">
        <div class="high-counter-main">
          <div class="version-event-header">
            <img class="version-event-icon" src="${escapeAttr(event.icon || "")}" alt="" />
            <h2>[${escapeHtml(event.label || "")}]</h2>
          </div>
          <div class="version-event-profiles" aria-hidden="true">
            ${profiles.map((name) => profileSlot(name, "version-image-slot-large")).join("")}
          </div>
        </div>
        ${codes.length ? `
          <div class="high-counter-divider" aria-hidden="true"></div>
          <div class="exchange-code-panel">
            <h2>[교환 코드]</h2>
            <div class="exchange-code-list">
              ${codes.map((code) => exchangeCodeItem(code)).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    </article>
  `;
}

function exchangeCodeItem(code) {
  return `
    <div class="exchange-code-item">
      <button class="exchange-copy-button" type="button" data-copy-code="${escapeAttr(code.name)}" aria-label="${escapeAttr(code.name)} 복사">
        <span class="exchange-copy-icon" aria-hidden="true"></span>
        <span class="exchange-code-name">${escapeHtml(code.name)}</span>
      </button>
      <span class="exchange-code-separator" aria-hidden="true">|</span>
      <span class="exchange-code-date">${escapeHtml(exchangeCodeDate(code))}</span>
    </div>
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
        <p>${escapeHtml(key === "ripples" ? "*해당 버전 광상을 받은 마도학자는 주황빛으로 빛납니다." : (event.dateMode === "none" ? "기간 제한 없음" : versionDateRange(page)))}</p>
      </div>
      <div class="version-event-profiles" aria-hidden="true">
        ${profiles.map((profile) => profileSlot(profile, "version-image-slot-large", key === "ripples" && profileHighlighted(profile))).join("")}
      </div>
    </article>
  `;
}

function profileSlot(name, sizeClass, highlighted = false) {
  const cleanName = profileName(name);
  const image = cleanName ? `profile/${cleanName}.png` : "";
  const style = image ? ` style="background-image: url('${escapeAttr(encodeURI(image))}')"` : "";
  return `<div class="version-image-slot ${sizeClass}${highlighted ? " is-highlighted" : ""}"${style}></div>`;
}

function pickupNames(page, key) {
  const pickup = page.pickups?.[key];
  if (!pickup || pickup.enabled === false) return [];
  return uniqueNames([pickup.name, ...(Array.isArray(pickup.profiles) ? pickup.profiles : [])]);
}

function pickupTagList(page, key) {
  const pickup = page.pickups?.[key];
  if (!pickup || pickup.enabled === false) return tagItems([]);
  const items = [];
  const pickupName = clean(pickup.name);
  if (pickupName) items.push({ name: pickupName, tone: "pickup" });
  uniqueNames(Array.isArray(pickup.profiles) ? pickup.profiles : []).forEach((name) => {
    items.push({ name, tone: "five-star" });
  });
  return tagItems(items);
}

function exchangeCodes(page) {
  return (Array.isArray(page.exchangeCodes) ? page.exchangeCodes : [])
    .map((code) => ({
      name: clean(code?.name),
      month: clean(code?.month),
      day: clean(code?.day)
    }))
    .filter((code) => code.name);
}

function exchangeCodeDate(code) {
  return `${code.month || ""}월 ${code.day || ""}일 04:59까지`;
}

function eventNames(page, key) {
  const event = page.events?.[key];
  if (!event) return [];
  return uniqueNames(Array.isArray(event.profiles) ? event.profiles : []);
}

function profileName(profile) {
  return clean(typeof profile === "string" ? profile : profile?.name);
}

function profileHighlighted(profile) {
  return Boolean(typeof profile === "object" && profile?.highlighted);
}

function uniqueNames(names) {
  return [...new Set(names.map(profileName).filter(Boolean))];
}

function tagList(names, tone) {
  const cleanNames = uniqueNames(names);
  return tagItems(cleanNames.map((name) => ({ name, tone })));
}

function tagItems(items) {
  if (items.length === 0) return '<span class="version-empty">-</span>';
  return `
    <div class="version-tag-list">
      ${items.map((item) => `<span class="version-tag version-tag--${item.tone}">${escapeHtml(item.name)}</span>`).join("")}
    </div>
  `;
}

function versionDateRange(page) {
  return `${dateStart(page.start)} → ${dateEnd(page.end)}`;
}

function versionTableSchedule(page) {
  return `
    <span>${escapeHtml(dateStart(page.start))}</span>
    <span>→ ${escapeHtml(dateEnd(page.end))}</span>
  `;
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

function versionDurationWeeks(page) {
  const start = dateToTimestamp(page.start);
  const end = dateToTimestamp(page.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "-";
  const days = (end - start) / 86400000;
  return `${Math.max(1, Math.ceil(days / 7))}주`;
}

function dateToTimestamp(date) {
  const year = Number(date?.year);
  const month = Number(date?.month);
  const day = Number(date?.day);
  if (!year || !month || !day) return NaN;
  return new Date(year, month - 1, day).getTime();
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
