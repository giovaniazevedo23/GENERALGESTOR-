/**
 * GENERAL App - Gerenciador de Estado e Persistência Local
 */

const STORAGE_KEY_INCIDENTS = 'GENERAL_PAAC_INCIDENTS_V2';
const STORAGE_KEY_CURRENT_ID = 'GENERAL_PAAC_CURRENT_INCIDENT_ID_V2';
const STORAGE_KEY_SETTINGS = 'GENERAL_PAAC_SETTINGS';

// Modelos pré-carregados de alta fidelidade para demonstração e treinamento
const DEMO_SCENARIOS = [];

class StateStore {
  constructor() {
    this.incidents = this.loadIncidents();
    this.currentIncidentId = this.loadCurrentId() || null;
    this.subscribers = [];
    this.soundEnabled = true;
    this.aiCredits = parseInt(localStorage.getItem('GENERAL_PAAC_AI_CREDITS') || '20');
    this.initAudioContext();
    this.initFirebaseSync();
  }

  getAICredits() {
    return this.aiCredits;
  }

  useAICredit() {
    if (this.aiCredits > 0) {
      this.aiCredits--;
      localStorage.setItem('GENERAL_PAAC_AI_CREDITS', this.aiCredits.toString());
      if (window.db) {
        window.db.collection('settings').doc('credits').set({ value: this.aiCredits }, { merge: true });
      }
      this.notify();
      return true;
    }
    return false;
  }

