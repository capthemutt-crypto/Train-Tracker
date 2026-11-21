# RailRadar — live train tracking, "FlightRadar24 for trains"

A zero-build, dependency-free JavaScript web app for train enthusiasts: a dark live map of a
simulated GB rail network with train-by-train tracking, full journey detail, rolling-stock
profiles, station departure boards, search, and a live network event feed.

## Run it

No build step. Serve the folder and open it in any browser:

```bash
cd railradar
python3 -m http.server 8000
# open http://localhost:8000
```

(Or just double-click `index.html` — the only external dependency is Leaflet + CARTO/OSM map
tiles, loaded from unpkg.)

## What's inside

| File | Purpose |
|---|---|
| `index.html` | Shell: top bar, search, filter/feed sidebar, detail panel, departure board |
| `css/style.css` | FR24-style dark theming, responsive layout |
| `js/network.js` | Data: 60+ stations, 8 operators, 13 vehicle classes, 12 routes with service patterns |
| `js/sim.js` | Simulation engine: timetabling, run profiles, delays, dwells, events |
| `js/app.js` | Map rendering, selection/follow, panels, search, boards, sparkline telemetry |
| `test/` | Node harnesses used to validate the engine and UI wiring headlessly |

## Features

- **Live map** — every active service shown as a heading-oriented marker, colour-coded by
  status (green cruising, amber at station, red delayed > 5 min). Labels show headcode +
  live speed.
- **Track one train** — click any train (or find it via search / the live feed / a departure
  board row). The right panel has four tabs:
  - **Overview** — live speed, journey progress bar, next stop + platform + estimated
    arrival, distance run, journey time, delay cause, headcode class (1xx express / 2xx
    stopping).
  - **Calling pattern** — every scheduled stop with scheduled and actual/expected times and
    punctuality tags, next stop highlighted.
  - **Rolling stock** — class, unit number, formation (coach-by-coach: First Class, shop,
    Standard), power type, design speed, builder, build years, and a fleet note.
  - **Telemetry** — speed sparkline over the recent window, peak speed, mean speed,
    distance.
  - **Follow mode** — the map pans to keep the selected train centred.
- **Search** (`/` focuses it) — by headcode, operator, vehicle class, origin/destination,
  unit number, or station code/name. Results jump straight to the train or open a board.
- **Station departure boards** — click any station dot: a live board with sched/expected
  times, platform, operator and status. Click a headcode to jump to that service.
- **Live network feed** — departures, terminus arrivals, delays; entries are clickable.
- **Filters** — toggle operators on/off, or show delayed services only.
- **Time controls** — pause, and 1x / 5x / 30x / 120x speed for timelapse watching.

## How the simulation works

Each route defines a stop pattern; services are generated over a rolling 27-hour window
(day rollover is automatic). Timetables are pre-computed with seeded per-segment speed
limits, station dwell times scaled by station importance, and per-segment entry/exit
deceleration zones. Live movement integrates distance over time with the same speed model,
so actual times emerge from the run — trains hold to schedule when early, recover with a
modest speed uplift when late, and pick up occasional station dwell extensions and initial
delays with realistic causes. Services started before you opened the page are
deterministically reconciled against their timetables.

## Plugging in real data later

The UI only talks to `js/sim.js`'s public surface (`Sim.trains()`, `Sim.trainById`,
`Sim.stationBoard`, `Sim.events`, `Sim.simTime` ...). To go live, replace `sim.js` with an
adapter implementing the same surface from a real-time source, e.g.:

- **GTFS-Realtime** `VehiclePosition` + `TripUpdate` feeds (many operators expose these;
  fetch server-side or through a small CORS proxy).
- **Network Rail Open Data** (UK) via the STOMP feed — real train described movements,
  matching the routes modelled here.
- **OpenRailwayMap** for infrastructure overlays; the `STOCK` table in `network.js` can be
  enriched with real fleet data unchanged.

Any source that provides id, headcode, position, speed, course, operator, and a timed stop
pattern will drive the whole UI unchanged.
