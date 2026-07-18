# Zapis i liczenie punktów

> Reguły **zapisu**: co i jak się wpisuje oraz jak liczą się punkty. Reguły gry (kolumny, kolejność, definicje figur, koniec gry): [yams-zasady.md](yams-zasady.md). Aplikacja, model danych i testy: [opis.md](opis.md).
> Cała logika w `js/rules.js` (czysta, bez DOM/Firebase), pokryta testami `test/rules.node.js`.

## Wartość pola
- **liczba** — wpisany wynik,
- **„X"** — pole skreślone (liczy się jako 0),
- **puste** — jeszcze niewypełnione.

W sumach `X` oraz puste liczą się jako **0**.

## Co wpisujesz: OCZKA → wartość
W polach **strit / full / kareta / poker / malusie** wpisujesz **oczka z kości**, a pole pokazuje wartość końcową (`Rules.isPipRow`, `Rules.valueFromPips`, `Rules.pipsFromValue`). Wpisywanie odbywa się przez **dedykowane pickery** (panele na dole ekranu) zamiast klawiatury systemowej — każdy wiersz ma własny picker dopasowany do dozwolonych wartości:
- **Szkółka (j1–j6):** 5 przycisków (1–5 kości danego nominału) z ikonkami ⚀⚁⚂⚃⚄⚅; „0 oczek" wpisuje się skreśleniem (X)
- **Full:** dwie kolumny obok siebie — „trójka" (3 ikonki, 1–6) i „para" (2 ikonki, 1–6); tap po jednym z każdej → auto-commit
- **Kareta:** 6 przycisków (4 ikonki danego nominału, łamane 2+2)
- **Poker:** 6 przycisków (5 ikonek danego nominału, łamane 3+2)
- **Strit:** 2 przyciski — mały (⚀⚁⚂⚃⚄) i duży (⚁⚂⚃⚄⚅)
- **Malusie:** 4 przyciski (5–8 oczek → 75–60 pkt)
- **+/−:** przyciski 20–29 (minus) lub 21–30 (plus)
- Każdy picker ma przycisk **X** (skreślenie) i **🗑** (wyczyść wypełnione pole)

Picker pokazuje nazwę pola, próg i wpisy innych graczy. Wartości poniżej progu są wyszarzone. Po zatwierdzeniu pole pokazuje wartość końcową.

| Pole | Wpisujesz (oczka) | Pole pokazuje | Przelicznik |
|---|---|---|---|
| strit | 15 / 20 | 45 / 50 | oczka + 30 |
| full | 5 … 30 | 25 … 50 | oczka + 20 |
| kareta | 4 … 24 (co 4) | 34 … 54 | oczka (4 kości) + 30 |
| poker | 5, 10, …, 30 | 75 … 100 | oczka + 70 |
| malusie | 5 … 8 | 75 … 60 | 100 − 5×oczka (9+ = skreśl → 0) |

Pola **1–6**, **+**, **−** wpisuje się wprost (bez przelicznika). **Wewnętrznie przechowywana jest wartość końcowa** — na niej liczą się sumy, próg „≥ X" i maksima; oczka to tylko forma wpisu i podglądu.

## Punktacja figur (wartości i maksima)
| Wiersz | Wartość | Max |
|---|---|---|
| `j1`…`j6` | suma oczek danego nominału (wielokrotność nominału) | 5, 10, 15, 20, 25, 30 |
| `plus` / `minus` | suma 5 kości; obie ≥ 20, „+" > „−"; dodają się do dołu | 30 |
| `strit` | suma 5 kości + 30 (tylko mały 45 / duży 50) | 50 |
| `full` | suma 5 kości + 20 (pięć jednakowych też) | 50 |
| `kareta` | suma **4 jednakowych** kości + 30 | 54 |
| `malusie` | 100 − 5 × oczka (tylko 5–8 oczek) | 75 |
| `poker` | suma 5 kości + 70 | 100 |

Maksima w `Rules.MAXES`. Para **+/−** jest powiązana i nie może zostać w stanie „jedno pole z wynikiem, drugie skreślone": przy skreśleniu jednego pola, jeśli partner ma już **wartość** — zostaje **automatycznie skreślony (X)** (logika w `app.js`); jeśli partner jest **pusty** — dopuszcza już wyłącznie X (blokada liczbowego wpisu w `app.js`), skreślasz go osobno w kolejnej turze. Każde skreślenie to **pełny ruch (przesuwa kolejkę)**.

## Premie
- **Premia za szkółkę** (osobno w każdej kolumnie, od sumy nominałów 1–6; `Rules.bonusSzkolka`): ≥ 60 → **+30**, ≥ 70 → **+50**, ≥ 80 → **+100**.
- **Premia za kolumnę: +200** — gdy w kolumnie: suma szkółki **≥ 60** (skreślenia u góry dozwolone, liczy się tylko suma) **oraz** **cały dół wypełniony liczbami, bez ani jednego skreślenia** i bez pustych.

## Wynik kolumny
`Wynik = round((suma szkółki + premia za szkółkę + suma dołu + premia 200) × waga / 10)` (`Rules.scoreColumn`).
- **Waga mnoży całość — w tym premię +200.**
- **Waga (i ÷ 10) naliczane są dopiero w polu „Σ//10".** Wcześniejsze wiersze (Suma szkółki, Premia, +200, wartości pól) pokazują wartości **bez** mnożenia przez wagę.
- Przykład: pełny wynik 7658 → **766**.

