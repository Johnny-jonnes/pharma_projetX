/**
 * PHARMA_PROJET — Settings, Users, Login
 */

function renderLogin(container) {
  document.getElementById('app-sidebar')?.style.setProperty('display', 'none');
  document.getElementById('app-topbar')?.style.setProperty('display', 'none');
  document.getElementById('app-content').style.marginLeft = '0';
  document.getElementById('app-content').style.paddingTop = '0';

  container.innerHTML = `
    <div class="login-wrapper">
      <div class="login-aside">
        <div class="login-aside-content">
          <div class="login-header">
            <div class="login-logo-elite">
              <i data-lucide="activity"></i>
            </div>
            <h1 class="login-title-elite">Pharma<span>Projet</span></h1>
            <p class="login-subtitle-elite">L'excellence opérationnelle pour votre officine.</p>
          </div>

          <form id="login-form" class="login-form-elite" onsubmit="handleLogin(event)">
            <div class="input-group-elite">
              <label for="login-username">Identifiant</label>
              <div class="input-wrapper-elite">
                <i data-lucide="user"></i>
                <input type="text" id="login-username" placeholder="votre identifiant" required>
              </div>
            </div>
            
            <div class="input-group-elite">
              <label for="login-password">Mot de passe</label>
              <div class="input-wrapper-elite">
                <i data-lucide="lock"></i>
                <input type="password" id="login-password" placeholder="••••••••" required>
              </div>
            </div>

            <div id="login-error" class="login-error-elite" style="display:none"></div>

            <button type="submit" class="login-submit-elite" id="login-submit">
              <span>Se connecter</span>
              <i data-lucide="chevron-right"></i>
            </button>
          </form>

        </div>
        
        <div class="login-footer-elite">
          <span class="version-tag">PharmaProjet v3.0</span>
          <div class="network-tag ${navigator.onLine ? 'online' : 'offline'}">
            <i data-lucide="${navigator.onLine ? 'wifi' : 'wifi-off'}"></i>
            ${navigator.onLine ? 'Système synchronisé' : 'Mode hors-ligne'}
          </div>
        </div>
      </div>

      <div class="login-visual">
        <div class="mesh-gradient"></div>
        <div class="visual-content">
          <div class="glass-card">
            <div class="glass-icon"><i data-lucide="shield-check"></i></div>
            <h2>Sécurisez votre pharmacie</h2>
            <ul class="feature-list-elite">
              <li><i data-lucide="check"></i> Traçabilité patient de bout en bout</li>
              <li><i data-lucide="check"></i> Intelligence de gestion de stock</li>
              <li><i data-lucide="check"></i> Conformité DNPM Guinée garantie</li>
              <li><i data-lucide="check"></i> Paiements mobiles intégrés</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function setDemo(u, p) {
  document.getElementById('login-username').value = u;
  document.getElementById('login-password').value = p;
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit');
  const errEl = document.getElementById('login-error');

  btn.disabled = true;
  btn.textContent = 'Connexion...';
  errEl.style.display = 'none';

  try {
    const user = await Auth.login(username, password);
    if (user) {
      document.getElementById('app-sidebar')?.style.removeProperty('display');
      document.getElementById('app-topbar')?.style.removeProperty('display');
      document.getElementById('app-content').style.marginLeft = '';
      document.getElementById('app-content').style.paddingTop = '';
      // Log access
      await DB.writeAudit('LOGIN', 'user', user.id, { username: user.username });

      // Navigate to dashboard
      initSidebar();
      updateTopbar();
      Router.navigate('dashboard');
      UI.toast(`Bienvenue, ${user.name} !`, 'success');
    } else {
      errEl.textContent = 'Identifiant ou mot de passe incorrect';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Erreur de connexion : ' + err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Connexion <i data-lucide="arrow-right"></i>`;
    if (window.lucide) lucide.createIcons();
  }
}

