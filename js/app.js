(() => {
  const MS_PER_MIN = 60000;
  let selectedId = null;
  let selectedTab = "overview";
  let follow = false;
  let boardCode = null;
  const hiddenOps = new Set();
  let delayedOnly = false;
  let spot = null;
  let spotPin = false;
  let spotMarker = null;
  let spotFx = null;
  let spotListDirty = true;
  let insightsOpen = false;
  let liveBounds = null;
  let lifelist = lsLoad("rr_life", { units: [], classes: [], routes: [], stations: [] });
  let watch = lsLoad("rr_watch", []);
  let alertsOn = false;
  let scenicLayer = null;
  let notifiedPasses = new Set();
  let hashApplying = false;

  const EN = (() => {
    let cfg = "";
    try { cfg = localStorage.getItem("rr_mode") || ""; } catch (_e) {}
    const parts = cfg.split("|");
    if (parts[0] === "live" && typeof LiveEngine !== "undefined") {
      if (parts[1]) LiveEngine.setSource(parts[1]);
      return LiveEngine;
    }
    return Sim;
  })();

  function lsLoad(key, def) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (_e) { return def; }
  }
  function lsSave(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_e) {} }

  const trainMarkers = new Map();
  const stationMarkers = new Map();
  let trail = null;

  const BASEMAPS = {
    dark: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
      className: "darkened"
    },
    standard: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
      maxZoom: 18
    }
  };
  let baseLayer = null;
  let ormLayer = null;

  const $ = (id) => document.getElementById(id);

  const map = L.map("map", { zoomControl: true, attributionControl: true, worldCopyJump: false });
  setBasemap("dark");

  function setBasemap(key) {
    if (baseLayer) { map.removeLayer(baseLayer); baseLayer = null; }
    const cfg = BASEMAPS[key];
    if (!cfg) return;
    const opts = { attribution: cfg.attribution, maxZoom: cfg.maxZoom };
    if (cfg.subdomains) opts.subdomains = cfg.subdomains;
    if (cfg.className) opts.className = cfg.className;
    baseLayer = L.tileLayer(cfg.url, opts).addTo(map);
  }

  function init() {
    EN.init();
    map.fitBounds([[24.5, -127], [57, 2]]);
    liveBounds = null;
    try {
      const b = map.getBounds();
      if (b && [b.getWest(), b.getEast(), b.getNorth(), b.getSouth()].every(isFinite)) liveBounds = b;
    } catch (_e) {}
    if (!liveBounds) liveBounds = L.latLngBounds([[24.5, -127], [57, 2]]);
    map.on("moveend", updateHomeBtn);
    buildStations();
    buildOperatorList();
    buildSpeedButtons();
    wireUI();
    updateLabels();
    map.on("zoomend", updateLabels);
    map.on("click", (e) => {
      if (spotPin) { setSpot({ lat: e.latlng.lat, lng: e.latlng.lng }); setSpotPin(false); }
    });
    try { const s = JSON.parse(localStorage.getItem("rr_spot")); if (s && typeof s.lat === "number") spot = s; } catch (_e) {}
    if (spot) dropSpotMarker();
    updateSpotStat();
    setInterval(loop, 250);
    setInterval(renderFeed, 1500);
    setInterval(renderSpotList, 4000);
    setInterval(checkAlerts, 5000);
    applyHash();
    window.addEventListener("hashchange", () => { if (!hashApplying) applyHash(); });
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (_e) {}
    }
  }

  function buildStations() {
    for (const [code, st] of Object.entries(STATIONS)) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="stn-dot ${st.size === 3 ? "big" : ""}" style="width:${st.size === 3 ? 12 : 8}px;height:${st.size === 3 ? 12 : 8}px"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6]
      });
      const m = L.marker([st.lat, st.lng], { icon })
        .addTo(map)
        .bindTooltip(st.name, { permanent: true, direction: "right", offset: [7, 0], className: "stn-label" })
        .on("click", () => openBoard(code));
      stationMarkers.set(code, m);
    }
  }

  function inLiveView() {
    if (!liveBounds) return true;
    try {
      const b = map.getBounds();
      if (!b || ![b.getWest(), b.getEast(), b.getNorth(), b.getSouth()].every(isFinite)) return true;
      const T = 0.02;
      return Math.abs(b.getWest() - liveBounds.getWest()) < T && Math.abs(b.getEast() - liveBounds.getEast()) < T
        && Math.abs(b.getNorth() - liveBounds.getNorth()) < T && Math.abs(b.getSouth() - liveBounds.getSouth()) < T;
    } catch (_e) { return true; }
  }

  function updateHomeBtn() {
    const btn = $("homebtn");
    if (btn) btn.classList.toggle("hidden", inLiveView());
  }

  function goLive() {
    follow = false;
    const cb = $("follow");
    if (cb) cb.checked = false;
    const ok = liveBounds && [liveBounds.getWest(), liveBounds.getEast(), liveBounds.getNorth(), liveBounds.getSouth()].every(isFinite);
    let sized = false;
    try { const s = map.getSize(); sized = !!(s && s.x > 0 && s.y > 0); } catch (_e) {}
    try {
      if (ok && sized) map.flyToBounds(liveBounds, { duration: 0.8 });
      else if (ok) map.fitBounds(liveBounds, { animate: false });
      else map.fitBounds([[24.5, -127], [57, 2]], { animate: false });
    } catch (_e) {
      try { const c = liveBounds && liveBounds.getCenter ? liveBounds.getCenter() : null; if (c && isFinite(c.lat) && isFinite(c.lng)) map.setView([c.lat, c.lng], 5, { animate: false }); } catch (_e2) {}
    }
    updateHomeBtn();
  }

  function updateLabels() {
    const z = map.getZoom();
    document.body.classList.toggle("z-low", z < 6);
    document.body.classList.toggle("z-mid", z < 5);
  }

  function buildOperatorList() {
    const box = $("oplist");
    box.innerHTML = "";
    for (const region of REGIONS) {
      const hdr = document.createElement("div");
      hdr.className = "opregion";
      hdr.textContent = region.name;
      box.appendChild(hdr);
      for (const [id, op] of Object.entries(OPERATORS).filter(([, o]) => o.region === region.id)) {
      const row = document.createElement("div");
      row.className = "oprow";
      row.dataset.op = id;
      row.innerHTML = `<span class="dot" style="background:${op.color}"></span><span class="nm">${op.name}</span><span class="cnt">0</span>`;
      row.addEventListener("click", () => {
        if (hiddenOps.has(id)) hiddenOps.delete(id); else hiddenOps.add(id);
        row.classList.toggle("off", hiddenOps.has(id));
      });
      box.appendChild(row);
      }
    }
  }

  function buildSpeedButtons() {
    const box = $("speedbtns");
    for (const m of SPEED_MULTIPLIERS) {
      const b = document.createElement("button");
      b.className = "ctl" + (m === 1 ? " active" : "");
      b.textContent = m + "x";
      b.addEventListener("click", () => {
        EN.setSpeed(m);
        box.querySelectorAll(".ctl").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
      });
      box.appendChild(b);
    }
  }

  function updateModeChip() {
    const chip = $("modechip");
    if (!chip) return;
    const isLive = EN !== Sim;
    chip.textContent = isLive ? (EN.lastError ? "LIVE \u26a0" : "LIVE") : "SIM";
    chip.classList.toggle("on", isLive);
    chip.classList.toggle("stale", isLive && !!EN.lastError);
    chip.title = isLive
      ? (EN.lastError ? "Live feed problem: " + EN.lastError : "Live Amtrak data via server.js — click for data source settings")
      : "Simulated schedule — click to switch to live Amtrak data";
  }

  function openMode() {
    const isLive = EN !== Sim;
    $("modesim").checked = !isLive;
    $("modelive").checked = isLive;
    let src = "api/live";
    try {
      const parts = (localStorage.getItem("rr_mode") || "").split("|");
      if (parts[1]) src = parts[1];
    } catch (_e) {}
    $("modesrc").value = isLive ? src : "";
    $("mode").classList.remove("hidden");
  }
  function closeMode() { $("mode").classList.add("hidden"); }
  function saveMode() {
    const live = $("modelive").checked;
    const src = ($("modesrc").value || "api/live").trim() || "api/live";
    try { localStorage.setItem("rr_mode", live ? "live|" + src : "sim"); } catch (_e) {}
    location.reload();
  }

  function wireUI() {
    $("pausebtn").addEventListener("click", () => {
      EN.setPaused(!EN.paused);
      $("pausebtn").innerHTML = EN.paused ? "&#9654;" : "&#10074;&#10074;";
    });
    $("modechip").addEventListener("click", openMode);
    $("modeclose").addEventListener("click", closeMode);
    $("modesave").addEventListener("click", saveMode);
    $("closebtn").addEventListener("click", () => {
      selectedId = null;
      $("detail").classList.add("hidden");
      if (trail) { trail.remove(); trail = null; }
      updMarkerSel();
      writeHash();
    });
    $("boardclose").addEventListener("click", closeBoard);
    $("board").addEventListener("click", (e) => { if (e.target === $("board")) closeBoard(); });
    $("follow").addEventListener("change", (e) => { follow = e.target.checked; });
    $("delayedOnly").addEventListener("change", (e) => { delayedOnly = e.target.checked; });
    $("basemap").addEventListener("change", (e) => setBasemap(e.target.value));
    $("ormtoggle").addEventListener("change", (e) => {
      if (e.target.checked && !ormLayer) {
        ormLayer = L.tileLayer("https://{s}.tile.openrailwaymap.org/standard/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenRailwayMap (CC-BY-SA) &copy; OpenStreetMap contributors",
          subdomains: "ab", maxZoom: 19, opacity: 0.85
        });
      }
      if (e.target.checked) ormLayer.addTo(map);
      else if (ormLayer) map.removeLayer(ormLayer);
    });
    document.querySelectorAll("#tabs .tab").forEach(b => {
      b.addEventListener("click", () => {
        document.querySelectorAll("#tabs .tab").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        selectedTab = b.dataset.tab;
        document.querySelectorAll(".tabpage").forEach(p => p.classList.add("hidden"));
        $("tab-" + selectedTab).classList.remove("hidden");
        if (selectedId) {
          const t = EN.trainById(selectedId);
          if (t) renderTab(t);
        }
      });
    });
    const search = $("search");
    search.addEventListener("input", () => renderSearch(search.value));
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const first = $("results").querySelector(".res"); if (first) first.click(); }
      if (e.key === "Escape") { $("results").classList.add("hidden"); search.blur(); }
    });
    document.addEventListener("click", (e) => {
      if (!$("searchwrap").contains(e.target)) $("results").classList.add("hidden");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== search) { e.preventDefault(); search.focus(); }
      if (e.key === "Escape") { closeBoard(); closeInsights(); closeMode(); }
      if (e.key.toLowerCase() === "i" && document.activeElement !== search && document.activeElement.tagName !== "INPUT") {
        if (insightsOpen) closeInsights(); else openInsights();
      }
      const free = document.activeElement !== search && document.activeElement.tagName !== "INPUT";
      if (free && e.key === "?") { if ($("keys").classList.contains("hidden")) openKeys(); else closeKeys(); }
      if (free && e.key.toLowerCase() === "k") { if ($("keys").classList.contains("hidden")) openKeys(); else closeKeys(); }
      if (free && e.key.toLowerCase() === "p") { EN.setPaused(!EN.paused); $("pausebtn").innerHTML = EN.paused ? "&#9654;" : "&#10074;&#10074;"; }
      if (free && e.key.toLowerCase() === "g") goLive();
      if (free && e.key.toLowerCase() === "l") { if ($("lifelist").classList.contains("hidden")) openLife(); else closeLife(); }
      if (free && e.key.toLowerCase() === "f" && selectedId) { follow = !follow; $("follow").checked = follow; }
      if (e.key === "Escape") closeKeys();
    });
    $("homebtn").addEventListener("click", goLive);
    $("insightsbtn").addEventListener("click", () => { if (insightsOpen) closeInsights(); else openInsights(); });
    $("insightsclose").addEventListener("click", closeInsights);
    $("insights").addEventListener("click", (e) => { if (e.target.id === "insights") closeInsights(); });
    $("spotgeo").addEventListener("click", () => {
      if (typeof navigator === "undefined" || !navigator.geolocation) { updateSpotStat("Geolocation unavailable — pin your spot on the map instead."); return; }
      updateSpotStat("Requesting your location…");
      navigator.geolocation.getCurrentPosition(
        (pos) => { setSpot({ lat: pos.coords.latitude, lng: pos.coords.longitude }); map.setView([spot.lat, spot.lng], map.getZoom()); },
        () => updateSpotStat("Location denied — pin your spot on the map instead.")
      );
    });
    $("spotpin").addEventListener("click", () => setSpotPin(!spotPin));
    $("spotradius").addEventListener("change", () => { if (spot) renderSpotList(); });
    $("menubtn").addEventListener("click", () => document.body.classList.toggle("panel-open"));
    $("scenictoggle").addEventListener("change", buildScenic);
    $("listbtn").addEventListener("click", openLife);
    $("lifeclose").addEventListener("click", closeLife);
    $("lifelist").addEventListener("click", (e) => { if (e.target.id === "lifelist") closeLife(); });
    $("helpbtn").addEventListener("click", openKeys);
    $("keysclose").addEventListener("click", closeKeys);
    $("keys").addEventListener("click", (e) => { if (e.target.id === "keys") closeKeys(); });
    $("watchbtn").addEventListener("click", () => { if (selectedId) { const t = EN.trainById(selectedId); if (t) toggleWatch(t.routeId, t); } });
    $("seenbtn").addEventListener("click", () => { if (selectedId) { const t = EN.trainById(selectedId); if (t) toggleLifeEntry("units", t.stockId + "::" + t.unitNumber); } });
    $("riddenbtn").addEventListener("click", () => { if (selectedId) { const t = EN.trainById(selectedId); if (t) toggleLifeEntry("routes", t.routeId); } });
    $("visitbtn").addEventListener("click", () => { if (boardCode) toggleLifeEntry("stations", boardCode); });
    $("alerttoggle").addEventListener("change", (e) => {
      alertsOn = e.target.checked;
      if (!alertsOn) return;
      if (typeof Notification === "undefined") { updateSpotStat("Notifications are not supported in this browser."); alertsOn = false; $("alerttoggle").checked = false; return; }
      if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => {
          if (p !== "granted") { alertsOn = false; $("alerttoggle").checked = false; updateSpotStat("Notification permission denied — pass alerts stay off."); }
        });
      }
    });
    $("addics").addEventListener("click", icsExport);
  }

  function trainVisible(t) {
    if (t.state !== "run" && t.state !== "dwell") return false;
    if (hiddenOps.has(t.opId)) return false;
    if (delayedOnly && EN.trainDelayMs(t) < MS_PER_MIN) return false;
    return true;
  }

  function trainColor(t) {
    const delay = EN.trainDelayMs(t);
    if (delay > 5 * MS_PER_MIN) return "#ff5c5c";
    if (t.state === "dwell") return "#ffc53d";
    return "#39d98a";
  }

  function ensureMarker(t) {
    let m = trainMarkers.get(t.id);
    if (!m) {
      const cls = t.type === "freight" ? "trn frt" : t.type === "heritage" ? "trn stm" : "trn";
      const shape = t.type === "freight"
        ? `<path d="M3.5 6.5 L14 6.5 L16.5 10 L14 13.5 L3.5 13.5 L1.5 10 Z" fill="${trainColor(t)}" stroke="rgba(0,0,0,.55)" stroke-width="1"/>`
        : t.type === "heritage"
          ? `<circle cx="10" cy="10" r="7" fill="${trainColor(t)}" stroke="rgba(0,0,0,.55)" stroke-width="1.4"/><circle cx="10" cy="10" r="2.6" fill="rgba(0,0,0,.5)"/>`
          : `<path d="M10 1 L17.5 17.5 L10 13.4 L2.5 17.5 Z" fill="${trainColor(t)}" stroke="rgba(0,0,0,.55)" stroke-width="1"/>`;
      const icon = L.divIcon({ className: "", html: `<div class="${cls}" aria-label="${t.headcode}" role="img"><svg viewBox="0 0 20 20">${shape}</svg></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
      m = L.marker(map.getCenter(), { icon, zIndexOffset: 500 })
        .addTo(map)
        .bindTooltip(t.headcode, { permanent: true, direction: "right", offset: [10, 0], className: "train-label", opacity: 0.9 })
        .on("click", () => selectTrain(t.id));
      trainMarkers.set(t.id, m);
    }
    return m;
  }

  function pruneMarkers() {
    const live = new Set();
    for (const t of EN.trains()) if (trainVisible(t)) live.add(t.id);
    for (const [id, m] of trainMarkers) {
      if (!live.has(id)) { m.remove(); trainMarkers.delete(id); }
    }
  }

  function updMarkerSel() {
    for (const [id, m] of trainMarkers) {
      const el = m.getElement();
      if (el) el.querySelector(".trn").classList.toggle("sel", id === selectedId);
    }
  }

  function fmtClock(ms) {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function plate(headcode, code) {
    let h = 0;
    const s = headcode + code;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 1 + (h % 12);
  }

  function fmtHm(ms) { return EN.fmtTime(ms); }

  function deltaTag(actual, sched) {
    if (actual == null) return `<span class="dim-note">—</span>`;
    const d = actual - sched;
    if (d <= 30000) return `<span class="tag good">On time</span>`;
    if (d < 5 * MS_PER_MIN) return `<span class="tag warn">${Math.round(d / MS_PER_MIN)}m late</span>`;
    return `<span class="tag bad">${Math.round(d / MS_PER_MIN)}m late</span>`;
  }

  function formation(t) {
    const cars = t.carCount;
    if (t.type === "freight") {
      const out = [{ cls: "f", label: `${t.stock.name} — ${t.unitNumber}` }];
      const shown = Math.min(cars - 1, 12);
      for (let i = 0; i < shown; i++) out.push({ cls: "std", label: `Freight car ${i + 1}` });
      if (cars - 1 > shown) out.push({ cls: "std", label: `+ ${cars - 1 - shown} more` });
      return out;
    }
    const usFirstN = { acela: 5, "p42sl": 3, "p42vl": 3, "genesis_amf": 2, "p42hor": 1, airo: 2, "sc44v": 1 }[t.stockId];
    const firstN = usFirstN != null ? usFirstN
      : { "390": 4, "800": 2, "801": 2, "802": 2, "221": 1, "220": 1, "43": 2, "185": 1, "397": 1, "195": 1, "331": 1, "720": 2, "385": 1 }[t.stockId] || 1;
    const usShop = { acela: "Café Car", "p42sl": "Dining car", "p42vl": "Dining car", "genesis_amf": "Café car", "p42hor": "Café car", airo: "Café car", "sc44v": "Café car" }[t.stockId];
    const shop = usShop != null && cars > 4 ? 1 : ["390", "800", "801", "802", "221", "220", "43"].includes(t.stockId) && cars > 4 ? 1 : 0;
    const out = [];
    const letters = "ABCDEFGHIJKLMNOP".split("");
    for (let i = 0; i < cars; i++) {
      let cls = "std", label = `Coach ${letters[i]} — Standard`;
      if (shop && i === 0) { cls = "s"; label = usShop != null ? usShop : "Coach " + letters[i] + " — Shop / buffet"; }
      else if (usFirstN != null) {
        if (i < firstN + shop) { cls = "f"; label = `Coach ${letters[i]} — ${i < Math.max(2, usFirstN - shop) ? "Business" : "Coach"} Class`;
          if (t.stockId === "p42sl" || t.stockId === "p42vl") { if (i === firstN + shop - 1) label = `Car ${i + 1} — Sleeper`; } }
        else if (t.stockId === "p42sl" && i === cars - 1) { label = `Car ${i + 1} — Sightseer Lounge`; }
      }
      else if (i < firstN + shop) { cls = "f"; label = `Coach ${letters[i]} — First Class`; }
      out.push({ cls, label });
    }
    return out;
  }

  function etaMin(t) {
    if (t.state === "dwell" || t.state === "done") return 0;
    const idx = nextStopIdx(t);
    if (idx == null) return null;
    const stops = t.stops;
    const kmLeft = stops[idx].d - t.prog;
    const spd = Math.max(t.curSpeed, 15);
    return (kmLeft * 1.609344 * 3600) / (spd * 1.609344);
  }

  function nextStopIdx(t) {
    let idx = null;
    for (let i = t.stopIdx + 1; i < t.sched.length; i++) {
      if (t.actual[i] && t.actual[i].arr != null) continue;
      idx = i; break;
    }
    return idx;
  }

  function statusHtml(t) {
    if (t.state === "dwell") {
      const d = EN.trainDelayMs(t);
      return d < MS_PER_MIN ? `<span class="tag good">At station — on time</span>` : `<span class="tag bad">At station — ${EN.fmtDelay(d)} late${t.cause ? " (" + t.cause + ")" : ""}</span>`;
    }
    const d = EN.trainDelayMs(t);
    if (d < MS_PER_MIN) return `<span class="tag good">On time</span>`;
    return `<span class="tag bad">${EN.fmtDelay(d)} late${t.cause ? " — " + t.cause : ""}</span>`;
  }

  function selectTrain(id) {
    selectedId = id;
    follow = false;
    $("follow").checked = false;
    $("detail").classList.remove("hidden");
    selectedTab = "overview";
    document.querySelectorAll("#tabs .tab").forEach(x => x.classList.toggle("active", x.dataset.tab === "overview"));
    document.querySelectorAll(".tabpage").forEach(p => p.classList.add("hidden"));
    $("tab-overview").classList.remove("hidden");
    updMarkerSel();
    const t = EN.trainById(id);
    if (trail) { trail.remove(); trail = null; }
    if (t) {
      const op = OPERATORS[t.opId];
      trail = L.polyline([], { color: op.color, weight: 3, opacity: 0.75 }).addTo(map);
      map.panTo([t.pos.lat, t.pos.lng], { animate: true });
    }
    render();
    writeHash();
  }

  function renderHead(t) {
    const op = OPERATORS[t.opId];
    $("d-headcode").textContent = t.headcode;
    $("d-op").innerHTML = `${op.name} — ${t.origin} &rarr; ${t.destination}`;
    $("d-status").innerHTML = statusHtml(t);
    const seen = $("seenbtn"), rid = $("riddenbtn"), wbtn = $("watchbtn");
    if (seen) { const on = lifelist.units.indexOf(t.stockId + "::" + t.unitNumber) >= 0; seen.classList.toggle("on", on); seen.innerHTML = on ? "&#10003; Seen" : "&#10003; Seen"; }
    if (rid) { const on = lifelist.routes.indexOf(t.routeId) >= 0; rid.classList.toggle("on", on); }
    if (wbtn) { const on = watch.indexOf(t.routeId) >= 0; wbtn.classList.toggle("on", on); wbtn.innerHTML = on ? "&#9733; Watching" : "&#9734; Watch"; }
  }

  function renderRouteInfo(t) {
    const info = typeof ROUTE_INFO !== "undefined" && ROUTE_INFO[t.routeId];
    if (!info) return "";
    return `<div class="nextbox" style="margin-top:10px"><div class="nb-t">About this train${info.since ? ` — running since ${info.since}` : ""}</div><div class="nb-v" style="font-weight:400;font-size:12px;color:var(--dim)">${info.blurb}</div></div>`;
  }

  function renderOverview(t) {
    const op = OPERATORS[t.opId];
    const stops = t.stops;
    const kmDone = t.prog;
    const pct = Math.min(100, Math.round(100 * kmDone / stops[stops.length - 1].d));
    const nsIdx = nextStopIdx(t);
    const eta = etaMin(t);
    const stats = EN.runStats(t);
    const headcodeClass = t.type === "freight" ? "Freight train " + t.headcode
      : t.type === "heritage" ? "Heritage steam special " + t.headcode
      : /^\d+$/.test(t.headcode) ? "Passenger train No. " + t.headcode
      : t.headcode[0] === "1" ? "Express passenger (" + t.headcode[0] + "xx)"
      : t.headcode[0] === "2" ? "Stopping passenger (" + t.headcode[0] + "xx)"
      : t.headcode[0] === "4" ? "Freight (" + t.headcode[0] + "xx)"
      : "Other (" + t.headcode + ")";
    $("tab-overview").innerHTML = `
      <div class="big-speed"><span class="num">${Math.round(t.curSpeed)}</span><span class="unit">mph&nbsp;(${Math.round(t.curSpeed * 1.609344)} km/h)</span>
      <span class="unit" style="margin-left:auto">max ${t.stock.maxSpeed} mph</span></div>
      <div class="routeline">
        <div class="rl-head"><span>${t.origin}</span><span>${pct}%</span><span>${t.destination}</span></div>
        <div class="rl-bar"><div class="rl-fill" style="width:${pct}%"></div></div>
      </div>
      ${nsIdx != null ? `<div class="nextbox"><div class="nb-t">Next stop — platform ${plate(t.headcode, stops[nsIdx].code)}</div>
        <div class="nb-v">${stops[nsIdx].name}</div>
        <div class="nb-e">sched ${fmtHm(t.sched[nsIdx].arr)} &middot; ${eta != null && t.state === "run" ? "est. arrival in ~" + Math.round(eta) + " min" : (t.state === "dwell" ? "departure " + fmtHm(t.actual[t.stopIdx].schedDepTarget || t.sched[t.stopIdx].dep) : "awaiting departure")}</div></div>` : ""}
      <div class="kv">
        <span class="k">Service</span><span class="v">${headcodeClass}</span>
        <span class="k">Unit</span><span class="v">${t.unitNumber} · ${t.carCount} ${t.type === "freight" ? "wagons" : "cars"}</span>
        <span class="k">Route</span><span class="v">${t.routeName}</span>
        <span class="k">Distance run</span><span class="v">${stats.km.toFixed(0)} km (${(stats.km * 0.621371).toFixed(0)} mi)</span>
        <span class="k">Journey time</span><span class="v">${stats.minutes >= 60 ? Math.floor(stats.minutes / 60) + "h " + Math.round(stats.minutes % 60) + "m" : Math.round(stats.minutes) + " min"}</span>
      </div>
      ${t.cause && EN.trainDelayMs(t) > MS_PER_MIN ? `<div class="nextbox" style="margin-top:10px"><div class="nb-t">Reported cause of delay</div><div class="nb-v" style="color:var(--bad)">${t.cause}</div></div>` : ""}
    `;
  }

  function renderCallings(t) {
    let html = `<table><thead><tr><th>Station</th><th>Pl</th><th>Sched</th><th>Actual / Exp</th><th>Status</th></tr></thead><tbody>`;
    t.sched.forEach((s, i) => {
      const a = t.actual[i];
      const isNext = nextStopIdx(t) === i;
      let shown = null, note = "";
      if (i === 0) {
        shown = a.dep;
        if (shown == null && t.state === "pre") shown = t.sched[0].dep;
      } else if (t.actual[i].dep != null) shown = a.dep;
      else if (t.actual[i].arr != null) { shown = a.arr; note = "arr"; }
      else if (isNext && t.state === "run") shown = t.sched[i].arr + EN.trainDelayMs(t) * 0.6; else shown = null;
      const expTxt = shown == null ? "—" : fmtHm(shown) + (note ? " (a)" : "");
      const before = t.actual[i].dep != null || (i === 0 && t.state !== "pre");
      html += `<tr class="${isNext ? "next" : ""}">
        <td>${s.name}${i === 0 ? " <span class='dim-note'>(from)</span>" : i === t.sched.length - 1 ? " <span class='dim-note'>(to)</span>" : ""}</td>
        <td>${plate(t.headcode, s.code)}</td>
        <td>${fmtHm(s.arr)}${i > 0 ? "<br><span class='dim-note'>dep " + fmtHm(s.dep) + "</span>" : ""}</td>
        <td>${expTxt}</td>
        <td>${before ? deltaTag(i === 0 ? a.dep : a.arr, i === 0 ? t.sched[0].dep : s.arr) : "—"}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    $("tab-callings").innerHTML = html;
  }

  function renderStock(t) {
    const s = t.stock;
    const form = formation(t);
    $("tab-stock").innerHTML = `
      <div class="kv">
        <span class="k">Class</span><span class="v">${s.name}</span>
        <span class="k">Unit number</span><span class="v">${t.unitNumber}</span>
        <span class="k">Formation</span><span class="v">${t.carCount} vehicles</span>
        <span class="k">Power</span><span class="v">${s.power}</span>
        <span class="k">Design speed</span><span class="v">${s.maxSpeed} mph${s.typical ? ` · ${s.typical} mph typical in service` : ""}</span>
        <span class="k">Builder</span><span class="v">${s.maker}</span>
        <span class="k">Built</span><span class="v">${s.built}</span>
      </div>
      <div class="formation">${form.map(c => `<span class="coach ${c.cls}">${c.label.replace("Coach ", "")}</span>`).join("")}</div>
      <div class="stocknote">${s.note}${s.fact ? `<div class="nextbox" style="margin-top:10px"><div class="nb-t">Fun fact</div><div class="nb-v" style="font-weight:400;font-size:12px;color:var(--dim)">${s.fact}</div></div>` : ""}</div>
    `;
  }

  function drawSpark(t) {
    const cv = $("speedcanvas");
    if (!cv) return;
    const w = cv.width = cv.clientWidth * 2;
    const h = cv.height = 180;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const pts = t.history.map(p => [p[2], p[3]]);
    pts.push([EN.simTime, t.curSpeed]);
    const windowMs = Math.max(10 * MS_PER_MIN, EN.simTime - (pts.length ? pts[0][0] : EN.simTime));
    const t0 = EN.simTime - windowMs;
    const maxSpd = Math.max(t.stock.maxSpeed, 10);
    ctx.strokeStyle = "rgba(119,131,154,.35)";
    ctx.beginPath();
    for (let g = 0; g <= 4; g++) {
      const y = (h - 20) * g / 4 + 10;
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(119,131,154,.8)";
    ctx.font = "18px sans-serif";
    ctx.fillText(maxSpd + " mph", 8, 24);
    ctx.fillText("0", 8, h - 14);
    ctx.strokeStyle = "#33c1ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    let started = false;
    for (const [ts, spd] of pts) {
      if (ts < t0) continue;
      const x = (ts - t0) / windowMs * (w - 20) + 10;
      const y = h - 20 - Math.min(1, spd / maxSpd) * (h - 30) - 5;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function renderTele(t) {
    const stats = EN.runStats(t);
    let maxSeen = 0;
    for (const p of t.history) maxSeen = Math.max(maxSeen, p[3]);
    maxSeen = Math.max(maxSeen, t.curSpeed);
    $("tab-tele").innerHTML = `
      <canvas id="speedcanvas"></canvas>
      <div class="kv" style="margin-top:10px">
        <span class="k">Current speed</span><span class="v">${Math.round(t.curSpeed)} mph</span>
        <span class="k">Peak (tracked)</span><span class="v">${Math.round(maxSeen)} mph</span>
        <span class="k">Design max</span><span class="v">${t.stock.maxSpeed} mph</span>
        <span class="k">Distance run</span><span class="v">${stats.km.toFixed(1)} km</span>
        <span class="k">Mean speed</span><span class="v">${stats.minutes > 0 ? Math.round(stats.km * 0.621371 / (stats.minutes / 60)) : 0} mph</span>
        <span class="k">Track incidents</span><span class="v">${t.cause ? "1 reported" : "none"}</span>
      </div>
      <div class="dim-note" style="margin-top:8px">Speed trace over the last ${Math.max(10, Math.round((EN.simTime - (t.history[0] ? t.history[0][2] : EN.simTime)) / MS_PER_MIN))} minutes.</div>
    `;
    drawSpark(t);
  }

  function render() {
    pruneMarkers();
    for (const t of EN.trains()) {
      if (!trainVisible(t)) continue;
      const m = ensureMarker(t);
      m.setLatLng([t.pos.lat, t.pos.lng]);
      const svg = m.getElement() && m.getElement().querySelector("svg");
      if (svg) svg.style.transform = `rotate(${Math.round(t.bearing)}deg)`;
      const trnEl = m.getElement() && m.getElement().querySelector(".trn");
      if (trnEl) trnEl.classList.toggle("late", EN.trainDelayMs(t) > 5 * MS_PER_MIN);
      const path = t.headcode + " " + Math.round(t.curSpeed) + " mph";
      const tt = m.getTooltip();
      if (tt && tt.getContent() !== path) m.setTooltipContent(path);
    }
    updMarkerSel();
    if (selectedId) {
      const t = EN.trainById(selectedId);
      if (t) {
        renderHead(t);
        renderTab(t);
        if (follow) map.setView([t.pos.lat, t.pos.lng], map.getZoom(), { animate: true, duration: 0.6 });
        if (trail) trail.setLatLngs(t.history.map(p => [p[0], p[1]]).concat([[t.pos.lat, t.pos.lng]]));
      } else {
        selectedId = null;
        $("detail").classList.add("hidden");
      }
    }
    for (const row of document.querySelectorAll(".oprow")) {
      const id = row.dataset.op;
      row.querySelector(".cnt").textContent = EN.trains().filter(x => x.opId === id && trainVisible(x)).length;
    }
  }

  function renderFeed() {
    const ev = EN.events().slice(-55).reverse();
    $("feed").innerHTML = ev.map(e => `<div class="fitem ${e.type}" data-id="${e.trainId}"><span class="ftime">${fmtHm(e.time)}</span><span><b>${e.headcode}</b> ${e.message.replace(/^\d\d:\d\d /, "")}</span></div>`).join("");
    document.querySelectorAll(".fitem").forEach(el => {
      el.onclick = () => { const t = EN.trainById(el.dataset.id); if (t) selectTrain(t.id); };
    });
    renderWatchbox();
  }

  function renderSearch(q) {
    const box = $("results");
    q = q.trim().toLowerCase();
    if (q.length < 2) { box.classList.add("hidden"); return; }
    const res = [];
    for (const t of EN.trains()) {
      if (t.state === "done") continue;
      const op = OPERATORS[t.opId];
      if (t.headcode.toLowerCase().includes(q) || op.name.toLowerCase().includes(q) || t.stock.name.toLowerCase().includes(q) || t.origin.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q) || t.unitNumber.toLowerCase().includes(q)) {
        res.push({
          title: t.headcode + " — " + t.origin + " → " + t.destination,
          sub: `${op.name} · ${t.stock.name} · ${t.state === "pre" ? "not yet departed" : Math.round(t.curSpeed) + " mph"}`,
          tag: t.state === "pre" ? "Plan" : t.state === "dwell" ? "Station" : "Live",
          go: () => selectTrain(t.id)
        });
      }
      if (res.length > 10) break;
    }
    if (res.length < 10) {
      for (const [code, st] of Object.entries(STATIONS)) {
        if (st.name.toLowerCase().includes(q) || code.toLowerCase().startsWith(q)) {
          res.push({
            title: st.name,
            sub: `Station · ${code} · departure board`,
            tag: "Station",
            go: () => { map.flyTo([st.lat, st.lng], 10); openBoard(code); }
          });
        }
      }
    }
    box.innerHTML = res.slice(0, 12).map((r, i) => `<div class="res ${i === 0 ? "sel" : ""}" data-i="${i}"><span><div class="r-title">${r.title}</div><div class="r-sub">${r.sub}</div></span><span class="r-tag">${r.tag}</span></div>`).join("") || `<div class="res"><span class="r-sub">No matches</span></div>`;
    box.classList.remove("hidden");
    box.querySelectorAll(".res[data-i]").forEach(el => {
      el.onclick = () => { res[+el.dataset.i].go(); box.classList.add("hidden"); $("search").value = ""; };
    });
  }

  function openBoard(code) {
    boardCode = code;
    const st = STATIONS[code];
    $("boardtitle").textContent = st.name;
    const vb = $("visitbtn");
    if (vb) { const on = lifelist.stations.indexOf(code) >= 0; vb.classList.toggle("on", on); }
    $("board").classList.remove("hidden");
    document.body.classList.remove("panel-open");
    writeHash();
    renderBoard();
  }
  function closeBoard() {
    boardCode = null;
    $("board").classList.add("hidden");
    writeHash();
  }

  function renderBoard() {
    if (boardCode == null) return;
    const rows = EN.stationBoard(boardCode);
    $("boardrows").innerHTML = rows.map(r => {
      const op = OPERATORS[r.op];
      let status;
      if (r.state === "dwell") status = `<span class="st-on">At platform</span>`;
      else if (r.exp > r.sched + 2 * MS_PER_MIN) status = `<span class="st-late">Exp ${fmtHm(r.exp)}</span>`;
      else status = `<span class="st-exp">On time</span>`;
      return `<tr>
        <td>${fmtHm(r.sched)}</td>
        <td>${r.exp > r.sched + 2 * MS_PER_MIN ? fmtHm(r.exp) : fmtHm(r.sched)}</td>
        <td><span class="clickable" data-hc="${r.headcode}">${r.headcode}</span> → ${r.dest}</td>
        <td>${plate(r.headcode, boardCode)}</td>
        <td><span style="color:${op.color}">${op.name}</span></td>
        <td>${status}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="6" class="dim-note" style="padding:14px 10px">No scheduled services in the next 30 minutes.</td></tr>`;
    document.querySelectorAll("#boardrows .clickable").forEach(el => {
      el.onclick = () => {
        const t = EN.trains().find(x => x.headcode === el.dataset.hc);
        closeBoard();
        if (t) selectTrain(t.id);
      };
    });
  }

  function setSpot(pt) {
    spot = { lat: pt.lat, lng: pt.lng };
    try { localStorage.setItem("rr_spot", JSON.stringify(spot)); } catch (_e) {}
    dropSpotMarker();
    spotListDirty = true;
    updateSpotStat();
    writeHash();
    if (selectedId && selectedTab === "spot") renderSpotTab(EN.trainById(selectedId));
  }

  function dropSpotMarker() {
    if (spotMarker) spotMarker.remove();
    spotMarker = L.marker([spot.lat, spot.lng], {
      icon: L.divIcon({ className: "", html: `<div class="spotpin"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }),
      zIndexOffset: 900
    }).addTo(map).bindTooltip("Your spot", { direction: "top", offset: [0, -8], className: "stn-label" });
  }

  function setSpotPin(on) {
    spotPin = on;
    $("spotpin").classList.toggle("active", on);
    document.body.classList.toggle("spotting", on);
    if (on) updateSpotStat("Click the map to set your spotting spot…");
  }

  function updateSpotStat(msg) {
    if (!$("spotstat")) return;
    if (spot) $("spotstat").textContent = msg || `Spot set — nearest trains recalculating…`; 
  }

  function nearestApproach(t, pt) {
    const now = EN.simTime;
    const start = Math.max(now, t.sched[0].dep);
    const end = Math.min(now + 12 * 3600000, t.sched[t.sched.length - 1].arr - 1);
    if (end - start < 59999) return null;
    const step = (t.sched[t.sched.length - 1].arr - start) > 12 * MS_PER_MIN ? 4 * MS_PER_MIN : MS_PER_MIN;
    let best = null;
    for (let ms = start; ms <= end; ms += step) {
      const p = EN.projectAt(t, ms);
      if (!p) break;
      const d = EN.distKm(p, pt);
      if (!best || d < best.distKm) best = { distKm: d, at: ms };
    }
    if (!best) return null;
    for (let ms = Math.max(start, best.at - step); ms <= Math.min(end, best.at + step); ms += 20000) {
      const p = EN.projectAt(t, ms);
      if (!p) break;
      const d = EN.distKm(p, pt);
      if (d < best.distKm) best = { distKm: d, at: ms };
    }
    const p = EN.projectAt(t, best.at);
    return { distKm: best.distKm, at: best.at, lat: p.lat, lng: p.lng };
  }

  function nearestStop(t, pt) {
    let best = null;
    t.sched.forEach((s, i) => {
      if (s.arr < EN.simTime) return;
      const st = STATIONS[s.code];
      if (!st) return;
      const d = EN.distKm(st, pt);
      if (!best || d < best.distKm) best = { distKm: d, code: s.code, name: s.name, arr: s.arr, dep: s.dep, idx: i };
    });
    return best;
  }

  function renderSpotFx(shown) {
    if (spotFx) { spotFx.remove(); spotFx = null; }
    if (!spot || !shown || !shown.length) return;
    const radius = parseInt($("spotradius").value, 10) || 100;
    spotFx = L.layerGroup();
    L.circle([spot.lat, spot.lng], { radius: radius * 1000, color: "#33c1ff", weight: 1.2, opacity: 0.55, dashArray: "5 7", fill: false }).addTo(spotFx);
    const next = shown[0];
    L.polyline([[spot.lat, spot.lng], [next.na.lat, next.na.lng]], { color: "#33c1ff", weight: 1.5, opacity: 0.7, dashArray: "2 6" })
      .bindTooltip(`${next.t.headcode} · next pass ${fmtHm(next.na.at)}`, { direction: "center", className: "stn-label" }).addTo(spotFx);
    for (const r of shown) {
      const mins = Math.max(0, Math.round((r.na.at - EN.simTime) / MS_PER_MIN));
      const inside = r.na.distKm <= radius + 1;
      L.marker([r.na.lat, r.na.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="passdot ${inside ? "in" : "out"}${r === next ? " nxt" : ""}"><i></i><u>${fmtHm(r.na.at)} · ${r.t.headcode}</u></div>`,
          iconSize: [12, 12], iconAnchor: [6, 6]
        }),
        zIndexOffset: 600
      }).addTo(spotFx)
        .bindTooltip(`${r.t.headcode} → ${r.t.destination}<br>closest pass ${fmtHm(r.na.at)} — ${r.na.distKm.toFixed(0)} km away${mins ? ` (in ${mins >= 60 ? Math.floor(mins / 60) + "h " + (mins % 60) + "m" : mins + "m"})` : " (now)"}`, { direction: "top", className: "stn-label", offset: [0, -6] })
        .on("click", () => { selectTrain(r.t.id); map.flyTo([r.na.lat, r.na.lng], Math.max(map.getZoom(), 9), { duration: 1.2 }); });
    }
    spotFx.addTo(map);
  }

  function renderSpotList() {
    const box = $("spotlist");
    if (!box) return;
    if (!spot) { box.innerHTML = ""; renderSpotFx([]); return; }
    const radius = parseInt($("spotradius").value, 10);
    const results = [];
    for (const t of EN.trains()) {
      if (t.state === "done") continue;
      const na = nearestApproach(t, spot);
      if (!na) continue;
      results.push({ t, na });
    }
    let shown = results.filter(r => r.na.distKm <= radius + 1).sort((a, b) => a.na.at - b.na.at).slice(0, 10);
    let head = `${shown.length} pass-by${shown.length === 1 ? "" : "s"} within ${radius} km`;
    if (!shown.length) {
      shown = results.sort((a, b) => a.na.distKm - b.na.distKm).slice(0, 5);
      head = shown.length ? `Nothing within ${radius} km yet — the closest upcoming passes:` : "No scheduled passes within 12 h";
    }
    box.innerHTML = `<div class="shead">${head}</div>` + shown.map(r => {
      const mins = Math.max(0, Math.round((r.na.at - EN.simTime) / MS_PER_MIN));
      const watch = nearestStop(r.t, spot);
      return `<div class="sitem" data-id="${r.t.id}">
        <div class="s1"><b>${r.t.headcode}</b> <span class="sdst">→ ${r.t.destination}</span><span class="swhen">${mins <= 0 ? "now" : "in " + (mins >= 60 ? Math.floor(mins / 60) + "h " + (mins % 60) + "m" : mins + "m")}</span></div>
        <div class="s2">Closest pass ${fmtHm(r.na.at)} · ${r.na.distKm.toFixed(0)} km / ${(r.na.distKm * 0.621371).toFixed(0)} mi away${watch ? ` · watch from ${watch.name} (${fmtHm(watch.arr)}, ${watch.distKm.toFixed(0)} km from you)` : ""}</div>
      </div>`;
    }).join("");
    box.querySelectorAll(".sitem[data-id]").forEach(el => {
      el.onclick = () => {
        const r = shown.find(x => x.t.id === el.dataset.id);
        selectTrain(el.dataset.id);
        if (r) { map.flyTo([r.na.lat, r.na.lng], Math.max(map.getZoom(), 9), { duration: 1.2 }); if (spotMarker) spotMarker.setTooltipContent(`${r.t.headcode} closest pass ${fmtHm(r.na.at)}`); }
      };
    });
    renderSpotFx(shown);
    spotListDirty = false;
    if (spot) $("spotstat").textContent = `Spot ${spot.lat.toFixed(3)}, ${spot.lng.toFixed(3)} — ${head}. Click a pass-by (list or map) to jump to it.`;
  }

  function renderTab(t) {
    if (selectedTab === "overview") renderOverview(t);
    else if (selectedTab === "callings") renderCallings(t);
    else if (selectedTab === "stock") renderStock(t);
    else if (selectedTab === "spot") renderSpotTab(t);
    else renderTele(t);
  }

  function renderSpotTab(t) {
    const box = $("tab-spot");
    if (!spot) {
      box.innerHTML = `<div class="dim-note">Set a spot with <b>Use my location</b> or <b>Pin on map</b> in the Spotting panel, and this tab will show exactly when and where this train passes closest to you — plus the best station to watch it from.</div>`;
      return;
    }
    const na = nearestApproach(t, spot);
    const watch = nearestStop(t, spot);
    const stationPasses = watch ? `<div class="kv" style="margin-top:10px">
        <span class="k">Best station</span><span class="v">${watch.name} — ${watch.distKm.toFixed(0)} km / ${(watch.distKm * 0.621371).toFixed(0)} mi from you</span>
        <span class="k">It arrives</span><span class="v">${fmtHm(watch.arr)} (departs ${fmtHm(watch.dep)})</span>
      </div>` : "";
    box.innerHTML = `${na
      ? `<div class="nextbox"><div class="nb-t">Closest point on its run</div>
        <div class="nb-v">${fmtHm(na.at)} · ${na.distKm.toFixed(0)} km / ${(na.distKm * 0.621371).toFixed(0)} mi from your spot</div>
        <div class="nb-e">${Math.max(0, Math.round((na.at - EN.simTime) / MS_PER_MIN))} minutes from now — straight-line distance to the track</div></div>`
      : `<div class="dim-note">This run is finished within the next 12 hours — no upcoming pass.</div>`}
      ${stationPasses}`;
  }

  function insightsData() {
    const trs = EN.trains();
    const live = trs.filter(t => t.state === "run" || t.state === "dwell");
    const running = live.filter(t => t.state === "run");
    const delayed = live.filter(t => EN.trainDelayMs(t) > 5 * MS_PER_MIN);
    const withDelay = live.filter(t => EN.trainDelayMs(t) > 0);
    const onTimePct = live.length ? Math.round(100 * (live.length - withDelay.length) / live.length) : 100;
    const fastest = running.reduce((a, b) => (b.curSpeed > (a ? a.curSpeed : 40) ? b : a), null);
    const worst = live.reduce((a, b) => (EN.trainDelayMs(b) > (a ? EN.trainDelayMs(a) : 0) ? b : a), null);
    const longest = live.reduce((a, b) => (b.stops[b.stops.length - 1].d > (a ? a.stops[a.stops.length - 1].d : 0) ? b : a), null);
    const perOp = {};
    for (const t of live) {
      const o = perOp[t.opId] || (perOp[t.opId] = { n: 0, dSum: 0, dMax: 0 });
      o.n++;
      const d = EN.trainDelayMs(t);
      o.dSum += d; if (d > o.dMax) o.dMax = d;
    }
    const fleet = {};
    for (const t of live) fleet[t.stock.name] = (fleet[t.stock.name] || 0) + 1;
    const nextHour = trs.filter(t => t.state === "pre" && t.depMs - EN.simTime <= 3600000).length;
    const hubs = Object.entries(STATIONS).filter(([, st]) => st.size === 3)
      .map(([code, st]) => ({ code, name: st.name, n: EN.stationBoard(code).length }))
      .sort((a, b) => b.n - a.n).slice(0, 6);
    return { live, running, delayed, onTimePct, fastest, worst, longest, perOp, fleet, nextHour, hubs };
  }

  function renderInsights() {
    const d = insightsData();
    const fastestRow = d.fastest ? `<div class="fastrow"><b>${d.fastest.headcode}</b> — ${d.fastest.routeName} ${Math.round(d.fastest.curSpeed)} mph</div>` : "";
    const opRows = Object.entries(d.perOp).sort((a, b) => b[1].n - a[1].n)
      .map(([id, o]) => { const op = OPERATORS[id] || { name: id, color: "#888" };
        return `<tr><td><span class="dot" style="background:${op.color}"></span>${op.name}</td><td>${o.n}</td><td>${EN.fmtDelay(Math.round(o.dSum / o.n))}</td><td>${EN.fmtDelay(o.dMax)}</td></tr>`;
      }).join("");
    const fleetRows = Object.entries(d.fleet).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, n]) => `<div class="flrow"><span>${name}</span><b>${n} in traffic</b></div>`).join("");
    $("insightsbody").innerHTML = `
      <div class="kv">
        <span class="k">Services live now</span><span class="v">${d.live.length} running · ${d.nextHour} departing within the next hour</span>
        <span class="k">Punctuality</span><span class="v">${d.onTimePct}% on time · ${d.delayed.length} running &gt; 5 min late</span>
        <span class="k">Fastest right now</span><span class="v">${d.fastest ? `${d.fastest.headcode} — ${Math.round(d.fastest.curSpeed)} mph (${d.fastest.routeName})` : "—"}</span>
        <span class="k">Most delayed</span><span class="v">${d.worst ? `${d.worst.headcode} — ${EN.fmtDelay(EN.trainDelayMs(d.worst))}${d.worst.cause ? " (" + d.worst.cause + ")" : ""}` : "—"}</span>
        <span class="k">Longest haul on the board</span><span class="v">${d.longest ? `${d.longest.routeName} — ${Math.round(d.longest.stops[d.longest.stops.length - 1].d).toLocaleString()} km` : "—"}</span>
      </div>
      <h3 class="ih">Busiest hubs right now</h3>
      <div class="hubrow">${d.hubs.map(h => `<span class="hub" data-code="${h.code}">${h.code} · ${h.n} services<u>${stShort(h.name)}</u></span>`).join("")}</div>
      <h3 class="ih">Operators — live services</h3>
      <table class="insights"><thead><tr><th>Operator</th><th>Live</th><th>Avg delay</th><th>Worst</th></tr></thead><tbody>${opRows}</tbody></table>
      <h3 class="ih">Fleet in traffic</h3>
      <div class="fleetlist">${fleetRows}</div>
    `;
    document.querySelectorAll("#insightsbody .hub").forEach(el => {
      el.onclick = () => { closeInsights(); openBoard(el.dataset.code); };
    });
  }

  function openInsights() { insightsOpen = true; $("insights").classList.remove("hidden"); renderInsights(); }
  function closeInsights() { insightsOpen = false; $("insights").classList.add("hidden"); }

  function stShort(name) {
    return name.replace(/ (Union Station|Central Station|Transportation Center)$/, "").split(" — ")[0];
  }

  /* ---- sun / golden hour ---- */
  function sunTimes(dateMs, lat, lng) {
    const rad = Math.PI / 180;
    const dayMs = 864e5, J1970 = 2440588, J2000 = 2451545;
    const toJ = (d) => d.valueOf() / dayMs - 0.5 + J1970;
    const fromJ = (j) => new Date((j + 0.5 - J1970) * dayMs);
    const obliq = rad * 23.4397;
    const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
    const eclipticLongitude = (M) => {
      const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
      const P = rad * 102.9372;
      return M + C + P + Math.PI;
    };
    const declination = (L) => Math.asin(Math.sin(obliq) * Math.sin(L));
    const d = toJ(dateMs);
    const M = solarMeanAnomaly(d);
    const L = eclipticLongitude(M);
    const dec = declination(L);
    const J0 = 0.0009;
    const lw = rad * -lng;
    const phi = rad * lat;
    const n = Math.round(d - J0 - lw / (2 * Math.PI));
    const ds = (ds_) => J0 + (ds_ + lw) / (2 * Math.PI) + n;
    const transitJ = solarTransitJ(ds(0), M, L);
    const h0 = rad * -0.833;
    const cosH = (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    if (cosH > 1) return { sunrise: null, sunset: null };
    if (cosH < -1) return { sunrise: fromJ(transitJ - 6 * 3600 / 48), sunset: fromJ(transitJ + 6 * 3600 / 48) };
    const w = hourAngle(h0, phi, dec);
    return { sunrise: fromJ(solarTransitJ(ds(-w), M, L) ), sunset: fromJ(solarTransitJ(ds(w), M, L) ) };
    function solarTransitJ(ds_, M_, L_) { return J2000 + ds_ + 0.0053 * Math.sin(M_) - 0.0069 * Math.sin(2 * L_); }
    function hourAngle(h, phi_, dec_) { return Math.acos((Math.sin(h) - Math.sin(phi_) * Math.sin(dec_)) / (Math.cos(phi_) * Math.cos(dec_))); }
  }

  function isGoldenHour(ms, lat, lng) {
    const sun = sunTimes(ms, lat, lng);
    if (!sun.sunrise || !sun.sunset) return false;
    const G = 75 * MS_PER_MIN;
    return (ms >= sun.sunrise && ms <= sun.sunrise + G) || (ms >= sun.sunset - G && ms <= sun.sunset);
  }

  /* ---- proximity notifications ---- */
  function checkAlerts() {
    if (!alertsOn || !spot) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const km = parseInt($("alertkm").value, 10) || 25;
    for (const t of EN.trains()) {
      if (t.state === "done") continue;
      const na = nearestApproach(t, spot);
      if (!na || na.distKm > km) continue;
      if (na.at < EN.simTime || na.at > EN.simTime + 30 * MS_PER_MIN) continue;
      if (notifiedPasses.has(t.headcode)) continue;
      notifiedPasses.add(t.headcode);
      try {
        new Notification(`${t.headcode} near your spot`, {
          body: `${t.routeName} — closest pass ${EN.fmtTime(na.at)}, ${na.distKm.toFixed(0)} km away (${Math.max(0, Math.round((na.at - EN.simTime) / MS_PER_MIN))} min).`
        });
      } catch (_e) {}
    }
  }

  /* ---- calendar (.ics) export ---- */
  function icsExport() {
    if (!spot) { updateSpotStat("Set a spot first — then the next close passes export to your calendar."); return; }
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function" || typeof Blob === "undefined") {
      updateSpotStat("Calendar export needs a browser with Blob support.");
      return;
    }
    const km = parseInt($("alertkm").value, 10) || parseInt($("spotradius").value, 10);
    const pad2 = (n) => String(n).padStart(2, "0");
    const float = (ms) => {
      const d = new Date(ms);
      return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
    };
    const esc = (s) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RailRadar//Spotting//EN"];
    let n = 0;
    for (const t of EN.trains()) {
      if (t.state === "done") continue;
      const na = nearestApproach(t, spot);
      if (!na || na.distKm > km) continue;
      if (na.at < EN.simTime || na.at > EN.simTime + 48 * 3600000) continue;
      const watch = nearestStop(t, spot);
      lines.push("BEGIN:VEVENT",
        `UID:${t.id}-${Math.round(na.at)}@railradar`,
        `DTSTAMP:${float(EN.simTime)}`,
        `DTSTART:${float(na.at)}`,
        "DURATION:PT10M",
        `SUMMARY:${esc(`Pass of ${t.headcode} (${t.routeName})`)}`,
        `DESCRIPTION:${esc(`${t.stock.name} passes ${na.distKm.toFixed(0)} km / ${(na.distKm * 0.621371).toFixed(0)} mi from your spot.${watch ? " Watch from " + watch.name + " (" + EN.fmtTime(watch.arr) + ")." : ""}${isGoldenHour(na.at, spot.lat, spot.lng) ? " Golden hour light!" : ""}`)}`,
        "END:VEVENT");
      if (++n >= 20) break;
    }
    if (!n) { updateSpotStat("No close passes in the next 48 h to export."); return; }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "railradar-passes.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    updateSpotStat(`Exported ${n} upcoming pass${n === 1 ? "" : "es"} to railradar-passes.ics.`);
  }

  /* ---- life list ---- */
  function openLife() { $("lifelist").classList.remove("hidden"); renderLife(); }
  function closeLife() { $("lifelist").classList.add("hidden"); }
  function toggleLifeEntry(kind, key, label) {
    const arr = lifelist[kind];
    const i = arr.indexOf(key);
    if (i >= 0) arr.splice(i, 1); else arr.push(key);
    lsSave("rr_life", lifelist);
    renderLife();
    if (selectedId) { const t = EN.trainById(selectedId); if (t) renderHead(t); }
    if (boardCode) { const vb = $("visitbtn"); if (vb) vb.classList.toggle("on", lifelist.stations.indexOf(boardCode) >= 0); }
  }
  function renderLife() {
    const body = $("lifebody");
    if (!body) return;
    const classCounts = {};
    for (const u of lifelist.units) { const cls = u.split("::")[0]; classCounts[cls] = (classCounts[cls] || 0) + 1; }
    const chip = (text, kind, key) => `<span class="chip">${text}<button data-kind="${kind}" data-key="${key.replace(/"/g, "&quot;")}" title="Remove">&#215;</button></span>`;
    const sec = (title, items, kind, emptyNote) => {
      const list = items.length ? items : [`<span class="chip empty-note">${emptyNote}</span>`];
      return `<div class="lifeh">${title}</div><div class="chipbox">${list.join("")}</div>`;
    };
    const unitChips = lifelist.units.map(u => {
      const [cls, num] = u.split("::");
      return chip(`${STOCK[cls] ? STOCK[cls].name.split(" ")[0] : cls} ${num}`, "units", u);
    });
    const classChips = Object.entries(classCounts).sort((a, b) => b[1] - a[1])
      .map(([cls, n]) => chip(`${STOCK[cls] ? STOCK[cls].name : cls} (${n})`, "#", cls)).map(c => c);
    const routeChips = lifelist.routes.map(rid => {
      const r = ROUTES.find(x => x.id === rid);
      return chip(r ? r.name.replace(/:.*$/, "").replace(/ \u2014.*$/, "") : rid, "routes", rid);
    });
    const stnChips = lifelist.stations.map(code => {
      const st = STATIONS[code];
      return chip(st ? st.name : code, "stations", code);
    });
    body.innerHTML = `
      <div class="lifestats">
        <div class="lstat"><b>${Object.keys(classCounts).length}</b><span>classes seen</span></div>
        <div class="lstat"><b>${lifelist.units.length}</b><span>units logged</span></div>
        <div class="lstat"><b>${lifelist.routes.length}</b><span>routes ridden</span></div>
        <div class="lstat"><b>${lifelist.stations.length}</b><span>stations visited</span></div>
      </div>
      ${sec("Units spotted", unitChips, "units", "Use the \u2713 Seen button on a train\u2019s detail panel.")}
      ${sec("Routes ridden", routeChips, "routes", "Use the \u2713 Ridden button on a train\u2019s detail panel.")}
      ${sec("Stations visited", stnChips, "stations", "Use the \u2713 Visited button on a departure board.")}
      <div class="dim-note" style="margin-top:10px">Saved in this browser. Clear an entry with the \u00d7 on its chip.</div>
    `;
    body.querySelectorAll(".chip button[data-kind]").forEach(b => {
      b.onclick = () => {
        const kind = b.dataset.kind;
        if (!lifelist[kind]) return;
        lifelist[kind] = lifelist[kind].filter(x => x !== b.dataset.key);
        lsSave("rr_life", lifelist);
        renderLife();
        if (selectedId) { const t = EN.trainById(selectedId); if (t) renderHead(t); }
      };
    });
  }

  /* ---- watchlist ---- */
  function toggleWatch(routeId, t) {
    if (!routeId) return;
    const i = watch.indexOf(routeId);
    if (i >= 0) watch.splice(i, 1); else watch.push(routeId);
    lsSave("rr_watch", watch);
    if (t) renderHead(t);
    renderWatchbox();
  }
  function renderWatchbox() {
    const box = $("watchbox"), list = $("watchlist");
    if (!box || !list) return;
    if (!watch.length) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    list.innerHTML = watch.map(rid => {
      const r = ROUTES.find(x => x.id === rid);
      const live = EN.trains().filter(t => t.routeId === rid && (t.state === "run" || t.state === "dwell"));
      const op = live.length ? OPERATORS[live[0].opId] : null;
      return `<div class="watchrow" data-rid="${rid}">
        <span class="dot" style="background:${op ? op.color : "#666"}"></span>
        <span class="wn">${r ? r.name : rid}</span>
        <span class="wc">${live.length ? live.length + " live" : "not running"}</span>
        <button class="unwatch" data-rid="${rid}" title="Remove from watchlist">&#215;</button>
      </div>`;
    }).join("");
    list.querySelectorAll(".watchrow").forEach(row => {
      row.onclick = () => {
        const t = EN.trains().find(x => x.routeId === row.dataset.rid && (x.state === "run" || x.state === "dwell"))
          || EN.trains().find(x => x.routeId === row.dataset.rid);
        if (t) selectTrain(t.id);
      };
    });
    list.querySelectorAll(".unwatch").forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); watch = watch.filter(r => r !== b.dataset.rid); lsSave("rr_watch", watch); if (selectedId) { const t = EN.trainById(selectedId); if (t) renderHead(t); } renderWatchbox(); };
    });
  }

  /* ---- shareable URLs ---- */
  function writeHash() {
    if (hashApplying) return;
    let h = "";
    if (selectedId) {
      const t = EN.trainById(selectedId);
      if (t) h = "#t=" + encodeURIComponent(t.headcode);
    } else if (boardCode) {
      h = "#stn=" + boardCode;
    } else if (spot) {
      h = "#spot=" + spot.lat.toFixed(4) + "," + spot.lng.toFixed(4);
    }
    try { history.replaceState(null, "", h || location.pathname.replace(/[^/]*$/, "") + location.search); } catch (_e) {
      try { location.hash = h; } catch (_e2) {}
    }
  }
  function applyHash() {
    if (!location.hash || location.hash.length < 2) return;
    hashApplying = true;
    try {
      const params = new URLSearchParams(location.hash.slice(1));
      const hc = params.get("t");
      if (hc) {
        const t = EN.trains().find(x => x.headcode === decodeURIComponent(hc));
        if (t) selectTrain(t.id);
      } else if (params.get("stn")) {
        const code = params.get("stn");
        const st = STATIONS[code];
        if (st) { map.setView([st.lat, st.lng], 9); openBoard(code); }
      } else if (params.get("spot")) {
        const [la, ln] = params.get("spot").split(",").map(Number);
        if (isFinite(la) && isFinite(ln)) setSpot({ lat: la, lng: ln });
      }
    } catch (_e) {}
    hashApplying = false;
  }

  /* ---- scenic layer ---- */
  function buildScenic() {
    if (scenicLayer) { scenicLayer.remove(); scenicLayer = null; }
    if (!$("scenictoggle") || !$("scenictoggle").checked) return;
    scenicLayer = L.layerGroup();
    const G = { summit: "\u25b2", viaduct: "\u23da", tunnel: "\u25d4", loop: "\u25ce", seawall: "\u2248", museum: "\u2605", landmark: "\u25c6" };
    for (const s of SCENIC) {
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: "", html: `<div class="scpin ${s.type}" role="img" aria-label="${s.name}"><span>${G[s.type] || "\u2022"}</span></div>`, iconSize: [26, 26], iconAnchor: [13, 26] }),
        zIndexOffset: 300
      }).addTo(scenicLayer)
        .bindTooltip(`<b>${s.name}</b><br>${s.note}`, { className: "stn-label", direction: "top", offset: [0, -28] })
        .on("click", () => map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 10), { duration: 1 }));
    }
    scenicLayer.addTo(map);
  }

  /* ---- help overlay ---- */
  function openKeys() { $("keys").classList.remove("hidden"); }
  function closeKeys() { $("keys").classList.add("hidden"); }

  const realTick = () => EN.tick(250);

  function loop() {
    realTick();
    updateModeChip();
    $("simclock").textContent = fmtClock(EN.simTime);
    render();
    if (boardCode != null) renderBoard();
    if (insightsOpen) renderInsights();
  }

  init();

  renderWatchbox();

  window.__rr = { setSpot: (lat, lng) => setSpot({ lat, lng }), openInsights, closeInsights, renderSpotList, spot: () => spot, select: (id) => selectTrain(id), goLive, pan: (lat, lng) => map.setView([lat, lng], map.getZoom() + 2), openLife, toggleWatch, toggleSeen: (id) => { const t = EN.trainById(id); if (t) toggleLifeEntry("units", t.stockId + "::" + t.unitNumber); }, lifelist: () => lifelist, writeHash, applyHash, buildScenic, sunTimes: (ms, lat, lng) => sunTimes(ms, lat, lng), isGolden: (ms) => isGoldenHour(ms, spot ? spot.lat : 40, spot ? spot.lng : -95), openKeys };
})();
