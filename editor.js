const state = {
  data: null,
  fileHandle: null,
  profileDirHandle: null,
  activeGroupId: null,
  relationScopeGroupId: null,
  multiSelected: [],
  suppressNextBlankClick: false,
  showEndpointDots: true,
  selected: { type: 'person', id: null }
};

const graph = document.getElementById('editorGraph');
const forms = {
  person: document.getElementById('personForm'),
  group: document.getElementById('groupForm'),
  label: document.getElementById('labelForm'),
  relation: document.getElementById('relationForm')
};

fetch(`data.json?v=${Date.now()}`, { cache: 'no-store' })
  .then(res => res.json())
  .then(data => {
    state.data = data;
    normalizeData();
    state.selected.id = data.people[0]?.id || null;
    renderEditor();
  })
  .catch(() => setStatus('data.json을 읽지 못했습니다. data.json 불러오기로 파일을 선택하세요.'));

function normalizeData() {
  if (!state.data) return;
  state.data.labels ||= [];
  state.data.labels.forEach(label => {
    label.name ||= label.text || '라벨';
    label.description ??= label.body || '';
    label.w = Number(label.w) || 180;
    label.h = Number(label.h) || 80;
  });
  state.data.relations.forEach(relation => {
    relation.fromPosition ||= 'center';
    relation.toPosition ||= 'center';
    relation.lineType ||= 'straight';
    relation.labelVisible ??= true;
  });
  state.data.groups.forEach(group => {
    group.description ??= '';
    group.parentGroupId ||= '';
    if (group.parentGroupId === group.id || !state.data.groups.some(parent => parent.id === group.parentGroupId)) group.parentGroupId = '';
    group.color ||= '#d7e8ff';
    group.borderColor ||= '#061633';
    group.borderEnabled ??= true;
    group.cols = Math.max(1, Number(group.cols) || 3);
    group.rows = Math.max(1, Number(group.rows) || 1);
  });
  state.data.groups.forEach(group => normalizeOrder(group.id));
  window.RelationshipGraph.applyAutoLayout(state.data);
}

function normalizeOrder(groupId) {
  const members = state.data.people
    .filter(person => person.groupId === groupId)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || state.data.people.indexOf(a) - state.data.people.indexOf(b));
  members.forEach((person, index) => { person.order = index; });
}

function renderEditor() {
  normalizeData();
  window.RelationshipGraph.renderGraph(graph, state.data, { onElement: wireElement, showEndpointDots: state.showEndpointDots });
  if (state.multiSelected.length > 1) {
    state.multiSelected.forEach(key => {
      const { type, id } = parseSelectionKey(key);
      graph.querySelectorAll(`[data-type="${type}"][data-id="${id}"]`).forEach(el => {
        el.classList.add('is-selected');
      });
    });
  } else if (state.selected.type && state.selected.id) {
    graph.querySelectorAll(`[data-type="${state.selected.type}"][data-id="${state.selected.id}"]`).forEach(el => {
      el.classList.add('is-selected');
      if (canHostDeleteButton(el)) attachDeleteButton(el);
    });
  }
  updateAnchorToggle();
  renderForms();
}

function updateAnchorToggle() {
  const button = document.getElementById('toggleAnchors');
  if (!button) return;
  button.textContent = state.showEndpointDots ? '앵커 ON' : '앵커 OFF';
  button.classList.toggle('is-active', state.showEndpointDots);
  button.setAttribute('aria-pressed', String(state.showEndpointDots));
}

