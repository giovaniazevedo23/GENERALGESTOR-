/**
 * GENERAL App - Módulo de Investigação de Causa Raiz (Ishikawa 6M & 5 Porquês)
 */

window.RCAInvestigationModule = {
  renderIshikawaDiagram(ishikawaData) {
    const data = ishikawaData || {};
    const categories = [
      { key: "metodo", name: "Método", icon: "📋", desc: "Procedimentos operacionais, rotas, velocidade permitida" },
      { key: "maquina", name: "Máquina", icon: "🚛", desc: "Manutenção do veículo, freios, pneus, suspensão, engates" },
      { key: "maoDeObra", name: "Mão de Obra", icon: "👷", desc: "Treinamento, fadiga, tempo de direção, conduta defensiva" },
      { key: "material", name: "Material", icon: "📦", desc: "Amarração, embalagem, integridade do tanque, peso distribuído" },
      { key: "meioAmbiente", name: "Meio Ambiente", icon: "🌧️", desc: "Condições climáticas, pista molhada, visibilidade, relevo" },
      { key: "medicao", name: "Medição", icon: "⏱️", desc: "Tacógrafo, telemetria, sensores de pressão e telemetria" }
    ];

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        ${categories.map(cat => `
          <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4 transition-all hover:border-blue-500/50">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xl">${cat.icon}</span>
              <div>
                <h4 class="font-bold text-white text-sm">${cat.name}</h4>
                <p class="text-[11px] text-slate-400 leading-tight">${cat.desc}</p>
              </div>
            </div>
            <textarea
              class="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-600 resize-none h-20"
              placeholder="Descreva as constatações em ${cat.name}..."
              onchange="appState.updateCurrentIncident({ rca: { ...appState.getCurrentIncident().rca, ishikawa: { ...(appState.getCurrentIncident().rca || {}).ishikawa, ${cat.key}: this.value } } })"
            >${data[cat.key] || ''}</textarea>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderFiveWhys(fiveWhysArray) {
    const list = Array.isArray(fiveWhysArray) && fiveWhysArray.length === 5 ? fiveWhysArray : ["", "", "", "", ""];
    
    return `
      <div class="space-y-3">
        ${list.map((why, idx) => `
          <div class="flex items-start gap-3 bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl">
            <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs border border-blue-500/30">
              #${idx + 1}
            </div>
            <div class="flex-1">
              <label class="block text-xs font-semibold text-slate-300 mb-1">
                ${idx === 4 ? '🎯 Causa Raiz Conclusiva (5º Porquê):' : `${idx + 1}º Porquê:`}
              </label>
              <input
                type="text"
                class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none transition-all"
                placeholder="${idx === 4 ? 'Conclusão definitiva da causa raiz do sinistro...' : 'Por que isto aconteceu?...'}"
                value="${why || ''}"
                onchange="RCAInvestigationModule.updateWhy(${idx}, this.value)"
              />
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  updateWhy(index, value) {
    const incident = appState.getCurrentIncident();
    if (!incident) return;
    const rca = incident.rca || {};
    const currentWhys = Array.isArray(rca.fiveWhys) ? [...rca.fiveWhys] : ["", "", "", "", ""];
    currentWhys[index] = value;
    appState.updateCurrentIncident({
      rca: {
        ...rca,
        fiveWhys: currentWhys
      }
    });
  }
};
