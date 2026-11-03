#!/usr/bin/env python3
"""gov.py — implementacao normativa do Ecossistema de Governanca em Grafos (v6).

ESTE ARQUIVO E A FONTE DE VERDADE do comportamento: schema, comandos,
campos obrigatorios, checagens e severidade. O contrato em Markdown
aponta para ca e NAO os redescreve (Art. 4 da Governanca Documental:
uma fonte viva por fato). Se doc e codigo divergirem, o codigo vence.

Grafo local (SQLite) como fonte de verdade da governanca do projeto.
`render` e `export` produzem saida regenerada para humano (Markdown /
JSONL) - nunca fonte, nunca editada a mao, nunca relida pelo agente.

Uso: python gov.py <comando> [args]
Comandos: init, pulso, add, status, aresta, query, evento, checar, render,
          briefing, export
"""

import argparse
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone

DB_PATH = os.environ.get("GOV_DB_PATH", os.path.join(".governanca", "grafo.db"))
EXPORT_PATH = os.environ.get("GOV_EXPORT_PATH", os.path.join(".governanca", "grafo.jsonl"))

# O console do Windows abre em cp1252 e quebra em '→'/'—' que o render usa.
# Sem isto, `render` levanta UnicodeEncodeError num terminal padrao pt-BR.
for _fluxo in (sys.stdout, sys.stderr):
    if hasattr(_fluxo, "reconfigure"):
        try:
            _fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS nos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    chave TEXT,
    dados TEXT NOT NULL,
    status TEXT DEFAULT 'vigente',
    criado_em TEXT NOT NULL,
    UNIQUE(tipo, chave)
);
CREATE TABLE IF NOT EXISTS arestas (
    de_id INTEGER NOT NULL REFERENCES nos(id),
    para_id INTEGER NOT NULL REFERENCES nos(id),
    relacao TEXT NOT NULL,
    origem TEXT NOT NULL DEFAULT 'declarado',
    confianca REAL,
    PRIMARY KEY (de_id, para_id, relacao)
);
CREATE INDEX IF NOT EXISTS idx_nos_tipo ON nos(tipo);
CREATE INDEX IF NOT EXISTS idx_nos_status ON nos(status);
"""

CAMPOS_OBRIGATORIOS = {
    "MANDATO": ["ni", "ns", "criterios"],
    "ONDA": ["objetivo", "criterio_aceite"],
    "SUP": ["enunciado", "raio_dano", "teste_refutacao"],
    "PNF": ["pergunta", "resposta_adotada"],
    "ADR": ["decisao", "motivo"],
    "RSK": ["risco", "gatilho", "resposta"],
    "EVENTO": ["texto"],
    "FATO": ["texto"],
    # PROVA (N8/N2): o despacho de um validador e seu veredito. Produtor:
    # `roteador.escalador_haiku` (e todo despacho de subagente); consumidor:
    # o portao anti-reconvocacao do `checar`. Entrou no vocabulario com os
    # dois lados ja existentes - a regra de admissao da 3a sessao.
    "PROVA": ["alvo", "validador", "veredito"],
    # LIC: a armadilha que ja custou caro, com o SINAL que a torna consultavel.
    #
    # Entra pelo mesmo criterio de admissao da 3a sessao - produtor e consumidor
    # existentes na mesma entrega. Produtor: `popular_licoes.py` (e `gov.py
    # add`). Consumidor: `gov.py licoes`, o indice que a abertura le.
    #
    # POR QUE VIRA NO, e nao continua sendo prosa no HANDOFF. As armadilhas do
    # §9 sao ~2.068 tokens lidos POR SESSAO, e numa sessao qualquer no maximo
    # duas delas se aplicam. Como no, a abertura le so o `sinal` (uma linha por
    # licao) e o corpo fica a um `query` de distancia. E o modelo do
    # `AGENT_NOTES/INDEX.md` do workspace hospedeiro, que ja provou funcionar:
    # abre-se a licao quando o sinal casa com a tarefa em maos.
    #
    # `sinal` e obrigatorio de proposito. Uma licao sem sinal e um paragrafo que
    # so quem ja o leu sabe quando reler - que e exatamente o estado em que uma
    # lista de 27 armadilhas nao e consultada por ninguem.
    "LIC": ["sinal", "licao"],
    # PEND: pendencias em aberto do projeto (solicitacoes do usuario, erros a corrigir).
    # Obrigatorio: pendencia (descricao da pendencia), origem (usuario | erro | auditoria | licao).
    "PEND": ["pendencia", "origem"],
}

# Tipos que nao exigem --chave (append-only, identificados por id).
TIPOS_SEM_CHAVE = {"EVENTO", "FATO", "PROVA"}

# Estados que um no pode assumir. Lista fechada de proposito: um typo
# ('concluído', 'concluida ') passaria despercebido e desligaria em silencio
# a checagem carro-chefe do `checar`, que compara status por igualdade.
STATUS_VALIDOS = {
    "vigente",     # padrao de qualquer no novo
    "concluida",   # ONDA entregue
    "resolvido",   # RSK tratado (para de bloquear ondas no `checar`)
    "refutada",    # SUP derrubada pelo seu teste de refutacao
    "confirmada",  # SUP cujo teste de refutacao rodou e ela sobreviveu
    "arquivado",   # historico: particiona na mesma tabela (§7 do contrato)
    "registrado",  # EVENTO/FATO, append-only
}

# Mapeamento tipo de no -> documento convencional da Governanca Documental.
# `render --tipo X` usa isto para nomear e agrupar a saida humana.
RENDER_DOC = {
    "MANDATO": "PROJECT_PLAN",
    "ONDA": "PROJECT_PLAN",
    "ADR": "DECISIONS",
    "RSK": "STATE",
    "EVENTO": "STATE",
    "SUP": "PROJECT_PLAN",
    "PNF": "PROJECT_PLAN",
    "FATO": "ARCHITECTURE",
    "PROVA": "PROVAS",
    "LIC": "LICOES",
    "PEND": "STATE",
}

# Vocabulario de arestas. Regra de admissao (licao da 3a sessao + anti-inchaco
# v1-v5): aresta nova so entra com produtor E consumidor existentes na mesma
# entrega, e so se comprar um portao. As tres de 2026-08-02 (Onda 6):
#   evidencia   ONDA -> EVENTO/FATO (commit/teste)  | portao G1 no checar
#   toca        ONDA/RSK -> FATO (caminho de arquivo)| briefing lista ARQUIVOS (G2)
#   provada_por ONDA -> PROVA (despacho)             | registro que N2/U1 consomem (G3)
# G4 (alerta LIC->tarefa) NAO entrou: nao ha no LIC neste grafo - sem
# produtor, a admissao reprova; entra quando as licoes virarem nos.
RELACOES_VALIDAS = {"depende_de", "refuta", "resolve", "pai_de", "bloqueia",
                    "evidencia", "toca", "provada_por"}
ORIGENS_VALIDAS = {"declarado", "inferido"}

# G5: SUP vigente ha mais que isto sem virar `confirmada`/`refutada` gera
# AVISO no checar. Dias como proxy declarado de "sessoes" - o grafo nao
# numera sessoes, e criado_em ja existe em todo no.
LIMIAR_SUP_ESTAGNADA_DIAS = 30

# Orcamento por classe de no no `briefing` (padrao importado do rtk,
# src/core/truncate.rs): constante NOMEADA por classe de sinal, nunca numero
# solto no meio do codigo. Desviar exige justificar no lugar do desvio.
CAP_BRIEFING = {
    "MANDATO": 1,   # ha um so; se houver mais, o projeto tem problema maior
    "ONDA": 10,
    "RSK": 10,      # risco vigente e o que mais decide um veredito
    "SUP": 10,
    "ADR": 15,      # decisao e o historico que o validador mais consulta
    "PNF": 8,
    "FATO": 10,
    "EVENTO": 5,    # so os mais recentes; historico completo e ruido aqui
    "PROVA": 5,     # mesmo criterio do EVENTO: despacho antigo e historico
    "PEND": 10,    # pendencias vigentes relevantes para briefing
}
CAP_RELACOES = 30   # um no muito conectado explodiria o payload que o
                    # briefing existe para encolher

# Cap de GRAU - a resposta ao achado do 1o piloto (topologia em estrela).
# Um no com grau alto e um CONDUTOR ruim: seus vizinhos nao sao parentes
# entre si, so compartilham o hub. Num MANDATO `pai_de` 10 ONDAs, atravessar
# o mandato poe as 10 ondas a 2 saltos umas das outras e o briefing engole o
# grafo (medido: 90,4% de reducao na fixture esparsa contra 11,3% no grafo em
# estrela). Regra: o hub ENTRA no briefing como contexto, mas nao e
# ATRAVESSADO. O foco nunca e podado por grau - ele e o assunto.
CAP_GRAU = 8

# Orcamento GLOBAL do briefing, em tokens estimados. Os caps por tipo acima
# nao bastam: um grafo denso passa em todos eles (nenhum tipo sozinho estoura)
# e ainda assim entrega um payload enorme. Quando este teto e atingido, a
# montagem para e devolve o subgrafo mais proximo do foco montado ate ali.
CAP_TOKENS_BRIEFING = 1500
# Estrutura que entra no arquivo final FORA da conta incremental do
# _montar_briefing: o comentario `<!-- briefing camada=... -->` do wrapper
# (~18 tk) e a deriva de arredondamento da conta por bytes (~15 tk numa
# fatia real de 300 nos, medido na 11a sessao). O orcamento UTIL desconta
# esta reserva para que a fatia final caiba no teto NOMINAL - foi a falta
# disto que levou o composto a ~1,26x o teto (pino da 10a).
RESERVA_ESTRUTURA_BRIEFING = 40

# G6 - o portao de obesidade. PROVA chegou a 65,4% do grafo em disco antes de
# alguem medir, e o custo real so apareceu na 13a sessao, num comando de boot
# que ninguem tinha medido. O portao existe para que o PROXIMO tipo gordo
# apareca sozinho, em vez de esperar por uma auditoria.
#
# TRES escolhas que definem o que ele acusa, e cada uma existe por licao paga:
#
# 1. **Por NO, nao por media do tipo.** Media esconde o outlier, e e o outlier
#    que trunca o payload. Um tipo com 30 nos pequenos e um gigante tem media
#    inocente e um problema real.
# 2. **So no que VIAJA** - o que tem ao menos uma aresta. E a mesma causa
#    estrutural medida em `custo_prova.py`: a BFS do `_montar_briefing` so anda
#    por aresta, entao um no sem aresta nenhuma nao alcanca payload nenhum, por
#    maior que seja. Sem este filtro o portao acusaria PROVA - que e evidencia,
#    e reescrever evidencia e o unico movimento que este projeto ja recusou por
#    invariante, nao por preco.
# 3. **AVISO, nunca FALHA.** No gordo nao e contradicao; e sinal de que a
#    proxima medicao deve olhar ali.
#
# O limiar e DERIVADO, nao escolhido: com `CAP_TOKENS_BRIEFING` de orcamento e
# ate `CAP_GRAU` vizinhos mais o foco, cabem ~9 nos, entao ~166 tokens por no.
# A conversao char/token abaixo e GROSSEIRA e serve so para acender um alarme
# em caracteres - a unidade em que o dano existe (LIC-2026-08-02-09). Ela NAO
# e regua de medicao: numero publicado passa por `medidor.py`, sempre.
CHAR_POR_TOKEN_ALARME = [REDIGIDO]
LIMIAR_CHAR_NO_VIAJANTE = (CAP_TOKENS_BRIEFING * CHAR_POR_TOKEN_ALARME
                           // (CAP_GRAU + 1))

TAMANHO_MAX_CAMPO = 2000
CONTROLE_PROIBIDO = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")  # exclui \t \n

# Travessia de path. `..` so e perigoso ADJACENTE a um separador (`../`,
# `..\`, `/..`, `\..`) ou como o campo inteiro. A checagem anterior procurava
# `..` e separador em QUALQUER posicao do texto, o que dava os dois erros
# opostos: recusava "ondas PED-01..09 em src/app/" (notacao de intervalo mais
# um caminho citado longe dali) e ACEITAVA o `..` puro, que e o token de
# travessia de verdade. Intervalo entre alfanumericos passa por desenho.
TRAVESSIA_PATH = re.compile(r"\.\.[\\/]|[\\/]\.\.")

# A ancora e o texto de MAIOR ALAVANCAGEM do projeto inteiro: ela viaja no
# prefixo de TODO turno de TODA sessao. Medido em 2026-08-01 sobre o corpus
# inteiro (110 mil tokens): so 0,2% dele de fato viaja - a ancora e o regime de
# saida. Por isso ela e o primeiro artefato a existir nos dois idiomas, e nao os
# 80 mil tokens de comentario em Python, que nunca entram num prompt (o proprio
# contrato manda nao ler `gov.py` inteiro).
ANCORAS = {
    "pt": """<!-- gov.py:ancora-boot (inicio) - nao editar a mao -->
