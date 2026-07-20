const appEl = document.getElementById('app');

const state = {
  tab: 'inicio', prevTab: 'inicio', selectedId: null,
  addStep: 'start', scanIndex: 0, newRecord: null, pendingPhoto: null,
  historyView: 'pieza',
  vehicles: [], currentVehicleId: null, vehiclePickerOpen: false,
  modal: null, toast: null,
  showInstallBanner: false, installBannerKind: null, notifBannerDismissed: false,
};

let deferredInstallPrompt = null;

function currentVehicle() {
  return state.vehicles.find(v => v.id === state.currentVehicleId) || state.vehicles[0];
}

async function persistCurrentVehicle() {
  const v = currentVehicle();
  if (v) await Store.putVehicle(v);
}

function computeViewModel() {
  const vehicle = currentVehicle();
  if (!vehicle) return { tab: state.tab, vehicles: [] };
  const computed = computeRecords(vehicle);
  const byId = Object.fromEntries(computed.map(r => [r.id, r]));
  const totalSpend = vehicle.records.reduce((s, r) => s + r.cost, 0);
  const annualEstimate = computed.reduce((s, r) => s + r.annualCost, 0);
  const historyList = [...computed].sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
  const historyByDate = [];
  for (const r of historyList) {
    let g = historyByDate.find(x => x.dateFmt === r.lastDateFmt);
    if (!g) { g = { dateFmt: r.lastDateFmt, km: r.lastKmFmt, total: 0, items: [] }; historyByDate.push(g); }
    g.items.push(r); g.total += r.cost;
  }

  let banner = '';
  if (state.showInstallBanner) {
    if (state.installBannerKind === 'android') {
      banner = `<div class="top-banner">Instala la app en tu celular para acceso rápido y uso offline.
        <button type="button" data-action="installApp">Instalar</button>
        <button type="button" class="dismiss" data-action="dismissInstallBanner">✕</button></div>`;
    } else if (state.installBannerKind === 'ios') {
      banner = `<div class="top-banner">Para instalar: toca Compartir (⬆) y luego "Agregar a inicio".
        <button type="button" class="dismiss" data-action="dismissInstallBanner">✕</button></div>`;
    }
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'default' && !state.notifBannerDismissed && vehicle.records.length) {
    banner = `<div class="top-banner">Activa notificaciones para avisarte de mantenimientos próximos.
      <button type="button" data-action="requestNotifPermission">Activar</button>
      <button type="button" class="dismiss" data-action="dismissNotifBanner">✕</button></div>`;
  }

  return {
    tab: state.tab, addStep: state.addStep, historyView: state.historyView,
    vehiclePickerOpen: state.vehiclePickerOpen, modal: state.modal, toast: state.toast, banner,
    carName: vehicle.name, plate: vehicle.plate, currentKmFmt: fmtInt(vehicle.currentKm),
    vehicleOptions: state.vehicles.map(v => ({ id: v.id, name: v.name, plate: v.plate, active: v.id === vehicle.id })),
    nextItem: computed[0] || null,
    soonItems: computed.filter(r => r.status !== 'ok').slice(0, 3),
    upcomingList: computed, historyList, historyByDate,
    totalSpendFmt: fmtInt(totalSpend), totalCount: vehicle.records.length,
    annualEstimateFmt: fmtInt(annualEstimate),
    selectedRecord: byId[state.selectedId] || null,
    newRecord: state.newRecord || {}, pendingPhoto: state.pendingPhoto,
  };
}

