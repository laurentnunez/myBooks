/* =========================================================
   PWA : Service Worker
   ========================================================= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

/* =========================================================
   THEME SOMBRE (avec persistance)
   ========================================================= */
const THEME_KEY = "bd-theme";
const themeToggleBtn = document.getElementById("themeToggle");

function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  themeToggleBtn.textContent = mode === "dark" ? "☀️" : "🌙";
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

let currentTheme = localStorage.getItem(THEME_KEY) || (systemPrefersDark() ? "dark" : "light");
applyTheme(currentTheme);

themeToggleBtn.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
});

/* =========================================================
   IndexedDB
   ========================================================= */
let db;
const request = indexedDB.open("BDCollection", 1);

request.onupgradeneeded = (event) => {
  db = event.target.result;
  if (!db.objectStoreNames.contains("bd")) {
    db.createObjectStore("bd", { keyPath: "id", autoIncrement: true });
  }
};

request.onsuccess = (event) => {
  db = event.target.result;
  loadBD();
};

/* =========================================================
   Variables globales
   ========================================================= */
let currentFilter = "all";
let importedCoverDataURL = "";
let listMode = "grid"; // grille par défaut

const modalEl = document.getElementById("modal");
const listEl = document.getElementById("bdList");
const viewModeToggle = document.getElementById("viewModeToggle");

/* =========================================================
   Utilitaires
   ========================================================= */
function byId(id) { return document.getElementById(id); }

