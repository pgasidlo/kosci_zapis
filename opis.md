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
- **Bezpieczeństwo:** utwardzone reguły bazy (`database.rules.json`, opublikowane) + klucz API ograniczony do domeny `mgrzemow.github.io/*`. `apiKey` jest jawny z założenia (nie sekret). Szczegóły w [README](README.md).

### Pliki
| Plik | Rola |
|---|---|
| `index.html` | wejście, ładuje style i skrypty (z `?v=` do cache-bustingu) |
| `js/rules.js` | czysta logika: punktacja, walidacja, aktywne pola, skreślanie pary +/− (bez DOM/Firebase) |
| `js/db.js` | warstwa Firebase: sesje, zapisy, obecność |
| `js/app.js` | UI: ekrany, zakładki, walidacja na żywo, dymki |
| `css/styles.css` | style (motyw jasny/ciemny — przełącznik jasny/ciemny/z telefonu, układ mobilny) |
| `test/rules.node.js` | testy silnika reguł (uruchamiane w Node) |
| `deploy.ps1` | wdrożenie z auto-podbiciem wersji zasobów |
| `database.rules.json` | reguły bezpieczeństwa Realtime Database (do wklejenia w konsoli) |
| `opis.md`, `zapis.md`, `yams-zasady.md` | dokumentacja |

## Model danych (Firebase Realtime Database)
```
sessions/{klucz}
  meta:     { status: "active"|"finished", createdAt, wagi: { <kolumna>: 8..18 }, order: [<pid>,…] }
  players:  { <pid>: { name } }            # pid = "p0","p1",… nadane przy tworzeniu
  grids:    { <pid>: { <kolumna>: { <wiersz>: wartość } } }   # wartość: liczba | "X"
  presence: { <pid>: <clientId> }          # obecność (ostrzeżenie o zajętym imieniu)
```
- **Kolumny (klucze):** `free` (Wolne), `down` (Dół), `up` (Góra), `harmony` (Harmonia), `second` (Drugi rzut), `anons` (Anons).
- **Wiersze (13, od góry):** `j1`…`j6`, `minus`, `plus`, `full`, `kareta`, `strit`, `malusie`, `poker`.
- **Wagi** losowane raz przy tworzeniu (permutacja 8,10,12,14,16,18), wspólne dla wszystkich graczy.
- Znaczenie pól (reguły gry) → [yams-zasady.md](yams-zasady.md); sposób liczenia → [zapis.md](zapis.md).

## Ekrany i przepływ
1. **Nowa gra** (host) — dodaje imiona graczy (domyślnie: Żaneta, Anna, Piotr, Michał), klika „Utwórz grę". Losują się wagi 6 kolumn (wspólne dla całej gry), powstaje jeden link.
2. **Wejście przez link** — gracz wybiera swoje imię z listy → widzi swoją kartę.
3. **Gra** — zakładki: własna (imię pogrubione, pierwsza) edytowalna, pozostałe tylko do podglądu. Przy każdym imieniu **ostateczny wynik** (prowadzący na zielono); przy imionach przeciwników symbole pojedynków (**★** gdy Ty dublujesz, **☠** gdy on dubluje Ciebie). Wszystko aktualizuje się na żywo; **pole, w które właśnie wpisał poprzedni gracz (przed Tobą w kolejności), dostaje pomarańczową obwódkę na Twojej karcie** — od razu widać, gdzie zagrał. Na dole ekranu: **przełącznik motywu (jasny / ciemny / z telefonu)**, przełącznik jednostki podpowiedzi progu (**oczka/punkty**, per urządzenie), **edycja kolejności graczy**, **zapowiedź głosowa** „<poprzedni gracz> skończył(a) swój ruch. Twoja kolej, <imię>" (Web Speech API, odmiana czasownika wg końcówki imienia; specjalny wyjątek: imię „Żaneta" czytane jako zdrobnienie — „Żanetka skończyła…" / „…Twoja kolej, Żanetko" (tylko w mowie, wyświetlane imię bez zmian); gdy brak głosu PL — zwykły ping) u następnego gracza po cudzym zapisie — z przełącznikiem głosu i przyciskiem **🔔 Test**. Opcjonalny **tryb stołowy** (przełącznik, per urządzenie) trzyma ekran włączony (Wake Lock) i utrzymuje kontekst audio „przy życiu", dzięki czemu zapowiedź głosowa + wibracja + baner „🎲 Twoja kolej!" odzywają się **samoczynnie**, gdy Twoja kolej — dopóki aplikacja jest otwarta na wierzchu. Uwaga: przeglądarka nie odtworzy dźwięku, gdy karta jest w tle / telefon zablokowany (powiadomienia w takim trybie wymagałyby push/FCM).
4. **Koniec** — gdy u wszystkich graczy każde pole jest wypełnione lub skreślone, pojawia się **ranking** u każdego.

