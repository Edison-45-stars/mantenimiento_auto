'use strict';
/* Estado, eventos y flujo de la aplicación. */

const appEl = document.getElementById('app');
const toastEl = document.getElementById('toast');

function blankForm(v) {
  return { itemId: '__new', piece: '', category: 'Motor', date: todayIso(), km: v ? v.currentKm : '', cost: '', intervalKm: 5000, intervalMonths: 6 };
}
function newAdd(v) {
  return { step: 'start', f: blankForm(v), errors: {}, photo: null, ocrNote: null, doneItemId: null };
}

const state = {
  tab: 'inicio', prevTab: 'inicio', selectedId: null,
  vehicles: [], currentVehicleId: null, pickerOpen: false,
  historyView: 'pieza', upFilter: 'todos', checklistOpen: false,
  add: newAdd(null), modal: null,
  showInstall: false, installKind: null, notifDismissed: false, storageWarn: false,
};

let deferredInstallPrompt = null;
let pendingConfirm = null;
let toastTimer = null;
let undoFn = null;
let lastTab = null;
let scanToken = 0;
let ocrWorker = null;

function currentVehicle() {
  return state.vehicles.find(v => v.id === state.currentVehicleId) || state.vehicles[0] || null;
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }

/* ---------- Vista ---------- */

function buildBanner(v, S) {
  if (state.storageWarn) return { icon: 'alert', text: 'Tu navegador no permite guardar datos (¿modo privado?). Lo que registres se perderá al cerrar la app.' };
  if (state.showInstall && state.installKind === 'android') return { icon: 'download', text: 'Instala la app para abrirla más rápido y usarla sin conexión.', action: 'installApp', label: 'Instalar', dismiss: 'dismissInstall' };
  if (state.showInstall && state.installKind === 'ios') return { icon: 'download', text: 'Para instalar: toca Compartir y luego "Agregar a inicio".', dismiss: 'dismissInstall' };
  if (v && S && S.items.length && typeof Notification !== 'undefined' && Notification.permission === 'default' && !state.notifDismissed) {
    return { icon: 'bell', text: 'Activa los avisos para enterarte de lo que vence al abrir la app.', action: 'requestNotifPermission', label: 'Activar', dismiss: 'dismissNotif' };
  }
  return null;
}

function computeViewModel() {
  const v = currentVehicle();
  if (!v) return { hasVehicles: false, tab: state.tab, modal: state.modal, banner: buildBanner(null, null) };
  const S = computeVehicle(v, new Date());
  return {
    hasVehicles: true, tab: state.tab, vehicle: v, S,
    pickerOpen: state.pickerOpen,
    vehicleOptions: state.vehicles.map(o => ({ id: o.id, name: o.name, plate: o.plate, items: o.items.length, active: o.id === v.id })),
    historyView: state.historyView, upFilter: state.upFilter, checklistOpen: state.checklistOpen,
    selected: S.byId[state.selectedId] || null,
    add: state.add, modal: state.modal, banner: buildBanner(v, S),
  };
}

function render() {
  const active = document.activeElement;
  let keep = null;
  if (active && appEl.contains(active) && active.matches && active.matches('[data-field],[data-mfield]') && active.type !== 'checkbox' && active.tagName !== 'SELECT') {
    const attr = active.hasAttribute('data-field') ? 'data-field' : 'data-mfield';
    keep = { attr, name: active.getAttribute(attr), s: null, e: null };
    try { keep.s = active.selectionStart; keep.e = active.selectionEnd; } catch (err) { /* input type=number */ }
  }
  const old = appEl.querySelector('#screen');
  const top = old ? old.scrollTop : 0;
  const sameTab = lastTab === state.tab;

  appEl.innerHTML = renderApp(computeViewModel());

  const screen = appEl.querySelector('#screen');
  if (screen) {
    if (sameTab) screen.scrollTop = top;
    else screen.classList.add('enter');
  }
  lastTab = state.tab;

  if (keep) {
    const el = appEl.querySelector('[' + keep.attr + '="' + keep.name + '"]');
    if (el) {
      el.focus();
      try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (err) { /* sin selección en number */ }
    }
  } else if (state.modal && state.modal.autofocus) {
    state.modal.autofocus = false;
    const first = appEl.querySelector('.sheet [data-mfield]:not([type=checkbox]):not(select)');
    if (first) { first.focus(); if (first.select) try { first.select(); } catch (err) { /* noop */ } }
  }
}

