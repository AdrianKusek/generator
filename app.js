const rawInput = document.getElementById("rawInput");
const cards = document.getElementById("cards");
const stats = document.getElementById("stats");
const parseBtn = document.getElementById("parseBtn");
const clearBtn = document.getElementById("clearBtn");
const pasteBtn = document.getElementById("pasteBtn");
const sortToggle = document.getElementById("sortToggle");
const printBtn = document.getElementById("printBtn");
const cardTemplate = document.getElementById("cardTemplate");

const INDEX_REGEX = /\b\d{3}\.\d{3}\.\d{2}\b/;
const HEADER_BLACKLIST = [
  "numer",
  "cdu",
  "indeks",
  "opis",
  "cena",
  "ilość",
  "ilosc",
  "wartość",
  "wartosc",
  "razem",
  "suma",
  "produkt",
  "nr",
  "pozycja",
  "kod",
];

let state = {
  raw: "",
  items: [],
  sort: false,
};

function normalizeLine(line) {
  return line.replace(/\s+/g, " ").trim();
}

function isHeaderLine(line) {
  const lower = line.toLowerCase();
  return HEADER_BLACKLIST.some((word) => lower.includes(word));
}

function looksLikeNumber(line) {
  return /^-?\d+(?:[\.,]\d+)?$/.test(line);
}

function parseInput(text) {
  const lines = text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.length > 0);

  const found = [];
  const indexMap = new Map();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isHeaderLine(line)) {
      continue;
    }

    const match = line.match(INDEX_REGEX);
    if (!match) {
      continue;
    }

    const index = match[0];
    let desc = "";
    let qtyProducts = null;
    let qtyPacks = null;

    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];
      if (INDEX_REGEX.test(next)) {
        break;
      }
      if (!desc && !isHeaderLine(next) && !looksLikeNumber(next)) {
        desc = next;
        continue;
      }
      if (looksLikeNumber(next)) {
        const value = parseFloat(next.replace(",", "."));
        if (Number.isFinite(value)) {
          if (qtyProducts === null) {
            qtyProducts = value;
          } else if (qtyPacks === null && Number.isInteger(value)) {
            qtyPacks = value;
          }
        }
      }
      if (desc && qtyProducts !== null && qtyPacks !== null) {
        break;
      }
    }

    const key = index;
    if (!indexMap.has(key)) {
      indexMap.set(key, {
        index,
        desc,
        qtyProducts,
        qtyPacks,
        count: 1,
      });
    } else {
      const existing = indexMap.get(key);
      existing.count += 1;
      if (!existing.desc && desc) {
        existing.desc = desc;
      }
      if (existing.qtyProducts === null && qtyProducts !== null) {
        existing.qtyProducts = qtyProducts;
      }
      if (existing.qtyPacks === null && qtyPacks !== null) {
        existing.qtyPacks = qtyPacks;
      }
    }

    found.push(index);
  }

  return {
    found,
    items: Array.from(indexMap.values()),
  };
}

function render() {
  cards.innerHTML = "";
  const items = [...state.items];
  if (state.sort) {
    items.sort((a, b) => a.index.localeCompare(b.index));
  }

  for (const item of items) {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".card");
    const indexEl = node.querySelector(".card__index");
    const descEl = node.querySelector(".card__desc");
    const qtyBadge = node.querySelector(".badge--qty");
    const totalBadge = node.querySelector(".badge--total");
    const barcode = node.querySelector(".barcode");

    indexEl.textContent = item.index;
    descEl.textContent = item.desc || "(brak opisu)";
    qtyBadge.textContent =
      item.qtyProducts !== null
        ? `Ilość: ${item.qtyProducts}`
        : "Ilość: ?";
    totalBadge.textContent = `Duplikaty: ${item.count}`;

    card.querySelector(".copy-index").addEventListener("click", () => {
      navigator.clipboard.writeText(item.index);
    });
    card.querySelector(".copy-plain").addEventListener("click", () => {
      navigator.clipboard.writeText(item.index.replace(/\./g, ""));
    });
    card.querySelector(".remove").addEventListener("click", () => {
      state.items = state.items.filter((x) => x.index !== item.index);
      render();
      updateStats();
    });

    JsBarcode(barcode, item.index.replace(/\./g, ""), {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      height: 80,
      margin: 0,
      background: "transparent",
      lineColor: "#111827",
    });

    cards.appendChild(node);
  }
}

function updateStats() {
  const total = state.raw ? parseInput(state.raw).found.length : 0;
  const unique = state.items.length;
  stats.textContent = `Znalezione: ${total} | Unikalne: ${unique}`;
}

function parseAndRender() {
  const raw = rawInput.value || "";
  state.raw = raw;
  localStorage.setItem("ikea_raw", raw);
  const { items } = parseInput(raw);
  state.items = items;
  render();
  updateStats();
}

parseBtn.addEventListener("click", parseAndRender);
clearBtn.addEventListener("click", () => {
  rawInput.value = "";
  state.raw = "";
  state.items = [];
  localStorage.removeItem("ikea_raw");
  render();
  updateStats();
});

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    rawInput.value = text;
    parseAndRender();
  } catch (err) {
    alert("Nie udało się odczytać schowka. Sprawdź uprawnienia przeglądarki.");
  }
});

sortToggle.addEventListener("change", (event) => {
  state.sort = event.target.checked;
  render();
});

printBtn.addEventListener("click", () => window.print());

function restoreFromStorage() {
  const cached = localStorage.getItem("ikea_raw");
  if (cached) {
    rawInput.value = cached;
    parseAndRender();
  }
}

restoreFromStorage();
