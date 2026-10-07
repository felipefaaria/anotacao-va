# Ambiente de avaliação (anotação VA) — TCC música brasileira

Pipeline de coleta das anotações de **Valência–Arousal** com desenho
**entre-sujeitos** (cada pessoa fica travada em UMA modalidade nas 5 semanas).

## Desenho

- **3 modalidades** (a pessoa é sorteada para uma e permanece nela):
  `letra` · `melodia` · `completa` (melodia+letra).
- **Estímulo**: excerto de ~30s centrado no refrão.
- **Escala**: 5 categorias ordinais, **pensadas para validar** (não para anotar):
  valência *muito negativa · negativa · neutra · positiva · muito positiva*; arousal
  *muito calma · calma · neutra · agitada · muito agitada* (gravadas como 1..5, com
  `escala=cat5`). A instrução deixa explícito que se julga a emoção **expressa** pela
  música, não a sentida. Conversão para [-1, 1] só na análise (`scripts/scale.py`).
  Coleta antiga em SAM 1–9 continua legível: linhas sem a coluna `escala` valem `sam9`.
- **5 blocos semanais**: ~10–11 faixas por semana, estratificados por quadrante/era.
- **Instrumentais** (`INS01/02/03`, `tem_letra=nao`): só entram para a modalidade
  `melodia`. Quem faz `letra`/`completa` avalia 50 faixas; `melodia` avalia 53.

## Scripts (determinísticos, seed fixo → reprodutível)

| Script | O que faz | Saída |
|---|---|---|
| `scripts/build_blocks.py` | Divide as 53 faixas em 5 semanas estratificadas | `data/weekly_blocks.{csv,json}`, `data/corpus_clean.csv` |
| `scripts/assign_participants.py` | Sorteia participante→modalidade, balanceado e **append-only** | `data/participants.csv` |

```bash
python scripts/build_blocks.py
python scripts/assign_participants.py --n 30          # ou --pids lista.txt
```

> `data/participants.csv` atual contém **dados de EXEMPLO** (P01..P37).
> Apague o arquivo e rode de novo com a sua lista real quando o recrutamento fechar.
> Como é append-only, adicionar gente depois **não muda** quem já foi sorteado.

## Formulário de anotação (`tools/anotacao.html`)

App estático, sem dependências. Isola por modalidade (letra vê só letra; melodia
tem player e não vê letra; completa vê os dois), player com **gate de escuta**,
escala de 5 categorias (cat5), pergunta por modalidade e aviso "emoção expressa, não sentida", exemplos Festa/Fúnebre, **autosave em localStorage** (chave `anot5::`, separada da versão SAM) (recupera ao
recarregar) e **fila de envio** ao Google Sheets (nada se perde).

Link por participante: `.../tools/anotacao.html?pid=P01&semana=1`

### Deploy da coleta (Google Sheets)
1. Crie uma planilha nova → Extensões > Apps Script → cole `tools/apps_script.gs`.
2. Implantar > Nova implantação > "App da Web" (executar como Eu; acesso: Qualquer pessoa).
3. Copie a URL e cole em `CONFIG.appsScriptUrl` no topo de `tools/anotacao.html`.
   - Cada resposta vira uma linha na aba `respostas`; demografia/fim na aba `eventos`.

### Hospedagem (link público)
Publique a pasta (GitHub Pages ou Netlify). Precisam ir juntos:
`tools/anotacao.html`, `data/weekly_blocks.json`, `data/participants.json` e
`stimuli/audio/*.mp3` + `stimuli/lyrics/*.txt`.
Teste local: `python -m http.server 8000` e abra `http://localhost:8000/tools/anotacao.html`
(precisa ser via servidor — `fetch` não funciona abrindo o arquivo direto).

## Corte dos áudios de 30s (estímulos)

Usa o `ffmpeg` embutido (`pip install imageio-ffmpeg rapidfuzz` — já feito).
O áudio bruto fica em `Dataset/` (85 mp3, cobre só ~18–29 das 53 faixas).

```bash
python scripts/match_audio.py          # cruza corpus x Dataset -> data/excerpt_plan.csv
#  -> edite data/excerpt_plan.csv: confirme a coluna 'arquivo' (use cand1..3) e
#     preencha 'start' (mm:ss do refrão). data/dataset_files.txt lista os 85 nomes.
python scripts/cut_excerpts.py         # corta -> stimuli/audio/<id>.mp3 (loudnorm + fade)
python scripts/cut_excerpts.py --only BOS01 --overwrite   # refazer uma
```

Cada excerto sai com **volume normalizado** (I=-16 LUFS — volume afeta arousal) e
fade in/out. Testado: gera mp3 de 30,0s.

