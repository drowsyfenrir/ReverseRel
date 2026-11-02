const accountDataInput = document.getElementById("accountDataInput");
const accountCalculateButton = document.getElementById("accountCalculateButton");
const accountResult = document.getElementById("accountResult");

const ACCOUNT_GROUP_COUNT = 4;
const ACCOUNT_NAME_LIMIT = 8;
const ACCOUNT_PULLS_PER_VERSION = 110;
const ACCOUNT_DEFAULT_OWNED_NAMES = ["마틸다"];
const ACCOUNT_PICKUP_COSTS = new Map([
  ["길가의 초상화", 0],
  ["배포", 0],
  ["고음 카운터", 0],
  ["상자 추천 메세지", 0],
  ["상자 추천 메시지", 0],
  ["전반기", 140],
  ["전반부", 140],
  ["후반기", 140],
  ["호수의 물결", 70],
  ["호수의 선물", 70],
  ["호수의 추억", 140],
  ["복각", 140]
]);
const ACCOUNT_ALIAS_GROUPS = [
  ["투스 페어리", "투페"],
  ["갈기 모래", "갈기모래"],
  ["안조 날라", "안조", "안조날라"],
  ["플러터 페이지", "플러터페이지", "플페"],
  ["에지오", "에지오 아디토레"],
  ["로렌츠 버터플라이", "로렌츠"],
  ["미스 스트레인저", "미스스", "그레이스"],
  ["A나이트", "어나햄", "A나", "에이나이트", "나이트"],
  ["갈라보나", "갈보"],
  ["키페리나", "키페"],
  ["제멜바이스", "제멜"],
  ["코르부스", "코부부"],
  ["센티널", "마리안"]
];

const accountState = {
  pickupData: { conditions: [], panels: { schedule: { blocks: [] } } },
  versionData: { currentPageId: "", pages: [] },
  aliasMap: new Map(),
  maxNameWords: 1,
  ready: false
};

Promise.all([
  fetch(`pickup-data.json?v=${Date.now()}`, { cache: "no-store" }).then((response) => response.json()),
  fetch(`version-data.json?v=${Date.now()}`, { cache: "no-store" }).then((response) => response.json())
]).then(([pickupData, versionData]) => {
  accountState.pickupData = normalizePickupData(pickupData);
  accountState.versionData = normalizeVersionData(versionData);
  buildAccountNameResolver();
  accountState.ready = true;
}).catch((error) => {
  console.error(error);
  setAccountMessage("분석 데이터를 불러오지 못했습니다.");
});

accountCalculateButton?.addEventListener("click", () => {
  if (!accountState.ready) {
    setAccountMessage("분석 데이터를 불러오는 중입니다.");
    return;
  }
  const ownedNames = parseOwnedNames(accountDataInput?.value || "");
  if (!ownedNames.size) {
    setAccountMessage("마도학자 이름을 입력해주세요.");
    return;
  }
  renderAccountDecks(ownedNames);
});

function normalizePickupData(data) {
  const panels = data?.panels || {};
  return {
    conditions: Array.isArray(data?.conditions) ? data.conditions.map((condition) => ({
      version: cleanText(condition?.version),
      label: cleanText(condition?.label),
      names: cleanText(condition?.names)
    })) : [],
    panels: {
      schedule: {
        blocks: Array.isArray(panels.schedule?.blocks) ? panels.schedule.blocks : []
      }
    }
  };
}

function normalizeVersionData(data) {
  return {
    currentPageId: data?.currentPageId || "",
    pages: Array.isArray(data?.pages) ? data.pages : []
  };
}

function buildAccountNameResolver() {
  const aliasMap = new Map();
  const addAlias = (alias, canonical) => {
    const key = nameKey(alias);
    const compact = compactNameKey(alias);
    if (key) aliasMap.set(key, canonical);
    if (compact) aliasMap.set(compact, canonical);
    accountState.maxNameWords = Math.max(accountState.maxNameWords, key.split(" ").length);
  };

  ACCOUNT_ALIAS_GROUPS.forEach(([canonical, ...aliases]) => {
    [canonical, ...aliases].forEach((alias) => addAlias(alias, canonical));
  });

  allKnownDataNames().forEach((name) => {
    const explicitCanonical = aliasMap.get(nameKey(name)) || aliasMap.get(compactNameKey(name));
    const canonical = explicitCanonical || name;
    addAlias(name, canonical);
    addAlias(canonical, canonical);
  });
  accountState.aliasMap = aliasMap;
}

