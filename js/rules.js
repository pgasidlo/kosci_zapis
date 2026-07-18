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
  var ROWS = ["j1","j2","j3","j4","j5","j6","minus","plus","full","kareta","strit","malusie","poker"];
  var ROW_LABELS = {
    j1:"Jedynki", j2:"Dwójki", j3:"Trójki", j4:"Czwórki", j5:"Piątki", j6:"Szóstki",
    plus:"+ (większe)", minus:"− (mniejsze)", strit:"Strit", full:"Full",
    kareta:"Kareta", malusie:"Malusie", poker:"Poker"
  };
  var ROW_HINT = {
    j1:"suma jedynek", j2:"suma dwójek", j3:"suma trójek", j4:"suma czwórek",
    j5:"suma piątek", j6:"suma szóstek",
    plus:"≥20, > „−”", minus:"≥20, < „+”", strit:"suma + 30", full:"suma + 20",
    kareta:"4 jedn.: suma 4 kości + 30", malusie:"100 − 5×oczka", poker:"5 jedn., suma + 70"
  };
  var UPPER = ["j1","j2","j3","j4","j5","j6"];                 // indeksy 0..5
  var LOWER = ["minus","plus","full","kareta","strit","malusie","poker"]; // 6..12
  var WEIGHTS = [8, 10, 12, 14, 16, 18];
  // Maksymalna możliwa liczba punktów w danym wierszu (walidacja wpisu).
  var MAXES = {
    j1: 5, j2: 10, j3: 15, j4: 20, j5: 25, j6: 30,
    plus: 30, minus: 30, strit: 50, full: 50, kareta: 54, malusie: 75, poker: 100
  };
  // Pola, w które wpisuje się OCZKA z kości; wartość końcowa liczona z bonusem/wzorem.
  // strit/full/kareta/poker: oczka + stały bonus. malusie: 100 − 5×oczka.
  var BONUS = { strit: 30, full: 20, kareta: 30, poker: 70 };
  function isPipRow(row) { return BONUS[row] != null || row === "malusie"; }
  function valueFromPips(row, pips) {
    if (BONUS[row] != null) return pips + BONUS[row];
    if (row === "malusie") return 100 - 5 * pips;
    return pips;
  }
  function pipsFromValue(row, value) {
    if (BONUS[row] != null) return value - BONUS[row];
    if (row === "malusie") return (100 - value) / 5;
    return value;
  }
  // Dolne granice (wartość końcowa) oraz wielokrotność nominału w szkółce.
  var MINS = { full: 25, kareta: 34, poker: 75 };
  var NOMINAL = { j1: 1, j2: 2, j3: 3, j4: 4, j5: 5, j6: 6 };

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
    var wynik = Math.round((szk + prem + dol + p200) * (weight || 0) / 10);  // pełny wynik ÷ 10, zaokrąglony
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

  // Efektywny próg z uwzględnieniem sprzężenia „+”/„−”: skoro „+” > „−”, cudzy wpis
  // w „−” podnosi też dolny próg mojego „+” (muszę przebić najwyższe cudze „−”).
  function floorEff(allGrids, pid, col, row) {
    var base = floorFor(allGrids, pid, col, row);
    if (row === "plus") {
      var fm = floorFor(allGrids, pid, col, "minus");
      if (fm > 0 && fm + 1 > base) base = fm + 1;
      // Własne „−” w tej kolumnie też podnosi próg: „+” musi być większe niż moje „−”.
      var own = allGrids && allGrids[pid] && allGrids[pid][col] && allGrids[pid][col]["minus"];
      if (!isEmpty(own) && !isCross(own) && numVal(own) + 1 > base) base = numVal(own) + 1;
    }
    return base;
  }

  // Walidacja proponowanej wartości. value: liczba lub "X".
  function validateCell(allGrids, pid, col, row, value) {
    if (isCross(value)) return { ok: true, cross: true };
    if (isEmpty(value)) return { ok: false, reason: "puste pole" };
    var n = Number(value);
    if (!isFinite(n) || n < 0) return { ok: false, reason: "niepoprawna liczba" };
    if (n !== Math.round(n)) return { ok: false, reason: "musi być liczbą całkowitą" };
    if (row === "malusie" && (n < 60 || n > 75)) return { ok: false, reason: "malusie: tylko 5–8 oczek (więcej — skreśl)" };
    if (MAXES[row] != null && n > MAXES[row]) {
      var maxMsg = BONUS[row] != null ? (pipsFromValue(row, MAXES[row]) + " oczek") : MAXES[row];
      return { ok: false, reason: "za dużo — max " + maxMsg };
    }
    if (MINS[row] != null && n < MINS[row]) {
      var minMsg = BONUS[row] != null ? (pipsFromValue(row, MINS[row]) + " oczek") : MINS[row];
      return { ok: false, reason: "za mało — min " + minMsg };
    }
    if (NOMINAL[row] != null && n % NOMINAL[row] !== 0) return { ok: false, reason: "musi być wielokrotnością " + NOMINAL[row] };
    if (row === "strit" && n !== 45 && n !== 50) return { ok: false, reason: "strit: tylko 15 lub 20 oczek" };
    if (row === "kareta" && (n - 30) % 4 !== 0) return { ok: false, reason: "kareta: wielokrotność 4 oczek" };
    if (row === "poker" && n % 5 !== 0) return { ok: false, reason: "poker: tylko wielokrotność 5 oczek" };

    var fl = floorEff(allGrids, pid, col, row);
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

  // Dublowanie: proporcja wyników ≥ 2× (0 vs >0 też liczy się jako dublowanie).
  function isDoubled(a, b) {
    var hi = Math.max(a, b), lo = Math.min(a, b);
    if (lo <= 0) return hi > 0;
    return hi >= 2 * lo;
  }
  // Bazowe wyniki kolumn wszystkich graczy: { pid: { col: wynik } }
  function columnBases(grids, weights, playerIds) {
    var out = {};
    for (var i = 0; i < playerIds.length; i++) {
      var pid = playerIds[i]; out[pid] = {};
      for (var c = 0; c < COLS.length; c++) {
        out[pid][COLS[c]] = scoreColumn((grids && grids[pid]) || {}, COLS[c], weights ? weights[COLS[c]] : 0).wynik;
      }
    }
    return out;
  }
  // Tabela końcowa: dla każdego gracza różnice do przeciwników (z dublowaniem),
  // finał każdej kolumny, suma końcowa oraz flagi skull/star.
  function gameStandings(allBases, playerIds) {
    var out = {};
    for (var i = 0; i < playerIds.length; i++) {
      var pid = playerIds[i], cols = {}, total = 0, skull = false, star = false;
      for (var c = 0; c < COLS.length; c++) {
        var col = COLS[c];
        var myBase = (allBases[pid] && allBases[pid][col]) || 0;
        var diffs = {}, sumDiff = 0;
        for (var j = 0; j < playerIds.length; j++) {
          var opp = playerIds[j]; if (opp === pid) continue;
          var ob = (allBases[opp] && allBases[opp][col]) || 0;
          var dbl = isDoubled(myBase, ob);
          var val = (myBase - ob) * (dbl ? 2 : 1);
          diffs[opp] = { value: val, doubled: dbl };
          sumDiff += val;
          if (dbl) { if (myBase > ob) star = true; else if (ob > myBase) skull = true; }
        }
        // Σ ost. kolumny = suma różnic do przeciwników (z dublowaniem), BEZ bazy —
        // baza jest już wliczona w każdą różnicę (mój − przeciwnik). Dzięki temu gra
        // jest zero-sum: suma ostatecznych wyników wszystkich graczy = 0.
        cols[col] = { base: myBase, diffs: diffs, final: sumDiff };
        total += sumDiff;
      }
      out[pid] = { cols: cols, total: total, skull: skull, star: star };
    }
    return out;
  }

  // Liczba kolumn, w których gracz `myPid` dubluje przeciwnika `oppPid` (stars)
  // lub jest przez niego dublowany (skulls) — z gotowych standings.
  function pairMarks(standings, myPid, oppPid) {
    var cols = (standings[myPid] && standings[myPid].cols) || {}, stars = 0, skulls = 0;
    for (var i = 0; i < COLS.length; i++) {
      var c = cols[COLS[i]], d = c && c.diffs[oppPid];
      if (d && d.doubled) { if (d.value > 0) stars++; else skulls++; }
    }
    return { stars: stars, skulls: skulls };
  }

  window.Rules = {
    COLS: COLS, COL_LABELS: COL_LABELS, COL_HINT: COL_HINT,
    ROWS: ROWS, ROW_LABELS: ROW_LABELS, ROW_HINT: ROW_HINT,
    UPPER: UPPER, LOWER: LOWER, WEIGHTS: WEIGHTS, MAXES: MAXES, MINS: MINS, NOMINAL: NOMINAL, BONUS: BONUS,
    isPipRow: isPipRow, valueFromPips: valueFromPips, pipsFromValue: pipsFromValue,
    isCross: isCross, isEmpty: isEmpty, isFilled: isFilled, numVal: numVal,
    shuffleWeights: shuffleWeights, bonusSzkolka: bonusSzkolka,
    scoreColumn: scoreColumn, scoreCard: scoreCard,
    activeRows: activeRows, isActive: isActive,
    floorFor: floorFor, floorEff: floorEff, validateCell: validateCell, cardComplete: cardComplete,
    isDoubled: isDoubled, columnBases: columnBases, gameStandings: gameStandings, pairMarks: pairMarks
  };
})();
