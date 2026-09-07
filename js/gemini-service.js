/**
 * GENERAL App - Gemini API Service
 */

const GeminiService = {
  API_KEY: "SUA_API_KEY_AQUI", // Removido para segurança
  API_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",

  async callGemini(prompt, isJsonResponse = false, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const payload = {
          contents: [{ parts: [{ text: prompt }] }]
        };

        if (isJsonResponse) {
          payload.generationConfig = { response_mime_type: "application/json" };
        }

        const response = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          // Se for 503 Unavailable, lança erro específico para forçar o retry
          if (response.status === 503) {
             throw new Error(`Serviço temporariamente indisponível (503).`);
          }
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) {
          throw new Error("Formato de resposta inválido retornado pelo Gemini");
        }

        let finalResponse = textResponse;
        if (isJsonResponse) {
          // Remove markdown formatting if Gemini includes it
          finalResponse = finalResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
          return JSON.parse(finalResponse);
        }
        return finalResponse;
      } catch (error) {
        lastError = error;
        console.warn(`Gemini API falhou na tentativa ${attempt}/${maxRetries}:`, error.message);
        
        if (attempt < maxRetries) {
          // Espera 2 segundos antes de tentar novamente (Exponencial simples)
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    }
    
    console.error("Gemini API falhou definitivamente:", lastError);
    throw lastError;
  },

  getMockResponse(prompt, isJsonResponse) {
    if (isJsonResponse) {
      if (prompt.includes("Avaliador de Desempenho e Auditoria Pós-Mortem")) {
        return {
          "responseQualityScore": 95,
          "managementRating": "ALTO DESEMPENHO (GESTÃO DE CRISE EXEMPLAR)",
          "originalDefects": [
            { "origin": "Fator Humano/Via", "defect": "Condição adversa na via e fadiga do condutor" }
          ],
          "auditedDecisions": [
            { "decision": "Isolamento da Área", "evaluatedStatus": "EXCELENTE", "comment": "Acionamento rápido da PRF e sinalização adequada, prevenindo riscos secundários." },
            { "decision": "Resposta Médica", "evaluatedStatus": "CONFORME", "comment": "Atendimento emergencial acionado dentro do protocolo de SLA (Golden Hour)." },
            { "decision": "Preservação da Carga", "evaluatedStatus": "ATENÇÃO", "comment": "Embora contida, a seguradora poderia ter sido notificada 10 minutos mais cedo." }
          ],
          "lessonsLearned": [
            "Reforçar treinamento de direção defensiva e regras de parada para descanso na rota.",
            "Otimizar o tempo de comunicação com a gerenciadora de risco nos primeiros 15 minutos."
          ],
          "conclusion": "A ocorrência foi gerenciada de forma altamente eficaz pela equipe tática. Os danos foram contidos rapidamente, a segurança da via foi mantida e o plano de ação minimizou os impactos financeiros e humanos."
        };
      }
      
      if (prompt.includes("Plano de Ação 5W2H")) {
        return [
          {
            "id": "ACT-01",
            "phase": "FASE 1: IMEDIATA",
            "priority": "CRÍTICA",
            "what": "Isolar a área e acionar suporte avançado",
            "why": "Preservar a cena do acidente e garantir atendimento médico e rodoviário imediato.",
            "who": "Gestor de Frota / Operador",
            "where": "Local do Acidente",
            "when": "Imediato",
            "how": "Utilizar contato de emergência da Concessionária e 191 (PRF)",
            "howMuch": "Sem custo",
            "completed": true
          }
        ];
      }
    }
    return `**[MODO OFFLINE] Orientações Táticas de Transbordo / Contenção:**\n\n1. **Isole a Área**: Mantenha raio de segurança (mín. 50 metros).\n2. **Acione Socorro**: Ligue 192 (SAMU) e 193 (Bombeiros) se houver vítimas ou vazamento.\n3. **Contenção**: Evite que o produto atinja vias hídricas.\n4. **Notifique**: Informe a Seguradora e PRF (191) imediatamente.\n\n*(Nota do Sistema: A integração com a IA está indisponível no momento pois a chave de API configurada não possui a 'Generative Language API' ativada no Google Cloud. Esta é uma resposta de contingência).*`;
  },

  async auditLogisticsPlan(plan) {
    let routeEvals = [];
    const routeKey = `route_eval_${plan.origin}_${plan.destination}`;
    let carrierEvals = [];
    const carrierKey = `carrier_eval_${plan.carrierName}`;
    
    try {
      if (window.db) {
        // Fetch Route Evals
        const routeSnapshot = await window.db.collection('route_evaluations')
          .where('origin', '==', plan.origin)
          .where('dest', '==', plan.destination)
          .get();
        routeSnapshot.forEach(doc => routeEvals.push(doc.data()));
        
        // Fetch Carrier Evals
        if (plan.carrierName) {
          const carrierSnapshot = await window.db.collection('carrier_evaluations')
            .where('carrier', '==', plan.carrierName)
            .get();
          carrierSnapshot.forEach(doc => carrierEvals.push(doc.data()));
        }
      }
    } catch (e) {
      console.warn("Firebase fetch failed, falling back to local storage", e);
    }
    
    if (routeEvals.length === 0) {
      routeEvals = JSON.parse(localStorage.getItem(routeKey) || '[]');
    }
    if (carrierEvals.length === 0 && plan.carrierName) {
      carrierEvals = JSON.parse(localStorage.getItem(carrierKey) || '[]');
    }

    let evalsText = 'Nenhuma avaliação histórica de rota encontrada.';
    if (routeEvals.length > 0) {
      const avgScore = (routeEvals.reduce((sum, e) => sum + e.score, 0) / routeEvals.length).toFixed(1);
      const comments = routeEvals.map(e => `- Nota ${e.score}/5: "${e.comments}"`).join('\n');
      evalsText = `Média Histórica da Rota: ${avgScore}/5 Estrelas\nComentários Recentes (Rota):\n${comments}`;
    }
    
    let carrierText = 'Nenhuma avaliação histórica de transportadora encontrada.';
    if (carrierEvals.length > 0) {
      const avgScore = (carrierEvals.reduce((sum, e) => sum + e.score, 0) / carrierEvals.length).toFixed(1);
      const comments = carrierEvals.map(e => `- Nota ${e.score}/5: "${e.comments}"`).join('\n');
      carrierText = `Média Histórica da Transportadora: ${avgScore}/5 Estrelas\nComentários Recentes (Transportadora):\n${comments}`;
    }

    const prompt = `
Você é uma IA Preditiva de Segurança Logística e Risco Rodoviário.
Analise rigorosamente o seguinte plano de viagem e audite potenciais perigos.
Retorne um objeto JSON ESTRITO com o seguinte formato:
{
  "safetyScore": <número de 10 a 100, onde 100 é perfeitamente seguro e 10 é risco iminente de acidente>,
  "status": "<APROVADO_SEGURO, APROVADO_COM_RESTRICOES, ou REPROVADO_CRITICO>",
  "statusLabel": "<Rótulo de exibição curto. Ex: PLANO INSEGURO • ALTO RISCO DE ACIDENTE>",
  "statusColor": "<#10b981 para seguro, #f59e0b para restrições, #f43f5e para crítico>",
  "statusClass": "<classes tailwind: bg-emerald-500/20 text-emerald-400 border-emerald-500/30 (seguro), amber para restrição, rose para crítico>",
  "warnings": [
    {
      "type": "<Categoria do Alerta (ex: CRONOBIOLOGIA, PRESSÃO_POR_PRAZO, CLIMA_EXTREMO, DINAMICA_CARGA)>",
      "severity": "<ALTA, MEDIA, CRITICA>",
      "title": "<Título do alerta>",
      "description": "<Descrição científica/técnica justificando o risco>",
      "penalty": "<ex: -20 pts>"
    }
  ],
  "prescriptions": [
    {
      "action": "<Ação corretiva curta e imperativa>",
      "detail": "<Detalhes de como executar a ação>"
    }
  ],
  "requiredAvgSpeed": <Velocidade média calculada (Distância / Tempo Disponível) em número inteiro>,
  "totalHoursAvailable": <Horas totais de viagem permitidas baseadas nos prazos, em número inteiro ou decimal>
}

=== DADOS DO PLANO ===
Origem: ${plan.origin}
Destino: ${plan.destination}
Distância: ${plan.distanceKm} KM
Rotas Previstas: ${plan.plannedRoads}
Partida: ${plan.departureTime}
Prazo Final de Entrega: ${plan.deliveryDeadline}

Carga: ${plan.cargoType} - ${plan.productName} (Código ONU: ${plan.onuCode || 'N/A'})
Peso da Carga: ${plan.cargoWeightTon} Toneladas
Enchimento do Tanque: ${plan.tankFillPercent}%

Veículo: ${plan.vehicleType}
Titular do Veículo: ${plan.isAssignedRegularTruck ? 'Sim' : 'Não (Veículo Reserva)'}
Motorista: ${plan.driverName}
Tempo de Empresa: ${plan.driverTenureDays} dias
Familiaridade com Rota: ${plan.driverRouteFamiliarity}
Modo: ${plan.driverMode}

=== CLIMA NO TRAJETO (MOCK DATA) ===
- Origem: ${JSON.stringify(plan.weatherForecast?.origin)}
- Trechos de Serra: ${JSON.stringify(plan.weatherForecast?.mountainPass)}
- Destino: ${JSON.stringify(plan.weatherForecast?.destination)}

=== AVALIAÇÕES HISTÓRICAS DE TERCEIROS (ROTA E TRANSPORTADORA) ===
${evalsText}
${carrierText}

Baseado nos princípios de fadiga (cronobiologia humana das 02:00 as 05:30), dinâmica de fluidos (efeito onda em tanques com líquidos perigosos parciais), familiaridade com rota (rotatividade alta), e limites de velocidade (média acima de 65km/h em veículos pesados induz excesso), gere a auditoria estrita no formato JSON.
    `;

    return this.callGemini(prompt, true);
  },

  async optimizePlan(plan, auditResults) {
    const prompt = `
Você é uma IA Preditiva Logística. Com base no plano de viagem original e na auditoria prévia, recalcule e ajuste os parâmetros para garantir a segurança MÁXIMA (Safety Score = 100).
Retorne APENAS um objeto JSON válido, contendo as alterações detalhadas, no formato:
{
  "optimizedPlan": { 
     "origin": "...",
     "destination": "...",
     "distanceKm": ...,
     "plannedRoads": "...",
     "departureTime": "...",
     "deliveryDeadline": "...",
     "cargoType": "...",
     "productName": "...",
     "onuCode": "...",
     "cargoWeightTon": ...,
     "tankFillPercent": ...,
     "cargoValue": ...,
     "vehicleType": "...",
     "plate": "...",
     "isAssignedRegularTruck": true,
     "driverName": "...",
     "driverTenureDays": ...,
     "driverRouteFamiliarity": "...",
     "driverMode": "...",
     "scheduledStops": [...],
     "weatherForecast": {...}
  },
  "changesMade": [
    { "item": "<Nome do campo, ex: Horário de Partida>", "before": "<Valor antigo>", "after": "<Novo valor>", "gain": "<ex: +22 pts>" }
  ]
}

=== PLANO ORIGINAL ===
${JSON.stringify(plan, null, 2)}

=== RESULTADO DA AUDITORIA (RISCOS IDENTIFICADOS) ===
${JSON.stringify(auditResults.warnings, null, 2)}

Analise os riscos e modifique o \`optimizedPlan\` para anular as penalidades. Garanta que todas as restrições foram resolvidas (ex: se cronobiologia afetada, jogue a partida para as 06:00).
    `;

    return this.callGemini(prompt, true);
  },

  async getCopilotResponse(question, incidentContext) {
    const prompt = `
Você é o Copilot de IA do aplicativo "GENERAL - Sistema Nativo de Gestão Logística".
Você orienta gestores operacionais sobre procedimentos críticos em incidentes de transporte de cargas (acidentes rodoviários, roubo, vazamentos).

=== CONTEXTO DO INCIDENTE ATUAL ===
${JSON.stringify(incidentContext || "Nenhum incidente selecionado", null, 2)}

=== PERGUNTA DO USUÁRIO ===
${question}

=== DIRETRIZES PARA A RESPOSTA ===
- Responda em Português Brasileiro (pt-BR).
- Seja profissional, direto, tático e imperativo (linguagem de sala de crise/comando).
- Use Markdown para dar destaque (negrito, listas).
- Se houver vítimas, priorize mencionar SAMU (192) e preservar vidas.
- Se houver produtos perigosos (Código ONU, Vazamento), reforce o risco ambiental e a contenção (Raio de isolamento da ABIQUIM, contato com Bombeiros 193).
- Se houver alto valor, mencione gerenciadora de risco, PRF e preservação da carga (Escolta).
- Não invente regras jurídicas se não tiver certeza, referencie ANTT, IBAMA ou normas SASSMAQ de forma genérica quando aplicável.
    `;

    return this.callGemini(prompt, false);
  },
  
  async generatePostMortem(incident) {
    const prompt = `
Você é o Avaliador de Desempenho e Auditoria Pós-Mortem do aplicativo GENERAL.
Analise a resposta dada pelo usuário a um incidente logístico.
Retorne um objeto JSON rigorosamente neste formato:
{
  "responseQualityScore": <número de 0 a 100>,
  "managementRating": "<ex: ALTO DESEMPENHO (GESTÃO DE CRISE EXEMPLAR), DESEMPENHO SATISFATÓRIO, ou DESEMPENHO CRÍTICO COM VULNERABILIDADES>",
  "originalDefects": [ { "origin": "...", "defect": "..." } ],
  "auditedDecisions": [
    { "decision": "<nome da frente de decisão (ex: Segurança Humana)>", "evaluatedStatus": "<EXCELENTE, PENDENTE, CONFORME, INCOMPLETA, ATENÇÃO, etc>", "comment": "<Breve explicação do porquê desta avaliação>" }
  ],
  "lessonsLearned": [
    "<Lição aprendida 1>",
    "<Lição aprendida 2>"
  ],
  "conclusion": "<Conclusão formal e sintética da atuação e fechamento>"
}

=== DADOS DO INCIDENTE E RESPOSTA ===
Checklists executados: ${JSON.stringify(incident.checklists)}
Detalhes do evento: ${incident.eventType} - ${incident.road}
Produto: ${incident.productName || 'Não especificado'}
Gravidade relatada: ${incident.severity}

Avalie o cumprimento dos protocolos emergenciais de contenção, socorro às vítimas (Golden Hour) e preservação pericial/ambiental.
    `;
    return this.callGemini(prompt, true);
  },

  async generate5W2HPlan(incident, fiveWhysAnswers) {
    const prompt = `
Você é um Especialista de Crises Logísticas do aplicativo GENERAL.
Seu objetivo é gerar um Plano de Ação 5W2H prescritivo baseado no Incidente e na investigação de Causa Raiz (Os 5 Porquês) fornecidos pelo gestor.
    
Retorne uma Array JSON estrita contendo de 3 a 7 objetos, correspondentes aos cards do plano de ação, utilizando o seguinte formato JSON rigoroso:
[
  {
    "id": "ACT-XX",
    "phase": "<Fase do plano. Ex: FASE 1: IMEDIATA, FASE 2: OPERACIONAL, FASE 3: CONCLUSÃO>",
    "priority": "<CRÍTICA, ALTA, MÉDIA, ou BAIXA>",
    "what": "<O que deve ser feito. Direto e imperativo>",
    "why": "<Por que deve ser feito>",
    "who": "<Quem é o responsável (cargo ou equipe)>",
    "where": "<Onde a ação ocorre>",
    "when": "<Prazo ou momento de execução>",
    "how": "<Instruções técnicas de como proceder>",
    "howMuch": "<Estimativa de custo, se houver, ou 'Sem custo direto'>",
    "completed": false
  }
]

=== DADOS DO INCIDENTE ===
Tipo: ${incident.eventType}
Rodovia: ${incident.road} (Km ${incident.km}), ${incident.city}
Produto Perigoso: ${incident.cargoType === 'PRODUTO_PERIGOSO' ? 'Sim' : 'Não'}
Veículo: ${incident.vehicleId}
Condutor: ${incident.driverName} (Status: ${incident.driverStatus})

=== INVESTIGAÇÃO DA CAUSA RAIZ (5 PORQUÊS) ===
1º Porquê: ${fiveWhysAnswers[0] || 'Não respondido'}
2º Porquê: ${fiveWhysAnswers[1] || 'Não respondido'}
3º Porquê: ${fiveWhysAnswers[2] || 'Não respondido'}
4º Porquê: ${fiveWhysAnswers[3] || 'Não respondido'}
5º Porquê (Causa Raiz): ${fiveWhysAnswers[4] || 'Não respondido'}

Crie ações lógicas e estruturadas que resolvem tanto a contenção da emergência atual quanto a mitigação da causa raiz identificada (os porquês). Divida as ações em Fases (1 a 3).
    `;
    return this.callGemini(prompt, true);
  }
};
