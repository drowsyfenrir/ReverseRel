const GUIDE_INSPIRATIONS = ["암석", "천체", "나무", "야수", "영혼", "지능", "암석+천체"];
const guideState = { characters: [], inspiration: "", search: "" };
const guideGrid = document.getElementById("characterGrid");
const guideFilters = document.getElementById("characterFilters");
const guideStatus = document.getElementById("characterGuideStatus");
const guideEscape = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
const guideAsset = (folder, name) => folder + "/" + encodeURIComponent(String(name).trim()) + ".png";
const guideInspiration = (name) => name === "천체+암석" ? "암석+천체" : name;

function guideMatches(character, inspiration, search) {
  const value = guideInspiration(character.inspiration);
  const matchesInspiration = !inspiration || value === inspiration
    || (value === "암석+천체" && (inspiration === "암석" || inspiration === "천체"));
  return character.visible !== false && matchesInspiration && String(character.name || "").toLocaleLowerCase("ko").includes(search.trim().toLocaleLowerCase("ko"));
}

function renderGuideFilters() {
  guideFilters.innerHTML = '<button type="button" data-inspiration="" aria-pressed="' + !guideState.inspiration + '">전체</button>' +
    GUIDE_INSPIRATIONS.map((name) => '<button type="button" data-inspiration="' + name + '" aria-label="' + name + '" title="' + name + '" aria-pressed="' + (guideState.inspiration === name) + '"><img src="' + guideAsset("img/character/영감", name + "_서클") + '" alt="' + name + '" /></button>').join("");
}

function renderGuideCard(c) {
  const tuning = c.tuning?.[0] || {};
  const modulationLabel = Array.from(String(tuning.modulation || "미정")).slice(0, 2).join("");
  const will = c.wills?.[0] || {};
  const name = String(c.name || "");
  const displayName = ({ "미스 스트레인저": "미스스", "로렌츠 버터플라이": "로렌츠" })[name] || name;
  return '<article class="character-guide-card" tabindex="0" data-character-id="' + guideEscape(c.id) + '" aria-label="' + guideEscape(name) + ' 상세보기">' +
    '<div class="character-guide-column"><div class="character-guide-portrait-stage"><div class="pickup-schedule-image character-guide-portrait"><img loading="lazy" src="' + guideAsset("profile", name) + '" alt="' + guideEscape(name) + '" /></div>' + (c.inspiration ? '<img class="character-guide-flag" src="' + guideAsset("img/character/영감", guideInspiration(c.inspiration) + "_플래그") + '" alt="' + guideEscape(c.inspiration) + '" />' : '') + '</div><span class="character-guide-name" title="' + guideEscape(name) + '">' + guideEscape(displayName) + '</span></div>' +
    '<div class="character-guide-column"><div class="character-guide-will">' + (will.name ? '<img loading="lazy" src="' + guideAsset("img/character/의지", will.name) + '" alt="' + guideEscape(will.name) + '" />' : '') + '</div><span class="character-guide-name">' + guideEscape(will.name || "미입력") + '</span></div>' +
    '<div class="character-guide-capsules"><span class="character-guide-version">' + guideEscape(c.version || "") + '</span>' +
    '<button class="deck-mini-capsule" type="button" data-guide-code="' + guideEscape(tuning.resonance || "") + '" title="공명 코드 복사" aria-label="' + guideEscape(name) + ' 공명 코드 복사"' + (tuning.resonance ? '' : ' disabled') + '>' + (tuning.modulation ? '<img loading="lazy" src="' + guideAsset("img/character/변조", tuning.modulation) + '" alt="" />' : '<i class="character-modulation-unknown" aria-hidden="true"></i>') + '<span>' + guideEscape(modulationLabel) + '</span></button></div>' +
    (Array.isArray(c.euphoria) && c.euphoria.some((value) => String(value ?? "").trim()) ? '<span class="character-guide-euphoria"><img src="img/character/광상/광상.png" alt="" /><span>광상</span></span>' : '') + '</article>';
}

