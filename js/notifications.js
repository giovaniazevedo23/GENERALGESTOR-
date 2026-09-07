/**
 * GENERAL App - Central Multicanal de Acionamentos e Notificações Rápidas
 * Inclui Aviso Oficial Automático de Sinistro, Perícia e Atraso ao Cliente/Embarcador
 */

const NotificationHub = {
  getTemplate(type, incident) {
    if (!incident) return "";
    const dateStr = new Date(incident.occurredAt || Date.now()).toLocaleString('pt-BR');
    const hazmat = findHazmatByQuery(incident.onuCode);

    switch (type) {
      case 'AVISO_CLIENTE_SINISTRO_ATRASO':
        return `🚨 *[COMUNICADO OFICIAL DE SINISTRO & PREVISÃO DE ATRASO]* 🚨

Prezado(a) Cliente / Recebedor da Carga da *${incident.carrier ? 'Techline Brasil' : 'Empresa Parceira'}*,

Informamos que o veículo responsável pelo transporte da sua carga (amparada pelo documento *${incident.nfeNumber || 'NF-e Registrada'}* - *${incident.cargoDescription}*) sofreu uma intercorrência operacional rodoviária (*${incident.eventType}*) em *${incident.city}* na rodovia *${incident.road}*.

📌 *STATUS ATUAL DA OPERAÇÃO:*
1. *Segurança & Vidas:* As medidas de preservação da integridade do condutor e isolamento da área foram executadas com sucesso.
2. *Análise Documental & Pericial:* A carga encontra-se neste momento sob *rigorosa análise documental e pericial técnica* para apuração detalhada da dinâmica do evento, verificação de lacres e integridade dos volumes.
3. *Previsão de Atraso:* Em virtude dos protocolos regulatórios da ANTT e dos procedimentos de segurança exigidos para este tipo de produto, a entrega programada *sofrerá atrasos operacionais*.

Nossa Central de Gestão de Crises está monitorando o plano de transbordo e contingência em tempo real pelo protocolo *${incident.id}*.

Manteremos atualizações contínuas sobre a liberação da carga e o novo horário estimado de entrega.

Atenciosamente,
*${incident.responsible || 'Gestão de Sinistros & Crises Logísticas'}*
Plataforma GENERAL PAAC 360°`;

      case 'EMAIL_CLIENTE_SINISTRO_ATRASO':
        return `Prezados Senhores da Área de Recebimento,

Vimos por meio deste comunicar formalmente a ocorrência de sinistro rodoviário envolvendo o veículo transportador da sua mercadoria, amparada pela ${incident.nfeNumber || 'NF-e correspondente'} (${incident.cargoDescription}).

DADOS DO EVENTO:
- Protocolo no Sistema GENERAL: ${incident.id}
- Tipo de Ocorrência: ${incident.eventType}
- Data e Horário: ${dateStr}
- Local: ${incident.road}, ${incident.km} (${incident.city})

SITUAÇÃO DA CARGA E PERÍCIA TÉCNICA:
Informamos que, conforme nossos protocolos de gestão de riscos e exigências securitárias, a carga está passando neste momento por um processo criterioso de ANÁLISE DOCUMENTAL E PERICIAL no local, a fim de apurar com exatidão os fatos ocorridos, integridade dos lacres e eventuais avarias.

IMPACTO NA ENTREGA:
Devido à natureza do produto e à necessidade de conclusão dos laudos periciais e procedimentos de transbordo seguro, a entrega anteriormente agendada sofrerá atrasos. 

Estamos empenhados na máxima agilidade para minimizar o impacto na sua operação e forneceremos boletins periódicos sobre a evolução do salvamento e previsão de continuidade.

Canal de Atendimento 24h: ${incident.responsible} • GENERAL PAAC 360°`;

      case 'WHATSAPP_EMERGENCIA':
        return `🚨 *[ALERTA GENERAL - PAAC]* 🚨
*Ocorrência:* ${incident.id} - ${incident.eventType}
*Data/Hora:* ${dateStr}
*Localização:* ${incident.road}, ${incident.km} - ${incident.city}
*Referência:* ${incident.reference || 'N/A'}
*Veículo:* ${incident.plate} (${incident.vehicleType})
*Motorista:* ${incident.driverName} - ${incident.driverStatus}
*Carga:* ${incident.cargoDescription || incident.cargoType} ${hazmat ? `(ONU ${hazmat.onu} - ${hazmat.nome})` : ''}
*Severidade:* ${incident.severity} | *Avaria:* ${incident.damageCondition}
*Responsável:* ${incident.responsible}

*Ações Imediatas:* Pista sinalizada, autoridades acionadas. Acompanhe em tempo real pelo sistema GENERAL.`;

      case 'EMAIL_SEGURADORA':
        return `Prezados Senhores da Regulação de Sinistros,

Vimos por meio deste comunicar formalmente a ocorrência de sinistro rodoviário envolvendo veículo transportador com cobertura securitária ativa.

DADOS DA OCORRÊNCIA:
- Código no Sistema GENERAL: ${incident.id}
- Tipo de Evento: ${incident.eventType}
- Data e Hora do Sinistro: ${dateStr}
- Rodovia / Trecho: ${incident.road}, ${incident.km} (${incident.city})
- Coordenadas GPS: ${incident.lat}, ${incident.lng}

DADOS DO TRANSPORTE:
- Transportadora: ${incident.carrier || 'N/A'}
- Placa Cavalo/Carreta: ${incident.plate}
- Condutor: ${incident.driverName} (Status: ${incident.driverStatus})
- Documento Fiscal: ${incident.nfeNumber} / ${incident.manifestNumber}
- Lacre de Segurança: ${incident.sealNumber} (${incident.sealIntact ? 'ÍNTEGRO' : 'ROMPIDO / VIOLADO'})
- Descrição da Carga: ${incident.cargoDescription}
- Valor Declarado: R$ ${Number(incident.cargoValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

MEDIDAS DE CONTENÇÃO ADOTADAS:
- Segurança de pessoas assegurada e local isolado.
- Cadeia de custódia e registros fotográficos em andamento no sistema.
- Solicitação de vistoria e acompanhamento para liberação de transbordo.

Atenciosamente,
${incident.responsible}
Central Integrada de Emergências - GENERAL`;

      default:
        return "";
    }
  },

  sendWhatsApp(type, phone = '') {
    const incident = appState.getCurrentIncident();
    const text = encodeURIComponent(this.getTemplate(type || 'WHATSAPP_EMERGENCIA', incident));
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
    appState.addDispatchLog("WhatsApp / Mensageria Rápida", "MENSAGEM ENVIADA", `WPP-${Date.now().toString().slice(-4)}`, incident ? incident.responsible : "Operador");
  },

  sendEmail(type) {
    const incident = appState.getCurrentIncident();
    const subject = encodeURIComponent(
      type === 'EMAIL_CLIENTE_SINISTRO_ATRASO'
        ? `[GENERAL] Comunicado de Sinistro e Análise Pericial - Carga ${incident.nfeNumber || incident.id}`
        : `[GENERAL PAAC] Aviso de Sinistro ${incident.id} - ${incident.road}`
    );
    const body = encodeURIComponent(this.getTemplate(type, incident));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    appState.addDispatchLog("E-mail Oficial", "DISPARADO", `EML-${Date.now().toString().slice(-4)}`, incident ? incident.responsible : "Operador");
  },

  callEmergency(number, targetName) {
    const incident = appState.getCurrentIncident();
    window.open(`tel:${number}`, '_self');
    appState.addDispatchLog(targetName || `Central ${number}`, "LIGAÇÃO DISPARADA", `TEL-${number}`, incident ? incident.responsible : "Operador");
  }
};