function attachDeleteButton(el) {
  if (el.querySelector?.('.target-delete')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'target-delete';
  button.title = '삭제';
  button.setAttribute('aria-label', '선택한 항목 삭제');
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"></path>
    </svg>
  `;
  button.addEventListener('click', event => {
    event.stopPropagation();
    deleteSelected();
  });
  el.append(button);
}

function canHostDeleteButton(el) {
  return el instanceof HTMLElement && !el.classList.contains('relation-line-hit');
}

function deleteSelected() {
  const item = selectedItem(state.selected.type);
  if (!item) return;
  const label = item.name || item.label || item.id;
  if (!window.confirm(`'${label}' 항목을 삭제할까요?`)) return;

  if (state.selected.type === 'person') {
    state.data.people = state.data.people.filter(person => person.id !== item.id);
    state.data.relations = state.data.relations.filter(relation => !((relation.fromType === 'person' && relation.from === item.id) || (relation.toType === 'person' && relation.to === item.id)));
    normalizeOrder(item.groupId);
    state.selected = { type: 'person', id: state.data.people[0]?.id || null };
  } else if (state.selected.type === 'group') {
    state.data.groups = state.data.groups.filter(group => group.id !== item.id);
    state.data.groups.forEach(group => {
      if (group.parentGroupId === item.id) group.parentGroupId = '';
    });
    state.data.people.forEach(person => {
      if (person.groupId === item.id) person.groupId = state.data.groups[0]?.id || '';
    });
    state.data.groups.forEach(group => normalizeOrder(group.id));
    state.data.relations = state.data.relations.filter(relation => !((relation.fromType === 'group' && relation.from === item.id) || (relation.toType === 'group' && relation.to === item.id)));
    state.selected = { type: 'group', id: state.data.groups[0]?.id || null };
  } else if (state.selected.type === 'label') {
    state.data.labels = state.data.labels.filter(label => label.id !== item.id);
    state.data.relations = state.data.relations.filter(relation => !((relation.fromType === 'label' && relation.from === item.id) || (relation.toType === 'label' && relation.to === item.id)));
    state.selected = { type: 'label', id: state.data.labels[0]?.id || null };
  } else if (state.selected.type === 'relation') {
    state.data.relations = state.data.relations.filter(relation => relation.id !== item.id);
    state.selected = { type: 'relation', id: state.data.relations[0]?.id || null };
  }

  setStatus('선택한 항목을 삭제했습니다. 저장 버튼으로 반영하세요.');
  renderEditor();
}

function wireElement(el, item, type) {
  el.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.target-delete')) return;
    if (event.ctrlKey || event.metaKey) return;
    if (state.multiSelected.length > 1 && state.multiSelected.includes(selectionKey(type, item.id))) {
      event.stopImmediatePropagation();
      startMultiDrag(event);
    }
  });
  el.addEventListener('click', event => {
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) {
      toggleMultiSelection(type, item.id);
      renderEditor();
      return;
    }
    state.multiSelected = [];
    state.selected = { type, id: item.id };
    state.activeGroupId = type === 'group' ? item.id : type === 'person' ? item.groupId || null : null;
    state.relationScopeGroupId = type === 'group' ? item.id : null;
    activateTab(type);
    renderEditor();
  });
  if (type === 'group') makeGroupDraggable(el, item, type);
  if (type === 'person') makePersonSortable(el, item, type);
  if (type === 'label') makeLabelDraggable(el, item, type);
  if (type === 'relation' && el.classList.contains('relation-label')) makeRelationLabelDraggable(el, item, type);
}

function makeGroupDraggable(el, group, type) {
  el.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.target-delete')) return;
    if (event.ctrlKey || event.metaKey) return;
    state.multiSelected = [];
    state.selected = { type, id: group.id };
    state.activeGroupId = group.id;
    state.relationScopeGroupId = group.id;
    activateTab(type);
    
    el.classList.add('is-dragging');
    const start = { x: event.clientX, y: event.clientY, itemX: group.x, itemY: group.y };
    
    const move = moveEvent => {
      let dx = moveEvent.clientX - start.x;
      let dy = moveEvent.clientY - start.y;
      if (moveEvent.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }
      const nextX = Math.max(8, Math.round(start.itemX + dx));
      const nextY = Math.max(8, Math.round(start.itemY + dy));
      group.x = nextX;
      group.y = nextY;
      
      el.style.left = `${nextX}px`;
      el.style.top = `${nextY}px`;
    };
    
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      el.classList.remove('is-dragging');
      
      if (group.parentGroupId) {
        const parent = state.data.groups.find(g => g.id === group.parentGroupId);
        if (parent) {
          const siblings = state.data.groups.filter(g => g.parentGroupId === group.parentGroupId);
          const members = state.data.people.filter(p => p.groupId === parent.id);
          
          const sortItems = [];
          siblings.forEach(sibling => {
            sortItems.push({ type: 'group', id: sibling.id, y: sibling.y });
          });
          if (members.length > 0) {
            const minPersonY = Math.min(...members.map(p => p.y));
            sortItems.push({ type: 'people', id: 'people', y: minPersonY });
          }
          
          sortItems.sort((a, b) => a.y - b.y);
          sortItems.forEach((item, index) => {
            if (item.type === 'group') {
              const sibling = siblings.find(s => s.id === item.id);
              if (sibling) sibling.order = index;
            } else if (item.type === 'people') {
              parent.peopleOrder = index;
            }
          });
        }
      }
      
      window.RelationshipGraph.applyAutoLayout(state.data);
      renderEditor();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}

function makePersonSortable(el, person, type) {
  el.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.target-delete')) return;
    if (event.ctrlKey || event.metaKey) return;
    state.multiSelected = [];
    state.selected = { type, id: person.id };
    state.activeGroupId = person.groupId || null;
    state.relationScopeGroupId = null;
    activateTab(type);
    
    const start = { x: event.clientX, y: event.clientY, itemX: person.x, itemY: person.y };
    let didDrag = false;
    
    const move = moveEvent => {
      if (!didDrag && Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) > 3) {
        didDrag = true;
        el.classList.add('is-dragging');
      }
      if (didDrag) {
        let dx = moveEvent.clientX - start.x;
        let dy = moveEvent.clientY - start.y;
        if (moveEvent.shiftKey) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            dy = 0;
          } else {
            dx = 0;
          }
        }
        el.style.left = `${Math.max(8, start.x + dx + graph.scrollLeft - graph.getBoundingClientRect().left - 46)}px`;
        el.style.top = `${Math.max(8, start.y + dy + graph.scrollTop - graph.getBoundingClientRect().top - 59)}px`;
      }
    };
    
    const up = upEvent => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (didDrag) {
        el.classList.remove('is-dragging');
        let dx = upEvent.clientX - start.x;
        let dy = upEvent.clientY - start.y;
        if (upEvent.shiftKey) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            dy = 0;
          } else {
            dx = 0;
          }
        }
        placePersonFromPoint(person, start.x + dx, start.y + dy);
      }
      renderEditor();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}

function makeLabelDraggable(el, label, type) {
  el.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.target-delete')) return;
    if (event.ctrlKey || event.metaKey) return;
    state.multiSelected = [];
    state.selected = { type, id: label.id };
    state.relationScopeGroupId = null;
    activateTab(type);
    const start = { x: event.clientX, y: event.clientY, itemX: label.x, itemY: label.y };
    el.classList.add('is-dragging');
    const move = moveEvent => {
      let dx = moveEvent.clientX - start.x;
      let dy = moveEvent.clientY - start.y;
      if (moveEvent.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }
      label.x = Math.max(8, Math.round(start.itemX + dx));
      label.y = Math.max(8, Math.round(start.itemY + dy));
      el.style.left = `${label.x}px`;
      el.style.top = `${label.y}px`;
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      el.classList.remove('is-dragging');
      renderEditor();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}

function makeRelationLabelDraggable(el, relation, type) {
  el.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.target-delete')) return;
    if (event.ctrlKey || event.metaKey) return;
    event.stopPropagation();
    state.multiSelected = [];
    state.selected = { type, id: relation.id };
    activateTab(type);
    const start = {
      x: event.clientX,
      y: event.clientY,
      offsetX: Number(relation.labelOffsetX) || 0,
      offsetY: Number(relation.labelOffsetY) || 0
    };
    el.classList.add('is-dragging');
    const move = moveEvent => {
      let dx = moveEvent.clientX - start.x;
      let dy = moveEvent.clientY - start.y;
      if (moveEvent.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }
      relation.labelOffsetX = Math.round(start.offsetX + dx);
      relation.labelOffsetY = Math.round(start.offsetY + dy);
      el.style.setProperty('--drag-x', `${relation.labelOffsetX - start.offsetX}px`);
      el.style.setProperty('--drag-y', `${relation.labelOffsetY - start.offsetY}px`);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      el.classList.remove('is-dragging');
      renderEditor();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}

function graphPointFromClient(clientX, clientY) {
  const rect = graph.getBoundingClientRect();
  return {
    x: clientX + graph.scrollLeft - rect.left,
    y: clientY + graph.scrollTop - rect.top
  };
}

function groupAtPoint(x, y) {
  const sortedGroups = state.data.groups.slice().sort((a, b) => {
    const aHasParent = a.parentGroupId ? 1 : 0;
    const bHasParent = b.parentGroupId ? 1 : 0;
    return bHasParent - aHasParent;
  });
  return sortedGroups.find(group =>
    x >= group.x &&
    x <= group.x + group.w &&
    y >= group.y &&
    y <= group.y + group.h
  );
}

function placePersonFromPoint(person, clientX, clientY) {
  const point = graphPointFromClient(clientX, clientY);
  placePersonAtPoint(person, point);
}

function placePersonAtPoint(person, point) {
  const previousGroupId = person.groupId || '';
  const targetGroup = groupAtPoint(point.x, point.y);
  if (!targetGroup) {
    if (previousGroupId) normalizeOrder(previousGroupId);
    person.groupId = '';
    person.order = 0;
    person.x = Math.max(8, Math.round(point.x - 46));
    person.y = Math.max(8, Math.round(point.y - 59));
    state.activeGroupId = null;
    state.relationScopeGroupId = null;
    return;
  }

  movePersonIntoGroup(person, targetGroup, point.x, point.y);
  if (previousGroupId && previousGroupId !== targetGroup.id) normalizeOrder(previousGroupId);
  state.activeGroupId = targetGroup.id;
}

function movePersonIntoGroup(person, group, x, y) {
  person.groupId = group.id;
  const groupMembers = state.data.people.filter(p => p.groupId === group.id && p.id !== person.id);
  
  let peopleStartY = group.y + 50;
  if (groupMembers.length > 0) {
    peopleStartY = Math.min(...groupMembers.map(p => p.y));
  }
  
  const rawCol = Math.floor((x - group.x - 24) / 112);
  const rawRow = Math.floor((y - peopleStartY) / 138);
  const col = Math.max(0, Math.min(group.cols - 1, rawCol));
  const row = Math.max(0, rawRow);
  const members = window.RelationshipGraph.orderedPeople(state.data, group.id).filter(item => item.id !== person.id);
  const maxIndex = members.length;
  const newIndex = Math.max(0, Math.min(maxIndex, row * group.cols + col));
  members.splice(newIndex, 0, person);
  members.forEach((item, index) => { item.order = index; });
}

function activeGroupForNewPerson() {
  if (state.selected.type === 'group' && selectedItem('group')) return state.selected.id;
  if (state.selected.type === 'person') {
    const person = selectedItem('person');
    if (person?.groupId) return person.groupId;
  }
  return state.data.groups.some(group => group.id === state.activeGroupId) ? state.activeGroupId : '';
}

function selectionKey(type, id) {
  return `${type}:${id}`;
}

function parseSelectionKey(key) {
  const index = key.indexOf(':');
  return { type: key.slice(0, index), id: key.slice(index + 1) };
}

function toggleMultiSelection(type, id) {
  const key = selectionKey(type, id);
  const existing = state.multiSelected.includes(key);
  const singleKey = state.selected.type && state.selected.id ? selectionKey(state.selected.type, state.selected.id) : null;
  state.multiSelected = state.multiSelected.length ? state.multiSelected.slice() : singleKey ? [singleKey] : [];
  state.multiSelected = existing ? state.multiSelected.filter(item => item !== key) : [...state.multiSelected, key];
  state.multiSelected = Array.from(new Set(state.multiSelected));
  if (state.multiSelected.length === 1) {
    const only = parseSelectionKey(state.multiSelected[0]);
    state.selected = { type: only.type, id: only.id };
  } else {
    state.selected = { type: null, id: null };
  }
  state.activeGroupId = null;
  state.relationScopeGroupId = null;
}

function itemByKey(key) {
  const { type, id } = parseSelectionKey(key);
  const keyMap = { person: 'people', group: 'groups', label: 'labels', relation: 'relations' };
  return { type, item: state.data[keyMap[type]]?.find(entry => entry.id === id) };
}

function canvasRectFromElement(el) {
  const graphRect = graph.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - graphRect.left + graph.scrollLeft,
    y: rect.top - graphRect.top + graph.scrollTop,
    w: rect.width,
    h: rect.height
  };
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function selectableElements() {
  return Array.from(graph.querySelectorAll('.group-box, .person-card, .map-label, .relation-label'));
}

function startSelectionBox(event) {
  if (event.button !== 0 || event.target !== graph) return;
  const start = graphPointFromClient(event.clientX, event.clientY);
  const box = document.createElement('div');
  box.className = 'selection-box';
  graph.append(box);
  let didDrag = false;

  const move = moveEvent => {
    const point = graphPointFromClient(moveEvent.clientX, moveEvent.clientY);
    const rect = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y)
    };
    didDrag = didDrag || rect.w > 4 || rect.h > 4;
    Object.assign(box.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.w}px`,
      height: `${rect.h}px`
    });
  };

  const up = upEvent => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    const end = graphPointFromClient(upEvent.clientX, upEvent.clientY);
    const selectRect = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      w: Math.abs(end.x - start.x),
      h: Math.abs(end.y - start.y)
    };
    box.remove();
    if (!didDrag) return;

    const keys = selectableElements()
      .filter(el => rectsIntersect(selectRect, canvasRectFromElement(el)))
      .map(el => selectionKey(el.dataset.type, el.dataset.id));
    state.multiSelected = Array.from(new Set(keys));
    if (state.multiSelected.length === 1) {
      const only = parseSelectionKey(state.multiSelected[0]);
      state.selected = { type: only.type, id: only.id };
      state.multiSelected = [];
    } else {
      state.selected = { type: null, id: null };
    }
    state.activeGroupId = null;
    state.relationScopeGroupId = null;
    state.suppressNextBlankClick = true;
    renderEditor();
  };

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function startMultiDrag(event) {
  event.preventDefault();
  const start = { x: event.clientX, y: event.clientY };
  const keys = state.multiSelected.slice();
  const selectedGroups = new Set(keys.map(parseSelectionKey).filter(item => item.type === 'group').map(item => item.id));
  const entries = keys.map(key => {
    const { type, item } = itemByKey(key);
    if (!item) return null;
    const el = graph.querySelector(`[data-type="${type}"][data-id="${CSS.escape(item.id)}"]`);
    const rect = el ? canvasRectFromElement(el) : null;
    return { key, type, item, el, rect, start: snapshotMoveStart(type, item) };
  }).filter(Boolean).filter(entry => entry.item && entry.el);
  const followerEls = Array.from(selectedGroups).flatMap(groupId =>
    Array.from(graph.querySelectorAll(`.person-card[data-id]`)).filter(el => {
      const person = state.data.people.find(item => item.id === el.dataset.id);
      return person?.groupId === groupId && !keys.includes(selectionKey('person', person.id));
    })
  );
  [...entries.map(entry => entry.el), ...followerEls].forEach(el => el.classList.add('is-dragging'));

  const move = moveEvent => {
    let dx = moveEvent.clientX - start.x;
    let dy = moveEvent.clientY - start.y;
    if (moveEvent.shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        dy = 0;
      } else {
        dx = 0;
      }
    }
    [...entries.map(entry => entry.el), ...followerEls].forEach(el => {
      if (el.classList.contains('relation-label')) {
        el.style.setProperty('--drag-x', `${dx}px`);
        el.style.setProperty('--drag-y', `${dy}px`);
      } else {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    });
  };

  const up = upEvent => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    let dx = upEvent.clientX - start.x;
    let dy = upEvent.clientY - start.y;
    if (upEvent.shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        dy = 0;
      } else {
        dx = 0;
      }
    }
    entries.forEach(entry => applyMultiMove(entry, dx, dy, selectedGroups));
    state.data.groups.forEach(group => normalizeOrder(group.id));
    renderEditor();
  };

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function snapshotMoveStart(type, item) {
  if (type === 'relation') {
    return { x: Number(item.labelOffsetX) || 0, y: Number(item.labelOffsetY) || 0 };
  }
  return { x: Number(item.x) || 0, y: Number(item.y) || 0 };
}

