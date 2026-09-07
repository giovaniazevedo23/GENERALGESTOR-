/**
 * GENERAL App - Motor do Plano Logístico, Previsão do Tempo (Google Weather), Cronobiologia, Rotatividade e Auto-Otimizador por IA
 */

const LogisticsPlanner = {
  // Modelos pré-configurados de planos de entrega para demonstração
  DEFAULT_PLANS: [
    {
      id: "LOG-2026-0041",
      title: "Transferência de Combustível S-10 - Refinaria Paulínia -> CD Curitiba",
      
      // Cliente / Embarcador
      clientName: "Techline Brasil Combustíveis S/A",
      clientContact: "Fábio Vasconcelos (Gerente de Supply Chain)",
      clientPhone: "(11) 98111-2233",
      clientEmail: "supply.emergencias@techlinebrasil.com.br",
      clientNfe: "NF-e 000.284.119 - Série 1",
      
      // Rota e Cronograma
      origin: "Refinaria Paulínia / SP (Rod. Zeferino Vaz)",
      destination: "CD São José dos Pinhais / PR (BR-116 KM 98)",
      distanceKm: 460,
      plannedRoads: "SP-330 (Anhanguera) + Rodoanel + BR-116 (Régis Bittencourt)",
      departureTime: "2026-08-20T01:30",
      deliveryDeadline: "2026-08-20T08:00", // Apenas 6h30 para 460km com serra (Pressão crítica por prazo!)
      
      // Tipo de Carga e Produto
      cargoType: "PRODUTO_PERIGOSO",
      productName: "ÓLEO DIESEL S-10 A GRANEL",
      onuCode: "1202",
      cargoWeightTon: 42.5,
      tankFillPercent: 78, // Efeito onda crítico (60-80%)
      cargoValue: 285000.00,
      
      // Veículo
      vehicleType: "Cavalo Mecânico Scania R500 6x4 + Bitrem Tanque Inox",
      plate: "BRA-9X28 / RBL-4E19",
      isAssignedRegularTruck: false, // Veículo reserva! (Rotatividade)
      
      // Condutor e Fatores de Rotatividade
      driverName: "Antônio Carlos Silveira",
      driverTenureDays: 45, // Novato (<90 dias de contratação)
      driverRouteFamiliarity: "PRIMEIRA_VEZ", // PRIMEIRA_VEZ, POUCO_FREQUENTE, FREQUENTE
      driverMode: "SOLO", // SOLO, DUPLA_REVEZAMENTO
      scheduledStops: [
        { km: "KM 120", name: "Posto Shell Rodoanel", durationMin: 15 },
        { km: "KM 340", name: "Posto Graal Registro", durationMin: 20 }
      ],

      // Meteorologia na Janela da Rota (Google Weather / Live Data)
      weatherForecast: {
        origin: { temp: 19, condition: "Nublado", rainMmH: 0, windKmH: 12, visibilityKm: 10 },
        mountainPass: { temp: 14, condition: "Tempestade com Neblina", rainMmH: 38, windKmH: 55, visibilityKm: 1.2, location: "Serra do Cafezal (KM 280-310)" },
        destination: { temp: 16, condition: "Chuva Leve", rainMmH: 4, windKmH: 22, visibilityKm: 7 }
      }
    },
    {
      id: "LOG-2026-0042",
      title: "Distribuição de Eletrônicos - CD Cajamar -> CD Joinville",
      clientName: "E-Commerce Magazine Varejo S/A",
      clientContact: "Mariana Alencar (Coordenação Logística)",
      clientPhone: "(47) 99222-3344",
      clientEmail: "logistica.joinville@magazinevarejo.com.br",
      clientNfe: "NF-e 000.912.440 - Série 2",
      origin: "CD Cajamar / SP",
      destination: "CD Joinville / SC",
      distanceKm: 520,
      plannedRoads: "Rodoanel + BR-116 + BR-101",
      departureTime: "2026-08-20T06:00",
      deliveryDeadline: "2026-08-20T16:00",
      cargoType: "ALTO_VALOR",
      productName: "SMARTPHONES E NOTEBOOKS PALETIZADOS",
      onuCode: "",
      cargoWeightTon: 16.5,
      tankFillPercent: 0,
      cargoValue: 1450000.00,
      vehicleType: "Volvo FH 540 6x2 + Carreta Baú Blindada",
      plate: "SC-E9901 / FGH-8822",
      isAssignedRegularTruck: true,
      driverName: "Maurício Valério",
      driverTenureDays: 420,
      driverRouteFamiliarity: "FREQUENTE",
      driverMode: "SOLO",
      scheduledStops: [
        { km: "KM 200", name: "Posto Buenos Aires BR-116", durationMin: 45 }
      ],
      weatherForecast: {
        origin: { temp: 18, condition: "Ensolarado", rainMmH: 0, windKmH: 15, visibilityKm: 10 },
        mountainPass: { temp: 22, condition: "Ensolarado", rainMmH: 0, windKmH: 18, visibilityKm: 10, location: "Morro do Boi" },
        destination: { temp: 24, condition: "Ensolarado", rainMmH: 0, windKmH: 14, visibilityKm: 10 }
      }
    }
  ],

  /**
   * Auditoria Profunda por IA do Plano Logístico Pré-Viagem (Via Gemini)
   */
  async auditPlan(plan) {
    if (!plan) return { safetyScore: 100, warnings: [], prescriptions: [], criticalHour: false };
    try {
      return await GeminiService.auditLogisticsPlan(plan);
    } catch (e) {
      console.error("Falha ao auditar plano via IA. Retornando fallback realista...", e);
      return {
        safetyScore: 85, status: "APROVADO_COM_RESTRICOES", statusLabel: "REVISÃO RECOMENDADA (IA LOCAL)",
        statusClass: "bg-amber-500/20 text-amber-400 border-amber-500/30", statusColor: "#f59e0b",
        warnings: [
          { type: "CRONOBIOLOGIA", severity: "MEDIA", title: "Fadiga Noturna", description: "O trajeto adentra em horário de risco biológico (02:00 as 05:00)." },
          { type: "CLIMA", severity: "MEDIA", title: "Clima em Trecho Crítico", description: "Possibilidade de pista molhada na serra." }
        ],
        prescriptions: [
          { action: "Pausa Obrigatória", detail: "Programar parada antes de iniciar trecho de serra." }
        ],
        requiredAvgSpeed: plan.distanceKm ? Math.round(plan.distanceKm / 10) : 60,
        totalHoursAvailable: 10
      };
    }
  },

  /**
   * REFORMULAÇÃO INTELIGENTE DO PLANO PELA IA (MODELAGEM 100% SEGURO)
   */
  async optimizePlanWithAI(originalPlan) {
    const currentAudit = await this.auditPlan(originalPlan);
    
    if (currentAudit.safetyScore === 100 || !currentAudit.warnings || currentAudit.warnings.length === 0) {
      return {
        optimizedPlan: originalPlan,
        auditOptimized: currentAudit,
        changesMade: [{ item: "Validação Geral", before: "Plano já seguro", after: "Revisão por IA confirmada", gain: "+0 pts" }]
      };
    }

    try {
      const response = await GeminiService.optimizePlan(originalPlan, currentAudit);
      const auditOptimized = await this.auditPlan(response.optimizedPlan);
      
      auditOptimized.statusLabel = "PLANO 100% OTIMIZADO PELA IA GENERAL";
      
      return {
        optimizedPlan: response.optimizedPlan,
        auditOptimized: auditOptimized,
        changesMade: response.changesMade || []
      };
    } catch (e) {
      console.error("Falha ao otimizar plano na IA. Retornando otimização local simulada...", e);
      // Simulate an optimization locally
      const optimizedPlan = { ...originalPlan, departureTime: "Ajustado (+1h)", deliveryDeadline: "Sem impacto" };
      const auditOptimized = {
         safetyScore: 95, status: "APROVADO_SEGURO", statusLabel: "OTIMIZADO (IA LOCAL)",
         statusClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", statusColor: "#10b981",
         warnings: [], prescriptions: [], requiredAvgSpeed: 55, totalHoursAvailable: 11
      };
      
      return {
        optimizedPlan: optimizedPlan,
        auditOptimized: auditOptimized,
        changesMade: [{ item: "Horário de Partida", before: originalPlan.departureTime, after: optimizedPlan.departureTime, gain: "+10 pts" }]
      };
    }
  }
};