function allKnownDataNames() {
  const names = new Set();
  scheduleDecks().forEach(({ block }) => {
    normalizeDeckGroups(block).forEach((group) => group.names.forEach((name) => names.add(name)));
  });
  accountState.pickupData.conditions.forEach((condition) => {
    condition.names.split(",").map(cleanText).filter(Boolean).forEach((name) => names.add(name));
  });
  accountState.versionData.pages.forEach((page) => {
    [page.pickups?.first, page.pickups?.middle, page.pickups?.last].forEach((pickup) => {
      const name = profileName(pickup?.name);
      if (name) names.add(name);
      (Array.isArray(pickup?.profiles) ? pickup.profiles : []).forEach((profile) => {
        const profileValue = profileName(profile);
        if (profileValue) names.add(profileValue);
      });
    });
    [page.events?.highCounter, page.events?.ripples].forEach((event) => {
      (Array.isArray(event?.profiles) ? event.profiles : []).forEach((profile) => {
        const profileValue = profileName(profile);
        if (profileValue) names.add(profileValue);
      });
    });
  });
  return names;
}

function parseOwnedNames(value) {
  const owned = new Set(ACCOUNT_DEFAULT_OWNED_NAMES.map((name) => canonicalName(name)));
  String(value || "")
    .split(/[+,，;|/\n\r]+/)
    .map(cleanText)
    .filter(Boolean)
    .forEach((chunk) => parseOwnedChunk(chunk).forEach((name) => owned.add(name)));
  return owned;
}

function parseOwnedChunk(chunk) {
  const exact = resolveAccountName(chunk);
  if (exact) return [exact];
  const words = cleanText(chunk).split(/\s+/).filter(Boolean);
  const result = [];
  for (let index = 0; index < words.length;) {
    let matched = "";
    let consumed = 0;
    const maxWords = Math.min(accountState.maxNameWords, words.length - index);
    for (let count = maxWords; count >= 1; count -= 1) {
      const candidate = words.slice(index, index + count).join(" ");
      const resolved = resolveAccountName(candidate);
      if (resolved) {
        matched = resolved;
        consumed = count;
        break;
      }
    }
    if (matched) result.push(matched);
    index += consumed || 1;
  }
  return result;
}

function resolveAccountName(value) {
  const text = cleanText(value);
  if (!text) return "";
  const direct = accountState.aliasMap.get(nameKey(text)) || accountState.aliasMap.get(compactNameKey(text));
  if (direct) return direct;
  const parenthesizedFormation = text.replace(/\s*\(\s*\d+\s*(?:돌|형상?)\s*\)\s*$/i, "");
  if (parenthesizedFormation !== text) {
    return accountState.aliasMap.get(nameKey(parenthesizedFormation))
      || accountState.aliasMap.get(compactNameKey(parenthesizedFormation))
      || "";
  }
  const formationMatch = /^(.*?)(\d+)$/.exec(text);
  if (!formationMatch) return "";
  const base = cleanText(formationMatch[1]);
  return accountState.aliasMap.get(nameKey(base)) || accountState.aliasMap.get(compactNameKey(base)) || "";
}

