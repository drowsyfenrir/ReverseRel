const pickupEditorState = {
  data: null,
  selectedPanel: "banner",
  fileHandle: null,
  draggedBlockIndex: null
};

const PICKUP_SCHEMA = "reverse-rel-pickup-data";
const PICKUP_FILE_NAME = "pickup-data.json";
const PICKUP_BACKUP_RE = /^pickup-data\.backup-\d{8}-\d{6}\.json$/;
const PANEL_LABELS = { banner: "픽업 배너", schedule: "마도학자 일정" };

fetch(`pickup-data.json?v=${Date.now()}`, { cache: "no-store" })
  .then((response) => response.json())
  .then((data) => {
    pickupEditorState.data = normalizePickupData(data);
    renderPickupEditor();
    setPickupStatus("pickup-data.json을 불러왔습니다.");
  })
  .catch(() => {
    pickupEditorState.data = normalizePickupData({});
    renderPickupEditor();
    setPickupStatus("pickup-data.json을 읽지 못해 새 데이터로 시작합니다.");
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
    id: condition?.id || `condition-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    version: condition?.version || "",
    label: condition?.label || "",
    names: condition?.names || ""
  })) : [];
}

function normalizeBlocks(blocks) {
  return Array.isArray(blocks) ? blocks.map(normalizeBlock) : [];
}

function normalizeBlock(block) {
  const names = Array.isArray(block?.names) ? block.names : [];
  return {
    id: block?.id || `block-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: block?.type || "text",
    text: block?.text || "",
    banner: block?.banner || "",
    name: block?.name || "",
    kind: block?.kind || "",
    category: block?.category || "",
    content: block?.content || "",
    note: block?.note || "",
    names: block?.type === "deck" ? normalizeNames(names) : names.map((name) => name || ""),
    visible: block?.visible !== false
  };
}

function normalizeNames(names) {
  const normalized = names.map((name) => name || "");
  while (normalized.length < 4) normalized.push("");
  return normalized;
}

function renderPickupEditor() {
  renderPanelList();
  renderPickupForm();
}

function renderPanelList() {
  document.getElementById("pickupPanelList").innerHTML = Object.entries(PANEL_LABELS).map(([key, label]) => `
    <button class="pickup-editor-panel-item ${pickupEditorState.selectedPanel === key ? "is-selected" : ""}" type="button" data-select-panel="${key}">
      ${escapeHtml(label)}
    </button>
  `).join("");
}

function renderPickupForm() {
  const form = document.getElementById("pickupEditorForm");
  const blocks = currentBlocks();
  const isSchedule = pickupEditorState.selectedPanel === "schedule";
  form.innerHTML = `
    ${isSchedule ? renderConditionEditor() : ""}
    <section class="deck-editor-section pickup-editor-layout">
      <nav class="pickup-editor-tools" aria-label="${isSchedule ? "마도학자 일정" : "픽업 배너"} 블록 추가">
        ${isSchedule ? `
          <button type="button" data-add-block="deck">덱 추가</button>
        ` : `
          <button type="button" data-add-block="header">헤더 추가</button>
          <button type="button" data-add-block="banner">배너 추가</button>
          <button type="button" data-add-block="text">텍스트 추가</button>
        `}
      </nav>
      <div class="pickup-editor-blocks">
        ${blocks.length ? blocks.map(blockTemplate).join("") : '<p class="deck-editor-empty">왼쪽 버튼으로 컨텐츠를 추가하세요.</p>'}
      </div>
    </section>
  `;
}

function renderConditionEditor() {
  const conditions = pickupEditorState.data.conditions || [];
  return `
    <section class="deck-editor-section pickup-editor-conditions">
      <header class="pickup-editor-conditions-header">
        <strong>조건 추가</strong>
        <button type="button" data-add-condition>조건 추가</button>
      </header>
      <div class="pickup-editor-condition-list">
        ${conditions.length ? conditions.map(conditionTemplate).join("") : '<p class="deck-editor-empty">수동 조건을 추가할 수 있습니다.</p>'}
      </div>
    </section>
  `;
}

function conditionTemplate(condition, index) {
  return `
    <div class="pickup-editor-condition-row" data-condition-index="${index}">
      <label class="deck-editor-field">
        <span>버전</span>
        <input data-condition-index="${index}" data-condition-field="version" type="text" value="${escapeAttr(condition.version)}" placeholder="3.6" />
      </label>
      <label class="deck-editor-field">
        <span>명칭</span>
        <input data-condition-index="${index}" data-condition-field="label" type="text" value="${escapeAttr(condition.label)}" placeholder="복각" />
      </label>
      <label class="deck-editor-field">
        <span>마도학자</span>
        <input data-condition-index="${index}" data-condition-field="names" type="text" value="${escapeAttr(condition.names)}" placeholder="베릴, 레굴루스" />
      </label>
      <button type="button" data-remove-condition="${index}" aria-label="조건 삭제">-</button>
    </div>
  `;
}