function renderGuide() {
  const visible = guideState.characters.filter((c) => guideMatches(c, guideState.inspiration, guideState.search));
  guideGrid.innerHTML = visible.map(renderGuideCard).join("");
  guideGrid.querySelectorAll("img").forEach((img) => img.addEventListener("error", () => { img.hidden = true; }, { once: true }));
  guideStatus.textContent = (guideState.inspiration || "전체") + " 캐릭터 " + visible.length + "명";
}
guideFilters.addEventListener("click", (e) => {
  const button = e.target.closest("[data-inspiration]");
  if (!button) return;
  guideState.inspiration = button.dataset.inspiration;
  renderGuideFilters(); renderGuide();
});
document.getElementById("characterSearch").addEventListener("input", (e) => {
  guideState.search = e.target.value; renderGuide();
});
let guideToastTimer;
function showGuideCopyToast() {
  let toast = document.getElementById("characterCopyToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "characterCopyToast";
    toast.className = "copy-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.append(toast);
  }
  clearTimeout(guideToastTimer);
  toast.textContent = "복사 완료";
  toast.classList.add("is-visible");
  guideToastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}
guideGrid.addEventListener("click", async (e) => {
  const button = e.target.closest("[data-guide-code]");
  if (!button) {
    const card = e.target.closest("[data-character-id]");
    if (card) openCharacterDetail(card.dataset.characterId);
    return;
  }
  if (!button.dataset.guideCode) return;
  e.stopPropagation();
  try {
    await navigator.clipboard.writeText(button.dataset.guideCode);
    showGuideCopyToast();
  } catch { guideStatus.textContent = "복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요."; }
});
renderGuideFilters();
fetch("character-data.json", { cache: "no-store" }).then((response) => {
  if (!response.ok) throw new Error("캐릭터 데이터를 불러오지 못했습니다.");
  return response.json();
}).then((data) => {
  if (!Array.isArray(data.characters)) throw new Error("캐릭터 데이터 형식을 확인하세요.");
  guideState.characters = data.characters.slice().reverse();
  renderGuide();
}).catch((error) => { guideStatus.textContent = error.message; });
const characterDetailDialog = document.getElementById("characterDetailDialog");
const characterDetailContent = document.getElementById("characterDetailContent");
let characterDeckObserver;
let characterReturnScroll = 0;
let characterMobileReading = false;
const detailImage = (folder, name, className = "") => name && String(name).trim() !== "미정"
  ? '<img class="' + className + '" src="' + guideAsset(folder, name) + '" alt="' + guideEscape(name) + '" />'
  : '<span aria-hidden="true"></span>';
