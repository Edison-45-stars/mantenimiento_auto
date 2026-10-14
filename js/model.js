'use strict';
/* ==========================================================================
   Modelo de datos y lógica de negocio (sin DOM, probable en Node).

   Esquema v2
   vehicle = { id, name, plate, currentKm, schema: 2,
               items:    [ { id, piece, category, intervalKm, intervalMonths, note,
                             history: [ { id, date:'YYYY-MM-DD', km, cost, photo? } ] } ],
               odometer: [ { date, km } ]   // solo actualizaciones manuales de km
             }

   Reglas de cálculo
   - Fechas 'YYYY-MM-DD' se interpretan en hora LOCAL (no UTC).
   - Vida útil consumida = max(km recorridos / intervalo km, meses / intervalo meses).
       >= 100 %  -> Vencido      >= 85 %  -> Pronto      resto -> Al día
   - Gasto anual por pieza = último costo × ciclos por año, con
       ciclos/año = max(12 / meses, km por año / intervalo km).
     Los km por año se estiman por regresión lineal sobre el odómetro (servicios
     registrados + actualizaciones manuales); sin datos suficientes se usa solo el tiempo.
   ========================================================================== */

const DAY_MS = 86400000;
const MONTH_DAYS = 30.4375;
const SOON_AT = 0.85;
const SCHEMA = 2;
const CATEGORIES = ['Motor', 'Frenos', 'Eléctrico', 'Suspensión', 'Transmisión', 'Otros'];

const ROUTINE_CHECKLIST = [
  'Freno de mano',
  'Ventilación, calefacción y aire acondicionado',
  'Limpiaparabrisas y aspersores',
  'Luces exteriores y pito',
  'Tensión y estado de la banda de accesorios',
  'Nivel de refrigerante y fugas del radiador',
  'Estado de la batería y del alternador',
  'Nivel y fugas del aceite del motor',
  'Nivel y fugas del líquido de dirección',
];

// Intervalos genéricos de referencia (ajústalos al manual de tu vehículo).
const TEMPLATE_ITEMS = [
  { piece: 'Aceite y filtro de motor', category: 'Motor', intervalKm: 5000, intervalMonths: 6, note: 'Lubrica el motor y evita el desgaste prematuro de sus componentes internos.' },
  { piece: 'Filtro de aire', category: 'Motor', intervalKm: 10000, intervalMonths: 12, note: 'Filtra el aire que entra al motor; si se satura, reduce el rendimiento y aumenta el consumo.' },
  { piece: 'Filtro de combustible', category: 'Motor', intervalKm: 20000, intervalMonths: 24, note: 'Evita que impurezas del combustible lleguen al motor.' },
  { piece: 'Bujías', category: 'Motor', intervalKm: 30000, intervalMonths: 24, note: 'Encienden la mezcla aire-combustible; si fallan, sube el consumo y baja la potencia.' },
  { piece: 'Correa de distribución', category: 'Motor', intervalKm: 90000, intervalMonths: 60, note: 'Si se rompe en marcha puede dañar el motor gravemente; no conviene retrasarla.' },
  { piece: 'Refrigerante', category: 'Motor', intervalKm: 40000, intervalMonths: 24, note: 'Protege el motor del sobrecalentamiento y la corrosión del circuito.' },
  { piece: 'Pastillas de freno delanteras', category: 'Frenos', intervalKm: 30000, intervalMonths: 24, note: 'Se desgastan por fricción al frenar; son críticas para la seguridad.' },
  { piece: 'Líquido de frenos', category: 'Frenos', intervalKm: 0, intervalMonths: 24, note: 'Absorbe humedad con el tiempo, lo que reduce la eficacia del sistema de frenos.' },
  { piece: 'Batería', category: 'Eléctrico', intervalKm: 0, intervalMonths: 36, note: 'Pierde capacidad con el tiempo y el calor; revísala antes de un viaje largo.' },
  { piece: 'Llantas (juego de 4)', category: 'Suspensión', intervalKm: 45000, intervalMonths: 48, note: 'El desgaste de la banda de rodadura afecta la tracción y la distancia de frenado.' },
  { piece: 'Alineación y balanceo', category: 'Suspensión', intervalKm: 10000, intervalMonths: 6, note: 'Mantiene el desgaste uniforme de las llantas y mejora la estabilidad.' },
];

