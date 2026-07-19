function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderVehicleHeader(vm) {
  const dropdown = vm.vehiclePickerOpen ? `
    <div class="vehicle-dropdown">
      ${vm.vehicleOptions.map(v => `
        <button type="button" class="vehicle-option" data-action="selectVehicle" data-id="${esc(v.id)}"
          style="background:${v.active ? 'oklch(96% 0.03 55)' : 'transparent'};color:${v.active ? 'var(--primary-dark)' : 'var(--text)'};">
          <div class="vehicle-option-name">${esc(v.name)}</div>
          <div class="vehicle-option-plate">${esc(v.plate)}</div>
        </button>`).join('')}
      <button type="button" class="vehicle-option vehicle-option-add" data-action="openAddVehicle">+ Agregar vehículo</button>
      <div class="vehicle-dropdown-divider"></div>
      <button type="button" class="vehicle-option vehicle-option-add" data-action="exportBackup">⬇ Exportar respaldo</button>
      <button type="button" class="vehicle-option vehicle-option-add" data-action="importBackup">⬆ Importar respaldo</button>
      <input type="file" id="backupInput" accept="application/json,.json" style="display:none;">
    </div>` : '';
  return `
  <div class="vehicle-header">
    <div class="vehicle-trigger" data-action="toggleVehiclePicker" role="button" tabindex="0">
      <div class="vehicle-name-row">
        <div class="vehicle-name">${esc(vm.carName)}</div>
        <div class="vehicle-caret"></div>
      </div>
    </div>
    <div class="vehicle-sub" data-action="editKm" role="button" tabindex="0">${esc(vm.plate)} · ${esc(vm.currentKmFmt)} km (toca para actualizar)</div>
    ${dropdown}
  </div>`;
}

function renderInicio(vm) {
  const hero = vm.nextItem ? `
    <div class="hero-card">
      <div class="hero-label">Próximo mantenimiento</div>
      <div class="hero-piece">${esc(vm.nextItem.piece)}</div>
      <div class="hero-due">${esc(vm.nextItem.dueLabel)}</div>
      <button type="button" class="hero-btn" data-action="openDetail" data-id="${esc(vm.nextItem.id)}">Ver detalle</button>
    </div>` : `
    <div class="hero-card">
      <div class="hero-label">Sin mantenimientos</div>
      <div class="hero-empty">Agrega tu primer mantenimiento para empezar a ver vencimientos.</div>
      <button type="button" class="hero-btn" data-action="goAgregar">Agregar</button>
    </div>`;

  return `
  ${renderVehicleHeader(vm)}
  ${hero}
  <div class="stat-grid">
    <div class="card stat-card">
      <div class="stat-label">Gasto estimado / año</div>
      <div class="stat-value">$${esc(vm.annualEstimateFmt)}</div>
      <div class="stat-sub">aprox. en Ecuador</div>
    </div>
    <div class="card stat-card">
      <div class="stat-label">Gastado hasta hoy</div>
      <div class="stat-value">$${esc(vm.totalSpendFmt)}</div>
      <div class="stat-sub">${vm.totalCount} mantenimientos</div>
    </div>
  </div>
  <div class="card checklist-card">
    <div class="checklist-title">Revisión oficial cada 5,000 km / 6 meses</div>
    <div class="checklist-items">
      ${CHECKLIST_5K.map(c => `<div class="checklist-row"><div class="checklist-dot"></div><div class="checklist-text">${esc(c)}</div></div>`).join('')}
    </div>
    <div class="checklist-foot">Según la matriz de mantenimiento preventivo Chevrolet Ecuador.</div>
  </div>
  <div class="section-title">Atención pronto</div>
  <div class="list-col">
    ${vm.soonItems.length ? vm.soonItems.map(r => `
      <button type="button" class="row-item" data-action="openDetail" data-id="${esc(r.id)}">
        <div class="row-dot" style="background:${r.statusColor}"></div>
        <div class="row-body">
          <div class="row-title">${esc(r.piece)}</div>
          <div class="row-sub">${esc(r.dueLabel)}</div>
        </div>
      </button>`).join('') : `<div class="empty-msg">Nada urgente por ahora 🎉</div>`}
  </div>
  <div style="height:14px;"></div>`;
}