To wartość **bazowa** kolumny (na karcie: **Σ//10**). Ostateczny wynik gracza liczy się z pojedynków (niżej).

## Pojedynki head-to-head
Pod wynikiem bazowym, dla **każdego przeciwnika** (graczy − 1 wierszy) liczymy różnicę w **każdej kolumnie** (`Rules.columnBases`, `Rules.gameStandings`):
- **różnica = mój wynik kolumny − wynik przeciwnika** (dodatnia podbija, ujemna obniża).
- **Dublowanie:** jeśli proporcja wyników ≥ 2× (`Rules.isDoubled`; 0 vs >0 też), różnicę liczymy **×2**. Taki wpis jest pogrubiony — zielony na „+", czerwony na „−".
- **Wynik ost. kolumny** (`Σ ost.`) = suma różnic do przeciwników w tej kolumnie (z dublowaniem), **bez** wyniku bazowego — baza jest już wliczona w każdą różnicę (mój − przeciwnik).
- **Ostateczny wynik gracza** = suma „wyników ost." z 6 kolumn. Gra jest **zero-sum**: suma ostatecznych wyników wszystkich graczy = 0.

Symbole przy imieniu **przeciwnika** (zakładki i ranking, z perspektywy `myPid`); **liczba symboli = liczba kolumn**:
- **★ złota gwiazdka** ×N — w N kolumnach **ja dubluję** tego przeciwnika.
- **☠ czerwona czaszka** (wypełniony SVG) ×N — w N kolumnach **on dubluje mnie**.

Liczone funkcją `Rules.pairMarks` ze `standings[myPid]` (kolumny z `doubled` + znak `value`); własna zakładka nie ma symboli.

## Próg „≥ X" między graczami
W danym polu (ta sama figura, ta sama kolumna) wartość liczbowa nie może być niższa niż najwyższa, jaką wpisali tam **inni** gracze (`Rules.floorFor`). Pole skreślone (`X`) lub puste u innych **nie** podnosi progu. Przeliczane na żywo z aktualnego stanu sesji. Próg „≥ X" jest widoczny **także w polach jeszcze zablokowanych** do edycji (nie tylko w aktywnych) — w każdej pustej komórce własnej karty. **Sprzężenie „+"/„−"** (`Rules.floorEff`): skoro „+" > „−", zarówno cudzy, jak i **mój własny** wpis w „−" podnosi dolny próg mojego „+" — „+" ≥ max(najwyższe cudze „−", moje „−") + 1. W aplikacji: podpowiedź „≥ X" (dla **malusie**, gdzie mniej oczek = więcej punktów, podpowiedź „≤ N" oczek). Jednostka podpowiedzi jest przełączalna **per gracz** (na dole ekranu): **oczka** (domyślnie) albo **punkty** (wartość z bonusem pola) — wtedy dla wszystkich pól „≥ X" w punktach.

## Reguły walidacji (`Rules.validateCell`)
1. **`X`** (skreślenie) — zawsze dozwolone (także poniżej progu).
2. Liczba **całkowita**, nieujemna (puste / nie-liczba / ułamek → odrzucone).
3. Nie większa niż **max** i nie mniejsza niż **min** wiersza (`Rules.MAXES`, `Rules.MINS`): full ≥ 5 oczek (25), kareta ≥ 4 (34), poker ≥ 5 (75).
4. **Dozwolone zbiory:** szkółka `j1…j6` — wielokrotność nominału (`Rules.NOMINAL`); **strit** — tylko 15 lub 20 oczek (45/50); **poker** — wielokrotność 5 oczek; **kareta** — wielokrotność 4 oczek (34…54); **malusie** — tylko 5–8 oczek (9+ = skreśl).
5. Nie mniejsza niż **próg „≥ X"** od innych graczy.
6. Dla `plus`/`minus`: ≥ 20 oraz „+" > „−"; dodatkowo „+" ≥ max(najwyższe cudze „−", moje „−") + 1 (`Rules.floorEff`).

Pola oczkowe: wpisane **oczka** są najpierw przeliczane na wartość końcową, a walidacja działa na wartości końcowej. Edycja własnych, wypełnionych pól jest dozwolona (obowiązuje ta sama walidacja), ale podlega kolejce: **w swojej turze** edycja liczy się jako ruch i przesuwa kolejkę, a **poza turą** jest zablokowana. Do poprawienia wcześniejszego wpisu bez zmiany kolejki (także nie w swojej turze) służy tryb **„Poprawa wyniku"** — patrz [yams-zasady.md](yams-zasady.md).

## Skreślanie
- Wpisanie `x`/`X` → pole pokazuje „X" i liczy się jako **0**.
- Para „+"/„−": nie może zostać w stanie „jedno pole z wynikiem, drugie skreślone". Skreślenie jednego pola: gdy partner ma **wartość** — zostaje **automatycznie skreślony (X)** w tym samym ruchu; gdy partner jest **pusty** — dopuszcza już **wyłącznie X** i skreślasz go osobno w kolejnej turze (nie tracisz prawa do jego zapisania, dopóki był pusty). Każde skreślenie to **pełny ruch (przesuwa kolejkę)**. Skreślone pole przestaje wyznaczać próg „≥ X" dla innych.
- *Kiedy wolno skreślić* (kolejność w kolumnie, Anons po zapowiedzi, Drugi rzut nawet po 3. rzucie) to reguła gry — [yams-zasady.md](yams-zasady.md).
