// Capa de persistencia real (IndexedDB). Reemplaza el estado en memoria del prototipo.
const DB_NAME = 'mantenimiento-auto';
const DB_VERSION = 1;
const STORE_VEHICLES = 'vehicles';
const STORE_META = 'meta';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VEHICLES)) {
        db.createObjectStore(STORE_VEHICLES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

const SEED_VEHICLES = [
  { id: 'aveo', name: 'Chevrolet Aveo Activo 2011', plate: 'PCA-0456', currentKm: 138000, records: [
    { id: 'aceite', piece: 'Aceite y filtro de motor', category: 'Motor', lastDate: '2026-05-20', lastKm: 135000, intervalKm: 5000, intervalMonths: 6, cost: 28, note: 'Lubrica el motor y evita el desgaste prematuro de sus componentes internos.' },
    { id: 'filtroaire', piece: 'Filtro de aire', category: 'Motor', lastDate: '2025-06-01', lastKm: 128000, intervalKm: 10000, intervalMonths: 12, cost: 14, note: 'Filtra el aire que entra al motor; si se satura, reduce el rendimiento y aumenta el consumo.' },
    { id: 'pastillas', piece: 'Pastillas de freno delanteras', category: 'Frenos', lastDate: '2025-09-10', lastKm: 110000, intervalKm: 30000, intervalMonths: 24, cost: 50, note: 'Se desgastan por fricción al frenar; son críticas para la seguridad del vehículo.' },
    { id: 'bateria', piece: 'Batería', category: 'Eléctrico', lastDate: '2024-03-15', lastKm: 120000, intervalKm: 0, intervalMonths: 36, cost: 85, note: 'Pierde capacidad de carga con el tiempo y el calor; revisar antes de un viaje largo.' },
    { id: 'llantas', piece: 'Llantas (juego de 4)', category: 'Suspensión', lastDate: '2024-10-01', lastKm: 100000, intervalKm: 45000, intervalMonths: 48, cost: 300, note: 'El desgaste de la banda de rodadura afecta la tracción y la distancia de frenado.' },
    { id: 'correa', piece: 'Correa de distribución', category: 'Motor', lastDate: '2022-01-10', lastKm: 90000, intervalKm: 90000, intervalMonths: 72, cost: 150, note: 'Si se rompe en marcha puede dañar el motor gravemente; no conviene retrasarla.' },
    { id: 'bujias', piece: 'Bujías', category: 'Motor', lastDate: '2025-01-05', lastKm: 118000, intervalKm: 20000, intervalMonths: 24, cost: 32, note: 'Encienden la mezcla aire-combustible; si fallan, sube el consumo y baja la potencia.' },
    { id: 'liquidofreno', piece: 'Líquido de frenos', category: 'Frenos', lastDate: '2024-02-01', lastKm: 116000, intervalKm: 0, intervalMonths: 24, cost: 18, note: 'Absorbe humedad con el tiempo, lo que reduce la eficacia del sistema de frenos.' },
    { id: 'filtrocomb', piece: 'Filtro de combustible', category: 'Motor', lastDate: '2025-11-01', lastKm: 130000, intervalKm: 20000, intervalMonths: 24, cost: 22, note: 'Evita que impurezas del combustible lleguen al motor.' },
  ] },
  { id: 'corolla', name: 'Toyota Corolla 2019', plate: 'PBX-1234', currentKm: 68500, records: [
    { id: 'aceite2', piece: 'Aceite y filtro de motor', category: 'Motor', lastDate: '2026-05-10', lastKm: 65000, intervalKm: 5000, intervalMonths: 6, cost: 32, note: 'Lubrica el motor y evita el desgaste prematuro de sus componentes internos.' },
    { id: 'filtroaire2', piece: 'Filtro de aire', category: 'Motor', lastDate: '2025-08-15', lastKm: 60000, intervalKm: 10000, intervalMonths: 12, cost: 16, note: 'Filtra el aire que entra al motor; si se satura, reduce el rendimiento y aumenta el consumo.' },
    { id: 'pastillas2', piece: 'Pastillas de freno delanteras', category: 'Frenos', lastDate: '2025-11-01', lastKm: 40000, intervalKm: 30000, intervalMonths: 24, cost: 65, note: 'Se desgastan por fricción al frenar; son críticas para la seguridad del vehículo.' },
    { id: 'bateria2', piece: 'Batería', category: 'Eléctrico', lastDate: '2024-06-20', lastKm: 45000, intervalKm: 60000, intervalMonths: 36, cost: 95, note: 'Pierde capacidad de carga con el tiempo y el calor; revisar antes de un viaje largo.' },
    { id: 'llantas2', piece: 'Llantas (juego de 4)', category: 'Suspensión', lastDate: '2025-01-15', lastKm: 38000, intervalKm: 45000, intervalMonths: 48, cost: 380, note: 'El desgaste de la banda de rodadura afecta la tracción y la distancia de frenado.' },
    { id: 'correa2', piece: 'Correa de distribución', category: 'Motor', lastDate: '2023-03-10', lastKm: 20000, intervalKm: 90000, intervalMonths: 60, cost: 180, note: 'Si se rompe en marcha puede dañar el motor gravemente; no conviene retrasarla.' },
    { id: 'bujias2', piece: 'Bujías', category: 'Motor', lastDate: '2025-02-01', lastKm: 42000, intervalKm: 30000, intervalMonths: 24, cost: 42, note: 'Encienden la mezcla aire-combustible; si fallan, sube el consumo y baja la potencia.' },
    { id: 'liquidofreno2', piece: 'Líquido de frenos', category: 'Frenos', lastDate: '2024-08-01', lastKm: 44000, intervalKm: 0, intervalMonths: 24, cost: 22, note: 'Absorbe humedad con el tiempo, lo que reduce la eficacia del sistema de frenos.' },
    { id: 'filtrocomb2', piece: 'Filtro de combustible', category: 'Motor', lastDate: '2025-09-05', lastKm: 61000, intervalKm: 20000, intervalMonths: 24, cost: 28, note: 'Evita que impurezas del combustible lleguen al motor.' },
  ] },
];

const Store = {
  async init() {
    this.db = await openDb();
    const existing = await this.getAllVehicles();
    if (existing.length === 0) {
      for (const v of SEED_VEHICLES) await this.putVehicle(v);
      await this.setMeta('currentVehicleId', 'aveo');
    }
  },
  getAllVehicles() {
    return new Promise((resolve, reject) => {
      const req = tx(this.db, STORE_VEHICLES, 'readonly').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  putVehicle(vehicle) {
    return new Promise((resolve, reject) => {
      const req = tx(this.db, STORE_VEHICLES, 'readwrite').put(vehicle);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  deleteVehicle(id) {
    return new Promise((resolve, reject) => {
      const req = tx(this.db, STORE_VEHICLES, 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  getMeta(key) {
    return new Promise((resolve, reject) => {
      const req = tx(this.db, STORE_META, 'readonly').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  },
  setMeta(key, value) {
    return new Promise((resolve, reject) => {
      const req = tx(this.db, STORE_META, 'readwrite').put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  clearVehicles() {
    return new Promise((resolve, reject) => {
      const req = tx(this.db, STORE_VEHICLES, 'readwrite').clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};
