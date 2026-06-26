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

## Dokumentacja
- **Reguły gry** (kolumny, kolejność, definicje figur, koniec gry): [yams-zasady.md](yams-zasady.md)
- **Reguły zapisu/punktacji** (wartości, premie, wynik ÷10, pojedynki, walidacja): [zapis.md](zapis.md)
- **Opis aplikacji** (architektura, model danych, ekrany, deploy, testy): [opis.md](opis.md)

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
- `opis.md` — opis aplikacji, założenia, logika. `zapis.md` — sposób zapisu, punktacja, zależności, walidacja.
- `test/rules.node.js` — testy silnika reguł (`node test/rules.node.js`).
- `yams-karta-wynikow.html` — wcześniejszy prototyp jednej karty (referencja).

## Uruchomienie lokalne
Otwórz `index.html` w przeglądarce (działa też przez `file://`) albo wystaw serwerem:
`python -m http.server` lub `npx serve`.

## Bezpieczeństwo i konfiguracja Firebase
- **`apiKey` w `js/db.js` jest jawny z założenia** — w aplikacjach webowych config Firebase jest publiczny (to identyfikatory, nie sekrety; przeglądarka i tak go potrzebuje). Bezpieczeństwa pilnują **reguły bazy**.
- **Reguły bazy (realny strażnik):** w pliku [`database.rules.json`](database.rules.json). Wklej je w Firebase Console → Realtime Database → **Rules** → **Publish**. Ograniczają dostęp do `sessions/<klucz>` i walidują kształt (typy pól, limity długości, brak obcych kluczy).
- **Opcjonalnie — ograniczenie klucza API:** Google Cloud Console → APIs & Services → Credentials → klucz „Browser key" → Application restrictions → Websites → `https://mgrzemow.github.io/*`. (Dla RTDB bez logowania klucz i tak nie bramkuje bazy — robią to reguły — ale to dobra higiena na wypadek włączenia Auth.)

## Wdrożenie
Skrypt `deploy.ps1` podbija wersję zasobów (`?v=` w `index.html`) na znacznik czasu, commituje i wypycha — dzięki temu po zwykłym odświeżeniu w przeglądarce ładuje się najnowsza wersja (cache-busting). Użycie:
```
powershell -ExecutionPolicy Bypass -File deploy.ps1 "opis zmiany"
```