function setState(patch) { Object.assign(state, patch); render(); }

function showToast(msg, undo) {
  clearTimeout(toastTimer);
  undoFn = undo || null;
  toastEl.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button" data-toast="undo">Deshacer</button>' : '');
  toastEl.classList.add('show');
  toastTimer = setTimeout(hideToast, undo ? 7000 : 2600);
}
function hideToast() { toastEl.classList.remove('show'); undoFn = null; }
toastEl.addEventListener('click', e => {
  if (e.target.closest('[data-toast="undo"]') && undoFn) { const f = undoFn; hideToast(); f(); }
});

/* ---------- Persistencia segura ---------- */

// Aplica el cambio a una copia, la guarda y solo entonces reemplaza el estado.
async function mutate(fn) {
  const v = currentVehicle();
  if (!v) return false;
  const copy = clone(v);
  const res = fn(copy);
  if (!res) return false;
  try { await Store.putVehicle(copy); }
  catch (err) { showToast('No se pudo guardar. Revisa el espacio disponible e inténtalo de nuevo.'); return false; }
  state.vehicles[state.vehicles.findIndex(x => x.id === copy.id)] = copy;
  return res;
}

async function restoreVehicle(snapshot) {
  try { await Store.putVehicle(snapshot); } catch (err) { showToast('No se pudo deshacer.'); return; }
  const i = state.vehicles.findIndex(x => x.id === snapshot.id);
  if (i >= 0) state.vehicles[i] = snapshot; else state.vehicles.push(snapshot);
  if (!state.currentVehicleId) state.currentVehicleId = snapshot.id;
  render();
}

function confirmDialog(opts, onYes) {
  pendingConfirm = onYes;
  setState({ modal: Object.assign({ type: 'confirm' }, opts) });
}

/* ---------- Navegación ---------- */

function goTab(tab) {
  const patch = { tab, pickerOpen: false, modal: null, selectedId: null };
  if (tab === 'agregar' && state.add.step === 'done') patch.add = newAdd(currentVehicle());
  setState(patch);
}

function openDetail(id) {
  const prev = state.tab !== 'detalle' ? state.tab : state.prevTab;
  history.pushState({ view: 'detalle' }, '');
  setState({ tab: 'detalle', selectedId: id, prevTab: prev, pickerOpen: false, modal: null });
}
function leaveDetail() {
  if (history.state && history.state.view === 'detalle') history.back();
  else setState({ tab: state.prevTab || 'inicio', selectedId: null });
}
window.addEventListener('popstate', () => {
  if (state.tab === 'detalle') setState({ tab: state.prevTab || 'inicio', selectedId: null });
});

/* ---------- Vehículos ---------- */

async function selectVehicle(id) {
  await Store.setMeta('currentVehicleId', id).catch(() => {});
  setState({ currentVehicleId: id, pickerOpen: false, selectedId: null, tab: state.tab === 'detalle' ? 'inicio' : state.tab, add: newAdd(state.vehicles.find(v => v.id === id)), upFilter: 'todos' });
}

function openVehicleModal(id) {
  const v = id ? state.vehicles.find(x => x.id === id) : null;
  setState({
    pickerOpen: false,
    modal: { type: 'vehicle', vehicleId: id || null, errors: {}, autofocus: true, data: v ? { name: v.name, plate: v.plate, currentKm: v.currentKm } : { name: '', plate: '', currentKm: '', template: true } },
  });
}

