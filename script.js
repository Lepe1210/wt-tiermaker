const SHEET_URLS = {
  ground: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSw25dQg94ZqXKwPWcUVnhj9ztKTLf8Sz5h0m2qnXY7z9oN0k_bneR38hiuGnTdRXUXwsLUplrQAO8V/pub?gid=0&single=true&output=csv",
  air: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSw25dQg94ZqXKwPWcUVnhj9ztKTLf8Sz5h0m2qnXY7z9oN0k_bneR38hiuGnTdRXUXwsLUplrQAO8V/pub?gid=164847306&single=true&output=csv",
  naval: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSw25dQg94ZqXKwPWcUVnhj9ztKTLf8Sz5h0m2qnXY7z9oN0k_bneR38hiuGnTdRXUXwsLUplrQAO8V/pub?gid=1471470287&single=true&output=csv"
};

const TIERS = ["S", "A", "B", "C", "D", "F"];
const STORAGE_KEY = "wt-tier-lab-state-v1";

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
    tag: "all"
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
        .filter((vehicle) => vehicle.enabled !== "FALSE" && vehicle.name);
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

  const headers = rows.shift()?.map((header) => header.trim()) || [];
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
    image: item.image || "",
    enabled: String(item.enabled || "TRUE").toUpperCase()
  };
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

function populateFilters() {
  const vehicles = state.allVehicles[state.category];
  fillSelect(els.nationFilter, uniqueValues(vehicles, "nation"), "전체", formatNation);
  fillSelect(els.typeFilter, uniqueValues(vehicles, "type"), "전체", (value) => value || "미분류");
  fillSelect(els.tagFilter, uniqueValues(vehicles, "tag"), "전체", formatTag);
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
  return true;
}

function createVehicleCard(vehicle) {
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = vehicle.id;
  node.dataset.category = vehicle.category;
  node.querySelector(".vehicle-name").textContent = vehicle.name;
  node.querySelector(".vehicle-sub").textContent = [formatNation(vehicle.nation), vehicle.type, formatTag(vehicle.tag)].filter(Boolean).join(" · ");

  const image = node.querySelector(".vehicle-image");
  if (vehicle.image) {
    image.src = vehicle.image;
    image.alt = vehicle.name;
    image.addEventListener("load", () => node.classList.add("has-image"));
    image.addEventListener("error", () => node.classList.remove("has-image"));
  }

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
  if (!state.placements[category]) state.placements[category] = makeEmptyPlacement();
  Object.keys(state.placements[category]).forEach((tier) => {
    state.placements[category][tier] = state.placements[category][tier].filter((itemId) => itemId !== id);
  });

  if (targetTier !== "pool") {
    state.placements[category][targetTier].push(id);
  }
}

function makeEmptyPlacement() {
  return Object.fromEntries(TIERS.map((tier) => [tier, []]));
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
  state.filters = { search: "", nation: "all", type: "all", tag: "all" };
  els.searchInput.value = "";
  els.nationFilter.value = "all";
  els.typeFilter.value = "all";
  els.tagFilter.value = "all";
}

function formatTag(value) {
  return tagLabels[String(value || "").toLowerCase()] || value || "미분류";
}

function formatNation(value) {
  const key = String(value || "").toLowerCase().replace(/\s+/g, "_");
  return nationLabels[key] || value || "미분류";
}
