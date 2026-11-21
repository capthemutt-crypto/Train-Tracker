#!/usr/bin/env node
/*
 * RailRadar live-data bridge.
 *
 * Serves the static site AND a normalized live Amtrak feed at /api/live.
 *
 * Amtrak publishes its own "Track Your Train" map data (the feed behind
 * maps.amtrak.com) as an encrypted blob with no official public API and no
 * key. This server polls that endpoint politely (default every 45 s),
 * decrypts it with node:crypto, and re-serves plain JSON with an open CORS
 * policy so the RailRadar front-end can consume it from the same origin.
 *
 * Run:  node server.js          (then open http://localhost:8000)
 * Env:  PORT=8000  POLL_MS=45000  HOST=127.0.0.1
 *
 * Data (c) Amtrak. No ownership implied; low-frequency access only,
 * suitable for a personal gadget. Do not redistribute the raw feed.
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "127.0.0.1";
const POLL_MS = Math.max(20000, Number(process.env.POLL_MS) || 45000);
const ROOT = __dirname;

const UA =
  "RailRadar/1.0 (personal hobby train-watching app; low-frequency polling)";

const TILES_URL =
  "https://maps.amtrak.com/services/MapDataService/trains/getTrainsData";
const STATIONS_URL =
  "https://maps.amtrak.com/services/MapDataService/stations/trainStations";
const LIST_URL = "https://maps.amtrak.com/rttl/js/RoutesList.json";
const LISTV_URL = "https://maps.amtrak.com/rttl/js/RoutesList.v.json";

/* ---------------------------------------------------------------- crypto */

let cryptoBox = null; // { pub, salt, iv, ts }

async function loadCryptoBox() {
  const listJson = await getJson(LIST_URL);
  const masterZoom = listJson.reduce((s, x) => s + (x.ZoomLevel || 0), 0);
  const cryptoData = await getJson(LISTV_URL);
  const pub = cryptoData.arr[masterZoom];
  if (!pub) throw new Error("Amtrak crypto bootstrap failed (no public key)");
  cryptoBox = {
    pub,
    salt: Buffer.from(cryptoData.s[cryptoData.s[0].length], "hex"),
    iv: Buffer.from(cryptoData.v[cryptoData.v[0].length], "hex"),
    ts: Date.now()
  };
}

function getJson(url) {
  return get(url).then((t) => JSON.parse(t));
}

function get(url) {
  return fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*" },
    signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined
  }).then((r) => {
    if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
    return r.text();
  });
}

function decryptPayload(raw) {
  const box = cryptoBox;
  if (!box) throw new Error("crypto not bootstrapped");
  let str = String(raw).trim();
  if (str.startsWith("{")) {
    const payload = JSON.parse(str);
    if (payload && typeof payload.commKey === "string") str = payload.commKey;
  }
  const passwordSegment = str.slice(str.length - 88);
  const ciphertext = str.substring(0, str.length - 88);
  const keyP = crypto.pbkdf2Sync(box.pub, box.salt, 1000, 16, "sha1");
  const d1 = crypto.createDecipheriv("aes-128-cbc", keyP, box.iv);
  const out = Buffer.concat([
    d1.update(Buffer.from(passwordSegment, "base64")),
    d1.final()
  ]).toString("utf8");
  const priv = out.split("|")[0];
  const keyT = crypto.pbkdf2Sync(priv, box.salt, 1000, 16, "sha1");
  const d2 = crypto.createDecipheriv("aes-128-cbc", keyT, box.iv);
  return JSON.parse(
    Buffer.concat([
      d2.update(Buffer.from(ciphertext, "base64")),
      d2.final()
    ]).toString("utf8")
  );
}

/* ------------------------------------------------------------ time zones */

const TZ_BASE = { E: -5, C: -6, M: -7, P: -8 };
// DST breaks (US rules, roughly): second Sunday of March to first Sunday of
// November. Arizona ignores DST (Navajo Nation excepted, not modelled).
function dstActiveUTC(d) {
  const year = d.getUTCFullYear();
  const mar1 = Date.UTC(year, 2, 1);
  const nov1 = Date.UTC(year, 10, 1);
  const start = mar1 + ((14 - new Date(mar1).getUTCDay()) % 7) * 86400000 + 7 * 3600000;
  const end = nov1 + ((7 - new Date(nov1).getUTCDay()) % 7) * 86400000 - 6 * 3600000;
  return d.getTime() >= start && d.getTime() < end;
}

// "11/19/2026 08:25:00" in a local tz with a single letter (E/C/M/P).
function parseLocalTime(s, tz, refMs, state) {
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(
    String(s).trim()
  );
  if (!m) return null;
  let hh = Number(m[4]);
  if (m[7]) {
    if (/pm/i.test(m[7]) && hh < 12) hh += 12;
    if (/am/i.test(m[7]) && hh === 12) hh = 0;
  }
  const asUTC = Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), hh, Number(m[5]), m[6] ? Number(m[6]) : 0);
  const offHours = tzBaseHours(tz, asUTC, state);
  return asUTC - offHours * 3600000;
}

function tzBaseHours(tz, whenMs, state) {
  let base = TZ_BASE[String(tz || "").toUpperCase()];
  if (base == null) return 0;
  if (dstActiveUTC(new Date(whenMs)) && state !== "AZ") base += 1;
  return base;
}

/* ------------------------------------------------------------ normalizing */

const HEADING_MAP = {
  n: 0, nne: 22.5, ne: 45, ene: 67.5, e: 90, ese: 112.5, se: 135,
  sse: 157.5, s: 180, ssw: 202.5, sw: 225, wsw: 247.5, w: 270,
  wnw: 292.5, nw: 315, nnw: 337.5
};

