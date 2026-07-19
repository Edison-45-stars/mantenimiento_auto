const CHECKLIST_5K = [
  'Funcionamiento del freno de mano',
  'Sistema de ventilación, calefacción y aire acondicionado',
  'Estado y funcionamiento de limpiaparabrisas y aspersores',
  'Luces exteriores y pito',
  'Tensión y condición de la banda de accesorios',
  'Nivel de refrigerante y fugas externas del radiador',
  'Estado de la batería y el alternador',
  'Nivel y fugas del aceite del motor',
  'Nivel y fugas del líquido de dirección',
];

const STATUS_STYLE = {
  vencido: { color: 'var(--vencido)', bg: 'var(--vencido-bg)', label: 'Vencido' },
  pronto: { color: 'var(--pronto)', bg: 'var(--pronto-bg)', label: 'Pronto' },
  ok: { color: 'var(--ok)', bg: 'var(--ok-bg)', label: 'Al día' },
};

// Simula la extracción de datos de la factura (OCR). Ver README para conectar
// un servicio real (Google Cloud Vision, Tesseract.js, o un modelo multimodal).
const MOCK_SCANS = [
  { piece: 'Cambio de aceite y filtro', category: 'Motor', cost: 34, intervalKm: 5000, intervalMonths: 6, note: 'Lubrica el motor y evita el desgaste prematuro de sus componentes internos.' },
  { piece: 'Alineación y balanceo', category: 'Suspensión', cost: 25, intervalKm: 10000, intervalMonths: 6, note: 'Mantiene el desgaste uniforme de las llantas y mejora la estabilidad.' },
  { piece: 'Pastillas de freno traseras', category: 'Frenos', cost: 58, intervalKm: 30000, intervalMonths: 24, note: 'Se desgastan por fricción al frenar; conviene revisarlas junto a los discos.' },
];

function fmtInt(n) { return Math.round(n).toLocaleString('es-EC'); }
function fmtDate(d) { return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }); }
function todayIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function computeRecords(vehicle) {
  const now = new Date();
  const currentKm = vehicle.currentKm;
  return vehicle.records.map(r => {
    const lastDate = new Date(r.lastDate);
    const nextDueDate = new Date(lastDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + r.intervalMonths);
    const nextDueKm = r.intervalKm > 0 ? r.lastKm + r.intervalKm : null;
    const kmRemaining = nextDueKm != null ? nextDueKm - currentKm : Infinity;
    const daysRemaining = (nextDueDate - now) / 86400000;
    const monthsRemaining = daysRemaining / 30.44;

    let status = 'ok';
    if (kmRemaining <= 0 || monthsRemaining <= 0) status = 'vencido';
    else if (kmRemaining <= 1500 || monthsRemaining <= 1.5) status = 'pronto';

    const urgencyScore = Math.min(kmRemaining === Infinity ? Infinity : kmRemaining, monthsRemaining * 1000);

    let dueLabel;
    if (status === 'vencido') dueLabel = 'Vencido — programar pronto';
    else if (nextDueKm != null) dueLabel = `Faltan ${fmtInt(kmRemaining)} km (≈ ${fmtDate(nextDueDate)})`;
    else dueLabel = `Faltan ${Math.max(0, Math.round(monthsRemaining))} meses (≈ ${fmtDate(nextDueDate)})`;

    const lifespanLabel = r.intervalKm > 0
      ? `${fmtInt(r.intervalKm)} km / ${r.intervalMonths} meses`
      : `${r.intervalMonths} meses`;

    const annualCost = r.cost / (r.intervalMonths / 12);
    const st = STATUS_STYLE[status];

    return {
      ...r,
      lastDateFmt: fmtDate(lastDate),
      lastKmFmt: fmtInt(r.lastKm),
      nextDueDateFmt: fmtDate(nextDueDate),
      nextDueKmFmt: nextDueKm != null ? `${fmtInt(nextDueKm)} km` : 'Según fecha',
      dueLabel, lifespanLabel, status,
      statusLabel: st.label, statusColor: st.color, statusBg: st.bg,
      urgencyScore, annualCost, annualCostFmt: fmtInt(annualCost),
      estNextCost: Math.round(r.cost * 1.05),
    };
  }).sort((a, b) => a.urgencyScore - b.urgencyScore);
}
