/*
 * LiveEngine — drop-in replacement for the Sim engine, fed by real-time data.
 *
 * Expects the normalized JSON served by server.js at GET /api/live
 * ({ trains: [...], stations: {...} }). Point it elsewhere with RailRadar's
 * data-source settings (stored in localStorage.rr_mode as "live|<url>").
 * Only Amtrak publishes a key-free real-time map feed; UK and freight
 * operators stay simulated.
 */
const LiveEngine = (() => {
  const MS_PER_MIN = 60000;
  const REFRESH_MS = 30000;
  const DESPAWN_MS = 4 * MS_PER_MIN;
  const MAX_DELAY = 12 * 3600000;

  let source = "api/live";
  let started = false;
  let livePaused = false;
  let lastErr = null;
  let lastFetch = 0;
  let firstData = false;
  const built = new Map(); // id -> sim-shaped train
  const prevSnap = new Map(); // id -> [{arr,dep}]
  const histAccum = new Map(); // id -> [[lat,lng,ts,speed]]
  const events = [];

  /* ------------------------------------------------------------ helpers */

  function distKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return 0;
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180;
    const la2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function fmtTime(ms) {
    const d = new Date(ms);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function fmtDelay(ms) {
    const m = Math.round(ms / 60000);
    if (m <= 0) return "on time";
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
  }

  function pushEvent(type, trainLike, timeMs, message) {
    events.push({
      time: timeMs,
      type,
      trainId: trainLike ? trainLike.id : "",
      headcode: trainLike ? trainLike.headcode : "system",
      op: trainLike ? trainLike.opId : "amtrak",
      message
    });
    if (events.length > 220) events.splice(0, events.length - 220);
  }

  function log(msg) {
    try { console.log("[live] " + msg); } catch (_e) {}
  }

  /* ------------------------------------------------ route / stock lookup */

  let routeByBase = null;
  function routeFor(raw) {
    if (!routeByBase) {
      routeByBase = [];
      for (const def of ROUTES) {
        routeByBase.push({ base: def.name.split(/[:\u2014\u2013]/)[0].trim().toLowerCase(), def });
      }
    }
    const rn = String(raw.routeName || "").trim().toLowerCase();
    if (rn) {
      let hit = routeByBase.find(r => r.base === rn);
      if (!hit) hit = routeByBase.find(r => r.base.startsWith(rn) || rn.startsWith(r.base));
      if (hit) return hit.def;
      const byNum = hitNumbers(raw.trainNum);
      if (byNum) return byNum;
      return { id: "live-" + rn.replace(/[^a-z0-9]+/g, "-"), name: raw.routeName, nums: [0, 0] };
    }
    return { id: "live-unknown", name: "Amtrak train " + raw.trainNum, nums: [0, 0] };
  }

  function hitNumbers(num) {
    const n = Number(num);
    if (!isFinite(n)) return null;
    for (const def of ROUTES) {
      if (typeof def.nums[0] !== "number") continue;
      for (const base of def.nums) {
        if (n >= base && n <= base + 30) return def;
      }
    }
    return null;
  }

  const STOCK_BY_KEYWORD = [
    [/acela/i, "acela"],
    [/keystone|pennsylvanian|northeast regional|empire service|maple leaf|adirondack|ethan allen|vermonter|valley flyer|hartford|new haven/i, "genesis_amf"],
    [/lake shore|cardinal|crescent|silver meteor|silver star|palmetto|carolinian/i, "p42vl"],
    [/zephyr|empire builder|southwest chief|sunset limited|texas eagle|city of new orleans|coast starlight|capitol limited/i, "p42sl"],
    [/surfliner|cascades|wolverine|hiawatha|lincoln service|downeaster|illini|saluki|illinois|heartland|san joaquin|capitol corridor/i, "airo"]
  ];

  function stockFor(raw) {
    for (const [re, id] of STOCK_BY_KEYWORD) {
      if (re.test(raw.routeName || "")) return STOCK[id];
    }
    return STOCK.genesis_amf;
  }

  function stockIdOf(stock) {
    for (const [k, v] of Object.entries(STOCK)) if (v === stock) return k;
    return "genesis_amf";
  }

  /* ------------------------------------------------------ buildSim train */

  function projectOnto(stops, pos) {
    if (!pos || pos.lat == null) return 0;
    let best = { err: Infinity, prog: 0 };
    let cum = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      const seg = distKm(a, b);
      let f = 0;
      if (seg > 0) {
        const denom = (b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2 || 1e-12;
        const dot =
          ((pos.lat - a.lat) * (b.lat - a.lat) +
            (pos.lng - a.lng) * (b.lng - a.lng)) / denom;
        f = clamp(dot, 0, 1);
      }
      const near = {
        lat: a.lat + (b.lat - a.lat) * f,
        lng: a.lng + (b.lng - a.lng) * f
      };
      const err = distKm(near, pos);
      if (err < best.err) best = { err, prog: cum + seg * f };
      cum += seg;
    }
    return best.prog;
  }

  const lastIdxWith = (key) => {
    for (let i = currentStations.length - 1; i >= 0; i--) {
      if (currentStations[i][key] != null) return i;
    }
    return -1;
  };

  let currentStations = null;

  function buildTrain(raw) {
    const now = Date.now();
    const stn = raw.stations || [];
    if (stn.length < 2) return null;
    currentStations = stn;
    const routeDef = routeFor(raw);
    const routeId = routeDef.id;
    const stops = [];
    let cum = 0;
    for (let i = 0; i < stn.length; i++) {
      const s = stn[i];
      let lat = s.lat, lng = s.lng;
      if (lat == null || lng == null) {
        const p = stops[i - 1];
        if (p) { lat = p.lat; lng = p.lng; }
      }
      if (i > 0) {
        const seg = distKm(stops[i - 1], { lat, lng });
        cum += seg > 0 ? seg : 0.5;
      }
      const our = STATIONS[s.code];
      stops.push({ code: s.code, name: s.name, lat, lng, d: cum, size: our ? our.size : 1 });
    }
    const n = stops.length;
    const sched = [];
    for (let i = 0; i < n; i++) {
      const s = stn[i];
      let arr = s.schArr != null ? s.schArr : s.estArr;
      let dep = s.schDep != null ? s.schDep : s.estDep;
      if (i === 0) arr = dep != null ? dep : arr;
      if (i === n - 1) dep = arr != null ? arr : dep;
      if (arr == null && dep != null) arr = dep;
      if (dep == null && arr != null) dep = arr;
      if (arr == null) {
        const prev = sched[i - 1];
        const t0 = prev ? prev.dep : raw.origSchDep || now;
        arr = t0; dep = t0;
      }
      if (dep < arr) dep = arr;
      sched.push({ code: s.code, name: s.name, arr, dep });
    }

    const arrived = stn.map(s => s.postArr != null);
    const departed = stn.map(s => s.postDep != null);
    const lastDep = departed.lastIndexOf(true);
    let state, stopIdx;
    if (raw.trainState === "Completed") { state = "done"; stopIdx = n - 1; }
    else if (raw.trainState === "Predeparture" || (!departed[0] && raw.trainState !== "Active")) {
      state = "pre"; stopIdx = 0;
    } else if (lastDep >= 0 && lastDep + 1 < n && arrived[lastDep + 1] && !departed[lastDep + 1]) {
      state = "dwell"; stopIdx = lastDep + 1;
    } else {
      state = "run"; stopIdx = Math.max(0, lastDep);
    }

    const delayMs = rawDelay(raw, state);
    const nextIdx = clamp(stopIdx + (state === "dwell" ? 0 : 1), 0, n - 1);
    const nextCmnt = stn[nextIdx] && stn[nextIdx].postCmnt;
    const cmntLate = nextCmnt && !/on time/i.test(nextCmnt) ? nextCmnt : null;
    const cause = delayMs > 4 * MS_PER_MIN
      ? (raw.statusMsg || cmntLate)
      : cmntLate;

    let pos = raw.lat != null && raw.lng != null ? { lat: raw.lat, lng: raw.lng } : null;
    if (!pos && raw.geometry && raw.geometry.lat != null) {
      pos = { lat: raw.geometry.lat, lng: raw.geometry.lng };
    }
    if (!pos || pos.lat == null) {
      pos = { lat: stops[stopIdx].lat, lng: stops[stopIdx].lng };
    }
    const prog = projectOnto(stops, pos);
    const stock = stockFor(raw);
    const carsArr = Array.isArray(stock.cars) && stock.cars.length ? stock.cars : [6];
    const carCount = carsArr[Number(raw.trainNum) % carsArr.length] || carsArr[0];
    const curSpeed = raw.velocity != null && isFinite(raw.velocity) ? Math.round(raw.velocity) : 0;

    const t = {
      id: raw.id,
      headcode: raw.headcode,
      routeId,
      routeName: raw.routeName || routeDef.name,
      dir: 0,
      opId: "amtrak",
      type: "pass",
      stockId: stockIdOf(stock),
      stock,
      carCount,
      unitNumber: "#" + raw.trainNum,
      origin: stops[0].name,
      destination: stops[n - 1].name,
      originCode: raw.origCode || stops[0].code,
      destCode: raw.destCode || stops[n - 1].code,
      stops,
      sched,
      delayMs,
      cause,
      depMs: raw.origSchDep || sched[0].dep,
      state,
      prog,
      stopIdx,
      curSpeed,
      pos,
      bearing: raw.heading != null ? raw.heading : 0,
      actual: stn.map((s, i) => ({
        arr: s.postArr,
        dep: s.postDep,
        schedDepTarget: state === "dwell" && i === stopIdx
          ? (s.estDep != null ? s.estDep : s.postArr)
          : null
      })),
      history: histAccum.get(raw.id) || [],
      despawnAt: state === "done" ? (stn[n - 1].postArr || now) + DESPAWN_MS : null,
      trailKm: prog,
      startedAt: raw.origSchDep || sched[0].dep,
      live: true
    };

    const h = histAccum.get(t.id) || [];
    const lastPt = h[h.length - 1];
    if (state !== "pre" &&
        (!lastPt || distKm({ lat: lastPt[0], lng: lastPt[1] }, pos) > 0.25)) {
      h.push([pos.lat, pos.lng, now, curSpeed]);
      if (h.length > 240) h.shift();
      histAccum.set(t.id, h);
    }
    t.history = h;
    return t;
  }

  function rawDelay(raw, state) {
    const stn = raw.stations;
    if (state === "done" || state === "pre") return 0;
    let idx = -1;
    for (let i = 0; i < stn.length; i++) {
      if (stn[i].postDep == null && stn[i].postArr == null) { idx = i; break; }
    }
    if (idx < 0) {
      for (let i = stn.length - 1; i >= 0; i--) {
        if (stn[i].postArr != null) { idx = i; break; }
      }
    }
    if (idx < 0) return 0;
    const s = stn[idx];
    const est = s.estArr != null ? s.estArr : s.estDep != null ? s.estDep : s.postArr;
    const sch = s.schArr != null ? s.schArr : s.schDep;
    if (est == null || sch == null) return 0;
    return clamp(est - sch, 0, MAX_DELAY);
  }

  /* ------------------------------------------------------------ fetching */

  function setSource(url) {
    if (typeof url === "string" && url.trim()) source = url.trim().replace(/\/$/, "");
  }

  async function fetchLive() {
    try {
      const sep = source.indexOf("?") >= 0 ? "&" : "?";
      const r = await fetch(source + sep + "t=" + Date.now(), { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "HTTP " + r.status);
      ingest(data, Date.now());
      lastErr = null;
      lastFetch = Date.now();
      if (!firstData) {
        firstData = true;
        log("live feed connected — " + built.size + " trains");
      }
    } catch (e) {
      lastErr = String((e && e.message) || e);
      log("live feed error: " + lastErr);
      pushEvent("sys", null, Date.now(),
        "Live feed unavailable — " + lastErr + " (check that server.js is running)");
    }
  }

  function ingest(data) {
    const used = new Set();
    const raws = [];
    for (const raw of (data.trains || [])) {
      let hc = "#" + raw.trainNum;
      if (used.has(hc)) hc = hc + "\u00b7" + String(raw.id).slice(-4);
      used.add(hc);
      raw.headcode = hc;
      raws.push(raw);
    }
    const seen = new Set();
    const builtList = [];
    for (const raw of raws) {
      const t = buildTrain(raw);
      if (!t) continue;
      seen.add(t.id);
      builtList.push(t);
      diffEvents(t, prevSnap.get(t.id));
      prevSnap.set(t.id, t.actual.map(x => ({ arr: x.arr, dep: x.dep })));
    }
    for (const id of Array.from(prevSnap.keys())) if (!seen.has(id)) prevSnap.delete(id);
    built.clear();
    for (const t of builtList) {
      if (t.state !== "done" || Date.now() < t.despawnAt) built.set(t.id, t);
    }
    log("ingest: " + builtList.length + " trains (" + built.size + " on board)");
  }

  function diffEvents(t, prev) {
    if (!prev) return;
    for (let i = 0; i < t.actual.length; i++) {
      const c = t.actual[i], p = prev[i] || {};
      if (c.dep != null && p.dep == null) {
        const late = c.dep - (t.sched[i].dep || c.dep);
        pushEvent("dep", t, c.dep,
          `departed ${t.sched[i].name}${late > 4 * MS_PER_MIN ? " — " + fmtDelay(late) + " late" : ""}`);
      } else if (c.arr != null && p.arr == null && c.dep == null) {
        pushEvent("arr", t, c.arr, `arrived ${t.sched[i].name}`);
      }
    }
  }

  /* ------------------------------------------------------ engine surface */

  function init() {
    if (started) return;
    started = true;
    fetchLive();
    setInterval(() => { if (!livePaused) fetchLive(); }, REFRESH_MS);
  }

  function tick() { /* positions come from the feed; the app loop just re-renders */ }

  function trains() {
    return Array.from(built.values());
  }

  function trainById(id) {
    return built.get(id);
  }

  function expectedTimeAt(t) {
    if (t.state === "dwell") return t.actual[t.stopIdx].schedDepTarget || t.sched[t.stopIdx].dep;
    for (let i = t.stopIdx + 1; i < t.sched.length; i++) {
      const a = t.actual[i] || {};
      if (a.arr != null) continue;
      return a.arr != null ? a.arr : t.sched[i].arr + (t.delayMs || 0);
    }
    return t.sched[t.sched.length - 1].arr + (t.delayMs || 0);
  }

  function effectiveTimes(t) {
    return t.stops.map((s, i) => {
      const a = t.actual[i] || {};
      const sched = t.sched[i];
      return {
        arr: a.arr != null ? a.arr : (sched.arr != null ? sched.arr + (t.delayMs || 0) : null),
        dep: a.dep != null ? a.dep : (sched.dep != null ? sched.dep + (t.delayMs || 0) : null)
      };
    });
  }

  function projectAt(t, whenMs) {
    if (t.state === "pre") return null;
    const eff = effectiveTimes(t);
    const n = eff.length;
    if (whenMs <= eff[0].dep) {
      return { lat: t.stops[0].lat, lng: t.stops[0].lng, prog: 0, at: whenMs, pre: true };
    }
    for (let k = 0; k < n - 1; k++) {
      const dep = eff[k].dep != null ? eff[k].dep : eff[k].arr;
      const arr = eff[k + 1].arr != null ? eff[k + 1].arr : eff[k + 1].dep;
      if (dep == null || arr == null) continue;
      if (whenMs < arr) {
        if (whenMs < dep && k > 0) {
          return { lat: t.stops[k].lat, lng: t.stops[k].lng, prog: t.stops[k].d, at: whenMs, dwellAt: k };
        }
        const span = Math.max(arr - dep, 1);
        const f = clamp((whenMs - dep) / span, 0, 1);
        const a = t.stops[k], b = t.stops[k + 1];
        const prog = a.d + f * (b.d - a.d);
        return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, prog, at: whenMs };
      }
    }
    return null;
  }

  function stationBoard(code) {
    const out = [];
    const now = Date.now();
    for (const t of built.values()) {
      if (t.state === "done") continue;
      const idx = t.stops.findIndex(s => s.code === code);
      if (idx < 0) continue;
      const a = t.actual[idx] || {};
      if (a.dep != null) continue;
      const s = t.sched[idx];
      let exp;
      if (t.state === "dwell" && t.stopIdx === idx) {
        exp = a.schedDepTarget || s.dep;
      } else if (t.state === "pre") {
        exp = Math.max(s.dep, t.depMs);
      } else {
        exp = s.dep + (t.delayMs || 0);
      }
      if (now > exp + 15000) continue;
      out.push({
        headcode: t.headcode, op: t.opId, dest: t.destination,
        origin: t.origin, sched: s.dep, exp, idx, state: t.state
      });
    }
    out.sort((x, y) => x.sched - y.sched);
    return out.slice(0, 14);
  }

  function trainDelayMs(t) {
    return t.delayMs || 0;
  }

  function runStats(t) {
    return { km: t.prog || 0, minutes: (Date.now() - t.depMs) / 60000 };
  }

  return {
    init, tick,
    setSpeed() {},
    setPaused(p) { livePaused = !!p; },
    get simTime() { return Date.now(); },
    get paused() { return livePaused; },
    get multiplier() { return 1; },
    get lastError() { return lastErr; },
    get source() { return source; },
    setSource,
    trains, trainById,
    events: () => events,
    stationBoard,
    trainDelayMs, expectedTimeAt, projectAt, fmtTime, fmtDelay, distKm,
    debugRoute: () => null,
    runStats,
    ingest,
    status: () => ({ live: firstData, error: lastErr, fetchedAt: lastFetch, source })
  };
})();