Governanca deste projeto: `.governanca/grafo.db`, via `utils/gov.py`.
Rode `gov.py pulso` antes de qualquer acao. Nunca edite `grafo.db` direto;
nunca escreva STATE.md/DECISIONS.md a mao - sao saida de `gov.py render`.
<!-- gov.py:ancora-boot (fim) -->""",
    "en": """<!-- gov.py:ancora-boot (inicio) - do not edit by hand -->
Governance for this project: `.governanca/grafo.db`, via `utils/gov.py`.
Run `gov.py pulso` before any action. Never edit `grafo.db` directly; never
write STATE.md/DECISIONS.md by hand - they are `gov.py render` output.
<!-- gov.py:ancora-boot (fim) -->""",
}

# O marcador HTML fica em portugues nos DOIS idiomas de proposito: ele e a
# chave de idempotencia de `_instalar_ancora`. Traduzi-lo faria `init` deixar
# de reconhecer a ancora que ele mesmo instalou antes e duplicar o bloco.
#
# Ate a 7a sessao esta chave era string magica repetida em tres lugares (as
# duas entradas de ANCORAS e a comparacao de `_instalar_ancora`), enquanto o
# regime de saida ja tinha MARCA_ESTILO. Assimetria sem razao: o Art. 4 do
# workspace vale para constante de codigo tanto quanto para fato em documento.
# `test_adequacao.py` prende a constante ao texto das duas ancoras, para que
# editar uma sem a outra falhe em vez de duplicar o bloco em producao.
MARCA_ANCORA = "gov.py:ancora-boot"

ANCORA_BOOT = ANCORAS["pt"]  # compatibilidade: quem importava o nome antigo

LINHA_INVENTARIO = "| `gov.py` | Grafo de governanca do projeto (init/pulso/add/query/checar/render/export). |"

# O regime de forma da saida (estilo.py) mora num bloco PROPRIO, nao dentro da
# ancora. Duas razoes, as duas verificaveis: o portao da §8 do contrato exige
# ancora de ate 5 linhas, e o regime e um custo de ENTRADA recorrente que so se
# paga se ficar num prefixo cacheado - misturar os dois esconderia o preco de
# cada um. Marcador proprio => `init` continua idempotente e aditivo em ambos.
MARCA_ESTILO = "gov.py:regime-de-saida"


def agora():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _iniciar_painel():
    """INICIA o painel; nunca escreve nele.

    Ate 2026-08-01 esta funcao era `_painel(metodo, ...)`, e `gov.py`
    EMPURRAVA eventos para o painel a cada `pulso`/`checar`. Isso acoplou
    observabilidade a trabalho e ja custou caro uma vez: a suite passou de 6s
    para 83s porque cada `registrar` sondava o Ollama. Agora `painel.py` PUXA
    sozinho - le o grafo, o log cumulativo e o Ollama - e a unica ligacao que
    sobra e esta: subir o processo.

    Import guardado e falha engolida, pelas mesmas duas razoes de sempre:
    `gov.py` roda copiado sozinho, e um painel que impede o boot de comecar e
    pior que painel nenhum."""
    try:
        import painel

        return painel.iniciar_em_segundo_plano(desde=agora(), abrir=True)
    except Exception:
        return None


def conectar():
    destino = os.path.dirname(DB_PATH)
    if destino:
        os.makedirs(destino, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    return conn


def sanitizar_dados(dados):
    """Valida/normaliza `dados` antes do INSERT: limite de tamanho, sem
    caractere de controle cru, nenhum campo apontando para fora do projeto."""
    limpos = {}
    for k, v in dados.items():
        texto = str(v)
        if len(texto) > TAMANHO_MAX_CAMPO:
            raise SystemExit(
                f"campo '{k}' excede {TAMANHO_MAX_CAMPO} caracteres "
                f"({len(texto)}) - resuma antes de gravar no grafo"
            )
        if CONTROLE_PROIBIDO.search(texto):
            raise SystemExit(f"campo '{k}' contem caractere de controle nao permitido")
        if TRAVESSIA_PATH.search(texto) or texto.strip() == "..":
            raise SystemExit(
                f"campo '{k}' parece um path saindo do projeto ('..' colado a "
                f"separador). Notacao de intervalo (PED-01..09, 10..20) e permitida."
            )
        limpos[k] = v
    return limpos


def _instalar_ancora(caminho, idioma="pt"):
    """Insere o bloco de ancora de boot em CLAUDE.md/AGENTS.md por ADICAO,
    nunca sobrescrevendo. Idempotente: se o marcador ja existe, nao duplica."""
    if idioma not in ANCORAS:
        raise SystemExit(f"idioma invalido: {idioma} (validos: {sorted(ANCORAS)})")
    texto = ANCORAS[idioma]
    if os.path.exists(caminho):
        conteudo = open(caminho, encoding="utf-8").read()
        if MARCA_ANCORA in conteudo:
            return f"ja presente em {caminho}"
        with open(caminho, "a", encoding="utf-8") as f:
            f.write("\n\n" + texto + "\n")
        return f"adicionada a {caminho} ({idioma})"
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(texto + "\n")
    return f"criado {caminho} com a ancora ({idioma})"


def _bloco_estilo(nivel, idioma):
    """Monta o bloco do regime de saida. Devolve (texto, tokens) ou None quando
    estilo.py nao foi copiado junto - o import e guardado do mesmo jeito que o
    do painel: observabilidade e regime de forma nao podem derrubar o grafo."""
    try:
        import estilo
    except ImportError:
        return None
    try:
        regra = estilo.NIVEIS[nivel][idioma]
    except KeyError:
        raise SystemExit(
            f"regime de saida: nivel/idioma invalido ({nivel}/{idioma}). "
            f"Niveis: {sorted(estilo.NIVEIS)}; idiomas: pt, en. "
            f"Recusados por medicao: {sorted(estilo.NIVEIS_RECUSADOS)}."
        )
    try:
        conta, _, _ = estilo.escolher_medidor()
        tokens = conta(regra)
    except SystemExit:
        tokens = None  # sem medidor: instala assim mesmo, mas nao alega custo
    texto = (
        f"<!-- {MARCA_ESTILO} (inicio) - nao editar a mao; "
        f"regenere com `estilo.py regra --nivel {nivel} --idioma {idioma}` -->\n"
        f"{regra}\n"
        f"<!-- {MARCA_ESTILO} (fim) -->"
    )
    return texto, tokens


def _instalar_regime_de_saida(caminho, nivel, idioma):
    bloco = _bloco_estilo(nivel, idioma)
    if bloco is None:
        return "pulado (estilo.py nao esta ao lado de gov.py)"
    texto, tokens = bloco
    custo = f"{tokens} tokens de entrada por turno" if tokens is not None \
        else "custo nao medido (sem medidor)"
    if os.path.exists(caminho):
        conteudo = open(caminho, encoding="utf-8").read()
        if MARCA_ESTILO in conteudo:
            return f"ja presente em {caminho}"
        with open(caminho, "a", encoding="utf-8") as f:
            f.write("\n\n" + texto + "\n")
        return f"adicionado a {caminho} ({custo})"
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(texto + "\n")
    return f"criado {caminho} com o regime ({custo})"


def _registrar_em_utils(caminho="utils/README.md"):
    """Registra gov.py no inventario de scripts (Art. 5: checar antes de criar)."""
    if os.path.exists(caminho):
        conteudo = open(caminho, encoding="utf-8").read()
        if "`gov.py`" in conteudo:
            return f"ja registrado em {caminho}"
        with open(caminho, "a", encoding="utf-8") as f:
            f.write("\n" + LINHA_INVENTARIO + "\n")
        return f"registrado em {caminho}"
    return f"{caminho} nao existe - registre gov.py no inventario do projeto a mao"


# Documentos de fonte primaria do Contrato_Mandato_Autonomo. O contrato em
# grafo diz que os dois nunca operam no mesmo projeto; ate 2026-08-01 nada
# CONFERIA isso, e o primeiro piloto ao vivo instalou uma ancora dizendo
# "nunca escreva STATE.md a mao" dentro de um CLAUDE.md cuja ordem de leitura
# obrigatoria mandava ler docs/STATE.md. Aviso, nao bloqueio: migrar um
# projeto e uma decisao do dono dele, mas tem de ser consciente.
APARATO_CONCORRENTE = ("MANDATO.md", "SUPOSICOES.md", "DECISIONS.md", "RISCOS.md", "STATE.md")


def _detectar_aparato_concorrente(raiz="docs"):
    achados = [nome for nome in APARATO_CONCORRENTE if os.path.exists(os.path.join(raiz, nome))]
    return achados if len(achados) >= 3 else []


def cmd_init(args):
    conectar().close()
    print(f"grafo inicializado em {DB_PATH}")
    concorrentes = _detectar_aparato_concorrente()
    if concorrentes:
        print(
            "AVISO: este projeto ja tem governanca documental em docs/ "
            f"({', '.join(concorrentes)}). O contrato em grafo e o "
            "Contrato_Mandato_Autonomo nao operam no mesmo projeto: decida "
            "qual fica e arquive o outro, senao os dois vao dar ordens "
            "contraditorias no mesmo CLAUDE.md."
        )
    if args.sem_ancora:
        print("ancora de boot: pulada (--sem-ancora)")
        return
    alvo = args.ancora or ("CLAUDE.md" if os.path.exists("CLAUDE.md") else "AGENTS.md")
    # getattr com padrao: `cmd_init` tambem e chamado direto (testes, scripts
    # que importam gov como biblioteca), onde o namespace do argparse nao existe.
    idioma = getattr(args, "idioma", "pt")
    print(f"ancora de boot: {_instalar_ancora(alvo, idioma)}")
    if getattr(args, "sem_estilo", False):
        print("regime de saida: pulado (--sem-estilo)")
    else:
        _reg_saida = _instalar_regime_de_saida(
            alvo, getattr(args, 'estilo_nivel', 'pleno'),
            getattr(args, 'estilo_idioma', None) or idioma)
        print(f"regime de saida: {_reg_saida}")
    print(f"inventario: {_registrar_em_utils()}")
    print(f"cache: {_declarar_cache(alvo)}")


def _declarar_cache(alvo):
    """B3/N7: o bloco instalado NAO cacheia sozinho - a API so cacheia
    prefixos acima do minimo do modelo, e ignora o resto EM SILENCIO. O
    `init` declara de que lado o arquivo esta, em vez de deixar a promessa
    de cache implicita (foi assim que o -60% do Tribunal virou numero falso).
    Heuristica bytes/4 declarada; confirmacao so pela fatura
    (`cache_read_input_tokens > 0` - ver `gov.py fatura`)."""
    try:
        from medidor import MINIMO_CACHEAVEL
    except ImportError:
        return "aviso pulado (medidor.py nao esta ao lado de gov.py)"
    minimo = MINIMO_CACHEAVEL["claude-opus-5"]
    if not os.path.exists(alvo):
        return f"sem {alvo} - nada a declarar"
    tk = estimar_tokens(open(alvo, encoding="utf-8").read())
    if tk < minimo:
        return (f"{alvo} ~{tk} tokens (bytes/4) < minimo cacheavel {minimo} "
                f"(Opus 5) - o bloco SO cacheia dentro de um {alvo} maior que "
                f"o minimo; abaixo dele a API ignora o breakpoint em silencio")
    return (f"{alvo} ~{tk} tokens (bytes/4) >= minimo {minimo} (Opus 5) - "
            f"elegivel a cache; confirmacao so pela fatura")


def cmd_add(args):
    tipo = args.tipo.upper()
    obrigatorios = CAMPOS_OBRIGATORIOS.get(tipo)
    if obrigatorios is None:
        raise SystemExit(f"tipo desconhecido: {tipo} (validos: {list(CAMPOS_OBRIGATORIOS)})")
    if args.chave is None and tipo not in TIPOS_SEM_CHAVE:
        raise SystemExit(f"--chave e obrigatoria para {tipo} (opcional so em {sorted(TIPOS_SEM_CHAVE)})")

    dados = {}
    for campo in args.campo or []:
        if "=" not in campo:
            raise SystemExit(f"--campo deve ser chave=valor, recebido: {campo}")
        k, v = campo.split("=", 1)
        dados[k] = v
    dados = sanitizar_dados(dados)

    faltando = [c for c in obrigatorios if c not in dados]
    if faltando:
        raise SystemExit(f"campos obrigatorios ausentes para {tipo}: {faltando}")
    if args.status is not None and args.status not in STATUS_VALIDOS:
        raise SystemExit(f"status invalido: '{args.status}' (validos: {sorted(STATUS_VALIDOS)})")

    conn = conectar()
    try:
        cur = conn.execute(
            "INSERT INTO nos (tipo, chave, dados, status, criado_em) VALUES (?, ?, ?, ?, ?)",
            (tipo, args.chave, json.dumps(dados, ensure_ascii=False), args.status or "vigente", agora()),
        )
        conn.commit()
        _avisar_duplicacao(conn, tipo, args.chave, cur.lastrowid)
    except sqlite3.IntegrityError as e:
        raise SystemExit(f"erro ao inserir: {e} (tipo+chave deve ser unico)")
    finally:
        conn.close()
    print(f"{tipo} '{args.chave or '(sem chave)'}' adicionado")


LIMIAR_DUPLICACAO = 0.85


def _avisar_duplicacao(conn, tipo, chave, novo_id):
    """O4: similaridade e AVISO, nunca portao. A armadilha que matou o
    GPTCache foi APROVAR por semelhanca; aqui a semelhanca so sinaliza - o
    insert ja aconteceu e nada e bloqueado. difflib da stdlib: offline,
    deterministico, 0 tokens - degrau abaixo do Ollama que o plano cogitou,
    pela logica da propria ESCADA (T0 script vence T0s LLM no mesmo servico)."""
    import difflib
    (dados_novo,) = conn.execute(
        "SELECT dados FROM nos WHERE id=?", (novo_id,)).fetchone()
    for outra_chave, outros_dados in conn.execute(
        "SELECT chave, dados FROM nos WHERE tipo=? AND id != ?", (tipo, novo_id)
    ):
        razao = difflib.SequenceMatcher(None, dados_novo, outros_dados).ratio()
        if razao >= LIMIAR_DUPLICACAO:
            print(f"AVISO: {tipo} '{chave or '(sem chave)'}' e {razao:.0%} "
                  f"parecido com '{outra_chave or '(sem chave)'}' - duplicata? "
                  f"(aviso, nunca portao)")


def _resolver_no(conn, chave, tipo=None):
    if tipo is not None:
        row = conn.execute(
            "SELECT id, tipo FROM nos WHERE chave = ? AND tipo = ?", (chave, tipo)
        ).fetchone()
        if row is None:
            raise SystemExit(f"nenhum no {tipo} com chave '{chave}'")
        return row[0]
    rows = conn.execute("SELECT id, tipo FROM nos WHERE chave = ?", (chave,)).fetchall()
    if not rows:
        raise SystemExit(f"nenhum no com chave '{chave}'")
    if len(rows) > 1:
        tipos = ", ".join(t for _, t in rows)
        raise SystemExit(f"chave '{chave}' ambigua entre tipos: {tipos} (use --tipo)")
    return rows[0][0]


def cmd_status(args):
    """Transicao de estado de um no ja existente.

    Sem este comando o grafo era write-once no campo `status`: `add` so
    INSERE (e falha no UNIQUE se a chave existe), entao uma ONDA nascida
    'vigente' nunca chegava a 'concluida'. Isso deixava LETRA MORTA a
    checagem carro-chefe do `checar` (onda concluida com risco bloqueante
    vigente), o contador de ondas do `pulso`, e o arquivamento por
    `status='arquivado'` previsto na §7 do contrato — as tres coisas
    dependem de uma transicao que a CLI nao sabia fazer. Achado no primeiro
    piloto ao vivo (teach-note, 2026-08-01).

    A transicao vira EVENTO automatico: quem audita o grafo depois precisa
    saber QUANDO uma onda passou a concluida, e o proprio no so guarda o
    estado final."""
    if args.para not in STATUS_VALIDOS:
        raise SystemExit(f"status invalido: '{args.para}' (validos: {sorted(STATUS_VALIDOS)})")
    conn = conectar()
    try:
        no_id = _resolver_no(conn, args.chave, args.tipo)
        tipo, antes = conn.execute(
            "SELECT tipo, status FROM nos WHERE id = ?", (no_id,)
        ).fetchone()
        if antes == args.para:
            print(f"{tipo} '{args.chave}' ja esta em '{args.para}' - nada a fazer")
            return
        conn.execute("UPDATE nos SET status = ? WHERE id = ?", (args.para, no_id))
        conn.execute(
            "INSERT INTO nos (tipo, chave, dados, status, criado_em)"
            " VALUES ('EVENTO', NULL, ?, 'registrado', ?)",
            (
                json.dumps(
                    {"texto": f"status de {tipo} '{args.chave}': {antes} -> {args.para}"},
                    ensure_ascii=False,
                ),
                agora(),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    print(f"{tipo} '{args.chave}': {antes} -> {args.para}")


def cmd_aresta(args):
    if args.relacao not in RELACOES_VALIDAS:
        raise SystemExit(f"relacao invalida: {args.relacao} (validas: {sorted(RELACOES_VALIDAS)})")
    if args.origem not in ORIGENS_VALIDAS:
        raise SystemExit(f"origem invalida: {args.origem} (validas: {sorted(ORIGENS_VALIDAS)})")
    if args.origem == "declarado" and args.confianca is not None:
        raise SystemExit("confianca so se aplica a origem='inferido'")
    if args.origem == "inferido" and args.confianca is None:
        raise SystemExit("origem='inferido' exige --confianca 0.0-1.0")
    if args.confianca is not None and not (0.0 <= args.confianca <= 1.0):
        raise SystemExit("confianca deve estar entre 0.0 e 1.0")

    conn = conectar()
    de_id = _resolver_no(conn, args.de)
    para_id = _resolver_no(conn, args.para)
    try:
        conn.execute(
            "INSERT INTO arestas (de_id, para_id, relacao, origem, confianca) VALUES (?, ?, ?, ?, ?)",
            (de_id, para_id, args.relacao, args.origem, args.confianca),
        )
        conn.commit()
    except sqlite3.IntegrityError as e:
        raise SystemExit(f"erro ao inserir aresta: {e}")
    finally:
        conn.close()
    print(f"aresta {args.de} -{args.relacao}-> {args.para} ({args.origem}) adicionada")


# Teto do resumo de UM no na listagem do boot. Medido 2026-08-03: o bloco DELTA
# do `abrir` custava 12.368 tokens, 74,2% deles em nos PROVA, porque imprimia o
# resumo integral dos tres primeiros campos - e o `veredito` de uma PROVA e um
# blob JSON. Com 80: 2.002 tk; com 200: 3.166. O boot precisa saber QUE um no
# nasceu, nao o que ele diz - o que ele diz esta a um `query` de distancia.
TETO_RESUMO_DELTA = 80


def _linha_no(tipo, chave, status, dados, teto=None, resolvido_por=()):
    """A linha de um no numa listagem. `teto` trunca o RESUMO (nunca a chave nem
    o status, que sao o que identifica o no) e declara o corte com um ponteiro
    para o comando que mostra tudo.

    Quem passa `teto` e so o boot. `cmd_query` NAO passa: ela e o destino do
    ponteiro, e truncar la deixaria a saida de escape sem saida - o Art. 3
    viraria letra morta em duas linhas.

    `resolvido_por` sao as chaves que APONTAM para este no por uma aresta
    `resolve`, e vem da aresta - nunca de texto fixo. O campo `resposta_adotada`
    de um PNF congela na criacao: quem le `query --tipo PNF` via a PROPOSTA
    antiga de um no ja resolvido, sem sinal nenhum de que a resposta viva mora
    noutro lugar. Copiar a chave do ADR para dentro do PNF criaria a segunda
    fonte que o Art. 4 proibe; o ponteiro derivado da aresta, nao."""
    resumo = ", ".join(f"{k}={v}" for k, v in list(dados.items())[:3])
    if teto and len(resumo) > teto:
        cortado = len(resumo) - teto
        resumo = f"{resumo[:teto]}... [+{cortado} char; `gov.py query --tipo {tipo}`]"
    # O verbo vem do STATUS e os alvos vem da ARESTA: um no `vigente` com
    # aresta `resolve` esta respondido em parte (o ADR fixou algo), e anunciar
    # "RESOLVIDO" ali seria a linha contradizer o proprio status.
    marca = (f" ({status.upper()} → {', '.join(resolvido_por)})"
             if resolvido_por else "")
    return f"[{tipo}] {chave or '(sem chave)'}{marca} | {status} | {resumo}"


def _resolvedores(conn):
    """{(tipo, chave): [chaves que o resolvem]} - uma consulta para a listagem
    inteira, em vez de uma por no."""
    mapa = {}
    for tipo, chave, fonte in conn.execute(
        "SELECT alvo.tipo, alvo.chave, fonte.chave FROM arestas a"
        " JOIN nos fonte ON fonte.id = a.de_id"
        " JOIN nos alvo ON alvo.id = a.para_id"
        " WHERE a.relacao = 'resolve' ORDER BY fonte.id"
    ):
        mapa.setdefault((tipo, chave), []).append(fonte or "(sem chave)")
    return mapa


def cmd_query(args):
    conn = conectar()
    sql = "SELECT tipo, chave, dados, status, criado_em FROM nos WHERE 1=1"
    params = []
    if args.tipo:
        sql += " AND tipo = ?"
        params.append(args.tipo.upper())
    if args.status:
        sql += " AND status = ?"
        params.append(args.status)
    rows = conn.execute(sql, params).fetchall()
    resolvedores = _resolvedores(conn)
    conn.close()

    if args.campo:
        chave_filtro, valor_filtro = args.campo.split("=", 1)
        rows = [
            r for r in rows
            if str(json.loads(r[2]).get(chave_filtro)) == valor_filtro
        ]

    for tipo, chave, dados_json, status, criado_em in rows:
        # Sem teto, de proposito: ver o docstring de `_linha_no`.
        print(_linha_no(tipo, chave, status, json.loads(dados_json),
                        resolvido_por=resolvedores.get((tipo, chave), ())))
    print(f"--- {len(rows)} no(s)")


def cmd_licoes(args):
    """O INDICE das licoes - uma linha por armadilha ativa, so o sinal.

    E o comando que substitui a leitura do §9 do HANDOFF na abertura. A regra
    que ele encarna, e que vale para todo indice deste projeto: **o indice
    carrega o gatilho, nunca o conteudo.** Quem le a abertura precisa saber
    QUANDO abrir a licao, nao o que ela diz - saber o que ela diz e o custo que
    a abertura estava pagando 27 vezes por sessao para usar duas.

    `--corpo` imprime a licao inteira; e o que fazer quando um sinal casa.
    `--sinal TEXTO` filtra por substring, para quem chega com um sintoma.
    """
    conn = conectar()
    sql = ("SELECT chave, dados FROM nos WHERE tipo='LIC' AND status <> 'arquivado'"
           " ORDER BY chave")
    linhas = []
    for chave, dados_json in conn.execute(sql):
        dados = json.loads(dados_json)
        if args.sinal and args.sinal.lower() not in json.dumps(
                dados, ensure_ascii=False).lower():
            continue
        linhas.append((chave, dados))
    conn.close()

    for chave, dados in linhas:
        print(f"[{chave}] {dados.get('sinal', '')}")
        if args.corpo:
            print(f"    {dados.get('licao', '')}")
            if dados.get("fonte"):
                print(f"    fonte: {dados['fonte']}")
    if not linhas:
        print("nenhuma licao registrada"
              + (f" com '{args.sinal}'" if args.sinal else "")
              + " (rode popular_licoes.py para carregar as do HANDOFF)")
    else:
        print(f"--- {len(linhas)} licao(oes); `gov.py licoes --corpo` abre o texto")


def cmd_evento(args):
    conn = conectar()
    conn.execute(
        "INSERT INTO nos (tipo, chave, dados, status, criado_em) VALUES (?, NULL, ?, 'registrado', ?)",
        ("EVENTO", json.dumps({"texto": args.texto}, ensure_ascii=False), agora()),
    )
    conn.commit()
    conn.close()
    print("evento registrado")


def registrar_prova(alvo, validador, veredito, detalhe="", hash_escopo=None):
    """API de biblioteca (N8/U2): grava o DESPACHO de um validador como no
    PROVA - e, quando o alvo existe no grafo, a aresta `provada_por` (G3).

    E o insumo do portao anti-reconvocacao do `checar` (N2) e da memoizacao
    exata (U1, via `hash_escopo`): sem registro de despacho, a regra mais
    cara do projeto (Achado 1: ~703,5k tokens numa sessao) continua sendo
    prosa. Quem despacha registra - o escalador do roteador chama isto
    sozinho; despacho manual usa `gov.py prova ...`.
    Devolve o id do no criado."""
    dados = sanitizar_dados({
        "alvo": alvo, "validador": validador, "veredito": veredito,
        **({"detalhe": detalhe} if detalhe else {}),
        **({"hash_escopo": hash_escopo} if hash_escopo else {}),
    })
    conn = conectar()
    try:
        cur = conn.execute(
            "INSERT INTO nos (tipo, chave, dados, status, criado_em)"
            " VALUES ('PROVA', NULL, ?, 'registrado', ?)",
            (json.dumps(dados, ensure_ascii=False), agora()),
        )
        prova_id = cur.lastrowid
        alvo_row = conn.execute("SELECT id FROM nos WHERE chave=?", (alvo,)).fetchone()
        if alvo_row:
            conn.execute(
                "INSERT OR IGNORE INTO arestas (de_id, para_id, relacao, origem)"
                " VALUES (?, ?, 'provada_por', 'declarado')",
                (alvo_row[0], prova_id))
        conn.commit()
        return prova_id
    finally:
        conn.close()


def prova_memoizada(alvo, hash_escopo):
    """U1: memoizacao EXATA de prova. Se existe PROVA com o MESMO
    (alvo, hash_escopo) e nenhum ADR ligado ao alvo nasceu depois dela, o
    veredito anterior vale e o despacho nao acontece.

    Casamento exato, nunca semantico - por desenho: aprovar por semelhanca
    foi o defeito que matou o GPTCache na avaliacao externa. Complementar ao
    N2 (la se barra reconvocacao INDEVIDA; aqui se deduz prova JA FEITA - os
    dois consomem o mesmo registro G3). Devolve o veredito (dict) ou None."""
    if not hash_escopo:
        return None
    conn = conectar()
    try:
        row = conn.execute(
            """SELECT id, json_extract(dados,'$.veredito') FROM nos
               WHERE tipo='PROVA' AND json_extract(dados,'$.alvo')=?
                 AND json_extract(dados,'$.hash_escopo')=?
               ORDER BY id DESC LIMIT 1""",
            (alvo, hash_escopo)).fetchone()
        if not row:
            return None
        prova_id, veredito = row
        alvo_row = conn.execute("SELECT id FROM nos WHERE chave=?", (alvo,)).fetchone()
        if alvo_row:
            escopo_mudou = conn.execute(
                """SELECT 1 FROM nos adr
                   JOIN arestas a ON (a.de_id = adr.id AND a.para_id = ?)
                                  OR (a.de_id = ? AND a.para_id = adr.id)
                   WHERE adr.tipo='ADR' AND adr.id > ? LIMIT 1""",
                (alvo_row[0], alvo_row[0], prova_id)).fetchone()
            if escopo_mudou:
                return None
        try:
            return json.loads(veredito)
        except (json.JSONDecodeError, TypeError):
            return None  # veredito truncado/nao-JSON: miss declarado, nunca lixo
    finally:
        conn.close()


def cmd_pulso(args):
    conn = conectar()
    contagens = conn.execute(
        "SELECT tipo, status, COUNT(*) FROM nos GROUP BY tipo, status"
    ).fetchall()
    ultimo_evento = conn.execute(
        "SELECT dados FROM nos WHERE tipo='EVENTO' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    ondas = conn.execute(
        "SELECT chave, status FROM nos WHERE tipo='ONDA' ORDER BY id"
    ).fetchall()
    bloqueios = conn.execute(
        """SELECT COUNT(*) FROM arestas a
           JOIN nos r ON r.id = a.de_id
           WHERE a.relacao='bloqueia' AND r.tipo IN ('RSK', 'PEND') AND r.status='vigente'"""
    ).fetchone()[0]
    conn.close()

    print("=== PULSO ===")
    if ondas:
        concluidas = sum(1 for _, s in ondas if s == "concluida")
        atual = next((c for c, s in ondas if s != "concluida"), "-")
        print(f"Ondas: {concluidas}/{len(ondas)} concluidas | atual: {atual}")
    if ultimo_evento:
        print(f"Ultimo evento: {json.loads(ultimo_evento[0])['texto']}")
    print(f"Bloqueios ativos (RSK/PEND vigente que bloqueia): {bloqueios}")
    print("Nos: " + " | ".join(f"{t}/{s}:{n}" for t, s, n in contagens))

    # `pulso` e o boot de sessao: o unico ponto que todo trabalho atravessa
    # antes da primeira acao. Por isso e aqui que o painel sobe, e o instante
    # do pulso vira o `desde` da vista de sessao - "uma sessao" para o painel
    # continua sendo exatamente "um pulso", so que agora ele recorta a vista
    # em vez de zerar arquivo.
    estado = _iniciar_painel()
    if estado:
        if estado.get("ja_estava_de_pe"):
            nota = "ja estava de pe"
        elif estado.get("aberto"):
            nota = "aberto no navegador"
        else:
            nota = "iniciado (abra a URL a mao)"
        print(f"Painel: {estado['url']} ({nota})")


def _falhar_se_grafo_ausente():
    """N6: grafo AUSENTE e diferente de grafo VAZIO. `conectar()` cria o
    schema ao abrir, entao sem esta checagem um projeto que nunca rodou
    `init` passava limpo - falso negativo silencioso (LIC-2026-07-29-03).
    A ordem importa: verificar ANTES de conectar, senao a propria checagem
    cria o arquivo que deveria acusar como ausente."""
    if not os.path.exists(DB_PATH):
        print("FALHA: 1 problema(s)")
        print(f"  - grafo AUSENTE em {DB_PATH} - rode `gov.py init` (vazio != ausente)")
        sys.exit(1)


def cmd_abrir(args):
    """B4: o boot de sessao consolidado - `pulso` + as 3 queries de abertura
    (SUP vigente, RSK, PNF) + `checar`, numa chamada e num bloco.

    A conta que justificou (regua ponderada N1, medida 2026-08-02): o stdout
    consolidado custa ~o mesmo que os 5 stdouts separados, mas os 4 comandos
    extras que o agente digitaria sao token de SAIDA (5x cada) mais 4
    molduras de resultado no transcript. O ganho e do envelope, nao do corpo
    - por isso `abrir` existe e os 5 comandos continuam existindo para uso
    cirurgico.

    Com `--delta` (U3), o boot vira O(mudanca) em vez de O(estado): so o que
    nasceu desde a marca do ultimo boot + os RSK vigentes (invariantes,
    recitados SEMPRE - risco nao prescreve por ser antigo). Justificado pela
    medicao de escala de 2026-08-02: `pulso` e O(1), mas as queries do boot
    sao O(n) (x9,5 para n x10) - e a unica alavanca que barateia com o
    crescimento do projeto.

    O exit code e o do `checar` (falha estrutural continua bloqueando o
    boot); a marca so avanca com o checar verde."""
    _falhar_se_grafo_ausente()  # antes do pulso, que criaria o banco ausente
    delta = getattr(args, "delta", False)
    marca_path = os.path.join(os.path.dirname(DB_PATH) or ".governanca",
                              "ultimo_boot")
    marca = None
    if delta and os.path.exists(marca_path):
        marca = open(marca_path, encoding="utf-8").read().strip()

    cmd_pulso(args)
    print()
    if marca:
        print(f"== DELTA (nos criados desde a marca do ultimo boot) ==")
        conn = conectar()
        novos = conn.execute(
            "SELECT tipo, chave, dados, status FROM nos"
            " WHERE criado_em > ? AND tipo != 'EVENTO' ORDER BY id",
            (marca,)).fetchall()
        for tipo, chave, dados_json, status in novos:
            print(_linha_no(tipo, chave, status, json.loads(dados_json),
                            teto=TETO_RESUMO_DELTA))
        print(f"--- {len(novos)} no(s) novo(s)" if novos
              else "--- nada novo desde o ultimo boot")
        conn.close()
        print()
        print("== RSK vigentes (invariantes, recitados sempre) ==")
        cmd_query(argparse.Namespace(tipo="RSK", status="vigente", campo=None))
        print()
    else:
        if delta:
            print("(sem marca de boot anterior - boot completo desta vez)")
        for titulo, tipo, status in (
            ("SUP vigentes", "SUP", "vigente"),
            ("RSK", "RSK", None),
            ("PNF", "PNF", None),
        ):
            print(f"== {titulo} ==")
            cmd_query(argparse.Namespace(tipo=tipo, status=status, campo=None))
            print()
    print("== CHECAR ==")
    cmd_checar(args)  # sai 1 em falha estrutural; a marca abaixo nao avanca
    with open(marca_path, "w", encoding="utf-8") as f:
        f.write(agora())


def cmd_checar(args):
    """Checagens deterministicas. FALHA -> exit 1; AVISO -> exit 0 (sinaliza,
    nao bloqueia). A distincao existe porque nem todo achado e impeditivo."""
    _falhar_se_grafo_ausente()
    conn = conectar()
    falhas, avisos = [], []

    # N6: status fora do vocabulario. `add`/`status` validam na escrita, mas
    # o banco tambem e escrito por SQL direto (scripts, humanos) - e um typo
    # aqui ('concluída' com acento) DESLIGA a checagem carro-chefe em
    # silencio, porque ela compara status por igualdade.
    marcadores_sql = ",".join("?" * len(STATUS_VALIDOS))
    for tipo, chave, status in conn.execute(
        f"SELECT tipo, chave, status FROM nos WHERE status NOT IN ({marcadores_sql})",
        sorted(STATUS_VALIDOS),
    ):
        falhas.append(
            f"{tipo} '{chave or '(sem chave)'}': status '{status}' fora do vocabulario "
            f"(a checagem carro-chefe nao enxerga status desconhecido)")

    # N6: relacao fora do vocabulario e confianca fora de faixa - mesmas
    # razoes: a CLI valida, o SQL direto nao.
    rel_sql = ",".join("?" * len(RELACOES_VALIDAS))
    for de_id, para_id, relacao in conn.execute(
        f"SELECT de_id, para_id, relacao FROM arestas WHERE relacao NOT IN ({rel_sql})",
        sorted(RELACOES_VALIDAS),
    ):
        falhas.append(f"aresta {de_id}->{para_id}: relacao '{relacao}' fora do vocabulario")
    for de_id, para_id, conf in conn.execute(
        "SELECT de_id, para_id, confianca FROM arestas"
        " WHERE confianca IS NOT NULL AND (confianca < 0.0 OR confianca > 1.0)"
    ):
        falhas.append(f"aresta {de_id}->{para_id}: confianca {conf} fora de [0,1]")

    # N6: auto-aresta (no que se bloqueia/depende de si) e ciclo direto A<->B
    # na MESMA relacao direcional - contradicoes insatisfativeis.
    for (no_id, relacao) in conn.execute(
        "SELECT de_id, relacao FROM arestas WHERE de_id = para_id"
    ):
        falhas.append(f"no #{no_id}: aresta '{relacao}' para si mesmo")
    for de_id, para_id, relacao in conn.execute(
        """SELECT a.de_id, a.para_id, a.relacao FROM arestas a
           JOIN arestas b ON a.de_id = b.para_id AND a.para_id = b.de_id
                         AND a.relacao = b.relacao
           WHERE a.de_id < a.para_id AND a.de_id != a.para_id"""
    ):
        falhas.append(f"ciclo direto: {de_id} <-'{relacao}'-> {para_id} (impossivel de satisfazer)")

    for tipo, obrigatorios in CAMPOS_OBRIGATORIOS.items():
        rows = conn.execute("SELECT id, chave, dados FROM nos WHERE tipo=?", (tipo,)).fetchall()
        for id_, chave, dados_json in rows:
            rotulo = chave or f"#{id_}"
            dados = json.loads(dados_json)
            faltando = [c for c in obrigatorios if c not in dados or dados[c] in (None, "")]
            if faltando:
                falhas.append(f"{tipo} '{rotulo}': campos vazios/ausentes {faltando}")
            for valor in dados.values():
                for marcador in ("TODO", "FIXME", "[a definir]"):
                    if marcador in str(valor):
                        falhas.append(f"{tipo} '{rotulo}': contem marcador proibido '{marcador}'")

    for de_id, para_id, relacao in conn.execute(
        """SELECT de_id, para_id, relacao FROM arestas
           WHERE de_id NOT IN (SELECT id FROM nos) OR para_id NOT IN (SELECT id FROM nos)"""
    ):
        falhas.append(f"aresta orfa: {de_id} -{relacao}-> {para_id}")

    # A checagem carro-chefe: onda dada como concluida enquanto um risco que
    # a bloqueia segue vigente. E a autocontradicao que so um Tribunal caro
    # pegou no projeto-piloto - aqui custa uma query.
    for onda, chave, tipo_bloq in conn.execute(
        """SELECT o.chave, r.chave, r.tipo FROM arestas a
           JOIN nos r ON r.id = a.de_id
           JOIN nos o ON o.id = a.para_id
           WHERE a.relacao='bloqueia' AND r.tipo IN ('RSK', 'PEND') AND r.status='vigente'
             AND o.tipo='ONDA' AND o.status='concluida'"""
    ):
        falhas.append(f"ONDA '{onda}' concluida mas {tipo_bloq} '{chave}' que a bloqueia segue vigente")

    # G1: conclusao sem evidencia registrada. "Concluida" sem uma aresta
    # `evidencia` apontando para o commit/teste (EVENTO/FATO) e alegacao sem
    # prova - a mesma classe de defeito que o ledger (U5) barra em documento.
    for (chave,) in conn.execute(
        """SELECT o.chave FROM nos o
           WHERE o.tipo='ONDA' AND o.status='concluida'
             AND NOT EXISTS (SELECT 1 FROM arestas a
                             WHERE a.de_id = o.id AND a.relacao = 'evidencia')"""
    ):
        falhas.append(f"ONDA '{chave}' concluida sem aresta 'evidencia' "
                      f"(aponte o commit/teste: gov.py aresta {chave} evidencia <no>)")

    # G5: suposicao parada. SUP vigente ha mais de LIMIAR dias sem virar
    # confirmada/refutada e suposicao cujo teste de refutacao ninguem rodou.
    # AVISO, nao falha: idade nao e contradicao.
    for chave, dias in conn.execute(
        """SELECT chave, CAST(julianday('now') - julianday(criado_em) AS INT)
           FROM nos WHERE tipo='SUP' AND status='vigente'
             AND julianday('now') - julianday(criado_em) > ?""",
        (LIMIAR_SUP_ESTAGNADA_DIAS,)
    ):
        avisos.append(f"SUP '{chave}' vigente ha {dias} dias sem reconfirmacao "
                      f"- rode o teste_refutacao dela (G5)")

    # N2 - o portao anti-reconvocacao (a regra mais cara do projeto virou
    # mecanismo). Segunda convocacao do MESMO validador sobre o MESMO alvo
    # sem mudanca de escopo no meio = o padrao do Achado 1 (~703,5k tokens
    # numa sessao). "Mudanca de escopo" = um ADR ligado por aresta ao alvo,
    # criado ENTRE os dois despachos. O tempo aqui e o id (AUTOINCREMENT
    # monotonico): aresta nao tem criado_em, entao o id do ADR e o proxy
    # declarado de quando o escopo mudou.
    # `status <> 'arquivado'`: sem isto um despacho registrado com rotulo
    # errado e INSANAVEL - PROVA nasce sem chave, entao `gov.py status` nao a
    # alcanca, e a unica saida seria inventar um ADR entre dois ids, que e a
    # retro-evidencia que este projeto ja recusou. Arquivar preserva o registro
    # (Art. 3) e tira do portao o que o operador declarou mal-rotulado.
    despachos = {}
    for pid, alvo, validador in conn.execute(
        """SELECT id, json_extract(dados,'$.alvo'), json_extract(dados,'$.validador')
           FROM nos WHERE tipo='PROVA' AND status <> 'arquivado' ORDER BY id"""
    ):
        despachos.setdefault((alvo, validador), []).append(pid)
    for (alvo, validador), ids in sorted(despachos.items()):
        if len(ids) < 2 or not alvo:
            continue
        alvo_row = conn.execute("SELECT id FROM nos WHERE chave=?", (alvo,)).fetchone()
        for anterior, seguinte in zip(ids, ids[1:]):
            escopo_mudou = alvo_row is not None and conn.execute(
                """SELECT 1 FROM nos adr
                   JOIN arestas a ON (a.de_id = adr.id AND a.para_id = ?)
                                  OR (a.de_id = ? AND a.para_id = adr.id)
                   WHERE adr.tipo='ADR' AND adr.id > ? AND adr.id < ? LIMIT 1""",
                (alvo_row[0], alvo_row[0], anterior, seguinte),
            ).fetchone() is not None
            if not escopo_mudou:
                falhas.append(
                    f"PROVA: validador '{validador}' reconvocado sobre '{alvo}' sem ADR "
                    f"de mudanca de escopo entre os despachos #{anterior} e #{seguinte} "
                    f"(anti-reconvocacao, Achado 1)")

    # Campo obrigatorio vazio ja e FALHA acima. O aviso cobre o que o schema
    # nao pega: teste de refutacao presente mas raso demais para refutar algo
    # de raio_dano alto. Heuristica, por isso sinaliza sem bloquear.
    for chave, teste in conn.execute(
        """SELECT chave, json_extract(dados,'$.teste_refutacao') FROM nos
           WHERE tipo='SUP' AND json_extract(dados,'$.raio_dano')='alto'
             AND LENGTH(COALESCE(json_extract(dados,'$.teste_refutacao'),'')) BETWEEN 1 AND 19"""
    ):
        avisos.append(f"SUP '{chave}': raio_dano=alto com teste_refutacao raso ('{teste}')")

    for de_id, para_id, conf in conn.execute(
        "SELECT de_id, para_id, confianca FROM arestas WHERE origem='inferido' AND confianca < 0.5"
    ):
        avisos.append(f"aresta inferida fraca ({conf}): {de_id} -> {para_id}")

    # G6: no gordo que VIAJA. Ver a derivacao do limiar em
    # LIMIAR_CHAR_NO_VIAJANTE - inclusive por que no sem aresta fica de fora.
    for tipo, chave, tamanho in conn.execute(
        """SELECT tipo, chave, LENGTH(dados) FROM nos
           WHERE status <> 'arquivado' AND LENGTH(dados) > ?
             AND EXISTS (SELECT 1 FROM arestas a
                         WHERE a.de_id = nos.id OR a.para_id = nos.id)
           ORDER BY LENGTH(dados) DESC""",
        (LIMIAR_CHAR_NO_VIAJANTE,)
    ):
        avisos.append(
            f"{tipo} '{chave or '(sem chave)'}': {tamanho} char e tem aresta - "
            f"acima de {LIMIAR_CHAR_NO_VIAJANTE}, o quinhao de um no no briefing "
            f"(G6; ele empurra vizinho para fora do payload)")

    conn.close()

    for a in avisos:
        print(f"AVISO: {a}")
    if falhas:
        print(f"FALHA: {len(falhas)} problema(s)")
        for f in falhas:
            print(f"  - {f}")
        sys.exit(1)
    print(f"OK: nenhuma falha estrutural ({len(avisos)} aviso(s))")


def _render_texto(conn, tipo):
    """Corpo do `render`, separado para o guard never_worse do briefing poder
    comparar a fatia contra a saida integral sem duplicar a montagem."""
    sql = "SELECT tipo, chave, dados, status FROM nos"
    params = []
    if tipo:
        sql += " WHERE tipo = ?"
        params.append(tipo.upper())
    sql += " ORDER BY tipo, id"
    rows = conn.execute(sql, params).fetchall()

    if tipo:
        doc = RENDER_DOC.get(tipo.upper(), "GOVERNANCA")
        titulo = f"# {doc} (gerado por `gov.py render --tipo {tipo.upper()}` — não editar à mão)"
    else:
        titulo = "# Governança do projeto (gerado por `gov.py render` — não editar à mão)"

    linhas = [titulo, ""]
    tipo_atual = None
    for t, chave, dados_json, status in rows:
        if t != tipo_atual:
            linhas.append(f"## {t} → {RENDER_DOC.get(t, 'GOVERNANCA')}")
            tipo_atual = t
        linhas.append(f"### {chave or '(sem chave)'} — {status}")
        for k, v in json.loads(dados_json).items():
            linhas.append(f"- **{k}:** {v}")
        linhas.append("")
    return "\n".join(linhas)


def cmd_render(args):
    """Gera o Markdown humano. `--tipo` seleciona; o cabecalho declara qual
    documento convencional aquela saida substitui (RENDER_DOC)."""
    conn = conectar()
    saida = _render_texto(conn, args.tipo)
    conn.close()

    if args.arquivo:
        with open(args.arquivo, "w", encoding="utf-8") as f:
            f.write(saida)
        print(f"renderizado em {args.arquivo}")
    else:
        print(saida)


def estimar_tokens(texto):
    """Heuristica bytes/4, a mesma que o rtk assume. A PORCENTAGEM de
    reducao e confiavel; o valor absoluto e aproximado. Medicao real exige
    tokenizer - ver medir_economia.py. Manter stdlib pura vale essa troca."""
    return max(1, len(texto) // 4)


def _grau(conn, no_id):
    """Numero de arestas incidentes no no, nos dois sentidos."""
    return conn.execute(
        "SELECT COUNT(*) FROM (SELECT para_id FROM arestas WHERE de_id=? "
        "UNION ALL SELECT de_id FROM arestas WHERE para_id=?)", (no_id, no_id)
    ).fetchone()[0]


def _vizinhanca(conn, raiz_id, profundidade, cap_grau=CAP_GRAU):
    """BFS limitada por profundidade sobre as arestas (nos dois sentidos),
    com CAP DE GRAU. Devolve ({id_no: distancia}, [ids de hub nao atravessado]).

    O cap de grau e o que impede a topologia em estrela de anular o ganho: um
    no cujo grau passa de `cap_grau` e incluido (ele e contexto legitimo) mas
    NAO e expandido, porque atravessa-lo transformaria "vizinho do vizinho"
    em "qualquer no do grafo". A raiz e imune - ela e o assunto do briefing."""
    vistos = {raiz_id: 0}
    fila = [(raiz_id, 0)]
    hubs = []
    while fila:
        atual, d = fila.pop(0)
        if d >= profundidade:
            continue
        if atual != raiz_id and _grau(conn, atual) > cap_grau:
            hubs.append(atual)
            continue
        for (viz,) in conn.execute(
            "SELECT para_id FROM arestas WHERE de_id=? "
            "UNION SELECT de_id FROM arestas WHERE para_id=?", (atual, atual)
        ):
            if viz not in vistos:
                vistos[viz] = d + 1
                fila.append((viz, d + 1))
    return vistos, hubs


def _montar_briefing(conn, ids_dist, foco, hubs=(), orcamento=CAP_TOKENS_BRIEFING,
                     raiz_id=None):
    """Monta o texto do briefing respeitando CAP_BRIEFING por tipo E o
    orcamento global de tokens, mais proximos do foco primeiro. Devolve
    (texto, cortados_por_tipo).

    Dois orcamentos, deliberadamente distintos: o cap por tipo impede um tipo
    de dominar a fatia; o orcamento global impede a fatia inteira de crescer.
    Um grafo denso passa em todos os caps por tipo e ainda assim estoura - por
    isso o global existe. O corte global e por DISTANCIA do foco (o no mais
    longe cai primeiro), nunca por ordem de tipo: cortar por tipo decapitaria
    uma categoria inteira so por causa da ordem alfabetica."""
    marcadores = ", ".join(f"{k}={v}" for k, v in sorted(CAP_BRIEFING.items()))
    linhas = [
        f"# BRIEFING — foco: {foco}",
        "",
        "Fatia do grafo de governança, não o projeto inteiro. Nós ordenados por",
        "distância do foco. Relações declaradas aparecem como arestas.",
        "",
    ]
    por_tipo = {}
    for id_, dist in sorted(ids_dist.items(), key=lambda kv: kv[1]):
        row = conn.execute(
            "SELECT tipo, chave, dados, status FROM nos WHERE id=?", (id_,)
        ).fetchone()
        if row:
            por_tipo.setdefault(row[0], []).append((id_, dist, row))

    cortados = {}
    # 1) cap por tipo - impede um tipo de dominar a fatia
    candidatos = []
    for tipo in sorted(por_tipo):
        itens = por_tipo[tipo]
        cap = CAP_BRIEFING.get(tipo, 10)
        if len(itens) > cap:
            cortados[tipo] = len(itens) - cap
            itens = itens[:cap]  # ja ordenados por distancia do foco
        for id_, dist, row in itens:
            _, chave, dados_json, status = row
            dados = json.loads(dados_json)
            campos = " · ".join(f"{k}={v}" for k, v in dados.items())
            linha = f"- [{chave or '(sem chave)'}|{status}|d{dist}] {campos}"
            candidatos.append((dist, tipo, id_, linha))

    # 2) orcamento global - corta o mais DISTANTE do foco primeiro. O no de
    #    foco entra sempre: um briefing sem o proprio assunto nao e briefing.
    #    O custo de admissao inclui o cabecalho "## TIPO" quando o no abre um
    #    tipo novo: ate a 11a sessao so a linha do no era contada, e o
    #    briefing composto chegava a ~1,26x o teto nominal (achado do pino
    #    de escala da 10a sessao, promovido a defeito pela auditoria externa).
    candidatos.sort(key=lambda c: (c[0], c[1], c[2]))
    # Contabilidade em BYTES (a unidade real do estimador len//4): somar
    # estimativas por linha acumula erro de arredondamento e newlines fora
    # da conta - foi assim que o composto passou do teto sem ninguem mentir.
    bytes_gasto = len("\n".join(linhas))
    orcamento_util = max(50, orcamento - RESERVA_ESTRUTURA_BRIEFING)
    sobreviventes, estourou = [], False
    tipos_admitidos = set()
    for dist, tipo, id_, linha in candidatos:
        custo = len(linha) + 1  # +1: o newline que o join adiciona
        if tipo not in tipos_admitidos:
            custo += len(f"## {tipo}") + 2  # cabecalho + newline + linha vazia
        if not estourou and ((bytes_gasto + custo) // 4 <= orcamento_util
                             or id_ == raiz_id):
            bytes_gasto += custo
            tipos_admitidos.add(tipo)
            sobreviventes.append((dist, tipo, id_, linha))
        else:
            estourou = True
            cortados[tipo] = cortados.get(tipo, 0) + 1
    gasto = bytes_gasto // 4

    ids_incluidos = {id_ for _, _, id_, _ in sobreviventes}
    por_tipo_final = {}
    for dist, tipo, id_, linha in sobreviventes:
        por_tipo_final.setdefault(tipo, []).append(linha)
    for tipo in sorted(por_tipo_final):
        linhas.append(f"## {tipo}")
        linhas.extend(por_tipo_final[tipo])
        linhas.append("")

    # Aresta so entra se AMBAS as pontas sobreviveram ao cap - senao o
    # briefing referenciaria um no que ele proprio nao incluiu.
    arestas = conn.execute(
        """SELECT d.chave, a.relacao, p.chave, a.origem, a.confianca
           FROM arestas a JOIN nos d ON d.id=a.de_id JOIN nos p ON p.id=a.para_id
           WHERE a.de_id IN (%s) AND a.para_id IN (%s)"""
        % (",".join("?" * len(ids_incluidos) or "NULL"),
           ",".join("?" * len(ids_incluidos) or "NULL")),
        list(ids_incluidos) * 2,
    ).fetchall() if ids_incluidos else []
    if arestas:
        # Relacao tambem tem orcamento: um no com 100 arestas explodiria o
        # payload que este comando existe para encolher. Alem do cap por
        # CONTAGEM, cada linha paga no orcamento global (mesmo defeito do
        # cabecalho: relacao fora da conta inflava o composto em silencio).
        if len(arestas) > CAP_RELACOES:
            cortados["RELAÇÃO"] = len(arestas) - CAP_RELACOES
            arestas = arestas[:CAP_RELACOES]
        cab_rel = "## RELAÇÕES"
        bytes_rel = len(cab_rel) + 2  # cabecalho + newline + linha vazia
        linhas_rel = []
        for de, rel, para, origem, conf in arestas:
            sufixo = f" ({origem}" + (f", conf={conf}" if conf is not None else "") + ")"
            linha_rel = f"- {de} —{rel}→ {para}{sufixo}"
            custo = len(linha_rel) + 1
            if (bytes_gasto + bytes_rel + custo) // 4 > orcamento_util:
                cortados["RELAÇÃO"] = cortados.get("RELAÇÃO", 0) + 1
                continue
            bytes_rel += custo
            linhas_rel.append(linha_rel)
        if linhas_rel:
            bytes_gasto += bytes_rel
            gasto = bytes_gasto // 4
            linhas.append(cab_rel)
            linhas.extend(linhas_rel)
            linhas.append("")

    if cortados or hubs:
        # Truncar SEM dica de recuperacao produz veredito falso em silencio
        # (invariante 'Never Block' do rtk): a persona precisa saber que ha
        # mais, e como pedir.
        linhas.append("## [PODADO]")
        if cortados:
            detalhe = ", ".join(f"{n} {t}" for t, n in sorted(cortados.items()))
            linhas += [
                f"Omitidos por orçamento: {detalhe}. Orçamento por tipo: {marcadores}.",
                f"Orçamento global: {orcamento} tokens (fatia ~{gasto}; "
                f"total real com esta estrutura ~TOTAL_REAL~).",
                "Para o conjunto completo de um tipo: `gov.py query --tipo <T>`;",
                "para o grafo inteiro: `gov.py render`.",
            ]
        if hubs:
            # Cap de grau: o hub esta AQUI, mas o que esta atras dele nao.
            # Sem esta linha o validador leria a fatia como se fosse tudo.
            nomes = []
            for hub_id in hubs:
                row = conn.execute("SELECT chave FROM nos WHERE id=?", (hub_id,)).fetchone()
                nomes.append(row[0] if row and row[0] else f"#{hub_id}")
            linhas += [
                f"Hubs incluídos mas NÃO atravessados (grau > {CAP_GRAU}): "
                f"{', '.join(nomes)}.",
                "O que está atrás deles ficou fora desta fatia — para abrir um: "
                "`gov.py briefing --no <hub>`.",
            ]
        linhas.append("")
    # O numero reportado e o total REAL do texto ([PODADO] incluso) - um
    # relatorio de orcamento que nao conta a si mesmo mente por construcao.
    texto = "\n".join(linhas)
    texto = texto.replace("~TOTAL_REAL~", str(estimar_tokens(texto)))
    return texto, cortados


def cmd_briefing(args):
    """Payload minimo suficiente para um subagente de validacao, derivado do
    grafo em vez dos arquivos crus do projeto. Tres camadas declaradas
    (padrao rtk): COMPLETO / PODADO / FALLBACK - o consumidor precisa saber
    quanto confiar na fatia que recebeu."""
    conn = conectar()
    raiz_id = _resolver_no(conn, args.no)
    # getattr: os flags novos sao opcionais, e chamadas antigas (e testes) que
    # montam args a mao nao os tem.
    cap_grau = getattr(args, "cap_grau", None) or CAP_GRAU
    orcamento = getattr(args, "orcamento", None) or CAP_TOKENS_BRIEFING
    ids_dist, hubs = _vizinhanca(conn, raiz_id, args.profundidade, cap_grau)
    texto, cortados = _montar_briefing(conn, ids_dist, args.no, hubs, orcamento, raiz_id)

    total_nos = conn.execute("SELECT COUNT(*) FROM nos").fetchone()[0]
    completo = _render_texto(conn, None)
    grau_foco = _grau(conn, raiz_id)
    conn.close()

    camada = "PODADO" if (cortados or hubs) else "COMPLETO"
    # Invariante 'never_worse' (rtk, src/core/guard.rs): comprimir nunca pode
    # sair mais caro que nao comprimir. Se a fatia ficou maior que o render
    # inteiro, a compressao falhou - mande o inteiro e diga que falhou.
    if estimar_tokens(texto) >= estimar_tokens(completo):
        texto, camada = completo, "FALLBACK"

    # G2: os arquivos que o FOCO toca - ponteiros, nunca conteudo (a
    # fronteira grafo != codigo fica de pe: o briefing diz ONDE ler). Entra
    # DEPOIS da decisao de camada, de proposito: ate no FALLBACK o validador
    # precisa saber quais arquivos abrir - o render nao carrega esse recorte.
    conn2 = conectar()
    tocados = conn2.execute(
        """SELECT p.dados FROM arestas a JOIN nos p ON p.id = a.para_id
           WHERE a.relacao = 'toca' AND a.de_id = ?""", (raiz_id,)).fetchall()
    conn2.close()
    if tocados:
        bloco_toca = ["## ARQUIVOS (toca)"]
        for (dados_json,) in tocados:
            d = json.loads(dados_json)
            bloco_toca.append(f"- {d.get('texto') or next(iter(d.values()))}")
        texto = texto + "\n" + "\n".join(bloco_toca) + "\n"

    # U4: a topologia do foco informa o DESPACHO. Ate 2026-08-02 essa
    # informacao existia (medida: reducao varia 11-96% com a topologia) e era
    # ignorada na hora de despachar - o hub rendia briefing gordo em silencio.
    aviso_hub = ""
    if grau_foco > cap_grau:
        aviso_hub = (f" [foco e HUB (grau {grau_foco}): payload melhor por "
                     f"decomposicao ou `render --tipo` - U4]")

    cabecalho = (f"<!-- briefing camada={camada} nos={len(ids_dist)}/{total_nos} "
                 f"profundidade={args.profundidade} tokens~{estimar_tokens(texto)}"
                 f"{aviso_hub} -->")
    saida = cabecalho + "\n" + texto
    if args.arquivo:
        with open(args.arquivo, "w", encoding="utf-8") as f:
            f.write(saida)
        print(f"briefing [{camada}] em {args.arquivo}: "
              f"{len(ids_dist)}/{total_nos} nos, ~{estimar_tokens(texto)} tokens"
              f"{aviso_hub}")
    else:
        print(saida)


def arquivar_prova(prova_id, motivo):
    """Tira um despacho MAL-ROTULADO do portao N2 sem apaga-lo.

    PROVA nasce sem chave, entao `gov.py status` nao a alcanca - ate
    2026-08-02 um despacho registrado com alvo ou validador errado ficava no
    grafo para sempre reprovando o `checar`, e a unica saida era forjar um ADR
    entre dois ids. O registro continua consultavel; so sai da conta do
    portao, e o MOTIVO fica gravado no proprio no."""
    conn = conectar()
    try:
        row = conn.execute(
            "SELECT dados, status FROM nos WHERE id = ? AND tipo='PROVA'",
            (prova_id,)).fetchone()
        if row is None:
            raise SystemExit(f"nao ha PROVA #{prova_id} neste grafo")
        if row[1] == "arquivado":
            print(f"PROVA #{prova_id} ja esta arquivada - nada a fazer")
            return False
        dados = json.loads(row[0])
        dados["arquivada_porque"] = motivo
        conn.execute("UPDATE nos SET status='arquivado', dados=? WHERE id=?",
                     (json.dumps(dados, ensure_ascii=False), prova_id))
        conn.execute(
            "INSERT INTO nos (tipo, chave, dados, status, criado_em)"
            " VALUES ('EVENTO', NULL, ?, 'registrado', ?)",
            (json.dumps({"texto": f"PROVA #{prova_id} arquivada: {motivo}"},
                        ensure_ascii=False), agora()))
        conn.commit()
        return True
    finally:
        conn.close()


def cmd_prova(args):
    """U2: ingestao do veredito ESTRUTURADO de um validador - o subagente
    devolve JSON preso a schema, isto vira no PROVA + aresta provada_por, e
    ninguem rele prosa de validador. A evidencia fica verbatim no campo
    (Art. 7)."""
    if getattr(args, "arquivar", None) is not None:
        if not getattr(args, "motivo", None):
            raise SystemExit("--arquivar exige --motivo: despacho tirado do "
                             "portao sem razao escrita e o portao desligado")
        if arquivar_prova(args.arquivar, args.motivo):
            print(f"PROVA #{args.arquivar} arquivada (fora do portao N2, "
                  f"continua no grafo)")
        return

    for obrigatorio in ("alvo", "validador", "veredito"):
        if not getattr(args, obrigatorio, None):
            raise SystemExit(f"--{obrigatorio} e obrigatorio para registrar")
    # O veredito PRECISA ser JSON para a memoizacao (U1) funcionar: `memo` faz
    # `json.loads` e trata o resto como miss. Ate 2026-08-02 este comando
    # anunciava "[memoizavel]" sem olhar o conteudo, e a promessa era falsa
    # sempre que o shell tivesse mexido no argumento. Acontece de verdade no
    # PowerShell, que tira as aspas de JSON passado a executavel nativo: o
    # despacho entra no grafo como `{aprovado:true,...}`, o comando diz
    # "memoizavel", e todo `memo` depois disso da miss - sem erro em lugar
    # nenhum. Agora a promessa so sai quando ela se sustenta.
    e_json = True
    try:
        json.loads(args.veredito)
    except (json.JSONDecodeError, TypeError):
        e_json = False

    pid = registrar_prova(args.alvo, args.validador, args.veredito,
                          detalhe=args.detalhe or "",
                          hash_escopo=args.hash_escopo)
    memo = (" [memoizavel: mesmo alvo+hash nao redespacha (U1)]"
            if args.hash_escopo and e_json else "")
    print(f"PROVA #{pid} registrada para '{args.alvo}' por '{args.validador}'{memo}")
    if not e_json:
        print("AVISO: --veredito NAO e JSON valido - o despacho fica registrado,"
              " mas a memoizacao (U1) dara miss para sempre neste alvo+hash.",
              file=sys.stderr)
        print("  No PowerShell as aspas somem ao passar JSON para executavel"
              " nativo; use  --% , um here-string, ou o Git Bash.",
              file=sys.stderr)


def cmd_memo(args):
    """U1 na CLI. Exit 1 no miss E POR CONTRATO (quem chama com verificacao
    automatica nao pode usar check=True cego - LIC-2026-08-01-03)."""
    veredito = prova_memoizada(args.alvo, args.hash_escopo)
    if veredito is None:
        print("sem memo: nunca provado com este escopo, ou um ADR mudou o "
              "escopo depois - despache o validador")
        sys.exit(1)
    print(json.dumps(veredito, ensure_ascii=False))


def cmd_fatura(args):
    """N4: a conta REAL da sessao por categoria - e a 5a categoria e
    obrigatoria.

    Categorias: boot / trabalho / saida (declaradas por quem operou a
    sessao, ex.: do /cost do harness), prova (MEDIDA - lida do log que o
    escalador escreve por chamada, `usage` da API e nao aritmetica) e
    **envelope do harness** - system prompt, schemas de ferramenta,
    reminders: a fracao que NENHUM script deste ecossistema ve nem pode
    otimizar. Sem ela declarada, todo percentual teria um denominador que
    nao se controla - por isso a fatura RECUSA percentuais sem envelope.

    E aqui que a promessa do B3/N7 e conferida: `cache_read` observado > 0
    sessao apos sessao, ou o desconto de cache e lenda de novo."""
    # Mesmo default do produtor (roteador.LOG_USO_API) - convencao de caminho,
    # como GOV_DB_PATH; o env var e o unico acoplamento entre os dois.
    caminho = os.environ.get("GOV_LOG_USO_API",
                             os.path.join(".governanca", "uso_api.jsonl"))
    todas = []
    if os.path.exists(caminho):
        with open(caminho, encoding="utf-8") as f:
            todas = [json.loads(l) for l in f if l.strip()]
    # Token de provedor diferente NAO se soma. A regua ponderada de
    # `medidor.py` deriva da tabela de precos da Anthropic (saida 5x, cache
    # 0,1x/1,25x): aplicada a um token do Gemini ela produziria um total que
    # nao corresponde a fatura de ninguem. Entao a categoria "prova" e so o
    # que e comparavel, e o resto sai numa linha propria, declarada.
    # Linha antiga nao tem o campo `provedor` - e anthropic, que e o que era.
    chamadas = [l for l in todas if l.get("provedor", "anthropic") == "anthropic"]
    outros = [l for l in todas if l.get("provedor", "anthropic") != "anthropic"]
    prova = {c: sum(l.get(c, 0) for l in chamadas)
             for c in ("entrada", "saida", "cache_leitura", "cache_escrita")}

    try:
        from medidor import custo_ponderado
    except ImportError:
        custo_ponderado = None

    def _pond(entrada=0, saida=0, cache_leitura=0, cache_escrita=0):
        if custo_ponderado is None:
            return None
        return custo_ponderado(entrada=entrada, saida=saida,
                               cache_leitura=cache_leitura,
                               cache_escrita=cache_escrita)

    categorias = [
        ("boot", args.boot, "declarado", _pond(entrada=args.boot or 0)),
        ("trabalho", args.trabalho, "declarado", _pond(entrada=args.trabalho or 0)),
        ("prova", sum(prova.values()), f"MEDIDO ({len(chamadas)} chamada(s))",
         _pond(**prova)),
        ("saida", args.saida, "declarado (peso 5x)", _pond(saida=args.saida or 0)),
        ("envelope", args.envelope, "declarado (o que nenhum script ve)",
         _pond(entrada=args.envelope or 0)),
    ]

    print("=== FATURA (tokens; ponderado em tokens de entrada equivalentes) ===")
    total_pond = 0.0
    algum_nao_declarado = False
    for nome, bruto, origem, pond in categorias:
        if bruto is None:
            print(f"{nome:<10} NAO DECLARADO ({origem})")
            algum_nao_declarado = algum_nao_declarado or nome == "envelope"
            continue
        pond_txt = f"{pond:>10.1f}" if pond is not None else "   (sem medidor)"
        print(f"{nome:<10} {bruto:>8} tk  ponderado {pond_txt}  [{origem}]")
        total_pond += pond or 0
    print()
    print(f"prova (detalhe): entrada={prova['entrada']} saida={prova['saida']} "
          f"cache_leitura={prova['cache_leitura']} cache_escrita={prova['cache_escrita']}")
    print(f"cache_read observado: {prova['cache_leitura']}"
          + ("" if prova["cache_leitura"] > 0 else
             "  <- ZERO: nenhum desconto de cache real ate agora (B3/N7)"))
    if outros:
        print()
        print("FORA DO TOTAL (provedor com outra tabela de precos - nao somavel):")
        for provedor in sorted({l.get("provedor") for l in outros}):
            do_provedor = [l for l in outros if l.get("provedor") == provedor]
            ent = sum(l.get("entrada", 0) for l in do_provedor)
            sai = sum(l.get("saida", 0) for l in do_provedor)
            modelos = sorted({l.get("modelo_real") or l.get("modelo", "?")
                              for l in do_provedor})
            print(f"  {provedor:<10} {len(do_provedor)} chamada(s)  "
                  f"entrada={ent} saida={sai}  [{', '.join(modelos)}]")
    print()
    if args.envelope is None:
        print("ENVELOPE DO HARNESS NAO DECLARADO - percentuais RECUSADOS: sem o")
        print("envelope, o denominador do total e desconhecido e todo percentual")
        print("prometeria economia sobre um numero que nao se controla (N4).")
        print("Declare com --envelope N (do /cost ou fatura do provedor).")
        return
    print(f"total ponderado declarado+medido: {total_pond:.1f} tk-equivalentes")
    for nome, bruto, _, pond in categorias:
        if bruto is not None and pond is not None and total_pond:
            print(f"  {nome:<10} {100 * pond / total_pond:>5.1f}%")


def cmd_export(args):
    """Espelho JSONL deterministico (ordem por id) - so para diff em PR e
    recuperacao. Nunca fonte, nunca relido pelo agente."""
    conn = conectar()
    nos = conn.execute(
        "SELECT id, tipo, chave, dados, status, criado_em FROM nos ORDER BY id"
    ).fetchall()
    arestas = conn.execute(
        "SELECT de_id, para_id, relacao, origem, confianca FROM arestas "
        "ORDER BY de_id, para_id, relacao"
    ).fetchall()
    conn.close()

    caminho = args.arquivo or EXPORT_PATH
    destino = os.path.dirname(caminho)
    if destino:
        os.makedirs(destino, exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        for id_, tipo, chave, dados_json, status, criado_em in nos:
            f.write(json.dumps({
                "registro": "no", "id": id_, "tipo": tipo, "chave": chave,
                "dados": json.loads(dados_json), "status": status, "criado_em": criado_em,
            }, ensure_ascii=False, sort_keys=True) + "\n")
        for de_id, para_id, relacao, origem, confianca in arestas:
            f.write(json.dumps({
                "registro": "aresta", "de_id": de_id, "para_id": para_id,
                "relacao": relacao, "origem": origem, "confianca": confianca,
            }, ensure_ascii=False, sort_keys=True) + "\n")
    print(f"exportado {len(nos)} no(s) + {len(arestas)} aresta(s) em {caminho}")


def main():
    parser = argparse.ArgumentParser(prog="gov.py")
    sub = parser.add_subparsers(dest="comando", required=True)

    p_init = sub.add_parser("init")
    p_init.add_argument("--ancora", help="arquivo alvo da ancora (default: CLAUDE.md ou AGENTS.md)")
    p_init.add_argument("--sem-ancora", action="store_true", dest="sem_ancora")
    p_init.add_argument("--idioma", default="pt", choices=["pt", "en"],
                        help="idioma do que VIAJA no prompt (ancora + regime). "
                             "Medido: EN custa ~30%% menos que pt-BR")
    p_init.add_argument("--sem-estilo", action="store_true", dest="sem_estilo",
                        help="nao instala o regime de forma da saida (estilo.py)")
    p_init.add_argument("--estilo-nivel", default="pleno", dest="estilo_nivel")
    p_init.add_argument("--estilo-idioma", default=None, dest="estilo_idioma",
                        choices=["pt", "en"], help="sobrepoe --idioma so no regime")

    p_add = sub.add_parser("add")
    p_add.add_argument("tipo")
    p_add.add_argument("--chave")
    p_add.add_argument("--campo", action="append")
    p_add.add_argument("--status")

    p_status = sub.add_parser("status")
    p_status.add_argument("chave")
    p_status.add_argument("para", help=f"novo status: {sorted(STATUS_VALIDOS)}")
    p_status.add_argument("--tipo", help="desambigua quando a chave existe em mais de um tipo")

    p_aresta = sub.add_parser("aresta")
    p_aresta.add_argument("de")
    p_aresta.add_argument("relacao")
    p_aresta.add_argument("para")
    p_aresta.add_argument("--origem", default="declarado")
    p_aresta.add_argument("--confianca", type=float, default=None)

    p_query = sub.add_parser("query")
    p_query.add_argument("--tipo")
    p_query.add_argument("--status")
    p_query.add_argument("--campo", help="chave=valor")

    p_licoes = sub.add_parser("licoes",
                              help="indice das armadilhas: 1 linha de SINAL por licao")
    p_licoes.add_argument("--corpo", action="store_true",
                          help="imprime tambem o texto da licao")
    p_licoes.add_argument("--sinal", default=None,
                          help="filtra por substring (chegue pelo sintoma)")

    p_evento = sub.add_parser("evento")
    p_evento.add_argument("texto")

    sub.add_parser("pulso")
    sub.add_parser("checar")
    p_abrir = sub.add_parser("abrir",
                             help="boot consolidado: pulso + queries + checar (B4)")
    p_abrir.add_argument("--delta", action="store_true",
                         help="boot O(mudanca): so o que nasceu desde o ultimo "
                              "boot + RSK vigentes (U3)")

    p_prova = sub.add_parser("prova", help="registra despacho/veredito de validador (U2)")
    p_prova.add_argument("--alvo")
    p_prova.add_argument("--validador")
    p_prova.add_argument("--veredito",
                         help="JSON estruturado do validador, verbatim")
    p_prova.add_argument("--arquivar", type=int, default=None, metavar="ID",
                         help="tira do portao N2 um despacho mal-rotulado, sem "
                              "apaga-lo; exige --motivo")
    p_prova.add_argument("--motivo", default=None,
                         help="por que o despacho saiu do portao (fica no no)")
    p_prova.add_argument("--detalhe", default="")
    p_prova.add_argument("--hash-escopo", default=None, dest="hash_escopo",
                         help="hash(diff+criterio+escopo) para memoizacao (U1)")

    p_memo = sub.add_parser("memo", help="consulta memoizacao exata de prova (U1); exit 1 = sem memo")
    p_memo.add_argument("--alvo", required=True)
    p_memo.add_argument("--hash-escopo", required=True, dest="hash_escopo")

    p_render = sub.add_parser("render")
    p_render.add_argument("--tipo")
    p_render.add_argument("--arquivo")

    p_brief = sub.add_parser("briefing")
    p_brief.add_argument("--no", required=True, dest="no", help="chave do no de foco")
    p_brief.add_argument("--profundidade", type=int, default=2)
    p_brief.add_argument("--arquivo")
    p_brief.add_argument("--orcamento", type=int, default=None, dest="orcamento",
                         help=f"teto global de tokens (padrao {CAP_TOKENS_BRIEFING})")
    p_brief.add_argument("--cap-grau", type=int, default=None, dest="cap_grau",
                         help=f"grau acima do qual um no nao e atravessado "
                              f"(padrao {CAP_GRAU})")

    p_export = sub.add_parser("export")
    p_export.add_argument("--formato", default="jsonl", choices=["jsonl"])
    p_export.add_argument("--arquivo")

    p_fatura = sub.add_parser("fatura", help="conta real por categoria (N4)")
    p_fatura.add_argument("--boot", type=int, default=None)
    p_fatura.add_argument("--trabalho", type=int, default=None)
    p_fatura.add_argument("--saida", type=int, default=None)
    p_fatura.add_argument("--envelope", type=int, default=None,
                          help="OBRIGATORIO para percentuais: a fracao do "
                               "harness que nenhum script ve")

    args = parser.parse_args()
    {
        "init": cmd_init, "add": cmd_add, "status": cmd_status,
        "aresta": cmd_aresta, "query": cmd_query,
        "evento": cmd_evento, "pulso": cmd_pulso, "checar": cmd_checar,
        "licoes": cmd_licoes,
        "abrir": cmd_abrir,
        "render": cmd_render, "briefing": cmd_briefing, "export": cmd_export,
        "fatura": cmd_fatura, "prova": cmd_prova, "memo": cmd_memo,
    }[args.comando](args)


if __name__ == "__main__":
    main()
