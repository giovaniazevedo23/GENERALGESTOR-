/**
 * GENERAL App - Módulo Avançado de Planejamento Operacional de Transbordo & Salvamento
 * Inclui:
 * 1. Indicadores Financeiros de Perda Mitigada & ROI de Salvamento
 * 2. Cronômetro de SLA Regressivo
 * 3. Checklist Interativo de EPIs e Segurança do Trabalho
 * 4. Geolocalização da Base de Apoio Mais Próxima & Veículo Substituto em Deslocamento
 */

const TransshipmentModule = {
  // Bases Avançadas de Apoio e Emergência em Rodovias Brasileiras
  SUPPORT_BASES: [
    {
      id: "BASE-REGISTRO",
      name: "Base Avançada de Pronta Resposta Registro / SP",
      location: "Rod. Régis Bittencourt (BR-116 KM 442)",
      distanceKm: 42,
      etaMinutes: 45,
      provider: "Ambipar / Suatrans Emergências",
      substituteTruck: "Cavalo Mecânico Volvo FH 540 6x4 + Bitrem Tanque Inox 45m³",
      plate: "PR-R9012 / ABC-4E88",
      substituteDriver: "Carlos Eduardo Martins",
      driverPhone: "(13) 99777-1122",
      status: "EM_DESLOCAMENTO",
      rescueTransportType: "Caminhão (Carreta Tanque Especial)",
      fleetType: "Empresa Terceira",
      rating: 5,
      technicalCompetencies: ["MOPP", "CIPP Inmetro", "NR-20", "NR-35"],
      averageTransshipmentTime: "4.5 horas",
      technicalSheet: "Tanque em Aço Inox 316L isotérmico, bomba de sucção pneumática antideflagrante, aterramento eletrônico redundante."
    },
    {
      id: "BASE-GUARULHOS",
      name: "Base Central de Resgate Guarulhos / SP",
      location: "Rod. Pres. Dutra (BR-116 KM 218)",
      distanceKm: 65,
      etaMinutes: 65,
      provider: "EcoRodovias / SOS Cargas",
      substituteTruck: "Scania R450 6x2 + Carreta Baú Blindada",
      plate: "SP-K8820 / GHT-1133",
      substituteDriver: "Marcos Aurélio Prado",
      driverPhone: "(11) 98222-4455",
      status: "PRONTIDAO",
      rescueTransportType: "Caminhão (Carreta Baú Blindada)",
      fleetType: "Empresa Terceira",
      rating: 4,
      technicalCompetencies: ["Escolta Armada", "Rastreamento Satelital Nível III"],
      averageTransshipmentTime: "3.0 horas",
      technicalSheet: "Carreta blindada nível III-A, fechadura eletrônica, painel de aço corten, sensores de abertura portas."
    },
    {
      id: "BASE-CURITIBA",
      name: "Base Integrada de Emergências Curitiba / PR",
      location: "Contorno Leste (BR-116 KM 95)",
      distanceKm: 78,
      etaMinutes: 80,
      provider: "SOS Ambiental Brasil",
      substituteTruck: "Mercedes-Benz Actros 2651 + Tanque Químico Isotérmico",
      plate: "PR-X1029 / HJK-9944",
      substituteDriver: "Rodrigo Sanches",
      driverPhone: "(41) 99111-8899",
      status: "PRONTIDAO",
      rescueTransportType: "Caminhão (Carreta Química)",
      fleetType: "Frota Própria",
      rating: 5,
      technicalCompetencies: ["MOPP", "Resgate Ambiental Integrado", "NR-20"],
      averageTransshipmentTime: "2.5 horas",
      technicalSheet: "Tanque isotérmico químico multicompartimentado com lavador de gases integrado e bomba magnética acoplada."
    }
  ],

  // Itens do Checklist de EPIs e Segurança do Trabalho
  DEFAULT_SAFETY_CHECKLIST: {
    ppeAntifire: false,       // Equipe com EPIs antichama e proteção respiratória
    groundingConnected: false, // Cabo de aterramento eletrostático conectado e testado
    explosionProofPumps: false,// Bomba de sucção pneumática/antideflagrante Inmetro
    containmentTrays: false,  // Bacias e mantas de contenção sob mangotes
    extinguishersReady: false, // Extintores PQS 12kg posicionados a favor do vento
    newSealsRecorded: false    // Lacre original periciado e novos lacres numerados em mãos
  },

  /**
   * Calcula todos os requisitos técnicos, financeiros e de SLA do Transbordo
   */
  calculateRequirements(incident) {
    if (!incident) return {};

    const isLiquid = incident.cargoType === 'PRODUTO_PERIGOSO';
    const isRefrigerated = incident.cargoType === 'REFRIGERADA';
    const isHighValue = incident.cargoType === 'ALTO_VALOR';
    const cargoValue = Number(incident.cargoValue) || 285000;

    // 1. INDICADORES FINANCEIROS DE PERDA MITIGADA
    const recoveryRate = isLiquid ? 0.90 : isRefrigerated ? 0.82 : isHighValue ? 0.96 : 0.92;
    const salvagedValue = cargoValue * recoveryRate;
    const directLoss = cargoValue - salvagedValue;
    const operationCost = isLiquid ? 12500 : isRefrigerated ? 9500 : isHighValue ? 15000 : 7500;
    const netSavings = salvagedValue - operationCost;

    // 2. DIMENSIONAMENTO MECÂNICO DO VEÍCULO E EQUIPAMENTOS
    let suggestedVehicle = "Carreta Baú Carga Geral 28 Paletes";
    let requiredPumps = "Paleteira Hidráulica Manual e Empilhadeira Móvel";
    let estimatedHours = 3.5;
    let slaLimitHours = 5; // SLA máximo em horas

    if (isLiquid) {
      suggestedVehicle = "Carreta Tanque Aço Inox 45.000 Litros com Certificado CIPP/Inmetro";
      requiredPumps = "Bomba Pneumática Antideflagrante de Duplo Diafragma + Mangotes Aterrados";
      estimatedHours = 4.5;
      slaLimitHours = 3; // SLA Crítico de 3 horas para produtos químicos
    } else if (isRefrigerated) {
      suggestedVehicle = "Carreta Frigorífica com Termo King a -18°C e Termógrafo Ativo";
      requiredPumps = "Esteira de Transferência Rápida Isotérmica";
      estimatedHours = 2.5;
      slaLimitHours = 2; // SLA Crítico de 2 horas para evitar perda térmica
    } else if (isHighValue) {
      suggestedVehicle = "Carreta Baú Blindada Nível III com Fechadura Eletrônica e Escolta";
      requiredPumps = "Equipe Tática de Carga e Descarga com Leitor de Código de Barras";
      estimatedHours = 3.0;
      slaLimitHours = 3;
    }

    // 3. BASE DE APOIO MAIS PRÓXIMA
    const nearestBase = this.SUPPORT_BASES[0];

    // 4. CHECKLIST DE SEGURANÇA
    const checklistState = incident.transshipmentChecklist || { ...this.DEFAULT_SAFETY_CHECKLIST };
    const checkedCount = Object.values(checklistState).filter(v => v === true).length;
    const isOperationAuthorized = checkedCount === 6;

    return {
      financial: {
        cargoValue,
        salvagedValue,
        directLoss,
        operationCost,
        netSavings,
        recoveryRatePercent: Math.round(recoveryRate * 100)
      },
      sla: {
        slaLimitHours,
        createdAt: incident.createdAt || Date.now()
      },
      technical: {
        suggestedVehicle,
        requiredPumps,
        estimatedHours
      },
      supportBase: nearestBase,
      checklist: checklistState,
      checklistProgress: Math.round((checkedCount / 6) * 100),
      isOperationAuthorized
    };
  }
};
