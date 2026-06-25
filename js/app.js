/* app.js — UI i spięcie z Firebase. Wymaga window.Rules i window.DB. */
(function () {
  "use strict";
  var R = window.Rules, DB = window.DB;

  // Skrócone etykiety pod ekran telefonu (pełne nazwy idą w atrybut title).
  var COL_SYM = { free: "", down: "↓", up: "↑", harmony: "↕", second: "2rz", anons: "A" };
  var COL_FULL = {
    free: "Wolne (dowolna kolejność)", down: "Dół (z góry na dół)", up: "Góra (z dołu do góry)",
    harmony: "Harmonia (od środka w górę/dół)", second: "Drugi rzut (wpis po 2 rzutach)", anons: "Anons (zapowiedź po 1. rzucie)"
  };
  var ROW_SHORT = {
    j1: "1", j2: "2", j3: "3", j4: "4", j5: "5", j6: "6",
    plus: "+", minus: "−", strit: "strit", full: "full", kareta: "kareta", malusie: "malusie", poker: "poker"
  };

  function $app() { return document.getElementById("app"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clientId() {
    var c = localStorage.getItem("kosci_cid");
    if (!c) { c = DB.genKey(10); localStorage.setItem("kosci_cid", c); }
    return c;
  }
  function myPidFor(sid) { return localStorage.getItem("kosci_pid_" + sid); }
  function setMyPid(sid, pid) { localStorage.setItem("kosci_pid_" + sid, pid); }

  var curSid = null, curSession = null, curPresence = {}, activeTab = null;
  var unsub = null, unsubPres = null, claimed = false, errorMsg = null, errTimer = null;

  function parseHash() {
    var m = (location.hash || "").match(/#\/s\/([A-Za-z0-9]+)/);
    return m ? m[1] : null;
  }

  function route() {
    if (unsub) { unsub(); unsub = null; }
    if (unsubPres) { unsubPres(); unsubPres = null; }
    curSession = null; curPresence = {}; activeTab = null; claimed = false; errorMsg = null;
    var sid = parseHash();
    curSid = sid;
    if (!sid) { renderStart(); return; }
    $app().innerHTML = '<div class="screen"><p class="muted">Ładowanie sesji…</p></div>';
    unsub = DB.subscribe(sid, function (s) { curSession = s; onSession(); });
    unsubPres = DB.watchPresence(sid, function (p) { curPresence = p || {}; if (curSession) onSession(); });
  }

  function onSession() {
    var sid = curSid;
    if (!curSession) {
      $app().innerHTML = '<div class="screen"><h2>Nie znaleziono gry</h2><p class="muted">Sprawdź link albo zacznij nową grę.</p><p><button class="btn btn-primary" onclick="location.hash=\'\'">Nowa gra</button></p></div>';
      return;
    }
    var myPid = myPidFor(sid);
    var players = curSession.players || {};
    if (!myPid || !players[myPid]) { renderPick(sid); return; }
    if (!claimed) { DB.claimPresence(sid, myPid, clientId()); claimed = true; }
    if (!activeTab) activeTab = myPid;
    autoFinishIfDone(sid);
    renderGame(sid, myPid);
  }

  function autoFinishIfDone(sid) {
    if (!curSession.meta || curSession.meta.status === "finished") return;
    var players = curSession.players || {}, grids = curSession.grids || {}, pid;
    for (pid in players) { if (!R.cardComplete(grids[pid] || {})) return; }
    DB.setStatus(sid, "finished");
  }

  /* ---------- Ekran 1: Nowa gra ---------- */
  function renderStart() {
    var h = "";
    h += '<div class="screen">';
    h += "<h1>Kości — zapis</h1>";
    h += '<p class="sub">Dodaj graczy, utwórz grę i podaj jeden link wszystkim. Każdy gra na swoim telefonie.</p>';
    h += '<h2>Nowa gra</h2>';
    h += '<div class="name-list" id="names"></div>';
    h += '<div class="row" style="margin-bottom:14px"><button class="btn btn-sm" id="addName">+ dodaj gracza</button></div>';
    h += '<button class="btn btn-primary" id="create">Utwórz grę</button>';
    h += '<p class="err-line" id="startErr" style="display:none"></p>';
    h += "</div>";
    $app().innerHTML = h;
    addNameRow("Żaneta"); addNameRow("Anna"); addNameRow("Piotr"); addNameRow("Michał");
    document.getElementById("addName").onclick = function () { addNameRow(""); focusLastName(); };
    document.getElementById("create").onclick = doCreate;
  }
  function addNameRow(val) {
    var list = document.getElementById("names");
    var div = document.createElement("div");
    div.className = "name-row";
    div.innerHTML = '<input class="name-input" placeholder="Imię gracza" value="' + esc(val) + '"><button class="btn btn-sm" title="Usuń">✕</button>';
    div.querySelector("button").onclick = function () { div.parentNode.removeChild(div); };
    div.querySelector("input").addEventListener("keydown", function (e) { if (e.key === "Enter") doCreate(); });
    list.appendChild(div);
  }
  function focusLastName() {
    var ins = document.querySelectorAll("#names input"); if (ins.length) ins[ins.length - 1].focus();
  }
  function doCreate() {
    var ins = document.querySelectorAll("#names input"), names = [], seen = {};
    for (var i = 0; i < ins.length; i++) {
      var v = ins[i].value.trim();
      if (v && !seen[v.toLowerCase()]) { names.push(v); seen[v.toLowerCase()] = 1; }
    }
    var err = document.getElementById("startErr");
    if (names.length < 2) { err.textContent = "Dodaj co najmniej 2 graczy (różne imiona)."; err.style.display = "block"; return; }
    var btn = document.getElementById("create"); btn.disabled = true; btn.textContent = "Tworzę…";
    DB.createSession(names).then(function (sid) { location.hash = "#/s/" + sid; })
      .catch(function (e) { btn.disabled = false; btn.textContent = "Utwórz grę"; err.textContent = "Błąd: " + e.message; err.style.display = "block"; });
  }

  /* ---------- Ekran 2: Wybór imienia ---------- */
  function renderPick(sid) {
    var players = curSession.players || {};
    var h = '<div class="screen">';
    h += "<h2>Wejdź do gry</h2>";
    h += linkBoxHTML(sid);
    h += '<p class="sub">Wybierz swoje imię:</p><div class="pick-grid">';
    Object.keys(players).forEach(function (pid) {
      var busy = curPresence[pid] && curPresence[pid] !== clientId();
      h += '<button class="pick' + (busy ? " busy" : "") + '" data-pid="' + pid + '">' + esc(players[pid].name) + (busy ? ' <span class="muted">(zajęte)</span>' : "") + "</button>";
    });
    h += "</div>";
    h += '<p class="row" style="margin-top:14px"><button class="btn btn-sm" onclick="location.hash=\'\'">Nowa gra</button></p>';
    h += "</div>";
    $app().innerHTML = h;
    var btns = document.querySelectorAll(".pick");
    for (var i = 0; i < btns.length; i++) btns[i].onclick = function () {
      var pid = this.getAttribute("data-pid");
      setMyPid(sid, pid); claimed = false; activeTab = pid; onSession();
    };
    bindCopy(sid);
  }

  /* ---------- Ekran 3: Gra ---------- */
  function renderGame(sid, myPid) {
    var players = curSession.players || {}, grids = curSession.grids || {};
    var finished = curSession.meta && curSession.meta.status === "finished";
    var focus = captureFocus();

    var h = '<div class="topbar"><h1 style="margin:0">Kości — zapis</h1><span class="spacer"></span>';
    h += '<button class="btn btn-sm" id="copyBtn">Kopiuj link</button>';
    h += '<button class="btn btn-sm" id="changeBtn">Zmień gracza</button>';
    h += '<button class="btn btn-sm" onclick="if(confirm(\'Wyjść do nowej gry?\'))location.hash=\'\'">Nowa gra</button></div>';

    if (curPresence[myPid] && curPresence[myPid] !== clientId())
      h += '<div class="warn">Uwaga: pod Twoim imieniem gra ktoś jeszcze na innym urządzeniu. Wpisy mogą się nadpisywać.</div>';

    if (finished) h += rankingHTML(sid);

    var weights = (curSession.meta && curSession.meta.weights) || {};
    var totals = {}, maxT = 0;
    Object.keys(players).forEach(function (pid) {
      var t = R.scoreCard(grids[pid] || {}, weights).total;
      totals[pid] = t; if (t > maxT) maxT = t;
    });
    h += '<div class="tabs">';
    var order = [myPid].concat(Object.keys(players).filter(function (p) { return p !== myPid; }));
    order.forEach(function (pid) {
      var me = pid === myPid;
      var done = R.cardComplete(grids[pid] || {});
      var label = esc(players[pid].name);
      var lead = maxT > 0 && totals[pid] === maxT;
      h += '<button class="tab' + (pid === activeTab ? " active" : "") + (me ? " me" : "") + '" data-pid="' + pid + '">' +
        label + ' <span class="tscore' + (lead ? " lead" : "") + '">' + (lead ? "★ " : "") + totals[pid] + "</span>" +
        (done ? ' <span class="done">✓</span>' : "") + "</button>";
    });
    h += "</div>";

    if (errorMsg) h += '<div class="toast">' + esc(errorMsg) + "</div>";

    h += '<div id="cardArea">' + cardTableHTML(sid, activeTab, myPid) + "</div>";

    h += '<div class="legend">Wpisz liczbę lub <b>x</b> (skreślenie). „≥ X” = próg od innych graczy. ' +
      'Kolumny: 1. wolne · ↓ dół · ↑ góra · ↕ harmonia · 2rz drugi rzut · A anons. Przytrzymaj nagłówek lub wiersz, by zobaczyć pełny opis.</div>';

    $app().innerHTML = h;
    document.getElementById("copyBtn").onclick = function () { copyLink(sid, this); };
    document.getElementById("changeBtn").onclick = function () {
      if (!confirm("Zmienić gracza? Zwolni to Twoje imię dla innych.")) return;
      DB.releasePresence(sid, myPid);
      localStorage.removeItem("kosci_pid_" + sid);
      claimed = false; activeTab = null;
      onSession();
    };
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].onclick = function () { activeTab = this.getAttribute("data-pid"); renderGame(sid, myPid); };
    bindCardInputs(sid, myPid);
    restoreFocus(focus);
  }

  function cardTableHTML(sid, viewPid, myPid) {
    var weights = (curSession.meta && curSession.meta.weights) || {};
    var grids = curSession.grids || {};
    var grid = grids[viewPid] || {};
    var editable = (viewPid === myPid) && !(curSession.meta && curSession.meta.status === "finished");
    var score = R.scoreCard(grid, weights);

    var h = '<div class="scroll"><table class="card"><thead><tr><th class="fig"></th>';
    R.COLS.forEach(function (c) {
      h += '<th title="' + esc(COL_FULL[c]) + '"><div class="csym">' + (COL_SYM[c] || "&nbsp;") + '</div><div class="cw">×' + (weights[c] || "?") + "</div></th>";
    });
    h += "</tr></thead><tbody>";
    R.UPPER.forEach(function (r) { h += dataRow(r, grid, grids, editable, myPid, ""); });
    h += compRow("Σ", "Suma szkółki (nominały 1–6)", score, "szkolka", "tot");
    h += compRow("bonus", "Premia za szkółkę: ≥60→+30, ≥70→+50, ≥80→+100", score, "premia", "tot");
    h += '<tr class="kreska"><td colspan="7"></td></tr>';
    h += dataRow("minus", grid, grids, editable, myPid, "pair");
    h += dataRow("plus", grid, grids, editable, myPid, "pair");
    ["full", "kareta", "strit", "malusie", "poker"].forEach(function (r) { h += dataRow(r, grid, grids, editable, myPid, ""); });
    h += compRow("dół÷10", "Suma dołu ÷ 10 (zaokrąglona)", score, "dol", "tot");
    h += compRow("+200", "Premia za kolumnę: szkółka ≥60 i cały dół bez skreśleń", score, "premia200", "bonus");
    h += compRow("Σ", "Wynik kolumny = (szkółka + premia + dół + 200) × waga", score, "wynik", "win");
    h += "</tbody></table></div>";
    h += '<div class="grand"><span class="muted">Wynik łączny:</span> <span class="val">' + score.total + "</span></div>";
    return h;
  }

  function compRow(label, title, score, kind, cls) {
    var h = '<tr class="' + cls + '"><td class="fig" title="' + esc(title) + '">' + label + "</td>";
    R.COLS.forEach(function (c) { h += "<td><span class=\"out\">" + score.cols[c][kind] + "</span></td>"; });
    return h + "</tr>";
  }
  function dataRow(row, grid, grids, editable, myPid, cls) {
    var h = '<tr' + (cls ? ' class="' + cls + '"' : "") + '><td class="fig" title="' + esc(R.ROW_LABELS[row] + " — " + R.ROW_HINT[row]) + '">' + ROW_SHORT[row] + "</td>";
    R.COLS.forEach(function (c) {
      var v = (grid[c] || {})[row];
      var tip = cellOwners(grids, c, row);
      h += "<td" + (tip ? ' title="' + esc(tip) + '"' : "") + ">" + cellHTML(c, row, v, grid, grids, editable, myPid) + "</td>";
    });
    return h + "</tr>";
  }
  // Podpowiedź: czyje wyniki są już w tym polu (wszyscy gracze, którzy je wypełnili).
  function fmtCellVal(row, v) {
    if (R.isCross(v)) return "X";
    return R.isPipRow(row) ? R.pipsFromValue(row, v) : v;     // dymki pokazują oczka
  }
  function cellOwners(grids, col, row) {
    var players = (curSession && curSession.players) || {};
    var parts = [];
    Object.keys(players).forEach(function (pid) {
      var v = grids[pid] && grids[pid][col] && grids[pid][col][row];
      if (!R.isEmpty(v)) parts.push(players[pid].name + ": " + fmtCellVal(row, v));
    });
    return parts.join(" · ");
  }
  // To samo, ale bez własnych wpisów — do dymka podczas wpisywania (tylko inni gracze).
  function cellOwnersOthers(grids, col, row, myPid) {
    var players = (curSession && curSession.players) || {};
    var parts = [];
    Object.keys(players).forEach(function (pid) {
      if (pid === myPid) return;
      var v = grids[pid] && grids[pid][col] && grids[pid][col][row];
      if (!R.isEmpty(v)) parts.push(players[pid].name + ": " + fmtCellVal(row, v));
    });
    return parts.join(" · ");
  }
  function cellHTML(col, row, v, grid, grids, editable, myPid) {
    if (!editable) {
      if (R.isCross(v)) return '<span class="ro x">X</span>';
      if (R.isEmpty(v)) return '<span class="ro muted">·</span>';
      return '<span class="ro">' + esc(v) + "</span>";
    }
    if (R.isFilled(v)) {
      var cross = R.isCross(v);
      return '<input class="cinp' + (cross ? " crossed" : "") + '" data-col="' + col + '" data-row="' + row + '" value="' + (cross ? "X" : esc(v)) + '">';
    }
    if (R.isActive(grid, col, row)) {
      var ph = floorPlaceholder(row, R.floorFor(grids, myPid, col, row));
      return '<input class="cinp" data-col="' + col + '" data-row="' + row + '"' + (ph ? ' placeholder="' + ph + '"' : "") + ">";
    }
    return '<span class="locked">·</span>';
  }
  function floorPlaceholder(row, fl) {
    if (fl <= 0) return "";
    if (row === "malusie") return "≤ " + R.pipsFromValue("malusie", fl);   // mniej oczek = więcej pkt
    if (R.BONUS[row] != null) return "≥ " + R.pipsFromValue(row, fl);
    return "≥ " + fl;
  }

  function bindCardInputs(sid, myPid) {
    var ins = document.querySelectorAll("#cardArea input.cinp");
    for (var i = 0; i < ins.length; i++) {
      ins[i].addEventListener("change", function () { commit(sid, myPid, this); });
      ins[i].addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); this.blur(); } });
      ins[i].addEventListener("focus", function () {
        toPipsDisplay(this);                                  // w edycji pokazujemy oczka
        var txt = cellOwnersOthers(curSession.grids || {}, this.dataset.col, this.dataset.row, myPid);
        if (txt) showPopover(this, txt, true); else hidePopover();
      });
      ins[i].addEventListener("blur", function () { hidePopover(); toValueDisplay(this); });
    }
  }
  function toPipsDisplay(input) {
    var row = input.dataset.row;
    if (R.isPipRow(row) && input.value !== "" && !R.isCross(input.value)) {
      var n = Number(input.value);
      if (isFinite(n)) input.value = String(R.pipsFromValue(row, n));
    }
  }
  function toValueDisplay(input) {
    var row = input.dataset.row;
    if (R.isPipRow(row) && input.value !== "" && !R.isCross(input.value)) {
      var n = Number(input.value);
      if (isFinite(n)) input.value = String(R.valueFromPips(row, n));
    }
  }

  function commit(sid, myPid, input) {
    var col = input.dataset.col, row = input.dataset.row;
    var raw = (input.value || "").trim();
    var grids = curSession.grids || {};
    if (raw === "") { DB.clearCell(sid, myPid, col, row); return; }
    if (/^x$/i.test(raw)) {
      var rows = R.crossedRows(row);
      if (rows.length > 1) { var o = {}; rows.forEach(function (rr) { o[rr] = "X"; }); DB.setCells(sid, myPid, col, o); }
      else DB.setCell(sid, myPid, col, row, "X");
      return;
    }
    var n = Number(raw.replace(",", "."));
    if (!isFinite(n)) { showError("niepoprawna liczba"); return; }
    var val = R.isPipRow(row) ? R.valueFromPips(row, n) : n;   // wpisywane oczka → wartość końcowa
    var res = R.validateCell(grids, myPid, col, row, val);
    if (!res.ok) { showError(res.reason); return; }
    if (row === "plus" || row === "minus") {
      var partner = row === "plus" ? "minus" : "plus";
      var pv = grids[myPid] && grids[myPid][col] && grids[myPid][col][partner];
      if (R.isCross(pv)) {
        var obj = {}; obj[row] = val; obj[partner] = null;   // odkreślenie pary
        DB.setCells(sid, myPid, col, obj); return;
      }
    }
    DB.setCell(sid, myPid, col, row, val);
  }

  function showError(msg) {
    errorMsg = msg;
    var myPid = myPidFor(curSid);
    renderGame(curSid, myPid);
    if (errTimer) clearTimeout(errTimer);
    errTimer = setTimeout(function () { errorMsg = null; if (curSession) renderGame(curSid, myPidFor(curSid)); }, 4000);
  }

  /* ---------- Ranking ---------- */
  function rankingHTML(sid) {
    var players = curSession.players || {}, grids = curSession.grids || {};
    var weights = (curSession.meta && curSession.meta.weights) || {};
    var arr = Object.keys(players).map(function (pid) {
      return { name: players[pid].name, total: R.scoreCard(grids[pid] || {}, weights).total };
    });
    arr.sort(function (a, b) { return b.total - a.total; });
    var h = '<div class="ranking"><h2>Koniec gry — ranking</h2>';
    arr.forEach(function (p, i) {
      h += '<div class="rankrow"><span class="pos">' + (i + 1) + ". " + esc(p.name) + '</span><span class="pts">' + p.total + "</span></div>";
    });
    h += "</div>";
    return h;
  }

  /* ---------- Link / kopiowanie ---------- */
  function shareLink(sid) { return location.origin + location.pathname + "#/s/" + sid; }
  function linkBoxHTML(sid) {
    return '<div class="link-box"><span class="muted">Link dla graczy:</span> <code>' + esc(shareLink(sid)) + '</code> <button class="btn btn-sm" id="copyBtn2">Kopiuj</button></div>';
  }
  function bindCopy(sid) { var b = document.getElementById("copyBtn2"); if (b) b.onclick = function () { copyLink(sid, b); }; }
  function copyLink(sid, btn) {
    var txt = shareLink(sid);
    function done() { var o = btn.textContent; btn.textContent = "Skopiowano ✓"; setTimeout(function () { btn.textContent = o; }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { prompt("Skopiuj link:", txt); });
    else prompt("Skopiuj link:", txt);
  }

  /* ---------- Zachowanie fokusu między renderami ---------- */
  function captureFocus() {
    var a = document.activeElement;
    if (a && a.classList && a.classList.contains("cinp")) return { col: a.dataset.col, row: a.dataset.row };
    return null;
  }
  function restoreFocus(f) {
    if (!f) return;
    var el = document.querySelector('#cardArea input.cinp[data-col="' + f.col + '"][data-row="' + f.row + '"]');
    if (el) { el.focus(); var val = el.value; el.value = ""; el.value = val; }
  }

  /* ---------- Dymek (mobile): dotknięcie pola pokazuje czyje wyniki / opis ---------- */
  function ensurePopover() {
    var p = document.getElementById("cellpop");
    if (!p) { p = document.createElement("div"); p.id = "cellpop"; document.body.appendChild(p); }
    return p;
  }
  function hidePopover() { var p = document.getElementById("cellpop"); if (p) p.style.display = "none"; }
  function showPopover(target, text, above) {
    var p = ensurePopover();
    p.innerHTML = text.split(" · ").map(function (l) { return "<div>" + esc(l) + "</div>"; }).join("");
    p.style.display = "block";
    var r = target.getBoundingClientRect();
    var left = r.left + window.scrollX;
    var maxLeft = window.scrollX + document.documentElement.clientWidth - p.offsetWidth - 6;
    if (left > maxLeft) left = maxLeft;
    if (left < window.scrollX + 6) left = window.scrollX + 6;
    var top;
    if (above) {                                  // nad polem — nie zasłania wpisywania
      top = r.top + window.scrollY - p.offsetHeight - 6;
      if (top < window.scrollY + 2) top = r.bottom + window.scrollY + 6;
    } else {
      top = r.bottom + window.scrollY + 4;
    }
    p.style.left = left + "px";
    p.style.top = top + "px";
  }
  document.addEventListener("click", function (e) {
    var p = document.getElementById("cellpop");
    if (p && p.contains(e.target)) return;
    if (e.target.tagName === "INPUT") return;          // input — dymek obsługuje focus/blur
    hidePopover();
    var hit = e.target.closest && e.target.closest("#cardArea [title]");
    if (hit) { var t = hit.getAttribute("title"); if (t) showPopover(hit, t); }
  });
  window.addEventListener("scroll", hidePopover, true);

  window.addEventListener("hashchange", route);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", route);
  else route();
})();
