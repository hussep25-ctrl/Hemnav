const defaultServices = [
  { id: "home-assistant", name: "Home Assistant", status: "Tuya/Deltaco/Helo", connected: false },
  { id: "deltaco", name: "Deltaco Smart Home", status: "Via Home Assistant", connected: false },
  { id: "helo", name: "Helo by Strong", status: "Via Home Assistant", connected: false },
  { id: "illumihome", name: "Illumihome", status: "Ansluten", connected: true },
  { id: "matter", name: "Matter", status: "Redo", connected: true },
];

const defaultDevices = [
  { id: 1, name: "Deltaco lampa", type: "Lampa", room: "Kök", service: "Home Assistant", online: true, on: true, color: "#ffd17e", brightness: 82 },
  { id: 2, name: "Hallrörelse", type: "Sensor", room: "Hall", service: "Illumihome", online: true, on: true },
  { id: 3, name: "Vardagsrum", type: "Termostat", room: "Vardagsrum", service: "Matter", online: true, on: false },
  { id: 4, name: "Helo plug", type: "Kontakt", room: "Sovrum", service: "Home Assistant", online: true, on: false },
];

const defaultFlows = [
  { trigger: "Hallrörelse upptäcker rörelse", action: "Tänd Kökslampa" },
  { trigger: "Borta aktiveras", action: "Sänk Vardagsrum" },
  { trigger: "Natt aktiveras", action: "Stäng av Sovrumshögtalare" },
];

const defaultActivities = [
  ["Deltaco lampa tändes", "Nyss"],
  ["Illumihome synkades", "08:42"],
  ["Matter hittade termostat", "Igår"],
  ["Home Assistant redo för Tuya", "Igår"],
];

const storageKey = "hemnav-state-v1";
const savedState = JSON.parse(localStorage.getItem(storageKey) || "null");

const services = savedState?.services || defaultServices;
const devices = savedState?.devices || defaultDevices;
const flows = savedState?.flows || defaultFlows;
const activities = savedState?.activities || defaultActivities;
const settings = savedState?.settings || {
  homeAssistantUrl: "",
  homeAssistantToken: "",
  apiBaseUrl: "http://127.0.0.1:8788",
  pcMacAddress: "",
  samsungTvIp: "192.168.50.247",
  samsungTvMac: "",
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
const homeAssistantUrl = document.querySelector("#homeAssistantUrl");
const homeAssistantToken = document.querySelector("#homeAssistantToken");
const apiBaseUrl = document.querySelector("#apiBaseUrl");
const pcMacAddress = document.querySelector("#pcMacAddress");
const samsungTvIp = document.querySelector("#samsungTvIp");
const samsungTvMac = document.querySelector("#samsungTvMac");
const integrationStatus = document.querySelector("#integrationStatus");
const apiStatusCard = document.querySelector("#apiStatusCard");
const apiStatusTitle = document.querySelector("#apiStatusTitle");
const apiStatusText = document.querySelector("#apiStatusText");
const lightUpdateTimers = new Map();

homeAssistantUrl.value = settings.homeAssistantUrl || "";
homeAssistantToken.value = settings.homeAssistantToken || "";
apiBaseUrl.value = settings.apiBaseUrl || "http://127.0.0.1:8788";
pcMacAddress.value = settings.pcMacAddress || "";
samsungTvIp.value = settings.samsungTvIp || "192.168.50.247";
samsungTvMac.value = settings.samsungTvMac || "";

function renderCounts() {
  document.querySelector("#deviceCount").textContent = devices.length;
  document.querySelector("#onlineCount").textContent = devices.filter((device) => device.online).length;
  document.querySelector("#serviceCount").textContent = services.filter((service) => service.connected).length;
  document.querySelector("#flowCount").textContent = flows.length;
}

function saveState() {
  settings.homeAssistantUrl = homeAssistantUrl.value.trim();
  settings.homeAssistantToken = homeAssistantToken.value.trim();
  settings.apiBaseUrl = apiBaseUrl.value.trim() || "http://127.0.0.1:8788";
  settings.pcMacAddress = pcMacAddress.value.trim();
  settings.samsungTvIp = samsungTvIp.value.trim();
  settings.samsungTvMac = samsungTvMac.value.trim();
  localStorage.setItem(storageKey, JSON.stringify({ services, devices, flows, activities, settings }));
}

if (!services.some((service) => service.name === "Home Assistant")) {
  services.unshift({ id: "home-assistant", name: "Home Assistant", status: "Tuya/Deltaco/Helo", connected: false });
}
for (let index = services.length - 1; index >= 0; index -= 1) {
  if (services[index].name === "Google Home") {
    services.splice(index, 1);
  }
}
if (devices.some((device) => device.service === "Google Home") && !services.some((service) => service.name === "Manuell")) {
  services.push({ id: "manual", name: "Manuell", status: "Lokal kontroll", connected: true });
}
devices.forEach((device) => {
  if (device.service === "Google Home") {
    device.service = "Manuell";
  }
});

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
    room: device.room || device.roomHint || device.structure || "Home Assistant",
    service: sourceName,
    online: device.online ?? device.isOnline ?? true,
    on: device.on ?? device.state?.on ?? false,
    color: device.color || device.state?.color || (isLightDevice(device) ? "#ffd17e" : undefined),
    brightness: device.brightness ?? device.state?.brightness ?? (isLightDevice(device) ? 80 : undefined),
    entityId: device.entityId,
  };
}

