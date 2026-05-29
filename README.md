# Hemnav

Hemnav är en lokal smart-hem-kontrollpanel/PWA med plats för Google Home, IllumiHome, PC, Samsung TV, PS5 och Apple TV/AirPlay.

## Starta appen

```bash
python3 -m http.server 4173
```

Öppna:

```text
http://127.0.0.1:4173
```

## Starta lokalt API

```bash
node api-server.js
```

API:t kör normalt på:

```text
http://127.0.0.1:8788
```

## Vad som fungerar direkt

- IllumiHome Bluetooth-upptäckt via Chrome/Edge på dator eller Android, när sidan körs på `localhost` eller HTTPS.
- PC Wake-on-LAN via lokal API-server, om PC:n har Wake-on-LAN aktiverat och du fyller i MAC-adressen.
- Samsung TV nätverksfjärr via port 8001/8002 där TV:n accepterar parkoppling från Hemnav.
- PS Remote Play-start via lokal API-server, om Sonys Remote Play-app är installerad.

## Begränsningar

- Google Home kräver Android/iOS Home APIs, OAuth och Permissions API. En vanlig webbapp kan inte läsa alla Google Home-enheter direkt.
- AirPlay-sändning kan inte göras av en vanlig webbsida. AirPlay startas via iOS/macOS eller en native companion.
- IllumiHome styrning av färg/ljusstyrka kräver tillverkarens Bluetooth-protokoll. Hemnav kan hitta/lägga till enheten först.

Se även [GOOGLE_HOME_BRIDGE.md](./GOOGLE_HOME_BRIDGE.md).