function render() {
  const active = document.activeElement;
  let focusField = null, selStart = null, selEnd = null;
  if (active && appEl.contains(active) && active.dataset && (active.dataset.field || active.dataset.modalField)) {
    focusField = active.dataset.field ? `[data-field="${active.dataset.field}"]` : `[data-modal-field="${active.dataset.modalField}"]`;
    selStart = active.selectionStart; selEnd = active.selectionEnd;
  }

  const vm = computeViewModel();
  appEl.innerHTML = renderApp(vm);

  if (focusField) {
    const el = appEl.querySelector(focusField);
    if (el) {
      el.focus();
      if (selStart != null && el.setSelectionRange) {
        try { el.setSelectionRange(selStart, selEnd); } catch (e) {}
      }
    }
  }

  const camInput = document.getElementById('cameraInput');
  if (camInput) camInput.addEventListener('change', onCameraChange);
  const backupInput = document.getElementById('backupInput');
  if (backupInput) backupInput.addEventListener('change', onBackupChange);
}

function setState(patch) {
  Object.assign(state, patch);
  render();
}

function showToast(msg) {
  setState({ toast: msg });
  setTimeout(() => setState({ toast: null }), 2500);
}

// ===== Navigation =====
function goInicio() { setState({ tab: 'inicio', addStep: 'start', newRecord: null, pendingPhoto: null }); }
function goHistorial() { setState({ tab: 'historial', addStep: 'start', newRecord: null, pendingPhoto: null }); }
function goProximos() { setState({ tab: 'proximos', addStep: 'start', newRecord: null, pendingPhoto: null }); }
function goAgregar() { setState({ tab: 'agregar' }); }
function openDetail(id) {
  const prevTab = state.tab !== 'detalle' ? state.tab : state.prevTab;
  history.pushState({ view: 'detalle' }, '');
  setState({ tab: 'detalle', selectedId: id, prevTab });
}
function goBack() { history.back(); }
window.addEventListener('popstate', () => {
  if (state.tab === 'detalle') setState({ tab: state.prevTab || 'inicio' });
});

// ===== Vehicle picker / editing =====
function toggleVehiclePicker() { setState({ vehiclePickerOpen: !state.vehiclePickerOpen }); }
function selectVehicle(id) { setState({ currentVehicleId: id, vehiclePickerOpen: false, selectedId: null, tab: state.tab === 'detalle' ? (state.prevTab || 'inicio') : state.tab }); }
function openAddVehicle() { setState({ vehiclePickerOpen: false, modal: { type: 'addVehicle', data: { name: '', plate: '', currentKm: 0 } } }); }
function editKm() { setState({ modal: { type: 'editKm', km: currentVehicle().currentKm } }); }
function closeModal() { setState({ modal: null }); }

async function saveKm() {
  const input = document.getElementById('modalKmInput');
  const km = Math.max(0, Math.round(+input.value || 0));
  const v = currentVehicle();
  v.currentKm = km;
  await persistCurrentVehicle();
  setState({ modal: null });
}

async function saveVehicle() {
  const data = state.modal.data;
  if (!data.name || !data.name.trim()) return;
  const id = 'v' + Date.now();
  const vehicle = { id, name: data.name.trim(), plate: (data.plate || '').trim(), currentKm: Math.max(0, Math.round(+data.currentKm || 0)), records: [] };
  state.vehicles.push(vehicle);
  await Store.putVehicle(vehicle);
  await Store.setMeta('currentVehicleId', id);
  setState({ currentVehicleId: id, modal: null });
}

async function deleteVehicle(id) {
  if (state.vehicles.length <= 1) {
    alert('Debe quedar al menos un vehículo. Agrega otro antes de eliminar este.');
    return;
  }
  const vehicle = state.vehicles.find(v => v.id === id);
  if (!confirm(`¿Eliminar "${vehicle.name}" y todo su historial de mantenimientos? Esta acción no se puede deshacer.`)) return;
  await Store.deleteVehicle(id);
  state.vehicles = state.vehicles.filter(v => v.id !== id);
  let currentVehicleId = state.currentVehicleId;
  if (currentVehicleId === id) {
    currentVehicleId = state.vehicles[0].id;
    await Store.setMeta('currentVehicleId', currentVehicleId);
  }
  setState({ vehicles: state.vehicles, currentVehicleId, selectedId: null, tab: state.tab === 'detalle' ? 'inicio' : state.tab });
  showToast('Vehículo eliminado');
}

