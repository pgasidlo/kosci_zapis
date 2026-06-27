/* db.js — warstwa sesji na Firebase Realtime Database (compat SDK).
   Eksport jako window.DB. Wymaga wcześniej załadowanego globalu `firebase`
   oraz window.Rules. apiKey jest jawny z założenia (bezpieczeństwo robią reguły). */
(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyBlxLO15ScBAZ0EPIpvbo5EE8x56sFrO08",
    authDomain: "kosci-zapis.firebaseapp.com",
    databaseURL: "https://kosci-zapis-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kosci-zapis",
    storageBucket: "kosci-zapis.firebasestorage.app",
    messagingSenderId: "418165345293",
    appId: "1:418165345293:web:ade5737ee72fdb9f095944"
  };

  firebase.initializeApp(firebaseConfig);
  var db = firebase.database();

  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bez mylących znaków (0/O, 1/I)
  function genKey(n) {
    n = n || 6;
    var s = "";
    for (var i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }

  function sref(sid) { return db.ref("sessions/" + sid); }

  function createSession(names) {
    var sid = genKey(6);
    var players = {};
    for (var i = 0; i < names.length; i++) players["p" + i] = { name: names[i] };
    var weights = window.Rules.shuffleWeights();
    return sref(sid).set({
      meta: { status: "active", createdAt: firebase.database.ServerValue.TIMESTAMP, weights: weights },
      players: players,
      grids: {}
    }).then(function () { return sid; });
  }

  function subscribe(sid, cb) {
    var ref = sref(sid);
    var handler = ref.on("value", function (snap) { cb(snap.val()); });
    return function () { ref.off("value", handler); };
  }

  function setCell(sid, pid, col, row, value) {
    return db.ref("sessions/" + sid + "/grids/" + pid + "/" + col + "/" + row).set(value);
  }
  function setCells(sid, pid, col, obj) {
    return db.ref("sessions/" + sid + "/grids/" + pid + "/" + col).update(obj);
  }
  function clearCell(sid, pid, col, row) {
    return db.ref("sessions/" + sid + "/grids/" + pid + "/" + col + "/" + row).remove();
  }
  function setStatus(sid, status) {
    return db.ref("sessions/" + sid + "/meta/status").set(status);
  }
  function setOrder(sid, order) {
    return db.ref("sessions/" + sid + "/meta/order").set(order);
  }
  function setTurn(sid, pid) {
    return db.ref("sessions/" + sid + "/meta/turn").set(pid);
  }

  // Obecność — do ostrzeżenia „imię używane na innym urządzeniu”.
  function claimPresence(sid, pid, clientId) {
    var ref = db.ref("sessions/" + sid + "/presence/" + pid);
    ref.onDisconnect().remove();
    ref.set(clientId);
  }
  function watchPresence(sid, cb) {
    var ref = db.ref("sessions/" + sid + "/presence");
    var handler = ref.on("value", function (snap) { cb(snap.val() || {}); });
    return function () { ref.off("value", handler); };
  }
  function releasePresence(sid, pid) {
    return db.ref("sessions/" + sid + "/presence/" + pid).remove();
  }

  window.DB = {
    genKey: genKey,
    releasePresence: releasePresence,
    createSession: createSession,
    subscribe: subscribe,
    setCell: setCell,
    setCells: setCells,
    clearCell: clearCell,
    setStatus: setStatus,
    setOrder: setOrder,
    setTurn: setTurn,
    claimPresence: claimPresence,
    watchPresence: watchPresence
  };
})();
