# Opis aplikacji — Kości (zapis)

Webowa aplikacja do liczenia punktów w domowej grze w kości (wariant z 6 kolumnami o losowych wagach, anonsem i harmonią). Każdy gracz prowadzi własną kartę na swoim telefonie/tablecie; karty są wspólne w czasie rzeczywistym i wzajemnie zależne.

- **Adres gry:** https://mgrzemow.github.io/kosci_zapis/
- **Repozytorium:** https://github.com/mgrzemow/kosci_zapis
- **Zasady gry (dla graczy):** [yams-zasady.md](yams-zasady.md)
- **Sposób zapisu, punktacja, walidacja (szczegóły techniczne):** [zapis.md](zapis.md)

## Cel i założenia
- **Grupa znajomych przy stole** — fizyczne kości, aplikacja tylko liczy i zapisuje punkty (nie rzuca i nie pilnuje liczby rzutów).
- **Każdy na swoim urządzeniu**, własna karta; podgląd kart innych graczy.
- **Bez rejestracji** — sesja to losowy klucz w linku; host wysyła jeden link wszystkim.
- **Wzajemna zależność kart** — w danym polu nie można wpisać wartości niższej niż najwyższa, którą wpisał tam inny gracz („próg ≥ X").
- **Działa na telefonie bez przewijania w bok** — karta mieści 7 kolumn na szerokość ekranu.
- **Darmowo i prosto** — statyczny frontend bez budowania, hosting na GitHub Pages, dane w Firebase.

## Architektura (bez builda)
- **Frontend:** statyczne pliki (czysty JS, brak narzędzi/budowania).
- **Realtime + dane:** Firebase Realtime Database, SDK ładowane z CDN (compat 9.23.0).
- **Hosting:** GitHub Pages.
- **Sesja:** losowy klucz w linku (`#/s/KLUCZ`); tożsamość gracza w `localStorage`.

### Pliki
| Plik | Rola |
|---|---|
| `index.html` | wejście, ładuje style i skrypty (z `?v=` do cache-bustingu) |
| `js/rules.js` | czysta logika: punktacja, walidacja, aktywne pola, skreślanie pary +/− (bez DOM/Firebase) |
| `js/db.js` | warstwa Firebase: sesje, zapisy, obecność |
| `js/app.js` | UI: ekrany, zakładki, walidacja na żywo, dymki |
| `css/styles.css` | style (jasny motyw, układ mobilny) |
| `test/rules.node.js` | testy silnika reguł (uruchamiane w Node) |
| `deploy.ps1` | wdrożenie z auto-podbiciem wersji zasobów |
| `opis.md`, `zapis.md`, `yams-zasady.md` | dokumentacja |

## Ekrany i przepływ
1. **Nowa gra** (host) — dodaje imiona graczy (domyślnie: Żaneta, Anna, Piotr, Michał), klika „Utwórz grę". Losują się wagi 6 kolumn (wspólne dla całej gry), powstaje jeden link.
2. **Wejście przez link** — gracz wybiera swoje imię z listy → widzi swoją kartę.
3. **Gra** — zakładki: własna (imię pogrubione, pierwsza) edytowalna, pozostałe tylko do podglądu. Przy każdym imieniu suma punktów; prowadzący ma **★**. Wszystko aktualizuje się na żywo.
4. **Koniec** — gdy u wszystkich graczy każde pole jest wypełnione lub skreślone, pojawia się **ranking** u każdego.

## Tożsamość, reconnect, zmiana gracza
- Wybór imienia zapisuje się w `localStorage` danego urządzenia — po odświeżeniu/rozłączeniu wracasz do swojej karty.
- **Zmiana gracza** (przycisk w pasku) — gdy ktoś kliknął nie to imię: zwalnia swoje imię (znika ostrzeżenie „zajęte" u innych) i wraca do wyboru.
- **Obecność** — jeśli to samo imię jest aktywne na innym urządzeniu, pokazujemy ostrzeżenie (wybór pozostaje wolny, nie blokujemy — potrzebne do reconnectu).

## Co aplikacja egzekwuje, a co zostawia graczom
**Egzekwuje:** próg „≥ X" między graczami; maksymalną liczbę punktów w polu; reguły pól „+"/„−" (≥20, „+" > „−", wspólne skreślenie); kolejność wpisywania w kolumnach (Dół z góry, Góra z dołu, Harmonia od środka) przez odblokowywanie tylko legalnych pól; przeliczanie sum, premii i wyniku; wykrycie końca gry.

**Zostawia graczom (aplikacja tego nie widzi):** liczbę rzutów oraz deklarację „Anons" — dlatego kolumny **Anons** i **Drugi rzut** mają w aplikacji wolną kolejność wpisywania.

## Wdrożenie
`deploy.ps1` podbija wersję zasobów (`?v=` w `index.html`) na znacznik czasu, commituje i wypycha — dzięki temu po zwykłym odświeżeniu ładuje się najnowsza wersja. Użycie:
```
powershell -ExecutionPolicy Bypass -File deploy.ps1 "opis zmiany"
```

## Testy
Silnik reguł (`js/rules.js`) ma pełny zestaw testów jednostkowych w `test/rules.node.js` — uruchomienie: `node test/rules.node.js`. Pokrycie testowe opisane jest na końcu [zapis.md](zapis.md).

> Po każdej zmianie funkcjonalnej aktualizujemy `opis.md` i `zapis.md`.
