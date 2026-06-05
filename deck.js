const deckState = {
  decks: [],
  activeId: "",
  activeCycleIndex: 0,
  query: ""
};

fetch(`deck-data.json?v=${Date.now()}`, { cache: "no-store" })
  .then((response) => response.json())
  .then((data) => {
    deckState.decks = normalizeDeckData(data).decks;
    deckState.activeId = deckState.decks[0]?.id || "";
    renderDeckList();
  })
  .catch(() => {
    document.getElementById("deckList").innerHTML = '<p class="deck-empty">deck-data.json을 불러오지 못했습니다.</p>';
  });

document.getElementById("deckSearchInput").addEventListener("input", (event) => {
  deckState.query = event.target.value.trim().toLowerCase();
  renderDeckList();
});

document.getElementById("deckList").addEventListener("click", (event) => {
  const card = event.target.closest("[data-deck-id]");
  if (!card) return;
  openDeckDetail(card.dataset.deckId);
});

document.getElementById("deckList").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-deck-id]");
  if (!card) return;
  event.preventDefault();
  openDeckDetail(card.dataset.deckId);
});

document.getElementById("deckDetailPopup").addEventListener("click", async (event) => {
  if (event.target.closest("[data-deck-back]")) {
    document.querySelector(".deck-list-popup").hidden = false;
    document.getElementById("deckDetailPopup").hidden = true;
    return;
  }
  const cycleButton = event.target.closest("[data-cycle-step]");
  if (cycleButton) {
    const deck = activeDeck();
    if (!deck?.cycles.length) return;
    deckState.activeCycleIndex = wrapIndex(deckState.activeCycleIndex + Number(cycleButton.dataset.cycleStep), deck.cycles.length);
    renderDeckDetail(deck);
    return;
  }
  const codeButton = event.target.closest("[data-member-code]");
  if (codeButton) {
    const text = codeButton.dataset.memberCode || "";
    if (!text) return;
    await copyText(text);
    showCopyToast("복사 완료");
  }
});

function normalizeDeckData(data) {
  const decks = Array.isArray(data.decks) ? data.decks : [];
  return { decks: decks.length ? decks.map(normalizeDeck) : [] };
}

function normalizeDeck(deck, index) {
  const normalized = {
    id: deck.id || `deck-${Date.now()}-${index}`,
    name: deck.name || "새 덱",
    profile: deck.profile || "",
    types: deck.types || "",
    description: deck.description || "",
    members: Array.isArray(deck.members) ? deck.members.slice(0, 4) : [],
    note: deck.note || "",
    cycles: Array.isArray(deck.cycles) ? deck.cycles : []
  };
  while (normalized.members.length < 4) normalized.members.push({});
  normalized.members = normalized.members.map((member) => ({
    name: member?.name || "",
    afflatus: member?.afflatus || "",
    psychube: member?.psychube || "",
    euphoria: member?.euphoria || "",
    tuning: member?.tuning || "",
    code: member?.code || ""
  }));
  normalized.cycles = normalized.cycles.map((cycle) => ({
    name: cycle?.name || "사이클",
    description: cycle?.description || "",
    rounds: Array.isArray(cycle?.rounds) ? cycle.rounds.map((round) => Array.isArray(round) ? round.map(normalizeRoundSkill) : []) : []
  }));
  return normalized;
}

function normalizeRoundSkill(entry) {
  if (typeof entry === "string") return { skill: entry, ready: false, overwrite: false };
  return {
    skill: entry?.skill || "",
    ready: Boolean(entry?.ready),
    overwrite: Boolean(entry?.overwrite)
  };
}

function renderDeckList() {
  const list = document.getElementById("deckList");
  const decks = deckState.decks.filter((deck) => {
    if (!deckState.query) return true;
    return `${deck.name} ${deck.description} ${deck.types}`.toLowerCase().includes(deckState.query);
  });
  list.innerHTML = decks.map((deck) => `
    <article class="deck-card" role="button" tabindex="0" data-deck-id="${escapeAttr(deck.id)}">
      <div class="deck-card-head">
        <img class="deck-profile" src="${profilePath(deck.profile)}" alt="${escapeAttr(deck.profile || deck.name)}" />
        <div class="deck-card-copy">
          <h2>${escapeHtml(deck.name)}</h2>
          <p>${escapeHtml(deck.description)}</p>
        </div>
      </div>
      <div class="deck-keywords" aria-label="키워드">
        ${splitTypes(deck.types).map((type) => `<span>${escapeHtml(type)}</span>`).join("")}
      </div>
      <img class="deck-open" src="img/deck/arrow outward.svg" alt="" aria-hidden="true" />
    </article>
  `).join("") || '<p class="deck-empty">표시할 덱이 없습니다.</p>';
}

function openDeckDetail(deckId) {
  const deck = deckState.decks.find((item) => item.id === deckId);
  if (!deck) return;
  deckState.activeId = deckId;
  deckState.activeCycleIndex = 0;
  renderDeckDetail(deck);
  document.querySelector(".deck-list-popup").hidden = true;
  document.getElementById("deckDetailPopup").hidden = false;
}

