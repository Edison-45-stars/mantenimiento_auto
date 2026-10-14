'use strict';
// Ejecutar con:  TZ=America/Guayaquil node tests/model.test.js
const assert = require('node:assert/strict');
const M = require('../js/model.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

const NOW = new Date(2026, 9, 13, 18, 0, 0); // 13-oct-2026, 18:00 hora local

// Datos del esquema v1 (los que tenía la app), con un duplicado como el que generaba el bug.
const V1 = {
  id: 'aveo', name: 'Chevrolet Aveo Activo 2011', plate: 'PCA-0456', currentKm: 138000,
  records: [
    { id: 'aceite', piece: 'Aceite y filtro de motor', category: 'Motor', lastDate: '2026-05-20', lastKm: 135000, intervalKm: 5000, intervalMonths: 6, cost: 28, note: 'n' },
    { id: 'aceite-viejo', piece: 'aceite y filtro de motor ', category: 'Motor', lastDate: '2025-11-02', lastKm: 130000, intervalKm: 5000, intervalMonths: 6, cost: 26, note: 'n' },
    { id: 'filtroaire', piece: 'Filtro de aire', category: 'Motor', lastDate: '2025-06-01', lastKm: 128000, intervalKm: 10000, intervalMonths: 12, cost: 14, note: 'n' },
    { id: 'pastillas', piece: 'Pastillas de freno delanteras', category: 'Frenos', lastDate: '2025-09-10', lastKm: 110000, intervalKm: 30000, intervalMonths: 24, cost: 50, note: 'n' },
    { id: 'bateria', piece: 'Batería', category: 'Eléctrico', lastDate: '2024-03-15', lastKm: 120000, intervalKm: 0, intervalMonths: 36, cost: 85, note: 'n' },
    { id: 'llantas', piece: 'Llantas (juego de 4)', category: 'Suspensión', lastDate: '2024-10-01', lastKm: 100000, intervalKm: 45000, intervalMonths: 48, cost: 300, note: 'n' },
    { id: 'correa', piece: 'Correa de distribución', category: 'Motor', lastDate: '2022-01-10', lastKm: 90000, intervalKm: 90000, intervalMonths: 72, cost: 150, note: 'n' },
  ],
};

console.log('Fechas');
test('las fechas ISO se leen en hora local (bug del día desfasado)', () => {
  const d = M.parseLocalDate('2026-05-20');
  assert.equal(d.getDate(), 20);
  assert.equal(d.getMonth(), 4);
  assert.equal(M.parseLocalDate('2026-02-31'), null);
  assert.equal(M.parseLocalDate('basura'), null);
});
test('addMonths recorta fin de mes', () => {
  assert.equal(M.toIso(M.addMonths(new Date(2026, 0, 31), 1)), '2026-02-28');
  assert.equal(M.toIso(M.addMonths(new Date(2026, 7, 31), 6)), '2027-02-28');
});

console.log('Migración v1 -> v2');
const V2 = M.migrateVehicle(V1, NOW);
test('migra y fusiona piezas duplicadas en un solo historial', () => {
  assert.equal(V2.schema, 2);
  assert.equal(V2.items.length, 6);
  const aceite = V2.items.find(i => i.piece === 'Aceite y filtro de motor');
  assert.equal(aceite.history.length, 2);
  assert.equal(aceite.history[0].date, '2026-05-20'); // el más reciente primero
  assert.equal(aceite.id, 'aceite');
});
test('no se pierde ningún gasto en la migración', () => {
  const before = V1.records.reduce((s, r) => s + r.cost, 0);
  const after = M.computeVehicle(V2, NOW).totalSpend;
  assert.equal(after, before);
});
test('migrar dos veces da el mismo resultado', () => {
  assert.deepEqual(M.migrateVehicle(V2, NOW), V2);
});

console.log('Estado y urgencia');
const S = M.computeVehicle(V2, NOW);
const by = id => S.byId[id];
test('estado se calcula por porcentaje de vida útil', () => {
  assert.equal(by('filtroaire').status, 'vencido');   // 100 % por km y 137 % por tiempo
  assert.equal(by('pastillas').status, 'pronto');     // 93 % por km
  assert.equal(by('bateria').status, 'pronto');       // 86 % por tiempo
  assert.equal(by('aceite').status, 'ok');            // 80 % por tiempo
  assert.equal(by('llantas').status, 'ok');           // 84 % por km: antes (1.500 km fijos) ya era "pronto"
  assert.equal(by('correa').status, 'ok');
});
test('la pieza que limita es la correcta', () => {
  assert.equal(by('aceite').limiting, 'tiempo');
  assert.equal(by('pastillas').limiting, 'km');
});
test('orden por urgencia: primero lo más consumido', () => {
  const order = S.items.map(i => i.id);
  assert.equal(order[0], 'filtroaire');
  for (let i = 1; i < S.items.length; i++) assert.ok(S.items[i - 1].progress >= S.items[i].progress);
});
test('justo en el km de cambio no muestra "-0 km"', () => {
  const r = by('filtroaire'); // 128.000 + 10.000 = 138.000 = km actual
  assert.equal(r.kmRemaining, 0);
  assert.ok(!/-0/.test(r.dueLabel), r.dueLabel);
  assert.match(r.dueLabel, /llegó a los/i);
});
test('km actual menor al del servicio no produce valores negativos', () => {
  const v = M.normalizeVehicle(Object.assign({}, V2, { currentKm: 1000 }), NOW);
  const r = M.computeVehicle(v, NOW).byId.aceite;
  assert.ok(r.progress >= 0);
});
test('pieza sin registro y pieza sin intervalo no rompen el cálculo', () => {
  const v = M.normalizeVehicle({ id: 'x', name: 'X', currentKm: 5000, items: [
    { id: 'a', piece: 'A', intervalKm: 5000, intervalMonths: 6, history: [] },
    { id: 'b', piece: 'B', intervalKm: 0, intervalMonths: 0, history: [{ date: '2026-01-01', km: 100, cost: 10 }] },
  ] }, NOW);
  const r = M.computeVehicle(v, NOW);
  assert.equal(r.byId.a.status, 'pendiente');
  assert.equal(r.byId.b.status, 'sinplan');
  assert.equal(r.healthPct, null);
  assert.equal(r.next, null);
  assert.ok(Number.isFinite(r.annualEstimate));
});
test('intervalo de meses = 0 ya no genera infinitos', () => {
  const v = M.normalizeVehicle({ id: 'x', name: 'X', currentKm: 20000, items: [
    { id: 'a', piece: 'A', intervalKm: 10000, intervalMonths: 0, history: [{ date: '2026-01-01', km: 15000, cost: 20 }] },
  ] }, NOW);
  const r = M.computeVehicle(v, NOW);
  for (const k of ['annualEstimate', 'totalSpend']) assert.ok(Number.isFinite(r[k]), k);
  assert.ok(Number.isFinite(r.byId.a.progress));
});

console.log('Gasto anual');
test('km por año se estima de los datos reales (rango razonable)', () => {
  assert.ok(S.kmPerYear > 7000 && S.kmPerYear < 14000, 'kmPerYear=' + S.kmPerYear);
});
test('costo anual = último costo × ciclos por año (lo que ocurra primero)', () => {
  const a = by('aceite');
  assert.equal(a.cyclesPerYear, Math.max(2, S.kmPerYear / 5000));
  assert.ok(Math.abs(a.annualCost - 28 * a.cyclesPerYear) < 1e-9);
  const b = by('bateria'); // solo tiempo: 12/36 por año
  assert.ok(Math.abs(b.annualCost - 85 / 3) < 1e-9);
});
test('sin datos de km suficientes se usa solo el tiempo y las piezas por km quedan fuera', () => {
  const v = M.normalizeVehicle({ id: 'x', name: 'X', currentKm: 1000, items: [
    { id: 'a', piece: 'A', intervalKm: 5000, intervalMonths: 0, history: [{ date: '2026-09-01', km: 900, cost: 30 }] },
    { id: 'b', piece: 'B', intervalKm: 0, intervalMonths: 12, history: [{ date: '2026-09-01', km: 900, cost: 40 }] },
  ] }, NOW);
  const r = M.computeVehicle(v, NOW);
  assert.equal(r.kmPerYear, null);
  assert.equal(r.byId.a.annualCost, null);
  assert.equal(r.byId.b.annualCost, 40);
});
test('el gasto total suma todo el historial, no solo el último servicio', () => {
  assert.equal(S.totalSpend, 28 + 26 + 14 + 50 + 85 + 300 + 150);
  assert.equal(S.serviceCount, 7);
});

console.log('Altas y ediciones');
test('registrar el mismo servicio otra vez NO duplica la pieza', () => {
  const v = M.migrateVehicle(V1, NOW);
  const before = v.items.length;
  M.addService(v, { piece: ' ACEITE y filtro de motor', date: '2026-10-13', km: 138200, cost: 30, category: 'Motor', intervalKm: 5000, intervalMonths: 6 }, NOW);
  assert.equal(v.items.length, before);
  const a = v.items.find(i => i.id === 'aceite');
  assert.equal(a.history.length, 3);
  assert.equal(a.history[0].date, '2026-10-13');
  assert.equal(v.currentKm, 138200);
  assert.equal(M.computeVehicle(v, NOW).byId.aceite.status, 'ok');
});
test('se puede registrar un servicio pasado sin tocar el km actual', () => {
  const v = M.migrateVehicle(V1, NOW);
  M.addService(v, { itemId: 'bateria', date: '2022-01-01', km: 80000, cost: 70 }, NOW);
  assert.equal(v.currentKm, 138000);
  assert.equal(v.items.find(i => i.id === 'bateria').history[0].date, '2024-03-15');
});
test('validación del formulario de servicio', () => {
  const v = M.migrateVehicle(V1, NOW);
  assert.deepEqual(Object.keys(M.validateService({ piece: '', date: '2026-10-13', km: 1, cost: 0, intervalKm: 5000, intervalMonths: 6 }, v, NOW)), ['piece']);
  assert.ok(M.validateService({ piece: 'A', date: '2026-10-14', km: 1, cost: 0, intervalKm: 5000, intervalMonths: 6 }, v, NOW).date);
  assert.ok(M.validateService({ piece: 'A', date: '2026-10-13', km: '', cost: 0, intervalKm: 5000, intervalMonths: 6 }, v, NOW).km);
  assert.ok(M.validateService({ piece: 'A', date: '2026-10-13', km: 5, cost: -3, intervalKm: 5000, intervalMonths: 6 }, v, NOW).cost);
  assert.ok(M.validateService({ piece: 'A', date: '2026-10-13', km: 5, cost: 0, intervalKm: 0, intervalMonths: 0 }, v, NOW).intervalMonths);
  assert.deepEqual(M.validateService({ date: '2026-10-13', km: 5, cost: 0 }, v, NOW, { existingItem: true }), {});
});
test('editar y borrar un servicio', () => {
  const v = M.migrateVehicle(V1, NOW);
  M.updateService(v, 'aceite', 'h-aceite', { date: '2026-06-01', km: 135500, cost: 31 }, NOW);
  const e = v.items.find(i => i.id === 'aceite').history[0];
  assert.deepEqual([e.date, e.km, e.cost], ['2026-06-01', 135500, 31]);
  assert.equal(M.deleteService(v, 'aceite', 'h-aceite'), true);
  assert.equal(v.items.find(i => i.id === 'aceite').history.length, 1);
});
test('actualizar km: valida y no deja bajar del último servicio', () => {
  const v = M.migrateVehicle(V1, NOW);
  assert.match(M.setCurrentKm(v, 100000, NOW), /no puede ser menor/i);
  assert.ok(M.setCurrentKm(v, -5, NOW));
  assert.equal(M.setCurrentKm(v, 139000, NOW), null);
  assert.equal(v.currentKm, 139000);
  assert.equal(v.odometer.at(-1).km, 139000);
});
test('el plan se edita sin perder el historial y no permite nombres repetidos', () => {
  const v = M.migrateVehicle(V1, NOW);
  assert.ok(M.validatePlan({ piece: 'filtro de aire', intervalKm: 1, intervalMonths: 1 }, v, 'aceite').piece);
  M.updatePlan(v, 'aceite', { piece: 'Aceite sintético', category: 'Motor', intervalKm: 7500, intervalMonths: 9, note: '' }, NOW);
  const a = v.items.find(i => i.id === 'aceite');
  assert.equal(a.intervalKm, 7500);
  assert.equal(a.history.length, 2);
});

console.log('Respaldo, plantilla y lectura de facturas');
test('importa respaldos v1 y rechaza basura', () => {
  const r = M.parseBackup(JSON.stringify({ vehicles: [V1], currentVehicleId: 'aveo' }), NOW);
  assert.equal(r.vehicles[0].schema, 2);
  assert.equal(r.currentVehicleId, 'aveo');
  assert.throws(() => M.parseBackup('no json', NOW), /JSON/);
  assert.throws(() => M.parseBackup('{"vehicles":[]}', NOW), /formato/);
  assert.throws(() => M.parseBackup('{"vehicles":[{"id":"1"}]}', NOW), /sin nombre/);
});
test('una foto con contenido no-imagen se descarta (evita inyección en src)', () => {
  const evil = { id: 'x', name: 'X', currentKm: 1, records: [{ id: 'r', piece: 'P', category: 'Motor', lastDate: '2026-01-01', lastKm: 1, intervalKm: 1, intervalMonths: 1, cost: 1, photo: 'javascript:alert(1)' }] };
  const v = M.migrateVehicle(evil, NOW);
  assert.equal(v.items[0].history[0].photo, undefined);
});
test('el plan típico crea piezas sin servicios registrados', () => {
  const v = M.createVehicle({ name: 'Kia Rio', plate: 'ABC-123', currentKm: 12000 }, true, NOW);
  assert.ok(v.items.length >= 10);
  assert.ok(v.items.every(i => i.history.length === 0));
  assert.equal(M.computeVehicle(v, NOW).count.pendiente, v.items.length);
});
test('lee fecha, total, km y pieza de un texto de factura', () => {
  const text = [
    'LUBRICADORA EL MOTOR', 'RUC 1790000000001', 'Fecha: 12/05/2026',
    'Cambio de aceite 10W30 y filtro', 'Subtotal 30.00', 'IVA 15% 4.50', 'TOTAL 34.50',
    'Kilometraje 135.000 km',
  ].join('\n');
  const r = M.parseInvoiceText(text, V2, NOW);
  assert.equal(r.date, '2026-05-12');
  assert.equal(r.total, 34.5);
  assert.equal(r.km, 135000);
  assert.equal(r.itemId, 'aceite');
});
test('interpreta montos con coma decimal y fechas con mes en texto', () => {
  assert.equal(M.parseAmount('1.234,56'), 1234.56);
  assert.equal(M.parseAmount('34,50'), 34.5);
  assert.equal(M.parseAmount('$ 1,234.50'), 1234.5);
  assert.equal(M.parseAmount('1.234'), 1234);
  assert.deepEqual(M.findDates('Quito, 3 de mayo de 2026', NOW), ['2026-05-03']);
  assert.deepEqual(M.findDates('fecha 2027-01-01', NOW), []); // futura: se descarta
});
test('el texto vacío no inventa datos', () => {
  const r = M.parseInvoiceText('', V2, NOW);
  assert.deepEqual([r.date, r.total, r.km, r.pieceName], [null, null, null, null]);
});

console.log('Calendario (.ics)');
test('genera eventos válidos solo para piezas con fecha estimada', () => {
  const ics = M.buildIcs(V2, S, NOW);
  assert.ok(ics.count >= 5);
  assert.match(ics.text, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics.text, /END:VCALENDAR\r\n$/);
  assert.equal((ics.text.match(/BEGIN:VEVENT/g) || []).length, ics.count);
  assert.equal((ics.text.match(/END:VEVENT/g) || []).length, ics.count);
  for (const line of ics.text.split('\r\n')) assert.ok(line.length <= 75, 'línea larga: ' + line.length);
});

console.log('\n' + passed + ' pruebas pasaron' + (process.exitCode ? ' — HAY FALLOS' : ''));
