/**
 * PHARMA_PROJET — Database Engine
 * IndexedDB offline-first storage layer
 * Handles all local data persistence with sync queue
 */

const DB_NAME = 'PharmaProjetDB';
const DB_VERSION = 2;

const STORES = {
  products: 'products',
  lots: 'lots',
  stock: 'stock',
  movements: 'movements',
  suppliers: 'suppliers',
  purchaseOrders: 'purchaseOrders',
  sales: 'sales',
  saleItems: 'saleItems',
  prescriptions: 'prescriptions',
  patients: 'patients',
  users: 'users',
  sessions: 'sessions',
  alerts: 'alerts',
  syncQueue: 'syncQueue',
  auditLog: 'auditLog',
  settings: 'settings',
  cashRegister: 'cashRegister',
  returns: 'returns',
};

let db = null;
let _supabaseInstance = null;

// App state manager
const AppState = {
  currentUser: null,
  currentPage: 'dashboard',
  theme: 'light',
  isOnline: navigator.onLine,
  pendingSyncCount: 0,
};

async function getSupabaseClient() {
  if (_supabaseInstance) return _supabaseInstance;
  try {
    const settings = await dbGetAll('settings');
    const url = settings.find(s => s.key === 'supabase_url')?.value;
    const key = settings.find(s => s.key === 'supabase_key')?.value;
    if (url && key && window.supabase) {
      _supabaseInstance = window.supabase.createClient(url, key);
      return _supabaseInstance;
    }
  } catch (e) {
    console.warn('[Supabase] Client init failed:', e);
  }
  return null;
}

async function initDB() {
  // --- Magic Link Auto-Config ---
  const urlParams = new URLSearchParams(window.location.search);
  const sbUrl = urlParams.get('sb_url');
  const sbKey = urlParams.get('sb_key');

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = async () => {
      db = request.result;

      // If URL params are present, update settings automatically
      if (sbUrl && sbKey) {
        console.log('[DB] Magic Link detected. Configuring Supabase...');
        try {
          const settings = await dbGetAll('settings');
          const update = async (k, v) => {
            const ex = settings.find(s => s.key === k);
            if (ex) await dbPut('settings', { ...ex, value: v, updatedAt: Date.now() });
            else await dbAdd('settings', { key: k, value: v, updatedAt: Date.now() });
          };
          await update('supabase_url', sbUrl);
          await update('supabase_key', sbKey);

          // Clean URL to hide keys and avoid re-triggering
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('[DB] Configuration updated. Reloading client...');
          _supabaseInstance = null; // Force recreation
          await getSupabaseClient();
        } catch (e) {
          console.error('[DB] Magic Link failed:', e);
        }
      }
      resolve(db);
    };

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Products store
      if (!database.objectStoreNames.contains('products')) {
        const ps = database.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('code', 'code', { unique: true });
        ps.createIndex('name', 'name');
        ps.createIndex('dci', 'dci');
        ps.createIndex('category', 'category');
        ps.createIndex('requiresPrescription', 'requiresPrescription');
        ps.createIndex('status', 'status');
      }

      // Lots store
      if (!database.objectStoreNames.contains('lots')) {
        const ls = database.createObjectStore('lots', { keyPath: 'id', autoIncrement: true });
        ls.createIndex('productId', 'productId');
        ls.createIndex('lotNumber', 'lotNumber');
        ls.createIndex('expiryDate', 'expiryDate');
        ls.createIndex('status', 'status');
      }

      // Stock store
      if (!database.objectStoreNames.contains('stock')) {
        const ss = database.createObjectStore('stock', { keyPath: 'id', autoIncrement: true });
        ss.createIndex('productId', 'productId', { unique: true });
        ss.createIndex('quantity', 'quantity');
      }

      // Movements store
      if (!database.objectStoreNames.contains('movements')) {
        const ms = database.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
        ms.createIndex('productId', 'productId');
        ms.createIndex('type', 'type');
        ms.createIndex('date', 'date');
        ms.createIndex('userId', 'userId');
      }

      // Suppliers store
      if (!database.objectStoreNames.contains('suppliers')) {
        const sus = database.createObjectStore('suppliers', { keyPath: 'id', autoIncrement: true });
        sus.createIndex('name', 'name');
        sus.createIndex('status', 'status');
      }

      // Purchase orders
      if (!database.objectStoreNames.contains('purchaseOrders')) {
        const pos = database.createObjectStore('purchaseOrders', { keyPath: 'id', autoIncrement: true });
        pos.createIndex('supplierId', 'supplierId');
        pos.createIndex('status', 'status');
        pos.createIndex('date', 'date');
      }

      // Sales store
      if (!database.objectStoreNames.contains('sales')) {
        const sal = database.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
        sal.createIndex('date', 'date');
        sal.createIndex('patientId', 'patientId');
        sal.createIndex('userId', 'userId');
        sal.createIndex('paymentMethod', 'paymentMethod');
      }

      // Sale items
      if (!database.objectStoreNames.contains('saleItems')) {
        const si = database.createObjectStore('saleItems', { keyPath: 'id', autoIncrement: true });
        si.createIndex('saleId', 'saleId');
        si.createIndex('productId', 'productId');
        si.createIndex('lotId', 'lotId');
      }

      // Prescriptions
      if (!database.objectStoreNames.contains('prescriptions')) {
        const prx = database.createObjectStore('prescriptions', { keyPath: 'id', autoIncrement: true });
        prx.createIndex('patientId', 'patientId');
        prx.createIndex('date', 'date');
        prx.createIndex('status', 'status');
      }

      // Patients
      if (!database.objectStoreNames.contains('patients')) {
        const pat = database.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
        pat.createIndex('name', 'name');
        pat.createIndex('phone', 'phone');
      }

      // Users
      if (!database.objectStoreNames.contains('users')) {
        const us = database.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        us.createIndex('username', 'username', { unique: true });
        us.createIndex('role', 'role');
      }

      // Sessions
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'id' });
      }

      // Alerts
      if (!database.objectStoreNames.contains('alerts')) {
        const als = database.createObjectStore('alerts', { keyPath: 'id', autoIncrement: true });
        als.createIndex('type', 'type');
        als.createIndex('status', 'status');
        als.createIndex('date', 'date');
      }

      // Sync queue
      if (!database.objectStoreNames.contains('syncQueue')) {
        const sq = database.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        sq.createIndex('status', 'status');
        sq.createIndex('timestamp', 'timestamp');
      }

      // Audit log
      if (!database.objectStoreNames.contains('auditLog')) {
        const al = database.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
        al.createIndex('userId', 'userId');
        al.createIndex('action', 'action');
        al.createIndex('timestamp', 'timestamp');
      }

      // Settings
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }

      // Cash register
      if (!database.objectStoreNames.contains('cashRegister')) {
        const cr = database.createObjectStore('cashRegister', { keyPath: 'id', autoIncrement: true });
        cr.createIndex('date', 'date');
        cr.createIndex('type', 'type');
      }

      // Returns (retours médicaments) — v2
      if (!database.objectStoreNames.contains('returns')) {
        const ret = database.createObjectStore('returns', { keyPath: 'id', autoIncrement: true });
        ret.createIndex('saleId', 'saleId');
        ret.createIndex('date', 'date');
        ret.createIndex('status', 'status');
        ret.createIndex('userId', 'userId');
        ret.createIndex('patientId', 'patientId');
      }
    };
  });
}