function renderAccountDecks(ownedNames) {
  const matchedDecks = scheduleDecks()
    .map((deck) => evaluateDeck(deck, ownedNames))
    .filter(Boolean)
    .sort((a, b) => a.deckNumber - b.deckNumber);

  const rankedDecks = [...matchedDecks].sort(compareDeckPriority);
  const accountWindow = currentAccountVersionWindow();
  const optimizedCombination = findOptimizedCombination(rankedDecks, accountWindow.availablePulls, true);
  const maximumDeckCombination = findOptimizedCombination(matchedDecks, Number.POSITIVE_INFINITY, false);

  accountResult.classList.toggle("has-results", matchedDecks.length > 0);
  accountResult.classList.toggle("is-ready", matchedDecks.length > 0);
  if (!matchedDecks.length) {
    accountResult.textContent = "조건을 충족하는 덱이 없습니다.";
    return;
  }
  accountResult.innerHTML = `
    <p class="account-result-summary">조건 충족 덱 ${matchedDecks.length}개</p>
    <div class="pickup-schedule-content account-deck-results">
      ${matchedDecks.map((deck) => renderAccountDeck(deck, ownedNames)).join("")}
    </div>
    ${renderAccountOptimization(rankedDecks, optimizedCombination, maximumDeckCombination, accountWindow)}
  `;
}

function scheduleDecks() {
  return accountState.pickupData.panels.schedule.blocks
    .map((block, index) => ({ block, deckNumber: index + 1 }))
    .filter(({ block }) => block?.type === "deck" && block.visible !== false);
}

function evaluateDeck(deck, ownedNames) {
  const groups = normalizeDeckGroups(deck.block);
  const populatedGroupCount = groups.filter((group) => group.names.length).length;
  const requiredGroupCount = populatedGroupCount >= 4 ? 4 : populatedGroupCount === 3 ? 3 : Number.POSITIVE_INFINITY;
  if (!groups.some((group) => group.names.some((name) => ownedNames.has(canonicalName(name))))) return null;
  if (!Number.isFinite(requiredGroupCount)) return null;

  const plans = buildDeckPlans(groups, ownedNames);
  if (!plans.length) return null;
  plans.sort(compareDeckPlans);
  return {
    ...deck,
    groups,
    satisfiedGroups: requiredGroupCount,
    ownedCharacterCount: countOwnedDeckCharacters(groups, ownedNames),
    plans,
    minPlan: plans[0]
  };
}

function buildDeckPlans(groups, ownedNames) {
  const populatedGroups = groups.filter((group) => group.names.length);
  const selectionGroups = populatedGroups.map((group) => ({
    group,
    selections: buildGroupSelections(group, ownedNames)
  }));
  if (selectionGroups.some((entry) => !entry.selections.length)) return [];

  const plans = new Map();
  const choices = [];
  const usedConditionKeys = new Set();
  const usedCharacterNames = new Set();
  const visit = (position) => {
    if (position >= selectionGroups.length) {
      const planChoices = choices.map((choice) => ({ ...choice }));
      const signature = planChoices
        .map((choice) => `${choice.groupIndex}:${choice.owned ? `owned:${canonicalName(choice.name)}` : choice.key}`)
        .join("|");
      if (!plans.has(signature)) {
        plans.set(signature, {
          choices: planChoices,
          cost: planChoices.reduce((sum, choice) => sum + choice.cost, 0),
          conditionKeys: new Set(planChoices.map((choice) => choice.key).filter(Boolean))
        });
      }
      return;
    }

    selectionGroups[position].selections.forEach((selection) => {
      if ([...selection.conditionKeys].some((key) => usedConditionKeys.has(key))) return;
      const characterNames = selection.options.map((option) => canonicalName(option.name));
      if (characterNames.some((name) => usedCharacterNames.has(name))) return;
      const previousChoiceCount = choices.length;
      choices.push(...selection.options);
      selection.conditionKeys.forEach((key) => usedConditionKeys.add(key));
      characterNames.forEach((name) => usedCharacterNames.add(name));
      visit(position + 1);
      selection.conditionKeys.forEach((key) => usedConditionKeys.delete(key));
      characterNames.forEach((name) => usedCharacterNames.delete(name));
      choices.splice(previousChoiceCount);
    });
  };
  visit(0);
  return [...plans.values()];
}