function euphoriaFileName(label) {
  return String(label).replace(/[\\/:*?"<>|]/g, "").trim().replace(/[. ]+$/g, "");
}
function openCharacterDetail(id) {
  const c = guideState.characters.find((item) => item.id === id);
  if (!c) return;
  const inspirationColor = ({ "영혼": "#6d3c71", "야수": "#823838", "천체": "#284059", "나무": "#286638", "암석": "#5e4524", "지능": "#86783c", "암석+천체": "#5e4524" })[guideInspiration(c.inspiration)] || "#101828";
  characterDetailContent.style.setProperty("--character-inspiration-color", inspirationColor);
  characterDeckObserver?.disconnect();
  const tuning = (c.tuning || []).filter((t) => t.modulation || t.resonance || t.notes);
  const wills = Array.from({ length: 4 }, (_, i) => c.wills?.[i] || {});
  const euphoria = (c.euphoria || []).map((name, index) => ({ name, recommended: c.euphoriaEnabled?.[index] === true })).filter((item) => String(item.name ?? "").trim());
  characterDetailContent.innerHTML =
    '<div class="character-detail-overview"><div class="character-detail-profile"><div class="character-detail-profile-art">' + detailImage("profile", c.name) + (c.inspiration ? '<img class="character-detail-afflatus" src="' + guideAsset("img/character/영감", guideInspiration(c.inspiration) + "_풀") + '" alt="' + guideEscape(c.inspiration) + '" />' : '') + '</div><h3>' + guideEscape(c.name) + '</h3></div>' +
    '<section class="character-detail-section character-detail-tuning-section"><h3 class="character-detail-icon-heading"><img class="character-detail-heading-icon" src="img/character/변조/아이콘.png" alt="" />변조 / 공명</h3>' +
    (tuning.length ? tuning.map((t) => '<div class="character-detail-tuning"' + (t.resonance && t.resonance !== "미정" ? ' role="button" tabindex="0" data-detail-code="' + guideEscape(t.resonance) + '" aria-label="공명 코드 복사"' : '') + '>' + detailImage("img/character/변조", t.modulation) + '<div class="character-detail-tuning-content"><div class="character-detail-tuning-title"><strong>' + guideEscape(t.modulation === "미정" ? "" : t.modulation || "") + '</strong>' + (t.notes ? '<span class="character-detail-separator">|</span><span>' + guideEscape(t.notes) + '</span>' : '') + '</div><div class="character-detail-code"><span>' + guideEscape(t.resonance === "미정" ? "" : t.resonance || "") + '</span>' + '</div></div></div>').join("") : '') + '</section>' +
    '<section class="character-detail-portrait-info"><h3 class="character-detail-icon-heading"><img class="character-detail-heading-icon" src="img/character/형상/아이콘.png" alt="" />형상</h3><img src="' + guideAsset("img/character/형상", c.name) + '" alt="' + guideEscape(c.name) + ' 형상" /><p>' + guideEscape(c.portrait === "미정" ? "" : c.portrait || "") + '</p></section></div>' +
    '<section class="character-detail-section"><h3 class="character-detail-icon-heading"><img class="character-detail-heading-icon" src="img/character/의지/아이콘.png" alt="" />의지</h3><div class="character-detail-wills">' +
    wills.map((w) => '<div class="character-detail-will"><div class="character-detail-will-meta"><strong>' + guideEscape(w.importance || "") + '</strong><span>' + guideEscape(String(w.notes || "").trim() || "-") + '</span></div><div class="character-detail-will-image">' + detailImage("img/character/의지", w.name) + '</div><p>' + guideEscape(w.name === "미정" ? "" : w.name || "") + '</p></div>').join("") + '</div></section>' +
    '<section class="character-detail-section"><h3 class="character-detail-icon-heading"><img class="character-detail-heading-icon" src="img/character/광상/광상.png" alt="" />광상</h3><div class="character-detail-euphorias">' +
    (euphoria.length ? euphoria.filter((item) => String(item.name).trim() !== "미정").map(({ name, recommended }) => {
      const notes = Array.from(String(name).matchAll(/[（(]([^()（）]*)[）)]/g), (match) => match[1]);
      const label = String(name).replace(/[（(][^()（）]*[）)]/g, "").trim();
      const imageBase = "img/character/광상/" + encodeURIComponent(euphoriaFileName(label));
      return '<div><p class="character-detail-euphoria-notes">' + guideEscape(notes.join(" · ").trim() || "-") + '</p><div class="character-detail-euphoria-art"><img class="character-detail-euphoria-image" src="' + imageBase + '.webp" data-euphoria-png="' + imageBase + '.png" alt="' + guideEscape(label) + '" />' + (recommended ? '<span class="character-euphoria-ribbon">추천</span>' : '') + '</div><p>' + guideEscape(label) + '</p></div>';
    }).join("") : '') + '</div></section>' +
    '<section class="character-detail-section"><h3 class="character-detail-icon-heading"><img class="character-detail-heading-icon" src="img/character/deck.png" alt="" />관련 덱</h3><iframe class="character-detail-decks" title="' + guideEscape(c.name) + ' 관련 픽업 일정" src="pickup-schedule-embed.html?character=' + encodeURIComponent(c.name) + '"></iframe></section>';
  characterDetailContent.querySelectorAll("img").forEach((img) => img.addEventListener("error", () => {
    if (img.classList.contains("character-detail-afflatus")) {
      img.remove();
      return;
    }
    if (img.dataset.euphoriaPng) {
      const png = img.dataset.euphoriaPng;
      delete img.dataset.euphoriaPng;
      img.src = png;
      return;
    }
    const placeholder = document.createElement("span");
    placeholder.className = "character-detail-placeholder";
    placeholder.textContent = "이미지 준비 중";
    img.replaceWith(placeholder);
  }));
  const afflatus = characterDetailContent.querySelector(".character-detail-afflatus");
  if (afflatus) {
    const reserveAfflatusHeight = () => {
      if (!afflatus.naturalWidth) return;
      const halfHeight = 100 * afflatus.naturalHeight / afflatus.naturalWidth / 2;
      characterDetailContent.querySelector(".character-detail-profile").style.setProperty("--character-afflatus-half-height", halfHeight + "px");
    };
    afflatus.addEventListener("load", reserveAfflatusHeight);
    if (afflatus.complete) reserveAfflatusHeight();
  }
  const frame = characterDetailContent.querySelector("iframe");
  frame.addEventListener("load", () => {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const resize = () => {
        const root = doc.querySelector(".pickup-shell") || doc.body;
        frame.style.height = Math.ceil(root.getBoundingClientRect().height + 16) + "px";
      };
      characterDeckObserver = new ResizeObserver(resize);
      characterDeckObserver.observe(doc.body);
      resize();
    } catch { frame.style.height = "600px"; }
  });
  characterReturnScroll = window.scrollY;
  characterMobileReading = window.matchMedia("(max-width: 720px)").matches;
  if (characterMobileReading) {
    characterDetailDialog.show();
    document.body.classList.add("character-mobile-reading");
    window.scrollTo(0, 0);
  } else characterDetailDialog.showModal();
  document.documentElement.classList.add("character-detail-open");
  characterDetailContent.scrollTop = 0;
}
async function copyDetailResonance(target) {
  const row = target.closest("[data-detail-code]");
  if (!row) return;
  try {
    await navigator.clipboard.writeText(row.dataset.detailCode);
    showGuideCopyToast();
    const toast = document.getElementById("characterCopyToast");
    if (toast.parentElement !== characterDetailDialog) characterDetailDialog.append(toast);
  } catch { guideStatus.textContent = "복사하지 못했습니다. 클립보드 권한을 확인하세요."; }
}
characterDetailContent.addEventListener("click", (e) => copyDetailResonance(e.target));
characterDetailContent.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-detail-code]")) {
    e.preventDefault();
    copyDetailResonance(e.target);
  }
});
document.getElementById("closeCharacterDetail").addEventListener("click", () => characterDetailDialog.close());
characterDetailDialog.addEventListener("close", () => {
  document.body.classList.remove("character-mobile-reading");
  if (characterMobileReading) window.scrollTo(0, characterReturnScroll);
  characterMobileReading = false;
  const toast = document.getElementById("characterCopyToast");
  if (toast) { toast.classList.remove("is-visible"); document.body.append(toast); }
  characterDeckObserver?.disconnect();
  document.documentElement.classList.remove("character-detail-open");
});
characterDetailDialog.addEventListener("click", (e) => {
  if (e.target !== characterDetailDialog) return;
  const rect = characterDetailDialog.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) characterDetailDialog.close();
});
guideGrid.addEventListener("keydown", (e) => {
  if (e.target.matches(".character-guide-card") && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openCharacterDetail(e.target.dataset.characterId);
  }
});
