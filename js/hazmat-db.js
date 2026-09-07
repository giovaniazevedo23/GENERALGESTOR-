/**
 * GENERAL App - Base de Dados de Produtos Perigosos (HazMat / ONU)
 * Compatível com Resolução ANTT 5998/22 e NBR 7500 / 14725
 */

const HAZMAT_DATABASE = [
  {
    onu: "1202",
    numRisco: "30",
    nome: "ÓLEO DIESEL ou ÓLEO COMBUSTÍVEL",
    classe: "3 - Líquidos Inflamáveis",
    classeId: "3",
    subRisco: "Nenhum",
    guia: "128",
    aspecto: "Líquido oleoso amarelado a avermelhado, odor característico de petróleo.",
    perigoFogo: "Inflamável. Os vapores podem formar misturas explosivas com o ar. Pode inflamar por faíscas ou calor.",
    perigoSaude: "A inalação dos vapores pode causar vertigem ou asfixia. Contato prolongado irrita a pele e olhos.",
    isolamentoInicial: 50, // metros
    isolamentoGrandeVazamento: 150, // metros
    epis: ["Luvas nitrílicas/PVC", "Óculos de ampla visão", "Botas de borracha cano longo", "Máscara com filtro para vapores orgânicos"],
    acoesVazamento: [
      "Eliminar todas as fontes de ignição (motores desligados, sem faíscas).",
      "Conter o vazamento com diques de terra, areia ou mantas absorventes.",
      "Evitar que o produto atinja bueiros, galerias pluviais, rios ou mananciais.",
      "Utilizar bombas antideflagrantes para transferência/transbordo.",
      "Notificar imediatamente o Órgão Ambiental competente (ex.: CETESB/IBAMA)."
    ],
    acoesFogo: [
      "Incêndios pequenos: Pó químico seco (PQS), CO2, água em neblina ou espuma resistente a álcool.",
      "Incêndios grandes: Espuma para hidrocarbonetos ou neblina de água. Resfriar os tanques vizinhos à distância."
    ]
  },
  {
    onu: "1203",
    numRisco: "33",
    nome: "GASOLINA DE AUTOMÓVEL",
    classe: "3 - Líquidos Inflamáveis (Alto Risco)",
    classeId: "3",
    subRisco: "Nenhum",
    guia: "128",
    aspecto: "Líquido volátil límpido a amarelado, odor pungente forte.",
    perigoFogo: "Extremamente inflamável. Ponto de fulgor baixo (< -40°C). Vapores mais pesados que o ar propagam-se rente ao solo.",
    perigoSaude: "Vapores causam perda de consciência e danos ao sistema nervoso central. Carcinogênico por exposição contínua.",
    isolamentoInicial: 100,
    isolamentoGrandeVazamento: 300,
    epis: ["Roupa antiestática/antichama", "Máscara autônoma ou máscara com filtro combinado ABEK", "Luvas de borracha nitrílica", "Botas antiestáticas"],
    acoesVazamento: [
      "Desligar imediatamente qualquer equipamento elétrico e sinalizar em ampla distância.",
      "Não pisar nem tocar no material derramado.",
      "Aplicar espuma para contenção de vapores inflamáveis.",
      "Proteger bueiros e redes de esgoto com mantas obturadoras."
    ],
    acoesFogo: [
      "Pó químico seco, espuma mecânica ou CO2.",
      "NÃO aplicar jato de água direto sobre o líquido (risco de espalhamento)."
    ]
  },
  {
    onu: "1830",
    numRisco: "80",
    nome: "ÁCIDO SULFÚRICO com mais de 51% de ácido",
    classe: "8 - Substâncias Corrosivas",
    classeId: "8",
    subRisco: "Nenhum",
    guia: "137",
    aspecto: "Líquido viscoso, incolor a castanho claro, inodoro quando puro.",
    perigoFogo: "Não é combustível, mas reage violentamente com água liberando grande quantidade de calor e respingos corrosivos.",
    perigoSaude: "Altamente corrosivo! Causa queimaduras químicas graves na pele, destruição das vias respiratórias e cegueira.",
    isolamentoInicial: 100,
    isolamentoGrandeVazamento: 250,
    epis: ["Roupa de proteção nível A ou B (PVC/Trellchem)", "Máscara facial inteira com filtro para gases ácidos", "Luvas de neoprene/butílica cano alto", "Botas de segurança resistentes a ácidos"],
    acoesVazamento: [
      "NUNCA JOGUE ÁGUA DIRETAMENTE NO DERRAMAMENTO de ácido concentrado!",
      "Neutralizar com cal virgem, calcário ou bicarbonato de sódio sob orientação técnica.",
      "Conter com areia seca ou terra inerte (não usar serragem combustível).",
      "Isolar e evacuar a área no sentido do vento."
    ],
    acoesFogo: [
      "Usar pó químico seco ou dióxido de carbono.",
      "Se for usar água, apenas para resfriar recipientes fechados de longe, sem atingir o produto."
    ]
  },
  {
    onu: "1075",
    numRisco: "23",
    nome: "GASES DE PETRÓLEO, LIQUEFEITOS (GLP)",
    classe: "2.1 - Gases Inflamáveis",
    classeId: "2",
    subRisco: "Nenhum",
    guia: "115",
    aspecto: "Gás comprimido liquefeito, incolor, odorizado artificialmente.",
    perigoFogo: "Extremamente inflamável. Risco iminente de BLEVE (explosão por expansão do líquido em ebulição) em caso de aquecimento do tanque.",
    perigoSaude: "Gás asfixiante simples. O contato com o líquido causa queimaduras por congelamento (frostbite).",
    isolamentoInicial: 150,
    isolamentoGrandeVazamento: 800,
    epis: ["Roupa térmica de aproximação criogênica/antichama", "Equipamento de respiração autônoma (EPR)", "Detector portátil de gases combustíveis (explosímetro)"],
    acoesVazamento: [
      "Isolar a área em pelo menos 800 metros em todas as direções se houver fogo em tanque.",
      "Cortar o fluxo de gás se for seguro fazê-lo.",
      "Não direcionar água para o ponto de vazamento do gás liquefeito.",
      "Usar neblina de água para dispersar a nuvem de vapor inflamável."
    ],
    acoesFogo: [
      "NÃO extinguir o fogo até que o vazamento seja estancado (risco de explosão por reacendimento de nuvem).",
      "Resfriar intensamente o costado do tanque com jatos maciços de água à máxima distância segura."
    ]
  },
  {
    onu: "3082",
    numRisco: "90",
    nome: "SUBSTÂNCIA PERIGOSA PARA O MEIO AMBIENTE, LÍQUIDA, N.E.",
    classe: "9 - Substâncias e Artigos Perigosos Diversos",
    classeId: "9",
    subRisco: "Nenhum",
    guia: "171",
    aspecto: "Líquidos variados (pesticidas, aditivos químicos industriais, tintas especiais).",
    perigoFogo: "Pode queimar se aquecido intensamente.",
    perigoSaude: "Tóxico para a vida aquática com efeitos duradouros. Risco por contaminação de lençol freático.",
    isolamentoInicial: 25,
    isolamentoGrandeVazamento: 100,
    epis: ["Macacão impermeável tipo Tyvek", "Luvas de borracha nitrílica", "Botas de PVC", "Óculos de proteção ampla"],
    acoesVazamento: [
      "Bloquear imediatamente caixas de captação de água, bueiros e margens de rios.",
      "Utilizar barreiras de contenção flutuantes se atingir corpos d'água.",
      "Recolher o produto com absorventes sintéticos e acondicionar em bombonas homologadas."
    ],
    acoesFogo: [
      "Usar pó químico, espuma ou água pulverizada. Reter toda a água de combate para evitar contaminação do solo."
    ]
  },
  {
    onu: "1170",
    numRisco: "33",
    nome: "ETANOL (ÁLCOOL ETÍLICO) ou SOLUÇÃO DE ETANOL",
    classe: "3 - Líquidos Inflamáveis",
    classeId: "3",
    subRisco: "Nenhum",
    guia: "127",
    aspecto: "Líquido límpido e incolor, odor alcoólico característico.",
    perigoFogo: "Facilmente inflamável. Chamas de álcool puro podem ser invisíveis à luz do dia.",
    perigoSaude: "Irritante para os olhos e vias aéreas.",
    isolamentoInicial: 50,
    isolamentoGrandeVazamento: 200,
    epis: ["Óculos ampla visão", "Luvas nitrílicas", "Botas antichama", "Câmera térmica para identificar chamas invisíveis"],
    acoesVazamento: [
      "Extinguir fontes de calor. Diluir com grande volume de água apenas se autorizado por técnicos ambientais.",
      "Conter com diques de terra ou areia."
    ],
    acoesFogo: [
      "OBRIGATÓRIO uso de ESPUMA RESISTENTE A ÁLCOOL (AR-AFFF). Espumas comuns são degradadas pelo etanol."
    ]
  },
  {
    onu: "1789",
    numRisco: "80",
    nome: "ÁCIDO CLORÍDRICO (ÁCIDO MURIÁTICO)",
    classe: "8 - Substâncias Corrosivas",
    classeId: "8",
    subRisco: "Nenhum",
    guia: "157",
    aspecto: "Líquido incolor a amarelado, fumegante ao ar, odor picante e sufocante.",
    perigoFogo: "Não inflamável, mas reage com metais liberando gás hidrogênio altamente explosivo.",
    perigoSaude: "Libera vapores brancos tóxicos e corrosivos de cloreto de hidrogênio. Causa edema pulmonar se inalado.",
    isolamentoInicial: 100,
    isolamentoGrandeVazamento: 300,
    epis: ["Roupa encapsulada nível A", "Máscara com adução de ar", "Luvas de borracha butílica", "Botas químicas"],
    acoesVazamento: [
      "Usar cortina de neblina d'água para abater a nuvem de vapores ácidos (sem jogar água no líquido represado).",
      "Neutralizar o derramamento com carbonato de sódio ou cal apagada."
    ],
    acoesFogo: [
      "Usar meios adequados para o incêndio circundante. Resfriar os tanques com neblina d'água."
    ]
  },
  {
    onu: "1005",
    numRisco: "268",
    nome: "AMÔNIA ANIDRA",
    classe: "2.3 - Gases Tóxicos",
    classeId: "2",
    subRisco: "8 - Corrosivo / 2.1 - Inflamável",
    guia: "125",
    aspecto: "Gás liquefeito incolor com odor extremamente irritante e sufocante.",
    perigoFogo: "Mistura inflamável em altas concentrações (15-28%).",
    perigoSaude: "GÁS ALTAMENTE TÓXICO E CORROSIVO! Destrói membranas mucosas, olhos e pulmões em segundos.",
    isolamentoInicial: 200,
    isolamentoGrandeVazamento: 1200,
    epis: ["Roupa de proteção química estanque a gás (Nível A)", "Aparelho de respiração autônoma de pressão positiva", "Botas e luvas de proteção química pesada"],
    acoesVazamento: [
      "EVACUAÇÃO IMEDIATA no sentido a favor do vento.",
      "Acionar imediatamente Defesa Civil, Bombeiros e Plano de Auxílio Mútuo (PAM).",
      "Abater a nuvem com cortina de água pulverizada em alto volume."
    ],
    acoesFogo: [
      "Usar neblina de água para resfriamento de tanques à distância segura."
    ]
  }
];

function findHazmatByQuery(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  return HAZMAT_DATABASE.find(item => 
    item.onu === q ||
    item.nome.toLowerCase().includes(q) ||
    item.classe.toLowerCase().includes(q)
  );
}

function searchHazmatList(query) {
  if (!query) return HAZMAT_DATABASE;
  const q = String(query).trim().toLowerCase();
  return HAZMAT_DATABASE.filter(item =>
    item.onu.includes(q) ||
    item.nome.toLowerCase().includes(q) ||
    item.classe.toLowerCase().includes(q) ||
    item.numRisco.includes(q)
  );
}