function blockTemplate(block, index) {
  const title = block.type === "header" ? "헤더" : block.type === "banner" ? "배너" : block.type === "deck" ? "덱" : "텍스트";
  const visible = block.visible !== false;
  const deckNameInput = block.type === "deck" ? `
    <input class="pickup-editor-deck-name" data-block-index="${index}" data-field="name" type="text" value="${escapeAttr(block.name)}" placeholder="덱 이름" />
  ` : "";
  return `
    <article class="pickup-editor-block ${visible ? "" : "is-hidden"}" data-block-index="${index}" draggable="true">
      <header>
        <div class="pickup-editor-block-title">
          <strong>${title}</strong>
          ${deckNameInput}
        </div>
        <div class="pickup-editor-block-actions">
          <button type="button" data-move-block="${index}" data-direction="-1" aria-label="${title} 위로 이동">▲</button>
          <button type="button" data-move-block="${index}" data-direction="1" aria-label="${title} 아래로 이동">▼</button>
          <button class="${visible ? "is-visible" : "is-hidden"}" type="button" data-toggle-visible="${index}" aria-label="${title} ${visible ? "숨김" : "보임"}">${visible ? "👁" : "🚫"}</button>
          <button type="button" data-remove-block="${index}" aria-label="${title} 삭제">-</button>
        </div>
      </header>
      ${blockFields(block, index)}
    </article>
  `;
}

function blockFields(block, index) {
  if (block.type === "header") return field(index, "text", "헤더 텍스트", block.text, "가운데 정렬 헤더");
  if (block.type === "deck") return scheduleDeckFields(block, index);
  if (block.type === "banner") {
    const preview = block.banner ? `<img src="img/pickup/notice/${encodeURIComponent(block.banner)}.png" alt="" />` : "";
    return `
      <div class="pickup-editor-banner-preview">${preview}</div>
      <div class="deck-editor-grid deck-editor-grid-3">
        ${field(index, "banner", "배너", block.banner, "이미지 파일명")}
        ${field(index, "name", "이름", block.name)}
        ${field(index, "kind", "종류", block.kind)}
        ${field(index, "category", "구분", block.category)}
        ${field(index, "content", "내용", block.content)}
        ${field(index, "note", "비고", block.note)}
      </div>
    `;
  }
  return textareaField(index, "text", "텍스트", block.text, "가운데 정렬 텍스트");
}

function scheduleDeckFields(block, index) {
  const names = normalizeNames(block.names || []);
  block.names = names;
  return `
    <div class="pickup-editor-schedule-title">
      <span>마도학자 이름</span>
      <button type="button" data-add-schedule-name="${index}" aria-label="마도학자 이름 추가">+</button>
    </div>
    <div class="pickup-editor-name-grid">
      ${names.map((name, nameIndex) => `
        <label class="deck-editor-field">
          <span>마도학자 ${nameIndex + 1}</span>
          <input data-block-index="${index}" data-name-index="${nameIndex}" type="text" value="${escapeAttr(name)}" placeholder="마도학자 이름" />
        </label>
      `).join("")}
    </div>
  `;
}

function field(index, name, label, value, placeholder = "") {
  return `
    <label class="deck-editor-field">
      <span>${label}</span>
      <input data-block-index="${index}" data-field="${name}" type="text" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" />
    </label>
  `;
}