function isLightDevice(device) {
  return /lampa|lamp|light|led|bulb|list/i.test(`${device.type || ""} ${device.name || ""}`);
}

function canShowLightControls(device) {
  return isLightDevice(device) && device.service !== "Illumihome";
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

function removeDevice(deviceId) {
  const index = devices.findIndex((device) => String(device.id) === String(deviceId));
  if (index < 0) {
    return;
  }
  const [removed] = devices.splice(index, 1);
  activities.unshift([`${removed.name} togs bort`, "Nyss"]);
  saveState();
  renderAll();
}

async function importHomeAssistantDevices() {
  saveState();
  try {
    setIntegrationStatus("Hämtar Deltaco/Helo från Home Assistant...");
    const data = await callLocalApi("/api/home-assistant/devices", {
      baseUrl: homeAssistantUrl.value.trim(),
      token: homeAssistantToken.value.trim(),
    });
    const result = upsertImportedDevices(data.devices || [], "Home Assistant");
    const service = services.find((item) => item.name === "Home Assistant");
    if (service) {
      service.connected = true;
      service.status = "Ansluten";
    }
    setIntegrationStatus(`Home Assistant klart: ${result.added} nya, ${result.updated} uppdaterade.`, "success");
  } catch (error) {
    setIntegrationStatus(`Kunde inte hämta från Home Assistant. ${error.message}`, "warning");
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
          color: "#7ee0ce",
          brightness: 80,
        },
      ],
      "Illumihome",
    );
    setIntegrationStatus("IllumiHome hittades och lades till. Styrning kräver rätt Bluetooth-protokoll från tillverkaren.", "success");
  } catch (error) {
    setIntegrationStatus(`Bluetooth-kopplingen avbröts eller misslyckades. (${error.message})`, "warning");
  }
}

