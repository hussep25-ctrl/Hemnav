const defaultServices = [
  { id: "google", name: "Google Home", status: "Ansluten", connected: true },
  { id: "illumihome", name: "Illumihome", status: "Ansluten", connected: true },
  { id: "matter", name: "Matter", status: "Redo", connected: true },
  { id: "hue", name: "Philips Hue", status: "Ej ansluten", connected: false },
];

const defaultDevices = [
  { id: 1, name: "Kökslampa", type: "Lampa", room: "Kök", service: "Google Home", online: true, on: true },
  { id: 2, name: "Hallrörelse", type: "Sensor", room: "Hall", service: "Illumihome", online: true, on: true },
  { id: 3, name: "Vardagsrum", type: "Termostat", room: "Vardagsrum", service: "Matter", online: true, on: false },
  { id: 4, name: "Sovrumshögtalare", type: "Högtalare", room: "Sovrum", service: "Google Home", online: false, on: false },
];

const defaultFlows = [
  { trigger: "Hallrörelse upptäcker rörelse", action: "Tänd Kökslampa" },
  { trigger: "Borta aktiveras", action: "Sänk Vardagsrum" },
  { trigger: "Natt aktiveras", action: "Stäng av Sovrumshögtalare" },
];

const defaultActivities = [
  ["Kökslampa tändes", "Nyss"],
  ["Illumihome synkades", "08:42"],
  ["Matter hittade termostat", "Igår"],
  ["Google Home anslöts", "Igår"],
];

const storageKey = "hemnav-state-v1";
const savedState = JSON.parse(localStorage.getItem(storageKey) || "null");

const services = savedState?.services || defaultServices;
const devices = savedState?.devices || defaultDevices;
const flows = savedState?.flows || defaultFlows;
const activities = savedState?.activities || defaultActivities;
const settings = savedState?.settings || {
  googleBridgeUrl: "",
  apiBaseUrl: "http://127.0.0.1:8788",
  pcMacAddress: "",
  samsungTvIp: "",
};

const serviceGrid = document.querySelector("#serviceGrid");
const deviceGrid = document.querySelector("#deviceGrid");
const quickDevices = document.querySelector("#quickDevices");
const flowList = document.querySelector("#flowList");
const triggerSelect = document.querySelector("#triggerSelect");
const actionSelect = document.querySelector("#actionSelect");
const newDeviceService = document.querySelector("#newDeviceService");
const deviceSearch = document.querySelector("#deviceSearch");
const dialog = document.querySelector("#deviceDialog");
const googleBridgeUrl = document.querySelector("#googleBridgeUrl");
const apiBaseUrl = document.querySelector("#apiBaseUrl");
const pcMacAddress = document.querySelector("#pcMacAddress");
const samsungTvIp = document.querySelector("#samsungTvIp");
const integrationStatus = document.querySelector("#integrationStatus");
const apiStatusCard = document.querySelector("#apiStatusCard");
const apiStatusTitle = document.querySelector("#apiStatusTitle");
const apiStatusText = document.querySelector("#apiStatusText");

googleBridgeUrl.value = settings.googleBridgeUrl || "";
apiBaseUrl.value = settings.apiBaseUrl || "http://127.0.0.1:8788";
pcMacAddress.value = settings.pcMacAddress || "";
samsungTvIp.value = settings.samsungTvIp || "";

function renderCounts() {
  document.querySelector("#deviceCount").textContent = devices.length;
  document.querySelector("#onlineCount").textContent = devices.filter((device) => device.online).length;
  document.querySelector("#serviceCount").textContent = services.filter((service) => service.connected).length;
  document.querySelector("#flowCount").textContent = flows.length;
}

function saveState() {
  settings.googleBridgeUrl = googleBridgeUrl.value.trim();
  settings.apiBaseUrl = apiBaseUrl.value.trim() || "http://127.0.0.1:8788";
  settings.pcMacAddress = pcMacAddress.value.trim();
  settings.samsungTvIp = samsungTvIp.value.trim();
  localStorage.setItem(storageKey, JSON.stringify({ services, devices, flows, activities, settings }));
}