const STATUS_META = {
  vencido: { label: 'Vencido', tone: 'late' },
  pronto: { label: 'Pronto', tone: 'soon' },
  ok: { label: 'Al día', tone: 'ok' },
  pendiente: { label: 'Sin registro', tone: 'idle' },
  sinplan: { label: 'Sin intervalo', tone: 'idle' },
  noaplica: { label: 'No aplica', tone: 'idle' },
};

/* ---------- Utilidades de fecha y formato ---------- */

function pad2(n) { return String(n).padStart(2, '0'); }
function toIso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayIso(now) { return toIso(now || new Date()); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function parseLocalDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const ok = d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
  return ok ? d : null;
}

function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(date.getDate(), last));
  return d;
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

// Días de calendario de a hacia b (seguro ante cambios de horario).
function daysBetween(a, b) {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS);
}

function fmtInt(n) { return Math.round(n).toLocaleString('es-EC'); }
function fmtDate(d) { return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtDateIso(iso) { const d = parseLocalDate(iso); return d ? fmtDate(d) : '—'; }
function fmtMoney(n) {
  const v = Math.round((n || 0) * 100) / 100;
  return '$' + v.toLocaleString('es-EC', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
function fmtSpan(days) {
  const d = Math.abs(Math.round(days));
  if (d < 1) return 'hoy';
  if (d < 45) return d + (d === 1 ? ' día' : ' días');
  const m = Math.round(d / MONTH_DAYS);
  if (m < 24) return m + (m === 1 ? ' mes' : ' meses');
  return (Math.round(d / 365.25 * 10) / 10) + ' años';
}

function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function num(x, def) { const n = Number(x); return Number.isFinite(n) ? n : (def || 0); }
function clampInt(x, max) { return Math.min(max || 9e9, Math.max(0, Math.round(num(x)))); }

/* ---------- Normalización y migración ---------- */

function validPhoto(p) {
  return typeof p === 'string' && p.length < 6e6 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p);
}

function sortHistory(item) {
  item.history.sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km);
}

function normalizeEntry(h, now) {
  const e = {
    id: (h && h.id) ? String(h.id) : uid('h'),
    date: parseLocalDate(h && h.date) ? String(h.date).slice(0, 10) : todayIso(now),
    km: clampInt(h && h.km, 2e6),
    cost: Math.min(1e7, Math.max(0, Math.round(num(h && h.cost) * 100) / 100)),
  };
  if (h && validPhoto(h.photo)) e.photo = h.photo;
  return e;
}

function normalizeItem(it, now) {
  const item = {
    id: (it && it.id) ? String(it.id) : uid('i'),
    piece: String((it && it.piece) || 'Mantenimiento').trim().slice(0, 80) || 'Mantenimiento',
    category: CATEGORIES.includes(it && it.category) ? it.category : 'Otros',
    noRepeat: !!(it && it.noRepeat),
    intervalKm: (it && it.noRepeat) ? 0 : clampInt(it && it.intervalKm, 1e6),
    intervalMonths: (it && it.noRepeat) ? 0 : clampInt(it && it.intervalMonths, 600),
    note: String((it && it.note) || '').slice(0, 300),
    history: Array.isArray(it && it.history) ? it.history.map(h => normalizeEntry(h, now)) : [],
  };
  sortHistory(item);
  return item;
}

function normalizeVehicle(v, now) {
  const out = {
    id: String(v.id || uid('v')),
    name: String(v.name || 'Mi vehículo').trim().slice(0, 60) || 'Mi vehículo',
    plate: String(v.plate || '').trim().slice(0, 12),
    currentKm: clampInt(v.currentKm, 2e6),
    schema: SCHEMA,
    items: (v.items || []).map(i => normalizeItem(i, now)),
    odometer: (v.odometer || [])
      .filter(p => p && parseLocalDate(p.date))
      .map(p => ({ date: String(p.date).slice(0, 10), km: clampInt(p.km, 2e6) })),
  };
  // Los ids de pieza e historial deben ser únicos dentro del vehículo.
  const seen = new Set();
  for (const item of out.items) {
    while (seen.has(item.id)) item.id = uid('i');
    seen.add(item.id);
    for (const h of item.history) {
      while (seen.has(h.id)) h.id = uid('h');
      seen.add(h.id);
    }
  }
  return out;
}

function needsMigration(v) { return !v || v.schema !== SCHEMA; }

// v1 guardaba un solo registro por mantenimiento y duplicaba piezas al repetir un servicio.
// Aquí se agrupan por nombre y cada registro viejo pasa a ser un servicio del historial.
function migrateVehicle(v, now) {
  if (v && v.schema === SCHEMA) return normalizeVehicle(v, now);
  const groups = new Map();
  for (const r of (v.records || [])) {
    const key = slug(r.piece) || r.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const items = [];
  for (const recs of groups.values()) {
    recs.sort((a, b) => String(b.lastDate).localeCompare(String(a.lastDate)));
    const base = recs[0];
    items.push({
      id: base.id, piece: base.piece, category: base.category,
      intervalKm: base.intervalKm, intervalMonths: base.intervalMonths, note: base.note,
      history: recs.map(r => ({ id: 'h-' + r.id, date: r.lastDate, km: r.lastKm, cost: r.cost, photo: r.photo })),
    });
  }
  return normalizeVehicle({ id: v.id, name: v.name, plate: v.plate, currentKm: v.currentKm, items, odometer: [] }, now);
}

function createVehicle(data, withTemplate, now) {
  const items = withTemplate
    ? TEMPLATE_ITEMS.map(t => Object.assign({ id: uid('i'), history: [] }, t))
    : [];
  return normalizeVehicle({ id: uid('v'), name: data.name, plate: data.plate, currentKm: data.currentKm, items, odometer: [] }, now);
}

function parseBackup(text, now) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('El archivo no es un JSON válido.'); }
  if (!data || !Array.isArray(data.vehicles) || !data.vehicles.length) {
    throw new Error('El archivo no tiene el formato de respaldo esperado.');
  }
  if (data.vehicles.length > 50) throw new Error('El respaldo tiene demasiados vehículos.');
  const vehicles = [];
  const ids = new Set();
  for (const raw of data.vehicles) {
    if (!raw || typeof raw !== 'object' || !raw.name) throw new Error('Hay un vehículo sin nombre en el respaldo.');
    const v = migrateVehicle(raw, now);
    while (ids.has(v.id)) v.id = uid('v');
    ids.add(v.id);
    vehicles.push(v);
  }
  const currentVehicleId = ids.has(data.currentVehicleId) ? data.currentVehicleId : vehicles[0].id;
  return { vehicles, currentVehicleId };
}

