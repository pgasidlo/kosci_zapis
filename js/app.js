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

  // Czerwona odznaka z czaszką (opcja 11) — czytelna w małym rozmiarze.
  var SKULL_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="11" fill="#d11"/>' +
    '<path d="M12 5.4c-3.4 0-6 2.4-6 5.4 0 1.9 1 3.5 2.5 4.4V17c0 .8.6 1.4 1.4 1.4h4.2c.8 0 1.4-.6 1.4-1.4v-1.8c1.5-.9 2.5-2.5 2.5-4.4 0-3-2.6-5.4-6-5.4z" fill="#fff"/>' +
    '<circle cx="9.9" cy="11" r="1.4" fill="#d11"/><circle cx="14.1" cy="11" r="1.4" fill="#d11"/>' +
    '<path d="M12 12.8l-.8 1.6h1.6z" fill="#d11"/></svg>';

  function marksHTML(m) {
    if (!m.stars && !m.skulls) return "";
    var s = "", i;
    for (i = 0; i < m.skulls; i++) s += SKULL_SVG;
    for (i = 0; i < m.stars; i++) s += '<span class="gstar">★</span>';
    return '<span class="marks" title="★ dublujesz przeciwnika · ☠ przeciwnik dubluje Ciebie (liczba = kolumny)">' + s + "</span>";
  }

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

  var floorMode = (function () { try { return localStorage.getItem("kosci_floorMode") || "oczka"; } catch (e) { return "oczka"; } })();
  var theme = (function () { try { return localStorage.getItem("kosci_theme") || "auto"; } catch (e) { return "auto"; } })();
  function prefersDark() { try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; } }
  function applyTheme() {
    var dark = theme === "dark" || (theme !== "light" && prefersDark());
    try { document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"); } catch (e) {}
  }
  var audioCtx = null, pingPrevBefore = null, pingPrevSig = null;
  function initAudio() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; } }
    if (audioCtx && audioCtx.state === "suspended") { try { audioCtx.resume(); } catch (e) {} }
    return audioCtx;
  }
  function beep(ctx, at) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.3, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    o.connect(g); g.connect(ctx.destination);
    o.start(at); o.stop(at + 0.24);
  }
  function vibe() { try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) {} }
  function beepNow() {
    var ctx = initAudio(); if (!ctx) return;
    function play() { try { var t = ctx.currentTime; beep(ctx, t); beep(ctx, t + 0.28); } catch (e) {} }
    if (ctx.state === "suspended" && ctx.resume) { ctx.resume().then(play, play); }  // poczekaj na odblokowanie
    else play();
  }
  function ping() { vibe(); beepNow(); }

  // Zapowiedź głosowa „Twoja kolej, <imię>" (Web Speech API). Brak głosu PL → zwykły ping.
  var voiceOn = (function () { try { return localStorage.getItem("kosci_voice") !== "0"; } catch (e) { return true; } })();
  var ttsVoice = null, ttsPrimed = false;
  function pickVoice() {
    try {
      var vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      for (var i = 0; i < vs.length; i++) if ((vs[i].lang || "").toLowerCase().indexOf("pl") === 0) { ttsVoice = vs[i]; return; }
    } catch (e) {}
  }
  if (window.speechSynthesis) { pickVoice(); try { window.speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {} }
  function canSpeak() { return voiceOn && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined"; }
  function primeTTS() {   // „rozgrzewka" głosu w obrębie gestu, by późniejsza zapowiedź zagrała
    if (ttsPrimed || !window.speechSynthesis) return;
    ttsPrimed = true;
    try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); } catch (e) {}
  }
  function speakNow(text, onStarted) {
    if (!canSpeak()) return false;
    try {
      if (!ttsVoice) pickVoice();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "pl-PL"; if (ttsVoice) u.voice = ttsVoice;
      u.onstart = function () { if (onStarted) onStarted(); };
      try { window.speechSynthesis.resume(); } catch (e) {}   // wyjdź z „pauzy", w której bywa Chrome
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function doneVerb(name) { return /a\s*$/i.test(name || "") ? "skończyła" : "skończył"; }   // odmiana wg końcówki imienia
  function announceTurn(myName, prevName) {
    vibe();
    var msg = (prevName ? prevName + " " + doneVerb(prevName) + " swój ruch. " : "") + "Twoja kolej" + (myName ? ", " + myName : "");
    var started = false;
    var tried = speakNow(msg, function () { started = true; });
    if (!tried) { beepNow(); return; }
    setTimeout(function () { if (!started) beepNow(); }, 450);   // mowa w tle zablokowana → awaryjny ping
  }

  // Tryb stołowy: ekran nie gaśnie (Wake Lock) + kontekst audio trzymany „przy życiu",
  // żeby ping zagrał sam, gdy Twoja kolej, bez dotykania ekranu (dopóki apka jest na wierzchu).
  var wakeLock = null, keepNode = null, flashTimer = null;
  var tableMode = (function () { try { return localStorage.getItem("kosci_tableMode") === "1"; } catch (e) { return false; } })();
  function startKeepAlive() {
    var ctx = initAudio(); if (!ctx || keepNode) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      g.gain.value = 0.0001; o.frequency.value = 30;                 // niesłyszalne
      o.connect(g); g.connect(ctx.destination); o.start();
      keepNode = o;
    } catch (e) {}
  }
  function stopKeepAlive() { try { if (keepNode) { keepNode.stop(); keepNode = null; } } catch (e) {} }
  function acquireWakeLock() {
    if (!tableMode || wakeLock || !("wakeLock" in navigator)) return;
    try {
      navigator.wakeLock.request("screen").then(function (wl) {
        wakeLock = wl;
        wakeLock.addEventListener("release", function () { wakeLock = null; });
      }, function () {});
    } catch (e) {}
  }
  function releaseWakeLock() { try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {} }
  function applyTableMode() {
    if (tableMode) { initAudio(); startKeepAlive(); acquireWakeLock(); }
    else { stopKeepAlive(); releaseWakeLock(); }
  }
  function flashTurn() {
    try {
      var el = document.getElementById("turnBanner");
      if (!el) { el = document.createElement("div"); el.id = "turnBanner"; document.body.appendChild(el); }
      el.textContent = "🎲 Twoja kolej!";
      el.className = "show";
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(function () { el.className = ""; }, 3500);
    } catch (e) {}
  }
  // Kolejność graczy: meta.order (z domyślką = kolejność kluczy graczy).
  function getOrder(session, playerIds) {
    var o = (session && session.meta && session.meta.order) || [], res = [], i;
    for (i = 0; i < o.length; i++) if (playerIds.indexOf(o[i]) >= 0 && res.indexOf(o[i]) < 0) res.push(o[i]);
    for (i = 0; i < playerIds.length; i++) if (res.indexOf(playerIds[i]) < 0) res.push(playerIds[i]);
    return res;
  }
  function moveOrder(sid, order, pid, dir) {
    var i = order.indexOf(pid); if (i < 0) return;
    var j = dir === "up" ? i - 1 : i + 1; if (j < 0 || j >= order.length) return;
    var no = order.slice(), t = no[i]; no[i] = no[j]; no[j] = t;
    DB.setOrder(sid, no);
  }
  // Ping u "kolejnego gracza": gdy gracz przede mną w kolejności zmieni swój zapis.
  function maybePing(myPid) {
    var finished = curSession.meta && curSession.meta.status === "finished";
    var grids = curSession.grids || {}, order = getOrder(curSession, Object.keys(curSession.players || {}));
    var idx = order.indexOf(myPid);
    if (finished || idx < 0 || order.length < 2) { pingPrevBefore = null; pingPrevSig = null; return; }
    var before = order[(idx - 1 + order.length) % order.length];
    var sig = JSON.stringify(grids[before] || {});
    if (before === pingPrevBefore && pingPrevSig !== null && sig !== pingPrevSig) {
      var pls = curSession.players || {};
      announceTurn((pls[myPid] || {}).name, (pls[before] || {}).name); flashTurn();
    }
    pingPrevBefore = before; pingPrevSig = sig;
  }

  // Komórka OSTATNIEGO ruchu dowolnego gracza — podświetlana ramką u WSZYSTKICH graczy (na własnej karcie).
  var gridsSnap = null, lastMoveCell = null;
  function cellVal(grids, pid, col, row) { return grids[pid] && grids[pid][col] && grids[pid][col][row]; }
  function detectEdits() {
    var grids = curSession.grids || {};
    if (gridsSnap !== null) {
      var seen = {}, p, ci, ri, col, row;
      for (p in gridsSnap) seen[p] = 1;
      for (p in grids) seen[p] = 1;
      for (p in seen)
        for (ci = 0; ci < R.COLS.length; ci++)
          for (ri = 0; ri < R.ROWS.length; ri++) {
            col = R.COLS[ci]; row = R.ROWS[ri];
            if (cellVal(grids, p, col, row) !== cellVal(gridsSnap, p, col, row)) lastMoveCell = { col: col, row: row };
          }
    }
    gridsSnap = JSON.parse(JSON.stringify(grids));
  }

  // ── Numpad overlay (tryb pijacki) ──
  var npState = null;
  function ensureNumpad() {
    var el = document.getElementById("numpad");
    if (el) return el;
    el = document.createElement("div");
    el.id = "numpad";
    el.innerHTML = '<div class="np-head"><span class="np-field" id="npField"></span><span class="np-hint" id="npHint"></span>' +
      '<button class="np-close" data-np="close">×</button></div>' +
      '<div class="np-others" id="npOthers"></div>' +
      '<div class="np-display" id="npDisp">—</div>' +
      '<div class="np-keys">' +
      '<button data-np="1">1</button><button data-np="2">2</button><button data-np="3">3</button>' +
      '<button data-np="4">4</button><button data-np="5">5</button><button data-np="6">6</button>' +
      '<button data-np="7">7</button><button data-np="8">8</button><button data-np="9">9</button>' +
      '<button data-np="X" class="np-x">X</button><button data-np="0">0</button><button data-np="back" class="np-back">←</button></div>' +
      '<div class="np-bottom"><button class="np-ok" data-np="ok">✓ OK</button><button class="np-clr" data-np="clr">🗑</button></div>';
    el.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-np]");
      if (btn) { e.preventDefault(); e.stopPropagation(); npKey(btn.getAttribute("data-np")); }
    });
    document.body.appendChild(el);
    return el;
  }
  function checkTurn() {
    var players = curSession.players || {};
    var playerIds = Object.keys(players);
    if (playerIds.length < 2) return true;
    var turnOrder = getOrder(curSession, playerIds);
    var curTurn = (curSession.meta && curSession.meta.turn) || turnOrder[0];
    var myPid = myPidFor(curSid);
    if (curTurn !== myPid) {
      var name = players[curTurn] ? players[curTurn].name : "?";
      showError("Teraz kolej: " + name + "!");
      return false;
    }
    return true;
  }
  function openNumpad(col, row) {
    if (!checkTurn()) return;
    if (row.charAt(0) === "j") { openDicePick(col, row); return; }
    if (row === "full") { openFullPick(col, row); return; }
    if (row === "strit" || row === "kareta" || row === "poker" || row === "malusie" || row === "plus" || row === "minus") { openFigurePick(col, row); return; }
    closeDicePick();
    var grids = curSession.grids || {}, pid = myPidFor(curSid);
    var grid = grids[pid] || {};
    var v = (grid[col] || {})[row], buf = "";
    if (R.isCross(v)) buf = "X";
    else if (R.isFilled(v)) buf = String(R.isPipRow(row) ? R.pipsFromValue(row, v) : v);
    npState = {col: col, row: row, buf: buf};
    var el = ensureNumpad();
    document.getElementById("npField").textContent = (ROW_SHORT[row] || row) + " · " + (COL_SYM[col] ? COL_SYM[col] + " " : "") + (COL_FULL[col] || col);
    var fl = R.floorEff(grids, pid, col, row);
    document.getElementById("npHint").textContent = floorPlaceholder(row, fl);
    var others = cellOwnersOthers(grids, col, row, pid);
    var oEl = document.getElementById("npOthers");
    oEl.textContent = others; oEl.style.display = others ? "block" : "none";
    updateNpDisplay();
    el.classList.add("show");
    highlightNpCell();
    document.body.style.paddingBottom = (el.offsetHeight + 10) + "px";
    var inp = document.querySelector('#cardArea input.cinp[data-col="' + col + '"][data-row="' + row + '"]');
    if (inp) {
      var rect = inp.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - (el.offsetHeight || 300) - 20)
        inp.scrollIntoView({block: "center", behavior: "smooth"});
    }
  }
  function closeNumpad() {
    npState = null;
    var el = document.getElementById("numpad");
    if (el) el.classList.remove("show");
    var c = document.querySelector("td.npactive");
    if (c) c.classList.remove("npactive");
    document.body.style.paddingBottom = "";
  }
  function highlightNpCell() {
    var old = document.querySelector("td.npactive");
    if (old) old.classList.remove("npactive");
    var st = npState || dpState;
    if (!st) return;
    var inp = document.querySelector('#cardArea input.cinp[data-col="' + st.col + '"][data-row="' + st.row + '"]');
    if (inp) { var td = inp.closest("td"); if (td) td.classList.add("npactive"); }
  }
  function npKey(key) {
    if (!npState) return;
    if (key === "close") { closeNumpad(); return; }
    if (key === "clr") { DB.clearCell(curSid, myPidFor(curSid), npState.col, npState.row); closeNumpad(); return; }
    if (key === "back") { npState.buf = npState.buf.slice(0, -1); updateNpDisplay(); return; }
    if (key === "X") { npState.buf = "X"; updateNpDisplay(); return; }
    if (key === "ok") {
      var fake = {value: npState.buf, dataset: {col: npState.col, row: npState.row}};
      var ok = commit(curSid, myPidFor(curSid), fake);
      if (ok !== false) closeNumpad();
      return;
    }
    if (npState.buf === "X") npState.buf = "";
    if (npState.buf.length < 3) npState.buf += key;
    updateNpDisplay();
  }
  function updateNpDisplay() {
    var d = document.getElementById("npDisp");
    if (d) d.textContent = npState && npState.buf ? npState.buf : "—";
  }

  // ── Dice picker (szkółka j1–j6: jedno tapnięcie = gotowe) ──
  var dpState = null;
  function ensureDicePick() {
    var el = document.getElementById("dicepick");
    if (el) return el;
    el = document.createElement("div");
    el.id = "dicepick";
    el.innerHTML = '<div class="np-head"><span class="np-field" id="dpField"></span><span class="np-hint" id="dpHint"></span>' +
      '<button class="np-close" data-dpc="1">×</button></div>' +
      '<div class="np-others" id="dpOthers"></div>' +
      '<div id="dpOpts" class="dp-opts"></div>';
    el.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-dv]");
      if (btn && !btn.disabled) { e.preventDefault(); e.stopPropagation(); dpSelect(btn.getAttribute("data-dv")); return; }
      if (e.target.closest("[data-dpc]")) { e.preventDefault(); e.stopPropagation(); closeDicePick(); }
    });
    document.body.appendChild(el);
    return el;
  }
  function diceWrap(icon, count) {
    if (count <= 3) return Array(count + 1).join(icon);
    var half = Math.ceil(count / 2);
    var top = Array(half + 1).join(icon);
    var bot = Array(count - half + 1).join(icon);
    return top + "<br>" + bot;
  }
  function openDicePick(col, row) {
    closeNumpad();
    var nom = parseInt(row.charAt(1));
    var grids = curSession.grids || {}, pid = myPidFor(curSid);
    var grid = grids[pid] || {};
    var v = (grid[col] || {})[row];
    var fl = R.floorEff(grids, pid, col, row);
    dpState = {col: col, row: row};
    var el = ensureDicePick();
    document.getElementById("dpField").textContent = (ROW_SHORT[row] || row) + " · " + (COL_SYM[col] ? COL_SYM[col] + " " : "") + (COL_FULL[col] || col);
    document.getElementById("dpHint").textContent = floorPlaceholder(row, fl);
    var others = cellOwnersOthers(grids, col, row, pid);
    var oEl = document.getElementById("dpOthers");
    oEl.textContent = others; oEl.style.display = others ? "block" : "none";
    var opts = document.getElementById("dpOpts");
    opts.className = "dp-opts";
    var DICE_ICON = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    var h = "";
    for (var i = 0; i <= 5; i++) {
      var val = i * nom;
      var dis = fl > 0 && val < fl;
      var sel = R.isFilled(v) && !R.isCross(v) && Number(v) === val;
      var icon = i === 0 ? "0" : diceWrap(DICE_ICON[nom], i);
      h += '<button data-dv="' + val + '"' + (dis ? " disabled" : "") + (sel ? ' class="dp-sel"' : "") + ">" +
        '<span class="dp-dice">' + icon + "</span>" +
        '<span class="dp-val">= ' + val + "</span></button>";
    }
    h += '<button data-dv="X" class="dp-x">X</button>';
    if (R.isFilled(v)) h += '<button data-dv="" class="dp-clr">🗑</button>';
    opts.innerHTML = h;
    el.classList.add("show");
    highlightNpCell();
    document.body.style.paddingBottom = (el.offsetHeight + 10) + "px";
    var inp = document.querySelector('#cardArea input.cinp[data-col="' + col + '"][data-row="' + row + '"]');
    if (inp) {
      var rect = inp.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - (el.offsetHeight || 250) - 20)
        inp.scrollIntoView({block: "center", behavior: "smooth"});
    }
  }
  function closeDicePick() {
    dpState = null;
    var el = document.getElementById("dicepick");
    if (el) el.classList.remove("show");
    if (!npState) {
      var c = document.querySelector("td.npactive"); if (c) c.classList.remove("npactive");
      document.body.style.paddingBottom = "";
    }
  }
  function dpSelect(val) {
    if (!dpState) return;
    if (val === "") { DB.clearCell(curSid, myPidFor(curSid), dpState.col, dpState.row); closeDicePick(); return; }
    var fake = {value: val, dataset: {col: dpState.col, row: dpState.row}};
    commit(curSid, myPidFor(curSid), fake);
    closeDicePick();
  }

  // ── Figure picker (strit/kareta/poker/malusie) ──
  function openFigurePick(col, row) {
    closeNumpad();
    var grids = curSession.grids || {}, pid = myPidFor(curSid);
    var grid = grids[pid] || {};
    var v = (grid[col] || {})[row];
    var fl = R.floorEff(grids, pid, col, row);
    dpState = {col: col, row: row};
    var el = ensureDicePick();
    document.getElementById("dpField").textContent = (ROW_SHORT[row] || row) + " · " + (COL_SYM[col] ? COL_SYM[col] + " " : "") + (COL_FULL[col] || col);
    document.getElementById("dpHint").textContent = floorPlaceholder(row, fl);
    var others = cellOwnersOthers(grids, col, row, pid);
    var oEl = document.getElementById("dpOthers");
    oEl.textContent = others; oEl.style.display = others ? "block" : "none";
    var opts = document.getElementById("dpOpts");
    opts.className = "dp-opts";
    var h = "";
    if (row === "strit") {
      var so = [{p:15, lbl:"mały", d:"⚀⚁⚂⚃⚄"}, {p:20, lbl:"duży", d:"⚁⚂⚃⚄⚅"}];
      for (var s = 0; s < so.length; s++) {
        var sv = so[s].p + 30, dis = fl > 0 && sv < fl;
        var sel = R.isFilled(v) && !R.isCross(v) && Number(v) === sv;
        var dd = so[s].d, top = dd.slice(0, 3), bot = dd.slice(3);
        h += '<button data-dv="' + so[s].p + '"' + (dis ? " disabled" : "") + (sel ? ' class="dp-sel"' : "") + '>' +
          '<span class="fg-strit">' + top + '<br>' + bot + '</span>' +
          '<span class="dp-val">' + so[s].lbl + ' = ' + so[s].p + '</span></button>';
      }
    } else if (row === "kareta") {
      var DI = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
      for (var k = 1; k <= 6; k++) {
        var kp = 4 * k, kv = kp + 30, dis = fl > 0 && kv < fl;
        var sel = R.isFilled(v) && !R.isCross(v) && Number(v) === kv;
        h += '<button data-dv="' + kp + '"' + (dis ? " disabled" : "") + (sel ? ' class="dp-sel"' : "") + '>' +
          '<span class="fg-strit">' + diceWrap(DI[k], 4) + '</span>' +
          '<span class="dp-val">= ' + kp + '</span></button>';
      }
    } else if (row === "poker") {
      var DI2 = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
      for (var p = 1; p <= 6; p++) {
        var pp = 5 * p, pv = pp + 70, dis = fl > 0 && pv < fl;
        var sel = R.isFilled(v) && !R.isCross(v) && Number(v) === pv;
        h += '<button data-dv="' + pp + '"' + (dis ? " disabled" : "") + (sel ? ' class="dp-sel"' : "") + '>' +
          '<span class="fg-strit">' + diceWrap(DI2[p], 5) + '</span>' +
          '<span class="dp-val">= ' + pp + '</span></button>';
      }
    } else if (row === "malusie") {
      for (var m = 5; m <= 8; m++) {
        var mv = 100 - 5 * m, dis = fl > 0 && mv < fl;
        var sel = R.isFilled(v) && !R.isCross(v) && Number(v) === mv;
        h += '<button data-dv="' + m + '"' + (dis ? " disabled" : "") + (sel ? ' class="dp-sel"' : "") + '>' +
          '<span class="dp-dice">' + m + '</span>' +
          '<span class="dp-val">' + m + ' oczek → ' + mv + ' pkt</span></button>';
      }
    } else if (row === "plus" || row === "minus") {
      var partner = row === "plus" ? "minus" : "plus";
      var pv = grid[col] && grid[col][partner];
      if (R.isCross(pv)) {
        h += '<div class="fg-label">partner skreślony — tylko X</div>';
      } else {
        var pmMin = row === "plus" ? 21 : 20, pmMax = row === "plus" ? 30 : 29;
        for (var pm = pmMin; pm <= pmMax; pm++) {
          var dis = fl > 0 && pm < fl;
          var sel = R.isFilled(v) && !R.isCross(v) && Number(v) === pm;
          h += '<button data-dv="' + pm + '"' + (dis ? " disabled" : "") + (sel ? ' class="dp-sel"' : "") + '>' +
            '<span class="dp-dice">' + pm + '</span></button>';
        }
      }
    }
    h += '<button data-dv="X" class="dp-x">X</button>';
    if (R.isFilled(v)) h += '<button data-dv="" class="dp-clr">🗑</button>';
    opts.innerHTML = h;
    el.classList.add("show");
    highlightNpCell();
    document.body.style.paddingBottom = (el.offsetHeight + 10) + "px";
    var inp = document.querySelector('#cardArea input.cinp[data-col="' + col + '"][data-row="' + row + '"]');
    if (inp) {
      var rect = inp.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - (el.offsetHeight || 250) - 20)
        inp.scrollIntoView({block: "center", behavior: "smooth"});
    }
  }

  // ── Full picker (3×a + 2×b, dwie kolumny) ──
  function openFullPick(col, row) {
    closeNumpad();
    var grids = curSession.grids || {}, pid = myPidFor(curSid);
    var grid = grids[pid] || {};
    var v = (grid[col] || {})[row];
    var fl = R.floorEff(grids, pid, col, row);
    dpState = {col: col, row: row};
    var el = ensureDicePick();
    document.getElementById("dpField").textContent = "full · " + (COL_SYM[col] ? COL_SYM[col] + " " : "") + (COL_FULL[col] || col);
    document.getElementById("dpHint").textContent = floorPlaceholder(row, fl);
    var others = cellOwnersOthers(grids, col, row, pid);
    var oEl = document.getElementById("dpOthers");
    oEl.textContent = others; oEl.style.display = others ? "block" : "none";
    var opts = document.getElementById("dpOpts");
    opts.className = "dp-opts dp-full";
    dpState.ft = null; dpState.fp = null;
    var h = '<div class="ff"><div class="ff-col ff-tri"><div class="ff-hdr">trójka</div>';
    var FDI = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    for (var i = 1; i <= 6; i++) h += '<button class="ff-btn" data-ft="' + i + '"><span class="fg-strit">' + Array(4).join(FDI[i]) + '</span></button>';
    h += '</div><div class="ff-mid"><div class="ff-sum" id="ffSum">—</div></div><div class="ff-col"><div class="ff-hdr">para</div>';
    for (var j = 1; j <= 6; j++) h += '<button class="ff-btn" data-fp="' + j + '"><span class="fg-strit">' + Array(3).join(FDI[j]) + '</span></button>';
    h += '</div></div><div class="ff-foot">';
    h += '<button data-dv="X" class="dp-x ff-x">X</button>';
    if (R.isFilled(v)) h += '<button data-dv="" class="dp-clr">🗑</button>';
    h += '</div>';
    opts.innerHTML = h;
    opts.querySelectorAll("[data-ft]").forEach(function(btn) {
      btn.addEventListener("click", function() { fullTap("ft", parseInt(btn.dataset.ft)); });
    });
    opts.querySelectorAll("[data-fp]").forEach(function(btn) {
      btn.addEventListener("click", function() { fullTap("fp", parseInt(btn.dataset.fp)); });
    });
    el.classList.add("show");
    highlightNpCell();
    document.body.style.paddingBottom = (el.offsetHeight + 10) + "px";
    var inp = document.querySelector('#cardArea input.cinp[data-col="' + col + '"][data-row="' + row + '"]');
    if (inp) {
      var rect = inp.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - (el.offsetHeight || 250) - 20)
        inp.scrollIntoView({block: "center", behavior: "smooth"});
    }
  }

  function fullTap(side, val) {
    if (!dpState) return;
    if (side === "ft") dpState.ft = val;
    else dpState.fp = val;
    var el = document.getElementById("dpOpts");
    el.querySelectorAll("[data-ft]").forEach(function(b) { b.classList.toggle("dp-sel", parseInt(b.dataset.ft) === dpState.ft); });
    el.querySelectorAll("[data-fp]").forEach(function(b) { b.classList.toggle("dp-sel", parseInt(b.dataset.fp) === dpState.fp); });
    var sum = document.getElementById("ffSum");
    if (dpState.ft != null && dpState.fp != null) {
      var pips = 3 * dpState.ft + 2 * dpState.fp;
      sum.textContent = "= " + pips;
      var grids = curSession.grids || {}, pid = myPidFor(curSid);
      var fl = R.floorEff(grids, pid, dpState.col, dpState.row);
      var finalVal = pips + 20;
      if (fl > 0 && finalVal < fl) { sum.textContent = "< próg"; return; }
      setTimeout(function() {
        var fake = {value: String(pips), dataset: {col: dpState.col, row: dpState.row}};
        commit(curSid, myPidFor(curSid), fake);
        closeDicePick();
      }, 350);
    } else if (dpState.ft != null) {
      sum.textContent = "3×" + dpState.ft;
    } else if (dpState.fp != null) {
      sum.textContent = "2×" + dpState.fp;
    } else {
      sum.textContent = "—";
    }
  }

  var curSid = null, curSession = null, curPresence = {}, activeTab = null;
  var unsub = null, unsubPres = null, claimed = false, errorMsg = null, errTimer = null;

  function parseHash() {
    var m = (location.hash || "").match(/#\/s\/([A-Za-z0-9]+)/);
    return m ? m[1] : null;
  }

  function route() {
    closeNumpad(); closeDicePick();
    if (unsub) { unsub(); unsub = null; }
    if (unsubPres) { unsubPres(); unsubPres = null; }
    curSession = null; curPresence = {}; activeTab = null; claimed = false; errorMsg = null;
    pingPrevBefore = null; pingPrevSig = null;
    gridsSnap = null; lastMoveCell = null;
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
    maybePing(myPid);
    detectEdits();
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
    var weights = (curSession.meta && curSession.meta.weights) || {};
    var playerIds = Object.keys(players);
    var standings = R.gameStandings(R.columnBases(grids, weights, playerIds), playerIds);
    var finished = curSession.meta && curSession.meta.status === "finished";
    var focus = captureFocus();

    var h = '<div class="topbar"><h1 style="margin:0">Kości — zapis</h1><span class="spacer"></span>';
    h += '<button class="btn btn-sm" id="copyBtn">Kopiuj link</button>';
    h += '<button class="btn btn-sm" id="changeBtn">Zmień gracza</button>';
    h += '<button class="btn btn-sm" onclick="if(confirm(\'Wyjść do nowej gry?\'))location.hash=\'\'">Nowa gra</button></div>';

    if (curPresence[myPid] && curPresence[myPid] !== clientId())
      h += '<div class="warn">Uwaga: pod Twoim imieniem gra ktoś jeszcze na innym urządzeniu. Wpisy mogą się nadpisywać.</div>';

    if (!finished && playerIds.length >= 2) {
      var counts = {}, minC = Infinity, maxC = -Infinity;
      playerIds.forEach(function (pid) {
        var g = grids[pid] || {}, cnt = 0;
        R.COLS.forEach(function (c) { R.ROWS.forEach(function (r) { if (R.isFilled(g[c] && g[c][r])) cnt++; }); });
        counts[pid] = cnt;
        if (cnt < minC) minC = cnt;
        if (cnt > maxC) maxC = cnt;
      });
      if (maxC - minC >= 2) {
        var ahead = [], behind = [];
        playerIds.forEach(function (pid) {
          if (counts[pid] === maxC) ahead.push(players[pid].name + " (" + counts[pid] + ")");
          if (counts[pid] === minC) behind.push(players[pid].name + " (" + counts[pid] + ")");
        });
        h += '<div class="warn">⚠ Nierówna liczba wpisów! ' + ahead.join(", ") + " vs " + behind.join(", ") + "</div>";
      }
    }

    if (finished) h += rankingHTML(standings, myPid);

    var maxT = -Infinity;
    playerIds.forEach(function (pid) { if (standings[pid].total > maxT) maxT = standings[pid].total; });
    var turnOrder = getOrder(curSession, playerIds);
    var curTurn = (curSession.meta && curSession.meta.turn) || turnOrder[0];
    if (playerIds.indexOf(curTurn) < 0) curTurn = turnOrder[0];
    var curTurnName = players[curTurn] ? players[curTurn].name : "?";
    var isMyTurn = curTurn === myPid;
    h += '<div class="turn-bar" id="turnBar"><span class="turn-label">🎲 Kolej: <strong' + (isMyTurn ? ' class="turn-me"' : '') + '>' + esc(curTurnName) + '</strong></span></div>';
    h += '<div class="tabs">';
    var order = [myPid].concat(turnOrder.filter(function (p) { return p !== myPid; }));
    order.forEach(function (pid) {
      var me = pid === myPid, st = standings[pid];
      var done = R.cardComplete(grids[pid] || {});
      var marks = me ? "" : marksHTML(R.pairMarks(standings, myPid, pid));
      var lead = st.total === maxT;
      h += '<button class="tab' + (pid === activeTab ? " active" : "") + (me ? " me" : "") + '" data-pid="' + pid + '">' +
        marks + esc(players[pid].name) + ' <span class="tscore' + (lead ? " lead" : "") + '">' + st.total + "</span>" +
        (done ? ' <span class="done">✓</span>' : "") + "</button>";
    });
    h += "</div>";

    if (errorMsg) h += '<div class="toast">' + esc(errorMsg) + "</div>";

    h += '<div id="cardArea">' + cardTableHTML(sid, activeTab, myPid, standings) + "</div>";

    h += '<div class="legend">Wpisz liczbę lub <b>x</b> (skreślenie). „≥ X” = próg od innych graczy. ' +
      'Kolumny: 1. wolne · ↓ dół · ↑ góra · ↕ harmonia · 2rz drugi rzut · A anons. Przytrzymaj nagłówek lub wiersz, by zobaczyć pełny opis.</div>';

    h += '<div class="opts"><div class="optrow"><span>Motyw:</span>' +
      '<span class="seg2" id="themeSeg">' +
      '<button data-th="light"' + (theme === "light" ? ' class="on"' : "") + ">jasny</button>" +
      '<button data-th="dark"' + (theme === "dark" ? ' class="on"' : "") + ">ciemny</button>" +
      '<button data-th="auto"' + (theme === "auto" ? ' class="on"' : "") + ">z telefonu</button></span></div>";
    h += '<div class="optrow"><span>Próg podpowiedzi:</span>' +
      '<span class="seg2" id="floorSeg">' +
      '<button data-fm="oczka"' + (floorMode === "oczka" ? ' class="on"' : "") + ">oczka</button>" +
      '<button data-fm="punkty"' + (floorMode === "punkty" ? ' class="on"' : "") + ">punkty</button></span></div>";
    h += '<div class="optrow"><label class="tbl"><input type="checkbox" id="tableMode"' + (tableMode ? " checked" : "") + "> Tryb stołowy — nie wygaszaj ekranu i przypominaj o kolejce</label></div>";
    h += '<div class="optrow"><label class="tbl"><input type="checkbox" id="voiceOn"' + (voiceOn ? " checked" : "") + "> Zapowiedź głosem („Twoja kolej, " + esc(players[myPid].name) + "”)</label>" +
      '<button class="btn btn-sm" id="pingTest" type="button">🔔 Test</button></div>';
    h += '<div class="optrow"><span>Kolejność graczy (kolejka pingu):</span></div><div class="orderlist">';
    turnOrder.forEach(function (pid, i) {
      h += '<div class="orow' + (pid === myPid ? " me" : "") + '"><span>' + (i + 1) + ". " + esc(players[pid].name) + "</span><span>" +
        '<button class="obtn" data-mv="up" data-pid="' + pid + '"' + (i === 0 ? " disabled" : "") + ">▲</button>" +
        '<button class="obtn" data-mv="down" data-pid="' + pid + '"' + (i === turnOrder.length - 1 ? " disabled" : "") + ">▼</button></span></div>";
    });
    h += "</div></div>";

    $app().innerHTML = h;
    document.getElementById("copyBtn").onclick = function () { copyLink(sid, this); };
    document.getElementById("turnBar").onclick = function () {
      var idx = turnOrder.indexOf(curTurn);
      var next = turnOrder[(idx + 1) % turnOrder.length];
      DB.setTurn(sid, next);
    };
    document.getElementById("changeBtn").onclick = function () {
      if (!confirm("Zmienić gracza? Zwolni to Twoje imię dla innych.")) return;
      DB.releasePresence(sid, myPid);
      localStorage.removeItem("kosci_pid_" + sid);
      claimed = false; activeTab = null;
      onSession();
    };
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].onclick = function () { closeNumpad(); closeDicePick(); activeTab = this.getAttribute("data-pid"); renderGame(sid, myPid); };
    bindCardInputs(sid, myPid);
    // Swipe między kartami graczy
    (function () {
      var area = document.getElementById("cardArea");
      if (!area) return;
      var sx = null, sy = null;
      area.addEventListener("touchstart", function (e) {
        if (npState) return;
        var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      }, {passive: true});
      area.addEventListener("touchend", function (e) {
        if (sx === null || npState) return;
        var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        sx = null;
        if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
        var pids = [myPid].concat(turnOrder.filter(function (p) { return p !== myPid; }));
        var ci = pids.indexOf(activeTab);
        if (ci < 0) return;
        var ni = dx < 0 ? ci + 1 : ci - 1;
        if (ni < 0 || ni >= pids.length) return;
        closeNumpad(); activeTab = pids[ni]; renderGame(sid, myPid);
      }, {passive: true});
    })();
    var thseg = document.querySelectorAll("#themeSeg button");
    for (var thi = 0; thi < thseg.length; thi++) thseg[thi].onclick = function () { theme = this.getAttribute("data-th"); try { localStorage.setItem("kosci_theme", theme); } catch (e) {} applyTheme(); renderGame(sid, myPid); };
    var fseg = document.querySelectorAll("#floorSeg button");
    for (var fi = 0; fi < fseg.length; fi++) fseg[fi].onclick = function () { floorMode = this.getAttribute("data-fm"); try { localStorage.setItem("kosci_floorMode", floorMode); } catch (e) {} renderGame(sid, myPid); };
    var obtns = document.querySelectorAll(".obtn");
    for (var oi = 0; oi < obtns.length; oi++) obtns[oi].onclick = function () { moveOrder(sid, turnOrder, this.getAttribute("data-pid"), this.getAttribute("data-mv")); };
    var myIdxT = turnOrder.indexOf(myPid);
    var prevPidT = (myIdxT >= 0 && turnOrder.length >= 2) ? turnOrder[(myIdxT - 1 + turnOrder.length) % turnOrder.length] : null;
    var pt = document.getElementById("pingTest"); if (pt) pt.onclick = function () { primeTTS(); announceTurn(players[myPid].name, prevPidT ? players[prevPidT].name : null); };
    var vo = document.getElementById("voiceOn");
    if (vo) vo.onchange = function () { voiceOn = this.checked; try { localStorage.setItem("kosci_voice", voiceOn ? "1" : "0"); } catch (e) {} if (voiceOn) primeTTS(); };
    var tm = document.getElementById("tableMode");
    if (tm) tm.onchange = function () { tableMode = this.checked; try { localStorage.setItem("kosci_tableMode", tableMode ? "1" : "0"); } catch (e) {} applyTableMode(); };
    restoreFocus(focus);
  }

  function cardTableHTML(sid, viewPid, myPid, standings) {
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
    R.UPPER.forEach(function (r) { h += dataRow(r, grid, grids, editable, myPid, "", viewPid); });
    h += compRow("Σ", "Suma szkółki (nominały 1–6)", score, "szkolka", "tot");
    h += compRow("bonus", "Premia za szkółkę: ≥60→+30, ≥70→+50, ≥80→+100", score, "premia", "tot");
    h += '<tr class="kreska"><td colspan="7"></td></tr>';
    h += dataRow("minus", grid, grids, editable, myPid, "pair", viewPid);
    h += dataRow("plus", grid, grids, editable, myPid, "pair", viewPid);
    ["full", "kareta", "strit", "malusie", "poker"].forEach(function (r) { h += dataRow(r, grid, grids, editable, myPid, "", viewPid); });
    h += compRow("+200", "Premia za kolumnę: szkółka ≥60 i cały dół bez skreśleń", score, "premia200", "bonus");
    h += compRow("Σ//10", "Wynik kolumny = (szkółka + premia + dół + 200) × waga ÷ 10 (zaokrąglone)", score, "wynik", "win");
    var players = curSession.players || {}, st = standings[viewPid];
    Object.keys(players).forEach(function (opp) {
      if (opp === viewPid) return;
      h += '<tr class="diffrow"><td class="fig" title="różnica punktów do gracza ' + esc(players[opp].name) + '">Δ ' + esc(players[opp].name) + "</td>";
      R.COLS.forEach(function (c) { h += "<td>" + diffCell(st.cols[c].diffs[opp]) + "</td>"; });
      h += "</tr>";
    });
    h += '<tr class="finalrow"><td class="fig" title="wynik kolumny po różnicach (z dublowaniem)">Σ ost.</td>';
    R.COLS.forEach(function (c) { h += '<td><span class="out">' + st.cols[c].final + "</span></td>"; });
    h += "</tr></tbody></table></div>";
    h += '<div class="grand"><span class="muted">Wynik łączny:</span> <span class="val">' + st.total + "</span></div>";
    return h;
  }
  function diffCell(d) {
    if (!d) return '<span class="ro muted">·</span>';
    var v = d.value, s = (v > 0 ? "+" : "") + v;
    if (d.doubled) return '<span class="dd ' + (v < 0 ? "ddneg" : "ddpos") + '">' + s + "</span>";
    return '<span class="ro">' + s + "</span>";
  }

  function compRow(label, title, score, kind, cls) {
    var h = '<tr class="' + cls + '"><td class="fig" title="' + esc(title) + '">' + label + "</td>";
    R.COLS.forEach(function (c) { h += "<td><span class=\"out\">" + score.cols[c][kind] + "</span></td>"; });
    return h + "</tr>";
  }
  function dataRow(row, grid, grids, editable, myPid, cls, viewPid) {
    var h = '<tr' + (cls ? ' class="' + cls + '"' : "") + '><td class="fig" title="' + esc(R.ROW_LABELS[row] + " — " + R.ROW_HINT[row]) + '">' + ROW_SHORT[row] + "</td>";
    R.COLS.forEach(function (c) {
      var v = (grid[c] || {})[row];
      var tip = cellOwners(grids, c, row);
      var hot = lastMoveCell && viewPid === myPid && lastMoveCell.col === c && lastMoveCell.row === row;
      h += "<td" + (hot ? ' class="lastedit"' : "") + (tip ? ' title="' + esc(tip) + '"' : "") + ">" + cellHTML(c, row, v, grid, grids, editable, myPid) + "</td>";
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
      return '<input class="cinp' + (cross ? " crossed" : "") + '" readonly data-col="' + col + '" data-row="' + row + '" value="' + (cross ? "X" : esc(v)) + '">';
    }
    if (R.isActive(grid, col, row)) {
      var ph = floorPlaceholder(row, R.floorEff(grids, myPid, col, row));
      return '<input class="cinp cinp-active" readonly data-col="' + col + '" data-row="' + row + '"' + (ph ? ' placeholder="' + ph + '"' : "") + ">";
    }
    var lf = floorPlaceholder(row, R.floorEff(grids, myPid, col, row));   // próg widoczny też w polach jeszcze zablokowanych
    return '<span class="locked">' + (lf || "·") + "</span>";
  }
  function floorPlaceholder(row, fl) {
    if (fl <= 0) return "";
    if (floorMode === "punkty") return "≥ " + fl;                          // próg w punktach (z bonusem)
    if (row === "malusie") return "≤ " + R.pipsFromValue("malusie", fl);   // oczka: mniej = więcej pkt
    if (R.BONUS[row] != null) return "≥ " + R.pipsFromValue(row, fl);
    return "≥ " + fl;
  }

  function bindCardInputs(sid, myPid) {
    var ins = document.querySelectorAll("#cardArea input.cinp");
    for (var i = 0; i < ins.length; i++) {
      ins[i].addEventListener("click", function () { openNumpad(this.dataset.col, this.dataset.row); });
    }
    highlightNpCell();
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
      DB.setCell(sid, myPid, col, row, "X");
      return;
    }
    if (row === "plus" || row === "minus") {
      var partner = row === "plus" ? "minus" : "plus";
      var pv = grids[myPid] && grids[myPid][col] && grids[myPid][col][partner];
      if (R.isCross(pv)) { showError("partner skreślony — tu też tylko X"); return false; }
    }
    var n = Number(raw.replace(",", "."));
    if (!isFinite(n)) { showError("niepoprawna liczba"); return false; }
    var val = R.isPipRow(row) ? R.valueFromPips(row, n) : n;   // wpisywane oczka → wartość końcowa
    var res = R.validateCell(grids, myPid, col, row, val);
    if (!res.ok) { showError(res.reason); return false; }
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
  function rankingHTML(standings, myPid) {
    var players = curSession.players || {};
    var arr = Object.keys(players).map(function (pid) {
      return { pid: pid, name: players[pid].name, total: standings[pid].total };
    });
    arr.sort(function (a, b) { return b.total - a.total; });
    var h = '<div class="ranking"><h2>Koniec gry — ranking</h2>';
    arr.forEach(function (p, i) {
      var marks = p.pid === myPid ? "" : marksHTML(R.pairMarks(standings, myPid, p.pid));
      h += '<div class="rankrow"><span class="pos">' + (i + 1) + ". " + marks + esc(p.name) + '</span><span class="pts">' + p.total + "</span></div>";
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
    initAudio();
    var npEl = document.getElementById("numpad");
    if (npState && npEl && !npEl.contains(e.target) && !(e.target.classList && e.target.classList.contains("cinp"))) closeNumpad();
    var dpEl = document.getElementById("dicepick");
    if (dpState && dpEl && !dpEl.contains(e.target) && !(e.target.classList && e.target.classList.contains("cinp"))) closeDicePick();
    var p = document.getElementById("cellpop");
    if (p && p.contains(e.target)) return;
    if (e.target.tagName === "INPUT") return;
    hidePopover();
    var hit = e.target.closest && e.target.closest("#cardArea [title]");
    if (hit) { var t = hit.getAttribute("title"); if (t) showPopover(hit, t); }
  });
  window.addEventListener("scroll", hidePopover, true);
  function onUserGesture() { initAudio(); primeTTS(); if (tableMode) { startKeepAlive(); acquireWakeLock(); } }
  ["pointerdown", "touchend", "keydown"].forEach(function (ev) {   // odblokuj audio przy każdym geście
    window.addEventListener(ev, onUserGesture, { passive: true });
  });
  document.addEventListener("visibilitychange", function () {       // po powrocie na wierzch — wznów blokadę/audio
    if (document.visibilityState === "visible" && tableMode) { initAudio(); startKeepAlive(); acquireWakeLock(); }
  });

  window.addEventListener("hashchange", function () {
    if (location.hash && location.hash.indexOf("#/s/") === 0) {
      history.pushState({kosci: true}, "", location.href);
    }
    route();
  });
  applyTheme();
  try {
    var mqDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (mqDark) {
      var onSys = function () { if (theme === "auto") applyTheme(); };
      if (mqDark.addEventListener) mqDark.addEventListener("change", onSys);
      else if (mqDark.addListener) mqDark.addListener(onSys);
    }
  } catch (e) {}
  applyTableMode();
  window.addEventListener("beforeunload", function (e) {
    if (curSid) { e.preventDefault(); e.returnValue = ""; }
  });
  var backWarn = 0;
  window.addEventListener("popstate", function () {
    if (!curSid) { route(); return; }
    var now = Date.now();
    if (now - backWarn < 3000) { route(); return; }
    backWarn = now;
    history.pushState({kosci: true}, "", "#/s/" + curSid);
    showError("Naciśnij ← jeszcze raz, aby wyjść");
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", route);
  else route();
})();
