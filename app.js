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
        <img src="${bd.cover}" class="bd-cover">
        <div>
          <h3>${bd.title}</h3>
          <p>Auteur : ${bd.author}</p>
          <p>Dessinateur : ${bd.artist}</p>
          <p>Statut : ${bd.status}</p>
          <button onclick="deleteBD(${bd.id})">Supprimer</button>
        </div>`;
      list.appendChild(card);
    });
  };
}

function deleteBD(id) {
  const tx = db.transaction("bd", "readwrite");
  tx.objectStore("bd").delete(id);
  tx.oncomplete = loadBD;
}

document.getElementById("addButton").onclick = () => {
  document.getElementById("modal").classList.remove("hidden");
};

document.getElementById("cancelButton").onclick = () => {
  document.getElementById("modal").classList.add("hidden");
};

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
    document.getElementById("modal").classList.add("hidden");
  };
};

function toBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}