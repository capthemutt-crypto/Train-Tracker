(() => {
  const MS_PER_MIN = 60000;
  let selectedId = null;
  let selectedTab = "overview";
  let follow = false;
  let boardCode = null;
  const hiddenOps = new Set();
  let delayedOnly = false;

  const trainMarkers = new Map();
  const stationMarkers = new Map();
  let trail = null;

  const BASEMAPS = {
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd", maxZoom: 19
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
    if (cfg) baseLayer = L.tileLayer(cfg.url, { attribution: cfg.attribution, subdomains: cfg.subdomains, maxZoom: cfg.maxZoom }).addTo(map);
  }

  function init() {
    Sim.init();
    map.fitBounds([[49.8, -8.2], [58.8, 1.8]]);
    buildStations();
    buildOperatorList();
    buildSpeedButtons();
    wireUI();
    updateLabels();
    map.on("zoomend", updateLabels);
    setInterval(loop, 250);
    setInterval(renderFeed, 1500);
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

  function updateLabels() {
    const z = map.getZoom();
    document.body.classList.toggle("z-low", z < 8);
    document.body.classList.toggle("z-mid", z < 6);
  }

  function buildOperatorList() {
    const box = $("oplist");
    box.innerHTML = "";
    for (const [id, op] of Object.entries(OPERATORS)) {
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

  function buildSpeedButtons() {
    const box = $("speedbtns");
    for (const m of SPEED_MULTIPLIERS) {
      const b = document.createElement("button");
      b.className = "ctl" + (m === 1 ? " active" : "");
      b.textContent = m + "x";
      b.addEventListener("click", () => {
        Sim.setSpeed(m);
        box.querySelectorAll(".ctl").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
      });
      box.appendChild(b);
    }
  }

  function wireUI() {
    $("pausebtn").addEventListener("click", () => {
      Sim.setPaused(!Sim.paused);
      $("pausebtn").innerHTML = Sim.paused ? "&#9654;" : "&#10074;&#10074;";
    });
    $("closebtn").addEventListener("click", () => {
      selectedId = null;
      $("detail").classList.add("hidden");
      if (trail) { trail.remove(); trail = null; }
      updMarkerSel();
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
      if (e.key === "Escape") closeBoard();
    });
  }

  function trainVisible(t) {
    if (t.state !== "run" && t.state !== "dwell") return false;
    if (hiddenOps.has(t.opId)) return false;
    if (delayedOnly && Sim.trainDelayMs(t) < MS_PER_MIN) return false;
    return true;
  }

  function trainColor(t) {
    const delay = Sim.trainDelayMs(t);
    if (delay > 5 * MS_PER_MIN) return "#ff5c5c";
    if (t.state === "dwell") return "#ffc53d";
    return "#39d98a";
  }

  function ensureMarker(t) {
    let m = trainMarkers.get(t.id);
    if (!m) {
      const icon = L.divIcon({ className: "", html: `<div class="trn"><svg viewBox="0 0 20 20"><path d="M10 1 L17.5 17.5 L10 13.4 L2.5 17.5 Z" fill="${trainColor(t)}" stroke="rgba(0,0,0,.55)" stroke-width="1"/></svg></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
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
    for (const t of Sim.trains()) if (trainVisible(t)) live.add(t.id);
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

  function fmtHm(ms) { return Sim.fmtTime(ms); }

  function deltaTag(actual, sched) {
    if (actual == null) return `<span class="dim-note">—</span>`;
    const d = actual - sched;
    if (d <= 30000) return `<span class="tag good">On time</span>`;
    if (d < 5 * MS_PER_MIN) return `<span class="tag warn">${Math.round(d / MS_PER_MIN)}m late</span>`;
    return `<span class="tag bad">${Math.round(d / MS_PER_MIN)}m late</span>`;
  }

  function formation(t) {
    const cars = t.carCount;
    const firstN = { "390": 4, "800": 2, "801": 2, "802": 2, "221": 1, "220": 1, "43": 2, "185": 1, "397": 1, "195": 1, "331": 1, "720": 2, "385": 1 }[t.stockId] || 1;
    const shop = ["390", "800", "801", "802", "221", "220", "43"].includes(t.stockId) && cars > 4 ? 1 : 0;
    const out = [];
    const letters = "ABCDEFGHIJKLMNOP".split("");
    for (let i = 0; i < cars; i++) {
      let cls = "std", label = `Coach ${letters[i]} — Standard`;
      if (shop && i === 0) { cls = "s"; label = "Coach " + letters[i] + " — Shop / buffet"; }
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
      const d = Sim.trainDelayMs(t);
      return d < MS_PER_MIN ? `<span class="tag good">At station — on time</span>` : `<span class="tag bad">At station — ${Sim.fmtDelay(d)} late${t.cause ? " (" + t.cause + ")" : ""}</span>`;
    }
    const d = Sim.trainDelayMs(t);
    if (d < MS_PER_MIN) return `<span class="tag good">On time</span>`;
    return `<span class="tag bad">${Sim.fmtDelay(d)} late${t.cause ? " — " + t.cause : ""}</span>`;
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
    const t = Sim.trainById(id);
    if (trail) { trail.remove(); trail = null; }
    if (t) {
      const op = OPERATORS[t.opId];
      trail = L.polyline([], { color: op.color, weight: 3, opacity: 0.75 }).addTo(map);
      map.panTo([t.pos.lat, t.pos.lng], { animate: true });
    }
    render();
  }

  function renderHead(t) {
    const op = OPERATORS[t.opId];
    $("d-headcode").textContent = t.headcode;
    $("d-op").innerHTML = `${op.name} — ${t.origin} &rarr; ${t.destination}`;
    $("d-status").innerHTML = statusHtml(t);
  }

  function renderOverview(t) {
    const op = OPERATORS[t.opId];
    const stops = t.stops;
    const kmDone = t.prog;
    const pct = Math.min(100, Math.round(100 * kmDone / stops[stops.length - 1].d));
    const nsIdx = nextStopIdx(t);
    const eta = etaMin(t);
    const stats = Sim.runStats(t);
    const headcodeClass = t.headcode[0] === "1" ? "Express passenger" : t.headcode[0] === "2" ? "Stopping passenger" : "Other";
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
        <span class="k">Service</span><span class="v">${headcodeClass} (${t.headcode[0]}xx)</span>
        <span class="k">Unit</span><span class="v">${t.unitNumber} · ${t.carCount} cars</span>
        <span class="k">Route</span><span class="v">${t.routeName}</span>
        <span class="k">Distance run</span><span class="v">${stats.km.toFixed(0)} km (${(stats.km * 0.621371).toFixed(0)} mi)</span>
        <span class="k">Journey time</span><span class="v">${stats.minutes >= 60 ? Math.floor(stats.minutes / 60) + "h " + Math.round(stats.minutes % 60) + "m" : Math.round(stats.minutes) + " min"}</span>
      </div>
      ${t.cause && Sim.trainDelayMs(t) > MS_PER_MIN ? `<div class="nextbox" style="margin-top:10px"><div class="nb-t">Reported cause of delay</div><div class="nb-v" style="color:var(--bad)">${t.cause}</div></div>` : ""}
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
      else if (isNext && t.state === "run") shown = t.sched[i].arr + Sim.trainDelayMs(t) * 0.6; else shown = null;
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
        <span class="k">Design speed</span><span class="v">${s.maxSpeed} mph</span>
        <span class="k">Builder</span><span class="v">${s.maker}</span>
        <span class="k">Built</span><span class="v">${s.built}</span>
      </div>
      <div class="formation">${form.map(c => `<span class="coach ${c.cls}">${c.label.replace("Coach ", "")}</span>`).join("")}</div>
      <div class="stocknote">${s.note}</div>
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
    pts.push([Sim.simTime, t.curSpeed]);
    const windowMs = Math.max(10 * MS_PER_MIN, Sim.simTime - (pts.length ? pts[0][0] : Sim.simTime));
    const t0 = Sim.simTime - windowMs;
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
    const stats = Sim.runStats(t);
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
      <div class="dim-note" style="margin-top:8px">Speed trace over the last ${Math.max(10, Math.round((Sim.simTime - (t.history[0] ? t.history[0][2] : Sim.simTime)) / MS_PER_MIN))} minutes.</div>
    `;
    drawSpark(t);
  }

  function render() {
    pruneMarkers();
    for (const t of Sim.trains()) {
      if (!trainVisible(t)) continue;
      const m = ensureMarker(t);
      m.setLatLng([t.pos.lat, t.pos.lng]);
      const svg = m.getElement() && m.getElement().querySelector("svg");
      if (svg) svg.style.transform = `rotate(${Math.round(t.bearing)}deg)`;
      const path = t.headcode + " " + Math.round(t.curSpeed) + " mph";
      const tt = m.getTooltip();
      if (tt && tt.getContent() !== path) m.setTooltipContent(path);
    }
    updMarkerSel();
    if (selectedId) {
      const t = Sim.trainById(selectedId);
      if (t) {
        renderHead(t);
        if (selectedTab === "overview") renderOverview(t);
        else if (selectedTab === "callings") renderCallings(t);
        else if (selectedTab === "stock") renderStock(t);
        else renderTele(t);
        if (follow) map.setView([t.pos.lat, t.pos.lng], map.getZoom(), { animate: true, duration: 0.6 });
        if (trail) trail.setLatLngs(t.history.map(p => [p[0], p[1]]).concat([[t.pos.lat, t.pos.lng]]));
      } else {
        selectedId = null;
        $("detail").classList.add("hidden");
      }
    }
    for (const row of document.querySelectorAll(".oprow")) {
      const id = row.dataset.op;
      row.querySelector(".cnt").textContent = Sim.trains().filter(x => x.opId === id && trainVisible(x)).length;
    }
  }

  function renderFeed() {
    const ev = Sim.events().slice(-55).reverse();
    $("feed").innerHTML = ev.map(e => `<div class="fitem ${e.type}" data-id="${e.trainId}"><span class="ftime">${fmtHm(e.time)}</span><span><b>${e.headcode}</b> ${e.message.replace(/^\d\d:\d\d /, "")}</span></div>`).join("");
    document.querySelectorAll(".fitem").forEach(el => {
      el.onclick = () => { const t = Sim.trainById(el.dataset.id); if (t) selectTrain(t.id); };
    });
  }

  function renderSearch(q) {
    const box = $("results");
    q = q.trim().toLowerCase();
    if (q.length < 2) { box.classList.add("hidden"); return; }
    const res = [];
    for (const t of Sim.trains()) {
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
    $("board").classList.remove("hidden");
    renderBoard();
  }
  function closeBoard() {
    boardCode = null;
    $("board").classList.add("hidden");
  }

  function renderBoard() {
    if (boardCode == null) return;
    const rows = Sim.stationBoard(boardCode);
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
        const t = Sim.trains().find(x => x.headcode === el.dataset.hc);
        closeBoard();
        if (t) selectTrain(t.id);
      };
    });
  }

  const realTick = () => Sim.tick(250);

  function loop() {
    realTick();
    $("simclock").textContent = fmtClock(Sim.simTime);
    render();
    if (boardCode != null) renderBoard();
  }

  init();
})();
