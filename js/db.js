'use strict';
/* Persistencia local con IndexedDB.
   - Escrituras confirmadas en tx.oncomplete (no antes), para no perder datos al cerrar la app.
   - Antes de migrar de v1 a v2 se guarda una copia intacta en meta['preMigrationBackup'].
   - Si IndexedDB no está disponible (p. ej. modo privado), la app sigue en memoria y avisa. */

const DB_NAME = 'mantenimiento-auto';
const DB_VERSION = 1;
const STORE_VEHICLES = 'vehicles';
const STORE_META = 'meta';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB no disponible')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VEHICLES)) db.createObjectStore(STORE_VEHICLES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Base de datos bloqueada por otra pestaña'));
  });
}

function idbWrite(db, stores, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite');
    fn(t);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transacción cancelada'));
  });
}

function idbRead(db, store, fn) {
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(store, 'readonly').objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const Store = {
  db: null,
  persistent: false,
  mem: { vehicles: new Map(), meta: new Map() },

  async init() {
    try {
      this.db = await openDb();
      this.persistent = true;
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {
      this.db = null;
      this.persistent = false;
    }
    const raw = await this.getAllRaw();
    if (raw.some(needsMigration)) {
      // Copia de seguridad intacta de lo que había antes de tocar nada (solo la primera vez).
      if (!(await this.getMeta('preMigrationBackup'))) {
        await this.setMeta('preMigrationBackup', { at: new Date().toISOString(), vehicles: raw });
      }
      const migrated = raw.map(v => migrateVehicle(v));
      await this.replaceAll(migrated, await this.getMeta('currentVehicleId'));
    }
  },

  async getAllRaw() {
    if (!this.db) return Array.from(this.mem.vehicles.values());
    return idbRead(this.db, STORE_VEHICLES, s => s.getAll());
  },
  async getAllVehicles() {
    return (await this.getAllRaw()).map(v => migrateVehicle(v));
  },

  async putVehicle(vehicle) {
    if (!this.db) { this.mem.vehicles.set(vehicle.id, JSON.parse(JSON.stringify(vehicle))); return; }
    await idbWrite(this.db, [STORE_VEHICLES], t => t.objectStore(STORE_VEHICLES).put(vehicle));
  },
  async deleteVehicle(id) {
    if (!this.db) { this.mem.vehicles.delete(id); return; }
    await idbWrite(this.db, [STORE_VEHICLES], t => t.objectStore(STORE_VEHICLES).delete(id));
  },

  // Reemplaza todo en una sola transacción: o queda todo, o no cambia nada.
  async replaceAll(vehicles, currentVehicleId) {
    const id = vehicles.some(v => v.id === currentVehicleId) ? currentVehicleId : (vehicles[0] && vehicles[0].id);
    if (!this.db) {
      this.mem.vehicles = new Map(vehicles.map(v => [v.id, JSON.parse(JSON.stringify(v))]));
      this.mem.meta.set('currentVehicleId', id);
      return;
    }
    await idbWrite(this.db, [STORE_VEHICLES, STORE_META], t => {
      const vs = t.objectStore(STORE_VEHICLES);
      vs.clear();
      vehicles.forEach(v => vs.put(v));
      if (id) t.objectStore(STORE_META).put({ key: 'currentVehicleId', value: id });
    });
  },

  async getMeta(key) {
    if (!this.db) return this.mem.meta.get(key);
    const r = await idbRead(this.db, STORE_META, s => s.get(key));
    return r ? r.value : undefined;
  },
  async setMeta(key, value) {
    if (!this.db) { this.mem.meta.set(key, value); return; }
    await idbWrite(this.db, [STORE_META], t => t.objectStore(STORE_META).put({ key, value }));
  },
};