function applyMultiMove(entry, dx, dy, selectedGroups) {
  if (entry.type === 'group') {
    entry.item.x = Math.max(8, Math.round(entry.start.x + dx));
    entry.item.y = Math.max(8, Math.round(entry.start.y + dy));
    return;
  }
  if (entry.type === 'label') {
    entry.item.x = Math.max(8, Math.round(entry.start.x + dx));
    entry.item.y = Math.max(8, Math.round(entry.start.y + dy));
    return;
  }
  if (entry.type === 'relation') {
    entry.item.labelOffsetX = Math.round(entry.start.x + dx);
    entry.item.labelOffsetY = Math.round(entry.start.y + dy);
    return;
  }
  if (entry.type === 'person') {
    if (entry.item.groupId && selectedGroups.has(entry.item.groupId)) return;
    const center = {
      x: entry.rect.x + entry.rect.w / 2 + dx,
      y: entry.rect.y + entry.rect.h / 2 + dy
    };
    placePersonAtPoint(entry.item, center);
  }
}

function selectedMoveEntries() {
  const keys = state.multiSelected.length > 1
    ? state.multiSelected
    : state.selected.type && state.selected.id ? [selectionKey(state.selected.type, state.selected.id)] : [];
  const selectedGroups = new Set(keys.map(parseSelectionKey).filter(item => item.type === 'group').map(item => item.id));
  return keys.map(key => {
    const { type, item } = itemByKey(key);
    if (!item) return null;
    if (type === 'person' && item.groupId && selectedGroups.has(item.groupId)) return null;
    const el = graph.querySelector(`[data-type="${type}"][data-id="${CSS.escape(item.id)}"]`);
    if (!el) return null;
    const rect = canvasRectFromElement(el);
    return { key, type, item, el, rect, start: snapshotMoveStart(type, item) };
  }).filter(Boolean);
}

