const SHEET_URLS = {
  ground: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSw25dQg94ZqXKwPWcUVnhj9ztKTLf8Sz5h0m2qnXY7z9oN0k_bneR38hiuGnTdRXUXwsLUplrQAO8V/pub?gid=0&single=true&output=csv",
  air: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSw25dQg94ZqXKwPWcUVnhj9ztKTLf8Sz5h0m2qnXY7z9oN0k_bneR38hiuGnTdRXUXwsLUplrQAO8V/pub?gid=164847306&single=true&output=csv",
  naval: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSw25dQg94ZqXKwPWcUVnhj9ztKTLf8Sz5h0m2qnXY7z9oN0k_bneR38hiuGnTdRXUXwsLUplrQAO8V/pub?gid=1471470287&single=true&output=csv"
};

const TIERS = ["S", "A", "B", "C", "D", "F", "Non"];
const STORAGE_KEY = "wt-tier-lab-state-v1";
const VEHICLE_API_BASE = "https://wtvehiclesapi.duckdns.org/api/vehicles";

let apiMetaPromise = null;

const tagLabels = {
  regular: "정규",
  premium: "프리미엄",
  squadron: "비행대",
  event: "이벤트"
};

const nationLabels = {
  usa: "미국",
  ussr: "소련",
  germany: "독일",
  britain: "영국",
  japan: "일본",
  china: "중국",
  italy: "이탈리아",
  france: "프랑스",
  sweden: "스웨덴",
  israel: "이스라엘"
};

const state = {
  category: "ground",
  allVehicles: { ground: [], air: [], naval: [] },
  placements: {},
  filters: {
    search: "",
    nation: "all",
    type: "all",
    tag: "all",
    ranks: [],
    brs: []
  }
};

const els = {
  tabs: document.querySelectorAll(".mode-tab"),
  tierBoard: document.querySelector("#tierBoard"),
  vehiclePool: document.querySelector("#vehiclePool"),
  cardTemplate: document.querySelector("#vehicleCardTemplate"),
  searchInput: document.querySelector("#searchInput"),
  nationFilter: document.querySelector("#nationFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  tagFilter: document.querySelector("#tagFilter"),
  rankFilter: document.querySelector("#rankFilter"),
  brFilter: document.querySelector("#brFilter"),
  countText: document.querySelector("#countText"),
  saveBtn: document.querySelector("#saveBtn"),
  loadBtn: document.querySelector("#loadBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput")
};

init();

async function init() {
  buildTierBoard();
  wireEvents();
  restoreState(false);
  await loadCategory("ground");
}

function wireEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", async () => {
      state.category = tab.dataset.category;
      els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
      resetFilters();
      await loadCategory(state.category);
    });
  });

  els.searchInput.addEventListener("input", () => {
    state.filters.search = els.searchInput.value.trim().toLowerCase();
    render();
  });

  els.nationFilter.addEventListener("change", () => {
    state.filters.nation = els.nationFilter.value;
    render();
  });

  els.typeFilter.addEventListener("change", () => {
    state.filters.type = els.typeFilter.value;
    render();
  });

  els.tagFilter.addEventListener("change", () => {
    state.filters.tag = els.tagFilter.value;
    render();
  });

  els.saveBtn.addEventListener("click", () => saveState(true));
  els.loadBtn.addEventListener("click", () => restoreState(true));
  els.resetBtn.addEventListener("click", resetTierBoard);
  els.exportBtn.addEventListener("click", exportJson);
  els.importInput.addEventListener("change", importJson);
}

function buildTierBoard() {
  els.tierBoard.innerHTML = "";
  TIERS.forEach((tier) => {
    const row = document.createElement("div");
    row.className = "tier-row";

    const label = document.createElement("div");
    label.className = "tier-label";
    label.dataset.tier = tier;
    label.textContent = tier;
    if (tier === "Non") {
      label.title = "우클릭으로 보내는 제외 영역";
    }

    const drop = document.createElement("div");
    drop.className = "tier-drop dropzone";
    drop.dataset.tier = tier;
    wireDropzone(drop);

    row.append(label, drop);
    els.tierBoard.append(row);
  });
  wireDropzone(els.vehiclePool);
}