function buildGroupSelections(group, ownedNames) {
  const requiredCount = groupRequiredCount(group);
  const optionsByCharacter = new Map();
  buildGroupOptions(group, ownedNames).forEach((option) => {
    const canonical = canonicalName(option.name);
    if (!optionsByCharacter.has(canonical)) optionsByCharacter.set(canonical, []);
    optionsByCharacter.get(canonical).push(option);
  });
  const characters = [...optionsByCharacter.entries()];
  if (characters.length < requiredCount) return [];

  const selections = new Map();
  const selectedOptions = [];
  const usedKeys = new Set();
  const visit = (position) => {
    if (selectedOptions.length === requiredCount) {
      const options = selectedOptions.map((option) => ({ ...option }));
      const signature = options.map(optionSortKey).sort().join("|");
      if (!selections.has(signature)) {
        selections.set(signature, {
          options,
          conditionKeys: new Set(options.map((option) => option.key).filter(Boolean)),
          cost: options.reduce((sum, option) => sum + option.cost, 0)
        });
      }
      return;
    }
    if (position >= characters.length || selectedOptions.length + (characters.length - position) < requiredCount) return;

    const [, options] = characters[position];
    options.forEach((option) => {
      if (option.key && usedKeys.has(option.key)) return;
      selectedOptions.push(option);
      if (option.key) usedKeys.add(option.key);
      visit(position + 1);
      if (option.key) usedKeys.delete(option.key);
      selectedOptions.pop();
    });
    visit(position + 1);
  };
  visit(0);
  return [...selections.values()].sort((a, b) => a.cost - b.cost);
}

function buildGroupOptions(group, ownedNames) {
  const options = [];
  const seen = new Set();
  group.names.forEach((name) => {
    const canonical = canonicalName(name);
    if (ownedNames.has(canonical)) {
      const ownedKey = `owned:${canonical}`;
      if (!seen.has(ownedKey)) {
        seen.add(ownedKey);
        options.push({ groupIndex: group.index, name, owned: true, schedule: null, key: "", cost: 0 });
      }
      return;
    }
    findFutureSchedules(name).forEach((schedule) => {
      const cost = pickupCost(schedule.category);
      const key = acquisitionKey(schedule, name);
      const optionKey = `${canonical}\u0000${key}`;
      if (!Number.isFinite(cost) || seen.has(optionKey)) return;
      seen.add(optionKey);
      options.push({ groupIndex: group.index, name, owned: false, schedule, key, cost });
    });
  });
  return options.sort((a, b) => a.cost - b.cost || optionSortKey(a).localeCompare(optionSortKey(b), "ko"));
}

function groupRequiredCount(group) {
  const match = /[中중]\s*(\d+)\s*명\s*선택/i.exec(cleanText(group.description));
  return Math.max(1, Number(match?.[1]) || 1);
}

function countOwnedDeckCharacters(groups, ownedNames) {
  const names = new Set();
  groups.forEach((group) => group.names.forEach((name) => {
    const canonical = canonicalName(name);
    if (ownedNames.has(canonical)) names.add(canonical);
  }));
  return names.size;
}

function compareDeckPlans(a, b) {
  return a.cost - b.cost || planSortKey(a).localeCompare(planSortKey(b), "ko");
}

function compareDeckPriority(a, b) {
  return a.minPlan.cost - b.minPlan.cost
    || b.ownedCharacterCount - a.ownedCharacterCount
    || a.deckNumber - b.deckNumber;
}

function optionSortKey(option) {
  return option.owned
    ? `0:${option.groupIndex}:${canonicalName(option.name)}`
    : `1:${option.groupIndex}:${option.key}:${canonicalName(option.name)}`;
}

function planSortKey(plan) {
  return plan.choices.map(optionSortKey).join("|");
}

function pickupCost(category) {
  return ACCOUNT_PICKUP_COSTS.get(cleanText(category)) ?? Number.POSITIVE_INFINITY;
}