async function saveVehicle() {
  const m = state.modal, d = m.data, errors = {};
  if (!String(d.name || '').trim()) errors.name = 'Escribe el nombre del vehículo.';
  const km = d.currentKm === '' ? 0 : Number(d.currentKm);
  if (!Number.isFinite(km) || km < 0 || km > 2e6) errors.currentKm = 'Ingresa un kilometraje válido.';
  if (Object.keys(errors).length) { m.errors = errors; render(); return; }

  if (m.vehicleId) {
    const target = state.vehicles.find(v => v.id === m.vehicleId);
    const copy = clone(target);
    copy.name = String(d.name).trim().slice(0, 60);
    copy.plate = String(d.plate || '').trim().slice(0, 12);
    const floor = maxServiceKm(copy);
    if (Math.round(km) < floor) { m.errors = { currentKm: 'No puede ser menor al del último servicio (' + fmtInt(floor) + ' km).' }; render(); return; }
    if (Math.round(km) !== copy.currentKm) {
      const err = setCurrentKm(copy, km, new Date());
      if (err) { m.errors = { currentKm: err }; render(); return; }
    }
    try { await Store.putVehicle(copy); } catch (err) { showToast('No se pudo guardar.'); return; }
    state.vehicles[state.vehicles.findIndex(v => v.id === copy.id)] = copy;
    setState({ modal: null });
    showToast('Vehículo actualizado');
    return;
  }
  const v = createVehicle({ name: d.name, plate: d.plate, currentKm: km }, !!d.template, new Date());
  try { await Store.putVehicle(v); await Store.setMeta('currentVehicleId', v.id); }
  catch (err) { showToast('No se pudo guardar.'); return; }
  state.vehicles.push(v);
  setState({ currentVehicleId: v.id, modal: null, tab: 'inicio', add: newAdd(v), selectedId: null, upFilter: 'todos' });
  showToast(d.template ? 'Vehículo creado con el plan típico' : 'Vehículo creado');
}

function deleteVehicle(id) {
  const v = state.vehicles.find(x => x.id === id);
  if (!v) return;
  const n = v.items.reduce((s, i) => s + i.history.length, 0);
  confirmDialog({
    title: '¿Eliminar vehículo?', danger: true, confirmLabel: 'Eliminar',
    message: '"' + v.name + '" y sus ' + n + (n === 1 ? ' servicio registrado' : ' servicios registrados') + ' se eliminarán de este dispositivo.',
  }, async () => {
    const snapshot = clone(v);
    try { await Store.deleteVehicle(id); } catch (err) { showToast('No se pudo eliminar.'); return; }
    state.vehicles = state.vehicles.filter(x => x.id !== id);
    let cur = state.currentVehicleId;
    if (cur === id) { cur = state.vehicles[0] ? state.vehicles[0].id : null; await Store.setMeta('currentVehicleId', cur).catch(() => {}); }
    setState({ vehicles: state.vehicles, currentVehicleId: cur, modal: null, pickerOpen: false, selectedId: null, tab: 'inicio' });
    showToast('Vehículo eliminado', async () => {
      await restoreVehicle(snapshot);
      await Store.setMeta('currentVehicleId', snapshot.id).catch(() => {});
      setState({ currentVehicleId: snapshot.id });
    });
  });
}

/* ---------- Kilometraje ---------- */

function editKm() {
  setState({ modal: { type: 'editKm', errors: {}, autofocus: true, data: { km: currentVehicle().currentKm } } });
}
async function saveKm() {
  const m = state.modal;
  let err = null;
  const ok = await mutate(v => { err = setCurrentKm(v, m.data.km, new Date()); return err ? null : {}; });
  if (err) { m.errors = { km: err }; render(); return; }
  if (ok) { setState({ modal: null }); showToast('Kilometraje actualizado'); }
}

/* ---------- Servicios (hoja rápida desde una pieza) ---------- */

function openServiceSheet(itemId, historyId) {
  const v = currentVehicle();
  const item = v.items.find(i => i.id === itemId);
  if (!item) return;
  const h = historyId ? item.history.find(x => x.id === historyId) : null;
  setState({
    modal: {
      type: 'service', itemId, historyId: historyId || null, errors: {}, autofocus: false,
      data: h ? { date: h.date, km: h.km, cost: h.cost } : { date: todayIso(), km: v.currentKm, cost: item.history[0] ? item.history[0].cost : '' },
    },
  });
}

async function saveServiceSheet() {
  const m = state.modal, v = currentVehicle(), now = new Date();
  const errors = validateService(m.data, v, now, { existingItem: true });
  if (Object.keys(errors).length) { m.errors = errors; render(); return; }
  const ok = await mutate(c => m.historyId
    ? updateService(c, m.itemId, m.historyId, m.data, now)
    : addService(c, { itemId: m.itemId, date: m.data.date, km: m.data.km, cost: m.data.cost }, now));
  if (ok) { setState({ modal: null }); showToast(m.historyId ? 'Servicio actualizado' : 'Servicio registrado'); }
}