async function loadCategory(category) {
  if (!state.allVehicles[category].length) {
    showPoolNotice("CSV 불러오는 중...");
    try {
      const response = await fetch(SHEET_URLS[category], { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csv = await response.text();
      state.allVehicles[category] = parseCsv(csv)
        .map(normalizeVehicle)
        .filter((vehicle) => !["FALSE", "0", "NO", "N"].includes(vehicle.enabled) && vehicle.name);

      await enrichMetaFromApi(category);

      const withImages = state.allVehicles[category].filter((vehicle) => vehicle.image);
      console.info(`[WT Tiermaker] ${category}: ${state.allVehicles[category].length}개 로드, 이미지 URL ${withImages.length}개`);
      console.info("[WT Tiermaker] 이미지 샘플:", withImages.slice(0, 5).map((vehicle) => ({ name: vehicle.name, image: vehicle.image })));
    } catch (error) {
      console.error(error);
      showPoolNotice("CSV를 불러오지 못했어. 구글시트 게시 링크나 인터넷 연결을 확인해줘.");
      return;
    }
  }

  populateFilters();
  render();
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim().toLowerCase()) || [];
  return rows
    .filter((items) => items.some((value) => value.trim() !== ""))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index]?.trim() || ""])));
}

function normalizeVehicle(item) {
  const category = (item.category || state.category || "").toLowerCase();
  const name = item.name || "";
  const id = item.id || makeId(category, item.nation, name);

  return {
    id,
    name,
    category,
    nation: cleanValue(item.nation),
    type: cleanValue(item.type),
    tag: cleanValue(item.tag || item.tags || "regular"),
    rank: normalizeRank(item.rank || item.vehicle_rank || item.tier || item.rk || ""),
    brRb: normalizeBr(item.br_rb || item.rb || item.realistic || item.realistic_br || item.battle_rating_rb || item.battle_rating_realistic || item.br || ""),
    image: pickImageValue(item),
    enabled: String(item.enabled || "TRUE").trim().toUpperCase()
  };
}

async function enrichMetaFromApi(category) {
  const vehicles = state.allVehicles[category] || [];
  if (!vehicles.length || vehicles.every((vehicle) => vehicle.rank && vehicle.brRb)) return;

  try {
    const apiMeta = await getApiMeta();
    let rankMatched = 0;
    let brMatched = 0;

    vehicles.forEach((vehicle) => {
      const api = findApiVehicle(apiMeta, vehicle);

      if (!vehicle.rank) {
        const rank = normalizeRank(extractApiRank(api));
        if (rank) {
          vehicle.rank = rank;
          rankMatched += 1;
        }
      }

      if (!vehicle.brRb) {
        const br = normalizeBr(extractApiBrRb(api));
        if (br) {
          vehicle.brRb = br;
          brMatched += 1;
        }
      }
    });

    console.info(`[WT Tiermaker] ${category}: API rank 자동 보강 ${rankMatched}/${vehicles.length}개, RB BR 자동 보강 ${brMatched}/${vehicles.length}개`);
  } catch (error) {
    console.warn("[WT Tiermaker] API 자동 보강 실패. 시트의 rank/br_rb 열만 사용함.", error);
  }
}

function getApiMeta() {
  if (!apiMetaPromise) apiMetaPromise = fetchApiMeta();
  return apiMetaPromise;
}

