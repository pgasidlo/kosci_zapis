/* Testy silnika reguł (uruchamiane w Node, bez przeglądarki). */
const fs = require("fs");
global.window = {};
eval(fs.readFileSync(__dirname + "/../js/rules.js", "utf8"));
const R = window.Rules;

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

// wagi
const w = R.shuffleWeights();
ok(R.COLS.every(c => R.WEIGHTS.indexOf(w[c]) >= 0), "wagi z dozwolonego zbioru");
ok(new Set(R.COLS.map(c => w[c])).size === 6, "wagi unikalne (permutacja)");

// premia szkółki
ok(R.bonusSzkolka(59) === 0 && R.bonusSzkolka(60) === 30 && R.bonusSzkolka(70) === 50 && R.bonusSzkolka(80) === 100, "progi premii szkółki");

// scoreColumn
const grid = { free: {} };
["j1","j2","j3","j4","j5","j6"].forEach((r, i) => grid.free[r] = (i + 1) * 5); // 5..30, suma=105
let s = R.scoreColumn(grid, "free", 10);
ok(s.szkolka === 105, "suma szkółki = " + s.szkolka);
ok(s.premia === 100, "premia 100");
ok(s.dol === 0 && s.premia200 === 0, "brak dołu -> 0");
ok(s.wynik === (105 + 100) * 10, "wynik = (szk+prem)*waga = " + s.wynik);

// premia +200
const g2 = { down: {} };
["j1","j2","j3","j4","j5","j6"].forEach(r => g2.down[r] = 10); // suma=60
["plus","minus","strit","full","kareta","malusie","poker"].forEach(r => g2.down[r] = 20);
let s2 = R.scoreColumn(g2, "down", 8);
ok(s2.szkolka === 60 && s2.premia200 === 200, "premia +200 gdy szkółka>=60 i dół pełny bez skreśleń");
g2.down.poker = "X";
ok(R.scoreColumn(g2, "down", 8).premia200 === 0, "premia +200 znika przy skreśleniu w dole");

// aktywne pola
const empty = { down: {}, up: {}, free: {}, harmony: {} };
ok(R.activeRows(empty, "free").length === 13, "Wolne: wszystkie pola aktywne");
ok(R.activeRows(empty, "down")[0] === "j1", "Dół: najwyższe pole");
ok(R.activeRows(empty, "up")[0] === "poker", "Góra: najniższe pole");
let ah = R.activeRows(empty, "harmony");
ok(ah.length === 2 && ah.indexOf("j6") >= 0 && ah.indexOf("plus") >= 0, "Harmonia: dwa pola przy kresce");
let ah2 = R.activeRows({ harmony: { j6: 30 } }, "harmony");
ok(ah2.indexOf("j5") >= 0 && ah2.indexOf("plus") >= 0, "Harmonia: granica w górę przesuwa się na j5");
ok(R.activeRows({ down: { j1: 5 } }, "down")[0] === "j2", "Dół: po wpisaniu j1 aktywne j2");

// walidacja: próg ≥ X
const grids = { pA: { free: { full: 30 } }, pB: {} };
ok(R.validateCell(grids, "pB", "free", "full", 25).ok === false, "próg blokuje 25 < 30");
ok(R.validateCell(grids, "pB", "free", "full", 30).ok === true, "próg dopuszcza 30");
ok(R.validateCell(grids, "pB", "free", "full", "X").ok === true, "skreślenie zawsze dozwolone");

// walidacja: +/-
ok(R.validateCell({ pB: {} }, "pB", "free", "plus", 19).ok === false, "„+” < 20 zablokowane");
ok(R.validateCell({ pB: { free: { minus: 25 } } }, "pB", "free", "plus", 24).ok === false, "„+” musi być > „−”");
ok(R.validateCell({ pB: { free: { minus: 25 } } }, "pB", "free", "plus", 30).ok === true, "„+” 30 > „−” 25 OK");

// kompletność
ok(R.cardComplete({}) === false, "pusta karta = niekompletna");

// maksima punktów
ok(R.validateCell({ pB: {} }, "pB", "free", "j1", 6).ok === false, "jedynki max 5 (6 zablokowane)");
ok(R.validateCell({ pB: {} }, "pB", "free", "j1", 5).ok === true, "jedynki 5 OK");
ok(R.validateCell({ pB: {} }, "pB", "free", "poker", 101).ok === false, "poker max 100");
ok(R.validateCell({ pB: {} }, "pB", "free", "malusie", 80).ok === false, "malusie max 75");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
