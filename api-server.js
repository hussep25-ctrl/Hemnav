const childProcess = require("child_process");
const dgram = require("dgram");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const tls = require("tls");
const crypto = require("crypto");
const { URL } = require("url");

const port = Number(process.env.HEMNAV_API_PORT || 8794);
const appName = Buffer.from("Hemnav").toString("base64");
const tokenFile = path.join(__dirname, ".hemnav-samsung-tokens.json");

function loadSamsungTokens() {
  try {
    return JSON.parse(fs.readFileSync(tokenFile, "utf8"));
  } catch {
    return {};
  }
}

function saveSamsungToken(host, portName, token) {
  if (!token) return;
  const tokens = loadSamsungTokens();
  tokens[host] = { ...(tokens[host] || {}), [portName]: token };
  fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
}

function getSamsungToken(host, portName) {
  return loadSamsungTokens()[host]?.[portName];
}

function hasSamsungToken(host) {
  const tokens = loadSamsungTokens()[host] || {};
  return Boolean(tokens["8002"] || tokens["8001"]);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Private-Network": "true",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function normalizeMac(mac) {
  const clean = String(mac || "").replace(/[^a-fA-F0-9]/g, "");
  if (clean.length !== 12) {
    throw new Error("MAC-adressen ska ha 12 hex-tecken, t.ex. AA:BB:CC:DD:EE:FF");
  }
  return clean.match(/.{2}/g).map((part) => Number.parseInt(part, 16));
}

function wakeOnLan(mac, broadcast = "255.255.255.255", wolPort = 9) {
  const bytes = normalizeMac(mac);
  const packet = Buffer.alloc(6 + 16 * 6, 0xff);
  for (let i = 6; i < packet.length; i += 6) {
    Buffer.from(bytes).copy(packet, i);
  }

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.once("error", reject);
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, wolPort, broadcast, (error) => {
        socket.close();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  });
}

function openApp(names) {
  const platform = process.platform;
  const candidates = Array.isArray(names) ? names : [names];

  return new Promise((resolve, reject) => {
    if (platform === "darwin") {
      const tryCandidate = (index) => {
        const candidate = candidates[index];
        if (!candidate) {
          reject(new Error(`Kunde inte hitta någon av apparna: ${candidates.join(", ")}`));
          return;
        }
        if (candidate.includes("/Contents/MacOS/")) {
          const child = childProcess.spawn(candidate, [], { detached: true, stdio: "ignore" });
          child.once("error", () => tryCandidate(index + 1));
          child.unref();
          resolve();
          return;
        }
        const args = candidate.endsWith(".app") || candidate.startsWith("/") ? [candidate] : ["-a", candidate];
        childProcess.execFile("open", args, (error) => {
          if (error) {
            tryCandidate(index + 1);
          } else {
            resolve();
          }
        });
      };
      tryCandidate(0);
      return;
    }

    if (platform === "win32") {
      const command = candidates.map((name) => `start "" "${name}"`).join(" || ");
      childProcess.exec(command, { shell: "cmd.exe" }, (error) => (error ? reject(error) : resolve()));
      return;
    }

    childProcess.execFile("sh", ["-lc", candidates.map((name) => `gtk-launch "${name}"`).join(" || ")], (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

function encodeWsFrame(text) {
  const payload = Buffer.from(text);
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(6);
    header[1] = 0x80 | payload.length;
  } else {
    header = Buffer.alloc(8);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  }

  header[0] = 0x81;
  const mask = crypto.randomBytes(4);
  mask.copy(header, header.length - 4);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i += 1) {
    masked[i] = payload[i] ^ mask[i % 4];
  }
  return Buffer.concat([header, masked]);
}

function extractSamsungToken(buffer) {
  const text = buffer.toString("utf8");
  const tokenMatch = text.match(/"token"\s*:\s*"([^"]+)"/);
  if (tokenMatch) return tokenMatch[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  try {
    const data = JSON.parse(text.slice(start, end + 1));
    return data?.data?.token || data?.token || "";
  } catch {
    return "";
  }
}

function sendSamsungKey({ host, key, token, secure = true, pairOnly = false }) {
  if (!host || !key) {
    throw new Error("host och key krävs");
  }

  const tvPort = secure ? 8002 : 8001;
  const portName = String(tvPort);
  const savedToken = token || getSamsungToken(host, portName);
  const query = `/api/v2/channels/samsung.remote.control?name=${appName}${savedToken ? `&token=${encodeURIComponent(savedToken)}` : ""}`;
  const requestKey = crypto.randomBytes(16).toString("base64");
  const command = JSON.stringify({
    method: "ms.remote.control",
    params: {
      Cmd: "Click",
      DataOfCmd: key,
      Option: "false",
      TypeOfRemote: "SendRemoteKey",
    },
  });

  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port: tvPort, rejectUnauthorized: false })
      : net.connect({ host, port: tvPort });

    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      error ? reject(error) : resolve(value);
    };

    socket.setTimeout(savedToken ? 15000 : 75000, () => {
      if (!savedToken) {
        finish(new Error("TV:n gav ingen token. Tryck Tillåt på TV:n och försök Parkoppla TV igen."));
      } else {
        finish(new Error("Timeout mot Samsung TV"));
      }
    });
    socket.once("error", finish);
    let upgraded = false;
    let sent = false;
    socket.once("connect", () => {
      socket.write(
        [
          `GET ${query} HTTP/1.1`,
          `Host: ${host}:${tvPort}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${requestKey}`,
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    });

    socket.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      const newToken = extractSamsungToken(chunk);
      if (newToken) {
        saveSamsungToken(host, portName, newToken);
      }
      if (text.includes("101 Switching Protocols")) {
        upgraded = true;
      }
      if (upgraded && savedToken && !sent) {
        sent = true;
        setTimeout(() => {
          if (!pairOnly) {
            socket.write(encodeWsFrame(command));
          }
          setTimeout(() => finish(null, { ok: true, message: pairOnly ? "Samsung TV är redan parkopplad." : `Skickade ${key} till Samsung TV.` }), 500);
        }, 80);
      }
      if (upgraded && newToken && !sent) {
        sent = true;
        setTimeout(() => {
          if (!pairOnly) {
            socket.write(encodeWsFrame(command));
          }
          setTimeout(() => finish(null, { ok: true, message: pairOnly ? "Samsung TV parkopplad. Token sparad." : `Samsung TV parkopplad och ${key} skickad. Token sparad.` }), 500);
        }, 200);
      }
    });
  });
}