async function fetchApiMeta() {
  const byId = new Map();
  const byName = new Map();

  for (let page = 0; page < 80; page += 1) {
    const url = `${VEHICLE_API_BASE}?limit=200&page=${page}&excludeEventVehicles=false&excludeKillstreak=true`;
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`API HTTP ${response.status}`);

    const data = await response.json();
    const items = Array.isArray(data) ? data : (data.vehicles || data.items || data.results || []);
    if (!items.length) break;

    items.forEach((item) => {
      const ids = [item.identifier, item.id, item.intname, item.unit_id, item.unitName, item.unit_name]
        .filter(Boolean)
        .map((value) => String(value).trim());
      ids.forEach((id) => byId.set(id.toLowerCase(), item));

      const names = [item.name, item.identifier, item.wiki_name, item.wikiname, item.title]
        .filter(Boolean)
        .map((value) => normalizeNameKey(value));
      names.forEach((name) => byName.set(name, item));
    });

    if (items.length < 200) break;
  }

  console.info(`[WT Tiermaker] API 메타데이터 로드: id ${byId.size} / name ${byName.size}`);
  return { byId, byName };
}

function findApiVehicle(apiMeta, vehicle) {
  const idKey = String(vehicle.id || "").trim().toLowerCase();
  if (apiMeta.byId.has(idKey)) return apiMeta.byId.get(idKey);

  const nameKey = normalizeNameKey(vehicle.name);
  if (apiMeta.byName.has(nameKey)) return apiMeta.byName.get(nameKey);

  return null;
}

function normalizeNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractApiRank(api) {
  if (!api) return "";
  return api.rank ||
    api.vehicle_rank ||
    api.vehicleRank ||
    api.tier ||
    api.level ||
    api.rank_number ||
    api.rankNumber ||
    api?.battle_rating?.rank ||
    api?.metadata?.rank ||
    "";
}

function extractApiBrRb(api) {
  if (!api) return "";

  const candidates = [
    api.br_rb,
    api.rb,
    api.realistic,
    api.realistic_br,
    api.battle_rating_rb,
    api.battleRatingRb,
    api.battle_rating_realistic,
    api?.br?.rb,
    api?.br?.realistic,
    api?.br?.Realistic,
    api?.battle_rating?.rb,
    api?.battle_rating?.realistic,
    api?.battleRating?.rb,
    api?.battleRating?.realistic,
    api?.battle_ratings?.rb,
    api?.battle_ratings?.realistic,
    api?.battleRatings?.rb,
    api?.battleRatings?.realistic,
    api?.rb_br,
    api?.rbBr
  ];

  for (const value of candidates) {
    const br = normalizeBr(value);
    if (br) return br;
  }

  // API마다 Battle Rating을 배열로 주는 경우가 있어서 RB/Realistic 키워드도 탐색함.
  const deep = findBrByKey(api);
  return normalizeBr(deep);
}

function findBrByKey(value, depth = 0) {
  if (!value || depth > 4) return "";

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object") {
        const mode = String(item.mode || item.name || item.type || item.difficulty || item.game_mode || item.gameMode || "").toLowerCase();
        if (["rb", "realistic", "realistic battles"].includes(mode)) {
          const br = item.value ?? item.br ?? item.battle_rating ?? item.battleRating ?? item.rating;
          if (normalizeBr(br)) return br;
        }
      }
      const nested = findBrByKey(item, depth + 1);
      if (nested) return nested;
    }
    return "";
  }

  if (typeof value !== "object") return "";

  for (const [key, inner] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");
    if (normalizedKey === "rb" || normalizedKey === "realistic" || normalizedKey === "realisticbr" || normalizedKey === "brrb") {
      const br = normalizeBr(inner);
      if (br) return br;
      if (inner && typeof inner === "object") {
        const nestedValue = inner.value ?? inner.br ?? inner.battle_rating ?? inner.battleRating ?? inner.rating;
        if (normalizeBr(nestedValue)) return nestedValue;
      }
    }
  }

  for (const inner of Object.values(value)) {
    if (inner && typeof inner === "object") {
      const nested = findBrByKey(inner, depth + 1);
      if (nested) return nested;
    }
  }

  return "";
}