function alignSelected(mode) {
  const entries = selectedMoveEntries();
  if (entries.length < 2) {
    setStatus('정렬하려면 요소를 2개 이상 선택하세요.');
    return;
  }
  const minX = Math.min(...entries.map(entry => entry.rect.x));
  const maxX = Math.max(...entries.map(entry => entry.rect.x + entry.rect.w));
  const minY = Math.min(...entries.map(entry => entry.rect.y));
  const maxY = Math.max(...entries.map(entry => entry.rect.y + entry.rect.h));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const selectedGroups = new Set(state.multiSelected.map(parseSelectionKey).filter(item => item.type === 'group').map(item => item.id));

  if (mode === 'distribute-x') {
    distributeEntries(entries, 'x', selectedGroups);
  } else if (mode === 'distribute-y') {
    distributeEntries(entries, 'y', selectedGroups);
  } else {
    entries.forEach(entry => {
      let dx = 0;
      let dy = 0;
      if (mode === 'left') dx = minX - entry.rect.x;
      if (mode === 'center-x') dx = centerX - (entry.rect.x + entry.rect.w / 2);
      if (mode === 'right') dx = maxX - (entry.rect.x + entry.rect.w);
      if (mode === 'top') dy = minY - entry.rect.y;
      if (mode === 'center-y') dy = centerY - (entry.rect.y + entry.rect.h / 2);
      if (mode === 'bottom') dy = maxY - (entry.rect.y + entry.rect.h);
      applyMultiMove(entry, dx, dy, selectedGroups);
    });
  }

  state.data.groups.forEach(group => normalizeOrder(group.id));
  setStatus('선택한 요소를 정렬했습니다. 저장 버튼으로 반영하세요.');
  renderEditor();
}