function setIntegrationStatus(message, tone = "info") {
  integrationStatus.textContent = message;
  integrationStatus.dataset.tone = tone;
}

function setApiStatus(isOnline, title, text) {
  apiStatusCard.classList.toggle("online", isOnline);
  apiStatusCard.classList.toggle("offline", !isOnline);
  apiStatusCard.querySelector(".status-dot").classList.toggle("online", isOnline);
  apiStatusTitle.textContent = title;
  apiStatusText.textContent = text;
}

function normalizeImportedDevice(device, sourceName) {
  return {
    id: device.id || `${sourceName}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: device.name || device.customName || device.roomHint || "Namnlös enhet",
    type: device.type || device.deviceType || "Enhet",
    room: device.room || device.roomHint || device.structure || "Google Home",
    service: sourceName,
    online: device.online ?? device.isOnline ?? true,
    on: device.on ?? device.state?.on ?? false,
  };
}

function upsertImportedDevices(importedDevices, sourceName) {
  let added = 0;
  let updated = 0;

  importedDevices.map((device) => normalizeImportedDevice(device, sourceName)).forEach((device) => {
    const existingIndex = devices.findIndex((item) => item.id === device.id || (item.name === device.name && item.service === sourceName));
    if (existingIndex >= 0) {
      devices[existingIndex] = { ...devices[existingIndex], ...device };
      updated += 1;
    } else {
      devices.unshift(device);
      added += 1;
    }
  });

  const service = services.find((item) => item.name === sourceName);
  if (service) {
    service.connected = true;
    service.status = "Ansluten";
  }

  activities.unshift([`${sourceName} importerade ${added + updated} enheter`, "Nyss"]);
  saveState();
  renderAll();
  return { added, updated };
}

async function importGoogleHomeDevices() {
  const bridgeUrl = googleBridgeUrl.value.trim().replace(/\/$/, "");
  saveState();

  if (!bridgeUrl) {
    setIntegrationStatus(
      "Google Home kräver en Android/iOS-brygga med Home APIs. Fyll i bryggans adress när den körs, t.ex. http://mobilens-ip:8787.",
      "warning",
    );
    return;
  }

  setIntegrationStatus("Kontaktar Google Home-bryggan...");
  try {
    const response = await fetch(`${bridgeUrl}/google-home/devices`, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Bridge svarade ${response.status}`);
    }
    const data = await response.json();
    const imported = Array.isArray(data) ? data : data.devices;
    if (!Array.isArray(imported)) {
      throw new Error("Svaret saknar devices-lista");
    }
    const result = upsertImportedDevices(imported, "Google Home");
    setIntegrationStatus(`Google Home klart: ${result.added} nya, ${result.updated} uppdaterade.`, "success");
  } catch (error) {
    setIntegrationStatus(
      `Kunde inte hämta från bryggan. Kontrollera adressen och att mobilen/appen har Google Home-tillstånd. (${error.message})`,
      "warning",
    );
  }
}

async function connectIllumiHomeBluetooth() {
  if (!navigator.bluetooth) {
    setIntegrationStatus(
      "Bluetooth direkt i webbläsaren stöds inte här. Testa Chrome/Edge på dator eller Android, via localhost eller HTTPS.",
      "warning",
    );
    return;
  }

  try {
    setIntegrationStatus("Välj din IllumiHome-enhet i Bluetooth-rutan...");
    const bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["battery_service"],
    });
    upsertImportedDevices(
      [
        {
          id: bluetoothDevice.id,
          name: bluetoothDevice.name || "IllumiHome LED",
          type: "LED-list",
          room: "Bluetooth",
          online: true,
          on: false,
        },
      ],
      "Illumihome",
    );
    setIntegrationStatus("IllumiHome hittades och lades till. Styrning kräver rätt Bluetooth-protokoll från tillverkaren.", "success");
  } catch (error) {
    setIntegrationStatus(`Bluetooth-kopplingen avbröts eller misslyckades. (${error.message})`, "warning");
  }
}

async function callLocalApi(path, body = {}) {
  saveState();
  const baseUrl = apiBaseUrl.value.trim().replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Fyll i Hemnav API-adress först");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `API svarade ${response.status}`);
  }
  return data;
}