function deleteServiceAction(itemId, historyId) {
  const snapshot = clone(currentVehicle());
  mutate(c => deleteService(c, itemId, historyId) ? {} : null).then(ok => {
    if (!ok) return;
    render();
    showToast('Servicio eliminado', () => restoreVehicle(snapshot));
  });
}

/* ---------- Plan de la pieza ---------- */

function editPlan(id) {
  const item = currentVehicle().items.find(i => i.id === id);
  if (!item) return;
  setState({ modal: { type: 'plan', itemId: id, errors: {}, autofocus: true, data: { piece: item.piece, category: item.category, intervalKm: item.intervalKm, intervalMonths: item.intervalMonths, note: item.note } } });
}
async function savePlan() {
  const m = state.modal, v = currentVehicle();
  const errors = validatePlan(m.data, v, m.itemId);
  if (Object.keys(errors).length) { m.errors = errors; render(); return; }
  const ok = await mutate(c => updatePlan(c, m.itemId, m.data, new Date()));
  if (ok) { setState({ modal: null }); showToast('Plan actualizado'); }
}
function deleteItem(id) {
  const item = currentVehicle().items.find(i => i.id === id);
  if (!item) return;
  confirmDialog({
    title: '¿Eliminar pieza?', danger: true, confirmLabel: 'Eliminar',
    message: '"' + item.piece + '" y sus ' + item.history.length + (item.history.length === 1 ? ' servicio registrado' : ' servicios registrados') + ' se eliminarán.',
  }, async () => {
    const snapshot = clone(currentVehicle());
    const ok = await mutate(c => { c.items = c.items.filter(i => i.id !== id); return {}; });
    if (!ok) return;
    setState({ modal: null });
    leaveDetail();
    showToast('Pieza eliminada', () => restoreVehicle(snapshot));
  });
}

/* ---------- Agregar: foto, lectura y formulario ---------- */

function compressImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * r));
      c.height = Math.max(1, Math.round(img.naturalHeight * r));
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen')); };
    img.src = url;
  });
}

let tesseractPromise = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => { tesseractPromise = null; reject(new Error('No se pudo cargar el lector (¿sin conexión?)')); };
      document.head.appendChild(s);
    });
  }
  return tesseractPromise;
}

function setScanProgress(label, frac) {
  const s = document.getElementById('ocrStatus'), b = document.getElementById('ocrBar');
  if (s && label) s.textContent = label;
  if (b) b.style.width = Math.max(4, Math.min(100, Math.round(frac * 100))) + '%';
}

async function runOcr(dataUrl, token) {
  setScanProgress('Descargando el lector…', 0.05);
  const T = await loadTesseract();
  if (token !== scanToken) throw new Error('cancelado');
  const labels = { 'loading tesseract core': 'Cargando el lector…', 'initializing tesseract': 'Preparando el lector…', 'loading language traineddata': 'Descargando idioma español…', 'initializing api': 'Preparando el lector…', 'recognizing text': 'Leyendo el texto…' };
  const worker = await T.createWorker('spa', 1, {
    logger: m => {
      if (token !== scanToken) return;
      if (m.status === 'recognizing text') setScanProgress(labels[m.status], 0.35 + 0.65 * m.progress);
      else setScanProgress(labels[m.status] || 'Preparando el lector…', 0.1 + 0.2 * (m.progress || 0));
    },
  });
  ocrWorker = worker;
  try {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Tardó demasiado')), 90000));
    const res = await Promise.race([worker.recognize(dataUrl), timeout]);
    return res.data.text || '';
  } finally {
    ocrWorker = null;
    worker.terminate().catch(() => {});
  }
}