async function sendSamsungKeyEveryWay(body) {
  try {
    return await sendSamsungKey({ ...body, secure: true });
  } catch (secureError) {
    if (getSamsungToken(body.host, "8001")) {
      return sendSamsungKey({ ...body, secure: false });
    }
    throw secureError;
  }
}

async function pairSamsungTv(body) {
  const result = await sendSamsungKey({ ...body, key: "KEY_HOME", secure: true, pairOnly: true });
  return { ...result, paired: hasSamsungToken(body.host) };
}

async function callHomeAssistant({ baseUrl, token, path: apiPath, method = "GET", body }) {
  if (!baseUrl || !token) {
    throw new Error("Home Assistant URL och token krävs");
  }
  const request = await fetch(`${String(baseUrl).replace(/\/$/, "")}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await request.json().catch(() => ({}));
  if (!request.ok) {
    throw new Error(data.message || `Home Assistant svarade ${request.status}`);
  }
  return data;
}

async function listHomeAssistantDevices(body) {
  const states = await callHomeAssistant({ ...body, path: "/api/states" });
  return states
    .filter((state) => /^(light|switch)\./.test(state.entity_id))
    .map((state) => ({
      id: state.entity_id,
      entityId: state.entity_id,
      name: state.attributes?.friendly_name || state.entity_id,
      type: state.entity_id.startsWith("light.") ? "Lampa" : "Kontakt",
      room: "Home Assistant",
      service: "Home Assistant",
      online: state.state !== "unavailable",
      on: state.state === "on",
      brightness: state.attributes?.brightness ? Math.round((state.attributes.brightness / 255) * 100) : undefined,
    }));
}

async function testHomeAssistant(body) {
  const info = await callHomeAssistant({ ...body, path: "/api/" });
  const states = await callHomeAssistant({ ...body, path: "/api/states" });
  const controllable = states.filter((state) => /^(light|switch)\./.test(state.entity_id));
  return {
    ok: true,
    message: info.message || "Home Assistant svarar.",
    totalEntities: states.length,
    controllableEntities: controllable.length,
  };
}

async function toggleHomeAssistantEntity(body) {
  const entityId = body.entityId;
  const domain = entityId?.split(".")[0];
  if (!entityId || !["light", "switch"].includes(domain)) {
    throw new Error("Endast light/switch stöds just nu");
  }
  await callHomeAssistant({
    ...body,
    path: `/api/services/${domain}/${body.on ? "turn_on" : "turn_off"}`,
    method: "POST",
    body: { entity_id: entityId },
  });
  return { ok: true, message: `${entityId} ${body.on ? "på" : "av"}` };
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

async function setHomeAssistantLight(body) {
  const entityId = body.entityId;
  if (!entityId) {
    throw new Error("entityId krävs");
  }
  if (!entityId.startsWith("light.")) {
    return toggleHomeAssistantEntity(body);
  }

  const serviceBody = { entity_id: entityId };
  const rgb = hexToRgb(body.color);
  if (rgb) {
    serviceBody.rgb_color = rgb;
  }
  if (body.brightness) {
    serviceBody.brightness_pct = Math.max(1, Math.min(100, Number(body.brightness)));
  }

  await callHomeAssistant({
    ...body,
    path: "/api/services/light/turn_on",
    method: "POST",
    body: serviceBody,
  });
  return { ok: true, message: `${entityId} uppdaterad` };
}

function sendPsRemoteKey(key) {
  const keyCodes = {
    up: 126,
    down: 125,
    left: 123,
    right: 124,
    enter: 36,
    back: 53,
    ps: 49,
    options: 49,
  };
  const code = keyCodes[key];
  if (!code) {
    throw new Error(`Okänd PS-knapp: ${key}`);
  }

  return new Promise((resolve, reject) => {
    const script = [
      'tell application "RemotePlay" to activate',
      "delay 0.15",
      'tell application "System Events"',
      `key code ${code}`,
      "end tell",
    ].join("\n");
    childProcess.execFile("osascript", ["-e", script], (error) => {
      if (error) {
        reject(new Error("macOS nekade tangentstyrning. Ge Terminal/Node tillgång under Systeminställningar > Integritet och säkerhet > Hjälpmedel."));
      } else {
        resolve({ ok: true, message: `Skickade PS-knapp: ${key}` });
      }
    });
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, name: "Hemnav API", port, version: 20, capabilities: { homeAssistantTest: true } });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 404, { ok: false, error: "Not found" });
      return;
    }

    const body = await readJson(request);

    if (url.pathname === "/api/pc/wake") {
      await wakeOnLan(body.mac, body.broadcast, body.port);
      sendJson(response, 200, { ok: true, message: "Wake-on-LAN skickat." });
      return;
    }

    if (url.pathname === "/api/ps5/remote-play") {
      await openApp(
        process.platform === "darwin"
          ? [
              "/Applications/RemotePlay.app",
              "RemotePlay",
              "PS Remote Play",
              "/Applications/RemotePlay.app/Contents/MacOS/RemotePlay",
            ]
          : ["PS Remote Play", "RemotePlay.exe", "RemotePlay"],
      );
      sendJson(response, 200, { ok: true, message: "PS Remote Play öppnad." });
      return;
    }

    if (url.pathname === "/api/ps5/key") {
      const result = await sendPsRemoteKey(body.key);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/api/samsung/key") {
      const result = await sendSamsungKeyEveryWay(body);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/api/samsung/pair") {
      const result = await pairSamsungTv(body);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/api/samsung/status") {
      sendJson(response, 200, { ok: true, paired: hasSamsungToken(body.host), tokenFile });
      return;
    }

    if (url.pathname === "/api/home-assistant/devices") {
      const devices = await listHomeAssistantDevices(body);
      sendJson(response, 200, { ok: true, devices });
      return;
    }

    if (url.pathname === "/api/home-assistant/test") {
      const result = await testHomeAssistant(body);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/api/home-assistant/toggle") {
      const result = await toggleHomeAssistantEntity(body);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/api/home-assistant/light") {
      const result = await setHomeAssistantLight(body);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/api/apple-tv/airplay-info") {
      sendJson(response, 200, {
        ok: true,
        message: "AirPlay-sändning måste startas från iOS/macOS eller en native companion.",
      });
      return;
    }

    sendJson(response, 404, { ok: false, error: "Unknown endpoint" });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Hemnav API: http://127.0.0.1:${port}/api/health`);
});