function distributeEntries(entries, axis, selectedGroups) {
  const prop = axis === 'x' ? 'x' : 'y';
  const size = axis === 'x' ? 'w' : 'h';
  const sorted = entries.slice().sort((a, b) => (a.rect[prop] + a.rect[size] / 2) - (b.rect[prop] + b.rect[size] / 2));
  if (sorted.length < 3) return;
  const firstCenter = sorted[0].rect[prop] + sorted[0].rect[size] / 2;
  const lastCenter = sorted.at(-1).rect[prop] + sorted.at(-1).rect[size] / 2;
  const gap = (lastCenter - firstCenter) / (sorted.length - 1);
  sorted.forEach((entry, index) => {
    const target = firstCenter + gap * index;
    const current = entry.rect[prop] + entry.rect[size] / 2;
    applyMultiMove(entry, axis === 'x' ? target - current : 0, axis === 'y' ? target - current : 0, selectedGroups);
  });
}

function renderForms() {
  renderPersonForm();
  renderGroupForm();
  renderLabelForm();
  renderRelationForm();
}

function renderPersonForm() {
  const person = selectedItem('person');
  forms.person.innerHTML = person ? `
    ${input('id', 'ID', person.id, true)}
    ${input('name', '이름', person.name)}
    ${select('groupId', '그룹', person.groupId, [['', '그룹 없음'], ...state.data.groups.map(group => [group.id, group.name])])}
    ${imageField(person.image || '')}
    ${input('traits', '특징', person.traits || '')}
    ${textarea('description', '설명', person.description || '')}
    ${input('order', '그룹 내 순서', person.order ?? 0, false, 'number')}
  ` : '<p>인물을 추가하세요.</p>';
  bindForm(forms.person, person);
  bindImagePicker(forms.person, person);
}

function renderGroupForm() {
  const group = selectedItem('group');
  forms.group.innerHTML = group ? `
    ${input('id', 'ID', group.id, true)}
    ${input('name', '그룹명', group.name)}
    ${select('parentGroupId', '상위 그룹', group.parentGroupId || '', parentGroupOptions(group))}
    ${group.parentGroupId ? '' : textarea('description', '그룹 설명', group.description || '')}
    <div class="color-row">
      ${colorInput('color', '배경색 HEX', group.color || '#d7e8ff')}
      ${colorInput('borderColor', '외곽선색 HEX', group.borderColor || '#061633')}
    </div>
    ${checkbox('borderEnabled', '외곽선 사용', group.borderEnabled !== false)}
    <div class="field-row">
      ${input('cols', '열', group.cols || 3, false, 'number')}
      ${input('rows', '최소 행', group.rows || 1, false, 'number')}
    </div>
    <div class="field-row">
      ${input('x', '그룹 X', group.x, false, 'number')}
      ${input('y', '그룹 Y', group.y, false, 'number')}
    </div>
  ` : '<p>그룹을 추가하세요.</p>';
  bindForm(forms.group, group);
}

