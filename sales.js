"use strict";

const salesHeaders = {
  Vendas: ["ID Venda","Data","Documento","Nome","Morada","Email","Contacto","NIF","Total","Estado TOConline","Documento TOConline","Utilizador","Vendedor"],
  VendasLinhas: ["ID Linha","ID Venda","Artigo","Nome","EAN","Quantidade","Preço unitário","Subtotal"]
};
const salesState = { items: [], customer: {}, seller: localStorage.getItem("brickGestSeller") || "", type: "", phase: "items", busy: false, error: "", id: "", rows: [], lines: [], from: "", to: "", filter: "", integration: "", saved: null, uncertain: false };
// Keep an in-flight submission recoverable across reloads, for the current browser tab.
try { const draft=JSON.parse(sessionStorage.getItem("brickGestSaleDraft")||"null");if(draft)Object.assign(salesState,draft,{busy:false,error:""}); } catch { /* No recoverable draft. */ }
function persistSaleDraft() {
  try { const {rows,lines,busy,error,...draft}=salesState;sessionStorage.setItem("brickGestSaleDraft",JSON.stringify(draft)); } catch { /* Storage may be unavailable. */ }
}
const saleMoney = cents => formatMoneyValue(cents / 100);
const saleTotal = items => items.reduce((sum,item) => sum + Math.round(Number(item.price) * 100) * Object.values(item.allocations).reduce((a,b) => a + Number(b || 0),0),0);
function salesMarkup() {
  const s = salesState, e = escapeHtml;
  if (!state.loggedIn) return `<section class="sales-page"><h1>VENDAS</h1><p>Inicia sessão para gerir as vendas.</p><button data-action="login">Login Google</button><button data-action="home">Início</button></section>`;
  if (s.owner && s.owner !== state.userEmail) return `<section class="sales-page"><h1>VENDAS</h1><p>Existe um rascunho de outra conta nesta sessão. Entra com essa conta para o recuperar ou inicia uma nova venda.</p><button data-sale-action="new">Nova venda</button><button data-action="home">Início</button></section>`;
  const toolbar = `<div class="sales-toolbar"><button data-sale-action="new">Nova venda</button><button data-sale-action="list">Consultar vendas</button><button data-action="home">Início</button></div>`;
  let body;
  if (s.phase === "list") {
    const rows = filteredSales();
    body = `<div class="sales-grid"><label>Desde<input type="date" data-sale-field="from" value="${e(s.from)}"></label><label>Até<input type="date" data-sale-field="to" value="${e(s.to)}"></label><label>Documento<select data-sale-field="filter">${["","Factura","Recibo"].map(v=>`<option value="${v}" ${s.filter===v?"selected":""}>${v||"Todos"}</option>`).join("")}</select></label><label>TOConline<select data-sale-field="integration">${["","Pendente","Integrada","Não aplicável"].map(v=>`<option value="${v}" ${s.integration===v?"selected":""}>${v||"Todos"}</option>`).join("")}</select></label></div><button data-sale-action="csv">Exportar CSV</button><div class="sales-table"><table><thead><tr><th>Data</th><th>Cliente</th><th>Documento</th><th>Total</th><th>TOConline</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${e(r[1])}</td><td>${e(r[3])}</td><td>${e(r[2])}</td><td>${saleMoney(Math.round(Number(r[8])*100))}</td><td>${e(r[9])}</td><td><button data-sale-action="reprint" data-id="${e(r[0])}">Consultar / imprimir</button></td></tr>`).join("")}</tbody></table></div><p class="sales-total">${rows.length} vendas · ${saleMoney(rows.reduce((a,r)=>a+Math.round(Number(r[8])*100),0))}</p>`;
  } else if (s.phase === "saved") {
    body = `<article><h2>Venda registada</h2><p>${e(s.saved[0])}</p><p>${e(s.saved[3])} · ${saleMoney(Math.round(Number(s.saved[8])*100))}</p><button data-sale-action="print">Imprimir / guardar PDF</button></article>`;
  } else {
    body = `<form id="sales-form"><fieldset ${s.busy||s.uncertain?"disabled":""}>${s.phase === "items" ? `<div class="sales-grid"><label>EAN ou código do artigo<input name="code" id="sale-code" autocomplete="off"></label><button type="submit" name="add">Adicionar artigo</button></div>` : ""}${s.items.map((item,i)=>`<article><strong>${e(item.code)} — ${e(item.name)}</strong><div class="sales-grid"><label>Preço unitário de venda (€)<input aria-label="Preço de ${e(item.code)}" type="number" min="0" step="0.01" required data-sale-price="${i}" value="${e(item.price)}" ${s.phase!=="items"?"readonly":""}></label>${item.locations.map((loc,j)=>`<label>${e(loc.storage)} (${loc.stock} disponíveis)<input type="number" min="0" max="${loc.stock}" step="1" required data-sale-item="${i}" data-location="${j}" value="${item.allocations[loc.storage]||0}" ${s.phase!=="items"?"readonly":""}></label>`).join("")}</div>${s.phase==="items"?`<button type="button" data-sale-action="remove" data-index="${i}">Remover</button>`:""}</article>`).join("")}<p class="sales-total" id="sale-total">Total: ${saleMoney(saleTotal(s.items))}</p>${s.phase === "items" ? `<button type="submit" name="checkout">Continuar</button>` : `<div class="sales-grid"><label>Documento<select required data-sale-field="type"><option value="">Selecionar…</option>${["Factura","Recibo"].map(v=>`<option ${s.type===v?"selected":""}>${v}</option>`).join("")}</select></label></div>${s.type ? `<h2>Dados do cliente</h2><div class="sales-grid">${[["name","Nome","text"],["address","Morada","text"],["email","Email","email"],["phone","Contacto","tel"],["tax","NIF","text"]].map(([key,label,type])=>`<label>${label}<input type="${type}" required maxlength="${key==="tax"?20:300}" data-sale-customer="${key}" value="${e(s.customer[key]||"")}"></label>`).join("")}</div><label>Identificação do vendedor (nome, NIF e morada)<input required data-sale-field="seller" value="${e(s.seller)}" maxlength="500"></label><p>Confirma os artigos, valores e dados acima antes de guardar.</p><small>Comprovativo interno — não serve de factura. A opção Factura fica pendente de emissão no TOConline.</small>`:""}<div class="sales-toolbar"><button type="button" data-sale-action="edit">Voltar aos artigos</button>${s.type?`<button type="submit" name="save">Confirmar venda</button>`:""}</div>`}</fieldset></form>${s.uncertain?`<p>O resultado do envio não foi confirmado. Verifica o registo antes de tentar novamente.</p><button data-sale-action="verify">Verificar gravação</button>`:""}`;
  }
  return `<section class="sales-page"><h1>VENDAS</h1>${s.busy?"<p role='status'>A processar…</p>":toolbar}${s.error?`<p class="sales-error" role="alert">${e(s.error)}</p>`:""}${body}</section>`;
}
function renderSalesPage() { document.querySelector("#app").innerHTML = `${headerMarkup()}<div class="app-content">${salesMarkup()}</div>`; }
async function salesRequest(path, body) {
  if (!state.loggedIn || !state.accessToken) throw new Error("Inicia sessão com Google para gerir vendas.");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`, {method:body?"POST":"GET",headers:{Authorization:`Bearer ${state.accessToken}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{cache:"no-store"})});
  if (!response.ok) throw new Error(response.status===401?"A sessão Google expirou. Inicia sessão novamente.":response.status===403?"A conta Google não tem permissão para esta operação.":`Não foi possível aceder às vendas (${response.status}).`);
  return response.json();
}
async function saleValues(range) { return (await salesRequest(`/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`)).values || []; }
function saleCells(values) { return {values:values.map(v=>({userEnteredValue:typeof v === "number"?{numberValue:v}:{stringValue:String(v??"")}}))}; }
async function prepareSalesSheets() {
  await ensureCostColumn();
  let sheets = await loadSpreadsheetSheetMetadata();
  const missing = Object.keys(salesHeaders).filter(name=>!findSheetByName(sheets,name));
  if (missing.length) { await salesRequest(":batchUpdate",{requests:missing.map(title=>({addSheet:{properties:{title,gridProperties:{rowCount:1000,columnCount:26}}}}))}); sheets = await loadSpreadsheetSheetMetadata(); }
  const requests = [];
  for (const [name,headers] of Object.entries(salesHeaders)) {
    const sheet = findSheetByName(sheets,name), current = (await saleValues(`${quoteSheetName(name)}!A1:M1`))[0] || [];
    if (current.some((v,i)=>v && v!==headers[i])) throw new Error(`A estrutura de ${name} não corresponde às colunas de vendas.`);
    requests.push({updateCells:{start:{sheetId:sheet.properties.sheetId,rowIndex:0,columnIndex:0},rows:[saleCells(headers)],fields:"userEnteredValue"}});
  }
  const movement = findSheetByName(sheets,"Movimentos");
  const count = movement.properties.gridProperties.columnCount;
  if (count<22) requests.push({appendDimension:{sheetId:movement.properties.sheetId,dimension:"COLUMNS",length:22-count}});
  const current = count>=21 ? (await saleValues(count>=22?"Movimentos!U1:V1":"Movimentos!U1:U1"))[0]||[] : [];
  if (current.some((v,i)=>v && v!==["ID Venda","ID Linha Venda"][i])) throw new Error("As colunas U e V de Movimentos já estão ocupadas.");
  requests.push({updateCells:{start:{sheetId:movement.properties.sheetId,rowIndex:0,columnIndex:20},rows:[saleCells(["ID Venda","ID Linha Venda"])],fields:"userEnteredValue"}});
  await salesRequest(":batchUpdate",{requests});
  return sheets;
}
function validateSaleItems(items) {
  if (!items.length) throw new Error("Adiciona pelo menos um artigo.");
  for (const item of items) {
    if (item.price==="" || !Number.isFinite(Number(item.price)) || Number(item.price)<0 || Math.abs(Number(item.price)*100-Math.round(Number(item.price)*100))>0.00001) throw new Error("Indica preços válidos com até duas casas decimais.");
    const quantities = Object.values(item.allocations).map(Number);
    if (quantities.some(q=>!Number.isSafeInteger(q)||q<0) || !quantities.some(q=>q>0)) throw new Error(`Indica quantidades inteiras para ${item.code}.`);
  }
  if (!Number.isSafeInteger(saleTotal(items))) throw new Error("O valor total da venda excede o limite permitido.");
}
function buildSaleRows(stockRows,id,timestamp) {
  const s=salesState, movements=[], lines=[];
  validateSaleItems(s.items);
  for (const item of s.items) {
    const allocations=Object.entries(item.allocations).filter(([,q])=>Number(q)>0).map(([storage,q])=>({storage,quantity:Number(q)}));
    const stock=locationStockFromRows(stockRows,item.code);
    for (const a of allocations) if (a.quantity>(stock.find(l=>l.storage===a.storage)?.stock||0)) throw new Error(`O stock de ${item.code} em ${a.storage} mudou. Revê as quantidades.`);
    const lineId=createMovementId(), qty=allocations.reduce((a,b)=>a+b.quantity,0);
    lines.push([lineId,id,item.code,item.name,item.ean,qty,Number(item.price),Math.round(Number(item.price)*100)*qty/100]);
    for (const a of splitExitAllocations(stockRows,item.code,allocations)) movements.push([createMovementId(),timestamp,item.ean,item.code,item.name,item.year,item.theme,item.subTheme||"","Venda",item.imageUrl,a.storage,-a.quantity,state.userEmail,item.rrp||"","","",a.group==="Com factura"?a.cost??"":"",a.group==="Sem factura"?a.cost??"":"",a.group,"",id,lineId]);
  }
  const c=s.customer;
  return {sale:[id,timestamp,s.type,c.name,c.address,c.email,c.phone,c.tax,saleTotal(s.items)/100,s.type==="Factura"?"Pendente":"Não aplicável","",state.userEmail,s.seller],lines,movements};
}
async function saveSale() {
  const s=salesState;
  validateSaleItems(s.items);
  if (!["Factura","Recibo"].includes(s.type) || ["name","address","email","phone","tax"].some(k=>!String(s.customer[k]||"").trim()) || !s.seller.trim()) throw new Error("Preenche o documento, os dados do cliente e a identificação do vendedor.");
  if (!s.id) s.id=createMovementId();
  const sheets=await prepareSalesSheets();
  const existing=await saleValues("Vendas!A2:M");
  const duplicate=existing.find(r=>r[0]===s.id);
  if (duplicate) { s.saved=duplicate;s.lines=await saleValues("VendasLinhas!A2:H");s.phase="saved";s.uncertain=false;return; }
  const rows=buildSaleRows(await loadMovementStockRows(),s.id,createMovementTimestamp());
  s.uncertain=true;s.submittedAt=Date.now();persistSaleDraft();
  await salesRequest(":batchUpdate",{requests:[["Movimentos",rows.movements],["Vendas",[rows.sale]],["VendasLinhas",rows.lines]].map(([name,values])=>({appendCells:{sheetId:findSheetByName(sheets,name).properties.sheetId,rows:values.map(saleCells),fields:"userEnteredValue"}}))});
  s.uncertain=false;s.saved=rows.sale;s.lines=rows.lines;s.phase="saved";
  try {localStorage.setItem("brickGestSeller",s.seller);} catch { /* Saving preferences must not affect the committed sale. */ }
}
function filteredSales() {
  const s=salesState;
  return s.rows.filter(r=>{const [d,m,y]=String(r[1]).split(" ")[0].split("/");const date=`${y}-${m}-${d}`;return (!s.from||date>=s.from)&&(!s.to||date<=s.to)&&(!s.filter||r[2]===s.filter)&&(!s.integration||r[9]===s.integration);});
}
function printSale(row) {
  const e=escapeHtml, lines=salesState.lines.filter(l=>l[1]===row[0]);
  const frame=document.createElement("iframe");frame.style.cssText="position:fixed;width:0;height:0;border:0";document.body.append(frame);
  const doc=frame.contentDocument;
  doc.open();doc.write(`<!doctype html><html lang="pt"><head><title>Venda ${e(row[0])}</title><style>body{font:14px Arial;margin:30px;color:#172b3a}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #ccc;padding:10px}h1{font-size:22px}footer{margin-top:30px;font-size:12px}@page{size:A4;margin:15mm}</style></head><body><h1>BrickGEST · Comprovativo de venda</h1><p>${e(row[12]||"")}</p><p>Ref.: ${e(row[0])}<br>Data: ${e(row[1])}<br>Opção: ${e(row[2])}</p><h2>Cliente</h2><p>${e(row[3])}<br>${e(row[4])}<br>NIF: ${e(row[7])}<br>${e(row[5])} · ${e(row[6])}</p><table><thead><tr><th>Artigo</th><th>Qtd.</th><th>Preço unit.</th><th>Subtotal</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${e(l[2])} — ${e(l[3])}</td><td>${e(l[5])}</td><td>${saleMoney(Math.round(Number(l[6])*100))}</td><td>${saleMoney(Math.round(Number(l[7])*100))}</td></tr>`).join("")}</tbody></table><h2>Total: ${saleMoney(Math.round(Number(row[8])*100))}</h2><footer>Comprovativo interno. Não serve de factura nem de recibo fiscal.${row[2]==="Factura"?" Emissão fiscal através do TOConline: "+e(row[9])+".":""}</footer></body></html>`);doc.close();
  frame.contentWindow.focus();frame.contentWindow.print();setTimeout(()=>frame.remove(),60000);
}
function exportSalesCSV() {
  const safe=v=>`"${String(v??"").replace(/^[=+@-]/,"'$&").replace(/"/g,'""')}"`;
  const csv="\uFEFF"+[salesHeaders.Vendas,...filteredSales()].map(r=>r.map(safe).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})), a=document.createElement("a");a.href=url;a.download="vendas.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function salesWork(work) {
  if (salesState.busy) return;
  if (!state.loggedIn || (salesState.owner && salesState.owner!==state.userEmail)) return;
  salesState.owner=state.userEmail;
  salesState.busy=true;salesState.error="";render();
  try {await work();} catch(error) {salesState.error=error.message;} finally {salesState.busy=false;persistSaleDraft();render();}
}
document.addEventListener("input",event=>{
  const el=event.target,s=salesState;
  if (state.mode!=="vendas" || s.busy || s.uncertain) return;
  if (el.dataset.saleCustomer) s.customer[el.dataset.saleCustomer]=el.value;
  if (el.dataset.saleField) {s[el.dataset.saleField]=el.value;if (["type","from","to","filter","integration"].includes(el.dataset.saleField)) render();}
  if (el.dataset.salePrice!==undefined) s.items[Number(el.dataset.salePrice)].price=el.value;
  if (el.dataset.saleItem!==undefined) {const item=s.items[Number(el.dataset.saleItem)];item.allocations[item.locations[Number(el.dataset.location)].storage]=el.value;}
  const total=document.querySelector("#sale-total");if(total) total.textContent=`Total: ${saleMoney(saleTotal(s.items))}`;
  persistSaleDraft();
});
document.addEventListener("submit",event=>{
  if(event.target.id!=="sales-form")return;event.preventDefault();
  const code=event.target.elements.code?.value?.trim(),action=event.submitter?.name;
  void salesWork(async()=>{
    const s=salesState;
    if(action==="add" || (s.phase==="items"&&code)) {
      const item=findSet(code);if(!item)throw new Error("Artigo não encontrado. Usa o EAN ou código do catálogo.");
      if(s.items.some(i=>i.code===item.code))throw new Error("O artigo já está na venda. Ajusta as quantidades.");
      const locations=locationStockFromRows(await loadMovementStockRows(),item.code);if(!locations.length)throw new Error("Este artigo não tem stock disponível.");
      s.items.push({...item,locations,allocations:Object.fromEntries(locations.map(l=>[l.storage,0])),price:""});
    } else if(s.phase==="items") {validateSaleItems(s.items);s.phase="customer";}
    else await saveSale();
  });
});
document.addEventListener("click",event=>{
  const button=event.target.closest("[data-sale-action]");if(!button||salesState.busy)return;
  const action=button.dataset.saleAction,s=salesState;
  if(s.uncertain&&action!=="verify")return;
  if(action==="new"){Object.assign(s,{items:[],customer:{},type:"",phase:"items",id:"",saved:null,error:"",owner:state.userEmail});persistSaleDraft();render();}
  if(action==="edit"){s.phase="items";render();}
  if(action==="remove"){s.items.splice(Number(button.dataset.index),1);render();}
  if(action==="print")printSale(s.saved);
  if(action==="reprint")printSale(s.rows.find(r=>r[0]===button.dataset.id));
  if(action==="csv")exportSalesCSV();
  if(action==="list")void salesWork(async()=>{const sheets=await loadSpreadsheetSheetMetadata();s.rows=findSheetByName(sheets,"Vendas")?await saleValues("Vendas!A2:M"):[];s.lines=findSheetByName(sheets,"VendasLinhas")?await saleValues("VendasLinhas!A2:H"):[];s.phase="list";});
  if(action==="verify")void salesWork(async()=>{const rows=await saleValues("Vendas!A2:M"),found=rows.find(r=>r[0]===s.id);if(found){s.saved=found;s.lines=await saleValues("VendasLinhas!A2:H");s.phase="saved";s.uncertain=false;}else if(Date.now()-(s.submittedAt||0)<185000){s.error="O pedido anterior ainda pode estar em processamento. Aguarda três minutos desde o envio e verifica novamente.";}else{s.uncertain=false;s.error="Venda não encontrada. Podes voltar a confirmar; o ID será mantido para evitar duplicações.";}});
});
