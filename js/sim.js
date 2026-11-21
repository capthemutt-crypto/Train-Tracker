const Sim = (() => {
  const MS_PER_MIN = 60000;
  const ZONE_KM = 1.4;
  const anch = new Date();
  anch.setHours(16, 22, 0, 0);
  const simStart = anch.getTime();
  let simTime = simStart;
  let multiplier = 1;
  let paused = false;
  let windowEnd = 0;

  const trains = new Map();
  const events = [];
  let trainSeq = 0;
  let headcodeSeq = {};

  const routes = {};

  function rng(seed) {
    let s = typeof seed === "string" ? stringHash(seed) : seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function stringHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function distKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180;
    const la2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {
    const la1 = a.lat * Math.PI / 180;
    const la2 = b.lat * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(la2);
    const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  const smooth = (x) => x * x * (3 - 2 * x);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function parsePathEntry(entry) {
    if (typeof entry === "string" && entry[0] === "@") {
      const [lat, lng] = entry.slice(1).split(",").map(Number);
      return { lat, lng, via: true };
    }
    return STATIONS[entry];
  }

  function buildRoute(def) {
    const fwdStops = def.path.map(parsePathEntry);
    const pts = [];
    const meta = [];
    for (let i = 0; i < fwdStops.length; i++) {
      if (i > 0) {
        const prev = fwdStops[i - 1];
        const next = fwdStops[i];
        const n = Math.max(0, Math.round(distKm(prev, next) / 18));
        for (let j = 1; j <= n; j++) {
          const f = j / (n + 1);
          pts.push([prev.lat + (next.lat - prev.lat) * f, prev.lng + (next.lng - prev.lng) * f]);
          meta.push(null);
        }
      }
      const st = fwdStops[i];
      pts.push([st.lat, st.lng]);
      meta.push(st.via ? null : { code: def.path[i], size: st.size });
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distKm({ lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: pts[i][0], lng: pts[i][1] }));

    const routesOut = {};
    for (const dir of [0, 1]) {
      const segs = [];
      const n = pts.length;
      let stopCounter = 0;
      for (let i = 0; i < n - 1; i++) {
        const ai = dir ? n - 1 - i : i;
        const bi = dir ? n - 2 - i : i + 1;
        const a = pts[ai], b = pts[bi];
        const rand = rng(def.id + i + dir * 977);
        const limit = clamp(def.base + (rand() - 0.5) * 34, 45, 140);
        const varf = 0.985 + rand() * 0.03;
        const stop = meta[bi] ? { ...meta[bi], idx: 0 } : null;
        if (stop) stop.idx = ++stopCounter;
        segs.push({
          ax: a, bx: b, cumStart: 0, d: distKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }),
          limit, varf, j1: 0.96 + rand() * 0.08, stop
        });
      }
      let acc = 0;
      for (const s of segs) { s.cumStart = acc; acc += s.d; }
      const origins = dir ? fwdStops[fwdStops.length - 1] : fwdStops[0];
      const stops = [{ code: dir ? def.path[def.path.length - 1] : def.path[0], name: origins.name, size: origins.size, d: 0 }];
      for (const s of segs) {
        if (s.stop) {
          const station = STATIONS[s.stop.code];
          stops.push({ code: s.stop.code, name: station.name, size: station.size, d: s.cumStart + s.d });
        }
      }
      routesOut[dir] = { segs, stops, totalKm: acc, terminusNames: [fwdStops[0].name, fwdStops[fwdStops.length - 1].name] };
    }
    return routesOut;
  }

  function segSpeedAt(seg, kmFromPrev, kmToNext, cruise) {
    const m = (v) => 0.3 + 0.7 * smooth(clamp(v / ZONE_KM, 0, 1));
    return cruise * Math.min(m(kmFromPrev), m(kmToNext));
  }

  function segTimeEstimate(seg, cruise) {
    let t = 0;
    const ds = 0.02;
    for (let x = ds / 2; x < seg.d; x += ds) {
      const sp = segSpeedAt(seg, x, seg.d - x, cruise);
      t += ds / (sp * 1.609344) * 3600;
    }
    return t;
  }

  function dwellSeconds(size) {
    return size === 3 ? 105 : size === 2 ? 70 : 40;
  }

  function buildTimetable(service, dirObj, stock, depMinutes) {
    const sched = [];
    let t = depMinutes * MS_PER_MIN;
    const stops = dirObj.stops;
    const segTimeArr = (seg) => segTimeEstimate(seg, Math.round(Math.min(stock.maxSpeed, seg.limit) * seg.varf * seg.j1));
    let segIdx = 0;
    for (let i = 0; i < stops.length; i++) {
      if (i > 0) {
        while (segIdx < dirObj.segs.length) {
          const seg = dirObj.segs[segIdx];
          t += segTimeArr(seg) * 1000;
          segIdx++;
          if (seg.stop) break;
        }
      }
      const arr = Math.round(t);
      t += i === 0 ? 0 : dwellSeconds(stops[i].size) * 1000;
      const dep = Math.round(t);
      sched.push({ code: stops[i].code, name: stops[i].name, arr, dep });
    }
    return { sched, cruiseSegs: sched.map((_, i) => i < dirObj.segs.length ? dirObj.segs[i] : null) };
  }

  function nextHeadcode(routeDef, dir) {
    const key = routeDef.id + "_" + dir;
    if (!headcodeSeq[key]) headcodeSeq[key] = { n: 0, d: 1 };
    const h = headcodeSeq[key];
    if (typeof routeDef.nums[0] === "number") {
      h.n += 2;
      if (h.n > 30) h.n = 0;
      return String(routeDef.nums[dir] + h.n);
    }
    h.n += h.d;
    if (h.n > 98) { h.n = 1; h.d = 1; }
    return routeDef.nums[dir] + String(h.n).padStart(2, "0");
  }

  function makeTrain(routeDef, dir, depMs, unitEntry) {
    const dirObj = routes[routeDef.id][dir];
    const stockId = unitEntry[0];
    const cars = unitEntry[1];
    const stock = STOCK[stockId];
    const seed = stringHash(routeDef.id + dir + depMs + stockId);
    const rand = rng(seed);
    const delayed = rand() < 0.32;
    const delayMin = delayed ? Math.round(2 + rand() * 11) : 0;
    const { sched } = buildTimetable({ maxSpeed: stock.maxSpeed }, dirObj, stock, depMs / MS_PER_MIN);
    sched.forEach(s => { s.dep += delayed ? delayMin * MS_PER_MIN : 0; });
    const unitNumber = stockId === "43"
      ? `43 ${String(100 + Math.floor(rand() * 180))}`
      : `${stockId} ${String(1 + Math.floor(rand() * 354)).padStart(3, "0")}`;
    const t = {
      id: "t" + (++trainSeq),
      headcode: nextHeadcode(routeDef, dir),
      routeId: routeDef.id,
      routeName: routeDef.name,
      dir,

      opId: unitOpFor(routeDef),
      stockId,
      stock,
      carCount: cars,
      unitNumber,
      origin: dirObj.terminusNames[dir ? 1 : 0],
      destination: dirObj.terminusNames[dir ? 0 : 1],
      originCode: (dir ? dirObj.stops[dirObj.stops.length - 1] : dirObj.stops[0]).code,
      destCode: (dir ? dirObj.stops[0] : dirObj.stops[dirObj.stops.length - 1]).code,
      stops: dirObj.stops,
      segs: dirObj.segs,
      sched,
      delayMs: delayMin * MS_PER_MIN,
      cause: delayed ? DELAY_CAUSES[Math.floor(rand() * DELAY_CAUSES.length)] : null,
      depMs,
      state: depMs >= simTime ? "pre" : "run",
      prog: 0,
      stopIdx: 0,
      curSpeed: 0,
      pos: null,
      bearing: 0,
      actual: sched.map(() => ({ arr: null, dep: null })),
      history: [],
      despawnAt: null,
      trailKm: 0,
      startedAt: depMs,
      rand: rng(seed ^ 0xA1B2)
    };
    if (t.state === "run") syncToSchedule(t);
    trains.set(t.id, t);
    return t;
  }

  function unitOpFor(routeDef) {
    const map = { wcml: "awc", ecml: "lner", "gwr-w": "gwr", "gwr-sw": "gwr", "xc-sw": "xc", "xc-ne": "xc", "tpe-sc": "tpe", "tpe-pn": "tpe", "nr-nw": "nr", "sr-c": "sr", "gm-ang": "ga", "gm-cbg": "ga", acela: "amtrak", "nec-reg": "amtrak", keystone: "amtrak", empire: "amtrak", "maple-leaf": "amtrak", adirondack: "amtrak", vermonter: "amtrak", downeaster: "amtrak", crescent: "amtrak", "silver-met": "amtrak", "silver-star": "amtrak", "auto-train": "amtrak", carolinian: "amtrak", "lake-shore": "amtrak", capitol: "amtrak", cardinal: "amtrak", "empire-builder": "amtrak", "cal-zephyr": "amtrak", "sw-chief": "amtrak", sunset: "amtrak", "texas-eagle": "amtrak", "city-no": "amtrak", wolverine: "amtrak", hiawatha: "amtrak", lincoln: "amtrak", starlight: "amtrak", surfliner: "amtrak", cascades: "amtrak", "san-joaquin": "amtrak", heartland: "amtrak" };
    return map[routeDef.id] || "nr";
  }

  function syncToSchedule(t) {
    const n = t.sched.length;
    for (let i = 0; i < n; i++) t.actual[i] = { arr: t.sched[i].arr, dep: t.sched[i].dep };
    if (simTime >= t.sched[n - 1].arr) {
      t.state = "done";
      t.prog = t.stops[n - 1].d;
      t.curSpeed = 0;
      t.despawnAt = simTime + 4 * 60000;
    } else if (simTime < t.sched[0].dep) {
      t.state = "pre";
      return;
    } else {
      let i = 0;
      while (i < n - 2 && simTime >= t.sched[i + 1].dep) i++;
      if (simTime < t.sched[i + 1].arr) {
        const f = clamp((simTime - t.sched[i].dep) / (t.sched[i + 1].arr - t.sched[i].dep), 0, 1);
        t.prog = t.stops[i].d + f * (t.stops[i + 1].d - t.stops[i].d);
        t.state = "run";
        t.stopIdx = i;
        t.actual[i].dep = null;
      } else {
        t.state = "dwell";
        t.stopIdx = i + 1;
        t.prog = t.stops[i + 1].d;
        t.actual[t.stopIdx].arr = Math.min(simTime, t.sched[t.stopIdx].arr);
        t.actual[t.stopIdx].dep = null;
        t.actual[t.stopIdx].schedDepTarget = Math.max(t.sched[t.stopIdx].dep, Math.min(simTime, t.sched[t.stopIdx].arr) + dwellSeconds(t.stops[t.stopIdx].size) * 1000);
      }
      if (t.state === "run") t.actual[i].dep = null;
    }
    const p = posAlong(t);
    t.pos = { lat: p.lat, lng: p.lng };
    if (t.state === "run" && t.stopIdx >= 0) {
      const seg = t.segs[p.segIdx];
      t.bearing = bearing({ lat: seg.ax[0], lng: seg.ax[1] }, { lat: seg.bx[0], lng: seg.bx[1] });
      t.curSpeed = Math.round(Math.min(t.stock.maxSpeed, seg.limit) * seg.varf * seg.j1);
    }
    t.history = [];
  }

  function posAlong(t, progArg) {
    const prog = progArg != null ? progArg : t.prog;
    const segs = t.segs;
    if (prog <= 0) return { lat: segs[0].ax[0], lng: segs[0].ax[1], segIdx: 0, dToNext: segs[0].d, kmFromPrev: 0, kmToNext: segs[0].d };
    for (let i = 0; i < segs.length; i++) {
      if (prog < segs[i].cumStart + segs[i].d - 1e-7) {
        const pos = prog - segs[i].cumStart;
        const f = segs[i].d > 0 ? clamp(pos / segs[i].d, 0, 1) : 0;
        const ax = segs[i].ax, bx = segs[i].bx;
        return {
          lat: ax[0] + (bx[0] - ax[0]) * f,
          lng: ax[1] + (bx[1] - ax[1]) * f,
          segIdx: i,
          dToNext: segs[i].d - pos,
          kmFromPrev: pos,
          kmToNext: segs[i].d - pos
        };
      }
    }
    const last = segs[segs.length - 1];
    return { lat: last.bx[0], lng: last.bx[1], segIdx: segs.length - 1, dToNext: 0, kmFromPrev: last.d, kmToNext: 0 };
  }

  function atBoundary(t, seg) {
    return t.prog >= seg.cumStart + seg.d - 1e-6;
  }

  function stepTrain(t, dtMs) {
    if (t.state === "pre") {
      if (simTime >= t.sched[0].dep) {
        t.state = "run";
        pushEvent("dep_origin", t, `${fmtTime(simTime)} departed ${t.origin}`);
        t.actual[0].dep = simTime;
        t.lastTick = simTime;
      } else return;
    }
    if (t.state === "done") {
      if (t.despawnAt && simTime >= t.despawnAt) trains.delete(t.id);
      return;
    }
    t.lastTick = simTime;
    if (t.state === "dwell") {
      const schedDep = t.actual[t.stopIdx].schedDepTarget || t.sched[t.stopIdx].dep;
      if (simTime >= schedDep) {
        t.state = "run";
        t.actual[t.stopIdx].dep = simTime;
        pushEvent("dep", t, `${fmtTime(simTime)} departed ${t.sched[t.stopIdx].name}`);
      } else { t.curSpeed = 0; return; }
    }
    const cruiseBase = (ad) => {
      const seg = t.segs[ad.segIdx];
      return Math.min(t.stock.maxSpeed, seg.limit) * seg.varf * seg.j1;
    };
    let moved = 0;
    const budget = dtMs;
    let consumed = 0;
    while (consumed < budget && t.state === "run") {
      const p = posAlong(t);
      const seg = t.segs[p.segIdx];
      const late = Math.max(0, simTime - expectedTimeAt(t));
      const recovery = 1 + Math.min(0.15, late / 3600000);
      const cruise = cruiseBase(p) * recovery;
      const mph = segSpeedAt(seg, p.kmFromPrev, p.kmToNext, cruise);
      const kmPerMs = mph * 1.609344 / 3600 / 1000;
      const remain = seg.cumStart + seg.d - t.prog;
      const dd = Math.min(kmPerMs * (budget - consumed), remain);
      t.prog += dd;
      consumed += dd > 0 ? dd / kmPerMs : budget;
      t.curSpeed = dd > 0 ? mph : 0;
      t.trailKm += dd;
      if (atBoundary(t, seg)) {
        if (p.segIdx >= t.segs.length - 1) {
          t.state = "done";
          t.prog = t.segs[t.segs.length - 1].cumStart + t.segs[t.segs.length - 1].d;
          t.curSpeed = 0;
          const lastIdx = t.sched.length - 1;
          t.actual[lastIdx].arr = simTime;
          t.actual[lastIdx].dep = simTime;
          pushEvent("terminate", t, `${fmtTime(simTime)} arrived ${t.destination} (terminus)`);
          t.despawnAt = simTime + 4 * 60000;
          break;
        } else if (seg.stop) {
          const si = seg.stop.idx;
          t.stopIdx = si;
          t.actual[si].arr = simTime;
          if (simTime > t.sched[si].dep) {
            pushEvent("late", t, `running ${fmtDelay(simTime - t.sched[si].dep)} late arriving ${t.sched[si].name}`);
          }
          if (t.rand() < 0.09) {
            const extra = 60000 * (1 + Math.floor(t.rand() * 3));
            t.actual[si].schedDepTarget = Math.max(t.sched[si].dep, simTime + dwellSeconds(t.stops[si].size) * 1000 + extra);
          } else {
            t.actual[si].schedDepTarget = Math.max(t.sched[si].dep, simTime + dwellSeconds(t.stops[si].size) * 1000, t.actual[si].arr + dwellSeconds(t.stops[si].size) * 1000);
          }
          t.state = "dwell";
          break;
        } else {
          continue;
        }
      }
    }
    const p = posAlong(t);
    const prev = t.pos;
    t.pos = { lat: p.lat, lng: p.lng };
    if (prev && (prev.lat !== t.pos.lat || prev.lng !== t.pos.lng)) {
      t.bearing = bearing(prev, t.pos);
    }
    if (t.history.length === 0 || simTime - t.history[t.history.length - 1][2] > 20000) {
      t.history.push([t.pos.lat, t.pos.lng, simTime, t.curSpeed]);
      if (t.history.length > 160) t.history.shift();
    }
  }

  function expectedTimeAt(t) {
    const stops = t.stops;
    if (t.state === "dwell") return t.sched[t.stopIdx].dep;
    let k = 0;
    while (k < stops.length - 1 && t.prog > stops[k + 1].d) k++;
    if (k >= stops.length - 1) return t.sched[t.sched.length - 1].arr;
    const a = t.sched[k], b = t.sched[k + 1];
    const span = stops[k + 1].d - stops[k].d;
    const f = span > 0 ? clamp((t.prog - stops[k].d) / span, 0, 1) : 1;
    const base = a.dep || a.arr;
    return base + f * (b.arr - base);
  }

  function projectAt(t, whenMs) {
    const sched = t.sched, stops = t.stops, n = sched.length;
    if (whenMs <= sched[0].dep) {
      const p = posAlong(t, 0);
      return { lat: p.lat, lng: p.lng, prog: 0, at: whenMs, pre: true };
    }
    if (whenMs >= sched[n - 1].arr) return null;
    for (let k = 0; k < n - 1; k++) {
      const dep = sched[k].dep || sched[k].arr;
      const arr = sched[k + 1].arr;
      if (whenMs < arr) {
        if (k > 0 && whenMs < dep) {
          const p = posAlong(t, stops[k].d);
          return { lat: p.lat, lng: p.lng, prog: stops[k].d, at: whenMs, dwellAt: k };
        }
        const span = arr - dep;
        const f = span > 0 ? clamp((whenMs - dep) / span, 0, 1) : 0;
        const prog = stops[k].d + f * (stops[k + 1].d - stops[k].d);
        const p = posAlong(t, prog);
        return { lat: p.lat, lng: p.lng, prog, at: whenMs };
      }
    }
    return null;
  }

  function fmtTime(ms) {
    const d = new Date(ms);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function fmtDelay(ms) {
    const m = Math.round(ms / 60000);
    if (m <= 0) return "on time";
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
  }

  function pushEvent(type, t, message) {
    events.push({ time: simTime, type, trainId: t.id, headcode: t.headcode, op: t.opId, message });
    if (events.length > 220) events.splice(0, events.length - 220);
  }

  function generateWindow(dayStartMs) {
    for (const def of ROUTES) {
      const svc = def.service;
      for (const dir of [0, 1]) {
        let dep = dayStartMs + svc.first * MS_PER_MIN + (dir ? svc.every * MS_PER_MIN / 2 : 0);
        const end = dayStartMs + svc.last * MS_PER_MIN;
        let idx = 0;
        while (dep <= end) {
          const unitEntry = def.units[idx % def.units.length];
          makeTrain(def, dir, Math.round(dep), unitEntry);
          dep += svc.every * MS_PER_MIN;
          idx++;
        }
      }
    }
    windowEnd = dayStartMs + 27 * 3600000;
  }

  function tick(dtRealMs) {
    if (paused) return;
    const dt = dtRealMs * multiplier;
    simTime += dt;
    if (simTime > windowEnd - 2 * 3600000) {
      const base = new Date(windowEnd);
      base.setHours(0, 0, 0, 0);
      generateWindow(base.getTime());
    }
    for (const t of Array.from(trains.values())) stepTrain(t, dt);
  }

  function init() {
    for (const def of ROUTES) routes[def.id] = buildRoute(def);
    const d = new Date(simStart);
    d.setHours(0, 0, 0, 0);
    generateWindow(d.getTime());
  }

  function trainDelayMs(t) {
    if (t.state === "pre") return 0;
    if (t.state === "done") return 0;
    if (t.state === "dwell") {
      const sched = t.sched[t.stopIdx];
      return Math.max(simTime - sched.arr, 0);
    }
    return Math.max(0, simTime - expectedTimeAt(t));
  }

  function trainAt(t) {
    return t.pos;
  }

  function stationBoard(code) {
    const out = [];
    for (const t of trains.values()) {
      const idx = t.sched.findIndex(s => s.code === code);
      if (idx < 0 || t.state === "done") continue;
      const s = t.sched[idx];
      if (simTime > s.dep + 30 * MS_PER_MIN) continue;
      let exp;
      if (t.actual[idx].dep !== null) continue;
      if (t.actual[idx].arr !== null) {
        exp = t.actual[idx].schedDepTarget || Math.max(s.dep, t.actual[idx].arr + dwellSeconds(t.stops[idx].size) * 1000);
      } else if (t.state === "pre") {
        exp = Math.max(s.dep, t.depMs);
      } else {
        exp = s.dep + trainDelayMs(t);
      }
      if (simTime > exp + 15000) continue;
      out.push({ headcode: t.headcode, op: t.opId, dest: t.destination, origin: t.origin, sched: s.dep, exp, idx, state: t.state });
    }
    out.sort((a, b) => a.sched - b.sched);
    return out.slice(0, 14);
  }

  return {
    init, tick, setSpeed(m) { multiplier = m; }, setPaused(p) { paused = p; },
    get simTime() { return simTime; }, get paused() { return paused; }, get multiplier() { return multiplier; },
    trains: () => Array.from(trains.values()),
    trainById: (id) => trains.get(id),
    events: () => events,
    stationBoard,
    trainDelayMs, expectedTimeAt, projectAt, fmtTime, fmtDelay, distKm,
    debugRoute: (id, dir) => routes[id][dir],
    runStats: (t) => ({ km: t.trailKm, minutes: (simTime - t.depMs) / 60000 })
  };
})();