/* ---------- Odómetro y uso anual ---------- */

function vehiclePoints(vehicle) {
  const pts = (vehicle.odometer || []).map(p => ({ date: p.date, km: p.km }));
  for (const item of vehicle.items) for (const h of item.history) pts.push({ date: h.date, km: h.km });
  return pts;
}

// Regresión lineal km ~ días. Usa los últimos 24 meses si alcanzan; si no, todo el historial.
function estimateKmPerYear(points, now) {
  const pts = points
    .map(p => ({ t: parseLocalDate(p.date), km: p.km }))
    .filter(p => p.t && p.km >= 0)
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const spanOf = a => daysBetween(a[0].t, a[a.length - 1].t);
  let use = pts.filter(p => p.t >= addMonths(startOfDay(now), -24));
  if (use.length < 2 || spanOf(use) < 90) use = pts;
  if (spanOf(use) < 90) return null;
  const x0 = use[0].t;
  const xs = use.map(p => daysBetween(x0, p.t));
  const ys = use.map(p => p.km);
  const n = use.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  if (sxx === 0) return null;
  const perYear = (sxy / sxx) * 365.25;
  return perYear > 0 && perYear <= 100000 ? perYear : null;
}

function maxServiceKm(vehicle) {
  let m = 0;
  for (const item of vehicle.items) for (const h of item.history) m = Math.max(m, h.km);
  return m;
}

/* ---------- Cálculo por pieza y por vehículo ---------- */

function lifespanLabel(item) {
  if (item.noRepeat) return 'Sin cambio periódico';
  const parts = [];
  if (item.intervalKm > 0) parts.push(fmtInt(item.intervalKm) + ' km');
  if (item.intervalMonths > 0) parts.push(item.intervalMonths + ' meses');
  return parts.length ? parts.join(' / ') : 'Sin intervalo definido';
}