## Tożsamość, reconnect, zmiana gracza
- Wybór imienia zapisuje się w `localStorage` danego urządzenia — po odświeżeniu/rozłączeniu wracasz do swojej karty.
- **Zmiana gracza** (przycisk w pasku) — gdy ktoś kliknął nie to imię: zwalnia swoje imię (znika ostrzeżenie „zajęte" u innych) i wraca do wyboru.
- **Obecność** — jeśli to samo imię jest aktywne na innym urządzeniu, pokazujemy ostrzeżenie (wybór pozostaje wolny, nie blokujemy — potrzebne do reconnectu).

## Co aplikacja egzekwuje, a co zostawia graczom
**Egzekwuje:** próg „≥ X" między graczami; minimalną i maksymalną liczbę punktów oraz dozwolone wartości w polu (np. strit 45/50, poker wielokrotność 5, szkółka wielokrotność nominału); reguły pól „+"/„−" (≥20, „+" > „−", a cudze „−" podnosi też próg mojego „+"; wspólne skreślenie); pokazywanie progu „≥ X" także w polach jeszcze zablokowanych; kolejność wpisywania w kolumnach (Dół z góry, Góra z dołu, Harmonia od środka) przez odblokowywanie tylko legalnych pól; przeliczanie sum, premii i wyniku; wykrycie końca gry. W polach z bonusem (strit/full/kareta/poker/malusie) wpisuje się **oczka z kości**, a pole samo liczy wartość końcową. Liczy też **różnice head-to-head** między graczami (z dublowaniem przy proporcji ≥2×) i pokazuje symbole **☠ / ★** przy imionach.

**Zostawia graczom (aplikacja tego nie widzi):** liczbę rzutów oraz deklarację „Anons" — dlatego kolumny **Anons** i **Drugi rzut** mają w aplikacji wolną kolejność wpisywania.

## Wdrożenie
`deploy.ps1` podbija wersję zasobów (`?v=` w `index.html`) na znacznik czasu, commituje i wypycha — dzięki temu po zwykłym odświeżeniu ładuje się najnowsza wersja. Użycie:
```
powershell -ExecutionPolicy Bypass -File deploy.ps1 "opis zmiany"
```

## Testy
Silnik reguł (`js/rules.js`) ma pełny zestaw testów jednostkowych w `test/rules.node.js` (uruchomienie: `node test/rules.node.js`). Sprawdzają **wszystkie reguły silnika**:
- struktura (kolumny, wiersze, maksima), losowanie wag (permutacja),
- premia za szkółkę (progi), suma szkółki/dołu, wynik kolumny (× waga ÷ 10) i wynik łączny, traktowanie `X`/pustych jako 0,
- premia +200 (spełniona; <60; skreślenie/puste w dole; skreślenie u góry dozwolone),
- aktywne pola każdej kolumny (Wolne/Drugi rzut/Anons, Dół, Góra, Harmonia — granice i wyczerpanie),
- próg „≥ X" (max innych, pominięcie siebie, ignorowanie `X`; sprzężenie „−"→„+" w `floorEff`),
- walidacja (X zawsze; całkowita/nieujemna; max i min; wielokrotności szkółki/poker/kareta; strit 45/50; malusie 5–8; +/−),
- skreślanie pary +/−, kompletność karty,
- pojedynki head-to-head: `columnBases`, dublowanie (≥2×, 0 vs >0), różnice, finał kolumny, suma końcowa, `pairMarks` (liczba ☠/★).

Poza silnikiem (logika UI w `app.js`, weryfikowana ręcznie w przeglądarce): synchronizacja na żywo, dymki, zakładki/sumy, zmiana gracza, odkreślanie pary, podpięcie Firebase.

> Po każdej zmianie funkcjonalnej aktualizujemy `opis.md`, `zapis.md` **oraz** `yams-zasady.md` (zasady dla graczy) i testy `test/rules.node.js`.