async function onFileChosen(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const v = currentVehicle();
  if (!v) return;
  const token = ++scanToken;
  let photo;
  try { photo = await compressImage(file, 1600, 0.75); }
  catch (err) { showToast('No se pudo abrir esa imagen.'); return; }
  setState({ tab: 'agregar', add: Object.assign(newAdd(v), { step: 'scanning', photo }) });

  let parsed = null, failed = null;
  try { parsed = parseInvoiceText(await runOcr(photo, token), v, new Date()); }
  catch (err) { failed = err; }
  if (token !== scanToken) return; // cancelado por el usuario

  const f = blankForm(v);
  let found = 0;
  if (parsed) {
    if (parsed.itemId) { f.itemId = parsed.itemId; found++; }
    else if (parsed.pieceName) { f.itemId = '__new'; f.piece = parsed.pieceName; f.category = parsed.category; f.intervalKm = parsed.intervalKm; f.intervalMonths = parsed.intervalMonths; found++; }
    if (parsed.date) { f.date = parsed.date; found++; }
    if (parsed.km) { f.km = parsed.km; found++; }
    if (parsed.total != null) { f.cost = parsed.total; found++; }
  }
  const note = failed
    ? { kind: 'warn', text: 'No pude leer la factura (' + (failed.message || 'error') + '). Completa los datos a mano; la foto queda adjunta.' }
    : (found >= 2
      ? { kind: 'ok', text: 'Leí ' + found + ' dato' + (found === 1 ? '' : 's') + ' de la factura. Revísalos antes de guardar: la lectura automática puede fallar.' }
      : { kind: 'warn', text: 'Casi no pude leer texto en la foto. Completa los datos a mano; la foto queda adjunta.' });
  setState({ add: Object.assign(newAdd(v), { step: 'form', f, photo, ocrNote: note }) });
}

function cancelScan() {
  scanToken++;
  if (ocrWorker) { ocrWorker.terminate().catch(() => {}); ocrWorker = null; }
  setState({ add: newAdd(currentVehicle()) });
}

async function saveAddForm() {
  const v = currentVehicle(), a = state.add, f = a.f, now = new Date();
  const existing = f.itemId && f.itemId !== '__new' ? v.items.find(i => i.id === f.itemId) : null;
  const errors = validateService(f, v, now, { existingItem: !!existing });
  if (Object.keys(errors).length) {
    a.errors = errors;
    render();
    const first = appEl.querySelector('.has-error input, .has-error select');
    if (first) first.focus();
    return;
  }
  let doneId = null;
  const ok = await mutate(c => {
    const r = addService(c, {
      itemId: existing ? existing.id : null, piece: f.piece, category: f.category,
      intervalKm: f.intervalKm, intervalMonths: f.intervalMonths,
      date: f.date, km: f.km, cost: f.cost, photo: a.photo || undefined,
    }, now);
    doneId = r.item.id;
    return r;
  });
  if (ok) setState({ add: Object.assign({}, a, { step: 'done', doneItemId: doneId, photo: null, errors: {}, ocrNote: null }) });
}