function computeItem(item, vehicle, ctx) {
  const today = startOfDay(ctx.now);
  const last = item.history[0] || null;
  const hasKm = item.intervalKm > 0;
  const hasTime = item.intervalMonths > 0;
  const out = {
    id: item.id, piece: item.piece, category: item.category, note: item.note,
    intervalKm: item.intervalKm, intervalMonths: item.intervalMonths,
    history: item.history, last, hasKm, hasTime,
    lifespanLabel: lifespanLabel(item),
    progress: -1, pct: 0, annualCost: null, cyclesPerYear: null,
    estDueDate: null, nextDueKm: null, kmRemaining: null, daysRemaining: null, limiting: null,
  };
  const finish = (status, dueLabel, dueShort) => {
    out.status = status; out.dueLabel = dueLabel; out.dueShort = dueShort;
    out.tone = STATUS_META[status].tone; out.statusLabel = STATUS_META[status].label;
    return out;
  };

  if (item.noRepeat) {
    const d = last && parseLocalDate(last.date);
    return finish('noaplica', last ? 'Último servicio: ' + (d ? fmtDate(d) : last.date) + ' · ' + fmtInt(last.km) + ' km' : 'Sin cambio periódico · sin servicios registrados', 'No aplica');
  }
  if (!hasKm && !hasTime) return finish('sinplan', 'Define cada cuánto se repite', 'Sin intervalo');
  if (!last) return finish('pendiente', 'Registra su último servicio para activar los avisos', 'Sin registro');

  const lastDate = parseLocalDate(last.date) || today;
  const elapsedMonths = Math.max(0, daysBetween(lastDate, today)) / MONTH_DAYS;
  const kmDriven = Math.max(0, vehicle.currentKm - last.km);
  const kmUsed = hasKm ? kmDriven / item.intervalKm : 0;
  const timeUsed = hasTime ? elapsedMonths / item.intervalMonths : 0;
  const progress = Math.max(kmUsed, timeUsed);
  out.progress = progress;
  out.pct = Math.min(100, Math.round(progress * 100));
  out.kmUsed = kmUsed; out.timeUsed = timeUsed;
  out.limiting = hasKm && hasTime ? (kmUsed >= timeUsed ? 'km' : 'tiempo') : (hasKm ? 'km' : 'tiempo');

  if (hasKm) { out.nextDueKm = last.km + item.intervalKm; out.kmRemaining = out.nextDueKm - vehicle.currentKm; }
  let nextDueDate = null;
  if (hasTime) { nextDueDate = addMonths(lastDate, item.intervalMonths); out.daysRemaining = daysBetween(today, nextDueDate); }
  out.nextDueDate = nextDueDate;

  // Fecha estimada de vencimiento: la primera entre el plazo y el momento en que se alcanzaría el km.
  const dates = [];
  if (nextDueDate) dates.push(nextDueDate);
  if (hasKm && ctx.kmPerYear) {
    dates.push(out.kmRemaining <= 0 ? today : addDays(today, Math.round(out.kmRemaining / ctx.kmPerYear * 365.25)));
  }
  if (dates.length) out.estDueDate = dates.reduce((a, b) => (a < b ? a : b));

  const status = progress >= 1 ? 'vencido' : (progress >= SOON_AT ? 'pronto' : 'ok');

  let dueLabel, dueShort;
  if (status === 'vencido') {
    const parts = [];
    if (hasKm && kmUsed >= 1) {
      parts.push(out.kmRemaining < 0
        ? 'pasado por ' + fmtInt(-out.kmRemaining) + ' km'
        : 'llegó a los ' + fmtInt(out.nextDueKm) + ' km');
    }
    if (hasTime && timeUsed >= 1) parts.push('vencido hace ' + fmtSpan(out.daysRemaining));
    dueLabel = parts.join(' · ');
    dueLabel = dueLabel.charAt(0).toUpperCase() + dueLabel.slice(1);
    dueShort = 'Vencido';
  } else {
    const parts = [];
    if (hasKm) parts.push(fmtInt(Math.max(0, out.kmRemaining)) + ' km');
    if (hasTime) parts.push(fmtSpan(Math.max(0, out.daysRemaining)));
    dueLabel = 'Faltan ' + parts.join(' o ');
    dueShort = parts.join(' · ');
  }

  // Costo anual: último costo × ciclos por año (lo que se cumpla primero: tiempo o km).
  const cands = [];
  if (hasTime) cands.push(12 / item.intervalMonths);
  if (hasKm && ctx.kmPerYear) cands.push(ctx.kmPerYear / item.intervalKm);
  if (cands.length) {
    out.cyclesPerYear = Math.max.apply(null, cands);
    if (last.cost > 0) out.annualCost = last.cost * out.cyclesPerYear;
  }
  return finish(status, dueLabel, dueShort);
}

