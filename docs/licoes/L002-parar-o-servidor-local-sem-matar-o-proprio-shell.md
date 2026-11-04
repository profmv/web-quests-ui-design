---
id: "L002"
titulo: "Parar o servidor local sem matar o proprio shell"
estado: "ativa"
categoria: "geral"
tags: []
ferramenta: ""
entrada: "pkill -f .*serve\\.py|pgrep -f 'python3 scripts/server"
erro: ""
bloquear: false
assinaturas: []
ocorrencias: 0
reincidencias: 0
criada: "2026-11-04 00:20"
ultima: "2026-11-04 00:20"
origem: ""
---

# L002 — Parar o servidor local sem matar o proprio shell

## Regra

Para encerrar scripts/server/serve.py use pgrep -f '^python3 scripts/server/serve\.py' (ancorado) e kill no PID; nunca pkill -f com o caminho, pois casa com o proprio comando bash

## Histórico

- 2026-11-04 00:20 · criada
