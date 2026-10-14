'use strict';
/* Vistas: funciones puras que devuelven HTML. Todo texto dinámico pasa por esc(). */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Íconos (trazo, 24 px) ---------- */
const ICON_PATHS = {
  home: '<path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.5 9.8V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.8"/><path d="M10 20v-5h4v5"/>',
  history: '<path d="M3.6 12a8.4 8.4 0 1 0 2.5-6"/><path d="M3.6 4.6V9H8"/><path d="M12 7.6V12l3 1.8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  car: '<path d="M5 12.5 6.6 8.4A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.4l1.6 4.1"/><rect x="3" y="12.5" width="18" height="5.5" rx="2"/><path d="M7 15.2h.01M17 15.2h.01M6.5 18v1.6M17.5 18v1.6"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5l-8.2 8.2a2.1 2.1 0 0 1-3-3l8.2-8.2z" transform="translate(-1 -1)"/><path d="M15 9l-1.5-1.5"/>',
  droplet: '<path d="M12 3.5s6 6.2 6 10.3a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5z"/>',
  disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2"/>',
  battery: '<rect x="3" y="7.5" width="16" height="9.5" rx="2.2"/><path d="M21.5 11v2.5M7 12.2h3M8.5 10.7v3"/>',
  tire: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="m5.9 5.9 4.5 4.5M13.6 13.6l4.5 4.5M18.1 5.9l-4.5 4.5M10.4 13.6l-4.5 4.5"/>',
  engine: '<path d="M7 8h7.5l2 2H19.5v5H16.5l-2 2H7z"/><path d="M4 11v4M10 8V6M13 8V6"/>',
  bolt: '<path d="M13 3.5 6 13.5h5l-1 7 7-10h-5z"/>',
  filter: '<rect x="4" y="6" width="16" height="12" rx="2.2"/><path d="M8 6v12M12 6v12M16 6v12"/>',
  belt: '<circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M7 9h10M7 15h10"/>',
  thermo: '<path d="M10 14.5V6a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z"/>',
  chevR: '<path d="m9.5 6 6 6-6 6"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>',
  chevD: '<path d="m6 9.5 6 6 6-6"/>',
  camera: '<path d="M4 8.5a2 2 0 0 1 2-2h1.6l1.2-1.6h6.4l1.2 1.6H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.8" r="3.3"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3L15 13l5 4.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4 3.3 19h17.4z"/><path d="M12 10v4M12 16.8h.01"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.8 12.2h9.4L17.5 7M10 11v5M14 11v5"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 7.5 3 3"/>',
  download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  gauge: '<path d="M4.5 17.5a8.5 8.5 0 1 1 15 0"/><path d="m12 13.5 4-4"/><circle cx="12" cy="13.5" r="1"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.4c-.5-.8-1.5-1.2-2.6-1.2-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.3 5 3.9 0 1.1-1.1 1.9-2.5 1.9-1.2 0-2.2-.5-2.7-1.4M12 6.5v1.7M12 15.9v1.6"/>',
  list: '<path d="M8.5 7h11M8.5 12h11M8.5 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />',
  receipt: '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9 8.5h6M9 12h6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
};

function icon(name, size, cls) {
  const p = ICON_PATHS[name] || ICON_PATHS.wrench;
  const s = size || 22;
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + p + '</svg>';
}

function pieceIcon(r) {
  const s = slug(r.piece);
  if (/aceite|lubric/.test(s)) return 'droplet';
  if (/filtro/.test(s)) return 'filter';
  if (/bujia/.test(s)) return 'bolt';
  if (/correa|distribucion/.test(s)) return 'belt';
  if (/pastilla|freno|disco/.test(s)) return 'disc';
  if (/bateria/.test(s)) return 'battery';
  if (/llanta|neumatic|alineacion|balanceo/.test(s)) return 'tire';
  if (/refrigerante|anticongelante/.test(s)) return 'thermo';
  return { 'Motor': 'engine', 'Frenos': 'disc', 'Eléctrico': 'bolt', 'Suspensión': 'tire' }[r.category] || 'wrench';
}

/* ---------- Piezas reutilizables ---------- */

function badge(r) { return '<span class="badge tone-' + r.tone + '">' + esc(r.statusLabel) + '</span>'; }

