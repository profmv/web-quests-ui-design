import os

path = r"C:\Repo\antigravity-workspace\scripts\gov.py"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. CAMPOS_OBRIGATORIOS
target1 = '    "LIC": ["sinal", "licao"],\n}'
repl1 = '''    "LIC": ["sinal", "licao"],
    # PEND: pendencias em aberto do projeto (solicitacoes do usuario, erros a corrigir).
    # Obrigatorio: pendencia (descricao da pendencia), origem (usuario | erro | auditoria | licao).
    "PEND": ["pendencia", "origem"],
}'''
if target1 not in text and target1.replace('\n', '\r\n') in text:
    target1 = target1.replace('\n', '\r\n')
    repl1 = repl1.replace('\n', '\r\n')

assert target1 in text, "target1 not found"
text = text.replace(target1, repl1, 1)

# 2. RENDER_DOC
target2 = '    "LIC": "LICOES",\n}'
repl2 = '''    "LIC": "LICOES",
    "PEND": "STATE",
}'''
if target2 not in text and target2.replace('\n', '\r\n') in text:
    target2 = target2.replace('\n', '\r\n')
    repl2 = repl2.replace('\n', '\r\n')

assert target2 in text, "target2 not found"
text = text.replace(target2, repl2, 1)

# 3. CAP_BRIEFING
target3 = '    "PROVA": 5,     # mesmo criterio do EVENTO: despacho antigo e historico\n}'
repl3 = '''    "PROVA": 5,     # mesmo criterio do EVENTO: despacho antigo e historico
    "PEND": 10,    # pendencias vigentes relevantes para briefing
}'''
if target3 not in text and target3.replace('\n', '\r\n') in text:
    target3 = target3.replace('\n', '\r\n')
    repl3 = repl3.replace('\n', '\r\n')

assert target3 in text, "target3 not found"
text = text.replace(target3, repl3, 1)

# 4. cmd_pulso
target4 = """    bloqueios = conn.execute(
        \"\"\"SELECT COUNT(*) FROM arestas a
           JOIN nos r ON r.id = a.de_id
           WHERE a.relacao='bloqueia' AND r.tipo='RSK' AND r.status='vigente'\"\"\"
    ).fetchone()[0]"""
repl4 = """    bloqueios = conn.execute(
        \"\"\"SELECT COUNT(*) FROM arestas a
           JOIN nos r ON r.id = a.de_id
           WHERE a.relacao='bloqueia' AND r.tipo IN ('RSK', 'PEND') AND r.status='vigente'\"\"\"
    ).fetchone()[0]"""
if target4 not in text and target4.replace('\n', '\r\n') in text:
    target4 = target4.replace('\n', '\r\n')
    repl4 = repl4.replace('\n', '\r\n')

assert target4 in text, "target4 not found"
text = text.replace(target4, repl4, 1)

target4_print = 'print(f"Bloqueios ativos (RSK vigente que bloqueia): {bloqueios}")'
repl4_print = 'print(f"Bloqueios ativos (RSK/PEND vigente que bloqueia): {bloqueios}")'
assert target4_print in text, "target4_print not found"
text = text.replace(target4_print, repl4_print, 1)

# 5. cmd_checar
target5 = """    for onda, risco in conn.execute(
        \"\"\"SELECT o.chave, r.chave FROM arestas a
           JOIN nos r ON r.id = a.de_id
           JOIN nos o ON o.id = a.para_id
           WHERE a.relacao='bloqueia' AND r.tipo='RSK' AND r.status='vigente'
             AND o.tipo='ONDA' AND o.status='concluida'\"\"\"
    ):
        falhas.append(f\"ONDA '{onda}' concluida mas RSK '{risco}' que a bloqueia segue vigente\")"""
repl5 = """    for onda, chave, tipo_bloq in conn.execute(
        \"\"\"SELECT o.chave, r.chave, r.tipo FROM arestas a
           JOIN nos r ON r.id = a.de_id
           JOIN nos o ON o.id = a.para_id
           WHERE a.relacao='bloqueia' AND r.tipo IN ('RSK', 'PEND') AND r.status='vigente'
             AND o.tipo='ONDA' AND o.status='concluida'\"\"\"
    ):
        falhas.append(f\"ONDA '{onda}' concluida mas {tipo_bloq} '{chave}' que a bloqueia segue vigente\")"""
if target5 not in text and target5.replace('\n', '\r\n') in text:
    target5 = target5.replace('\n', '\r\n')
    repl5 = repl5.replace('\n', '\r\n')

assert target5 in text, "target5 not found"
text = text.replace(target5, repl5, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("[OK] gov.py updated successfully with PEND support!")
