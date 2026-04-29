const STORAGE_KEY = "ledermair-fahrer-info-v13";
const DRIVERS_STORAGE_KEY = "ledermair-fahrer-info-drivers-v13";
const LEGACY_STORAGE_KEYS = ["ledermair-fahrer-info-v12", "ledermair-fahrer-info-v11", "ledermair-fahrer-info-v1"];

const starterEntries = [
  {
    id: crypto.randomUUID(),
    name: "Beispiel Busparkplatz",
    category: "Busparkplatz",
    address: "Musterstraße 1",
    postalCode: "6130",
    cityName: "Schwaz",
    country: "Österreich",
    gps: "",
    mapsLink: "",
    parkingAddress: "Direkt am Ziel / Musterparkplatz",
    parkingGps: "",
    parkingLink: "",
    parkingFees: "Kostenlos",
    bookingType: "nicht_noetig",
    accessible: "ja",
    accessRestriction: "keine_bekannt",
    accessRestrictionDetails: "",
    dropoff: "Direkt beim Eingang möglich.",
    difficulty: "gruen",
    authorDriverId: "",
    author: "Demo-Eintrag",
    localContact: "",
    driverNotes: "Dieser Eintrag dient als Muster. Kann gelöscht oder überschrieben werden.",
    photos: [],
    updatedAt: new Date().toISOString()
  }
];

const starterDrivers = [
  { id: crypto.randomUUID(), name: "Ömer Bülbül", phone: "+43 664 000000", updatedAt: new Date().toISOString() },
  { id: crypto.randomUUID(), name: "Christoph Budeck", phone: "+43 664 111111", updatedAt: new Date().toISOString() }
];

const fields = [
  "name", "category", "address", "postalCode", "cityName", "country", "gps", "mapsLink",
  "parkingAddress", "parkingGps", "parkingLink", "parkingFees", "bookingType", "accessible",
  "accessRestriction", "accessRestrictionDetails", "dropoff", "difficulty",
  "localContact", "driverNotes"
];

const countryCodeMap = {
  "Österreich": "AT",
  "Deutschland": "DE",
  "Schweiz": "CH",
  "Italien": "IT",
  "Frankreich": "FR",
  "Tschechien": "CZ",
  "Slowenien": "SI",
  "Kroatien": "HR",
  "Ungarn": "HU"
};

const $ = (id) => document.getElementById(id);
let entries = loadEntries();
let drivers = loadDrivers();
let currentPhotos = [];
let recognition = null;
let isRecording = false;

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(starterEntries));
    return starterEntries;
  }
  try {
    const parsed = JSON.parse(raw).map(normalizeEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(starterEntries));
    return starterEntries;
  }
}

function loadDrivers() {
  const raw = localStorage.getItem(DRIVERS_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(starterDrivers));
    return starterDrivers;
  }
  try {
    return JSON.parse(raw).map(d => ({
      id: d.id || crypto.randomUUID(),
      name: d.name || "",
      phone: d.phone || "",
      updatedAt: d.updatedAt || new Date().toISOString()
    }));
  } catch {
    localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(starterDrivers));
    return starterDrivers;
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function saveDrivers() {
  localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(drivers));
}

function normalizeEntry(entry) {
  const normalized = { ...entry };
  if (!normalized.postalCode || !normalized.cityName) {
    const legacyCity = normalized.city || "";
    const match = legacyCity.match(/^(\d{4,5})\s+(.+)$/);
    if (match) {
      normalized.postalCode = normalized.postalCode || match[1];
      normalized.cityName = normalized.cityName || match[2];
    } else {
      normalized.cityName = normalized.cityName || legacyCity;
      normalized.postalCode = normalized.postalCode || "";
    }
  }
  normalized.gps = normalized.gps || "";
  normalized.parkingGps = normalized.parkingGps || "";
  normalized.photos = Array.isArray(normalized.photos) ? normalized.photos : [];
  normalized.authorDriverId = normalized.authorDriverId || "";
  normalized.author = normalized.author || resolveAuthorFromDriverId(normalized.authorDriverId) || "";
  return normalized;
}

function resolveAuthorFromDriverId(driverId) {
  const driver = drivers.find(d => d.id === driverId);
  return driver ? `${driver.name} (${driver.phone})` : "";
}