function makeId(category, nation, name) {
  return [category, nation, name]
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanValue(value) {
  return String(value || "").trim();
}

function pickImageValue(item) {
  return cleanValue(
    item.image ||
    item.img ||
    item.icon ||
    item.thumbnail ||
    item.thumb ||
    item.picture ||
    item.image_url ||
    item.thumbnail_url ||
    item.photo ||
    ""
  );
}

function populateFilters() {
  const vehicles = state.allVehicles[state.category];
  fillSelect(els.nationFilter, uniqueValues(vehicles, "nation"), "전체", formatNation);
  fillSelect(els.typeFilter, uniqueValues(vehicles, "type"), "전체", (value) => value || "미분류");
  fillSelect(els.tagFilter, uniqueValues(vehicles, "tag"), "전체", formatTag);
  populateRankFilter(uniqueValues(vehicles, "rank"));
  populateBrFilter(uniqueValues(vehicles, "brRb"));
}


function populateRankFilter(ranks) {
  els.rankFilter.innerHTML = "";

  const validRanks = ranks.filter(Boolean).sort(compareRanks);
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `rank-chip ${state.filters.ranks.length ? "" : "active"}`;
  allButton.textContent = "전체";
  allButton.addEventListener("click", () => {
    state.filters.ranks = [];
    populateRankFilter(validRanks);
    render();
  });
  els.rankFilter.append(allButton);

  if (!validRanks.length) {
    const hint = document.createElement("span");
    hint.className = "rank-hint";
    hint.textContent = "rank 열이 없으면 API에서 자동 보강을 시도해. 안 뜨면 새로고침하거나 잠시 뒤 다시 시도해줘.";
    els.rankFilter.append(hint);
    return;
  }

  validRanks.forEach((rank) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `rank-chip ${state.filters.ranks.includes(rank) ? "active" : ""}`;
    button.textContent = formatRank(rank);
    button.addEventListener("click", () => {
      if (state.filters.ranks.includes(rank)) {
        state.filters.ranks = state.filters.ranks.filter((item) => item !== rank);
      } else {
        state.filters.ranks = [...state.filters.ranks, rank].sort(compareRanks);
      }
      populateRankFilter(validRanks);
      render();
    });
    els.rankFilter.append(button);
  });
}

function populateBrFilter(brs) {
  els.brFilter.innerHTML = "";

  const validBrs = brs.filter(Boolean).sort(compareBrs);
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `rank-chip ${state.filters.brs.length ? "" : "active"}`;
  allButton.textContent = "전체";
  allButton.addEventListener("click", () => {
    state.filters.brs = [];
    populateBrFilter(validBrs);
    render();
  });
  els.brFilter.append(allButton);

  if (!validBrs.length) {
    const hint = document.createElement("span");
    hint.className = "rank-hint";
    hint.textContent = "RB BR 정보가 없으면 API에서 자동 보강을 시도해. 안 뜨면 새로고침하거나 잠시 뒤 다시 시도해줘.";
    els.brFilter.append(hint);
    return;
  }

  validBrs.forEach((br) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `rank-chip ${state.filters.brs.includes(br) ? "active" : ""}`;
    button.textContent = br;
    button.title = `RB BR ${br}`;
    button.addEventListener("click", () => {
      if (state.filters.brs.includes(br)) {
        state.filters.brs = state.filters.brs.filter((item) => item !== br);
      } else {
        state.filters.brs = [...state.filters.brs, br].sort(compareBrs);
      }
      populateBrFilter(validBrs);
      render();
    });
    els.brFilter.append(button);
  });
}

function normalizeBr(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const nested = value.value ?? value.br ?? value.battle_rating ?? value.battleRating ?? value.rating ?? "";
    return normalizeBr(nested);
  }

  const raw = String(value).trim();
  if (!raw || raw === "-" || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") return "";

  const match = raw.replace(",", ".").match(/\d+(?:\.\d+)?/);
  if (!match) return "";

  const num = Number(match[0]);
  if (!Number.isFinite(num) || num <= 0) return "";
  return num.toFixed(1);
}

function compareBrs(a, b) {
  return Number(a) - Number(b) || String(a).localeCompare(String(b));
}

function formatBr(value) {
  const br = normalizeBr(value);
  return br ? `BR ${br}` : "";
}