function normalizeDeckGroups(block) {
  const legacyNames = Array.isArray(block?.names) ? block.names : [];
  const source = Array.isArray(block?.groups) && block.groups.length
    ? block.groups.slice(0, ACCOUNT_GROUP_COUNT)
    : [{ description: "", names: legacyNames }];
  const groups = source.map((group, index) => ({
    index,
    description: cleanText(group?.description),
    names: (Array.isArray(group?.names) ? group.names : [])
      .map((entry) => cleanText(entry && typeof entry === "object" ? entry.name : entry))
      .filter(Boolean)
  }));
  while (groups.length < ACCOUNT_GROUP_COUNT) groups.push({ index: groups.length, description: "", names: [] });
  let remaining = ACCOUNT_NAME_LIMIT;
  return groups.map((group) => {
    const names = group.names.slice(0, remaining);
    remaining -= names.length;
    return { ...group, names };
  });
}

function currentAccountVersionWindow() {
  const pages = accountState.versionData.pages;
  const foundCurrentIndex = pages.findIndex((page) => page.id === accountState.versionData.currentPageId);
  const currentIndex = foundCurrentIndex >= 0 ? foundCurrentIndex : 0;
  const futurePages = pages.slice(currentIndex);
  const currentPage = pages[currentIndex] || {};
  const latestPage = pages.at(-1) || currentPage;
  return {
    currentVersion: cleanText(currentPage.version || currentPage.pageName) || "-",
    latestVersion: cleanText(latestPage.version || latestPage.pageName) || "-",
    versionCount: futurePages.length,
    availablePulls: futurePages.length * ACCOUNT_PULLS_PER_VERSION
  };
}

function findOptimizedCombination(rankedDecks, availablePulls, preferPriority) {
  const candidates = rankedDecks.map((deck) => ({
    deck,
    plans: uniqueCombinationPlans(deck.plans).filter((plan) => plan.cost <= availablePulls)
  }));
  let best = { selections: [], totalPulls: 0, inclusion: rankedDecks.map(() => false) };
  const usedKeys = new Set();
  const selections = [];

  const visit = (index, totalPulls) => {
    if (selections.length + (candidates.length - index) < best.selections.length) return;
    if (index >= candidates.length) {
      const inclusion = rankedDecks.map((deck) => selections.some((selection) => selection.deck === deck));
      const candidate = { selections: [...selections], totalPulls, inclusion };
      if (isBetterCombination(candidate, best, preferPriority)) best = candidate;
      return;
    }

    const { deck, plans } = candidates[index];
    plans.forEach((plan) => {
      if (totalPulls + plan.cost > availablePulls || hasConditionConflict(plan.conditionKeys, usedKeys)) return;
      plan.conditionKeys.forEach((key) => usedKeys.add(key));
      selections.push({ deck, plan });
      visit(index + 1, totalPulls + plan.cost);
      selections.pop();
      plan.conditionKeys.forEach((key) => usedKeys.delete(key));
    });
    visit(index + 1, totalPulls);
  };

  visit(0, 0);
  return best;
}

function uniqueCombinationPlans(plans) {
  const unique = new Map();
  [...plans].sort(compareDeckPlans).forEach((plan) => {
    const key = [...plan.conditionKeys].sort().join("|");
    if (!unique.has(key)) unique.set(key, plan);
  });
  return [...unique.values()];
}

function hasConditionConflict(conditionKeys, usedKeys) {
  return [...conditionKeys].some((key) => usedKeys.has(key));
}

function isBetterCombination(candidate, current, preferPriority) {
  if (candidate.selections.length !== current.selections.length) {
    return candidate.selections.length > current.selections.length;
  }
  if (candidate.totalPulls !== current.totalPulls) return candidate.totalPulls < current.totalPulls;
  if (preferPriority) {
    for (let index = 0; index < candidate.inclusion.length; index += 1) {
      if (candidate.inclusion[index] !== current.inclusion[index]) return candidate.inclusion[index];
    }
  }
  return false;
}