function headingDeg(h) {
  if (!h) return null;
  const v = HEADING_MAP[String(h).trim().toLowerCase()];
  return v == null ? null : v;
}

function normStations(props, stationMeta) {
  const out = [];
  for (let i = 1; i <= 46; i++) {
    const raw = props["Station" + i];
    if (!raw) continue;
    let s;
    try {
      s = JSON.parse(raw);
    } catch (_e) {
      continue;
    }
    if (!s || !s.code) continue;
    const meta = stationMeta[s.code] || {};
    const tz = s.tz || meta.tz || "E";
    const state = meta.state || null;
    out.push({
      code: s.code,
      bus: !!s.bus,
      name: meta.name || s.code,
      lat: meta.lat == null ? null : Number(meta.lat),
      lng: meta.lon == null ? null : Number(meta.lon),
      schArr: parseLocalTime(s.scharr, tz, 0, state),
      schDep: parseLocalTime(s.schdep, tz, 0, state),
      estArr: parseLocalTime(s.estarr, tz, 0, state),
      estDep: parseLocalTime(s.estdep, tz, 0, state),
      postArr: parseLocalTime(s.postarr, tz, 0, state),
      postDep: parseLocalTime(s.postdep, tz, 0, state),
      postCmnt: (s.postcmnt || "").trim() || null,
      schCmnt: (s.schcmnt || "").trim() || null
    });
  }
  return out;
}

function normalize(stationsGeo, trainsGeo) {
  const stationMeta = {};
  const sfeat = (stationsGeo.StationsDataResponse || stationsGeo).features || [];
  for (const f of sfeat) {
    const p = f.properties || {};
    if (!p.Code) continue;
    stationMeta[p.Code] = {
      name: p.StationName || p.Name || p.Code,
      lat: p.lat == null ? null : Number(p.lat),
      lon: p.lon == null ? null : Number(p.lon),
      state: p.State || null
    };
  }
  const tfeat = trainsGeo.features || [];
  const codesUsed = new Set();
  const trains = [];
  for (const f of tfeat) {
    const p = f.properties || {};
    if (p.TrainNum == null) continue;
    const stations = normStations(p, stationMeta);
    stations.forEach((s) => codesUsed.add(s.code));
    trains.push({
      id: "A" + (p.ID != null ? p.ID : p.TrainNum),
      trainNum: String(p.TrainNum),
      routeName: p.RouteName || "",
      lat: p.lat == null ? null : Number(p.lat),
      lng: p.lon == null ? null : Number(p.lon),
      velocity: p.Velocity == null ? null : Number(p.Velocity),
      heading: headingDeg(p.Heading),
      headingTxt: p.Heading || null,
      trainState: p.TrainState || "Unknown",
      statusMsg: (p.StatusMsg || "").trim() || null,
      origCode: p.OrigCode || null,
      destCode: p.DestCode || null,
      origSchDep: parseLocalTime(p.OrigSchDep, p.OriginTZ, 0, null),
      lastVal: parseLocalTime(
        p.LastValTS, p.OriginTZ || "E", Date.now(),
        null
      ),
      geometry: f.geometry && f.geometry.type === "Point"
        ? { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }
        : null,
      stations
    });
  }
  const stOut = {};
  for (const code of codesUsed) {
    const m = stationMeta[code];
    if (m) {
      stOut[code] = { name: m.name, lat: m.lat, lng: m.lon, state: m.state };
    }
  }
  return trains.length ? { trains, stations: stOut } : null;
}

/* -------------------------------------------------------------- polling */

const cache = { data: null, fetchedAt: 0, error: null, fetching: false };

async function pollOnce() {
  if (cache.fetching) return;
  cache.fetching = true;
  try {
    if (!cryptoBox || Date.now() - cryptoBox.ts > 3600000) {
      await loadCryptoBox();
    }
    const [stRaw, trRaw] = await Promise.all([get(STATIONS_URL), get(TILES_URL)]);
    const stGeo = decryptPayload(stRaw);
    const trGeo = decryptPayload(trRaw);
    const data = normalize(stGeo, trGeo);
    if (!data || !data.trains.length) throw new Error("empty train feed");
    cache.data = data;
    cache.fetchedAt = Date.now();
    cache.error = null;
    log("feed OK: " + data.trains.length + " trains, " + Object.keys(data.stations).length + " stations");
  } catch (e) {
    cache.error = String((e && e.message) || e);
    log("feed error: " + cache.error);
  } finally {
    cache.fetching = false;
  }
}

function log(msg) {
  console.log(new Date().toISOString() + " " + msg);
}

/* --------------------------------------------------------------- server */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch (_e) {
    res.writeHead(400).end("bad request");
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  fs.readFile(filePath, (err, body) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "max-age=300",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(body);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    });
    res.end();
    return;
  }
  if (req.url.split("?")[0] === "/api/live") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "GET only" });
      return;
    }
    if (cache.data && Date.now() - cache.fetchedAt <= POLL_MS * 3) {
      sendJson(res, 200, {
        provider: "Amtrak",
        fetchedAt: cache.fetchedAt,
        pollMs: POLL_MS,
        trains: cache.data.trains,
        stations: cache.data.stations
      });
      return;
    }
    sendJson(res, 503, {
      error: cache.error || "live feed not ready yet (first poll in progress)"
    });
    return;
  }
  serveStatic(req, res);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    log("RailRadar serving " + ROOT + " at http://" + HOST + ":" + PORT);
    pollOnce();
    setInterval(pollOnce, POLL_MS);
  });
}

module.exports = {
  loadCryptoBox, decryptPayload, normalize, parseLocalTime, dstActiveUTC,
  headingDeg, pollOnce, cache
};
