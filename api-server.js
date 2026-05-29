const childProcess = require("child_process");
const dgram = require("dgram");
const http = require("http");
const net = require("net");
const tls = require("tls");
const crypto = require("crypto");
const { URL } = require("url");

const port = Number(process.env.HEMNAV_API_PORT || 8788);
const appName = Buffer.from("Hemnav").toString("base64");

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function sendSamsungKey({ host, key, token, secure = false }) {
  if (!host || !key) {
    throw new Error("host och key krävs");
  }

  const tvPort = secure ? 8002 : 8001;
  const query = `/api/v2/channels/samsung.remote.control?name=${appName}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
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

    socket.setTimeout(4500, () => finish(new Error("Timeout mot Samsung TV")));
    socket.once("error", finish);
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
      if (text.includes("101 Switching Protocols")) {
        socket.write(encodeWsFrame(command));
        setTimeout(() => finish(null, { ok: true, message: `Skickade ${key} till Samsung TV.` }), 350);
      }
    });
  });
}

async function sendSamsungKeyEveryWay(body) {
  const attempts = await Promise.allSettled([
    sendSamsungKey({ ...body, secure: false }),
    sendSamsungKey({ ...body, secure: true }),
  ]);
  const successes = attempts.filter((attempt) => attempt.status === "fulfilled");
  if (successes.length > 0) {
    return {
      ok: true,
      message: `Skickade ${body.key} till Samsung TV via ${successes.length} kanal(er). Om inget händer, godkänn Hemnav-rutan på TV:n eller rensa blockerade enheter.`,
    };
  }
  throw new Error(attempts.map((attempt) => attempt.reason?.message || "Okänt fel").join(" / "));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, name: "Hemnav API", port });
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

    if (url.pathname === "/api/samsung/key") {
      const result = await sendSamsungKeyEveryWay(body);
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

server.listen(port, "0.0.0.0", () => {
  console.log(`Hemnav API: http://127.0.0.1:${port}/api/health`);
});
