import importlib
import json
import os
import sqlite3
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def carregar_gov(tmp_path, monkeypatch):
    monkeypatch.setenv("GOV_DB_PATH", str(tmp_path / ".governanca" / "grafo.db"))
    monkeypatch.chdir(tmp_path)
    import gov
    importlib.reload(gov)
    return gov


def _args(**kw):
    return type("A", (), kw)()


def add(gov, tipo, chave, campos, status=None):
    gov.cmd_add(_args(tipo=tipo, chave=chave, campo=[f"{k}={v}" for k, v in campos.items()], status=status))


# --- schema -----------------------------------------------------------------

def test_init_cria_banco(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    conn = gov.conectar()
    tabelas = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    assert {"nos", "arestas"} <= tabelas


def test_arestas_tem_colunas_origem_confianca(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    conn = gov.conectar()
    colunas = {r[1] for r in conn.execute("PRAGMA table_info(arestas)")}
    conn.close()
    assert {"origem", "confianca"} <= colunas


# --- init: ancora de boot e inventario (o que o v5 alegava sem implementar) --

def test_init_instala_ancora_de_boot(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    conteudo = open(tmp_path / "AGENTS.md", encoding="utf-8").read()
    assert "gov.py:ancora-boot" in conteudo
    assert "gov.py pulso" in conteudo


def test_init_ancora_e_idempotente_e_aditiva(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    (tmp_path / "CLAUDE.md").write_text("# Projeto existente\nRegra que nao pode sumir.\n", encoding="utf-8")
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    conteudo = open(tmp_path / "CLAUDE.md", encoding="utf-8").read()
    assert conteudo.count("gov.py:ancora-boot (inicio)") == 1
    assert "Regra que nao pode sumir." in conteudo


def test_init_registra_no_inventario_utils(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    os.makedirs(tmp_path / "utils", exist_ok=True)
    (tmp_path / "utils" / "README.md").write_text("| script | papel |\n|---|---|\n", encoding="utf-8")
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    assert "`gov.py`" in open(tmp_path / "utils" / "README.md", encoding="utf-8").read()


def test_init_sem_ancora_nao_escreve_nada(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    gov.cmd_init(_args(ancora=None, sem_ancora=True))
    assert not (tmp_path / "AGENTS.md").exists()
    assert not (tmp_path / "CLAUDE.md").exists()


# --- init: regime de forma da saida (estilo.py) ------------------------------

def test_init_instala_o_regime_de_saida_em_bloco_proprio(tmp_path, monkeypatch, capsys):
    """Bloco separado da ancora: o portao da §8 exige ancora de ate 5 linhas, e
    os dois custos precisam ficar legiveis um do outro."""
    gov = carregar_gov(tmp_path, monkeypatch)
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    conteudo = (tmp_path / "AGENTS.md").read_text(encoding="utf-8")
    assert gov.MARCA_ESTILO in conteudo
    assert "gov.py:ancora-boot" in conteudo
    corpo_ancora = conteudo.split("ancora-boot (inicio)")[1].split("ancora-boot (fim)")[0]
    assert len(corpo_ancora.strip().splitlines()) <= 5


def test_init_do_regime_e_idempotente_e_aditivo(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    (tmp_path / "CLAUDE.md").write_text("# meu projeto\n", encoding="utf-8")
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    conteudo = (tmp_path / "CLAUDE.md").read_text(encoding="utf-8")
    assert conteudo.count(f"{gov.MARCA_ESTILO} (inicio)") == 1
    assert "# meu projeto" in conteudo


def test_init_sem_estilo_instala_ancora_mas_nao_o_regime(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    gov.cmd_init(_args(ancora=None, sem_ancora=False, sem_estilo=True))
    conteudo = (tmp_path / "AGENTS.md").read_text(encoding="utf-8")
    assert "gov.py:ancora-boot" in conteudo
    assert gov.MARCA_ESTILO not in conteudo


def test_init_declara_o_custo_do_regime_em_tokens(tmp_path, monkeypatch, capsys):
    """Art. 6: nunca instalar custo recorrente em silencio. O bloco entra no
    prompt de todo turno - quem roda `init` tem de ver o preco na hora."""
    gov = carregar_gov(tmp_path, monkeypatch)
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    saida = capsys.readouterr().out
    assert "regime de saida:" in saida
    assert "tokens de entrada por turno" in saida


def test_init_instala_a_ancora_no_idioma_pedido(tmp_path, monkeypatch, capsys):
    """A ancora e o texto de maior alavancagem do projeto: viaja no prefixo de
    todo turno. Medido: so 0,2% do corpus de fato viaja - por isso e ELA que
    existe nos dois idiomas, e nao os 80 mil tokens de comentario em Python."""
    gov = carregar_gov(tmp_path, monkeypatch)
    gov.cmd_init(_args(ancora=None, sem_ancora=False, idioma="en"))
    conteudo = (tmp_path / "AGENTS.md").read_text(encoding="utf-8")
    assert "Run `gov.py pulso` before any action" in conteudo
    assert "Rode `gov.py pulso`" not in conteudo
    assert "Output form: no rhetoric" in conteudo  # --idioma cascateia no regime


def test_o_marcador_de_ancora_nao_e_traduzido(tmp_path, monkeypatch):
    """O marcador HTML e a chave de idempotencia. Traduzido, `init` deixaria de
    reconhecer a propria ancora e duplicaria o bloco na 2a chamada."""
    gov = carregar_gov(tmp_path, monkeypatch)
    for idioma in ("pt", "en"):
        assert "gov.py:ancora-boot (inicio)" in gov.ANCORAS[idioma]
        assert "gov.py:ancora-boot (fim)" in gov.ANCORAS[idioma]


def test_ancora_em_ingles_custa_menos_que_em_portugues(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from medidor import escolher_medidor

    conta, _, _ = escolher_medidor(forcar_proxy=True)
    assert conta(gov.ANCORAS["en"]) < conta(gov.ANCORAS["pt"])


def test_init_recusa_idioma_invalido(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    with pytest.raises(SystemExit) as erro:
        gov.cmd_init(_args(ancora=None, sem_ancora=False, idioma="fr"))
    assert "idioma invalido" in str(erro.value)


def test_init_recusa_nivel_de_estilo_recusado_por_medicao(tmp_path, monkeypatch):
    """`init --estilo-nivel ultra` nao pode instalar em silencio um degrau que
    este projeto reprovou por medicao."""
    gov = carregar_gov(tmp_path, monkeypatch)
    with pytest.raises(SystemExit) as erro:
        gov.cmd_init(_args(ancora=None, sem_ancora=False, estilo_nivel="ultra"))
    assert "ultra" in str(erro.value)


def test_gov_roda_sem_estilo_ao_lado(tmp_path, monkeypatch, capsys):
    """Import guardado, igual ao do painel: gov.py copiado sozinho continua
    instalando a ancora e o grafo, so pula o regime."""
    gov = carregar_gov(tmp_path, monkeypatch)
    monkeypatch.setitem(sys.modules, "estilo", None)  # forca ImportError
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    conteudo = (tmp_path / "AGENTS.md").read_text(encoding="utf-8")
    assert "gov.py:ancora-boot" in conteudo
    assert gov.MARCA_ESTILO not in conteudo
    assert "estilo.py nao esta ao lado" in capsys.readouterr().out


# --- add --------------------------------------------------------------------

def test_add_rejeita_campo_obrigatorio_ausente(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    try:
        add(gov, "SUP", "SUP-02", {"enunciado": "x"})
        assert False, "deveria ter levantado SystemExit"
    except SystemExit as e:
        assert "obrigatorios ausentes" in str(e)


def test_add_rejeita_campo_grande_demais(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    try:
        add(gov, "ADR", "ADR-99", {"decisao": "x" * (gov.TAMANHO_MAX_CAMPO + 1), "motivo": "m"})
        assert False, "deveria ter levantado SystemExit"
    except SystemExit as e:
        assert "excede" in str(e)


def test_add_rejeita_caractere_controle(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    try:
        add(gov, "ADR", "ADR-98", {"decisao": "texto\x07com sino", "motivo": "m"})
        assert False, "deveria ter levantado SystemExit"
    except SystemExit as e:
        assert "controle" in str(e)


def test_add_fato_dispensa_chave(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "FATO", None, {"texto": "inventario atual", "tipo_fato": "licao"})
    conn = gov.conectar()
    row = conn.execute("SELECT chave, dados FROM nos WHERE tipo='FATO'").fetchone()
    conn.close()
    assert row[0] is None and json.loads(row[1])["tipo_fato"] == "licao"


def test_add_exige_chave_para_tipo_identificado(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    try:
        add(gov, "ADR", None, {"decisao": "d", "motivo": "m"})
        assert False, "deveria ter levantado SystemExit"
    except SystemExit as e:
        assert "chave" in str(e)


# --- checar: severidade e a checagem carro-chefe ----------------------------

def test_checar_detecta_marcador_proibido(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ADR", "ADR-01", {"decisao": "TODO decidir depois", "motivo": "m"})
    try:
        gov.cmd_checar(_args())
        assert False, "deveria ter chamado sys.exit(1)"
    except SystemExit as e:
        assert e.code == 1
    assert "TODO" in capsys.readouterr().out


def test_checar_passa_sem_problemas(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ADR", "ADR-01", {"decisao": "usar SQLite", "motivo": "simplicidade"})
    gov.cmd_checar(_args())
    assert "OK" in capsys.readouterr().out


def test_checar_pega_onda_concluida_com_risco_vigente(tmp_path, monkeypatch, capsys):
    """A checagem carro-chefe: a autocontradicao que so um Tribunal caro
    pegou no projeto-piloto. O v5 alegava isto sem implementar."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "RSK", "RSK-01", {"risco": "r", "gatilho": "g", "resposta": "x"})
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"}, status="concluida")
    gov.cmd_aresta(_args(de="RSK-01", relacao="bloqueia", para="O1", origem="declarado", confianca=None))
    capsys.readouterr()

    try:
        gov.cmd_checar(_args())
        assert False, "deveria ter falhado: onda concluida com risco vigente"
    except SystemExit as e:
        assert e.code == 1
    saida = capsys.readouterr().out
    assert "O1" in saida and "RSK-01" in saida


def test_checar_aceita_onda_concluida_com_risco_resolvido(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "RSK", "RSK-01", {"risco": "r", "gatilho": "g", "resposta": "x"}, status="resolvido")
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"}, status="concluida")
    gov.cmd_aresta(_args(de="RSK-01", relacao="bloqueia", para="O1", origem="declarado", confianca=None))
    # G1 (2026-08-02): concluida exige evidencia - o custo declarado do portao
    add(gov, "FATO", "COMMIT-1", {"texto": "commit 1: suite verde"})
    gov.cmd_aresta(_args(de="O1", relacao="evidencia", para="COMMIT-1", origem="declarado", confianca=None))
    capsys.readouterr()
    gov.cmd_checar(_args())
    assert "OK" in capsys.readouterr().out


def test_checar_sup_alto_com_teste_raso_e_aviso_nao_falha(tmp_path, monkeypatch, capsys):
    """'Sinaliza para revisao, nao bloqueia' - exit 0 com AVISO. Vazio ja e
    FALHA de schema; o aviso cobre o que o schema nao pega: teste presente
    mas raso demais para refutar algo de raio_dano alto."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "SUP", "SUP-01", {"enunciado": "e", "raio_dano": "alto", "teste_refutacao": "ver depois"})
    capsys.readouterr()

    gov.cmd_checar(_args())  # nao levanta: e aviso
    saida = capsys.readouterr().out
    assert "AVISO" in saida and "SUP-01" in saida and "raso" in saida


def test_checar_sup_alto_sem_teste_e_falha_de_schema(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    conn = gov.conectar()
    conn.execute(
        "INSERT INTO nos (tipo, chave, dados, criado_em) VALUES (?, ?, ?, ?)",
        ("SUP", "SUP-01", json.dumps({"enunciado": "e", "raio_dano": "alto", "teste_refutacao": ""}), gov.agora()),
    )
    conn.commit()
    conn.close()
    capsys.readouterr()

    try:
        gov.cmd_checar(_args())
        assert False, "campo obrigatorio vazio deve ser FALHA, nao aviso"
    except SystemExit as e:
        assert e.code == 1


def test_checar_aresta_inferida_fraca_e_aviso(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "RSK", "RSK-01", {"risco": "r", "gatilho": "g", "resposta": "x"})
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    gov.cmd_aresta(_args(de="RSK-01", relacao="bloqueia", para="O1", origem="inferido", confianca=0.3))
    capsys.readouterr()

    gov.cmd_checar(_args())
    assert "AVISO" in capsys.readouterr().out


# --- arestas ----------------------------------------------------------------

def test_aresta_inferida_exige_confianca(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "RSK", "RSK-01", {"risco": "r", "gatilho": "g", "resposta": "x"})
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    try:
        gov.cmd_aresta(_args(de="RSK-01", relacao="bloqueia", para="O1", origem="inferido", confianca=None))
        assert False, "deveria ter levantado SystemExit"
    except SystemExit as e:
        assert "confianca" in str(e)


def test_evento_e_append_only(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    gov.cmd_evento(_args(texto="primeiro evento"))
    gov.cmd_evento(_args(texto="segundo evento"))
    conn = gov.conectar()
    eventos = conn.execute("SELECT dados FROM nos WHERE tipo='EVENTO' ORDER BY id").fetchall()
    conn.close()
    assert [json.loads(d[0])["texto"] for d in eventos] == ["primeiro evento", "segundo evento"]


# --- pulso / render / export ------------------------------------------------

def test_pulso_conta_bloqueios_ativos(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "RSK", "RSK-01", {"risco": "r", "gatilho": "g", "resposta": "x"})
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    gov.cmd_aresta(_args(de="RSK-01", relacao="bloqueia", para="O1", origem="declarado", confianca=None))
    capsys.readouterr()

    gov.cmd_pulso(_args())
    saida = capsys.readouterr().out
    assert "Bloqueios ativos" in saida and "1" in saida


def test_render_declara_documento_convencional(tmp_path, monkeypatch, capsys):
    """`--tipo ADR` tem que dizer que substitui DECISIONS - o v5 alegava
    esse mapeamento sem implementar."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ADR", "ADR-01", {"decisao": "usar SQLite", "motivo": "simplicidade"})
    capsys.readouterr()

    gov.cmd_render(_args(tipo="ADR", arquivo=None))
    saida = capsys.readouterr().out
    assert "DECISIONS" in saida and "ADR-01" in saida


def test_export_gera_jsonl_com_nos_e_arestas(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "RSK", "RSK-01", {"risco": "r", "gatilho": "g", "resposta": "x"})
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    gov.cmd_aresta(_args(de="RSK-01", relacao="bloqueia", para="O1", origem="inferido", confianca=0.8))
    caminho = str(tmp_path / "grafo.jsonl")
    gov.cmd_export(_args(formato="jsonl", arquivo=caminho))

    linhas = [json.loads(l) for l in open(caminho, encoding="utf-8")]
    registros = [l["registro"] for l in linhas]
    assert registros.count("no") == 2 and registros.count("aresta") == 1


# --- Alavanca 1: briefing (fatia do grafo em vez do projeto inteiro) -------

def _projeto_com_vizinhanca(gov):
    add(gov, "MANDATO", "M1", {"ni": "migrar ETL", "ns": "fechamento sem retrabalho", "criterios": "paridade"})
    add(gov, "ONDA", "O1", {"objetivo": "extrair", "criterio_aceite": "dump identico"})
    add(gov, "ONDA", "O2", {"objetivo": "carregar", "criterio_aceite": "totais batem"})
    add(gov, "RSK", "RSK-01", {"risco": "encoding", "gatilho": "diff acusa", "resposta": "forcar latin1"})
    add(gov, "ADR", "ADR-01", {"decisao": "CSV intermediario", "motivo": "sem conexao concorrente"})
    gov.cmd_aresta(_args(de="RSK-01", relacao="bloqueia", para="O1", origem="declarado", confianca=None))
    gov.cmd_aresta(_args(de="ADR-01", relacao="resolve", para="RSK-01", origem="declarado", confianca=None))


def test_briefing_traz_so_a_vizinhanca(tmp_path, monkeypatch, capsys):
    """O1 alcanca RSK-01 (d1) e ADR-01 (d2); O2 nao esta na vizinhanca."""
    gov = carregar_gov(tmp_path, monkeypatch)
    _projeto_com_vizinhanca(gov)
    capsys.readouterr()

    gov.cmd_briefing(_args(no="O1", profundidade=2, arquivo=None))
    saida = capsys.readouterr().out
    assert "RSK-01" in saida and "ADR-01" in saida
    assert "O2" not in saida


def test_briefing_profundidade_1_corta_mais(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    _projeto_com_vizinhanca(gov)
    capsys.readouterr()

    gov.cmd_briefing(_args(no="O1", profundidade=1, arquivo=None))
    saida = capsys.readouterr().out
    assert "RSK-01" in saida and "ADR-01" not in saida


def test_briefing_declara_camada(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    _projeto_com_vizinhanca(gov)
    capsys.readouterr()

    gov.cmd_briefing(_args(no="O1", profundidade=2, arquivo=None))
    saida = capsys.readouterr().out
    assert "camada=" in saida
    assert any(c in saida for c in ("COMPLETO", "PODADO", "FALLBACK"))


def test_briefing_inclui_relacoes_declaradas(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    _projeto_com_vizinhanca(gov)
    capsys.readouterr()

    gov.cmd_briefing(_args(no="O1", profundidade=2, arquivo=None))
    saida = capsys.readouterr().out
    assert "RELAÇÕES" in saida and "bloqueia" in saida


def test_briefing_podado_traz_dica_de_recuperacao(tmp_path, monkeypatch, capsys):
    """Invariante 'Never Block' (rtk): truncar sem dizer como recuperar produz
    veredito falso em silencio."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "raiz", "criterio_aceite": "c"})
    for i in range(gov.CAP_BRIEFING["ADR"] + 25):
        add(gov, "ADR", f"ADR-{i:02d}", {
            "decisao": f"decisao longa numero {i} " + "d" * 200,
            "motivo": f"motivo longo numero {i} " + "m" * 200})
        gov.cmd_aresta(_args(de=f"ADR-{i:02d}", relacao="depende_de", para="O1",
                             origem="declarado", confianca=None))
    capsys.readouterr()

    gov.cmd_briefing(_args(no="O1", profundidade=1, arquivo=None))
    saida = capsys.readouterr().out
    assert "[PODADO]" in saida
    assert "gov.py query --tipo" in saida  # dica de recuperacao


def test_briefing_nunca_pior_que_render_completo(tmp_path, monkeypatch, capsys):
    """Invariante never_worse (rtk, src/core/guard.rs): comprimir nunca pode
    sair mais caro. Grafo minusculo -> o cabecalho do briefing custa mais que
    o render inteiro -> tem que cair para FALLBACK."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    capsys.readouterr()

    gov.cmd_briefing(_args(no="O1", profundidade=2, arquivo=None))
    saida = capsys.readouterr().out
    assert "camada=FALLBACK" in saida


def test_briefing_menor_que_render_em_grafo_grande(tmp_path, monkeypatch, capsys):
    """O caso que justifica a alavanca: com muitos nos fora da vizinhanca, a
    fatia tem que ser materialmente menor que o render integral."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "foco", "criterio_aceite": "c"})
    add(gov, "RSK", "RSK-01", {"risco": "r", "gatilho": "g", "resposta": "x"})
    gov.cmd_aresta(_args(de="RSK-01", relacao="bloqueia", para="O1", origem="declarado", confianca=None))
    for i in range(40):  # ruido longe do foco
        add(gov, "PNF", f"PNF-{i:02d}", {
            "pergunta": f"pergunta longa numero {i} " + "x" * 120,
            "resposta_adotada": f"resposta longa numero {i} " + "y" * 120})
    capsys.readouterr()

    gov.cmd_briefing(_args(no="O1", profundidade=2, arquivo=None))
    brief = capsys.readouterr().out
    conn = gov.conectar()
    completo = gov._render_texto(conn, None)
    conn.close()
    assert gov.estimar_tokens(brief) < gov.estimar_tokens(completo) / 2
    assert "camada=COMPLETO" in brief


# --- status: a transicao de estado que faltava ------------------------------
# Achado do 1o piloto ao vivo (teach-note, 2026-08-01): `add` so INSERE, entao
# nada conseguia levar um no de 'vigente' a 'concluida'. A checagem carro-chefe
# acima passava por criar a onda JA concluida - provava o SQL, nunca o caminho
# que um projeto real percorre.


def _status(gov, chave, para, tipo=None):
    gov.cmd_status(_args(chave=chave, para=para, tipo=tipo))


# --- init: colisao com o Contrato_Mandato_Autonomo --------------------------


def _escrever_aparato(tmp_path, nomes):
    (tmp_path / "docs").mkdir(exist_ok=True)
    for nome in nomes:
        (tmp_path / "docs" / nome).write_text("conteudo", encoding="utf-8")


def test_init_avisa_quando_o_projeto_ja_tem_aparato_documental(tmp_path, monkeypatch, capsys):
    """Achado do 1o piloto ao vivo: `init` instalou uma ancora dizendo
    'nunca escreva STATE.md a mao' num CLAUDE.md cuja ordem de leitura
    obrigatoria mandava ler docs/STATE.md - duas governancas dando ordens
    contraditorias no mesmo arquivo, sem ninguem avisar."""
    gov = carregar_gov(tmp_path, monkeypatch)
    _escrever_aparato(tmp_path, ["MANDATO.md", "SUPOSICOES.md", "DECISIONS.md", "STATE.md"])

    gov.cmd_init(_args(ancora=None, sem_ancora=False))

    saida = capsys.readouterr().out
    assert "AVISO" in saida and "MANDATO.md" in saida


def test_init_avisa_mas_nao_bloqueia(tmp_path, monkeypatch, capsys):
    """Migrar e decisao do dono do projeto: o aviso nao pode impedir o
    init, so tornar a colisao consciente."""
    gov = carregar_gov(tmp_path, monkeypatch)
    _escrever_aparato(tmp_path, ["MANDATO.md", "SUPOSICOES.md", "DECISIONS.md"])

    gov.cmd_init(_args(ancora=None, sem_ancora=False))

    assert "ancora de boot" in capsys.readouterr().out
    assert os.path.exists(tmp_path / ".governanca" / "grafo.db")


def test_init_nao_avisa_num_projeto_limpo(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    gov.cmd_init(_args(ancora=None, sem_ancora=False))
    assert "AVISO" not in capsys.readouterr().out


def test_init_nao_avisa_por_um_unico_arquivo_de_nome_parecido(tmp_path, monkeypatch, capsys):
    """`docs/STATE.md` sozinho e comum em projeto nenhum aparato; exigir
    3 dos 5 evita alarme falso."""
    gov = carregar_gov(tmp_path, monkeypatch)
    _escrever_aparato(tmp_path, ["STATE.md"])

    gov.cmd_init(_args(ancora=None, sem_ancora=False))

    assert "AVISO" not in capsys.readouterr().out


def test_status_muda_o_estado_de_um_no_existente(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    capsys.readouterr()

    _status(gov, "O1", "concluida")

    conn = gov.conectar()
    assert conn.execute("SELECT status FROM nos WHERE chave='O1'").fetchone()[0] == "concluida"
    conn.close()


def test_status_registra_a_transicao_como_evento(tmp_path, monkeypatch, capsys):
    """O no guarda so o estado final; quem audita depois precisa saber
    quando a onda passou a concluida."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    _status(gov, "O1", "concluida")
    capsys.readouterr()

    conn = gov.conectar()
    eventos = [
        json.loads(d)["texto"]
        for (d,) in conn.execute("SELECT dados FROM nos WHERE tipo='EVENTO'")
    ]
    conn.close()
    assert any("vigente -> concluida" in e and "O1" in e for e in eventos)


def test_status_recusa_estado_fora_da_lista(tmp_path, monkeypatch, capsys):
    """Um typo ('concluído') desligaria em silencio a checagem carro-chefe,
    que compara status por igualdade exata."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})

    try:
        _status(gov, "O1", "concluído")
        assert False, "deveria ter recusado o status invalido"
    except SystemExit as e:
        assert "invalido" in str(e.code)

    conn = gov.conectar()
    assert conn.execute("SELECT status FROM nos WHERE chave='O1'").fetchone()[0] == "vigente"
    conn.close()


def test_add_tambem_recusa_estado_fora_da_lista(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    try:
        add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"}, status="pronta")
        assert False, "deveria ter recusado o status invalido"
    except SystemExit as e:
        assert "invalido" in str(e.code)


def test_status_em_no_inexistente_falha_em_vez_de_silenciar(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    try:
        _status(gov, "NAO-EXISTE", "concluida")
        assert False, "deveria ter falhado"
    except SystemExit as e:
        assert "NAO-EXISTE" in str(e.code)


def test_status_com_chave_ambigua_exige_tipo(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "X", {"objetivo": "o", "criterio_aceite": "c"})
    add(gov, "RSK", "X", {"risco": "r", "gatilho": "g", "resposta": "x"})

    try:
        _status(gov, "X", "concluida")
        assert False, "deveria ter recusado a chave ambigua"
    except SystemExit as e:
        assert "ambigua" in str(e.code)

    _status(gov, "X", "concluida", tipo="ONDA")
    conn = gov.conectar()
    estados = dict(conn.execute("SELECT tipo, status FROM nos WHERE chave='X'"))
    conn.close()
    assert estados == {"ONDA": "concluida", "RSK": "vigente"}


def test_status_repetido_nao_gera_evento_duplicado(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    _status(gov, "O1", "concluida")
    _status(gov, "O1", "concluida")
    capsys.readouterr()

    conn = gov.conectar()
    total = conn.execute("SELECT COUNT(*) FROM nos WHERE tipo='EVENTO'").fetchone()[0]
    conn.close()
    assert total == 1


def test_carro_chefe_dispara_pelo_ciclo_real_de_vida_da_onda(tmp_path, monkeypatch, capsys):
    """O teste que faltava: a onda nasce 'vigente' (como em qualquer projeto
    real) e so depois e concluida. Antes do comando `status` este caminho era
    impossivel, e a checagem carro-chefe nunca podia disparar de verdade."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "RSK", "RSK-01", {"risco": "r", "gatilho": "g", "resposta": "x"})
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    gov.cmd_aresta(_args(de="RSK-01", relacao="bloqueia", para="O1", origem="declarado", confianca=None))
    capsys.readouterr()

    gov.cmd_checar(_args())  # ainda vigente: nada a reclamar
    assert "OK" in capsys.readouterr().out

    _status(gov, "O1", "concluida")
    # G1 (2026-08-02): concluir tambem exige evidencia; ela entra aqui para o
    # teste continuar isolando a checagem carro-chefe (RSK vigente).
    add(gov, "FATO", "COMMIT-1", {"texto": "commit 1: suite verde"})
    gov.cmd_aresta(_args(de="O1", relacao="evidencia", para="COMMIT-1",
                         origem="declarado", confianca=None))
    capsys.readouterr()
    try:
        gov.cmd_checar(_args())
        assert False, "deveria ter falhado: onda concluida com risco bloqueante vigente"
    except SystemExit as e:
        assert e.code == 1
    assert "O1" in capsys.readouterr().out

    # e resolver o risco limpa a contradicao, sem tocar na onda
    _status(gov, "RSK-01", "resolvido")
    capsys.readouterr()
    gov.cmd_checar(_args())
    assert "OK" in capsys.readouterr().out


def test_pulso_conta_ondas_concluidas_depois_da_transicao(tmp_path, monkeypatch, capsys):
    """O contador do `pulso` ('Ondas X/Y concluidas') so saia de 0/Y se a
    onda ja tivesse nascido concluida."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "o", "criterio_aceite": "c"})
    add(gov, "ONDA", "O2", {"objetivo": "o", "criterio_aceite": "c"})
    capsys.readouterr()

    gov.cmd_pulso(_args())
    assert "0/2" in capsys.readouterr().out

    _status(gov, "O1", "concluida")
    capsys.readouterr()
    gov.cmd_pulso(_args())
    assert "1/2" in capsys.readouterr().out


# --- a fixture de medicao e um artefato executavel, nao um arquivo parado ----


REFERENCIA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _rodar_script(nome, tmp_path):
    """Roda um script da referencia com o banco redirecionado para tmp_path.
    cwd fica na propria referencia porque `popular_grafo.py` chama `gov.py`
    por caminho relativo - e assim que um usuario o roda."""
    env = {
        **os.environ,
        "GOV_DB_PATH": str(tmp_path / "grafo.db"),
        "GOV_EXPORT_PATH": str(tmp_path / "grafo.jsonl"),
        "GOV_RELATORIOS": str(tmp_path / "relatorios"),
        "PYTHONIOENCODING": "utf-8",
    }
    return subprocess.run(
        [sys.executable, nome], cwd=REFERENCIA, env=env,
        capture_output=True, encoding="utf-8",
    )


@pytest.fixture(scope="module")
def grafo_fixture(tmp_path_factory):
    """Popula a fixture UMA vez para os quatro testes abaixo. Cada chamada a
    `popular_grafo.py` dispara ~40 subprocessos de `gov.py`; repetir isso por
    teste levou a suite de 10s para 57s. O mesmo criterio que o projeto aplica
    ao painel do Ollama vale aqui: instrumentacao nao pode custar caro."""
    destino = tmp_path_factory.mktemp("fixture_medicao")
    r = _rodar_script("popular_grafo.py", destino)
    return destino, r


def test_popular_grafo_roda_de_ponta_a_ponta(grafo_fixture):
    """Regressao de 2026-08-01: fechar STATUS_VALIDOS numa lista sem
    'confirmada' quebrou `popular_grafo.py`, que usa esse status em 3 SUP.
    Ninguem viu porque a fixture nao tinha teste e um grafo.db antigo no
    disco mascarava a falha - so quando alguem apagasse o banco e tentasse
    regerar e que a medicao inteira apareceria irreproduzivel. A fixture
    e a base de TODO numero da §6 do contrato: se ela nao roda, nenhum
    numero do projeto e reproduzivel."""
    _, r = grafo_fixture

    assert r.returncode == 0, f"popular_grafo.py falhou:\n{r.stdout}{r.stderr}"
    assert "36 nos" in r.stdout


def test_popular_grafo_produz_exatamente_36_nos_e_5_arestas(grafo_fixture):
    """O numero citado no contrato ('36 fatos') e um fato verificavel."""
    destino, _ = grafo_fixture

    conn = sqlite3.connect(destino / "grafo.db")
    nos = conn.execute("SELECT COUNT(*) FROM nos").fetchone()[0]
    arestas = conn.execute("SELECT COUNT(*) FROM arestas").fetchone()[0]
    por_tipo = dict(conn.execute("SELECT tipo, COUNT(*) FROM nos GROUP BY tipo"))
    conn.close()

    assert (nos, arestas) == (36, 5)
    assert por_tipo == {"MANDATO": 1, "ONDA": 5, "SUP": 9, "PNF": 5, "ADR": 8, "RSK": 8}


def test_todo_status_da_fixture_esta_no_vocabulario_fechado(grafo_fixture):
    """A causa raiz em uma assercao: nenhum status gravado pela fixture pode
    estar fora de STATUS_VALIDOS. Pega a proxima vez que alguem fechar o
    vocabulario sem olhar quem o usa."""
    import gov
    destino, _ = grafo_fixture

    conn = sqlite3.connect(destino / "grafo.db")
    usados = {r[0] for r in conn.execute("SELECT DISTINCT status FROM nos")}
    conn.close()

    assert usados <= gov.STATUS_VALIDOS, f"fora do vocabulario: {usados - gov.STATUS_VALIDOS}"


def test_medir_economia_sobrevive_a_checar_reprovando(grafo_fixture):
    """A fixture reproduz o estado real do token-agent-logger: [REDIGIDO] ondas
    concluidas com riscos que as bloqueiam ainda vigentes - ou seja, ela
    DISPARA a checagem carro-chefe de proposito, e `checar` sai 1 por
    contrato. O reprodutor usava check=True e quebrava justamente quando a
    checagem fazia o seu trabalho."""
    destino, _ = grafo_fixture

    r = _rodar_script("medir_economia.py", destino)

    assert r.returncode == 0, f"medir_economia.py falhou:\n{r.stdout}{r.stderr}"
    # B2: o stdout e 1 linha de veredito + caminho; o relatorio completo vive
    # no disco. O teste confere OS DOIS lados - o veredito viajou e o texto
    # integral nao se perdeu.
    # Assercao AGNOSTICA A REGUA de proposito: com a regua real o D2 recusa
    # o percentual e a linha diz "boot N tk (pct RECUSADO...)"; com o proxy
    # diz "boot realista N%". Prender o texto do percentual foi o que fez
    # este teste falhar 2/2 no dia em que a credencial apareceu.
    assert "medicao:" in r.stdout and "boot" in r.stdout
    relatorio_txt = (destino / "relatorios" /
                     "medir_economia.txt").read_text(encoding="utf-8")
    assert "ESCRITA DE GOVERNANCA" in relatorio_txt and "BOOT" in relatorio_txt


def test_medir_economia_mede_o_grafo_apontado_e_nao_o_do_cwd(grafo_fixture):
    """O teste que faltava - e que o de cima NAO consegue fazer.

    Ate 2026-08-02 `medir_economia.py` ignorava `GOV_DB_PATH` e
    `GOV_EXPORT_PATH`, lendo `.governanca/` do diretorio corrente. Na
    referencia esses arquivos EXISTEM, entao a medicao rodava sobre o grafo
    vivo e o teste acima passava sem nunca ter lido a fixture - verde pelo
    motivo errado. So apareceu ao rodar de um piloto, cuja pasta de kit nao
    tem grafo nenhum, como `unable to open database file`.
    LIC-2026-08-01-01: arquivo que ja estava no disco disfarca um gerador
    quebrado por tempo indefinido.

    O discriminador e o CONTEUDO, nao o exit code: a fixture tem 36 nos e 5
    arestas, numeros que o grafo vivo de nenhum projeto reproduz por acaso.
    Funciona igual na referencia (onde ha grafo no cwd para mascarar) e num
    piloto (onde nao ha) - o teste anterior so funcionava na referencia."""
    destino, populado = grafo_fixture
    assert "36 nos" in populado.stdout, "a fixture mudou; atualize o numero abaixo"

    r = _rodar_script("medir_economia.py", destino)

    assert r.returncode == 0, f"medir_economia.py falhou:\n{r.stdout}{r.stderr}"
    relatorio = (destino / "relatorios" / "medir_economia.txt").read_text(
        encoding="utf-8")
    assert "Nos no grafo: 36 | Arestas: 5" in relatorio, (
        "mediu outro grafo que nao o apontado por GOV_DB_PATH - provavelmente "
        f"o do diretorio corrente:\n{relatorio[:400]}")


def test_medir_economia_nao_escreve_na_arvore_de_trabalho(grafo_fixture):
    """O terceiro acoplamento com o cwd, e o mais caro: ate 2026-08-02 o
    resumo ia para `resultado_medicao.json` do diretorio corrente. Como a
    suite roda com cwd na referencia, RODAR OS TESTES sobrescrevia o artefato
    VERSIONADO com os numeros da fixture - o arquivo publicado passava a
    descrever um grafo sintetico de 36 nos, e so o `git status` denunciava."""
    destino, _ = grafo_fixture
    no_cwd = os.path.join(REFERENCIA, "resultado_medicao.json")
    # Nem toda copia do kit tem o artefato da referencia; a propriedade e a
    # mesma nos dois casos - o script nao pode TOCAR no arquivo do cwd, exista
    # ele ou nao. (Ler o conteudo so quando existe mantem o teste portavel.)
    existia = os.path.exists(no_cwd)
    antes = open(no_cwd, encoding="utf-8").read() if existia else None

    _rodar_script("medir_economia.py", destino)

    if existia:
        assert open(no_cwd, encoding="utf-8").read() == antes, \
            "a suite alterou um arquivo versionado da referencia"
    else:
        assert not os.path.exists(no_cwd), \
            "a suite criou um arquivo na pasta do kit"
    assert os.path.exists(destino / "relatorios" / "resultado_medicao.json"), \
        "o resumo tem de ir para GOV_RELATORIOS, nao sumir"


# --- sanitizacao: travessia de path vs notacao de intervalo -----------------


@pytest.mark.parametrize("texto", [
    "PED-01..09",                              # o falso positivo reportado
    "ondas PED-01..09 em src/teach_note/",     # intervalo + caminho citado longe
    "linhas 10..20 do arquivo utils/gov.py",
    "a..z",
    "v1..v6 em legado/",
])
def test_sanitizar_aceita_notacao_de_intervalo(texto):
    """A checagem antiga olhava '..' e separador em QUALQUER posicao do texto,
    entao qualquer frase que citasse um intervalo E um caminho era recusada."""
    import gov
    assert gov.sanitizar_dados({"campo": texto}) == {"campo": texto}


@pytest.mark.parametrize("texto", [
    "../etc/passwd",
    r"..\windows\system32",
    "src/../segredo",
    "a/../../b",
    "foo/..",
    "..",          # o campo inteiro: era ACEITO pela checagem antiga
    "  ..  ",
])
def test_sanitizar_recusa_travessia_de_path(texto):
    """`..` colado a separador, ou como campo inteiro. O caso '..' puro e o
    mais importante: e o token de travessia de verdade, e passava antes."""
    import gov
    with pytest.raises(SystemExit):
        gov.sanitizar_dados({"campo": texto})


# --- cap de grau: a resposta a topologia em estrela -------------------------


def _estrela(gov, n_ondas=10):
    """Replica a topologia do 1o piloto: um MANDATO pai_de N ondas e um risco
    que bloqueia quase todas. Tudo fica a 2 saltos de tudo pelo hub."""
    add(gov, "MANDATO", "M1", {"ni": "app", "ns": "sem retrabalho", "criterios": "ok"})
    add(gov, "RSK", "RSK-02", {"risco": "regra do projeto alvo exige roteiro manual",
                               "gatilho": "onda pronta sem evidencia", "resposta": "usuario executa"})
    for i in range(1, n_ondas + 1):
        add(gov, "ONDA", f"PED-{i:02d}", {"objetivo": f"pedido {i} com escopo proprio",
                                          "criterio_aceite": f"teste do pedido {i} verde"})
        gov.cmd_aresta(_args(de="M1", relacao="pai_de", para=f"PED-{i:02d}",
                             origem="declarado", confianca=None))
        if i > 1:
            gov.cmd_aresta(_args(de="RSK-02", relacao="bloqueia", para=f"PED-{i:02d}",
                                 origem="declarado", confianca=None))


def test_cap_de_grau_nao_atravessa_o_hub(tmp_path, monkeypatch, capsys):
    """O achado do 1o piloto: com um MANDATO `pai_de` 10 ONDAs, atravessar o
    hub poe as 10 ondas a 2 saltos umas das outras e o briefing engole o
    grafo. Focando numa folha, as ondas irmas NAO podem entrar."""
    gov = carregar_gov(tmp_path, monkeypatch)
    _estrela(gov)
    capsys.readouterr()

    gov.cmd_briefing(_args(no="PED-10", profundidade=2, arquivo=None))
    saida = capsys.readouterr().out

    assert "PED-10" in saida          # o foco esta la
    assert "M1" in saida              # o hub entra como contexto...
    assert "PED-05" not in saida      # ...mas nao serve de ponte para as irmas
    assert "PED-02" not in saida


def test_cap_de_grau_declara_o_hub_que_nao_atravessou(tmp_path, monkeypatch, capsys):
    """Podar em silencio produz veredito falso: quem le a fatia precisa saber
    que ha algo atras do hub, e como abrir."""
    gov = carregar_gov(tmp_path, monkeypatch)
    _estrela(gov)
    capsys.readouterr()

    gov.cmd_briefing(_args(no="PED-10", profundidade=2, arquivo=None))
    saida = capsys.readouterr().out

    assert "[PODADO]" in saida
    assert "NÃO atravessados" in saida
    assert "gov.py briefing --no" in saida   # dica de recuperacao


def test_cap_de_grau_desligado_engole_o_grafo(tmp_path, monkeypatch, capsys):
    """Prova de que o cap e o que faz a diferenca - sem ele, as irmas entram.
    Medido fora do teste: -2,4% sem cap contra 59,8% com cap, no mesmo grafo."""
    gov = carregar_gov(tmp_path, monkeypatch)
    _estrela(gov)
    capsys.readouterr()

    gov.cmd_briefing(_args(no="PED-10", profundidade=2, arquivo=None,
                           cap_grau=999, orcamento=999999))
    saida = capsys.readouterr().out

    assert "PED-05" in saida   # sem cap, o hub vira ponte e as irmas entram


def test_orcamento_global_corta_o_mais_distante_do_foco(tmp_path, monkeypatch, capsys):
    """Os caps por tipo nao bastam: um grafo denso passa em todos eles e ainda
    entrega payload enorme. O corte global e por distancia, e o foco entra
    sempre - briefing sem o proprio assunto nao e briefing."""
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "o foco", "criterio_aceite": "c"})
    for i in range(6):
        add(gov, "ADR", f"ADR-{i:02d}", {"decisao": "d" * 300, "motivo": "m" * 300})
        gov.cmd_aresta(_args(de=f"ADR-{i:02d}", relacao="depende_de", para="O1",
                             origem="declarado", confianca=None))
    capsys.readouterr()

    gov.cmd_briefing(_args(no="O1", profundidade=1, arquivo=None, orcamento=400))
    saida = capsys.readouterr().out

    assert "O1" in saida                    # o foco sobrevive ao orcamento
    assert "[PODADO]" in saida
    assert "Orçamento global: 400" in saida  # e diz qual era o teto


def test_orcamento_global_folgado_nao_corta_nada(tmp_path, monkeypatch, capsys):
    gov = carregar_gov(tmp_path, monkeypatch)
    _projeto_com_vizinhanca(gov)
    capsys.readouterr()

    gov.cmd_briefing(_args(no="O1", profundidade=2, arquivo=None, orcamento=999999))
    assert "Omitidos por orçamento" not in capsys.readouterr().out


# --- a regua: uma fonte viva, e sempre declarada ----------------------------


def test_medidor_declara_qual_regua_usou():
    """Um numero sem a regua que o produziu nao e citavel. O medidor sempre
    devolve a nota junto - nunca degrada para o proxy em silencio."""
    import medidor
    conta, regua, e_real = medidor.escolher_medidor()

    assert callable(conta) and conta("teste") > 0
    assert regua                                   # nunca vazia
    # A nota tem de bater com a flag. Nao basta procurar "count_tokens": a
    # nota do proxy tambem o cita, em "count_tokens indisponivel".
    assert ("PROXY" in regua) != e_real
    if e_real:
        assert "MEDIDOR CORRETO" in regua


def test_medidor_avisa_quando_a_regua_e_proxy():
    """Com proxy, valores absolutos nao sao citaveis - e isso tem de estar
    escrito, nao subentendido."""
    import medidor
    assert "ABSOLUTOS" in medidor.aviso_de_regua(False)
    assert medidor.aviso_de_regua(True) == ""      # regua correta: nada a ressalvar


def test_medidor_forcar_proxy_nunca_devolve_e_real():
    import medidor
    _, regua, e_real = medidor.escolher_medidor(forcar_proxy=True)
    assert e_real is False and "tiktoken" in regua


# --- PEND: pendencias em aberto (solicitacoes do usuario, erros a corrigir) ---


def test_pend_campos_obrigatorios(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    with pytest.raises(SystemExit) as exc:
        gov.cmd_add(_args(tipo="PEND", chave="PEND_TEST", campo=["origem=usuario"], status=None))
    assert "campos obrigatorios ausentes" in str(exc.value)


def test_pend_bloqueia_onda_vigente_e_resolve(tmp_path, monkeypatch):
    gov = carregar_gov(tmp_path, monkeypatch)
    add(gov, "ONDA", "O1", {"objetivo": "Obj", "criterio_aceite": "Crit"})
    add(gov, "PEND", "PEND_1", {"pendencia": "Corrigir bug X", "origem": "usuario"})
    gov.cmd_aresta(_args(de="PEND_1", relacao="bloqueia", para="O1", origem="declarado", confianca=None))

    # Concluir O1 com PEND_1 vigente deve falhar no checar
    gov.cmd_status(_args(tipo=None, chave="O1", para="concluida"))
    with pytest.raises(SystemExit) as exc:
        gov.cmd_checar(_args())
    assert "PEND 'PEND_1' que a bloqueia segue vigente" in str(exc.value)

    # Resolvendo PEND_1 e adicionando evidencia, O1 concluida passa
    gov.cmd_status(_args(tipo=None, chave="PEND_1", para="resolvido"))
    add(gov, "FATO", "F1", {"texto": "Commit fix"})
    gov.cmd_aresta(_args(de="O1", relacao="evidencia", para="F1", origem="declarado", confianca=None))
    # Nao deve levantar SystemExit
    gov.cmd_checar(_args())
