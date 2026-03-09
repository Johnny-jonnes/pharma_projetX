/**
 * PHARMA_PROJET — Module Caisse Journalière
 * Journal caisse, clôture, réconciliation, Mobile Money
 */

async function renderCaisse(container) {
  UI.loading(container, 'Chargement de la caisse...');

  const today = new Date().toISOString().split('T')[0];
  const [sales, cashRegister, returns] = await Promise.all([
    DB.dbGetAll('sales'),
    DB.dbGetAll('cashRegister'),
    DB.dbGetAll('returns'),
  ]);

  // Today's sales breakdown
  const todaySales = sales.filter(s => s.date && s.date.startsWith(today) && s.status === 'completed');

  const breakdown = {
    cash: { count: 0, total: 0 },
    orange_money: { count: 0, total: 0 },
    mtn_momo: { count: 0, total: 0 },
    credit: { count: 0, total: 0 },
    transfer: { count: 0, total: 0 },
  };
  todaySales.forEach(s => {
    const m = s.paymentMethod || 'cash';
    if (!breakdown[m]) breakdown[m] = { count: 0, total: 0 };
    breakdown[m].count++;
    breakdown[m].total += s.total || 0;
  });

  // Subtract today's returns from breakdown and gross total
  const todayReturns = returns.filter(r => r.date && r.date.startsWith(today) && r.status === 'approved');
  todayReturns.forEach(r => {
    const m = r.paymentMethod || 'cash';
    if (breakdown[m]) {
      breakdown[m].total -= (r.refundAmount || 0);
    }
  });

  const grandTotal = Object.values(breakdown).reduce((a, b) => a + b.total, 0);
  const totalDiscounts = todaySales.reduce((a, s) => a + (s.discount || 0), 0);

  // Real Monthly Turnover calculation (Net: Sales - Returns)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const monthlySales = sales.filter(s => s.date && s.date >= startOfMonth && s.status === 'completed');
  const monthlyReturns = returns.filter(r => r.date && r.date >= startOfMonth && r.status === 'approved');

  const monthlyTurnover = monthlySales.reduce((a, s) => a + (s.total || 0), 0) -
    monthlyReturns.reduce((a, r) => a + (r.refundAmount || 0), 0);

  // Current theoretical cash balance
  const manualIn = cashRegister.filter(c => c.date === today && c.type === 'manual_in').reduce((a, c) => a + c.amount, 0);
  const manualOut = cashRegister.filter(c => c.date === today && c.type === 'manual_out').reduce((a, c) => a + c.amount, 0);
  const returnOut = cashRegister.filter(c => c.date === today && c.type === 'return_out').reduce((a, c) => a + c.amount, 0);
  const cashSales = todaySales.filter(s => (s.paymentMethod || 'cash') === 'cash').reduce((a, s) => a + s.total, 0);
  const currentCashBalance = cashSales + manualIn - manualOut - returnOut;

  // Check if today is already closed
  const todayClosure = cashRegister.find(c => c.date === today && c.type === 'closure');

  // Get last 7 days closures
  const last7Closures = cashRegister.filter(c => c.type === 'closure').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  // Hourly sales today
  const hourlyData = new Array(24).fill(0);
  todaySales.forEach(s => {
    const h = new Date(s.date).getHours();
    hourlyData[h] += s.total || 0;
  });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Caisse Journalière</h1>
        <p class="page-subtitle">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="openAddCashEntry()"><i data-lucide="plus"></i> Entrée/Sortie manuelle</button>
        ${['admin', 'pharmacien'].includes(DB.AppState.currentUser?.role)
      ? (!todayClosure
        ? `<button class="btn btn-primary" onclick="openCaisseClose()"><i data-lucide="lock"></i> Clôturer la journée</button>`
        : `<span class="badge badge-success" style="padding:8px 16px"><i data-lucide="check-circle"></i> Journée clôturée</span>`
      )
      : (todayClosure
        ? `<span class="badge badge-success" style="padding:8px 16px"><i data-lucide="check-circle"></i> Journée clôturée</span>`
        : `<span class="badge badge-warning" style="padding:8px 16px"><i data-lucide="lock"></i> Clôture : pharmacien uniquement</span>`
      )
    }
      </div>
    </div>

    ${todayClosure ? `<div class="closure-banner"><i data-lucide="check-circle"></i> Cette journée a été clôturée à ${UI.formatDateTime(todayClosure.closedAt)} par ${todayClosure.closedBy}</div>` : ''}
    
    <!-- Tabs Navigation -->
    <div class="tabs-bar" style="margin-bottom: 20px;">
      <button class="tab-btn active" onclick="switchCaisseTab(this,'main')"><i data-lucide="banknote"></i> Ventes du jour</button>
      ${DB.AppState.currentUser?.role !== 'caissier' ? `
      <button class="tab-btn" onclick="switchCaisseTab(this,'detail')"><i data-lucide="calculator"></i> Détail du calcul</button>
      <button class="tab-btn" onclick="switchCaisseTab(this,'stats')"><i data-lucide="bar-chart-3"></i> Statistiques & Clôtures</button>
      ` : ''}
    </div>

    <div id="tab-caisse-main" class="tab-content active">
      <!-- Recap cards -->
      <div class="caisse-recap">
        <div class="caisse-total-card balance-card">
          <div class="caisse-total-icon" style="background: var(--success-color)"><i data-lucide="wallet"></i></div>
          <div>
            <div class="caisse-total-val" id="current-cash-display">${UI.formatCurrency(currentCashBalance)}</div>
            <div class="caisse-total-label">Solde Espèces Théorique</div>
            <div class="caisse-total-sub">Cumul ventes + entrées - sorties</div>
          </div>
        </div>
        <div class="caisse-total-card">
          <div class="caisse-total-icon"><i data-lucide="banknote"></i></div>
          <div>
            <div class="caisse-total-val">${UI.formatCurrency(grandTotal)}</div>
            <div class="caisse-total-label">Recette Totale Journée</div>
            <div class="caisse-total-sub">${todaySales.length} transactions · ${todayReturns.length ? `Net: -${UI.formatCurrency(todayReturns.reduce((a, r) => a + r.refundAmount, 0))} retours` : `${UI.formatCurrency(totalDiscounts)} de remises`}</div>
          </div>
        </div>
      </div>

      <div class="payment-breakdown-grid" style="margin-top:20px">
        ${Object.entries(breakdown).filter(([, v]) => v.count > 0).map(([method, data]) => {
      const icons = { cash: 'banknote', orange_money: 'smartphone', mtn_momo: 'smartphone', credit: 'file-text', transfer: 'landmark' };
      const labels = { cash: 'Espèces', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', credit: 'Crédit', transfer: 'Virement' };
      return `<div class="pay-breakdown-card">
            <span class="pay-icon-lg"><i data-lucide="${icons[method] || 'credit-card'}"></i></span>
            <div>
              <div class="pay-bd-val">${UI.formatCurrency(data.total)}</div>
              <div class="pay-bd-label">${labels[method] || method}</div>
              <div class="pay-bd-count">${data.count} vente(s)</div>
            </div>
          </div>`;
    }).join('')}
      </div>

      <!-- Today transactions list -->
      <div class="dash-panel" style="margin-top:24px">
        <div class="panel-header">
          <h3 class="panel-title"><i data-lucide="clipboard-list"></i> Transactions du jour (Ventes)</h3>
          <button class="btn btn-sm btn-ghost" onclick="exportDayTransactions('${today}')"><i data-lucide="download"></i> CSV</button>
        </div>
        <div id="today-transactions"></div>
      </div>

      <!-- Manual movements list -->
      <div class="dash-panel" style="margin-top:24px">
        <div class="panel-header">
          <h3 class="panel-title"><i data-lucide="banknote"></i> Mouvements Manuels (Hors Ventes)</h3>
        </div>
        <div id="manual-movements"></div>
      </div>
    </div>

    <!-- Tab: Balance Detail -->
    <div id="tab-caisse-detail" class="tab-content" style="display:none">
      <div class="dash-panel" style="border-left: 4px solid var(--success-color)">
        <div class="panel-header" style="padding-bottom:12px">
          <h3 class="panel-title" style="color:var(--success-color)"><i data-lucide="calculator"></i> Justification de l'argent en caisse</h3>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:32px; padding:20px 0; border-bottom: 1px solid var(--border); margin-bottom: 20px;">
          <div class="calc-item">
            <div class="text-xs text-muted font-bold uppercase tracking-wider">VENTES ESPÈCES</div>
            <div class="text-2xl font-bold text-success">+ ${UI.formatCurrency(cashSales)}</div>
            <div class="text-xs text-muted">Ventes payées en "Cash" aujourd'hui</div>
          </div>
          <div class="calc-item" style="font-size: 28px; align-self: center; opacity: 0.3">+</div>
          <div class="calc-item">
            <div class="text-xs text-muted font-bold uppercase tracking-wider">ENTRÉES MANUELLES</div>
            <div class="text-2xl font-bold text-success">+ ${UI.formatCurrency(manualIn)}</div>
            <div class="text-xs text-muted">Fonds initiaux, dépôts, etc.</div>
          </div>
          <div class="calc-item" style="font-size: 28px; align-self: center; opacity: 0.3">-</div>
          <div class="calc-item">
            <div class="text-xs text-muted font-bold uppercase tracking-wider">SORTIES MANUELLES</div>
            <div class="text-2xl font-bold text-danger">- ${UI.formatCurrency(manualOut)}</div>
            <div class="text-xs text-muted">Achats, retraits, frais...</div>
          </div>
          <div class="calc-item" style="font-size: 28px; align-self: center; opacity: 0.3">-</div>
          <div class="calc-item">
            <div class="text-xs text-muted font-bold uppercase tracking-wider">REMBOURSEMENTS RETOURS</div>
            <div class="text-2xl font-bold text-danger">- ${UI.formatCurrency(returnOut)}</div>
            <div class="text-xs text-muted">Médicaments retournés ce jour</div>
          </div>
          <div class="calc-item" style="font-size: 28px; align-self: center; opacity: 0.3">=</div>
          <div class="calc-item">
            <div class="text-xs text-muted font-bold uppercase tracking-wider">SOLDE THÉORIQUE</div>
            <div class="text-3xl font-bold" style="color:var(--success-color)">${UI.formatCurrency(currentCashBalance)}</div>
            <div class="text-xs text-muted">Argent réel attendu dans le tiroir</div>
          </div>
        </div>
        
        <div style="background: var(--surface-2); padding: 16px; border-radius: 8px; border: 1px dashed var(--border);">
          <p class="text-sm text-muted" style="line-height: 1.6;">
            <i data-lucide="info" style="width:16px; height:16px; margin-right:6px; vertical-align: middle; color: var(--info);"></i>
            <strong>Note importante :</strong> Votre Chiffre d'Affaires du mois est de <strong>${UI.formatCurrency(monthlyTurnover)}</strong>. 
            Ce montant inclut les paiements numériques (Orange Money, MTN) et les ventes à crédit. 
            Seuls les encaissements physiques sont pris en compte dans le <strong>Solde Théorique</strong> ci-dessus.
          </p>
        </div>
      </div>
    </div>

    <!-- Tab: Stats & Closures -->
    <div id="tab-caisse-stats" class="tab-content" style="display:none">
      <!-- Charts row -->
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-header"><h3 class="chart-title">Ventes par heure aujourd'hui</h3></div>
          <canvas id="chart-hourly" width="500" height="250"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-header"><h3 class="chart-title">Répartition paiements</h3></div>
          <canvas id="chart-pay-breakdown" width="500" height="250"></canvas>
        </div>
      </div>

      <!-- Last closures -->
      <div class="dash-panel" style="margin-top:24px">
        <div class="panel-header"><h3 class="panel-title"><i data-lucide="calendar"></i> Historique des 7 dernières clôtures</h3></div>
        ${last7Closures.length === 0 ? '<p class="text-muted text-center" style="padding:40px">Aucune clôture enregistrée</p>' : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Ventes Totales</th><th>Transactions</th><th>Clôturé par</th><th>Écart caisse</th></tr></thead>
              <tbody>
                ${last7Closures.map(c => {
      const ecart = (c.physicalCash || 0) - (c.expectedCash || 0);
      return `<tr>
                  <td>${UI.formatDate(c.date)}</td>
                  <td><strong>${UI.formatCurrency(c.totalSales || 0)}</strong></td>
                  <td>${c.transactionCount || 0}</td>
                  <td>${c.closedBy || '—'}</td>
                  <td class="${ecart === 0 ? 'text-success' : ecart > 0 ? 'text-success' : 'text-danger'} font-bold">${ecart >= 0 ? '+' : ''}${UI.formatCurrency(ecart)}</td>
                </tr>`;
    }).join('')}
              </tbody>
            </table>
          </div>`}
      </div>
    </div>
  `;

  // Render transactions & movements
  const txContainer = document.getElementById('today-transactions');
  if (txContainer) {
    if (todaySales.length === 0) {
      txContainer.innerHTML = '<div class="empty-state-small">Aucune vente aujourd\'hui</div>';
    } else {
      // Pré-calculer les remboursements par vente pour affichage net
      const refundMap = {};
      todayReturns.forEach(r => {
        refundMap[r.saleId] = (refundMap[r.saleId] || 0) + (r.refundAmount || 0);
      });

      const sortedTx = [...todaySales].sort((a, b) => new Date(b.date) - new Date(a.date));
      UI.table(txContainer, [
        { label: 'Heure', render: r => new Date(r.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
        { label: 'N° Vente', render: r => `<code class="code-tag">#${String(r.id).padStart(6, '0')}</code>` },
        { label: 'Articles', render: r => `${r.itemCount || '—'}` },
        { label: 'Remise', render: r => r.discount > 0 ? `<span class="text-warning">-${UI.formatCurrency(r.discount)}</span>` : '—' },
        {
          label: 'Montant Net', render: r => {
            const refunded = refundMap[r.id] || 0;
            const net = r.total - refunded;
            let badge = '';
            if (r.returnStatus === 'fully_returned') badge = ' <span class="badge badge-neutral" style="font-size:0.72em">Retourné</span>';
            else if (r.returnStatus === 'partially_returned') badge = ` <span class="badge badge-warning" style="font-size:0.72em">Ret. partiel (${UI.formatCurrency(refunded)})</span>`;
            return `<strong class="text-success">${UI.formatCurrency(net)}</strong>${badge}`;
          }
        },
        { label: 'Mode', render: r => UI.paymentMethodBadge(r.paymentMethod) },
        { label: '', render: r => `<button class="btn btn-xs btn-ghost" onclick="viewSaleDetail(${r.id})"><i data-lucide="eye"></i> Détail</button>` },
      ], sortedTx);
    }
  }
  // Render manual movements (entrées, sorties manuelles + remboursements retours)
  const manualContainer = document.getElementById('manual-movements');
  if (manualContainer) {
    const manualTx = cashRegister.filter(c => c.date === today && ['manual_in', 'manual_out', 'return_out'].includes(c.type));
    if (manualTx.length === 0) {
      manualContainer.innerHTML = '<div class="empty-state-small">Aucun mouvement manuel aujourd\'hui</div>';
    } else {
      const sortedManual = [...manualTx].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      UI.table(manualContainer, [
        { label: 'Heure', render: r => r.timestamp ? new Date(r.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—' },
        {
          label: 'Type', render: r => {
            if (r.type === 'return_out') return '<span class="badge badge-warning"><i data-lucide="undo-2"></i> Remboursement Retour</span>';
            return `<span class="badge badge-${r.type === 'manual_in' ? 'success' : 'warning'}"><i data-lucide="${r.type === 'manual_in' ? 'arrow-up' : 'arrow-down'}"></i> ${r.type === 'manual_in' ? 'Entrée' : 'Sortie'}</span>`;
          }
        },
        { label: 'Montant', render: r => `<strong class="text-danger">-${UI.formatCurrency(r.amount)}</strong>`.replace('text-danger">-', r.type === 'manual_in' ? 'text-success">+' : 'text-danger">-') },
        { label: 'Motif', render: r => r.reason || '—' },
        { label: 'Mode', render: r => UI.paymentMethodBadge(r.paymentMethod) },
        { label: 'Réf.', render: r => r.reference ? `<code class="code-tag">${r.reference}</code>` : (r.returnId ? `<code class="code-tag">RET-${String(r.returnId).padStart(5, '0')}</code>` : '—') },
      ], sortedManual);
    }
  }

  if (window.lucide) lucide.createIcons();

  // Draw charts
  requestAnimationFrame(() => {
    const activeHours = hourlyData.map((v, h) => ({ h, v })).filter(x => x.v > 0);
    const peakHour = activeHours.length > 0 ? activeHours.reduce((a, b) => b.v > a.v ? b : a).h : 12;
    const displayHours = Array.from({ length: 24 }, (_, i) => i);
    Charts.bar('chart-hourly',
      new Array(24).fill(0).map((_, h) => `${h}h`),
      [{ data: hourlyData, color: '#2E86C1' }]
    );

    const payKeys = Object.keys(breakdown).filter(k => breakdown[k].count > 0);
    const payColors = { cash: '#F39C12', orange_money: '#E74C3C', mtn_momo: '#F1C40F', credit: '#3498DB', transfer: '#2ECC71' };
    const payLabels = { cash: 'Espèces', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', credit: 'Crédit', transfer: 'Virement' };
    Charts.donut('chart-pay-breakdown',
      payKeys.map(k => payLabels[k] || k),
      payKeys.map(k => breakdown[k].total),
      payKeys.map(k => payColors[k] || '#95A5A6')
    );
  });
}

function switchCaisseTab(btn, tabId) {
  const targetId = `tab-caisse-${tabId}`;
  const target = document.getElementById(targetId);
  if (!target) return;

  const bar = btn.closest('.tabs-bar');
  bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  document.querySelectorAll('#tab-caisse-main, #tab-caisse-detail, #tab-caisse-stats').forEach(t => t.style.display = 'none');

  btn.classList.add('active');
  target.style.display = 'block';
}

function openAddCashEntry() {
  UI.modal('<i data-lucide="banknote" class="modal-icon-inline"></i> Mouvement de Caisse Manuel', `
    <form id="cash-entry-form" class="form-grid">
      <div class="form-group">
        <label>Type de mouvement *</label>
        <select name="type" id="cash-entry-type" class="form-control" required>
          <option value="in">Entrée (fond de caisse, autre recette)</option>
          <option value="out">Sortie (achat express, remboursement, dépense)</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Montant (GNF) *</label>
          <input type="number" name="amount" class="form-control" min="1" required>
        </div>
        <div class="form-group">
          <label>Mode de paiement</label>
          <select name="paymentMethod" class="form-control">
            <option value="cash">Espèces</option>
            <option value="orange_money">Orange Money</option>
            <option value="mtn_momo">MTN MoMo</option>
            <option value="transfer">Virement</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Motif *</label>
        <input type="text" name="reason" class="form-control" placeholder="Ex: Fond de caisse initial, Remboursement patient..." required>
      </div>
      <div class="info-box-small" style="margin-top:8px">
        <i data-lucide="info"></i>
        <span>Solde actuel en caisse : <strong>${document.getElementById('current-cash-display')?.textContent || '...'}</strong></span>
      </div>
      <div class="form-group">
        <label>N° de référence</label>
        <input type="text" name="reference" class="form-control" placeholder="N° de reçu, N° transaction Orange Money...">
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitCashEntry()"><i data-lucide="check"></i> Enregistrer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function submitCashEntry() {
  const form = document.getElementById('cash-entry-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  const amount = parseFloat(data.amount);
  const type = data.type === 'in' ? 'manual_in' : 'manual_out';

  if (type === 'manual_out') {
    const today = new Date().toISOString().split('T')[0];
    const [sales, cashRegister] = await Promise.all([
      DB.dbGetAll('sales'),
      DB.dbGetAll('cashRegister'),
    ]);

    const cashSales = sales.filter(s => s.date?.startsWith(today) && (s.paymentMethod || 'cash') === 'cash' && s.status === 'completed').reduce((a, s) => a + s.total, 0);
    const manualIn = cashRegister.filter(c => c.date === today && c.type === 'manual_in').reduce((a, c) => a + c.amount, 0);
    const manualOut = cashRegister.filter(c => c.date === today && c.type === 'manual_out').reduce((a, c) => a + c.amount, 0);
    const currentBalance = cashSales + manualIn - manualOut;

    if (amount > currentBalance) {
      UI.toast("L'argent n'est pas dans la caisse", 'error', 5000);
      return;
    }
  }

  await DB.dbAdd('cashRegister', {
    type,
    amount,
    paymentMethod: data.paymentMethod,
    reason: data.reason,
    reference: data.reference || '',
    date: new Date().toISOString().split('T')[0],
    timestamp: Date.now(),
    userId: DB.AppState.currentUser?.id,
  });
  await DB.writeAudit('CASH_ENTRY', 'cashRegister', null, data);
  UI.closeModal();
  UI.toast(`Mouvement de caisse enregistré`, 'success');
  Router.navigate('caisse');
}

function openCaisseClose() {
  UI.modal('<i data-lucide="lock" class="modal-icon-inline"></i> Clôture de Caisse', `
    <div class="closure-form">
      <div class="closure-warning">
        <i data-lucide="alert-triangle"></i>
        <p>La clôture de caisse est une opération définitive pour la journée. Elle doit être réalisée par le responsable de la pharmacie.</p>
      </div>
      <div class="form-grid" style="margin-top:16px">
        <div class="form-row">
          <div class="form-group">
            <label>Fond d'ouverture de caisse (GNF)</label>
            <input type="number" id="closure-opening" class="form-control" placeholder="Montant en espèces en caisse ce matin">
          </div>
          <div class="form-group">
            <label>Espèces comptées en caisse (GNF)</label>
            <input type="number" id="closure-physical" class="form-control" placeholder="Comptage physique actuel" oninput="calcClosureEcart()">
          </div>
        </div>
        <div class="form-group">
          <label>Espèces attendues selon système</label>
          <div id="closure-expected" class="closure-expected-display">Calcul en cours...</div>
        </div>
        <div class="form-group">
          <label>Écart de caisse</label>
          <div id="closure-ecart" class="closure-ecart-display">—</div>
        </div>
        <div class="form-group">
          <label>Observations</label>
          <textarea id="closure-note" class="form-control" rows="2" placeholder="Billets retirés, déposés en banque, incidents..."></textarea>
        </div>
      </div>
    </div>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-danger" onclick="confirmCaisseClose()"><i data-lucide="lock"></i> Confirmer la Clôture</button>
    `
  });
  if (window.lucide) lucide.createIcons();
  calcExpectedCash();
}

async function calcExpectedCash() {
  const today = new Date().toISOString().split('T')[0];
  const sales = await DB.dbGetAll('sales');
  const todayCash = sales.filter(s => s.date?.startsWith(today) && s.paymentMethod === 'cash' && s.status === 'completed').reduce((a, s) => a + s.total, 0);
  const manualIn = (await DB.dbGetAll('cashRegister')).filter(c => c.date === today && c.type === 'manual_in').reduce((a, c) => a + c.amount, 0);
  const manualOut = (await DB.dbGetAll('cashRegister')).filter(c => c.date === today && c.type === 'manual_out').reduce((a, c) => a + c.amount, 0);
  const returnOut = (await DB.dbGetAll('cashRegister')).filter(c => c.date === today && c.type === 'return_out').reduce((a, c) => a + c.amount, 0);
  const expected = todayCash + manualIn - manualOut - returnOut;
  const todayReturns = (await DB.dbGetAll('returns')).filter(r => r.date?.startsWith(today) && r.status === 'approved');
  const totalReturnsAmt = todayReturns.reduce((a, r) => a + (r.refundAmount || 0), 0);

  window._expectedCash = expected;
  window._todayCashTotal = todayCash;
  window._todaySalesCount = sales.filter(s => s.date?.startsWith(today) && s.status === 'completed').length;
  window._todaySalesTotal = sales.filter(s => s.date?.startsWith(today) && s.status === 'completed').reduce((a, s) => a + s.total, 0) - totalReturnsAmt;

  const el = document.getElementById('closure-expected');
  if (el) el.textContent = UI.formatCurrency(expected);
  calcClosureEcart();
}

function calcClosureEcart() {
  const physical = parseFloat(document.getElementById('closure-physical')?.value || 0);
  const expected = window._expectedCash || 0;
  const ecart = physical - expected;
  const el = document.getElementById('closure-ecart');
  if (el) {
    el.textContent = `${ecart >= 0 ? '+' : ''}${UI.formatCurrency(ecart)}`;
    el.className = 'closure-ecart-display ' + (ecart === 0 ? 'ecart-ok' : ecart > 0 ? 'ecart-surplus' : 'ecart-deficit');
  }
}

async function confirmCaisseClose() {
  // Restriction : seul le pharmacien ou l'admin peut clôturer
  const role = DB.AppState.currentUser?.role;
  if (!['admin', 'pharmacien'].includes(role)) {
    UI.toast('Seul(e) le/la pharmacien(ne) ou l\'administrateur peut clôturer la caisse.', 'error', 5000);
    UI.closeModal();
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const physical = parseFloat(document.getElementById('closure-physical')?.value || 0);
  const opening = parseFloat(document.getElementById('closure-opening')?.value || 0);
  const note = document.getElementById('closure-note')?.value || '';

  const ok = await UI.confirm(`Confirmer la clôture de caisse du ${today} ?\n\nCette action est irréversible. Aucune vente ne pourra être enregistrée après la clôture.`);
  if (!ok) return;

  await DB.dbAdd('cashRegister', {
    type: 'closure',
    date: today,
    closedAt: Date.now(),
    closedBy: DB.AppState.currentUser?.name,
    closedByRole: role,
    openingFund: opening,
    expectedCash: window._expectedCash || 0,
    physicalCash: physical,
    totalSales: window._todaySalesTotal || 0,
    transactionCount: window._todaySalesCount || 0,
    note,
  });

  await DB.writeAudit('CAISSE_CLOSURE', 'cashRegister', null, { date: today, physical, expected: window._expectedCash, closedBy: DB.AppState.currentUser?.name });
  UI.closeModal();
  UI.toast('Caisse clôturée avec succès. Les ventes sont bloquées pour aujourd\'hui.', 'success', 5000);
  Router.navigate('caisse');
}

async function exportDayTransactions(date) {
  const sales = await DB.dbGetAll('sales');
  const daySales = sales.filter(s => s.date?.startsWith(date));
  const csv = '\uFEFFN° Vente,Heure,Articles,Remise,Total,Mode Paiement\n' +
    daySales.map(s => [s.id, new Date(s.date).toLocaleTimeString('fr-FR'), s.itemCount || '', s.discount || 0, s.total, s.paymentMethod].join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `caisse_${date}.csv`;
  a.click();
}

window.switchCaisseTab = switchCaisseTab;
window.openAddCashEntry = openAddCashEntry;
window.submitCashEntry = submitCashEntry;
window.openCaisseClose = openCaisseClose;
window.calcClosureEcart = calcClosureEcart;
window.confirmCaisseClose = confirmCaisseClose;
window.exportDayTransactions = exportDayTransactions;

Router.register('caisse', renderCaisse);