### Download automático das faixas faltantes
As faixas ausentes do `Dataset/` são baixadas do YouTube (busca por título+artista):

```bash
python scripts/download_audio.py             # baixa todas sem 'arquivo' no plano
python scripts/download_audio.py --only POP01 # uma só
```
Baixa o melhor áudio (webm/m4a, sem conversão), nomeia com o `id`, e **preenche o
`arquivo` no plano** automaticamente. **Estado atual: as 53 faixas já têm áudio**
(18 do Dataset + 35 baixadas).

> ⚠️ O YouTube retorna o 1º resultado — **ouça antes de cortar**. Alguns vieram em
> versão "Ao Vivo" (ex.: MPB06 Oceano) que pode não ser a intenção.

### Proposta automática do refrão (`suggest_chorus.py`)
Preenche a coluna `start` do plano com um chute (energia + recorrência via
pseudo-chroma em numpy; só ffmpeg embutido, sem libs frágeis):

```bash
python scripts/suggest_chorus.py                 # preenche os 'start' vazios
python scripts/suggest_chorus.py --overwrite     # refaz todos
python scripts/suggest_chorus.py --only MPB01 --overwrite
```
É **chute para revisar** — o refrão final às vezes é o mais forte, então a proposta
pode cair perto do fim (ainda é um refrão válido). Ajuste ouvindo.

**Estado atual: os 53 excertos já foram gerados** em `stimuli/audio/*.mp3` (30s cada).

### Instrumental para a modalidade `melodia` (`separate_vocals.py`)
A modalidade `melodia` NÃO pode ter vocais (o canto entrega a letra). Geramos a
versão instrumental removendo os vocais com **Demucs** (htdemucs):

```bash
python scripts/separate_vocals.py            # stimuli/audio/*.mp3 -> stimuli/audio_melodia/*.mp3
python scripts/separate_vocals.py --only POP01 --overwrite
```
Contorna o I/O do torchaudio/torchcodec (decodifica/reencoda com o ffmpeg embutido;
usa só o núcleo do Demucs). ~10s por faixa na CPU. O formulário serve automaticamente:
`melodia` → `stimuli/audio_melodia/`; `completa` → `stimuli/audio/` (mix completo).

## Letras (estímulo da modalidade `letra`) — `fetch_lyrics.py`
Busca as letras reais de uma base aberta (LRCLIB, com fallback lyrics.ovh) e grava
em `stimuli/lyrics/<id>.txt`. Instrumentais recebem um marcador.

```bash
python scripts/fetch_lyrics.py               # busca as que ainda são placeholder
python scripts/fetch_lyrics.py --only MPB01 --overwrite
```
**Estado: 50/50 letras baixadas + 3 instrumentais marcados.** As letras são material
protegido — uso acadêmico interno da anotação; não redistribua os `.txt`.

### Letra casada com o trecho — `lyrics_excerpt.py`
A modalidade `letra` julga o MESMO pedaço da música que o áudio (comparabilidade do
D_V/D_A). Extrai as linhas cantadas em `[start, start+30s]` da letra sincronizada
(estende para trás se ficar curto) → `stimuli/lyrics_excerpt/<id>.txt`.

```bash
python scripts/lyrics_excerpt.py            # todas
python scripts/lyrics_excerpt.py --ids POP01,FNK01
```
O formulário usa a letra-do-trecho e **cai automaticamente na letra inteira**
(`stimuli/lyrics/`) quando o trecho falta (sem letra sincronizada ou versão diferente).

**Decisão metodológica (registrada em `data/letra_nivel.csv`):**
- **41 faixas** → `letra` = **nível-trecho** (casada com os 30s de áudio).
- **9 faixas** (`BOS01, BOS04, SAM04, MPB02, MPB03, ROC01, ROC05, MPB08, ARR01`) →
  `letra` = **nível-música** (letra inteira), pois a versão de áudio não alinha com a
  letra sincronizada. Para essas, a `letra` é julgada no nível da canção enquanto o
  áudio é o trecho — declarar isso na análise e tratar como covariável/ressalva do D.
- **3 instrumentais** → sem letra.

## Back-end: autorização + envio por clique + retomar

O formulário valida a senha, **envia cada resposta ao clicar "Próxima"** (nada se
perde se a pessoa parar no meio) e **retoma de onde parou** (pergunta ao back-end
quais faixas já foram avaliadas — funciona até em outro dispositivo).

`CONFIG.appsScriptUrl` no `anotacao.html` define o back-end:
- `"/api"` → teste local com `mock_backend.py`
- URL do Web App → produção (Apps Script)
- `""` → modo offline (usa `participants.json`, sem envio)

