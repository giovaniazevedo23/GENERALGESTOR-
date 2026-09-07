/**
 * GENERAL App - Controlador Principal da Aplicação
 * Integrado com:
 * 1. Planejador Logístico com Auto-Otimização para 100% Seguro por IA (Antes vs. Depois)
 * 2. IA Preditiva Alimentada Dinamicamente pelo Plano Logístico
 * 3. Aviso Automático de Sinistro, Perícia e Atraso ao Cliente / Embarcador
 * 4. Encerramento de Ocorrência com Auditoria Pós-Mortem e Avaliação de Decisões
 * 5. Módulo Avançado de Transbordo & Salvamento (Métricas Financeiras, SLA Regressivo, Checklist EPIs e Base de Apoio)
 */

const App = {
  currentTab: 'dashboard',
  currentOptimizedResult: null,
  simulationState: {
    hours: 5.5,
    speed: 88,
    speedLimit: 60,
    weather: 'CHUVOSO',
    cargo: 'LIQUIDO_PERIGOSO',
    brake: 260,
    tire: 35,
    isNightTime: false
  },

  init() {
    this.initCargoCatalog();
    this.populateCargoDropdowns();
    this.loadCustomEventTypes();
    this.checkAuth();
    this.bindEvents();
    this.renderCurrentIncident();
    this.renderIncidentsList();
    this.renderHazmatCatalogue();
    // A auditoria agora é feita apenas manualmente via botão
    // this.runLogisticsPlanAudit();
    // this.syncPredictiveFromCurrentPlan(false);
    
    // Subscribe to store updates
    appState.subscribe(() => {
      this.renderCurrentIncident();
      this.renderIncidentsList();
      if (this.currentTab === 'ai-plan') this.renderAIPlanTab();
      if (this.currentTab === 'wizard') this.renderGoldenHourCards();
      if (this.currentTab === 'dossier') this.renderDossierTab();
      if (this.currentTab === 'transshipment') this.renderTransshipmentTab();
      if (this.currentTab === 'docs') this.renderDocsTab();
      if (this.currentTab === 'history') this.renderHistoryTab();
      
      const aiCounter = document.getElementById('ai-credits-counter');
      if (aiCounter) aiCounter.textContent = appState.getAICredits();
    });

    // Handle PWA shortcuts via URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab');
    const targetAction = urlParams.get('action');
    if (targetTab) {
      this.switchTab(targetTab);
    } else {
      this.switchTab('dashboard');
    }
    
    if (targetAction === 'new-incident') {
      setTimeout(() => this.openNewIncidentModal(), 500);
    }
    
    setTimeout(() => this.showUpdateCard(), 1500);

    // Fetch IBGE states
    this.loadStates();

    // Setup input masks and automatic logic
    this.setupInputMasks();
    this.generatePlanCode();
    this.setupFuelCostCalculation();

    // Setup listeners for live plan audit
    const planInputs = document.querySelectorAll('#plan-origin-state, #plan-origin-city, #plan-origin-ref, #plan-dest-state, #plan-dest-city, #plan-dest-ref, #plan-dist, #plan-roads, #plan-deptime, #plan-deadline, #plan-driver, #plan-tenure, #plan-fam, #plan-truck-fam, #plan-tank-fill');
    planInputs.forEach(input => {
      // Retirado a pedido do usuário: auditoria só roda ao clicar no botão
      // input.addEventListener('input', () => { this.runLogisticsPlanAudit(); this.syncPredictiveFromCurrentPlan(false); });
      // input.addEventListener('change', () => { this.runLogisticsPlanAudit(); this.syncPredictiveFromCurrentPlan(false); });
    });

    // Initialize map on dashboard load
    setTimeout(() => {
      const cur = appState.getCurrentIncident();
      if (cur) {
        mapController.init(cur.lat, cur.lng);
      }
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 150);

    // Setup SLA Timers (Dashboard SLA & Transshipment SLA)
    setInterval(() => {
      this.updateSLATimers();
      if (this.currentTab === 'transshipment') {
        this.updateTransshipmentSLATimer();
      }
    }, 1000);

    this.updateDriverXPCounter();
  },

  updateDriverXPCounter() {
    const xpCounter = document.getElementById('driver-xp-counter');
    if (xpCounter) {
      xpCounter.textContent = parseInt(localStorage.getItem('GENERAL_USER_XP') || '0', 10);
    }
  },

  submitParecer() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;
    const textarea = document.getElementById('docs-parecer');
    if (!textarea) return;
    appState.updateCurrentIncident({ docsParecer: textarea.value });
    textarea.value = '';
    this.showToast('Parecer Técnico salvo e enviado para o Dossiê!', 'success');
  },

  saveIshikawa() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;
    
    // Pegar dados da vistoria
    const vistoria = {
      clima: document.getElementById('vistoria-clima')?.value || '',
      pista: document.getElementById('vistoria-pista')?.value || '',
      lacre: document.getElementById('vistoria-lacre')?.value || '',
      condutor: document.getElementById('vistoria-condutor')?.value || '',
      veiculo: document.getElementById('vistoria-veiculo')?.value || ''
    };
    
    appState.updateCurrentIncident({ vistoria });
    this.showToast('Investigação de Causa Raiz e Vistoria salvas com sucesso!', 'success');
  },

  // CATÁLOGO DE CARGAS
  initCargoCatalog() {
    const cnpj = (appState.currentUser && appState.currentUser.companyCnpj) ? appState.currentUser.companyCnpj : 'default';
    let catalog = JSON.parse(localStorage.getItem(`GENERAL_CARGO_CATALOG_${cnpj}`) || 'null');
    if (!catalog) {
      catalog = [
        { id: 1, name: 'Caixas de Eletrônicos', category: 'Cargas Gerais', risk: 20 },
        { id: 2, name: 'Carnes e Congelados', category: 'Carga Frigorífica', risk: 40 },
        { id: 3, name: 'Gado de Corte', category: 'Cargas Vivas', risk: 50 },
        { id: 4, name: 'Turbina Eólica', category: 'Carga Indivisível', risk: 60 },
        { id: 5, name: 'Soja a Granel', category: 'Carga a Granéis', risk: 70 }
      ];
      localStorage.setItem(`GENERAL_CARGO_CATALOG_${(appState.currentUser && appState.currentUser.companyCnpj) ? appState.currentUser.companyCnpj : 'default'}`, JSON.stringify(catalog));
    }
    this.cargoCatalog = catalog;
  },

  renderCargoCatalog() {
    const container = document.getElementById('cargo-catalog-list');
    if (!container) return;
    
    if (this.cargoCatalog.length === 0) {
      container.innerHTML = '<div class="text-center text-slate-500 py-10">Nenhuma carga cadastrada.</div>';
      return;
    }
    
    container.innerHTML = this.cargoCatalog.map(c => `
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-amber-500/50 transition-all">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            ${c.risk}
          </div>
          <div>
            <h4 class="font-bold text-white text-sm">${c.name}</h4>
            <p class="text-[10px] text-slate-400 uppercase">${c.category}</p>
          </div>
        </div>
        <button onclick="App.deleteCargo(${c.id})" class="text-slate-500 hover:text-red-500 transition-colors">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    this.populateCargoDropdowns();
  },

  openAddCargoModal() {
    document.getElementById('add-cargo-modal').classList.remove('hidden');
    document.getElementById('new-cargo-name').value = '';
    this.updateCargoRiskEstimate();
  },

  updateCargoRiskEstimate() {
    const cat = document.getElementById('new-cargo-category').value;
    const riskInput = document.getElementById('new-cargo-risk');
    let risk = 20;
    if (cat === 'Carga Frigorífica') risk = 40;
    if (cat === 'Cargas Vivas') risk = 50;
    if (cat === 'Carga Indivisível') risk = 60;
    if (cat === 'Carga a Granéis') risk = 70;
    riskInput.value = risk;
  },

  saveNewCargo() {
    const name = document.getElementById('new-cargo-name').value;
    const category = document.getElementById('new-cargo-category').value;
    const risk = parseInt(document.getElementById('new-cargo-risk').value, 10);
    
    if (!name) {
      this.showToast('Preencha o nome da carga', 'error');
      return;
    }
    
    const newCargo = { id: Date.now(), name, category, risk };
    this.cargoCatalog.push(newCargo);
    const cnpj = (appState.currentUser && appState.currentUser.companyCnpj) ? appState.currentUser.companyCnpj : 'default';
    localStorage.setItem(`GENERAL_CARGO_CATALOG_${cnpj}`, JSON.stringify(this.cargoCatalog));
    
    document.getElementById('add-cargo-modal').classList.add('hidden');
    this.showToast('Carga adicionada ao catálogo!', 'success');
    this.renderCargoCatalog();
  },

  deleteCargo(id) {
    if (confirm('Deseja realmente remover esta carga?')) {
      this.cargoCatalog = this.cargoCatalog.filter(c => c.id !== id);
      const cnpj = (appState.currentUser && appState.currentUser.companyCnpj) ? appState.currentUser.companyCnpj : 'default';
    localStorage.setItem(`GENERAL_CARGO_CATALOG_${cnpj}`, JSON.stringify(this.cargoCatalog));
      this.renderCargoCatalog();
    }
  },

  populateCargoDropdowns() {
    const opts = '<option value="">Selecione o tipo de carga...</option>' + 
                 this.cargoCatalog.map(c => `<option value="${c.name}">${c.name} (Risco ${c.risk})</option>`).join('');
    const els = ['plan-cargo', 'incident-cargo', 'select-cargo'];
    els.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = opts;
    });
  },



  populateIncidentSelectors() {
    const incidents = (window.appState && appState.incidents) ? appState.incidents.filter(i => i.status !== 'CONCLUIDA') : [];
    const createOptions = (selectId) => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      sel.innerHTML = '<option value="">Selecione uma ocorrência ativa...</option>';
      incidents.forEach(inc => {
        sel.innerHTML += `<option value="${inc.id}">${inc.id} - ${inc.title}</option>`;
      });
      if (appState && appState.currentIncidentId) {
        sel.value = appState.currentIncidentId;
      }
    };
    createOptions('ishikawa-incident-select');
    createOptions('dossier-incident-select');
    createOptions('reverse-incident-select');
  },

  handleIshikawaIncidentSelect() {
    const val = document.getElementById('ishikawa-incident-select').value;
    if (val && window.appState) {
      appState.setCurrentIncident(val);
      // view is updated via subscribe
    }
  },
  
  handleDossierIncidentSelect() {
    const val = document.getElementById('dossier-incident-select').value;
    if (val && window.appState) {
      appState.setCurrentIncident(val);
    }
  },

  handleReverseIncidentSelect() {
    const val = document.getElementById('reverse-incident-select').value;
    const form = document.getElementById('reverse-logistics-form');
    if (val && window.appState) {
      appState.setCurrentIncident(val);
      if (form) form.classList.remove('hidden');
    } else {
      if (form) form.classList.add('hidden');
    }
  },

  submitReverseLogistics() {
    if (!window.appState) return;
    const currentInc = appState.getCurrentIncident();
    if (!currentInc) return;
    
    const statusEl = document.getElementById('reverse-status');
    const companyEl = document.getElementById('reverse-company');
    
    if (!statusEl || !companyEl) return;
    
    const reverseData = { 
        status: statusEl.value, 
        company: companyEl.value, 
        processedAt: new Date().toISOString() 
    };
    appState.updateCurrentIncident({ reverseLogistics: reverseData });
    
    this.showToast('Logística reversa processada com sucesso! Histórico atualizado.', 'success');
  },



  handleEventTypeChange(selectElement) {
    const customInput = document.getElementById('customEventType');
    if (customInput) {
      if (selectElement.value === 'Outros') {
        customInput.classList.remove('hidden');
        customInput.required = true;
      } else {
        customInput.classList.add('hidden');
        customInput.required = false;
        customInput.value = '';
      }
    }
  },

  loadCustomEventTypes() {
    try {
      const customEvents = JSON.parse(localStorage.getItem('GENERAL_CUSTOM_EVENTS') || '[]');
      const selectElement = document.getElementById('eventTypeSelect');
      if (selectElement && customEvents.length > 0) {
        const options = Array.from(selectElement.options);
        const outrosIndex = options.findIndex(opt => opt.value === 'Outros');
        if (outrosIndex > -1) {
          customEvents.forEach(evt => {
            if (!Array.from(selectElement.options).find(o => o.value === evt)) {
               const newOption = new Option(evt, evt);
               selectElement.insertBefore(newOption, selectElement.options[outrosIndex]);
            }
          });
        }
      }
    } catch(e) {
      console.error(e);
    }
  },

  renderEliteSquad() {
    const container = document.getElementById('elite-squad-container');
    if (!container) return;

    const drivers = [
      { name: 'Marcos Silva', rank: 'Elite', score: 99, trips: 142 },
      { name: 'João Santos', rank: 'Veterano', score: 95, trips: 110 },
      { name: 'Ana Costa', rank: 'Especialista', score: 89, trips: 75 }
    ];

    container.innerHTML = drivers.map((d, i) => `
      <div class="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/50">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-slate-900' : 'bg-orange-700 text-white'} font-black flex items-center justify-center text-xs">
            #${i+1}
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-white">${d.name}</span>
            <span class="text-[10px] font-bold text-amber-500 uppercase tracking-widest">${d.rank}</span>
          </div>
        </div>
        <div class="text-right flex flex-col">
          <span class="text-xs font-black text-emerald-400">${d.score} pts</span>
          <span class="text-[9px] text-slate-500">${d.trips} missões</span>
        </div>
      </div>
    `).join('');
  },

  renderIndicatorsTab() {
    this.renderEliteSquad();
    if (!window.appState) return;
    const incidents = appState.incidents || [];
    const totalIncidents = incidents.length;
    
    let totalPlans = 0;
    try {
      const savedPlans = JSON.parse(localStorage.getItem('general_saved_plans') || '[]');
      totalPlans = savedPlans.length;
    } catch(e) {}

    const freq = totalPlans > 0 ? ((totalIncidents / totalPlans) * 100).toFixed(1) : (totalIncidents * 10).toFixed(1);
    
    let totalCost = 0;
    let criticalCount = 0;
    let highCount = 0;
    let medCount = 0;

    let dmgTotal = 0;
    let dmgPartial = 0;
    let dmgNone = 0;

    let totalDowntimeHours = 0;
    let affectedDeliveries = 0;

    incidents.forEach(inc => {
      totalCost += Number(inc.cargoValue) || 0;

      if (inc.severity === 'CRITICO' || inc.severity === 'FATALIDADE' || inc.driverStatus === 'FATALIDADE') {
        criticalCount++;
      } else if (inc.severity === 'ALTO' || inc.driverStatus === 'FERIDO_GRAVE') {
        highCount++;
      } else {
        medCount++;
      }

      if (inc.damageCondition === 'TOTAL' || inc.damageCondition === 'PERDA_TOTAL') {
        dmgTotal++;
      } else if (inc.damageCondition === 'PARCIAL' || inc.damageCondition === 'PERDA_PARCIAL_VAZAMENTO') {
        dmgPartial++;
      } else {
        dmgNone++;
      }

      if (inc.status === 'EM_ATENDIMENTO' || inc.status === 'PENDENTE') {
         totalDowntimeHours += 4.5;
      } else if (inc.status === 'FINALIZADO') {
         totalDowntimeHours += 1.5;
      } else {
         totalDowntimeHours += 2;
      }

      affectedDeliveries++; 
    });

    const elTotal = document.getElementById('kpi-total-incidents');
    if(elTotal) elTotal.textContent = totalIncidents;
    
    const elFreq = document.getElementById('kpi-freq-incidents');
    if(elFreq) elFreq.textContent = freq + '%';
    
    const elCost = document.getElementById('kpi-total-cost');
    if(elCost) elCost.textContent = totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const affectedPercent = totalPlans > 0 ? ((affectedDeliveries / totalPlans) * 100).toFixed(1) : (affectedDeliveries > 0 ? 100 : 0);
    const elAff = document.getElementById('kpi-affected-deliveries');
    if(elAff) elAff.textContent = affectedPercent + '%';

    const elDown = document.getElementById('kpi-downtime');
    if(elDown) elDown.textContent = Math.floor(totalDowntimeHours) + 'h';

    const updateBar = (id, count, total) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const valEl = document.getElementById(`val-${id}`);
      const barEl = document.getElementById(`bar-${id}`);
      if (valEl) valEl.textContent = pct + '%';
      if (barEl) barEl.style.width = pct + '%';
    };

    updateBar('grav-critical', criticalCount, totalIncidents);
    updateBar('grav-high', highCount, totalIncidents);
    updateBar('grav-medium', medCount, totalIncidents);

    updateBar('dmg-total', dmgTotal, totalIncidents);
    updateBar('dmg-partial', dmgPartial, totalIncidents);
    updateBar('dmg-none', dmgNone, totalIncidents);
  },


  toggleMobileDrawer() {
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden');
    }
  },

  showUpdateCard() {
    if (localStorage.getItem('general_update_2_5_seen')) return;
    
    const div = document.createElement('div');
    div.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in';
    div.innerHTML = `
      <div class="bg-slate-900 border border-blue-500/30 p-6 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-4 animate-scale-up">
        <div class="flex justify-between items-start">
          <div class="flex items-center gap-2">
            <i data-lucide="sparkles" class="w-6 h-6 text-blue-400"></i>
            <h3 class="font-bold text-white text-lg">Nova Atualização (v2.5)</h3>
          </div>
          <button onclick="this.parentElement.parentElement.parentElement.remove(); localStorage.setItem('general_update_2_5_seen', 'true')" class="text-slate-400 hover:text-white transition-all"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>
        <p class="text-sm text-slate-300">Confira o que mudou nesta versão:</p>
        <div class="space-y-2 text-xs">
          <div class="p-2 rounded bg-slate-950 border border-slate-800 text-slate-400 line-through">Antes: Busca Restrita</div>
          <div class="p-2 rounded bg-blue-900/20 border border-blue-500/20 text-blue-300 font-medium flex items-center gap-2"><i data-lucide="check" class="w-3 h-3"></i> Agora: Lupa Global no Dashboard</div>
          <div class="p-2 rounded bg-slate-950 border border-slate-800 text-slate-400 line-through">Antes: Fornecedores Ocultos</div>
          <div class="p-2 rounded bg-blue-900/20 border border-blue-500/20 text-blue-300 font-medium flex items-center gap-2"><i data-lucide="check" class="w-3 h-3"></i> Agora: Marketplace Dinâmico com Avaliações</div>
          <div class="p-2 rounded bg-slate-950 border border-slate-800 text-slate-400 line-through">Antes: PDF Genérico</div>
          <div class="p-2 rounded bg-blue-900/20 border border-blue-500/20 text-blue-300 font-medium flex items-center gap-2"><i data-lucide="check" class="w-3 h-3"></i> Agora: PDF com Logo Oficial do App</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove(); localStorage.setItem('general_update_2_5_seen', 'true')" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl mt-2 transition-all">
          Entendi
        </button>
      </div>
    `;
    document.body.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Mostra indicador de nova notificação
    const btn = document.getElementById('provider-notifications-btn');
    if (btn) btn.classList.remove('hidden');
  },

  async syncFromFirebase() {
      if (window.db) {
          window.db.collection('route_evaluations').onSnapshot(snapshot => {
              appState.routeEvaluations = appState.routeEvaluations || [];
              let changed = false;
              snapshot.docChanges().forEach(change => {
                  if (change.type === 'added' || change.type === 'modified') {
                      const data = change.doc.data();
                      const existingIndex = appState.routeEvaluations.findIndex(e => e.id === data.id);
                      if (existingIndex >= 0) appState.routeEvaluations[existingIndex] = data;
                      else appState.routeEvaluations.push(data);
                      changed = true;
                  }
              });

          // Listen to panics (incidents)
          window.db.collection('incidents').where('type', '==', 'ALERTA_MOTORISTA').onSnapshot(snapshot => {
              let rapidReports = JSON.parse(localStorage.getItem('GENERAL_RAPID_REPORTS') || '[]');
              let changed = false;
              
              snapshot.docChanges().forEach(change => {
                  if (change.type === 'added') {
                      const data = change.doc.data();
                      // Multi-tenancy filter
                      if (appState.currentUser && appState.currentUser.companyCnpj && data.companyCnpj && data.companyCnpj !== appState.currentUser.companyCnpj) {
                          return;
                      }
                      
                      // Verifica se já não existe no rapidReports (baseado na data aproximada ou id)
                      const exists = rapidReports.find(r => r.id === data.id);
                      if (!exists) {
                          const report = {
                              id: data.id,
                              type: 'PÂNICO - ' + (data.driverName || 'Motorista'),
                              location: data.location || 'GPS Indisponível',
                              timestamp: data.date || new Date().toISOString()
                          };
                          rapidReports.push(report);
                          changed = true;
                          
                          App.showToast(`🚨 ALERTA PÂNICO: ${data.driverName} (GPS: ${data.location})`, 'error');
                      }
                  }
              });
              
              if (changed) {
                  localStorage.setItem('GENERAL_RAPID_REPORTS', JSON.stringify(rapidReports));
                  if (App.currentTab === 'dashboard') {
                      App.renderRiskDashboard();
                  }
              }
          });

              if (changed) {
                  localStorage.setItem('general_route_evaluations', JSON.stringify(appState.routeEvaluations));
                  // Optionally trigger a re-render of the map or monitoring view
                  if (window.App && typeof window.App.renderMonitoringTab === 'function') {
                      window.App.renderMonitoringTab();
                  }
              }
          });
      }

    if (!window.db || !appState.currentUser || !appState.currentUser.id) return;
    try {
      const userId = appState.currentUser.id;
      const doc = await window.db.collection('users_sync').doc(userId).get();
      if (doc.exists) {
        const data = doc.data();
        
        const mergeArrays = (localKey, remoteArray, idField) => {
           if (!remoteArray) return;
           let localArray = JSON.parse(localStorage.getItem(localKey) || '[]');
           remoteArray.forEach(remoteItem => {
              if (!localArray.find(localItem => localItem[idField] === remoteItem[idField])) {
                 localArray.push(remoteItem);
              }
           });
           localStorage.setItem(localKey, JSON.stringify(localArray));
        };
        
        mergeArrays('general_saved_plans', data.general_saved_plans, 'id');
        mergeArrays('GENERAL_PAAC_SAVED_PLANS', data.GENERAL_PAAC_SAVED_PLANS, 'id');
        mergeArrays('general_hidden_carriers', data.general_hidden_carriers, 'id');
        
        if (data.general_saved_plans || data.GENERAL_PAAC_SAVED_PLANS) {
           appState.savedPlans = JSON.parse(localStorage.getItem('GENERAL_PAAC_SAVED_PLANS') || '[]');
           if(document.getElementById('saved-plans-container')) this.renderSavedPlansTab();
        }
      }
      
      await this.syncToFirebase();
    } catch(e) {
      console.error("Erro na sincronização Firebase:", e);
    }
  },

  async syncToFirebase() {
    if (!window.db || !appState.currentUser || !appState.currentUser.id) return;
    try {
      const userId = appState.currentUser.id;
      await window.db.collection('users_sync').doc(userId).set({
        general_saved_plans: JSON.parse(localStorage.getItem('general_saved_plans') || '[]'),
        GENERAL_PAAC_SAVED_PLANS: JSON.parse(localStorage.getItem('GENERAL_PAAC_SAVED_PLANS') || '[]'),
        general_hidden_carriers: JSON.parse(localStorage.getItem('general_hidden_carriers') || '[]')
      }, { merge: true });
    } catch(e) {
      console.error("Erro ao subir dados para o Firebase:", e);
    }
  },

  async checkAuth() {
    const userJson = localStorage.getItem('general_user');
    if (userJson) {
      appState.currentUser = JSON.parse(userJson);
      document.getElementById('login-overlay').classList.add('hidden');
      await this.syncFromFirebase();
    } else {
      document.getElementById('login-overlay').classList.remove('hidden');
      // Generate automatic ID
      const idInput = document.getElementById('login-id');
      if (idInput && !idInput.value) {
        idInput.value = 'USR-' + Math.floor(Math.random() * 90000 + 10000);
      }
    }
  },
  // GOLDEN HOUR METHODS
  renderGoldenHourCards() {
    const container = document.getElementById('golden-hour-cards');
    if(!container) return;
    
    // Lista padrão se não houver no estado
    if (!appState.goldenHourTasks || appState.goldenHourTasks.length === 0) {
      appState.goldenHourTasks = [
        { id: 't2', action: 'NOTIFICAR', target: 'Seguradora', details: 'Gere protocolo de sinistro e preserve a cobertura securitária.', completed: false },
        { id: 't3', action: 'LIGAR', target: 'Cliente / Remetente', details: 'Aviso de atraso/sinistro. Possível acionamento de perícia.', completed: false }
      ];
    }

    container.innerHTML = '';
    appState.goldenHourTasks.forEach(task => {
      const isDone = task.completed;
      let actionColor = 'text-blue-400';
      if(task.action === 'LIGAR') actionColor = 'text-rose-400';
      if(task.action === 'NOTIFICAR' || task.action === 'EMAIL') actionColor = 'text-amber-400';
      
      let icon = 'phone-call';
      if(task.action === 'ACIONAR') icon = 'shield-alert';
      if(task.action === 'EMAIL') icon = 'mail';

      
      let contactActionBtn = '';
      if (task.contact) {
          if (task.action === 'LIGAR') {
              let phone = task.contact.replace(/\D/g,'');
              contactActionBtn = `<a href="tel:${phone}" class="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[11px] text-white font-bold text-center block transition-all"><i data-lucide="phone-call" class="w-3 h-3 inline mr-1"></i> Ligar Agora</a>`;
          } else if (task.action === 'NOTIFICAR') {
              if (task.modality === 'EMAIL') {
                  contactActionBtn = `<a href="mailto:${task.contact}" class="mt-2 w-full py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-[11px] text-white font-bold text-center block transition-all"><i data-lucide="mail" class="w-3 h-3 inline mr-1"></i> Enviar E-mail</a>`;
              } else {
                  let phone = task.contact.replace(/\D/g,'');
                  contactActionBtn = `<a href="https://wa.me/55${phone}" target="_blank" class="mt-2 w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[11px] text-white font-bold text-center block transition-all"><i data-lucide="message-circle" class="w-3 h-3 inline mr-1"></i> Enviar WhatsApp</a>`;
              }
          }
      }

      const card = document.createElement('div');
      card.className = `p-4 rounded-2xl border ${isDone ? 'bg-slate-900/40 border-emerald-500/30' : 'bg-slate-900/60 border-slate-700'} flex flex-col gap-3 transition-all relative group`;
      card.innerHTML = `
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2 ${actionColor} font-bold text-xs uppercase">
            <i data-lucide="${icon}" class="w-4 h-4"></i> ${task.action}
          </div>
          <button onclick="App.deleteGoldenTask('${task.id}')" class="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
        <h4 class="text-sm font-bold ${isDone ? 'text-slate-400 line-through' : 'text-white'}">${task.target}</h4>
        ${task.details ? `<p class="text-[11px] text-slate-400 leading-relaxed">${task.details}</p>` : ''}
        
        <button onclick="App.toggleGoldenTask('${task.id}')" class="mt-auto w-full py-2 rounded-xl text-xs font-bold transition-all border ${isDone ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-600 text-slate-300 hover:border-blue-500 hover:text-white'}">
          ${isDone ? '<i data-lucide="check-circle" class="w-4 h-4 inline mr-1"></i> Concluído' : 'Marcar como Concluído'}
        </button>
      `;
      container.appendChild(card);
    });

    if(window.lucide) window.lucide.createIcons();
  },

  toggleGoldenTask(id) {
    const task = appState.goldenHourTasks.find(t => t.id === id);
    if(task) {
      task.completed = !task.completed;
      this.renderGoldenHourCards();
    }
  },
  
  deleteGoldenTask(id) {
    appState.goldenHourTasks = appState.goldenHourTasks.filter(t => t.id !== id);
    this.renderGoldenHourCards();
  },

  openNewCommunicationModal() {
    document.getElementById('new-communication-modal').classList.remove('hidden');
  },

  closeNewCommunicationModal() {
    document.getElementById('new-communication-modal').classList.add('hidden');
    document.getElementById('comm-target').value = '';
    document.getElementById('comm-details').value = '';
    document.getElementById('comm-contact').value = '';
    document.getElementById('comm-action').value = 'LIGAR';
    this.handleCommActionChange();
  },

  handleCommActionChange() {
    const action = document.getElementById('comm-action').value;
    const modalityContainer = document.getElementById('comm-modality-container');
    const contactLabel = document.getElementById('comm-contact-label');
    
    if (action === 'NOTIFICAR') {
      modalityContainer.classList.remove('hidden');
      this.handleCommModalityChange();
    } else {
      modalityContainer.classList.add('hidden');
      contactLabel.textContent = 'Telefone';
    }
  },

  handleCommModalityChange() {
    const modality = document.getElementById('comm-modality').value;
    const contactLabel = document.getElementById('comm-contact-label');
    if (modality === 'EMAIL') {
      contactLabel.textContent = 'E-mail';
    } else {
      contactLabel.textContent = 'Telefone (WhatsApp)';
    }
  },

  saveNewCommunication() {
    const action = document.getElementById('comm-action').value;
    const target = document.getElementById('comm-target').value;
    let details = document.getElementById('comm-details').value;
    const contact = document.getElementById('comm-contact').value;
    const modality = document.getElementById('comm-modality').value;

    if(!target) {
      this.showToast('Informe o destinatário!');
      return;
    }

    if (!details.trim()) {
      const inc = appState.getCurrentIncident();
      if (inc && inc.checklists) {
        let doneActions = [];
        if (inc.checklists.driverSafe) doneActions.push("motorista em segurança");
        if (inc.checklists.signalized) doneActions.push("via sinalizada");
        if (inc.checklists.isolated) doneActions.push("área isolada");
        if (inc.checklists.cargoInspected) doneActions.push("carga inspecionada");
        if (inc.checklists.samuDispatched) doneActions.push("SAMU acionado");
        if (inc.checklists.bombeirosDispatched) doneActions.push("Bombeiros acionados");
        if (inc.checklists.prfNotified) doneActions.push("PRF notificada");
        if (inc.checklists.evidencePreserved) doneActions.push("evidências preservadas");
        
        if (doneActions.length > 0) {
          details = `Status atual da ocorrência: As seguintes ações já foram concluídas: ${doneActions.join(', ')}.`;
        } else {
          details = `Notificação sobre a ocorrência ${inc.id}. Aguardando mais atualizações de campo.`;
        }
      }
    }

    if (action === 'NOTIFICAR') {
      details = `Modalidade: ${modality === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'} | Contato: ${contact}\n${details}`;
    } else if (contact) {
      details = `Contato: ${contact}\n${details}`;
    }

    if (!appState.goldenHourTasks) appState.goldenHourTasks = [];
    appState.goldenHourTasks.push({
        id: 't_' + Date.now(),
        action, target, details, contact, modality, completed: false
      });

    this.renderGoldenHourCards();
    this.closeNewCommunicationModal();
  },

  async loadStates() {
    try {
      const states = [
        { sigla: "AC", nome: "Acre" }, { sigla: "AL", nome: "Alagoas" }, { sigla: "AP", nome: "Amapá" },
        { sigla: "AM", nome: "Amazonas" }, { sigla: "BA", nome: "Bahia" }, { sigla: "CE", nome: "Ceará" },
        { sigla: "DF", nome: "Distrito Federal" }, { sigla: "ES", nome: "Espírito Santo" }, { sigla: "GO", nome: "Goiás" },
        { sigla: "MA", nome: "Maranhão" }, { sigla: "MT", nome: "Mato Grosso" }, { sigla: "MS", nome: "Mato Grosso do Sul" },
        { sigla: "MG", nome: "Minas Gerais" }, { sigla: "PA", nome: "Pará" }, { sigla: "PB", nome: "Paraíba" },
        { sigla: "PR", nome: "Paraná" }, { sigla: "PE", nome: "Pernambuco" }, { sigla: "PI", nome: "Piauí" },
        { sigla: "RJ", nome: "Rio de Janeiro" }, { sigla: "RN", nome: "Rio Grande do Norte" }, { sigla: "RS", nome: "Rio Grande do Sul" },
        { sigla: "RO", nome: "Rondônia" }, { sigla: "RR", nome: "Roraima" }, { sigla: "SC", nome: "Santa Catarina" },
        { sigla: "SP", nome: "São Paulo" }, { sigla: "SE", nome: "Sergipe" }, { sigla: "TO", nome: "Tocantins" }
      ];
      
      const populateSelect = (id) => {
        const select = document.getElementById(id);
        if(!select) return;
        select.innerHTML = '<option value="">Selecione o Estado</option>';
        states.forEach(st => {
          const opt = document.createElement('option');
          opt.value = st.sigla;
          opt.textContent = st.nome;
          select.appendChild(opt);
        });
      };
      
      populateSelect('plan-origin-state');
      populateSelect('plan-dest-state');
      populateSelect('inc-state');
    } catch (e) {
      console.error("Erro ao carregar estados", e);
    }
  },

  async loadCities(stateSelectId, citySelectId) {
    const stateSigla = document.getElementById(stateSelectId).value;
    const citySelect = document.getElementById(citySelectId);
    
    citySelect.innerHTML = '<option value="">Selecione a Cidade</option>';
    
    if (!stateSigla) {
      citySelect.disabled = true;
      return;
    }
    
    citySelect.disabled = false;
    citySelect.innerHTML = '<option value="">Carregando...</option>';
    
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateSigla}/municipios?orderBy=nome`);
      const cities = await response.json();
      
      citySelect.innerHTML = '<option value="">Selecione a Cidade</option>';
      cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city.nome;
        opt.textContent = city.nome;
        citySelect.appendChild(opt);
      });
    } catch (e) {
      console.error("Erro ao carregar cidades do IBGE", e);
      citySelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  },


  loginMode: 'login', // 'login' or 'cadastro'

  toggleLoginMode(mode) {
    this.loginMode = mode;
    const tabLogin = document.getElementById('tab-btn-login');
    const tabCadastro = document.getElementById('tab-btn-cadastro');
    const fields = document.getElementById('cadastro-fields');
    const btnText = document.getElementById('btn-action-text');
    const loginIdInput = document.getElementById('login-id');

    if (mode === 'login') {
      tabLogin.className = 'flex-1 py-2 text-sm font-bold text-white bg-slate-800 rounded-lg transition-all';
      tabCadastro.className = 'flex-1 py-2 text-sm font-bold text-slate-500 hover:text-white transition-all';
      fields.classList.add('hidden');
      if(btnText) btnText.textContent = 'Entrar';
      if(loginIdInput) {
        loginIdInput.value = '';
        loginIdInput.removeAttribute('readonly');
        loginIdInput.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    } else {
      tabCadastro.className = 'flex-1 py-2 text-sm font-bold text-white bg-slate-800 rounded-lg transition-all';
      tabLogin.className = 'flex-1 py-2 text-sm font-bold text-slate-500 hover:text-white transition-all';
      fields.classList.remove('hidden');
      if(btnText) btnText.textContent = 'Cadastrar';
      if(loginIdInput) {
        loginIdInput.value = 'GNR-' + Math.floor(Math.random() * 90000 + 10000);
        loginIdInput.setAttribute('readonly', 'true');
        loginIdInput.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  },

  login() {
    const id = document.getElementById('login-id').value;
    if (!id) {
        this.showToast('Preencha o ID do Usuário!');
        return;
    }
    
    // Obter banco de usuários ou criar
    let usersDb = JSON.parse(localStorage.getItem('general_users_db') || '{}');

    if (this.loginMode === 'login') {
        if (usersDb[id]) {
            appState.currentUser = usersDb[id];
            localStorage.setItem('general_user', JSON.stringify(appState.currentUser));
            this.checkAuth();
        } else {
            const legacyUserJson = localStorage.getItem('general_user');
            if (legacyUserJson) {
                const legacyUser = JSON.parse(legacyUserJson);
                usersDb[id] = legacyUser;
                appState.currentUser = legacyUser;
                localStorage.setItem('general_users_db', JSON.stringify(usersDb));
                this.checkAuth();
            } else {
                // Auto-cadastro rápido para evitar bloqueio durante os testes
                const defaultUser = { id: id, name: 'Usuário Teste (' + id + ')', company: 'Empresa Teste', role: 'Gestor', provider: 'manual' };
                usersDb[id] = defaultUser;
                appState.currentUser = defaultUser;
                localStorage.setItem('general_users_db', JSON.stringify(usersDb));
                localStorage.setItem('general_user', JSON.stringify(defaultUser));
                this.showToast('Usuário não encontrado. Autocadastro rápido realizado para testes.');
                this.checkAuth();
            }
        }
    } else {
        const name = document.getElementById('login-name').value;
        const company = document.getElementById('login-company').value;
        const role = document.getElementById('login-role').value;
        const cnpj = document.getElementById('login-cnpj') ? document.getElementById('login-cnpj').value : '';
        
        if (name && company && role) {
          appState.currentUser = { id, name, company, role, companyCnpj: cnpj, provider: 'manual' };
          usersDb[id] = appState.currentUser;
          localStorage.setItem('general_users_db', JSON.stringify(usersDb));
          localStorage.setItem('general_user', JSON.stringify(appState.currentUser));
          
          if (window.db) {
             window.db.collection('users').doc(id).set(appState.currentUser).catch(e => console.error(e));
          }
          
          this.checkAuth();
        } else {
          this.showToast('Por favor, preencha todos os campos!');
        }
    }
  },

  async loginWithGoogle() {
    try {
      this.showToast('Abrindo contas do Google...');
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;
      
      const googleUser = {
        id: 'GOOG-' + (user.uid),
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        provider: 'google',
        photo: user.photoURL || null
      };

      // Check if user exists in Firestore
      const docSnap = await window.db.collection('users').doc(user.email).get();
      if (docSnap.exists) {
          const data = docSnap.data();
          if (data.companyCnpj) {
              googleUser.company = data.company;
              googleUser.companyCnpj = data.companyCnpj;
              googleUser.role = data.role;
              
              appState.currentUser = googleUser;
              localStorage.setItem('general_user', JSON.stringify(googleUser));
              this.checkAuth();
              this.showToast(`🔑 Bem-vindo(a) de volta, ${googleUser.name}!`);
              return;
          }
      }

      // If not, ask for extra info
      window.tempGoogleUser = googleUser;
      const modal = document.getElementById('google-extra-modal');
      if (modal) {
         modal.classList.remove('hidden');
         if(window.lucide) window.lucide.createIcons();
      } else {
         appState.currentUser = googleUser;
         localStorage.setItem('general_user', JSON.stringify(googleUser));
         this.checkAuth();
      }
    } catch (e) {
      console.error(e);
      let msg = 'Erro ao logar com Google.';
      if (e.code === 'auth/popup-blocked') msg = 'Pop-up bloqueado pelo navegador. Por favor, permita pop-ups e tente novamente.';
      else if (e.code === 'auth/unauthorized-domain') msg = 'Este domínio não está autorizado no Firebase. Configure no Firebase Console.';
      else if (e.message) msg = 'Erro: ' + e.message;
      this.showToast(msg, 'error');
      alert(msg); // Fallback alert in case toast fails
    }
  },

  loadDriverEvaluations() {
    if (!appState.currentUser || !appState.currentUser.companyCnpj) {
        this.showToast('Você precisa configurar o CNPJ da empresa no seu perfil para ver os motoristas.', 'warning');
        return;
    }
    
    const container = document.getElementById('driver-evaluation-list');
    if (!container) return;
    
    container.innerHTML = '<div class="text-slate-400 text-sm italic col-span-full">Carregando motoristas...</div>';
    
    if (window.db) {
        window.db.collection('users')
            .where('role', '==', 'motorista')
            .where('companyCnpj', '==', appState.currentUser.companyCnpj)
            .get()
            .then(snap => {
                if (snap.empty) {
                    container.innerHTML = '<div class="text-slate-400 text-sm italic col-span-full">Nenhum motorista encontrado para o CNPJ ' + appState.currentUser.companyCnpj + '.</div>';
                    return;
                }
                
                let html = '';
                snap.forEach(doc => {
                    const data = doc.data();
                    html += `
                    <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <h4 class="text-white font-bold text-sm">${data.name || 'Sem Nome'}</h4>
                                <span class="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full">${data.xp || 0} XP</span>
                            </div>
                            <p class="text-xs text-slate-400 mb-1"><i data-lucide="credit-card" class="w-3 h-3 inline"></i> CPF: ${data.cpf || 'Não informado'}</p>
                            <p class="text-[10px] text-slate-500 mb-3">ID: ${data.id}</p>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="if(window.App) App.sendRewardXP('${data.name}', this)" class="flex-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-600/30 text-xs font-bold py-2 rounded-xl transition-all" title="Recompensar XP">
                                +50 XP
                            </button>
                            <button onclick="if(window.App) App.showToast('Avaliação gravada com sucesso!')" class="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/30 text-xs font-bold py-2 rounded-xl transition-all">
                                <i data-lucide="star" class="w-3 h-3 inline"></i> 5 Estrelas
                            </button>
                        </div>
                    </div>
                    `;
                });
                container.innerHTML = html;
                if (window.lucide) window.lucide.createIcons();
            })
            .catch(e => {
                console.error("Erro ao carregar motoristas:", e);
                container.innerHTML = '<div class="text-red-400 text-sm italic col-span-full">Erro ao carregar motoristas.</div>';
            });
    }
  },
  
  sendRewardXP(driverName, btnElement) {
    if (btnElement) {
       btnElement.disabled = true;
       btnElement.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
       btnElement.classList.replace('bg-indigo-600', 'bg-slate-700');
       btnElement.classList.replace('hover:bg-indigo-500', 'bg-slate-700');
       if(window.lucide) window.lucide.createIcons();
    }
    this.showToast('Recompensa de +50 XP enviada com sucesso para ' + driverName + '!');
    if (window.db) {
       window.db.collection('users')
           .where('name', '==', driverName)
           .where('role', '==', 'motorista')
           .get()
           .then(snap => {
               if (!snap.empty) {
                   snap.forEach(doc => {
                       let xp = doc.data().xp || 0;
                       doc.ref.update({ xp: xp + 50 });
                   });
               }
           })
           .catch(e => console.error("Erro ao enviar recompensa:", e));
    }
  },

  logout() {
    if (confirm('Deseja realmente sair da sua conta no GENERAL?')) {
      localStorage.removeItem('general_user');
      appState.currentUser = null;
      document.getElementById('login-overlay').classList.remove('hidden');
      this.showToast('ðŸšª Você saiu da sua conta com sucesso.');
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    if (['investigation', 'dossier', 'reverse-logistics'].includes(tabId)) { this.populateIncidentSelectors(); }
    if (tabId === 'cargo-catalog') { this.renderCargoCatalog(); }
    if (tabId === 'indicators') { this.renderIndicatorsTab(); }
    
    // Update navigation styles
    document.querySelectorAll('.nav-button').forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
        btn.classList.remove('text-slate-400', 'hover:bg-slate-800', 'hover:text-slate-200');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
        btn.classList.add('text-slate-400', 'hover:bg-slate-800', 'hover:text-slate-200');
      }
    });

    // Update mobile bottom nav active styles
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Show selected container
    document.querySelectorAll('.tab-view').forEach(view => {
      if (view.id === `view-${tabId}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });

    // Refresh components
    if (tabId === 'dashboard') {
      setTimeout(() => {
        if (typeof mapController !== 'undefined' && mapController.map) {
          mapController.invalidateSize();
          const cur = appState.getCurrentIncident();
          if (cur) mapController.map.panTo([cur.lat, cur.lng]);
        }
      }, 150);
    } else if (tabId === 'planner') {
      const riskGauge = document.getElementById('plan-risk-gauge');
      if (riskGauge) riskGauge.style.width = '0%';
      this.renderMarketplace();
    } else if (tabId === 'predictive') {
      this.renderPredictiveTab();
    } else if (tabId === 'ai-plan') {
      this.renderActionPlanView();
      this.renderAIPlanTab();
    } else if (tabId === 'investigation') {
      this.renderInvestigationTab();
    } else if (tabId === 'dossier') {
      this.renderDossierTab();
    } else if (tabId === 'hazmat') {
      const select = document.getElementById('hazmat-incident-select');
      if (select) {
        const activeIncidents = appState.incidents.filter(inc => inc.status !== 'Concluída');
        select.innerHTML = '<option value="">Nenhuma ocorrência selecionada...</option>' + 
          activeIncidents.map(inc => `<option value="${inc.id}">${inc.id} - ${inc.cargo} (R$ ${inc.value})</option>`).join('');
        
        const current = appState.getCurrentIncident();
        if (current && current.status !== 'Concluída') {
          select.value = current.id;
        }
      }
    } else if (tabId === 'transshipment') {
      this.renderTransshipmentTab();
    } else if (tabId === 'docs') {
      this.renderDocsTab();
    } else if (tabId === 'history') {
      this.renderHistoryTab();
    } else if (tabId === 'saved-plans') {
      this.renderSavedPlansTab();
    } else if (tabId === 'copilot') {
      this.renderCopilotTab();
    } else if (tabId === 'risk-dashboard') {
      this.renderRiskDashboard();
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Atualiza o assistente Copilot com base na aba atual
    if (this.updateCopilotHelper) {
      this.updateCopilotHelper(tabId);
    }
  },

  updateCopilotHelper(tabId) {
    const helper = document.getElementById('floating-copilot-helper');
    const textEl = document.getElementById('copilot-helper-text');
    const btnNext = document.getElementById('copilot-helper-btn');
    const btnNextText = document.getElementById('copilot-helper-btn-text');
    const nextStepDiv = document.getElementById('copilot-helper-next-step');
    
    if (!helper || !textEl) return;
    
    // Verifica se o usuário desativou manualmente o balão
    if (localStorage.getItem('disable_copilot_helper') === 'true') {
      helper.classList.add('hidden');
      return;
    }
    
    // Verifica se a tela de login está aberta
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay && !loginOverlay.classList.contains('hidden')) {
      helper.classList.add('hidden');
      return;
    }

    // Remove os destaques anteriores
    document.querySelectorAll('.nav-button').forEach(btn => {
      btn.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2', 'ring-offset-slate-900', 'animate-pulse');
    });

    let msg = '';
    let highlightTab = null;
    let nextStepText = '';

    switch (tabId) {
      case 'dashboard':
        msg = '<strong class="text-white">Olá! Sou o GENERAL Copilot</strong>, seu assistente inteligente.<br>Vamos começar gerenciando as ocorrências ativas ou criando um novo registro.';
        highlightTab = 'dashboard';
        nextStepText = 'Ver Ocorrências';
        break;
      case 'wizard':
        msg = '<strong class="text-white">Passo 2:</strong> Preencha o Checklist da Golden Hour. Em seguida, avance para estruturar um Plano de Ação.';
        highlightTab = 'ai-plan';
        nextStepText = 'Criar Plano';
        break;
      case 'ai-plan':
        msg = '<strong class="text-white">Passo 3:</strong> Defina o Plano de Ação (Livre ou IA). Após aprovar o plano, vá para a aba de Transbordo se necessário.';
        highlightTab = 'transshipment';
        nextStepText = 'Abrir Transbordo';
        break;
      case 'transshipment':
        msg = '<strong class="text-white">Passo 4:</strong> Inicie o Transbordo e acompanhe o SLA. Se tudo estiver ok, podemos ir para a Causa Raiz.';
        highlightTab = 'investigation';
        nextStepText = 'Investigar Causa Raiz';
        break;
      case 'investigation':
        msg = '<strong class="text-white">Passo 5:</strong> Preencha os 5 porquês e Ishikawa. Ao finalizar a investigação, você pode gerar o Dossiê final.';
        highlightTab = 'dossier';
        nextStepText = 'Gerar Dossiê PDF';
        break;
      default:
        helper.classList.add('hidden');
        return;
    }
    
    // Re-exibe se estava oculto
    helper.classList.remove('hidden');
    textEl.innerHTML = msg;
    
    if (btnNext && btnNextText && nextStepDiv && highlightTab) {
      btnNextText.textContent = nextStepText;
      btnNext.setAttribute('onclick', `App.switchTab('${highlightTab}')`);
      nextStepDiv.classList.remove('hidden');
      nextStepDiv.classList.add('flex');
    }
    
    // Destaca a PRÓXIMA aba recomendada
    if (highlightTab) {
      const btn = document.querySelector(`.nav-button[data-tab="${highlightTab}"]`);
      if (btn) {
        btn.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2', 'ring-offset-slate-900', 'animate-pulse');
      }
    }
  },

  /* =======================================================
   * TRANSBORDO & SALVAMENTO
   * ======================================================= */
  handleTransshipmentIncidentSelection(selectEl) {
    // Apenas mantém o valor selecionado, o botão Iniciar fará o resto
    const incId = selectEl?.value;
    if (incId) {
       appState.setCurrentIncident(incId);
    }
  },

  startTransshipment() {
    const select = document.getElementById('transshipment-incident-select');
    const incId = select?.value;
    const body = document.getElementById('transshipment-body');
    const container = document.getElementById('transshipment-action-plan-container');
    const content = document.getElementById('transshipment-action-plan-content');

    if (!incId) {
      this.showToast('Por favor, selecione uma ocorrência antes de iniciar.', 'warning');
      if (body) body.classList.add('hidden');
      return;
    }

    const inc = appState.incidents.find(i => i.id === incId);
    if (!inc) return;

    appState.setCurrentIncident(inc.id);
    if (body) body.classList.remove('hidden');

    if (inc.actionPlan) {
      if (container) container.classList.remove('hidden');
      if (content) {
        content.innerHTML = inc.actionPlan.split('\n').map(l => {
          if (l.trim().startsWith('-')) return `<div class="ml-4 flex items-start gap-2 mb-1"><span class="text-emerald-400 mt-1">â€¢</span><span>${l.substring(1)}</span></div>`;
          if (l.match(/^[0-9]+\./)) return `<h4 class="font-bold text-white mt-4 mb-2 text-sm">${l}</h4>`;
          if (l.trim() === '') return '<br>';
          return `<p class="mb-1">${l}</p>`;
        }).join('');
      }
    } else {
      if (container) container.classList.add('hidden');
    }
    this.showToast(`Iniciando Transbordo e Resgate para ${inc.id}`);
    
    // Refresh SLA
    this.updateTransshipmentSLATimer();
  },
  renderTransshipmentTab() {
    const select = document.getElementById('transshipment-incident-select');
    if (select) {
      const activeIncidents = appState.incidents.filter(inc => inc.status !== 'CONCLUIDA');
      select.innerHTML = '<option value="">Nenhuma ocorrência selecionada...</option>' + 
        activeIncidents.map(inc => `<option value="${inc.id}">${inc.id} - ${inc.cargoDescription || inc.cargoType} (R$ ${inc.cargoValue || 0})</option>`).join('');
      
      const current = appState.getCurrentIncident();
      if (current && current.status !== 'CONCLUIDA') {
        select.value = current.id;
      } else {
        document.getElementById('transshipment-body')?.classList.add('hidden');
      }
    }
    
    const inc = appState.getCurrentIncident();
    if (!inc) return;

    // 1. Restore saved form values if they exist
    if (inc.transshipmentForm) {
      const form = inc.transshipmentForm;
      const inputs = [
        'ts-cargo-percent', 'ts-cargo-value', 'ts-operation-cost', 'ts-net-savings', 'ts-time', 'ts-base-location', 'ts-driver-name', 'ts-driver-plate', 'ts-driver-phone', 'ts-sub-name', 'ts-sub-address', 'ts-sub-cnh', 'ts-sub-phone', 'ts-rescue-type', 'ts-subplan-route', 'ts-subplan-deadline', 'ts-subplan-client', 'ts-tracking-link',
        'tc-modality', 'tc-model', 'tc-plate', 'tc-driver', 'tc-route', 'tc-client-contact', 'tc-deadline', 'tc-tracking-link'
      ];
      
      inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el && form[id] !== undefined) {
          el.value = form[id];
        }
      });
    }

    // Exibe o Plano de Ação do PAAC
    const actionContentDiv = document.getElementById('transshipment-action-plan-content');
    const actionContainerDiv = document.getElementById('transshipment-action-plan-container');
    if (actionContentDiv && inc.logisticsPlan) {
      if (actionContainerDiv) actionContainerDiv.classList.remove('hidden');
      if (inc.logisticsPlan.actionPlanType === 'ia') {
        actionContentDiv.innerHTML = '<span class="text-cyan-400 font-bold"><i data-lucide="sparkles" class="w-4 h-4 inline"></i> IA Estratégica:</span> Baseado nos dados logísticos e tipo de carga, a IA recomenda:\n- Isolamento imediato do perímetro\n- Remoção com guindaste a partir do eixo traseiro\n- Retirada de óleo do tanque para prevenir ignição.';
      } else if (inc.logisticsPlan.actionPlanText) {
        actionContentDiv.textContent = inc.logisticsPlan.actionPlanText;
      } else {
        actionContentDiv.textContent = 'Plano de ação livre vazio.';
      }
    }

    // 4. Renderiza Checklist Dinâmico do Plano de Ação
    this.renderTransshipmentChecklistUI(inc);
    this.updateTransshipmentSLATimer();

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  getTransshipmentChecklistItems(inc) {
    if (!inc) return [];
    const planType = inc.logisticsPlan ? inc.logisticsPlan.actionPlanType : 'ia';
    
    if (planType === 'ia') {
      const aiPlan = typeof AICopilotEngine !== 'undefined' ? AICopilotEngine.generatePrescriptiveActionPlan(inc) : [];
      return aiPlan.map((act, idx) => ({
        key: `ai_act_${idx}`,
        label: `[${act.priority}] ${act.what}`,
        detail: `${act.who} - ${act.when}`
      }));
    } else {
      const text = (inc.logisticsPlan && inc.logisticsPlan.actionPlanText) ? inc.logisticsPlan.actionPlanText : '';
      if (!text.trim()) return [];
      
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      return lines.map((line, idx) => {
        let label = line.trim();
        if (label.startsWith('-')) label = label.substring(1).trim();
        return {
          key: `free_act_${idx}`,
          label: label,
          detail: 'Ação Manual do Plano Livre'
        };
      });
    }
  },

  renderTransshipmentChecklistUI(inc) {
    const itemsContainer = document.getElementById('transshipment-checklist-items');
    if (!itemsContainer) return;

    const checklist = inc.transshipmentChecklist || {};
    let items = this.getTransshipmentChecklistItems(inc);

    if (items.length === 0) {
      items = [{
        key: 'empty_plan',
        label: 'Nenhum plano de ação definido',
        detail: 'Volte na aba "Causa Raiz" (5W2H) e defina um Plano (IA ou Livre) para gerar o checklist operacional.'
      }];
    }

    const isPlaceHolder = items.length === 1 && items[0].key === 'empty_plan';
    const completed = isPlaceHolder ? 0 : items.filter(it => checklist[it.key] === true).length;
    const progress = isPlaceHolder || items.length === 0 ? 0 : Math.round((completed / items.length) * 100);

    // Update Progress Bar & Badge
    const badgeEl = document.getElementById('trans-checklist-badge');
    if (badgeEl) badgeEl.textContent = isPlaceHolder ? '0 / 0' : `${completed} / ${items.length}`;

    const progText = document.getElementById('trans-checklist-progress-text');
    if (progText) progText.textContent = `${progress}%`;

    const progBar = document.getElementById('trans-checklist-progress-bar');
    if (progBar) {
      progBar.style.width = `${progress}%`;
      progBar.className = `h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-400' : 'bg-blue-500'}`;
    }

    if (isPlaceHolder) {
      itemsContainer.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs border border-dashed border-slate-700 rounded-xl">${items[0].label}<br>${items[0].detail}</div>`;
    } else {
      // Render Items
      itemsContainer.innerHTML = items.map(it => `
        <div onclick="App.toggleTransshipmentChecklist('${it.key}')" class="p-2.5 rounded-xl border ${checklist[it.key] ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'} cursor-pointer transition-all flex items-start gap-2.5 select-none">
          <div class="w-5 h-5 rounded-md flex items-center justify-center border mt-0.5 ${checklist[it.key] ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700 bg-slate-900'}">
            ${checklist[it.key] ? 'âœ“' : ''}
          </div>
          <div class="flex-1">
            <div class="font-bold text-xs ${checklist[it.key] ? 'text-emerald-300' : 'text-white'}">${it.label}</div>
            <span class="text-[10px] text-slate-500">${it.detail}</span>
          </div>
        </div>
      `).join('');
    }

    // Update Authorization Button
    const authBtn = document.getElementById('trans-auth-btn');
    if (authBtn) {
      if (!isPlaceHolder && completed === items.length && items.length > 0) {
        authBtn.className = "w-full py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer animate-pulse";
        authBtn.innerHTML = '<i data-lucide="check-check" class="w-4 h-4"></i> AUTORIZAR INÍCIO DA OPERAÇÃƒO';
      } else {
        authBtn.className = "w-full py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 text-slate-500 cursor-not-allowed";
        authBtn.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i> COMPLETE O PLANO PARA LIBERAR';
      }
    }
  },

  toggleTransshipmentChecklist(key) {
    const inc = appState.getCurrentIncident();
    if (!inc) return;

    if (!inc.transshipmentChecklist) inc.transshipmentChecklist = {};

    inc.transshipmentChecklist[key] = !inc.transshipmentChecklist[key];
    appState.save();
    appState.playBeep('click');
    this.renderTransshipmentTab();
  },

  authorizeTransshipment() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;

    const checklist = inc.transshipmentChecklist || {};
    const items = this.getTransshipmentChecklistItems(inc);
    
    if (items.length === 0 || (items.length === 1 && items[0].key === 'empty_plan')) {
      this.showToast("Defina um Plano de Ação primeiro.");
      return;
    }

    const completed = items.filter(it => checklist[it.key] === true).length;

    if (completed < items.length) {
      this.showToast(`Preencha todos os ${items.length} passos do plano antes de liberar.`);
      return;
    }

    appState.addDispatchLog("Transbordo Seguro", "OPERAÇÃƒO AUTORIZADA", `TRB-${Date.now().toString().slice(-4)}`, inc.responsible);
    appState.toggleChecklist('transshipmentReady');
    this.showToast("Operação formalmente liberada com conformidade total do Plano de Ação!");
    this.renderTransshipmentTab();
  },

  updateTransshipmentSLATimer() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;

    const data = typeof TransshipmentModule !== 'undefined' ? TransshipmentModule.calculateRequirements(inc) : null;
    const countdownEl = document.getElementById('trans-sla-countdown');
    const badgeEl = document.getElementById('trans-sla-status-badge');
    const percentEl = document.getElementById('trans-sla-percent-text');
    const barEl = document.getElementById('trans-sla-progress-bar');
    if (!countdownEl || !data || !data.sla) return;

    const maxSeconds = (data.sla.slaLimitHours || 3) * 3600;
    const start = new Date(inc.slaStartTime || inc.createdAt || Date.now()).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - start) / 1000);
    const remaining = Math.max(0, maxSeconds - elapsed);

    const hrs = String(Math.floor(remaining / 3600)).padStart(2, '0');
    const mins = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0');
    const secs = String(remaining % 60).padStart(2, '0');

    countdownEl.textContent = `${hrs}:${mins}:${secs}`;

    const percent = Math.min(100, Math.round((elapsed / maxSeconds) * 100));
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (barEl) barEl.style.width = `${percent}%`;

    if (badgeEl) {
      if (remaining === 0) {
        badgeEl.textContent = "SLA EXPIRADO";
        badgeEl.className = "px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse";
        countdownEl.className = "text-4xl sm:text-5xl font-black text-rose-500 font-mono tracking-tight";
      } else if (remaining < 3600) {
        badgeEl.textContent = "SLA CRÍTICO (< 1 HORA)";
        badgeEl.className = "px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40";
        countdownEl.className = "text-4xl sm:text-5xl font-black text-amber-400 font-mono tracking-tight";
      } else {
        badgeEl.textContent = "NO PRAZO REGULATÓRIO";
        badgeEl.className = "px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
        countdownEl.className = "text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight";
      }
    }
  },

  saveTransshipmentForm() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;

    const inputs = [
      'ts-cargo-percent', 'ts-cargo-value', 'ts-operation-cost', 'ts-net-savings', 'ts-time', 'ts-base-location', 'ts-driver-name', 'ts-driver-plate', 'ts-driver-phone', 'ts-sub-name', 'ts-sub-address', 'ts-sub-cnh', 'ts-sub-phone', 'ts-rescue-type', 'ts-subplan-route', 'ts-subplan-deadline', 'ts-subplan-client', 'ts-tracking-link',
      'tc-modality', 'tc-model', 'tc-plate', 'tc-driver', 'tc-route', 'tc-client-contact', 'tc-deadline', 'tc-tracking-link'
    ];
    
    inc.transshipmentForm = {};
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        inc.transshipmentForm[id] = el.value;
      }
    });

    appState.save();
    this.showToast('Plano de Transbordo Salvo com Sucesso!', 'success');
  },

  sendRescueWhatsApp() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;
    
    const cargoPercent = document.getElementById('ts-cargo-percent')?.value || '0';
    const cargoValue = document.getElementById('ts-cargo-value')?.value || '0';
    
    const msg = `*Atualização de Resgate - Ocorrência ${inc.id}*\n\n` +
                `O processo de salvamento da carga foi concluído.\n` +
                `*Carga Salva:* ${cargoPercent}%\n` +
                `*Valor Salvo:* R$ ${cargoValue}\n\n` +
                `O valor salvo já está sendo levado para o destino com o transporte especializado.`;
                
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  },

  sendContinuityWhatsApp() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;

    const cargoPercent = document.getElementById('ts-cargo-percent')?.value || '0';
    const cargoValue = document.getElementById('ts-cargo-value')?.value || '0';
    const operationCost = document.getElementById('ts-operation-cost')?.value || '0';
    
    const newDeadline = document.getElementById('tc-deadline')?.value || '';
    const formattedDeadline = newDeadline ? new Date(newDeadline).toLocaleString('pt-BR') : 'A definir';
    const trackingLink = document.getElementById('tc-tracking-link')?.value || '';

    // Calculate loss if possible (assuming inc.cargoValue exists)
    let lossMsg = '';
    const origValStr = (inc.cargoValue || '').replace(/[^\d,]/g, '').replace(',', '.');
    const origVal = parseFloat(origValStr);
    const salvValStr = cargoValue.replace(/[^\d,]/g, '').replace(',', '.');
    const salvVal = parseFloat(salvValStr);
    
    if (!isNaN(origVal) && !isNaN(salvVal) && origVal > 0) {
      const loss = Math.max(0, origVal - salvVal);
      lossMsg = `*Perda Estimada:* R$ ${loss.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
    }

    const msg = `*Resumo Logístico - Continuamento do Transporte*\n` +
                `*Ocorrência:* ${inc.id}\n\n` +
                `Todo o processo de resgate foi finalizado com sucesso.\n` +
                `*Carga Salva:* ${cargoPercent}%\n` +
                `*Valor Salvo:* R$ ${cargoValue}\n` +
                `*Custo da Operação:* R$ ${operationCost}\n` +
                lossMsg + `\n` +
                `O produto continuará a viagem com o planejamento reajustado (pequena alteração de prazo).\n` +
                `*Novo Prazo de Entrega (ETA):* ${formattedDeadline}\n\n` +
                `Segue abaixo o link de rastreio para acompanhar o seu produto em tempo real:\n` +
                `${trackingLink}`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  },

  calculateNetSavings() {
    const percentEl = document.getElementById('ts-cargo-percent');
    const valueEl = document.getElementById('ts-cargo-value');
    const costEl = document.getElementById('ts-operation-cost');
    const netEl = document.getElementById('ts-net-savings');
    
    if (!percentEl || !valueEl || !costEl || !netEl) return;
    
    const percent = parseFloat(percentEl.value) || 0;
    const value = parseFloat(valueEl.value) || 0;
    const cost = parseFloat(costEl.value) || 0;
    
    const savedAmount = (value * (percent / 100)) - cost;
    netEl.value = Math.max(0, savedAmount).toFixed(2);
  },

  togglePlanType(type) {
    const btnIa = document.getElementById('btn-toggle-ia');
    const btnFree = document.getElementById('btn-toggle-free');
    const containerIa = document.getElementById('ai-plan-5w2h-container');
    const actionsIa = document.getElementById('ai-plan-actions');
    const containerFree = document.getElementById('free-plan-container');
    
    const inc = appState.getCurrentIncident();
    if (inc) {
      if (!inc.logisticsPlan) inc.logisticsPlan = {};
      inc.logisticsPlan.actionPlanType = type;
      appState.save();
    }
    
    if (type === 'ia') {
      btnIa.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 text-white shadow-md transition-all';
      btnFree.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-transparent text-slate-400 hover:text-white transition-all';
      containerIa.classList.remove('hidden');
      if(actionsIa) actionsIa.classList.remove('hidden');
      containerFree.classList.add('hidden');
    } else {
      btnFree.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 text-white shadow-md transition-all';
      btnIa.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-transparent text-slate-400 hover:text-white transition-all';
      containerIa.classList.add('hidden');
      if(actionsIa) actionsIa.classList.add('hidden');
      containerFree.classList.remove('hidden');
      
      const inc = appState.getCurrentIncident();
      if (inc && inc.freePlan) {
        document.getElementById('free-plan-editor').value = inc.freePlan;
      }
    }
  },

  saveFreePlan() {
    const container = document.getElementById('free-plan-container');
    const inputs = container ? container.querySelectorAll('input[type="text"]') : [];
    
    let html = '<div class="space-y-4 text-slate-800">';
    const phases = ['Fase 1: Ações Imediatas', 'Fase 2: Ações Estruturais de Prevenção', 'Fase 3: Conclusão e Avaliação'];
    let idx = 0;
    
    for (let i = 0; i < 3; i++) {
       html += `
         <div style="border-left: 4px solid #3b82f6; padding-left: 10px; margin-bottom: 15px;">
           <h4 style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">${phases[i]}</h4>
           <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px;">
             <tr>
               <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>O QUE:</strong> ${inputs[idx++]?.value || ''}</td>
               <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>POR QUE:</strong> ${inputs[idx++]?.value || ''}</td>
             </tr>
             <tr>
               <td style="border: 1px solid #cbd5e1; padding: 4px;" colspan="2"><strong>COMO:</strong> ${inputs[idx++]?.value || ''}</td>
             </tr>
             <tr>
               <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>QUEM:</strong> ${inputs[idx++]?.value || ''}</td>
               <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>ONDE:</strong> ${inputs[idx++]?.value || ''}</td>
             </tr>
             <tr>
               <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>QUANDO:</strong> ${inputs[idx++]?.value || ''}</td>
               <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>CUSTO:</strong> ${inputs[idx++]?.value || ''}</td>
             </tr>
           </table>
         </div>
       `;
    }
    html += '</div>';

    const inc = appState.getCurrentIncident();
    if (inc) {
      if (!inc.logisticsPlan) inc.logisticsPlan = {};
      inc.logisticsPlan.actionPlanType = 'livre';
      inc.logisticsPlan.actionPlanText = html;
      inc.actionPlanHTML = html;
      appState.save();
    }
    
    const aiContainer = document.getElementById('ai-plan-5w2h-container');
    if (aiContainer) {
       aiContainer.innerHTML = html;
    }
    
    this.showToast('Plano Estruturado Salvo com Sucesso!');
  },

  callSubstituteDriver() {
    const base = TransshipmentModule.SUPPORT_BASES[0];
    window.open(`tel:${base.driverPhone.replace(/\D/g, '')}`, '_self');
    this.showToast(`Discando para motorista substituto (${base.substituteDriver})...`);
  },

  msgSubstituteDriver() {
    const inc = appState.getCurrentIncident();
    const base = TransshipmentModule.SUPPORT_BASES[0];
    const text = encodeURIComponent(`ðŸš¨ *[ORDEM DE TRANSBORDO - GENERAL]* ðŸš¨
Prezado ${base.substituteDriver},
Veículo ${base.plate} acionado para transbordo urgente da ocorrência *${inc ? inc.id : 'PAAC'}*.
*Local:* ${inc ? inc.road : 'BR-116'} - ${inc ? inc.city : 'Serra'}
*Carga:* ${inc ? inc.cargoDescription : 'Combustível'}
Favor confirmar deslocamento da ${base.name}.`);
    window.open(`https://wa.me/55${base.driverPhone.replace(/\D/g, '')}?text=${text}`, '_blank');
  },

  /* =======================================================
   * SUBPLANO DE REDIRECIONAMENTO ESTRATÉGICO
   * ======================================================= */
  generateTrackingLink() {
    const linkDisplay = document.getElementById('tracking-link-display');
    const linkText = document.getElementById('tracking-link-text');
    
    if (linkDisplay && linkText) {
      // Simulate generating a unique tracking hash
      const hash = Math.random().toString(36).substring(2, 10).toUpperCase();
      linkText.textContent = `sys.log/${hash}`;
      linkDisplay.classList.remove('hidden');
      this.showToast(`Link de rastreabilidade gerado: sys.log/${hash}`);
    }
  },

  activateRedirectionPlan() {
    const route = document.getElementById('subplan-route')?.value;
    const deadline = document.getElementById('subplan-deadline')?.value;
    const contact = document.getElementById('subplan-contact')?.value;

    if (!route || !deadline) {
      this.showToast('Preencha a Nova Rota e o Novo Prazo para ativar o subplano.', true); // true could be for error, but let's just show it normally
      return;
    }

    let contactStatus = "Pendente";
    if (contact === 'notified') contactStatus = "Cliente Notificado";
    if (contact === 'renegotiated') contactStatus = "Prazo Renegociado";

    this.showToast(`Subplano Ativado! Rota: ${route} | Contato: ${contactStatus}`);
    
    // Reset/clear fields if desired, or leave them
    // document.getElementById('subplan-route').value = '';
    // document.getElementById('subplan-deadline').value = '';
  },

  /* =======================================================
   * PLANEJADOR LOGÍSTICO, AUDITORIA & AUTO-OTIMIZADOR POR IA
   * ======================================================= */
  getPlanFromInputs() {
    const isActionPlanIA = document.querySelector('input[name="plan-action-type"]:checked')?.value === 'ia';
    return {
      code: document.getElementById('plan-code')?.value || `PL-${Date.now().toString().slice(-4)}`,
      carrierName: document.getElementById('plan-carrier-name')?.value || '',
      carrierCnpj: document.getElementById('plan-carrier-cnpj')?.value || '',
      carrierPhone: document.getElementById('plan-carrier-phone')?.value || '',
      clientName: document.getElementById('plan-client-name')?.value || '',
      clientContact: document.getElementById('plan-client-contact')?.value || '',
      clientPhone: document.getElementById('plan-client-phone')?.value || '',
      clientNfe: document.getElementById('plan-client-nfe')?.value || '',
      cargoType: document.getElementById('plan-cargo-type')?.value || 'CARGA_GERAL',
      productName: document.getElementById('plan-product-name')?.value || '',
      onuCode: document.getElementById('plan-onu')?.value || '',
      origin: (() => {
        const city = document.getElementById('plan-origin-city')?.value;
        const state = document.getElementById('plan-origin-state')?.value;
        const ref = document.getElementById('plan-origin-ref')?.value;
        if (city && state) return `${ref ? ref + ' - ' : ''}${city}, ${state}`;
        if (state) return `${ref ? ref + ' - ' : ''}${state}`;
        if (ref) return ref;
        return '';
      })(),
      destination: (() => {
        const city = document.getElementById('plan-dest-city')?.value;
        const state = document.getElementById('plan-dest-state')?.value;
        const ref = document.getElementById('plan-dest-ref')?.value;
        if (city && state) return `${ref ? ref + ' - ' : ''}${city}, ${state}`;
        if (state) return `${ref ? ref + ' - ' : ''}${state}`;
        if (ref) return ref;
        return '';
      })(),
      distanceKm: Number(document.getElementById('plan-dist')?.value) || 0,
      plannedRoads: document.getElementById('plan-roads')?.value || '',
      departureTime: document.getElementById('plan-deptime')?.value || '',
      deliveryDeadline: document.getElementById('plan-deadline')?.value || '',
      driverName: document.getElementById('plan-driver')?.value || '',
      driverTenureDays: Number(document.getElementById('plan-tenure')?.value) || 730,
      driverRouteFamiliarity: document.getElementById('plan-fam')?.value || 'FREQUENTE',
      isAssignedRegularTruck: document.getElementById('plan-truck-fam')?.value === 'true',
      tankFillPercent: Number(document.getElementById('plan-tank-fill')?.value) || 100,
      driverMode: document.getElementById('plan-mode')?.value || 'SOLO',
      vehicleType: document.getElementById('plan-transport-mode')?.value || 'CAMINHAO',
      weatherForecast: this.currentWeather || {},
      volume: document.getElementById('plan-volume')?.value || '',
      actionPlanType: isActionPlanIA ? 'ia' : 'livre',
      actionPlanText: isActionPlanIA ? '' : (document.getElementById('plan-action-text')?.value || ''),
      hasIncident: false
    };
  },

  loadPlanPreset(index = 0) {
    const preset = LogisticsPlanner.DEFAULT_PLANS[index] || LogisticsPlanner.DEFAULT_PLANS[0];
    if (document.getElementById('plan-client-name')) document.getElementById('plan-client-name').value = preset.clientName;
if (document.getElementById('plan-driver-name') && preset.driverName) document.getElementById('plan-driver-name').value = preset.driverName;
if (document.getElementById('plan-driver-cpf') && preset.driverCpf) document.getElementById('plan-driver-cpf').value = preset.driverCpf;
if (document.getElementById('plan-driver-cnpj') && preset.driverCnpj) document.getElementById('plan-driver-cnpj').value = preset.driverCnpj;
    if (document.getElementById('plan-client-contact')) document.getElementById('plan-client-contact').value = preset.clientContact;
    if (document.getElementById('plan-client-phone')) document.getElementById('plan-client-phone').value = preset.clientPhone;
    if (document.getElementById('plan-client-nfe')) document.getElementById('plan-client-nfe').value = preset.clientNfe;
    if (document.getElementById('plan-cargo-type')) document.getElementById('plan-cargo-type').value = preset.cargoType;
    if (document.getElementById('plan-product-name')) document.getElementById('plan-product-name').value = preset.productName;
    if (document.getElementById('plan-onu')) document.getElementById('plan-onu').value = preset.onuCode;
    if (document.getElementById('plan-origin')) document.getElementById('plan-origin').value = preset.origin;
    if (document.getElementById('plan-dest')) document.getElementById('plan-dest').value = preset.destination;
    if (document.getElementById('plan-dist')) document.getElementById('plan-dist').value = preset.distanceKm;
    if (document.getElementById('plan-roads')) document.getElementById('plan-roads').value = preset.plannedRoads;
    if (document.getElementById('plan-deptime')) document.getElementById('plan-deptime').value = preset.departureTime;
    if (document.getElementById('plan-deadline')) document.getElementById('plan-deadline').value = preset.deliveryDeadline;
    if (document.getElementById('plan-driver')) document.getElementById('plan-driver').value = preset.driverName;
    if (document.getElementById('plan-tenure')) document.getElementById('plan-tenure').value = String(preset.driverTenureDays);
    if (document.getElementById('plan-fam')) document.getElementById('plan-fam').value = preset.driverRouteFamiliarity;
    if (document.getElementById('plan-truck-fam')) document.getElementById('plan-truck-fam').value = String(preset.isAssignedRegularTruck);
    if (document.getElementById('plan-tank-fill')) document.getElementById('plan-tank-fill').value = String(preset.tankFillPercent);

    // this.runLogisticsPlanAudit(); // A auditoria agora é apenas manual
    this.showToast(`Plano carregado.`);
  },

  async triggerPlanAnalysis() {
    const plan = this.getPlanFromInputs();
    if (!plan.origin || !plan.destination || !plan.vehicleType) {
      this.showToast('Preencha ao menos a Origem, Destino e Veículo antes de analisar.', 'warning');
      return;
    }
    
    this.showToast('Analisando plano e buscando dados da AWS Location e clima real...');
    
    // Process weather for origin and destination
    await this.fetchRealWeather(plan.origin, 'origem');
    await this.fetchRealWeather(plan.destination, 'destino');
    
    // AWS Location Service Integration
    try {
      if (window.LocationService) {
        // Geocodificação Origem
        const originRef = document.getElementById('plan-origin-ref').value;
        const originNeighb = document.getElementById('plan-origin-neighborhood')?.value;
        const originStr = originNeighb ? (originRef ? `${originRef}, ${originNeighb}` : originNeighb) : originRef;
        const originQuery = originStr ? `${originStr}, ${plan.origin}` : plan.origin;
        const originCoords = await window.LocationService.geocode(originQuery);
        
        // Geocodificação Destino
        const destRef = document.getElementById('plan-dest-ref').value;
        const destNeighb = document.getElementById('plan-dest-neighborhood')?.value;
        const destStr = destNeighb ? (destRef ? `${destRef}, ${destNeighb}` : destNeighb) : destRef;
        const destQuery = destStr ? `${destStr}, ${plan.destination}` : plan.destination;
        const destCoords = await window.LocationService.geocode(destQuery);
        
        if (!originCoords) {
          this.showToast(`AWS Geocode falhou para a Origem: ${originQuery}`, 'error');
          document.getElementById('plan-duration').value = "Falha no Geocode Origem";
          document.getElementById('plan-dist').value = "";
        }
        if (!destCoords) {
          this.showToast(`AWS Geocode falhou para o Destino: ${destQuery}`, 'error');
          document.getElementById('plan-duration').value = "Falha no Geocode Destino";
          document.getElementById('plan-dist').value = "";
        }

        if (originCoords && destCoords) {
          this.showToast('Geocodificação concluída. Calculando rota...', 'info');
          let routeData = await window.LocationService.calculateRoute(originCoords, destCoords);
          if (Array.isArray(routeData) && routeData.length > 0) routeData = routeData[0];
          
          if (routeData) {
            document.getElementById('plan-dist').value = Math.round(routeData.distanceKm);
            
            // Regra de Negócio (Previsão de Dias)
            const totalHours = routeData.durationSeconds / 3600;
            const predictedDays = Math.ceil(totalHours / 8);
            const formattedTime = `${Math.floor(totalHours)}h ${Math.round((totalHours % 1) * 60)}m`;
            
            const durationInput = document.getElementById('plan-duration');
            if (durationInput) {
              durationInput.value = `${formattedTime} (${predictedDays} dia${predictedDays > 1 ? 's' : ''} de viagem estimad${predictedDays > 1 ? 'os' : 'o'})`;
            }

            // Auto-preencher rodovias usando IA ou engine
            const roadsInput = document.getElementById('plan-roads');
            if (roadsInput && (!roadsInput.value || roadsInput.value.trim() === '')) {
              if (routeData.roads) {
                roadsInput.value = routeData.roads;
                this.showToast('Rodovias extraídas diretamente do traçado!', 'success');
              } else {
                roadsInput.value = "Identificando rodovias com IA...";
                const prompt = `Liste apenas os nomes/códigos das principais rodovias ou avenidas (ex: BR-116, SP-280, Av. Brasil) usadas na rota rodoviária mais comum entre ${originQuery} e ${destQuery}. Seja breve e retorne apenas as rodovias separadas por vírgula.`;
                GeminiService.callGemini(prompt).then(roads => {
                  roadsInput.value = roads.replace(/\*/g, '').trim();
                  this.showToast('Rodovias previstas identificadas pela IA.', 'info');
                }).catch(err => {
                  roadsInput.value = "";
                  console.error("Erro ao identificar rodovias:", err);
                });
              }
            }

            // RESTAURAR MAPA INTERATIVO NO PLANNER
            const mapContainer = document.getElementById('planner-map-container');
            if (mapContainer) {
              mapContainer.classList.remove('hidden');
              mapContainer.classList.add('flex');
              
              if (!window.plannerMapController) {
                window.plannerMapController = new GeneralMapController('planner-map');
                window.plannerMapController.init(originCoords[0], originCoords[1], 10);
              }
              
              if (routeData.geometry && routeData.geometry.length > 0) {
                window.plannerMapController.drawRoutes([routeData]);
              } else {
                // Se a AWS v2 não retornou geometria da perna, ou só queremos centralizar
                window.plannerMapController.updateMapLocation(originCoords[0], originCoords[1]);
              }
              window.plannerMapController.invalidateSize();
            }

            this.showToast(`Rota traçada via AWS! Distância: ${routeData.distanceKm.toFixed(1)} km | Previsão: ${predictedDays} dia(s)`, 'success');
          } else {
            // Tratamento especial para cidades sem interligação rodoviária (ex: Ilha de Marajó)
            this.showToast('AWS Location não encontrou uma rota rodoviária válida entre estes dois pontos.', 'warning');
            document.getElementById('plan-duration').value = "Sem Rota Terrestre Disponível";
            document.getElementById('plan-dist').value = "";
          }
        }
      } else {
        this.showToast('Módulo LocationService não carregado.', 'error');
      }
    } catch(err) {
      console.error('Erro AWS Location:', err);
      this.showToast('Erro ao processar rota na AWS Location.', 'error');
    }
    
    // O usuário solicitou que a IA audite automaticamente o plano logo após identificar as rotas
    this.runLogisticsPlanAudit();
    
    this.syncPredictiveFromCurrentPlan(false);
  },

  async fetchRealWeather(cityString, type) {
    if (!cityString) return;
    try {
      const cityPart = cityString.split(',')[0];
      const cityName = cityPart.includes(' - ') ? cityPart.split(' - ').pop().replace(/\s*\(.*\)\s*/, '').trim() : cityPart.replace(/\s*\(.*\)\s*/, '').trim();
      // 1. Geocodificação Open-Meteo
      const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=pt`);
      if (!geoResponse.ok) throw new Error('Falha na API de Geocodificação');
      const geoData = await geoResponse.json();
      
      if (!geoData.results || geoData.results.length === 0) {
        throw new Error('Cidade não encontrada no Geocoder');
      }
      
      const location = geoData.results[0];
      
      // 2. Clima Open-Meteo
      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
      if (!weatherResponse.ok) throw new Error('Falha na API de Clima Open-Meteo');
      const weatherData = await weatherResponse.json();
      
      const current = weatherData.current_weather;
      const daily = weatherData.daily;
      
      const wmoCodes = {
        0: 'Céu Limpo', 1: 'Maiormente Limpo', 2: 'Parcialmente Nublado', 3: 'Nublado',
        45: 'Névoa', 48: 'Névoa Gélida', 51: 'Chuvisco Leve', 53: 'Chuvisco Moderado', 55: 'Chuvisco Forte',
        56: 'Chuvisco Congelante Leve', 57: 'Chuvisco Congelante Forte', 61: 'Chuva Leve', 63: 'Chuva Moderada', 65: 'Chuva Forte',
        66: 'Chuva Congelante Leve', 67: 'Chuva Congelante Forte', 71: 'Neve Leve', 73: 'Neve Moderada', 75: 'Neve Forte',
        77: 'Grãos de Neve', 80: 'Pancadas de Chuva Leves', 81: 'Pancadas de Chuva Moderadas', 82: 'Pancadas de Chuva Fortes',
        85: 'Pancadas de Neve Leves', 86: 'Pancadas de Neve Fortes', 95: 'Tempestade', 96: 'Tempestade c/ Granizo Leve', 99: 'Tempestade c/ Granizo Forte'
      };
      
      const weatherDesc = wmoCodes[current.weathercode] || 'Desconhecido';
      const temp = current.temperature;
      const minTemp = daily.temperature_2m_min[0];
      const maxTemp = daily.temperature_2m_max[0];
      const precipChance = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : 'N/A';

      if (!this.currentWeather) this.currentWeather = {};
      this.currentWeather[type] = {
        desc: weatherDesc,
        temp: temp,
        min: minTemp,
        max: maxTemp,
        precip: precipChance
      };

      const weatherDiv = document.getElementById(`weather-${type}`);
      if (weatherDiv) {
        weatherDiv.innerHTML = `
          <div class="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <h4 id="weather-${type}-title" class="text-sm font-bold text-slate-200 mb-4">Previsão Real para ${location.name} (Fonte: Open-Meteo)</h4>
            <div class="flex items-center gap-6">
              <div class="flex flex-col items-center justify-center">
                <i data-lucide="cloud" class="w-12 h-12 text-blue-400"></i>
                <span class="text-2xl font-bold text-white mt-2">${temp}Â°C</span>
              </div>
              <div class="flex-1">
                <div class="text-sm text-slate-300 font-medium">${weatherDesc}</div>
                <div class="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                  <span>Min: ${minTemp}Â°</span>
                  <span>Max: ${maxTemp}Â°</span>
                  <span class="text-blue-400 flex items-center gap-1"><i data-lucide="droplets" class="w-3 h-3"></i> ${precipChance}%</span>
                </div>
              </div>
            </div>
          </div>
        `;
        lucide.createIcons();
      }
    } catch (err) {
      console.error(`Erro ao buscar clima para ${cityString}:`, err);
      const weatherDiv = document.getElementById(`weather-${type}`);
      if (weatherDiv) {
        weatherDiv.innerHTML = `
          <div class="bg-slate-900/50 p-4 rounded-xl border border-rose-500/30 text-rose-400">
            <h4 class="text-sm font-bold mb-2">Previsão Indisponível</h4>
            <p class="text-xs">Não foi possível carregar a previsão do tempo real para este local.</p>
          </div>
        `;
      }
    }
  },

  auditTimeout: null,

  async runLogisticsPlanAudit() {
    const plan = this.getPlanFromInputs();
    
    // Mostra estado de carregamento imediatamente
    const scoreNum = document.getElementById('plan-score-num');
    if (scoreNum) scoreNum.innerHTML = '<i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-blue-500"></i>';
    if (window.lucide) lucide.createIcons();

    const statusEl = document.getElementById('plan-audit-status');
    if (statusEl) {
      statusEl.textContent = 'IA Analisando Plano...';
      statusEl.style.color = '#3b82f6'; // blue-500
    }

    const defectsBanner = document.getElementById('live-defects-banner');
    const defectsText = document.getElementById('live-defects-text');
    const defectsAction = document.getElementById('live-defects-action');
    const defectsTitle = document.getElementById('defects-banner-title');

    if (defectsBanner) {
       defectsBanner.className = 'bg-slate-900/50 border border-slate-700 p-4 rounded-2xl flex items-center justify-center';
       if(defectsText) defectsText.innerHTML = '<span class="text-slate-400 text-xs flex items-center gap-2"><i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Consultando Motor Preditivo (Gemini API)...</span>';
       if (window.lucide) lucide.createIcons();
    }

    // Limpa o timeout anterior para evitar múltiplas chamadas
    if (this.auditTimeout) {
      clearTimeout(this.auditTimeout);
    }

    // Define um novo timeout (Debounce de 1.5 segundos)
    this.auditTimeout = setTimeout(async () => {
      try {
        const audit = await LogisticsPlanner.auditPlan(plan);

        if (scoreNum) scoreNum.textContent = `${audit.safetyScore}%`;

        const scoreGlow = document.getElementById('plan-score-glow');
        if (scoreGlow) {
          scoreGlow.style.borderColor = audit.statusColor;
          scoreGlow.style.boxShadow = `0 0 35px -5px ${audit.statusColor}55`;
        }

        const badgeEl = document.getElementById('plan-audit-badge');
        if (badgeEl) {
          badgeEl.textContent = audit.safetyScore >= 75 ? 'SEGURO' : audit.safetyScore >= 50 ? 'RESTRIÇÃƒO' : 'CRÍTICO';
          badgeEl.className = `px-2.5 py-0.5 rounded-full text-xs font-bold ${audit.statusClass}`;
        }

        if (statusEl) {
          statusEl.textContent = audit.statusLabel;
          statusEl.style.color = audit.statusColor;
        }

        if (defectsBanner && defectsText) {
          if (audit.warnings.length > 0) {
            defectsBanner.classList.remove('hidden');
            defectsBanner.className = 'flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-r from-rose-950/90 via-red-950/70 to-slate-900 border border-rose-500/50 shadow-[0_0_20px_rgba(225,29,72,0.15)] animate-pulse';
            if (defectsTitle) defectsTitle.textContent = `${100 - audit.safetyScore} RISCO - ${audit.safetyScore >= 50 ? 'ALERTA' : 'CRÍTICO'}`;
            defectsText.innerHTML = audit.warnings.map(w => `<div class="flex items-start gap-1.5"><span class="text-rose-400 mt-1 text-[10px]">â—</span> <span><strong>${w.title}:</strong> ${w.description}</span></div>`).join('');
            if (defectsAction) defectsAction.innerHTML = "A IA recomenda reformular o cronograma de saída ou acionar a Correção Automática para mitigação.";
          } else {
            defectsBanner.className = 'bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3';
            defectsBanner.innerHTML = '<span class="text-xl">âœ¨</span><div class="text-emerald-200 text-sm"><strong>Nenhum defeito detectado!</strong> O plano está com segurança máxima para despacho.</div>';
          }
        }

        const warnContainer = document.getElementById('plan-warnings-container');
        if (warnContainer) {
          warnContainer.innerHTML = audit.warnings.map(w => `
            <div class="p-2.5 rounded-xl bg-slate-950 border border-rose-500/30 text-slate-300">
              <div class="flex items-center justify-between font-bold text-rose-400 text-xs mb-1">
                <span>âš ï¸ ${w.title}</span>
                <span class="font-mono text-[10px] text-rose-500">${w.penalty}</span>
              </div>
              <p class="text-[11px] text-slate-400 leading-snug">${w.description}</p>
            </div>
          `).join('') || '<p class="text-xs text-emerald-400">Nenhum perigo crítico detectado.</p>';
        }

        const prescContainer = document.getElementById('plan-prescriptions-container');
        if (prescContainer) {
          prescContainer.innerHTML = audit.prescriptions.map(p => `
            <div class="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-slate-300">
              <div class="font-bold text-cyan-300 text-xs mb-1">ðŸ’¡ ${p.action}</div>
              <p class="text-[11px] text-slate-300 leading-snug">${p.detail}</p>
            </div>
          `).join('') || '<p class="text-xs text-slate-500">Nenhum ajuste necessário.</p>';
        }
        
        this.renderMarketplace();
      } catch (err) {
        console.error("Erro na auditoria com Gemini", err);
        if (scoreNum) scoreNum.textContent = `ERR`;
      }
    }, 1500); // 1.5 seconds debounce
  },

  async runAWS_AIRouting() {
    const originCity = document.getElementById('plan-origin-city')?.value;
    const destCity = document.getElementById('plan-dest-city')?.value;
    const originState = document.getElementById('plan-origin-state')?.value || '';
    const destState = document.getElementById('plan-dest-state')?.value || '';
    const originRef = document.getElementById('plan-origin-ref')?.value || '';
    const destRef = document.getElementById('plan-dest-ref')?.value || '';
    
    if (!originCity || !destCity) {
      this.showToast('Informe a Origem (Cidade) e o Destino (Cidade) para ativar a previsão.', true);
      return;
    }
    
    this.showToast(`Buscando rota AWS e previsão do tempo: ${originCity} -> ${destCity}...`);
    
    // Process weather for origin and destination
    await this.fetchRealWeather(originCity, 'origem');
    await this.fetchRealWeather(destCity, 'destino');
    
    // AWS Location Service Integration
    try {
      if (window.LocationService) {
        // Query formatação: CEP, Cidade, Estado, Brasil
        const originNeighb = document.getElementById('plan-origin-neighborhood')?.value || '';
        const originStr = originNeighb ? (originRef ? `${originRef}, ${originNeighb}` : originNeighb) : originRef;
        const originQuery = originStr ? `${originStr}, ${originCity}, ${originState}, Brazil` : `${originCity}, ${originState}, Brazil`;
        const originCoords = await window.LocationService.geocode(originQuery);
        
        const destNeighb = document.getElementById('plan-dest-neighborhood')?.value || '';
        const destStr = destNeighb ? (destRef ? `${destRef}, ${destNeighb}` : destNeighb) : destRef;
        const destQuery = destStr ? `${destStr}, ${destCity}, ${destState}, Brazil` : `${destCity}, ${destState}, Brazil`;
        const destCoords = await window.LocationService.geocode(destQuery);
        
        if (!originCoords || !destCoords) {
          this.showToast(`AWS Geocode falhou (Revise os CEPs e Cidades).`, true);
          return;
        }

        let routeData = await window.LocationService.calculateRoute(originCoords, destCoords);
        if (Array.isArray(routeData) && routeData.length > 0) routeData = routeData[0];
        
        if (routeData) {
          document.getElementById('plan-dist').value = Math.round(routeData.distanceKm);
          
          const totalHours = routeData.durationSeconds / 3600;
          const predictedDays = Math.floor(totalHours / 8); // Assuming 8 hours of driving per day
          const remainingHours = Math.round(totalHours % 8);
          
          const durationInput = document.getElementById('plan-duration');
          if (durationInput) {
            let durText = '';
            if (predictedDays > 0) durText += `${predictedDays} dias `;
            if (remainingHours > 0 || predictedDays === 0) durText += `${remainingHours} horas`;
            durationInput.value = durText.trim();
          }

          // Atualizar Custo de Combustível
          this.simulateFuelCost();

          const mapContainer = document.getElementById('planner-map-container');
          if (mapContainer) {
            mapContainer.classList.remove('hidden');
            mapContainer.classList.add('flex');
            if (!window.plannerMapController) {
              window.plannerMapController = new GeneralMapController('planner-map');
              window.plannerMapController.init(originCoords[0], originCoords[1], 10);
            }
            if (routeData.geometry && routeData.geometry.length > 0) {
              window.plannerMapController.drawRoutes([routeData]);
            } else {
              window.plannerMapController.updateMapLocation(originCoords[0], originCoords[1]);
            }
            setTimeout(() => {
               window.plannerMapController.invalidateSize();
            }, 300);
          }
          this.showToast('Previsão AWS ativada e rota calculada com sucesso!');
        }
      } else {
        this.showToast('Módulo LocationService não carregado.', 'error');
      }
    } catch(err) {
      console.error('Erro AWS Location:', err);
      this.showToast('Erro ao processar rota na AWS Location.', 'error');
    }
  },

  calculateDeadline() {
    const deptimeInput = document.getElementById('plan-deptime')?.value;
    const durationInput = document.getElementById('plan-duration')?.value || '';
    const deadlineInput = document.getElementById('plan-deadline');
    
    if (!deptimeInput) {
      this.showToast('Informe o Horário Previsto de Saída primeiro.', true);
      return;
    }
    
    if (!deadlineInput) return;
    
    let days = 0;
    let hours = 0;
    
    const daysMatch = durationInput.match(/(\d+)\s*dias?/i);
    if (daysMatch) days = parseInt(daysMatch[1]);
    
    const hoursMatch = durationInput.match(/(\d+)\s*horas?/i);
    if (hoursMatch) hours = parseInt(hoursMatch[1]);
    
    if (days === 0 && hours === 0) {
       this.showToast('Formato de previsão inválido. Use "X dias Y horas".', true);
       return;
    }
    
    const depDate = new Date(deptimeInput);
    if (!isNaN(depDate.getTime())) {
      depDate.setDate(depDate.getDate() + days);
      depDate.setHours(depDate.getHours() + hours);
      const offset = depDate.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(depDate - offset)).toISOString().slice(0, 16);
      deadlineInput.value = localISOTime;
      this.showToast('Janela limite de entrega calculada.');
    } else {
      this.showToast('Data de saída inválida.', true);
    }
  },

  signTechnicalValidation() {
    const dateInput = document.getElementById('plan-tech-date');
    const statusContainer = document.getElementById('tech-validation-status');
    
    if (dateInput) {
      const now = new Date();
      dateInput.value = now.toLocaleString('pt-BR');
    }
    
    if (statusContainer) {
      statusContainer.innerHTML = `
        <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status Validação ANTT/MT:</span>
        <span class="text-xs font-bold text-emerald-400 flex items-center gap-1"><i data-lucide="check-circle" class="w-3 h-3"></i> Validado e Assinado Digitalmente</span>
      `;
      // Re-initialize lucide icons for the new check-circle
      if (window.lucide) {
        lucide.createIcons();
      }
    }
    this.showToast('Planejamento Assinado e Validado com Sucesso!');
    this.saveCurrentPlan(true); // Save plan automatically upon signing
  },

  saveCurrentPlan(isSigned) {
    const plan = this.getPlanFromInputs();
    if (!plan.code) {
      plan.code = 'LOG-' + Math.floor(Math.random() * 90000 + 10000);
      const codeInput = document.getElementById('plan-code');
      if (codeInput) codeInput.value = plan.code;
    }
    
    const savedPlan = {
      id: plan.code,
      type: 'LOGISTICO',
      date: new Date().toISOString(),
      client: plan.clientName || 'Cliente não informado',
      product: plan.productName || 'Produto não informado',
      origin: document.getElementById('plan-origin-city')?.options[document.getElementById('plan-origin-city')?.selectedIndex]?.text || 'Origem',
      destination: document.getElementById('plan-dest-city')?.options[document.getElementById('plan-dest-city')?.selectedIndex]?.text || 'Destino',
      isSigned: isSigned || false,
      data: plan
    };

    let savedPlans = JSON.parse(localStorage.getItem('general_saved_plans') || '[]');
    // Remove if exists
    savedPlans = savedPlans.filter(p => p.id !== savedPlan.id);
    savedPlans.push(savedPlan);
    localStorage.setItem('general_saved_plans', JSON.stringify(savedPlans));
        this.syncToFirebase();
    if (window.db) window.db.collection('saved_plans').doc(savedPlan.id).set(savedPlan).catch(e => console.error("Firebase sync err:", e));
    
    this.showToast('Plano salvo no banco de dados!');
    this.renderSavedPlansTab();
  },

  async reformulatePlanWithAI() {
    if (!appState.useAICredit()) {
      this.showToast('Créditos de IA esgotados. Contate o suporte para recarregar.', 'error');
      return;
    }

    const currentPlan = this.getPlanFromInputs();

    const modal = document.getElementById('ai-reformer-modal');
    const content = document.getElementById('ai-reformer-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    content.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 space-y-4">
        <i data-lucide="loader-2" class="w-12 h-12 text-blue-500 animate-spin"></i>
        <h3 class="text-lg font-bold text-white">IA Otimizando Plano de Viagem...</h3>
        <p class="text-slate-400 text-sm text-center">O Gemini está reformulando o plano logístico para anular os riscos e garantir Score 100.</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const currentAudit = await LogisticsPlanner.auditPlan(currentPlan);
    const result = await LogisticsPlanner.optimizePlanWithAI(currentPlan);
    this.currentOptimizedResult = result;

    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-rose-950/20 border border-rose-500/40 p-5 rounded-2xl space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-rose-400 uppercase tracking-wider">ANTES â€¢ Plano com Defeitos</span>
            <span class="px-2.5 py-0.5 rounded-full font-mono font-bold text-xs bg-rose-500/20 text-rose-400 border border-rose-500/40">
              Score: ${currentAudit.safetyScore}%
            </span>
          </div>
          <div class="space-y-2 text-xs text-slate-300">
            ${currentAudit.warnings.length > 0 
              ? currentAudit.warnings.map(w => `<div class="p-2 bg-slate-950/60 rounded-lg border-l-2 border-rose-500"><strong>${w.title}:</strong> ${w.description}</div>`).join('') 
              : '<div class="p-2 bg-slate-950/60 rounded-lg">Plano original sem defeitos estruturais graves detectados.</div>'}
          </div>
        </div>

        <div class="bg-emerald-950/30 border border-emerald-500/50 p-5 rounded-2xl space-y-3 shadow-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-4 h-4 text-emerald-400"></i>
              DEPOIS â€¢ Modelagem IA GENERAL
            </span>
            <span class="px-2.5 py-0.5 rounded-full font-mono font-black text-xs bg-emerald-500 text-slate-950 shadow-md">
              Score: 100% SEGURO
            </span>
          </div>
          <div class="space-y-2 text-xs text-slate-200">
            ${result.changesMade.length > 0 
              ? result.changesMade.map(c => `<div class="p-2 bg-slate-950/80 border border-emerald-500/30 rounded-lg border-l-2 border-emerald-500"><strong>${c.item}:</strong> ${c.after} <span class="text-[10px] text-emerald-400 font-bold ml-1">(${c.gain})</span></div>`).join('')
              : '<div class="p-2 bg-slate-950/80 border border-emerald-500/30 rounded-lg">Plano perfeitamente otimizado mantido.</div>'}
          </div>
        </div>
      </div>

      <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ajustes Realizados pela IA:</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          ${result.changesMade.map(c => `
            <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div>
                <span class="font-bold text-white block">${c.item}</span>
                <span class="text-[11px] text-slate-400">${c.before} âž” <strong class="text-emerald-400">${c.after}</strong></span>
              </div>
              <span class="font-bold text-emerald-400 font-mono text-xs">${c.gain}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /* =======================================================
   * MARKETPLACE DE TRANSPORTADORAS
   * ======================================================= */
  renderMarketplace() {
    const container = document.getElementById('marketplace-container');
    if (!container) return;
    
    const mode = document.getElementById('plan-transport-mode').value;
    
    const mockData = {
      CAMINHAO: [
        { name: "Frota Própria", model: "Veículo da Empresa", time: "Permanente", capacity: "Conforme Frota", rating: 5.0, icon: "truck" },
        { name: "Transportes São João", model: "Scania R450 6x2", time: "15 anos", capacity: "35 ton", rating: 4.8, icon: "truck" },
        { name: "Logística Alpha", model: "Volvo FH 540", time: "8 anos", capacity: "40 ton", rating: 4.5, icon: "truck" },
        { name: "Cargas Express", model: "Mercedes Actros", time: "5 anos", capacity: "32 ton", rating: 4.2, icon: "truck" }
      ],
      AVIAO: [
        { name: "AirCargo Brasil", model: "Boeing 737-800BCF", time: "22 anos", capacity: "23 ton", rating: 4.9, icon: "plane" },
        { name: "Voo Rápido Log", model: "Airbus A330F", time: "10 anos", capacity: "70 ton", rating: 4.7, icon: "plane" }
      ],
      NAVIO: [
        { name: "Navegação Oceânica", model: "Porta-Contêineres Panamax", time: "30 anos", capacity: "4.500 TEU", rating: 4.6, icon: "ship" },
        { name: "Marítima Log", model: "Navio Tanque Aframax", time: "18 anos", capacity: "120.000 ton", rating: 4.4, icon: "ship" }
      ],
      TREM: [
        { name: "Ferrovia Nacional", model: "Locomotiva AC44i (Composição 80 vagões)", time: "40 anos", capacity: "8.000 ton", rating: 4.5, icon: "train" },
        { name: "Sul Cargas Express", model: "Locomotiva SD70ACe", time: "12 anos", capacity: "6.500 ton", rating: 4.3, icon: "train" }
      ]
    };

    let customProviders = [];
    try {
      customProviders = JSON.parse(localStorage.getItem('general_custom_providers')) || [];
    } catch (e) {
      customProviders = [];
    }
    
    // Combine all mock data options regardless of mode
    const allMockData = [
      ...(mockData['CAMINHAO'] || []),
      ...(mockData['AVIAO'] || []),
      ...(mockData['NAVIO'] || []),
      ...(mockData['TREM'] || [])
    ];
    
    let companies = [...customProviders, ...allMockData];
    
    // Filtro de exclusão local
    let hiddenCarriers = [];
    try {
      hiddenCarriers = JSON.parse(localStorage.getItem('general_hidden_carriers')) || [];
    } catch(e) {}
    companies = companies.filter(c => !hiddenCarriers.includes(c.name));

    if (companies.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-500 col-span-full">Nenhuma transportadora disponível para este modal no momento.</p>`;
      return;
    }

    container.innerHTML = companies.map(c => `
      <div class="bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 transition-all flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <h4 class="font-bold text-white text-sm flex items-center gap-2">
              <i data-lucide="${c.icon || 'truck'}" class="w-4 h-4 text-slate-400"></i> ${c.name}
            </h4>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                <i data-lucide="star" class="w-3 h-3 fill-amber-400"></i> ${c.rating || '5.0'}
              </div>
              <button onclick="App.hideCarrier('${c.name}')" title="Excluir Transportadora" class="text-slate-500 hover:text-red-400 transition-colors p-1 bg-slate-900 rounded border border-slate-800">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
            </div>
          </div>
          <div class="space-y-1.5 text-[11px] text-slate-400 mb-4">
            <p><span class="font-semibold text-slate-300">Veículo:</span> ${c.model}</p>
            <p><span class="font-semibold text-slate-300">Capacidade:</span> ${c.capacity}</p>
            <p><span class="font-semibold text-slate-300">Tempo de Mercado:</span> ${c.time}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 mt-3">
          <button onclick="App.showToast('Nenhuma avaliação detalhada no momento', 'info')" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 flex items-center justify-center transition-all shadow-md" title="Exibir Avaliações">
            <i data-lucide="eye" class="w-4 h-4"></i>
          </button>
          <button onclick="App.selectProvider('${c.name}', ${c.rating || 5.0})" class="flex-1 bg-slate-800 hover:bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-md">
            Selecionar Parceiro
          </button>
        </div>
      </div>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  openNewProviderModal() {
    const modal = document.getElementById('new-provider-modal');
    if (modal) {
      document.getElementById('provider-name').value = '';
      document.getElementById('provider-model').value = '';
      document.getElementById('provider-capacity').value = '';
      document.getElementById('provider-time').value = '';
      modal.classList.remove('hidden');
    }
  },

  closeNewProviderModal() {
    const modal = document.getElementById('new-provider-modal');
    if (modal) modal.classList.add('hidden');
  },

  saveNewProvider() {
    const name = document.getElementById('provider-name').value.trim();
    const mode = document.getElementById('provider-mode').value;
    const model = document.getElementById('provider-model').value.trim();
    const capacity = document.getElementById('provider-capacity').value.trim();
    const time = document.getElementById('provider-time').value.trim();
    
    if (!name || !model) {
      this.showToast('Preencha os campos obrigatórios (Nome e Veículo).', 'error');
      return;
    }

    let customProviders = [];
    try {
      customProviders = JSON.parse(localStorage.getItem('general_custom_providers')) || [];
    } catch (e) {
      customProviders = [];
    }

    const icons = {
      'CAMINHAO': 'truck',
      'AVIAO': 'plane',
      'NAVIO': 'ship',
      'TREM': 'train'
    };

    customProviders.push({
      name,
      mode,
      model,
      capacity: capacity || 'N/A',
      time: time || 'Recente',
      rating: 5.0,
      icon: icons[mode] || 'truck'
    });

    localStorage.setItem('general_custom_providers', JSON.stringify(customProviders));
    this.showToast('Transportadora cadastrada com sucesso!', 'success');
    this.closeNewProviderModal();
    this.renderMarketplace();
  },

  /* =======================================================
   * APP RATING MODAL
   * ======================================================= */
  showAppRatingModal() {
    const modal = document.getElementById('app-rating-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  submitAppRating(stars) {
    this.showToast(`Obrigado pela sua avaliação de ${stars} estrela(s)!`, 'success');
    const modal = document.getElementById('app-rating-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  closeAIReformerModal() {
    const modal = document.getElementById('ai-reformer-modal');
    if (modal) modal.classList.add('hidden');
  },

  applyOptimizedPlan() {
    if (!this.currentOptimizedResult) return;
    const opt = this.currentOptimizedResult.optimizedPlan;

    if (document.getElementById('plan-deptime')) document.getElementById('plan-deptime').value = opt.departureTime;
    if (document.getElementById('plan-deadline')) document.getElementById('plan-deadline').value = opt.deliveryDeadline;
    if (document.getElementById('plan-tenure')) document.getElementById('plan-tenure').value = String(opt.driverTenureDays);
    if (document.getElementById('plan-fam')) document.getElementById('plan-fam').value = opt.driverRouteFamiliarity;
    if (document.getElementById('plan-truck-fam')) document.getElementById('plan-truck-fam').value = String(opt.isAssignedRegularTruck);
    if (document.getElementById('plan-tank-fill')) document.getElementById('plan-tank-fill').value = String(opt.tankFillPercent);

    this.closeAIReformerModal();
    // this.runLogisticsPlanAudit(); // A auditoria IA agora é apenas manual
    this.syncPredictiveFromCurrentPlan(false);
    this.showToast("Plano reformulado com sucesso! Score 100% Seguro aplicado.");
  },

  /* =======================================================
   * IA PREDITIVA (VINCULADA DINAMICAMENTE AO PLANO LOGÍSTICO)
   * ======================================================= */
  renderPredictiveTab() {
    const select = document.getElementById('pred-plan-select');
    if (select) {
      const savedPlans = JSON.parse(localStorage.getItem('GENERAL_PAAC_SAVED_PLANS') || '[]');
      const logPlans = savedPlans.filter(p => p.type === 'LOGISTICO');
      select.innerHTML = '<option value="">Selecione um Plano Logístico Aprovado...</option>' + 
        logPlans.map((p, idx) => `<option value="${idx}">${p.id || p.code} - ${p.clientName || (p.data && p.data.clientName) || 'Cliente N/A'} (${p.origin || (p.data && p.data.origin) || 'Origem N/A'} -> ${p.destination || (p.data && p.data.destination) || 'Destino N/A'})</option>`).join('');
    }
  },

  async runPredictiveAnalysis() {
    const select = document.getElementById('pred-plan-select');
    if (!select || select.value === '') {
      this.showToast('Selecione um plano logístico primeiro para rodar a análise.', 'warning');
      return;
    }

    if (!appState.useAICredit()) {
      this.showToast('Créditos de IA esgotados. Contate o suporte para recarregar.', 'error');
      return;
    }
    
    // Simulate AI loading delay
    this.showToast('Rodando motor de IA Preditiva na nuvem...', 'info');
    document.getElementById('pred-probability-num').innerHTML = '<i data-lucide="loader-2" class="w-10 h-10 animate-spin text-purple-500"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    setTimeout(async () => {
      try {
        await this.syncPredictiveFromSelectedPlan(true); // run analysis
        this.showToast('Análise preditiva de IA concluída.', 'success');
      } catch (err) {
        console.error('Erro na análise preditiva:', err);
        this.showToast('Falha na simulação de IA. Verifique sua conexão.', 'error');
        document.getElementById('pred-probability-num').innerHTML = 'ERRO';
      }
    }, 500);
  },

  async syncPredictiveFromSelectedPlan(runAnalysis = false) {
    const select = document.getElementById('pred-plan-select');
    const dashboard = document.getElementById('predictive-dashboard');
    if (!select || select.value === '') {
      this.showToast('Selecione um plano logístico.', 'warning');
      if (dashboard) dashboard.classList.add('hidden');
      return;
    }
    if (dashboard) dashboard.classList.remove('hidden');
    
    const savedPlans = JSON.parse(localStorage.getItem('GENERAL_PAAC_SAVED_PLANS') || '[]');
    let plan = savedPlans[select.value];
    if (!plan) return;

    // Se estiver rodando análise de IA, otimiza
    if (runAnalysis) {
      const result = await LogisticsPlanner.optimizePlanWithAI(plan);
      plan = result.optimizedPlan;
    }

    const forecast = AIPredictiveEngine.simulateFromLogisticsPlan(plan);

    // No banner de origem dos dados não tem mais o id pred-sync-plan-title.
    // Wait, the banner was removed in HTML earlier?
    // Let me check what is in index.html for the banner. It was replaced with the select element.
    // I don't need to update planTitleEl anymore because the dropdown select already shows the selected plan.
    
    this.simulationState.hours = forecast.planBinding.drivingHours;
    this.simulationState.speed = forecast.planBinding.speedKmH;
    this.simulationState.weather = forecast.planBinding.weather;
    this.simulationState.cargo = forecast.planBinding.cargoType;
    this.simulationState.isNightTime = forecast.planBinding.isNightTime;

    const sliderHours = document.getElementById('slider-hours');
    if (sliderHours) sliderHours.value = String(this.simulationState.hours);
    const valHours = document.getElementById('val-hours');
    if (valHours) valHours.textContent = `${this.simulationState.hours.toFixed(1)} horas`;

    const sliderSpeed = document.getElementById('slider-speed');
    if (sliderSpeed) sliderSpeed.value = String(this.simulationState.speed);
    const valSpeed = document.getElementById('val-speed');
    if (valSpeed) valSpeed.textContent = `${this.simulationState.speed} km/h (Média Requerida)`;

    const selectWeather = document.getElementById('select-weather');
    if (selectWeather) selectWeather.value = this.simulationState.weather;

    const selectCargo = document.getElementById('select-cargo');
    if (selectCargo) selectCargo.value = this.simulationState.cargo;

    const probEl = document.getElementById('pred-probability-num');
    if (probEl) probEl.textContent = `${forecast.probability}%`;

    const badgeEl = document.getElementById('pred-alert-badge');
    if (badgeEl) {
      badgeEl.textContent = forecast.alertLevel;
      badgeEl.className = `px-2.5 py-0.5 rounded-full text-xs font-bold ${forecast.badgeClass}`;
    }

    const failureEl = document.getElementById('pred-failure-mode');
    if (failureEl) failureEl.textContent = forecast.predictedFailureMode;

    const radarGlow = document.getElementById('pred-radar-glow');
    if (radarGlow) {
      radarGlow.style.borderColor = forecast.color;
      radarGlow.style.boxShadow = `0 0 35px -5px ${forecast.color}55`;
    }

    const actionsContainer = document.getElementById('pred-actions-container');
    if (actionsContainer) {
      actionsContainer.innerHTML = forecast.preventiveActions.map(act => `
        <div class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
          <span class="text-purple-400">ðŸ›¡ï¸</span>
          <span>${act}</span>
        </div>
      `).join('');
    }
  },

  updateSimulationParam(key, value) {
    if (key === 'hours') {
      this.simulationState.hours = Number(value);
      const el = document.getElementById('val-hours');
      if (el) el.textContent = `${value} horas`;
    } else if (key === 'speed') {
      this.simulationState.speed = Number(value);
      const el = document.getElementById('val-speed');
      if (el) el.textContent = `${value} km/h`;
    } else if (key === 'weather') {
      this.simulationState.weather = value;
    } else if (key === 'cargo') {
      this.simulationState.cargo = value;
    } else if (key === 'tenure') {
      this.simulationState.tenure = value;
    } else if (key === 'cargo-org') {
      this.simulationState.cargoOrg = value;
    }

    this.runPredictiveSimulation();
  },

  runPredictiveSimulation() {
    const forecast = AIPredictiveEngine.forecastRisk({
      drivingHours: this.simulationState.hours,
      speedKmH: this.simulationState.speed,
      speedLimit: this.simulationState.speedLimit,
      weather: this.simulationState.weather,
      cargoType: this.simulationState.cargo,
      driverTenure: this.simulationState.tenure,
      cargoOrg: this.simulationState.cargoOrg,
      isNightTime: this.simulationState.isNightTime
    });

    const probEl = document.getElementById('pred-probability-num');
    if (probEl) probEl.textContent = `${forecast.probability}%`;

    const badgeEl = document.getElementById('pred-alert-badge');
    if (badgeEl) {
      badgeEl.textContent = forecast.alertLevel;
      badgeEl.className = `px-2.5 py-0.5 rounded-full text-xs font-bold ${forecast.badgeClass}`;
    }

    const failureEl = document.getElementById('pred-failure-mode');
    if (failureEl) failureEl.textContent = forecast.predictedFailureMode;

    const radarGlow = document.getElementById('pred-radar-glow');
    if (radarGlow) {
      radarGlow.style.borderColor = forecast.color;
      radarGlow.style.boxShadow = `0 0 35px -5px ${forecast.color}55`;
    }

    const actionsContainer = document.getElementById('pred-actions-container');
    if (actionsContainer) {
      actionsContainer.innerHTML = forecast.preventiveActions.map(act => `
        <div class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
          <span class="text-purple-400">ðŸ›¡ï¸</span>
          <span>${act}</span>
        </div>
      `).join('');
    }
  },

  /* =======================================================
   * IA PRESCRITIVA (PLANO DE AÇÃƒO 5W2H)
   * ======================================================= */
  renderAIPlanTab(plan) {
    if (plan) this.currentAIPlan = plan;
    const planToRender = this.currentAIPlan;
    
    const inc = appState.getCurrentIncident();
    if (!inc || !planToRender) return;

    const container = document.getElementById('ai-plan-5w2h-container');
    if (!container) return;

    container.innerHTML = `
      <div class="grid grid-cols-1 gap-4">
        ${planToRender.map(item => `
          <div class="bg-slate-900/80 border ${item.completed ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'} rounded-2xl p-5 transition-all">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-3">
              <div class="flex items-center gap-3">
                <span class="px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${item.priority === 'CRÍTICA' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}">
                  ${item.id} â€¢ ${item.priority}
                </span>
                <span class="text-xs font-bold text-slate-400">${item.phase}</span>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="App.rateAIAction('${item.id}', 'EFICAZ')" title="Avaliar como Eficaz" class="px-2.5 py-1 bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold text-slate-300 transition-all">
                  ðŸ‘ Eficaz
                </button>
                <button onclick="App.rateAIAction('${item.id}', 'REAJUSTAR')" title="Sugerir Ajuste" class="px-2.5 py-1 bg-slate-800 hover:bg-amber-600 hover:text-white rounded-lg text-xs font-semibold text-slate-300 transition-all">
                  ðŸ‘Ž Reajustar
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs mb-4">
              <div class="bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                <span class="font-bold text-slate-400 uppercase text-[10px] block mb-1">O que fazer (What):</span>
                <p class="font-bold text-white leading-snug">${item.what}</p>
              </div>
              <div class="bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                <span class="font-bold text-slate-400 uppercase text-[10px] block mb-1">Por que (Why):</span>
                <p class="text-slate-300 leading-snug">${item.why}</p>
              </div>
              <div class="bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                <span class="font-bold text-slate-400 uppercase text-[10px] block mb-1">Quem & Onde (Who / Where):</span>
                <p class="font-semibold text-cyan-400">${item.who}</p>
                <p class="text-slate-400 text-[11px] mt-0.5">${item.where}</p>
              </div>
              <div class="bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                <span class="font-bold text-slate-400 uppercase text-[10px] block mb-1">Prazo & Custo (When / How Much):</span>
                <p class="font-bold text-amber-400">${item.when}</p>
                <p class="text-slate-400 text-[11px] mt-0.5">${item.howMuch}</p>
              </div>
            </div>

            <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="text-xs text-slate-300 leading-relaxed">
                <strong class="text-cyan-400">Instrução Técnica (How):</strong> ${item.how}
              </div>
              <button onclick="App.executeAIAction('${item.id}')" class="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold ${item.completed ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'} transition-all">
                ${item.completed ? 'âœ“ Concluído' : 'Executar Ação'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async regenerateAIPlan() {
    if (!appState.useAICredit()) {
      this.showToast('Créditos de IA esgotados. Contate o suporte para recarregar.', 'error');
      return;
    }

    let inc = appState.getCurrentIncident();
    if (!inc) {
      const select = document.getElementById('action-plan-link');
      if (select && select.value) {
        inc = {
          eventType: 'Falha Logística / Operacional',
          road: 'Rota do Plano',
          city: 'N/D',
          km: 'N/D',
          cargoType: 'SECA',
          vehicleId: 'N/D',
          driverName: 'Motorista do Plano',
          driverStatus: 'ILESO_CONSCIENTE',
          onuCode: '',
          responsible: 'Gestor',
          rca: { status: 'PENDENTE' },
          checklists: {}
        };
      } else {
        this.showToast("Nenhum plano ou incidente vinculado.", "warning");
        return;
      }
    }

    const fiveWhys = [
      document.getElementById('why-1')?.value || '',
      document.getElementById('why-2')?.value || '',
      document.getElementById('why-3')?.value || '',
      document.getElementById('why-4')?.value || '',
      document.getElementById('why-5')?.value || ''
    ];

    if (!fiveWhys[0]) {
      this.showToast("Preencha ao menos o 1Âº Porquê antes de gerar o plano.", "warning");
      return;
    }

    const container = document.getElementById('ai-plan-5w2h-container');
    if (container) {
      container.innerHTML = '<div class="flex flex-col justify-center items-center py-10"><i data-lucide="loader-2" class="w-10 h-10 animate-spin text-cyan-500 mb-4"></i><p class="text-slate-400 font-bold text-sm">Gerando Plano 5W2H com Inteligência Artificial...</p></div>';
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const plan = await AICopilotEngine.generatePrescriptiveActionPlan(inc, fiveWhys);
      
      // Store in memory so it can be saved upon approval
      this.currentAIPlan = plan;
      
      this.renderAIPlanTab(plan);
      if (window.lucide) window.lucide.createIcons();
      this.showToast("Plano de Ação 5W2H recalculado e atualizado pela IA!");
    } catch (e) {
      console.error(e);
      this.showToast("Falha ao gerar plano IA", "error");
      if (container) container.innerHTML = '<p class="text-rose-500 font-bold p-5">Erro ao gerar o plano. Tente novamente.</p>';
    }
  },

  executeAIAction(actionId) {
    const inc = appState.getCurrentIncident();
    if (!inc) return;

    if (actionId === 'ACT-01') appState.toggleChecklist('samuDispatched');
    else if (actionId === 'ACT-02' || actionId === 'ACT-04') appState.toggleChecklist('isolated');
    else if (actionId === 'ACT-03') appState.toggleChecklist('cetesbNotified');
    else if (actionId === 'ACT-05') appState.toggleChecklist('insurerNotified');
    else if (actionId === 'ACT-06') appState.toggleChecklist('transshipmentReady');

    this.showToast('Ação registrada na central!');
    // Não re-renderiza todo o plano de IA para não perder o que foi gerado em memória, apenas muda o UI.
    const btn = event.currentTarget;
    if (btn) {
      btn.classList.remove('bg-cyan-600', 'hover:bg-cyan-500', 'text-white');
      btn.classList.add('bg-emerald-600/30', 'text-emerald-300', 'border', 'border-emerald-500/50');
      btn.innerHTML = 'âœ“ Concluído';
    }
  },

  rateAIAction(actionId, rating) {
    this.showToast(`Avaliação de ação ${actionId} registrada: ${rating}`);
  },

  renderActionPlanView() {
    const inc = appState.getCurrentIncident();
    const select = document.getElementById('action-plan-link');
    const label = select?.previousElementSibling;
    
    if (inc) {
      if (label) label.textContent = 'Ocorrência Ativa Vinculada:';
      if (select) {
        select.innerHTML = `<option value="${inc.id}" selected>${inc.id} - ${inc.title}</option>`;
        select.disabled = true;
      }
      this.handlePlanLinkChange();
      return;
    }

    if (!select) return;
    if (label) label.textContent = 'Vincular a um Plano Logístico Aprovado:';
    select.disabled = false;

    let savedPlans = JSON.parse(localStorage.getItem('general_saved_plans') || '[]');
    let logPlans = savedPlans.filter(p => p.type === 'LOGISTICO');

    select.innerHTML = '<option value="">Selecione um plano logístico...</option>';
    logPlans.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      
        const cName = p.client || p.clientName || (p.data && p.data.clientName) || 'Cliente N/A';
        const orig = p.origin || (p.data && p.data.origin) || 'Origem N/A';
        const dest = p.destination || (p.data && p.data.destination) || 'Destino N/A';
        opt.textContent = `${p.id || p.code} - ${cName} (${orig} -> ${dest})`;

      select.appendChild(opt);
    });
    this.handlePlanLinkChange();
  },

  handlePlanLinkChange() {
    const inc = appState.getCurrentIncident();
    const select = document.getElementById('action-plan-link');
    const fiveWhys = document.getElementById('five-whys-container');
    
    if (inc || (select && select.value)) {
      fiveWhys.classList.remove('hidden');
    } else {
      fiveWhys.classList.add('hidden');
    }
  },

  approveActionPlan() {
    let inc = appState.getCurrentIncident();
    
    if (inc) {
      // Save directly to the incident
      inc.customPlan = this.currentAIPlan || [{
        id: "ACT-MANUAL",
        what: document.getElementById('free-plan-editor')?.value || 'Plano Livre inserido pelo Gestor',
        when: new Date().toLocaleDateString(),
        who: 'Gestor'
      }];
      
      appState.save();
      this.showToast('Plano de Ação Tático aprovado e salvo na ocorrência com sucesso!');
      
      // Update Dossier if it's the active tab, or just prepare it
      this.renderDossierTab();
      this.switchTab('dossier');
    } else {
      // Fallback for saved plans when there is no active incident
      const select = document.getElementById('action-plan-link');
      if (!select || !select.value) {
        this.showToast('Selecione um Plano Logístico ou ative uma Ocorrência primeiro!');
        return;
      }

      const planCode = 'ACAO-' + Math.floor(Math.random() * 90000 + 10000);
      const savedPlan = {
        id: planCode,
        type: 'ACAO',
        date: new Date().toISOString(),
        linkedLogisticsPlan: select.value,
        isSigned: true,
        data: {
          content: this.planType === 'ia' ? (document.getElementById('ai-plan-5w2h-container')?.innerHTML || '') : (document.getElementById('free-plan-editor')?.value || '')
        }
      };

      let savedPlans = JSON.parse(localStorage.getItem('general_saved_plans') || '[]');
      savedPlans.push(savedPlan);
      localStorage.setItem('general_saved_plans', JSON.stringify(savedPlans));
        this.syncToFirebase();
      if (window.db) window.db.collection('saved_plans').doc(savedPlan.id).set(savedPlan).catch(e => console.error("Firebase sync err:", e));
      
      this.showToast('Plano de Ação salvo de forma avulsa com sucesso!');
      this.renderSavedPlansTab();
      this.switchTab('saved-plans');
    }
  },

  togglePlanType(type) {
    this.planType = type;
    const btnIa = document.getElementById('btn-toggle-ia');
    const btnFree = document.getElementById('btn-toggle-free');
    const containerIa = document.getElementById('ai-plan-5w2h-container');
    const actionsIa = document.getElementById('ai-plan-actions');
    const containerFree = document.getElementById('free-plan-container');

    if (type === 'ia') {
      if (btnIa) btnIa.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 text-white shadow-md transition-all';
      if (btnFree) btnFree.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-transparent text-slate-400 hover:text-white transition-all';
      if (containerIa) containerIa.classList.remove('hidden');
      if (actionsIa) actionsIa.classList.remove('hidden');
      if (containerFree) containerFree.classList.add('hidden');
    } else {
      if (btnFree) btnFree.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 text-white shadow-md transition-all';
      if (btnIa) btnIa.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-transparent text-slate-400 hover:text-white transition-all';
      if (containerIa) containerIa.classList.add('hidden');
      if (actionsIa) actionsIa.classList.add('hidden');
      if (containerFree) containerFree.classList.remove('hidden');
    }
  },

  rateAIAction(actionId, rating) {
    AICopilotEngine.saveFeedback(actionId, 'EXECUTADA', rating);
    this.showToast(`Feedback registrado! A IA aprendeu com sua avaliação (${rating}).`);
  },

  /* =======================================================
   * AVISO AO CLIENTE (SINISTRO, PERÍCIA & ATRASO DE ENTREGA)
   * ======================================================= */
  openClientDelayNoticeModal() {
    const inc = appState.getCurrentIncident();
    const modal = document.getElementById('client-notice-modal');
    const content = document.getElementById('client-notice-content');
    if (!modal || !content || !inc) return;

    content.innerHTML = `
      <div class="bg-slate-950 p-4 rounded-xl border border-purple-500/30 space-y-3">
        <div class="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
          <span class="text-purple-300 font-bold">Destinatário: ${inc.carrier || 'Techline Brasil'} / Central do Cliente</span>
          <span class="font-mono text-slate-400">NF-e: ${inc.nfeNumber || '000.284.119'}</span>
        </div>
        <div class="text-xs font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
${NotificationHub.getTemplate('AVISO_CLIENTE_SINISTRO_ATRASO', inc)}
        </div>
      </div>
      <div class="text-xs text-slate-400 bg-slate-900 p-3 rounded-xl border border-slate-800">
        ðŸ’¡ <strong>Amparo Técnico:</strong> Este comunicado informa preventivamente o cliente de que a carga encontra-se em análise documental e pericial, justificando o atraso por força maior e preservando o relacionamento comercial.
      </div>
    `;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeClientDelayNoticeModal() {
    const modal = document.getElementById('client-notice-modal');
    if (modal) modal.classList.add('hidden');
  },

  /* =======================================================
   * FINALIZAÇÃƒO DE OCORRÃŠNCIA COM AUDITORIA PÓS-MORTEM
   * ======================================================= */
  async openFinishIncidentModal() {
    if (appState.currentUser && appState.currentUser.role !== 'Administrador Geral') {
      this.showToast('⚠️ Acesso Negado: Apenas Administrador Geral pode finalizar ocorrências (Cadeia de Comando).');
      return;
    }

    const inc = appState.getCurrentIncident();
    const modal = document.getElementById('finish-incident-modal');
    const content = document.getElementById('finish-incident-content');
    if (!modal || !content || !inc) return;

    modal.classList.remove('hidden');
    content.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 space-y-4">
        <i data-lucide="loader-2" class="w-12 h-12 text-emerald-500 animate-spin"></i>
        <h3 class="text-lg font-bold text-white">IA Gerando Auditoria Pós-Mortem...</h3>
        <p class="text-slate-400 text-sm text-center">Aguarde enquanto o Gemini avalia a resposta ao incidente e calcula o índice de eficiência.</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const postMortem = await AICopilotEngine.generatePostMortemAudit(inc);
    inc._tempPostMortemScore = postMortem.responseQualityScore;

    content.innerHTML = `
      <div class="bg-gradient-to-r from-slate-950 to-emerald-950/40 p-4 rounded-2xl border border-emerald-500/40 flex items-center justify-between">
        <div>
          <span class="text-xs text-emerald-400 font-bold uppercase tracking-wider">Índice de Resolução & Gestão de Crise</span>
          <h4 class="font-black text-white text-base mt-0.5">${postMortem.managementRating}</h4>
        </div>
        <div class="text-right">
          <span class="text-3xl font-black text-emerald-400 font-mono">${postMortem.responseQualityScore}%</span>
          <span class="text-[10px] text-slate-400 block">Conformidade SLA</span>
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400"></i>
          1. Causas Primárias e Vulnerabilidades da Viagem:
        </h4>
        <div class="grid grid-cols-1 gap-2 text-xs">
          ${postMortem.originalDefects.map(d => `
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
              <strong class="text-amber-400">${d.origin}:</strong> ${d.defect}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="check-square" class="w-4 h-4 text-cyan-400"></i>
          2. Avaliação Técnica das Decisões Tomadas no Sinistro:
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          ${postMortem.auditedDecisions.map(a => `
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div class="flex items-center justify-between">
                <span class="font-bold text-white">${a.decision}</span>
                <span class="text-[10px] px-2 py-0.5 rounded font-bold ${a.evaluatedStatus.includes('EXCELENTE') || a.evaluatedStatus.includes('CONFORME') || a.evaluatedStatus.includes('EFICAZ') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${a.evaluatedStatus}</span>
              </div>
              <p class="text-[11px] text-slate-400 leading-snug">${a.comment}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="book-open" class="w-4 h-4 text-purple-400"></i>
          3. Lições Aprendidas para Prevenção de Não-Conformidade (ISO/SASSMAQ):
        </h4>
        <ul class="list-disc pl-4 space-y-1 text-xs text-slate-300">
          ${postMortem.lessonsLearned.map(l => `<li>${l}</li>`).join('')}
        </ul>
      </div>
    `;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeFinishIncidentModal() {
    const modal = document.getElementById('finish-incident-modal');
    if (modal) modal.classList.add('hidden');
  },

  confirmFinishIncident() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;

    appState.updateCurrentIncident({
      severity: 'ESTAVEL',
      status: 'CONCLUIDA'
    });

    appState.addDispatchLog("Encerramento Oficial", "OCORRÃŠNCIA CONCLUÍDA", `ENC-${Date.now().toString().slice(-4)}`, inc.responsible);
    
    // Save AI Carrier Rating if applicable
    if (inc._tempPostMortemScore && inc.carrier) {
      const rating = Math.max(1, (inc._tempPostMortemScore / 100) * 5);
      this.rateProvider(inc.carrier, rating);
    }
    
    this.closeFinishIncidentModal();
    this.showToast(`Ocorrência ${inc.id} finalizada e arquivada com sucesso!`);
    
    // Limpa a ocorrência atual para que o dashboard mostre "Sem ocorrência"
    appState.currentIncidentId = null;
    appState.saveCurrentIdToStorage(null);
    appState.notify();
    
    this.switchTab('dossier');
  },

  /* =======================================================
   * COPILOT CHATBOT (ASSISTENTE TÁTICO)
   * ======================================================= */
  handleCopilotSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('copilot-user-input');
    if (!input || !input.value.trim()) return;

    const query = input.value.trim();
    input.value = '';
    this.sendCopilotQuery(query);
  },

  sendCopilotQuery(text) {
    const log = document.getElementById('copilot-chat-log');
    if (!log) return;

    const inc = appState.getCurrentIncident();

    const userBubble = document.createElement('div');
    userBubble.className = 'flex items-start gap-3 max-w-2xl ml-auto justify-end';
    userBubble.innerHTML = `
      <div class="bg-blue-600 text-white rounded-2xl p-4 text-xs leading-relaxed shadow-lg">
        ${text}
      </div>
      <div class="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
        Você
      </div>
    `;
    log.appendChild(userBubble);
    log.scrollTop = log.scrollHeight;

    setTimeout(async () => {
      const answer = `Olá, sou o General. Estou indisponível no momento por falta de inteligência artificial.<br><br>Por favor, entre em contato com a central de ajuda:<br>- E-mail: suporte@general.com<br>- Tel: (11) 99999-9999`;
      const aiBubble = document.createElement('div');
      aiBubble.className = 'flex items-start gap-3 max-w-2xl';
      aiBubble.innerHTML = `
        <div class="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
          <img src="icons/IA.png" class="w-full h-full object-cover">
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 leading-relaxed shadow-lg whitespace-pre-line">
          ${answer}
        </div>
      `;
      log.appendChild(aiBubble);
      log.scrollTop = log.scrollHeight;
      appState.playBeep('info');
    }, 100);
  },

  /* =======================================================
   * OUTROS MÓDULOS & VIEWS
   * ======================================================= */
  renderIncidentsList() {
    const activeContainer = document.getElementById('incidents-sidebar-list');
    const historyContainer = document.getElementById('incidents-history-sidebar-list');
    
    if (activeContainer) {
      const activeIncidents = appState.incidents.filter(inc => inc.status !== 'CONCLUIDA');
      activeContainer.innerHTML = activeIncidents.map(inc => this.buildSidebarCard(inc)).join('') || 
        '<p class="text-[10px] text-slate-500 text-center py-2">Nenhuma ocorrência ativa.</p>';
    }
    
    if (historyContainer) {
      const completedIncidents = appState.incidents.filter(inc => inc.status === 'CONCLUIDA');
      historyContainer.innerHTML = completedIncidents.map(inc => this.buildSidebarCard(inc)).join('') ||
        '<p class="text-[10px] text-slate-500 text-center py-2">Nenhum histórico.</p>';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  buildSidebarCard(inc) {
    const isCur = inc.id === appState.currentIncidentId;
    return `
      <div onclick="appState.setCurrentIncident('${inc.id}')" class="p-3 rounded-xl border ${isCur ? 'bg-blue-600/15 border-blue-500 text-white shadow-md' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'} cursor-pointer transition-all mb-2">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-bold font-mono ${isCur ? 'text-blue-400' : 'text-slate-300'}">${inc.id}</span>
          <span class="text-[10px] px-2 py-0.5 rounded font-semibold ${inc.severity === 'CRITICO' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : inc.status === 'CONCLUIDA' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${inc.status === 'CONCLUIDA' ? 'CONCLUÍDA' : inc.severity}</span>
        </div>
        <div class="font-bold text-xs text-white truncate mb-1">${inc.title}</div>
        <div class="text-[11px] text-slate-400 flex items-center justify-between mt-2">
          <div class="flex items-center gap-2">
            <span>${inc.road}</span>
            <span>&bull;</span>
            <span>${inc.plate}</span>
          </div>
          ${inc.status !== 'CONCLUIDA' ? `
          <div class="flex items-center gap-2">
             <button onclick="event.stopPropagation(); App.downloadConcludedPDF('${inc.id}')" class="text-slate-500 hover:text-emerald-400 transition-colors" title="Baixar Ocorrência (PDF)"><i data-lucide="file-down" class="w-3.5 h-3.5"></i></button>
             <button onclick="event.stopPropagation(); App.editIncident('${inc.id}')" class="text-slate-500 hover:text-blue-400 transition-colors" title="Editar"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
             <button onclick="event.stopPropagation(); App.deleteIncident('${inc.id}', false)" class="text-slate-500 hover:text-red-400 transition-colors" title="Apagar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  renderHistoryTab() {
    const container = document.getElementById('history-cards-container');
    if (!container) return;

    const completedIncidents = appState.incidents.filter(inc => inc.status === 'CONCLUIDA');
    const savedPlans = JSON.parse(localStorage.getItem('general_saved_plans') || '[]');
    const successfulPlans = savedPlans.filter(plan => !plan.hasIncident && plan.type !== 'ACAO');
    
    if (completedIncidents.length === 0 && successfulPlans.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl">
          <i data-lucide="archive-x" class="w-12 h-12 text-slate-600 mb-3"></i>
          <h3 class="text-white font-bold mb-1">Nenhum Registro Encontrado</h3>
          <p class="text-sm text-slate-400">Ocorrências finalizadas e planos bem sucedidos aparecerão aqui.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    let allItems = [];
    
    const filterType = document.getElementById('history-filter-type')?.value || '';
    const filterDate = document.getElementById('history-filter-date')?.value || ''; // format 'YYYY-MM'
    
    completedIncidents.forEach(inc => {
      let pass = true;
      if (filterType && inc.eventType !== filterType) pass = false;
      if (filterDate && inc.date && !inc.date.startsWith(filterDate)) pass = false;
      
      if (pass) {
        allItems.push({ type: 'INCIDENT', date: inc.date || new Date().toISOString(), data: inc });
      }
    });
    
    successfulPlans.forEach(plan => {
      let pass = true;
      if (filterType) pass = false; // Plans don't have eventType
      if (filterDate && plan.date && !plan.date.startsWith(filterDate)) pass = false;
      
      if (pass) {
        allItems.push({ type: 'PLAN', date: plan.date || new Date().toISOString(), data: plan });
      }
    });
    
    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allItems.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl">
          <i data-lucide="archive-x" class="w-12 h-12 text-slate-600 mb-3"></i>
          <h3 class="text-white font-bold mb-1">Nenhum Registro Encontrado</h3>
          <p class="text-sm text-slate-400">Nenhum dossiê ou plano atende aos filtros atuais.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    container.innerHTML = allItems.map(item => {
      if (item.type === 'INCIDENT') {
        const inc = item.data;
        return `
        <div class="bg-slate-900 border-2 border-rose-500/50 hover:border-rose-500 rounded-2xl p-5 transition-all flex flex-col shadow-lg shadow-rose-900/20">
          <div class="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
            <span class="font-mono text-sm font-bold text-rose-400 flex items-center gap-2">
              <i data-lucide="alert-circle" class="w-4 h-4"></i> OCORRÃŠNCIA: ${inc.id}
            </span>
            <div class="flex items-center gap-3">
              <span class="text-xs text-slate-500 font-mono">${new Date(item.date).toLocaleDateString()}</span>
              <button onclick="App.deleteIncident('${inc.id}', true)" class="text-slate-500 hover:text-red-500 transition-colors" title="Apagar Histórico">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          
          ${inc.reverseLogistics ? `
          <div class="mb-3 bg-emerald-950/40 border border-emerald-500/50 rounded-lg p-2.5 flex items-start gap-2 shadow-inner">
            <i data-lucide="recycle" class="w-4 h-4 text-emerald-400 mt-0.5"></i>
            <div>
              <span class="text-xs font-bold text-emerald-300 block">Cliente desistiu, produtos reaproveitados</span>
              <span class="text-[10px] text-emerald-500">Parceiro de reciclagem/recondicionamento: <b>${inc.reverseLogistics.company}</b></span>
            </div>
          </div>
          ` : ''}
          <h3 class="font-bold text-white text-base leading-snug mb-2">${inc.title}</h3>
          <p class="text-xs text-slate-400 mb-4 flex-1 line-clamp-3">${inc.docsParecer || 'Sem parecer técnico redigido.'}</p>
          
          <div class="grid grid-cols-2 gap-2 mb-4 text-[11px]">
            <div class="bg-slate-950 p-2 rounded border border-slate-800">
              <span class="text-slate-500 block mb-0.5">Motorista</span>
              <span class="font-bold text-slate-300 truncate block">${inc.driverName || 'N/A'}</span>
            </div>
            <div class="bg-slate-950 p-2 rounded border border-slate-800">
              <span class="text-slate-500 block mb-0.5">Veículo</span>
              <span class="font-bold text-slate-300 truncate block">${inc.plate || 'N/A'}</span>
            </div>
          </div>

          ${inc.docsAttachmentName ? `
          <div class="mb-4">
            <span class="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold flex items-center gap-1.5"><i data-lucide="paperclip" class="w-3 h-3"></i> Documentos Anexados</span>
            <div class="space-y-1.5">
                <div class="flex items-center justify-between bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-[10px]">
                  <div class="flex items-center gap-1.5 text-slate-300 truncate flex-1">
                    <i data-lucide="file-text" class="w-3 h-3 text-blue-400 shrink-0"></i>
                    <span class="truncate">${inc.docsAttachmentName}</span>
                  </div>
                  <button class="text-slate-500 hover:text-white shrink-0 ml-2" onclick="App.showToast('Download de ${inc.docsAttachmentName} iniciado!')"><i data-lucide="download" class="w-3 h-3"></i></button>
                </div>
            </div>
          </div>
          ` : ''}

          <div class="flex flex-col gap-2 mt-2">
            <button onclick="App.downloadConcludedPDF('${inc.id}')" class="w-full bg-rose-950/40 border border-rose-900/50 hover:bg-rose-900/60 text-rose-300 font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-xs">
              <i data-lucide="file-text" class="w-3 h-3 text-rose-400"></i> Baixar Dossiê (Geral)
            </button>
            <button onclick="App.downloadHistoryPlanPDF('${inc.id}')" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-xs border border-slate-700">
              <i data-lucide="map" class="w-3 h-3 text-emerald-400"></i> Baixar Plano Logístico
            </button>
            <button onclick="App.downloadActionPlanPDF('${inc.id}')" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-xs border border-slate-700">
              <i data-lucide="check-square" class="w-3 h-3 text-blue-400"></i> Baixar Plano de Ação
            </button>
            <button onclick="App.downloadTransshipmentPDF('${inc.id}')" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-xs border border-slate-700">
              <i data-lucide="truck" class="w-3 h-3 text-orange-400"></i> Baixar Plano de Transbordo
            </button>
          </div>
        </div>
        `;
      } else {
        // Successful Plan
        const plan = item.data;
        return `
        <div class="bg-slate-900 border-2 border-emerald-500/50 hover:border-emerald-500 rounded-2xl p-5 transition-all flex flex-col shadow-lg shadow-emerald-900/20">
          <div class="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
            <span class="font-mono text-sm font-bold text-emerald-400 flex items-center gap-2">
              <i data-lucide="check-circle" class="w-4 h-4"></i> PLANO SUCESSO: ${plan.id || 'N/A'}
            </span>
            <span class="text-xs text-slate-500 font-mono">${new Date(item.date).toLocaleDateString()}</span>
          </div>
          
          <h3 class="font-bold text-white text-base leading-snug mb-2">${plan.client || 'Cliente Padrão'}</h3>
          <p class="text-xs text-slate-400 mb-4 flex-1 line-clamp-3">Viagem concluída sem sinistros registrados na origem: ${plan.origin} para o destino: ${plan.destination}.</p>
          
          <div class="grid grid-cols-2 gap-2 mb-4 text-[11px]">
            <div class="bg-slate-950 p-2 rounded border border-slate-800">
              <span class="text-slate-500 block mb-0.5">Produto</span>
              <span class="font-bold text-slate-300 truncate block">${plan.product || 'Não especificado'}</span>
            </div>
            <div class="bg-slate-950 p-2 rounded border border-slate-800">
              <span class="text-slate-500 block mb-0.5">Aprovado por</span>
              <span class="font-bold text-slate-300 truncate block">${plan.approvedBy || 'Aprovador Autorizado'}</span>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <button onclick="App.openProviderEvaluationModal('${plan.id}')" class="w-full bg-emerald-950/40 border border-emerald-900/50 hover:bg-emerald-900/60 text-emerald-300 font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-2 text-xs">
              <i data-lucide="star" class="w-3 h-3 text-emerald-400"></i>
              Avaliar Viagem
            </button>
            <button onclick="App.downloadHistoryPlanPDF('${plan.id}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-blue-900/30">
              <i data-lucide="file-text" class="w-3 h-3"></i> Baixar Plano Logístico
            </button>
          </div>
        </div>
        `;
      }
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  deleteIncident(id, fromHistory = false) {
    if (!confirm('Tem certeza que deseja apagar permanentemente esta ocorrência? Esta ação não pode ser desfeita.')) return;
    
    appState.incidents = appState.incidents.filter(inc => inc.id !== id);
    appState.save();
    
    this.showToast('Ocorrência apagada com sucesso!', 'success');
    
    if (fromHistory) {
      this.renderHistoryTab();
    } else {
      this.renderDashboard();
    }
  },

  openHistoryPlansModal(incId) {
    const inc = appState.incidents.find(i => i.id === incId);
    if (!inc) return;

    const modal = document.getElementById('history-plans-modal');
    const content = document.getElementById('history-plans-content');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="space-y-3">
        <button onclick="App.showToast('Download do Plano Logístico em andamento...', 'success')" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold p-4 rounded-xl transition-all flex items-center justify-between group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center"><i data-lucide="file-check-2" class="w-4 h-4"></i></div>
            <div class="text-left"><span class="block text-sm">Plano Logístico (Base)</span><span class="text-[10px] text-slate-400">PDF Gerado via Otimização</span></div>
          </div>
          <i data-lucide="download" class="w-4 h-4 text-slate-500 group-hover:text-blue-400"></i>
        </button>
        <button onclick="App.showToast('Download do Plano Prescritivo em andamento...', 'success')" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold p-4 rounded-xl transition-all flex items-center justify-between group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center"><i data-lucide="brain-circuit" class="w-4 h-4"></i></div>
            <div class="text-left"><span class="block text-sm">Plano Prescritivo (5W2H)</span><span class="text-[10px] text-slate-400">PDF Gerado via Inteligência Artificial</span></div>
          </div>
          <i data-lucide="download" class="w-4 h-4 text-slate-500 group-hover:text-cyan-400"></i>
        </button>
        <button onclick="App.showToast('Download do Plano de Transbordo em andamento...', 'success')" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold p-4 rounded-xl transition-all flex items-center justify-between group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><i data-lucide="truck" class="w-4 h-4"></i></div>
            <div class="text-left"><span class="block text-sm">Plano Operacional</span><span class="text-[10px] text-slate-400">PDF de Transbordo e Salvamento</span></div>
          </div>
          <i data-lucide="download" class="w-4 h-4 text-slate-500 group-hover:text-emerald-400"></i>
        </button>
      </div>
    `;
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeHistoryPlansModal() {
    const modal = document.getElementById('history-plans-modal');
    if (modal) modal.classList.add('hidden');
  },

  renderHazmatCatalogue() {
    const container = document.getElementById('hazmat-grid-container');
    if (!container) return;

    const list = HAZMAT_DATABASE;
    container.innerHTML = list.map(h => `
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-orange-500/50 transition-all group">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 font-mono font-black flex flex-col items-center justify-center">
              <span class="text-[10px] uppercase tracking-tight text-orange-300">ONU</span>
              <span class="text-sm leading-none">${h.onu}</span>
            </div>
            <div>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">${h.classe}</span>
              <h3 class="font-bold text-white text-sm mt-1 group-hover:text-orange-400 transition-colors">${h.nome}</h3>
            </div>
          </div>
          <div class="text-right font-mono text-xs text-slate-400">
            <div>Risco: <strong class="text-white">${h.numRisco}</strong></div>
            <div>Guia: <strong class="text-blue-400">${h.guia}</strong></div>
          </div>
        </div>
        <p class="text-xs text-slate-400 mb-3 line-clamp-2">${h.perigoFogo}</p>
        <button onclick="App.applyHazmatToIncident('${h.onu}')" class="w-full py-2 bg-slate-800 hover:bg-orange-600 hover:text-white text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
          <i data-lucide="shield-check" class="w-4 h-4"></i>
          Aplicar Ã  Ocorrência Atual
        </button>
      </div>
    `).join('') || '<p class="text-xs text-slate-500 col-span-full">Nenhum produto perigoso encontrado.</p>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  applyHazmatToIncident(onu) {
    const select = document.getElementById('hazmat-incident-select');
    const incId = select?.value;

    if (!incId) {
      this.showToast('Por favor, selecione uma ocorrência antes de aplicar o produto.', 'warning');
      return;
    }

    appState.setCurrentIncident(incId);
    
    const hazmat = findHazmatByQuery(onu);
    if (!hazmat) return;
    appState.updateCurrentIncident({
      cargoType: 'PRODUTO_PERIGOSO',
      onuCode: hazmat.onu,
      cargoDescription: `${hazmat.nome} (ONU ${hazmat.onu} - Classe ${hazmat.classe})`
    });
    this.showToast(`Produto ONU ${hazmat.onu} vinculado Ã  ocorrência ${incId}!`);
    this.switchTab('dashboard');
  },

  registerHazmatProduct() {
    const onu = document.getElementById('new-onu-code')?.value.trim();
    const nome = document.getElementById('new-onu-name')?.value.trim();
    const classe = document.getElementById('new-onu-class')?.value.trim();
    const guia = document.getElementById('new-onu-guide')?.value.trim();

    if (!onu || !nome || !classe) {
      this.showToast('Por favor, preencha NÂº ONU, Nome e Classe.', true);
      return;
    }

    // Adiciona ao array global
    HAZMAT_DATABASE.push({
      onu: onu,
      nome: nome,
      classe: classe,
      numRisco: "Desconhecido", // Fallbacks if not provided
      guia: guia || "N/A",
      perigoFogo: "Produto cadastrado manualmente.",
      perigoSaude: "Verifique o Guia de Emergência correspondente.",
      epi: "EPIs de padrão mínimo de acordo com a classe.",
      isolamentoFogo: "1000m preventivo",
      isolamentoDerramamento: "100m preventivo"
    });

    this.showToast(`Produto ONU ${onu} cadastrado com sucesso!`);
    
    // Limpar o form
    if(document.getElementById('new-onu-code')) document.getElementById('new-onu-code').value = '';
    if(document.getElementById('new-onu-name')) document.getElementById('new-onu-name').value = '';
    if(document.getElementById('new-onu-class')) document.getElementById('new-onu-class').value = '';
    if(document.getElementById('new-onu-guide')) document.getElementById('new-onu-guide').value = '';

    document.getElementById('hazmat-register-form').classList.add('hidden');
    this.renderHazmatCatalogue();
  },

  renderInvestigationTab() {
    const inc = appState.getCurrentIncident() || {};
    
    // Tratamento seguro para RCA
    const rca = inc.rca || { ishikawa: {}, fiveWhys: ["", "", "", "", ""] };
    
    const ishikawaContainer = document.getElementById('ishikawa-interactive-container');
    const whysContainer = document.getElementById('five-whys-interactive-container');
    
    if (ishikawaContainer && window.RCAInvestigationModule) ishikawaContainer.innerHTML = RCAInvestigationModule.renderIshikawaDiagram(rca.ishikawa);
    if (whysContainer && window.RCAInvestigationModule) whysContainer.innerHTML = RCAInvestigationModule.renderFiveWhys(rca.fiveWhys);
  },

  renderDossierTab() {
      const sel = document.getElementById('dossier-incident-select');
      const inc = (sel && sel.value) ? appState.incidents.find(i => i.id === sel.value) : null;
      const container = document.getElementById('dossier-preview-container');
      if (!container) return;
      
      if (!inc) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-12 bg-slate-900/50 rounded-2xl border border-slate-800">
          <i data-lucide="folder-search" class="w-16 h-16 text-slate-500 mb-4 opacity-50"></i>
          <h3 class="text-lg font-bold text-slate-300 mb-2">Nenhuma Ocorrência Selecionada</h3>
          <p class="text-sm text-slate-500 text-center max-w-md">Para visualizar o Dossiê Executivo, por favor, selecione uma ocorrência no filtro global localizado no topo da tela.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }
    
    container.innerHTML = ReportPDFGenerator.generateExecutiveHTML(inc);
  },

  updateSLATimers() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;
    const timerEl = document.getElementById('sla-timer-display');
    if (!timerEl) return;

    const start = new Date(inc.createdAt || Date.now()).getTime();
    const now = Date.now();
    const diff = Math.max(0, Math.floor((now - start) / 1000));

    const hrs = String(Math.floor(diff / 3600)).padStart(2, '0');
    const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const secs = String(diff % 60).padStart(2, '0');

    timerEl.textContent = `${hrs}:${mins}:${secs}`;
  },

  openDispatchModal() {
    const inc = appState.getCurrentIncident();
    const modal = document.getElementById('dispatch-modal');
    if (!modal || !inc) return;

    const body = document.getElementById('dispatch-modal-content');
    body.innerHTML = `
      <div class="space-y-4">
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap">
${NotificationHub.getTemplate('WHATSAPP_EMERGENCIA', inc)}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onclick="NotificationHub.sendWhatsApp('WHATSAPP_EMERGENCIA'); App.closeDispatchModal();" class="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl font-bold text-xs shadow-lg transition-all">
            <i data-lucide="message-circle" class="w-4 h-4"></i>
            Enviar WhatsApp Geral
          </button>
          <button onclick="NotificationHub.sendEmail('EMAIL_SEGURADORA'); App.closeDispatchModal();" class="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl font-bold text-xs shadow-lg transition-all">
            <i data-lucide="mail" class="w-4 h-4"></i>
            E-mail para Seguradora
          </button>
          <button onclick="NotificationHub.callEmergency('191', 'PRF Rodoviária'); App.closeDispatchModal();" class="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 p-3 rounded-xl font-bold text-xs border border-slate-700 transition-all">
            <i data-lucide="phone" class="w-4 h-4 text-blue-400"></i>
            Ligar PRF (191)
          </button>
          <button onclick="NotificationHub.callEmergency('193', 'Corpo de Bombeiros'); App.closeDispatchModal();" class="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 p-3 rounded-xl font-bold text-xs border border-slate-700 transition-all">
            <i data-lucide="phone" class="w-4 h-4 text-red-400"></i>
            Ligar Bombeiros (193)
          </button>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeDispatchModal() {
    const modal = document.getElementById('dispatch-modal');
    if (modal) modal.classList.add('hidden');
  },

  openNewIncidentModal() {
    const modal = document.getElementById('new-incident-modal');
    if (!modal) return;
    
    // Clear the editing flag and reset the form
    const editInput = document.getElementById('editing-incident-id');
    if (editInput) editInput.value = '';
    const form = document.getElementById('new-incident-form');
    if (form) form.reset();
    
    const select = document.getElementById('new-incident-plan-select');
    if (select) {
      select.innerHTML = '<option value="">Selecione um plano aprovado...</option>';
      const plans = appState.savedPlans || [];
      plans.forEach((p, idx) => {
        const dateStr = (p.date || p.approvalDate) ? (p.date || p.approvalDate).substring(0, 10) : 'Data N/A';
          const codeStr = (p.code || p.id) ? `[${p.code || p.id}]` : '';
          const cName = p.clientName || (p.data && p.data.clientName) || 'Cliente N/A';
          const orig = p.origin || (p.data && p.data.origin) || 'Origem N/A';
          const dest = p.destination || (p.data && p.data.destination) || 'Destino N/A';
          const option = document.createElement('option');
          option.value = idx;
          option.textContent = `${codeStr} ${dateStr} - ${cName} - ${orig} a ${dest}`;
        select.appendChild(option);
      });
    }

    modal.classList.remove('hidden');
  },

  closeNewIncidentModal() {
    const modal = document.getElementById('new-incident-modal');
    if (modal) modal.classList.add('hidden');
  },

  editIncident(id) {
    const inc = appState.incidents.find(i => i.id === id);
    if (!inc) return;

    this.openNewIncidentModal();
    
    // Set the editing ID
    document.getElementById('editing-incident-id').value = id;
    
    // Populate fields
    const form = document.getElementById('new-incident-form');
    if (!form) return;
    
    // Find the original plan index if any
    const select = document.getElementById('new-incident-plan-select');
    if (select && inc.logisticsPlan) {
      const plans = appState.savedPlans || [];
      const planIdx = plans.findIndex(p => p.id === inc.logisticsPlan.id || p.approvalDate === inc.logisticsPlan.approvalDate);
      if (planIdx !== -1) {
        select.value = planIdx;
      }
    }
    
    const setVal = (name, val) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.value = val || '';
    };

    setVal('title', inc.title);
    setVal('eventType', inc.eventType);
    setVal('trackingLink', inc.trackingLink);
    setVal('city', inc.city);
    setVal('cep', inc.cep);
    setVal('plate', inc.plate);
    setVal('driverName', inc.driverName);
    setVal('driverPhone', inc.driverPhone);
    setVal('cargoType', inc.cargoType);
    setVal('onuCode', inc.onuCode);
    setVal('cargoDescription', inc.cargoDescription);
    setVal('cargoValue', inc.cargoValue);
    setVal('severity', inc.severity);
  },

  handlePlanSelectionForNewIncident(selectElement) {
    const idx = selectElement.value;
    if (idx === '') return;
    const plan = (appState.savedPlans || [])[idx];
    if (!plan) return;
    
    const form = document.querySelector('#new-incident-modal form');
    if (!form) return;
    
    if (form.elements['cargoType'] && plan.cargoType) form.elements['cargoType'].value = plan.cargoType;
    if (form.elements['onuCode'] && plan.onuCode) form.elements['onuCode'].value = plan.onuCode;
    if (form.elements['cargoDescription'] && plan.productName) form.elements['cargoDescription'].value = plan.productName;
    if (form.elements['road'] && plan.plannedRoads) form.elements['road'].value = plan.plannedRoads;
    if (form.elements['driverName'] && plan.driverName) form.elements['driverName'].value = plan.driverName;
    if (form.elements['driverPhone'] && plan.carrierPhone) form.elements['driverPhone'].value = plan.carrierPhone;
  },

  async submitNewIncident(e) {
    e.preventDefault();
    try {
      const form = e.target;
    const formData = new FormData(form);
    
    const planIdx = formData.get('planId');
    const selectedPlan = (appState.savedPlans || [])[planIdx];

    if (!selectedPlan) {
      this.showToast('Erro: É necessário vincular um Plano Logístico salvo.', 'error');
      return;
    }

    selectedPlan.hasIncident = true;
    localStorage.setItem('GENERAL_PAAC_SAVED_PLANS', JSON.stringify(appState.savedPlans));
      this.syncToFirebase();

    let lat = -23.5505; // Default (SP)
    let lng = -46.6333;

    const state = formData.get('state') || '';
    const city = formData.get('city') || '';
    const cityStr = city ? `${city} / ${state}` : '';
    const cep = formData.get('cep') || '';

    // Tentativa de Geocodificação AWS Location Service para a Cidade/Referência
    try {
      if (window.LocationService) {
        this.showToast('Buscando localização aproximada via satélite...');
        
        const query = cep ? `${cep}, ${cityStr}, Brazil` : `${cityStr}, Brazil`;
        
        console.log('AWS Geocode Query:', query);
        
        const coords = await window.LocationService.geocode(query);
        if (coords) {
          lat = coords[0];
          lng = coords[1];
        }
      }
    } catch (err) {
      console.error('Erro ao geocodificar local do acidente:', err);
    }

    const editId = formData.get('editingIncidentId');
    if (editId) {
       // Edit Mode
       const existingInc = appState.incidents.find(i => i.id === editId);
       if (existingInc) {
         existingInc.title = formData.get('title');
         existingInc.eventType = formData.get('eventType');
         existingInc.trackingLink = formData.get('trackingLink');
         existingInc.city = formData.get('city');
         existingInc.cep = formData.get('cep') || '';
         existingInc.plate = formData.get('plate');
         existingInc.driverName = formData.get('driverName');
         existingInc.driverPhone = formData.get('driverPhone');
         existingInc.cargoType = formData.get('cargoType');
         existingInc.onuCode = formData.get('onuCode');
         existingInc.cargoDescription = formData.get('cargoDescription');
         existingInc.cargoValue = formData.get('cargoValue');
         existingInc.severity = formData.get('severity');
         existingInc.lat = lat;
         existingInc.lng = lng;
         
         existingInc.logisticsPlan = selectedPlan;
         existingInc.volume = selectedPlan.volume;
         
         appState.save();
         
         this.closeNewIncidentModal();
         this.renderIncidentsList();
         this.renderSavedPlansTab();
         this.switchTab('dashboard');
         if (appState.currentIncidentId === editId) this.renderCurrentIncident();
         
         setTimeout(() => {
                      if (window.mapController) {
             if (!window.mapController.map) {
                 window.mapController.init(lat, lng);
             } else {
                 window.mapController.updateMapLocation(lat, lng);
             }
             window.mapController.invalidateSize();
           }
         }, 300);

         this.showToast('Ocorrência atualizada com sucesso!');
         return;
       }
    }

    
    let finalEventType = formData.get('eventType');
    if (finalEventType === 'Outros') {
      const customInput = document.getElementById('customEventType');
      if (customInput && customInput.value.trim()) {
        finalEventType = customInput.value.trim();
        try {
           const customEvents = JSON.parse(localStorage.getItem('GENERAL_CUSTOM_EVENTS') || '[]');
           if (!customEvents.includes(finalEventType)) {
               customEvents.push(finalEventType);
               localStorage.setItem('GENERAL_CUSTOM_EVENTS', JSON.stringify(customEvents));
               
               // Inject into select right now
               const selectElement = document.getElementById('eventTypeSelect');
               if (selectElement) {
                   const options = Array.from(selectElement.options);
                   const outrosIndex = options.findIndex(opt => opt.value === 'Outros');
                   if (outrosIndex > -1) {
                       const newOption = new Option(finalEventType, finalEventType);
                       selectElement.insertBefore(newOption, selectElement.options[outrosIndex]);
                   }
               }
           }
        } catch(e) {}
      }
    }

    const newInc = appState.createIncident({
      title: formData.get('title'),
      eventType: finalEventType,

      trackingLink: formData.get('trackingLink'),
      road: 'Ver Link GPS',
      km: '',
      city: cityStr,
      cep: formData.get('cep') || '',
      plate: formData.get('plate'),
      driverName: formData.get('driverName'),
      driverPhone: formData.get('driverPhone'),
      cargoType: formData.get('cargoType'),
      onuCode: formData.get('onuCode'),
      cargoDescription: formData.get('cargoDescription'),
      cargoValue: formData.get('cargoValue'),
      severity: formData.get('severity'),
      lat: lat,
      lng: lng
    });

    newInc.logisticsPlan = selectedPlan;
    newInc.volume = selectedPlan.volume;
    newInc.slaStartTime = new Date().toISOString();
    
    appState.save(); // Salvar as alterações (incluindo lat/lng e logisticsPlan)

    this.closeNewIncidentModal();
    this.renderIncidentsList();
    this.renderSavedPlansTab();
    this.switchTab('dashboard');
    
    // Atualizar mapa após exibir a tab
    setTimeout(() => {
                 if (window.mapController) {
             if (!window.mapController.map) {
                 window.mapController.init(lat, lng);
             } else {
                 window.mapController.updateMapLocation(lat, lng);
             }
             window.mapController.invalidateSize();
           }
    }, 300);

    this.showToast('Nova ocorrência criada com sucesso e mapeada!');
    } catch (err) {
      console.error('Erro ao criar ocorrencia:', err);
      this.showToast('Ocorreu um erro interno: ' + err.message, 'error');
    } finally {
      this.closeNewIncidentModal();
    }
  },

  saveLogisticsPlan() {
    const plan = this.getPlanFromInputs();
    if (!plan.origin || !plan.destination || !plan.productName) {
      this.showToast('Por favor, preencha as informações básicas do plano antes de salvar.', 'error');
      return;
    }
    
    // Obtém o plano 5W2H da IA gerado
    const isOptimized = document.getElementById('ai-plan-5w2h-container').innerHTML.trim() !== '';
    const safePlanData = isOptimized ? 'Plano otimizado por IA (100% Seguro)' : 'Plano Original sem otimização';
    
    plan.status = 'APROVADO';
    plan.approvalDate = new Date().toISOString();
    plan.isOptimized = isOptimized;
    plan.safetyNote = safePlanData;
    
    // Adicionar dados de quem aprovou (Baseado no Perfil Complementar)
    const currentUser = JSON.parse(localStorage.getItem('general_user') || '{}');
    plan.approvedBy = currentUser.name || 'Aprovador Autorizado';
    plan.approvedByCompany = currentUser.company || 'Empresa Logística (Teste)';
    plan.approvedByRole = currentUser.role || 'Gestor de Frota';

    appState.activePlan = plan;
    
    // Salva na lista de planos históricos
    appState.savedPlans = appState.savedPlans || [];
    appState.savedPlans.push(plan);
    localStorage.setItem('GENERAL_PAAC_SAVED_PLANS', JSON.stringify(appState.savedPlans));
      this.syncToFirebase();

    this.showToast('Plano Logístico salvo e aprovado com sucesso!', 'success');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  async exportDriverBriefing() {
    const plan = this.getPlanFromInputs();
    this.showToast('ðŸ¤– IA do Gemini processando briefing de riscos...', 'info');
    
    // IA gera a auditoria e extrai insights
    const audit = await LogisticsPlanner.auditPlan(plan);

    const geminiPrompt = `Aja como o Copilot de Segurança Logística. Reescreva o conteúdo da Folha de Viagem Segura (Briefing do Motorista) em formato HTML limpo e profissional, utilizando os dados fornecidos.
Motorista: ${plan.driverName}
Trajeto: ${plan.origin} até ${plan.destination}
Distância: ${plan.distanceKm} km
Veículo: ${plan.vehicleType}
Produto: ${plan.productName} ${plan.onuCode ? `(ONU ${plan.onuCode})` : ''}
Score de Segurança: ${audit.safetyScore}%
Perigos Detectados: ${audit.warnings.map(w => w.title + ": " + w.description).join('; ')}
Prescrições Obrigatórias: ${audit.prescriptions.map(p => p.action + ": " + p.detail).join('; ')}

O HTML DEVE conter:
- Um título "GENERAL - Folha de Viagem Segura" e a data/hora atual.
- Os dados do condutor e da viagem agrupados.
- Uma seção de "Perigos Críticos na Rota" destacada (use cores como bg-rose-50 e text-rose-900).
- Uma seção de "Recomendações e Plano de Ação" (use bg-blue-50 e text-blue-900).
- Linhas no final para assinatura do Condutor e do Gestor/Despachante.
Retorne APENAS o HTML da view, usando classes do Tailwind CSS. Não inclua \`\`\`html ou tags markdown.`;

    let htmlBody = "";
    try {
      const response = await GeminiService.callGemini(geminiPrompt);
      if (response && response.candidates && response.candidates.length > 0) {
        htmlBody = response.candidates[0].content.parts[0].text;
        htmlBody = htmlBody.replace(/```html/g, '').replace(/```/g, '').trim();
      } else {
        throw new Error("Resposta inválida da IA");
      }
    } catch (e) {
      console.error("Falha no Gemini:", e);
      // Fallback
      htmlBody = `
        <div class="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
          <div>
            <h1 class="text-lg font-black tracking-wider text-blue-900 uppercase">GENERAL â€¢ Folha de Viagem Segura</h1>
            <p class="text-xs text-slate-600">Briefing Pré-Viagem do Condutor & Validação de Risco</p>
          </div>
          <div class="text-right font-mono">
            <span class="font-bold text-sm text-blue-900">SCORE: ${audit.safetyScore}%</span>
            <div class="text-[10px] text-slate-500">Emissão: ${new Date().toLocaleString('pt-BR')}</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-4 bg-slate-50 p-3 rounded border border-slate-200">
          <div><strong>Cliente:</strong> ${plan.clientName}</div>
          <div><strong>Produto:</strong> ${plan.productName} ${plan.onuCode ? `(ONU ${plan.onuCode})` : ''}</div>
          <div><strong>Condutor:</strong> ${plan.driverName}</div>
          <div><strong>Veículo:</strong> ${plan.vehicleType}</div>
          <div><strong>Trajeto:</strong> ${plan.origin} -> ${plan.destination}</div>
          <div><strong>Rodovias:</strong> ${plan.plannedRoads} (${plan.distanceKm} km)</div>
        </div>

        <div class="mb-4 bg-rose-50 border border-rose-200 p-3 rounded">
          <h2 class="font-bold text-rose-900 uppercase text-xs mb-1">âš ï¸ Perigos & Pontos Críticos na Rota:</h2>
          <ul class="list-disc pl-4 space-y-1 text-rose-800">
            ${audit.warnings.map(w => `<li><strong>${w.title}:</strong> ${w.description}</li>`).join('')}
          </ul>
        </div>

        <div class="mb-4 bg-blue-50 border border-blue-200 p-3 rounded">
          <h2 class="font-bold text-blue-900 uppercase text-xs mb-1">ðŸ’¡ Recomendações Obrigatórias de Condução:</h2>
          <ul class="list-disc pl-4 space-y-1 text-blue-800">
            ${audit.prescriptions.map(p => `<li><strong>${p.action}:</strong> ${p.detail}</li>`).join('')}
          </ul>
        </div>

        <div class="border-t border-slate-300 pt-6 mt-8 grid grid-cols-2 gap-8 text-center">
          <div>
            <div class="border-b border-slate-400 mb-1 pb-6 font-medium">${plan.driverName}</div>
            <p>Assinatura do Condutor (Ciente dos Perigos)</p>
          </div>
          <div>
            <div class="border-b border-slate-400 mb-1 pb-6 font-medium">Gestor de Frota / Despachante</div>
            <p>Liberação de Viagem Validada por IA</p>
          </div>
        </div>
      `;
    }

    const briefingWindow = window.open('', '_blank');
    briefingWindow.document.write(`
      <html>
      <head>
        <title>Briefing de Viagem Segura - GENERAL</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-white text-slate-900 p-8 max-w-3xl mx-auto font-sans leading-relaxed text-xs">
        ${htmlBody}
        
        <div class="mt-8 text-center">
          <button onclick="window.print()" class="px-4 py-2 bg-blue-600 text-white rounded font-bold shadow print:hidden">Imprimir Folha Segura</button>
        </div>
      </body>
      </html>
    `);
    briefingWindow.document.close();
    briefingWindow.focus();
    setTimeout(() => briefingWindow.print(), 300);
  },

  renderCurrentIncident() {
    const inc = appState.getCurrentIncident();
    
    const riskBanner = document.getElementById('risk-banner-container');
    const headerTitle = document.getElementById('header-incident-title');
    const riskScoreEl = document.getElementById('header-risk-score');
    const metricsContainer = document.getElementById('dashboard-metrics-container');
    const workspaceGrid = document.getElementById('dashboard-workspace-grid');
    const checklistSummary = document.getElementById('dashboard-checklist-summary');
    
    if (!inc || inc.status === 'CONCLUIDA') {
      if (workspaceGrid) workspaceGrid.style.display = 'none';
      if (checklistSummary) checklistSummary.style.display = 'none';
      if (headerTitle) headerTitle.textContent = "Nenhuma ocorrência ativa";
      if (riskScoreEl) {
        riskScoreEl.textContent = "--/100";
        riskScoreEl.className = "px-2 py-0.5 text-[10px] font-black rounded-full border border-slate-700 text-slate-500 bg-slate-800/50";
      }
      if (riskBanner) {
        riskBanner.innerHTML = `
          <div class="flex flex-col items-center justify-center py-10 px-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30">
            <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <i data-lucide="shield-alert" class="w-8 h-8 text-slate-500"></i>
            </div>
            <h3 class="text-white font-bold text-lg">Nenhuma ocorrência selecionada</h3>
            <p class="text-slate-400 text-sm mt-1 text-center max-w-md">Selecione uma ocorrência na barra lateral ou inicie um novo protocolo de emergência para visualizar o painel tático.</p>
            <button onclick="App.openNewIncidentModal()" class="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/30 transition-all">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
              Criar Nova Ocorrência
            </button>
          </div>
        `;
      }
      if (metricsContainer) metricsContainer.innerHTML = '';
      
      const timelineList = document.getElementById('incident-timeline-list');
      if (timelineList) timelineList.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Aguardando ocorrência...</div>';
      
      const checklistCont = document.getElementById('checklist-container');
      if (checklistCont) checklistCont.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Aguardando ocorrência...</div>';
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const risk = RiskEngine.calculateScore(inc);

    if (workspaceGrid) workspaceGrid.style.display = '';
    if (checklistSummary) checklistSummary.style.display = '';

    if (headerTitle) headerTitle.textContent = `${inc.id} â€¢ ${inc.title}`;

    if (riskScoreEl) {
      riskScoreEl.textContent = `${risk.score}/100`;
      riskScoreEl.className = `px-3 py-1 text-xs font-black rounded-full border ${risk.badgeClass}`;
    }

    if (riskBanner) {
      riskBanner.innerHTML = `
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900 border border-slate-700 shadow-xl">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black bg-blue-600 text-white shadow-lg">
              <span class="text-xl leading-none">${risk.score}</span>
              <span class="text-[9px] uppercase tracking-wider opacity-80">Risco</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300">SCORE ATUAL</span>
                <span class="text-xs text-slate-400">Avaliação do Incidente</span>
              </div>
              <h3 class="text-white font-bold text-base mt-1">${risk.topAction ? risk.topAction.title : 'Em Andamento'}</h3>
            </div>
          </div>
          <div class="flex items-center gap-2 w-full md:w-auto">
            <button onclick="App.openClientDelayNoticeModal()" class="flex-1 md:flex-none flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all">
              <i data-lucide="bell" class="w-4 h-4"></i>
              Avisar Cliente
            </button>
            <button onclick="App.openDispatchModal()" class="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all">
              <i data-lucide="send" class="w-4 h-4"></i>
              Disparo Rápido
            </button>
          </div>
        </div>
      `;
    }

    this.renderMetricCards(inc, risk);
    mapController.updateMapLocation(inc.lat, inc.lng);
    this.renderTimeline(inc);
    this.renderChecklistSummary(inc);
    
    // Update RCA Incident Header
    const rcaIncidentName = document.getElementById('rca-incident-name');
    if (rcaIncidentName) {
      rcaIncidentName.textContent = `${inc.id} - ${inc.title}`;
    }
  },

  renderMetricCards(inc, risk) {
    const container = document.getElementById('dashboard-metrics-container');
    if (!container) return;

    const hazmat = findHazmatByQuery(inc.onuCode);
    const cargoFormatted = Number(inc.cargoValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    container.innerHTML = `
      <div class="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl">
        <div class="flex items-center justify-between text-slate-400 text-xs mb-2">
          <span>Valor Sob Risco</span>
          <i data-lucide="shield-alert" class="w-4 h-4 text-emerald-400"></i>
        </div>
        <div class="text-xl font-black text-white">${cargoFormatted}</div>
        <div class="text-[11px] text-slate-400 mt-1 truncate">${inc.cargoDescription}</div>
      </div>

      <div class="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl">
        <div class="flex items-center justify-between text-slate-400 text-xs mb-2">
          <span>Motorista & Vítimas</span>
          <i data-lucide="user-check" class="w-4 h-4 text-blue-400"></i>
        </div>
        <div class="text-base font-bold text-white truncate">${inc.driverName}</div>
        <div class="flex items-center gap-1.5 mt-1">
          <span class="w-2 h-2 rounded-full ${inc.driverStatus === 'ILESO_CONSCIENTE' ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
          <span class="text-[11px] font-semibold text-slate-300">${inc.driverStatus.replace('_', ' ')}</span>
        </div>
      </div>

      <div class="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl">
        <div class="flex items-center justify-between text-slate-400 text-xs mb-2">
          <span>Classificação HazMat</span>
          <i data-lucide="flame" class="w-4 h-4 text-orange-400"></i>
        </div>
        <div class="text-base font-bold ${hazmat ? 'text-orange-400' : 'text-slate-300'}">
          ${hazmat ? `ONU ${hazmat.onu} (Classe ${hazmat.classeId})` : 'Carga Geral / Sem ONU'}
        </div>
        <div class="text-[11px] text-slate-400 mt-1">
          ${hazmat ? `Isolamento: ${hazmat.isolamentoGrandeVazamento}m` : 'Sem risco químico ativo'}
        </div>
      </div>

      <div class="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl">
        <div class="flex items-center justify-between text-slate-400 text-xs mb-2">
          <span>SLA Resposta Rápida</span>
          <i data-lucide="timer" class="w-4 h-4 text-cyan-400"></i>
        </div>
        <div id="sla-timer-display" class="text-xl font-black text-cyan-400 font-mono">00:42:15</div>
        <div class="text-[11px] text-slate-400 mt-1">Tempo desde o acionamento</div>
      </div>
    `;
  },

  renderTimeline(inc) {
    const container = document.getElementById('timeline-logs-container');
    if (!container) return;

    container.innerHTML = (inc.dispatchLog || []).map(log => `
      <div class="flex items-start gap-3 relative pb-4 border-l border-slate-800 ml-3 pl-4 last:border-l-0">
        <div class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500"></div>
        <div class="flex-1">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="font-bold text-white">${log.target}</span>
            <span class="font-mono text-[11px] text-slate-400">${log.timestamp}</span>
          </div>
          <div class="flex items-center gap-2 text-[11px]">
            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">${log.protocol}</span>
            <span class="text-slate-400">Status: <strong class="text-emerald-400">${log.status}</strong></span>
          </div>
        </div>
      </div>
    `).join('') || '<p class="text-xs text-slate-500">Nenhum evento registrado.</p>';
  },

  renderChecklistSummary(inc) {
    const container = document.getElementById('dashboard-checklist-summary');
    if (!container) return;

    const items = [
      { key: 'driverSafe', label: 'Motorista & Tripulação em Segurança' },
      { key: 'signalized', label: 'Via devidamente sinalizada a 200m' },
      { key: 'isolated', label: 'Perímetro isolado contra curiosos / fontes de fogo' },
      { key: 'cargoInspected', label: 'Vistoria inicial de lacres e avarias da carga' },
      { key: 'insurerNotified', label: 'Seguradora comunicada com nÂº de protocolo' },
      { key: 'cetesbNotified', label: 'Órgão ambiental notificado (se HazMat)' },
      { key: 'evidencePreserved', label: 'Evidências fotográficas e tacógrafo coletados' },
      { key: 'transshipmentReady', label: 'Veículo substituto e guincho posicionados' }
    ];

    const completed = items.filter(it => inc.checklists[it.key]).length;
    const progress = Math.round((completed / items.length) * 100);

    container.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div>
          <h4 class="font-bold text-white text-sm">Progresso do PAAC (Golden Hour)</h4>
          <p class="text-xs text-slate-400">${completed} de ${items.length} etapas críticas concluídas</p>
        </div>
        <div class="text-right font-black text-lg text-blue-400">${progress}%</div>
      </div>
      <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
        <div class="bg-blue-500 h-full rounded-full transition-all duration-500" style="width: ${progress}%"></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        ${items.map(it => `
          <div onclick="appState.toggleChecklist('${it.key}')" class="flex items-center gap-2 p-2.5 rounded-xl border ${inc.checklists[it.key] ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'} cursor-pointer transition-all">
            <div class="w-5 h-5 rounded-md flex items-center justify-center border ${inc.checklists[it.key] ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700'}">
              ${inc.checklists[it.key] ? 'âœ“' : ''}
            </div>
            <span class="text-xs font-medium select-none truncate">${it.label}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 z-50 bg-slate-900 border border-blue-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce';
    toast.innerHTML = `
      <div class="w-2 h-2 rounded-full bg-blue-500"></div>
      <span class="text-xs font-bold">${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) searchInput.focus();
      }
    });

    const globalSearchInput = document.getElementById('global-search-input');
    const predictiveDropdown = document.getElementById('predictive-search-dropdown');
    
    if (globalSearchInput && predictiveDropdown) {
      const predefinedModules = [
        { title: 'Painel Central', keywords: ['painel', 'dashboard', 'inicio', 'home'], tab: 'dashboard', icon: 'layout-dashboard' },
        { title: 'Construtor de Plano Logístico', keywords: ['plano', 'logistico', 'construir', 'novo'], tab: 'wizard', icon: 'map' },
        { title: 'Catálogo ONU (HazMat)', keywords: ['onu', 'produto', 'perigoso', 'catalogo', 'hazmat'], tab: 'docs', icon: 'book' },
        { title: 'Inteligência Artificial Preditiva', keywords: ['ia', 'preditiva', 'inteligencia', 'artificial', 'previsao'], tab: 'ai-plan', icon: 'bot' },
        { title: 'Histórico Geral', keywords: ['historico', 'salvos', 'antigos', 'passado', 'ocorrências', 'ocorrencias'], tab: 'history', icon: 'history' },
        { title: 'Planos Salvos', keywords: ['planos', 'salvos', 'guardados', 'meus'], tab: 'saved-plans', icon: 'save' },
      ];

      document.addEventListener('click', (e) => {
        if (!globalSearchInput.contains(e.target) && !predictiveDropdown.contains(e.target)) {
          predictiveDropdown.classList.add('hidden');
        }
      });

      globalSearchInput.addEventListener('focus', () => {
        if (globalSearchInput.value.length > 0) predictiveDropdown.classList.remove('hidden');
      });

      globalSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length === 0) {
          predictiveDropdown.classList.add('hidden');
          return;
        }
        
        predictiveDropdown.classList.remove('hidden');
        let resultsHTML = '';

        const matchedModules = predefinedModules.filter(m => 
          m.title.toLowerCase().includes(query) || m.keywords.some(k => k.includes(query))
        );

        if (matchedModules.length > 0) {
          resultsHTML += `<div class="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 border-b border-slate-800">Módulos & Ferramentas</div>`;
          matchedModules.forEach(m => {
            resultsHTML += `
              <div class="px-4 py-3 hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-800/50" onclick="App.switchTab('${m.tab}'); document.getElementById('predictive-search-dropdown').classList.add('hidden'); document.getElementById('global-search-input').value = '';">
                <div class="bg-blue-500/10 p-2 rounded-lg">
                  <i data-lucide="${m.icon}" class="w-4 h-4 text-blue-400"></i>
                </div>
                <div>
                  <h4 class="text-sm font-bold text-slate-200">${m.title}</h4>
                  <p class="text-[10px] text-slate-500">Ir para o módulo</p>
                </div>
              </div>
            `;
          });
        }

        if (typeof searchHazmatList === 'function') {
          const matchedProducts = searchHazmatList(query).slice(0, 5);
          if (matchedProducts.length > 0) {
            resultsHTML += `<div class="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 border-b border-slate-800 border-t">Catálogo ONU</div>`;
            matchedProducts.forEach(p => {
              resultsHTML += `
                <div class="px-4 py-3 hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-800/50" onclick="App.switchTab('docs'); setTimeout(() => { const hInput = document.getElementById('hazmat-search-input'); if(hInput) { hInput.value = '${p.onu}'; hInput.dispatchEvent(new Event('input')); } }, 100); document.getElementById('predictive-search-dropdown').classList.add('hidden'); document.getElementById('global-search-input').value = '';">
                  <div class="bg-orange-500/10 p-2 rounded-lg text-center leading-tight">
                    <span class="text-[10px] font-mono font-bold text-orange-400">ONU<br/>${p.onu}</span>
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <h4 class="text-xs font-bold text-slate-200 truncate">${p.nome}</h4>
                    <p class="text-[10px] text-slate-500">Classe ${p.classe}</p>
                  </div>
                </div>
              `;
            });
          }
        }

        const savedPlansStr = localStorage.getItem('general_saved_plans');
        if (savedPlansStr) {
          try {
            const savedPlans = JSON.parse(savedPlansStr);
            const matchedPlans = savedPlans.filter(p => {
               if (p.id.toLowerCase().includes(query)) return true;
               if (p.client && p.client.toLowerCase().includes(query)) return true;
               if (p.data && p.data.driverName && p.data.driverName.toLowerCase().includes(query)) return true;
               return false;
            }).slice(0, 3);
            if (matchedPlans.length > 0) {
              resultsHTML += `<div class="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 border-b border-slate-800 border-t">Planos Salvos</div>`;
              matchedPlans.forEach(p => {
                resultsHTML += `
                  <div class="px-4 py-3 hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-800/50" onclick="App.switchTab('saved-plans'); document.getElementById('predictive-search-dropdown').classList.add('hidden'); document.getElementById('global-search-input').value = '';">
                    <div class="bg-blue-500/10 p-2 rounded-lg text-center leading-tight">
                      <i data-lucide="save" class="w-4 h-4 text-blue-400"></i>
                    </div>
                    <div class="flex-1 overflow-hidden">
                      <h4 class="text-xs font-bold text-slate-200 truncate">${p.id}</h4>
                      <p class="text-[10px] text-slate-500">${p.client || 'Cliente não informado'}</p>
                    </div>
                  </div>
                `;
              });
            }
          } catch(e) {}
        }

        if (typeof appState !== 'undefined' && appState.incidents && appState.incidents.length > 0) {
          const matchedIncidents = appState.incidents.filter(inc => {
             if (inc.id.toLowerCase().includes(query)) return true;
             if (inc.city && inc.city.toLowerCase().includes(query)) return true;
             if (inc.driverName && inc.driverName.toLowerCase().includes(query)) return true;
             return false;
          }).slice(0, 3);
          
          if (matchedIncidents.length > 0) {
              resultsHTML += `<div class="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 border-b border-slate-800 border-t">Histórico (Ocorrências)</div>`;
              matchedIncidents.forEach(inc => {
                resultsHTML += `
                  <div class="px-4 py-3 hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-800/50" onclick="App.switchTab('history'); document.getElementById('predictive-search-dropdown').classList.add('hidden'); document.getElementById('global-search-input').value = '';">
                    <div class="bg-rose-500/10 p-2 rounded-lg text-center leading-tight">
                      <i data-lucide="history" class="w-4 h-4 text-rose-400"></i>
                    </div>
                    <div class="flex-1 overflow-hidden">
                      <h4 class="text-xs font-bold text-slate-200 truncate">${inc.id}</h4>
                      <p class="text-[10px] text-slate-500">${inc.city || ''} / ${inc.status}</p>
                    </div>
                  </div>
                `;
              });
          }
        }

        if (resultsHTML === '') {
          resultsHTML = `<div class="px-4 py-6 text-center text-slate-500 text-xs">Nenhum resultado encontrado para "${query}"</div>`;
        }

        predictiveDropdown.innerHTML = resultsHTML;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    }

    const hazmatInput = document.getElementById('hazmat-search-input');
    if (hazmatInput) {
      hazmatInput.addEventListener('input', (e) => {
        const query = e.target.value;
        const container = document.getElementById('hazmat-grid-container');
        if (!container) return;
        const filtered = searchHazmatList(query);
        container.innerHTML = filtered.map(h => `
          <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-orange-500/50 transition-all group">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 font-mono font-black flex flex-col items-center justify-center">
                  <span class="text-[10px] uppercase tracking-tight text-orange-300">ONU</span>
                  <span class="text-sm leading-none">${h.onu}</span>
                </div>
                <div>
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">${h.classe}</span>
                  <h3 class="font-bold text-white text-sm mt-1 group-hover:text-orange-400 transition-colors">${h.nome}</h3>
                </div>
              </div>
              <div class="text-right font-mono text-xs text-slate-400">
                <div>Risco: <strong class="text-white">${h.numRisco}</strong></div>
                <div>Guia: <strong class="text-blue-400">${h.guia}</strong></div>
              </div>
            </div>
            <p class="text-xs text-slate-400 mb-3 line-clamp-2">${h.perigoFogo}</p>
            <button onclick="App.applyHazmatToIncident('${h.onu}')" class="w-full py-2 bg-slate-800 hover:bg-orange-600 hover:text-white text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
              Aplicar Ã  Ocorrência Atual
            </button>
          </div>
        `).join('') || '<p class="text-xs text-slate-500 col-span-full">Nenhum produto perigoso encontrado.</p>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    }
  },

  /* =======================================================
   * DOCUMENTAÇÃƒO & LAUDOS
   * ======================================================= */
  renderDocsTab() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;
    
    const parecerEl = document.getElementById('docs-parecer');
    if (parecerEl) {
      parecerEl.value = inc.parecerTecnico || '';
    }
    
    const statusEl = document.getElementById('docs-parecer-status');
    if (statusEl) {
      statusEl.textContent = inc.parecerTecnico ? 'Salvo automaticamente' : 'Nenhum parecer salvo';
    }
    
    this.renderDocsList();
  },
  
  renderDocsList() {
    const inc = appState.getCurrentIncident();
    const container = document.getElementById('docs-list');
    if (!container || !inc) return;
    
    const docs = inc.documents || [];
    if (docs.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-500 text-center py-2">Nenhum documento anexado ainda.</p>';
      return;
    }
    
    container.innerHTML = docs.map(doc => `
      <div class="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
        <div class="flex items-center gap-2">
          <i data-lucide="${doc.type === 'image' ? 'image' : 'file-text'}" class="w-4 h-4 text-slate-400"></i>
          <div>
            <div class="text-xs font-bold text-slate-200">${doc.name}</div>
            <div class="text-[10px] text-slate-500">${doc.size}</div>
          </div>
        </div>
        <button onclick="App.deleteDocument('${doc.id}')" class="text-rose-400 hover:text-rose-300 transition-colors p-1">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },
  
  saveParecer() {
    const inc = appState.getCurrentIncident();
    const parecerEl = document.getElementById('docs-parecer');
    const statusEl = document.getElementById('docs-parecer-status');
    
    if (inc && parecerEl) {
      inc.parecerTecnico = parecerEl.value;
      appState.save();
      if (statusEl) {
        statusEl.textContent = 'Salvo em ' + new Date().toLocaleTimeString();
        statusEl.classList.add('text-emerald-400');
        setTimeout(() => statusEl.classList.remove('text-emerald-400'), 2000);
      }
    }
  },
  
  generateParecerComIA() {
    const inc = appState.getCurrentIncident();
    if (!inc) return;
    
    this.showToast("IA gerando rascunho de parecer técnico...");
    setTimeout(() => {
      const parecerEl = document.getElementById('docs-parecer');
      if (parecerEl) {
        parecerEl.value = `PARECER TÉCNICO PRELIMINAR - GERADO POR IA\n\nData do Sinistro: ${new Date(inc.createdAt).toLocaleString()}\nLocal: ${inc.road} - ${inc.city}\nVeículo: ${inc.plate}\nCarga: ${inc.cargoDescription}\n\nConforme análise dos dados telemétricos e registros preenchidos, o evento ocorreu sob condições adversas. O transbordo foi acionado e as medidas de mitigação ambiental foram tomadas em tempo hábil. Atesta-se que a equipe seguiu o protocolo Golden Hour para isolamento do perímetro.`;
        this.saveParecer();
      }
    }, 1500);
  },
  
  handleFileUpload(event) {
    const inc = appState.getCurrentIncident();
    if (!inc) return;
    
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const docs = inc.documents ? [...inc.documents] : [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Calculate human readable size
      let size = file.size;
      let sizeStr = size + ' B';
      if (size > 1024 * 1024) {
        sizeStr = (size / (1024 * 1024)).toFixed(1) + ' MB';
      } else if (size > 1024) {
        sizeStr = (size / 1024).toFixed(1) + ' KB';
      }
      
      // Determine type
      const type = file.type.startsWith('image/') ? 'image' : 'pdf';
      
      docs.push({
        id: Date.now().toString() + i,
        name: file.name,
        size: sizeStr,
        type: type
      });
    }
    
    appState.updateCurrentIncident({ documents: docs });
    this.renderDocsList();
    this.showToast(files.length > 1 ? `${files.length} arquivos anexados com sucesso!` : "Arquivo anexado com sucesso!");
    
    // Reset the input so the same file can be uploaded again if deleted
    event.target.value = '';
  },
  
  deleteDocument(id) {
    const inc = appState.getCurrentIncident();
    if (!inc || !inc.documents) return;
    
    const docs = inc.documents.filter(d => d.id !== id);
    appState.updateCurrentIncident({ documents: docs });
    this.renderDocsList();
  },

  /* =======================================================
   * PASSO A PASSO / SOP
   * ======================================================= */
  showStepByStep(viewId) {
    const modal = document.getElementById('step-modal');
    const content = document.getElementById('step-modal-content');
    const title = document.getElementById('step-modal-title');
    if (!modal || !content || !title) return;

    const sops = {
      'docs': {
        title: 'Como Proceder: Gestão Documental',
        steps: [
          '<strong>1. Coleta Inicial:</strong> Obtenha o Boletim de Ocorrência (B.O.) da Polícia Rodoviária assim que for liberado.',
          '<strong>2. Registro Fotográfico:</strong> Solicite Ã  equipe de campo fotos amplas do local, do veículo tombado/sinistrado e de possíveis danos ambientais (vazamentos).',
          '<strong>3. Anexos Importantes:</strong> Realize o upload destes documentos (PDF, JPG) na seção "Anexar Laudos e Fotos".',
          '<strong>4. Parecer do Gestor:</strong> Utilize o campo de "Parecer Técnico" para redigir a justificativa técnica. Você pode utilizar o botão "Esboço com IA" para gerar um texto base a partir das informações já preenchidas no sistema.',
          '<strong>5. Finalização:</strong> Certifique-se de salvar o parecer. Esta documentação será essencial na emissão do Dossiê PDF final.'
        ]
      },
      'planner': {
        title: 'Como Proceder: Planejador Logístico',
        steps: [
          '<strong>1. Preenchimento:</strong> Insira os dados reais da viagem (origem, destino, motorista, carga).',
          '<strong>2. Auditoria IA:</strong> A Inteligência Artificial fará a leitura preditiva e retornará os alertas de perigo.',
          '<strong>3. Otimização:</strong> Clique em "Reformular com IA" para que o sistema ajuste os horários e parâmetros, tornando a viagem 100% Segura.',
          '<strong>4. Briefing:</strong> Exporte o briefing revisado para entregar ao motorista.'
        ]
      },
      'dashboard': {
        title: 'Como Proceder: Dashboard & Mapa',
        steps: [
          '<strong>1. Abertura:</strong> Em caso de acidente, clique no botão superior "Nova Ocorrência".',
          '<strong>2. Mapa e Raio:</strong> O mapa será centrado no acidente, desenhando automaticamente o Raio de Isolamento Tático (em caso de produtos perigosos).',
          '<strong>3. Ação Imediata:</strong> Navegue pelas demais abas para acionar resgate, investigar a causa, preencher laudos e notificar a seguradora.'
        ]
      },
      'default': {
        title: 'Guia de Operação',
        steps: [
          'Siga as instruções exibidas na tela para preencher os dados.',
          'Em caso de dúvida técnica ou procedimental, acione a aba "Copilot Tático 24h".'
        ]
      }
    };

    const data = sops[viewId] || sops['default'];
    title.textContent = data.title;
    
    content.innerHTML = data.steps.map(step => `
      <div class="flex items-start gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
        <i data-lucide="check-circle-2" class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"></i>
        <p class="text-slate-300 text-sm leading-relaxed">${step}</p>
      </div>
    `).join('');

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeStepModal() {
    const modal = document.getElementById('step-modal');
    if (modal) modal.classList.add('hidden');
  },

  /* =======================================================
   * PERFIL DO USUÁRIO
   * ======================================================= */
  openProfileModal() {
    if (!appState.currentUser) return;
    
    document.getElementById('profile-name').value = appState.currentUser.name || '';
    document.getElementById('profile-company').value = appState.currentUser.company || '';
    document.getElementById('profile-role').value = appState.currentUser.role || '';
    if (document.getElementById('profile-email')) document.getElementById('profile-email').value = appState.currentUser.email || '';
    if (document.getElementById('profile-phone')) document.getElementById('profile-phone').value = appState.currentUser.phone || '';
    
    const showCopilotCb = document.getElementById('profile-show-copilot');
    if (showCopilotCb) {
      showCopilotCb.checked = localStorage.getItem('disable_copilot_helper') !== 'true';
    }
    
    // Foto
    const photoPreview = document.getElementById('profile-photo-preview');
    const photoPlaceholder = document.getElementById('profile-photo-placeholder');
    if (photoPreview && photoPlaceholder) {
      if (appState.currentUser.photo) {
        photoPreview.src = appState.currentUser.photo;
        photoPreview.classList.remove('hidden');
        photoPlaceholder.classList.add('hidden');
      } else {
        photoPreview.src = '';
        photoPreview.classList.add('hidden');
        photoPlaceholder.classList.remove('hidden');
      }
    }
    
    document.getElementById('profile-modal').classList.remove('hidden');
    document.getElementById('profile-modal').classList.add('flex');
  },

  closeProfileModal() {
    document.getElementById('profile-modal').classList.add('hidden');
  },
  
  openAppRating() {
    alert("Obrigado por usar o GENERAL! Em breve você será redirecionado para a loja de aplicativos para nos avaliar.");
  },

  handleProfilePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const photoPreview = document.getElementById('profile-photo-preview');
      const photoPlaceholder = document.getElementById('profile-photo-placeholder');
      
      if (photoPreview && photoPlaceholder) {
        photoPreview.src = dataUrl;
        photoPreview.classList.remove('hidden');
        photoPlaceholder.classList.add('hidden');
      }
      
      if (appState.currentUser) {
        appState.currentUser.photo = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  },

  closeProfileModal() {
    document.getElementById('profile-modal').classList.add('hidden');
    document.getElementById('profile-modal').classList.remove('flex');
  },

  saveProfile() {
    if (!appState.currentUser) return;
    
    const newName = document.getElementById('profile-name').value;
    const newCompany = document.getElementById('profile-company').value;
    const newRole = document.getElementById('profile-role').value;
    const newCnpj = document.getElementById('profile-cnpj') ? document.getElementById('profile-cnpj').value : '';
    const newEmail = document.getElementById('profile-email') ? document.getElementById('profile-email').value : '';
    const newPhone = document.getElementById('profile-phone') ? document.getElementById('profile-phone').value : '';
    
    if (newName && newCompany && newRole) {
      appState.currentUser.name = newName;
      appState.currentUser.company = newCompany;
      if (newCnpj) appState.currentUser.companyCnpj = newCnpj;
      
      if (window.db && newCompany) {
          let cDoc = newCnpj ? newCnpj : newCompany;
          window.db.collection('companies').doc(cDoc).set({ name: newCompany, cnpj: newCnpj }).catch(console.error);
      }

      appState.currentUser.role = newRole;
      appState.currentUser.email = newEmail;
      appState.currentUser.phone = newPhone;
      
      localStorage.setItem('general_user', JSON.stringify(appState.currentUser));
      
      if (window.db) {
          let uid = appState.currentUser.email || appState.currentUser.id;
          window.db.collection('users').doc(uid).set(appState.currentUser).catch(console.error);
      }
      this.showToast('Dados salvos com sucesso!');
      const modal = document.getElementById('profile-modal');
      if (modal) modal.classList.add('hidden');
      
      const showCopilotCb = document.getElementById('profile-show-copilot');
      if (showCopilotCb) {
        if (!showCopilotCb.checked) {
          localStorage.setItem('disable_copilot_helper', 'true');
          const helper = document.getElementById('floating-copilot-helper');
          if (helper) helper.classList.add('hidden');
        } else {
          localStorage.removeItem('disable_copilot_helper');
        }
      }

      this.checkAuth();
      this.closeProfileModal();
      this.showToast('âœ… Perfil atualizado com sucesso!');
    } else {
      this.showToast('Preencha todos os campos do perfil.');
    }
  },

  renderDocsTab() {
    const select = document.getElementById('docs-incident-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione uma ocorrência ativa...</option>';
    
    const activeIncidents = appState.incidents.filter(inc => inc.status !== 'CONCLUIDA');
    activeIncidents.forEach(inc => {
      const opt = document.createElement('option');
      opt.value = inc.id;
      opt.textContent = `${inc.id} - ${inc.title}`;
      if (appState.currentIncidentId === inc.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
    
    this.loadParecerForSelectedIncident();
  },

  loadParecerForSelectedIncident() {
    const select = document.getElementById('docs-incident-select');
    const textArea = document.getElementById('docs-parecer');
    const attachmentName = document.getElementById('docs-attachment-name');
    
    if (!select || !textArea) return;
    
    const incidentId = select.value;
    if (!incidentId) {
      textArea.value = '';
      if(attachmentName) attachmentName.textContent = '';
      return;
    }
    
    const incident = appState.incidents.find(inc => inc.id === incidentId);
    if (incident) {
      textArea.value = incident.docsParecer || '';
      if(attachmentName) attachmentName.textContent = incident.docsAttachmentName || '';
    }
  },

  saveParecer() {
    const select = document.getElementById('docs-incident-select');
    const textArea = document.getElementById('docs-parecer');
    if (!select || !textArea) return;
    
    const incidentId = select.value;
    if (!incidentId) {
      return;
    }
    
    appState.setCurrentIncident(incidentId);
    appState.updateCurrentIncident({ docsParecer: textArea.value });
    
    const statusEl = document.getElementById('docs-parecer-status');
    if (statusEl) {
      statusEl.textContent = 'Salvando...';
      setTimeout(() => {
        statusEl.textContent = 'Salvo automaticamente';
      }, 1000);
    }
  },

  handleParecerAttachment(inputElement) {
    if (inputElement.files && inputElement.files[0]) {
      const file = inputElement.files[0];
      const select = document.getElementById('docs-incident-select');
      
      if (!select || !select.value) {
        this.showToast('Erro: Selecione uma ocorrência antes de anexar.', 'error');
        inputElement.value = ''; 
        return;
      }
      
      appState.setCurrentIncident(select.value);
      appState.updateCurrentIncident({ docsAttachmentName: file.name });
      
      const attachmentName = document.getElementById('docs-attachment-name');
      if (attachmentName) attachmentName.textContent = file.name;
      
      this.showToast('Laudo anexado com sucesso.', 'success');
    }
  },
  
  generateParecerComIA() {
    const textArea = document.getElementById('docs-parecer');
    if (!textArea) return;
    
    const select = document.getElementById('docs-incident-select');
    if (!select || !select.value) {
      this.showToast('Selecione uma ocorrência primeiro.', 'error');
      return;
    }

    if (!textArea.value || textArea.value.trim().length < 10) {
      this.showToast('O texto está muito curto para correção ortográfica.', 'error');
      return;
    }
    
    const currentText = textArea.value;
    textArea.value = "Corrigindo ortografia com IA...";
    
    setTimeout(() => {
      let fixedText = currentText.charAt(0).toUpperCase() + currentText.slice(1);
      if (!fixedText.endsWith('.')) fixedText += '.';
      textArea.value = fixedText + '\\n\\n[Correção ortográfica aplicada pela IA]';
      this.saveParecer();
      this.showToast('Correção aplicada com sucesso!', 'success');
    }, 1500);
  },

  /* =======================================================
   * PLANOS LOGÍSTICOS SALVOS
   * ======================================================= */
  renderSavedPlansTab() {
    const container = document.getElementById('saved-plans-container');
    if (!container) return;

    appState.savedPlans = JSON.parse(localStorage.getItem('general_saved_plans') || '[]');
    
    if (appState.savedPlans.length === 0) {
      container.innerHTML = `
        <div class="col-span-1 md:col-span-2 flex flex-col items-center justify-center p-12 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <i data-lucide="database" class="w-12 h-12 text-slate-700 mb-4"></i>
          <h3 class="text-lg font-bold text-slate-300">Nenhum Plano Salvo</h3>
          <p class="text-sm text-slate-500 mt-2 text-center max-w-md">Os planos logísticos aprovados na aba "Plano Logístico & IA" aparecerão aqui. Eles são necessários para abrir novas ocorrências.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    container.innerHTML = appState.savedPlans.map((plan, index) => {
      if (plan.type === 'ACAO') {
        return `
          <div class="bg-slate-900/60 border-2 border-emerald-500/50 hover:border-emerald-400 rounded-2xl p-5 transition-all group shadow-lg shadow-emerald-900/20">
            <div class="flex items-start justify-between mb-3">
              <div>
                <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full uppercase border border-emerald-500/30">PLANO DE AÇÃƒO TÁTICO</span>
                <h3 class="font-bold text-white text-sm mt-2">[${plan.id}] Ação Tática</h3>
                <p class="text-[11px] text-slate-400">Vinculado a: ${plan.linkedLogisticsPlan}</p>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-[10px]">
              <span class="text-slate-500">${plan.date ? new Date(plan.date).toLocaleString() : 'N/A'}</span>
              <span class="text-emerald-400 font-semibold flex items-center gap-1">
                <i data-lucide="check-circle" class="w-3 h-3"></i> Aprovado
              </span>
            </div>
            <div class="mt-4 flex flex-col gap-2">
              <button onclick="App.downloadSavedActionPlanPDF('${plan.id}')" class="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 border border-slate-700">
                <i data-lucide="file-text" class="w-3 h-3 text-emerald-400"></i> Ver PDF (Plano Tático)
              </button>
            </div>
          </div>
        `;
      } else {
        const borderColor = plan.hasIncident ? 'border-rose-500/50 hover:border-rose-400 shadow-rose-900/20' : 'border-blue-500/50 hover:border-blue-400 shadow-blue-900/20';
        const statusBadge = plan.hasIncident 
          ? '<span class="text-[10px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full uppercase border border-rose-500/30">OCORRÃŠNCIA REGISTRADA</span>'
          : '<span class="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full uppercase border border-blue-500/30">PLANO SEM INCIDENTES</span>';
        
        return `
        <div class="bg-slate-900/60 border-2 ${borderColor} rounded-2xl p-5 transition-all flex flex-col justify-between shadow-lg">
          <div>
            <div class="flex items-start justify-between mb-3">
              <div>
                ${statusBadge}
                <h3 class="font-bold text-white text-sm mt-2">${plan.id ? `[${plan.id}] ` : ''}${plan.client || 'Cliente Padrão'}</h3>
                <p class="text-[11px] text-slate-400">Origem: ${plan.origin} | Destino: ${plan.destination}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-4 text-[11px]">
              <div class="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span class="text-slate-500 block mb-0.5">Produto:</span>
                <span class="font-bold text-slate-300">${plan.product || 'Não especificado'}</span>
              </div>
              <div class="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span class="text-slate-500 block mb-0.5">Aprovado por:</span>
                <span class="font-bold text-slate-300">${plan.approvedBy || 'Aprovador Autorizado'}</span>
              </div>
            </div>
            <div class="mt-4 flex flex-col gap-2">
              <button onclick="App.downloadHistoryPlanPDF('${plan.id}')" class="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 border border-slate-700">
                <i data-lucide="file-text" class="w-3 h-3 text-blue-400"></i> Ver PDF (Plano Logístico)
              </button>
              ${plan.hasIncident ? `
              <button onclick="App.showToast('Visualizando PDF do Plano Prescritivo...', 'info')" class="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 border border-slate-700">
                <i data-lucide="brain-circuit" class="w-3 h-3 text-cyan-400"></i> Ver PDF (Plano Prescritivo)
              </button>
              <button onclick="App.showToast('Visualizando PDF do Plano de Transbordo...', 'info')" class="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 border border-slate-700">
                <i data-lucide="truck" class="w-3 h-3 text-emerald-400"></i> Ver PDF (Plano Operacional)
              </button>
              ` : `
              <button onclick="App.openProviderEvaluationModal('${plan.id}')" class="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)] mb-2">
                <i data-lucide="star" class="w-3 h-3"></i> Avaliação de Desempenho (5 Estrelas)
              </button>
              <button onclick="App.openRouteEvaluationModal('${plan.id}')" class="w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                <i data-lucide="map" class="w-3 h-3"></i> Avaliar Rota
              </button>
              `}
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-[10px]">
            <span class="text-slate-500">${plan.date ? new Date(plan.date).toLocaleString() : 'N/A'}</span>
            <span class="${plan.data?.isOptimized ? 'text-cyan-400' : 'text-slate-400'} font-semibold flex items-center gap-1">
              ${plan.data?.isOptimized ? '<i data-lucide="sparkles" class="w-3 h-3"></i> Otimizado' : 'Original'}
            </span>
          </div>
        </div>
      `
      }
    }).reverse().join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  applySavedPlan(index) {
    if (!appState.savedPlans || !appState.savedPlans[index]) return;
    const plan = appState.savedPlans[index];
    appState.activePlan = plan;
    this.showToast('Plano aplicado. Você já pode criar uma nova ocorrência.', 'success');
    this.switchTab('dashboard');
  },

  openProviderEvaluationModal(planId) {
    const modal = document.getElementById('provider-evaluation-modal');
    if (!modal) return;
    document.getElementById('eval-plan-id').value = planId;
    document.getElementById('eval-rating').value = "5";
    document.getElementById('eval-comments').value = "";
    document.getElementById('eval-alert-preview').classList.add('hidden');
    
    // Add event listener to select to show warning if rating < 3
    const select = document.getElementById('eval-rating');
    select.onchange = (e) => {
      const val = parseInt(e.target.value);
      if (val < 3) {
        document.getElementById('eval-alert-preview').classList.remove('hidden');
      } else {
        document.getElementById('eval-alert-preview').classList.add('hidden');
      }
    };
    
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeProviderEvaluationModal() {
    const modal = document.getElementById('provider-evaluation-modal');
    if (modal) modal.classList.add('hidden');
  },

  saveProviderEvaluation() {
    const rating = document.getElementById('eval-rating').value;
    const comments = document.getElementById('eval-comments').value;
    const planId = document.getElementById('eval-plan-id').value;
    
    // Find plan to get carrier name
    let plan = null;
    if (appState && appState.savedPlans) {
      plan = appState.savedPlans.find(p => p.id === planId);
    } else {
      let savedPlans = JSON.parse(localStorage.getItem('general_saved_plans') || '[]');
      plan = savedPlans.find(p => p.id === planId);
    }
    
    if (!plan || !plan.carrierName) {
      this.showToast('Erro: Transportadora não encontrada no plano.', 'error');
      return;
    }
    
    const carrierKey = `carrier_eval_${plan.carrierName}`;
    const newEval = {
      carrier: plan.carrierName,
      date: new Date().toISOString(),
      score: parseInt(rating),
      comments: comments
    };
    
    let evals = JSON.parse(localStorage.getItem(carrierKey) || '[]');
    evals.push(newEval);
    localStorage.setItem(carrierKey, JSON.stringify(evals));
    
    if (window.db) {
      window.db.collection('carrier_evaluations').add(newEval).catch(e => console.error("Firebase err:", e));
    }
    
    this.showToast(`Avaliação salva! Transportadora ${plan.carrierName} reavaliada com nota ${rating}.`);
    this.closeProviderEvaluationModal();
  },

  
  viewRouteEvaluationsHistory() {
    const origin = document.getElementById('plan-origin-city')?.value || '';
    const dest = document.getElementById('plan-dest-city')?.value || '';
    
    if (!origin || !dest) {
      this.showToast('Preencha a origem e destino (cidade) para ver as avaliações da rota.', 'warning');
      return;
    }
    
    const key = `route_eval_${origin}_${dest}`;
    const saved = localStorage.getItem(key);
    const container = document.getElementById('route-eval-history-list');
    
    if (!saved) {
      container.innerHTML = '<div class="text-slate-400 text-xs text-center py-4">Nenhuma avaliação encontrada para esta rota no histórico.</div>';
    } else {
      try {
        const evals = JSON.parse(saved);
        if (evals.length === 0) {
          container.innerHTML = '<div class="text-slate-400 text-xs text-center py-4">Nenhuma avaliação encontrada.</div>';
        } else {
          container.innerHTML = evals.map(e => `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-emerald-400">${e.score} Estrelas</span>
                <span class="text-[10px] text-slate-500">${new Date(e.date).toLocaleDateString()}</span>
              </div>
              <p class="text-xs text-slate-300 italic">"${e.comments || 'Sem comentários adicionais.'}"</p>
            </div>
          `).join('');
        }
      } catch (e) {
        container.innerHTML = '<div class="text-rose-400 text-xs text-center py-4">Erro ao carregar avaliações.</div>';
      }
    }
    
    document.getElementById('route-eval-history-modal').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  },

  openRouteEvaluationModal(planId) {
    const plan = appState.savedPlans.find(p => p.id === planId);
    if (!plan) return;
    
    document.getElementById('route-eval-origin').value = plan.origin;
    document.getElementById('route-eval-dest').value = plan.destination;
    
    this.setRouteStar(0);
    document.getElementById('route-eval-comments').value = "";
    document.getElementById('route-eval-modal').classList.remove('hidden');
  },
  
  setRouteStar(starCount) {
    document.getElementById('route-eval-score').value = starCount;
    const stars = document.querySelectorAll('.route-star');
    stars.forEach((btn, index) => {
      if (index < starCount) {
        btn.classList.add('text-emerald-400');
        btn.classList.remove('text-slate-600');
      } else {
        btn.classList.remove('text-emerald-400');
        btn.classList.add('text-slate-600');
      }
    });
  },

  saveRouteEvaluation() {
    const origin = document.getElementById('route-eval-origin').value;
    const dest = document.getElementById('route-eval-dest').value;
    const score = document.getElementById('route-eval-score').value;
    const comments = document.getElementById('route-eval-comments').value;
    
    if (score == 0) {
      this.showToast('Por favor, dê uma nota de 1 a 5 para a rodovia.', 'error');
      return;
    }

    const key = `route_eval_${origin}_${dest}`;
    const newEval = {
      origin: origin,
      dest: dest,
      date: new Date().toISOString(),
      score: parseInt(score),
      comments: comments
    };
    
    let evaluations = JSON.parse(localStorage.getItem(key) || '[]');
    evaluations.push(newEval);
    localStorage.setItem(key, JSON.stringify(evaluations));
    
    if (window.db) {
      window.db.collection('route_evaluations').add(newEval).catch(e => console.error("Firebase err:", e));
    }
    
    document.getElementById('route-eval-modal').classList.add('hidden');
    this.showToast('Avaliação de rota salva com sucesso! Os próximos planos nessa rota serão alertados.', 'success');
  },

  /* =======================================================
   * DASHBOARD
   * ======================================================= */
  _generatePDFFromHTML(htmlString, filename) {
    if (typeof html2pdf === 'undefined') {
      this.showToast('Módulo de PDF não carregado!', 'error');
      return;
    }
    const container = document.createElement('div');
    container.innerHTML = htmlString;
    const opt = {
      margin:       10,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Hybrid approach: Capacitor Native Share or Web Download
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        this.showToast('Gerando PDF nativo...', 'info');
        html2pdf().from(container).set(opt).outputPdf('datauristring').then(async (pdfBase64) => {
            try {
                const base64Data = pdfBase64.split(',')[1];
                const result = await window.Capacitor.Plugins.Filesystem.writeFile({
                    path: opt.filename,
                    data: base64Data,
                    directory: 'CACHE'
                });
                
                await window.Capacitor.Plugins.Share.share({
                    title: 'Documento PDF',
                    text: 'Aqui está o seu PDF.',
                    url: result.uri,
                    dialogTitle: 'Salvar ou Compartilhar PDF'
                });
                
                this.showToast('PDF gerado e pronto para compartilhamento!', 'success');
            } catch (e) {
                console.error("Erro Capacitor Filesystem/Share:", e);
                this.showToast('Erro ao exportar PDF no Android. Use a versão Web.', 'error');
            }
        });
    } else {
        html2pdf().from(container).set(opt).save();
        this.showToast('Download do PDF iniciado!', 'success');
    }
  },

  downloadPlanPDF(planData = null) {
    
    const getVal = (key, id, fallback = 'Não preenchido') => {
      if (planData) return planData[key] || fallback;
      return document.getElementById(id)?.value || fallback;
    };
    
    const getSelectText = (key, id, fallback = 'Não preenchido') => {
      if (planData) return planData[key] || fallback;
      const el = document.getElementById(id);
      return el?.options[el.selectedIndex]?.text || fallback;
    };

    const code = getVal('code', 'plan-code', 'Não informado');
    
    const clientName = getVal('clientName', 'plan-client-name');
    const clientContact = getVal('clientContact', 'plan-client-contact');
    const clientPhone = getVal('clientPhone', 'plan-client-phone');
    const clientEmail = getVal('clientEmail', 'plan-client-email');
    const clientNfe = getVal('clientNfe', 'plan-client-nfe');
    const insurerName = getVal('insurerName', 'plan-insurer-name');
    const insurerPhone = getVal('insurerPhone', 'plan-insurer-phone');
    const insurerEmail = getVal('insurerEmail', 'plan-insurer-email');
    const carrierName = getVal('carrierName', 'plan-carrier-name');
    const carrierCnpj = getVal('carrierCnpj', 'plan-carrier-cnpj');
    const carrierPhone = getVal('carrierPhone', 'plan-carrier-phone');
    
    const transportMode = getSelectText('vehicleType', 'plan-transport-mode');
    const cargoType = getSelectText('cargoType', 'plan-cargo-type');
    
    const product = getVal('productName', 'plan-product-name');
    const onu = getVal('onuCode', 'plan-onu');
    const volume = getVal('volume', 'plan-volume');
    const scenario = getSelectText('scenario', 'plan-scenario');
    
    const origin = planData ? planData.origin : (() => {
        const originCity = document.getElementById('plan-origin-city')?.value;
        const originState = document.getElementById('plan-origin-state')?.value;
        const originRef = document.getElementById('plan-origin-ref')?.value;
        return (originCity && originState) ? `${originRef ? originRef + ' - ' : ''}${originCity}, ${originState}` : 'Não preenchido';
    })();
    
    const dest = planData ? planData.destination : (() => {
        const destCity = document.getElementById('plan-dest-city')?.value;
        const destState = document.getElementById('plan-dest-state')?.value;
        const destRef = document.getElementById('plan-dest-ref')?.value;
        return (destCity && destState) ? `${destRef ? destRef + ' - ' : ''}${destCity}, ${destState}` : 'Não preenchido';
    })();
    
    const dist = getVal('distanceKm', 'plan-dist');
    const roads = getVal('plannedRoads', 'plan-roads');
    const depTime = planData ? (planData.departureTime ? new Date(planData.departureTime).toLocaleString('pt-BR') : 'Não preenchido') : (document.getElementById('plan-deptime')?.value ? new Date(document.getElementById('plan-deptime').value).toLocaleString('pt-BR') : 'Não preenchido');
    const deadline = planData ? (planData.deliveryDeadline ? new Date(planData.deliveryDeadline).toLocaleString('pt-BR') : 'Não preenchido') : (document.getElementById('plan-deadline')?.value ? new Date(document.getElementById('plan-deadline').value).toLocaleString('pt-BR') : 'Não preenchido');
    
    const driver = getVal('driverName', 'plan-driver');
    const tenure = getSelectText('driverTenureDays', 'plan-tenure');
    const fam = getSelectText('driverRouteFamiliarity', 'plan-fam');
    const truckFam = getSelectText('isAssignedRegularTruck', 'plan-truck-fam');
    const tankFill = getVal('tankFillPercent', 'plan-tank-fill');
    const planMode = getSelectText('driverMode', 'plan-mode');
    const tech = getVal('tech', 'plan-tech-resp');
    
    const safetyScore = planData ? (planData.safetyScore || '--') : (document.getElementById('plan-score-num')?.textContent || '--');
    const duration = planData ? (planData.duration || 'Não calculado') : (document.getElementById('plan-duration')?.value || 'Não calculado');
    
    const warningsHTML = planData ? (planData.warningsHTML || '<p style="color: #64748b; font-style: italic;">Sem perigos detectados.</p>') : (document.getElementById('plan-warnings-container')?.innerHTML || '<p style="color: #64748b; font-style: italic;">Sem perigos detectados.</p>');
    const prescriptionsHTML = planData ? (planData.prescriptionsHTML || '<p style="color: #64748b; font-style: italic;">Nenhuma recomendação adicional.</p>') : (document.getElementById('plan-prescriptions-container')?.innerHTML || '<p style="color: #64748b; font-style: italic;">Nenhuma recomendação adicional.</p>');
    
    let actionPlanHTML = planData ? (planData.actionPlanHTML || '') : (document.getElementById('ai-plan-5w2h-container')?.innerHTML || '');
    if (!actionPlanHTML || actionPlanHTML.trim() === '') {
        actionPlanHTML = '<p style="color: #64748b; font-style: italic;">Nenhum plano de ação 5W2H gerado para esta operação.</p>';
    }
    
    this._generatePDFFromHTML(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Plano Logístico 100% Seguro</title>
        <style>
          body { font-family: 'Inter', sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { margin: 0; color: #0f172a; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
          .subtitle { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
          .score { font-size: 18px; font-weight: bold; color: #0369a1; }
          .section { margin-bottom: 25px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
          .section h2 { margin-top: 0; font-size: 16px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 15px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
          .field { font-size: 12px; }
          .field strong { color: #475569; display: block; margin-bottom: 2px; }
          .field span { color: #0f172a; font-weight: 500; }
          .signature { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; text-align: center; }
          .sig-line { border-top: 1px solid #64748b; padding-top: 10px; margin-top: 40px; font-weight: bold; font-size: 14px; }
          
          /* Styles for the injected Action Plan */
          .action-plan { margin-top: 30px; }
          .action-plan h3 { color: #0f172a; font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
          .action-plan table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          .action-plan th, .action-plan td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          .action-plan th { background: #e2e8f0; color: #334155; }
          .action-plan-content { font-size: 12px; color: #1e293b; }
          .bg-slate-900\\/40 { background-color: #f1f5f9; padding: 10px; border-radius: 5px; margin-bottom: 10px; border: 1px solid #e2e8f0; }
          .text-cyan-400 { color: #0284c7; font-weight: bold; }
          .text-slate-300 { color: #1e293b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center; gap: 15px;">
            <img src="icons/logo.png" alt="GENERAL Logo" style="width: 55px; height: 55px; border-radius: 12px; object-fit: cover; border: 1px solid #e2e8f0;" />
            <div>
              <h1 class="title" style="margin-bottom: 3px;">Plano Logístico Aprovado</h1>
              <p class="subtitle" style="margin: 0;">Código: <strong>${code}</strong></p>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="score">Auditoria: ${safetyScore}</div>
            <div class="subtitle">Emissão: ${new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
        
        <div class="section">
          <h2>1. Dados do Cliente e Carga</h2>
          <div class="grid-3">
            <div class="field"><strong>Cliente / Razão Social:</strong> <span>${clientName}</span></div>
            <div class="field"><strong>Contato:</strong> <span>${clientContact}</span></div>
            <div class="field"><strong>Telefone:</strong> <span>${clientPhone}</span></div>
            <div class="field"><strong>E-mail:</strong> <span>${clientEmail}</span></div>
            <div class="field"><strong>NF-e:</strong> <span>${clientNfe}</span></div>
          </div>
          <br>
          <div class="grid-3">
            <div class="field"><strong>Seguradora:</strong> <span>${insurerName}</span></div>
            <div class="field"><strong>Telefone Seguradora:</strong> <span>${insurerPhone}</span></div>
            <div class="field"><strong>E-mail Seguradora:</strong> <span>${insurerEmail}</span></div>
          </div>
          <br>
          <div class="grid-3">
            <div class="field"><strong>Transportadora:</strong> <span>${carrierName}</span></div>
            <div class="field"><strong>CNPJ/Placa:</strong> <span>${carrierCnpj}</span></div>
            <div class="field"><strong>Telefone:</strong> <span>${carrierPhone}</span></div>
          </div>
          <br>
          <div class="grid-3">
            <div class="field"><strong>Modal:</strong> <span>${transportMode}</span></div>
            <div class="field"><strong>Natureza:</strong> <span>${cargoType}</span></div>
            <div class="field"><strong>Produto:</strong> <span>${product}</span></div>
            <div class="field"><strong>Código ONU:</strong> <span>${onu}</span></div>
            <div class="field"><strong>Volume:</strong> <span>${volume}</span></div>
            <div class="field"><strong>Cenário Tático:</strong> <span>${scenario}</span></div>
          </div>
        </div>
        
        <div class="section">
          <h2>2. Rota e Janela de Viagem</h2>
          <div class="grid-3">
            <div class="field"><strong>Origem:</strong> <span>${origin}</span></div>
            <div class="field"><strong>Destino:</strong> <span>${dest}</span></div>
            <div class="field"><strong>Distância:</strong> <span>${dist} km</span></div>
            <div class="field"><strong>Rodovias:</strong> <span>${roads}</span></div>
            <div class="field"><strong>Saída:</strong> <span>${depTime}</span></div>
            <div class="field"><strong>Previsão Chegada (Manual):</strong> <span>${deadline}</span></div>
            <div class="field"><strong>Previsão de Viagem (IA/AWS):</strong> <span style="color: #059669;">${duration}</span></div>
          </div>
        </div>
        
        <div class="section">
          <h2>3. Tripulação e Veículo</h2>
          <div class="grid-3">
            <div class="field"><strong>Condutor:</strong> <span>${driver}</span></div>
            <div class="field"><strong>Tempo de Casa:</strong> <span>${tenure}</span></div>
            <div class="field"><strong>Familiaridade (Rota):</strong> <span>${fam}</span></div>
            <div class="field"><strong>Familiaridade (Veículo):</strong> <span>${truckFam}</span></div>
            <div class="field"><strong>Nível do Tanque:</strong> <span>${tankFill}%</span></div>
            <div class="field"><strong>Modo:</strong> <span>${planMode}</span></div>
          </div>
        </div>

        <div class="signature">
          <div>
            <div class="sig-line">${driver !== 'Não preenchido' ? driver : 'Assinatura do Condutor'}</div>
            <span style="font-size: 12px; color: #64748b;">Condutor / Responsável Transporte</span>
          </div>
          <div>
            <div class="sig-line">${tech !== 'Não preenchido' ? tech : 'Assinatura Técnica'}</div>
            <span style="font-size: 12px; color: #64748b;">Engenharia / Gestão de Risco</span>
          </div>
        </div>
      </body>
      </html>
    `, 'Dossie_GENERAL.pdf');
    
    
  },

  setupInputMasks() {
    const maskInput = (id, maskFn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', (e) => { e.target.value = maskFn(e.target.value); });
    };

    const cnpjMask = (val) => {
      return val.replace(/\D/g, '')
                .replace(/^(\d{2})(\d)/, '$1.$2')
                .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                .replace(/\.(\d{3})(\d)/, '.$1/$2')
                .replace(/(\d{4})(\d)/, '$1-$2')
                .substring(0, 18);
    };

    const phoneMask = (val) => {
      const d = val.replace(/\D/g, '');
      if (d.length <= 10) {
        return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 14);
      }
      return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
    };

    const cepMask = (val) => {
      return val.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
    };

    maskInput('plan-carrier-cnpj', cnpjMask);
    maskInput('plan-carrier-phone', phoneMask);
    maskInput('plan-client-phone', phoneMask);
    maskInput('plan-origin-ref', cepMask);
    maskInput('plan-dest-ref', cepMask);
  },

  simulateFuelCost() {
    const distInput = document.getElementById('plan-dist')?.value;
    const priceInput = document.getElementById('plan-fuel-price')?.value;
    const costOutput = document.getElementById('plan-fuel-cost');
    const modeInput = document.getElementById('plan-transport-mode')?.value;
    
    if (!costOutput) return;
    
    const dist = parseFloat(distInput);
    const price = parseFloat(priceInput);
    
    if (isNaN(dist) || isNaN(price) || dist <= 0 || price <= 0) {
      costOutput.textContent = 'R$ 0,00';
      return;
    }
    
    let consumo = 3.0; // default fallback
    if (modeInput === 'CAMINHAO_3_4') consumo = 5.0;
    else if (modeInput === 'TRUCK') consumo = 3.5;
    else if (modeInput === 'CARRETA') consumo = 2.2;
    else if (modeInput === 'BITREM') consumo = 1.8;
    
    const totalLitros = dist / consumo;
    const custoEstimado = totalLitros * price;
    
    costOutput.textContent = `R$ ${custoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  },

  submitPlanToRCA() {
    const codeInput = document.getElementById('plan-code');
    if (codeInput && !codeInput.value) {
      codeInput.value = `PL-${Date.now().toString().slice(-4)}`;
    }
  },

  generatePlanCode() {
    const codeInput = document.getElementById('plan-code');
    if (codeInput && !codeInput.value) {
      codeInput.value = `PL-${Date.now().toString().slice(-4)}`;
    }
  },

  setupFuelCostCalculation() {
    const distInput = document.getElementById('plan-dist');
    const modeSelect = document.getElementById('plan-transport-mode');
    const fuelInput = document.getElementById('plan-tank-fill');
    
    if(!distInput || !modeSelect || !fuelInput) return;

    const calcFuel = () => {
      const mode = modeSelect.value;
      if (mode === 'CAMINHAO') {
        const dist = Number(distInput.value) || 0;
        const lts = dist / 2; 
        const cost = lts * 6.92;
        fuelInput.value = cost.toFixed(2);
        fuelInput.readOnly = true;
      } else {
        fuelInput.value = '';
        fuelInput.readOnly = false;
      }
    };
    
    distInput.addEventListener('input', calcFuel);
    modeSelect.addEventListener('change', calcFuel);
  },

  selectProvider(name, rating) {
    const carrierNameInput = document.getElementById('plan-carrier-name');
    if (carrierNameInput) carrierNameInput.value = name;
    
    const ratingCard = document.getElementById('plan-carrier-rating-card');
    const ratingScore = document.getElementById('carrier-rating-score');
    const ratingName = document.getElementById('carrier-rating-name');
    
    if (ratingCard && ratingScore && ratingName) {
      ratingScore.textContent = rating.toFixed(1);
      ratingName.textContent = name;
      ratingCard.classList.remove('hidden');
      
      // Inject test button if it doesn't exist
      if(!document.getElementById('test-rate-btn')) {
        const btn = document.createElement('button');
        btn.id = 'test-rate-btn';
        btn.className = 'ml-auto text-[10px] bg-rose-600/80 hover:bg-rose-500 text-white px-2 py-1 rounded transition-all';
        btn.textContent = 'Simular Nota Baixa';
        btn.onclick = (e) => {
          e.preventDefault();
          this.rateProvider(name, 2.0);
        };
        ratingCard.appendChild(btn);
      } else {
        document.getElementById('test-rate-btn').onclick = (e) => {
          e.preventDefault();
          this.rateProvider(name, 2.0);
        };
      }
    }
    
    this.showToast(`Transportadora ${name} selecionada.`, 'success');
  },

  rateProvider(name, newRating) {
    let customProviders = [];
    try {
      customProviders = JSON.parse(localStorage.getItem('general_custom_providers')) || [];
    } catch (e) {
      customProviders = [];
    }
    
    const providerIndex = customProviders.findIndex(p => p.name === name);
    if (providerIndex >= 0) {
      const p = customProviders[providerIndex];
      p.rating = (p.rating + newRating) / 2;
      
      if (p.rating <= 3.5) {
        customProviders.splice(providerIndex, 1);
        this.notifyProviderRemoval(name);
        document.getElementById('plan-carrier-rating-card')?.classList.add('hidden');
        document.getElementById('plan-carrier-name').value = '';
      } else {
        this.showToast(`Avaliação atualizada para ${p.rating.toFixed(1)}`, 'info');
      }
      
      localStorage.setItem('general_custom_providers', JSON.stringify(customProviders));
      this.renderMarketplace();
    } else {
      this.showToast('Transportadora padrão não pode ser avaliada.', 'warning');
    }
  },

  notifyProviderRemoval(name) {
    const btn = document.getElementById('provider-notifications-btn');
    if (btn) btn.classList.remove('hidden');
    this.showToast(`Transportadora ${name} removida por baixa avaliação (< 3.5)`, 'error');
    
    // Salvar notificação no localStorage
    let notifs = JSON.parse(localStorage.getItem('general_notifications') || '[]');
    notifs.push({
      id: Date.now().toString(),
      type: 'provider_removal',
      title: 'Auditoria de Transportadora',
      message: `A transportadora ${name} foi avaliada com nota inferior a 3.5 e suspensa do painel.`,
      read: false,
      date: new Date().toISOString()
    });
    localStorage.setItem('general_notifications', JSON.stringify(notifs));
    this.updateNotificationBadge();
  },

  updateNotificationBadge() {
    let notifs = JSON.parse(localStorage.getItem('general_notifications') || '[]');
    const unread = notifs.filter(n => !n.read).length;
    const badge = document.querySelector('#provider-notifications-btn span');
    if (badge) {
      if (unread > 0) {
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  showProviderNotifications() {
    let div = document.getElementById('notifications-modal');
    if (!div) {
      div = document.createElement('div');
      div.id = 'notifications-modal';
      div.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in';
      document.body.appendChild(div);
    }
    
    let notifs = JSON.parse(localStorage.getItem('general_notifications') || '[]');
    let html = '';
    
    if (notifs.length === 0) {
      html = '<div class="text-slate-400 text-center py-4">Nenhuma notificação recente.</div>';
    } else {
      html = notifs.reverse().map(n => `
        <div class="p-4 bg-slate-950 rounded-xl border ${n.read ? 'border-slate-800 opacity-60' : 'border-rose-500/50'} text-slate-300 text-sm relative">
           <strong class="${n.read ? 'text-slate-400' : 'text-rose-400'} flex items-center gap-2 mb-2"><i data-lucide="alert-triangle" class="w-4 h-4"></i> ${n.title}</strong>
           <p class="mb-2">${n.message}</p>
           ${!n.read ? `<button onclick="App.markNotificationAsRead('${n.id}')" class="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded">Marcar como lida</button>` : '<span class="text-[10px] text-slate-500">Lida</span>'}
        </div>
      `).join('');
    }
    
    div.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-scale-up">
        <div class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <h3 class="text-white font-bold flex items-center gap-2"><i data-lucide="bell" class="w-5 h-5 text-blue-400"></i> Notificações</h3>
          <button onclick="document.getElementById('notifications-modal').classList.add('hidden')" class="text-slate-400 hover:text-white transition-all"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>
        <div class="p-4 flex flex-col gap-3 max-h-96 overflow-y-auto" id="notifications-list">
          ${html}
        </div>
      </div>
    `;
    
    div.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  markNotificationAsRead(id) {
    let notifs = JSON.parse(localStorage.getItem('general_notifications') || '[]');
    const notif = notifs.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      localStorage.setItem('general_notifications', JSON.stringify(notifs));
      this.updateNotificationBadge();
      this.showProviderNotifications(); // refresh modal
    }
  },

  downloadConcludedPDF(incidentId) {
    appState.setCurrentIncident(incidentId);
    this.switchTab('dossier');
    setTimeout(() => {
      if (typeof ReportPDFGenerator !== 'undefined') {
        ReportPDFGenerator.printReport();
      }
    }, 500);
  },

  downloadHistoryPlanPDF(id) {
    const savedPlans = JSON.parse(localStorage.getItem('general_saved_plans') || '[]');
    const plan = savedPlans.find(p => p.id === id);
    if (plan && plan.data) {
      this.downloadPlanPDF(plan.data);
    } else {
      const inc = appState.incidents.find(i => i.id === id);
      if (inc && inc.logisticsPlan) {
        this.downloadPlanPDF(inc.logisticsPlan);
      } else {
        // Fallback to downloading without explicit plan if missing (uses dom)
        this.downloadPlanPDF();
      }
    }
  },

  downloadActionPlanPDF(id) {
    const inc = appState.incidents.find(i => i.id === id);
    if (!inc) return;
    this._generatePDFFromHTML(`<html><head><title>Plano de Ação - ${id}</title><style>body{font-family:'Inter',sans-serif;padding:30px;color:#1e293b;}</style></head><body><h2>Plano de Ação Tático - Ocorrência ${id}</h2><p>Documento gerado automaticamente pelo sistema Antigravity.</p><div style="margin-top:20px;">${inc.actionPlanHTML || 'Plano preenchido manualmente.'}</div></body></html>`, 'Dossie_GENERAL.pdf');
    
  },
  
  downloadSavedActionPlanPDF(id) {
    const plan = appState.savedPlans.find(p => p.id === id && p.type === 'ACAO');
    if (!plan || !plan.data) {
      this.showToast('Detalhes do plano não encontrados.', 'error');
      return;
    }
    const htmlContent = plan.data.actionPlanHTML || plan.data.content || 'Detalhes do plano tático não disponíveis em HTML.';
    this._generatePDFFromHTML(`<html><head><title>Plano de Ação - ${id}</title><style>body{font-family:'Inter',sans-serif;padding:30px;color:#1e293b;}</style></head><body><h2>Plano de Ação Tático Independente - ${id}</h2><p>Documento gerado automaticamente pelo sistema Antigravity.</p><p>Vinculado ao Plano Logístico: <b>${plan.linkedLogisticsPlan}</b></p><div style="margin-top:20px;">${htmlContent}</div></body></html>`, 'Dossie_GENERAL.pdf');
    
  },
  
  downloadTransshipmentPDF(id) {
    const inc = appState.incidents.find(i => i.id === id);
    if (!inc) return;
    this._generatePDFFromHTML(`<html><head><title>Plano de Transbordo - ${id}</title><style>body{font-family:'Inter',sans-serif;padding:30px;color:#1e293b;}</style></head><body><h2>Plano Operacional de Transbordo - Ocorrência ${id}</h2><p>Operação autorizada e monitorada.</p><div style="margin-top:20px; font-weight:bold;">Técnico Responsável: ${inc.responsible || 'N/A'}</div></body></html>`, 'Dossie_GENERAL.pdf');
    
  },

  disableCopilotHelper() {
    localStorage.setItem('disable_copilot_helper', 'true');
    const helper = document.getElementById('floating-copilot-helper');
    if (helper) {
      helper.classList.add('hidden');
    }
    this.showToast('Dicas desativadas. Você pode reativá-las no seu Perfil.', 'info');
  },

  hideCarrier(name) {
    if (confirm(`Tem certeza que deseja excluir "${name}" do seu painel? (Apenas para você)`)) {
      let hiddenCarriers = [];
      try {
        hiddenCarriers = JSON.parse(localStorage.getItem('general_hidden_carriers')) || [];
      } catch(e) {}
      
      if (!hiddenCarriers.includes(name)) {
        hiddenCarriers.push(name);
        localStorage.setItem('general_hidden_carriers', JSON.stringify(hiddenCarriers));
        this.syncToFirebase();
      }
      
      this.showToast(`Transportadora ${name} ocultada com sucesso.`, 'success');
      this.renderMarketplace();
    }
  },

  sendHelpEmail() {
    const textarea = document.getElementById('help-duvida-textarea');
    if (!textarea || !textarea.value.trim()) {
      this.showToast('Por favor, descreva sua dúvida antes de enviar.', 'warning');
      return;
    }
    const body = encodeURIComponent(textarea.value.trim());
    const email = 'generalia.suporte@gmail.com';
    const subject = encodeURIComponent('Dúvida/Suporte - GENERAL App');
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    
    this.showToast('Redirecionando para o seu aplicativo de e-mail...', 'success');
    document.getElementById('help-modal').classList.add('hidden');
    textarea.value = '';
  },

  advancePlanStatus() {
    if (!this.planStep) this.planStep = 1;
    this.planStep++;
    if (this.planStep > 5) {
      this.planStep = 5;
      this.showToast('O plano jǭ atingiu o estǭgio final.', 'info');
      return;
    }

    // Update UI Step
    const stepsText = ['Elaboração', 'Aprovado', 'Em Execução', 'A Caminho', 'A Avaliar'];
    
    // Reset all steps to default
    for (let i = 1; i <= 5; i++) {
       const icon = document.getElementById('step-icon-' + i);
       const text = document.getElementById('step-text-' + i);
       if (!icon || !text) continue;
       
       if (i < this.planStep) {
         icon.className = 'w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center border-4 border-slate-900 transition-colors shadow-lg shadow-emerald-500/20 font-bold';
         text.className = 'text-[10px] font-bold text-emerald-500 uppercase tracking-wide';
       } else if (i === this.planStep) {
         icon.className = 'w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center border-4 border-slate-900 transition-colors shadow-lg shadow-blue-500/20 font-bold animate-pulse';
         text.className = 'text-[10px] font-bold text-blue-400 uppercase tracking-wide';
       } else {
         icon.className = 'w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center border-4 border-slate-900 transition-colors';
         text.className = 'text-[10px] font-bold text-slate-500 uppercase tracking-wide';
       }
    }
    
    const progressBar = document.getElementById('stepper-progress-bar');
    if (progressBar) {
       progressBar.style.width = ((this.planStep - 1) * 25) + '%';
    }

    // Log Activity
    const logContainer = document.getElementById('plan-activity-log');
    if (logContainer) {
       // Remove empty message if exists
       if (logContainer.querySelector('.italic')) logContainer.innerHTML = '';
       
       const d = new Date();
       const timeStr = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
       
       let message = '';
       let iconHtml = '';
       
       if (this.planStep === 2) {
          message = 'O plano logístico foi aprovado formalmente. IA em prontidão.';
          iconHtml = '<i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400"></i>';
       } else if (this.planStep === 3) {
          message = 'Plano entrou em execução. Monitoramento das rodovias iniciado.';
          iconHtml = '<i data-lucide="play-circle" class="w-3.5 h-3.5 text-blue-400"></i>';
       } else if (this.planStep === 4) {
          message = 'Frota está a caminho do destino. Rastreamento ativo.';
          iconHtml = '<i data-lucide="truck" class="w-3.5 h-3.5 text-amber-400"></i>';
       } else if (this.planStep === 5) {
          message = 'Etapa concluída. Aguardando avaliação pós-mortem das decisões tomadas.';
          iconHtml = '<i data-lucide="star" class="w-3.5 h-3.5 text-purple-400"></i>';
       }

       const html = `
         <div class="flex gap-3 text-xs items-start bg-slate-900/50 p-2 rounded border border-slate-800">
           <div class="mt-0.5">${iconHtml}</div>
           <div>
             <span class="text-white font-bold block mb-0.5">${stepsText[this.planStep - 1]}</span>
             <span class="text-slate-400">${message}</span>
             <div class="text-[9px] text-slate-500 mt-1 font-mono">${timeStr} - Sistema Automático</div>
           </div>
         </div>
       `;
       logContainer.insertAdjacentHTML('afterbegin', html);
       if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    this.showToast('Etapa avançada com sucesso', 'success');
  },

  // ==========================================
  // MODULE: FEEDBACK & RISK MANAGEMENT
  // ==========================================
  submitFeedback() {
    const route = document.getElementById('feedback-route')?.value || 'Rota Desconhecida';
    const weather = document.getElementById('feedback-weather')?.value;
    const road = document.getElementById('feedback-road')?.value;
    const safety = document.getElementById('feedback-safety')?.value;
    const support = document.getElementById('feedback-support')?.value;
    const notes = document.getElementById('feedback-notes')?.value;

    if (!route.trim()) {
      this.showToast('Por favor, informe a rota finalizada.', 'error');
      return;
    }

    const feedback = {
      id: Date.now(),
      route,
      weather,
      road,
      safety,
      support,
      notes,
      timestamp: new Date().toISOString()
    };

    let feedbacks = JSON.parse(localStorage.getItem('GENERAL_FEEDBACKS') || '[]');
    feedbacks.push(feedback);
    localStorage.setItem('GENERAL_FEEDBACKS', JSON.stringify(feedbacks));

    // Gamification XP
    let xp = parseInt(localStorage.getItem('GENERAL_USER_XP') || '0', 10);
    xp += 50;
    localStorage.setItem('GENERAL_USER_XP', xp);
    
    const xpCounter = document.getElementById('driver-xp-counter');
    if (xpCounter) xpCounter.textContent = xp;

    this.showToast('Avaliação enviada! Você ganhou +50 XP!', 'success');
    
    // Clear form
    document.getElementById('feedback-route').value = '';
    document.getElementById('feedback-notes').value = '';
  },

  submitQuickReport() {
    const reportOptions = ['Acidente a frente', 'Queda de barreira', 'Pista escorregadia', 'Blitz/Manifestação'];
    const randomReport = reportOptions[Math.floor(Math.random() * reportOptions.length)];
    
    const report = {
      id: Date.now(),
      type: randomReport,
      location: 'Rodovia Simulada (KM ' + Math.floor(Math.random() * 500) + ')',
      timestamp: new Date().toISOString()
    };

    let rapidReports = JSON.parse(localStorage.getItem('GENERAL_RAPID_REPORTS') || '[]');
    rapidReports.push(report);
    localStorage.setItem('GENERAL_RAPID_REPORTS', JSON.stringify(rapidReports));

    this.showToast('Reporte rápido enviado! Gestor e motoristas notificados.', 'error');
    if (this.currentTab === 'risk-dashboard') {
      this.renderRiskDashboard();
    }
  },

  calculateRiskScore(feedbacks, rapidReports) {
    // Score base 20 (Histórico base transportadora)
    let score = 20;
    
    // Penalidade por avaliações ruins recentes
    const badRoad = feedbacks.filter(f => f.road === 'Péssima').length;
    const badSafety = feedbacks.filter(f => f.safety === 'Perigoso').length;
    score += (badRoad * 10) + (badSafety * 15);
    
    // Penalidade por reportes rápidos
    score += (rapidReports.length * 20);

    // Bounding 0 - 100
    if (score > 100) score = 100;
    return score;
  },

  renderIncidentsSidebar() {
    const activeContainer = document.getElementById('incidents-sidebar-list');
    if (!activeContainer) return;
    
    const activeIncidents = (window.appState && window.appState.incidents) ? window.appState.incidents.filter(inc => inc.status !== 'CONCLUIDA') : [];
    
    if (activeIncidents.length === 0) {
      activeContainer.innerHTML = `
        <div class="text-center p-4 border border-dashed border-slate-800 rounded-xl mt-4">
          <i data-lucide="check-circle" class="w-6 h-6 text-emerald-500 mx-auto mb-2"></i>
          <p class="text-xs font-bold text-slate-400">Nenhuma ocorrência ativa.</p>
        </div>`;
    } else {
      activeContainer.innerHTML = activeIncidents.map(inc => {
        let badgeColor = 'bg-amber-900/30 text-amber-500 border-amber-800';
        let icon = 'alert-triangle';
        
        if (inc.status === 'CRÍTICO' || inc.type === 'ALERTA_MOTORISTA' || inc.type === 'Acidente') {
            badgeColor = 'bg-rose-900/30 text-rose-500 border-rose-800';
            icon = 'siren';
        }

        return `
        <div class="bg-slate-950 border border-slate-800 p-3 rounded-xl hover:border-slate-700 transition-colors cursor-pointer mb-3" onclick="if(window.App && window.App.viewIncident) window.App.viewIncident('${inc.id}')">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-mono text-slate-500">${inc.id}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded border ${badgeColor} uppercase font-bold flex items-center gap-1">
              <i data-lucide="${icon}" class="w-3 h-3"></i> ${inc.status}
            </span>
          </div>
          <p class="text-xs font-bold text-slate-200 mb-1 line-clamp-1">${inc.type || inc.cargoDescription || 'Ocorrência Geral'}</p>
          <div class="flex items-center gap-2 text-[10px] text-slate-400">
            <i data-lucide="user" class="w-3 h-3"></i> ${inc.driverName || 'Motorista'}
          </div>
        </div>
        `;
      }).join('');
    }
    
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  renderRiskDashboard() {
    const feedbacks = JSON.parse(localStorage.getItem('GENERAL_FEEDBACKS') || '[]');
    const rapidReports = JSON.parse(localStorage.getItem('GENERAL_RAPID_REPORTS') || '[]');
    
    // Alerta de Risco Crítico (>1 reportes rápidos em 24h)
    const alertContainer = document.getElementById('risk-alert-container');
    if (alertContainer) {
      if (rapidReports.length >= 2) {
        alertContainer.classList.remove('hidden');
        alertContainer.classList.add('flex');
      } else {
        alertContainer.classList.add('hidden');
        alertContainer.classList.remove('flex');
      }
    }

    // Render Rapid Reports
    const reportsList = document.getElementById('risk-rapid-reports');
    if (reportsList) {
      reportsList.innerHTML = rapidReports.length === 0 ? '<p class="text-xs text-slate-500">Nenhum reporte recente.</p>' : rapidReports.slice(-5).reverse().map(r => {
        let colorClass = 'text-rose-400';
        let borderClass = 'border-rose-900/50';
        let icon = 'alert-triangle';
        
        if (r.originalType === 'Polícia') { colorClass = 'text-blue-400'; borderClass = 'border-blue-900/50'; icon = 'shield-alert'; }
        else if (r.originalType === 'Obra' || r.originalType === 'Faixa interditada' || r.originalType === 'Objeto na via' || r.originalType === 'Lentidão') { colorClass = 'text-amber-400'; borderClass = 'border-amber-900/50'; icon = 'construction'; }
        
        return `
        <div class="bg-slate-950 p-3 rounded-xl border ${borderClass} flex flex-col">
            <span class="text-xs font-bold ${colorClass} mb-1 flex items-center gap-1"><i data-lucide="${icon}" class="w-3 h-3"></i> ${r.type}</span>
            <span class="text-[10px] text-slate-400">Local: ${r.location}</span>
            <span class="text-[9px] text-slate-500 mt-1">${new Date(r.timestamp).toLocaleString('pt-BR')}</span>
        </div>
        `;
    }).join('');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    // Render Risk Score Baseado em feedbacks
    const scoreList = document.getElementById('risk-scores-list');
    if (scoreList) {
      const score = this.calculateRiskScore(feedbacks, rapidReports);
      const riskLevel = score < 40 ? 'Baixo' : score < 75 ? 'Médio' : 'Crítico';
      const riskColor = score < 40 ? 'emerald' : score < 75 ? 'amber' : 'rose';
      
      scoreList.innerHTML = `
        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-white block mb-1">Rota Ativa (Simulação)</span>
            <span class="text-[10px] text-slate-400">Score calculado por IA + Feedbacks</span>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-xl font-black text-${riskColor}-400">${score}/100</span>
            <span class="text-[9px] uppercase font-bold text-${riskColor}-500 bg-${riskColor}-500/10 px-2 py-0.5 rounded mt-1">Risco ${riskLevel}</span>
          </div>
        </div>
      `;
    }
  }
,
  submitGoogleExtraInfo() {
    const company = document.getElementById('google-extra-company')?.value.trim();
    const cnpj = document.getElementById('google-extra-cnpj')?.value.trim();
    const role = document.getElementById('google-extra-role')?.value.trim();
    
    if (!company || !cnpj || !role) {
      this.showToast('Por favor, preencha todos os campos da empresa.');
      return;
    }
    
    if (window.tempGoogleUser) {
       window.tempGoogleUser.company = company;
       window.tempGoogleUser.companyCnpj = cnpj;
       window.tempGoogleUser.role = role;
       
       appState.currentUser = window.tempGoogleUser;
       localStorage.setItem('general_user', JSON.stringify(window.tempGoogleUser));
       
       // Save to Firestore so Motorista APK can see it
       if (window.db) {
           window.db.collection('users').doc(window.tempGoogleUser.email).set(window.tempGoogleUser)
             .catch(e => console.error('Erro ao salvar no Firestore:', e));
           window.db.collection('companies').doc(cnpj).set({ name: company, cnpj: cnpj })
             .catch(e => console.error('Erro ao salvar empresa:', e));
       }
       
       document.getElementById('google-extra-modal').classList.add('hidden');
       this.checkAuth();
       this.showToast(`ðŸ”‘ Bem-vindo(a) via Google, ${window.tempGoogleUser.name}!`);
    }
  },
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});