function renderLabelForm() {
  const label = selectedItem('label');
  forms.label.innerHTML = label ? `
    ${input('id', 'ID', label.id, true)}
    ${input('name', '라벨명', label.name || label.text || '')}
    ${textarea('description', '라벨문구', label.description || label.body || '')}
    <div class="field-row">
      ${input('x', '라벨 X', label.x, false, 'number')}
      ${input('y', '라벨 Y', label.y, false, 'number')}
    </div>
    <div class="field-row">
      ${input('w', '너비', label.w || 140, false, 'number')}
      ${input('h', '최소 높이', label.h || 44, false, 'number')}
    </div>
  ` : '<p>라벨을 추가하세요.</p>';
  bindForm(forms.label, label);
}

function renderRelationForm() {
  const scopedGroupId = state.selected.type === 'group' ? state.selected.id : state.relationScopeGroupId;
  const options = relationOptions(scopedGroupId);
  const fallbackRelation = options.length ? state.data.relations.find(relation => relation.id === options[0][0]) : null;
  const selectedRelation = selectedItem('relation');
  const relation = selectedRelation && (!scopedGroupId || relationTouchesGroup(selectedRelation, scopedGroupId)) ? selectedRelation : fallbackRelation;
  const endpoints = endpointOptions();
  forms.relation.innerHTML = relation ? `
    ${select('relationPicker', scopedGroupId ? '선택 그룹의 관계' : '관계 선택', relation.id, options)}
    ${input('id', 'ID', relation.id, true)}
    <div class="field-row">
      ${select('fromKey', '출발', endpointKey(relation.fromType, relation.from), endpoints)}
      ${select('fromPosition', '출발 위치', relation.fromPosition || 'center', anchorOptions())}
    </div>
    <div class="field-row">
      ${select('toKey', '도착', endpointKey(relation.toType, relation.to), endpoints)}
      ${select('toPosition', '도착 위치', relation.toPosition || 'center', anchorOptions())}
    </div>
    <div class="field-row">
      ${select('direction', '방향', relation.direction, [['forward', '단방향'], ['both', '양방향'], ['none', '선만 표시']])}
      ${select('lineType', '선 종류', relation.lineType || 'straight', [['straight', '직선'], ['orthogonal', '꺾은선']])}
    </div>
    <div class="field-row">
      ${input('boxW', '박스 너비', relation.boxW || 180, false, 'number')}
      ${input('boxH', '박스 최소 높이', relation.boxH || 0, false, 'number')}
    </div>
    ${input('label', '관계 라벨', relation.label || '')}
    ${checkbox('labelVisible', '관계 라벨 표기', relation.labelVisible !== false)}
    ${textarea('description', '관계 설명 박스', relation.description || '')}
  ` : '<p>선택한 그룹과 연결된 관계가 없습니다.</p>';
  bindForm(forms.relation, relation);
}

function parentGroupOptions(group) {
  const descendants = descendantGroupIds(group.id);
  return [
    ['', '상위 그룹 없음'],
    ...state.data.groups
      .filter(item => item.id !== group.id && !descendants.has(item.id))
      .map(item => [item.id, item.name])
  ];
}

function descendantGroupIds(groupId) {
  const ids = new Set();
  const visit = id => {
    state.data.groups
      .filter(group => group.parentGroupId === id)
      .forEach(group => {
        if (ids.has(group.id)) return;
        ids.add(group.id);
        visit(group.id);
      });
  };
  visit(groupId);
  return ids;
}

function bindForm(form, item) {
  if (!item) return;
  form.querySelectorAll('input[name], textarea, select').forEach(field => {
    const originalGroup = item.groupId;
    const update = () => {
      if (field.name === 'fromKey' || field.name === 'toKey') {
        if (!field.value) {
          item[field.name === 'fromKey' ? 'fromType' : 'toType'] = '';
          item[field.name === 'fromKey' ? 'from' : 'to'] = '';
          return;
        }
        const [type, id] = field.value.split(':');
        item[field.name === 'fromKey' ? 'fromType' : 'toType'] = type;
        item[field.name === 'fromKey' ? 'from' : 'to'] = id;
      } else if (field.name === 'relationPicker') {
        state.selected = { type: 'relation', id: field.value };
        activateTab('relation');
        renderEditor();
        return;
      } else if (field.name === 'fromPosition' || field.name === 'toPosition' || field.name === 'lineType') {
        item[field.name] = field.value;
      } else if (field.name === 'parentGroupId') {
        item.parentGroupId = field.value;
      } else if (field.type === 'checkbox') {
        item[field.name] = field.checked;
      } else if (field.name === 'color' || field.name === 'borderColor') {
        item[field.name] = normalizeHexInput(field.value);
      } else if (['x', 'y', 'w', 'h', 'cols', 'rows', 'order', 'boxW', 'boxH'].includes(field.name)) {
        item[field.name] = Number(field.value) || 0;
      } else {
        item[field.name] = field.value;
      }
      if (field.name === 'groupId' && originalGroup !== item.groupId) {
        normalizeOrder(originalGroup);
        item.order = state.data.people.filter(person => person.groupId === item.groupId && person.id !== item.id).length;
        normalizeOrder(item.groupId);
      }
    };
    field.addEventListener('input', update);
    field.addEventListener('change', () => { update(); renderEditor(); });
  });
  form.querySelectorAll('[data-color-picker]').forEach(picker => {
    picker.addEventListener('input', () => {
      const target = picker.dataset.colorPicker;
      const field = form.querySelector(`input[name="${target}"]`);
      if (!field) return;
      field.value = picker.value;
      item[target] = picker.value;
      renderEditor();
    });
  });
}

