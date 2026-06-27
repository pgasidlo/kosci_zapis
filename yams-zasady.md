# Gra w kości — zasady gry

> Reguły **gry**: jak się gra i jak gra ma się do aplikacji oraz do zapisu punktów.
> Punktacja, walidacja, pojedynki: [zapis.md](zapis.md). Aplikacja, model danych, testy: [opis.md](opis.md).
> Aplikacja: https://mgrzemow.github.io/kosci_zapis/ · Status: aktualne 2026-06-27.

## Materiał i przebieg
- **5 kości** sześciennych. **Każdy gracz ma własną kartę**; karty są zależne (próg „≥ X" — patrz zapis.md).
- Tura: **3 rzuty** (pierwszy wszystkimi, w 2. i 3. odkładasz wybrane i przerzucasz resztę). Po turze **wpisujesz wynik do jednego pola** dedykowanym pickerem (panel na dole ekranu z dużymi przyciskami i ikonkami kości ⚀⚁⚂⚃⚄⚅) albo **skreślasz** pole (przycisk X). Każdy wiersz ma własny picker dopasowany do dozwolonych wartości.
- **Kolejka:** zakładka gracza, którego kolej, ma **zieloną ramkę** — zsynchronizowana między telefonami. Tap na tę zakładkę przesuwa na następnego gracza. Próba wpisu poza swoją kolejką → komunikat błędu. Aplikacja wykrywa nierówną liczbę wpisów (różnica ≥ 2) i wyświetla ostrzeżenie. Przycisk „wstecz" w przeglądarce nie opuszcza gry bez potwierdzenia.
- **Lista gier:** ekran startowy pokazuje wszystkie gry z Firebase (data, gracze, wyniki). Kliknięcie → wejście, 🗑 → trwałe usunięcie.
- **Koniec gry:** gdy u wszystkich każde pole jest wypełnione lub skreślone → **ranking** (ostateczne wyniki malejąco) u każdego.

## Kolumny (6) i kolejność wpisywania
Na start każda kolumna dostaje **losowo jedną z wag: 8, 10, 12, 14, 16, 18** (po jednej, wspólne dla wszystkich). Waga mnoży wynik kolumny (jak dokładnie — patrz zapis.md).

| Kolumna | Kiedy / jak wpisujesz |
|---|---|
| Wolne | dowolne puste pole (dowolna kolejność) |
| Dół | z góry na dół (po kolei) |
| Góra | z dołu do góry (po kolei) |
| Harmonia | od **kreski** (środka) w górę **albo** w dół — rośnie w obie strony |
| Drugi rzut | po **dokładnie 2 rzutach** |
| Anons | po **1. rzucie** mówisz „Anons" i musisz w tej kolumnie zapisać |

## Układ karty (wiersze, od góry)
1–6 (szkółka) · Suma szkółki + Premia (liczą się same) · **─── Kreska ───** (środek, start Harmonii) · **−** i **+** (pod kreską) · figury: **Full, Kareta, Strit, Malusie, Poker** · niżej wiersze wyniku (Σ//10, różnice do przeciwników, Σ ost.).

## Figury — co to za układy kości
*(Ile punktów i jak wpisać — [zapis.md](zapis.md).)*
- **Szkółka 1–6** — kości pokazujące dany nominał (jedynki, dwójki, … szóstki).
- **+ / −** — sumy 5 kości (większa / mniejsza).
- **Strit** — 5 kolejnych (mały 1‑2‑3‑4‑5, duży 2‑3‑4‑5‑6).
- **Full** — trójka + para (pięć jednakowych też liczy się jako full).
- **Kareta** — 4 jednakowe kości.
- **Malusie** — jak najmniej oczek na 5 kościach.
- **Poker** — 5 jednakowych.

## Jak gra ma się do aplikacji
- **Aplikacja pilnuje:** kolejności w kolumnach — odblokowuje tylko legalne pola (Dół z góry, Góra z dołu, Harmonia od środka; Wolne/Anons/Drugi rzut — dowolnie); progu „≥ X" na żywo; dozwolonych wartości, premii i wyniku (patrz zapis.md); wykrycia końca gry.
- **Zostawia graczom** (apka nie widzi kości): **liczbę rzutów** i **deklarację „Anons"** — dlatego kolumny **Anons** i **Drugi rzut** mają w aplikacji dowolną kolejność.
- **Skreślanie przy stole:** w kolumnach z kolejnością skreślasz tylko bieżące pole; w **Anonsie** — po zapowiedzi; wyjątek **Drugi rzut** — można skreślić nawet po 3. rzucie. (Mechanika „X = 0" — zapis.md.)
- **Para +/−:** skreślenie jednego **nie skreśla** automatycznie drugiego — gracz musi osobno skreślić partnera w swojej turze (nie traci ruchu). Gdy partner jest skreślony, drugie pole dopuszcza tylko X.

## Jak ma się do zapisu
Wpisujesz **oczka z kości** — pole samo przelicza je na punkty. Wartości figur, premie, wynik kolumny (× waga ÷ 10), **pojedynki head‑to‑head** (różnice, dublowanie, ☠/★) oraz walidacja są w **[zapis.md](zapis.md)**.