function textareaField(index, name, label, value, placeholder = "") {
  return `
    <label class="deck-editor-field">
      <span>${label}</span>
      <textarea data-block-index="${index}" data-field="${name}" placeholder="${escapeAttr(placeholder)}">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function currentBlocks() {
  return pickupEditorState.data.panels[pickupEditorState.selectedPanel].blocks;
}

document.getElementById("pickupPanelList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-panel]");
  if (!button) return;
  syncPickupForm();
  pickupEditorState.selectedPanel = button.dataset.selectPanel;
  renderPickupEditor();
});

document.getElementById("pickupEditorForm").addEventListener("click", (event) => {
  const addConditionButton = event.target.closest("[data-add-condition]");
  if (addConditionButton) {
    syncPickupForm();
    pickupEditorState.data.conditions.push(normalizeConditions([{}])[0]);
    renderPickupForm();
    setPickupStatus("수동 조건을 추가했습니다.");
    return;
  }
  const removeConditionButton = event.target.closest("[data-remove-condition]");
  if (removeConditionButton) {
    syncPickupForm();
    pickupEditorState.data.conditions.splice(Number(removeConditionButton.dataset.removeCondition), 1);
    renderPickupForm();
    setPickupStatus("수동 조건을 삭제했습니다.");
    return;
  }
  const addNameButton = event.target.closest("[data-add-schedule-name]");
  if (addNameButton) {
    syncPickupForm();
    const block = currentBlocks()[Number(addNameButton.dataset.addScheduleName)];
    if (block) {
      block.names = normalizeNames(block.names || []);
      block.names.push("");
      renderPickupForm();
      setPickupStatus("마도학자 이름 칸을 추가했습니다.");
    }
    return;
  }
  const addButton = event.target.closest("[data-add-block]");
  if (addButton) {
    syncPickupForm();
    currentBlocks().push(normalizeBlock({ type: addButton.dataset.addBlock }));
    renderPickupForm();
    setPickupStatus(`${addButton.textContent.trim()} 슬롯을 추가했습니다.`);
    return;
  }
  const removeButton = event.target.closest("[data-remove-block]");
  if (removeButton) {
    syncPickupForm();
    currentBlocks().splice(Number(removeButton.dataset.removeBlock), 1);
    renderPickupForm();
    setPickupStatus("슬롯을 삭제했습니다.");
    return;
  }
  const moveButton = event.target.closest("[data-move-block]");
  if (moveButton) {
    syncPickupForm();
    moveBlock(Number(moveButton.dataset.moveBlock), Number(moveButton.dataset.direction));
    return;
  }
  const visibleButton = event.target.closest("[data-toggle-visible]");
  if (visibleButton) {
    syncPickupForm();
    const block = currentBlocks()[Number(visibleButton.dataset.toggleVisible)];
    if (block) {
      block.visible = block.visible === false;
      renderPickupForm();
      setPickupStatus(block.visible ? "슬롯을 보이게 했습니다." : "슬롯을 숨겼습니다.");
    }
  }
});

document.getElementById("pickupEditorForm").addEventListener("input", (event) => {
  const conditionInput = event.target.closest("[data-condition-field]");
  if (conditionInput) {
    const condition = pickupEditorState.data.conditions[Number(conditionInput.dataset.conditionIndex)];
    if (condition) condition[conditionInput.dataset.conditionField] = conditionInput.value;
    return;
  }
  const nameInput = event.target.closest("[data-name-index]");
  if (nameInput) {
    const block = currentBlocks()[Number(nameInput.dataset.blockIndex)];
    if (block) {
      block.names = normalizeNames(block.names || []);
      block.names[Number(nameInput.dataset.nameIndex)] = nameInput.value;
    }
    return;
  }
  const input = event.target.closest("[data-field]");
  if (!input) return;
  const block = currentBlocks()[Number(input.dataset.blockIndex)];
  if (block) block[input.dataset.field] = input.value;
});

document.getElementById("pickupEditorForm").addEventListener("dragstart", (event) => {
  const block = event.target.closest(".pickup-editor-block");
  if (!block) return;
  syncPickupForm();
  pickupEditorState.draggedBlockIndex = Number(block.dataset.blockIndex);
  event.dataTransfer.setData("text/plain", String(pickupEditorState.draggedBlockIndex));
  block.classList.add("is-dragging");
});

document.getElementById("pickupEditorForm").addEventListener("dragend", () => {
  pickupEditorState.draggedBlockIndex = null;
  document.querySelectorAll(".pickup-editor-block").forEach((block) => block.classList.remove("is-dragging", "is-drop-before", "is-drop-after"));
});

document.getElementById("pickupEditorForm").addEventListener("dragover", (event) => {
  const block = event.target.closest(".pickup-editor-block");
  if (!block || pickupEditorState.draggedBlockIndex === null) return;
  event.preventDefault();
  document.querySelectorAll(".pickup-editor-block").forEach((item) => item.classList.remove("is-drop-before", "is-drop-after"));
  block.classList.add(dropAfter(block, event.clientY) ? "is-drop-after" : "is-drop-before");
});

document.getElementById("pickupEditorForm").addEventListener("drop", (event) => {
  const target = event.target.closest(".pickup-editor-block");
  if (!target || pickupEditorState.draggedBlockIndex === null) return;
  event.preventDefault();
  const blocks = currentBlocks();
  const from = pickupEditorState.draggedBlockIndex;
  let to = Number(target.dataset.blockIndex);
  if (from === to) return;
  const [block] = blocks.splice(from, 1);
  if (from < to) to -= 1;
  if (dropAfter(target, event.clientY)) to += 1;
  blocks.splice(to, 0, block);
  pickupEditorState.draggedBlockIndex = null;
  renderPickupForm();
  setPickupStatus("슬롯 순서를 변경했습니다.");
});

function syncPickupForm() {
  document.querySelectorAll("#pickupEditorForm [data-condition-field]").forEach((input) => {
    const condition = pickupEditorState.data.conditions[Number(input.dataset.conditionIndex)];
    if (condition) condition[input.dataset.conditionField] = input.value;
  });
  document.querySelectorAll("#pickupEditorForm [data-field]").forEach((input) => {
    const block = currentBlocks()[Number(input.dataset.blockIndex)];
    if (block) block[input.dataset.field] = input.value;
  });
  document.querySelectorAll("#pickupEditorForm [data-name-index]").forEach((input) => {
    const block = currentBlocks()[Number(input.dataset.blockIndex)];
    if (!block) return;
    block.names = normalizeNames(block.names || []);
    block.names[Number(input.dataset.nameIndex)] = input.value;
  });
}

function dropAfter(item, clientY) {
  const rect = item.getBoundingClientRect();
  return clientY > rect.top + rect.height / 2;
}

function moveBlock(index, direction) {
  const blocks = currentBlocks();
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= blocks.length) {
    setPickupStatus("더 이동할 수 없습니다.");
    return;
  }
  const [block] = blocks.splice(index, 1);
  blocks.splice(nextIndex, 0, block);
  renderPickupForm();
  setPickupStatus(direction < 0 ? "슬롯을 위로 이동했습니다." : "슬롯을 아래로 이동했습니다.");
}

document.getElementById("openPickupData").addEventListener("click", async () => {
  if (!window.showOpenFilePicker) {
    setPickupStatus("이 브라우저는 직접 불러오기를 지원하지 않습니다.");
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      multiple: false
    });
    const file = await handle.getFile();
    if (!isAllowedPickupFileName(file.name)) throw new Error("픽업 에디터에서는 pickup-data.json 또는 pickup-data.backup-YYYYMMDD-HHMMSS.json만 불러올 수 있습니다.");
    pickupEditorState.data = preparePickupData(JSON.parse(await file.text()));
    pickupEditorState.fileHandle = file.name === PICKUP_FILE_NAME ? handle : null;
    pickupEditorState.selectedPanel = "banner";
    renderPickupEditor();
    setPickupStatus(`${file.name}을 불러왔습니다.`);
  } catch (error) {
    if (error.name !== "AbortError") setPickupStatus(error.message || "파일을 불러오지 못했습니다.");
  }
});

document.getElementById("savePickupData").addEventListener("click", async () => {
  syncPickupForm();
  if (!window.showSaveFilePicker) {
    setPickupStatus("이 브라우저는 직접 저장을 지원하지 않습니다. 다운로드를 사용하세요.");
    return;
  }
  try {
    if (!pickupEditorState.fileHandle) {
      pickupEditorState.fileHandle = await window.showSaveFilePicker({
        suggestedName: PICKUP_FILE_NAME,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
      });
    }
    await assertPickupSaveTarget(pickupEditorState.fileHandle);
    const writable = await pickupEditorState.fileHandle.createWritable();
    await writable.write(JSON.stringify(pickupEditorState.data, null, 2));
    await writable.close();
    setPickupStatus("pickup-data.json에 저장했습니다.");
  } catch (error) {
    if (error.name !== "AbortError") setPickupStatus(error.message || "저장에 실패했습니다.");
  }
});

document.getElementById("downloadPickupData").addEventListener("click", () => {
  syncPickupForm();
  const blob = new Blob([JSON.stringify(pickupEditorState.data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = PICKUP_FILE_NAME;
  link.click();
  URL.revokeObjectURL(link.href);
  setPickupStatus("pickup-data.json을 다운로드했습니다.");
});

document.getElementById("copyPickupData").addEventListener("click", async () => {
  syncPickupForm();
  await navigator.clipboard.writeText(JSON.stringify(pickupEditorState.data, null, 2));
  setPickupStatus("JSON을 복사했습니다.");
});

function preparePickupData(data) {
  if (!data || typeof data !== "object") throw new Error("픽업 데이터 형식이 아닙니다.");
  if (data.schema && data.schema !== PICKUP_SCHEMA) throw new Error("픽업 데이터가 아닙니다.");
  return normalizePickupData({ ...data, schema: PICKUP_SCHEMA });
}

function isAllowedPickupFileName(name) {
  return name === PICKUP_FILE_NAME || PICKUP_BACKUP_RE.test(name);
}

async function assertPickupSaveTarget(handle) {
  const file = await handle.getFile();
  if (file.name !== PICKUP_FILE_NAME) {
    pickupEditorState.fileHandle = null;
    throw new Error("저장 대상이 pickup-data.json이 아닙니다. 픽업 에디터에서는 pickup-data.json에만 저장할 수 있습니다.");
  }
  const text = await file.text();
  if (!text.trim()) return;
  preparePickupData(JSON.parse(text));
}

function setPickupStatus(message) {
  document.getElementById("pickupEditorStatus").textContent = message;
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