function renderDeckDetail(deck) {
  const popup = document.getElementById("deckDetailPopup");
  const cycle = deck.cycles[deckState.activeCycleIndex] || null;
  popup.innerHTML = `
    <div class="deck-detail">
      <button class="deck-detail-back" type="button" data-deck-back aria-label="덱 리스트로 돌아가기">
        <span aria-hidden="true"></span>
        <strong>${escapeHtml(deck.name)}</strong>
      </button>
      <div class="deck-detail-slots">
        <section class="deck-detail-slot" aria-label="마도학자 구성">
          <div class="deck-member-list">
            ${deck.members.map(memberTemplate).join("")}
          </div>
        </section>
        <section class="deck-detail-slot deck-note-slot" aria-label="특이사항">
          <h2>[특이사항]</h2>
          <p>${escapeHtml(deck.note)}</p>
        </section>
        <section class="deck-detail-slot deck-cycle-slot" aria-label="카드 사이클">
          <div class="deck-cycle-inner">
            <div class="deck-cycle-header">
              <h2>[카드 사이클]</h2>
              <button class="deck-cycle-select" type="button" aria-label="카드 사이클 선택">
                <img src="img/deck/left.svg" alt="" data-cycle-step="-1" />
                <span>${escapeHtml(cycle?.name || "사이클 없음")}</span>
                <img src="img/deck/right.svg" alt="" data-cycle-step="1" />
              </button>
            </div>
            <p class="deck-cycle-description">${escapeHtml(cycle?.description || "")}</p>
            ${(cycle?.rounds || []).map(roundTemplate).join("")}
          </div>
        </section>
      </div>
    </div>
  `;
}

function memberTemplate(member) {
  const name = member.name || "마도학자";
  return `
    <article class="deck-member">
      <div class="deck-member-standing">
        <div class="deck-member-frame">
          <img class="deck-member-art" src="${standingPath(member.name)}" alt="${escapeAttr(name)}" />
          <img class="deck-member-rarity" src="img/deck/6성.png" alt="" />
          ${bottomIconTemplate("의지", member.psychube)}
          ${bottomIconTemplate("광상", member.euphoria)}
        </div>
        <img class="deck-member-afflatus" src="${namedAssetPath("영감", member.afflatus)}" alt="" />
        <span class="deck-bottom-icon-name deck-bottom-icon-name--left">${escapeHtml(member.psychube)}</span>
        <span class="deck-bottom-icon-name deck-bottom-icon-name--right">${escapeHtml(member.euphoria)}</span>
      </div>
      <h2>${escapeHtml(name)}</h2>
      <div class="deck-member-capsules">
        <span class="deck-mini-capsule">
          <img src="${namedAssetPath("변조", member.tuning)}" alt="" />
          <span>${escapeHtml(member.tuning)}</span>
        </span>
        <button class="deck-mini-capsule deck-code-capsule" type="button" data-member-code="${escapeAttr(member.code)}">
          <span class="deck-code-icon" aria-hidden="true"></span>
          <span>코드</span>
        </button>
      </div>
    </article>
  `;
}

function bottomIconTemplate(folder, name) {
  const value = String(name || "").trim();
  if (!value) return '<span class="deck-bottom-icon is-empty" aria-hidden="true"></span>';
  return `
    <span class="deck-bottom-icon">
      <img src="${namedAssetPath(folder, value)}" alt="" />
    </span>
  `;
}

function roundTemplate(round, index) {
  return `
    <div class="deck-cycle-round">
      <div class="deck-round-divider"><span>Round ${index + 1}</span></div>
      <div class="deck-skill-row">
        ${round.map((entry, skillIndex) => skillCardTemplate(entry, round[skillIndex - 1])).join("")}
      </div>
    </div>
  `;
}

function skillCardTemplate(entry, previousEntry) {
  const item = normalizeRoundSkill(entry);
  const previous = normalizeRoundSkill(previousEntry);
  return `
    <span class="deck-skill-item">
      <img class="${skillClass(item.skill, previous.skill)}" src="${skillPath(item.skill)}" alt="" />
      ${item.ready ? '<img class="deck-skill-overlay" src="img/deck/스킬/준비.png" alt="" />' : ""}
      ${item.overwrite ? '<img class="deck-skill-overlay" src="img/deck/스킬/덮어쓰기.png" alt="" />' : ""}
    </span>
  `;
}

function activeDeck() {
  return deckState.decks.find((deck) => deck.id === deckState.activeId) || null;
}

function splitTypes(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function profilePath(name) {
  return `profile/${encodePathName(name || "베릴")}.png`;
}

function standingPath(name) {
  return `img/deck/스탠딩/${encodePathName(assetName(name || "베릴"))}.png`;
}

function namedAssetPath(folder, name) {
  return `img/deck/${folder}/${encodePathName(name || "정성")}.png`;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
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

function skillPath(name) {
  return `img/deck/스킬/${encodePathName(name || "술식")}.png`;
}

function skillClass(name, previousName = "") {
  if (/3$/.test(String(name || "").trim())) return "deck-skill-card deck-skill-card--tall";
  if (String(previousName || "").trim() === "로렌츠3") return "deck-skill-card deck-skill-card--small";
  return "deck-skill-card";
}

function assetName(name) {
  const aliases = { "로렌츠 버터플라이": "로렌츠" };
  return aliases[name] || name;
}

function encodePathName(name) {
  return String(name || "").replaceAll("#", "%23");
}

function wrapIndex(index, length) {
  return ((index % length) + length) % length;
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
