const http = require("http");

const devices = [
  { id: "google-kitchen-light", name: "Google kökslampa", type: "Lampa", room: "Kök", online: true, on: true },
  { id: "google-living-speaker", name: "Nest vardagsrum", type: "Högtalare", room: "Vardagsrum", online: true, on: false },
  { id: "google-hall-plug", name: "Hallkontakt", type: "Kontakt", room: "Hall", online: true, on: false },
];

const server = http.createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (request.url === "/google-home/devices") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ devices }));
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(8787, "0.0.0.0", () => {
  console.log("Hemnav bridge sample: http://127.0.0.1:8787/google-home/devices");
});