function escapeHTML(s) {
  return (s || "").toString().replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function formatStatus(code) {
  return ({
    a_lire: "À lire",
    lu: "Lu",
    wishlist: "Wishlist",
    a_vendre: "À vendre"
  })[code] || code;
}

function toBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function urlToDataURL(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Image introuvable");
  const blob = await res.blob();
  return new Promise(resolve => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

function normalizeDate(input) {
  if (!input) return "";
  if (/^\d{4}(-\d{2}){0,2}$/.test(input)) {
    if (/^\d{4}$/.test(input)) return `${input}-01-01`;
    if (/^\d{4}-\d{2}$/.test(input)) return `${input}-01`;
    return input;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/* =========================================================
   Rendu liste BD (avec tri + modes grille/liste)
   ========================================================= */
function loadBD() {
  const tx = db.transaction("bd", "readonly");
  const store = tx.objectStore("bd");
  const req = store.getAll();

  req.onsuccess = () => {
    let items = req.result || [];

    items = items
      .filter(bd => currentFilter === "all" || bd.status === currentFilter)
      .sort((a, b) => (a.title || "").localeCompare(b.title || "", "fr", { sensitivity: "base" }));

    listEl.innerHTML = "";

    listEl.classList.toggle("grid-mode", listMode === "grid");
    listEl.classList.toggle("list-mode", listMode === "list");

    items.forEach((bd) => {
      let html = "";
      let wrapper = document.createElement("div");

      /* ==========================
         MODE GRILLE
      ========================== */
      if (listMode === "grid") {
        wrapper.className = "bd-card-grid";
        html = `
          <img src="${escapeHTML(bd.cover || "")}" alt="Couverture" />
          <div class="bd-card-title">${escapeHTML(bd.title)}</div>
          <div class="bd-card-actions">
            <button class="btn" onclick="editBD(${bd.id})">✏️</button>
            <button class="btn" onclick="deleteBD(${bd.id})">🗑️</button>
          </div>
        `;

      /* ==========================
         MODE LISTE (L3)
      ========================== */
      } else {
        wrapper.className = "bd-card-list";
        html = `
          <img src="${escapeHTML(bd.cover || "")}" alt="Couverture" />
          <div class="info">
            <div class="bd-card-title">${escapeHTML(bd.title)}</div>
            <div class="author">${escapeHTML(bd.author || "")}</div>
          </div>
          <div class="bd-card-actions">
            <button class="btn" onclick="editBD(${bd.id})">✏️</button>
            <button class="btn" onclick="deleteBD(${bd.id})">🗑️</button>
          </div>
        `;
      }

      wrapper.innerHTML = html;
      listEl.appendChild(wrapper);
    });
  };
}

/* =========================================================
   Toggle Grille ↔ Liste
   ========================================================= */
viewModeToggle.addEventListener("change", () => {
  listMode = viewModeToggle.checked ? "list" : "grid";
  loadBD();
});

/* =========================================================
   CRUD
   ========================================================= */
function deleteBD(id) {
  const tx = db.transaction("bd", "readwrite");
  tx.objectStore("bd").delete(id);
  tx.oncomplete = loadBD;
}
window.deleteBD = deleteBD;

function editBD(id) {
  const tx = db.transaction("bd", "readonly");
  const req = tx.objectStore("bd").get(id);

  req.onsuccess = () => {
    const bd = req.result;
    if (!bd) return;

    byId("titleInput").value = bd.title;
    byId("authorInput").value = bd.author;
    byId("artistInput").value = bd.artist;
    byId("editorInput").value = bd.editor;
    byId("dateInput").value = bd.date;
    byId("statusInput").value = bd.status;

    importedCoverDataURL = bd.cover || "";
    modalEl.dataset.editId = id;

    openModal();
  };
}
window.editBD = editBD;

/* =========================================================
   Modale
   ========================================================= */
function openModal() {
  modalEl.classList.remove("hidden");
}
function closeModal() {
  modalEl.classList.add("hidden");
  delete modalEl.dataset.editId;
}

byId("addButton").onclick = () => openModal();
byId("cancelButton").onclick = () => { resetForm(); closeModal(); };

/* =========================================================
   Enregistrer BD (Ajouter + Modifier)
   ========================================================= */
byId("saveButton").onclick = async () => {
  const file = byId("coverInput").files[0];
  let cover = file ? await toBase64(file) : importedCoverDataURL;

  const bd = {
    title: byId("titleInput").value,
    author: byId("authorInput").value,
    artist: byId("artistInput").value,
    editor: byId("editorInput").value,
    date: byId("dateInput").value,
    status: byId("statusInput").value,
    cover
  };

  const editId = modalEl.dataset.editId;

  if (editId) {
    bd.id = Number(editId);
    const tx = db.transaction("bd", "readwrite");
    tx.objectStore("bd").put(bd);
    tx.oncomplete = () => { resetForm(); closeModal(); loadBD(); };
  } else {
    const tx = db.transaction("bd", "readwrite");
    tx.objectStore("bd").add(bd);
    tx.oncomplete = () => { resetForm(); closeModal(); loadBD(); };
  }
};

/* =========================================================
   Reset
   ========================================================= */
function resetForm() {
  ["titleInput","authorInput","artistInput","editorInput","dateInput","isbnInputModal"]
    .forEach(id => { if (byId(id)) byId(id).value = ""; });

  importedCoverDataURL = "";
  byId("coverInput").value = "";
  byId("statusInput").value = "a_lire";
}

/* =========================================================
   Filtres statut
   ========================================================= */
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    loadBD();
  });
});

/* =========================================================
   Import ISBN (dans la modale)
   ========================================================= */
const isbnInput = byId("isbnInputModal");
const importBtn = byId("importIsbnBtnModal");
const importHint = byId("importHintModal");

async function importFromGoogleBooks(isbn) {
  const apiKey = "AIzaSyA5B3tNy65krib-Y7DWpR1U01X1cOxMMiI";
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error();
  const data = await r.json();
  if (!data.items || !data.items.length) throw new Error();

  const info = data.items[0].volumeInfo;
  byId("titleInput").value = info.title || "";
  byId("authorInput").value = (info.authors || []).join(", ");
  byId("editorInput").value = info.publisher || "";
  byId("dateInput").value = normalizeDate(info.publishedDate || "");

  const img = info.imageLinks?.thumbnail;
  importedCoverDataURL = img ? await urlToDataURL(img.replace("http://","https://")) : "";
}

async function importFromOpenLibrary(isbn) {
  importedCoverDataURL = "";

  try {
    const r = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (r.ok) {
      const meta = await r.json();
      if (!byId("titleInput").value)  byId("titleInput").value  = meta.title || "";
      if (!byId("editorInput").value) byId("editorInput").value = (meta.publishers || [""])[0];
      if (!byId("dateInput").value)   byId("dateInput").value   = normalizeDate(meta.publish_date || "");
    }
  } catch {}

  try {
    const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    const t = await fetch(coverUrl);
    if (t.ok) importedCoverDataURL = await urlToDataURL(coverUrl);
  } catch {}
}

importBtn.addEventListener("click", async () => {
  const isbn = isbnInput.value.replace(/[-\s]/g,"");

  if (!isbn) {
    alert("Saisis un ISBN.");
    return;
  }

  importHint.textContent = "Import en cours…";

  try {
    try {
      await importFromGoogleBooks(isbn);
    } catch {
      await importFromOpenLibrary(isbn);
    }

    importHint.textContent = importedCoverDataURL
      ? "Données récupérées + couverture trouvée ✔️"
      : "Données récupérées (pas de couverture)";

  } catch {
    importHint.textContent = "Aucun résultat trouvé.";
  }
});