/* LiveEngine adapter tests: runs js/network.js + js/live.js in a VM sandbox
   and feeds fixture /api/live payloads through LiveEngine.ingest(). */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const src =
  fs.readFileSync(path.join(ROOT, "js/network.js"), "utf8") +
  "\n" +
  fs.readFileSync(path.join(ROOT, "js/live.js"), "utf8") +
  "\n; globalThis.__LIVE = LiveEngine;";

const sandbox = {
  console: { log() {} },
  setInterval() { return 0; },
  setTimeout() { return 0; },
  clearTimeout() {},
  setIntervalReal: setInterval
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "live-bundle.js" });
const Live = sandbox.__LIVE;

const MS_PER_MIN = 60000;
const now = Date.now();
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("  ok - " + name); }
  else { fail++; console.log("  FAIL - " + name); }
}

function hhmmAgo(min) { return new Date(now - min * MS_PER_MIN); }
function hhmmAhead(min) { return new Date(now + min * MS_PER_MIN); }
const T = (d) => d.getTime();

/* Train 1: California Zephyr #6, running between Martinez (MTZ) and Sacramento (SAC). */
function zephyr(extraDep) {
  const stations = [
    { code: "EMY", postDep: T(hhmmAgo(160)), schDep: T(hhmmAgo(160)), tz: "P" , name: "Emeryville, CA (EMY)", lat: 37.8393, lng: -122.2945},
    { code: "RIC", postArr: T(hhmmAgo(120)), postDep: T(hhmmAgo(118)), schArr: T(hhmmAgo(121)), schDep: T(hhmmAgo(110)), tz: "P" , name: "Richmond, CA (RIC)", lat: 37.9361, lng: -122.3535},
    { code: "DAV", postArr: T(hhmmAgo(45)), postDep: T(hhmmAgo(43)), schArr: T(hhmmAgo(47)), schDep: T(hhmmAgo(45)), tz: "P" , name: "Davis, CA (DAV)", lat: 38.4406, lng: -121.7003},
    {
      code: "SAC", schArr: T(hhmmAhead(8)), schDep: T(hhmmAhead(13)),
      estArr: T(hhmmAhead(8 + extraDep)), estDep: T(hhmmAhead(13 + extraDep)), tz: "P",
      name: "Sacramento, CA (SAC)", lat: 38.5791, lng: -121.4911
    },
    { code: "ROSE", schArr: T(hhmmAhead(30)), schDep: T(hhmmAhead(31)), estArr: T(hhmmAhead(32)), tz: "P" , name: "Roseville, CA (ROS)", lat: 38.7521, lng: -121.2846},
    { code: "CHI", schArr: T(hhmmAhead(52 * 60)), tz: "P" , name: "Chicago, IL (CHI)", lat: 41.8786, lng: -87.6396}
  ];
  return {
    id: "A9001", trainNum: 6, routeName: "California Zephyr",
    lat: 38.35, lng: -121.9, velocity: "58.3", heading: 90, headingTxt: "E",
    trainState: "Active", statusMsg: " ", OrigCode: "EMY", DestCode: "CHI",
    OrigSchDep: T(hhmmAgo(160)), OriginTZ: "P", LastValTS: now,
    stations
  };
}

/* Train 2: Acela #2253, dwelling at New Haven. */
function acela() {
  return {
    id: "A9002", trainNum: 2253, routeName: "Acela",
    lat: 41.2954, lng: -72.9263, velocity: "0", heading: 45, headingTxt: "NE",
    trainState: "Active", OrigCode: "NYP", DestCode: "BOS",
    OrigSchDep: T(hhmmAgo(50)), OriginTZ: "E", LastValTS: now,
    stations: [
      { code: "NYP", postDep: T(hhmmAgo(50)), schDep: T(hhmmAgo(50)), tz: "E" , name: "New York, NY (NYP)", lat: 40.7506, lng: -73.9935},
      { code: "NHV", postArr: T(hhmmAgo(4)), schArr: T(hhmmAgo(5)), schDep: T(hhmmAhead(2)), estDep: T(hhmmAhead(2)), tz: "E" , name: "New Haven, CT (NHV)", lat: 41.2954, lng: -72.9263},
      { code: "PVD", schArr: T(hhmmAhead(60)), schDep: T(hhmmAhead(62)), estArr: T(hhmmAhead(63)), tz: "E" , name: "Providence, RI (PVD)", lat: 41.8389, lng: -71.415},
      { code: "BOS", schArr: T(hhmmAhead(110)), tz: "E" , name: "Boston, MA (BOS)", lat: 42.3522, lng: -71.0552}
    ]
  };
}

/* Train 3: completed long ago -> should be despawned. */
function finished() {
  return {
    id: "A9003", trainNum: 155, routeName: "Downeaster", lat: 43.66, lng: -70.26, velocity: "0",
    trainState: "Completed", OrigCode: "BOS", DestCode: "POR",
    OrigSchDep: T(hhmmAgo(200)), OriginTZ: "E", LastValTS: now,
    stations: [
      { code: "BOS", postDep: T(hhmmAgo(200)), tz: "E" , name: "Boston, MA (BOS)", lat: 42.3522, lng: -71.0552},
      { code: "POR", postArr: T(hhmmAgo(10)), tz: "E" , name: "Portland, ME (POR)", lat: 43.6567, lng: -70.2568}
    ]
  };
}