function monthlySpend(vehicle, now, months) {
  const n = months || 12;
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  const buckets = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    buckets.push({ key: d.getFullYear() + '-' + pad2(d.getMonth() + 1), year: d.getFullYear(), month: d.getMonth(), total: 0 });
  }
  const byKey = new Map(buckets.map(b => [b.key, b]));
  for (const item of vehicle.items) {
    for (const h of item.history) {
      const b = byKey.get(h.date.slice(0, 7));
      if (b) b.total += h.cost;
    }
  }
  return buckets;
}

function historyEntries(vehicle) {
  const list = [];
  for (const item of vehicle.items) for (const h of item.history) list.push({ item, h });
  list.sort((a, b) => b.h.date.localeCompare(a.h.date) || b.h.km - a.h.km || a.item.piece.localeCompare(b.item.piece, 'es'));
  return list;
}

function computeVehicle(vehicle, now) {
  now = now || new Date();
  const kmPerYear = estimateKmPerYear(vehiclePoints(vehicle), now);
  const ctx = { now, kmPerYear };
  const items = vehicle.items.map(i => computeItem(i, vehicle, ctx));
  items.sort((a, b) => b.progress - a.progress || a.piece.localeCompare(b.piece, 'es'));

  const count = { vencido: 0, pronto: 0, ok: 0, pendiente: 0, sinplan: 0, noaplica: 0 };
  items.forEach(i => { count[i.status]++; });
  const tracked = count.vencido + count.pronto + count.ok;
  const spend = vehicle.items.reduce((s, it) => s + it.history.reduce((t, h) => t + h.cost, 0), 0);
  const services = vehicle.items.reduce((s, it) => s + it.history.length, 0);
  const withCost = items.filter(i => i.annualCost != null);

  return {
    kmPerYear, items, count, tracked,
    byId: Object.fromEntries(items.map(i => [i.id, i])),
    healthPct: tracked ? Math.round(count.ok / tracked * 100) : null,
    totalSpend: spend, serviceCount: services,
    annualEstimate: withCost.reduce((s, i) => s + i.annualCost, 0),
    annualCovered: withCost.length,
    monthly: monthlySpend(vehicle, now, 12),
    attention: items.filter(i => i.status === 'vencido' || i.status === 'pronto'),
    next: items.length && items[0].progress >= 0 ? items[0] : null,
  };
}

/* ---------- Altas, ediciones y bajas ---------- */

function findItemByName(vehicle, name) {
  const key = slug(name);
  return key ? vehicle.items.find(i => slug(i.piece) === key) : null;
}

// Valida los datos del formulario de servicio. Devuelve {campo: mensaje}.
function validateService(f, vehicle, now, opts) {
  const errors = {};
  const o = opts || {};
  if (!o.existingItem && !String(f.piece || '').trim()) errors.piece = 'Escribe el nombre del mantenimiento.';
  const d = parseLocalDate(f.date);
  if (!d) errors.date = 'Elige una fecha válida.';
  else if (d > startOfDay(now)) errors.date = 'La fecha no puede ser futura.';
  const km = Number(f.km);
  if (f.km === '' || f.km == null || !Number.isFinite(km) || km < 0) errors.km = 'Ingresa el kilometraje.';
  else if (km > 2e6) errors.km = 'Ese kilometraje no parece real.';
  const cost = Number(f.cost === '' || f.cost == null ? 0 : f.cost);
  if (!Number.isFinite(cost) || cost < 0) errors.cost = 'El costo no puede ser negativo.';
  if (!o.existingItem) {
    if (num(f.intervalKm) < 0) errors.intervalKm = 'No puede ser negativo.';
    if (num(f.intervalMonths) < 0) errors.intervalMonths = 'No puede ser negativo.';
    if (!f.noRepeat && !(num(f.intervalKm) > 0) && !(num(f.intervalMonths) > 0)) errors.intervalMonths = 'Define cada cuántos km o meses, o marca "No aplica".';
  }
  return errors;
}