// Sync debounce & guard
let _syncTimer = null;
let _syncInProgress = false;

function _scheduleSyncToSupabase() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    syncToSupabase().catch(() => { });
  }, 5000); // Wait 5s after last write before syncing
}

// Internal put that does NOT reset _synced and does NOT trigger sync
// Used exclusively by syncToSupabase to mark items as synced
function _dbPutRaw(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Generic CRUD operations
async function dbAdd(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.add({ ...data, _createdAt: Date.now(), _updatedAt: Date.now(), _synced: false });
    req.onsuccess = () => {
      resolve(req.result);
      if (AppState.isOnline) _scheduleSyncToSupabase();
    };
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put({ ...data, _updatedAt: Date.now(), _synced: false });
    req.onsuccess = () => {
      resolve(req.result);
      if (AppState.isOnline) _scheduleSyncToSupabase();
    };
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(storeName, indexName, query) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    let req;
    if (indexName && query !== undefined) {
      const index = store.index(indexName);
      req = index.getAll(query);
    } else {
      req = store.getAll();
    }
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function dbCount(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Audit log writer
async function writeAudit(action, entity, entityId, details, userId) {
  try {
    await dbAdd('auditLog', {
      action,
      entity,
      entityId,
      details,
      userId: userId || AppState.currentUser?.id,
      username: AppState.currentUser?.username,
      timestamp: Date.now(),
      ip: 'local'
    });
  } catch (e) {
    console.warn('Audit write failed:', e);
  }
}

// Initialisation des paramètres de base (aucune donnée de test)
async function seedDemoData() {
  // Vérifier si déjà initialisé
  const settings = await dbGetAll('settings');
  const alreadySeeded = settings.find(s => s.key === 'seeded');
  if (alreadySeeded) return;

  console.log('[DB] Initialisation des paramètres de base...');

  // Settings essentiels uniquement
  await dbPut('settings', { key: 'currency', value: 'GNF' });
  await dbPut('settings', { key: 'seeded', value: true });

  console.log('[DB] Paramètres initialisés. Aucune donnée de test créée.');
}

async function trackInstallation() {
  // Enregistrement facultatif dans une table pharmacies_registry.
  // Si la table n'existe pas dans le Supabase du client, on ignore silencieusement.
  try {
    const sb = await getSupabaseClient();
    if (!sb) return;
    const settings = await dbGetAll('settings');
    const name = settings.find(s => s.key === 'pharmacy_name')?.value || 'Inconnue';
    const address = settings.find(s => s.key === 'pharmacy_address')?.value || 'Inconnue';

    await sb.from('pharmacies_registry').insert([
      { name, address, installed_at: new Date().toISOString() }
    ]);
    console.log('[DB] Installation tracked.');
  } catch (e) {
    // Table might not exist — this is expected and safe to ignore
    console.warn('[DB] Tracking skipped (table may not exist):', e.message);
  }
}

async function syncToSupabase() {
  if (_syncInProgress) return;
  _syncInProgress = true;

  try {
    const sb = await getSupabaseClient();
    if (!sb) {
      console.log('[Sync] Cloud sync skipped: Supabase not configured.');
      return;
    }
    if (!navigator.onLine) {
      console.log('[Sync] Cloud sync skipped: Offline.');
      return;
    }

    const storesToSync = ['products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders', 'sales', 'saleItems', 'patients', 'prescriptions', 'alerts', 'cashRegister', 'auditLog', 'users', 'settings', 'returns'];

    for (const storeName of storesToSync) {
      try {
        const all = await dbGetAll(storeName);
        const pending = all.filter(item => item._synced === false);

        if (pending.length === 0) continue;

        console.log(`[Sync] 📤 Sending ${pending.length} items from ${storeName}...`);

        const payloads = pending.map(item => {
          const payload = {};
          for (const [key, value] of Object.entries(item)) {
            if (!key.startsWith('_')) {
              // BigInt safety for userId
              if (key === 'userId' && typeof value === 'string' && value.startsWith('session_')) {
                payload[key] = DB.AppState.currentUser?.id || 1;
              } else {
                payload[key] = value;
              }
            }
          }
          // Mapping _updatedAt to updatedAt for Supabase
          if (item._updatedAt) payload.updatedAt = item._updatedAt;
          return payload;
        });

        const { error } = await sb
          .from(storeName)
          .upsert(payloads, {
            onConflict: storeName === 'settings' ? 'key' : 'id',
            ignoreDuplicates: false
          });

        if (!error) {
          for (const item of pending) {
            item._synced = true;
            await _dbPutRaw(storeName, item);
          }
          console.log(`[Sync] ✅ ${pending.length} items synced for ${storeName}`);
        } else {
          console.error(`[Sync] ❌ Error in ${storeName}:`, error.message || error);
        }
      } catch (storeError) {
        console.error(`[Sync] Exception in ${storeName}:`, storeError);
      }
    }
  } catch (globalError) {
    console.error('[Sync] Critical sync error:', globalError);
  } finally {
    _syncInProgress = false;
  }
}

/**
 * PULL : Download data from Supabase to local IndexedDB
 */
async function pullFromSupabase() {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !navigator.onLine) {
      console.warn('[Sync] Cannot pull: No Supabase client or offline.');
      return;
    }

    console.log('[Sync] 📥 Pulling data from Supabase...');
    const storesToPull = [
      'products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders',
      'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
      'cashRegister', 'auditLog', 'users', 'settings', 'returns'
    ];

    for (const storeName of storesToPull) {
      console.log(`[Sync] Fetching ${storeName}...`);
      const { data, error } = await sb.from(storeName).select('*');

      if (error) {
        console.warn(`[Sync] Could not pull ${storeName}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        console.log(`[Sync] 📥 Downloaded ${data.length} items for ${storeName}`);
        for (const item of data) {
          // Meta-data transformation: map back to local convention
          const localItem = { ...item, _synced: true, _updatedAt: item.updatedAt || Date.now() };

          // CRITICAL: Handle unique constraints
          if (storeName === 'products' && localItem.code) {
            const existing = await dbGetAll('products', 'code', localItem.code);
            if (existing.length > 0) {
              await _dbPutRaw(storeName, { ...existing[0], ...localItem });
              continue;
            }
          }
          if (storeName === 'settings' && localItem.key) {
            await _dbPutRaw(storeName, localItem);
            continue;
          }
          if (storeName === 'users' && localItem.username) {
            const existing = await dbGetAll('users', 'username', localItem.username);
            if (existing.length > 0) {
              await _dbPutRaw(storeName, { ...existing[0], ...localItem });
              continue;
            }
          }

          // Fallback to standard put
          await _dbPutRaw(storeName, localItem);
        }
      }
    }
    console.log('[Sync] 🏁 Pull complete.');
  } catch (e) {
    console.error('[Sync] Pull failed:', e);
  }
}

/**
 * FORCE SYNC: Re-mark everything as pending and push to cloud
 */
async function forceSyncAll() {
  const stores = [
    'products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders',
    'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
    'cashRegister', 'auditLog', 'users', 'settings', 'returns'
  ];

  for (const s of stores) {
    const all = await dbGetAll(s);
    for (const item of all) {
      await _dbPutRaw(s, { ...item, _synced: false });
    }
  }
  return syncToSupabase();
}

function resetSupabaseClient() {
  console.log('[DB] Supabase client reset.');
  _supabaseInstance = null;
}

window.DB = { initDB, dbAdd, dbPut, dbGet, dbGetAll, dbDelete, dbCount, writeAudit, seedDemoData, syncToSupabase, pullFromSupabase, resetSupabaseClient, forceSyncAll, trackInstallation, STORES, AppState };