function bar(r, extra) {
  if (r.progress < 0) return '';
  return '<span class="bar tone-' + r.tone + (extra ? ' ' + extra : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + r.pct + '" aria-label="Vida útil consumida"><i style="width:' + r.pct + '%"></i></span>';
}

function itemRow(r) {
  return '<button type="button" class="row" data-action="openDetail" data-id="' + esc(r.id) + '">' +
    '<span class="tile tone-' + r.tone + '">' + icon(pieceIcon(r), 20) + '</span>' +
    '<span class="row-main">' +
      '<span class="row-top"><span class="row-title">' + esc(r.piece) + '</span>' + badge(r) + '</span>' +
      '<span class="row-sub">' + esc(r.dueLabel) + '</span>' +
      bar(r) +
    '</span>' + icon('chevR', 18, 'row-chev') +
  '</button>';
}

function ring(pct) {
  const R = 26, C = 2 * Math.PI * R;
  const tone = pct >= 80 ? 'ok' : (pct >= 50 ? 'soon' : 'late');
  return '<svg class="ring tone-' + tone + '" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="' + pct + '% de las piezas al día">' +
    '<circle class="ring-bg" cx="32" cy="32" r="' + R + '"/>' +
    '<circle class="ring-fg" cx="32" cy="32" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - pct / 100)).toFixed(1) + '" transform="rotate(-90 32 32)"/>' +
    '<text x="32" y="36.5" text-anchor="middle" class="ring-text">' + pct + '%</text></svg>';
}

function monthLabel(b) { return new Date(b.year, b.month, 1).toLocaleDateString('es-EC', { month: 'short' }).replace('.', '').slice(0, 3); }

function sparkBars(monthly) {
  const max = Math.max.apply(null, monthly.map(m => m.total).concat([1]));
  const bars = monthly.map((m, i) => {
    const h = m.total > 0 ? Math.max(4, m.total / max * 34) : 2;
    return '<rect class="' + (m.total > 0 ? 'sp-on' : 'sp-off') + (i === monthly.length - 1 ? ' sp-now' : '') + '" x="' + (i * 9.5) + '" y="' + (36 - h) + '" width="7" height="' + h.toFixed(1) + '" rx="2"/>';
  }).join('');
  return '<svg class="spark" viewBox="0 0 112 36" width="112" height="36" role="img" aria-label="Gasto de los últimos 12 meses">' + bars + '</svg>';
}

function barChart(monthly) {
  const max = Math.max.apply(null, monthly.map(m => m.total).concat([1]));
  const W = 300, H = 112, base = 92, step = W / monthly.length;
  const top = monthly.reduce((a, b) => (b.total > a.total ? b : a), monthly[0]);
  const cols = monthly.map((m, i) => {
    const h = m.total > 0 ? Math.max(5, m.total / max * 74) : 2;
    const x = i * step + 5;
    return '<g><title>' + esc(monthLabel(m) + ' ' + m.year + ': ' + fmtMoney(m.total)) + '</title>' +
      '<rect class="' + (m.total > 0 ? 'bc-on' : 'bc-off') + (i === monthly.length - 1 ? ' bc-now' : '') + '" x="' + x.toFixed(1) + '" y="' + (base - h).toFixed(1) + '" width="' + (step - 10).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4"/>' +
      '<text class="bc-label" x="' + (x + (step - 10) / 2).toFixed(1) + '" y="108" text-anchor="middle">' + esc(monthLabel(m)) + '</text></g>';
  }).join('');
  const aria = top.total > 0 ? 'Gasto mensual de los últimos 12 meses; el mayor fue ' + monthLabel(top) + ' con ' + fmtMoney(top.total) : 'Sin gastos en los últimos 12 meses';
  return '<svg class="barchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(aria) + '"><line class="bc-axis" x1="0" y1="' + base + '" x2="' + W + '" y2="' + base + '"/>' + cols + '</svg>';
}

function emptyState(ic, title, text, action, label) {
  return '<div class="empty"><span class="empty-ic">' + icon(ic, 28) + '</span><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
    (action ? '<button type="button" class="btn btn-primary" data-action="' + action + '">' + esc(label) + '</button>' : '') + '</div>';
}

/* ---------- Campos de formulario ---------- */

function field(label, name, value, attrs, error, scope, hint) {
  const a = scope === 'm' ? 'data-mfield' : 'data-field';
  return '<label class="field' + (error ? ' has-error' : '') + '"><span class="field-label">' + esc(label) + '</span>' +
    '<input class="input" ' + a + '="' + name + '" value="' + esc(value) + '" ' + (attrs || '') + (error ? ' aria-invalid="true"' : '') + '>' +
    (hint ? '<span class="field-hint">' + esc(hint) + '</span>' : '') +
    (error ? '<span class="field-error" role="alert">' + esc(error) + '</span>' : '') + '</label>';
}

function selectField(label, name, options, value, error, scope) {
  const a = scope === 'm' ? 'data-mfield' : 'data-field';
  return '<label class="field' + (error ? ' has-error' : '') + '"><span class="field-label">' + esc(label) + '</span>' +
    '<span class="select-wrap"><select class="input" ' + a + '="' + name + '">' +
    options.map(o => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
    '</select>' + icon('chevD', 18, 'select-chev') + '</span>' +
    (error ? '<span class="field-error" role="alert">' + esc(error) + '</span>' : '') + '</label>';
}

/* ---------- Cabecera, selector de vehículo ---------- */

function renderHeader(vm) {
  const v = vm.vehicle;
  const picker = vm.pickerOpen ? '<div class="picker" role="menu">' +
    vm.vehicleOptions.map(o =>
      '<div class="picker-row' + (o.active ? ' active' : '') + '">' +
        '<button type="button" class="picker-main" role="menuitem" data-action="selectVehicle" data-id="' + esc(o.id) + '">' +
          '<span class="avatar sm">' + icon('car', 18) + '</span>' +
          '<span class="picker-text"><span class="picker-name">' + esc(o.name) + '</span><span class="picker-sub">' + esc(o.plate || 'Sin placa') + ' · ' + o.items + ' piezas</span></span>' +
          (o.active ? icon('check', 18, 'picker-check') : '') +
        '</button>' +
        '<button type="button" class="icon-btn sm" data-action="openEditVehicle" data-id="' + esc(o.id) + '" aria-label="Editar ' + esc(o.name) + '">' + icon('edit', 17) + '</button>' +
        '<button type="button" class="icon-btn sm danger" data-action="deleteVehicle" data-id="' + esc(o.id) + '" aria-label="Eliminar ' + esc(o.name) + '">' + icon('trash', 17) + '</button>' +
      '</div>').join('') +
    '<button type="button" class="picker-add" role="menuitem" data-action="openAddVehicle">' + icon('plus', 18) + ' Agregar vehículo</button></div>' : '';
  return '<header class="topbar">' +
    '<button type="button" class="vehicle-btn" data-action="toggleVehiclePicker" aria-haspopup="menu" aria-expanded="' + (vm.pickerOpen ? 'true' : 'false') + '">' +
      '<span class="avatar">' + icon('car', 22) + '</span>' +
      '<span class="vehicle-text"><span class="vehicle-name">' + esc(v.name) + '</span><span class="vehicle-plate">' + esc(v.plate || 'Sin placa') + '</span></span>' +
      icon('chevD', 18, 'vehicle-chev') +
    '</button>' +
    '<button type="button" class="icon-btn" data-action="openMore" aria-label="Más opciones">' + icon('more', 22) + '</button>' +
    picker +
  '</header>' +
  '<button type="button" class="km-pill" data-action="editKm">' + icon('gauge', 18) + '<b>' + fmtInt(v.currentKm) + ' km</b><span>Actualizar</span></button>';
}

/* ---------- Pantallas ---------- */

function heroArcs() {
  return '<svg class="hero-deco" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.2">' +
    '<circle cx="150" cy="50" r="38"/><circle cx="150" cy="50" r="62"/><circle cx="150" cy="50" r="88"/><circle cx="150" cy="50" r="116"/></g></svg>';
}

function renderHero(vm) {
  const S = vm.S, n = S.next;
  if (n) {
    const est = n.estDueDate && n.status !== 'vencido' ? '≈ ' + fmtDate(n.estDueDate) : (n.status === 'vencido' ? 'Programa el servicio pronto' : '');
    return '<section class="hero tone-' + n.tone + '" aria-label="Próximo mantenimiento">' + heroArcs() +
      '<div class="hero-top"><span class="eyebrow">Lo siguiente en tu lista</span><span class="badge on-dark">' + esc(n.statusLabel) + '</span></div>' +
      '<h2 class="hero-title">' + esc(n.piece) + '</h2>' +
      '<p class="hero-due">' + esc(n.dueLabel) + '</p>' +
      '<span class="bar hero-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + n.pct + '" aria-label="Vida útil consumida"><i style="width:' + n.pct + '%"></i></span>' +
      '<div class="hero-meta"><span>' + n.pct + '% de su vida útil</span><span>' + esc(est) + '</span></div>' +
      '<div class="hero-actions">' +
        '<button type="button" class="btn btn-accent" data-action="quickService" data-id="' + esc(n.id) + '">' + icon('plus', 18) + ' Registrar servicio</button>' +
        '<button type="button" class="btn btn-glass" data-action="openDetail" data-id="' + esc(n.id) + '">Detalle</button>' +
      '</div></section>';
  }
  const pend = S.count.pendiente;
  return '<section class="hero tone-idle" aria-label="Primeros pasos">' + heroArcs() +
    '<div class="hero-top"><span class="eyebrow">Primeros pasos</span></div>' +
    '<h2 class="hero-title">' + (pend ? 'Registra el último servicio de cada pieza' : 'Agrega tu primer mantenimiento') + '</h2>' +
    '<p class="hero-due">' + (pend ? 'Con una fecha y un kilometraje por pieza, calculamos cuándo toca el siguiente.' : 'Escanea una factura o registra un servicio y empezamos a calcular tus vencimientos.') + '</p>' +
    '<div class="hero-actions"><button type="button" class="btn btn-accent" data-action="' + (pend ? 'goProximos' : 'goAgregar') + '">' + icon(pend ? 'list' : 'plus', 18) + ' ' + (pend ? 'Ver piezas' : 'Registrar servicio') + '</button></div></section>';
}

function renderInicio(vm) {
  const S = vm.S, v = vm.vehicle;
  const usage = S.kmPerYear
    ? 'con ~' + fmtInt(Math.round(S.kmPerYear / 100) * 100) + ' km/año'
    : 'por tiempo (faltan datos de km)';
  const health = S.healthPct == null
    ? '<span class="stat-ic tone-idle">' + icon('shield', 26) + '</span>'
    : ring(S.healthPct);
  const attention = S.attention.slice(0, 4);
  const checklist = /chevrolet|chevy|aveo|spark|sail|onix|cruze|tracker/i.test(v.name)
    ? 'Según la matriz de mantenimiento preventivo de Chevrolet Ecuador.'
    : 'Lista de referencia general; confirma los intervalos en el manual de tu vehículo.';
  return renderHeader(vm) + renderHero(vm) +
  '<div class="stat-grid">' +
    '<div class="card stat"><div class="stat-body">' + health + '<div><div class="stat-label">Estado general</div>' +
      '<div class="stat-value sm">' + (S.tracked ? S.count.ok + ' de ' + S.tracked : '—') + '</div><div class="stat-sub">piezas al día</div></div></div></div>' +
    '<div class="card stat"><div class="stat-label">Gasto anual estimado</div><div class="stat-value">' + fmtMoney(S.annualEstimate) + '</div>' +
      '<div class="stat-sub">' + esc(usage) + '</div></div>' +
    '<div class="card stat wide"><div class="stat-split"><div><div class="stat-label">Invertido en total</div><div class="stat-value">' + fmtMoney(S.totalSpend) + '</div>' +
      '<div class="stat-sub">' + S.serviceCount + (S.serviceCount === 1 ? ' servicio' : ' servicios') + ' registrados</div></div>' + sparkBars(S.monthly) + '</div></div>' +
  '</div>' +
  (S.count.pendiente && S.next ? '<button type="button" class="notice" data-action="goProximos"><span class="notice-ic">' + icon('info', 20) + '</span><span><b>' + S.count.pendiente + (S.count.pendiente === 1 ? ' pieza sin servicio registrado' : ' piezas sin servicio registrado') + '</b><small>Regístralos para activar los avisos.</small></span>' + icon('chevR', 18) + '</button>' : '') +
  '<div class="section-head"><h3>Requieren atención</h3>' + (S.attention.length > 4 ? '<button type="button" class="link" data-action="goProximos">Ver todo</button>' : '') + '</div>' +
  '<div class="list">' + (attention.length ? attention.map(itemRow).join('') :
    '<div class="all-good">' + icon('shield', 22) + '<span>' + (S.tracked ? 'Todo al día. Nada urgente por ahora.' : 'Aquí verás lo que vaya venciendo.') + '</span></div>') + '</div>' +
  '<section class="card checklist">' +
    '<button type="button" class="checklist-head" data-action="toggleChecklist" aria-expanded="' + (vm.checklistOpen ? 'true' : 'false') + '">' +
      '<span class="tile tone-ok">' + icon('check', 20) + '</span>' +
      '<span class="checklist-ttl"><b>Revisión de rutina</b><small>Cada 5.000 km o 6 meses</small></span>' +
      icon('chevD', 18, 'checklist-chev' + (vm.checklistOpen ? ' open' : '')) +
    '</button>' +
    (vm.checklistOpen ? '<ul class="checklist-list">' + ROUTINE_CHECKLIST.map(c => '<li>' + icon('check', 16) + '<span>' + esc(c) + '</span></li>').join('') + '</ul><p class="checklist-foot">' + esc(checklist) + '</p>' : '') +
  '</section>';
}

function renderHistorial(vm) {
  const S = vm.S, v = vm.vehicle;
  const hasAny = S.serviceCount > 0;
  let body;
  if (!hasAny) {
    body = emptyState('receipt', 'Aún no hay servicios', 'Cuando registres un mantenimiento aparecerá aquí con su costo y kilometraje.', 'goAgregar', 'Registrar servicio');
  } else if (vm.historyView === 'pieza') {
    const withH = S.items.filter(i => i.last).sort((a, b) => b.last.date.localeCompare(a.last.date));
    const without = S.items.filter(i => !i.last);
    body = '<div class="list">' + withH.map(r =>
      '<button type="button" class="row" data-action="openDetail" data-id="' + esc(r.id) + '">' +
        '<span class="tile tone-' + r.tone + '">' + icon(pieceIcon(r), 20) + '</span>' +
        '<span class="row-main"><span class="row-title">' + esc(r.piece) + '</span>' +
        '<span class="row-sub">' + esc(fmtDateIso(r.last.date)) + ' · ' + fmtInt(r.last.km) + ' km' + (r.history.length > 1 ? ' · ' + r.history.length + ' servicios' : '') + '</span></span>' +
        '<span class="row-cost">' + fmtMoney(r.last.cost) + '</span></button>').join('') + '</div>' +
      (without.length ? '<div class="section-head"><h3>Sin servicios registrados</h3></div><div class="list">' + without.map(r =>
        '<button type="button" class="row muted" data-action="openDetail" data-id="' + esc(r.id) + '"><span class="tile tone-idle">' + icon(pieceIcon(r), 20) + '</span>' +
        '<span class="row-main"><span class="row-title">' + esc(r.piece) + '</span><span class="row-sub">' + esc(r.lifespanLabel) + '</span></span>' + icon('chevR', 18, 'row-chev') + '</button>').join('') + '</div>' : '');
  } else {
    const groups = [];
    for (const e of historyEntries(v)) {
      let g = groups[groups.length - 1];
      if (!g || g.date !== e.h.date) { g = { date: e.h.date, km: e.h.km, total: 0, rows: [] }; groups.push(g); }
      g.rows.push(e); g.total += e.h.cost; g.km = Math.max(g.km, e.h.km);
    }
    body = groups.map(g =>
      '<div class="group"><div class="group-head"><span class="group-date">' + esc(fmtDateIso(g.date)) + '</span><span class="group-meta">' + fmtInt(g.km) + ' km · ' + fmtMoney(g.total) + '</span></div><div class="list">' +
      g.rows.map(e => {
        const r = S.byId[e.item.id];
        return '<button type="button" class="row" data-action="openDetail" data-id="' + esc(e.item.id) + '"><span class="tile tone-' + r.tone + '">' + icon(pieceIcon(r), 20) + '</span>' +
          '<span class="row-main"><span class="row-title">' + esc(e.item.piece) + '</span></span><span class="row-cost">' + fmtMoney(e.h.cost) + '</span></button>';
      }).join('') + '</div></div>').join('');
  }
  return '<h1 class="screen-title">Historial</h1>' +
    (hasAny ? '<section class="card chart-card"><div class="chart-head"><div><div class="stat-label">Invertido en total</div><div class="stat-value">' + fmtMoney(S.totalSpend) + '</div></div><span class="chip">12 meses</span></div>' + barChart(S.monthly) + '</section>' : '') +
    (hasAny ? '<div class="segmented" role="tablist"><button type="button" role="tab" aria-selected="' + (vm.historyView === 'pieza') + '" data-action="setViewPieza" class="' + (vm.historyView === 'pieza' ? 'active' : '') + '">Por pieza</button>' +
      '<button type="button" role="tab" aria-selected="' + (vm.historyView === 'fecha') + '" data-action="setViewFecha" class="' + (vm.historyView === 'fecha' ? 'active' : '') + '">Por fecha</button></div>' : '') +
    body;
}

function renderProximos(vm) {
  const S = vm.S;
  const filters = [
    { k: 'todos', label: 'Todos', n: S.items.length },
    { k: 'vencido', label: 'Vencidos', n: S.count.vencido },
    { k: 'pronto', label: 'Pronto', n: S.count.pronto },
    { k: 'ok', label: 'Al día', n: S.count.ok },
    { k: 'pendiente', label: 'Sin registro', n: S.count.pendiente + S.count.sinplan },
  ].filter(f => f.k === 'todos' || f.n > 0);
  const f = filters.some(x => x.k === vm.upFilter) ? vm.upFilter : 'todos';
  const list = S.items.filter(i => f === 'todos' || i.status === f || (f === 'pendiente' && i.status === 'sinplan'));
  return '<h1 class="screen-title">Próximos</h1>' +
    (S.items.length ? '<div class="chips" role="tablist">' + filters.map(x =>
      '<button type="button" role="tab" aria-selected="' + (x.k === f) + '" class="chip-btn' + (x.k === f ? ' active' : '') + '" data-action="setFilter" data-id="' + x.k + '">' + x.label + ' <span>' + x.n + '</span></button>').join('') + '</div>' : '') +
    (list.length ? '<div class="list">' + list.map(itemRow).join('') + '</div>' +
      '<p class="footnote">' + (S.kmPerYear ? 'Fechas estimadas con tu uso actual: ~' + fmtInt(Math.round(S.kmPerYear / 100) * 100) + ' km/año.' : 'Con más actualizaciones de kilometraje podremos estimar fechas por tu uso real.') + '</p>'
      : emptyState('calendar', S.items.length ? 'Nada en esta categoría' : 'Aún no hay piezas', S.items.length ? 'Prueba con otro filtro.' : 'Registra un servicio o carga el plan típico desde el menú ⋯.', S.items.length ? '' : 'goAgregar', 'Registrar servicio'));
}

function renderDetalle(vm) {
  const r = vm.selected;
  if (!r) return '<div class="detail-head"><button type="button" class="icon-btn" data-action="goBack" aria-label="Volver">' + icon('chevL', 22) + '</button></div>' + emptyState('alert', 'Pieza no encontrada', 'Puede que se haya eliminado.', 'goInicio', 'Ir al inicio');
  const total = r.history.reduce((s, h) => s + h.cost, 0);
  let progress;
  if (r.status === 'pendiente' || r.status === 'sinplan') {
    progress = '<section class="card prog tone-idle"><p class="prog-msg">' + esc(r.dueLabel) + '</p>' +
      (r.status === 'pendiente' ? '<button type="button" class="btn btn-primary" data-action="quickService" data-id="' + esc(r.id) + '">' + icon('plus', 18) + ' Registrar servicio</button>' : '<button type="button" class="btn btn-primary" data-action="editPlan" data-id="' + esc(r.id) + '">Definir intervalo</button>') + '</section>';
  } else {
    const kmBlock = r.hasKm ? '<div class="metric' + (r.limiting === 'km' ? ' lim' : '') + '"><span class="metric-label">Kilometraje límite</span><span class="metric-value">' + fmtInt(r.nextDueKm) + ' km</span>' +
      '<span class="metric-sub">' + (r.kmRemaining > 0 ? 'faltan ' + fmtInt(r.kmRemaining) + ' km' : (r.kmRemaining === 0 ? 'llegaste al límite' : 'pasado por ' + fmtInt(-r.kmRemaining) + ' km')) + '</span></div>' : '';
    const dateBlock = r.hasTime ? '<div class="metric' + (r.limiting === 'tiempo' ? ' lim' : '') + '"><span class="metric-label">Fecha límite</span><span class="metric-value">' + esc(fmtDate(r.nextDueDate)) + '</span>' +
      '<span class="metric-sub">' + (r.daysRemaining > 0 ? 'en ' + fmtSpan(r.daysRemaining) : (r.daysRemaining === 0 ? 'es hoy' : 'hace ' + fmtSpan(r.daysRemaining))) + '</span></div>' : '';
    const est = r.hasKm && r.estDueDate && vm.S.kmPerYear && r.status !== 'vencido'
      ? '<p class="prog-est">' + icon('calendar', 16) + 'Con tu uso actual, tocaría hacia el <b>' + esc(fmtDate(r.estDueDate)) + '</b>.</p>' : '';
    progress = '<section class="card prog tone-' + r.tone + '"><div class="prog-top"><div><span class="prog-pct">' + r.pct + '%</span><span class="prog-cap">de su vida útil consumida</span></div>' + badge(r) + '</div>' +
      bar(r, 'lg') + '<div class="metrics">' + kmBlock + dateBlock + '</div>' + est + '</section>';
  }
  const entries = r.history.map(h =>
    '<div class="entry"><div class="entry-main"><span class="entry-date">' + esc(fmtDateIso(h.date)) + '</span><span class="entry-sub">' + fmtInt(h.km) + ' km</span></div>' +
    '<span class="entry-cost">' + fmtMoney(h.cost) + '</span>' +
    (h.photo ? '<button type="button" class="thumb" data-action="openPhoto" data-id="' + esc(r.id) + '" data-hid="' + esc(h.id) + '" aria-label="Ver foto de la factura"><img src="' + esc(h.photo) + '" alt="" loading="lazy"></button>' : '') +
    '<button type="button" class="icon-btn sm" data-action="editService" data-id="' + esc(r.id) + '" data-hid="' + esc(h.id) + '" aria-label="Editar servicio">' + icon('edit', 17) + '</button>' +
    '<button type="button" class="icon-btn sm danger" data-action="deleteService" data-id="' + esc(r.id) + '" data-hid="' + esc(h.id) + '" aria-label="Eliminar servicio">' + icon('trash', 17) + '</button></div>').join('');
  return '<div class="detail-head"><button type="button" class="icon-btn" data-action="goBack" aria-label="Volver">' + icon('chevL', 22) + '</button>' +
      '<h1 class="detail-title">' + esc(r.piece) + '</h1>' +
      '<button type="button" class="icon-btn" data-action="editPlan" data-id="' + esc(r.id) + '" aria-label="Editar plan">' + icon('edit', 20) + '</button></div>' +
    '<div class="detail-chips"><span class="chip"><span class="chip-ic">' + icon(pieceIcon(r), 15) + '</span>' + esc(r.category) + '</span></div>' +
    progress +
    '<section class="card info"><div class="info-row"><span>Se repite cada</span><b>' + esc(r.lifespanLabel) + '</b></div>' +
      (r.note ? '<p class="info-note">' + esc(r.note) + '</p>' : '') + '</section>' +
    '<section class="card info"><div class="info-row"><span>Último costo</span><b>' + (r.last ? fmtMoney(r.last.cost) : '—') + '</b></div>' +
      '<div class="info-row"><span>Gasto anual estimado</span><b>' + (r.annualCost != null ? fmtMoney(r.annualCost) : '—') + '</b></div>' +
      '<div class="info-row"><span>Total invertido</span><b>' + fmtMoney(total) + '</b></div>' +
      (r.cyclesPerYear ? '<p class="info-note">≈ ' + (Math.round(r.cyclesPerYear * 10) / 10) + ' veces al año, lo que ocurra primero entre el tiempo y el kilometraje.</p>' : '') + '</section>' +
    '<div class="section-head"><h3>Servicios registrados</h3><span class="count">' + r.history.length + '</span></div>' +
    (r.history.length ? '<div class="entries">' + entries + '</div>' : '<p class="footnote">Todavía no hay servicios registrados para esta pieza.</p>') +
    '<div class="detail-actions"><button type="button" class="btn btn-primary block" data-action="quickService" data-id="' + esc(r.id) + '">' + icon('plus', 18) + ' Registrar servicio</button>' +
      '<button type="button" class="btn btn-danger-ghost block" data-action="deleteItem" data-id="' + esc(r.id) + '">' + icon('trash', 18) + ' Eliminar pieza</button></div>';
}

function renderAgregar(vm) {
  const a = vm.add, S = vm.S;
  const title = 'Registrar servicio';
  if (a.step === 'start') {
    return '<h1 class="screen-title">' + title + '</h1><p class="lead">Escanea la factura y completamos los datos; tú los confirmas antes de guardar.</p>' +
      '<div class="options">' +
        '<button type="button" class="option primary" data-action="startScan"><span class="option-ic">' + icon('camera', 26) + '</span><span class="option-txt"><b>Escanear factura</b><small>Toma una foto con la cámara</small></span>' + icon('chevR', 18) + '</button>' +
        '<button type="button" class="option" data-action="chooseFromGallery"><span class="option-ic">' + icon('image', 26) + '</span><span class="option-txt"><b>Elegir de la galería</b><small>Usa una foto que ya tienes</small></span>' + icon('chevR', 18) + '</button>' +
        '<button type="button" class="option" data-action="startManual"><span class="option-ic">' + icon('edit', 26) + '</span><span class="option-txt"><b>Registrar manualmente</b><small>Sin foto, con fecha y datos a mano</small></span>' + icon('chevR', 18) + '</button>' +
      '</div>' +
      '<p class="footnote">La lectura se hace en tu teléfono; la imagen no se envía a ningún servidor. La primera vez descarga el lector (unos MB) y necesita internet. Los datos leídos pueden fallar: revísalos siempre.</p>';
  }
  if (a.step === 'scanning') {
    return '<div class="scanning"><div class="spinner" aria-hidden="true"></div><h2>Leyendo factura…</h2>' +
      '<p id="ocrStatus" class="lead">Preparando el lector</p><span class="bar lg tone-ok"><i id="ocrBar" style="width:4%"></i></span>' +
      '<button type="button" class="btn btn-ghost" data-action="cancelScan">Cancelar</button></div>';
  }
  if (a.step === 'done') {
    const r = S.byId[a.doneItemId];
    return '<div class="done"><div class="done-check">' + icon('check', 34) + '</div><h2>¡Guardado!</h2>' +
      (r ? '<p class="lead"><b>' + esc(r.piece) + '</b>: ' + esc(r.statusLabel.toLowerCase()) + '. ' + esc(r.dueLabel) + '.</p>' : '<p class="lead">Se agregó a tu historial.</p>') +
      '<div class="done-actions">' + (r ? '<button type="button" class="btn btn-primary" data-action="openDetail" data-id="' + esc(r.id) + '">Ver pieza</button>' : '') +
      '<button type="button" class="btn btn-ghost" data-action="resetAdd">Registrar otro</button></div></div>';
  }
  // Formulario
  const f = a.f, e = a.errors || {};
  const existing = f.itemId && f.itemId !== '__new' ? S.byId[f.itemId] : null;
  const isNew = !existing;
  const opts = [{ value: '__new', label: '＋ Otro: nueva pieza o servicio' }]
    .concat(S.items.slice().sort((x, y) => x.piece.localeCompare(y.piece, 'es')).map(i => ({ value: i.id, label: i.piece })));
  const have = new Set(S.items.map(i => slug(i.piece)));
  const suggest = TEMPLATE_ITEMS.filter(t => !have.has(slug(t.piece))).map(t => '<option value="' + esc(t.piece) + '"></option>').join('');
  const photo = a.photo ? '<div class="photo-prev"><img src="' + esc(a.photo) + '" alt="Foto de la factura"><button type="button" class="icon-btn sm" data-action="removePhoto" aria-label="Quitar foto">' + icon('close', 16) + '</button></div>' : '';
  const note = a.ocrNote ? '<div class="callout ' + esc(a.ocrNote.kind) + '">' + icon(a.ocrNote.kind === 'ok' ? 'check' : 'info', 18) + '<span>' + esc(a.ocrNote.text) + '</span></div>' : '';
  return '<h1 class="screen-title">' + title + '</h1>' + note + photo +
    '<form class="card form" data-form="service" novalidate>' +
    selectField('Pieza o servicio', 'itemId', opts, f.itemId || '__new', null) +
    (isNew ? '<p class="form-sub">Escribe el nombre que quieras (ej. Amortiguadores, Lavado de inyectores) o elige una sugerencia.</p>' +
      field('Nombre del servicio o pieza', 'piece', f.piece, 'list="pieceSuggest" placeholder="Ej. Amortiguadores" autocomplete="off" maxlength="80"', e.piece) +
      '<datalist id="pieceSuggest">' + suggest + '</datalist>' +
      selectField('Categoría', 'category', CATEGORIES.map(c => ({ value: c, label: c })), f.category || 'Motor', null) : '') +
    field('Fecha del servicio', 'date', f.date, 'type="date" max="' + esc(todayIso()) + '"', e.date) +
    '<div class="form-row">' +
      field('Kilometraje', 'km', f.km, 'type="number" inputmode="numeric" min="0" step="1" placeholder="0"', e.km) +
      field('Costo ($)', 'cost', f.cost, 'type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"', e.cost) +
    '</div>' +
    (isNew ? '<div class="form-sub">¿Cada cuánto se repite?</div><div class="form-row">' +
      field('Cada (km)', 'intervalKm', f.intervalKm, 'type="number" inputmode="numeric" min="0" step="1" placeholder="0 si no aplica"', e.intervalKm) +
      field('Cada (meses)', 'intervalMonths', f.intervalMonths, 'type="number" inputmode="numeric" min="0" step="1" placeholder="0 si no aplica"', e.intervalMonths) + '</div>' : '') +
    '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="cancelForm">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>' +
    '</form>';
}

function renderWelcome() {
  return '<div class="welcome"><div class="welcome-ic">' + icon('car', 40) + '</div><h1>Mantenimiento Auto</h1>' +
    '<p class="lead">Lleva el historial de tu auto, sabe qué toca y cuándo, y estima cuánto vas a gastar al año.</p>' +
    '<button type="button" class="btn btn-primary block" data-action="openAddVehicle">' + icon('plus', 18) + ' Agregar mi vehículo</button>' +
    '<button type="button" class="btn btn-ghost block" data-action="importBackup">' + icon('upload', 18) + ' Importar un respaldo</button></div>';
}

/* ---------- Barra inferior, modales ---------- */

function renderTabBar(vm) {
  if (vm.tab === 'detalle') return '';
  const t = (key, ic, label, extra) =>
    '<button type="button" class="tab' + (vm.tab === key ? ' active' : '') + (key === 'agregar' ? ' tab-add' : '') + '" data-action="' + ({ inicio: 'goInicio', historial: 'goHistorial', proximos: 'goProximos', agregar: 'goAgregar' })[key] + '"' + (vm.tab === key ? ' aria-current="page"' : '') + '>' +
    '<span class="tab-ic">' + icon(ic, key === 'agregar' ? 24 : 22) + (extra || '') + '</span><span class="tab-label">' + label + '</span></button>';
  const dot = vm.S && vm.S.attention.length ? '<span class="tab-dot" aria-label="' + vm.S.attention.length + ' requieren atención">' + vm.S.attention.length + '</span>' : '';
  return '<nav class="tabbar" aria-label="Principal">' + t('inicio', 'home', 'Inicio') + t('historial', 'history', 'Historial') + t('proximos', 'calendar', 'Próximos', dot) + t('agregar', 'plus', 'Agregar') + '</nav>';
}

function sheet(title, inner, opts) {
  const o = opts || {};
  return '<div class="overlay" data-action="closeModal"><div class="sheet' + (o.center ? ' center' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '" data-stop="1">' +
    '<div class="sheet-handle" aria-hidden="true"></div><h2 class="sheet-title">' + esc(title) + '</h2>' + inner + '</div></div>';
}

function renderModal(vm) {
  const m = vm.modal;
  if (!m) return '';
  const e = m.errors || {};
  if (m.type === 'editKm') {
    return sheet('Actualizar kilometraje', '<p class="lead">Lo usamos para calcular qué piezas están por vencer.</p>' +
      field('Kilometraje actual', 'km', m.data.km, 'type="number" inputmode="numeric" min="0" step="1" id="modalKmInput"', e.km, 'm') +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="closeModal">Cancelar</button><button type="button" class="btn btn-primary" data-action="saveKm">Guardar</button></div>');
  }
  if (m.type === 'vehicle') {
    const d = m.data;
    return sheet(m.vehicleId ? 'Editar vehículo' : 'Nuevo vehículo',
      field('Nombre', 'name', d.name, 'placeholder="Ej. Kia Rio 2020" maxlength="60" autocomplete="off"', e.name, 'm') +
      field('Placa', 'plate', d.plate, 'placeholder="ABC-1234" maxlength="12" autocomplete="off" autocapitalize="characters"', e.plate, 'm') +
      field('Kilometraje actual', 'currentKm', d.currentKm, 'type="number" inputmode="numeric" min="0" step="1"', e.currentKm, 'm') +
      (m.vehicleId ? '' : '<label class="check"><input type="checkbox" data-mfield="template"' + (d.template ? ' checked' : '') + '><span>Cargar plan de mantenimiento típico<small>Piezas con intervalos de referencia; luego registras el último servicio de cada una.</small></span></label>') +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="closeModal">Cancelar</button><button type="button" class="btn btn-primary" data-action="saveVehicle">' + (m.vehicleId ? 'Guardar' : 'Agregar') + '</button></div>');
  }
  if (m.type === 'plan') {
    const d = m.data;
    return sheet('Editar plan',
      field('Nombre', 'piece', d.piece, 'maxlength="80" autocomplete="off"', e.piece, 'm') +
      selectField('Categoría', 'category', CATEGORIES.map(c => ({ value: c, label: c })), d.category, null, 'm') +
      '<div class="form-sub">¿Cada cuánto se repite?</div><div class="form-row">' +
      field('Cada (km)', 'intervalKm', d.intervalKm, 'type="number" inputmode="numeric" min="0" step="1" placeholder="0 si no aplica"', e.intervalKm, 'm') +
      field('Cada (meses)', 'intervalMonths', d.intervalMonths, 'type="number" inputmode="numeric" min="0" step="1" placeholder="0 si no aplica"', e.intervalMonths, 'm') + '</div>' +
      '<p class="field-hint block">Si defines ambos, vence lo que ocurra primero.</p>' +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="closeModal">Cancelar</button><button type="button" class="btn btn-primary" data-action="savePlan">Guardar</button></div>');
  }
  if (m.type === 'service') {
    const it = vm.S.byId[m.itemId], d = m.data;
    return sheet(m.historyId ? 'Editar servicio' : 'Registrar servicio',
      '<p class="sheet-sub">' + esc(it ? it.piece : '') + '</p>' +
      field('Fecha del servicio', 'date', d.date, 'type="date" max="' + esc(todayIso()) + '"', e.date, 'm') +
      '<div class="form-row">' +
        field('Kilometraje', 'km', d.km, 'type="number" inputmode="numeric" min="0" step="1" placeholder="0"', e.km, 'm') +
        field('Costo ($)', 'cost', d.cost, 'type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"', e.cost, 'm') +
      '</div>' +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="closeModal">Cancelar</button><button type="button" class="btn btn-primary" data-action="saveService">Guardar</button></div>');
  }
  if (m.type === 'confirm') {
    return sheet(m.title, '<p class="lead">' + esc(m.message) + '</p><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="closeModal">Cancelar</button>' +
      '<button type="button" class="btn ' + (m.danger ? 'btn-danger' : 'btn-primary') + '" data-action="confirmYes">' + esc(m.confirmLabel || 'Confirmar') + '</button></div>', { center: true });
  }
  if (m.type === 'more') {
    const item = (act, ic, t, s) => '<button type="button" class="menu-item" data-action="' + act + '"><span class="tile tone-idle">' + icon(ic, 20) + '</span><span class="menu-txt"><b>' + t + '</b><small>' + s + '</small></span>' + icon('chevR', 18) + '</button>';
    return sheet('Más opciones',
      '<div class="menu">' +
      (vm.vehicle ? item('loadTemplate', 'wrench', 'Cargar plan típico de piezas', 'Agrega las piezas habituales que aún no tengas') : '') +
      (vm.vehicle ? item('exportIcs', 'calendar', 'Recordatorios en tu calendario', 'Descarga un archivo .ics con las fechas estimadas') : '') +
      item('exportBackup', 'download', 'Exportar respaldo', 'Guarda todos tus datos en un archivo') +
      item('importBackup', 'upload', 'Importar respaldo', 'Reemplaza los datos actuales con los del archivo') +
      '</div><p class="footnote">Tus datos viven solo en este dispositivo. Haz un respaldo de vez en cuando.</p>');
  }
  if (m.type === 'photo') {
    return '<div class="overlay photo-overlay" data-action="closeModal"><button type="button" class="icon-btn photo-close" data-action="closeModal" aria-label="Cerrar">' + icon('close', 22) + '</button><img class="photo-full" src="' + esc(m.src) + '" alt="Foto de la factura" data-stop="1"></div>';
  }
  return '';
}

function renderBanner(vm) {
  const b = vm.banner;
  if (!b) return '';
  return '<div class="banner" role="status"><span class="banner-ic">' + icon(b.icon || 'info', 18) + '</span><span class="banner-text">' + esc(b.text) + '</span>' +
    (b.action ? '<button type="button" class="banner-btn" data-action="' + b.action + '">' + esc(b.label) + '</button>' : '') +
    (b.dismiss ? '<button type="button" class="banner-x" data-action="' + b.dismiss + '" aria-label="Cerrar aviso">' + icon('close', 16) + '</button>' : '') + '</div>';
}

function renderApp(vm) {
  let screen;
  if (!vm.hasVehicles) screen = renderWelcome();
  else if (vm.tab === 'inicio') screen = renderInicio(vm);
  else if (vm.tab === 'historial') screen = renderHistorial(vm);
  else if (vm.tab === 'proximos') screen = renderProximos(vm);
  else if (vm.tab === 'detalle') screen = renderDetalle(vm);
  else screen = renderAgregar(vm);
  return '<div class="safe-top"></div>' + renderBanner(vm) +
    '<main class="screen' + (vm.tab === 'detalle' ? ' no-tabs' : '') + '" id="screen">' + screen + '</main>' +
    (vm.hasVehicles ? renderTabBar(vm) : '') + renderModal(vm);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { esc, icon, pieceIcon, renderApp, ICON_PATHS };