async function checkApiStatus() {
  saveState();
  const baseUrl = apiBaseUrl.value.trim().replace(/\/$/, "");
  if (!baseUrl) {
    setApiStatus(false, "API-adress saknas", "Fyll i adressen till din lokala Hemnav API-server.");
    return;
  }

  setApiStatus(false, "Kontrollerar API...", baseUrl);
  try {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Status ${response.status}`);
    }
    setApiStatus(true, "API online", `${data.name || "Hemnav API"} svarar på ${baseUrl}`);
  } catch (error) {
    setApiStatus(false, "API offline", "Starta api-server.js hemma eller kontrollera adressen.");
  }
}

async function wakePc() {
  try {
    const mac = pcMacAddress.value.trim();
    if (!mac) {
      setIntegrationStatus("Fyll i PC:ns MAC-adress först.", "warning");
      return;
    }
    await callLocalApi("/api/pc/wake", { mac });
    setIntegrationStatus("Wake-on-LAN skickat till PC.", "success");
  } catch (error) {
    setIntegrationStatus(`Kunde inte starta PC. ${error.message}`, "warning");
  }
}

async function sendSamsungKey(key) {
  try {
    const host = samsungTvIp.value.trim();
    if (!host) {
      setIntegrationStatus("Fyll i Samsung TV-IP först.", "warning");
      return;
    }
    const result = await callLocalApi("/api/samsung/key", { host, key });
    setIntegrationStatus(result.message || `Skickade ${key} till Samsung TV.`, "success");
  } catch (error) {
    setIntegrationStatus(`Samsung TV svarade inte. ${error.message}`, "warning");
  }
}

async function openPsRemotePlay() {
  try {
    await callLocalApi("/api/ps5/remote-play", {});
    setIntegrationStatus("Försökte öppna PS Remote Play på datorn.", "success");
  } catch (error) {
    setIntegrationStatus(`Kunde inte öppna PS Remote Play. ${error.message}`, "warning");
  }
}

function showAirPlayInfo() {
  setIntegrationStatus(
    "AirPlay till Apple TV/Samsung TV startas från iPhone/macOS kontrollcenter eller videospelarens AirPlay-knapp. Hemnav kan inte själv spegla skärmen från en webbsida.",
    "warning",
  );
}

function renderDevices(target, list) {
  target.innerHTML = "";
  list.forEach((device) => {
    const card = document.createElement("article");
    card.className = "device-card";
    card.innerHTML = `
      <header>
        <div>
          <h3>${device.name}</h3>
          <span>${device.type} · ${device.room}</span>
        </div>
        <i class="status-dot ${device.online ? "online" : ""}" title="${device.online ? "Online" : "Offline"}"></i>
      </header>
      <footer>
        <span>${device.service}</span>
        <button class="toggle ${device.on ? "on" : ""}" type="button" aria-label="Växla ${device.name}">
          <span></span>
        </button>
      </footer>
    `;
    card.querySelector(".toggle").addEventListener("click", () => {
      device.on = !device.on;
      saveState();
      renderAll();
    });
    target.append(card);
  });
}

function renderServices() {
  serviceGrid.innerHTML = "";
  services.forEach((service) => {
    const card = document.createElement("article");
    card.className = `service-card ${service.connected ? "connected" : ""}`;
    card.innerHTML = `
      <header>
        <div>
          <h3>${service.name}</h3>
          <span>${service.status}</span>
        </div>
        <i class="status-dot ${service.connected ? "online" : ""}"></i>
      </header>
      <footer>
        <span>${devices.filter((device) => device.service === service.name).length} enheter</span>
        <button class="secondary-btn" type="button">${service.connected ? "Hantera" : "Anslut"}</button>
      </footer>
    `;
    card.querySelector("button").addEventListener("click", () => {
      if (service.name === "Google Home") {
        importGoogleHomeDevices();
        return;
      }
      if (service.name === "Illumihome") {
        connectIllumiHomeBluetooth();
        return;
      }
      service.connected = true;
      service.status = "Ansluten";
      saveState();
      renderAll();
    });
    serviceGrid.append(card);
  });
}

function renderFlows() {
  flowList.innerHTML = "";
  flows.forEach((flow) => {
    const item = document.createElement("article");
    item.className = "flow-item";
    item.innerHTML = `
      <strong>${flow.trigger}</strong>
      <span>${flow.action}</span>
    `;
    flowList.append(item);
  });
}

function renderSelectors() {
  const triggers = devices.map((device) => `${device.name} ändras`);
  const actions = devices.map((device) => `${device.on ? "Stäng av" : "Tänd"} ${device.name}`);

  triggerSelect.innerHTML = triggers.map((trigger) => `<option>${trigger}</option>`).join("");
  actionSelect.innerHTML = actions.map((action) => `<option>${action}</option>`).join("");
  newDeviceService.innerHTML = services.map((service) => `<option>${service.name}</option>`).join("");
}

function renderActivity() {
  const list = document.querySelector("#activityList");
  list.innerHTML = "";
  activities.forEach(([label, time]) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${label}</strong><span>${time}</span>`;
    list.append(item);
  });
}

