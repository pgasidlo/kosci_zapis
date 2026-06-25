/* Testy silnika reguł (Node, bez przeglądarki).
   Pokrywają: strukturę, wagi, premie, punktację, premię +200, kolejność kolumn,
   próg ≥X, walidację (max, +/-), kompletność karty. */
const fs = require("fs");
global.window = {};
eval(fs.readFileSync(__dirname + "/../js/rules.js", "utf8"));
const R = window.Rules;

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function eq(a, b, m) { ok(a === b, m + " (oczekiwano " + b + ", jest " + a + ")"); }

function emptyGrid() { var g = {}; R.COLS.forEach(function (c) { g[c] = {}; }); return g; }
function lowerNums() { var o = {}; R.LOWER.forEach(function (r) { o[r] = (r === "plus" || r === "minus") ? 20 : 5; }); return o; }
function fullGrid() { var g = {}; R.COLS.forEach(function (c) { g[c] = {}; R.ROWS.forEach(function (r) { g[c][r] = (r === "plus" || r === "minus") ? 20 : 5; }); }); return g; }

/* ---- struktura ---- */
eq(R.COLS.length, 6, "6 kolumn");
eq(R.ROWS.length, 13, "13 wierszy");
eq(R.UPPER.length, 6, "6 wierszy szkółki");
eq(R.LOWER.length, 7, "7 wierszy dołu");
ok(R.ROWS.every(function (r) { return R.MAXES[r] != null; }), "każdy wiersz ma zdefiniowany max");

/* ---- wagi ---- */
const w = R.shuffleWeights();
ok(R.COLS.every(function (c) { return R.WEIGHTS.indexOf(w[c]) >= 0; }), "wagi z dozwolonego zbioru 8–18");
eq(new Set(R.COLS.map(function (c) { return w[c]; })).size, 6, "wagi unikalne (permutacja)");

/* ---- premia za szkółkę ---- */
[[0, 0], [59, 0], [60, 30], [69, 30], [70, 50], [79, 50], [80, 100], [105, 100]]
  .forEach(function (p) { eq(R.bonusSzkolka(p[0]), p[1], "premia szkółki(" + p[0] + ")"); });

/* ---- scoreColumn / scoreCard ---- */
var g = emptyGrid();
["j1", "j2", "j3", "j4", "j5", "j6"].forEach(function (r, i) { g.free[r] = (i + 1) * 5; }); // 5..30 = 105
var s = R.scoreColumn(g, "free", 10);
eq(s.szkolka, 105, "suma szkółki");
eq(s.premia, 100, "premia 100 przy 105");
eq(s.dol, 0, "dół 0 gdy pusto");
eq(s.wynik, (105 + 100) * 10, "wynik = (szkółka+premia+dół+200)×waga");

var gx = emptyGrid(); gx.free.j6 = 30; gx.free.j5 = "X";
eq(R.scoreColumn(gx, "free", 8).szkolka, 30, "X i puste liczą się jako 0 w sumie");

var card = emptyGrid(); card.free.j6 = 30; card.down.j6 = 30;
eq(R.scoreCard(card, { free: 10, down: 8, up: 0, harmony: 0, second: 0, anons: 0 }).total,
  30 * 10 + 30 * 8, "wynik łączny = suma wyników kolumn");

/* ---- premia +200 ---- */
function col(upper) { return Object.assign({}, upper, lowerNums()); }
eq(R.scoreColumn({ d: col({ j6: 30, j5: 25, j1: 5 }) }, "d", 8).premia200, 200, "+200: szkółka 60 i dół pełny bez skreśleń");
eq(R.scoreColumn({ d: col({ j6: 30, j5: 24 }) }, "d", 8).premia200, 0, "+200=0: szkółka 54 (<60)");
var cCross = col({ j6: 30, j5: 25, j1: 5 }); cCross.poker = "X";
eq(R.scoreColumn({ d: cCross }, "d", 8).premia200, 0, "+200=0: skreślenie w dole");
var cEmpty = col({ j6: 30, j5: 25, j1: 5 }); delete cEmpty.poker;
eq(R.scoreColumn({ d: cEmpty }, "d", 8).premia200, 0, "+200=0: puste pole w dole");
var cUp = col({ j1: "X", j2: 10, j3: 15, j4: 20, j5: 25, j6: 30 }); // szkółka = 100
eq(R.scoreColumn({ d: cUp }, "d", 8).premia200, 200, "+200: skreślenie U GÓRY dozwolone gdy szkółka ≥60");

/* ---- suma dołu ÷ 10 (zaokrąglona) ---- */
(function () {
  var c = {}; R.LOWER.forEach(function (r) { c[r] = (r === "plus" || r === "minus") ? 20 : 5; }); // raw 65
  eq(R.scoreColumn({ d: c }, "d", 1).dol, 7, "suma dołu round(65/10) = 7");
  eq(R.scoreColumn({ d: c }, "d", 2).wynik, 7 * 2, "wynik liczy ze skalowanego dołu");
})();
(function () {
  var c = {}; R.LOWER.forEach(function (r) { c[r] = (r === "plus" || r === "minus") ? 20 : 4; }); // raw 60
  eq(R.scoreColumn({ d: c }, "d", 1).dol, 6, "suma dołu round(60/10) = 6");
})();

