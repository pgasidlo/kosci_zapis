# Zapis i liczenie punktów

Szczegóły techniczne sposobu zapisu, punktacji, zależności między polami i walidacji. Reguły gry dla graczy: [yams-zasady.md](yams-zasady.md). Opis aplikacji: [opis.md](opis.md).

Cała logika jest w `js/rules.js` (czysta, bez DOM/Firebase) i pokryta testami `test/rules.node.js`.

## Model danych (Firebase Realtime Database)
```
sessions/{klucz}
  meta:     { status: "active"|"finished", createdAt, wagi: { <kolumna>: 8..18 } }
  players:  { <pid>: { name } }            # pid = "p0","p1",… nadane przy tworzeniu
  grids:    { <pid>: { <kolumna>: { <wiersz>: wartość } } }
  presence: { <pid>: <clientId> }          # obecność do ostrzeżenia o zajętym imieniu
```
- **Kolumny:** `free` (Wolne), `down` (Dół ↓), `up` (Góra ↑), `harmony` (Harmonia ↕), `second` (Drugi rzut), `anons` (Anons).
- **Wiersze (13, od góry):** `j1`,`j2`,`j3`,`j4`,`j5`,`j6`, `minus`, `plus`, `full`, `kareta`, `strit`, `malusie`, `poker`.
- **Wagi** losowane raz przy tworzeniu gry (permutacja `8,10,12,14,16,18`), wspólne dla wszystkich graczy.

## Wartość pola
Pole ma jedną z trzech postaci:
- **liczba** — wpisany wynik,
- **`"X"`** — pole skreślone (liczy się jako 0),
- **puste** (brak klucza) — jeszcze niewypełnione.

W sumach `X` oraz puste liczą się jako **0**.

## Kolejność wpisywania (aktywne pola)
W danym momencie odblokowane są tylko pola, które wolno legalnie wypełnić (`Rules.activeRows`):
- **Wolne, Drugi rzut, Anons** — każde puste pole (dowolna kolejność).
- **Dół** — tylko najwyższe puste pole (z góry na dół).
- **Góra** — tylko najniższe puste pole (z dołu do góry).
- **Harmonia** — dwa pola na granicy przy kresce (między `j6` a `minus`): jedno w górę (od `j6` wzwyż) i jedno w dół (od `minus` w dół). Blok rośnie od środka.

Skreślenie (`X`) liczy się jak wypełnienie — w kolumnach z kolejnością przesuwa granicę dalej.

## Punktacja figur (wartości wpisywane przez graczy)
| Wiersz | Warunek | Wartość | Max |
|---|---|---|---|
| `j1`…`j6` | suma oczek danego nominału | n × nominał | 5, 10, 15, 20, 25, 30 |
| `plus` (+) | suma 5 kości | ≥ 20, „+" > „−" | 30 |
| `minus` (−) | suma 5 kości | ≥ 20, „−" < „+" | 30 |
| `strit` | mały lub duży | suma 5 kości + 30 | 50 |
| `full` | trójka + para (pięć jednakowych też liczy się jako full) | suma 5 kości + 20 | 50 |
| `kareta` | 4 jednakowe | suma **4 jednakowych** kości + 30 | 54 |
| `malusie` | im mniej oczek, tym lepiej (tylko 5–8 oczek) | 100 − 5 × (suma oczek) | 75 |
| `poker` | 5 jednakowych | suma 5 kości + 70 | 100 |

Maksima (`Rules.MAXES`) wyliczone z najwyższych możliwych rzutów; służą do walidacji (patrz niżej).

### Wpisywanie: oczka kości a wartość pola
W polach z własnym bonusem/wzorem **wpisuje się tylko oczka z kości**, a pole pokazuje wartość końcową (`Rules.isPipRow`, `Rules.valueFromPips`, `Rules.pipsFromValue`):

| Pole | Wpisujesz (oczka) | Pole pokazuje | Przelicznik |
|---|---|---|---|
| strit | 15 / 20 | 45 / 50 | oczka + 30 |
| full | 7 … 30 | 27 … 50 | oczka + 20 |
| kareta | 4 … 24 | 34 … 54 | oczka (4 kości) + 30 |
| poker | 5 … 30 | 75 … 100 | oczka + 70 |
| malusie | 5 … 8 | 75 … 60 | 100 − 5×oczka (9+ = skreśl → 0) |

- Po wyjściu z pola widać wartość końcową; po wejściu w edycję pole wraca do oczek.
- Dymki (wyniki innych graczy) pokazują **oczka**.
- Pozostałe pola (`j1…j6`, `+`, `−`) wpisuje się wprost (bez przelicznika).
- **Wewnętrznie przechowywana jest wartość końcowa** — sumy, próg „≥ X" i maksima liczą się na niej; oczka to tylko forma wpisu i podglądu.
- Podpowiedź progu w polu: dla strit/full/kareta/poker oczkowe „≥ N"; dla **malusie** (mniej oczek = więcej punktów) „≤ N" oczek.

## Premie
### Premia za szkółkę (osobno w każdej kolumnie)
Od sumy nominałów `j1…j6` (`Rules.bonusSzkolka`):
- ≥ 60 → **+30**
- ≥ 70 → **+50**
- ≥ 80 → **+100**