function renderHistorial(vm) {
  const body = vm.historyView === 'pieza' ? `
    <div class="list-col" style="margin-top:0;">
      ${vm.historyList.length ? vm.historyList.map(r => `
        <button type="button" class="row-item between" data-action="openDetail" data-id="${esc(r.id)}">
          <div class="row-body">
            <div class="row-title">${esc(r.piece)}</div>
            <div class="row-sub">${esc(r.lastDateFmt)} · ${esc(r.lastKmFmt)} km</div>
          </div>
          <div class="row-cost">$${esc(r.cost)}</div>
        </button>`).join('') : `<div class="empty-msg">Aún no hay mantenimientos registrados.</div>`}
    </div>` : `
    <div class="history-groups">
      ${vm.historyByDate.map(g => `
        <div class="history-group">
          <div class="history-group-head">
            <div class="history-group-date">${esc(g.dateFmt)}</div>
            <div class="history-group-total">${esc(g.km)} km · $${esc(g.total)}</div>
          </div>
          <div class="list-col" style="margin-top:0;">
            ${g.items.map(r => `
              <button type="button" class="row-item between" data-action="openDetail" data-id="${esc(r.id)}">
                <div class="row-title">${esc(r.piece)}</div>
                <div class="row-cost">$${esc(r.cost)}</div>
              </button>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;

  return `
  <div class="screen-title">Historial</div>
  <div class="segmented">
    <button type="button" data-action="setViewPieza" class="${vm.historyView === 'pieza' ? 'active' : ''}">Por pieza</button>
    <button type="button" data-action="setViewFecha" class="${vm.historyView === 'fecha' ? 'active' : ''}">Por fecha</button>
  </div>
  ${body}
  <div style="height:14px;"></div>`;
}

function renderProximos(vm) {
  return `
  <div class="screen-title">Próximos</div>
  <div class="list-col" style="margin-top:0;">
    ${vm.upcomingList.length ? vm.upcomingList.map(r => `
      <button type="button" class="row-item" data-action="openDetail" data-id="${esc(r.id)}">
        <div class="row-dot" style="background:${r.statusColor}"></div>
        <div class="row-body">
          <div class="row-title">${esc(r.piece)}</div>
          <div class="row-sub">${esc(r.dueLabel)}</div>
        </div>
        <div class="row-badge" style="color:${r.statusColor};background:${r.statusBg};">${esc(r.statusLabel)}</div>
      </button>`).join('') : `<div class="empty-msg">Aún no hay mantenimientos registrados.</div>`}
  </div>
  <div style="height:14px;"></div>`;
}

function renderDetalle(vm) {
  const r = vm.selectedRecord;
  if (!r) return `<div class="empty-msg">Registro no encontrado.</div>`;
  const photo = r.photo ? `<img class="detail-photo" src="${r.photo}" alt="Foto de factura">` : '';
  return `
  <div class="detail-head">
    <button type="button" class="back-btn" data-action="goBack">‹</button>
    <div class="detail-title">${esc(r.piece)}</div>
  </div>
  <div class="detail-chip">${esc(r.category)}</div>
  ${photo}
  <div class="card detail-card">
    <div class="detail-card-title">Último mantenimiento</div>
    <div class="detail-row"><span>Fecha</span><span>${esc(r.lastDateFmt)}</span></div>
    <div class="detail-row"><span>Kilometraje</span><span>${esc(r.lastKmFmt)} km</span></div>
    <div class="detail-row"><span>Costo pagado</span><span>$${esc(r.cost)}</span></div>
  </div>
  <div class="card detail-card">
    <div class="detail-card-title">Vida útil de la pieza</div>
    <div class="detail-lifespan">${esc(r.lifespanLabel)}</div>
    <div class="detail-note">${esc(r.note)}</div>
  </div>
  <div class="detail-next">
    <div class="detail-next-head">
      <div class="detail-card-title">Próximo mantenimiento</div>
      <div class="row-badge" style="color:${r.statusColor};background:${r.statusBg};">${esc(r.statusLabel)}</div>
    </div>
    <div class="detail-row"><span>Fecha estimada</span><span>${esc(r.nextDueDateFmt)}</span></div>
    <div class="detail-row"><span>Kilometraje</span><span>${esc(r.nextDueKmFmt)}</span></div>
    <div class="detail-row"><span>Faltan</span><span>${esc(r.dueLabel)}</span></div>
  </div>
  <div class="card detail-card">
    <div class="detail-card-title">Costo estimado próxima vez</div>
    <div class="detail-cost">$${esc(r.estNextCost)}</div>
    <div class="detail-cost-sub">Equivale a ~$${esc(r.annualCostFmt)}/año en Ecuador</div>
  </div>
  <div class="detail-actions">
    <button type="button" class="pill flex danger-ghost" data-action="deleteRecord" data-id="${esc(r.id)}">Eliminar</button>
  </div>
  <div style="height:14px;"></div>`;
}

function renderAgregar(vm) {
  const s = vm.addStep;
  let inner = '';
  if (s === 'start') {
    inner = `
    <div class="add-start">
      <div class="cam-icon"><div class="cam-icon-top"></div><div class="cam-icon-lens"></div></div>
      <div class="add-hint">Toma una foto clara de la factura o recibo</div>
      <button type="button" class="pill pill-primary" data-action="startScan">Tomar foto de factura</button>
      <div class="divider-or">— o —</div>
      <button type="button" class="pill pill-outline" data-action="startManual">Agregar manualmente</button>
    </div>`;
  } else if (s === 'manual' || s === 'review') {
    const nr = vm.newRecord || {};
    const isReview = s === 'review';
    const photo = vm.pendingPhoto ? `<img class="scan-thumb" src="${vm.pendingPhoto}" alt="Foto capturada">` : '';
    inner = `
    <div class="form-card">
      ${isReview ? `<div class="review-badge">✓ Factura leída</div>` : ''}
      ${photo}
      ${isReview ? `<div class="ocr-disclaimer">Datos extraídos automáticamente (simulado). Revisa y corrige antes de guardar — ver README para conectar OCR real.</div>` : ''}
      <div class="card" style="display:flex;flex-direction:column;gap:12px;">
        <label class="form-col">
          <span class="form-label">Mantenimiento</span>
          <input class="form-input" data-field="piece" value="${esc(nr.piece)}" placeholder="Ej. Cambio de aceite">
        </label>
        ${isReview ? '' : `
        <label class="form-col">
          <span class="form-label">Categoría</span>
          <select class="form-input" data-field="category">
            ${['Motor', 'Frenos', 'Eléctrico', 'Suspensión'].map(c => `<option value="${c}" ${nr.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </label>`}
        <div class="form-row">
          <label class="form-col flex">
            <span class="form-label">Kilometraje</span>
            <input class="form-input" type="number" data-field="km" value="${esc(nr.km)}">
          </label>
          <label class="form-col flex">
            <span class="form-label">Costo ($)</span>
            <input class="form-input" type="number" data-field="cost" value="${esc(nr.cost)}">
          </label>
        </div>
        ${isReview ? `<div class="review-note">Fecha: hoy · Categoría: ${esc(nr.category)}</div>` : `
        <div class="form-sub-title">¿Cada cuánto se repite?</div>
        <div class="form-row">
          <label class="form-col flex">
            <span class="form-label">Cada (km)</span>
            <input class="form-input" type="number" data-field="intervalKm" placeholder="0 si no aplica" value="${esc(nr.intervalKm)}">
          </label>
          <label class="form-col flex">
            <span class="form-label">Cada (meses)</span>
            <input class="form-input" type="number" data-field="intervalMonths" value="${esc(nr.intervalMonths)}">
          </label>
        </div>`}
      </div>
      <div class="form-actions">
        <button type="button" class="pill flex pill-ghost" data-action="${isReview ? 'startScan' : 'resetAdd'}">${isReview ? 'Escanear otra' : 'Cancelar'}</button>
        <button type="button" class="pill flex pill-primary" data-action="saveRecord">Guardar</button>
      </div>
    </div>`;
  } else if (s === 'scanning') {
    inner = `
    <div class="scanning-card">
      <div class="spinner"></div>
      <div class="scanning-label">Leyendo factura...</div>
    </div>`;
  } else if (s === 'done') {
    inner = `
    <div class="done-card">
      <div class="done-check">✓</div>
      <div class="done-title">¡Guardado!</div>
      <div class="done-sub">Se agregó a tu historial de mantenimientos.</div>
      <div class="done-actions">
        <button type="button" class="pill small pill-ghost" data-action="resetAdd">Agregar otro</button>
        <button type="button" class="pill small pill-primary" data-action="goToHistorialFromDone">Ver historial</button>
      </div>
    </div>`;
  }
  return `
  <div class="screen-title" style="padding-bottom:4px;">Agregar mantenimiento</div>
  <div class="add-intro">Escanea la factura y completamos los datos por ti</div>
  ${inner}
  <div style="height:14px;"></div>
  <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none;">`;
}

function renderTabBar(vm) {
  if (vm.tab === 'detalle') return '';
  const c = (name) => vm.tab === name ? 'var(--primary)' : 'oklch(72% 0.02 55)';
  return `
  <div class="tabbar">
    <button type="button" class="tab-btn" data-action="goInicio">
      <div class="tab-icon sq" style="background:${c('inicio')}"></div>
      <div class="tab-label" style="color:${c('inicio')}">Inicio</div>
    </button>
    <button type="button" class="tab-btn" data-action="goHistorial">
      <div class="tab-icon circle-outline" style="border-color:${c('historial')}"></div>
      <div class="tab-label" style="color:${c('historial')}">Historial</div>
    </button>
    <button type="button" class="tab-btn" data-action="goProximos">
      <div class="tab-icon diamond" style="background:${c('proximos')}"></div>
      <div class="tab-label" style="color:${c('proximos')}">Próximos</div>
    </button>
    <button type="button" class="tab-btn" data-action="goAgregar">
      <div class="tab-icon plus" style="background:${c('agregar')}">+</div>
      <div class="tab-label" style="color:${c('agregar')}">Agregar</div>
    </button>
  </div>`;
}

function renderModal(vm) {
  if (!vm.modal) return '';
  if (vm.modal.type === 'editKm') {
    return `
    <div class="modal-overlay" data-action="closeModal">
      <div class="modal-card" data-stop="1">
        <div class="form-label">Actualizar kilometraje actual</div>
        <input class="form-input" type="number" id="modalKmInput" value="${esc(vm.modal.km)}" autofocus>
        <div class="form-actions">
          <button type="button" class="pill flex pill-ghost" data-action="closeModal">Cancelar</button>
          <button type="button" class="pill flex pill-primary" data-action="saveKm">Guardar</button>
        </div>
      </div>
    </div>`;
  }
  if (vm.modal.type === 'addVehicle') {
    const nv = vm.modal.data || {};
    return `
    <div class="modal-overlay" data-action="closeModal">
      <div class="modal-card" data-stop="1">
        <div class="form-label">Nuevo vehículo</div>
        <input class="form-input" data-modal-field="name" placeholder="Nombre (ej. Kia Rio 2020)" value="${esc(nv.name)}">
        <input class="form-input" data-modal-field="plate" placeholder="Placa" value="${esc(nv.plate)}">
        <input class="form-input" type="number" data-modal-field="currentKm" placeholder="Kilometraje actual" value="${esc(nv.currentKm)}">
        <div class="form-actions">
          <button type="button" class="pill flex pill-ghost" data-action="closeModal">Cancelar</button>
          <button type="button" class="pill flex pill-primary" data-action="saveVehicle">Agregar</button>
        </div>
      </div>
    </div>`;
  }
  return '';
}

function renderApp(vm) {
  let screen = '';
  if (vm.tab === 'inicio') screen = renderInicio(vm);
  else if (vm.tab === 'historial') screen = renderHistorial(vm);
  else if (vm.tab === 'proximos') screen = renderProximos(vm);
  else if (vm.tab === 'detalle') screen = renderDetalle(vm);
  else if (vm.tab === 'agregar') screen = renderAgregar(vm);

  return `
  <div class="statusbar-spacer"></div>
  ${vm.banner || ''}
  <div class="screen">${screen}</div>
  ${renderTabBar(vm)}
  ${vm.toast ? `<div class="toast">${esc(vm.toast)}</div>` : ''}
  ${renderModal(vm)}`;
}
