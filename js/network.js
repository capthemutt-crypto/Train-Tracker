const OPERATORS = {
  amtrak: { code: "AK", name: "Amtrak", color: "#2e5fa3", region: "us" },
  awc: { code: "AW", name: "Avanti West Coast", color: "#c8102e", region: "uk" },
  lner: { code: "LR", name: "LNER", color: "#8b1d41", region: "uk" },
  gwr: { code: "GW", name: "Great Western Railway", color: "#0a6c46", region: "uk" },
  xc: { code: "XC", name: "CrossCountry", color: "#b31b34", region: "uk" },
  tpe: { code: "TP", name: "TransPennine Express", color: "#00a08a", region: "uk" },
  nr: { code: "NT", name: "Northern", color: "#d6472e", region: "uk" },
  ga: { code: "GA", name: "Greater Anglia", color: "#1d4f91", region: "uk" },
  sr: { code: "SC", name: "ScotRail", color: "#504a9e", region: "uk" }
};

const REGIONS = [
  { id: "us", name: "United States" },
  { id: "uk", name: "United Kingdom" }
];

const STATIONS = {
  BOS: { name: "Boston South Station", lat: 42.3519, lng: -71.0552, size: 3 },
  PRV: { name: "Providence", lat: 41.8317, lng: -71.4127, size: 2 },
  NHV: { name: "New Haven (Union Station)", lat: 41.2971, lng: -72.9263, size: 2 },
  NYP: { name: "New York Penn Station", lat: 40.7506, lng: -73.9935, size: 3 },
  PHL: { name: "Philadelphia 30th Street", lat: 39.9556, lng: -75.1822, size: 3 },
  BAL: { name: "Baltimore Penn Station", lat: 39.3089, lng: -76.6157, size: 2 },
  WAS: { name: "Washington Union Station", lat: 38.8977, lng: -77.0065, size: 3 },
  HAR: { name: "Harrisburg Transportation Center", lat: 40.2599, lng: -76.8823, size: 2 },
  PIT: { name: "Pittsburgh Union Station", lat: 40.4397, lng: -79.9959, size: 2 },
  CLE: { name: "Cleveland Lakefront", lat: 41.5047, lng: -81.6947, size: 2 },
  TOL: { name: "Toledo Martin Luther King Jr", lat: 41.6528, lng: -83.5379, size: 2 },
  CHI: { name: "Chicago Union Station", lat: 41.8786, lng: -87.6396, size: 3 },
  ALB: { name: "Albany–Rensselaer", lat: 42.6498, lng: -73.7564, size: 2 },
  SYR: { name: "Syracuse", lat: 43.0501, lng: -76.1607, size: 1 },
  ROC: { name: "Rochester", lat: 43.1566, lng: -77.6110, size: 1 },
  BUF: { name: "Buffalo–Exchange Street", lat: 42.8864, lng: -78.8784, size: 1 },
  TOR: { name: "Toronto Union", lat: 43.6450, lng: -79.3806, size: 3 },
  MTL: { name: "Montréal Central Station", lat: 45.5029, lng: -73.5672, size: 3 },
  LOR: { name: "Lorton (Auto Train)", lat: 38.6902, lng: -77.2261, size: 1 },
  SFD: { name: "Sanford (Auto Train)", lat: 28.8122, lng: -81.3300, size: 1 },
  ORL: { name: "Orlando", lat: 28.5384, lng: -81.3792, size: 2 },
  MIA: { name: "Miami", lat: 25.7942, lng: -80.2043, size: 3 },
  CHS: { name: "Charleston SC", lat: 32.7816, lng: -79.9314, size: 1 },
  SAV: { name: "Savannah", lat: 32.0762, lng: -81.0982, size: 1 },
  JAX: { name: "Jacksonville", lat: 30.3322, lng: -81.6557, size: 2 },
  CAE: { name: "Columbia SC", lat: 34.0007, lng: -81.0348, size: 1 },
  RVM: { name: "Richmond Staples Mill Road", lat: 37.5637, lng: -77.4838, size: 1 },
  RAL: { name: "Raleigh Union Station", lat: 35.7666, lng: -78.6402, size: 2 },
  CLT: { name: "Charlotte", lat: 35.2271, lng: -80.8431, size: 2 },
  ATL: { name: "Atlanta Peachtree", lat: 33.7542, lng: -84.3924, size: 2 },
  BIR: { name: "Birmingham AL", lat: 33.5186, lng: -86.8104, size: 1 },
  NOL: { name: "New Orleans Union Passenger Terminal", lat: 29.9511, lng: -90.0719, size: 3 },
  CVL: { name: "Charlottesville", lat: 38.0293, lng: -78.4767, size: 1 },
  GRO: { name: "Greensboro", lat: 36.0726, lng: -79.7920, size: 1 },
  CHW: { name: "Charleston WV", lat: 38.3498, lng: -81.6326, size: 1 },
  CIN: { name: "Cincinnati Union Terminal", lat: 39.1096, lng: -84.5086, size: 2 },
  IND: { name: "Indianapolis Union Station", lat: 39.7600, lng: -86.1581, size: 1 },
  MEM: { name: "Memphis Central Station", lat: 35.1400, lng: -90.0532, size: 1 },
  JAN: { name: "Jackson MS", lat: 32.2988, lng: -90.1848, size: 1 },
  STL: { name: "St. Louis Gateway Station", lat: 38.6270, lng: -90.1994, size: 2 },
  LIT: { name: "Little Rock", lat: 34.7465, lng: -92.2900, size: 1 },
  DAL: { name: "Dallas Union Station", lat: 32.7819, lng: -96.8003, size: 2 },
  SAS: { name: "San Antonio", lat: 29.4254, lng: -98.4946, size: 2 },
  KCY: { name: "Kansas City Union Station", lat: 39.0899, lng: -94.5866, size: 2 },
  ABQ: { name: "Albuquerque Alvarado", lat: 35.0842, lng: -106.6504, size: 1 },
  FLG: { name: "Flagstaff", lat: 35.1983, lng: -111.6513, size: 1 },
  SNB: { name: "San Bernardino", lat: 34.1083, lng: -117.2898, size: 1 },
  MKE: { name: "Milwaukee Intermodal Station", lat: 43.0390, lng: -87.9400, size: 2 },
  MSP: { name: "St. Paul Union Depot", lat: 44.9487, lng: -93.0158, size: 2 },
  FGO: { name: "Fargo", lat: 46.8772, lng: -96.7898, size: 1 },
  MOT: { name: "Minot", lat: 48.2325, lng: -101.2963, size: 1 },
  WHF: { name: "Whitefish", lat: 48.4106, lng: -114.3717, size: 1 },
  SPO: { name: "Spokane", lat: 47.6588, lng: -117.4260, size: 2 },
  SEA: { name: "Seattle King Street Station", lat: 47.5994, lng: -122.3312, size: 3 },
  PRT: { name: "Portland Union Station", lat: 45.5288, lng: -122.6742, size: 2 },
  VAN: { name: "Vancouver Pacific Central", lat: 49.2827, lng: -123.1207, size: 3 },
  EUG: { name: "Eugene", lat: 44.0521, lng: -123.0911, size: 1 },
  RDD: { name: "Redding", lat: 40.5865, lng: -122.3917, size: 1 },
  SAC: { name: "Sacramento Valley Station", lat: 38.5816, lng: -121.4944, size: 2 },
  EME: { name: "Emeryville (San Francisco)", lat: 37.8372, lng: -122.2919, size: 2 },
  SLO: { name: "San Luis Obispo", lat: 35.2828, lng: -120.6596, size: 1 },
  SBA: { name: "Santa Barbara", lat: 34.4167, lng: -119.7036, size: 1 },
  LAX: { name: "Los Angeles Union Station", lat: 34.0562, lng: -118.2365, size: 3 },
  ANA: { name: "Anaheim ARTIC", lat: 33.8035, lng: -117.8817, size: 1 },
  SDO: { name: "San Diego Santa Fe Depot", lat: 32.7157, lng: -117.1647, size: 2 },
  TUS: { name: "Tucson", lat: 32.2226, lng: -110.9747, size: 1 },
  ELP: { name: "El Paso Union Depot", lat: 31.7619, lng: -106.4850, size: 1 },
  HOU: { name: "Houston", lat: 29.7648, lng: -95.3657, size: 1 },
  OMA: { name: "Omaha", lat: 41.2565, lng: -95.9345, size: 1 },
  DEN: { name: "Denver Union Station", lat: 39.7526, lng: -105.0002, size: 2 },
  GJT: { name: "Grand Junction", lat: 39.0639, lng: -108.5506, size: 1 },
  SLC: { name: "Salt Lake City", lat: 40.7694, lng: -111.8926, size: 2 },
  RNO: { name: "Reno", lat: 39.5296, lng: -119.8138, size: 1 },
  FNO: { name: "Fresno Santa Fe Depot", lat: 36.7378, lng: -119.7871, size: 1 },
  BFL: { name: "Bakersfield", lat: 35.3733, lng: -119.0187, size: 1 },
  OAK: { name: "Oakland–Jack London Square", lat: 37.7955, lng: -122.2788, size: 2 },
  KAL: { name: "Kalamazoo Transportation Center", lat: 42.2917, lng: -85.5872, size: 1 },
  ANN: { name: "Ann Arbor", lat: 42.2808, lng: -83.7430, size: 1 },
  DET: { name: "Detroit New Center", lat: 42.3754, lng: -83.0517, size: 1 },
  PME: { name: "Portland (Maine)", lat: 43.6564, lng: -70.2564, size: 1 },
  SPR: { name: "Springfield Union Station", lat: 42.1015, lng: -72.5898, size: 1 },
  WRI: { name: "White River Junction", lat: 43.6499, lng: -72.3192, size: 1 },
  STAJ: { name: "St. Albans VT", lat: 44.8098, lng: -73.0827, size: 1 },
  OKC: { name: "Oklahoma City Santa Fe Depot", lat: 35.4676, lng: -97.5164, size: 1 },
  FTW: { name: "Fort Worth Central Station", lat: 32.7817, lng: -97.3289, size: 1 },
  EUS: { name: "London Euston", lat: 51.5281, lng: -0.1337, size: 3 },
  KGX: { name: "London Kings Cross", lat: 51.5308, lng: -0.1238, size: 3 },
  PAD: { name: "London Paddington", lat: 51.5185, lng: -0.1769, size: 3 },
  STP: { name: "London Liverpool Street", lat: 51.5180, lng: -0.0798, size: 3 },
  BHM: { name: "Birmingham New Street", lat: 52.4778, lng: -1.8994, size: 3 },
  MAN: { name: "Manchester Piccadilly", lat: 53.4774, lng: -2.2308, size: 3 },
  LIV: { name: "Liverpool Lime Street", lat: 53.4075, lng: -2.9806, size: 3 },
  LDS: { name: "Leeds", lat: 53.7946, lng: -1.5466, size: 3 },
  YRK: { name: "York", lat: 53.9587, lng: -1.0813, size: 2 },
  NCL: { name: "Newcastle", lat: 54.9691, lng: -1.6158, size: 2 },
  EDB: { name: "Edinburgh Waverley", lat: 55.9519, lng: -3.1905, size: 3 },
  GLC: { name: "Glasgow Central", lat: 55.8595, lng: -4.2588, size: 3 },
  SHF: { name: "Sheffield", lat: 53.3807, lng: -1.4720, size: 2 },
  DER: { name: "Derby", lat: 52.9180, lng: -1.4720, size: 2 },
  MKC: { name: "Milton Keynes Central", lat: 52.0330, lng: -0.7560, size: 2 },
  RUG: { name: "Rugby", lat: 52.3802, lng: -1.2419, size: 1 },
  NUN: { name: "Nuneaton", lat: 52.5240, lng: -1.4650, size: 1 },
  STF: { name: "Stafford", lat: 52.8071, lng: -2.1153, size: 1 },
  CRE: { name: "Crewe", lat: 53.0893, lng: -2.4329, size: 2 },
  WGN: { name: "Wigan North Western", lat: 53.5459, lng: -2.6301, size: 1 },
  PRE: { name: "Preston", lat: 53.7609, lng: -2.6997, size: 2 },
  OXM: { name: "Oxenholme Lake District", lat: 54.3483, lng: -2.7300, size: 1 },
  PEN: { name: "Penrith North Lakes", lat: 54.6661, lng: -2.7544, size: 1 },
  CAR: { name: "Carlisle", lat: 54.8920, lng: -2.9374, size: 2 },
  LCB: { name: "Lockerbie", lat: 55.1200, lng: -3.3500, size: 1 },
  MTH: { name: "Motherwell", lat: 55.7830, lng: -3.9900, size: 1 },
  PBO: { name: "Peterborough", lat: 52.5702, lng: -0.2400, size: 2 },
  GRN: { name: "Grantham", lat: 52.9130, lng: -0.6400, size: 1 },
  NNG: { name: "Newark North Gate", lat: 53.0900, lng: -0.8100, size: 1 },
  DNC: { name: "Doncaster", lat: 53.5170, lng: -1.1300, size: 2 },
  NTL: { name: "Northallerton", lat: 54.3367, lng: -1.4383, size: 1 },
  DAR: { name: "Darlington", lat: 54.5234, lng: -1.5557, size: 1 },
  DHM: { name: "Durham", lat: 54.7752, lng: -1.5860, size: 1 },
  BWK: { name: "Berwick-upon-Tweed", lat: 55.7712, lng: -2.0030, size: 1 },
  RDG: { name: "Reading", lat: 51.4545, lng: -0.9727, size: 2 },
  DID: { name: "Didcot Parkway", lat: 51.5070, lng: -1.2350, size: 1 },
  SWI: { name: "Swindon", lat: 51.5590, lng: -1.7900, size: 1 },
  CPN: { name: "Chippenham", lat: 51.4580, lng: -2.1150, size: 1 },
  BTH: { name: "Bath Spa", lat: 51.3812, lng: -2.3590, size: 1 },
  BTC: { name: "Bristol Temple Meads", lat: 51.4490, lng: -2.5813, size: 3 },
  TAU: { name: "Taunton", lat: 51.0140, lng: -3.1040, size: 1 },
  EXD: { name: "Exeter St Davids", lat: 50.7184, lng: -3.5347, size: 2 },
  NPT2: { name: "Newton Abbot", lat: 50.5302, lng: -3.6060, size: 1 },
  PLY: { name: "Plymouth", lat: 50.3763, lng: -4.1429, size: 2 },
  TRU: { name: "Truro", lat: 50.2637, lng: -5.0513, size: 1 },
  PGE: { name: "Penzance", lat: 50.1186, lng: -5.5350, size: 1 },
  NSP: { name: "Newport (S Wales)", lat: 51.5843, lng: -2.9976, size: 1 },
  CDF: { name: "Cardiff Central", lat: 51.4755, lng: -3.1810, size: 3 },
  BRD: { name: "Bridgend", lat: 51.5070, lng: -3.5800, size: 1 },
  PGN: { name: "Port Talbot Parkway", lat: 51.5940, lng: -3.7800, size: 1 },
  SWA: { name: "Swansea", lat: 51.6215, lng: -3.9432, size: 2 },
  WAC: { name: "Warrington Central", lat: 53.3770, lng: -2.5820, size: 1 },
  CHD: { name: "Cheltenham Spa", lat: 51.8990, lng: -2.0780, size: 1 },
  GLS: { name: "Gloucester", lat: 51.8650, lng: -2.2410, size: 1 },
  RCHE: { name: "Chesterfield", lat: 53.2380, lng: -1.4330, size: 1 },
  HDE: { name: "Huddersfield", lat: 53.6450, lng: -1.7800, size: 1 },
  DEW: { name: "Dewsbury", lat: 53.6900, lng: -1.6280, size: 1 },
  FHD: { name: "Falkirk High", lat: 56.0030, lng: -3.7900, size: 1 },
  COL: { name: "Colchester", lat: 51.8890, lng: 0.9030, size: 1 },
  IPS: { name: "Ipswich", lat: 52.0509, lng: 1.1592, size: 1 },
  NOR: { name: "Norwich", lat: 52.6309, lng: 1.2965, size: 2 },
  AUD: { name: "Audley End", lat: 52.0180, lng: 0.2100, size: 1 },
  CBG: { name: "Cambridge North", lat: 52.2200, lng: 0.1600, size: 1 }
};

