const OPERATORS = {
  awc: { code: "AW", name: "Avanti West Coast", color: "#c8102e" },
  lner: { code: "LR", name: "LNER", color: "#8b1d41" },
  gwr: { code: "GW", name: "Great Western Railway", color: "#0a6c46" },
  xc: { code: "XC", name: "CrossCountry", color: "#b31b34" },
  tpe: { code: "TP", name: "TransPennine Express", color: "#00a08a" },
  nr: { code: "NT", name: "Northern", color: "#d6472e" },
  ga: { code: "GA", name: "Greater Anglia", color: "#1d4f91" },
  sr: { code: "SC", name: "ScotRail", color: "#504a9e" }
};

const STATIONS = {
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
  "220": {
    name: "Class 220 'Voyager'", power: "Diesel-electric — Cummins QSK19",
    maxSpeed: 125, cars: [4], maker: "Bombardier, Bruges", built: "2001–2002",
    note: "Non-tilting Voyager; mainstay of CrossCountry diagrams since 2002."
  },
  "221": {
    name: "Class 221 'Super Voyager'", power: "Diesel-electric — Cummins QSK19",
    maxSpeed: 125, cars: [4, 5], maker: "Bombardier, Bruges", built: "2001–2002",
    note: "Tilting sister of the Voyager fleet, used on the cross-country network."
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
    note: "Replaced Class 380s and Cass 318s on Greater Glasgow electrified routes."
  },
  "43": {
    name: "Class 43 'InterCity 125' power cars", power: "Diesel-hydraulic — Paxman Valenta/VP185",
    maxSpeed: 125, cars: [7], maker: "BREL, Crewe", built: "1976–1982",
    note: "Kept the world diesel speed record (148 mph) for 37 years. 'Castle' sets carry named power cars."
  }
};

const R = (id, name, path, base, units, prefixes, service) => ({ id, name, path, base, units, prefixes, service });

const ROUTES = [
  R("wcml", "West Coast Main Line — Euston ↔ Glasgow Central",
    ["EUS", "MKC", "RUG", "NUN", "STF", "CRE", "PRE", "OXM", "PEN", "CAR", "LCB", "MTH", "GLC"],
    125, [["390", 11], ["390", 9]], ["1S", "1M"],
    { first: 330, last: 1290, every: 45 }),
  R("ecml", "East Coast Main Line — Kings Cross ↔ Edinburgh",
    ["KGX", "PBO", "GRN", "NNG", "DNC", "YRK", "NTL", "DAR", "DHM", "NCL", "BWK", "EDB"],
    125, [["800", 9], ["801", 5], ["800", 5]], ["1N", "1E"],
    { first: 345, last: 1260, every: 50 }),
  R("gwr-w", "Great Western Main Line — Paddington ↔ Penzance",
    ["PAD", "RDG", "DID", "SWI", "CPN", "BTH", "BTC", "TAU", "EXD", "NPT2", "PLY", "TRU", "PGE"],
    110, [["802", 9], ["43", 7]], ["1C", "1A"],
    { first: 360, last: 1140, every: 70 }),
  R("gwr-sw", "Great Western Main Line — Paddington ↔ Swansea",
    ["PAD", "RDG", "DID", "SWI", "NSP", "CDF", "BRD", "PGN", "SWA"],
    110, [["802", 5], ["802", 9]], ["1B", "1L"],
    { first: 375, last: 1200, every: 60 }),
  R("xc-sw", "CrossCountry — Birmingham ↔ Bristol/Paignton",
    ["BHM", "CHD", "GLS", "BTH", "BTC"],
    100, [["221", 4], ["220", 4]], ["1V", "1O"],
    { first: 390, last: 1230, every: 55 }),
  R("xc-ne", "CrossCountry — Birmingham ↔ Newcastle",
    ["BHM", "DER", "RCHE", "SHF", "LDS", "YRK", "DAR", "NCL"],
    100, [["221", 5], ["220", 4], ["221", 4]], ["1D", "1E"],
    { first: 405, last: 1140, every: 75 }),
  R("tpe-sc", "TransPennine —Manchester ↔ Glasgow",
    ["MAN", "WAC", "PRE", "OXM", "PEN", "CAR", "MTH", "GLC"],
    100, [["397", 4], ["802", 5]], ["1S", "1M"],
    { first: 390, last: 1140, every: 90 }),
  R("tpe-pn", "TransPennine — Manchester ↔ York",
    ["MAN", "HDE", "DEW", "LDS", "YRK"],
    100, [["185", 3]], ["1Y", "1M"],
    { first: 375, last: 1275, every: 45 }),
  R("nr-nw", "Northern — Manchester ↔ Liverpool",
    ["MAN", "WAC", "LIV"],
    90, [["195", 3], ["331", 3]], ["2P", "2W"],
    { first: 330, last: 1335, every: 30 }),
  R("sr-c", "ScotRail — Glasgow ↔ Edinburgh",
    ["GLC", "FHD", "EDB"],
    100, [["385", 3], ["385", 4]], ["2L", "2K"],
    { first: 330, last: 1335, every: 30 }),
  R("gm-ang", "Great Eastern Main Line — Liverpool St ↔ Norwich",
    ["STP", "COL", "IPS", "NOR"],
    100, [["720", 10], ["720", 12]], ["1P", "1W"],
    { first: 345, last: 1305, every: 45 }),
  R("gm-cbg", "Lea Valley Lines — Liverpool St ↔ Cambridge",
    ["STP", "AUD", "CBG"],
    100, [["720", 10]], ["1N", "1C"],
    { first: 360, last: 1320, every: 45 })
];

const DELAY_CAUSES = [
  "Signalling failure", "Earlier cancelled train", "Train crew delayed",
  "Congestion ahead", "Passenger incident", "Rolling stock fault",
  "Level crossing failure", "Awaiting relief crew"
];

const SPEED_MULTIPLIERS = [1, 5, 30, 120];
