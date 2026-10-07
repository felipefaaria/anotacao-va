/**
 * Coletor + autenticador do TESTE DE VALIDACAO (modalidade "completa", escala cat5).
 * Use uma planilha NOVA (nao a do estudo anterior em SAM 1-9) e este script no Apps Script dela.
 *
 * ABAS DA PLANILHA:
 *  - "participantes" (PRIVADA): colunas  pid | bloco   (bloco = A ou B). Cole aqui o conteudo de
 *       data/validacao_participantes.csv (gerado por scripts/build_validacao.py). NAO publique.
 *  - "respostas" -> criada sozinha; uma linha por resposta (inclui ancoras e repeticoes).
 *  - "eventos"   -> criada sozinha; consentimento, demografia e "fim".
 *
 * DEPLOY: Extensoes > Apps Script > cole isto > Implantar > Nova implantacao > App da Web
 *   (Executar como: Eu | Quem acessa: Qualquer pessoa). Cole a URL /exec em CONFIG.appsScriptUrl
 *   de tools/validacao.html. Ao editar depois: Gerenciar implantacoes > Nova versao.
 *
 * Teste pela URL:  /exec?action=debug   |   /exec?action=auth&pid=CODIGO   |   /exec?action=progress&pid=CODIGO
 */

const ABA_PART = "participantes";
const ABA_RESP = "respostas";
const ABA_META = "eventos";

const COLS_RESP = ["enviadoEm","pid","bloco","itemId","item","tipo","ordem",
                   "valencia","arousal","escala","conhece","listenMs",
                   "idade","nativo","familiaridade","musico","respondidoEm"];
const COLS_META = ["recebidoEm","type","pid","bloco","payload"];

function partSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_PART);
  if (sh) return sh;
  const alvo = ABA_PART.toLowerCase();
  return ss.getSheets().filter(s => s.getName().trim().toLowerCase() === alvo)[0] || null;
}

/* mapa codigo(minuscula) -> bloco */
function participantes_() {
  const sh = partSheet_();
  const map = {};
  if (!sh) return map;
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    const pid = String(vals[i][0]).trim();
    const bloco = String(vals[i][1]).trim().toUpperCase();
    if (pid) map[pid.toLowerCase()] = bloco;
  }
  return map;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const pid = String(p.pid || "").trim().toLowerCase();

  if (p.action === "debug") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const map = participantes_();
    return json_({ abas: ss.getSheets().map(s => s.getName()),
                   aba_participantes_encontrada: !!partSheet_(),
                   total_codigos: Object.keys(map).length });
  }
  if (p.action === "auth") {
    const bloco = participantes_()[pid];
    return json_(bloco ? {ok: true, bloco: bloco} : {ok: false});
  }
  if (p.action === "progress") {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_RESP);
    const done = [];
    if (sh) {
      const v = sh.getDataRange().getValues();
      const col = {}; v[0].forEach((c, i) => col[c] = i);
      for (let i = 1; i < v.length; i++) {
        if (String(v[i][col.pid]).trim().toLowerCase() === pid) done.push(String(v[i][col.itemId]));
      }
    }
    return json_({done: Array.from(new Set(done))});
  }
  return json_({ok: true, msg: "coletor de validacao ativo"});
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (data.type === "resposta") {
      appendRow_(ss, ABA_RESP, COLS_RESP, data);
    } else {
      const sheet = getSheet_(ss, ABA_META, COLS_META);
      sheet.appendRow([new Date(), data.type || "", data.pid || "", data.bloco || "", JSON.stringify(data)]);
    }
    return json_({ok: true});
  } catch (err) {
    return json_({ok: false, error: String(err)});
  } finally {
    lock.releaseLock();
  }
}

function appendRow_(ss, nome, cols, data) {
  const sheet = getSheet_(ss, nome, cols);
  sheet.appendRow(cols.map(c => (c in data && data[c] !== undefined && data[c] !== null) ? data[c] : ""));
}
function getSheet_(ss, nome, cols) {
  let sheet = ss.getSheetByName(nome);
  if (!sheet) { sheet = ss.insertSheet(nome); sheet.appendRow(cols); sheet.setFrozenRows(1); }
  return sheet;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