function niceValue(value) {
  const map = {
    gruen: "Grün",
    gelb: "Gelb",
    rot: "Rot",
    vor_ort: "Vor Ort",
    online: "Onlinebuchung",
    telefonisch: "Telefonisch",
    nicht_noetig: "Nicht nötig",
    unbekannt: "Unbekannt",
    ja: "Ja",
    nein: "Nein",
    teilweise: "Teilweise",
    keine_bekannt: "Keine bekannt",
    innenstadt: "Innenstadt",
    umweltzone: "Umweltzone",
    enge_zufahrt: "Enge Zufahrt",
    hoehenbeschraenkung: "Höhenbeschränkung",
    gewichtsbeschraenkung: "Gewichtsbeschränkung",
    anmeldung_noetig: "Anmeldung nötig",
    sonstiges: "Sonstiges"
  };
  return map[value] || value || "—";
}

function updateCategoryFilter() {
  const select = $("categoryFilter");
  const current = select.value;
  const cats = [...new Set(entries.map(e => e.category).filter(Boolean))].sort();
  select.innerHTML = '<option value="">Alle Kategorien</option>' + cats.map(c => `<option>${escapeHtml(c)}</option>`).join("");
  select.value = current;
}

function populateDriverDropdown(selectedId = "") {
  const select = $("authorDriverId");
  select.innerHTML = '<option value="">Bitte Fahrer auswählen</option>' + drivers
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map(driver => `<option value="${driver.id}">${escapeHtml(driver.name)} – ${escapeHtml(driver.phone)}</option>`)
    .join("");
  select.value = selectedId;
  updateSelectedDriverInfo();
}

function updateSelectedDriverInfo() {
  const driverId = $("authorDriverId").value;
  const box = $("selectedDriverInfo");
  if (!driverId) {
    box.textContent = "Noch kein Fahrer ausgewählt.";
    return;
  }
  const driver = drivers.find(d => d.id === driverId);
  box.textContent = driver ? `Rückfragen an: ${driver.name} · ${driver.phone}` : "Fahrer nicht gefunden.";
}

