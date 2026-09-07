/**
 * GENERAL App - Emissor de Dossiê Oficial e Relatório PDF do Acidente (com Parecer de IA & 5W2H)
 */

const ReportPDFGenerator = {
  generateExecutiveHTML(incident) {
    if (!incident) {
      return `
        <div class="flex flex-col items-center justify-center p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
          <i data-lucide="file-x" class="w-16 h-16 text-slate-600 mb-4"></i>
          <h3 class="text-lg font-bold text-slate-300">Nenhum Sinistro Ativo</h3>
          <p class="text-sm text-slate-500 mt-2 max-w-md">
            O dossiê oficial e o parecer técnico em PDF são gerados automaticamente 
            a partir dos dados de uma ocorrência ativa. Registre ou selecione um sinistro 
            no mapa para visualizar o relatório.
          </p>
        </div>
      `;
    }

    const dateFormatted = new Date(incident.occurredAt || Date.now()).toLocaleString('pt-BR');
    const hazmat = findHazmatByQuery(incident.onuCode) || { nome: 'Não especificado', onu: 'N/D', classe: 'N/D' };
    const risk = RiskEngine.calculateScore(incident);
    const planData = incident.customPlan || [];
    const isFreePlan = incident.customPlan ? true : false;
    const planIcon = isFreePlan ? '📝' : '🤖';
    const planTitle = isFreePlan ? 'Plano de Ação Tático (Estruturado)' : 'Parecer Técnico e Plano de Ação 5W2H da IA';
    const parecerText = incident.docsParecer || incident.parecerTecnico || 'Nenhum parecer técnico adicional foi anexado pelo gestor até o momento da emissão deste dossiê.';

    return `
      <div id="printable-dossier" class="bg-white text-slate-900 p-8 rounded-2xl shadow-xl max-w-4xl mx-auto border border-slate-200 font-sans leading-relaxed text-sm">
        
        <!-- Cabeçalho Oficial -->
        <div class="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
          <div class="flex items-start gap-4">
            <img src="icons/logo.png" alt="GENERAL Logo" class="w-14 h-14 object-contain mt-1 rounded-2xl" />
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-2xl font-black tracking-wider text-blue-950 uppercase">GENERAL</span>
                <span class="text-xs bg-slate-900 text-white font-bold px-2 py-0.5 rounded tracking-wide ml-1">PAAC 360° • AI CORE</span>
              </div>
              <h1 class="text-lg font-bold text-slate-800 uppercase">Dossiê Técnico de Atendimento a Sinistro & Parecer Técnico</h1>
              <p class="text-xs text-slate-500">Relatório Pericial Consolidado para Seguradora, ANTT, Órgãos Ambientais e Auditoria</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-base font-mono font-bold text-blue-950">${incident.id}</div>
            <div class="text-xs text-slate-500">Emissão: ${new Date().toLocaleString('pt-BR')}</div>
            <div class="mt-1 inline-block text-[11px] font-bold px-2 py-0.5 rounded ${risk.score >= 70 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}">
              Criticidade: ${incident.severity} (${risk.score}/100)
            </div>
          </div>
        </div>

        <!-- 1. Dados da Ocorrência e Localização -->
        <div class="mb-6">
          <h2 class="text-xs font-black text-blue-900 uppercase tracking-wider border-b border-slate-300 pb-1 mb-3">1. Identificação do Evento & Georreferenciamento</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span class="block font-semibold text-slate-500">Tipo de Evento:</span>
              <span class="font-bold text-slate-800">${incident.eventType}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Data e Hora:</span>
              <span class="font-bold text-slate-800">${dateFormatted}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Rodovia / Trecho:</span>
              <span class="font-bold text-slate-800">${incident.road}, ${incident.km}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Município / UF:</span>
              <span class="font-bold text-slate-800">${incident.city}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Ponto de Referência:</span>
              <span class="font-bold text-slate-800">${incident.reference || 'Não informado'}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Condições Climáticas:</span>
              <span class="font-bold text-slate-800">${(incident.vistoria && incident.vistoria.clima) || incident.weather.replace('_', ' ')}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Condição da Pista:</span>
              <span class="font-bold text-slate-800">${(incident.vistoria && incident.vistoria.pista) || incident.roadCondition.replace('_', ' ')}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Coordenadas GPS:</span>
              <span class="font-mono text-slate-800">${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}</span>
            </div>
          </div>
        </div>

        <!-- 2. Veículo, Condutor e Carga -->
        <div class="mb-6">
          <h2 class="text-xs font-black text-blue-900 uppercase tracking-wider border-b border-slate-300 pb-1 mb-3">2. Veículo, Condutor e Documentação Fiscal</h2>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span class="block font-semibold text-slate-500">Veículo / Condição:</span>
              <span class="font-bold text-slate-800">${(incident.vistoria && incident.vistoria.veiculo) || incident.vehicleType}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Placas / Frota:</span>
              <span class="font-bold text-slate-800">${incident.plate} (Nº ${incident.fleetNumber || 'S/N'})</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Motorista / Contato:</span>
              <span class="font-bold text-slate-800">${incident.driverName} • ${incident.driverPhone}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Estado do Motorista:</span>
              <span class="font-bold text-slate-800">${(incident.vistoria && incident.vistoria.condutor) || incident.driverStatus.replace('_', ' ')}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Nota Fiscal / Manifesto:</span>
              <span class="font-bold text-slate-800">${incident.nfeNumber} / ${incident.manifestNumber}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Lacre de Segurança:</span>
              <span class="font-bold text-slate-800">${(incident.vistoria && incident.vistoria.lacre) || (incident.sealIntact ? 'Íntegro' : 'Violado')}</span>
            </div>
            <div class="col-span-2">
              <span class="block font-semibold text-slate-500">Descrição da Mercadoria:</span>
              <span class="font-bold text-slate-800">${incident.cargoDescription}</span>
            </div>
            <div>
              <span class="block font-semibold text-slate-500">Valor Declarado da Carga:</span>
              <span class="font-bold text-emerald-800 text-sm">R$ ${Number(incident.cargoValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <!-- 3. Parecer Técnico do Gestor -->
        <div class="mb-6">
          <h2 class="text-xs font-black text-blue-900 uppercase tracking-wider border-b border-slate-300 pb-1 mb-3">3. Parecer Técnico do Gestor / Perito</h2>
          <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-800 italic text-xs leading-relaxed whitespace-pre-wrap">${parecerText}</div>
        </div>

        <!-- 4. Plano de Ação 5W2H (Aprovado / Executado) -->
        <div class="mb-6 bg-blue-50/70 border border-blue-200 p-4 rounded-xl">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              ${planIcon} 4. ${planTitle}
            </h2>
            <button onclick="App.switchTab('ai-plan')" class="no-print bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5">
              <span class="text-base leading-none">🔗</span> Ir para Plano
            </button>
          </div>
          <table class="w-full text-left text-xs border-collapse bg-white rounded-lg overflow-hidden border border-blue-200">
            <thead>
              <tr class="bg-blue-900 text-white font-bold">
                <th class="p-2 border border-blue-800">O que fazer (What)</th>
                <th class="p-2 border border-blue-800">Por que (Why)</th>
                <th class="p-2 border border-blue-800">Responsável (Who)</th>
                <th class="p-2 border border-blue-800">Prazo (When)</th>
                <th class="p-2 border border-blue-800">Status</th>
              </tr>
            </thead>
            <tbody>
              ${planData.map(act => `
                <tr class="border-b border-slate-200">
                  <td class="p-2 font-bold text-slate-800">${act.what || 'Não preenchido'}</td>
                  <td class="p-2 text-slate-600">${act.why || 'Não preenchido'}</td>
                  <td class="p-2 font-medium text-slate-700">${act.who || 'Equipe'}</td>
                  <td class="p-2 font-mono text-blue-900">${act.when || 'Imediato'}</td>
                  <td class="p-2 font-bold text-xs ${act.completed ? 'text-emerald-700' : 'text-amber-700'}">
                    ${act.completed ? '✓ CONCLUÍDO' : '⏳ PENDENTE'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 4. Cronologia dos Acionamentos e Resgate -->
        <div class="mb-6">
          <h2 class="text-xs font-black text-blue-900 uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">4. Linha do Tempo & Protocolos Oficiais</h2>
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-100 text-slate-700">
                <th class="p-2 border border-slate-200">Horário</th>
                <th class="p-2 border border-slate-200">Órgão / Envolvido</th>
                <th class="p-2 border border-slate-200">Status</th>
                <th class="p-2 border border-slate-200">Protocolo</th>
                <th class="p-2 border border-slate-200">Atendente / Agente</th>
              </tr>
            </thead>
            <tbody>
              ${(incident.dispatchLog || []).map(log => `
                <tr class="border-b border-slate-200">
                  <td class="p-2 font-mono font-bold text-slate-800">${log.timestamp}</td>
                  <td class="p-2 font-medium text-slate-800">${log.target}</td>
                  <td class="p-2 font-bold text-xs ${log.status === 'CONFIRMADO' || log.status === 'NO LOCAL' ? 'text-emerald-700' : 'text-blue-700'}">${log.status}</td>
                  <td class="p-2 font-mono text-slate-600">${log.protocol}</td>
                  <td class="p-2 text-slate-700">${log.agent}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 5. Transbordo e Causa Raiz -->
        <div class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h3 class="font-bold text-blue-900 mb-1.5 uppercase">5. Transbordo & Salvamento</h3>
            <p><strong>Veículo Substituto:</strong> ${incident.transshipment.backupVehiclePlate || 'Em definição'}</p>
            <p><strong>Transportadora de Apoio:</strong> ${incident.transshipment.backupCarrier || 'N/A'}</p>
            <p><strong>Destinação Autorizada:</strong> ${incident.transshipment.safeDestination || 'A definir'}</p>
            <p><strong>Status Operacional:</strong> ${incident.transshipment.status.replace('_', ' ')}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h3 class="font-bold text-blue-900 mb-1.5 uppercase">6. Análise de Causa Raiz (Ishikawa/RCA)</h3>
            <p><strong>Hipótese Principal:</strong> ${incident.rca.hypothesis.replace(/_/g, ' ')}</p>
            <p><strong>Investigador Responsável:</strong> ${incident.rca.investigator || 'Comitê de Sinistros'}</p>
            <p><strong>Ação Preventiva:</strong> ${incident.rca.preventiveActionPlan || 'Em apuração técnica'}</p>
          </div>
        </div>

        <!-- Assinaturas e Carimbo -->
        <div class="border-t border-slate-300 pt-6 mt-8 grid grid-cols-3 gap-6 text-center text-xs text-slate-600">
          <div>
            <div class="border-b border-slate-400 mb-1 pb-6 font-medium text-slate-800">${incident.responsible}</div>
            <p>Responsável pelo PAAC / Gestor</p>
          </div>
          <div>
            <div class="border-b border-slate-400 mb-1 pb-6 font-medium text-slate-800">${incident.driverName}</div>
            <p>Condutor do Veículo</p>
          </div>
          <div>
            <div class="border-b border-slate-400 mb-1 pb-6 font-medium text-slate-800">Perito / Regulador de Sinistro</div>
            <p>Companhia Seguradora</p>
          </div>
        </div>

        <div class="mt-8 text-center text-[10px] text-slate-400 font-mono">
          Dossiê certificado e emitido pelo motor GENERAL AI ENGINE • Validação Eletrônica: ${Math.random().toString(36).substring(2, 10).toUpperCase()}
        </div>
      </div>
    `;
  },

  async printReport() {
    try {
      App.showToast('Gerando Dossiê PDF, aguarde...');
      
      const element = document.getElementById('printable-dossier');
      
      const opt = {
        margin:       10,
        filename:     `Dossie_GENERAL_${new Date().getTime()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Hybrid approach: Capacitor Native Share or Web Download
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
          App.showToast('Gerando PDF nativo...', 'info');
          html2pdf().from(element).set(opt).outputPdf('datauristring').then(async function(pdfBase64) {
              try {
                  const base64Data = pdfBase64.split(',')[1];
                  const fileName = opt.filename;
                  const result = await window.Capacitor.Plugins.Filesystem.writeFile({
                      path: fileName,
                      data: base64Data,
                      directory: 'CACHE'
                  });
                  
                  await window.Capacitor.Plugins.Share.share({
                      title: 'Relatório PDF',
                      text: 'Aqui está o seu PDF.',
                      url: result.uri,
                      dialogTitle: 'Salvar ou Compartilhar PDF'
                  });
                  
                  App.showToast('PDF gerado e pronto para compartilhamento!', 'success');
              } catch (e) {
                  console.error("Erro Capacitor Filesystem/Share:", e);
                  App.showToast('Erro ao exportar PDF no Android. Use a versão Web.', 'error');
              }
          });
      } else {
          html2pdf().from(element).set(opt).save();
          App.showToast('Download do PDF iniciado!');
      }
      
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      App.showToast('Erro ao gerar o PDF. Tente novamente.');
    }
  }
};
