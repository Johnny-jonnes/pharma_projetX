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
      _supabaseInstance = window.supabase.createClient(url.trim(), key.trim());
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

  if (urlParams.get('reset') === 'true') {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => {
        localStorage.clear();
        window.location.href = window.location.pathname;
      };
      req.onerror = () => {
        console.error("Failed to delete local DB");
        resolve(); // proceed anyway
      };
    });
  }

  const sbUrl = urlParams.get('sb_url');
  const sbKey = urlParams.get('sb_key');

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = async () => {
      db = request.result;

      // If URL params are present, update settings automatically
      if (sbUrl && sbKey) {

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
  }, 2000); // Réduit de 5s → 2s pour une réactivité cloud optimale
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



  // Settings essentiels uniquement
  await dbPut('settings', { key: 'currency', value: 'GNF' });
  await dbPut('settings', { key: 'seeded', value: true });


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

      return;
    }
    if (!navigator.onLine) {

      return;
    }

    const storesToSync = ['products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders', 'sales', 'saleItems', 'patients', 'prescriptions', 'alerts', 'cashRegister', 'auditLog', 'users', 'settings', 'returns'];

    for (const storeName of storesToSync) {
      try {
        const all = await dbGetAll(storeName);
        const pending = all.filter(item => item._synced === false);

        if (pending.length === 0) continue;



        const payloads = pending.map(item => {
          const payload = {};
          for (const [key, value] of Object.entries(item)) {
            if (!key.startsWith('_')) {
              // Sensitive columns that MUST remain Strings (even if numeric)
              const mustBeString = [
                'username', 'password', 'code', 'lotNumber', 'phone', 'dnpm',
                'pharmacy_phone', 'pharmacy_dnpm', 'pharmacy_name', 'key', 'value'
              ];

              if (mustBeString.includes(key)) {
                payload[key] = (value !== null && value !== undefined) ? String(value) : value;
                continue;
              }

              // Global BigInt safety for any numeric or session field
              if (typeof value === 'string') {
                if (value.startsWith('session_')) {
                  // Extract numeric part from session_123456789
                  payload[key] = parseInt(value.replace('session_', '')) || 1;
                } else if (/^\d+$/.test(value) && !value.startsWith('0')) {
                  // Only convert strings that are purely numeric TO integers IF they don't start with 0
                  // (preserving leading zeros for codes, phones, and passwords)
                  payload[key] = parseInt(value);
                } else {
                  payload[key] = value;
                }
              } else {
                payload[key] = value;
              }
            }
          }
          // Mapping _updatedAt to updatedAt for Supabase
          if (item._updatedAt) payload.updatedAt = item._updatedAt;

          // Ensure userId is never null ONLY for tables that have a userId column in Supabase
          const tablesWithUserId = ['sales', 'movements', 'cashRegister', 'auditLog'];
          if (tablesWithUserId.includes(storeName)) {
            if (payload.userId === undefined || payload.userId === null) {
              payload.userId = AppState.currentUser?.id || 1;
            }
          }

          return payload;
        });

        const { error } = await sb
          .from(storeName === 'users' ? 'app_users' : storeName)
          .upsert(payloads, {
            onConflict: storeName === 'settings' ? 'key' : 'id',
            ignoreDuplicates: false
          });

        if (!error) {
          for (const item of pending) {
            item._synced = true;
            await _dbPutRaw(storeName, item);
          }

        } else {
          console.error(`[Sync] ❌ Error in ${storeName}:`, error.message || error);
          if (AppState.currentPage === 'settings') {
            UI.toast(`Sync failed for ${storeName}: ${error.message}`, 'error');
          }
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


    const storesToPull = [
      'products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders',
      'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
      'cashRegister', 'auditLog', 'users', 'settings', 'returns'
    ];

    for (const storeName of storesToPull) {

      const { data, error } = await sb.from(storeName === 'users' ? 'app_users' : storeName).select('*');

      if (error) {
        console.warn(`[Sync] Could not pull ${storeName}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {

        for (const item of data) {
          try {
            // Meta-data transformation: map back to local convention
            const localItem = { ...item, _synced: true, _updatedAt: item.updatedAt || Date.now() };

            // CRITICAL: Force sensitive fields to String to prevent numeric breakage
            const mustBeString = [
              'username', 'password', 'code', 'lotNumber', 'phone', 'dnpm',
              'pharmacy_phone', 'pharmacy_dnpm', 'pharmacy_name', 'key', 'value'
            ];
            for (const key of Object.keys(localItem)) {
              if (mustBeString.includes(key) || (storeName === 'settings' && key === 'value')) {
                if (localItem[key] !== undefined && localItem[key] !== null) {
                  localItem[key] = String(localItem[key]);
                }
              }
            }

            // CRITICAL: Handle unique constraints to avoid ConstraintError
            if (storeName === 'products' && localItem.code) {
              const existing = await dbGetAll('products', 'code', localItem.code);
              if (existing.length > 0) {
                // IMPORTANT: preserve local ID to update existing record instead of creating conflict
                await _dbPutRaw(storeName, { ...localItem, id: existing[0].id });
                continue;
              }
            }
            if (storeName === 'stock' && localItem.productId) {
              const existing = await dbGetAll('stock', 'productId', localItem.productId);
              if (existing.length > 0) {
                await _dbPutRaw(storeName, { ...localItem, id: existing[0].id });
                continue;
              }
            }
            if (storeName === 'settings' && localItem.key) {
              const existing = await DB.dbGet('settings', localItem.key);
              if (existing) {
                console.log(`[Sync] Updating setting: ${localItem.key}`);
                await _dbPutRaw(storeName, localItem);
              } else {
                console.log(`[Sync] Adding new setting: ${localItem.key}`);
                await _dbPutRaw(storeName, localItem);
              }
              continue;
            }
            if (storeName === 'users' && localItem.username) {
              const existing = await dbGetAll('users', 'username', localItem.username);
              if (existing.length > 0) {
                // Cloud/Supabase version MUST overwrite local user (especially for passwords)
                await _dbPutRaw(storeName, { ...localItem, id: existing[0].id });
                continue;
              }
            }

            // Fallback to standard put
            await _dbPutRaw(storeName, localItem);
          } catch (itemError) {
            console.warn(`[Sync] Failed to pull item for store ${storeName}:`, itemError, item);
            // We continue to next item
          }
        }
      }
    }

    // Final refresh of display if settings were updated
    if (window.updatePharmacyDisplay) {
      await window.updatePharmacyDisplay();
    }
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

/**
 * AUTO-BACKUP : Sauvegarde automatique locale (localStorage) et périodique
 * - Backup silencieux dans localStorage toutes les 30 minutes
 * - Structure : pharma_backup_<date> = JSON de toutes les données
 */
async function autoBackupToStorage() {
  try {
    const stores = [
      'products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders',
      'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
      'cashRegister', 'auditLog', 'users', 'settings', 'returns'
    ];

    const backup = {
      version: window.APP_VERSION || '3.5.0',
      exportedAt: new Date().toISOString(),
      exportedBy: AppState.currentUser?.name || 'Système',
      pharmacy: null,
      data: {}
    };

    for (const s of stores) {
      backup.data[s] = await dbGetAll(s);
    }

    // Récupérer le nom de la pharmacie pour le backup
    const settings = backup.data.settings || [];
    backup.pharmacy = settings.find(s => s.key === 'pharmacy_name')?.value || 'PharmaProjet';

    // Stocker dans localStorage (backup silencieux)
    const key = `pharma_auto_backup_${new Date().toISOString().split('T')[0]}`;
    localStorage.setItem(key, JSON.stringify(backup));
    localStorage.setItem('pharma_last_backup', new Date().toISOString());

    // Nettoyer les vieux backups (garder seulement les 7 derniers jours)
    const keysToDelete = Object.keys(localStorage)
      .filter(k => k.startsWith('pharma_auto_backup_'))
      .sort()
      .reverse()
      .slice(7);
    keysToDelete.forEach(k => localStorage.removeItem(k));

    console.log('[Backup] ✅ Sauvegarde automatique effectuée:', key);
    return backup;
  } catch (e) {
    console.warn('[Backup] Échec backup automatique:', e);
    return null;
  }
}

/**
 * BACKUP MANUEL : Télécharge un fichier JSON complet (déclenché par bouton)
 */
async function doBackup() {
  try {
    const backup = await autoBackupToStorage();
    if (!backup) throw new Error('Échec de la génération du backup');

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `pharmaprojet_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.UI) UI.toast('💾 Sauvegarde téléchargée avec succès', 'success');
    return true;
  } catch (e) {
    console.error('[Backup] Erreur export manuel:', e);
    if (window.UI) UI.toast('Erreur lors de la sauvegarde : ' + e.message, 'error');
    return false;
  }
}

/**
 * DÉMARRAGE AUTO-BACKUP : Lance le backup automatique périodique
 * Appelé une fois au démarrage de l'app
 */
function startAutoBackup() {
  // Backup initial au démarrage (après 10 secondes pour laisser l'app s'initialiser)
  setTimeout(async () => {
    await autoBackupToStorage();
  }, 10000);

  // Backup toutes les 30 minutes
  setInterval(async () => {
    await autoBackupToStorage();
    // Si en ligne, synchroniser aussi vers le cloud
    if (AppState.isOnline) {
      syncToSupabase().catch(() => { });
    }
  }, 30 * 60 * 1000); // 30 minutes

  console.log('[Backup] ✅ Auto-backup démarré (toutes les 30 min)');
}

/**
 * AUTO-PULL : Synchronisation cloud → local automatique
 * Déclenché toutes les 5 minutes si en ligne
 */
function startAutoPull() {
  setInterval(async () => {
    if (AppState.isOnline) {
      try {
        await pullFromSupabase();
        console.log('[Sync] ⬇️ Pull automatique effectué');
      } catch (e) {
        console.warn('[Sync] Auto-pull échoué:', e);
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * RESTAURATION SÉCURISÉE "ZERO LOSS"
 * Procédure : Backup de secours auto -> Backup localStorage -> Wipe -> Restore -> Audit
 */
async function restoreFromBackup(backupData) {
  try {
    // 1. PHASE DE PRÉSERVATION (Auto-download de l'état actuel)
    console.log('[Restore] 🛡️ Phase 1 : Sauvegarde de secours automatique...');
    await doBackup();

    // 2. PHASE D'URGENCE (Copie en localStorage)
    console.log('[Restore] 🛡️ Phase 2 : Copie d\'urgence en localStorage...');
    const emergencyBackup = await autoBackupToStorage();
    if (emergencyBackup) {
      localStorage.setItem('pharma_emergency_restore', JSON.stringify(emergencyBackup));
    }

    // 3. PHASE DE VALIDATION DU FICHIER
    console.log('[Restore] 🛡️ Phase 3 : Validation du fichier...');
    if (!backupData || typeof backupData !== 'object') throw new Error('Données de sauvegarde invalides');

    // Support des deux formats (ancien _exportDate et nouveau exportedAt)
    const isPharmaBackup = backupData.data || backupData.products;
    if (!isPharmaBackup) throw new Error('Ce fichier ne semble pas être une sauvegarde PharmaProjet valide.');

    // 4. PHASE DE NETTOYAGE (Wipe)
    console.log('[Restore] 🛡️ Phase 4 : Nettoyage de la base de données locale...');
    const storesToClear = [
      'products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders',
      'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
      'cashRegister', 'auditLog', 'settings', 'returns'
    ];

    const db = await initDB();
    for (const storeName of storesToClear) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // 5. PHASE D'INJECTION
    console.log('[Restore] 🛡️ Phase 5 : Injection des nouvelles données...');
    const dataToImport = backupData.data || backupData; // Gère les deux structures de backup possible

    for (const storeName of storesToClear) {
      const items = dataToImport[storeName];
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await dbPut(storeName, item);
        }
      }
    }

    // 6. PHASE D'AUDIT ET FINALISATION
    console.log('[Restore] ✅ Restauration terminée avec succès.');
    await writeAudit('RESTORE_ZERO_LOSS', 'system', null, {
      timestamp: Date.now(),
      version: backupData.version || 'unknown'
    });

    return { success: true };
  } catch (e) {
    console.error('[Restore] ❌ Erreur critique lors de la restauration:', e);
    throw e;
  }
}

function resetSupabaseClient() {
  _supabaseInstance = null;
}

window.DB = { initDB, dbAdd, dbPut, dbGet, dbGetAll, dbDelete, dbCount, writeAudit, seedDemoData, syncToSupabase, pullFromSupabase, resetSupabaseClient, forceSyncAll, trackInstallation, STORES, AppState, doBackup, startAutoBackup, startAutoPull, autoBackupToStorage, restoreFromBackup };