function renderAccountOptimization(rankedDecks, optimizedCombination, maximumDeckCombination, accountWindow) {
  const combinationNames = optimizedCombination.selections.map(({ deck }) => cleanText(deck.block.name));
  const maximumCombinationNames = maximumDeckCombination.selections.map(({ deck }) => cleanText(deck.block.name));
  const optimizedDeckCount = optimizedCombination.selections.length;
  const maximumDeckCount = maximumDeckCombination.selections.length;
  const accountRating = optimizedDeckCount >= 3 ? "훌륭한" : "아쉬운";
  const assessmentAdvice = optimizedDeckCount >= 3
    ? "<p>리버스 1999의 컨텐츠를 플레이 하기에 부족함이 없습니다.</p><p>지금 당장 시작하세요!</p>"
    : maximumDeckCount >= 3
      ? "<p>하지만 최소 수치가 아니라면 3개 이상 덱을 만들 수 있으므로 취향을 바탕으로 신중히 지갑과 상담하여 덱을 짜보도록 합시다.</p>"
      : "";
  return `
    <section class="account-optimization" aria-label="계정 분석 추천 결과">
      <div class="account-version-summary">
        <p>현재 버전은 <strong>[${escapeHtml(accountWindow.currentVersion)}]</strong>입니다. 확인된 최신 버전은 <strong>[${escapeHtml(accountWindow.latestVersion)}]</strong>입니다.</p>
        <p>소과금 기준 획득 가능한 픽업 횟수는 약 <strong class="account-pull-count"><img class="account-pull-icon" src="img/icon/토끼.png" alt="" aria-hidden="true">[${accountWindow.availablePulls}]회</strong>입니다.</p>
        <p class="account-pull-disclaimer">아래 픽업 횟수는 모두 픽뚫을 상정한 최대 횟수입니다.</p>
        <p class="account-analysis-warning">해당 조합 추천은 다양한 변수가 아닌 일괄적인 값을 바탕으로 추천 하기에<br>참고 자료로 사용하고 픽업은 본인이 판단 하시길 바랍니다.</p>
      </div>
      <h3>픽업 횟수 적은 순으로 추천한 덱 순서입니다.</h3>
      <ol class="account-ranking-list">
        ${rankedDecks.map((deck, index) => `<li><span>${index + 1}위 ${escapeHtml(cleanText(deck.block.name))}</span><strong class="account-pull-count"><img class="account-pull-icon" src="img/icon/토끼.png" alt="" aria-hidden="true">${deck.minPlan.cost}회</strong></li>`).join("")}
      </ol>
      <h3>겹치는 조건을 제외하여 가장 픽업 횟수를 적게 소모하는 조합입니다.</h3>
      <p class="account-combination-copy"><strong>${combinationNames.length
        ? `현재 만들 수 있는 조합은 ${combinationNames.map((name) => `${escapeHtml(name)} 덱`).join(", ")}입니다.`
        : "현재 가용 횟수 안에서 만들 수 있는 조합이 없습니다."}</strong></p>
      <p class="account-combination-copy"><strong>덱 추천 조합과 조건은 아래와 같습니다.</strong></p>
      <div class="account-combination-list">
        ${optimizedCombination.selections.map(({ deck, plan }) => renderCombinationDeck(deck, plan)).join("")}
      </div>
      <h3>가장 덱을 많이 만들 수 있는 조합은 아래와 같습니다.</h3>
      <p class="account-combination-copy"><strong>${maximumCombinationNames.length
        ? `현재 만들 수 있는 조합은 ${maximumCombinationNames.map((name) => `${escapeHtml(name)} 덱`).join(", ")}입니다.`
        : "현재 만들 수 있는 조합이 없습니다."}</strong></p>
      <p class="account-combination-copy"><strong>덱 추천 조합과 조건은 아래와 같습니다.</strong></p>
      <div class="account-combination-list account-maximum-combination-list">
        ${maximumDeckCombination.selections.map(({ deck, plan }) => renderCombinationDeck(deck, plan)).join("")}
      </div>
      <div class="account-final-assessment">
        <p>현재 리버스 1999의 최종 컨텐츠는 상위 덱을 3개 요구합니다.</p>
        <p>당신은 현재 버전 이후 ${accountWindow.versionCount}버전 간 최소 ${optimizedDeckCount}개의 덱을 완성할 가능성이 높습니다.</p>
        <p>해당 계정은 ${accountRating} 계정입니다.</p>
        ${assessmentAdvice}
      </div>
    </section>
  `;
}

