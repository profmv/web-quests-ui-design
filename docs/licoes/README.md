# Lições do projeto
[Gerido pelo plugin gerador-licoes-projeto]

O que este projeto aprendeu com os próprios erros, para o agente não os repetir. Uma lição por
arquivo `Lnnn-<assunto>.md`; índice em `INDICE.md` (gerado, não edite). Os hooks do plugin
percebem falhas, correções e pedidos do tipo "lembre disso" e pedem ao agente que registre a lição;
lições com `entrada` avisam (ou bloqueiam) antes do comando que já deu errado.

Comandos: `licao buscar "<termos>"`, `licao nova "<título>" --regra "<o que fazer>"`,
`licao pendentes`, `licao verificar`. Sem o plugin: `node scripts/licoes/licoes.mjs <comando>`.
Pode editar uma lição à mão; depois rode `licao verificar` e `licao indice`.

Para devolver esta pasta ao projeto, apague a linha de marcação acima: o plugin para de gravar.