/* ---------- Respaldo, calendario, plan típico ---------- */

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportBackup() {
  const payload = { app: 'mantenimiento-auto', version: 2, exportedAt: new Date().toISOString(), currentVehicleId: state.currentVehicleId, vehicles: state.vehicles };
  download('respaldo-mantenimiento-auto-' + todayIso() + '.json', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  setState({ modal: null });
  showToast('Respaldo exportado');
}

async function onBackupChosen(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let parsed;
  try { parsed = parseBackup(await file.text(), new Date()); }
  catch (err) { setState({ modal: null }); showToast(err.message || 'Respaldo inválido.'); return; }
  const services = parsed.vehicles.reduce((s, v) => s + v.items.reduce((t, i) => t + i.history.length, 0), 0);
  confirmDialog({
    title: '¿Reemplazar tus datos?', danger: true, confirmLabel: 'Reemplazar',
    message: 'El respaldo trae ' + parsed.vehicles.length + (parsed.vehicles.length === 1 ? ' vehículo' : ' vehículos') + ' y ' + services + (services === 1 ? ' servicio' : ' servicios') + '. Los datos actuales se reemplazan; guardamos una copia por seguridad.',
  }, async () => {
    try {
      await Store.setMeta('preImportBackup', { at: new Date().toISOString(), vehicles: state.vehicles });
      await Store.replaceAll(parsed.vehicles, parsed.currentVehicleId);
    } catch (err) { showToast('No se pudo importar el respaldo.'); return; }
    setState({ vehicles: parsed.vehicles, currentVehicleId: parsed.currentVehicleId, modal: null, tab: 'inicio', selectedId: null, add: newAdd(parsed.vehicles[0]) });
    showToast('Respaldo importado');
  });
}

function exportIcs() {
  const v = currentVehicle();
  const S = computeVehicle(v, new Date());
  const r = buildIcs(v, S, new Date());
  if (!r.count) { setState({ modal: null }); showToast('Aún no hay fechas estimadas. Registra servicios primero.'); return; }
  download('recordatorios-' + (slug(v.plate || v.name).replace(/\s+/g, '-') || 'auto') + '.ics', new Blob([r.text], { type: 'text/calendar;charset=utf-8' }));
  setState({ modal: null });
  showToast(r.count + ' recordatorios exportados');
}

async function loadTemplate() {
  let added = 0;
  const ok = await mutate(c => {
    for (const t of TEMPLATE_ITEMS) {
      if (findItemByName(c, t.piece)) continue;
      c.items.push(normalizeItem(Object.assign({ id: uid('i'), history: [] }, t), new Date()));
      added++;
    }
    return added ? {} : null;
  });
  setState({ modal: null });
  showToast(ok ? 'Se agregaron ' + added + ' piezas' : 'Ya tienes todas las piezas del plan típico');
}

/* ---------- Avisos ---------- */

async function checkAndNotify(force) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const today = todayIso();
  if (!force && (await Store.getMeta('lastNotifyDate')) === today) return;
  const urgent = [];
  for (const v of state.vehicles) {
    for (const r of computeVehicle(v, new Date()).attention) urgent.push({ vehicle: v.name, piece: r.piece, status: r.statusLabel });
  }
  await Store.setMeta('lastNotifyDate', today).catch(() => {});
  if (!urgent.length) return;
  const title = urgent.length === 1 ? '1 mantenimiento requiere atención' : urgent.length + ' mantenimientos requieren atención';
  const body = urgent.slice(0, 3).map(u => u.piece + ' (' + u.vehicle + ') — ' + u.status).join('\n');
  try {
    if (navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'mantenimiento-recordatorio' });
    } else new Notification(title, { body, icon: 'icons/icon-192.png' });
  } catch (err) { /* notificaciones no disponibles en este contexto */ }
}

async function requestNotifPermission() {
  if (typeof Notification === 'undefined') return;
  try { await Notification.requestPermission(); } catch (err) { /* noop */ }
  await checkAndNotify(true);
  render();
}

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  setState({ showInstall: false });
}

/* ---------- Acciones (delegación de eventos) ---------- */

const actions = {
  goInicio: () => goTab('inicio'),
  goHistorial: () => goTab('historial'),
  goProximos: () => goTab('proximos'),
  goAgregar: () => goTab('agregar'),
  finishAdd: () => setState({ tab: 'inicio', add: newAdd(currentVehicle()) }),
  goBack: () => leaveDetail(),
  openDetail: c => openDetail(c.id),
  toggleVehiclePicker: () => setState({ pickerOpen: !state.pickerOpen }),
  selectVehicle: c => selectVehicle(c.id),
  openAddVehicle: () => openVehicleModal(null),
  openEditVehicle: c => openVehicleModal(c.id),
  saveVehicle,
  deleteVehicle: c => deleteVehicle(c.id),
  editKm, saveKm,
  openMore: () => setState({ pickerOpen: false, modal: { type: 'more' } }),
  closeModal: () => { pendingConfirm = null; setState({ modal: null }); },
  confirmYes: () => { const f = pendingConfirm; pendingConfirm = null; if (f) f(); },
  setViewPieza: () => setState({ historyView: 'pieza' }),
  setViewFecha: () => setState({ historyView: 'fecha' }),
  setFilter: c => setState({ upFilter: c.id }),
  toggleChecklist: () => setState({ checklistOpen: !state.checklistOpen }),
  quickService: c => openServiceSheet(c.id, null),
  editService: c => openServiceSheet(c.id, c.hid),
  saveService: saveServiceSheet,
  deleteService: c => deleteServiceAction(c.id, c.hid),
  editPlan: c => editPlan(c.id),
  savePlan,
  deleteItem: c => deleteItem(c.id),
  openPhoto: c => {
    const item = currentVehicle().items.find(i => i.id === c.id);
    const h = item && item.history.find(x => x.id === c.hid);
    if (h && h.photo) setState({ modal: { type: 'photo', src: h.photo } });
  },
  startScan: () => document.getElementById('cameraInput').click(),
  chooseFromGallery: () => document.getElementById('galleryInput').click(),
  startManual: () => setState({ add: Object.assign(newAdd(currentVehicle()), { step: 'form' }) }),
  cancelScan,
  cancelForm: () => setState({ add: newAdd(currentVehicle()) }),
  resetAdd: () => setState({ add: newAdd(currentVehicle()) }),
  removePhoto: () => { state.add.photo = null; render(); },
  exportBackup,
  importBackup: () => document.getElementById('backupInput').click(),
  exportIcs, loadTemplate,
  installApp,
  dismissInstall: () => setState({ showInstall: false }),
  dismissNotif: () => setState({ notifDismissed: true }),
  requestNotifPermission,
};