function renderCombinationDeck(deck, plan) {
  const choices = [...plan.choices].sort((a, b) => a.groupIndex - b.groupIndex);
  const hasLakeGift = choices.some((choice) => !choice.owned && cleanText(choice.schedule?.category) === "호수의 선물");
  const hasDoublePickup = choices.some((choice) => !choice.owned && cleanText(choice.schedule?.category) === "이중 픽업");
  return `
    <article class="account-combination-deck">
      <h4>${escapeHtml(cleanText(deck.block.name))} <span class="account-pull-count"><img class="account-pull-icon" src="img/icon/토끼.png" alt="" aria-hidden="true">${plan.cost}회</span></h4>
      <ul>
        ${choices.map((choice) => `<li>${formatCombinationChoice(choice)}</li>`).join("")}
      </ul>
      ${hasLakeGift ? '<p class="account-lake-gift-warning">[호수의 선물]은 선택한 캐릭터 3개 중 하나가 랜덤으로 뽑히니 주의.</p>' : ""}
      ${hasDoublePickup ? '<p class="account-lake-gift-warning">[이중 픽업]은 선택한 캐릭터 2개 중 하나가 랜덤으로 뽑히니 주의.</p>' : ""}
    </article>
  `;
}

function formatCombinationChoice(choice) {
  const condition = choice.owned
    ? "보유 중"
    : `[${escapeHtml(choice.schedule.category)}]${choice.schedule.version ? ` ${escapeHtml(choice.schedule.version)}` : ""}`;
  return `<span class="account-choice-group">그룹${choice.groupIndex + 1}</span> <span class="account-choice-detail">${escapeHtml(scheduleDisplayName(choice.name))} ${condition}</span>`;
}

function findFutureSchedules(name) {
  const target = canonicalName(name);
  if (!target) return [];
  const pages = accountState.versionData.pages;
  const foundCurrentIndex = pages.findIndex((page) => page.id === accountState.versionData.currentPageId);
  const currentIndex = foundCurrentIndex >= 0 ? foundCurrentIndex : 0;
  const futurePages = pages.slice(currentIndex);
  const fullVersionOrder = versionOrderMap(pages);
  const futureVersionOrder = versionOrderMap(futurePages);
  const schedules = [];
  let sequence = 0;

  futurePages.forEach((page, pageIndex) => {
    const version = cleanText(page.version || page.pageName);
    [
      ["전반기", page.pickups?.first],
      ["후반기", page.pickups?.last],
      ["배포", page.pickups?.middle]
    ].forEach(([category, pickup]) => {
      if (pickupContainsCanonicalName(pickup, target)) schedules.push(scheduleItem(category, version, pageIndex, sequence++));
    });
    [
      ["고음 카운터", page.events?.highCounter],
      ["호수의 물결", page.events?.ripples]
    ].forEach(([category, event]) => {
      if (profileListContainsCanonicalName(event?.profiles, target)) schedules.push(scheduleItem(category, version, pageIndex, sequence++));
    });
  });

  accountState.pickupData.conditions.forEach((condition, index) => {
    if (!conditionContainsCanonicalName(condition, target)) return;
    const version = cleanText(condition.version);
    if (!isCurrentOrFutureVersion(version, fullVersionOrder, currentIndex, pages)) return;
    schedules.push(scheduleItem(
      cleanText(condition.label),
      version,
      version ? versionSortOrder(version, futureVersionOrder) : Number.MAX_SAFE_INTEGER,
      sequence + index
    ));
  });

  const unique = new Map();
  schedules
    .filter((schedule) => schedule.category)
    .sort((a, b) => a.order - b.order || a.sequence - b.sequence)
    .forEach((schedule) => {
      const key = scheduleKey(schedule);
      if (!unique.has(key)) unique.set(key, { category: schedule.category, version: schedule.version });
    });
  return [...unique.values()];
}

