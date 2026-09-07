/**
 * GENERAL App - Motor de Inteligência Artificial Preditiva (Previsão de Risco de Acidentes em Rota)
 * Alimentado e Sincronizado Diretamente pelo Plano Logístico do Usuário
 */

const AIPredictiveEngine = {
  // Histórico de pontos críticos de rodovias brasileiras (Hotspots de Sinistros)
  ROAD_HOTSPOTS: [
    {
      road: "BR-116",
      section: "Serra do Cafezal (KM 280-310)",
      baseRisk: 35,
      dangerousFactors: ["Curvas de raio duplo", "Declive acentuado", "Neblina frequente", "Pista úmida"],
      speedLimit: 60
    },
    {
      road: "BR-101",
      section: "Morro do Boi (KM 140-143)",
      baseRisk: 28,
      dangerousFactors: ["Declive em curva", "Intenso fluxo de veículos leves", "Vento lateral"],
      speedLimit: 70
    },
    {
      road: "BR-381",
      section: "Trecho Betim -> Nova Era (Rodovia da Morte)",
      baseRisk: 42,
      dangerousFactors: ["Pista simples", "Curvas cegas", "Asfalto irregular"],
      speedLimit: 60
    },
    {
      road: "SP-330",
      section: "Descida de Perus (KM 25-30)",
      baseRisk: 20,
      dangerousFactors: ["Frenagem brusca", "Superaquecimento de tambor de freio"],
      speedLimit: 80
    }
  ],

  /**
   * Converte o Plano Logístico do Usuário em Vetores de Simulação Preditiva
   */
  simulateFromLogisticsPlan(plan) {
    if (!plan) return this.forecastRisk({});

    const depDate = new Date(plan.departureTime);
    const deadDate = new Date(plan.deliveryDeadline);
    const depHour = depDate.getHours();
    
    // 1. Horas Contínuas ao Volante (calculadas da distância e paradas)
    const totalHoursAvailable = Math.max(0.5, (deadDate.getTime() - depDate.getTime()) / (1000 * 3600));
    const drivingHours = Math.min(10, Math.max(1, totalHoursAvailable));

    // 2. Velocidade Necessária para a Janela vs. Limite da Serra (60 km/h)
    const speedKmH = Math.round(plan.distanceKm / totalHoursAvailable);
    const speedLimit = 60; // Padrão de serra

    // 3. Mapeamento Meteorológico do Trecho Crítico
    let weather = "ENSOLARADO";
    const mtnRain = plan.weatherForecast?.mountainPass?.rainMmH || 0;
    if (mtnRain >= 30) weather = "TEMPESTADE";
    else if (mtnRain >= 10) weather = "CHUVOSO";
    else if (plan.weatherForecast?.mountainPass?.condition?.includes("Neblina")) weather = "NEBLINA";
    else if (mtnRain > 0) weather = "CHUVOSO";

    // 4. Dinâmica da Carga
    let cargoType = "SECA";
    if (plan.cargoType === 'PRODUTO_PERIGOSO') cargoType = "LIQUIDO_PERIGOSO";
    else if (plan.cargoType === 'ALTO_VALOR') cargoType = "ALTO_VALOR";
    else if (plan.cargoType === 'REFRIGERADA') cargoType = "REFRIGERADA";

    // 5. Temperatura de Freios e Pneus estimada pela dinâmica da serra e rotatividade
    const brakeTempCelsius = speedKmH > 70 ? 320 : speedKmH > 60 ? 260 : 180;
    const tireHealthPercent = plan.isAssignedRegularTruck ? 65 : 35;
    const isNightTime = (depHour >= 0 && depHour <= 5) || depHour >= 22;

    const forecast = this.forecastRisk({
      drivingHours,
      speedKmH,
      speedLimit,
      weather,
      cargoType,
      brakeTempCelsius,
      tireHealthPercent,
      isNightTime
    });

    return {
      ...forecast,
      planBinding: {
        planId: plan.id || 'PLANO_ATIVO',
        clientName: plan.clientName || 'Não informado',
        productName: plan.productName || 'Não informado',
        route: `${plan.origin || 'Origem'} -> ${plan.destination || 'Destino'}`,
        drivingHours,
        speedKmH,
        weather,
        cargoType,
        isNightTime
      }
    };
  },

  /**
   * Calcula a probabilidade de acidente (0 a 100%) baseado nas variáveis operacionais
   */
  forecastRisk(params) {
    const {
      drivingHours = 4,
      speedKmH = 80,
      speedLimit = 60,
      weather = 'CHUVOSO', // ENSOLARADO, NUBLADO, CHUVOSO, TEMPESTADE, NEBLINA
      cargoType = 'LIQUIDO_PERIGOSO', // SECA, LIQUIDO_PERIGOSO, ALTO_VALOR, REFRIGERADA
      driverTenure = 'ALTA', // NOVA, MEDIA, ALTA
      cargoOrg = 'BAIXO_CG', // BAIXO_CG, ALTO_CG, SOLTA
      isNightTime = false
    } = params;

    let score = 15; // Probabilidade basal de rodovia

    // 1. FATOR FADIGA (Horas de condução ininterrupta)
    if (drivingHours > 7) score += 32;
    else if (drivingHours > 5.5) score += 20; // Acima da Lei do Motorista
    else if (drivingHours > 4) score += 8;

    // 2. FATOR EXCESSO DE VELOCIDADE
    const speedRatio = speedKmH / Math.max(1, speedLimit);
    if (speedRatio > 1.35) score += 35; // 35% acima do limite
    else if (speedRatio > 1.15) score += 22;
    else if (speedRatio > 1.0) score += 10;

    // 3. FATOR METEOROLÓGICO
    switch (weather) {
      case 'TEMPESTADE': score += 26; break;
      case 'NEBLINA': score += 22; break;
      case 'CHUVOSO': score += 14; break;
      case 'NUBLADO': score += 4; break;
      case 'ENSOLARADO': score += 0; break;
    }

    // 4. FATOR CARGA / INSTABILIDADE
    if (cargoType === 'LIQUIDO_PERIGOSO') score += 18; // Efeito onda de fluidos
    else if (cargoType === 'ALTO_VALOR') score += 8; // Risco de desvio forçado/abordagem
    else if (cargoType === 'REFRIGERADA') score += 5;

    // 5. ESTADO DA ORGANIZAÇÃO (Estiva)
    if (cargoOrg === 'ALTO_CG') score += 25; // Risco crítico de tombamento
    else if (cargoOrg === 'SOLTA') score += 18; // Risco de desbalanceamento

    // 6. EXPERIÊNCIA DO MOTORISTA
    if (driverTenure === 'NOVA') score += 15; // Pouca experiência / falha humana
    else if (driverTenure === 'MEDIA') score += 5;

    // 7. PERÍODO NOTURNO
    if (isNightTime) score += 12;

    // Normalização (0 a 99%)
    const probability = Math.min(99, Math.max(5, score));

    // Determinação do Modo de Falha Mais Provável
    let predictedFailureMode = "RISCO CONTROLADO / SEM ANOMALIA PREVISTA";
    const preventiveActions = [];

    if (cargoType === 'LIQUIDO_PERIGOSO' && speedRatio > 1.15 && (weather === 'CHUVOSO' || weather === 'TEMPESTADE')) {
      predictedFailureMode = "TOMBAMENTO EM CURVA DE DECLIVE POR EFEITO ONDA E PERDA DE ADERÊNCIA";
      preventiveActions.push("Reduzir imediatamente velocidade para 45 km/h no trecho de serra");
      preventiveActions.push("Evitar freadas bruscas durante a curva (desacelerar no retardo antes da entrada)");
    } else if (cargoOrg === 'ALTO_CG' && speedRatio > 1.1) {
      predictedFailureMode = "TOMBAMENTO POR CENTRO DE GRAVIDADE ALTO EM CURVA FECHADA";
      preventiveActions.push("Reduzir a velocidade para 30% abaixo do limite em todas as curvas");
      preventiveActions.push("Reavaliar a estiva e a amarração da carga no próximo ponto de parada");
    } else if (drivingHours > 5.5 || isNightTime) {
      predictedFailureMode = "SAÍDA DE PISTA OU COLISÃO TRASEIRA POR MICRO-SONO / FADIGA DO MOTORISTA";
      preventiveActions.push("Cumprir imediatamente parada obrigatória de 30 minutos (Lei 13.103/15)");
      preventiveActions.push("Acionar telemetria com sensor de fadiga e desvio de faixa");
    } else if (weather === 'TEMPESTADE' && driverTenure === 'NOVA') {
      predictedFailureMode = "AQUAPLANAGEM COM PERDA DIRECIONAL DO CAVALO MECÂNICO (FALHA HUMANA/PÂNICO)";
      preventiveActions.push("Reduzir velocidade em 40% em relação ao limite da via");
      preventiveActions.push("Manter distância mínima de 150 metros do veículo à frente");
    }

    let alertLevel = "BAIXO";
    let badgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    let color = "#10b981";

    if (probability >= 70) {
      alertLevel = "CRÍTICO (IMINENTE)";
      badgeClass = "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse";
      color = "#f43f5e";
    } else if (probability >= 40) {
      alertLevel = "MODERADO / ATENÇÃO";
      badgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/30";
      color = "#f59e0b";
    }

    return {
      probability,
      alertLevel,
      badgeClass,
      color,
      predictedFailureMode,
      preventiveActions: preventiveActions.length > 0 ? preventiveActions : ["Manter direção defensiva e monitoramento ativo por telemetria."],
      rawScores: {
        fatigue: drivingHours > 5.5 ? 'ALTO' : 'NORMAL',
        speed: speedRatio > 1.1 ? 'EXCESSO' : 'ADEQUADO',
        thermalBrakes: brakeTempCelsius > 250 ? 'ALERTA' : 'NORMAL',
        tires: tireHealthPercent < 40 ? 'CRÍTICO' : 'BOM'
      }
    };
  }
};