/* ---- aktywne pola (kolejność kolumn) ---- */
eq(R.activeRows(emptyGrid(), "free").length, 13, "Wolne: wszystkie 13 aktywne");
eq(R.activeRows(emptyGrid(), "second").length, 13, "Drugi rzut: wolna kolejność");
eq(R.activeRows(emptyGrid(), "anons").length, 13, "Anons: wolna kolejność");
eq(R.activeRows(emptyGrid(), "down")[0], "j1", "Dół: najwyższe puste");
eq(R.activeRows({ down: { j1: 5 } }, "down")[0], "j2", "Dół: po j1 → j2");
eq(R.activeRows({ down: { j1: "X" } }, "down")[0], "j2", "Dół: skreślenie też przesuwa granicę");
eq(R.activeRows(emptyGrid(), "up")[0], "poker", "Góra: najniższe puste");
eq(R.activeRows({ up: { poker: 30 } }, "up")[0], "malusie", "Góra: po poker → malusie");
var ah = R.activeRows(emptyGrid(), "harmony");
ok(ah.length === 2 && ah.indexOf("j6") >= 0 && ah.indexOf("minus") >= 0, "Harmonia: start [j6, minus]");
ok(R.activeRows({ harmony: { j6: 30 } }, "harmony").indexOf("j5") >= 0, "Harmonia: po j6 w górę → j5");
ok(R.activeRows({ harmony: { minus: 20 } }, "harmony").indexOf("plus") >= 0, "Harmonia: po minus w dół → plus");
var hUp = { harmony: {} }; R.UPPER.forEach(function (r) { hUp.harmony[r] = 5; });
var ahUp = R.activeRows(hUp, "harmony");
ok(ahUp.length === 1 && ahUp[0] === "minus", "Harmonia: górna wyczerpana → tylko dół (minus)");
eq(R.activeRows(fullGrid(), "harmony").length, 0, "Harmonia: pełna kolumna → brak aktywnych");
eq(R.activeRows(fullGrid(), "down").length, 0, "Dół: pełna kolumna → brak aktywnych");
ok(R.isActive(emptyGrid(), "down", "j1") && !R.isActive(emptyGrid(), "down", "j2"), "isActive zgodne z activeRows");

/* ---- próg ≥X (floorFor) ---- */
var grids = { A: { free: { full: 30 } }, B: { free: { full: 40 } }, C: {} };
eq(R.floorFor(grids, "C", "free", "full"), 40, "floor = najwyższa wartość innych");
eq(R.floorFor(grids, "B", "free", "full"), 30, "floor pomija własną wartość");
eq(R.floorFor({ A: { free: { full: "X" } }, B: { free: { full: 25 } } }, "C", "free", "full"), 25, "floor: skreślone u innych nie liczy");
eq(R.floorFor({ A: { free: { full: "X" } } }, "C", "free", "full"), 0, "floor: same skreślenia → 0");

/* ---- walidacja ---- */
ok(R.validateCell({}, "A", "free", "full", "X").ok, "X zawsze dozwolone");
ok(!R.validateCell({}, "A", "free", "full", "").ok, "puste → błąd");
ok(!R.validateCell({}, "A", "free", "full", -1).ok, "ujemne → błąd");
ok(!R.validateCell({}, "A", "free", "full", "abc").ok, "nie-liczba → błąd");
R.ROWS.forEach(function (r) {
  ok(R.validateCell({}, "A", "free", r, R.MAXES[r]).ok, "max OK: " + r + " = " + R.MAXES[r]);
  ok(!R.validateCell({}, "A", "free", r, R.MAXES[r] + 1).ok, "powyżej max → błąd: " + r);
});
ok(!R.validateCell({ A: { free: { full: 30 } }, B: {} }, "B", "free", "full", 25).ok, "floor blokuje 25 < 30");
ok(R.validateCell({ A: { free: { full: 30 } }, B: {} }, "B", "free", "full", 30).ok, "floor dopuszcza 30");
ok(R.validateCell({ A: { free: { full: 30 } }, B: {} }, "B", "free", "full", "X").ok, "X dozwolone nawet poniżej floor");
ok(!R.validateCell({ A: {} }, "A", "free", "plus", 19).ok, "plus < 20 → błąd");
ok(R.validateCell({ A: {} }, "A", "free", "plus", 20).ok, "plus = 20 OK");
ok(!R.validateCell({ A: { free: { minus: 25 } } }, "A", "free", "plus", 24).ok, "„+” musi być > „−”");
ok(R.validateCell({ A: { free: { minus: 25 } } }, "A", "free", "plus", 30).ok, "„+” 30 > „−” 25 OK");
ok(!R.validateCell({ A: { free: { plus: 25 } } }, "A", "free", "minus", 25).ok, "„−” musi być < „+”");
ok(R.validateCell({ A: { free: { plus: 25 } } }, "A", "free", "minus", 22).ok, "„−” 22 < „+” 25 OK");