async function inspectIllumiHomeBluetooth() {
  if (!navigator.bluetooth) {
    setIntegrationStatus("BLE-inspektören kräver Chrome/Edge med Web Bluetooth.", "warning");
    return;
  }

  try {
    setIntegrationStatus("Välj IllumiHome-enheten igen för BLE-inspektion...");
    const bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["battery_service", "device_information"],
    });
    const server = await bluetoothDevice.gatt.connect();
    const foundServices = await server.getPrimaryServices();
    const names = foundServices.map((service) => service.uuid).join(", ");
    setIntegrationStatus(
      names ? `BLE services för ${bluetoothDevice.name || "IllumiHome"}: ${names}` : "Chrome gav ingen service-lista. Vi behöver IllumiHomes privata service-UUID.",
      names ? "success" : "warning",
    );
  } catch (error) {
    setIntegrationStatus(`BLE-inspektion misslyckades. ${error.message}`, "warning");
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

async function wakeTv() {
  try {
    const mac = samsungTvMac.value.trim();
    if (!mac) {
      setIntegrationStatus("Fyll i TV:ns MAC-adress först. Den finns i TV:ns nätverksinformation eller i routern.", "warning");
      return;
    }
    await callLocalApi("/api/pc/wake", { mac });
    setIntegrationStatus("Wake-on-LAN skickat till Samsung TV.", "success");
  } catch (error) {
    setIntegrationStatus(`Kunde inte väcka TV:n. ${error.message}`, "warning");
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

async function toggleHomeAssistantDevice(device, nextState) {
  await callLocalApi("/api/home-assistant/toggle", {
    baseUrl: homeAssistantUrl.value.trim(),
    token: homeAssistantToken.value.trim(),
    entityId: device.entityId || device.id,
    on: nextState,
  });
}

function scheduleHomeAssistantLightUpdate(device) {
  const entityId = device.entityId || device.id;
  clearTimeout(lightUpdateTimers.get(entityId));
  lightUpdateTimers.set(
    entityId,
    setTimeout(() => {
      callLocalApi("/api/home-assistant/light", {
        baseUrl: homeAssistantUrl.value.trim(),
        token: homeAssistantToken.value.trim(),
        entityId,
        color: device.color,
        brightness: device.brightness,
      })
        .then(() => setIntegrationStatus(`${device.name} uppdaterad via Home Assistant.`, "success"))
        .catch((error) => setIntegrationStatus(`Home Assistant kunde inte ändra ${device.name}. ${error.message}`, "warning"));
    }, 350),
  );
}

async function openPsRemotePlay() {
  try {
    await callLocalApi("/api/ps5/remote-play", {});
    setIntegrationStatus("Försökte öppna PS Remote Play på datorn.", "success");
  } catch (error) {
    setIntegrationStatus(`Kunde inte öppna PS Remote Play. ${error.message}`, "warning");
  }
}

async function sendPsKey(key) {
  try {
    const result = await callLocalApi("/api/ps5/key", { key });
    setIntegrationStatus(result.message || `Skickade PS-knapp: ${key}`, "success");
  } catch (error) {
    setIntegrationStatus(`Kunde inte styra PS Remote Play. ${error.message}`, "warning");
  }
}

function showAirPlayInfo() {
  setIntegrationStatus(
    "AirPlay till Apple TV/Samsung TV startas från iPhone/macOS kontrollcenter eller videospelarens AirPlay-knapp. Hemnav kan inte själv spegla skärmen från en webbsida.",
    "warning",
  );
}

function showTuyaHelp() {
  setIntegrationStatus(
    "Deltaco Smart Home och Helo by Strong brukar gå via Tuya/Smart Life. Lägg dem i Tuya eller Smart Life, koppla Tuya i Home Assistant, skapa en långlivad token i Home Assistant och tryck sedan Hämta Deltaco/Helo.",
    "info",
  );
}

function showSamsungHelp() {
  setIntegrationStatus(
    "Samsung UE58TU7175UXXC är en 2020 Tizen-TV. Koppla TV:n till samma Wi-Fi, ge den fast IP i routern, öppna SmartThings på mobilen och godkänn Hemnav när TV:n visar parkopplingsruta. Testa port 8001 först, 8002 används ofta för säker WebSocket.",
    "info",
  );
}

function showIllumiHelp() {
  setIntegrationStatus(
    "IllumiHome via dator kräver Chrome/Edge, Bluetooth påslaget, Chrome tillåtet i macOS Bluetooth-integritet och att IllumiHome-appen inte redan håller lampan ansluten. Webben kan hitta DMRRBA-enheten, men färg/ljusstyrka kräver IllumiHomes privata BLE-protokoll.",
    "warning",
  );
}

function renderDevices(target, list) {
  target.innerHTML = "";
  list.forEach((device) => {
    const canColor = canShowLightControls(device);
    const card = document.createElement("article");
    card.className = "device-card";
    card.innerHTML = `
      <header>
        <div>
          <h3>${device.name}</h3>
          <span>${device.type} · ${device.room}</span>
        </div>
        <button class="delete-device" type="button" aria-label="Ta bort ${device.name}">×</button>
      </header>
      <footer>
        <span>${device.service}</span>
        <button class="toggle ${device.on ? "on" : ""}" type="button" aria-label="Växla ${device.name}">
          <span></span>
        </button>
      </footer>
      ${
        canColor
          ? `<div class="light-controls">
              <label>
                Färg
                <input class="color-input" type="color" value="${device.color || "#ffd17e"}" aria-label="Färg för ${device.name}" />
              </label>
              <label>
                Ljus
                <input class="brightness-input" type="range" min="1" max="100" value="${device.brightness || 80}" aria-label="Ljusstyrka för ${device.name}" />
              </label>
            </div>`
          : ""
      }
    `;
    const toggleDevice = () => {
      const nextState = !device.on;
      if (device.service === "Home Assistant") {
        toggleHomeAssistantDevice(device, nextState)
          .then(() => setIntegrationStatus(`${device.name} ${nextState ? "på" : "av"} via Home Assistant.`, "success"))
          .catch((error) => setIntegrationStatus(`Home Assistant kunde inte styra ${device.name}. ${error.message}`, "warning"));
      }
      if (device.service === "Illumihome") {
        setIntegrationStatus("IllumiHome är hittad via Bluetooth, men riktig av/på/färg kräver BLE-protokollet. Använd Inspektera IllumiHome BLE som nästa steg.", "warning");
      }
      device.on = !device.on;
      saveState();
      renderAll();
    };
    card.addEventListener("click", toggleDevice);
    card.querySelector(".delete-device").addEventListener("click", (event) => {
      event.stopPropagation();
      removeDevice(device.id);
    });
    card.querySelector(".toggle").addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDevice();
    });
    card.querySelectorAll("input").forEach((input) => {
      input.addEventListener("click", (event) => event.stopPropagation());
    });
    card.querySelector(".color-input")?.addEventListener("input", (event) => {
      device.color = event.target.value;
      device.on = true;
      if (device.service === "Home Assistant") {
        scheduleHomeAssistantLightUpdate(device);
      }
      saveState();
      card.style.setProperty("--device-color", device.color);
      card.querySelector(".toggle").classList.add("on");
    });
    card.querySelector(".brightness-input")?.addEventListener("input", (event) => {
      device.brightness = Number(event.target.value);
      device.on = true;
      if (device.service === "Home Assistant") {
        scheduleHomeAssistantLightUpdate(device);
      }
      saveState();
      card.querySelector(".toggle").classList.add("on");
    });
    if (device.color) {
      card.style.setProperty("--device-color", device.color);
    }
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
      if (service.name === "Home Assistant") {
        importHomeAssistantDevices();
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

document.querySelector("#importHomeAssistantBtn").addEventListener("click", importHomeAssistantDevices);
document.querySelector("#connectIllumiBtn").addEventListener("click", connectIllumiHomeBluetooth);
document.querySelector("#inspectIllumiBtn").addEventListener("click", inspectIllumiHomeBluetooth);
document.querySelector("#tuyaHelpBtn").addEventListener("click", showTuyaHelp);
document.querySelector("#samsungHelpBtn").addEventListener("click", showSamsungHelp);
document.querySelector("#illumiHelpBtn").addEventListener("click", showIllumiHelp);
document.querySelector("#checkApiBtn").addEventListener("click", checkApiStatus);
document.querySelector("#wakePcBtn").addEventListener("click", wakePc);
document.querySelector("#wakeTvBtn").addEventListener("click", wakeTv);
document.querySelector("#openPsRemoteBtn").addEventListener("click", openPsRemotePlay);
document.querySelector("#airplayInfoBtn").addEventListener("click", showAirPlayInfo);
document.querySelectorAll("[data-samsung-key]").forEach((button) => {
  button.addEventListener("click", () => sendSamsungKey(button.dataset.samsungKey));
});
document.querySelectorAll("[data-ps-key]").forEach((button) => {
  button.addEventListener("click", () => sendPsKey(button.dataset.psKey));
});
[homeAssistantUrl, homeAssistantToken, apiBaseUrl, pcMacAddress, samsungTvIp, samsungTvMac].forEach((input) => input.addEventListener("change", saveState));

document.querySelector("#addDeviceBtn").addEventListener("click", () => {
  dialog.showModal();
  document.querySelector("#newDeviceName").focus();
});

document.querySelector("#confirmAddDevice").addEventListener("click", (event) => {
  const nameInput = document.querySelector("#newDeviceName");
  const roomInput = document.querySelector("#newDeviceRoom");
  const name = nameInput.value.trim();
  if (!name) {
    event.preventDefault();
    nameInput.focus();
    return;
  }

  const type = document.querySelector("#newDeviceType").value;
  const light = isLightDevice({ name, type });
  devices.unshift({
    id: Date.now(),
    name,
    type,
    room: roomInput.value.trim() || "Nytt rum",
    service: newDeviceService.value,
    online: true,
    on: false,
    color: light ? "#ffd17e" : undefined,
    brightness: light ? 80 : undefined,
  });
  activities.unshift([`${name} lades till`, "Nyss"]);
  nameInput.value = "";
  roomInput.value = "";
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