// f: {itemId?, piece, category, intervalKm, intervalMonths, date, km, cost, photo?, note?}
function addService(vehicle, f, now) {
  let item = f.itemId ? vehicle.items.find(i => i.id === f.itemId) : null;
  if (!item) item = findItemByName(vehicle, f.piece); // evita duplicar una pieza existente
  if (!item) {
    item = normalizeItem({
      id: uid('i'), piece: f.piece, category: f.category, note: f.note || '',
      intervalKm: f.intervalKm, intervalMonths: f.intervalMonths, noRepeat: !!f.noRepeat, history: [],
    }, now);
    vehicle.items.push(item);
  }
  const entry = normalizeEntry({ id: uid('h'), date: f.date, km: f.km, cost: f.cost, photo: f.photo }, now);
  item.history.push(entry);
  sortHistory(item);
  if (entry.km > vehicle.currentKm) vehicle.currentKm = entry.km;
  return { item, entry };
}

function updateService(vehicle, itemId, historyId, f, now) {
  const item = vehicle.items.find(i => i.id === itemId);
  const entry = item && item.history.find(h => h.id === historyId);
  if (!entry) return null;
  const fresh = normalizeEntry({ id: entry.id, date: f.date, km: f.km, cost: f.cost, photo: f.photo === undefined ? entry.photo : f.photo }, now);
  Object.assign(entry, fresh);
  if (!fresh.photo) delete entry.photo;
  sortHistory(item);
  if (entry.km > vehicle.currentKm) vehicle.currentKm = entry.km;
  return { item, entry };
}

function deleteService(vehicle, itemId, historyId) {
  const item = vehicle.items.find(i => i.id === itemId);
  if (!item) return false;
  const n = item.history.length;
  item.history = item.history.filter(h => h.id !== historyId);
  return item.history.length < n;
}

function updatePlan(vehicle, itemId, p, now) {
  const item = vehicle.items.find(i => i.id === itemId);
  if (!item) return null;
  const n = normalizeItem({ id: item.id, piece: p.piece, category: p.category, note: p.note, noRepeat: !!p.noRepeat, intervalKm: p.intervalKm, intervalMonths: p.intervalMonths, history: item.history }, now);
  Object.assign(item, { piece: n.piece, category: n.category, note: n.note, noRepeat: n.noRepeat, intervalKm: n.intervalKm, intervalMonths: n.intervalMonths });
  return item;
}

function validatePlan(p, vehicle, itemId) {
  const errors = {};
  if (!String(p.piece || '').trim()) errors.piece = 'Escribe un nombre.';
  else {
    const dup = findItemByName(vehicle, p.piece);
    if (dup && dup.id !== itemId) errors.piece = 'Ya existe una pieza con ese nombre.';
  }
  if (num(p.intervalKm) < 0) errors.intervalKm = 'No puede ser negativo.';
  if (num(p.intervalMonths) < 0) errors.intervalMonths = 'No puede ser negativo.';
  if (!p.noRepeat && !(num(p.intervalKm) > 0) && !(num(p.intervalMonths) > 0)) errors.intervalMonths = 'Define cada cuántos km o meses, o marca "No aplica".';
  return errors;
}

// Actualiza el km actual. Devuelve un mensaje de error o null.
function setCurrentKm(vehicle, km, now) {
  const v = Number(km);
  if (!Number.isFinite(v) || v < 0 || v > 2e6) return 'Ingresa un kilometraje válido.';
  const k = Math.round(v);
  const floor = maxServiceKm(vehicle);
  if (k < floor) return 'No puede ser menor al del último servicio registrado (' + fmtInt(floor) + ' km).';
  vehicle.odometer = (vehicle.odometer || []).filter(p => p.km <= k);
  vehicle.odometer.push({ date: todayIso(now), km: k });
  vehicle.currentKm = k;
  return null;
}

/* ---------- Lectura de facturas (texto OCR -> campos) ---------- */

