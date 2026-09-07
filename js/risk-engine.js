/**
 * GENERAL App - Motor de Cálculo de Risco Dinâmico & Próximas Ações
 */

const RiskEngine = {
  calculateScore(incident) {
    if (!incident) return { score: 0, level: "BAIXO", badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", color: "#10b981", factors: [], actions: [] };

    let score = 20; // Base score
    const factors = [];
    const actions = [];

    // 1. Fator: Condição do Condutor / Pessoas (Peso alto)
    if (incident.driverStatus === "PRESO_FERRAGENS") {
      score += 35;
      factors.push({ name: "Condutor preso às ferragens (Risco Vital)", points: 35, type: "danger" });
      if (!incident.checklists.samuDispatched) {
        actions.push({ priority: 1, title: "Acionar Resgate SAMU/Bombeiros Imediatamente (192/193)", category: "VIDA" });
      }
    } else if (incident.driverStatus === "FERIDO_GRAVE") {
      score += 25;
      factors.push({ name: "Condutor ferido gravemente", points: 25, type: "danger" });
      if (!incident.checklists.samuDispatched) {
        actions.push({ priority: 1, title: "Despachar ambulância com suporte avançado (SAMU)", category: "VIDA" });
      }
    } else if (incident.driverStatus === "FERIDO_LEVE") {
      score += 10;
      factors.push({ name: "Condutor com escoriações/ferimentos leves", points: 10, type: "warning" });
    }

    
    // 2. Fator: Tipo de Carga e Periculosidade
    if (incident.cargoType === "PRODUTO_PERIGOSO") {
      score += 25;
      factors.push({ name: "Carga de Produto Perigoso (HazMat / ONU)", points: 25, type: "danger" });
      if (incident.damageCondition === "PERDA_PARCIAL_VAZAMENTO" || incident.damageCondition === "TOTAL") {
        score += 15;
        factors.push({ name: "Vazamento ativo de produto químico/inflamável", points: 15, type: "danger" });
        if (!incident.checklists.isolated) {
          actions.push({ priority: 2, title: "Isolar perímetro conforme Ficha de Emergência ONU", category: "SEGURANÇA" });
        }
        if (!incident.checklists.cetesbNotified) {
          actions.push({ priority: 3, title: "Notificar Órgão Ambiental e Empresa de Pronta Resposta", category: "AMBIENTAL" });
        }
      }
    } else {
      try {
        const catalog = JSON.parse(localStorage.getItem('GENERAL_CARGO_CATALOG') || '[]');
        const cargo = catalog.find(c => c.name === incident.cargoType);
        if (cargo) {
          score += cargo.risk;
          factors.push({ name: `Carga: ${cargo.name} (${cargo.category})`, points: cargo.risk, type: cargo.risk > 40 ? "danger" : "warning" });
        } else if (incident.cargoType === "ALTO_VALOR") {
          score += 15;
          factors.push({ name: "Carga de Alto Valor Agregado (Risco de Saque/Roubo)", points: 15, type: "warning" });
          if (!incident.checklists.isolated) {
            actions.push({ priority: 2, title: "Posicionar Escolta Armada / Preservação no Local", category: "PATRIMÔNIO" });
          }
        }
      } catch(e) {}
    }

    // 3. Fator: Condições da Pista e Clima
    if (incident.weather === "CHUVA_INTENSA" || incident.weather === "NEBLINA") {
      score += 10;
      factors.push({ name: "Clima adverso severo (Visibilidade/Aderência reduzida)", points: 10, type: "warning" });
      if (!incident.checklists.signalized) {
        actions.push({ priority: 2, title: "Reforçar sinalização com cones e pisca-alerta a 200m", category: "TRÂNSITO" });
      }
    }

    if (incident.roadCondition === "PISTA_MOLHADA_INTERDITADA" || incident.roadCondition === "OLEO_NA_PISTA") {
      score += 10;
      factors.push({ name: "Pista interditada / Óleo espalhado na via", points: 10, type: "warning" });
      if (!incident.checklists.prfNotified) {
        actions.push({ priority: 2, title: "Acionar PRF / Concessionária para desvio de tráfego", category: "RODOVIA" });
      }
    }

    // 4. Fator: Risco Ambiental / Proximidade de Córrego
    if (incident.drainageProximity) {
      score += 15;
      factors.push({ name: "Manancial ou rede pluvial a menos de 100m", points: 15, type: "danger" });
      actions.push({ priority: 3, title: "Instalar barreiras e mantas absorventes no leito d'água", category: "AMBIENTAL" });
    }

    // 5. Reduções por Ações Já Executadas (Checklists)
    if (incident.checklists.driverSafe) score -= 5;
    if (incident.checklists.signalized) score -= 5;
    if (incident.checklists.isolated) score -= 5;
    if (incident.checklists.insurerNotified) score -= 5;
    if (incident.checklists.transshipmentReady) score -= 5;

    // Normalização (0 - 100)
    score = Math.max(5, Math.min(100, score));

    // Determinação de Nível e Estilos
    let level = "BAIXO";
    let badgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    let color = "#10b981";

    if (score >= 80) {
      level = "CRÍTICO";
      badgeClass = "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse";
      color = "#f43f5e";
    } else if (score >= 60) {
      level = "ALTO";
      badgeClass = "bg-orange-500/20 text-orange-400 border-orange-500/30";
      color = "#f97316";
    } else if (score >= 35) {
      level = "MODERADO";
      badgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/30";
      color = "#f59e0b";
    }

    // Próxima ação recomendada prioritária
    if (actions.length === 0) {
      if (!incident.checklists.insurerNotified) {
        actions.push({ priority: 4, title: "Registrar aviso de sinistro junto à Seguradora", category: "REGULAÇÃO" });
      }
      if (!incident.checklists.evidencePreserved) {
        actions.push({ priority: 4, title: "Fotografar lacres, tacógrafo e marcas de frenagem", category: "PERÍCIA" });
      }
      if (actions.length === 0) {
        actions.push({ priority: 5, title: "Acompanhar transbordo e emitir dossiê final", category: "FINALIZAÇÃO" });
      }
    }

    actions.sort((a, b) => a.priority - b.priority);

    return {
      score,
      level,
      badgeClass,
      color,
      factors,
      actions,
      topAction: actions[0]
    };
  }
};
