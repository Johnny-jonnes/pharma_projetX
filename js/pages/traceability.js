/**
 * PHARMA_PROJET — Module Traçabilité & Pharmacovigilance
 * Tracking complet lot <i data-lucide="arrow-right"></i> patient, rappels, ANSS
 */

async function renderTraceability(container) {
  UI.loading(container, 'Chargement du module traçabilité...');

  const [lots, products, movements, prescriptions, patients] = await Promise.all([
    DB.dbGetAll('lots'),
    DB.dbGetAll('products'),
    DB.dbGetAll('movements'),
    DB.dbGetAll('prescriptions'),
    DB.dbGetAll('patients'),
  ]);

  const productMap = {};
  products.forEach(p => { productMap[p.id] = p; });

  // Lots expiring soon
  const today = new Date();
  const soonExpiry = lots.filter(l => {
    const d = UI.daysUntilExpiry(l.expiryDate);
    return l.status === 'active' && d !== null && d <= 90 && d > 0;
  }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  const expiredLots = lots.filter(l => {
    const d = UI.daysUntilExpiry(l.expiryDate);
    return d !== null && d <= 0 && l.status === 'active';
  });

  const recalledLots = lots.filter(l => l.status === 'recalled');

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Traçabilité & Pharmacovigilance</h1>
        <p class="page-subtitle">Suivi lot-à-patient · Rappels · Déclarations ANSS</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-warning" onclick="showLotRecallForm()"><i data-lucide="alert-triangle"></i> Rappel de Lot</button>
        <button class="btn btn-danger" onclick="showPharmacovigilanceForm()"><i data-lucide="alert-octagon"></i> Déclaration ANSS</button>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-chip stat-red"><span class="stat-val">${expiredLots.length}</span><span class="stat-label">Lots expirés</span></div>
      <div class="stat-chip stat-orange"><span class="stat-val">${soonExpiry.length}</span><span class="stat-label">Exp. &lt;90j</span></div>
      <div class="stat-chip stat-purple"><span class="stat-val">${recalledLots.length}</span><span class="stat-label">Rappels actifs</span></div>
      <div class="stat-chip stat-blue"><span class="stat-val">${lots.filter(l => l.status === 'active').length}</span><span class="stat-label">Lots actifs</span></div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button class="tab-btn active" data-tab="expiry" onclick="switchTraceTab(this,'expiry')"><i data-lucide="clock"></i> Expirations</button>
      <button class="tab-btn" data-tab="search" onclick="switchTraceTab(this,'search')"><i data-lucide="search"></i> Tracer un lot</button>
      <button class="tab-btn" data-tab="recalls" onclick="switchTraceTab(this,'recalls')"><i data-lucide="alert-triangle"></i> Rappels actifs</button>
      <button class="tab-btn" data-tab="destruction" onclick="switchTraceTab(this,'destruction')"><i data-lucide="trash-2"></i> Destruction</button>
      ${DB.AppState.currentUser?.role === 'admin' ? `
      <button class="tab-btn" data-tab="audit" onclick="switchTraceTab(this,'audit');loadAuditTab()"><i data-lucide="clipboard-list"></i> Journal d'Audit</button>` : ''}
    </div>

    <!-- Tab: Expirations -->
    <div id="tab-expiry" class="tab-content active">
      ${expiredLots.length > 0 ? `
        <div class="alert-section-banner alert-danger">
          <i data-lucide="alert-octagon"></i> <strong>${expiredLots.length} lot(s) expiré(s) encore actif(s)</strong> — Action immédiate requise
          <button class="btn btn-xs btn-danger" onclick="blockExpiredLots()">Bloquer tous</button>
        </div>` : ''}

      <h3 class="section-subtitle">Lots expirant dans les 90 jours</h3>
      ${soonExpiry.length === 0 ? '<div class="empty-state-small"><i data-lucide="check-circle"></i> Aucun lot expirant dans les 90 prochains jours</div>' : `
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Produit</th><th>N° Lot</th><th>Stock restant</th><th>Expiration</th><th>Jours restants</th><th>Actions</th></tr></thead>
            <tbody>
              ${[...expiredLots.map(l => ({ ...l, _expired: true })), ...soonExpiry].map(lot => {
    const prod = productMap[lot.productId];
    const days = UI.daysUntilExpiry(lot.expiryDate);
    const urgency = days <= 0 ? 'danger' : days <= 30 ? 'danger' : days <= 60 ? 'warning' : 'info';
    return `<tr class="${days <= 0 ? 'row-danger' : ''}">
                  <td><strong>${prod?.name || '—'}</strong><br><span class="text-muted text-sm">${prod?.category || ''}</span></td>
                  <td><code class="code-tag">${lot.lotNumber}</code></td>
                  <td>${lot.quantity}</td>
                  <td>${UI.formatDate(lot.expiryDate)}</td>
                  <td>${UI.expiryBadge(lot.expiryDate)}</td>
                  <td>
                    <div class="actions-cell">
                      <button class="btn btn-xs btn-primary" onclick="traceLot('${lot.lotNumber}')"><i data-lucide="search"></i> Tracer</button>
                      ${days <= 0 ? `<button class="btn btn-xs btn-danger" onclick="initDestroyLot(${lot.id})"><i data-lucide="trash-2"></i> Détruire</button>` : `<button class="btn btn-xs btn-warning" onclick="promoteLot(${lot.id})"><i data-lucide="megaphone"></i> Promouvoir</button>`}
                    </div>
                  </td>
                </tr>`;
  }).join('')}
            </tbody>
          </table>
        </div>`}
    </div>

    <!-- Tab: Search -->
    <div id="tab-search" class="tab-content" style="display:none">
      <div class="trace-search-box">
        <h3 class="section-subtitle">Tracer un Lot ou Médicament</h3>
        <div class="trace-search-bar">
          <input type="text" id="trace-input" class="filter-input" placeholder="Entrez un numéro de lot, code produit, ou nom...">
          <button class="btn btn-primary" onclick="doLotTrace()"><i data-lucide="search"></i> Tracer</button>
        </div>
        <div id="trace-results"></div>
      </div>
    </div>

    <!-- Tab: Recalls -->
    <div id="tab-recalls" class="tab-content" style="display:none">
      <div id="recalls-list">
        ${recalledLots.length === 0 ? '<div class="empty-state-small"><i data-lucide="check-circle"></i> Aucun rappel de lot actif</div>' : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Produit</th><th>N° Lot</th><th>Motif</th><th>Date rappel</th><th>Statut</th></tr></thead>
              <tbody>
                ${recalledLots.map(lot => {
    const prod = productMap[lot.productId];
    return `<tr>
                    <td><strong>${prod?.name || '—'}</strong></td>
                    <td><code class="code-tag">${lot.lotNumber}</code></td>
                    <td>${lot.recallReason || '—'}</td>
                    <td>${lot.recallDate ? UI.formatDate(lot.recallDate) : '—'}</td>
                    <td><span class="badge badge-danger">Rappelé</span></td>
                  </tr>`;
  }).join('')}
              </tbody>
            </table>
          </div>`}
      </div>
    </div>

    <!-- Tab: Destruction -->
    <div id="tab-destruction" class="tab-content" style="display:none">
      <div class="destruction-info">
        <div class="info-box">
          <h4>📋 Procédure de destruction réglementaire</h4>
          <p>Conformément aux textes DNPM Guinée, la destruction des médicaments périmés ou non conformes doit faire l'objet :</p>
          <ul style="margin:8px 0 0 20px;font-size:13px">
            <li>D'un procès-verbal signé par le pharmacien responsable</li>
            <li>D'une déclaration préalable auprès de la DNPM</li>
            <li>D'une traçabilité complète des lots détruits</li>
            <li>D'une méthode de destruction appropriée (incinération recommandée)</li>
          </ul>
        </div>
      </div>
    <div style="margin-top:16px">
        <button class="btn btn-primary" onclick="showDestroyForm()"><i data-lucide="trash-2"></i> Initier une procédure de destruction</button>
      </div>
      <div id="destruction-history" style="margin-top:16px"></div>
    </div>

    <!-- Tab: Audit Log -->
    <div id="tab-audit" class="tab-content" style="display:none">
      <div class="info-box" style="margin-bottom: 20px; background: rgba(46, 134, 193, 0.05); border-left: 4px solid var(--primary-color); padding: 15px; border-radius: 0 8px 8px 0;">
        <h4 style="margin-top:0; color:var(--primary-color); display:flex; align-items:center; gap:8px;">
          <i data-lucide="shield-check"></i> À propos du Journal d'Audit
        </h4>
        <p class="text-sm text-muted" style="margin-bottom:0">
          Conformément aux directives de la <strong>DNPM</strong> et aux standards de sécurité HealthTech, le journal d'audit enregistre de manière immuable toutes les actions critiques effectuées sur le système. 
          Il permet de répondre à la question : <em>"Qui a fait quoi, sur quelle donnée, et à quel moment ?"</em>. 
          Il est essentiel pour la responsabilité légale du pharmacien titulaire et la détection d'anomalies.
        </p>
      </div>
      <div class="audit-toolbar" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <input type="text" id="audit-filter-text" class="filter-input" placeholder="Rechercher dans l'audit..." oninput="filterAuditLog()" style="flex:1;min-width:180px">
        <select id="audit-filter-action" class="form-control" onchange="filterAuditLog()" style="width:auto;min-width:140px">
          <option value="">Toutes les actions</option>
          <option value="STOCK_ENTRY">Entrées stock</option>
          <option value="SALE">Ventes</option>
          <option value="SAVE_SETTINGS">Paramètres</option>
          <option value="ADD_USER">Ajout utilisateur</option>
          <option value="EDIT_USER">Modif utilisateur</option>
          <option value="LOT_RECALL">Rappels lot</option>
          <option value="LOT_DESTRUCTION">Destructions</option>
          <option value="PV_REPORT">Pharmacovigilance</option>
          <option value="RETURN_PROCESSED">Retours clients</option>
        </select>
      </div>
      <div id="audit-log-container">Chargement...</div>
    </div>
  `;

  window._traceProductMap = productMap;
  window._traceLots = lots;
  window._traceMovements = movements;
  window._tracePrescriptions = prescriptions;
  window._tracePatients = patients;

  loadDestructionHistory();
  if (window.lucide) lucide.createIcons();
}

function switchTraceTab(btn, tabId) {
  const targetId = `tab-${tabId}`;
  const target = document.getElementById(targetId);

  if (!target) {
    console.error(`[Traceability] Tab content not found: ${targetId}`);
    return;
  }

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');

  btn.classList.add('active');
  target.style.display = 'block';
}

async function doLotTrace() {
  const query = document.getElementById('trace-input')?.value.trim().toLowerCase();
  if (!query) { UI.toast('Entrez un numéro de lot ou nom de produit', 'warning'); return; }

  const container = document.getElementById('trace-results');
  if (!container) return;
  UI.loading(container, 'Recherche en cours...');

  const lots = window._traceLots || [];
  const productMap = window._traceProductMap || {};
  const movements = window._traceMovements || [];
  const prescriptions = window._tracePrescriptions || [];

  // Find matching lots
  const matchedLots = lots.filter(l =>
    l.lotNumber?.toLowerCase().includes(query) ||
    productMap[l.productId]?.name?.toLowerCase().includes(query) ||
    productMap[l.productId]?.code?.toLowerCase().includes(query) ||
    productMap[l.productId]?.dci?.toLowerCase().includes(query)
  );

  if (matchedLots.length === 0) {
    container.innerHTML = `<div class="empty-state-small">Aucun lot trouvé pour "${query}"</div>`;
    return;
  }

  container.innerHTML = matchedLots.map(lot => {
    const prod = productMap[lot.productId];
    const lotMovements = movements.filter(m => m.lotNumber === lot.lotNumber);
    const dispensed = lotMovements.filter(m => m.type === 'EXIT' && m.subType === 'SALE');
    const totalDispensed = Math.abs(dispensed.reduce((a, m) => a + (m.quantity || 0), 0));

    // Find prescriptions that used this lot
    const relatedRx = prescriptions.filter(rx =>
      (rx.items || []).some(item => item.productId === lot.productId) && rx.status === 'dispensed'
    ).slice(0, 5);

    return `
    <div class="trace-result-card">
        <div class="trace-result-header">
          <div>
            <div class="trace-lot-number"><code>${lot.lotNumber}</code></div>
            <div class="trace-product-name">${prod?.name || '—'} <span class="text-muted text-sm">${prod?.dci || ''}</span></div>
          </div>
          <div class="trace-result-badges">
            ${UI.expiryBadge(lot.expiryDate)}
            <span class="badge badge-${lot.status === 'active' ? 'success' : lot.status === 'recalled' ? 'danger' : 'neutral'}">${lot.status}</span>
          </div>
        </div>
        <div class="trace-grid">
          <div class="trace-detail"><span class="trace-lbl">Réception</span><span>${UI.formatDate(lot.receiptDate)}</span></div>
          <div class="trace-detail"><span class="trace-lbl">Expiration</span><span>${UI.formatDate(lot.expiryDate)}</span></div>
          <div class="trace-detail"><span class="trace-lbl">Stock initial</span><span>${lot.initialQuantity}</span></div>
          <div class="trace-detail"><span class="trace-lbl">Stock actuel</span><span class="${lot.quantity <= 0 ? 'text-danger' : 'text-success'} font-bold">${lot.quantity}</span></div>
          <div class="trace-detail"><span class="trace-lbl">Unités vendues</span><span>${totalDispensed}</span></div>
          <div class="trace-detail"><span class="trace-lbl">Mouvements</span><span>${lotMovements.length}</span></div>
        </div>
        ${relatedRx.length > 0 ? `
          <div class="trace-rx-section">
            <div class="trace-section-title"><i data-lucide="file-text"></i> Ordonnances liées (${relatedRx.length})</div>
            ${relatedRx.map(rx => `<span class="rx-item-tag" onclick="viewPrescription(${rx.id})">Rx-${String(rx.id).padStart(5, '0')} <i data-lucide="arrow-right"></i> ${rx.patientName || '—'}</span>`).join('')}
          </div>` : ''
      }
  <div class="trace-movements">
    <div class="trace-section-title"><i data-lucide="clipboard-list"></i> Derniers mouvements</div>
    ${lotMovements.slice(-5).reverse().map(m => `
            <div class="trace-movement-row">
              <span class="badge badge-${m.type === 'ENTRY' ? 'success' : 'warning'} badge-xs"><i data-lucide="${m.type === 'ENTRY' ? 'arrow-up' : 'arrow-down'}"></i></span>
              <span>${m.quantity > 0 ? '+' : ''}${m.quantity}</span>
              <span class="text-muted">${UI.formatDate(m.date)}</span>
              <span class="text-muted text-sm">${m.note || m.reference || ''}</span>
            </div>`).join('')}
  </div>
      </div> `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function traceLot(lotNumber) {
  document.getElementById('trace-input').value = lotNumber;
  switchTraceTab(document.querySelector('[data-tab="search"]'), 'search');
  doLotTrace();
}

function showLotRecallForm() {
  const lots = window._traceLots || [];
  const productMap = window._traceProductMap || {};
  const activeLots = lots.filter(l => l.status === 'active');

  UI.modal('<i data-lucide="alert-triangle" class="modal-icon-inline"></i> Rappel de Lot', `
    <div class="info-box info-danger" style="margin-bottom:16px">
      <strong>⚠️ Action critique</strong> — Le rappel de lot bloque immédiatement les ventes et génère une alerte SMS pour les patients concernés.
    </div>
    <form id="recall-form" class="form-grid">
      <div class="form-group">
        <label>Lot à rappeler *</label>
        <select name="lotId" id="recall-lot-select" class="form-control" required onchange="updateRecallInfo()">
          <option value="">Sélectionner un lot...</option>
          ${activeLots.map(l => `<option value="${l.id}" data-product="${productMap[l.productId]?.name || ''}" data-qty="${l.quantity}">${l.lotNumber} — ${productMap[l.productId]?.name || '?'} (${l.quantity} en stock)</option>`).join('')}
        </select>
      </div>
      <div id="recall-lot-info" class="lot-info-box" style="display:none"></div>
      <div class="form-group">
        <label>Motif du rappel *</label>
        <select name="reason" class="form-control" required>
          <option value="">Sélectionner...</option>
          <option>Non-conformité qualité</option>
          <option>Contamination détectée</option>
          <option>Rappel fabricant</option>
          <option>Décision DNPM / ANSS</option>
          <option>Problème d'étiquetage</option>
          <option>Suspicion de contrefaçon</option>
          <option>Autre</option>
        </select>
      </div>
      <div class="form-group">
        <label>Description détaillée *</label>
        <textarea name="description" class="form-control" rows="3" required placeholder="Décrivez précisément le problème détecté..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Source de l'alerte</label>
          <input type="text" name="alertSource" class="form-control" placeholder="DNPM, Fabricant, Interne...">
        </div>
        <div class="form-group">
          <label>Référence officielle</label>
          <input type="text" name="alertRef" class="form-control" placeholder="N° de rappel officiel">
        </div>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="recall-notify-patients" checked>
            Notifier les patients ayant reçu ce lot (SMS)
        </label>
      </div>
    </form>
  `, {
    size: 'large',
    footer: `
    <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-danger" onclick="submitLotRecall()"><i data-lucide="alert-triangle"></i> Confirmer le Rappel</button>
  `
  });
  if (window.lucide) lucide.createIcons();
}

function updateRecallInfo() {
  const sel = document.getElementById('recall-lot-select');
  const info = document.getElementById('recall-lot-info');
  if (!sel?.value || !info) return;
  const opt = sel.options[sel.selectedIndex];
  info.style.display = 'block';
  info.innerHTML = `<strong>Produit :</strong> ${opt.dataset.product} · <strong>Stock actuel :</strong> ${opt.dataset.qty} unités`;
  info.className = 'lot-info-box';
}

async function submitLotRecall() {
  const form = document.getElementById('recall-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  const lotId = parseInt(data.lotId);
  const notifyPatients = document.getElementById('recall-notify-patients')?.checked;

  const ok = await UI.confirm(`⚠️ CONFIRMER LE RAPPEL ?\n\nCette action va: \n• Bloquer immédiatement les ventes de ce lot\n• Générer une alerte prioritaire\n${notifyPatients ? '• Notifier les patients concernés par SMS' : ''} \n\nCette action est irréversible.`);
  if (!ok) return;

  const lot = await DB.dbGet('lots', lotId);
  await DB.dbPut('lots', {
    ...lot,
    status: 'recalled',
    recallReason: data.reason,
    recallDescription: data.description,
    recallDate: new Date().toISOString().split('T')[0],
    recallSource: data.alertSource,
    recallRef: data.alertRef,
    recalledBy: DB.AppState.currentUser?.id,
  });

  // Generate high-priority alert
  await DB.dbAdd('alerts', {
    type: 'LOT_RECALL',
    productId: lot.productId,
    lotId,
    message: `RAPPEL LOT ${lot.lotNumber} — ${data.reason} `,
    description: data.description,
    status: 'unread',
    date: Date.now(),
    priority: 'critical',
  });

  await DB.writeAudit('LOT_RECALL', 'lots', lotId, { reason: data.reason, lotNumber: lot.lotNumber });

  if (notifyPatients) {
    UI.toast('📱 Notifications SMS envoyées aux patients concernés (simulation)', 'info', 4000);
  }

  UI.closeModal();
  UI.toast(`Lot ${lot.lotNumber} rappelé — Ventes bloquées`, 'error', 6000);
  Router.navigate('traceability');
}

function showPharmacovigilanceForm() {
  UI.modal('<i data-lucide="alert-octagon" class="modal-icon-inline"></i> Déclaration de Pharmacovigilance — ANSS', `
    <div class="info-box info-primary" style="margin-bottom:16px">
      Formulaire de déclaration d'effet indésirable médicamenteux conformément au cadre réglementaire de l'ANSS(Agence Nationale de Sécurité Sanitaire) de Guinée.
    </div>
    <form id="pv-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Médicament suspecté *</label>
          <input type="text" name="suspectedDrug" class="form-control" required placeholder="Nom du médicament + dosage">
        </div>
        <div class="form-group">
          <label>N° de lot</label>
          <input type="text" name="lotNumber" class="form-control" placeholder="Si connu">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Âge du patient</label>
          <input type="number" name="patientAge" class="form-control" min="0" max="120">
        </div>
        <div class="form-group">
          <label>Sexe</label>
          <select name="patientGender" class="form-control">
            <option value="">Non précisé</option>
            <option>Masculin</option>
            <option>Féminin</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Description de l'effet indésirable *</label>
        <textarea name="adverseEffect" class="form-control" rows="3" required placeholder="Décrivez précisément l'effet indésirable observé..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de survenue</label>
          <input type="date" name="eventDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Gravité</label>
          <select name="severity" class="form-control">
            <option value="minor">Mineur</option>
            <option value="moderate">Modéré</option>
            <option value="severe">Sévère</option>
            <option value="lethal">Potentiellement fatal</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Évolution</label>
        <select name="outcome" class="form-control">
          <option>Guéri sans séquelles</option>
          <option>Guéri avec séquelles</option>
          <option>En cours de guérison</option>
          <option>Non résolu</option>
          <option>Décès</option>
          <option>Inconnu</option>
        </select>
      </div>
      <div class="form-group">
        <label>Commentaires additionnels</label>
        <textarea name="comments" class="form-control" rows="2" placeholder="Médicaments associés, antécédents pertinents..."></textarea>
      </div>
      <div class="form-group">
        <label>Déclarant (pharmacien responsable) *</label>
        <input type="text" name="reporter" class="form-control" value="${DB.AppState.currentUser?.name || ''}" required>
      </div>
    </form>
  `, {
    size: 'large',
    footer: `
    <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-ghost" onclick="previewPVReport()">👁 Prévisualiser</button>
      <button class="btn btn-danger" onclick="submitPVReport()">📤 Soumettre à l'ANSS</button>
  `
  });
  if (window.lucide) lucide.createIcons();
}

/**
 * Affiche un aperçu de la déclaration avant soumission à l'ANSS
 */
function previewPVReport() {
  const form = document.getElementById('pv-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));

  const severityMap = { minor: 'Mineur', moderate: 'Modéré', severe: 'Sévère', lethal: 'Potentiellement fatal' };
  const sevLabel = severityMap[data.severity] || data.severity;

  UI.modal('<i data-lucide="eye" class="modal-icon-inline"></i> Aperçu de la Déclaration ANSS', `
    <div class="pv-report-card">
      <div class="info-box info-primary" style="margin-bottom:16px">
        <strong>Mode Aperçu</strong> — Veuillez vérifier l'exactitude des informations ci-dessous avant la transmission réglementaire.
      </div>
      <div class="pv-report-grid">
        <div class="pv-report-row"><span class="pv-lbl">Médicament suspecté</span><span class="pv-val"><strong>${data.suspectedDrug}</strong></span></div>
        <div class="pv-report-row"><span class="pv-lbl">N° de lot</span><span class="pv-val"><code>${data.lotNumber || 'Non spécifié'}</code></span></div>
        <div class="pv-report-row"><span class="pv-lbl">Patient</span><span class="pv-val">${data.patientAge || '?'} ans · Sexe: ${data.patientGender || 'Non précisé'}</span></div>
        <div class="pv-report-row"><span class="pv-lbl">Description de l'effet</span><span class="pv-val italic">"${data.adverseEffect}"</span></div>
        <div class="pv-report-row"><span class="pv-lbl">Date de survenue</span><span class="pv-val">${UI.formatDate(data.eventDate)}</span></div>
        <div class="pv-report-row"><span class="pv-lbl">Gravité</span><span class="pv-val"><span class="badge badge-${data.severity === 'lethal' || data.severity === 'severe' ? 'danger' : 'warning'}">${sevLabel}</span></span></div>
        <div class="pv-report-row"><span class="pv-lbl">Évolution</span><span class="pv-val">${data.outcome}</span></div>
        <div class="pv-report-row"><span class="pv-lbl">Commentaires</span><span class="pv-val">${data.comments || 'Aucun'}</span></div>
        <div class="pv-report-row"><span class="pv-lbl">Déclarant</span><span class="pv-val">${data.reporter}</span></div>
      </div>
    </div>
  `, {
    size: 'large',
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal(); showPharmacovigilanceForm()"><i data-lucide="edit-3"></i> Retour à la saisie</button>
      <button class="btn btn-danger" onclick="submitPVReport()"><i data-lucide="send"></i> Confirmer & Envoyer à l'ANSS</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function submitPVReport() {
  const form = document.getElementById('pv-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));

  const reportId = await DB.dbAdd('alerts', {
    type: 'PHARMACOVIGILANCE',
    message: `Déclaration PV — ${data.suspectedDrug} — ${data.severity} `,
    data,
    status: 'submitted',
    date: Date.now(),
    priority: data.severity === 'lethal' ? 'critical' : data.severity === 'severe' ? 'high' : 'medium',
  });

  await DB.writeAudit('PV_REPORT', 'alerts', reportId, { drug: data.suspectedDrug, severity: data.severity });
  UI.closeModal();
  UI.toast('Déclaration de pharmacovigilance enregistrée et transmise à l\'ANSS', 'success', 5000);
}

async function initDestroyLot(lotId) {
  const lot = await DB.dbGet('lots', lotId);
  const prod = lot ? window._traceProductMap?.[lot.productId] : null;
  if (!lot) return;

  UI.modal('<i data-lucide="trash-2" class="modal-icon-inline"></i> Destruction de Médicament', `
    <div class="info-box info-warning" style="margin-bottom:16px">
      <strong>⚠️ Procédure réglementaire</strong> — La destruction doit être consignée dans un procès-verbal officiel.
    </div>
    <form id="destroy-form" class="form-grid">
      <div class="detail-row"><span>Produit</span><span><strong>${prod?.name || '—'}</strong></span></div>
      <div class="detail-row"><span>Lot</span><span><code>${lot.lotNumber}</code></span></div>
      <div class="detail-row"><span>Quantité en stock</span><span><strong>${lot.quantity} unités</strong></span></div>
      <div class="detail-row"><span>Date d'expiration</span><span>${UI.expiryBadge(lot.expiryDate)}</span></div>

      <div class="form-group" style="margin-top:12px">
        <label>Quantité à détruire *</label>
        <input type="number" name="quantity" class="form-control" max="${lot.quantity}" value="${lot.quantity}" min="1" required>
      </div>
      <div class="form-group">
        <label>Motif de destruction *</label>
        <select name="reason" class="form-control" required>
          <option>Péremption</option>
          <option>Rappel de lot</option>
          <option>Non-conformité qualité</option>
          <option>Dommage physique</option>
          <option>Contamination</option>
          <option>Autre</option>
        </select>
      </div>
      <div class="form-group">
        <label>Méthode de destruction</label>
        <select name="method" class="form-control">
          <option>Incinération</option>
          <option>Dénaturation chimique</option>
          <option>Enfouissement sécurisé</option>
          <option>Retour fournisseur</option>
        </select>
      </div>
      <div class="form-group">
        <label>Témoin(s) présent(s)</label>
        <input type="text" name="witnesses" class="form-control" placeholder="Noms des témoins">
      </div>
    </form>
  `, {
    footer: `
    <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-danger" onclick="confirmDestroyLot(${lotId})"><i data-lucide="trash-2"></i> Confirmer la Destruction</button>
  `
  });
  if (window.lucide) lucide.createIcons();
}

async function showDestroyForm() {
  const lots = window._traceLots || [];
  const productMap = window._traceProductMap || {};
  const expiredLots = lots.filter(l => {
    const d = UI.daysUntilExpiry(l.expiryDate);
    return l.status === 'active' && d !== null && d <= 30;
  });
  if (expiredLots.length === 0) {
    UI.toast('Aucun lot expiré ou proche de l\'expiration à détruire', 'info');
    return;
  }
  await initDestroyLot(expiredLots[0].id);
}

async function confirmDestroyLot(lotId) {
  const form = document.getElementById('destroy-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  const qty = parseInt(data.quantity);
  const lot = await DB.dbGet('lots', lotId);

  await DB.dbPut('lots', {
    ...lot,
    quantity: lot.quantity - qty,
    status: lot.quantity - qty <= 0 ? 'destroyed' : lot.status,
    destroyedQty: (lot.destroyedQty || 0) + qty,
    destructionDate: new Date().toISOString().split('T')[0],
    destructionReason: data.reason,
    destructionMethod: data.method,
    destructionWitnesses: data.witnesses,
    destructionBy: DB.AppState.currentUser?.name,
  });

  // Movement
  await DB.dbAdd('movements', {
    productId: lot.productId,
    type: 'EXIT',
    subType: 'DESTRUCTION',
    quantity: -qty,
    lotNumber: lot.lotNumber,
    date: new Date().toISOString(),
    userId: DB.AppState.currentUser?.id,
    note: `Destruction: ${data.reason} `,
  });

  // Update stock
  const stockAll = await DB.dbGetAll('stock');
  const stockEntry = stockAll.find(s => s.productId === lot.productId);
  if (stockEntry) {
    await DB.dbPut('stock', { ...stockEntry, quantity: Math.max(0, stockEntry.quantity - qty) });
  }

  await DB.writeAudit('LOT_DESTRUCTION', 'lots', lotId, { qty, reason: data.reason, lotNumber: lot.lotNumber });
  UI.closeModal();
  UI.toast(`Destruction de ${qty} unité(s) enregistrée — PV généré`, 'success');
  Router.navigate('traceability');
}

async function blockExpiredLots() {
  const ok = await UI.confirm('Bloquer tous les lots expirés actifs ?\n\nLes ventes seront automatiquement bloquées.');
  if (!ok) return;
  const lots = window._traceLots || [];
  let count = 0;
  for (const lot of lots) {
    const d = UI.daysUntilExpiry(lot.expiryDate);
    if (lot.status === 'active' && d !== null && d <= 0) {
      await DB.dbPut('lots', { ...lot, status: 'blocked' });
      count++;
    }
  }
  UI.toast(`${count} lot(s) expiré(s) bloqué(s)`, 'success');
  Router.navigate('traceability');
}

async function promoteLot(lotId) {
  UI.toast('Fonctionnalité : Promotion lot proche expiration — Newsletter & remises générées', 'info', 4000);
}

async function loadDestructionHistory() {
  const container = document.getElementById('destruction-history');
  if (!container) return;
  const lots = await DB.dbGetAll('lots');
  const destroyed = lots.filter(l => l.destructionDate);
  const productMap = window._traceProductMap || {};
  if (destroyed.length === 0) {
    container.innerHTML = '<div class="empty-state-small">Aucune destruction enregistrée</div>';
    return;
  }
  container.innerHTML = `<h3 class="section-subtitle" style="margin-bottom:8px">Historique des destructions</h3>` + `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Produit</th><th>Lot</th><th>Qté détruite</th><th>Motif</th><th>Méthode</th><th>Date</th><th>Réalisé par</th></tr></thead>
        <tbody>
          ${destroyed.sort((a, b) => b.destructionDate?.localeCompare(a.destructionDate || '')).map(l => `
            <tr>
              <td>${productMap[l.productId]?.name || '—'}</td>
              <td><code class="code-tag">${l.lotNumber}</code></td>
              <td><strong>${l.destroyedQty || '—'}</strong></td>
              <td>${l.destructionReason || '—'}</td>
              <td>${l.destructionMethod || '—'}</td>
              <td>${UI.formatDate(l.destructionDate)}</td>
              <td>${l.destructionBy || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div> `;
  if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════
// Journal d'Audit — Onglet dédié dans Traçabilité
// ═══════════════════════════════════════════════════════════════════
let _auditData = [];

async function loadAuditTab() {
  const container = document.getElementById('audit-log-container');
  if (!container) return;

  if (DB.AppState.currentUser?.role !== 'admin') {
    container.innerHTML = '<div class="error-state">Accès réservé à l\'administrateur</div>';
    return;
  }

  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Chargement...</p></div>';

  _auditData = await DB.dbGetAll('auditLog');
  _auditData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  renderAuditTable(_auditData);
}

function filterAuditLog() {
  const text = (document.getElementById('audit-filter-text')?.value || '').toLowerCase();
  const action = document.getElementById('audit-filter-action')?.value || '';

  let filtered = _auditData;
  if (action) filtered = filtered.filter(l => l.action === action);
  if (text) filtered = filtered.filter(l =>
    (l.action || '').toLowerCase().includes(text) ||
    (l.username || '').toLowerCase().includes(text) ||
    (l.entity || '').toLowerCase().includes(text) ||
    JSON.stringify(l.details || {}).toLowerCase().includes(text)
  );
  renderAuditTable(filtered);
}

function formatAuditDetails(log) {
  const d = log.details || {};
  const user = log.username || 'Système';

  switch (log.action) {
    case 'LOGIN':
      return `Connexion réussie de <strong>${user}</strong>.`;
    case 'LOGOUT':
      return `Déconnexion de <strong>${user}</strong>.`;
    case 'CASH_ENTRY':
      const typeLabel = d.type === 'in' ? 'Entrée de' : 'Sortie de';
      const reasonStr = d.reason ? ` (Motif : ${d.reason})` : '';
      return `${typeLabel} <strong>${UI.formatCurrency(d.amount)}</strong> en ${UI.paymentMethodBadge(d.paymentMethod)}${reasonStr}.`;
    case 'CAISSE_CLOSURE':
      const ecart = (d.physical || 0) - (d.expected || 0);
      const ecartStatus = ecart === 0 ? 'Balance parfaite' : ecart < 0 ? `Déficit de ${UI.formatCurrency(Math.abs(ecart))}` : `Excédent de ${UI.formatCurrency(ecart)}`;
      return `Clôture de caisse du ${UI.formatDate(d.date)}. Physique : <strong>${UI.formatCurrency(d.physical)}</strong>. Résultat : <span class="${ecart < 0 ? 'text-danger' : 'text-success'}">${ecartStatus}</span>.`;
    case 'STOCK_ENTRY':
      return `Réception de <strong>${d.productName || 'produit'}</strong>. Quantité : ${d.quantity} unités. N° Lot : <code>${d.lotNumber || '—'}</code>.`;
    case 'SALE':
      const itemsCount = d.itemCount ? ` (${d.itemCount} articles)` : '';
      return `Vente #<strong>${String(log.entityId).padStart(6, '0')}</strong> pour un montant de <strong>${UI.formatCurrency(d.total)}</strong>${itemsCount}.`;
    case 'DEBT_REFUND':
      return `Règlement d'une dette de <strong>${UI.formatCurrency(d.amount)}</strong> pour la vente #<strong>${String(log.entityId).padStart(6, '0')}</strong>.`;
    case 'SAVE_SETTINGS':
      return `Modification des paramètres généraux : <em>${d.pharmacy_name || 'Configuration'}</em>.`;
    case 'ADD_USER':
      return `Création d'un nouvel accès pour <strong>${d.name || d.username}</strong> avec le rôle <em>${d.role}</em>.`;
    case 'EDIT_USER':
      return `Mise à jour du profil de l'utilisateur <strong>${d.name || 'Inconnu'}</strong>.`;
    case 'LOT_RECALL':
      return `<strong>ALERTE RAPPEL</strong> : Le lot <code>${d.lotNumber}</code> a été retiré de la vente. Motif : ${d.reason}.`;
    case 'LOT_DESTRUCTION':
      return `Destruction réglementaire de ${d.qty} unités du lot <code>${d.lotNumber}</code>. Motif : ${d.reason}.`;
    case 'PV_REPORT':
      const severityMap = { minor: 'Mineur', moderate: 'Modéré', severe: 'Sévère', lethal: 'Potentiellement fatal' };
      const sevLabel = severityMap[d.severity] || d.severity;
      return `Signalement d'effet indésirable (ANSS) pour <strong>${d.drug}</strong>. Gravité : <span class="badge badge-danger">${sevLabel}</span>.`;
    case 'RETURN_PROCESSED':
      return `<strong>RETOUR CLIENT</strong> : Vente #<strong>${String(d.saleId).padStart(6, '0')}</strong>. Montant remboursé : <strong>${UI.formatCurrency(d.refundAmount)}</strong>. Motif : ${d.reason}.`;
    default:
      // Si on ne connaît pas l'action, on essaie de construire une phrase générique
      if (d.name || d.productName) return `Action sur <strong>${d.name || d.productName}</strong>.`;
      return "Action système enregistrée.";
  }
}

function renderAuditTable(data) {
  const container = document.getElementById('audit-log-container');
  if (!container) return;

  const actionLabels = {
    STOCK_ENTRY: ['package-plus', 'Entrée Stock', 'badge-success'],
    SALE: ['shopping-cart', 'Vente', 'badge-info'],
    SAVE_SETTINGS: ['settings', 'Configuration', 'badge-neutral'],
    RETURN_PROCESSED: ['undo-2', 'Retour Client', 'badge-warning'],
    ADD_USER: ['user-plus', 'Nouvel Utilisateur', 'badge-info'],
    EDIT_USER: ['user-cog', 'Modif Utilisateur', 'badge-neutral'],
    LOT_RECALL: ['alert-triangle', 'Rappel Lot', 'badge-danger'],
    LOT_DESTRUCTION: ['trash-2', 'Destruction', 'badge-danger'],
    PV_REPORT: ['file-warning', 'Pharmacovigilance', 'badge-warning'],
    RESTORE_BACKUP: ['folder-open', 'Restauration', 'badge-warning'],
    LOGIN: ['log-in', 'Connexion', 'badge-neutral'],
    LOGOUT: ['log-out', 'Déconnexion', 'badge-neutral'],
    CASH_ENTRY: ['banknote', 'Mouv. Caisse', 'badge-info'],
    CAISSE_CLOSURE: ['lock', 'Clôture Caisse', 'badge-neutral'],
    DEBT_REFUND: ['check-circle', 'Réglt Dette', 'badge-success'],
  };

  if (data.length === 0) {
    container.innerHTML = '<div class="empty-state-small"><i data-lucide="clipboard-list"></i> Aucune entrée d\'audit trouvée</div>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <p class="text-muted text-sm" style="margin-bottom:8px">${data.length} entrée(s) trouvée(s)</p>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Date / Heure</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
        <tbody>
          ${data.slice(0, 100).map(log => {
    const [icon, label, cls] = actionLabels[log.action] || ['info', log.action, 'badge-neutral'];
    const humanDetails = formatAuditDetails(log);
    return `<tr>
              <td class="text-sm" style="white-space:nowrap">${UI.formatDateTime(log.timestamp)}</td>
              <td><code>${log.username || '—'}</code></td>
              <td><span class="badge ${cls}"><i data-lucide="${icon}"></i> ${label}</span></td>
              <td class="text-sm">${humanDetails}</td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>
    ${data.length > 100 ? '<p class="text-muted text-sm" style="margin-top:8px">Affichage limité aux 100 dernières entrées</p>' : ''}
  `;
  if (window.lucide) lucide.createIcons();
}

window.switchTraceTab = switchTraceTab;
window.doLotTrace = doLotTrace;
window.traceLot = traceLot;
window.showLotRecallForm = showLotRecallForm;
window.updateRecallInfo = updateRecallInfo;
window.submitLotRecall = submitLotRecall;
window.showPharmacovigilanceForm = showPharmacovigilanceForm;
window.previewPVReport = previewPVReport;
window.submitPVReport = submitPVReport;
window.initDestroyLot = initDestroyLot;
window.showDestroyForm = showDestroyForm;
window.confirmDestroyLot = confirmDestroyLot;
window.blockExpiredLots = blockExpiredLots;
window.promoteLot = promoteLot;
window.loadAuditTab = loadAuditTab;
window.filterAuditLog = filterAuditLog;

Router.register('traceability', renderTraceability);

// ═══════════════════════════════════════════════════════════════════
// GATEWAY ANSS — Déclarations de Pharmacovigilance (v3)
// ═══════════════════════════════════════════════════════════════════
const ANSSGateway = {
  // Point d'accès ANSS Guinée (simulation — à remplacer par l'URL réelle)
  endpoint: 'https://anss.gov.gn/api/pharmacovigilance/v1/declarations',
  apiKey: 'ANSS-PV-KEY-DEMO-2024', // Clé API à configurer en production

  async submitDeclaration(data) {
    // Préparer le payload normalisé ANSS
    const payload = {
      type: 'ADVERSE_DRUG_REACTION',
      version: '1.0',
      pharmacy: {
        name: data.pharmacyName,
        dnpm: data.pharmacyDnpm,
        phone: data.pharmacyPhone,
        reporter: data.reporter,
      },
      patient: {
        age: data.patientAge || null,
        gender: data.patientGender || null,
        anonymized: true,
      },
      medication: {
        name: data.suspectedDrug,
        lotNumber: data.lotNumber || null,
        manufacturer: data.manufacturer || null,
      },
      event: {
        description: data.adverseEffect,
        date: data.eventDate,
        severity: data.severity,
        outcome: data.outcome,
        causality: data.causality || 'possible',
        comments: data.comments || '',
      },
      submittedAt: new Date().toISOString(),
      submissionId: `PV - ${Date.now()} `,
    };

    // Tentative d'envoi réel (timeout 5s)
    let serverResponse = null;
    let sendError = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Pharmacy-DNPM': data.pharmacyDnpm || '',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        serverResponse = await resp.json();
      } else {
        sendError = `HTTP ${resp.status} `;
      }
    } catch (e) {
      sendError = e.name === 'AbortError' ? 'Délai dépassé (serveur ANSS)' : e.message;
    }

    // Enregistrer la déclaration localement avec son statut
    const declarationRecord = {
      ...payload,
      localId: Date.now(),
      serverResponse,
      sendError,
      status: serverResponse ? 'submitted' : 'queued_offline',
      savedAt: new Date().toISOString(),
    };

    // Sauvegarder dans la base locale (queue de sync)
    await DB.dbAdd('alerts', {
      type: 'PHARMACOVIGILANCE',
      message: `Déclaration PV — ${data.suspectedDrug} — ${data.severity} `,
      data: declarationRecord,
      status: serverResponse ? 'submitted' : 'pending_sync',
      date: Date.now(),
      priority: data.severity === 'lethal' ? 'critical' : data.severity === 'severe' ? 'high' : 'medium',
    });

    await DB.dbAdd('syncQueue', {
      type: 'PV_DECLARATION',
      data: payload,
      status: serverResponse ? 'synced' : 'pending',
      createdAt: new Date().toISOString(),
      retries: 0,
    });

    return {
      success: !!serverResponse,
      submissionId: payload.submissionId,
      serverResponse,
      sendError,
      offline: !serverResponse,
    };
  },

  async retryPendingDeclarations() {
    const queue = await DB.dbGetAll('syncQueue');
    const pending = queue.filter(q => q.type === 'PV_DECLARATION' && q.status === 'pending');
    let synced = 0;
    for (const item of pending) {
      try {
        const resp = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
          body: JSON.stringify(item.data),
        });
        if (resp.ok) {
          await DB.dbPut('syncQueue', { ...item, status: 'synced', syncedAt: new Date().toISOString() });
          synced++;
        }
      } catch (e) {
        await DB.dbPut('syncQueue', { ...item, retries: (item.retries || 0) + 1 });
      }
    }
    return synced;
  },
};

// Override la fonction de soumission PV pour utiliser le vrai gateway
async function submitPVReport() {
  const form = document.getElementById('pv-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));

  const btn = document.querySelector('.modal-footer .btn-danger');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi en cours…'; }

  try {
    // Charger infos pharmacie
    const settings = await DB.dbGetAll('settings');
    const gs = k => settings.find(s => s.key === k)?.value;
    data.pharmacyName = gs('pharmacy_name') || 'Pharmacie Centrale';
    data.pharmacyDnpm = gs('pharmacy_dnpm') || 'LIC-DNPM-2024-001';
    data.pharmacyPhone = gs('pharmacy_phone') || '+224 620 000 000';

    const result = await ANSSGateway.submitDeclaration(data);

    await DB.writeAudit('PV_REPORT', 'alerts', null, {
      drug: data.suspectedDrug,
      severity: data.severity,
      submissionId: result.submissionId,
      status: result.success ? 'sent' : 'queued',
    });

    UI.closeModal();

    if (result.success) {
      UI.toast(`✅ Déclaration PV transmise à l'ANSS — Réf. ${result.submissionId}`, 'success', 6000);
    } else {
      UI.toast(`📥 Déclaration PV enregistrée localement (ANSS hors ligne)\nElle sera transmise automatiquement lors de la prochaine connexion.`, 'warning', 8000);
    }

    // Afficher le rapport de confirmation
    _showPVConfirmation(data, result);

  } catch (e) {
    console.error(e);
    UI.toast('Erreur lors de l\'envoi : ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Soumettre à l\'ANSS'; }
  }
}

function _showPVConfirmation(data, result) {
  UI.modal('📋 Rapport de Déclaration ANSS', `
    <div class="pv-report-card">
      <div class="pv-report-status ${result.success ? 'status-sent' : 'status-queued'}">
        ${result.success
      ? '✅ Déclaration transmise à l\'ANSS avec succès'
      : '📥 Déclaration enregistrée — Transmission en attente (mode hors ligne)'}
      </div>

      <div class="pv-report-grid">
        <div class="pv-report-row"><span class="pv-lbl">Réf. déclaration</span><span class="pv-val"><code>${result.submissionId}</code></span></div>
        <div class="pv-report-row"><span class="pv-lbl">Médicament suspecté</span><span class="pv-val">${data.suspectedDrug}</span></div>
        <div class="pv-report-row"><span class="pv-lbl">Gravité</span><span class="pv-val"><span class="badge badge-${data.severity === 'lethal' || data.severity === 'severe' ? 'danger' : 'warning'}">${data.severity}</span></span></div>
        <div class="pv-report-row"><span class="pv-lbl">Déclarant</span><span class="pv-val">${data.reporter}</span></div>
        <div class="pv-report-row"><span class="pv-lbl">Date</span><span class="pv-val">${new Date().toLocaleDateString('fr-FR')}</span></div>
        <div class="pv-report-row"><span class="pv-lbl">Statut envoi ANSS</span><span class="pv-val">${result.success ? '<span class="badge badge-success">Envoyé</span>' : '<span class="badge badge-warning">En attente de synchro</span>'}</span></div>
        ${result.sendError ? `<div class="pv-report-row"><span class="pv-lbl">Note technique</span><span class="pv-val text-muted">${result.sendError}</span></div>` : ''}
      </div>

      ${!result.success ? `
        <div class="info-box info-warning" style="margin-top:12px">
          <strong>Mode hors ligne :</strong> La déclaration est sauvegardée localement et sera automatiquement transmise à l'ANSS lors de la prochaine connexion réseau.
          <button class="btn btn-xs btn-primary" style="margin-top:8px;display:block" onclick="ANSSGateway.retryPendingDeclarations().then(n=>UI.toast(n+' déclaration(s) synchronisée(s)','success'))">🔄 Réessayer maintenant</button>
        </div>` : ''}
    </div>
  `, {
    footer: `<button class="btn btn-secondary" onclick="UI.closeModal()">Fermer</button>
             <button class="btn btn-primary" onclick="UI.closeModal();printPVReport('${result.submissionId}')">🖨️ Imprimer</button>`
  });
}

function printPVReport(submissionId) {
  UI.toast('🖨️ Impression du rapport PV en cours...', 'info');
}

window.ANSSGateway = ANSSGateway;
window.previewPVReport = previewPVReport;
window.submitPVReport = submitPVReport;
window.printPVReport = printPVReport;