async function renderSettings(container) {
  if (DB.AppState.currentUser?.role !== 'admin') {
    container.innerHTML = `<div class="error-state">Accès refusé — Réservé à l'administrateur</div>`;
    return;
  }

  const [users, auditLog, settingsData] = await Promise.all([
    DB.dbGetAll('users'),
    DB.dbGetAll('auditLog'),
    DB.dbGetAll('settings'),
  ]);

  // Load settings into a map
  const gs = k => settingsData.find(s => s.key === k)?.value || '';

  const recentAudit = auditLog.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Paramètres & Administration</h1>
        <p class="page-subtitle">Gestion des utilisateurs, sécurité et configuration</p>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Pharmacy Info -->
      <div class="settings-card">
        <h3 class="settings-card-title"><i data-lucide="hospital"></i> Informations Pharmacie</h3>
        <form id="settings-form" class="form-grid">
          <div class="form-group">
            <label>Nom de la pharmacie</label>
            <input type="text" name="pharmacy_name" class="form-control" value="${gs('pharmacy_name') || 'Pharmacie Centrale de Conakry'}">
          </div>
          <div class="form-group">
            <label>Adresse</label>
            <input type="text" name="pharmacy_address" class="form-control" value="${gs('pharmacy_address') || 'Avenue de la République, Conakry'}">
          </div>
          <div class="form-group">
            <label>Slogan / Phrase d'accroche</label>
            <input type="text" name="pharmacy_slogan" class="form-control" value="${gs('pharmacy_slogan') || 'Santé & Technologie'}" placeholder="Ex: Votre santé, notre priorité">
          </div>
          <div class="form-group">
            <label>Logo de la pharmacie</label>
            <div id="logo-preview-container" class="settings-logo-container">
              ${gs('pharmacy_logo') ? `
                <img src="${gs('pharmacy_logo')}" id="settings-logo-img" style="max-height: 80px; object-fit: contain; margin-bottom: 0.5rem; display: block;">
                <button type="button" class="btn btn-xs btn-danger" onclick="removeLogo()"><i data-lucide="trash-2"></i> Supprimer le logo</button>
              ` : `
                <div class="logo-placeholder" style="width: 60px; height: 60px; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 0.5rem;"><i data-lucide="image"></i></div>
                <button type="button" class="btn btn-xs btn-secondary" onclick="document.getElementById('logo-upload').click()"><i data-lucide="upload"></i> Choisir un logo...</button>
              `}
              <input type="file" id="logo-upload" accept="image/*" style="display: none;" onchange="handleLogoUpload(event)">
              <input type="hidden" name="pharmacy_logo" id="pharmacy-logo-input" value="${gs('pharmacy_logo') || ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Téléphone</label>
              <input type="text" name="pharmacy_phone" class="form-control" value="${gs('pharmacy_phone') || '+224 620 000 000'}">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="pharmacy_email" class="form-control" value="${gs('pharmacy_email') || ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>N° Licence DNPM</label>
              <input type="text" name="pharmacy_dnpm" class="form-control" value="${gs('pharmacy_dnpm') || 'LIC-DNPM-2024-001'}">
            </div>
            <div class="form-group">
              <label>Pharmacien responsable</label>
              <input type="text" name="pharmacy_resp" class="form-control" value="${gs('pharmacy_resp') || 'Pharmacien Responsable'}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Seuil alerte stock</label>
              <input type="number" name="min_stock_alert" class="form-control" value="${gs('min_stock_alert') || '10'}">
            </div>
            <div class="form-group">
              <label>Alerte expiration (jours)</label>
              <input type="number" name="expiry_alert_days" class="form-control" value="${gs('expiry_alert_days') || '90'}">
            </div>
          </div>
          <button type="button" class="btn btn-primary" onclick="saveSettings()"><i data-lucide="save"></i> Sauvegarder les paramètres</button>
        </form>
      </div>

      <!-- Users Management (Admin Only) -->
      ${DB.AppState.currentUser?.role === 'admin' ? `
      <div class="settings-card">
        <div class="panel-header">
          <h3 class="settings-card-title"><i data-lucide="users"></i> Gestion des Utilisateurs</h3>
          <button class="btn btn-sm btn-primary" onclick="showAddUser()"><i data-lucide="plus"></i> Ajouter</button>
        </div>
        <div class="users-list">
          ${users.map(u => `
            <div class="user-item">
              <div class="user-avatar">${u.name?.charAt(0).toUpperCase() || '?'}</div>
              <div class="user-info">
                <div class="user-name">${u.name}</div>
                <div class="user-meta">
                  <code>${u.username}</code>
                  ${UI.roleBadge(u.role)}
                  <span class="badge badge-${u.active ? 'success' : 'neutral'}">${u.active ? 'Actif' : 'Inactif'}</span>
                </div>
              </div>
              <button class="btn btn-xs btn-secondary" onclick="editUser(${u.id})"><i data-lucide="edit-3"></i></button>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Sync Status -->
      <div class="settings-card">
        <h3 class="settings-card-title"><i data-lucide="rotate-cw"></i> Synchronisation & Sauvegarde</h3>
        <div class="sync-panel">
          <div class="sync-status-row">
            <span>Statut réseau</span>
            <span class="${navigator.onLine ? 'text-success' : 'text-danger'}">${navigator.onLine ? '<i data-lucide="wifi"></i> En ligne' : '<i data-lucide="wifi-off"></i> Hors ligne'}</span>
          </div>
          <div class="sync-status-row">
            <span>Dernière sync</span>
            <span class="text-muted">${UI.formatDateTime(Date.now())}</span>
          </div>
          <div class="sync-status-row">
            <span>Mode opération</span>
            <span class="badge badge-success">Offline-First <i data-lucide="check"></i></span>
          </div>
          <div class="sync-actions">
            <button class="btn btn-secondary" onclick="doBackup()"><i data-lucide="save"></i> Sauvegarder maintenant</button>
            <button class="btn btn-ghost" onclick="restoreBackup()"><i data-lucide="folder-open"></i> Restaurer une sauvegarde</button>
          </div>
          <hr style="margin: 1rem 0; opacity: 0.1;">
          <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem;">Configuration Supabase (Cloud Sync)</h4>
          <form id="supabase-config-form" class="form-grid">
            <div class="form-group">
              <label>URL Supabase</label>
              <input type="password" name="supabase_url" class="form-control" value="${gs('supabase_url') || ''}" placeholder="https://xyz.supabase.co">
            </div>
            <div class="form-group">
              <label>Clé Supabase (Anon Public)</label>
              <input type="password" name="supabase_key" class="form-control" value="${gs('supabase_key') || ''}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...">
            </div>
            <button type="button" class="btn btn-xs btn-secondary" onclick="saveSupabaseConfig()">Enregistrer la config Cloud</button>
          </form>
        </div>
      </div>

      <!-- Audit Log -->
      <div class="settings-card settings-card-wide">
        <h3 class="settings-card-title"><i data-lucide="clipboard-list"></i> Journal d'Audit (20 dernières actions)</h3>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Date/Heure</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>Détails</th></tr></thead>
            <tbody>
              ${recentAudit.map(log => `
                <tr>
                  <td class="text-sm">${UI.formatDateTime(log.timestamp)}</td>
                  <td><code>${log.username || '—'}</code></td>
                  <td><span class="badge badge-neutral">${log.action}</span></td>
                  <td>${log.entity || '—'}</td>
                  <td class="text-muted text-sm">${JSON.stringify(log.details || {}).substring(0, 60)}...</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function saveSettings() {
  const form = document.getElementById('settings-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  try {
    for (const [key, value] of Object.entries(data)) {
      const existing = (await DB.dbGetAll('settings')).find(s => s.key === key);
      if (existing) {
        await DB.dbPut('settings', { ...existing, value, updatedAt: Date.now() });
      } else {
        await DB.dbAdd('settings', { key, value, updatedAt: Date.now() });
      }
    }
    await DB.writeAudit('SAVE_SETTINGS', 'settings', null, data);
    updatePharmacyDisplay();
    UI.toast('Paramètres sauvegardés avec succès', 'success');
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

function showAddUser() {
  UI.modal('<i data-lucide="user-plus" class="modal-icon-inline"></i> Nouvel Utilisateur', `
    <form id="user-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" name="name" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Identifiant *</label>
          <input type="text" name="username" class="form-control" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Mot de passe *</label>
          <input type="password" name="password" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Rôle *</label>
          <select name="role" class="form-control" required>
            <option value="caissier">Caissier</option>
            <option value="pharmacien">Pharmacien</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" class="form-control">
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitUser()"><i data-lucide="check"></i> Créer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function submitUser() {
  const form = document.getElementById('user-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  data.active = true;
  try {
    await DB.dbAdd('users', data);
    await DB.writeAudit('ADD_USER', 'users', null, { name: data.name, username: data.username, role: data.role });
    UI.closeModal();
    UI.toast('Utilisateur créé', 'success');
    Router.navigate('settings');
  } catch (err) {
    UI.toast('Erreur : ' + (err.message.includes('unique') ? 'Cet identifiant existe déjà' : err.message), 'error');
  }
}

async function editUser(id) {
  const u = await DB.dbGet('users', id);
  if (!u) { UI.toast('Utilisateur introuvable', 'error'); return; }

  UI.modal('<i data-lucide="edit-3" class="modal-icon-inline"></i> Modifier l\'utilisateur', `
    <form id="edit-user-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" name="name" class="form-control" value="${u.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Identifiant</label>
          <input type="text" class="form-control" value="${u.username}" disabled>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nouveau mot de passe</label>
          <input type="password" name="password" class="form-control" placeholder="(laisser vide pour ne pas changer)">
        </div>
        <div class="form-group">
          <label>Rôle *</label>
          <select name="role" class="form-control" required>
            <option value="caissier" ${u.role === 'caissier' ? 'selected' : ''}>Caissier</option>
            <option value="pharmacien" ${u.role === 'pharmacien' ? 'selected' : ''}>Pharmacien</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrateur</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" class="form-control" value="${u.email || ''}">
        </div>
        <div class="form-group">
          <label>Statut</label>
          <select name="active" class="form-control">
            <option value="true" ${u.active ? 'selected' : ''}>Actif</option>
            <option value="false" ${!u.active ? 'selected' : ''}>Inactif — Désactivé</option>
          </select>
        </div>
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="updateUser(${u.id})"><i data-lucide="check"></i> Enregistrer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function updateUser(id) {
  const form = document.getElementById('edit-user-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  const original = await DB.dbGet('users', id);
  if (!original) return;

  const updated = {
    ...original,
    name: data.name,
    role: data.role,
    email: data.email || '',
    active: data.active === 'true',
  };
  if (data.password && data.password.trim()) {
    updated.password = data.password;
  }

  try {
    await DB.dbPut('users', updated);
    await DB.writeAudit('EDIT_USER', 'users', id, { name: updated.name, role: updated.role, active: updated.active });
    UI.closeModal();
    UI.toast('Utilisateur modifié', 'success');
    Router.navigate('settings');
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function doBackup() {
  const stores = ['products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders', 'sales', 'saleItems', 'prescriptions', 'patients', 'users', 'auditLog', 'settings', 'alerts', 'cashRegister', 'returns'];
  const backup = {};
  for (const s of stores) {
    backup[s] = await DB.dbGetAll(s);
  }
  backup._exportDate = new Date().toISOString();
  backup._version = '1.0';

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `pharma_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  UI.toast('Sauvegarde téléchargée', 'success');
}

function restoreBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ok = await UI.confirm('⚠️ Restaurer une sauvegarde remplacera toutes les données actuelles.\n\nCette action est irréversible. Continuer ?');
    if (!ok) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const stores = ['products', 'lots', 'stock', 'movements', 'suppliers', 'sales', 'saleItems', 'prescriptions', 'patients', 'settings', 'alerts', 'cashRegister', 'purchaseOrders'];
      for (const s of stores) {
        if (data[s] && Array.isArray(data[s])) {
          for (const item of data[s]) {
            await DB.dbPut(s, item);
          }
        }
      }
      await DB.writeAudit('RESTORE_BACKUP', 'system', null, { file: file.name, date: data._exportDate });
      UI.toast('Sauvegarde restaurée avec succès. Rechargement...', 'success', 3000);
      setTimeout(() => location.reload(), 2000);
    } catch (err) {
      UI.toast('Erreur de restauration : ' + err.message, 'error');
    }
  };
  input.click();
}

async function updatePharmacyDisplay() {
  const settings = await DB.dbGetAll('settings');
  const gs = k => settings.find(s => s.key === k)?.value || '';

  const name = gs('pharmacy_name') || 'PharmaProjet';
  const slogan = gs('pharmacy_slogan') || 'Santé & Technologie';
  const logo = gs('pharmacy_logo');

  const nameEl = document.getElementById('pharmacy-name-display');
  const sloganEl = document.getElementById('pharmacy-slogan-display');
  const logoEl = document.getElementById('sidebar-logo-icon');

  if (nameEl) nameEl.textContent = name;
  if (sloganEl) sloganEl.textContent = slogan;
  if (logoEl) {
    if (logo) {
      logoEl.innerHTML = `<img src="${logo}" style="width:100%; height:100%; object-fit:contain; border-radius:4px;">`;
    } else {
      logoEl.innerHTML = '<i data-lucide="activity"></i>';
    }
    if (window.lucide) lucide.createIcons();
  }
}

async function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 1024 * 1024) { // 1MB limit for IndexedDB/Supabase safety
    UI.toast('L\'image est trop lourde (max 1Mo)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    document.getElementById('pharmacy-logo-input').value = base64;

    const container = document.getElementById('logo-preview-container');
    // Preserve the hidden input and file input
    const hiddenInput = document.getElementById('pharmacy-logo-input');
    const fileInput = document.getElementById('logo-upload');
    container.innerHTML = `
      <img src="${base64}" id="settings-logo-img" style="max-height: 80px; object-fit: contain; margin-bottom: 0.5rem; display: block;">
      <button type="button" class="btn btn-xs btn-danger" onclick="removeLogo()"><i data-lucide="trash-2"></i> Supprimer le logo</button>
    `;
    container.appendChild(fileInput);
    container.appendChild(hiddenInput);
    hiddenInput.value = base64;
    UI.toast('Logo prêt (cliquez sur Sauvegarder pour appliquer)', 'info');
    if (window.lucide) lucide.createIcons();
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  document.getElementById('pharmacy-logo-input').value = '';
  const container = document.getElementById('logo-preview-container');
  container.innerHTML = `
    <div class="logo-placeholder" style="width: 60px; height: 60px; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 0.5rem;"><i data-lucide="image"></i></div>
    <button type="button" class="btn btn-xs btn-secondary" onclick="document.getElementById('logo-upload').click()"><i data-lucide="upload"></i> Choisir un logo...</button>
    <input type="file" id="logo-upload" accept="image/*" style="display: none;" onchange="handleLogoUpload(event)">
    <input type="hidden" name="pharmacy_logo" id="pharmacy-logo-input" value="">
  `;
  if (window.lucide) lucide.createIcons();
}

async function saveSupabaseConfig() {
  const form = document.getElementById('supabase-config-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  try {
    for (const [key, value] of Object.entries(data)) {
      const existing = (await DB.dbGetAll('settings')).find(s => s.key === key);
      if (existing) {
        await DB.dbPut('settings', { ...existing, value, updatedAt: Date.now() });
      } else {
        await DB.dbAdd('settings', { key, value, updatedAt: Date.now() });
      }
    }
    UI.toast('Configuration Supabase enregistrée', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

window.updatePharmacyDisplay = updatePharmacyDisplay;
window.saveSupabaseConfig = saveSupabaseConfig;
window.handleLogoUpload = handleLogoUpload;
window.removeLogo = removeLogo;
window.handleLogin = handleLogin;
window.setDemo = setDemo;
window.showAddUser = showAddUser;
window.submitUser = submitUser;
window.editUser = editUser;
window.updateUser = updateUser;
window.saveSettings = saveSettings;
window.doBackup = doBackup;
window.restoreBackup = restoreBackup;

Router.register('login', renderLogin);
Router.register('settings', renderSettings);

