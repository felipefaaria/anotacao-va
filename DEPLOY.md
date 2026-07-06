# Publicação — GitHub Pages + Google Sheets

Passo a passo para pôr o ambiente de anotação no ar. O link é só para os seus
anotadores (estudo fechado); o `robots.txt` já impede indexação por buscadores.

---

## Parte 1 — Back-end (planilha + Apps Script)

1. Crie uma planilha nova no **Google Sheets**.
2. Crie uma aba chamada **`participantes`** com o cabeçalho `pid | modalidade` e cole
   a sua lista (o conteúdo de `data/participants.csv`). **Esta aba é PRIVADA** — é a
   lista de senhas; não compartilhe.
3. **Extensões › Apps Script**. Apague o conteúdo e cole `tools/apps_script.gs`.
4. **Implantar › Nova implantação › App da Web**:
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
   - Autorize o acesso quando pedir.
5. Copie a **URL do app da web** (termina em `/exec`).
6. Teste no navegador (troque a senha por uma real da sua lista):
   `SUA_URL/exec?action=auth&pid=SUASENHA` → deve responder `{"ok":true,"modalidade":"..."}`.

## Parte 2 — Senhas (recomendado)

Para produção, use senhas **aleatórias** (não `P01/P02`):
```bash
Remove-Item data\participants.csv, data\participants.json   # limpa exemplo
python scripts/assign_participants.py --n 30 --random        # ou --pids lista.txt
```
Depois cole o novo `data/participants.csv` na aba `participantes` da planilha.

## Parte 3 — Site (GitHub Pages) — tutorial completo

> ⚠️ **Antes de tudo (segurança):** NUNCA suba `data/participants.json`,
> `data/participants.csv`, a pasta `Dataset/` (áudio bruto, pesado) nem `venv/`.
> O `.gitignore` já cuida disso **se você usar o Git** (Desktop ou linha de comando).
> **Não** suba a pasta pelo "upload de arquivos" do site do GitHub (arrastar-e-soltar
> IGNORA o `.gitignore` e mandaria as senhas junto).

### 3.0 — Ajuste obrigatório antes de subir
Em `tools/anotacao.html`, troque:
```js
appsScriptUrl: "/api"
```
pela sua URL do passo 1.5:
```js
appsScriptUrl: "https://script.google.com/macros/s/SEU_ID/exec"
```

### 3.1 — Criar a conta e o repositório
1. Se não tiver, crie conta em **https://github.com** (grátis).
2. Clique no **+** (canto superior direito) › **New repository**.
3. **Repository name**: ex. `anotacao-va` (sem espaços/acentos).
4. Deixe **Public** (o Pages gratuito exige repositório público).
5. **NÃO** marque "Add a README". Clique **Create repository**.
6. Anote o endereço: `https://github.com/SEU_USUARIO/anotacao-va`.

### 3.2 — Subir o projeto — Opção A (fácil): GitHub Desktop
1. Baixe e instale o **GitHub Desktop**: https://desktop.github.com — faça login.
2. **File › Add local repository** › escolha a pasta do projeto (`...\Área de Trabalho\Tcc`).
   Se disser que não é um repositório Git, clique em **"create a repository"** (ele inicializa).
3. Na lista de arquivos à esquerda (Changes), **confira que NÃO aparecem**:
   `data/participants.json`, `data/participants.csv`, `Dataset/`, `venv/`.
   (Se aparecerem, pare — o `.gitignore` não está pegando; me chame.)
4. Embaixo, escreva um resumo (ex.: `Ambiente de anotação VA`) › **Commit to main**.
5. No topo, **Publish repository** › desmarque "Keep this code private" › **Publish**.

### 3.2 — Subir o projeto — Opção B: linha de comando (PowerShell)
Precisa do Git instalado (https://git-scm.com/download/win). Na pasta do projeto:
```powershell
git init
git add .
git status                       # CONFIRA: participants.json / Dataset / venv NÃO listados
git commit -m "Ambiente de anotação VA"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/anotacao-va.git
git push -u origin main
```

### 3.3 — Checagem de segurança (faça sempre)
No site do repositório, ou por comando, confirme que a senha NÃO subiu:
```powershell
git ls-files | Select-String "participants"    # não deve retornar NADA
```
Se aparecer `data/participants.json`, remova-o do repositório antes de continuar:
```powershell
git rm --cached data/participants.json data/participants.csv
git commit -m "remove lista de senhas"; git push
```

### 3.4 — Ligar o GitHub Pages
1. No repositório: **Settings** (aba do topo) › **Pages** (menu à esquerda).
2. Em **Build and deployment › Source**, escolha **Deploy from a branch**.
3. **Branch**: `main` · pasta **`/ (root)`** › **Save**.
4. Aguarde 1–2 min e recarregue. Vai aparecer:
   `Your site is live at https://SEU_USUARIO.github.io/anotacao-va/`

### 3.5 — Testar o site no ar
Abra (troque pelo seu usuário/repo e uma senha real):
```
https://SEU_USUARIO.github.io/anotacao-va/tools/anotacao.html?pid=Fael&semana=1
```
- Deve entrar como `completa`, tocar o áudio, aceitar a avaliação.
- Responda 1 faixa › recarregue › deve **continuar de onde parou**.
- A resposta deve aparecer na aba **`respostas`** da planilha.

### 3.6 — Atualizar o site depois (quando editar algo)
- **GitHub Desktop:** faz o commit das mudanças › **Push origin**.
- **Linha de comando:** `git add . ; git commit -m "ajuste" ; git push`
- O Pages republica sozinho em ~1 min.

## Parte 4 — Distribuição

Envie a cada anotador **só o link com a senha dele**:
```
https://SEU_USUARIO.github.io/SEU_REPO/tools/anotacao.html?pid=SENHA&semana=1
```
- A cada semana, mude `semana=1` → `2 … 5`.
- Não divulgue o link publicamente.

## Parte 5 — Coletar resultados

1. Na planilha, aba `respostas` › **Arquivo › Fazer download › CSV** → salve como
   `data/respostas.csv`.
2. `python scripts/aggregate_annotations.py` → gera VA por faixa/modalidade,
   dissociação D_V/D_A, Krippendorff e gráficos em `data/results/`.

---

### Checklist rápido
- [ ] Aba `participantes` privada preenchida
- [ ] Apps Script implantado; `?action=auth` responde ok
- [ ] `CONFIG.appsScriptUrl` = URL `/exec` (não mais `/api`)
- [ ] `git ls-files` não mostra `participants*`
- [ ] Pages publicado; link testado com uma senha válida
- [ ] Envio por clique grava na aba `respostas`; recarregar retoma de onde parou

### O que NÃO vai para o Git (via `.gitignore`)
Senhas (`participants.*`), dados coletados (`respostas*`, `eventos_local`),
áudio bruto (`Dataset/`), planilhas de trabalho, `venv/`, temporários.