### Premia za kolumnę: +200
Przyznawana, gdy w danej kolumnie spełnione są **oba** warunki:
- suma szkółki ≥ 60 — **skreślenie u góry jest dozwolone** (skreślone pole liczy się jako 0; liczy się tylko końcowa suma);
- **cały dół** (`plus, minus, strit, full, kareta, malusie, poker`) wypełniony liczbami, **bez ani jednego skreślenia** i bez pustych.

> Założenie do potwierdzenia: +200 wchodzi do sumy kolumny i jest mnożone przez wagę (jak premia za szkółkę). Jeśli ma być płaskie (poza ×waga) — jedna zmiana we wzorze niżej.

## Wynik
- **Wynik kolumny** = `(suma szkółki + premia za szkółkę + suma dołu÷10 + premia 200) × waga` (`Rules.scoreColumn`). Suma dołu jest **dzielona przez 10 i zaokrąglana**.
- **Wynik łączny gracza** = suma wyników 6 kolumn (`Rules.scoreCard`).

## Zależności między polami
- **Próg „≥ X" (między graczami)** — w danym polu wartość liczbowa nie może być niższa niż najwyższa, jaką w to samo pole wpisali **inni** gracze (`Rules.floorFor`). Pole skreślone (`X`) lub puste u innych **nie** podnosi progu. Zależność jest międzykartowa i przeliczana na żywo z aktualnego stanu sesji.
- **Para „+" / „−"** — obie wartości ≥ 20, „+" > „−"; **skreślenie jednego skreśla oba** (`Rules.crossedRows`). Odkreślenie jednego z pary czyści drugie pole, by gracz wpisał je ponownie (logika w `app.js`).
- **Premia za szkółkę** zależy od sumy `j1…j6` w tej samej kolumnie.
- **Premia +200** zależy od szkółki i kompletności dołu w tej samej kolumnie.

## Reguły walidacji (`Rules.validateCell`)
Wpis jest przyjmowany tylko, gdy przejdzie walidację:
1. **`X`** (skreślenie) — zawsze dozwolone (także poniżej progu).
2. Liczba **całkowita**, nieujemna (puste / nie-liczba / ułamek → odrzucone).
3. Nie większa niż **max** i nie mniejsza niż **min** wiersza (`Rules.MAXES`, `Rules.MINS`): full ≥ 5 oczek (25), kareta ≥ 4 (34), poker ≥ 5 (75).
4. **Dozwolone zbiory**: szkółka `j1…j6` — wielokrotność nominału (`Rules.NOMINAL`; np. dwójki 0,2,…,10); **strit** — tylko 15 lub 20 oczek (45/50); **poker** — wielokrotność 5 oczek (75,80,…,100); **kareta** — wielokrotność 4 oczek (4,8,…,24 → 34…54); **malusie** — tylko 5–8 oczek (75/70/65/60; 9+ = skreśl).
5. Nie mniejsza niż **próg „≥ X"** od innych graczy.
6. Dla `plus`/`minus`: ≥ 20 oraz zachowana relacja „+" > „−".

Pola oczkowe (strit/full/kareta/poker/malusie): wpisane **oczka** są najpierw przeliczane na **wartość końcową**, a walidacja (max, próg) działa na wartości końcowej.

Edycja własnych, już wypełnionych pól jest dozwolona — po zmianie obowiązuje ta sama walidacja.

## Skreślanie
- Wpisanie `x`/`X` (wielkość liter bez znaczenia) → pole pokazuje „X" i liczy się jako **0**.
- Skreślić można dobrowolnie lub z konieczności.
- Para „+"/„−" skreśla się wspólnie; skreślone pole przestaje wyznaczać próg „≥ X" dla innych.
- (Reguły kolejności skreślania przy stole — Anons po zapowiedzi, Drugi rzut nawet po 3. rzucie — są po stronie graczy; aplikacja ich nie pilnuje.)

## Koniec gry
Karta gracza jest **kompletna**, gdy każde z 78 pól (6 kolumn × 13 wierszy) jest wypełnione lub skreślone (`Rules.cardComplete`). Gdy kompletne są karty wszystkich graczy, `meta.status` przechodzi na `finished` i u każdego pojawia się ranking (suma punktów malejąco).

## Pokrycie testami
`test/rules.node.js` (uruchomienie: `node test/rules.node.js`) sprawdza **wszystkie reguły silnika**:
- struktura (kolumny, wiersze, maksima), losowanie wag (permutacja),
- premia za szkółkę (wszystkie progi), suma szkółki/dołu, wynik kolumny i łączny, traktowanie `X`/pustych jako 0,
- premia +200 (spełniona; <60; skreślenie w dole; puste w dole; skreślenie u góry dozwolone),
- aktywne pola każdej kolumny (Wolne/Drugi rzut/Anons, Dół, Góra, Harmonia — w tym granice i wyczerpanie),
- próg ≥ X (max innych, pominięcie siebie, ignorowanie `X`),
- walidacja (X zawsze; całkowita/nieujemna; max i min dla każdego wiersza; wielokrotność szkółki; strit 45/50; poker ×5; próg; reguły +/−),
- skreślanie pary +/−, kompletność karty.

Poza silnikiem (logika UI w `app.js`, weryfikowana ręcznie w przeglądarce): synchronizacja na żywo, dymki, zakładki/sumy, zmiana gracza, odkreślanie pary, podpięcie Firebase.