// ===== Respaldo (exportar / importar un archivo local, sin servidor) =====
function exportBackup() {
  const payload = {
    app: 'mantenimiento-auto', version: 1,
    exportedAt: new Date().toISOString(),
    currentVehicleId: state.currentVehicleId,
    vehicles: state.vehicles,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo-mantenimiento-auto-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setState({ vehiclePickerOpen: false });
  showToast('Respaldo exportado');
}

function importBackup() {
  const input = document.getElementById('backupInput');
  if (input) input.click();
}

async function onBackupChange(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    alert('Ese archivo no es un respaldo válido (JSON inválido).');
    return;
  }
  if (!data || !Array.isArray(data.vehicles) || !data.vehicles.length) {
    alert('Ese archivo no tiene el formato de respaldo esperado.');
    return;
  }
  const ok = confirm('Esto va a REEMPLAZAR todos los datos actuales de la app con los del archivo de respaldo. ¿Continuar?');
  if (!ok) return;
  await Store.clearVehicles();
  for (const v of data.vehicles) await Store.putVehicle(v);
  const currentVehicleId = data.currentVehicleId || data.vehicles[0].id;
  await Store.setMeta('currentVehicleId', currentVehicleId);
  setState({ vehicles: data.vehicles, currentVehicleId, vehiclePickerOpen: false, tab: 'inicio', selectedId: null });
  showToast('Respaldo importado');
}

// ===== Historial toggle =====
function setViewPieza() { setState({ historyView: 'pieza' }); }
function setViewFecha() { setState({ historyView: 'fecha' }); }

// ===== Agregar flow =====
function startScan() {
  const camInput = document.getElementById('cameraInput');
  if (camInput) { camInput.click(); return; }
  setState({ addStep: 'start' });
}

function onCameraChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    setState({ addStep: 'scanning', pendingPhoto: reader.result });
    setTimeout(() => {
      const pick = MOCK_SCANS[state.scanIndex % MOCK_SCANS.length];
      const vehicle = currentVehicle();
      state.scanIndex++;
      setState({ addStep: 'review', newRecord: { ...pick, km: vehicle.currentKm } });
    }, 1400);
  };
  reader.readAsDataURL(file);
}

function startManual() {
  const vehicle = currentVehicle();
  setState({ addStep: 'manual', pendingPhoto: null, newRecord: { piece: '', category: 'Motor', km: vehicle.currentKm, cost: 0, intervalKm: 5000, intervalMonths: 6, note: '' } });
}
function resetAdd() { setState({ addStep: 'start', newRecord: null, pendingPhoto: null }); }

async function saveRecord() {
  const nr = state.newRecord;
  if (!nr || !nr.piece || !nr.piece.trim()) return;
  const vehicle = currentVehicle();
  const record = {
    id: 'm' + Date.now(),
    piece: nr.piece.trim(), category: nr.category || 'Motor',
    lastDate: todayIso(), lastKm: Math.max(0, Math.round(+nr.km || 0)),
    intervalKm: Math.max(0, Math.round(+nr.intervalKm || 0)),
    intervalMonths: Math.max(0, Math.round(+nr.intervalMonths || 0)),
    cost: Math.max(0, +nr.cost || 0),
    note: nr.note || '',
  };
  if (state.pendingPhoto) record.photo = state.pendingPhoto;
  if (record.lastKm > vehicle.currentKm) vehicle.currentKm = record.lastKm;
  vehicle.records.push(record);
  await persistCurrentVehicle();
  setState({ addStep: 'done', newRecord: null, pendingPhoto: null });
}

function goToHistorialFromDone() { setState({ tab: 'historial', addStep: 'start', newRecord: null }); }

async function deleteRecord(id) {
  if (!confirm('¿Eliminar este mantenimiento del historial?')) return;
  const vehicle = currentVehicle();
  vehicle.records = vehicle.records.filter(r => r.id !== id);
  await persistCurrentVehicle();
  setState({ tab: state.prevTab || 'historial', selectedId: null });
}

