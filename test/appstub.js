const fs = require('fs');

function el() {
  const store = { dataset: {}, style: {}, value: "", textContent: "", checked: false };
  return {
    dataset: store.dataset, style: store.style,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    set className(v) { this._cn = v; }, get className() { return this._cn || ""; },
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElement() { return null; }, getContext() { return null; },
    width: 0, height: 0,
    focus() {}, blur() {}, click() {},
    clientWidth: 200
  };
}

const elems = {};
const getEl = (id) => elems[id] || (elems[id] = el());

const L = {
  map: (id, opts) => ({
    fitBounds() {}, on() {}, getZoom() { return 6; }, setView() {}, panTo() {}, flyTo() {}, getCenter() { return [54, -2]; }
  }),
  tileLayer: () => ({ addTo() {} }),
  marker: () => {
    let latlng = [0, 0];
    const m = {
      addTo() { return m; },
      bindTooltip(txt) { m._tt = txt; return m; },
      getTooltip() { return { getContent: () => m._tt }; },
      setTooltipContent(t) { m._tt = t; },
      on() { return m; },
      setLatLng(ll) { latlng = ll; },
      getLatLng() { return latlng; },
      getElement() { return null; },
      remove() {},
      set _icon(v) {}, get _icon() { return null; }
    };
    return m;
  },
  polyline: () => ({ addTo() {}, setLatLngs() {}, remove() {} }),
  divIcon: (o) => o
};
global.window = {};
global.document = {
  getElementById: getEl,
  createElement: () => el(),
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  activeElement: null,
  body: { classList: { toggle() {}, add() {}, remove() {} } }
};

const code = fs.readFileSync('js/network.js', 'utf8') + '\n' + fs.readFileSync('js/sim.js', 'utf8') + '\n' + fs.readFileSync('js/app.js', 'utf8') + '\n' + `
for (let i = 0; i < 200; i++) { }
`;
try {
  eval(code);
  setTimeout(() => {
    for (let i = 0; i < 60; i++) { }
    console.log('APP SMOKE OK — clock widget:', elems['simclock'] ? elems['simclock'].textContent : 'n/a');
  }, 1300);
  setTimeout(() => process.exit(0), 1500);
} catch (e) {
  console.log('APP SMOKE ERR:', e.message);
  console.log(e.stack.split(String.fromCharCode(10)).slice(0, 4).join(String.fromCharCode(10)));
  process.exit(1);
}
