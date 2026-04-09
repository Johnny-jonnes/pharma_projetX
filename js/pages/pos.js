/**
 * PHARMA_PROJET v3 — Point de Vente Professionnel
 * Panier · Client · Ordonnance · Mobile Money · Reçu officiel
 * FEFO · Interactions · Substitution Générique
 */

let posCart = [];
let posProducts = [];
let posStock = {};
let posLots = []; // Loaded for FEFO
let posSearch = '';
let posCurrentPatient = null;
let posCurrentRx = null;
let posActiveCategory = '';
let posMobilePayState = 'idle'; // idle | en_attente | confirme | echoue

// ═══════════════════════════════════════════════════════════════════
// INTERACTIONS MÉDICAMENTEUSES — Base statique des 30 combinaisons critiques
// Format: [DCI_A, DCI_B, niveau (grave/modéré), description]
// ═══════════════════════════════════════════════════════════════════
const DRUG_INTERACTIONS = [
  ['methotrexate','trimethoprime','grave','Risque de pancytopénie potentiellement fatale'],
  ['warfarine','aspirine','grave','Hémorragie sévère — surveillance INR obligatoire'],
  ['warfarine','ibuprofène','grave','Hémorragie digestive — AINS contre-indiqués'],
  ['warfarine','fluconazole','grave','Augmentation effet anticoagulant — hémorragie'],
  ['metformine','produit de contraste iodé','modéré','Risque acidose lactique'],
  ['ciprofloxacine','théophylline','grave','Convulsions — surdosage théophylline'],
  ['érythromycine','simvastatine','grave','Rhabdomyolyse — toxicité musculaire'],
  ['clarithromycine','simvastatine','grave','Rhabdomyolyse — toxicité musculaire'],
  ['fluconazole','simvastatine','grave','Rhabdomyolyse — inhibition CYP3A4'],
  ['métronidazole','alcool','grave','Effet antabuse — nausées, vomissements sévères'],
  ['ciprofloxacine','fer','modéré','Absorption réduite de la ciprofloxacine'],
  ['tétracycline','calcium','modéré','Chélation — perte d\'efficacité antibiotique'],
  ['doxycycline','calcium','modéré','Absorption réduite de la doxycycline'],
  ['amoxicilline','méthotrexate','grave','Toxicité méthotrexate augmentée'],
  ['lithium','ibuprofène','grave','Toxicité lithium — insuffisance rénale'],
  ['lithium','diclofénac','grave','Toxicité lithium — insuffisance rénale'],
  ['digoxine','amiodarone','grave','Toxicité digitale — bradycardie sévère'],
  ['digoxine','vérapamil','grave','Bradycardie sévère — bloc AV'],
  ['carbamazépine','érythromycine','grave','Toxicité carbamazépine — ataxie, nystagmus'],
  ['phénytoïne','fluconazole','grave','Toxicité phénytoïne augmentée'],
  ['captopril','spironolactone','modéré','Hyperkaliémie — surveillance potassium'],
  ['énalapril','spironolactone','modéré','Hyperkaliémie — surveillance potassium'],
  ['cisapride','fluconazole','grave','Allongement QT — arythmie cardiaque'],
  ['tramadol','carbamazépine','modéré','Efficacité tramadol réduite — induction enzymatique'],
  ['clopidogrel','oméprazole','modéré','Efficacité clopidogrel réduite — éviter association'],
  ['sildenafil','nitrate','grave','Hypotension sévère potentiellement fatale'],
  ['isoniazide','rifampicine','modéré','Hépatotoxicité — surveillance hépatique obligatoire'],
  ['amiodarone','simvastatine','grave','Rhabdomyolyse — limiter dose statine'],
  ['métoclopramide','lévodopa','modéré','Antagonisme dopaminergique — perte d\'efficacité'],
  ['furosémide','gentamicine','grave','Ototoxicité et néphrotoxicité augmentées'],
];

/**
 * Vérifie les interactions médicamenteuses entre un nouveau produit et le panier actuel
 */
function checkDrugInteractions(newProduct) {
  if (!newProduct.dci) return [];
  const newDci = newProduct.dci.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const alerts = [];
  for (const cartItem of posCart) {
    if (!cartItem.dci) continue;
    const cartDci = cartItem.dci.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const [dciA, dciB, level, desc] of DRUG_INTERACTIONS) {
      const a = dciA.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const b = dciB.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if ((newDci.includes(a) && cartDci.includes(b)) || (newDci.includes(b) && cartDci.includes(a))) {
        alerts.push({ with: cartItem.name, level, desc });
      }
    }
  }
  return alerts;
}

/**
 * FEFO : Retourne le lot actif avec la DLC la plus proche pour un produit
 */