function isCurrentOrFutureVersion(version, orderMap, currentIndex, pages) {
  if (!version) return true;
  if (orderMap.has(version)) return orderMap.get(version) >= currentIndex;
  const currentVersion = Number(pages[currentIndex]?.version || pages[currentIndex]?.pageName);
  const conditionVersion = Number(version);
  return !Number.isFinite(currentVersion) || !Number.isFinite(conditionVersion) || conditionVersion >= currentVersion;
}

function renderAccountDeck(deck, ownedNames) {
  const visibleGroups = deck.groups.filter((group) => group.names.length);
  const deckName = cleanText(deck.block.name) || `덱 ${deck.deckNumber}`;
  return `
    <section class="pickup-schedule-deck account-schedule-deck">
      <div class="pickup-schedule-deck-label">
        <strong>${escapeHtml(deckName)}</strong>
      </div>
      <div class="pickup-schedule-group-row">
        ${visibleGroups.map((group) => `
          <div class="pickup-schedule-group-label" style="--pickup-group-size:${group.names.length}">
            그룹${group.index + 1}${group.description ? ` ${escapeHtml(group.description)}` : ""}
          </div>
        `).join("")}
      </div>
      <div class="pickup-schedule-deck-body">
        ${visibleGroups.flatMap((group) => group.names).map((name) => renderAccountProfile(name, ownedNames)).join("")}
      </div>
    </section>
  `;
}

function renderAccountProfile(name, ownedNames) {
  const canonical = canonicalName(name);
  const isOwned = ownedNames.has(canonical);
  const schedules = isOwned ? [] : findFutureSchedules(name);
  const displayName = scheduleDisplayName(name);
  return `
    <article class="pickup-schedule-profile">
      <div class="pickup-schedule-image" style="background-image:url('profile/${encodeURIComponent(name)}.png')"></div>
      <h3>${escapeHtml(displayName)}</h3>
      <div class="pickup-schedule-list">
        ${isOwned
          ? "<p class=\"account-owned-label\">보유 중</p>"
          : schedules.length
            ? schedules.map((schedule) => `<p>[${escapeHtml(schedule.category)}]${schedule.version ? ` ${escapeHtml(schedule.version)}` : ""}</p>`).join("")
            : "<p>예정 없음</p>"}
      </div>
    </article>
  `;
}

function scheduleDisplayName(name) {
  const displayNames = {
    "로렌츠 버터플라이": "로렌츠",
    "미스 스트레인저": "미스스"
  };
  return displayNames[cleanText(name)] || name;
}

function pickupContainsCanonicalName(pickup, target) {
  if (!pickup || pickup.enabled === false) return false;
  return [pickup.name, ...(Array.isArray(pickup.profiles) ? pickup.profiles : [])]
    .some((profile) => canonicalName(profileName(profile)) === target);
}

function profileListContainsCanonicalName(profiles, target) {
  return Array.isArray(profiles) && profiles.some((profile) => canonicalName(profileName(profile)) === target);
}

function conditionContainsCanonicalName(condition, target) {
  return String(condition?.names || "")
    .split(",")
    .map(cleanText)
    .filter(Boolean)
    .some((name) => canonicalName(name) === target);
}

function canonicalName(value) {
  const text = cleanText(value);
  return accountState.aliasMap.get(nameKey(text)) || accountState.aliasMap.get(compactNameKey(text)) || text;
}

function profileName(profile) {
  return cleanText(typeof profile === "object" && profile ? profile.name : profile);
}

function scheduleItem(category, version, order, sequence) {
  return { category, version, order, sequence };
}

function scheduleKey(schedule) {
  return `${cleanText(schedule.category)}\u0000${cleanText(schedule.version)}`;
}

function acquisitionKey(schedule, name) {
  const key = scheduleKey(schedule);
  return cleanText(schedule.category) === "복각" ? `${key}\u0000${canonicalName(name)}` : key;
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

function setAccountMessage(message) {
  accountResult.classList.remove("has-results", "is-ready");
  accountResult.textContent = message;
}

function nameKey(value) {
  return cleanText(value).toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
}

function compactNameKey(value) {
  return nameKey(value).replace(/\s+/g, "");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}