const PIECE_KEYWORDS = [
  { re: /pastillas?.{0,25}traser|traser.{0,25}pastillas?/i, name: 'Pastillas de freno traseras', category: 'Frenos', intervalKm: 30000, intervalMonths: 24 },
  { re: /pastillas?|balatas?/i, name: 'Pastillas de freno delanteras', category: 'Frenos', intervalKm: 30000, intervalMonths: 24 },
  { re: /l[ií]quido\s+de\s+freno|liquido\s+freno/i, name: 'Líquido de frenos', category: 'Frenos', intervalKm: 0, intervalMonths: 24 },
  { re: /filtro\s+de\s+aire|filtro\s+aire/i, name: 'Filtro de aire', category: 'Motor', intervalKm: 10000, intervalMonths: 12 },
  { re: /filtro\s+de\s+combustible|filtro\s+combust/i, name: 'Filtro de combustible', category: 'Motor', intervalKm: 20000, intervalMonths: 24 },
  { re: /aceite|lubricante/i, name: 'Aceite y filtro de motor', category: 'Motor', intervalKm: 5000, intervalMonths: 6 },
  { re: /buj[ií]as?/i, name: 'Bujías', category: 'Motor', intervalKm: 30000, intervalMonths: 24 },
  { re: /correa\s+de\s+distribuci|kit\s+de\s+distribuci/i, name: 'Correa de distribución', category: 'Motor', intervalKm: 90000, intervalMonths: 60 },
  { re: /refrigerante|anticongelante/i, name: 'Refrigerante', category: 'Motor', intervalKm: 40000, intervalMonths: 24 },
  { re: /bater[ií]a|acumulador/i, name: 'Batería', category: 'Eléctrico', intervalKm: 0, intervalMonths: 36 },
  { re: /alineaci[oó]n|balanceo/i, name: 'Alineación y balanceo', category: 'Suspensión', intervalKm: 10000, intervalMonths: 6 },
  { re: /llantas?|neum[aá]tic/i, name: 'Llantas (juego de 4)', category: 'Suspensión', intervalKm: 45000, intervalMonths: 48 },
];

const MONTHS_ES = { ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, set: 9, septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12 };

function parseAmount(s) {
  s = String(s).replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;
  const dot = s.lastIndexOf('.'), comma = s.lastIndexOf(',');
  const dec = Math.max(dot, comma);
  if (dec === -1) return parseFloat(s);
  const after = s.length - dec - 1;
  const both = dot !== -1 && comma !== -1;
  if (after === 3 && !both && (s.match(/[.,]/g) || []).length >= 1 && s.slice(0, dec).length >= 1 && /^\d{1,3}([.,]\d{3})+$/.test(s)) {
    return parseFloat(s.replace(/[.,]/g, '')); // 1.234 -> 1234
  }
  const v = parseFloat(s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1));
  return Number.isFinite(v) ? v : null;
}

function isoIfValid(y, m, d, now) {
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  if (y < 2000 || dt > startOfDay(now)) return null;
  return toIso(dt);
}

function findDates(line, now) {
  const found = [];
  let m;
  const iso = /\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/g;
  while ((m = iso.exec(line))) { const r = isoIfValid(+m[1], +m[2], +m[3], now); if (r) found.push(r); }
  const dmy = /\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})\b/g;
  while ((m = dmy.exec(line))) {
    let r = isoIfValid(+m[3], +m[2], +m[1], now);           // dd/mm/aaaa (formato de Ecuador)
    if (!r && +m[2] > 12) r = isoIfValid(+m[3], +m[1], +m[2], now); // mm/dd/aaaa
    if (r) found.push(r);
  }
  const txt = /\b(\d{1,2})\s*(?:de\s+)?([a-záéíóú]{3,10})\.?\s*(?:de|del)?\s*(\d{4})\b/gi;
  while ((m = txt.exec(line))) {
    const mon = MONTHS_ES[slug(m[2])];
    const r = mon && isoIfValid(+m[3], mon, +m[1], now);
    if (r) found.push(r);
  }
  return found;
}