appEl.addEventListener('click', e => {
  const el = e.target.closest('[data-action], [data-stop]');
  const insidePicker = e.target.closest('.picker, .vehicle-btn');
  const ctx = el && el.dataset.action ? { action: el.dataset.action, id: el.dataset.id, hid: el.dataset.hid } : null;
  if (state.pickerOpen && !insidePicker) { state.pickerOpen = false; if (!ctx || ctx.action !== 'toggleVehiclePicker') render(); }
  if (!ctx) return; // clic dentro de una hoja (data-stop) o fuera de todo
  if (actions[ctx.action]) actions[ctx.action](ctx);
});

appEl.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.field) {
    state.add.f[t.dataset.field] = t.value;
  } else if (t.dataset.mfield && state.modal && state.modal.data) {
    state.modal.data[t.dataset.mfield] = t.type === 'checkbox' ? t.checked : t.value;
  }
});

appEl.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.field === 'itemId') {
    const f = state.add.f, v = currentVehicle();
    t.blur(); // en iOS, refocalizar el selector tras re-renderizar lo vuelve a abrir
    f.itemId = t.value;
    const it = v && v.items.find(i => i.id === t.value);
    if (it && it.history[0] && (f.cost === '' || f.cost == null)) f.cost = it.history[0].cost;
    state.add.errors = {};
    render();
  } else if (t.dataset.field === 'piece') {
    // Si elige una sugerencia de la plantilla, completamos categoría e intervalos (editables).
    const f = state.add.f, tpl = TEMPLATE_ITEMS.find(x => slug(x.piece) === slug(t.value));
    if (tpl) {
      f.category = tpl.category;
      f.intervalKm = tpl.intervalKm; f.intervalMonths = tpl.intervalMonths;
      render();
    }
  } else if (t.dataset.mfield && state.modal && state.modal.data) {
    state.modal.data[t.dataset.mfield] = t.type === 'checkbox' ? t.checked : t.value;
  }
});

appEl.addEventListener('submit', e => {
  if (e.target.matches('[data-form="service"]')) { e.preventDefault(); saveAddForm(); }
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (state.modal) { pendingConfirm = null; setState({ modal: null }); }
  else if (state.pickerOpen) setState({ pickerOpen: false });
});

document.getElementById('cameraInput').addEventListener('change', onFileChosen);
document.getElementById('galleryInput').addEventListener('change', onFileChosen);
document.getElementById('backupInput').addEventListener('change', onBackupChosen);

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  setState({ showInstall: true, installKind: 'android' });
});
window.addEventListener('appinstalled', () => setState({ showInstall: false }));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.vehicles.length) { render(); checkAndNotify(false); }
});

/* ---------- Arranque ---------- */

function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }

async function init() {
  try { await Store.init(); } catch (err) { console.error(err); }
  let vehicles = [];
  try { vehicles = await Store.getAllVehicles(); } catch (err) { console.error(err); }
  let id = null;
  try { id = await Store.getMeta('currentVehicleId'); } catch (err) { /* noop */ }
  if (!vehicles.some(v => v.id === id)) id = vehicles[0] ? vehicles[0].id : null;
  Object.assign(state, { vehicles, currentVehicleId: id, storageWarn: !Store.persistent, add: newAdd(vehicles.find(v => v.id === id) || null) });
  if (isIOS() && !isStandalone()) Object.assign(state, { showInstall: true, installKind: 'ios' });
  render();
  document.documentElement.classList.add('ready');

  if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('./sw.js'); } catch (err) { /* sin SW */ } }
  await checkAndNotify(false);
}

init();
