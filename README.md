# RailRadar — live train tracking, "FlightRadar24 for trains"

A zero-build, dependency-free JavaScript web app for train enthusiasts: a dark live map of a
simulated rail network spanning the whole U.S. (Amtrak-style, coast to coast) plus the GB
main lines — with train-by-train tracking, full journey detail, rolling-stock profiles,
named-train history, freight & steam traffic, station departure boards, spotting planning,
a life list, search, and a live network event feed.

## Run it

No build step. Serve the folder and open it in any browser:

```bash
cd Train-Tracker
python3 -m http.server 8000
# open http://localhost:8000
```

(Or just double-click `index.html` — Leaflet is vendored locally in `vendor/`, so no
internet is needed for the app itself.)

**Basemaps:** every option is key-free. The default **Dark** style is derived from standard
OpenStreetMap tiles with a CSS darkening filter — CARTO is not used anywhere (it started
demanding API keys). The bottom-right picker also switches to standard OpenStreetMap tiles,
Esri satellite imagery, or **None** (no tile server at all; trains draw on a plain dark
canvas). There is also a free, key-less **OpenRailwayMap** overlay showing the actual
tracked infrastructure — turn it on to see that trains follow the real alignments. A
**Scenic spots** toggle adds pins for famous bridges, summits, loops and railway museums.

## What's inside

| File | Purpose |
|---|---|
| `index.html` | Shell: top bar, search, watchlist/spotting/filter/feed sidebar, detail panel, departure board, modals |
| `css/style.css` | FR24-style dark theming, marker shapes, responsive drawer layout |
| `js/network.js` | Data: ~150 stations across the US and UK, 14 operators in 2 regions, 20+ vehicle classes (Acela, P42DC Genesis, SC-44, Pendolino, EMD SD70ACe, Class 66 "Shed", GWR Castle steam, …), 48 routes with real service patterns, Amtrak train numbers, curved-track waypoints, named-train history (`ROUTE_INFO`) and `SCENIC` locations |
| `js/sim.js` | Simulation engine: timetabling, run profiles, delays, dwells, events |
| `js/app.js` | Map rendering, selection/follow, panels, search, boards, sparkline telemetry, spotting, life list, watchlist, shareable URLs, notifications |
| `vendor/` | Locally-bundled Leaflet 1.9.4 (offline-friendly) |
| `manifest.webmanifest`, `icon.svg`, `sw.js` | PWA install + offline service worker |
| `test/` | Node harnesses used to validate the engine and UI wiring headlessly |

## Features

- **Live map** — every active service shown as a heading-oriented marker, colour-coded by
  status (green cruising, amber at station, red delayed > 5 min — late trains also grow a
  red **!** badge, so status is not colour-only). Labels show headcode + live speed. Marker
  shape identifies the traffic type: arrow for passenger, wedge for freight, ringed circle
  for steam specials. Operator filters are grouped by region (United States / United
  Kingdom) and include Amtrak, BNSF, Norfolk Southern, DB Cargo UK, Freightliner and
  Vintage Trains alongside the passenger franchises.
- **Routes follow real alignments** — paths are plotted through curved-track waypoints
  (`@lat,lng` entries) concentrated on the famous bends: the Northeast Corridor shoreline,
  Croton-Harmon and the Hudson Line, Paoli and the Lancaster straight, the Horseshoe Curve,
  Marias Pass, Moffat Tunnel, Donner Pass, Cajon Pass, Raton Pass, Stevens Pass, Siskiyou
  summit, Shap summit, Dawlish and more, with interpolation every 9 km between waypoints so
  trains hug the actual alignment.