// ===== Install banner =====
function dismissInstallBanner() { setState({ showInstallBanner: false }); }
async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  setState({ showInstallBanner: false });
}
function dismissNotifBanner() { setState({ notifBannerDismissed: true }); }
async function requestNotifPermission() {
  if (typeof Notification === 'undefined') return;
  await Notification.requestPermission();
  await checkAndNotify(true);
  render();
}

// ===== Action dispatch table =====
const actions = {
  goInicio, goHistorial, goProximos, goAgregar, goBack, toggleVehiclePicker,
  openAddVehicle, editKm, closeModal, saveKm, saveVehicle, setViewPieza, setViewFecha,
  startScan, startManual, resetAdd, saveRecord, goToHistorialFromDone,
  dismissInstallBanner, installApp, dismissNotifBanner, requestNotifPermission,
  exportBackup, importBackup,
};

appEl.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-stop]');
  if (!el || !appEl.contains(el)) return;
  if (!el.dataset.action) return; // clic dentro de una zona "data-stop" (ej. tarjeta del modal): no hacer nada
  const action = el.dataset.action;
  const id = el.dataset.id;
  if (action === 'openDetail') return openDetail(id);
  if (action === 'selectVehicle') return selectVehicle(id);
  if (action === 'deleteRecord') return deleteRecord(id);
  if (action === 'deleteVehicle') return deleteVehicle(id);
  if (actions[action]) return actions[action]();
});

appEl.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.field) {
    const field = t.dataset.field;
    const numeric = ['km', 'cost', 'intervalKm', 'intervalMonths'].includes(field);
    const val = numeric ? (t.value === '' ? '' : +t.value) : t.value;
    state.newRecord = { ...state.newRecord, [field]: val };
  } else if (t.dataset && t.dataset.modalField) {
    const field = t.dataset.modalField;
    state.modal = { ...state.modal, data: { ...state.modal.data, [field]: t.value } };
  }
});

appEl.addEventListener('change', (e) => {
  const t = e.target;
  if (t.tagName === 'SELECT' && t.dataset && t.dataset.field === 'category') {
    state.newRecord = { ...state.newRecord, category: t.value };
    render();
  }
});

// ===== Notifications (local, foreground-only — ver README para push real) =====
async function checkAndNotify(force) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const lastCheck = await Store.getMeta('lastNotifyDate');
  const today = todayIso();
  if (!force && lastCheck === today) return;
  await Store.setMeta('lastNotifyDate', today);
  const urgent = [];
  for (const v of state.vehicles) {
    for (const r of computeRecords(v)) {
      if (r.status === 'vencido' || r.status === 'pronto') urgent.push({ vehicle: v.name, piece: r.piece, status: r.statusLabel });
    }
  }
  if (!urgent.length) return;
  const title = urgent.length === 1 ? '1 mantenimiento requiere atención' : `${urgent.length} mantenimientos requieren atención`;
  const body = urgent.slice(0, 3).map(u => `${u.piece} (${u.vehicle}) — ${u.status}`).join('\n');
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, { body, icon: 'icons/icon.svg', tag: 'mantenimiento-recordatorio' });
    } else {
      new Notification(title, { body, icon: 'icons/icon.svg' });
    }
  } catch (err) { /* notificaciones no disponibles en este contexto */ }
}

// ===== Install prompt wiring =====
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  setState({ showInstallBanner: true, installBannerKind: 'android' });
});
window.addEventListener('appinstalled', () => setState({ showInstallBanner: false }));

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// ===== Init =====
async function init() {
  await Store.init();
  const vehicles = await Store.getAllVehicles();
  const currentVehicleId = (await Store.getMeta('currentVehicleId')) || (vehicles[0] && vehicles[0].id);
  Object.assign(state, { vehicles, currentVehicleId });
  render();

  if (isIOS() && !isStandalone()) {
    setState({ showInstallBanner: true, installBannerKind: 'ios' });
  }

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch (e) {}
  }
  await checkAndNotify(false);
}

init();
