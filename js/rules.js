/* rules.js — czysta logika gry: punktacja, walidacja, aktywne pola.
   Bez DOM, bez Firebase. Eksport jako window.Rules. */
(function () {
  "use strict";

  var COLS = ["free", "down", "up", "harmony", "second", "anons"];
  var COL_LABELS = {
    free: "Wolne", down: "Dół", up: "Góra",
    harmony: "Harmonia", second: "Drugi rzut", anons: "Anons"
  };
  var COL_HINT = {
    free: "dowolnie", down: "z góry", up: "z dołu",
    harmony: "od środka", second: "po 2 rz.", anons: "anons"
  };

  // 13 wierszy do wpisywania, od góry do dołu (kreska jest między indeksem 5 a 6)
  var ROWS = ["j1","j2","j3","j4","j5","j6","plus","minus","strit","full","kareta","malusie","poker"];
  var ROW_LABELS = {
    j1:"Jedynki", j2:"Dwójki", j3:"Trójki", j4:"Czwórki", j5:"Piątki", j6:"Szóstki",
    plus:"+ (większe)", minus:"− (mniejsze)", strit:"Strit", full:"Full",
    kareta:"Kareta", malusie:"Malusie", poker:"Poker"
  };
  var ROW_HINT = {
    j1:"suma jedynek", j2:"suma dwójek", j3:"suma trójek", j4:"suma czwórek",
    j5:"suma piątek", j6:"suma szóstek",
    plus:"≥20, > „−”", minus:"≥20, < „+”", strit:"suma + 30", full:"suma + 20",
    kareta:"4 jedn., suma + 30", malusie:"100 − 5×oczka", poker:"5 jedn., suma + 70"
  };
  var UPPER = ["j1","j2","j3","j4","j5","j6"];                 // indeksy 0..5
  var LOWER = ["plus","minus","strit","full","kareta","malusie","poker"]; // 6..12
  var WEIGHTS = [8, 10, 12, 14, 16, 18];
  // Maksymalna możliwa liczba punktów w danym wierszu (walidacja wpisu).
  var MAXES = {
    j1: 5, j2: 10, j3: 15, j4: 20, j5: 25, j6: 30,
    plus: 30, minus: 30, strit: 50, full: 48, kareta: 60, malusie: 75, poker: 100
  };

  function isCross(v) { return v === "X" || v === "x"; }
  function isEmpty(v) { return v === undefined || v === null || v === ""; }
  function isFilled(v) { return !isEmpty(v); }                  // liczba albo X
  function numVal(v) {
    if (isEmpty(v) || isCross(v)) return 0;
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function shuffleWeights(rnd) {
    var a = WEIGHTS.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor((rnd ? rnd() : Math.random()) * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    var out = {};
    for (var k = 0; k < COLS.length; k++) out[COLS[k]] = a[k];
    return out;
  }

  function bonusSzkolka(s) { return s >= 80 ? 100 : (s >= 70 ? 50 : (s >= 60 ? 30 : 0)); }

  function colValues(grid, col) { return (grid && grid[col]) || {}; }

  function scoreColumn(grid, col, weight) {
    var cv = colValues(grid, col), i, szk = 0, dol = 0;
    for (i = 0; i < UPPER.length; i++) szk += numVal(cv[UPPER[i]]);
    var prem = bonusSzkolka(szk);
    for (i = 0; i < LOWER.length; i++) dol += numVal(cv[LOWER[i]]);
    var lowerCleanComplete = true;
    for (i = 0; i < LOWER.length; i++) {
      var v = cv[LOWER[i]];
      if (isEmpty(v) || isCross(v)) { lowerCleanComplete = false; break; }
    }
    var p200 = (szk >= 60 && lowerCleanComplete) ? 200 : 0;
    var wynik = (szk + prem + dol + p200) * (weight || 0);
    return { szkolka: szk, premia: prem, dol: dol, premia200: p200, wynik: wynik };
  }

  function scoreCard(grid, weights) {
    var cols = {}, total = 0;
    for (var i = 0; i < COLS.length; i++) {
      var s = scoreColumn(grid, COLS[i], weights ? weights[COLS[i]] : 0);
      cols[COLS[i]] = s; total += s.wynik;
    }
    return { cols: cols, total: total };
  }

  // Które puste pola wolno teraz wypełnić w danej kolumnie (zwraca listę nazw wierszy).
  function activeRows(grid, col) {
    var cv = colValues(grid, col);
    function filled(r) { return isFilled(cv[r]); }
    var i, res = [];
    if (col === "free" || col === "second" || col === "anons") {
      for (i = 0; i < ROWS.length; i++) if (!filled(ROWS[i])) res.push(ROWS[i]);
      return res;
    }
    if (col === "down") {
      for (i = 0; i < ROWS.length; i++) if (!filled(ROWS[i])) return [ROWS[i]];
      return [];
    }
    if (col === "up") {
      for (i = ROWS.length - 1; i >= 0; i--) if (!filled(ROWS[i])) return [ROWS[i]];
      return [];
    }
    if (col === "harmony") {
      for (i = 5; i >= 0; i--) { if (!filled(ROWS[i])) { res.push(ROWS[i]); break; } }   // w górę od środka
      for (i = 6; i < ROWS.length; i++) { if (!filled(ROWS[i])) { res.push(ROWS[i]); break; } } // w dół od środka
      return res;
    }
    return [];
  }

  function isActive(grid, col, row) {
    var a = activeRows(grid, col);
    for (var i = 0; i < a.length; i++) if (a[i] === row) return true;
    return false;
  }

  // Próg „≥ X”: najwyższa liczbowa wartość innych graczy w tym samym polu (X/puste nie liczą).
  function floorFor(allGrids, pid, col, row) {
    var mx = 0;
    for (var opid in allGrids) {
      if (opid === pid) continue;
      var g = allGrids[opid];
      var v = g && g[col] && g[col][row];
      if (!isEmpty(v) && !isCross(v)) { var n = numVal(v); if (n > mx) mx = n; }
    }
    return mx;
  }

  // Walidacja proponowanej wartości. value: liczba lub "X".
  function validateCell(allGrids, pid, col, row, value) {
    if (isCross(value)) return { ok: true, cross: true };
    if (isEmpty(value)) return { ok: false, reason: "puste pole" };
    var n = Number(value);
    if (!isFinite(n) || n < 0) return { ok: false, reason: "niepoprawna liczba" };
    if (MAXES[row] != null && n > MAXES[row]) return { ok: false, reason: "za dużo — max " + MAXES[row] };

    var fl = floorFor(allGrids, pid, col, row);
    if (n < fl) return { ok: false, reason: "za nisko — min. " + fl };

    if (row === "plus" || row === "minus") {
      if (n < 20) return { ok: false, reason: "„+” i „−” muszą być ≥ 20" };
      var cv = colValues(allGrids[pid], col);
      if (row === "plus") {
        var m = cv["minus"];
        if (!isEmpty(m) && !isCross(m) && !(n > numVal(m)))
          return { ok: false, reason: "„+” musi być większe niż „−”" };
      } else {
        var p = cv["plus"];
        if (!isEmpty(p) && !isCross(p) && !(numVal(p) > n))
          return { ok: false, reason: "„−” musi być mniejsze niż „+”" };
      }
    }
    return { ok: true };
  }

  function cardComplete(grid) {
    for (var c = 0; c < COLS.length; c++)
      for (var r = 0; r < ROWS.length; r++)
        if (!isFilled(grid && grid[COLS[c]] && grid[COLS[c]][ROWS[r]])) return false;
    return true;
  }

  window.Rules = {
    COLS: COLS, COL_LABELS: COL_LABELS, COL_HINT: COL_HINT,
    ROWS: ROWS, ROW_LABELS: ROW_LABELS, ROW_HINT: ROW_HINT,
    UPPER: UPPER, LOWER: LOWER, WEIGHTS: WEIGHTS,
    isCross: isCross, isEmpty: isEmpty, isFilled: isFilled, numVal: numVal,
    shuffleWeights: shuffleWeights, bonusSzkolka: bonusSzkolka,
    scoreColumn: scoreColumn, scoreCard: scoreCard,
    activeRows: activeRows, isActive: isActive,
    floorFor: floorFor, validateCell: validateCell, cardComplete: cardComplete
  };
})();
