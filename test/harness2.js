const fs = require('fs');
let code = fs.readFileSync('js/network.js', 'utf8') + '\n' + fs.readFileSync('js/sim.js', 'utf8') + '\n' + `
Sim.init();
let active = () => Sim.trains().filter(t => t.state === 'run' || t.state === 'dwell');
console.log('generated:', Sim.trains().length, 'active now:', active().length);
const t0 = active()[0];
console.log('sample:', t0.headcode, t0.origin, '->', t0.destination, 'stock', t0.stockId, t0.unitNumber, Math.round(t0.curSpeed), 'mph state', t0.state, 'delay', (Sim.trainDelayMs(t0)/60000).toFixed(1));
console.log('pos:', t0.pos.lat.toFixed(4), t0.pos.lng.toFixed(4), 'bearing', Math.round(t0.bearing));
let maxDelay = 0, sum = 0, n = 0, runs = 0;
for (let i = 0; i < 7200; i++) {
  Sim.tick(1000);
  for (const x of active()) {
    const d = Sim.trainDelayMs(x);
    maxDelay = Math.max(maxDelay, d); sum += d; n++;
  }
  runs = active().length;
}
console.log('after 2h sim: active', runs, 'maxDelayMin', (maxDelay/60000).toFixed(1), 'avgMin', (sum/n/60000).toFixed(2), 'events', Sim.events().length);
console.log('board CRE:', Sim.stationBoard('CRE').slice(0,5).map(b => b.headcode + ' ' + Sim.fmtTime(b.sched) + ' exp ' + Sim.fmtTime(b.exp)).join(' | '));
console.log('events:', Sim.events().slice(-4).map(e => e.message));
const lt = active().find(t => Sim.trainDelayMs(t) > 4*60000);
if (lt) console.log('late example:', lt.headcode, (Sim.trainDelayMs(lt)/60000).toFixed(1), 'min', lt.cause);
`;
try { eval(code); } catch (e) { console.log('ERR', e.message); console.log(e.stack.split(String.fromCharCode(10))[1]); }
