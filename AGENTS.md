# AGENTS.md — Manifesto Operacional do Agente de IA

Diretrizes mandatórias para qualquer agente autônomo ou assistente de IA atuando neste repositório (`web-quests-ui-design`).

---

## 1. Visão Geral e Stack

- **Objetivo:** Atividade web dinâmica sobre Design de Interfaces de Aplicativos e preparação para o Figma, voltada para resolução em duplas por alunos de desenvolvimento web e design.
- **Estrutura Core:** 
  - `slides/`: Apresentação interativa cobrindo os 4 pilares de UI (Hierarquia Visual, Affordance & Signifiers, Consistência & Padrões, Espaçamento & Grid 8px).
  - `quest/`: Trilha de fechaduras encadeadas e cifradas (AES-256-GCM + PBKDF2), bancadas interativas, desafios visuais e placar com senha para o professor.
- **Runtimes:** HTML5, CSS3 moderno, Vanilla JavaScript (ES Modules, Web Crypto API), Python 3 (servidor estático zero-dependência), Node.js v18+ (compilação criptográfica das etapas).

---

## 2. Autocontenção e Limites de Pasta (Inviolável)

- **Regra de Confinamento:** Toda a governança deste projeto deve residir estritamente dentro da raiz do projeto (`C:\Repo\Ensino-Educacao\web-quests-ui-design\`). NUNCA crie nem altere arquivos em diretórios ancestrais como `C:\Repo\` ou `C:\Repo\docs\`.
  - Lições aprendidas: `docs/licoes/`
  - Diário de bordo: `docs/diario/`
  - Handoffs de sessão: `docs/handoffs/` (numerados: `handoff_001.md`, `handoff_002.md`, ...)
  - Manifesto operacional: `AGENTS.md` na raiz
  - Ferramentas e harness: `scripts/`
  - Entregáveis e evidências: `artifacts/`
  - Metadados do agente: `.agents/` (`plan.md`, `progress.md`, `handoff.md`)

---

## 3. Protocolo de Sessão (Ciclo de Vida do Agente)

### Início de Sessão
1. Ler o handoff mais recente em `docs/handoffs/` para absorver o estado real e o próximo passo imediato.
2. Consultar lições ativas com:
   `node "C:/Users/Marcos V Moraes/.gemini/config/plugins/gerador-licoes-projeto/scripts/licoes.mjs" status`
3. Consultar diário do projeto com:
   `node "C:/Users/Marcos V Moraes/.gemini/config/plugins/gerador-diario-projeto/scripts/diario.mjs" status`
4. Verificar pulso de governança com `python C:\Repo\antigravity-workspace\scripts\gov.py pulso`.

### Durante a Sessão
1. **Estrito Zero Emojis (Regra 5):** É terminantemente proibido o uso de emojis e pictogramas unicode em código, documentação, mensagens de commit e saídas do agente. Use ícones vetoriais SVG (sprite Tabler/Lucide) e tags ASCII (`[OK]`, `[FAIL]`, `[PENDING]`).
2. **Qualidade de UI e Acessibilidade:** Dar o exemplo em design: escala modular de 8px, contraste mínimo WCAG 2.2 AA (4.5:1), suporte a `prefers-reduced-motion` e navegação por teclado.
3. **Decisões Técnicas:** Registrar decisões arquiteturais relevantes no diário com:
   `node "C:/Users/Marcos V Moraes/.gemini/config/plugins/gerador-diario-projeto/scripts/diario.mjs" decisao "<o quê>" --porque "<motivo>"`

### Fechamento de Sessão
1. Executar o portão de verificação antes de qualquer declaração de pronto.
2. Criar novo handoff incremental em `docs/handoffs/handoff_NNN.md` (nunca sobrescreva handoffs anteriores).
3. Registrar o resumo da sessão no diário:
   `node "C:/Users/Marcos V Moraes/.gemini/config/plugins/gerador-diario-projeto/scripts/diario.mjs" resumo "<resumo acionável>"`
4. Verificar se restam ocorrências de erro pendentes em `docs/licoes/`.

---

## 4. Comandos e Harness Operacionais

| Ação | Comando |
|---|---|
| Executar aplicação local | `iniciar.bat` ou `python scripts/server/serve.py` |
| Auditar proibição de emojis | `python scripts/audit/check_no_emojis.py` |
| Compilar/cifrar etapas da trilha | `node scripts/build/build_etapas.mjs --placar-senha "<frase-senha do professor>"` |
| Restaurar a fonte das etapas (gitignored) | `node scripts/build/build_etapas.mjs --restaurar --placar-senha "<frase-senha do professor>"` |
| Checar governança em grafos | `python C:\Repo\antigravity-workspace\scripts\gov.py checar` |
| Registrar pendência no grafo | `python C:\Repo\antigravity-workspace\scripts\gov.py add pend --chave "PEND_XXX" --campo pendencia="<texto>" --campo origem="<origem>"` |
| Status das lições locais | `node "C:/Users/Marcos V Moraes/.gemini/config/plugins/gerador-licoes-projeto/scripts/licoes.mjs" status` |
| Status do diário local | `node "C:/Users/Marcos V Moraes/.gemini/config/plugins/gerador-diario-projeto/scripts/diario.mjs" status` |

---

## 5. Portão de Verificação (Critérios de Aceite)

Nenhuma tarefa é considerada concluída sem que as seguintes verificações passem com código de saída 0:
1. `python scripts/audit/check_no_emojis.py` (0 violações de emojis).
2. `python C:\Repo\antigravity-workspace\scripts\gov.py checar` (0 falhas estruturais de governança).
3. `iniciar.bat` / servidor estático respondendo na porta 8080 sem erros de carregamento ou console.
4. Integridade de codificação: todos os arquivos em UTF-8 sem BOM.