function input(name, label, value, disabled = false, type = 'text') {
  return `<label>${label}<input name="${name}" type="${type}" value="${escapeAttr(value)}" ${disabled ? 'disabled' : ''}></label>`;
}
function imageField(value) {
  return `<label>프로필 이미지<span class="attach-field"><input name="image" type="text" value="${escapeAttr(value)}" placeholder="profile/name.png"><input type="file" data-image-file-input accept="image/*" style="display:none"><button data-image-picker type="button">파일 첨부</button></span></label>`;
}
function colorInput(name, label, value) {
  const color = normalizeHex(value);
  return `<label class="color-field">${label}<span class="color-control"><span class="color-swatch" style="background:${escapeAttr(color)}"><input class="color-picker" data-color-picker="${name}" type="color" value="${escapeAttr(color)}" aria-label="${escapeAttr(label)} 팔레트"></span><input name="${name}" type="text" value="${escapeAttr(value)}" placeholder="061633"></span></label>`;
}
function textarea(name, label, value) {
  return `<label>${label}<textarea name="${name}">${escapeHtml(value)}</textarea></label>`;
}
function checkbox(name, label, checked) {
  return `<label class="check-field"><input name="${name}" type="checkbox" ${checked ? 'checked' : ''}>${label}</label>`;
}
function select(name, label, value, options) {
  return `<label>${label}<select name="${name}">${options.map(([id, text]) => `<option value="${escapeAttr(id)}" ${id === value ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;
}
function endpointOptions() {
  return [['', '선택 안 함'], ...endpointItems().map(endpoint => [`${endpoint.type}:${endpoint.id}`, endpoint.label])];
}
function endpointItems() {
  return [
    ...state.data.groups.map(group => ({ type: 'group', id: group.id, label: `그룹: ${group.name}` })),
    ...state.data.people.map(person => ({ type: 'person', id: person.id, label: `인물: ${person.name}` })),
    ...state.data.labels.map(label => ({ type: 'label', id: label.id, label: `라벨: ${label.name || label.text || label.id}` }))
  ];
}
function anchorOptions() {
  return [
    ['center', '중앙'],
    ['top', '상'],
    ['bottom', '하'],
    ['left', '좌'],
    ['right', '우']
  ];
}
function relationOptions(groupId = null) {
  return state.data.relations.filter(relation => !groupId || relationTouchesGroup(relation, groupId)).map(relation => {
    const from = endpointLabel(relation.fromType, relation.from);
    const to = endpointLabel(relation.toType, relation.to);
    return [relation.id, `${relation.label || relation.id}: ${from} -> ${to}`];
  });
}
function relationTouchesGroup(relation, groupId) {
  return (relation.fromType === 'group' && relation.from === groupId) || (relation.toType === 'group' && relation.to === groupId);
}
function endpointLabel(type, id) {
  if (type === 'group') return state.data.groups.find(group => group.id === id)?.name || id;
  if (type === 'label') return state.data.labels.find(label => label.id === id)?.name || id;
  return state.data.people.find(person => person.id === id)?.name || id;
}
function endpointKey(type, id) {
  return type && id ? `${type}:${id}` : '';
}
function selectedItem(type) {
  if (!type || !state.selected.id) return null;
  const key = type === 'person' ? 'people' : `${type}s`;
  return state.selected.type === type ? state.data[key].find(item => item.id === state.selected.id) : null;
}
function activateTab(type) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === type));
  document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('is-hidden', panel.dataset.panel !== type));
}

function bindImagePicker(form, person) {
  const button = form.querySelector('[data-image-picker]');
  const fileInput = form.querySelector('[data-image-file-input]');
  if (!button || !fileInput || !person) return;
  button.addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const imagePath = `profile/${file.name}`;
    person.image = imagePath;
    const textInput = form.querySelector('input[name="image"]');
    if (textInput) textInput.value = imagePath;
    setStatus(`이미지 파일 경로를 '${imagePath}'로 설정했습니다. 저장 버튼으로 저장해 주세요.`);
    renderEditor();
  });
}

