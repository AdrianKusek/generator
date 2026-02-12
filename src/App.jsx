import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

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

    if (!indexMap.has(index)) {
      indexMap.set(index, {
        index,
        desc,
        qtyProducts,
        qtyPacks,
        count: 1,
      });
    } else {
      const existing = indexMap.get(index);
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
    items: Array.from(indexMap.values()),
    totalFound: found.length,
  };
}

function copyText(text) {
  if (!navigator.clipboard) {
    return;
  }
  navigator.clipboard.writeText(text).catch(() => {
    alert("Nie udało się skopiować do schowka.");
  });
}

function ItemCard({ item, onRemove }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (!barcodeRef.current || !window.JsBarcode) {
      return;
    }
    window.JsBarcode(barcodeRef.current, item.index.replace(/\./g, ""), {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      height: 80,
      margin: 0,
      background: "transparent",
      lineColor: "#111827",
    });
  }, [item.index]);

  return (
    <article className="card">
      <div className="card__header">
        <div>
          <div className="card__index">{item.index}</div>
          <div className="card__desc">{item.desc || "(brak opisu)"}</div>
        </div>
        <div className="card__meta">
          <span className="badge badge--qty">
            Ilość: {item.qtyProducts !== null ? item.qtyProducts : "?"}
          </span>
          <span className="badge badge--packs">
            Paczki: {item.qtyPacks !== null ? item.qtyPacks : "?"}
          </span>
          <span className="badge badge--total">Duplikaty: {item.count}</span>
        </div>
      </div>
      <div className="card__barcode">
        <svg className="barcode" ref={barcodeRef}></svg>
      </div>
      <div className="card__actions">
        <button
          className="btn btn--small"
          type="button"
          onClick={() => copyText(item.index)}
        >
          Kopiuj indeks
        </button>
        <button
          className="btn btn--small"
          type="button"
          onClick={() => copyText(item.index.replace(/\./g, ""))}
        >
          Kopiuj bez kropek
        </button>
        <button
          className="btn btn--small btn--danger"
          type="button"
          onClick={() => onRemove(item.index)}
        >
          Usuń
        </button>
      </div>
    </article>
  );
}

function App() {
  const [raw, setRaw] = useState("");
  const [items, setItems] = useState([]);
  const [totalFound, setTotalFound] = useState(0);
  const [sort, setSort] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem("ikea_raw");
    if (cached) {
      setRaw(cached);
      const parsed = parseInput(cached);
      setItems(parsed.items);
      setTotalFound(parsed.totalFound);
    }
  }, []);

  const sortedItems = useMemo(() => {
    const next = [...items];
    if (sort) {
      next.sort((a, b) => a.index.localeCompare(b.index));
    }
    return next;
  }, [items, sort]);

  const handleParse = () => {
    const parsed = parseInput(raw);
    setItems(parsed.items);
    setTotalFound(parsed.totalFound);
    localStorage.setItem("ikea_raw", raw);
  };

  const handleClear = () => {
    setRaw("");
    setItems([]);
    setTotalFound(0);
    localStorage.removeItem("ikea_raw");
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRaw(text);
      const parsed = parseInput(text);
      setItems(parsed.items);
      setTotalFound(parsed.totalFound);
      localStorage.setItem("ikea_raw", text);
    } catch (err) {
      alert("Nie udało się odczytać schowka. Sprawdź uprawnienia przeglądarki.");
    }
  };

  const handleRemove = (index) => {
    setItems((prev) => prev.filter((item) => item.index !== index));
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__title">IKEA Barcode Generator</span>
          <span className="brand__subtitle">
            Prosty parser koszyka + kody kreskowe
          </span>
        </div>
        <div className="stats">
          Znalezione: {totalFound} | Unikalne: {items.length}
        </div>
      </header>

      <main className="wrap">
        <section className="panel">
          <label className="label" htmlFor="rawInput">
            Wklej listę
          </label>
          <textarea
            id="rawInput"
            className="textarea"
            placeholder="Wklej surowy tekst z koszyka IKEA..."
            rows={10}
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
          ></textarea>

          <div className="controls">
            <button className="btn" type="button" onClick={handlePaste}>
              Wklej ze schowka
            </button>
            <button className="btn" type="button" onClick={handleParse}>
              Przetwórz
            </button>
            <button className="btn" type="button" onClick={handleClear}>
              Wyczyść
            </button>
            <label className="toggle">
              <input
                type="checkbox"
                checked={sort}
                onChange={(event) => setSort(event.target.checked)}
              />
              <span>Sortuj alfabetycznie</span>
            </label>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => window.print()}
            >
              Drukuj A4
            </button>
          </div>

          <div className="hint">
            Parser ignoruje nagłówki, wyciąga indeksy w formacie ###.###.##,
            szacuje opis i ilości.
          </div>
        </section>

        <section className="cards">
          {sortedItems.map((item) => (
            <ItemCard key={item.index} item={item} onRemove={handleRemove} />
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;