const STOCK = {
  acela: {
    name: "Acela (Alstom Avelia Liberty)", power: "Electric — 12 kV / 25 kV catenary",
    maxSpeed: 160, cars: [9], maker: "Alstom, Hornell NY", built: "2019–2024",
    note: "America's fastest scheduled trains: 150 mph running on the Northeast Corridor, with active tilt through the curves."
  },
  "p42sl": {
    name: "GE P42DC 'Genesis' + Superliner consist", power: "Diesel-electric — 4,250 hp",
    maxSpeed: 110, cars: [8, 10], maker: "GE Transportation, Grove City PA", built: "1997–2005",
    note: "The workhorse of Amtrak's western long-distance routes: double-deck Superliner coaches, Sleepers, Dining and a Sightseer Lounge."
  },
  "p42vl": {
    name: "P42DC Genesis + Viewliner consist", power: "Diesel-electric — 4,250 hp",
    maxSpeed: 100, cars: [7, 9], maker: "GE Transportation / American Car & Foundry", built: "Viewliners: 1995–2022",
    note: "Single-level Viewliner Sleepers and Diners for the eastern overnight network — lower-platform friendly."
  },
  "genesis_amf": {
    name: "P32-8WH 'Genesis' + Amfleet coaches", power: "Diesel-electric — 4,000 hp (HEP from the locomotive)",
    maxSpeed: 110, cars: [5, 7], maker: "GE Transportation / Budd Company", built: "Amfleet: 1975–1983",
    note: "Amfleet I & II — the distinctive stainless Budd fleet that has carried the Northeast for 50 years."
  },
  "p42hor": {
    name: "P32-8WH Genesis + Horizon coaches", power: "Diesel-electric — 4,000 hp",
    maxSpeed: 100, cars: [6, 7], maker: "GE Transportation / Bombardier", built: "Horizon: 1988–1990",
    note: "Horizon-fleet midwestern corridor services; being replaced by Amtrak Airo."
  },
  airo: {
    name: "Amtrak Airo (ALC-42E Charger + Venture)", power: "Dual-mode — diesel / electric overhead",
    maxSpeed: 125, cars: [7, 8], maker: "Siemens Mobility, Sacramento CA", built: "2024–2027 (entering service)",
    note: "Amtrak's new corridor fleet — USB at every seat, larger windows, push-pull operation."
  },
  "sc44v": {
    name: "Siemens SC-44 Charger + Venture cars", power: "Diesel-electric — 4,400 hp",
    maxSpeed: 125, cars: [5, 7], maker: "Siemens Mobility, Sacramento CA", built: "2017–2023",
    note: "State-supported corridor fleets across California, the Midwest, the Pacific Northwest and Pennsylvania."
  },
  "390": {
    name: "Class 390 'Pendolino'", power: "Electric — 25 kV AC OHLE",
    maxSpeed: 140, cars: [9, 11], maker: "Alstom, Washwood Heath", built: "2002–2005",
    note: "Tilting body EMU, 3+2 seating in Standard. Fleet of 98 units."
  },
  "802": {
    name: "Class 802 'Intercity Express Train'", power: "Bi-mode — OHLE / MTU diesel engines",
    maxSpeed: 125, cars: [5, 9], maker: "Hitachi, Newton Aycliffe", built: "2017–2019",
    note: "Part of the Intercity Express Programme replacing HSTs and InterCity 125 sets."
  },
  "800": {
    name: "Class 800 'Azuma'", power: "Bi-mode — OHLE / diesel engines",
    maxSpeed: 125, cars: [5, 9], maker: "Hitachi, Newton Aycliffe", built: "2018–2020",
    note: "LNER's flagship fleet; named on launch services in 2019."
  },
  "801": {
    name: "Class 801 'Azuma'", power: "Electric — 25 kV AC OHLE",
    maxSpeed: 125, cars: [5, 9], maker: "Hitachi, Newton Aycliffe", built: "2018–2020",
    note: "Electric-only Azuma variant with small diesel 'last-mile' engines."
  },
  "221": {
    name: "Class 221 'Super Voyager'", power: "Diesel-electric — Cummins QSK19",
    maxSpeed: 125, cars: [4, 5], maker: "Bombardier, Bruges", built: "2001–2002",
    note: "Tilting sister of the Voyager fleet, used on the cross-country network."
  },
  "220": {
    name: "Class 220 'Voyager'", power: "Diesel-electric — Cummins QSK19",
    maxSpeed: 125, cars: [4], maker: "Bombardier, Bruges", built: "2001–2002",
    note: "Non-tilting Voyager; mainstay of CrossCountry diagrams since 2002."
  },
  "185": {
    name: "Class 185 'Desiro'", power: "Diesel-mechanical — Cummins QSK19",
    maxSpeed: 100, cars: [3], maker: "Siemens, Uerdingen", built: "2005–2007",
    note: "TransPennine Express workhorse; distinctive twin headlights."
  },
  "397": {
    name: "Class 397 'Caledonian'", power: "Electric — 25 kV AC OHLE",
    maxSpeed: 100, cars: [4], maker: "CAF, Spain", built: "2019–2021",
    note: "Named after the historic Caledonian Railway; used on Transpennine Scottish routes."
  },
  "195": {
    name: "Class 195 'CAF Civity'", power: "Diesel-mechanical — Cummins",
    maxSpeed: 100, cars: [2, 3], maker: "CAF, Spain", built: "2019–2020",
    note: "Northern's modern diesel fleet replacing Class 158s on regional services."
  },
  "331": {
    name: "Class 331 'CEF Civity'", power: "Electric — 25 kV AC OHLE",
    maxSpeed: 100, cars: [3, 4], maker: "CAF, Spain", built: "2018–2020",
    note: "Northern's electric Civity fleet for the North West electrified lines."
  },
  "720": {
    name: "Class 720 'Aventra'", power: "Electric — 25 kV AC OHLE",
    maxSpeed: 100, cars: [10, 12], maker: "Bombardier/Alstom, Derby", built: "2019–2022",
    note: "Walk-through Aventra fleet that brought long 12-car trains to East Anglia."
  },
  "385": {
    name: "Class 385 'Hitachi AT300'", power: "Electric — 25 kV AC OHLE",
    maxSpeed: 100, cars: [3, 4], maker: "Hitachi, Newton Aycliffe", built: "2017–2019",
    note: "Replaced Class 380s and Class 318s on Greater Glasgow electrified routes."
  },
  "43": {
    name: "Class 43 'InterCity 125' power cars", power: "Diesel-hydraulic — Paxman Valenta/VP185",
    maxSpeed: 125, cars: [7], maker: "BREL, Crewe", built: "1976–1982",
    note: "Kept the world diesel speed record (148 mph) for 37 years. 'Castle' sets carry named power cars."
  }
};

