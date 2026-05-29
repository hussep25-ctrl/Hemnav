# Hemnav Google Home Bridge

Google Home-enheter kan inte läsas direkt från en vanlig webbapp. Google Home APIs körs via Android/iOS SDK och kräver OAuth + Permissions API innan appen får se användarens hem och enheter.

Hemnav är därför förberedd för en liten mobilbrygga. När bryggan körs fyller du i adressen i Hemnav under Tjänster, till exempel:

```text
http://192.168.50.20:8787
```

Hemnav anropar sedan:

```http
GET /google-home/devices
Accept: application/json
```

Förväntat svar:

```json
{
  "devices": [
    {
      "id": "google-device-id",
      "name": "Kökslampa",
      "type": "Lampa",
      "room": "Kök",
      "online": true,
      "on": true
    }
  ]
}
```

Minsta flöde för riktig Google Home-koppling:

1. Bygg en Android- eller iOS-brygga med Google Home APIs.
2. Skapa OAuth-klient och be användaren godkänna åtkomst till hemmet.
3. Anropa Home APIs `home.devices().list()` eller motsvarande.
4. Mappa Google-enheterna till JSON-formatet ovan.
5. Servera `GET /google-home/devices` lokalt eller via en säker backend.

IllumiHome verkar vara en Bluetooth-baserad LED-app utan tydligt publikt API. Hemnav kan därför lägga till en IllumiHome-enhet via Web Bluetooth där mobilen stöder det, men riktig färg-/ljusstyrning kräver tillverkarens Bluetooth-protokoll eller att enheten först exponeras via Google Home/Home Assistant.
