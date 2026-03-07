/**
 * PHARMA_PROJET — Module Patients
 * Dossiers patients, historique médicaments, allergies
 */

async function renderPatients(container) {
  UI.loading(container, 'Chargement des dossiers patients...');
  const [patients, prescriptions, sales] = await Promise.all([
    DB.dbGetAll('patients'),
    DB.dbGetAll('prescriptions'),
    DB.dbGetAll('sales'),
  ]);

  const sorted = patients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dossiers Patients</h1>
        <p class="page-subtitle">${patients.length} patients enregistrés — Données confidentielles</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="exportPatients()"><i data-lucide="download"></i> Exporter (anonymisé)</button>
        <button class="btn btn-primary" onclick="showAddPatient()"><i data-lucide="plus"></i> Nouveau Patient</button>
      </div>
    </div>

    <div class="privacy-banner">
      <i data-lucide="lock"></i> <strong>Données de santé protégées</strong> — Accès restreint au personnel soignant habilité. Archivage conforme DNPM.
    </div>

    <div class="filter-bar">
      <input type="text" id="patient-search" placeholder="Rechercher patient (nom, téléphone)..." class="filter-input" oninput="filterPatients()">
    </div>

    <div id="patients-table-container"></div>
  `;

  window._patientsData = sorted;
  window._patientsPrescriptions = prescriptions;
  filterPatients();
  if (window.lucide) lucide.createIcons();
}

function filterPatients() {
  const search = document.getElementById('patient-search')?.value.toLowerCase() || '';
  let data = window._patientsData || [];
  if (search) data = data.filter(p =>
    (p.name || '').toLowerCase().includes(search) ||
    (p.phone || '').toLowerCase().includes(search)
  );

  const container = document.getElementById('patients-table-container');
  if (!container) return;

  const rxMap = {};
  (window._patientsPrescriptions || []).forEach(rx => {
    if (!rxMap[rx.patientId]) rxMap[rx.patientId] = 0;
    rxMap[rx.patientId]++;
  });

  UI.table(container, [
    {
      label: 'Patient', render: r => `
      <div class="patient-name-cell">
        <div class="patient-avatar-sm">${r.name?.charAt(0).toUpperCase() || '?'}</div>
        <div><strong>${r.name}</strong><br><span class="text-muted text-sm">${r.phone || '—'}</span></div>
      </div>` },
    { label: 'Date de naissance', render: r => r.dob ? `${UI.formatDate(r.dob)} <span class="text-muted text-sm">(${calcAge(r.dob)} ans)</span>` : '—' },
    { label: 'Allergies', render: r => r.allergies ? `<span class="badge badge-danger"><i data-lucide="alert-triangle"></i> ${r.allergies}</span>` : '<span class="text-muted">Aucune connue</span>' },
    { label: 'Ordonnances', render: r => `<span class="badge badge-info">${rxMap[r.id] || 0}</span>` },
    { label: 'Adresse', render: r => r.address || '—' },
    {
      label: 'Actions', render: r => `
      <div class="actions-cell">
        <button class="btn btn-xs btn-primary" onclick="viewPatient(${r.id})"><i data-lucide="folder"></i> Dossier</button>
        <button class="btn btn-xs btn-secondary" onclick="editPatient(${r.id})"><i data-lucide="edit-3"></i></button>
      </div>` },
  ], data, { emptyMessage: 'Aucun patient trouvé', emptyIcon: 'user' });
  if (window.lucide) lucide.createIcons();
}

function calcAge(dob) {
  if (!dob) return '—';
  const birth = new Date(dob);
  const today = new Date();
  return today.getFullYear() - birth.getFullYear() - (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) ? 1 : 0);
}

async function viewPatient(patientId) {
  const [patient, prescriptions, saleItems] = await Promise.all([
    DB.dbGet('patients', patientId),
    DB.dbGetAll('prescriptions', 'patientId', patientId),
    DB.dbGetAll('saleItems'),
  ]);
  if (!patient) return;

  const sortedRx = prescriptions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Drug history from prescriptions
  const drugHistory = {};
  prescriptions.forEach(rx => {
    (rx.items || []).forEach(item => {
      if (!drugHistory[item.productName]) drugHistory[item.productName] = { count: 0, lastDate: null };
      drugHistory[item.productName].count++;
      if (!drugHistory[item.productName].lastDate || rx.date > drugHistory[item.productName].lastDate) {
        drugHistory[item.productName].lastDate = rx.date;
      }
    });
  });
  const topDrugs = Object.entries(drugHistory).sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  UI.modal(`<i data-lucide="folder" class="modal-icon-inline"></i> Dossier — ${patient.name}`, `
    <div class="patient-detail">
      <div class="patient-detail-header">
        <div class="patient-avatar-lg">${patient.name?.charAt(0).toUpperCase() || '?'}</div>
        <div class="patient-detail-info">
          <h2>${patient.name}</h2>
          <div class="patient-detail-meta">
            ${patient.dob ? `<span><i data-lucide="calendar"></i> ${UI.formatDate(patient.dob)} (${calcAge(patient.dob)} ans)</span>` : ''}
            ${patient.phone ? `<span><i data-lucide="phone"></i> ${patient.phone}</span>` : ''}
            ${patient.address ? `<span><i data-lucide="map-pin"></i> ${patient.address}</span>` : ''}
          </div>
          ${patient.allergies ? `<div class="allergy-alert"><i data-lucide="alert-triangle"></i> Allergie : <strong>${patient.allergies}</strong></div>` : ''}
        </div>
      </div>

      <div class="patient-stats-row">
        <div class="patient-stat-card">
          <div class="patient-stat-val">${prescriptions.length}</div>
          <div class="patient-stat-label">Ordonnances</div>
        </div>
        <div class="patient-stat-card">
          <div class="patient-stat-val">${prescriptions.filter(r => r.status === 'dispensed').length}</div>
          <div class="patient-stat-label">Dispensées</div>
        </div>
        <div class="patient-stat-card">
          <div class="patient-stat-val">${topDrugs.length}</div>
          <div class="patient-stat-label">Médicaments utilisés</div>
        </div>
      </div>

      ${topDrugs.length > 0 ? `
        <div class="patient-drugs-section">
          <h4><i data-lucide="pill"></i> Médicaments fréquents</h4>
          <div class="drugs-grid">
            ${topDrugs.map(([name, data]) => `
              <div class="drug-chip">
                <span class="drug-name">${name}</span>
                <span class="drug-count">${data.count}x</span>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <div class="patient-rx-history">
        <h4><i data-lucide="file-text"></i> Historique des Ordonnances</h4>
        ${sortedRx.length === 0 ? '<p class="text-muted">Aucune ordonnance enregistrée</p>' : `
          <table class="data-table">
            <thead><tr><th>N° Rx</th><th>Date</th><th>Médecin</th><th>Médicaments</th><th>Statut</th></tr></thead>
            <tbody>
              ${sortedRx.slice(0, 10).map(rx => `
                <tr>
                  <td><code class="code-tag">Rx-${String(rx.id).padStart(5, '0')}</code></td>
                  <td>${UI.formatDate(rx.date)}</td>
                  <td>${rx.doctorName || '—'}</td>
                  <td>${(rx.items || []).slice(0, 2).map(i => i.productName).join(', ')}${(rx.items || []).length > 2 ? '...' : ''}</td>
                  <td><span class="badge badge-${rx.status === 'dispensed' ? 'success' : 'warning'}">${rx.status}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>`}
      </div>

      ${patient.note ? `<div class="patient-note"><h4><i data-lucide="file-edit"></i> Notes</h4><p>${patient.note}</p></div>` : ''}

      <div class="patient-legal-footer">
        <span class="text-muted text-sm"><i data-lucide="lock"></i> Données confidentielles — Accès tracé — Conservation conforme DNPM</span>
      </div>
    </div>
  `, { size: 'large' });
  if (window.lucide) lucide.createIcons();
  // Log access to patient data
  await DB.writeAudit('VIEW_PATIENT', 'patients', patientId, { patientName: patient.name });
}

function showAddPatient() {
  UI.modal('<i data-lucide="user-plus" class="modal-icon-inline"></i> Nouveau Patient', `
    <form id="patient-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" name="name" class="form-control" required placeholder="Prénom Nom">
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" name="phone" class="form-control" placeholder="+224 6XX XXX XXX">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de naissance</label>
          <input type="date" name="dob" class="form-control">
        </div>
        <div class="form-group">
          <label>Sexe</label>
          <select name="gender" class="form-control">
            <option value="">Non précisé</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Adresse</label>
        <input type="text" name="address" class="form-control" placeholder="Quartier, commune, ville">
      </div>
      <div class="form-group">
        <label><i data-lucide="alert-triangle"></i> Allergies connues</label>
        <input type="text" name="allergies" class="form-control" placeholder="Ex: Pénicilline, Aspirine, Sulfamides... (laisser vide si aucune)">
      </div>
      <div class="form-group">
        <label>Antécédents médicaux</label>
        <textarea name="medicalHistory" class="form-control" rows="2" placeholder="HTA, Diabète, Asthme..."></textarea>
      </div>
      <div class="form-group">
        <label>Note</label>
        <textarea name="note" class="form-control" rows="2"></textarea>
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitPatient()"><i data-lucide="check"></i> Enregistrer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function submitPatient() {
  const form = document.getElementById('patient-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  try {
    const id = await DB.dbAdd('patients', data);
    await DB.writeAudit('ADD_PATIENT', 'patients', id, { name: data.name });
    UI.closeModal();
    UI.toast('Patient enregistré', 'success');
    Router.navigate('patients');
  } catch (err) { UI.toast('Erreur : ' + err.message, 'error'); }
}

async function editPatient(patientId) {
  const patient = await DB.dbGet('patients', patientId);
  if (!patient) return;
  UI.modal('<i data-lucide="edit-3" class="modal-icon-inline"></i> Modifier Patient', `
    <form id="edit-patient-form" class="form-grid">
      <div class="form-row">
        <div class="form-group"><label>Nom complet *</label><input type="text" name="name" class="form-control" value="${patient.name || ''}" required></div>
        <div class="form-group"><label>Téléphone</label><input type="tel" name="phone" class="form-control" value="${patient.phone || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Date de naissance</label><input type="date" name="dob" class="form-control" value="${patient.dob || ''}"></div>
        <div class="form-group"><label>Sexe</label><select name="gender" class="form-control"><option ${!patient.gender ? 'selected' : ''}>Non précisé</option><option value="M" ${patient.gender === 'M' ? 'selected' : ''}>Masculin</option><option value="F" ${patient.gender === 'F' ? 'selected' : ''}>Féminin</option></select></div>
      </div>
      <div class="form-group"><label>Adresse</label><input type="text" name="address" class="form-control" value="${patient.address || ''}"></div>
      <div class="form-group"><label><i data-lucide="alert-triangle"></i> Allergies</label><input type="text" name="allergies" class="form-control" value="${patient.allergies || ''}"></div>
      <div class="form-group"><label>Antécédents</label><textarea name="medicalHistory" class="form-control" rows="2">${patient.medicalHistory || ''}</textarea></div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="updatePatient(${patientId})"><i data-lucide="save"></i> Mettre à jour</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function updatePatient(patientId) {
  const form = document.getElementById('edit-patient-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  const existing = await DB.dbGet('patients', patientId);
  await DB.dbPut('patients', { ...existing, ...data });
  await DB.writeAudit('EDIT_PATIENT', 'patients', patientId, { name: data.name });
  UI.closeModal();
  UI.toast('Dossier patient mis à jour', 'success');
  Router.navigate('patients');
}

function exportPatients() {
  // Export anonymized (no names - just stats)
  const data = window._patientsData || [];
  const csv = ['ID,Age,Genre,Allergies,Ville'].join('\n') + '\n' +
    data.map((p, i) => [
      `P${String(i + 1).padStart(4, '0')}`,
      p.dob ? calcAge(p.dob) : '',
      p.gender || '',
      p.allergies ? 'Oui' : 'Non',
      p.address ? p.address.split(',').pop().trim() : '',
    ].join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `patients_anonymises_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  UI.toast('Export anonymisé téléchargé', 'success');
}

window.filterPatients = filterPatients;
window.viewPatient = viewPatient;
window.showAddPatient = showAddPatient;
window.submitPatient = submitPatient;
window.editPatient = editPatient;
window.updatePatient = updatePatient;
window.exportPatients = exportPatients;

Router.register('patients', renderPatients);
