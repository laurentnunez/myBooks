// ================================
// Initialisation IndexedDB
// ================================

let db;
const request = indexedDB.open("BDCollection", 1);

request.onupgradeneeded = event => {
  db = event.target.result;
  const store = db.createObjectStore("bd", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = event => {
  db = event.target.result;
  loadBD();
};


// ================================
// Charger la liste des BD
// ================================

function loadBD() {
  const tx = db.transaction("bd", "readonly");
  const store = tx.objectStore("bd");
  const req = store.getAll();

  req.onsuccess = () => {
    const list = document.getElementById("bdList");
    list.innerHTML = "";

    req.result.forEach(bd => {
      const card = document.createElement("div");
      card.className = "bd-card";

      card.innerHTML = `
        <img src="${bd.cover || ''}" class="bd-cover" alt="cover">
        <div class="bd-info">
          <h3>${bd.title}</h3>
          <p><strong>Auteur :</strong> ${bd.author}</p>
          <p><strong>Dessinateur :</strong> ${bd.artist}</p>
          <p><strong>Éditeur :</strong> ${bd.editor}</p>
          <p><strong>Statut :</strong> ${formatStatus(bd.status)}</p>
          <button class="delete-btn" onclick="deleteBD(${bd.id})">🗑️ Supprimer</button>
        </div>
      `;

      list.appendChild(card);
    });
  };
}


// ================================
// Formatage du statut
// ================================

function formatStatus(code) {
  const labels = {
    a_lire: "À lire",
    lu: "Lu",
    wishlist: "Wishlist",
    a_vendre: "À vendre"
  };
  return labels[code] || code;
}


// ================================
// Suppression d'une BD
// ================================

function deleteBD(id) {
  const tx = db.transaction("bd", "readwrite");
  tx.objectStore("bd").delete(id);
  tx.oncomplete = loadBD;
}


// ================================
// Ouverture / fermeture du modal
// ================================

document.getElementById("addButton").onclick = () => {
  document.getElementById("modal").classList.remove("hidden");
};

document.getElementById("cancelButton").onclick = () => {
  document.getElementById("modal").classList.add("hidden");
  resetForm();
};


// ================================
// Sauvegarde d'une nouvelle BD
// ================================

document.getElementById("saveButton").onclick = async () => {
  const file = document.getElementById("coverInput").files[0];
  let cover = "";

  if (file) {
    cover = await toBase64(file);
  }

  const bd = {
    title: document.getElementById("titleInput").value,
    author: document.getElementById("authorInput").value,
    artist: document.getElementById("artistInput").value,
    editor: document.getElementById("editorInput").value,
    date: document.getElementById("dateInput").value,
    status: document.getElementById("statusInput").value,
    cover
  };

  const tx = db.transaction("bd", "readwrite");
  tx.objectStore("bd").add(bd);

  tx.oncomplete = () => {
    loadBD();
    resetForm();
    document.getElementById("modal").classList.add("hidden");
  };
};


// ================================
// Reset du formulaire
// ================================

function resetForm() {
  document.getElementById("titleInput").value = "";
  document.getElementById("authorInput").value = "";
  document.getElementById("artistInput").value = "";
  document.getElementById("editorInput").value = "";
  document.getElementById("dateInput").value = "";
  document.getElementById("statusInput").value = "a_lire";
  document.getElementById("coverInput").value = "";
}


// ================================
// Conversion image → Base64
// ================================

function toBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}