/* =========================================================
PWA
========================================================= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

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

request.onsuccess = () => {
  db = request.result;
  loadBD();
  updateStats();
};

/* =========================================================
STATE
========================================================= */
let currentFilter = "collec";
let importedCoverDataURL = "";
let groupBySeries = localStorage.getItem("groupBySeries") === "true";
let selectedTags = [];


/* =========================================================
UTILS
========================================================= */
const byId = (id) => document.getElementById(id);

function escapeHTML(s = "") {
  return s.toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function formatTomeLabel(tome) {
  if (tome === 0 || tome === "0") return "Récit complet";
  if (!tome) return "";
  return `Tome ${tome}`;
}

function toBase64(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

/* =========================================================
TOAST
========================================================= */
function showToast(msg, type = "success") {
  const root = byId("toastRoot") || document.body;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = escapeHTML(msg);
  root.appendChild(el);
  el.classList.add("show");
  setTimeout(() => el.remove(), 3000);
}

/* =========================================================
MODALES
========================================================= */
function openModal() {
  byId("modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  byId("modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function openDetailModal(bd) {
  byId("detailSeries").textContent = bd.series || "";
  byId("detailTitle").textContent = bd.title || "";
  byId("detailTome").textContent = formatTomeLabel(bd.tome);
  byId("detailAuthor").textContent = bd.author || "";
  byId("detailArtist").textContent = bd.artist || "";
  byId("detailEditor").textContent = bd.editor || "";
  byId("detailDate").textContent = formatDateFR(bd.date);
  byId("detailCover").src = bd.cover || "";
  byId("detailToggleRead").checked = bd.status === "lu";


 const tagsHTML = (bd.tags || [])
    .map(tag => `<span class="tag tag-${tag.toLowerCase()}">${escapeHTML(tag)}</span>`)
    .join("");

  byId("detailTags").innerHTML = tagsHTML;



  const modal = byId("detailModal");
  modal.dataset.bdId = bd.id;
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeDetailModal() {
  byId("detailModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

/* =========================================================
CRUD
========================================================= */
function editBD(id) {
  const tx = db.transaction("bd", "readonly");
  tx.objectStore("bd").get(id).onsuccess = (e) => {
    const bd = e.target.result;
    if (!bd) return;

    byId("seriesInput").value = bd.series ?? "";
    byId("tomeInput").value = bd.tome ?? "";
    byId("titleInput").value = bd.title ?? "";
    byId("authorInput").value = bd.author ?? "";
    byId("artistInput").value = bd.artist ?? "";
    byId("editorInput").value = bd.editor ?? "";
    byId("dateInput").value = bd.date ?? "";
    byId("statusInput").value = bd.status ?? "a_lire";
    byId("pagesInput").value = bd.pages ?? "";


selectedTags = bd.tags || [];

// reset visuel
document.querySelectorAll(".tag-btn").forEach(btn => {
  const tag = btn.dataset.tag;

  if (selectedTags.includes(tag)) {
    btn.classList.add("active");
  } else {
    btn.classList.remove("active");
  }
});


    importedCoverDataURL = bd.cover ?? "";
    byId("modal").dataset.editId = id;

    openModal();
  };
}

function deleteBD(id) {
  const tx = db.transaction("bd", "readwrite");
  tx.objectStore("bd").delete(id);
  tx.oncomplete = () => {
    loadBD();
    updateStats();
    showToast("BD supprimée");
  };
}

/* =========================================================
SAVE
========================================================= */
async function saveBD() {
  const file = byId("coverInput").files?.[0];

  if (file) {
    if (!file.type.startsWith("image/")) {
      showToast("Fichier non valide", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("Image trop lourde (max 2MB)", "error");
      return;
    }
  }

  const cover = file ? await toBase64(file) : importedCoverDataURL;

  const tomeValue = byId("tomeInput").value;


  const bd = {
    series: byId("seriesInput").value,
    tome: tomeValue ? Number(tomeValue) : null,
    title: byId("titleInput").value,
    author: byId("authorInput").value,
    artist: byId("artistInput").value,
    editor: byId("editorInput").value,
    date: byId("dateInput").value,
    status: byId("statusInput").value,
    pages: byId("pagesInput").value,
    cover,
    tags: [...selectedTags].sort((a, b) =>
    a.localeCompare(b, "fr", { sensitivity: "base" })
)
  };

  const editId = byId("modal").dataset.editId;

  const tx = db.transaction("bd", "readwrite");
  const store = tx.objectStore("bd");

  if (editId) {
    bd.id = Number(editId);
    store.put(bd);
  } else {
    store.add(bd);
  }

  tx.oncomplete = () => {
    resetForm();
    closeModal();
    loadBD();
    updateStats();
    showToast(editId ? "BD mise à jour" : "BD ajoutée");
  };
}

/* =========================================================
LIST
========================================================= */
function loadBD() {
  const list = byId("bdList");
  const tx = db.transaction("bd", "readonly");
  const store = tx.objectStore("bd");

  store.getAll().onsuccess = (e) => {
    let items = e.target.result || [];

    items = items.filter((bd) => {
      if (currentFilter === "collec")
        return bd.status === "a_lire" || bd.status === "lu";
      return bd.status === currentFilter;
    });

    items.sort((a, b) => {
      const seriesCompare = (a.series || "").localeCompare(b.series || "", "fr", { sensitivity: "base" });
      if (seriesCompare !== 0) return seriesCompare;
      // si même série → tri par tome
      return (a.tome || 0) - (b.tome || 0);
    });

    list.innerHTML = "";

    if (groupBySeries) {
      renderGrouped(items, list);
      list.classList.add("grouped");
    } else {
      renderGrid(items, list);
      list.classList.remove("grouped");
    }
  };
}

function renderGrid(items, list) {
  items.forEach((bd) => {
    list.appendChild(createBDCard(bd));
  });
}

function renderGrouped(items, list) {
  const groups = {};

  items.forEach((bd) => {
    const key = bd.series || "Sans série";
    if (!groups[key]) groups[key] = [];
    groups[key].push(bd);
  });

  Object.entries(groups).forEach(([series, bds]) => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "series-group";

    const header = document.createElement("div");
    header.className = "series-header";
    header.innerHTML = `
      ${escapeHTML(series)}
      <span class="series-count">(${bds.length})</span>
    `;

    const grid = document.createElement("div");
    grid.className = "series-grid";

    bds.sort((a, b) => (a.tome || 0) - (b.tome || 0));

    bds.forEach((bd) => {
      grid.appendChild(createBDCard(bd));
    });

    groupDiv.appendChild(header);
    groupDiv.appendChild(grid);
    list.appendChild(groupDiv);
  });
}

function createBDCard(bd) {
  const el = document.createElement("div");
  el.className = "bd-card-grid";
  
  const futureBadge = isFutureDate(bd.date)
      ? `<div class="future-badge">Sortie le ${formatDateFR(bd.date)}</div>`
      : "";

  const tagsHTML = (bd.tags || [])
  .slice() // évite de modifier l'original
  .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }))
  .map(tag => `<span class="tag tag-${tag.toLowerCase()}">${escapeHTML(tag)}</span>`)
  .join("");



  el.innerHTML = `
    ${bd.cover
      ? `<img src="${bd.cover}" alt="cover"/>`
      : `<div class="bd-cover">Pas de couverture</div>`
    }

    ${futureBadge}

    ${bd.status === "lu" ? `<div class="read-badge">✔</div>` : ""}
    <div class="bd-card-series">${escapeHTML(bd.series || "")}</div>
    <div class="bd-card-tome">${formatTomeLabel(bd.tome)}</div>
  `;

  el.onclick = () => openDetailModal(bd);

  return el;
}

/* =========================================================
STATS
========================================================= */
function updateStats() {
  const tx = db.transaction("bd", "readonly");
  const store = tx.objectStore("bd");

  store.getAll().onsuccess = (e) => {
    const items = e.target.result || [];

    byId("statTotal").textContent = items.length;

    const read = items.filter((b) => b.status === "lu");
    byId("statRead").textContent = read.length;

    const pages = read.reduce((sum, b) => sum + Number(b.pages || 0), 0);
    byId("statPages").textContent = pages;
  };
}

/* =========================================================
TOGGLE READ
========================================================= */
function toggleReadStatus(id) {
  const tx = db.transaction("bd", "readwrite");
  const store = tx.objectStore("bd");

  store.get(id).onsuccess = (e) => {
    const bd = e.target.result;
    if (!bd) return;

    bd.status = bd.status === "lu" ? "a_lire" : "lu";
    store.put(bd);
  };

  tx.oncomplete = () => {
    loadBD();
    updateStats();
    showToast("Statut modifié");
  };
}

/* =========================================================
FORM
========================================================= */
function resetForm() {
  [
    "seriesInput", "tomeInput", "titleInput",
    "authorInput", "artistInput", "editorInput",
    "dateInput", "pagesInput"
  ].forEach((id) => {
    const el = byId(id);
    if (el) el.value = "";
  });

  byId("statusInput").value = "a_lire";
  byId("coverInput").value = "";
  byId("isbnInput").value = "";

  importedCoverDataURL = "";
  delete byId("modal").dataset.editId;

selectedTags = [];

document.querySelectorAll(".tag-btn").forEach(btn => {
  btn.classList.remove("active");
});

}

/* =========================================================
INIT
========================================================= */
window.addEventListener("DOMContentLoaded", () => {

  // bouton +
  byId("addButton").onclick = () => {
    resetForm();
    openModal();
  };

  byId("saveButton").onclick = saveBD;
  byId("cancelButton").onclick = closeModal;

  // détail
  byId("detailClose").onclick = closeDetailModal;

  byId("detailEdit").onclick = () => {
    const id = Number(byId("detailModal").dataset.bdId);
    closeDetailModal();
    editBD(id);
  };

  byId("detailDelete").onclick = () => {
    const id = Number(byId("detailModal").dataset.bdId);
    if (confirm("Supprimer cette BD ?")) {
      closeDetailModal();
      deleteBD(id);
    }
  };

  byId("detailToggleRead").onclick = () => {
    const id = Number(byId("detailModal").dataset.bdId);
    toggleReadStatus(id);
  };


  // filtres
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      loadBD();
    });
  });

  document.querySelectorAll(".tag-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;

      if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
        btn.classList.remove("active");
      } else {
        selectedTags.push(tag);
        btn.classList.add("active");
      }
    });
  });


  document.querySelector('[data-filter="collec"]')?.classList.add("active");

  // ✅ Toggle ALBUM / SERIE
  const toggle = byId("groupBySeriesToggle");
  toggle.checked = groupBySeries;

  toggle.addEventListener("change", () => {
    groupBySeries = toggle.checked;
    localStorage.setItem("groupBySeries", groupBySeries);
    loadBD();
  });
});

function isFutureDate(dateStr) {
  if (!dateStr) return false;

  const today = new Date();
  const date = new Date(dateStr);

  // on ignore l'heure pour éviter les faux positifs
  today.setHours(0,0,0,0);
  date.setHours(0,0,0,0);

  return date > today;
}

function formatDateFR(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}