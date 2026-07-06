/**
 * Coletor + autenticador de anotações VA (Google Sheets).
 * Espelha o mock_backend.py testado localmente.
 *
 * ABAS DA PLANILHA:
 *  - "participantes" (PRIVADA — a lista de senhas): colunas  pid | modalidade
 *       (a ABA precisa se chamar "participantes"; renomeie a "Página1" se for o caso)
 *  - "respostas"  -> criada sozinha; uma linha por resposta.
 *  - "eventos"    -> criada sozinha; demografia e "fim".
 *
 * DEPLOY: Extensões > Apps Script > cole isto > Implantar > Nova implantação >
 *   App da Web (Executar como: Eu | Quem acessa: Qualquer pessoa). Copie a URL /exec.
 * IMPORTANTE: ao editar o código depois, faça "Gerenciar implantações > (lápis) >
 *   Versão: Nova versão > Implantar", senão a URL /exec continua rodando a versão antiga.
 *
 * Teste pela URL (NÃO clicando em Executar):
 *   /exec?action=debug              -> mostra as abas e quantas senhas leu
 *   /exec?action=auth&pid=Fael      -> {ok, modalidade}
 *   /exec?action=progress&pid=&semana=
 */

const ABA_PART = "participantes";
const ABA_RESP = "respostas";
const ABA_META = "eventos";

const COLS_RESP = ["enviadoEm","pid","modalidade","semana","trackId","ordem",
                   "valencia","arousal","naoConheco","listenMs",
                   "nome","idade","familiaridade","musico","respondidoEm"];
const COLS_META = ["recebidoEm","type","pid","modalidade","semana","payload"];

/* acha a aba de participantes mesmo com maiúsculas/espaços diferentes */
function partSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_PART);
  if (sh) return sh;
  const alvo = ABA_PART.toLowerCase();
  return ss.getSheets().filter(s => s.getName().trim().toLowerCase() === alvo)[0] || null;
}

/* mapa senha(minúscula) -> modalidade */
function participantes_() {
  const sh = partSheet_();
  const map = {};
  if (!sh) return map;
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {           // pula cabeçalho
    const pid = String(vals[i][0]).trim();
    const mod = String(vals[i][1]).trim();
    if (pid) map[pid.toLowerCase()] = mod;           // senha NÃO diferencia maiúscula
  }
  return map;
}

function doGet(e) {
  const p = (e && e.parameter) || {};                // blindado contra "Executar" no editor
  const pid = String(p.pid || "").trim().toLowerCase();

  if (p.action === "debug") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const map = participantes_();
    return json_({
      abas: ss.getSheets().map(s => s.getName()),
      aba_participantes_encontrada: !!partSheet_(),
      total_senhas: Object.keys(map).length,
      exemplos: Object.keys(map).slice(0, 3)
    });
  }
  if (p.action === "auth") {
    const mod = participantes_()[pid];
    return json_(mod ? {ok: true, modalidade: mod} : {ok: false});
  }
  if (p.action === "progress") {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_RESP);
    const done = [];
    if (sh) {
      const v = sh.getDataRange().getValues();
      const col = {}; v[0].forEach((c, i) => col[c] = i);
      for (let i = 1; i < v.length; i++) {
        if (String(v[i][col.pid]).trim().toLowerCase() === pid &&
            String(v[i][col.semana]) === String(p.semana)) {
          done.push(v[i][col.trackId]);
        }
      }
    }
    return json_({done: Array.from(new Set(done))});
  }
  return json_({ok: true, msg: "coletor VA ativo"});
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
      sheet.appendRow([new Date(), data.type || "", data.pid || "", data.modalidade || "",
                       data.semana || "", JSON.stringify(data)]);
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
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