  initAudioContext() {
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = null; // initialized on first user gesture
    } catch(e) {
      console.warn("Audio context not supported", e);
    }
  }

  playBeep(type = 'info') {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      const now = this.audioCtx.currentTime;
      if (type === 'critical') {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(440, now + 0.1);
        osc.frequency.setValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        osc.frequency.setValueAtTime(587.33, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch(e) {
      // Audio playback failed silently
    }
  }

  loadIncidents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_INCIDENTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Erro ao carregar ocorrências do LocalStorage:", e);
    }
    // Salva os cenários de demonstração como base inicial
    this.saveIncidentsToStorage([]);
    return [];
  }

  loadCurrentId() {
    return localStorage.getItem(STORAGE_KEY_CURRENT_ID);
  }

  saveIncidentsToStorage(incidents) {
    try {
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(incidents));
    } catch (e) {
      console.error("Erro ao gravar no LocalStorage:", e);
    }
  }

  initFirebaseSync() {
    // We wait briefly for Firebase to initialize in index.html
    setTimeout(() => {
      if (!window.db) return;
      
      // Listen to Saved Plans
      window.db.collection('saved_plans').onSnapshot((snapshot) => {
        const plans = [];
        snapshot.forEach(doc => plans.push(doc.data()));
        if (plans.length > 0) {
          localStorage.setItem('general_saved_plans', JSON.stringify(plans));
          
          // Update the local state directly so selects get the newest data
          this.savedPlans = plans;

          if (window.App) {
            if (typeof window.App.renderSavedPlansTab === 'function') {
              window.App.renderSavedPlansTab();
            }
            if (typeof window.App.populateIncidentSelectors === 'function') {
              window.App.populateIncidentSelectors();
            }
            if (typeof window.App.populateFeedbackRoutes === 'function') {
              window.App.populateFeedbackRoutes();
            }
          }
        }
      });
      
      // Sync AI Credits
      const creditsDoc = window.db.collection('settings').doc('credits');
      creditsDoc.onSnapshot(doc => {
        if (doc.exists) {
          this.aiCredits = doc.data().value;
          localStorage.setItem('GENERAL_PAAC_AI_CREDITS', this.aiCredits.toString());
          this.notify();
        }
      });
    }, 1000);
  }

  saveCurrentIdToStorage(id) {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_ID, id);
    } catch (e) {
      console.error("Erro ao gravar ID atual:", e);
    }
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.subscribers.forEach(cb => cb(this));
  }

  getCurrentIncident() {
    if (!this.currentIncidentId && this.incidents.length > 0) {
      this.currentIncidentId = this.incidents[0].id;
    }
    return this.incidents.find(inc => inc.id === this.currentIncidentId) || this.incidents[0];
  }

  setCurrentIncident(id) {
    if (this.currentIncidentId === id) return;
    this.currentIncidentId = id;
    this.saveCurrentIdToStorage(id);
    this.notify();
  }

  updateCurrentIncident(patch) {
    const current = this.getCurrentIncident();
    if (!current) return;
    
    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    
    this.incidents = this.incidents.map(inc => inc.id === current.id ? updated : inc);
    this.saveIncidentsToStorage(this.incidents);
    this.notify();
  }

  createIncident(data) {
    const year = new Date().getFullYear();
    const count = this.incidents.length + 1;
    const newId = `INC-${year}-${String(count).padStart(4, '0')}`;
    
    const newIncident = {
      id: newId,
      title: data.title || `Ocorrência ${newId}`,
      status: "EM_ATENDIMENTO",
      severity: data.severity || "ALTO",
      createdAt: new Date().toISOString(),
      responsible: data.responsible || "Operador de Plantão",
      channel: data.channel || "Central 24h",
      
      eventType: data.eventType || "Acidente Rodoviário",
      occurredAt: data.occurredAt || new Date().toISOString().slice(0, 16),
      road: data.road || "BR-116",
      km: data.km || "KM 0",
      city: data.city || "São Paulo / SP",
      reference: data.reference || "",
      lat: data.lat || -23.5505,
      lng: data.lng || -46.6333,
      
      vehicleType: data.vehicleType || "Cavalo Mecânico + Carreta",
      plate: data.plate || "",
      fleetNumber: data.fleetNumber || "",
      carrier: data.carrier || "",
      driverName: data.driverName || "",
      driverPhone: data.driverPhone || "",
      driverStatus: data.driverStatus || "ILESO_CONSCIENTE",
      driverMedicalSupportDispatched: false,
      
      cargoType: data.cargoType || "CARGA_GERAL",
      onuCode: data.onuCode || "",
      cargoDescription: data.cargoDescription || "",
      cargoValue: Number(data.cargoValue) || 0,
      packagesCount: Number(data.packagesCount) || 1,
      nfeNumber: data.nfeNumber || "",
      manifestNumber: data.manifestNumber || "",
      sealNumber: data.sealNumber || "",
      sealIntact: true,
      damageCondition: data.damageCondition || "SEM_DANOS",
      
      weather: data.weather || "ENSOLARADO",
      roadCondition: data.roadCondition || "SECA",
      drainageProximity: false,
      drainageDetails: "",
      
      checklists: {
        driverSafe: false,
        signalized: false,
        isolated: false,
        cargoInspected: false,
        samuDispatched: false,
        bombeirosDispatched: false,
        prfNotified: false,
        insurerNotified: false,
        carrierNotified: false,
        shipperNotified: false,
        cetesbNotified: false,
        evidencePreserved: false,
        transshipmentReady: false,
        continuityPlanActive: false
      },
      
      dispatchLog: [
        { timestamp: new Date().toLocaleTimeString().slice(0, 5), target: "Registro no Sistema General", status: "ABERTO", protocol: newId, agent: data.responsible || "Operador" }
      ],
      evidences: [],
      transshipment: {
        required: false,
        status: "NAO_NECESSARIO",
        backupVehiclePlate: "",
        backupCarrier: "",
        pumpType: "",
        estimatedVolumeLiters: 0,
        spilledEstimatedLiters: 0,
        safetyOfficer: "",
        containmentBarriersInstalled: false,
        safeDestination: ""
      },
      rca: {
        status: "EM_ANDAMENTO",
        investigator: "A designar",
        hypothesis: "A_APURAR",
        ishikawa: { metodo: "", maquina: "", maoDeObra: "", material: "", meioAmbiente: "", medicao: "" },
        fiveWhys: ["", "", "", "", ""],
        preventiveActionPlan: ""
      }
    };

    this.incidents.unshift(newIncident);
    this.currentIncidentId = newId;
    this.saveIncidentsToStorage(this.incidents);
    this.saveCurrentIdToStorage(newId);
    this.playBeep('critical');
    this.notify();
    return newIncident;
  }

  toggleChecklist(key) {
    const current = this.getCurrentIncident();
    if (!current) return;
    
    const newVal = !current.checklists[key];
    const updatedChecklists = {
      ...current.checklists,
      [key]: newVal
    };
    
    this.updateCurrentIncident({ checklists: updatedChecklists });
    this.playBeep(newVal ? 'success' : 'info');
  }

  addDispatchLog(target, status, protocol, agent) {
    const current = this.getCurrentIncident();
    if (!current) return;
    
    const newLog = {
      timestamp: new Date().toLocaleTimeString().slice(0, 5),
      target,
      status,
      protocol: protocol || `PROT-${Math.floor(100000 + Math.random() * 900000)}`,
      agent: agent || current.responsible
    };
    
    const updatedLogs = [newLog, ...(current.dispatchLog || [])];
    this.updateCurrentIncident({ dispatchLog: updatedLogs });
    this.playBeep('success');
  }

  addEvidence(fileData) {
    const current = this.getCurrentIncident();
    if (!current) return;
    
    const newEv = {
      id: `ev-${Date.now()}`,
      name: fileData.name || "Foto_Evidencia.jpg",
      type: fileData.type || "FOTO_AVARIA",
      timestamp: new Date().toLocaleTimeString().slice(0, 5),
      location: `${current.road} ${current.km}`,
      note: fileData.note || "Evidência anexada durante atendimento",
      url: fileData.url
    };
    
    const updatedEvidences = [...(current.evidences || []), newEv];
    this.updateCurrentIncident({ evidences: updatedEvidences });
    this.playBeep('success');
  }

  resetToDemo() {
    this.incidents = [];
    this.currentIncidentId = null;
    this.saveIncidentsToStorage(this.incidents);
    this.saveCurrentIdToStorage(this.currentIncidentId);
    this.notify();
  }
}

const appState = new StateStore();
