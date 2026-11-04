/**
 * OBJECTIVE: Source definitions for the 8 progressive encrypted locks + completion stage.
 * COMPILED BY: node scripts/build/build_etapas.mjs
 * SECURITY: Each stage N is encrypted with normalizar(stage[N-1].resposta).
 * RULE 5: Strictly ZERO emojis.
 */

export const configuracao = {
  versao: 1,
  titulo: "Web Quests: UI Design & Preparação para o Figma",
  totalEtapas: 8,
};

export const etapas = [
  // -------------------------------------------------------------------------
  // LOCK 0: Hierarquia Visual
  // -------------------------------------------------------------------------
  {
    id: "lock-0",
    numero: 0,
    titulo: "O Olho Clínico de Hierarquia",
    conceito: "Hierarquia Visual & Padrões de Escaneamento",
    resposta: "F-PATTERN",
    conteudo: {
      id: "lock-0",
      numero: 0,
      titulo: "O Olho Clínico de Hierarquia",
      pilar: "Hierarquia Visual",
      enunciado: "A hierarquia visual organiza a importância dos elementos na tela através de contrastes de tamanho, peso tipográfico, cor e espaçamento. Em páginas ocidentais com blocos densos de informação, os olhos dos usuários tendem a percorrer a tela em um padrão característico antes de decidirem onde aprofundar a leitura.",
      instrucoes_dupla: {
        navegador: "Analise os dois cartões na bancada interativa abaixo. Compare a proporção tipográfica, o contraste do texto e a clareza da chamada para ação (CTA). Se precisar de apoio teórico, consulte os slides com Ctrl+S.",
        piloto: "Examine os cartões A e B. Um deles viola as regras básicas de peso e escala tipográfica, enquanto o outro conduz a leitura com naturalidade no padrão clássico. Selecione o cartão correto na bancada para extrair a senha da fechadura."
      },
      tipo_desafio: "diff-picker",
      dados_desafio: {
        pergunta: "Qual dos dois cartões apresenta a hierarquia visual correta e proporcional?",
        opcao_a: {
          rotulo: "Cartão A",
          titulo_estilo: "font-size: 13px; font-weight: 400; color: #888888;",
          corpo_estilo: "font-size: 22px; font-weight: 800; color: #111111; line-height: 1.2;",
          botao_estilo: "font-size: 11px; text-decoration: underline; color: #777777; background: transparent; border: none;",
          titulo_texto: "Confirmação de Transação Financeira",
          corpo_texto: "Clique aqui para transferir imediatamente o valor sem verificar os dados.",
          botao_texto: "Prosseguir"
        },
        opcao_b: {
          rotulo: "Cartão B",
          titulo_estilo: "font-size: 20px; font-weight: 700; color: #1e293b; line-height: 1.3;",
          corpo_estilo: "font-size: 14px; font-weight: 400; color: #475569; line-height: 1.5;",
          botao_estilo: "font-size: 14px; font-weight: 600; color: #ffffff; background: #2563eb; border: none; padding: 10px 18px; border-radius: 6px;",
          titulo_texto: "Confirmação de Transação",
          corpo_texto: "Revise os detalhes abaixo antes de confirmar o envio seguro do valor.",
          botao_texto: "Confirmar Transferência"
        },
        opcao_correta: "B",
        dica_revelada: "Excelente olhar clínico! O padrão clássico de leitura e escaneamento ocidental em blocos de texto chama-se: F-PATTERN"
      },
      pistas: [
        "Consulte o Slide 3 sobre Hierarquia Visual. O título principal deve ter peso e escala superiores ao texto de apoio.",
        "Em interfaces com texto denso, os usuários leem as linhas superiores inteiras e descem escaneando apenas as bordas esquerdas.",
        "A resposta esperada é o nome do padrão de leitura em bloco: F-PATTERN"
      ],
      resposta_esperada: "F-PATTERN",
      feedback_sucesso: "Hierarquia decifrada! Vocês reconheceram como tamanho, peso e contraste direcionam o foco antes mesmo da leitura consciente."
    }
  },

  // -------------------------------------------------------------------------
  // LOCK 1: Affordance & Signifiers
  // -------------------------------------------------------------------------
  {
    id: "lock-1",
    numero: 1,
    titulo: "Affordance & Falsos Amigos",
    conceito: "Affordance & Signifiers (Conceito de Don Norman)",
    resposta: "SIGNIFIER",
    conteudo: {
      id: "lock-1",
      numero: 1,
      titulo: "Affordance & Falsos Amigos",
      pilar: "Affordance & Signifiers",
      enunciado: "Donald Norman esclareceu que 'affordance' é a propriedade real e física que determina como um objeto pode ser usado, enquanto 'signifier' é o sinal perceptível que comunica onde e como agir. Telas touch têm affordance física de toque em qualquer ponto, mas apenas os signifiers visuais (relevo, sombras, estados de botão) dizem ao usuário: 'este retângulo executa uma ação'.",
      instrucoes_dupla: {
        navegador: "Abra os slides de Affordance & Signifiers (Ctrl+S). Verifique os 5 estados essenciais de um botão acessível (Slide 7): Padrão (Default), Ao passar o mouse (Hover), Pressionado (Active), Com foco de teclado (Focused) e Desabilitado (Disabled).",
        piloto: "Na bancada abaixo, o botão de pagamento perdeu seus sinais visuais. Configure cada um dos 5 estados com as pistas visuais adequadas (cor de fundo, elevação, anel de foco e cursor) para restabelecer a máquina de estados e liberar a palavra-chave."
      },
      tipo_desafio: "state-fixer",
      dados_desafio: {
        estados_obrigatorios: ["default", "hover", "active", "focused", "disabled"],
        configuracoes_disponiveis: {
          default: [
            { id: "opt-1", texto: "Fundo azul royal (#2563eb), texto branco, cursor ponteiro, sombra sutil", correto: true },
            { id: "opt-2", texto: "Fundo cinza claro, texto cinza (#94a3b8), cursor texto, sem borda", correto: false },
            { id: "opt-3", texto: "Fundo transparente com linha pontilhada vermelha", correto: false }
          ],
          hover: [
            { id: "opt-1", texto: "Fundo azul mais escuro (#1d4ed8), elevação ligeiramente aumentada, cursor ponteiro", correto: true },
            { id: "opt-2", texto: "Sem alteração visual de cor nem de cursor", correto: false },
            { id: "opt-3", texto: "Fundo piscante em amarelo neon", correto: false }
          ],
          active: [
            { id: "opt-1", texto: "Fundo azul profundo (#1e40af), escala 0.98 (sensação de afundamento físico)", correto: true },
            { id: "opt-2", texto: "Fundo branco com texto invisível", correto: false },
            { id: "opt-3", texto: "Sem resposta ao clique", correto: false }
          ],
          focused: [
            { id: "opt-1", texto: "Anel de foco visível de alto contraste (outline 2px com afastamento), cor de fundo mantida", correto: true },
            { id: "opt-2", texto: "Outline removido (outline: none) sem nenhum indicador substituto", correto: false },
            { id: "opt-3", texto: "Texto do botão some enquanto ele tem foco", correto: false }
          ],
          disabled: [
            { id: "opt-1", texto: "Fundo cinza desbotado (#e2e8f0), texto opaco (#94a3b8), cursor não permitido (not-allowed)", correto: true },
            { id: "opt-2", texto: "Fundo verde chamativo convidando ao clique", correto: false },
            { id: "opt-3", texto: "Mesma aparência do botão ativo", correto: false }
          ]
        },
        dica_revelada: "Perfeito! Donald Norman destacou que na tela plana o sinal visual que comunica a ação ao usuário chama-se: SIGNIFIER"
      },
      pistas: [
        "Consulte os slides de Affordance. Em telas digitais, o vidro tem affordance de toque, mas não de clique em elemento específico.",
        "O elemento gráfico que indica a interatividade de um botão chama-se signifier (sinalizador).",
        "A resposta é a palavra conceitual em inglês formulada por Don Norman: SIGNIFIER"
      ],
      resposta_esperada: "SIGNIFIER",
      feedback_sucesso: "Excelente trabalho! Vocês dominaram a máquina de estados e compreenderam por que um botão precisa comunicar visualmente seu status."
    }
  },

  // -------------------------------------------------------------------------
  // LOCK 2: Consistência & Padrões
  // -------------------------------------------------------------------------
  {
    id: "lock-2",
    numero: 2,
    titulo: "Detetive de Consistência & Dark Patterns",
    conceito: "Lei de Jakob & Padrões Escuros (Deceptive UI)",
    resposta: "CONSISTENCIA",
    conteudo: {
      id: "lock-2",
      numero: 2,
      titulo: "Detetive de Consistência & Dark Patterns",
      pilar: "Consistência & Padrões",
      enunciado: "A Lei de Jakob afirma que os usuários passam quase todo o tempo deles usando outros aplicativos. Por isso, esperam que o seu produto funcione com os mesmos padrões e convenções já consolidados no mercado. Quebrar convenções gera confusão mental; pior ainda, distorcer convenções intencionalmente para induzir ações prejudiciais constitui um Dark Pattern.",
      instrucoes_dupla: {
        navegador: "Observe o modal de cancelamento de assinatura na bancada. Ele contém 3 armadilhas de interface (Dark Patterns) que tentam enganar o usuário ou dificultar a ação legítima.",
        piloto: "Clique sobre cada uma das 3 armadilhas detectadas no modal interativo para desativá-las. Corrija o fluxo para expor a senha da fechadura."
      },
      tipo_desafio: "pattern-hunter",
      dados_desafio: {
        armadilhas: [
          {
            id: "trap-buttons",
            elemento: "Botoes Invertidos",
            descricao: "O botão primário chamativo em verde 'Manter Plano' induz o clique por engano, enquanto 'Confirmar Cancelamento' foi escondido como link cinza desbotado.",
            resolvido_texto: "Botões normalizados: Cancelar (Ação Destrutiva em destaque secundário) e Manter (Ação Segura)."
          },
          {
            id: "trap-optin",
            elemento: "Caixa Pre-marcada Oculta",
            descricao: "Checkbox 'Desejo receber mensagens diárias de parceiros com cobrança no cartão' marcada por padrão com texto minúsculo.",
            resolvido_texto: "Opt-in abusivo removido. Consentimento deve ser explícito e voluntário."
          },
          {
            id: "trap-wording",
            elemento: "Dupla Negacao Confusa",
            descricao: "Frase ardilosa: 'Desmarque caso não queira deixar de não perder os benefícios'.",
            resolvido_texto: "Redação clara: 'Deseja realmente cancelar sua assinatura?'."
          }
        ],
        dica_revelada: "Armadilhas desarmadas com sucesso! O pilar fundamental que respeita as convenções universais do usuário chama-se: CONSISTENCIA"
      },
      pistas: [
        "Consulte os slides sobre Consistência e Dark Patterns. A Lei de Jakob é a base deste desafio.",
        "Inverter botões de ação e esconder caixas pré-marcadas quebra a previsibilidade do usuário.",
        "A resposta é o nome do terceiro pilar de UI que garante previsibilidade: CONSISTENCIA"
      ],
      resposta_esperada: "CONSISTENCIA",
      feedback_sucesso: "Consciência ética afiada! Uma interface de qualidade respeita a autonomia do usuário e preserva padrões universais."
    }
  },

  // -------------------------------------------------------------------------
  // LOCK 3: Grid de 8px
  // -------------------------------------------------------------------------
  {
    id: "lock-3",
    numero: 3,
    titulo: "A Bancada do Grid de 8px",
    conceito: "Espaçamento Modular, Densidade de Pixels & Ritmo Vertical",
    resposta: "RITMO8PX",
    conteudo: {
      id: "lock-3",
      numero: 3,
      titulo: "A Bancada do Grid de 8px",
      pilar: "Espaçamento & Grid de 8px",
      enunciado: "O sistema de grid de 8px utiliza múltiplos inteiros (8, 16, 24, 32, 40, 48px) para todas as distâncias de margem, espaçamento interno (padding) e lacunas (gap). Esse rigor matemático evita subpixels borrados em telas de alta densidade (@1.5x, @2x, @3x) e confere um ritmo visual harmônico e coeso a toda a aplicação.",
      instrucoes_dupla: {
        navegador: "Ligue a chave de sobreposição 'Visualizar Grade de 8px' na bancada. Note como o card com medidas arbitrárias (13px, 7px, 21px, 11px) 'sangra' desalinhado sobre as linhas guias.",
        piloto: "Ajuste os 4 controles deslizantes para valores da escala de 8px (por exemplo: Padding do Card = 24px, Espaço do Título = 8px, Espaço do Texto = 16px, Padding do Botão = 16px). Quando todos entrarem no compasso de 8px, a bancada liberará a senha."
      },
      tipo_desafio: "grid-aligner",
      dados_desafio: {
        propriedades: [
          { id: "paddingCard", nome: "Padding Interno do Card", valor_atual: 13, opcoes: [8, 13, 16, 24, 32], correto: [16, 24, 32] },
          { id: "gapTitulo", nome: "Distância entre Título e Subtítulo", valor_atual: 7, opcoes: [4, 7, 8, 16], correto: [8, 16] },
          { id: "gapCorpo", nome: "Espaço entre Texto e Ação", valor_atual: 21, opcoes: [12, 16, 21, 24], correto: [16, 24] },
          { id: "paddingBotao", nome: "Padding Vertical do Botão", valor_atual: 11, opcoes: [8, 11, 16, 20], correto: [8, 16] }
        ],
        dica_revelada: "Layout encaixado com harmonia milimétrica! O compasso estético criado pela escala de oito pontos chama-se: RITMO8PX"
      },
      pistas: [
        "Consulte o Slide 11 sobre Grid de 8px. Valores ímpares causam quebra de alinhamento em diferentes telas.",
        "Todos os valores devem pertencer à escala modular: 8, 16, 24, 32, 40...",
        "A resposta esperada une a palavra 'ritmo' ao valor do grid: RITMO8PX"
      ],
      resposta_esperada: "RITMO8PX",
      feedback_sucesso: "Cadência matemática perfeita! Vocês comprovaram na prática como múltiplos de 8 removem a arbitrariedade do design."
    }
  },

  // -------------------------------------------------------------------------
  // LOCK 4: Wireframing Low-Fi
  // -------------------------------------------------------------------------
  {
    id: "lock-4",
    numero: 4,
    titulo: "Esqueletizador Low-Fi",
    conceito: "Wireframing Estrutural & Abstração de Baixa Fidelidade",
    resposta: "WIREFRAME",
    conteudo: {
      id: "lock-4",
      numero: 4,
      titulo: "Esqueletizador Low-Fi",
      pilar: "Wireframing & Estrutura",
      enunciado: "Antes de aplicar sombras, paletas de cores e tipografias decorativas no Figma, é indispensável desenhar o esqueleto funcional da interface. O wireframe de baixa fidelidade permite que a dupla valide a arquitetura de informação, o fluxo de navegação e a hierarquia dos blocos sem a distração estética de elementos visuais acabados.",
      instrucoes_dupla: {
        navegador: "Analise o mockup de aplicativo na bancada. Identifique a função de cada seção principal: Barra Superior (App Bar), Banner Destaque (Hero), Grade de Recursos (Cards 2x2) e Barra de Navegação Inferior (Bottom Bar).",
        piloto: "Arraste ou posicione os blocos conceituais neutros nas posições corretas do esqueleto mobile para construir o wireframe funcional. Ao completar a montagem sem ruídos estéticos, a senha será exposta."
      },
      tipo_desafio: "wireframe-builder",
      dados_desafio: {
        posicoes: [
          { posicao: 1, rotulo: "Topo (Navegação Superior)", bloco_correto: "app-bar", nome_correto: "Top App Bar com Título e Perfil" },
          { posicao: 2, rotulo: "Área de Destaque", bloco_correto: "hero-banner", nome_correto: "Hero Banner com Resumo e Saldo" },
          { posicao: 3, rotulo: "Conteúdo Principal", bloco_correto: "feature-grid", nome_correto: "Grade de Ações Rápidas (2x2)" },
          { posicao: 4, rotulo: "Rodapé Fixo", bloco_correto: "bottom-nav", nome_correto: "Bottom Navigation Bar com Ícones de Seção" }
        ],
        blocos_disponiveis: [
          { id: "bottom-nav", titulo: "Bottom Navigation Bar", desc: "Abas inferiores para alternância de telas principais" },
          { id: "hero-banner", titulo: "Hero Banner", desc: "Cartão de destaque com resumo de métricas principais" },
          { id: "app-bar", titulo: "Top App Bar", desc: "Barra superior com logotipo, nome da tela e avatar" },
          { id: "feature-grid", titulo: "Grade de Ações Rápidas", desc: "Quatro cartões modulares para atalhos do usuário" }
        ],
        dica_revelada: "Esqueleto montado com sucesso! A representação esquemática em baixa fidelidade da interface chama-se: WIREFRAME"
      },
      pistas: [
        "Consulte os slides sobre preparação para o Figma. A primeira etapa é sempre o rascunho estrutural.",
        "O termo em inglês designa o desenho de 'arame' que ancora o layout sem preocupação com cores.",
        "A resposta esperada é o substantivo singular em inglês: WIREFRAME"
      ],
      resposta_esperada: "WIREFRAME",
      feedback_sucesso: "Arquitetura validada! Separar layout de cosmética visual é a marca registrada de designers e desenvolvedores maduros."
    }
  },

  // -------------------------------------------------------------------------
  // LOCK 5: Heurísticas & Usabilidade
  // -------------------------------------------------------------------------
  {
    id: "lock-5",
    numero: 5,
    titulo: "Tribunal da Usabilidade Cotidiana",
    conceito: "Heurísticas de Jakob Nielsen & Diagnóstico de UI",
    resposta: "HEURISTICA",
    conteudo: {
      id: "lock-5",
      numero: 5,
      titulo: "Tribunal da Usabilidade Cotidiana",
      pilar: "Avaliação Heurística & Usabilidade",
      enunciado: "Sistemas do cotidiano (portais acadêmicos, bancários e de serviços públicos) com frequência violam as 10 Heurísticas de Usabilidade de Jakob Nielsen. Quando um sistema apaga dados digitados pelo usuário, não oferece confirmação de ações ou exibe mensagens de erro criptografadas, ele comete infrações graves de usabilidade.",
      instrucoes_dupla: {
        navegador: "Examinem o relatório de caso no Tribunal da Usabilidade: um portal acadêmico que recarrega a página em branco e apaga um formulário de 15 campos após um erro de validação genérico ('Erro 500: Verifique os campos').",
        piloto: "Respondam às 2 perguntas do tribunal: qual heurística fundamental de Nielsen foi desrespeitada e qual solução de design moderna no Figma deve ser adotada para corrigir a falha."
      },
      tipo_desafio: "critique-evaluator",
      dados_desafio: {
        caso_titulo: "Caso: Formulário de Inscrição Universitária",
        caso_relato: "O estudante preenche 15 campos obrigatórios com histórico escolar e dados pessoais. Ao clicar em 'Finalizar Inscrição', a página pisca, recarrega limpa, todos os campos voltam a ficar vazios e surge um alerta vermelho no topo: 'Erro genérico: Dados inválidos'.",
        questoes: [
          {
            id: "q1",
            enunciado: "Qual heurística de Jakob Nielsen foi violada de maneira mais crítica?",
            opcoes: [
              { id: "a", texto: "Reconhecimento em vez de memorização", correto: false },
              { id: "b", texto: "Prevenção de erros e Visibilidade do status do sistema", correto: true },
              { id: "c", texto: "Design minimalista e flexibilidade de atalhos", correto: false }
            ]
          },
          {
            id: "q2",
            enunciado: "Qual a refatoração correta de interface a ser prototipada no Figma?",
            opcoes: [
              { id: "a", texto: "Preservar todos os dados digitados, destacar o campo incorreto em vermelho com mensagem inline clara e focar automaticamente nele", correto: true },
              { id: "b", texto: "Exibir um modal com som estridente obrigando o usuário a começar do zero", correto: false },
              { id: "c", texto: "Remover a validação para que qualquer dado passe sem verificação", correto: false }
            ]
          }
        ],
        dica_revelada: "Diagnóstico preciso! A técnica de avaliação baseada nas regras de ouro de usabilidade é conhecida como avaliação: HEURISTICA"
      },
      pistas: [
        "Consulte os slides sobre usabilidade e princípios de Nielsen.",
        "As 10 regras consolidadas por Nielsen para diagnosticar falhas de interface são chamadas de heurísticas.",
        "A resposta esperada é a palavra no singular feminino sem acento: HEURISTICA"
      ],
      resposta_esperada: "HEURISTICA",
      feedback_sucesso: "Sentença justa proferida! Vocês identificaram a falha de comunicação do sistema e propuseram uma solução focada no usuário."
    }
  },

  // -------------------------------------------------------------------------
  // LOCK 6: Olho Clínico de Precisão (Gauntlet)
  // -------------------------------------------------------------------------
  {
    id: "lock-6",
    numero: 6,
    titulo: "O Desafio dos Mestres de UI",
    conceito: "Bateria de Precisão Visual (Can't Unsee & UI Inyerface)",
    resposta: "OLHOCLINICO",
    conteudo: {
      id: "lock-6",
      numero: 6,
      titulo: "O Desafio dos Mestres de UI",
      pilar: "Olho Clínico de Precisão",
      enunciado: "Designers de ponta têm sensibilidade treinada para notar microvariações de contraste, assimetrias de margem e alinhamentos milimétricos. Este circuito reúne 5 microdesafios de decisão rápida para colocar o olhar visual da dupla sob teste rigoroso.",
      instrucoes_dupla: {
        navegador: "Monitore os critérios de acessibilidade e geometria visual em cada rodada: contraste WCAG AA, simetria de cantos arredondados, hierarquia de ações e detecção de falsos controles.",
        piloto: "Selecione a resposta correta em cada um dos 5 microdesafios consecutivos na bancada. Qualquer erro reinicia o contador do circuito!"
      },
      tipo_desafio: "clinical-gauntlet",
      dados_desafio: {
        etapas_gauntlet: [
          {
            id: "g1",
            titulo: "Desafio 1 de 5: Contraste WCAG 2.2 AA",
            pergunta: "Qual combinação de botão atinge o contraste mínimo de 4.5:1 para leitura acessível?",
            opcoes: [
              { id: "opt-1", texto: "Texto cinza claro (#94a3b8) sobre fundo branco (#ffffff) - Contraste 2.6:1", correto: false },
              { id: "opt-2", texto: "Texto azul profundo (#0f172a) sobre fundo branco (#ffffff) - Contraste 17.9:1", correto: true },
              { id: "opt-3", texto: "Texto amarelo ouro (#fbbf24) sobre fundo branco (#ffffff) - Contraste 1.7:1", correto: false }
            ]
          },
          {
            id: "g2",
            titulo: "Desafio 2 de 5: Alinhamento e Centralização Óptica",
            pergunta: "Em um botão com ícone e texto, como deve ser feita a centralização?",
            opcoes: [
              { id: "opt-1", texto: "Alinhamento óptico vertical perfeito ao centro com margem proporcional entre ícone e rótulo", correto: true },
              { id: "opt-2", texto: "Ícone grudado na borda esquerda e texto empurrado aleatoriamente", correto: false },
              { id: "opt-3", texto: "Ícone centralizado matematicamente por caixa delimitadora ignorando peso visual", correto: false }
            ]
          },
          {
            id: "g3",
            titulo: "Desafio 3 de 5: Raio de Borda Aninhado (Nested Radius)",
            pergunta: "Ao aninhar um elemento arredondado dentro de um container com padding, qual a fórmula harmônica?",
            opcoes: [
              { id: "opt-1", texto: "Raio Interno = Raio Externo menos o Padding (R_interno = R_externo - P)", correto: true },
              { id: "opt-2", texto: "Ambos devem ter exatamente o mesmo raio independentemente do padding", correto: false },
              { id: "opt-3", texto: "O raio interno deve ser o dobro do raio externo", correto: false }
            ]
          },
          {
            id: "g4",
            titulo: "Desafio 4 de 5: Hierarquia de Ação Única",
            pergunta: "Em um formulário de compra, qual deve ser o tratamento do botão 'Confirmar Pedido'?",
            opcoes: [
              { id: "opt-1", texto: "Ação Primária destacada com cor sólida de alta ênfase (os demais secundários ou neutros)", correto: true },
              { id: "opt-2", texto: "Três botões idênticos em vermelho brilhante lado a lado", correto: false },
              { id: "opt-3", texto: "Texto simples sem aparência de botão no rodapé da página", correto: false }
            ]
          },
          {
            id: "g5",
            titulo: "Desafio 5 de 5: Detecção de Falso Botão de Fechar",
            pergunta: "Em um anúncio invasivo com três 'X' espalhados, onde fica o controle legítimo do sistema?",
            opcoes: [
              { id: "opt-1", texto: "No canto superior da moldura do diálogo nativo, com foco acessível e contraste claro", correto: true },
              { id: "opt-2", texto: "No banner promocional piscando no centro da tela", correto: false },
              { id: "opt-3", texto: "No link disfarçado com texto 'Baixar Agora'", correto: false }
            ]
          }
        ],
        dica_revelada: "Impressionante agilidade perceptiva! O talento visual refinado de um profissional de interface chama-se: OLHOCLINICO"
      },
      pistas: [
        "Consulte os slides sobre hierarquia e contraste. O teste avalia sua acuidade técnica.",
        "A expressão descreve a visão atenta e analítica desenvolvida pela prática contínua.",
        "A resposta esperada une 'olho' e 'clínico' sem separação ou acento: OLHOCLINICO"
      ],
      resposta_esperada: "OLHOCLINICO",
      feedback_sucesso: "Circuito concluído sem falhas! Vocês provaram que conseguem identificar sutilezas de interface em segundos."
    }
  },

  // -------------------------------------------------------------------------
  // LOCK 7: Figma Ready & Auto-Layout
  // -------------------------------------------------------------------------
  {
    id: "lock-7",
    numero: 7,
    titulo: "Figma Ready — A Chave Mestra",
    conceito: "Auto-Layout, Frames & Componentes no Figma",
    resposta: "AUTOLAYOUT",
    conteudo: {
      id: "lock-7",
      numero: 7,
      titulo: "Figma Ready — A Chave Mestra",
      pilar: "Figma Ready: Auto-Layout & Componentes",
      enunciado: "No Figma moderno, componentes não são desenhados com coordenadas estáticas absolutas, mas sim estruturados com Frames responsivos munidos de Auto-Layout. O Auto-Layout atua de forma análoga ao Flexbox do CSS: define direção do fluxo, espaçamento entre itens (Gap) e margens internas (Padding), garantindo que botões e cartões se adaptem automaticamente quando o texto muda.",
      instrucoes_dupla: {
        navegador: "Abram os slides finais de preparação para o Figma (Ctrl+S). Verifiquem como o Auto-Layout governa a expansão e o encolhimento de componentes de forma dinâmica.",
        piloto: "Na bancada final, configurem o Frame do componente com Direção Vertical, Espaçamento (Gap) de 16px e Padding de 24px. Redimensionem o componente na pré-visualização para comprovar a responsividade e revelar a Chave Mestra."
      },
      tipo_desafio: "figma-ready",
      dados_desafio: {
        propriedades: [
          {
            id: "direcao",
            nome: "Direção do Fluxo",
            opcoes: [
              { id: "horizontal", texto: "Horizontal (Linha)", correto: false },
              { id: "vertical", texto: "Vertical (Coluna)", correto: true }
            ]
          },
          {
            id: "gap",
            nome: "Espaçamento entre Itens (Gap)",
            opcoes: [
              { id: "gap-5", texto: "5px (Aleatório)", correto: false },
              { id: "gap-16", texto: "16px (Grid 8px)", correto: true },
              { id: "gap-33", texto: "33px (Ímpar)", correto: false }
            ]
          },
          {
            id: "padding",
            nome: "Padding Interno do Frame",
            opcoes: [
              { id: "pad-10", texto: "10px", correto: false },
              { id: "pad-24", texto: "24px (Múltiplo de 8)", correto: true },
              { id: "pad-45", texto: "45px", correto: false }
            ]
          }
        ],
        dica_revelada: "A Chave Mestra final foi encontrada! A poderosa ferramenta do Figma baseada em flexbox visual chama-se: AUTOLAYOUT"
      },
      pistas: [
        "Consulte os slides finais sobre o Figma. O recurso é ativado com o atalho Shift + A.",
        "Essa propriedade substitui retângulos fixos por caixas adaptáveis de conteúdo.",
        "A resposta é o nome em inglês da funcionalidade: AUTOLAYOUT"
      ],
      resposta_esperada: "AUTOLAYOUT",
      feedback_sucesso: "Chave Mestra conquistada! Vocês dominaram todos os alicerces teóricos e práticos de UI Design e estão 100% prontos para o Figma."
    }
  },

  // -------------------------------------------------------------------------
  // STAGE 8: Vitória & Certificado Oficial
  // -------------------------------------------------------------------------
  {
    id: "lock-8-conclusao",
    numero: 8,
    titulo: "Vitória da Dupla & Certificado Oficial",
    conceito: "Conclusão da Trilha & Certificação",
    resposta: "",
    conteudo: {
      id: "lock-8-conclusao",
      numero: 8,
      titulo: "Vitória da Dupla & Certificado Oficial",
      pilar: "Trilha Concluída",
      enunciado: "Missão cumprida! Vocês desvendaram as 8 fechaduras da Web Quest, compreendendo na prática os 4 pilares do Design de Interfaces: Hierarquia Visual, Affordance & Signifiers, Consistência & Padrões e Espaçamento no Grid de 8px. Vocês conquistaram o Certificado Oficial de Conclusão da Dupla!",
      instrucoes_dupla: {
        navegador: "Verifiquem o tempo final de resolução e os nomes da dupla no certificado abaixo.",
        piloto: "Baixem o código oficial de conclusão para entregar ao professor e exportem o Certificado Oficial da Equipe em formato vetorial SVG ou impressão."
      },
      tipo_desafio: "certificate-generator",
      dados_desafio: {
        conquistado: true
      },
      pistas: [],
      resposta_esperada: "",
      feedback_sucesso: "Parabéns à dupla pelo excepcional desempenho!"
    }
  }
];