const R = (id, name, path, base, units, nums, service) => ({ id, name, path, base, units, nums, service });

const ROUTES = [
  R("acela", "Northeast Corridor — Acela: Boston ↔ Washington", ["BOS", "PRV", "NHV", "NYP", "PHL", "BAL", "WAS"], 145, [["acela", 9]], [2150, 2250], { first: 330, last: 1230, every: 90 }),
  R("nec-reg", "Northeast Regional: Boston ↔ Washington", ["BOS", "PRV", "NHV", "NYP", "PHL", "BAL", "WAS"], 120, [["genesis_amf", 6], ["genesis_amf", 5]], [100, 110], { first: 300, last: 1350, every: 50 }),
  R("keystone", "Keystone Service: New York ↔ Harrisburg", ["NYP", "PHL", "HAR"], 110, [["sc44v", 6]], [640, 650], { first: 330, last: 1320, every: 70 }),
  R("empire", "Empire Service: New York ↔ Buffalo", ["NYP", "ALB", "SYR", "ROC", "BUF"], 100, [["genesis_amf", 6]], [280, 240], { first: 330, last: 1320, every: 160 }),
  R("maple-leaf", "Maple Leaf: New York ↔ Toronto", ["NYP", "ALB", "SYR", "ROC", "BUF", "@43.10,-79.20", "@43.47,-79.72", "TOR"], 95, [["p42vl", 7]], [63, 64], { first: 600, last: 1320, every: 1440 }),
  R("adirondack", "Adirondack: New York ↔ Montréal", ["NYP", "ALB", "@43.75,-73.64", "@44.69,-73.44", "MTL"], 95, [["genesis_amf", 5]], [68, 69], { first: 600, last: 1320, every: 1440 }),
  R("vermonter", "Vermonter: Washington ↔ St. Albans", ["WAS", "BAL", "PHL", "NYP", "SPR", "WRI", "STAJ"], 90, [["genesis_amf", 5]], [55, 54], { first: 480, last: 1320, every: 1440 }),
  R("downeaster", "Downeaster: Boston ↔ Portland ME", ["BOS", "PME"], 90, [["genesis_amf", 5]], [680, 685], { first: 330, last: 1320, every: 200 }),
  R("crescent", "Crescent: New York ↔ New Orleans", ["NYP", "PHL", "BAL", "WAS", "CVL", "GRO", "CLT", "ATL", "BIR", "NOL"], 95, [["p42vl", 9]], [19, 20], { first: 600, last: 1320, every: 1440 }),
  R("silver-met", "Silver Meteor: New York ↔ Miami", ["NYP", "WAS", "CHS", "SAV", "ORL", "MIA"], 95, [["p42vl", 9]], [97, 98], { first: 600, last: 1320, every: 1440 }),
  R("silver-star", "Silver Star: New York ↔ Miami", ["NYP", "WAS", "RVM", "CAE", "JAX", "ORL", "MIA"], 95, [["p42vl", 9]], [91, 92], { first: 600, last: 1320, every: 1440 }),
  R("auto-train", "Auto Train: Lorton ↔ Sanford", ["LOR", "SFD"], 85, [["p42sl", 10]], [52, 53], { first: 900, last: 1320, every: 1440 }),
  R("carolinian", "Carolinian: New York ↔ Charlotte", ["NYP", "BAL", "WAS", "RVM", "RAL", "CLT"], 95, [["genesis_amf", 6]], [79, 80], { first: 480, last: 1320, every: 1440 }),
  R("lake-shore", "Lake Shore Limited: New York ↔ Chicago", ["NYP", "ALB", "SYR", "ROC", "BUF", "@42.13,-80.09", "CLE", "@41.42,-82.44", "TOL", "CHI"], 95, [["p42vl", 8]], [48, 49], { first: 600, last: 1320, every: 1440 }),
  R("capitol", "Capitol Limited: Washington ↔ Chicago", ["WAS", "PIT", "CLE", "@41.42,-82.44", "TOL", "CHI"], 90, [["p42vl", 8]], [29, 30], { first: 900, last: 1320, every: 1440 }),
  R("cardinal", "Cardinal: Washington ↔ Chicago", ["WAS", "CVL", "CHW", "CIN", "IND", "CHI"], 85, [["p42vl", 7]], [50, 51], { first: 900, last: 1320, every: 1440 }),
  R("empire-builder", "Empire Builder: Chicago ↔ Seattle", ["CHI", "@42.08,-87.76", "@42.60,-87.86", "MKE", "MSP", "FGO", "MOT", "WHF", "SPO", "SEA"], 90, [["p42sl", 10], ["p42sl", 8]], [7, 8], { first: 870, last: 1320, every: 1440 }),
  R("cal-zephyr", "California Zephyr: Chicago ↔ Emeryville", ["CHI", "@41.72,-88.20", "OMA", "DEN", "GJT", "SLC", "RNO", "SAC", "EME"], 90, [["p42sl", 10], ["p42sl", 8]], [5, 6], { first: 840, last: 1320, every: 1440 }),
  R("sw-chief", "Southwest Chief: Chicago ↔ Los Angeles", ["CHI", "KCY", "ABQ", "FLG", "SNB", "LAX"], 90, [["p42sl", 10]], [3, 4], { first: 915, last: 1320, every: 1440 }),
  R("sunset", "Sunset Limited: Los Angeles ↔ New Orleans", ["LAX", "TUS", "ELP", "SAS", "HOU", "@30.08,-94.10", "@30.23,-93.22", "@30.22,-92.02", "NOL"], 80, [["p42sl", 10]], [1, 2], { first: 600, last: 1320, every: 1440 }),
  R("texas-eagle", "Texas Eagle: Chicago ↔ San Antonio", ["CHI", "STL", "LIT", "DAL", "SAS"], 95, [["p42sl", 10]], [21, 22], { first: 810, last: 1320, every: 1440 }),
  R("city-no", "City of New Orleans: Chicago ↔ New Orleans", ["CHI", "MEM", "JAN", "NOL"], 95, [["p42sl", 9]], [58, 59], { first: 1250, last: 1320, every: 1440 }),
  R("wolverine", "Wolverine: Chicago ↔ Detroit", ["CHI", "@41.72,-86.90", "KAL", "ANN", "DET"], 100, [["p42hor", 6]], [353, 352], { first: 330, last: 1320, every: 160 }),
  R("hiawatha", "Hiawatha: Chicago ↔ Milwaukee", ["CHI", "@42.08,-87.76", "@42.60,-87.86", "MKE"], 90, [["sc44v", 6]], [329, 330], { first: 330, last: 1320, every: 110 }),
  R("lincoln", "Lincoln Service: Chicago ↔ St. Louis", ["CHI", "STL"], 100, [["sc44v", 7], ["airo", 7]], [300, 303], { first: 330, last: 1320, every: 130 }),
  R("starlight", "Coast Starlight: Seattle ↔ Los Angeles", ["SEA", "PRT", "EUG", "RDD", "SAC", "EME", "SLO", "SBA", "LAX"], 90, [["p42sl", 10]], [11, 14], { first: 585, last: 1320, every: 1440 }),
  R("surfliner", "Pacific Surfliner: Los Angeles ↔ San Diego", ["LAX", "ANA", "SDO"], 90, [["sc44v", 6], ["sc44v", 5]], [562, 573], { first: 330, last: 1350, every: 90 }),
  R("cascades", "Amtrak Cascades: Vancouver ↔ Eugene", ["VAN", "@49.10,-122.66", "@48.75,-122.48", "@47.98,-122.20", "SEA", "PRT", "EUG"], 95, [["sc44v", 7]], [500, 517], { first: 390, last: 1140, every: 260 }),
  R("san-joaquin", "San Joaquins: Oakland ↔ Bakersfield", ["OAK", "FNO", "BFL"], 85, [["sc44v", 5]], [712, 711], { first: 390, last: 1320, every: 240 }),
  R("heartland", "Heartland Flyer: Oklahoma City ↔ Fort Worth", ["OKC", "FTW"], 90, [["p42hor", 5]], [800, 801], { first: 480, last: 1320, every: 1440 }),
  R("wcml", "West Coast Main Line — Euston ↔ Glasgow Central", ["EUS", "MKC", "RUG", "NUN", "STF", "CRE", "PRE", "OXM", "PEN", "CAR", "LCB", "MTH", "GLC"], 125, [["390", 11], ["390", 9]], ["1S", "1M"], { first: 330, last: 1290, every: 45 }),
  R("ecml", "East Coast Main Line — Kings Cross ↔ Edinburgh", ["KGX", "PBO", "GRN", "NNG", "DNC", "YRK", "NTL", "DAR", "DHM", "NCL", "BWK", "EDB"], 125, [["800", 9], ["801", 5], ["800", 5]], ["1N", "1E"], { first: 345, last: 1260, every: 50 }),
  R("gwr-w", "Great Western Main Line — Paddington ↔ Penzance", ["PAD", "RDG", "DID", "SWI", "CPN", "BTH", "BTC", "TAU", "EXD", "NPT2", "PLY", "TRU", "PGE"], 110, [["802", 9], ["43", 7]], ["1C", "1A"], { first: 360, last: 1140, every: 70 }),
  R("gwr-sw", "Great Western Main Line — Paddington ↔ Swansea", ["PAD", "RDG", "DID", "SWI", "NSP", "CDF", "BRD", "PGN", "SWA"], 110, [["802", 5], ["802", 9]], ["1B", "1L"], { first: 375, last: 1200, every: 60 }),
  R("xc-sw", "CrossCountry — Birmingham ↔ Bristol", ["BHM", "CHD", "GLS", "BTH", "BTC"], 100, [["221", 4], ["220", 4]], ["1V", "1O"], { first: 390, last: 1230, every: 55 }),
  R("xc-ne", "CrossCountry — Birmingham ↔ Newcastle", ["BHM", "DER", "RCHE", "SHF", "LDS", "YRK", "DAR", "NCL"], 100, [["221", 5], ["220", 4], ["221", 4]], ["1D", "1E"], { first: 405, last: 1140, every: 75 }),
  R("tpe-sc", "TransPennine — Manchester ↔ Glasgow", ["MAN", "WAC", "PRE", "OXM", "PEN", "CAR", "MTH", "GLC"], 100, [["397", 4], ["802", 5]], ["1S", "1M"], { first: 390, last: 1140, every: 90 }),
  R("tpe-pn", "TransPennine — Manchester ↔ York", ["MAN", "HDE", "DEW", "LDS", "YRK"], 100, [["185", 3]], ["1Y", "1M"], { first: 375, last: 1275, every: 45 }),
  R("nr-nw", "Northern — Manchester ↔ Liverpool", ["MAN", "WAC", "LIV"], 90, [["195", 3], ["331", 3]], ["2P", "2W"], { first: 330, last: 1335, every: 30 }),
  R("sr-c", "ScotRail — Glasgow ↔ Edinburgh", ["GLC", "FHD", "EDB"], 100, [["385", 3], ["385", 4]], ["2L", "2K"], { first: 330, last: 1335, every: 30 }),
  R("gm-ang", "Great Eastern Main Line — Liverpool St ↔ Norwich", ["STP", "COL", "IPS", "NOR"], 100, [["720", 10], ["720", 12]], ["1P", "1W"], { first: 345, last: 1305, every: 45 }),
  R("gm-cbg", "Lea Valley Lines — Liverpool St ↔ Cambridge", ["STP", "AUD", "CBG"], 100, [["720", 10]], ["1N", "1C"], { first: 360, last: 1320, every: 45 })
];

const DELAY_CAUSES = [
  "Signalling failure", "Earlier cancelled train", "Train crew delayed",
  "Congestion ahead", "Passenger incident", "Rolling stock fault",
  "Level crossing failure", "Awaiting relief crew", "Freight train interference",
  "Track maintenance overrunning"
];

const SPEED_MULTIPLIERS = [1, 5, 30, 120];
