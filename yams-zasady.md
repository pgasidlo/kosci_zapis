# Gra w kości — zasady (wariant z wagami i anonsem)

> Status: zaakceptowane 2026-06-24 (wersja robocza pod aplikację).
> Formularz / karta wyników: `yams-karta-wynikow.html`.

## Materiał i przebieg

- 5 kości sześciennych.
- **Każdy gracz ma własną kartę wyników.** Karty są jednak od siebie zależne (patrz: „Zależność między graczami").
- W turze masz **3 rzuty**: pierwszy wszystkimi kośćmi, w drugim i trzecim odkładasz wybrane i przerzucasz resztę.
- Po turze **wpisujesz wynik do jednego pola** (jedna kolumna) **albo skreślasz** pole.
- Gra trwa, aż wszystkie pola każdej kolumny są wypełnione lub skreślone.

## Kolumny (6) i wagi

Na początku gry każda kolumna dostaje **losowo jedną z wag: 8, 10, 12, 14, 16, 18** (każda waga użyta raz). Cały wynik kolumny jest mnożony przez jej wagę, więc opłaca się ładować wysokie układy do kolumn o dużej wadze.

| Kolumna | Reguła wpisywania |
|---|---|
| Wolne | dowolna kolejność |
| Dół | z góry na dół (po kolei) |
| Góra | z dołu do góry (po kolei) |
| Harmonia | start od **kreski** (środka); co turę dokładasz pole w górę **albo** w dół (rozrasta się od środka w obie strony) |
| Drugi rzut | wynik wpisujesz **po dokładnie 2 rzutach** (nie po 3) |
| Anons | po **1. rzucie** mówisz „Anons" i musisz w tej kolumnie zapisać wynik (wiersz dowolny) |

## Układ karty (wiersze, od góry)

1. **Szkółka** — nominały: jedynki, dwójki, trójki, czwórki, piątki, szóstki (suma oczek danego nominału).
2. **Suma szkółki** — liczy się sama (suma pól 1–6).
3. **Premia za szkółkę** — liczy się sama (progi niżej).
4. **─── Kreska ───** — środek planszy; stąd startuje Harmonia. To nie jest wiersz do wpisywania.
5. **+ (większe)** oraz **− (mniejsze)** — wiersze pod kreską, **niezależne od figur**.
6. **Figury**: Strit, Full, Kareta, Malusie, Poker.
7. **Suma dół**, **Premia za kolumnę (+200)**, **Wynik kolumny** — liczą się same.

## Punktacja figur

| Figura | Warunek | Punkty |
|---|---|---|
| Strit | mały lub duży (5 kolejnych) | suma 5 kości **+ 30** |
| Full | trójka + para | suma 5 kości **+ 20** |
| Kareta | 4 jednakowe | suma 5 kości **+ 30** |
| Poker | 5 jednakowych | suma 5 kości **+ 70** |
| Malusie | im mniej oczek, tym lepiej | `100 − 5 × (suma oczek)` |

Malusie — przykłady: 5 oczek → 75, 6 → 70, 7 → 65, 8 → 60 (każde oczko więcej = −5).

### Wiersze + i − (para)

- W obu polach wpisujesz **sumę 5 kości**.
- Obie wartości muszą być **≥ 20**, przy czym **„+" > „−"**.
- Obie wartości **dodają się** do sumy dołu (to nie jest różnica).
- Są **powiązane**: skreślenie jednego pola **zeruje też drugie** (oba liczą się wtedy za 0).

## Premie

- **Premia za szkółkę** (od sumy nominałów 1–6, osobno w każdej kolumnie):
  - ≥ 60 → **+30**
  - ≥ 70 → **+50**
  - ≥ 80 → **+100**
- **Premia za kolumnę: +200** — przyznawana, gdy w danej kolumnie spełnione są **oba** warunki:
  - suma szkółki (góra) **≥ 60** — skreślenie u góry jest dozwolone (skreślone pole liczy się jako 0), liczy się tylko końcowa suma;
  - **cały dół wypełniony bez ani jednego skreślenia**.

## Skreślanie

- Pole można skreślić **dobrowolnie lub z konieczności** — wtedy liczy się za **0** (w formularzu wpisujesz „x", pokazuje się „X").
- W parze **+ / −**: skreślenie jednego **zeruje oba**, a takie skreślone pole **przestaje wyznaczać próg „≥"** dla innych graczy (mogą teraz wpisać mniej).
- W kolumnach z narzuconą kolejnością (Dół, Góra, Harmonia) skreślasz **tylko bieżące pole w kolejności** — nie można przeskakiwać.
- W kolumnie **Anons** skreślić można **tylko po zapowiedzi** „Anons" (po 1. rzucie).
- Wyjątek — kolumna **Drugi rzut**: można skreślić **nawet po 3. rzucie**, gdy nie da się już nic wpisać.

## Zależność między graczami

- Każdy ma własną kartę, ale w **danym polu** (ta sama figura, ta sama kolumna) możesz wpisać wartość **nie niższą** niż **najwyższa**, którą w to samo pole wpisali już inni gracze.
- W aplikacji ma to być pokazywane **na żywo** — np. jako podpowiedź „≥ X" w pustym polu.
- Pole skreślone (X = 0) **nie wyznacza** progu „≥" dla innych.

## Liczenie wyniku

- **Wynik kolumny** = `(suma szkółki + premia za szkółkę + suma dół + premia za kolumnę 200) × waga`.
- **Wynik łączny gracza** = suma wyników 6 kolumn.

## Do potwierdzenia (założenie)

- Premia **+200** jest obecnie liczona **wewnątrz** mnożenia przez wagę (tak jak premia za szkółkę), czyli realnie daje `200 × waga`. Do ustalenia, czy ma być **płaska** (dodawana po przemnożeniu).
