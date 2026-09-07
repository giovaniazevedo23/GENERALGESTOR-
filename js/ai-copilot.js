/**
 * GENERAL App - IA Prescritiva, Copilot 24h & Auditoria Pós-Mortem de Decisões do Gestor
 */

const AICopilotEngine = {
  FEEDBACK_STORAGE_KEY: 'GENERAL_AI_FEEDBACK_HISTORY',

  loadFeedbackHistory() {
    try {
      const raw = localStorage.getItem(this.FEEDBACK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  },

  saveFeedback(actionId, status, rating, notes = "") {
    const history = this.loadFeedbackHistory();
    history.push({
      actionId,
      status,
      rating,
      notes,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(this.FEEDBACK_STORAGE_KEY, JSON.stringify(history));
  },

  /**
   * Gera o Plano de Ação Inteligente (5W2H) sob medida para o Gestor
   */
  async generatePrescriptiveActionPlan(incident, fiveWhysAnswers = []) {
    if (!incident) return [];

    try {
      if (window.GeminiService) {
        const aiPlan = await GeminiService.generate5W2HPlan(incident, fiveWhysAnswers);
        if (aiPlan && Array.isArray(aiPlan)) {
          return aiPlan;
        }
      }
    } catch (e) {
      console.error("Falha ao gerar plano 5W2H com Gemini. Usando plano estático (fallback).", e);
    }

    const hazmat = findHazmatByQuery(incident.onuCode);
    const isLiquidPeril = incident.cargoType === 'PRODUTO_PERIGOSO';
    const isHighValue = incident.cargoType === 'ALTO_VALOR';
    const isDriverInjured = incident.driverStatus !== 'ILESO_CONSCIENTE';
    const hasDrainageThreat = incident.drainageProximity;

    const plan = [];

    // FASE 1: AÇÕES IMEDIATAS / SALVA-VIDAS & CONTENÇÃO (0 a 30 min)
    plan.push({
      id: "ACT-00",
      phase: "FASE 1: IMEDIATA (0-30 min)",
      priority: "CRÍTICA",
      what: "Isolamento primário e acionamento de autoridades competentes (PRF / PRE)",
      why: "Garantir a segurança da via, evitar novos acidentes e cumprir a legislação de trânsito vigente.",
      who: incident.responsible || "Motorista / Operador de Plantão",
      where: `${incident.road}, ${incident.km} (${incident.city})`,
      when: "Imediato",
      how: "Sinalizar a via com triângulo a distância segura e contatar o 191/198 informando o ocorrido.",
      howMuch: "Sem custo direto",
      completed: incident.checklists?.isolated || false
    });

    if (isDriverInjured) {
      plan.push({
        id: "ACT-01",
        phase: "FASE 1: IMEDIATA (0-30 min)",
        priority: "CRÍTICA",
        what: "Acionar e monitorar socorro avançado SAMU (192) / Resgate Concessionária",
        why: "Preservação da vida do condutor, obrigação de socorro e mitigação de responsabilidade civil/penal.",
        who: incident.responsible || "Operador de Plantão",
        where: `${incident.road}, ${incident.km} (${incident.city})`,
        when: "Primeiros 10 minutos (SLA: Imediato)",
        how: "Ligar 192 ou 0800 da concessionária informando se há vítima presa em ferragens e sinais vitais.",
        howMuch: "Sem custo direto (Serviço público/concessão)",
        completed: incident.checklists.samuDispatched || false
      });
    }

    if (isLiquidPeril && (incident.damageCondition === 'PERDA_PARCIAL_VAZAMENTO' || incident.damageCondition === 'TOTAL')) {
      plan.push({
        id: "ACT-02",
        phase: "FASE 1: IMEDIATA (0-30 min)",
        priority: "CRÍTICA",
        what: `Isolar perímetro de ${hazmat ? hazmat.isolamentoGrandeVazamento : 150}m e conter vazamento de ${hazmat ? hazmat.nome : 'Produto Químico'}`,
        why: "Evitar ignição explosiva, asfixia de terceiros e crime ambiental gravíssimo (Lei 9.605/98).",
        who: "Equipe de Apoio Local & Polícia Rodoviária",
        where: `Perímetro de ${hazmat ? hazmat.isolamentoGrandeVazamento : 150}m ao redor do veículo`,
        when: "Primeiros 15 minutos",
        how: `Eliminar fontes de calor. Construir dique de contenção com areia/terra. Conforme Guia ABIQUIM ${hazmat ? hazmat.guia : '128'}.`,
        howMuch: "R$ 1.500 - R$ 5.000 (Mantas e materiais absorventes)",
        completed: incident.checklists.isolated || false
      });

      if (hasDrainageThreat) {
        plan.push({
          id: "ACT-03",
          phase: "FASE 1: IMEDIATA (0-30 min)",
          priority: "CRÍTICA",
          what: "Bloqueio preventivo de bueiros e instalação de barreiras no leito hídrico",
          why: "Conter propagação do produto em mananciais públicos, evitando multas diárias e paralisação de captação.",
          who: "Empresa de Pronta Resposta Ambiental (Ambipar / Suatrans)",
          where: `Ponto de escoamento a ${incident.reference || 'margem da rodovia'}`,
          when: "Primeiros 30 minutos",
          how: "Lançar barreiras de contenção absorventes oleofílicas e fechar grelhas com mantas vedantes.",
          howMuch: "R$ 8.000 - R$ 25.000 (Mobilização de Pronta Resposta)",
          completed: incident.checklists.cetesbNotified || false
        });
      }
    }

    if (isHighValue) {
      plan.push({
        id: "ACT-04",
        phase: "FASE 1: IMEDIATA (0-30 min)",
        priority: "ALTA",
        what: "Mobilizar Escolta Armada de Preservação e Gerenciadora de Risco",
        why: "Prevenir saque de carga e garantir cobertura integral da apólice RCF-DC.",
        who: "Gerenciadora de Risco (GR) & Empresa de Escolta",
        where: `${incident.road} ${incident.km}`,
        when: "Primeiros 20 minutos",
        how: "Enviar coordenadas georreferenciadas para a viatura de escolta mais próxima e acionar botão de pânico.",
        howMuch: "Incluso em contrato / Adicional de R$ 1.200 diária",
        completed: (incident.checklists && incident.checklists.isolated) || false
      });
    }

    // FASE 2: OPERACIONAL & REGULAÇÃO DE SINISTRO (30 min a 2 horas)
    plan.push({
      id: "ACT-05",
      phase: "FASE 2: OPERACIONAL (30-120 min)",
      priority: "ALTA",
      what: "Abertura formal de sinistro com envio de Dossiê Preliminar à Seguradora",
      why: "Garantir vistoria prévia e aprovação formal antes de qualquer movimentação de carga/veículo.",
      who: incident.responsible || "Gestor de Sinistros",
      where: "Central de Regulação da Seguradora (Porto / Tokio / Allianz)",
      when: "Até 1 hora após o evento",
      how: "Disparar e-mail formal gerado pelo GENERAL contendo fotos, NF-e, manifesto e descrição do dano.",
      howMuch: "Sem custo",
      completed: (incident.checklists && incident.checklists.insurerNotified) || false
    });

    plan.push({
      id: "ACT-06",
      phase: "FASE 2: OPERACIONAL (30-120 min)",
      priority: "ALTA",
      what: "Despachar conjunto de transbordo e guincho pesado homologado",
      why: "Desobstruir a rodovia conforme exigência da concessionária e salvar mercadoria remanescente.",
      who: "Coordenador de Tráfego / Transportadora",
      where: "Base operacional -> Local do acidente",
      when: "Até 90 minutos após confirmação da perícia",
      how: `Posicionar ${isLiquidPeril ? 'Tanque com bomba antideflagrante e aterramento' : 'Carreta baú com paleteira'} e aplicar novos lacres.`,
      howMuch: "R$ 4.500 - R$ 18.000 (Guincho Lança + Frota Extra)",
      completed: (incident.checklists && incident.checklists.transshipmentReady) || false
    });

    // FASE 3: ENCERRAMENTO, AUDITORIA & PREVENÇÃO (2h a 24h)
    plan.push({
      id: "ACT-07",
      phase: "FASE 3: INVESTIGAÇÃO & RELATÓRIO (Até 48h)",
      priority: "MÉDIA",
      what: "Concluir Dossiê de Investigação RCA e aprovar Plano de Prevenção",
      why: "Atendimento de compliance, encerramento de sinistro e melhoria contínua.",
      who: "Comitê de Segurança Logística",
      where: "Plataforma GENERAL PAAC",
      when: "Em até 48 horas",
      how: "Consolidar 5W2H, laudos periciais e Boletim de Ocorrência no Dossiê Digital.",
      howMuch: "Sem custo",
      completed: (incident.checklists && incident.checklists.dossierReady) || false
    });

    if (fiveWhysAnswers && fiveWhysAnswers[4] && fiveWhysAnswers[4].trim() !== '') {
      plan.push({
        id: "ACT-ROOT",
        phase: "FASE 4: PREVENÇÃO DA CAUSA RAIZ (Médio/Longo Prazo)",
        priority: "ESTRATÉGICA",
        what: `Mitigar causa raiz: ${fiveWhysAnswers[4]}`,
        why: "Evitar a recorrência do mesmo modo de falha (Ação baseada no 5º Porquê da investigação).",
        who: "Engenharia / Gestão de Riscos",
        where: "Plano Logístico / Matriz",
        when: "Próximos 15 dias",
        how: "Revisar parâmetros de roteirização, atualizar matriz de risco e promover treinamento focado na causa identificada.",
        howMuch: "Variável (Depende da ação definitiva)",
        completed: false
      });
    }

    return plan;
  },

  /**
   * NOVO: AUDITORIA PÓS-MORTEM DE DECISÕES DO GESTOR & FECHAMENTO DE OCORRÊNCIA
   * Avalia os defeitos originais do evento e o desempenho das atitudes tomadas pelo gestor
   */
  async generatePostMortemAudit(incident) {
    if (!incident) return null;

    try {
      return await GeminiService.generatePostMortem(incident);
    } catch (e) {
      console.error("Falha ao gerar post-mortem via IA. Usando fallback.", e);
      const checklist = incident.checklists || {};
      const totalItems = Object.keys(checklist).length;
      const completedItems = Object.values(checklist).filter(v => v === true).length;
      const responseQualityScore = Math.round((completedItems / Math.max(1, totalItems)) * 100);

      const originalDefects = [
        { origin: "Sistema", defect: "Falha na comunicação com a IA do Gemini." }
      ];

      const auditedDecisions = [
        {
          decision: "Qualidade Geral",
          evaluatedStatus: responseQualityScore > 70 ? "CONFORME" : "ATENÇÃO",
          comment: `Checklist concluído em ${responseQualityScore}%`
        }
      ];

      return {
        responseQualityScore,
        managementRating: "AVALIAÇÃO MANUAL NECESSÁRIA (IA OFFLINE)",
        originalDefects,
        auditedDecisions,
        lessonsLearned: ["Restaurar conexão com API do Gemini."],
        conclusion: `A ocorrência ${incident.id} foi gerenciada com índice de resolução de ${responseQualityScore}%.`
      };
    }
  },

  async askCopilot(userQuestion, incident) {
    if (!userQuestion) return "Por favor, digite sua dúvida operacional ou regulatória.";

    let safeContext = null;
    if (incident) {
      try {
        safeContext = JSON.parse(JSON.stringify(incident, (key, value) => {
          // Remove potential circular references like Leaflet objects
          if (key === 'marker' || key === 'circle' || key === 'map') return undefined;
          return value;
        }));
      } catch (e) {
        safeContext = { id: incident.id, title: incident.title, type: incident.eventType, road: incident.road };
      }
    }

    try {
      return await GeminiService.getCopilotResponse(userQuestion, safeContext);
    } catch (e) {
      console.error("Erro ao chamar o Copilot Gemini", e);
      return GeminiService.getMockResponse(userQuestion, false);
    }
  }
};