function renderAll() {
  const query = deviceSearch.value.trim().toLowerCase();
  const filtered = devices.filter((device) =>
    `${device.name} ${device.type} ${device.room} ${device.service}`.toLowerCase().includes(query),
  );

  renderCounts();
  renderDevices(deviceGrid, filtered);
  renderDevices(quickDevices, devices.slice(0, 3));
  renderServices();
  renderFlows();
  renderSelectors();
  renderActivity();
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
    history.replaceState(null, "", `#${button.dataset.view}`);
  });
});

function showView(viewId) {
  const nextView = document.querySelector(`#${viewId}`);
  const nextButton = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (!nextView || !nextButton) {
    return;
  }

  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  nextButton.classList.add("active");
  nextView.classList.add("active");
}

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segmented button").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
  });
});

document.querySelector("#saveFlowBtn").addEventListener("click", () => {
  flows.unshift({ trigger: triggerSelect.value, action: actionSelect.value });
  activities.unshift(["Ny koppling sparades", "Nyss"]);
  saveState();
  renderAll();
});

document.querySelector("#syncBtn").addEventListener("click", () => {
  activities.unshift(["Alla tjänster synkades", "Nyss"]);
  saveState();
  renderAll();
});

document.querySelector("#importGoogleBtn").addEventListener("click", importGoogleHomeDevices);
document.querySelector("#connectIllumiBtn").addEventListener("click", connectIllumiHomeBluetooth);
document.querySelector("#checkApiBtn").addEventListener("click", checkApiStatus);
document.querySelector("#wakePcBtn").addEventListener("click", wakePc);
document.querySelector("#openPsRemoteBtn").addEventListener("click", openPsRemotePlay);
document.querySelector("#airplayInfoBtn").addEventListener("click", showAirPlayInfo);
document.querySelectorAll("[data-samsung-key]").forEach((button) => {
  button.addEventListener("click", () => sendSamsungKey(button.dataset.samsungKey));
});
[googleBridgeUrl, apiBaseUrl, pcMacAddress, samsungTvIp].forEach((input) => input.addEventListener("change", saveState));

document.querySelector("#addDeviceBtn").addEventListener("click", () => {
  dialog.showModal();
  document.querySelector("#newDeviceName").focus();
});

document.querySelector("#confirmAddDevice").addEventListener("click", (event) => {
  const nameInput = document.querySelector("#newDeviceName");
  const name = nameInput.value.trim();
  if (!name) {
    event.preventDefault();
    nameInput.focus();
    return;
  }

  devices.unshift({
    id: Date.now(),
    name,
    type: document.querySelector("#newDeviceType").value,
    room: "Nytt rum",
    service: newDeviceService.value,
    online: true,
    on: false,
  });
  activities.unshift([`${name} lades till`, "Nyss"]);
  nameInput.value = "";
  saveState();
  renderAll();
});

deviceSearch.addEventListener("input", renderAll);

window.addEventListener("hashchange", () => {
  showView(location.hash.replace("#", "") || "overview");
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

renderAll();
showView(location.hash.replace("#", "") || "overview");
checkApiStatus();