function getFEFOLot(productId) {
  try {
    const productLots = posLots
      .filter(l => l.productId === productId && l.status === 'active' && l.quantity > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    return productLots[0] || null;
  } catch (e) { return null; }
}

/**
 * Substitution Générique : Trouve les alternatives DCI en stock
 */
function findGenericAlternatives(product) {
  if (!product.dci) return [];
  const dci = product.dci.toLowerCase();
  return posProducts.filter(p =>
    p.id !== product.id &&
    p.dci && p.dci.toLowerCase() === dci &&
    (posStock[p.id] || 0) > 0
  );
}

// Route registration is at the bottom of this file

// ═══════════════════════════════════════════════════════════════════
// RENDU PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
async function renderPOS(container) {
  posCart = [];
  posCurrentPatient = null;
  posCurrentRx = null;
  posMobilePayState = 'idle';

  const [products, stockAll, patients, prescriptions, lots] = await Promise.all([
    DB.dbGetAll('products'),
    DB.dbGetAll('stock'),
    DB.dbGetAll('patients'),
    DB.dbGetAll('prescriptions'),
    DB.dbGetAll('lots'),
  ]);

  posProducts = products.filter(p => p.status !== 'inactive');
  posStock = {};
  stockAll.forEach(s => { posStock[s.productId] = s.quantity; });
  posLots = lots.filter(l => l.status === 'active');
  window._posPatients = patients;
  window._posPrescriptions = prescriptions.filter(rx => ['pending', 'validated'].includes(rx.status));

  container.innerHTML = `
    <div class="pos-wrap">

      <!-- ══ GAUCHE : Catalogue ══ -->
      <div class="pos-left">
        <div class="pos-searchbar">
          <div class="pos-searchfield">
            <span class="pos-searchicon"><i data-lucide="search"></i></span>
            <input id="pos-search" type="text" class="pos-searchinput"
              placeholder="Nom médicament, DCI, code barre…" autocomplete="off">
            <button id="pos-clearsearch" class="pos-clearbtn" onclick="clearPosSearch()" style="display:none"><i data-lucide="x"></i></button>
          </div>
          <button class="btn btn-sm btn-ghost" onclick="startBarcodeScan()" title="Scanner"><i data-lucide="camera"></i></button>
        </div>
        <div class="pos-catbar" id="pos-catbar"></div>
        <div id="pos-grid" class="pos-grid"></div>
      </div>

      <!-- ══ DROITE : Panier complet ══ -->
      <div class="pos-right pos-cart-panel" id="pos-cart-panel">
        <!-- MOBILE HEADER TOGGLE -->
        <div class="pos-cart-header" onclick="this.parentElement.classList.toggle('expanded')">
            <div style="display:flex; align-items:center; gap:10px">
                <i data-lucide="shopping-basket"></i>
                <span style="font-weight:700">Votre Panier</span>
            </div>
            <i data-lucide="chevron-up" class="cart-toggle-icon"></i>
        </div>

        <!-- CLIENT -->
        <div class="pos-section">
          <div class="pos-section-header">
            <span class="pos-section-icon"><i data-lucide="user"></i></span>
            <span class="pos-section-title">Patient</span>
            <button class="btn btn-xs btn-outline" onclick="showQuickNewClient()" title="Nouveau patient"><i data-lucide="plus"></i> Nouveau Patient</button>
          </div>
          <div class="client-selection-area">
            <div id="client-search-trigger" class="client-selector-box" onclick="showPatientRepertory()">
              <i data-lucide="search"></i>
              <span>Cliquez ici pour choisir un patient...</span>
            </div>
          </div>
          <div id="client-badge" style="display:none"></div>
        </div>

        <!-- ORDONNANCE — section visible et bien marquée -->
        <div class="pos-section pos-section-rx" id="pos-rx-section">
          <div class="pos-section-header">
            <span class="pos-section-icon"><i data-lucide="file-text"></i></span>
            <span class="pos-section-title">Vente sur Ordonnance</span>
            <label class="toggle-switch">
              <input type="checkbox" id="rx-toggle" onchange="onRxToggle(this.checked)">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>
          <div id="rx-detail" style="display:none">
            <div class="rx-info-row">
              <span class="rx-info-text">Liez une ordonnance validée pour charger automatiquement les médicaments prescrits.</span>
              <button class="btn btn-sm btn-primary" onclick="openRxPicker()"><i data-lucide="link"></i> Choisir une Rx</button>
            </div>
            <div id="rx-badge" style="display:none"></div>
          </div>
        </div>

        <!-- ARTICLES DU PANIER -->
        <div class="pos-section pos-section-cart">
          <div class="pos-section-header">
            <span class="pos-section-icon"><i data-lucide="shopping-cart"></i></span>
            <span class="pos-section-title">Panier</span>
            <span class="cart-count-badge" id="cart-count">0 article</span>
          </div>
          <div class="pos-cart-body" id="pos-cart-items">
            <div class="cart-placeholder">
              <div class="cart-placeholder-icon"><i data-lucide="shopping-cart"></i></div>
              <div class="cart-placeholder-text">Panier vide</div>
              <div class="cart-placeholder-sub">Cliquez sur un médicament à gauche pour l'ajouter</div>
            </div>
          </div>
        </div>

        <!-- TOTAUX & REMISE -->
        <div class="pos-totals-block">
          <div class="totals-row">
            <span class="totals-label">Sous-total</span>
            <span id="pos-subtotal" class="totals-value">0 GNF</span>
          </div>
          <div class="totals-row">
            <span class="totals-label">Remise</span>
            <div class="discount-controls">
              <button class="disc-btn" onclick="quickDiscount(5)">-5%</button>
              <button class="disc-btn" onclick="quickDiscount(10)">-10%</button>
              <button class="disc-btn" onclick="quickDiscount(15)">-15%</button>
              <input id="pos-discount" type="number" class="disc-input" value="0" min="0" step="100" oninput="refreshTotals()"> GNF
            </div>
          </div>
          <div class="totals-row totals-total">
            <span>TOTAL À PAYER</span>
            <span id="pos-total">0 GNF</span>
          </div>
        </div>

        <!-- MODE DE PAIEMENT -->
        <div class="pos-pay-block">
          <div class="pay-label">Mode de paiement</div>
          <div class="pay-methods">
            <button class="pay-btn active" data-m="cash"         onclick="selectPay(this)"><span class="pay-icon"><i data-lucide="banknote"></i></span><span class="pay-name">Espèces</span></button>
            <button class="pay-btn"        data-m="orange_money" onclick="selectPay(this)"><span class="pay-icon"><i data-lucide="smartphone"></i></span><span class="pay-name">Orange Money</span></button>
            <button class="pay-btn"        data-m="mtn_momo"     onclick="selectPay(this)"><span class="pay-icon"><i data-lucide="smartphone"></i></span><span class="pay-name">MTN MoMo</span></button>
            <button class="pay-btn"        data-m="combined"     onclick="selectPay(this)"><span class="pay-icon"><i data-lucide="split"></i></span><span class="pay-name">Combiné</span></button>
            <button class="pay-btn"        data-m="assurance"    onclick="selectPay(this)"><span class="pay-icon"><i data-lucide="shield-plus"></i></span><span class="pay-name">Couverture</span></button>
            <button class="pay-btn"        data-m="credit"       onclick="selectPay(this)"><span class="pay-icon"><i data-lucide="file-clock"></i></span><span class="pay-name">Crédit</span></button>
          </div>

          <!-- Détail Espèces -->
          <div id="pay-cash" class="pay-detail">
            <div class="pay-detail-row">
              <label class="pay-detail-label">Montant reçu (GNF)</label>
              <input id="cash-in" type="number" class="pay-input" placeholder="0" oninput="refreshChange()">
            </div>
            <div id="cash-shortcuts" class="cash-quick"></div>
            <div class="pay-detail-row">
              <label class="pay-detail-label">Monnaie à rendre</label>
              <strong id="cash-change" class="change-amount">—</strong>
            </div>
          </div>

          <!-- Détail Mobile Money -->
          <div id="pay-mobile" class="pay-detail" style="display:none">
            <div class="pay-detail-row">
              <label class="pay-detail-label">Numéro du patient</label>
              <input id="mm-phone" type="tel" class="pay-input" placeholder="+224 6XX XXX XXX" oninput="refreshMmPhone()">
            </div>
            <div id="mm-state" class="mm-state mm-idle">
              <button class="btn btn-sm btn-primary mm-send-btn" onclick="initMobilePay()">
                <i data-lucide="send"></i> Envoyer la demande de paiement
              </button>
            </div>
          </div>

          <!-- Détail Paiement Combiné -->
          <div id="pay-combined" class="pay-detail" style="display:none">
            <div class="combined-info" style="background:rgba(46,134,193,0.08);border:1px solid rgba(46,134,193,0.2);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--text-muted)">
              <i data-lucide="info" style="width:14px;height:14px;vertical-align:text-bottom;margin-right:4px"></i>
              Divisez le paiement entre deux modes. Le total doit couvrir le montant dû.
            </div>
            <div class="combined-split-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
              <div style="flex:1;min-width:180px">
                <label class="pay-detail-label" style="margin-bottom:6px;display:block">1er mode</label>
                <select id="combined-method-1" class="pay-input" style="margin-bottom:8px" onchange="onCombinedChange()">
                  <option value="cash">Espèces</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_momo">MTN MoMo</option>
                </select>
                <input id="combined-amount-1" type="number" class="pay-input" placeholder="Montant 1" oninput="refreshCombined()">
              </div>
              <div style="flex:1;min-width:180px">
                <label class="pay-detail-label" style="margin-bottom:6px;display:block">2ème mode</label>
                <select id="combined-method-2" class="pay-input" style="margin-bottom:8px" onchange="onCombinedChange()">
                  <option value="orange_money">Orange Money</option>
                  <option value="cash">Espèces</option>
                  <option value="mtn_momo">MTN MoMo</option>
                </select>
                <input id="combined-amount-2" type="number" class="pay-input" placeholder="Montant 2" oninput="refreshCombined()">
              </div>
            </div>
            <div id="combined-phone-row" style="display:none;margin-bottom:12px">
              <label class="pay-detail-label">Numéro Mobile Money</label>
              <input id="combined-mm-phone" type="tel" class="pay-input" placeholder="+224 6XX XXX XXX">
            </div>
            <div id="combined-status" style="padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;background:var(--bg);color:var(--text-muted)">Saisissez les montants</div>
          </div>

          <!-- Détail Prise en Charge / Assurance -->
          <div id="pay-assurance" class="pay-detail" style="display:none">
            <div class="combined-info" style="background:rgba(46,175,125,0.08);border:1px solid rgba(46,175,125,0.2);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--success-color)">
              <i data-lucide="shield-check" style="width:14px;height:14px;vertical-align:text-bottom;margin-right:4px"></i>
              Prise en charge (Tiers-Payant). La part Assurance sera enregistrée comme Créance.
            </div>
            <div class="pay-detail-row">
              <label class="pay-detail-label">Organisme (Assurance/Entreprise) *</label>
              <input id="assur-name" type="text" class="pay-input" placeholder="Ex: SAHAM, INAM, Ogar...">
            </div>
            <div class="pay-detail-row">
              <label class="pay-detail-label">Numéro Prise en Charge / Matricule (Optionnel)</label>
              <input id="assur-ref" type="text" class="pay-input" placeholder="Réf...">
            </div>
            <div class="pay-detail-row">
              <label class="pay-detail-label">Montant Pris en charge par l'organisme (GNF) *</label>
              <input id="assur-amount" type="number" class="pay-input" placeholder="Saisir montant" oninput="calcAssurance()">
            </div>
            
            <hr style="margin:16px 0; border:1px dashed var(--border)">
            
            <div class="pay-detail-row">
              <label class="pay-detail-label" style="color:var(--primary); font-weight:700">Ticket Modérateur (Reste à payer Patient)</label>
              <strong id="assur-patient-part" style="font-size:20px; color:var(--text)">—</strong>
            </div>
            <div class="combined-split-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
              <div style="flex:1;min-width:140px">
                 <label class="pay-detail-label">Méthode Patient</label>
                 <select id="assur-patient-method" class="pay-input" onchange="calcAssurance()">
                    <option value="cash">Espèces</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="mtn_momo">MTN MoMo</option>
                 </select>
              </div>
              <div style="flex:1;min-width:140px" id="assur-patient-recv-wrap">
                 <label class="pay-detail-label">Montant reçu Patient (GNF)</label>
                 <input id="assur-patient-recv" type="number" class="pay-input" placeholder="0" oninput="calcAssurance()">
              </div>
              <div style="flex:1;min-width:140px;display:none" id="assur-patient-phone-wrap">
                 <label class="pay-detail-label">Numéro MM Patient</label>
                 <input id="assur-patient-phone" type="tel" class="pay-input" placeholder="+224...">
              </div>
            </div>
            <div id="assur-status" style="font-size:13px;font-weight:600;margin-top:4px"></div>
            <div class="credit-warn" style="margin-top:12px"><i data-lucide="alert-triangle"></i> Un patient doit obligatoirement être sélectionné</div>
          </div>

          <!-- Détail Crédit -->
          <div id="pay-credit" class="pay-detail" style="display:none">
            <div class="pay-detail-row">
              <label class="pay-detail-label">Date d'échéance</label>
              <input id="credit-date" type="date" class="pay-input"
                value="${new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]}">
            </div>
            <div class="credit-warn"><i data-lucide="alert-triangle"></i> Vente à crédit — un patient doit être sélectionné</div>
          </div>
        </div>

        <!-- BOUTONS D'ACTION -->
        <div class="pos-actions-bar">
          <button class="btn btn-ghost pos-btn-cancel" onclick="viderPanier()"><i data-lucide="trash-2"></i> Vider</button>
          <button class="btn btn-secondary pos-btn-hold" onclick="mettreEnAttente()"><i data-lucide="pause"></i> Attente</button>
          <button id="btn-valider" class="btn btn-success pos-btn-validate" onclick="validerVente()">
            <i data-lucide="check-circle"></i> Valider la Vente
          </button>
        </div>

      </div><!-- fin pos-right -->
    </div><!-- fin pos-wrap -->
  `;

  buildCatBar();
  refreshGrid();
  initPosSearch();
  document.getElementById('pos-search').focus();

  // Restore held cart
  if (window._heldCart) {
    posCart = window._heldCart.items;
    posCurrentPatient = window._heldCart.patient;
    posCurrentRx = window._heldCart.rx;
    window._heldCart = null;
    refreshCartUI();
    if (posCurrentPatient) renderClientBadge(posCurrentPatient);
  }
  if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════
// CATALOGUE
// ═══════════════════════════════════════════════════════════════════
function buildCatBar() {
  const cats = [...new Set(posProducts.map(p => p.category).filter(Boolean))].sort();
  const el = document.getElementById('pos-catbar');
  if (!el) return;
  el.innerHTML = `<button class="cat-pill active" onclick="filterCat(this,'')">Tous</button>`
    + cats.map(c => `<button class="cat-pill" onclick="filterCat(this,'${c}')">${c}</button>`).join('');
}

function filterCat(btn, cat) {
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  posActiveCategory = cat;
  refreshGrid();
}

function initPosSearch() {
  const input = document.getElementById('pos-search');
  if (!input) return;
  input.addEventListener('input', e => {
    posSearch = e.target.value.toLowerCase();
    document.getElementById('pos-clearsearch').style.display = posSearch ? 'flex' : 'none';
    refreshGrid();
  });
}

function clearPosSearch() {
  posSearch = '';
  const inp = document.getElementById('pos-search');
  if (inp) inp.value = '';
  document.getElementById('pos-clearsearch').style.display = 'none';
  refreshGrid();
}

function refreshGrid() {
  const grid = document.getElementById('pos-grid');
  if (!grid) return;

  let list = posProducts;
  if (posActiveCategory) list = list.filter(p => p.category === posActiveCategory);
  if (posSearch) list = list.filter(p =>
    (p.name || '').toLowerCase().includes(posSearch) ||
    (p.dci || '').toLowerCase().includes(posSearch) ||
    (p.code || '').toLowerCase().includes(posSearch)
  );

  list = [...list].sort((a, b) => {
    const qa = posStock[a.id] || 0, qb = posStock[b.id] || 0;
    if ((qa > 0) !== (qb > 0)) return qa > 0 ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr');
  });

  if (!list.length) {
    grid.innerHTML = `<div class="grid-empty"><i data-lucide="search"></i> Aucun médicament trouvé${posSearch ? ` pour "<b>${posSearch}</b>"` : ''}</div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  grid.innerHTML = list.slice(0, 60).map(p => {
    const q = posStock[p.id] || 0;
    const inCart = posCart.find(c => c.productId === p.id);
    const rupt = q === 0;
    const low = q > 0 && q <= (p.minStock || 10);
    const alts = rupt ? findGenericAlternatives(p) : [];
    return `<div class="prod-card ${rupt ? 'prod-rupt' : ''} ${inCart ? 'prod-incart' : ''} ${low ? 'prod-low' : ''}"
       onclick="${rupt ? (alts.length ? `showGenericAlternatives(${p.id})` : "UI.toast('Rupture de stock — aucune alternative DCI en stock','error')") : `addToCart(${p.id})`}">
      <div class="prod-top">
        ${p.requiresPrescription ? '<span class="tag-rx">Rx</span>' : ''}
        ${p.isControlled ? '<span class="tag-rx" style="background:#e74c3c">SC</span>' : ''}
        ${inCart ? `<span class="tag-cart">${inCart.qty}</span>` : ''}
      </div>
      <div class="prod-cat">${p.category || ''}</div>
      <div class="prod-name">${p.name}</div>
      <div class="prod-dci">${p.dci || p.brand || ''}</div>
      <div class="prod-foot">
        <span class="prod-price">${UI.formatCurrency(p.salePrice)}</span>
        <span class="prod-stock ${rupt ? 's-rupt' : low ? 's-low' : 's-ok'}">${rupt ? (alts.length ? '<i data-lucide="repeat"></i> Alternatives' : '<i data-lucide="x-circle"></i> Rupture') : q + ' u.'}</span>
      </div>
    </div>`;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════
// PANIER
// ═══════════════════════════════════════════════════════════════════
function addToCart(productId) {
  const p = posProducts.find(x => x.id === productId);
  if (!p) return;
  const avail = posStock[productId] || 0;
  const existing = posCart.find(c => c.productId === productId);
  if ((existing?.qty || 0) >= avail) {
    UI.toast(`Stock insuffisant — ${avail} unité(s) disponible(s)`, 'warning'); return;
  }
  // Alerte allergie patient
  if (posCurrentPatient?.allergies) {
    const txt = (p.name + ' ' + (p.dci || '')).toLowerCase();
    const hits = posCurrentPatient.allergies.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(a => a && txt.includes(a));
    if (hits.length) UI.toast(`⚠️ ALLERGIE — ${posCurrentPatient.name} : ${hits.join(', ')}`, 'error', 8000);
  }
  // Vérification interactions médicamenteuses
  try {
    const interactions = checkDrugInteractions(p);
    for (const inter of interactions) {
      const icon = inter.level === 'grave' ? '🚨' : '⚠️';
      UI.toast(`${icon} INTERACTION ${inter.level.toUpperCase()} — ${p.name} + ${inter.with}\n${inter.desc}`, 'error', 10000);
    }
  } catch(e) { console.warn('[Interactions] Erreur vérification:', e); }

  // FEFO : identifier le lot
  const fefoLot = getFEFOLot(productId);

  if (existing) { existing.qty++; existing.total = existing.qty * existing.unitPrice; }
  else posCart.push({
    productId, name: p.name, dci: p.dci || '', dosage: p.dosage || '',
    unitPrice: p.salePrice, purchasePrice: p.purchasePrice || 0,
    qty: 1, total: p.salePrice, requiresPrescription: !!p.requiresPrescription,
    isControlled: !!p.isControlled, controlledClass: p.controlledClass || null,
    fefoLotNumber: fefoLot?.lotNumber || null, fefoLotId: fefoLot?.id || null,
  });
  refreshCartUI(); refreshGrid();
}

function changeQty(productId, delta) {
  const item = posCart.find(c => c.productId === productId);
  if (!item) return;
  const nq = item.qty + delta;
  if (nq <= 0) posCart = posCart.filter(c => c.productId !== productId);
  else {
    if (nq > (posStock[productId] || 0)) { UI.toast('Stock insuffisant', 'warning'); return; }
    item.qty = nq; item.total = nq * item.unitPrice;
  }
  refreshCartUI(); refreshGrid();
}

function setQtyDirect(productId, val) {
  const nq = parseInt(val);
  if (isNaN(nq) || nq < 1) return;
  const item = posCart.find(c => c.productId === productId);
  if (!item) return;
  if (nq > (posStock[productId] || 0)) { UI.toast('Stock insuffisant', 'warning'); return; }
  item.qty = nq; item.total = nq * item.unitPrice;
  refreshCartUI(); refreshGrid();
}

function removeItem(productId) {
  posCart = posCart.filter(c => c.productId !== productId);
  refreshCartUI(); refreshGrid();
}

function viderPanier() {
  posCart = [];
  clearClientUI();
  detachRx();
  const rt = document.getElementById('rx-toggle');
  if (rt) { rt.checked = false; onRxToggle(false); }
  const disc = document.getElementById('pos-discount');
  if (disc) disc.value = 0;
  const ci = document.getElementById('cash-in');
  if (ci) ci.value = '';
  refreshCartUI(); refreshGrid();
}

function refreshCartUI() {
  const body = document.getElementById('pos-cart-items');
  if (!body) return;

  // Update count badge
  const total = posCart.reduce((a, c) => a + c.qty, 0);
  const countBadge = document.getElementById('cart-count');
  if (countBadge) countBadge.textContent = total > 0 ? `${total} article${total > 1 ? 's' : ''}` : '0 article';

  if (!posCart.length) {
    body.innerHTML = `<div class="cart-placeholder"><div class="cart-placeholder-icon"><i data-lucide="shopping-cart"></i></div><div class="cart-placeholder-text">Panier vide</div><div class="cart-placeholder-sub">Cliquez sur un médicament à gauche</div></div>`;
    refreshTotals();
    if (window.lucide) lucide.createIcons();
    return;
  }

  body.innerHTML = posCart.map(item => `
    <div class="cart-line">
      <div class="cart-line-info">
        <div class="cart-line-name">${item.name}${item.requiresPrescription ? ' <span class="tag-rx-xs">Rx</span>' : ''}</div>
        ${item.dci ? `<div class="cart-line-dci">${item.dci}${item.dosage ? ' · ' + item.dosage : ''}</div>` : ''}
        <div class="cart-line-pu">${UI.formatCurrency(item.unitPrice)} / unité</div>
      </div>
      <div class="cart-line-qty">
        <button class="qty-ctrl" onclick="changeQty(${item.productId},-1)">−</button>
        <input type="number" class="qty-direct" value="${item.qty}" min="1"
          onchange="setQtyDirect(${item.productId}, this.value)"
          onfocus="this.select()">
        <button class="qty-ctrl" onclick="changeQty(${item.productId},+1)">+</button>
      </div>
      <div class="cart-line-right">
        <div class="cart-line-total">${UI.formatCurrency(item.total)}</div>
        <button class="cart-line-del" onclick="removeItem(${item.productId})" title="Retirer"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join('');

  refreshTotals();
  if (window.lucide) lucide.createIcons();
}

function refreshTotals() {
  const sub = posCart.reduce((a, c) => a + c.total, 0);
  const disc = Math.max(0, parseFloat(document.getElementById('pos-discount')?.value || 0));
  const tot = Math.max(0, sub - disc);
  const el1 = document.getElementById('pos-subtotal');
  const el2 = document.getElementById('pos-total');
  if (el1) el1.textContent = UI.formatCurrency(sub);
  if (el2) el2.textContent = UI.formatCurrency(tot);

  // Protection marge : vérifier que la remise ne fait pas passer sous le prix d'achat
  const totalPurchase = posCart.reduce((a, c) => a + (c.purchasePrice || 0) * c.qty, 0);
  const marginWarn = document.getElementById('margin-warning');
  if (disc > 0 && tot < totalPurchase) {
    const role = DB.AppState.currentUser?.role;
    if (role === 'caissier') {
      // Blocage dur pour les caissiers
      const el = document.getElementById('pos-discount');
      const maxDisc = Math.max(0, sub - totalPurchase);
      if (el) el.value = maxDisc;
      const correctedTot = Math.max(0, sub - maxDisc);
      if (el2) el2.textContent = UI.formatCurrency(correctedTot);
      UI.toast('⛔ Remise bloquée — interdit de vendre en dessous du prix d\'achat', 'error', 4000);
    }
    if (!marginWarn) {
      const warn = document.createElement('div');
      warn.id = 'margin-warning';
      warn.className = 'margin-warning-banner';
      warn.innerHTML = '<i data-lucide="alert-triangle"></i> <span>Attention : la remise fait passer en dessous du coût d\'achat !</span>';
      warn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);border-radius:8px;color:#e74c3c;font-size:12px;font-weight:600;margin-top:8px';
      document.querySelector('.pos-totals-block')?.appendChild(warn);
      if (window.lucide) lucide.createIcons();
    }
  } else {
    if (marginWarn) marginWarn.remove();
  }

  buildCashShortcuts(tot);
  refreshChange();
  if (getPayMethod() === 'combined') refreshCombined();
  if (getPayMethod() === 'assurance') calcAssurance();
}

function quickDiscount(pct) {
  const sub = posCart.reduce((a, c) => a + c.total, 0);
  const totalPurchase = posCart.reduce((a, c) => a + (c.purchasePrice || 0) * c.qty, 0);
  const discAmount = Math.round(sub * pct / 100);
  const role = DB.AppState.currentUser?.role;
  // Caissier : plafonner la remise à (sub - totalPurchase)
  const finalDisc = (role === 'caissier' && (sub - discAmount) < totalPurchase)
    ? Math.max(0, sub - totalPurchase)
    : discAmount;
  const el = document.getElementById('pos-discount');
  if (el) { el.value = finalDisc; refreshTotals(); }
}

// ═══════════════════════════════════════════════════════════════════
// PAIEMENT
// ═══════════════════════════════════════════════════════════════════
function getTotal() { const s = posCart.reduce((a, c) => a + c.total, 0); return Math.max(0, s - getDiscount()); }
function getDiscount() { return Math.max(0, parseFloat(document.getElementById('pos-discount')?.value || 0)); }
function getPayMethod() { return document.querySelector('.pay-btn.active')?.dataset.m || 'cash'; }

function selectPay(btn) {
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const m = btn.dataset.m;
  document.getElementById('pay-cash').style.display = m === 'cash' ? 'block' : 'none';
  document.getElementById('pay-mobile').style.display = ['orange_money', 'mtn_momo'].includes(m) ? 'block' : 'none';
  document.getElementById('pay-combined').style.display = m === 'combined' ? 'block' : 'none';
  document.getElementById('pay-assurance').style.display = m === 'assurance' ? 'block' : 'none';
  document.getElementById('pay-credit').style.display = m === 'credit' ? 'block' : 'none';
  posMobilePayState = 'idle';
  resetMobilePayUI();
  if (['orange_money', 'mtn_momo'].includes(m) && posCurrentPatient?.phone) {
    document.getElementById('mm-phone').value = posCurrentPatient.phone;
  }
  if (m === 'combined') {
    refreshCombined();
    onCombinedChange();
  }
  if (m === 'assurance') {
    calcAssurance();
    if (posCurrentPatient?.phone) {
        const ph = document.getElementById('assur-patient-phone');
        if (ph && !ph.value) ph.value = posCurrentPatient.phone;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// PAIEMENT COMBINÉ — Split Payment (2 modes max)
// ═══════════════════════════════════════════════════════════════════
function refreshCombined() {
  const total = getTotal();
  const a1 = parseFloat(document.getElementById('combined-amount-1')?.value || 0);
  const a2 = parseFloat(document.getElementById('combined-amount-2')?.value || 0);
  const sum = a1 + a2;
  const el = document.getElementById('combined-status');
  if (!el) return;
  if (sum === 0) {
    el.style.background = 'var(--bg)';
    el.style.color = 'var(--text-muted)';
    el.innerHTML = 'Saisissez les montants';
  } else if (sum < total) {
    const rest = total - sum;
    el.style.background = 'rgba(231,76,60,0.1)';
    el.style.color = '#e74c3c';
    el.innerHTML = `<i data-lucide="alert-circle" style="width:16px;height:16px;vertical-align:text-bottom;margin-right:4px"></i> Insuffisant — Manque ${UI.formatCurrency(rest)}`;
  } else if (sum > total) {
    const change = sum - total;
    el.style.background = 'rgba(46,175,125,0.1)';
    el.style.color = '#2eaf7d';
    el.innerHTML = `<i data-lucide="check-circle" style="width:16px;height:16px;vertical-align:text-bottom;margin-right:4px"></i> OK — Monnaie à rendre : ${UI.formatCurrency(change)}`;
  } else {
    el.style.background = 'rgba(46,175,125,0.1)';
    el.style.color = '#2eaf7d';
    el.innerHTML = `<i data-lucide="check-circle" style="width:16px;height:16px;vertical-align:text-bottom;margin-right:4px"></i> Montant exact — Parfait !`;
  }
  if (window.lucide) lucide.createIcons();
}

function onCombinedChange() {
  const m1 = document.getElementById('combined-method-1')?.value || 'cash';
  const m2 = document.getElementById('combined-method-2')?.value || 'orange_money';
  const hasMM = [m1, m2].some(m => ['orange_money', 'mtn_momo'].includes(m));
  const phoneRow = document.getElementById('combined-phone-row');
  if (phoneRow) phoneRow.style.display = hasMM ? 'block' : 'none';
  if (hasMM && posCurrentPatient?.phone) {
    const ph = document.getElementById('combined-mm-phone');
    if (ph && !ph.value) ph.value = posCurrentPatient.phone;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PRISE EN CHARGE (Assurance / Tiers payant)
// ═══════════════════════════════════════════════════════════════════
function calcAssurance() {
  const total = getTotal();
  const assurAmt = parseFloat(document.getElementById('assur-amount')?.value || 0);
  const patientPart = Math.max(0, total - assurAmt);
  
  const elPatientPart = document.getElementById('assur-patient-part');
  if (elPatientPart) {
    elPatientPart.textContent = UI.formatCurrency(patientPart);
  }

  // Toggle fields based on patient's payment method
  const pMethod = document.getElementById('assur-patient-method')?.value || 'cash';
  const pRecvWrap = document.getElementById('assur-patient-recv-wrap');
  const pPhoneWrap = document.getElementById('assur-patient-phone-wrap');
  
  if (pMethod === 'cash') {
    if (pRecvWrap) pRecvWrap.style.display = 'block';
    if (pPhoneWrap) pPhoneWrap.style.display = 'none';
  } else {
    // Mobile money
    if (pRecvWrap) pRecvWrap.style.display = 'none';
    if (pPhoneWrap) pPhoneWrap.style.display = 'block';
  }

  // Status for cash change
  const statEl = document.getElementById('assur-status');
  if (statEl) {
    if (patientPart === 0) {
      statEl.innerHTML = '<span style="color:#2eaf7d"><i data-lucide="check-circle" style="width:14px;height:14px;vertical-align:text-bottom"></i> Part patient soldée.</span>';
    } else if (pMethod === 'cash') {
      const recv = parseFloat(document.getElementById('assur-patient-recv')?.value || 0);
      if (recv < patientPart) {
        statEl.innerHTML = `<span style="color:#e74c3c"><i data-lucide="alert-circle" style="width:14px;height:14px;vertical-align:text-bottom"></i> Manque ${UI.formatCurrency(patientPart - recv)}</span>`;
      } else {
        statEl.innerHTML = `<span style="color:#2eaf7d"><i data-lucide="check-circle" style="width:14px;height:14px;vertical-align:text-bottom"></i> Monnaie à rendre : ${UI.formatCurrency(recv - patientPart)}</span>`;
      }
    } else {
      statEl.innerHTML = `<span style="color:#2E86C1"><i data-lucide="info" style="width:14px;height:14px;vertical-align:text-bottom"></i> ${UI.formatCurrency(patientPart)} seront prélevés par Mobile Money.</span>`;
    }
    if (window.lucide) lucide.createIcons();
  }
}

function buildCashShortcuts(total) {
  const el = document.getElementById('cash-shortcuts');
  if (!el) return;
  if (!total) { el.innerHTML = ''; return; }
  const bills = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  const shown = bills.filter(b => b >= total).slice(0, 4);
  if (!shown.length || shown[0] !== total) shown.unshift(total);
  el.innerHTML = shown.slice(0, 5).map(b =>
    `<button class="cash-pill" onclick="setCashIn(${b})">${UI.formatCurrency(b)}</button>`
  ).join('');
}

function setCashIn(v) {
  const el = document.getElementById('cash-in');
  if (el) { el.value = v; refreshChange(); }
}

function refreshChange() {
  const total = getTotal();
  const recv = parseFloat(document.getElementById('cash-in')?.value || 0);
  const el = document.getElementById('cash-change');
  if (!el) return;
  if (!recv) { el.textContent = '—'; el.className = 'change-amount'; return; }
  const diff = recv - total;
  el.textContent = diff >= 0
    ? `${UI.formatCurrency(diff)} GNF`
    : `Insuffisant — Manque ${UI.formatCurrency(Math.abs(diff))}`;
  el.className = 'change-amount ' + (diff >= 0 ? 'change-ok' : 'change-ko');
}

function refreshMmPhone() {
  // Reset payment state when phone changes
  posMobilePayState = 'idle';
  resetMobilePayUI();
}

// ═══════════════════════════════════════════════════════════════════
// MOBILE MONEY — Vrai Gateway avec simulation API
// ═══════════════════════════════════════════════════════════════════


function resetMobilePayUI() {
  const el = document.getElementById('mm-state');
  if (!el) return;
  el.className = 'mm-state mm-idle';
  el.innerHTML = `<button class="btn btn-sm btn-primary mm-send-btn" onclick="initMobilePay()"><i data-lucide="send"></i> Envoyer la demande de paiement</button>`;
  if (window.lucide) lucide.createIcons();
}

async function initMobilePay() {
  const phone = document.getElementById('mm-phone')?.value?.trim();
  if (!phone) { UI.toast('Entrez le numéro de téléphone du client', 'warning'); return; }
  const total = getTotal();
  if (total <= 0) { UI.toast('Panier vide ou montant nul', 'error'); return; }
  const method = getPayMethod();
  const desc = `Pharmacie — ${posCart.length} article(s) — ${UI.formatCurrency(total)}`;
  posMobilePayState = 'en_attente';
  await MobileMoneyGateway.initiatePayment({
    method, phone, amount: total, description: desc,
    onSuccess: () => { posMobilePayState = 'confirme'; },
    onFailure: (msg) => { posMobilePayState = 'echoue'; },
  });
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT / PATIENT
// ═══════════════════════════════════════════════════════════════════
/** Positionne le dropdown client-suggest en position: fixed par rapport à l'input */
function positionClientDropdown() {
  const input = document.getElementById('client-input');
  const dd = document.getElementById('client-suggest');
  if (!input || !dd) return;
  const rect = input.getBoundingClientRect();
  const ddWidth = Math.max(320, rect.width); // Plus large pour le mobile et la lisibilité

  let left = rect.left;
  const screenWidth = window.innerWidth;

  // Si on est trop à droite, on aligne la droite du dropdown avec la droite de l'input
  if (left + ddWidth > screenWidth - 20) {
    left = rect.right - ddWidth;
  }

  // Sécurité bord gauche
  if (left < 10) left = 10;

  dd.style.top = (rect.bottom + 5) + 'px';
  dd.style.left = left + 'px';
  dd.style.width = ddWidth + 'px';
}

function onClientFocus() { showPatientRepertory(); }

// Fermer le dropdown quand on clique ailleurs (obsolète mais gardé pour compatibilité structurelle si besoin)
document.addEventListener('click', function (e) {
  if (!e.target.closest || !e.target.closest('.client-field-wrap')) {
    const dd = document.getElementById('client-suggest');
    if (dd) dd.style.display = 'none';
  }
});

async function selectPatient(id) {
  const pt = (window._posPatients || []).find(p => p.id === id);
  if (!pt) return;
  posCurrentPatient = pt;
  renderClientBadge(pt);
  if (pt.phone) {
    const ph = document.getElementById('mm-phone');
    if (ph) ph.value = pt.phone;
  }
  if (pt.allergies) UI.toast(`Allergie connue — ${pt.name} : ${pt.allergies}`, 'error', 7000);
}

function renderClientBadge(pt) {
  const el = document.getElementById('client-badge');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = `
    <div class="client-badge-card premium-badge">
      <div class="cb-avatar">${(pt.name || '?').charAt(0).toUpperCase()}</div>
      <div class="cb-info">
        <div class="cb-header">
          <div class="cb-name">${pt.name}</div>
          <button class="cb-clear-btn" onclick="clearClientUI()" title="Retirer le patient"><i data-lucide="x"></i></button>
        </div>
        <div class="cb-details">
          <span class="cb-detail-item"><i data-lucide="phone"></i> ${pt.phone || '—'}</span>
          <span class="cb-detail-item"><i data-lucide="calendar"></i> ${pt.dob ? calcAge(pt.dob) + ' ans' : '—'}</span>
          <span class="cb-detail-item"><i data-lucide="map-pin"></i> ${pt.address || '—'}</span>
        </div>
        ${pt.allergies ? `<div class="cb-allergy"><i data-lucide="alert-triangle"></i> Allergies : ${pt.allergies}</div>` : ''}
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons({ props: { size: 14 } });
}

function clearClientUI() {
  posCurrentPatient = null;
  const inp = document.getElementById('client-input');
  if (inp) inp.value = '';
  const badge = document.getElementById('client-badge');
  if (badge) badge.style.display = 'none';
}

function calcAge(dob) {
  if (!dob) return '?';
  const today = new Date(), birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
}

async function showPatientRepertory() {
  const patients = await DB.dbGetAll('patients');
  const sorted = patients.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));

  const content = `
    <div style="margin-bottom:15px">
      <div class="pos-searchfield">
        <span class="pos-searchicon"><i data-lucide="search"></i></span>
        <input type="text" class="pos-searchinput" placeholder="Chercher un nom, téléphone ou adresse..." oninput="filterRepertory(this.value)" autofocus>
      </div>
    </div>
    <div id="repertory-list" style="max-height:450px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface)">
      ${renderRepertoryItems(sorted)}
    </div>
  `;

  UI.modal('Répertoire des Patients', content, { size: 'large' });
  if (window.lucide) lucide.createIcons();
}

function renderRepertoryItems(list) {
  if (!list.length) return '<div style="padding:40px; text-align:center; color:var(--text-muted)"><i data-lucide="search-x" style="width:40px;height:40px;opacity:0.2;margin-bottom:10px"></i><br>Aucun patient trouvé</div>';
  return list.map(p => `
    <div class="user-item" style="cursor:pointer; padding:12px 18px; border-bottom:1px solid var(--bg); transition:background 0.2s" 
         onclick="selectPatient(${p.id}); UI.closeModal()" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='transparent'">
      <div class="user-avatar" style="background:var(--primary-light)">${(p.name || '?').charAt(0).toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name" style="font-weight:600">${p.name}</div>
        <div class="user-meta">${p.phone || '—'} · <span style="opacity:0.7">${p.address || 'Sans adresse'}</span></div>
      </div>
      <i data-lucide="chevron-right" style="opacity:0.3"></i>
    </div>
  `).join('');
}

window.filterRepertory = (val) => {
  const q = val.toLowerCase();
  DB.dbGetAll('patients').then(all => {
    const filtered = all.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(q) ||
      (p.address || '').toLowerCase().includes(q)
    );
    const container = document.getElementById('repertory-list');
    if (container) {
      container.innerHTML = renderRepertoryItems(filtered);
      if (window.lucide) lucide.createIcons();
    }
  });
};

function showQuickNewClient(prefill) {
  const dd = document.getElementById('client-suggest');
  if (dd) dd.style.display = 'none';
  UI.modal('👤 Nouveau Patient', `
    <form id="qp-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" name="name" class="form-control" value="${prefill || ''}" required autofocus>
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
          <select name="gender" class="form-control"><option value="">—</option><option>Masculin</option><option>Féminin</option></select>
        </div>
      </div>
      <div class="form-group">
        <label>Allergies connues</label>
        <input type="text" name="allergies" class="form-control" placeholder="Ex : Pénicilline, Aspirine">
      </div>
      <div class="form-group">
        <label>Adresse</label>
        <input type="text" name="address" class="form-control" placeholder="Quartier, Commune">
      </div>
    </form>`,
    { footer: `<button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveQuickClient()">✓ Enregistrer</button>` });
}

async function saveQuickClient() {
  const form = document.getElementById('qp-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  const id = await DB.dbAdd('patients', { ...data, createdAt: new Date().toISOString() });
  const newPt = { ...data, id };
  window._posPatients = [...(window._posPatients || []), newPt];
  UI.closeModal();
  await selectPatient(id);
  UI.toast(`✅ Patient ${data.name} enregistré`, 'success');
}

// ═══════════════════════════════════════════════════════════════════
// ORDONNANCE
// ═══════════════════════════════════════════════════════════════════
function onRxToggle(checked) {
  const detail = document.getElementById('rx-detail');
  const section = document.getElementById('pos-rx-section');
  if (detail) detail.style.display = checked ? 'block' : 'none';
  if (section) section.classList.toggle('pos-section-rx-active', checked);
  if (!checked) detachRx();
}

function detachRx() {
  posCurrentRx = null;
  const el = document.getElementById('rx-badge');
  if (el) el.style.display = 'none';
}

async function openRxPicker() {
  const rxList = window._posPrescriptions || [];
  const filtered = posCurrentPatient
    ? rxList.filter(rx => rx.patientId === posCurrentPatient.id || !rx.patientId)
    : rxList;

  if (!filtered.length) {
    showQuickNewRx();
    return;
  }

  UI.modal('📄 Sélectionner une Ordonnance', `
    <div class="rx-picker-list">
      ${filtered.map(rx => `
        <div class="rx-pick-card" onclick="attachRx(${rx.id})">
          <div class="rx-pick-ref-block">
            <div class="rx-pick-ref">Rx-${String(rx.id).padStart(5, '0')}</div>
            <div class="rx-pick-date">${UI.formatDate(rx.date)}</div>
            <span class="badge badge-${rx.status === 'validated' ? 'success' : 'warning'} badge-sm">${rx.status === 'validated' ? '<i data-lucide="check-circle"></i> Validée' : '<i data-lucide="clock"></i> En attente'}</span>
          </div>
          <div class="rx-pick-body">
            <div class="rx-pick-patient"><i data-lucide="user"></i> ${rx.patientName || 'Patient anonyme'}</div>
            <div class="rx-pick-doctor"><i data-lucide="stethoscope"></i> Dr ${rx.doctorName || '—'} ${rx.specialty ? '· ' + rx.specialty : ''}</div>
            <div class="rx-pick-drugs">${(rx.items || []).map(i => `<span class="tag-drug">${i.productName}</span>`).join('')}</div>
          </div>
        </div>`).join('')}
    </div>`, { size: 'large' });
}

async function attachRx(rxId) {
  const rx = (window._posPrescriptions || []).find(r => r.id === rxId);
  if (!rx) return;
  posCurrentRx = rx;

  if (!posCurrentPatient && rx.patientId) await selectPatient(rx.patientId);

  // Charger les médicaments prescrits dans le panier
  let added = 0, skipped = [];
  for (const item of (rx.items || [])) {
    const prod = posProducts.find(p => p.id === item.productId);
    if (prod && (posStock[prod.id] || 0) > 0) {
      const want = item.quantity || 1;
      const have = posStock[prod.id] || 0;
      const take = Math.min(want, have);
      const ex = posCart.find(c => c.productId === prod.id);
      if (ex) { ex.qty += take; ex.total = ex.qty * ex.unitPrice; }
      else posCart.push({ productId: prod.id, name: prod.name, dci: prod.dci || '', dosage: prod.dosage || '', unitPrice: prod.salePrice, purchasePrice: prod.purchasePrice || 0, qty: take, total: take * prod.salePrice, requiresPrescription: !!prod.requiresPrescription });
      added += take;
    } else {
      skipped.push(item.productName || 'Produit inconnu');
    }
  }

  UI.closeModal();
  refreshCartUI(); refreshGrid();

  const el = document.getElementById('rx-badge');
  if (el) {
    el.style.display = 'block';
    el.innerHTML = `
      <div class="rx-linked-pill">
        <div class="rx-linked-info">
          <span class="rx-linked-ref"><i data-lucide="file-text"></i> Rx-${String(rxId).padStart(5, '0')}</span>
          <span>Dr ${rx.doctorName || '—'} · ${UI.formatDate(rx.date)}</span>
          ${skipped.length ? `<span class="rx-skipped"><i data-lucide="alert-triangle"></i> Rupture : ${skipped.join(', ')}</span>` : ''}
        </div>
        <button class="btn btn-xs btn-ghost" onclick="detachRx()"><i data-lucide="x"></i></button>
      </div>`;
    if (window.lucide) lucide.createIcons({ props: { size: 14 } });
  }
  UI.toast(`Ordonnance liée — ${added} unité(s) ajoutée(s) au panier`, 'success', 4000);
  if (skipped.length) UI.toast(`Rupture de stock : ${skipped.join(', ')}`, 'warning', 5000);
}

function mettreEnAttente() {
  if (!posCart.length) { UI.toast('Panier vide', 'warning'); return; }
  window._heldCart = { items: [...posCart], patient: posCurrentPatient, rx: posCurrentRx };
  viderPanier();
  UI.toast('Panier mis en attente — Il sera restauré à votre retour', 'info', 5000);
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION VENTE
// ═══════════════════════════════════════════════════════════════════
async function validerVente() {
  if (!posCart.length) { UI.toast('Le panier est vide', 'warning'); return; }

  // ── Vérification clôture de caisse ──
  const today = new Date().toISOString().split('T')[0];
  const cashRegister = await DB.dbGetAll('cashRegister');
  const todayClosure = cashRegister.find(c => c.date === today && c.type === 'closure');
  if (todayClosure) {
    UI.toast(
      `🔒 Caisse clôturée — Aucune vente possible.\nClôture effectuée à ${UI.formatDateTime(todayClosure.closedAt)} par ${todayClosure.closedBy}.`,
      'error', 7000
    );
    return;
  }

  const method = getPayMethod();
  const total = getTotal();
  const disc = getDiscount();
  const sub = posCart.reduce((a, c) => a + c.total, 0);

  // ── Gate substances contrôlées ──
  const hasControlled = posCart.some(i => i.isControlled);
  if (hasControlled) {
    if (!posCurrentPatient) {
      UI.toast('⛔ Substance contrôlée — Un patient identifié est OBLIGATOIRE', 'error', 6000);
      return;
    }
    const rxCheckedForCtrl = document.getElementById('rx-toggle')?.checked;
    if (!rxCheckedForCtrl || !posCurrentRx) {
      const okCtrl = await UI.confirm('⚠️ SUBSTANCE CONTRÔLÉE\n\nLe panier contient des substances réglementées.\nUne ordonnance doit être liée pour la traçabilité.\n\nContinuer sans ordonnance ?\n(Votre responsabilité est ENGAGÉE)');
      if (!okCtrl) return;
    }
  }

  // ── Protection marge finale ──
  const totalPurchase = posCart.reduce((a, c) => a + (c.purchasePrice || 0) * c.qty, 0);
  if (total < totalPurchase && DB.AppState.currentUser?.role === 'caissier') {
    UI.toast('⛔ Vente refusée — le total est inférieur au coût d\'achat. Contactez le pharmacien.', 'error', 6000);
    return;
  }
  if (total < totalPurchase) {
    const okMargin = await UI.confirm(`⚠️ ATTENTION MARGE\n\nLe total (${UI.formatCurrency(total)}) est inférieur au coût d'achat (${UI.formatCurrency(totalPurchase)}).\n\nVous perdrez ${UI.formatCurrency(totalPurchase - total)} sur cette vente.\n\nConfirmer quand même ?`);
    if (!okMargin) return;
  }

  // Contrôles ordonnance
  const hasRxItems = posCart.some(i => i.requiresPrescription);
  const rxChecked = document.getElementById('rx-toggle')?.checked;
  if (hasRxItems && !rxChecked) {
    const ok = await UI.confirm('Médicament(s) sur ordonnance dans le panier.\n\nConfirmer la vente sans ordonnance liée ?\n(La responsabilité du pharmacien est engagée)');
    if (!ok) return;
  }

  // Contrôles paiement
  if (method === 'cash') {
    const recv = parseFloat(document.getElementById('cash-in')?.value || 0);
    if (recv < total) { UI.toast('Montant reçu insuffisant par rapport au total', 'error'); return; }
  }

  if (['orange_money', 'mtn_momo'].includes(method) && posMobilePayState !== 'confirme') {
    const ok = await UI.confirm('Le paiement Mobile Money n\'est pas encore confirmé.\nValider la vente quand même ?');
    if (!ok) return;
  }

  if (method === 'combined') {
    const a1 = parseFloat(document.getElementById('combined-amount-1')?.value || 0);
    const a2 = parseFloat(document.getElementById('combined-amount-2')?.value || 0);
    if ((a1 + a2) < total) {
      UI.toast('Le total des paiements combinés est insuffisant', 'error');
      return;
    }
  }

  if (method === 'assurance') {
    if (!posCurrentPatient) {
      UI.toast('Un patient doit être sélectionné pour une prise en charge', 'error'); return;
    }
    const assurName = document.getElementById('assur-name')?.value.trim();
    if (!assurName) {
      UI.toast('Le nom de l\'organisme (Assurance/Entreprise) est requis', 'error'); return;
    }
    const assurAmt = parseFloat(document.getElementById('assur-amount')?.value || 0);
    if (assurAmt <= 0) {
      UI.toast('Le montant pris en charge doit être supérieur à zéro', 'error'); return;
    }
    // Check patient part rules
    const patientPart = Math.max(0, total - assurAmt);
    const pMethod = document.getElementById('assur-patient-method')?.value || 'cash';
    if (patientPart > 0 && pMethod === 'cash') {
      const pRecv = parseFloat(document.getElementById('assur-patient-recv')?.value || 0);
      if (pRecv < patientPart) {
        UI.toast('La part patient reçue en espèces est insuffisante', 'error'); return;
      }
    }
  }

  if (method === 'credit' && !posCurrentPatient) {
    UI.toast('Un patient doit être sélectionné pour une vente à crédit', 'error'); return;
  }

  const btn = document.getElementById('btn-valider');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Traitement…'; if (window.lucide) lucide.createIcons(); }

  try {
    // Build combined payment details if applicable
    let combinedDetails = null;
    let combinedMmPhone = null;
    if (method === 'combined') {
      const m1 = document.getElementById('combined-method-1')?.value || 'cash';
      const m2 = document.getElementById('combined-method-2')?.value || 'orange_money';
      const a1 = parseFloat(document.getElementById('combined-amount-1')?.value || 0);
      const a2 = parseFloat(document.getElementById('combined-amount-2')?.value || 0);
      combinedDetails = [{ method: m1, amount: a1 }, { method: m2, amount: a2 }];
      combinedMmPhone = document.getElementById('combined-mm-phone')?.value || null;
    }

    // Build assurance data
    let assurData = {};
    if (method === 'assurance') {
      const assurName = document.getElementById('assur-name')?.value.trim();
      const assurRef = document.getElementById('assur-ref')?.value.trim();
      const assurAmt = parseFloat(document.getElementById('assur-amount')?.value || 0);
      const patientPart = Math.max(0, total - assurAmt);
      const pMethod = document.getElementById('assur-patient-method')?.value || 'cash';
      
      assurData = {
         assuranceName: assurName,
         assuranceRef: assurRef,
         assuranceAmount: assurAmt,
      };
      
      combinedDetails = [
         { method: 'assurance', amount: assurAmt, entity: assurName }
      ];
      if (patientPart > 0) {
         combinedDetails.push({ method: pMethod, amount: patientPart, label: 'Ticket modérateur' });
      }
      
      if (pMethod !== 'cash') {
         combinedMmPhone = document.getElementById('assur-patient-phone')?.value;
      }
    }

    // Calcul du cash reçu formel
    let cashRcv = 0;
    if (method === 'cash') cashRcv = parseFloat(document.getElementById('cash-in')?.value || 0);
    else if (method === 'combined') cashRcv = combinedDetails?.find(d => d.method === 'cash')?.amount || 0;
    else if (method === 'assurance') {
       const pMethod = document.getElementById('assur-patient-method')?.value || 'cash';
       if (pMethod === 'cash') {
           // L'argent reçu physiquement par le patient
           cashRcv = parseFloat(document.getElementById('assur-patient-recv')?.value || 0);
       }
    }

    // Status: assurance & credit become "pending" debt
    const finalStatus = (method === 'credit' || method === 'assurance') ? 'pending' : 'completed';

    const saleData = {
      ...assurData,
      date: new Date().toISOString(),
      patientId: posCurrentPatient?.id || null,
      patientName: posCurrentPatient?.name || null,
      patientPhone: posCurrentPatient?.phone || null,
      userId: DB.AppState.currentUser?.id,
      sellerName: DB.AppState.currentUser?.name || 'Vendeur inconnu',
      total, subtotal: sub, discount: disc,
      paymentMethod: method,
      paymentDetails: combinedDetails,
      mmPhone: method === 'combined' || method === 'assurance' ? combinedMmPhone : (['orange_money', 'mtn_momo'].includes(method) ? document.getElementById('mm-phone')?.value : null),
      status: finalStatus,
      prescriptionId: posCurrentRx?.id || null,
      prescriptionRef: posCurrentRx ? `Rx-${String(posCurrentRx.id).padStart(5, '0')}` : null,
      doctorName: posCurrentRx?.doctorName || null,
      itemCount: posCart.length,
      creditDueDate: method === 'credit' ? document.getElementById('credit-date')?.value : null,
      cashReceived: cashRcv > 0 ? cashRcv : null,
    };

    const saleId = await DB.dbAdd('sales', saleData);

    for (const item of posCart) {
      // FEFO: décrémentation du lot le plus proche de l'expiration
      let assignedLotNumber = item.fefoLotNumber || null;
      let remainingQty = item.qty;
      try {
        const productLots = posLots
          .filter(l => l.productId === item.productId && l.status === 'active' && l.quantity > 0)
          .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        for (const lot of productLots) {
          if (remainingQty <= 0) break;
          const take = Math.min(remainingQty, lot.quantity);
          lot.quantity -= take;
          remainingQty -= take;
          assignedLotNumber = assignedLotNumber || lot.lotNumber;
          await DB.dbPut('lots', lot);
        }
      } catch(e) { console.warn('[FEFO] Erreur décrément lot:', e); }

      await DB.dbAdd('saleItems', {
        saleId, productId: item.productId, productName: item.name,
        quantity: item.qty, unitPrice: item.unitPrice,
        purchasePrice: item.purchasePrice, total: item.total,
        lotNumber: assignedLotNumber,
      });
      const stockAll = await DB.dbGetAll('stock');
      const se = stockAll.find(s => s.productId === item.productId);
      if (se) {
        const nq = Math.max(0, se.quantity - item.qty);
        await DB.dbPut('stock', { ...se, quantity: nq });
        posStock[item.productId] = nq;
      }
      await DB.dbAdd('movements', {
        productId: item.productId, type: 'EXIT', subType: 'SALE',
        quantity: -item.qty, date: new Date().toISOString(),
        userId: DB.AppState.currentUser?.id,
        reference: `SALE-${saleId}`,
        lotNumber: assignedLotNumber,
        note: posCurrentPatient ? `Patient: ${posCurrentPatient.name}` : 'Vente comptoir',
      });
    }

    if (posCurrentRx?.id) {
      const rx = await DB.dbGet('prescriptions', posCurrentRx.id);
      if (rx) await DB.dbPut('prescriptions', { ...rx, status: 'dispensed', dispensedAt: Date.now(), dispensedBy: DB.AppState.currentUser?.id, saleId });
    }

    await DB.writeAudit('SALE', 'sales', saleId, { total, items: posCart.length, method, patient: posCurrentPatient?.name });

    // Envoi SMS reçu après paiement confirmé
    if (['orange_money', 'mtn_momo'].includes(method) && saleData.mmPhone) {
      await MobileMoneyGateway.sendSMSReceipt(saleData.mmPhone, method, total, saleId);
    }

    triggerFeedback('success', `Vente #${String(saleId).padStart(6, '0')} validée !`);

    // Afficher reçu officiel
    await afficherRecu(saleId, [...posCart], saleData);

    // Reset POS
    posCart = []; posCurrentPatient = null; posCurrentRx = null; posMobilePayState = 'idle';
    const disc2 = document.getElementById('pos-discount'); if (disc2) disc2.value = 0;
    const ci = document.getElementById('cash-in'); if (ci) ci.value = '';
    clearClientUI();
    const rxtog = document.getElementById('rx-toggle');
    if (rxtog) { rxtog.checked = false; onRxToggle(false); }
    resetMobilePayUI();
    refreshCartUI(); refreshGrid();
    if (typeof updateAlertBadge === 'function') updateAlertBadge();

  } catch (err) {
    console.error(err);
    UI.toast('Erreur : ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="check-circle"></i> Valider la Vente'; if (window.lucide) lucide.createIcons(); }
  }
}

// ═══════════════════════════════════════════════════════════════════
// REÇU OFFICIEL v3 — Professionnel et complet
// ═══════════════════════════════════════════════════════════════════
async function afficherRecu(saleId, items, saleData) {
  const settings = await DB.dbGetAll('settings');
  const gs = k => settings.find(s => s.key === k)?.value;
  const nomPharma = gs('pharmacy_name') || 'Pharmacie Centrale de Conakry';
  const addrPharma = gs('pharmacy_address') || 'Avenue de la République, Conakry, Guinée';
  const telPharma = gs('pharmacy_phone') || '+224 620 000 000';
  const emailPharma = gs('pharmacy_email') || '';
  const dnpmPharma = gs('pharmacy_dnpm') || 'LIC-DNPM-2024-001';
  const respPharma = gs('pharmacy_resp') || 'Pharmacien Responsable';
  const payLabels = { cash: 'Espèces', orange_money: 'Orange Money Guinée', mtn_momo: 'MTN Mobile Money', credit: 'Vente à crédit', transfer: 'Virement bancaire' };
  const now = new Date();
  const cashRecv = saleData.cashReceived || 0;
  const change = saleData.paymentMethod === 'cash' ? cashRecv - saleData.total : 0;
  const refNum = String(saleId).padStart(8, '0');

  UI.modal(`🧾 Reçu de Vente — Réf. ${refNum}`, `
    <div class="recu-pro" id="recu-printable">

      <!-- EN-TÊTE -->
      <div class="recu-header">
        <div class="recu-logo-block">
          <div class="recu-logo">💠</div>
        </div>
        <div class="recu-org">
          <div class="recu-orgname">${nomPharma}</div>
          <div class="recu-orgdetail">${addrPharma}</div>
          <div class="recu-orgdetail">Tél : ${telPharma}${emailPharma ? ' · ' + emailPharma : ''}</div>
          <div class="recu-orgdnpm">Licence DNPM : ${dnpmPharma}</div>
        </div>
        <div class="recu-docblock">
          <div class="recu-doctype">REÇU DE VENTE</div>
          <div class="recu-docnum">N° ${refNum}</div>
          <div class="recu-docdate">${now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          <div class="recu-doctime">${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
      <div class="recu-sep"></div>

      <!-- INFORMATIONS TRANSACTION -->
      <div class="recu-transaction-grid">
        <div class="recu-tx-block recu-tx-client">
          <div class="recu-tx-label">CLIENT</div>
          ${saleData.patientName ? `
            <div class="recu-tx-name">${saleData.patientName}</div>
            ${saleData.patientPhone ? `<div class="recu-tx-sub">${saleData.patientPhone}</div>` : ''}
          ` : `<div class="recu-tx-name recu-tx-anon">Client de passage</div>`}
        </div>
        <div class="recu-tx-block recu-tx-payment">
          <div class="recu-tx-label">PAIEMENT</div>
          <div class="recu-tx-name">${payLabels[saleData.paymentMethod] || saleData.paymentMethod}</div>
          ${saleData.mmPhone ? `<div class="recu-tx-sub">${saleData.mmPhone}</div>` : ''}
          ${saleData.creditDueDate ? `<div class="recu-tx-sub">Échéance : ${UI.formatDate(saleData.creditDueDate)}</div>` : ''}
        </div>
        <div class="recu-tx-block recu-tx-caissier">
          <div class="recu-tx-label">CAISSIER</div>
          <div class="recu-tx-name">${saleData.sellerName || DB.AppState.currentUser?.name || '—'}</div>
        </div>
        ${saleData.prescriptionRef ? `
        <div class="recu-tx-block recu-tx-rx">
          <div class="recu-tx-label">ORDONNANCE</div>
          <div class="recu-tx-name">${saleData.prescriptionRef}</div>
          ${saleData.doctorName ? `<div class="recu-tx-sub">Dr ${saleData.doctorName}</div>` : ''}
        </div>` : ''}
      </div>
      <div class="recu-sep"></div>

      <!-- TABLEAU DES MÉDICAMENTS -->
      <table class="recu-table">
        <thead>
          <tr>
            <th class="recu-th-product">Médicament / Désignation</th>
            <th class="recu-th-qty ta-c">Qté</th>
            <th class="recu-th-pu ta-r">P.U. (GNF)</th>
            <th class="recu-th-total ta-r">Total (GNF)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((i, idx) => `
            <tr class="${idx % 2 === 0 ? 'recu-row-even' : ''}">
              <td>
                <div class="recu-drug-name">${i.name}${i.requiresPrescription ? ` <span class="tag-rx-print">Rx</span>` : ''}</div>
                ${i.dci ? `<div class="recu-drug-sub">${i.dci}${i.dosage ? ' · ' + i.dosage : ''}</div>` : ''}
              </td>
              <td class="ta-c recu-td-qty">${i.qty}</td>
              <td class="ta-r">${UI.formatCurrency(i.unitPrice)}</td>
              <td class="ta-r recu-td-total">${UI.formatCurrency(i.total)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="recu-sep"></div>

      <!-- TOTAUX -->
      <div class="recu-totaux-block">
        <div class="recu-totaux">
          ${saleData.discount > 0 ? `
            <div class="recu-tot-row">
              <span>Sous-total</span>
              <span>${UI.formatCurrency(saleData.subtotal)}</span>
            </div>
            <div class="recu-tot-row recu-remise">
              <span>Remise accordée</span>
              <span>− ${UI.formatCurrency(saleData.discount)}</span>
            </div>` : ''}
          <div class="recu-tot-row recu-tot-main">
            <span>TOTAL TTC</span>
            <span>${UI.formatCurrency(saleData.total)}</span>
          </div>
          ${saleData.paymentMethod === 'cash' && cashRecv > 0 ? `
            <div class="recu-tot-row">
              <span>Montant reçu</span>
              <span>${UI.formatCurrency(cashRecv)}</span>
            </div>
            <div class="recu-tot-row recu-monnaie">
              <span>Monnaie rendue</span>
              <span>${UI.formatCurrency(change)}</span>
            </div>` : ''}
        </div>
      </div>
      <div class="recu-sep"></div>

      <!-- PIED DE PAGE -->
      <div class="recu-footer">
        <div class="recu-footer-conseils">
          <p>📋 <em>Respectez scrupuleusement vos prescriptions médicales</em></p>
          <p>💊 <em>Conservez les médicaments hors de portée des enfants</em></p>
          <p>☎️ <em>Pour toute question : ${telPharma}</em></p>
        </div>
        <div class="recu-footer-legal">
          <p>Établi par : ${respPharma}</p>
          <p>Document officiel — Réf. ${refNum} — ${dnpmPharma}</p>
          <p>Imprimé le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          <p class="recu-merci">✨ Merci pour votre confiance</p>
        </div>
      </div>

    </div>

    <div class="recu-actions" id="recu-actions">
      <button class="btn btn-ghost" onclick="imprimerTicket()">🖨️ Ticket thermique</button>
      <button class="btn btn-secondary" onclick="PrintEngine ? PrintEngine.printInvoice(${saleId}) : UI.toast('Module impression non chargé','warning')">📄 Facture A4</button>
      ${saleData.mmPhone ? `<button class="btn btn-info" onclick="MobileMoneyGateway.sendSMSReceipt('${saleData.mmPhone}','${saleData.paymentMethod}',${saleData.total},${saleId}).then(()=>UI.toast('📱 SMS envoyé','success'))">📱 Renvoyer SMS</button>` : ''}
      <button class="btn btn-primary" onclick="UI.closeModal()">✓ Fermer</button>
    </div>
  `, { size: 'large' });
}

// ═══════════════════════════════════════════════════════════════════
// IMPRESSION TICKET THERMIQUE
// ═══════════════════════════════════════════════════════════════════
function imprimerTicket() {
  const el = document.getElementById('recu-printable');
  if (!el) return;
  const w = window.open('', '_blank', 'width=420,height=750');
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Ticket</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Courier New',monospace;font-size:11px;width:80mm;margin:0 auto;padding:4px;color:#000;background:#fff}
    .recu-header{display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:6px}
    .recu-logo{font-size:24px;margin-bottom:2px}
    .recu-orgname{font-size:13px;font-weight:bold;margin:2px 0}
    .recu-orgdetail,.recu-orgdnpm{font-size:9px;color:#555;line-height:1.4}
    .recu-docblock{margin-top:4px;text-align:center}
    .recu-doctype{font-size:12px;font-weight:bold;letter-spacing:1px}
    .recu-docnum{font-size:11px;font-weight:bold;color:#333}
    .recu-docdate,.recu-doctime{font-size:9px;color:#666}
    .recu-sep{border-top:1px dashed #999;margin:4px 0}
    .recu-transaction-grid{margin:4px 0}
    .recu-tx-block{margin-bottom:4px}
    .recu-tx-label{font-size:8px;font-weight:bold;text-transform:uppercase;color:#999;letter-spacing:.5px}
    .recu-tx-name{font-size:11px;font-weight:bold}
    .recu-tx-sub{font-size:9px;color:#666}
    .recu-tx-anon{color:#999;font-style:italic}
    .recu-table{width:100%;border-collapse:collapse;margin:4px 0}
    .recu-th-product,.recu-th-qty,.recu-th-pu,.recu-th-total{font-size:8px;font-weight:bold;border-bottom:1px solid #ccc;padding:2px;text-transform:uppercase;color:#444}
    .recu-table td{padding:3px 2px;vertical-align:top;font-size:10px}
    .recu-row-even{background:#f9f9f9}
    .recu-drug-name{font-weight:bold}
    .recu-drug-sub{font-size:8px;color:#777}
    .recu-td-qty{text-align:center;font-weight:bold}
    .recu-td-total{text-align:right;font-weight:bold}
    .tag-rx-print{font-size:7px;background:#fee;color:#c00;padding:0 2px;border-radius:2px;border:1px solid #f00}
    .ta-c{text-align:center}.ta-r{text-align:right}
    .recu-totaux-block{display:flex;justify-content:flex-end}
    .recu-totaux{width:60%;font-size:10px}
    .recu-tot-row{display:flex;justify-content:space-between;padding:2px 0}
    .recu-remise{color:#c00}
    .recu-tot-main{font-size:13px;font-weight:bold;border-top:2px solid #000;margin-top:3px;padding-top:3px}
    .recu-monnaie{color:#060;font-weight:bold}
    .recu-footer{text-align:center;margin-top:6px}
    .recu-footer-conseils p{font-size:9px;color:#666;margin-bottom:1px}
    .recu-footer-legal p{font-size:8px;color:#999;margin-bottom:1px}
    .recu-merci{font-size:10px;font-weight:bold;color:#000;margin-top:4px!important}
    .recu-actions,.recu-logo-block{display:none}
  </style></head><body>${el.outerHTML}</body></html>`);
  w.document.close();
  w.onload = () => { setTimeout(() => w.print(), 200); };
}

async function startBarcodeScan() {
  // Check for BarcodeDetector API (Chrome/Edge) or fallback to manual entry
  const hasBarcodeAPI = 'BarcodeDetector' in window;
  const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  if (!hasCamera) {
    // Fallback: manual code entry
    showManualBarcodeEntry();
    return;
  }

  UI.modal('📷 Scanner un Code-Barres', `
    <div class="barcode-scanner-module">
      <div class="scanner-preview-wrap">
        <video id="barcode-video" autoplay playsinline muted style="width:100%;max-height:300px;border-radius:8px;background:#000"></video>
        <div class="scanner-overlay">
          <div class="scanner-line"></div>
        </div>
      </div>
      <div class="scanner-status" id="scanner-status">
        <span class="scanner-status-dot"></span>
        Recherche de code-barres en cours…
      </div>
      <div class="scanner-manual" style="margin-top:12px">
        <p class="text-muted text-sm">Ou saisissez le code manuellement :</p>
        <div class="form-row" style="gap:8px;align-items:flex-end">
          <input type="text" id="manual-barcode" class="form-control" placeholder="Code EAN-13 ou CIP..." style="flex:1">
          <button class="btn btn-primary btn-sm" onclick="searchByBarcode(document.getElementById('manual-barcode').value)">🔍 Chercher</button>
        </div>
      </div>
    </div>
  `, { size: 'medium' });

  // Start camera
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    const video = document.getElementById('barcode-video');
    if (!video) { stream.getTracks().forEach(t => t.stop()); return; }
    video.srcObject = stream;
    window._scannerStream = stream;

    // Use BarcodeDetector if available
    if (hasBarcodeAPI) {
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'] });
      const scanInterval = setInterval(async () => {
        if (!document.getElementById('barcode-video')) {
          clearInterval(scanInterval);
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            clearInterval(scanInterval);
            stream.getTracks().forEach(t => t.stop());
            const code = barcodes[0].rawValue;
            UI.closeModal();
            searchByBarcode(code);
          }
        } catch (e) { /* continue scanning */ }
      }, 500);
      window._scanInterval = scanInterval;
    }
  } catch (err) {
    const status = document.getElementById('scanner-status');
    if (status) {
      status.innerHTML = '<span class="text-warning">⚠️ Caméra non disponible — utilisez la saisie manuelle ci-dessous</span>';
    }
  }

  // Cleanup on modal close
  const origClose = UI.closeModal;
  UI.closeModal = function () {
    if (window._scannerStream) {
      window._scannerStream.getTracks().forEach(t => t.stop());
      window._scannerStream = null;
    }
    if (window._scanInterval) {
      clearInterval(window._scanInterval);
      window._scanInterval = null;
    }
    origClose.call(UI);
    UI.closeModal = origClose;
  };
}

function showManualBarcodeEntry() {
  UI.modal('🔢 Saisie manuelle du code', `
    <div class="form-grid">
      <div class="form-group">
        <label>Code-barres (EAN-13, CIP, Code interne)</label>
        <input type="text" id="manual-barcode" class="form-control" placeholder="Ex: 3400936... ou P001" autofocus>
      </div>
      <div class="info-box-small" style="margin-top:8px">
        <i data-lucide="info"></i>
        <span>Saisissez le code inscrit sur l'emballage du médicament ou le code interne du produit.</span>
      </div>
    </div>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="searchByBarcode(document.getElementById('manual-barcode').value)"><i data-lucide="search"></i> Chercher</button>
    `
  });
  if (window.lucide) lucide.createIcons();
  setTimeout(() => document.getElementById('manual-barcode')?.focus(), 100);
}

/**
 * Création rapide d'une ordonnance directement dans le POS
 */
function showQuickNewRx() {
  const patientName = posCurrentPatient ? posCurrentPatient.name : "Patient Anonyme";
  UI.modal('📄 Nouvelle Ordonnance (Saisie Rapide)', `
    <div class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Patient</label>
          <input type="text" class="form-control" value="${patientName}" readonly>
        </div>
        <div class="form-group">
          <label>Médecin prescripteur</label>
          <input type="text" id="qrx-doctor" class="form-control" placeholder="Nom du médecin">
        </div>
      </div>
      <div class="form-group">
        <label>Médicaments prescrits (Note informative)</label>
        <textarea id="qrx-notes" class="form-control" rows="3" placeholder="Saisissez ici les détails de l'ordonnance si nécessaire..."></textarea>
      </div>
      <div class="info-box">
        💡 Les médicaments ajoutés au panier seront liés à cette ordonnance lors de la validation.
      </div>
    </div>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveQuickRx()">✓ Valider l'ordonnance</button>
    `
  });
}

async function saveQuickRx() {
  const doctor = document.getElementById('qrx-doctor')?.value || "Non spécifié";
  const notes = document.getElementById('qrx-notes')?.value || "";

  const rxData = {
    patientId: posCurrentPatient?.id || null,
    patientName: posCurrentPatient?.name || "Patient Anonyme",
    doctorName: doctor,
    date: new Date().toISOString(),
    status: 'validated',
    items: posCart.map(item => ({
      productId: item.productId,
      productName: item.name,
      quantity: item.qty
    })),
    notes: notes
  };

  const id = await DB.dbAdd('prescriptions', rxData);
  const newRx = { ...rxData, id };
  window._posPrescriptions = [...(window._posPrescriptions || []), newRx];

  UI.closeModal();
  attachRx(id);
  UI.toast('✅ Ordonnance créée et liée au panier', 'success');
}

window.showQuickNewRx = showQuickNewRx;
window.saveQuickRx = saveQuickRx;

function searchByBarcode(code) {
  if (!code || !code.trim()) { UI.toast('Veuillez entrer un code', 'warning'); return; }
  code = code.trim().toUpperCase();
  const product = posProducts.find(p =>
    (p.code || '').toUpperCase() === code ||
    (p.ean || '').toUpperCase() === code ||
    (p.cip || '').toUpperCase() === code
  );
  UI.closeModal();
  if (product) {
    addToCart(product.id);
    UI.toast(`✅ ${product.name} ajouté au panier`, 'success');
  } else {
    UI.toast(`❌ Aucun produit trouvé pour le code "${code}"`, 'error');
    // Set the search field to the code for manual search
    const searchInput = document.getElementById('pos-search');
    if (searchInput) {
      searchInput.value = code;
      posSearch = code.toLowerCase();
      refreshGrid();
    }
  }
}

window.searchByBarcode = searchByBarcode;
window.showManualBarcodeEntry = showManualBarcodeEntry;

// Note: le listener pour fermer le dropdown client-suggest est déjà défini plus haut (L530-536)

// ─── Exports globaux ──────────────────────────────────────────────
window.addToCart = addToCart;
window.changeQty = changeQty;
window.setQtyDirect = setQtyDirect;
window.removeItem = removeItem;
window.viderPanier = viderPanier;
window.mettreEnAttente = mettreEnAttente;
window.validerVente = validerVente;
window.selectPay = selectPay;
window.setCashIn = setCashIn;
window.refreshChange = refreshChange;
window.refreshTotals = refreshTotals;
window.quickDiscount = quickDiscount;
window.initMobilePay = initMobilePay;
window.resetMobilePayUI = resetMobilePayUI;
window.refreshMmPhone = refreshMmPhone;
window.refreshCombined = refreshCombined;
window.onCombinedChange = onCombinedChange;
window.calcAssurance = calcAssurance;
window.filterCat = filterCat;
window.clearPosSearch = clearPosSearch;
window.onClientFocus = onClientFocus;
window.selectPatient = selectPatient;
window.clearClientUI = clearClientUI;
window.showQuickNewClient = showQuickNewClient;
window.saveQuickClient = saveQuickClient;
window.onRxToggle = onRxToggle;
window.openRxPicker = openRxPicker;
window.attachRx = attachRx;
window.detachRx = detachRx;
window.renderPOS = renderPOS;
window.imprimerTicket = imprimerTicket;
window.startBarcodeScan = startBarcodeScan;
window.MobileMoneyGateway = MobileMoneyGateway;
window.showGenericAlternatives = showGenericAlternatives;

// ═══════════════════════════════════════════════════════════════════
// SUBSTITUTION GÉNÉRIQUE — Popup alternatives DCI
// ═══════════════════════════════════════════════════════════════════
function showGenericAlternatives(productId) {
  const p = posProducts.find(x => x.id === productId);
  if (!p) return;
  const alts = findGenericAlternatives(p);
  if (!alts.length) { UI.toast('Aucune alternative générique en stock', 'info'); return; }
  UI.modal(`<i data-lucide="repeat" class="modal-icon-inline"></i> Alternatives Génériques — ${p.dci}`, `
    <div class="info-box info-primary" style="margin-bottom:16px">
      <strong>${p.name}</strong> est en rupture de stock. Voici les alternatives avec la même DCI (<strong>${p.dci}</strong>) disponibles :
    </div>
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${alts.map(a => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:var(--surface); border:1px solid var(--border); border-radius:12px; cursor:pointer; transition:all 0.2s"
             onmouseover="this.style.borderColor='var(--primary-color)';this.style.transform='translateX(5px)'" 
             onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'"
             onclick="UI.closeModal(); addToCart(${a.id})">
          <div>
            <div style="font-weight:700; font-size:15px;">${a.name}</div>
            <div style="color:var(--text-muted); font-size:13px;">${a.dci} ${a.dosage || ''} · ${a.form || ''} · ${a.brand || ''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800; color:var(--primary-color)">${UI.formatCurrency(a.salePrice)}</div>
            <div style="font-size:12px; color:var(--success-color);">${posStock[a.id] || 0} en stock</div>
          </div>
        </div>
      `).join('')}
    </div>
  `, { size: 'medium' });
  if (window.lucide) lucide.createIcons();
}

Router.register('pos', renderPOS);