graph.addEventListener('pointerdown', startSelectionBox);
graph.addEventListener('click', event => {
  if (event.target !== graph) return;
  if (state.suppressNextBlankClick) {
    state.suppressNextBlankClick = false;
    return;
  }
  state.selected = { type: null, id: null };
  state.multiSelected = [];
  state.activeGroupId = null;
  state.relationScopeGroupId = null;
  renderEditor();
});

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => activateTab(tab.dataset.tab)));
document.querySelectorAll('[data-align]').forEach(button => {
  button.addEventListener('click', () => alignSelected(button.dataset.align));
});
document.getElementById('toggleAnchors').addEventListener('click', () => {
  state.showEndpointDots = !state.showEndpointDots;
  renderEditor();
});
document.getElementById('addPerson').addEventListener('click', () => {
  const id = `p-${Date.now()}`;
  const groupId = activeGroupForNewPerson();
  const order = groupId ? state.data.people.filter(person => person.groupId === groupId).length : 0;
  state.data.people.push({ id, name: '새 인물', groupId, order, x: 120, y: 120, image: '', traits: '', description: '' });
  state.multiSelected = [];
  state.selected = { type: 'person', id };
  state.activeGroupId = groupId || null;
  activateTab('person');
  renderEditor();
});
document.getElementById('addGroup').addEventListener('click', () => {
  const id = `g-${Date.now()}`;
  state.data.groups.push({ id, name: '새 그룹', description: '', parentGroupId: '', x: 80, y: 80, cols: 3, rows: 1, color: '#d7e8ff', borderEnabled: true, borderColor: '#061633' });
  state.multiSelected = [];
  state.selected = { type: 'group', id };
  state.activeGroupId = id;
  activateTab('group');
  renderEditor();
  setStatus('새 최상위 독립 그룹을 추가했습니다.');
});
document.getElementById('addChildGroup').addEventListener('click', () => {
  if (state.selected.type !== 'group' || !state.selected.id) {
    setStatus('내부 그룹을 추가하려면 먼저 상위 그룹 요소를 선택해 주세요.');
    return;
  }
  const parentGroup = selectedItem('group');
  if (!parentGroup) return;

  const id = `g-${Date.now()}`;
  const cols = parentGroup.cols || 3;
  state.data.groups.push({
    id,
    name: '새 내부 그룹',
    description: '',
    parentGroupId: parentGroup.id,
    x: parentGroup.x,
    y: parentGroup.y,
    cols,
    rows: 1,
    color: '#F4F4F4',
    borderEnabled: false,
    borderColor: '#061633'
  });
  state.multiSelected = [];
  state.selected = { type: 'group', id };
  state.activeGroupId = id;
  activateTab('group');
  renderEditor();
  setStatus(`'${parentGroup.name}' 그룹 내부에 새 내부 그룹을 추가했습니다.`);
});
document.getElementById('addLabel').addEventListener('click', () => {
  const id = `l-${Date.now()}`;
  state.data.labels.push({ id, name: '새 라벨', description: '', x: 120, y: 120, w: 180, h: 80 });
  state.multiSelected = [];
  state.selected = { type: 'label', id };
  state.activeGroupId = null;
  state.relationScopeGroupId = null;
  activateTab('label');
  renderEditor();
});
document.getElementById('addRelation').addEventListener('click', () => {
  const id = `r-${Date.now()}`;
  const endpoints = endpointItems();
  const selectedEndpoint = ['person', 'group', 'label'].includes(state.selected.type) && selectedItem(state.selected.type)
    ? { type: state.selected.type, id: state.selected.id }
    : endpoints[0];
  state.data.relations.push({
    id,
    fromType: selectedEndpoint?.type || 'person',
    from: selectedEndpoint?.id || '',
    fromPosition: 'center',
    toType: '',
    to: '',
    toPosition: 'center',
    direction: 'forward',
    lineType: 'straight',
    boxW: 180,
    boxH: 0,
    label: '새 관계',
    labelVisible: true,
    description: ''
  });
  state.multiSelected = [];
  state.selected = { type: 'relation', id };
  state.relationScopeGroupId = selectedEndpoint?.type === 'group' ? selectedEndpoint.id : null;
  activateTab('relation');
  renderEditor();
});
document.getElementById('openJson').addEventListener('click', async () => {
  if (!window.showOpenFilePicker) {
    setStatus('이 브라우저는 직접 저장을 지원하지 않습니다. data.json 다운로드를 사용하세요.');
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      multiple: false
    });
    const file = await handle.getFile();
    state.data = JSON.parse(await file.text());
    state.fileHandle = handle;
    normalizeData();
    state.selected = { type: 'person', id: state.data.people[0]?.id || null };
    activateTab('person');
    renderEditor();
    setStatus(`${file.name} 파일을 불러왔습니다. 이제 저장 버튼으로 덮어쓸 수 있습니다.`);
  } catch (error) {
    if (error.name !== 'AbortError') setStatus('data.json 파일을 불러오지 못했습니다.');
  }
});

document.getElementById('saveJson').addEventListener('click', async () => {
  if (!window.showSaveFilePicker || !window.showOpenFilePicker) {
    setStatus('이 브라우저는 직접 저장을 지원하지 않습니다. data.json 다운로드를 사용하세요.');
    return;
  }
  try {
    normalizeData();
    if (!state.fileHandle) {
      state.fileHandle = await window.showSaveFilePicker({
        suggestedName: 'data.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
    }
    const writable = await state.fileHandle.createWritable();
    await writable.write(JSON.stringify(state.data, null, 2));
    await writable.close();
    setStatus('data.json에 저장했습니다. 관계도 페이지를 강력 새로고침하면 반영됩니다.');
  } catch (error) {
    if (error.name !== 'AbortError') setStatus('data.json 저장에 실패했습니다.');
  }
});

document.getElementById('downloadJson').addEventListener('click', () => {
  normalizeData();
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'data.json';
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus('data.json 파일을 다운로드했습니다.');
});
document.getElementById('copyJson').addEventListener('click', async () => {
  normalizeData();
  await navigator.clipboard.writeText(JSON.stringify(state.data, null, 2));
  setStatus('JSON을 클립보드에 복사했습니다.');
});
function setStatus(text) { document.getElementById('statusText').textContent = text; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
function escapeAttr(value) { return escapeHtml(value).replace(/'/g, '&#39;'); }
function normalizeHex(value) {
  const text = String(value || '').trim();
  const withHash = text.startsWith('#') ? text : `#${text}`;
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(withHash) ? withHash : '#ffffff';
}
function normalizeHexInput(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const withHash = text.startsWith('#') ? text : `#${text}`;
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(withHash) ? withHash : text;
}