function parseInvoiceText(text, vehicle, now) {
  now = now || new Date();
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = { date: null, total: null, km: null, pieceName: null, category: null, intervalKm: null, intervalMonths: null, itemId: null };

  // Fecha: primero líneas que digan "fecha", luego cualquiera.
  const dated = lines.filter(l => /fecha/i.test(l)).concat(lines);
  for (const l of dated) { const d = findDates(l, now); if (d.length) { out.date = d[0]; break; } }

  // Total: líneas con "total" (sin "subtotal"); si no hay, el mayor monto con decimales.
  const amountRe = /\d[\d.,]*\d|\d/g;
  const totals = [];
  lines.forEach((l, i) => {
    if (/(^|[^a-z])total(?![a-z])|a\s+pagar|importe/i.test(l) && !/sub\s*total/i.test(l)) {
      (l + ' ' + (lines[i + 1] || '')).match(amountRe) && (l + ' ' + (lines[i + 1] || '')).match(amountRe).forEach(a => {
        const v = parseAmount(a);
        if (v != null && v > 0 && v < 100000) totals.push(v);
      });
    }
  });
  if (totals.length) out.total = Math.max.apply(null, totals);
  else {
    const all = [];
    lines.forEach(l => (l.match(/\d+[.,]\d{2}\b/g) || []).forEach(a => { const v = parseAmount(a); if (v != null && v > 0 && v < 20000) all.push(v); }));
    if (all.length) out.total = Math.max.apply(null, all);
  }

  // Kilometraje.
  const kmM = /(\d{1,3}(?:[.,]\d{3})+|\d{4,7})\s*(?:km|kms|kil[oó]metros)\b/i.exec(text || '')
    || /kilometraje\D{0,12}(\d{1,3}(?:[.,]\d{3})+|\d{4,7})/i.exec(text || '');
  if (kmM) { const k = parseInt(kmM[1].replace(/[.,]/g, ''), 10); if (k > 0 && k < 2e6) out.km = k; }

  // Pieza: primera palabra clave encontrada; se asocia a una pieza existente si hay.
  for (const kw of PIECE_KEYWORDS) {
    if (kw.re.test(text || '')) {
      out.pieceName = kw.name; out.category = kw.category;
      out.intervalKm = kw.intervalKm; out.intervalMonths = kw.intervalMonths;
      const existing = vehicle && (findItemByName(vehicle, kw.name) || vehicle.items.find(i => kw.re.test(i.piece) && !(/traser/i.test(kw.name) !== /traser/i.test(i.piece))));
      if (existing) { out.itemId = existing.id; out.pieceName = existing.piece; }
      break;
    }
  }
  return out;
}

/* ---------- Recordatorios en calendario (.ics) ---------- */

function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icsDate(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()); }
function icsFold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 70) { out.push(rest.slice(0, 70)); rest = ' ' + rest.slice(70); }
  out.push(rest);
  return out.join('\r\n');
}

function buildIcs(vehicle, summary, now) {
  now = now || new Date();
  const today = startOfDay(now);
  const stamp = now.getUTCFullYear() + pad2(now.getUTCMonth() + 1) + pad2(now.getUTCDate()) + 'T' + pad2(now.getUTCHours()) + pad2(now.getUTCMinutes()) + pad2(now.getUTCSeconds()) + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mantenimiento Auto//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  let n = 0;
  for (const it of summary.items) {
    if (!it.estDueDate) continue;
    const day = it.estDueDate < today ? today : it.estDueDate;
    const desc = 'Kilometraje actual: ' + fmtInt(vehicle.currentKm) + ' km. Intervalo: ' + it.lifespanLabel + '. Fecha estimada con tu uso actual; revisa el kilometraje antes de agendar.';
    L.push('BEGIN:VEVENT',
      'UID:' + it.id + '-' + vehicle.id + '@mantenimiento-auto',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + icsDate(day),
      'DTEND;VALUE=DATE:' + icsDate(addDays(day, 1)),
      'SUMMARY:' + icsEscape('Mantenimiento: ' + it.piece + ' (' + vehicle.name + ')'),
      'DESCRIPTION:' + icsEscape(desc),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape('Pronto: ' + it.piece), 'TRIGGER:-P7D', 'END:VALARM',
      'END:VEVENT');
    n++;
  }
  L.push('END:VCALENDAR');
  return { text: L.map(icsFold).join('\r\n') + '\r\n', count: n };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SOON_AT, TEMPLATE_ITEMS, CATEGORIES, STATUS_META,
    parseLocalDate, toIso, todayIso, addMonths, addDays, daysBetween, fmtSpan, fmtMoney, slug,
    migrateVehicle, normalizeVehicle, needsMigration, createVehicle, parseBackup,
    estimateKmPerYear, vehiclePoints, computeItem, computeVehicle, monthlySpend, historyEntries,
    validateService, addService, updateService, deleteService, updatePlan, validatePlan, setCurrentKm,
    parseAmount, parseInvoiceText, findDates, buildIcs, findItemByName,
  };
}