function getFilteredEntries() {
  const q = $("searchInput").value.toLowerCase().trim();
  const cat = $("categoryFilter").value;
  const diff = $("difficultyFilter").value;
  return entries
    .filter(e => !cat || e.category === cat)
    .filter(e => !diff || e.difficulty === diff)
    .filter(e => {
      if (!q) return true;
      return [e.name, e.category, e.address, e.postalCode, e.cityName, e.country, e.parkingAddress, e.driverNotes, e.author]
        .join(" ").toLowerCase().includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function renderEntries() {
  updateCategoryFilter();
  const list = $("entryList");
  const template = $("entryCardTemplate");
  list.innerHTML = "";
  const filtered = getFilteredEntries();

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><strong>Keine Einträge gefunden.</strong><br>Suche ändern oder neues Ziel erfassen.</div>`;
    return;
  }

  for (const entry of filtered) {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".entry-card");
    card.querySelector(".category").textContent = entry.category || "Ohne Kategorie";
    const dot = card.querySelector(".status-dot");
    dot.classList.add(entry.difficulty || "gruen");

    const photoButton = card.querySelector(".card-photo");
    const photoImg = photoButton.querySelector("img");
    const firstPhoto = entry.photos?.[0];
    if (firstPhoto) {
      photoImg.src = firstPhoto.dataUrl;
      photoImg.alt = firstPhoto.name || `Foto zu ${entry.name}`;
      photoButton.addEventListener("click", () => openPhotoDialog(firstPhoto, entry.name));
    } else {
      photoButton.classList.add("empty");
      photoButton.innerHTML = `<span>Kein Foto</span>`;
      photoButton.disabled = true;
    }

    card.querySelector("h2").textContent = entry.name;
    card.querySelector(".location").textContent = fullAddress(entry);
    card.querySelector(".notes").textContent = entry.driverNotes || "Kein Fahrerhinweis hinterlegt.";

    const meta = card.querySelector(".meta-grid");
    meta.innerHTML = [
      ["Busparkplatz", entry.parkingAddress],
      ["Gebühren", entry.parkingFees],
      ["Buchung", niceValue(entry.bookingType)],
      ["Behindertengerecht", niceValue(entry.accessible)],
      ["Zufahrt", niceValue(entry.accessRestriction)],
      ["Fotos", entry.photos?.length ? `${entry.photos.length} Foto(s)` : "—"],
      ["Verfasser", entry.author]
    ].map(([label, value]) => `<div class="meta-item"><small>${label}</small>${escapeHtml(value || "—")}</div>`).join("");

    const maps = card.querySelector(".maps");
    maps.href = entry.mapsLink || makeMapsSearch(entry);
    const parking = card.querySelector(".parking");
    const parkingUrl = entry.parkingLink || makeParkingMapsSearch(entry);
    if (parkingUrl) parking.href = parkingUrl;
    else parking.classList.add("disabled");

    card.querySelector(".edit").addEventListener("click", () => openDialog(entry));
    list.appendChild(node);
  }
}

function renderDriversList() {
  const list = $("driversList");
  list.innerHTML = "";
  if (!drivers.length) {
    list.innerHTML = `<div class="empty-state"><strong>Noch keine Fahrer angelegt.</strong><br>Bitte Name und Handynummer erfassen.</div>`;
    return;
  }

  drivers
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .forEach(driver => {
      const item = document.createElement("div");
      item.className = "driver-list-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(driver.name)}</strong>
          <div class="hint compact">${escapeHtml(driver.phone)}</div>
        </div>
        <div class="driver-actions">
          <button type="button" class="ghost edit-driver">Bearbeiten</button>
          <button type="button" class="danger delete-driver">Löschen</button>
        </div>
      `;
      item.querySelector(".edit-driver").addEventListener("click", () => editDriver(driver.id));
      item.querySelector(".delete-driver").addEventListener("click", () => deleteDriver(driver.id));
      list.appendChild(item);
    });
}

function fullAddress(entry) {
  return [entry.address, [entry.postalCode, entry.cityName].filter(Boolean).join(" "), entry.country]
    .filter(Boolean).join(", ");
}

function makeMapsSearch(entry) {
  if (entry.gps) return makeGoogleMapsLinkFromGps(entry.gps);
  const query = encodeURIComponent([entry.name, fullAddress(entry)].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function makeParkingMapsSearch(entry) {
  if (entry.parkingGps) return makeGoogleMapsLinkFromGps(entry.parkingGps);
  if (!entry.parkingAddress) return "";
  const query = encodeURIComponent([entry.parkingAddress, entry.cityName, entry.country].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function makeGoogleMapsLinkFromGps(gpsString) {
  const coords = parseGps(gpsString);
  if (!coords) return "";
  return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lon}`;
}

function parseGps(gpsString) {
  const parts = String(gpsString).split(",").map(p => Number(p.trim()));
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return { lat: parts[0], lon: parts[1] };
}

function openDialog(entry = null) {
  $("entryForm").reset();
  $("addressStatus").textContent = "";
  $("voiceStatus").textContent = "Spracheingabe bereit.";
  $("entryId").value = entry?.id || "";
  $("dialogTitle").textContent = entry ? "Ziel bearbeiten" : "Neues Ziel erfassen";
  $("deleteBtn").style.visibility = entry ? "visible" : "hidden";
  currentPhotos = entry?.photos ? [...entry.photos] : [];

  fields.forEach(f => { if ($(f)) $(f).value = entry?.[f] || ""; });
  populateDriverDropdown(entry?.authorDriverId || "");

  if (!entry) {
    $("country").value = "Österreich";
    $("difficulty").value = "gruen";
    $("bookingType").value = "unbekannt";
    $("accessible").value = "unbekannt";
    $("accessRestriction").value = "keine_bekannt";
  }

  renderPhotoPreview();
  $("entryDialog").showModal();
}

function closeDialog() {
  stopSpeechInput();
  $("entryDialog").close();
}

function handleSubmit(event) {
  event.preventDefault();
  const authorDriverId = $("authorDriverId").value;
  if (!authorDriverId) {
    alert("Bitte einen Fahrer / Verfasser auswählen.");
    return;
  }

  const id = $("entryId").value || crypto.randomUUID();
  const data = { id, updatedAt: new Date().toISOString(), photos: currentPhotos, authorDriverId };
  fields.forEach(f => data[f] = $(f).value.trim());
  data.author = resolveAuthorFromDriverId(authorDriverId);

  if (!data.mapsLink) data.mapsLink = makeMapsSearch(data);
  if (!data.parkingLink) data.parkingLink = makeParkingMapsSearch(data);

  const index = entries.findIndex(e => e.id === id);
  if (index >= 0) entries[index] = data;
  else entries.push(data);

  saveEntries();
  closeDialog();
  renderEntries();
}

function deleteCurrent() {
  const id = $("entryId").value;
  if (!id) return;
  if (!confirm("Diesen Eintrag wirklich löschen?")) return;
  entries = entries.filter(e => e.id !== id);
  saveEntries();
  closeDialog();
  renderEntries();
}

function exportData() {
  const payload = { entries, drivers, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledermair-fahrer-info-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (Array.isArray(imported)) {
        entries = imported.map(e => normalizeEntry({ ...e, id: e.id || crypto.randomUUID() }));
      } else {
        if (Array.isArray(imported.entries)) {
          entries = imported.entries.map(e => normalizeEntry({ ...e, id: e.id || crypto.randomUUID() }));
        }
        if (Array.isArray(imported.drivers)) {
          drivers = imported.drivers.map(d => ({
            id: d.id || crypto.randomUUID(),
            name: d.name || "",
            phone: d.phone || "",
            updatedAt: d.updatedAt || new Date().toISOString()
          }));
          saveDrivers();
        }
      }
      saveEntries();
      populateDriverDropdown();
      renderDriversList();
      renderEntries();
      alert("Import abgeschlossen.");
    } catch (err) {
      alert("Import nicht möglich: " + err.message);
    }
  };
  reader.readAsText(file);
}

async function lookupCityFromPostalCode() {
  const postalCode = $("postalCode").value.trim();
  const country = $("country").value;
  const countryCode = countryCodeMap[country];
  const status = $("addressStatus");
  if (!postalCode || !countryCode) {
    status.textContent = "Bitte zuerst PLZ und ein unterstütztes Land auswählen.";
    return;
  }
  status.textContent = "Ort wird gesucht …";
  try {
    const response = await fetch(`https://api.zippopotam.us/${countryCode}/${encodeURIComponent(postalCode)}`);
    if (!response.ok) throw new Error("PLZ nicht gefunden");
    const data = await response.json();
    const place = data.places?.[0]?.["place name"];
    if (!place) throw new Error("Kein Ort gefunden");
    $("cityName").value = place;
    status.textContent = `Ort übernommen: ${place}. Bitte trotzdem kurz prüfen.`;
  } catch {
    status.textContent = "Ort konnte nicht automatisch ermittelt werden. Bitte manuell eintragen.";
  }
}

function getFormEntry() {
  const data = {};
  fields.forEach(f => data[f] = $(f).value.trim());
  data.photos = currentPhotos;
  data.authorDriverId = $("authorDriverId").value;
  data.author = resolveAuthorFromDriverId(data.authorDriverId);
  return data;
}

function buildAndSetMapsLink() {
  const temp = getFormEntry();
  const link = makeMapsSearch(temp);
  $("mapsLink").value = link;
  $("addressStatus").textContent = "Navi-Link wurde aus Adresse/GPS erzeugt. Bitte einmal prüfen.";
}

function buildAndSetParkingLink() {
  const temp = getFormEntry();
  const link = makeParkingMapsSearch(temp);
  if (!link) {
    $("addressStatus").textContent = "Für den Parkplatz fehlt noch GPS oder eine Parkplatzadresse.";
    return;
  }
  $("parkingLink").value = link;
  $("addressStatus").textContent = "Parkplatz-Link wurde aus Adresse/GPS erzeugt. Bitte einmal prüfen.";
}

function openAddressVerification() {
  buildAndSetMapsLink();
  window.open($("mapsLink").value, "_blank", "noopener");
}

function openParkingVerification() {
  buildAndSetParkingLink();
  if ($("parkingLink").value) window.open($("parkingLink").value, "_blank", "noopener");
}

function captureGps(targetInputId, targetLinkInputId) {
  const status = $("addressStatus");
  if (!navigator.geolocation) {
    status.textContent = "GPS-Erfassung wird von diesem Gerät oder Browser nicht unterstützt.";
    return;
  }
  status.textContent = "GPS wird erfasst … bitte Standortfreigabe erlauben.";
  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude.toFixed(6);
      const lon = position.coords.longitude.toFixed(6);
      const gps = `${lat}, ${lon}`;
      $(targetInputId).value = gps;
      $(targetLinkInputId).value = makeGoogleMapsLinkFromGps(gps);
      status.textContent = `GPS übernommen: ${gps}. Der Google-Maps-Link wurde erzeugt.`;
    },
    () => { status.textContent = "GPS konnte nicht erfasst werden. Standortfreigabe prüfen oder Adresse manuell erfassen."; },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

async function handlePhotoInput(event) {
  const files = [...event.target.files];
  if (files.length === 0) return;
  $("addressStatus").textContent = "Fotos werden verarbeitet …";
  try {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await resizeImageToDataUrl(file, 1400, 0.78);
      currentPhotos.push({ id: crypto.randomUUID(), name: file.name, dataUrl, addedAt: new Date().toISOString() });
    }
    renderPhotoPreview();
    $("addressStatus").textContent = "Fotos wurden hinzugefügt. Bitte Eintrag speichern.";
  } catch {
    $("addressStatus").textContent = "Foto konnte nicht verarbeitet werden.";
  } finally {
    event.target.value = "";
  }
}

function resizeImageToDataUrl(file, maxSide = 1400, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview() {
  const preview = $("photoPreview");
  if (!preview) return;
  if (currentPhotos.length === 0) {
    preview.innerHTML = `<div class="empty-photos">Noch keine Fotos hinterlegt.</div>`;
    return;
  }
  preview.innerHTML = "";
  currentPhotos.forEach((photo, index) => {
    const item = document.createElement("div");
    item.className = "photo-preview-item";
    item.innerHTML = `
      <button type="button" class="preview-image" aria-label="Foto vergrößern">
        <img src="${photo.dataUrl}" alt="${escapeHtml(photo.name || "Foto")}" />
      </button>
      <div class="photo-preview-actions">
        <span>${index === 0 ? "Thumbnail" : `Foto ${index + 1}`}</span>
        <button type="button" class="remove-photo">Entfernen</button>
      </div>
    `;
    item.querySelector(".preview-image").addEventListener("click", () => openPhotoDialog(photo, $("name").value || "Foto"));
    item.querySelector(".remove-photo").addEventListener("click", () => {
      currentPhotos = currentPhotos.filter(p => p.id !== photo.id);
      renderPhotoPreview();
    });
    preview.appendChild(item);
  });
}

function openPhotoDialog(photo, title) {
  $("photoDialogTitle").textContent = title || "Foto";
  $("photoDialogImg").src = photo.dataUrl;
  $("photoDialogCaption").textContent = photo.name || "";
  $("photoDialog").showModal();
}

function closePhotoDialog() {
  $("photoDialog").close();
  $("photoDialogImg").removeAttribute("src");
}

function clearPhotos() {
  if (!currentPhotos.length) return;
  if (!confirm("Alle Fotos aus diesem Eintrag entfernen?")) return;
  currentPhotos = [];
  renderPhotoPreview();
}

function openDriversDialog() {
  resetDriverForm();
  renderDriversList();
  $("driversDialog").showModal();
}

function closeDriversDialog() {
  $("driversDialog").close();
}

function resetDriverForm() {
  $("driverId").value = "";
  $("driverName").value = "";
  $("driverPhone").value = "";
}

function saveDriverFromForm() {
  const id = $("driverId").value || crypto.randomUUID();
  const name = $("driverName").value.trim();
  const phone = $("driverPhone").value.trim();
  if (!name || !phone) {
    alert("Bitte Name und Handynummer erfassen.");
    return;
  }
  const record = { id, name, phone, updatedAt: new Date().toISOString() };
  const existingIndex = drivers.findIndex(d => d.id === id);
  if (existingIndex >= 0) drivers[existingIndex] = record;
  else drivers.push(record);
  saveDrivers();

  entries = entries.map(entry => entry.authorDriverId === id ? { ...entry, author: `${name} (${phone})` } : entry);
  saveEntries();

  populateDriverDropdown($("authorDriverId").value || id);
  renderDriversList();
  renderEntries();
  resetDriverForm();
}

function editDriver(id) {
  const driver = drivers.find(d => d.id === id);
  if (!driver) return;
  $("driverId").value = driver.id;
  $("driverName").value = driver.name;
  $("driverPhone").value = driver.phone;
}

function deleteDriver(id) {
  const driver = drivers.find(d => d.id === id);
  if (!driver) return;
  const inUse = entries.some(entry => entry.authorDriverId === id);
  if (inUse) {
    alert("Dieser Fahrer ist noch in Einträgen hinterlegt und kann aktuell nicht gelöscht werden.");
    return;
  }
  if (!confirm(`Fahrer ${driver.name} wirklich löschen?`)) return;
  drivers = drivers.filter(d => d.id !== id);
  saveDrivers();
  populateDriverDropdown();
  renderDriversList();
}

function startSpeechInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("voiceStatus").textContent = "Spracheingabe wird von diesem Browser nicht unterstützt.";
    return;
  }
  if (isRecording) {
    stopSpeechInput();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "de-DE";
  recognition.interimResults = true;
  recognition.continuous = true;
  let finalTranscript = "";
  isRecording = true;
  $("voiceDriverNotesBtn").textContent = "■ Spracheingabe stoppen";
  $("voiceStatus").textContent = "Spracheingabe läuft …";

  recognition.onresult = (event) => {
    let interimTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += transcript + " ";
      else interimTranscript += transcript;
    }
    const textarea = $("driverNotes");
    const base = textarea.dataset.baseValue ?? textarea.value;
    textarea.dataset.baseValue = base;
    textarea.value = `${base}${base && !base.endsWith(" ") ? " " : ""}${finalTranscript}${interimTranscript}`.trim();
  };

  recognition.onerror = () => {
    $("voiceStatus").textContent = "Spracheingabe fehlgeschlagen oder abgebrochen.";
    stopSpeechInput(false);
  };

  recognition.onend = () => {
    const textarea = $("driverNotes");
    delete textarea.dataset.baseValue;
    stopSpeechInput(false);
  };

  recognition.start();
}

function stopSpeechInput(stopRecognition = true) {
  if (recognition && stopRecognition) {
    try { recognition.stop(); } catch {}
  }
  isRecording = false;
  $("voiceDriverNotesBtn").textContent = "🎤 Spracheingabe starten";
  if ($("voiceStatus").textContent === "Spracheingabe läuft …") {
    $("voiceStatus").textContent = "Spracheingabe beendet.";
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

// Event wiring
$("newEntryBtn").addEventListener("click", () => openDialog());
$("closeDialogBtn").addEventListener("click", closeDialog);
$("entryForm").addEventListener("submit", handleSubmit);
$("deleteBtn").addEventListener("click", deleteCurrent);
$("searchInput").addEventListener("input", renderEntries);
$("categoryFilter").addEventListener("change", renderEntries);
$("difficultyFilter").addEventListener("change", renderEntries);
$("exportBtn").addEventListener("click", exportData);
$("importInput").addEventListener("change", (e) => e.target.files?.[0] && importData(e.target.files[0]));
$("lookupZipBtn").addEventListener("click", lookupCityFromPostalCode);
$("makeMapsLinkBtn").addEventListener("click", buildAndSetMapsLink);
$("captureGpsBtn").addEventListener("click", () => captureGps("gps", "mapsLink"));
$("verifyAddressBtn").addEventListener("click", openAddressVerification);
$("makeParkingLinkBtn").addEventListener("click", buildAndSetParkingLink);
$("captureParkingGpsBtn").addEventListener("click", () => captureGps("parkingGps", "parkingLink"));
$("verifyParkingBtn").addEventListener("click", openParkingVerification);
$("photoInput").addEventListener("change", handlePhotoInput);
$("clearPhotosBtn").addEventListener("click", clearPhotos);
$("closePhotoDialogBtn").addEventListener("click", closePhotoDialog);
$("driversBtn").addEventListener("click", openDriversDialog);
$("closeDriversDialogBtn").addEventListener("click", closeDriversDialog);
$("saveDriverBtn").addEventListener("click", saveDriverFromForm);
$("resetDriverBtn").addEventListener("click", resetDriverForm);
$("authorDriverId").addEventListener("change", updateSelectedDriverInfo);
$("voiceDriverNotesBtn").addEventListener("click", startSpeechInput);
document.querySelectorAll(".quick-actions button[data-category]").forEach(button => {
  button.addEventListener("click", () => {
    $("categoryFilter").value = button.dataset.category;
    renderEntries();
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

populateDriverDropdown();
renderDriversList();
renderEntries();