### Testar localmente (antes de publicar)
```bash
python scripts/mock_backend.py        # serve site + API em http://127.0.0.1:8777
# abra: http://127.0.0.1:8777/tools/anotacao.html?pid=P01&semana=1
```
- Senha errada → "Senha não autorizada". Senha válida → entra na sua modalidade.
- Cada "Próxima" grava em `data/respostas_local.csv`. Recarregar → continua de onde parou.
- Endpoints: `GET /api?action=auth&pid=` · `GET /api?action=progress&pid=&semana=` · `POST /api`.

### Produção (Apps Script) — `tools/apps_script.gs`
Espelha o mock. A lista de senhas vira uma aba **privada** `participantes` (pid | modalidade).
**Segurança:** use senhas NÃO óbvias (aleatórias), não `P01/P02` — como a lista fica
privada no Sheets e a validação é no servidor, ninguém vê as senhas dos outros, mas
senhas adivinháveis ainda seriam um risco. A lista pública `participants.json` só é
usada no modo offline; **não publique** ela junto com o site em produção.

## Resultados — `aggregate_annotations.py`

"O resultado de todos os formulários". Lê o CSV com as respostas (as colunas que o
Apps Script grava) e produz em `data/results/`:
- `va_por_faixa_modalidade.csv` — VA médio por faixa × modalidade (IC 95%)
- `dissociacao.csv` — **D_V = V_letra − V_melodia** e **D_A** por faixa (o coração da hipótese)
- `concordancia.csv` — Krippendorff α por modalidade × dimensão
- `quadrantes.csv` — quadrante estimado × prior + F1 macro
- `plano_va.png`, `dissociacao.png`, `concordancia.png`

`scale.py` é a fonte única da conversão (cat5 e SAM 1–9) → [−1,1] (só na análise). A concordância usa Krippendorff **ordinal** para `cat5` e intervalar para `sam9`.

```bash
# com dados reais: baixe a aba 'respostas' (Arquivo > Download > CSV) para data/respostas.csv
python scripts/aggregate_annotations.py

# para ver a saída ANTES da coleta, com dados fictícios:
python scripts/simulate_annotations.py            # padrão cat5 (--escala sam9 para a antiga)
python scripts/aggregate_annotations.py --input data/respostas_simuladas.csv
```

## Ainda por fazer (conferências humanas)

1. **Ouvir os excertos** (`stimuli/audio/` e `stimuli/audio_melodia/`): versão certa?
   refrão no trecho? instrumental sem voz vazando? Corrija no plano e re-rode
   `cut_excerpts.py` / `separate_vocals.py --only <id> --overwrite`.
2. **Coletar** (recrutar, publicar o link, plugar o Apps Script) e então rodar o agregador.

## Teste de validação humana (só "música completa") — `tools/validacao.html`

Teste confirmatório do caminho 1: nas faixas em que o quadrante do áudio sozinho difere do da
fusão (LF1+LF3), quem concorda mais com a avaliação humana da música completa? A seleção das
faixas vem do projeto principal (`tcc_mer/data/outputs/validacao_selecao.csv`, protocolo em
`validacao_protocolo.json`). Este formulário é **isolado** do estudo anterior (SAM 1–9).

- 1 modalidade (completa, áudio original com voz = o MESMO arquivo de prévia que o modelo analisou,
  normalizado a -16 LUFS com fade de 0,2 s), escala `cat5`, pergunta "emoção expressa, não sentida".
- Cada pessoa recebe um bloco (A ou B, 25 faixas balanceadas) + 4 âncoras + 3 repetições (consistência
  intra-avaliador, ≥ 8 itens depois do original) = 32 itens, ~20 min, em ordem embaralhada por código.
- Itens com **códigos opacos** (V01.., A1..): o avaliador não vê ano/título/grupo. O mapa
  código→faixa fica em `data/validacao_mapa_itens.csv` (PRIVADO).
- Pergunta "você já conhecia a música?" (não / já ouvi / conheço bem) por item, como covariável.
- Sem tela de consentimento (envio só a pessoas específicas); exige 18+ e falante nativo de pt-BR.
- A avaliação libera após **10 s de reprodução** do áudio (tempo real tocando; o ideal é ouvir até o fim).

```bash
python scripts/build_validacao.py --participantes 12     # blocos, códigos, áudios, senhas
python scripts/mock_backend_validacao.py                 # teste local (copie validacao.html com appsScriptUrl="/api")
```
Produção: planilha NOVA + `tools/apps_script_validacao.gs` (aba `participantes` com
`data/validacao_participantes.csv`), colar a URL em `CONFIG.appsScriptUrl` de `tools/validacao.html`.
**Não publicar:** `validacao_mapa_itens.csv`, `validacao_participantes.*` e `validacao_respostas_local.csv`.
Publicar: `tools/validacao.html`, `data/validacao_blocos.json`, `stimuli_validacao/`.