/* ---- minimalne wartości i dozwolone zbiory ---- */
ok(!R.validateCell({}, "A", "free", "full", 25.5).ok, "wartość niecałkowita → błąd");
ok(!R.validateCell({}, "A", "free", "full", 24).ok, "full < 25 (min 5 oczek) → błąd");
ok(R.validateCell({}, "A", "free", "full", 25).ok, "full 25 (5 oczek) OK");
ok(R.validateCell({}, "A", "free", "kareta", 34).ok, "kareta 34 (cztery jedynki, 4 oczka) OK");
ok(!R.validateCell({}, "A", "free", "kareta", 35).ok, "kareta 35 (nie-wielokrotność 4 oczek) → błąd");
ok(R.validateCell({}, "A", "free", "kareta", 54).ok, "kareta 54 (cztery szóstki) OK");
ok(!R.validateCell({}, "A", "free", "kareta", 55).ok, "kareta > 54 → błąd");
ok(!R.validateCell({}, "A", "free", "poker", 74).ok, "poker < 75 → błąd");
ok(!R.validateCell({}, "A", "free", "poker", 77).ok, "poker nie-wielokrotność 5 → błąd");
ok(R.validateCell({}, "A", "free", "poker", 80).ok, "poker 80 (wielokrotność 5) OK");
ok(R.validateCell({}, "A", "free", "strit", 45).ok && R.validateCell({}, "A", "free", "strit", 50).ok, "strit: 45 i 50 OK");
ok(!R.validateCell({}, "A", "free", "strit", 46).ok && !R.validateCell({}, "A", "free", "strit", 30).ok, "strit: inne wartości → błąd");
ok(R.validateCell({}, "A", "free", "j2", 0).ok && R.validateCell({}, "A", "free", "j2", 4).ok, "dwójki: 0 i 4 OK");
ok(!R.validateCell({}, "A", "free", "j2", 5).ok, "dwójki = 5 (nie-wielokrotność 2) → błąd");
ok(R.validateCell({}, "A", "free", "j3", 15).ok && !R.validateCell({}, "A", "free", "j3", 14).ok, "trójki: 15 OK, 14 błąd");
ok(R.validateCell({}, "A", "free", "malusie", 75).ok && R.validateCell({}, "A", "free", "malusie", 60).ok, "malusie 5–8 oczek (75 i 60) OK");
ok(!R.validateCell({}, "A", "free", "malusie", 55).ok, "malusie 9 oczek (55) → błąd (skreśl)");
ok(!R.validateCell({}, "A", "free", "malusie", 76).ok, "malusie powyżej 75 → błąd");

/* ---- kompletność karty ---- */
ok(!R.cardComplete(emptyGrid()), "pusta karta → niekompletna");
ok(!R.cardComplete({ free: { j1: 5 } }), "częściowa karta → niekompletna");
ok(R.cardComplete(fullGrid()), "pełna karta (liczby) → kompletna");
var fgX = fullGrid(); fgX.free.j1 = "X";
ok(R.cardComplete(fgX), "pełna karta ze skreśleniem → kompletna");

/* ---- skreślanie pary +/- ---- */
ok(R.crossedRows("plus").length === 2 && R.crossedRows("plus").indexOf("minus") >= 0, "skreślenie „+” skreśla też „−”");
ok(R.crossedRows("minus").indexOf("plus") >= 0, "skreślenie „−” skreśla też „+”");
eq(R.crossedRows("strit").length, 1, "skreślenie figury nie dotyka innych pól");

/* ---- wpisywanie oczek + bonus ---- */
eq(R.valueFromPips("strit", 15), 45, "strit: 15 oczek → 45");
eq(R.valueFromPips("strit", 20), 50, "strit: 20 → 50");
eq(R.valueFromPips("full", 7), 27, "full: 7 → 27");
eq(R.valueFromPips("kareta", 24), 54, "kareta: 24 oczka (4×6) → 54");
eq(R.valueFromPips("poker", 30), 100, "poker: 30 → 100");
eq(R.valueFromPips("malusie", 8), 60, "malusie: 8 oczek → 60");
eq(R.valueFromPips("malusie", 5), 75, "malusie: 5 → 75");
eq(R.pipsFromValue("strit", 45), 15, "strit: 45 → 15 oczek");
eq(R.pipsFromValue("poker", 100), 30, "poker: 100 → 30 oczek");
eq(R.pipsFromValue("malusie", 60), 8, "malusie: 60 → 8 oczek");
ok(R.isPipRow("strit") && R.isPipRow("malusie") && !R.isPipRow("j1") && !R.isPipRow("plus"), "isPipRow: figury z bonusem + malusie");
["strit", "full", "kareta", "poker", "malusie"].forEach(function (r) {
  eq(R.pipsFromValue(r, R.valueFromPips(r, 9)), 9, "round-trip oczka↔wartość: " + r);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