const meta = {
  EMY: { name: "Emeryville, CA (EMY)" }, RIC: { name: "Richmond, CA (RIC)" },
  DAV: { name: "Davis, CA (DAV)" }, SAC: { name: "Sacramento, CA (SAC)" },
  ROSE: { name: "Roseville, CA (ROS)" }, CHI: { name: "Chicago, IL (CHI)" },
  NYP: { name: "New York, NY (NYP)" }, NHV: { name: "New Haven, CT (NHV)" },
  PVD: { name: "Providence, RI (PVD)" }, BOS: { name: "Boston, MA (BOS)" },
  POR: { name: "Portland, ME (POR)" }
};
function payload(list) {
  return { trains: list, stations: meta };
}

Live.ingest(payload([zephyr(12), acela(), finished()]));

console.log("LiveEngine adapter:");
const ts = Live.trains();
ok(ts.length === 2, "despawned completed trains are dropped");
const tz = Live.trainById("A9001");
ok(!!tz, "zephyr built");
ok(tz.headcode === "#6", "headcode is #6");
ok(tz.opId === "amtrak" && tz.type === "pass", "operator/type");
ok(tz.stock && /Superliner/.test(tz.stock.name), "long-distance stock inferred");
ok(tz.state === "run", "state run");
ok(tz.stops.length === 6 && tz.stops[tz.stops.length - 1].code === "CHI", "stops traverse the consist");
ok(tz.stops[tz.stops.length - 1].d > 2500, "cumulative km plausible");
ok(tz.prog > 50 && tz.prog < tz.stops[tz.stops.length - 1].d, "progress km plausible");
ok(tz.pos.lat === 38.35 && tz.pos.lng === -121.9, "position from feed");
ok(Math.round(tz.curSpeed) === 58, "speed from Velocity");
ok(tz.bearing === 90, "heading E = 90deg");
ok(tz.delayMs > 10 * 50000 && tz.delayMs <= 13 * MS_PER_MIN, "delay ~12 min from est vs sch");
ok(tz.unitNumber === "#6", "unit number falls back to train id");
const next = tz.stops[tz.stopIdx + 1];
ok(next && next.code === "SAC", "next stop SAC");
const ta = Live.trainById("A9002");
ok(ta.state === "dwell" && ta.stopIdx === 1, "acela dwelling at NHV");
ok(!!Live.stationBoard("SAC").find(r => r.headcode === "#6"), "station board SAC lists #6");
ok(!!Live.stationBoard("NHV").find(r => r.headcode === "#2253"), "board NHV lists dwelling acela");
const proj = Live.projectAt(tz, now + 25 * MS_PER_MIN);
ok(proj && proj.lat > 38.3 && proj.lat < 38.6 && proj.lng > -121.9, "projectAt advances along the route");
ok(Live.projectAt(tz, now + 60 * 60 * MS_PER_MIN) === null, "projectAt null past journey");
ok(Live.expectedTimeAt(tz) > now, "expectedTimeAt sane");
ok(Live.runStats(tz).minutes > 150, "runStats minutes from departure");
ok(Live.fmtDelay(7 * MS_PER_MIN) === "7 min", "fmtDelay");
ok(Live.simTime <= Date.now() + 50, "simTime is real time");

/* second ingest: zephyr departs SAC -> event, still 12 min late stays */
const before = Live.events().length;
Live.ingest(payload([{ ...zephyr(12), stations: (() => {
  const st = zephyr(12).stations.slice();
  st[3] = { code: "SAC", schArr: st[3].schArr, schDep: st[3].schDep, postArr: T(hhmmAgo(2)), postDep: T(hhmmAgo(1)), tz: "P" , name: "Sacramento, CA (SAC)", lat: 38.5791, lng: -121.4911};
  return st;
})() }, acela()]));
const ev = Live.events();
ok(ev.length === before + 1, "one new event after departure diff");
ok(/departed/.test(ev[ev.length - 1].message) && /Sacramento/.test(ev[ev.length - 1].message), "event says departed Sacramento");

/* geometry-only position (most real trains come this way) */
Live.ingest(payload([{ ...acela(), lat: null, lng: null, geometry: { lat: 41.2954, lng: -72.9263 } }]));
const tg = Live.trainById("A9002");
ok(tg && tg.pos.lat === 41.2954 && tg.pos.lng === -72.9263, "geometry fallback used when lat/lng absent");

/* broken payload: stations too short */
Live.ingest({ trains: [{ id: 9, trainNum: 99, routeName: "", stations: [] }], stations: {} });
ok(Live.trains().length === 0, "malformed payload replaces board (transient fetch errors never reach ingest)");



console.log(`\nlive adapter: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