- **Track one train** — click any train (or find it via search / the live feed / a departure
  board row / a watchlist entry / a shared link). The right panel has five tabs:
  - **Overview** — live speed, journey progress bar, next stop + platform + estimated
    arrival, distance run, journey time, delay cause, headcode class (1xx express / 2xx
    stopping / 4xx freight; US services show their train number), and — for named services —
    a history blurb with the year the name launched (California Zephyr 1949, the B&O Capitol
    Limited, the Seaboard Silver services of 1939, Vintage Trains' Cathedrals Express, …).
    28 named-train blurbs ship in `ROUTE_INFO`.
  - **Calling pattern** — every scheduled stop with scheduled and actual/expected times and
    punctuality tags, next stop highlighted.
  - **Rolling stock** — class, unit number, formation (coach-by-coach: First Class, shop,
    Standard — or locomotive + a realistic string of freight wagons), power type, design
    speed **and typical speed in service**, builder, build years, a fleet note and a
    **fun fact**.
  - **Telemetry** — speed sparkline over the recent window, peak speed, mean speed,
    distance.
  - **Spotting** — the closest future pass to your spot for this exact train, plus the best
    station to watch it from.
  - **Follow mode** — the map pans to keep the selected train centred; markers rotate with
    the track curvature.
- **Spotting near you** — set a spot with your device's geolocation or by pinning the map,
  choose a radius, and the app continuously works out which trains will pass closest to you
  in the future, when, and from how far — plus the best remaining station to watch each from
  (with its arrival time and distance from you). Click a pass-by to fly the map there. Your
  spot is remembered between visits.
- **Spotting drawn on the map** — a dashed radius ring is drawn around your spot, each
  upcoming pass-by appears as a pulsing dot labelled with its time and headcode (green for
  the next one, blue while inside your radius), and a dashed line marks where the nearest
  pass will happen. Pass dots and the sidebar list stay in sync — click either to jump.
- **Photo & calendar extras** — sunrise and sunset are computed for your spot, passes
  falling within 75 minutes of either are tagged **golden hour**, and one click exports the
  next 48 h of close passes as an `.ics` calendar file.
- **Proximity notifications** — opt in with "Notify me when a train passes" and choose a
  radius (10–100 km): the browser Notification API pings you whenever a train will pass your
  spot within the next half hour (permission-requested, de-duplicated per service).
- **Insights panel** (press `I` or the button in the top bar) — network-wide statistics:
  live service counts and one-hour departure outlook, punctuality percentage, fastest and
  most-delayed services, the longest haul currently on the board, busiest hub stations
  (click one for its departure board), a per-operator live-delay table, and the fleet
  currently in traffic.
- **Search** (`/` focuses it) — by headcode, operator, vehicle class, origin/destination,
  unit number, or station code/name. Results jump straight to the train or open a board.
- **Station departure boards** — click any station dot: a live board with sched/expected
  times, platform, operator and status. Click a headcode to jump to that service.
- **Live network feed** — departures, terminus arrivals, delays; entries are clickable.
- **Life list** (press `L` or the **List** button) — the collector's log: tick **✓ Seen** on
  a train to log its actual unit number, **✓ Ridden** to mark a route as ridden, **✓
  Visited** on any departure board to tick off a station. Live counts of classes seen, units
  logged, routes ridden and stations visited; saved in `localStorage`.
- **Watchlist** — star (**☆ Watch**) any route and it is pinned to the top of the sidebar
  with a live count of its trains in traffic; click to jump to one.
- **Freight & steam** — simulated Norfolk Southern lake-division and BNSF Transcon
  freights, DB Cargo and Freightliner British freights, and Great Western "Cathedrals
  Express" steam specials hauled by Castle-class locomotives.
- **Scenic spots layer** — optional map pins (legend toggle) for Horseshoe Curve, the
  Tehachapi Loop, Donner/Cajon/Marias/Raton/Stevens/Siskiyou summits, Moffat Tunnel, the
  Forth and Ribblehead viaducts, Glenfinnan, Dawlish sea wall, Box Tunnel, Ais Gill, plus
  railway museums (York NRM, California State Railroad Museum, B&O Museum, Strasburg) —
  each with a note; click one to fly there.
- **Shareable URLs** — selecting a train, opening a board or setting a spot updates the
  address hash (`#t=<headcode>`, `#stn=CRE`, `#spot=41.95,-87.9`), so links re-open exactly
  that state (back/forward works too).
- **Installable & offline (PWA)** — a web manifest plus a service worker cache the app
  shell, code and vendored Leaflet for offline use, and map tiles are cached as you browse.
  Serve over HTTP(S) to install it on a phone from the browser menu; plain `file://` still
  works, just without install/offline.
- **Keyboard shortcuts** — `/` search · `I` insights · `P` pause · `G` go live · `F` follow
  · `L` life list · `?` help · `Esc` close. Press `?` anytime for the overlay.
- **Filters** — toggle operators on/off (grouped by region), or show delayed services only.
- **Time controls** — pause, and 1x / 5x / 30x / 120x speed for timelapse watching.
- **Mobile** — below 1000 px wide the sidebar becomes a slide-in drawer, toggled with the
  ≡ button in the top bar.

## How the simulation works

Each route defines a stop pattern (interspersed with real-alignment waypoints); services
are generated over a rolling 27-hour window (day rollover is automatic). Timetables are
pre-computed with seeded per-segment speed limits, station dwell times scaled by station
importance, and per-segment entry/exit deceleration zones. Live movement integrates distance
over time with the same speed model, so actual times emerge from the run — trains hold to
schedule when early, recover with a modest speed uplift when late, and pick up occasional
station dwell extensions and initial delays with realistic causes. Services started before
you opened the page are deterministically reconciled against their timetables. Headcodes are
deterministic per route/direction/departure, which is what makes the `#t=` share links work.

## Plugging in real data later

The UI only talks to `js/sim.js`'s public surface (`Sim.trains()`, `Sim.trainById`,
`Sim.stationBoard`, `Sim.events`, `Sim.simTime` ...). To go live, replace `sim.js` with an
adapter implementing the same surface from a real-time source, e.g.:

- **GTFS-Realtime** `VehiclePosition` + `TripUpdate` feeds (many operators expose these;
  fetch server-side or through a small CORS proxy) — the easiest first step for a few
  Amtrak or UK feeds.
- **Network Rail Open Data** (UK) via the STOMP feed — real train described movements,
  matching the routes modelled here.
- **OpenRailwayMap** for infrastructure overlays; the `STOCK` table in `network.js` can be
  enriched with real fleet data unchanged.

Any source that provides id, headcode, position, speed, course, operator, and a timed stop
pattern will drive the whole UI unchanged.
