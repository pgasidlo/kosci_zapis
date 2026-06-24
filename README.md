# Kości — zapis

Webowa aplikacja do liczenia punktów w domowej grze w kości (wariant z 6 kolumnami o losowych wagach, anonsem i harmonią). Każdy gracz gra na swoim telefonie/tablecie; karty są wspólne w czasie rzeczywistym.

**Adres gry:** https://mgrzemow.github.io/kosci_zapis/

## Jak grać
1. Na stronie startowej dodaj imiona graczy → **Utwórz grę**.
2. Skopiuj **jeden link** i wyślij go wszystkim.
3. Każdy wchodzi w link i **wybiera swoje imię** → widzi swoją kartę (zakładka **JA**).
4. Wpisujesz wynik liczbą, albo **x** żeby skreślić pole (liczy się 0).
5. W zakładkach widzisz karty innych graczy (tylko podgląd).
6. Gdy u wszystkich wszystkie pola są wypełnione/skreślone → **ranking**.

## Zasady gry
Pełne zasady: [yams-zasady.md](yams-zasady.md).

## Architektura (bez builda)
- Statyczny frontend (czysty JS, brak narzędzi), hostowany na GitHub Pages.
- Realtime + dane: Firebase Realtime Database (SDK z CDN).
- Sesja = losowy klucz w linku (`#/s/KLUCZ`); brak rejestracji graczy; tożsamość gracza w `localStorage`.

### Pliki
- `index.html` — wejście, ładuje skrypty.
- `js/rules.js` — czysta logika: punktacja, walidacja, aktywne pola.
- `js/db.js` — warstwa Firebase (sesje, zapisy, obecność).
- `js/app.js` — UI: ekrany, zakładki, walidacja na żywo.
- `css/styles.css` — style (jasny motyw).
- `yams-karta-wynikow.html` — wcześniejszy prototyp jednej karty (referencja).

## Uruchomienie lokalne
Otwórz `index.html` w przeglądarce (działa też przez `file://`) albo wystaw serwerem:
`python -m http.server` lub `npx serve`.

## Konfiguracja Firebase
Reguły bazy (Realtime Database → Rules):
```json
{ "rules": { "sessions": { "$sid": { ".read": true, ".write": true } } } }
```
`apiKey` w `js/db.js` jest jawny z założenia (bezpieczeństwo zapewniają reguły).