function normalizeRank(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase().replace(/^RANK\s*/i, "").trim();
  const numberToRoman = {
    "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V",
    "6": "VI", "7": "VII", "8": "VIII", "9": "IX", "10": "X"
  };
  return numberToRoman[upper] || upper;
}

function compareRanks(a, b) {
  return rankOrder(a) - rankOrder(b) || String(a).localeCompare(String(b));
}

function rankOrder(rank) {
  const order = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  return order[String(rank || "").toUpperCase()] || 999;
}

function formatRank(value) {
  return value ? `Rank ${value}` : "";
}

function fillSelect(select, values, defaultText, labelFn) {
  const previous = select.value;
  select.innerHTML = `<option value="all">${defaultText}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value || "unknown";
    option.textContent = labelFn(value);
    select.append(option);
  });
  select.value = [...select.options].some((option) => option.value === previous) ? previous : "all";
  if (select.id === "nationFilter") state.filters.nation = select.value;
  if (select.id === "typeFilter") state.filters.type = select.value;
  if (select.id === "tagFilter") state.filters.tag = select.value;
}

function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function render() {
  ensureCategoryPlacement(state.category);
  clearDropzones();
  const vehicles = state.allVehicles[state.category];
  const visibleVehicles = vehicles.filter(matchesFilters);
  const placedIds = new Set();

  TIERS.forEach((tier) => {
    const ids = state.placements[state.category]?.[tier] || [];
    const zone = document.querySelector(`.tier-drop[data-tier="${tier}"]`);
    ids.forEach((id) => {
      const vehicle = vehicles.find((item) => item.id === id);
      if (vehicle && matchesFilters(vehicle)) {
        zone.append(createVehicleCard(vehicle));
      }
      placedIds.add(id);
    });
  });

  visibleVehicles
    .filter((vehicle) => !placedIds.has(vehicle.id))
    .forEach((vehicle) => els.vehiclePool.append(createVehicleCard(vehicle)));

  els.countText.textContent = `${visibleVehicles.length}개`;
}

function clearDropzones() {
  document.querySelectorAll(".tier-drop").forEach((zone) => zone.innerHTML = "");
  els.vehiclePool.innerHTML = "";
}

function showPoolNotice(text) {
  clearDropzones();
  const notice = document.createElement("div");
  notice.className = "notice";
  notice.textContent = text;
  els.vehiclePool.append(notice);
}

function matchesFilters(vehicle) {
  const search = state.filters.search;
  if (search && !vehicle.name.toLowerCase().includes(search)) return false;
  if (state.filters.nation !== "all" && vehicle.nation !== state.filters.nation) return false;
  if (state.filters.type !== "all" && vehicle.type !== state.filters.type) return false;
  if (state.filters.tag !== "all" && vehicle.tag !== state.filters.tag) return false;
  if (state.filters.ranks.length && !state.filters.ranks.includes(vehicle.rank)) return false;
  if (state.filters.brs.length && !state.filters.brs.includes(vehicle.brRb)) return false;
  return true;
}

function createVehicleCard(vehicle) {
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = vehicle.id;
  node.dataset.category = vehicle.category;
  node.querySelector(".vehicle-name").textContent = vehicle.name;
  node.querySelector(".vehicle-sub").textContent = [formatNation(vehicle.nation), formatRank(vehicle.rank), formatBr(vehicle.brRb), vehicle.type, formatTag(vehicle.tag)].filter(Boolean).join(" · ");

  const image = node.querySelector(".vehicle-image");
  const imageUrl = normalizeImageUrl(vehicle.image);

  if (imageUrl) {
    image.alt = vehicle.name;

    // 먼저 이미지 영역을 표시하고, 실패하면 다시 WT fallback으로 돌림.
    // 이렇게 하면 load 이벤트를 놓치거나 브라우저 캐시 타이밍이 꼬여도 이미지가 숨겨지지 않음.
    node.classList.add("has-image");

    image.addEventListener("load", () => {
      node.classList.add("has-image");
    });

    image.addEventListener("error", () => {
      image.removeAttribute("src");
      node.classList.remove("has-image");
      console.warn("이미지 로드 실패:", vehicle.name, imageUrl);
    });

    image.src = imageUrl;
  } else {
    console.debug("이미지 URL 없음:", vehicle.name, vehicle.id);
  }

  node.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    moveVehicle(vehicle.category, vehicle.id, "Non");
    render();
  });

  node.title = "드래그해서 티어 배치 / 우클릭하면 Non으로 이동";

  node.addEventListener("dragstart", (event) => {
    node.classList.add("dragging");
    event.dataTransfer.setData("text/plain", JSON.stringify({ id: vehicle.id, category: vehicle.category }));
    event.dataTransfer.effectAllowed = "move";
  });

  node.addEventListener("dragend", () => {
    node.classList.remove("dragging");
  });

  return node;
}

function wireDropzone(zone) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drag-over");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("drag-over");

    const raw = event.dataTransfer.getData("text/plain");
    if (!raw) return;

    const { id, category } = JSON.parse(raw);
    moveVehicle(category, id, zone.dataset.tier);
    render();
  });
}

function moveVehicle(category, id, targetTier) {
  ensureCategoryPlacement(category);

  Object.keys(state.placements[category]).forEach((tier) => {
    state.placements[category][tier] = state.placements[category][tier].filter((itemId) => itemId !== id);
  });

  if (targetTier !== "pool") {
    if (!state.placements[category][targetTier]) state.placements[category][targetTier] = [];
    state.placements[category][targetTier].push(id);
  }
}

function makeEmptyPlacement() {
  return Object.fromEntries(TIERS.map((tier) => [tier, []]));
}

function ensureCategoryPlacement(category) {
  if (!state.placements[category]) state.placements[category] = makeEmptyPlacement();
  TIERS.forEach((tier) => {
    if (!Array.isArray(state.placements[category][tier])) state.placements[category][tier] = [];
  });
}

function saveState(showAlert = false) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    category: state.category,
    placements: state.placements
  }));
  if (showAlert) alert("저장 완료. 이 브라우저에 티어표가 저장됐어.");
}

function restoreState(showAlert = false) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    if (showAlert) alert("저장된 티어표가 없어.");
    return;
  }

  try {
    const saved = JSON.parse(raw);
    state.placements = saved.placements || {};
    if (showAlert) alert("불러오기 완료.");
    render();
  } catch (error) {
    console.error(error);
    alert("저장 데이터를 읽지 못했어.");
  }
}

function resetTierBoard() {
  if (!confirm("현재 선택한 장비군의 티어표를 초기화할까?")) return;
  state.placements[state.category] = makeEmptyPlacement();
  saveState(false);
  render();
}

function exportJson() {
  const data = {
    app: "WT Tier Lab",
    version: 1,
    exportedAt: new Date().toISOString(),
    placements: state.placements
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wt-tier-lab.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state.placements = data.placements || {};
      saveState(false);
      render();
      alert("JSON 가져오기 완료.");
    } catch (error) {
      console.error(error);
      alert("JSON 파일을 읽지 못했어.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function resetFilters() {
  state.filters = { search: "", nation: "all", type: "all", tag: "all", ranks: [], brs: [] };
  els.searchInput.value = "";
  els.nationFilter.value = "all";
  els.typeFilter.value = "all";
  els.tagFilter.value = "all";
}

function normalizeImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // CSV 안에 따옴표가 같이 들어온 경우 제거
  const cleaned = raw.replace(/^"|"$/g, "");

  // 프로토콜 생략 URL: //example.com/a.png
  if (cleaned.startsWith("//")) return `${location.protocol}${cleaned}`;

  // WT Vehicles API가 상대 경로를 준 경우 보정
  if (cleaned.startsWith("/")) return `https://wtvehiclesapi.duckdns.org${cleaned}`;

  return cleaned;
}

function formatTag(value) {
  return tagLabels[String(value || "").toLowerCase()] || value || "미분류";
}

function formatNation(value) {
  const key = String(value || "").toLowerCase().replace(/\s+/g, "_");
  return nationLabels[key] || value || "미분류";
}
