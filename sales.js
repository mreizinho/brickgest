"use strict";

// Preencher quando forem fornecidos os dados definitivos do vendedor.
const SALES_SELLER = Object.freeze({ name: "", tax: "", address: "", email: "", phone: "" });
function saleSellerText() { return [SALES_SELLER.name, SALES_SELLER.tax && `NIF: ${SALES_SELLER.tax}`, SALES_SELLER.address, SALES_SELLER.email, SALES_SELLER.phone].filter(Boolean).join(" · "); }

const salesHeaders = {
  Vendas: ["ID Venda","Data","Documento","Nome","Morada","Email","Contacto","NIF","Total","Estado TOConline","Documento TOConline","Utilizador","Vendedor"],
  VendasLinhas: ["ID Linha","ID Venda","Artigo","Nome","EAN","Quantidade","Preço unitário","Subtotal"]
};
const salesState = { items: [], customer: {}, type: "", phase: "scan", pending: null, busy: false, error: "", id: "", rows: [], lines: [], from: "", to: "", filter: "", integration: "", saved: null, uncertain: false };
// Keep an in-flight submission recoverable across reloads, for the current browser tab.
try { const draft=JSON.parse(sessionStorage.getItem("brickGestSaleDraft")||"null");if(draft)Object.assign(salesState,draft,{busy:false,error:""}); } catch { /* No recoverable draft. */ }
if (salesState.phase === "items") salesState.phase = salesState.items.length ? "review" : "scan";
salesState.showMenu = true;
function openSalesMenu() { salesState.showMenu=true;state.query=""; }
function salesTitle() {
  if(salesState.showMenu)return "VENDAS";
  if(salesState.pending)return "PREÇO DE VENDA";
  return {scan:"NOVA VENDA",review:"REVER VENDA",customer:"DOCUMENTO E CLIENTE",list:"CONSULTAR VENDAS",saved:"VENDA REGISTADA"}[salesState.phase] || "VENDAS";
}
function salesMenuMarkup() {
  const recovery=salesState.uncertain||salesState.pending;
  return `<section class="workspace batch-page"><section class="batch-panel"><div class="batch-heading"><h2>O que queres fazer?</h2><span>Prepara uma nova venda ou consulta as vendas registadas.</span></div><div class="home-actions movement-actions batch-movement-actions"><button type="button" class="sheets-open-button home-action home-action-entrada" data-sale-action="new" ${recovery?"disabled":""}>Nova Venda<img src="public/options/entrada.svg?v=add-box-black" alt="" width="28" height="28"></button><button type="button" class="sheets-open-button home-action home-action-transferencia" data-sale-action="list" ${recovery?"disabled":""}>Consultar<img src="public/options/consultar.svg" alt="" width="28" height="28"></button></div>${recovery?'<p>Existe uma leitura ou gravação por concluir.</p><button type="button" class="sheets-open-button" data-sale-action="resume">Retomar venda</button>':""}</section></section>`;
}
function persistSaleDraft() {
  try { const {rows,lines,busy,error,...draft}=salesState;sessionStorage.setItem("brickGestSaleDraft",JSON.stringify(draft)); } catch { /* Storage may be unavailable. */ }
}
const saleMoney = cents => formatMoneyValue(cents / 100);
const saleTotal = items => items.reduce((sum,item) => sum + Math.round(Number(item.price) * 100) * Object.values(item.allocations).reduce((a,b) => a + Number(b || 0),0),0);
function saleUnitCount() { return salesState.items.reduce((sum,item)=>sum+Object.values(item.allocations).reduce((a,b)=>a+Number(b||0),0),0); }
function saleItemMarkup(item,index,readonly=false) {
  const e=escapeHtml;
  return `<article><strong>${e(item.code)} — ${e(item.name)}</strong><div class="sales-grid"><label>Preço unitário de venda (€)<input type="number" min="0" step="0.01" required data-sale-price="${index}" value="${e(item.price)}" ${readonly?"readonly":""}></label>${item.locations.map((loc,j)=>`<label>${e(loc.storage)} (${loc.stock} disponíveis)<input type="number" min="0" max="${loc.stock}" step="1" required data-sale-item="${index}" data-location="${j}" value="${item.allocations[loc.storage]||0}" ${readonly?"readonly":""}></label>`).join("")}</div>${readonly?"":`<button type="button" data-sale-action="remove" data-index="${index}">Remover</button>`}</article>`;
}
function salePriceMarkup() {
  const item=salesState.pending.item,e=escapeHtml;
  return `<form id="sale-price-form"><fieldset ${salesState.busy?"disabled":""}><h2>Preço de venda</h2><p><strong>${e(item.code)} — ${e(item.name)}</strong></p><label>Preço unitário de venda (€)<input id="sale-pending-price" type="number" min="0" step="0.01" required autofocus data-sale-pending-price value="${e(item.price)}"></label><div class="sales-grid">${item.locations.map((loc,j)=>`<label>${e(loc.storage)} (${loc.stock} disponíveis nesta leitura)<input type="number" min="0" max="${loc.stock}" step="1" required data-sale-pending-location="${j}" value="${item.allocations[loc.storage]||0}"></label>`).join("")}</div><div class="sales-toolbar"><button type="button" data-sale-action="cancel-price">CANCELAR LEITURA</button><button type="submit">CONFIRMAR PREÇO / CONTINUAR</button></div></fieldset></form>`;
}
async function addSaleCode(rawCode, fromScanner = false) {
  const s=salesState;
  if(s.showMenu || s.busy || s.pending || s.uncertain || s.phase!=="scan")return;
  const code=String(rawCode||"").trim();
  state.query="";
  await salesWork(async()=>{
    const found=findSet(code);
    if(!found)throw new Error("Artigo não encontrado. Usa o EAN ou código do catálogo.");
    const stockRows=await loadMovementStockRows();
    if(state.mode!=="vendas")return;
    const locations=locationStockFromRows(stockRows,found.code).map(loc=>({...loc,stock:loc.stock-s.items.filter(i=>i.code===found.code).reduce((sum,i)=>sum+Number(i.allocations[loc.storage]||0),0)})).filter(loc=>loc.stock>0);
    if(!locations.length)throw new Error("Não há mais stock disponível deste artigo para adicionar à venda.");
    s.pending={resumeScanner:fromScanner,item:{...found,locations,allocations:Object.fromEntries(locations.map((loc,i)=>[loc.storage,i===0?1:0])),price:""}};
  });
  document.querySelector("#sale-pending-price")?.focus();
}
function confirmSalePrice() {
  const s=salesState;
  if(s.busy||!s.pending||s.uncertain)return;
  const item=s.pending.item;
  const resumeScanner=s.pending.resumeScanner;
  validateSaleItems([item]);
  for(const loc of item.locations)if(Number(item.allocations[loc.storage]||0)>loc.stock)throw new Error("A quantidade excede o stock disponível.");
  const existing=s.items.find(i=>i.code===item.code&&Math.round(Number(i.price)*100)===Math.round(Number(item.price)*100));
  if(existing) {
    for(const [storage,qty] of Object.entries(item.allocations))existing.allocations[storage]=Number(existing.allocations[storage]||0)+Number(qty||0);
  } else {
    // Review uses physical stock, while the price prompt shows stock remaining in the sale.
    item.locations=item.locations.map(loc=>({...loc,stock:loc.stock+s.items.filter(i=>i.code===item.code).reduce((sum,i)=>sum+Number(i.allocations[loc.storage]||0),0)}));
    s.items.push(item);
  }
  s.pending=null;s.error="";persistSaleDraft();render();
  if(resumeScanner && state.mode==="vendas")void openBarcodeScanner();
}
function salesMarkup() {
  const s = salesState, e = escapeHtml;
  if(s.showMenu)return salesMenuMarkup();
  if (!state.loggedIn) return `<section class="sales-page"><h1>VENDAS</h1><p>Inicia sessão para gerir as vendas.</p><button data-action="login">Login Google</button><button data-action="home">Início</button></section>`;
  if (s.owner && s.owner !== state.userEmail) return `<section class="sales-page"><h1>VENDAS</h1><p>Existe um rascunho de outra conta nesta sessão. Entra com essa conta para o recuperar ou inicia uma nova venda.</p><button data-sale-action="new">Nova venda</button><button data-action="home">Início</button></section>`;
  const toolbar = `<div class="sales-toolbar"><button data-sale-action="menu">Menu de vendas</button></div>`;
  let body;
  if (s.phase === "list") {
    const rows = filteredSales();
    body = `<div class="sales-grid"><label>Desde<input type="date" data-sale-field="from" value="${e(s.from)}"></label><label>Até<input type="date" data-sale-field="to" value="${e(s.to)}"></label><label>Documento<select data-sale-field="filter">${["","Factura","Recibo"].map(v=>`<option value="${v}" ${s.filter===v?"selected":""}>${v||"Todos"}</option>`).join("")}</select></label><label>TOConline<select data-sale-field="integration">${["","Pendente","Integrada","Não aplicável"].map(v=>`<option value="${v}" ${s.integration===v?"selected":""}>${v||"Todos"}</option>`).join("")}</select></label></div><button data-sale-action="csv">Exportar CSV</button><div class="sales-table"><table><thead><tr><th>Data</th><th>Cliente</th><th>Documento</th><th>Total</th><th>TOConline</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${e(r[1])}</td><td>${e(r[3])}</td><td>${e(r[2])}</td><td>${saleMoney(Math.round(Number(r[8])*100))}</td><td>${e(r[9])}</td><td><button data-sale-action="reprint" data-id="${e(r[0])}">Consultar / imprimir</button></td></tr>`).join("")}</tbody></table></div><p class="sales-total">${rows.length} vendas · ${saleMoney(rows.reduce((a,r)=>a+Math.round(Number(r[8])*100),0))}</p>`;
  } else if (s.phase === "saved") {
    body = `<article><h2>Venda registada</h2><p>${e(s.saved[0])}</p><p>${e(s.saved[3])} · ${saleMoney(Math.round(Number(s.saved[8])*100))}</p><button data-sale-action="print">Imprimir / guardar PDF</button></article>`;
  } else if (s.pending) {
    body = salePriceMarkup();
  } else if (s.phase === "scan") {
    body = `<section class="scan-panel"><div class="entry-keypad saida">${keypadControlsMarkup()}</div></section><p>Cada leitura abre o preço de venda e adiciona uma unidade.</p><p>${s.items.length} referências · ${saleUnitCount()} unidades · ${saleMoney(saleTotal(s.items))}</p><div class="sales-toolbar"><button data-sale-action="review" ${s.items.length ? "" : "disabled"}>PAUSAR / REVER</button><button data-sale-action="checkout" ${s.items.length ? "" : "disabled"}>CONCLUIR</button></div>`;
  } else {
    const reviewing = s.phase === "review";
    body = `<form id="sales-form"><fieldset ${s.busy||s.uncertain?"disabled":""}>${reviewing ? "<h2>Rever venda</h2>" : "<h2>Documento e cliente</h2>"}${s.items.map((item,i)=>saleItemMarkup(item,i,!reviewing)).join("")}<p class="sales-total" id="sale-total">Total: ${saleMoney(saleTotal(s.items))}</p>${reviewing ? `<div class="sales-toolbar"><button type="button" data-sale-action="scan">CONTINUAR LEITURA</button><button type="submit" name="checkout">CONCLUIR</button></div>` : `<div class="sales-grid"><label>Documento<select required data-sale-field="type"><option value="">Selecionar…</option>${["Factura","Recibo"].map(v=>`<option ${s.type===v?"selected":""}>${v}</option>`).join("")}</select></label></div>${s.type ? `<h2>Dados do cliente</h2><div class="sales-grid">${[["name","Nome","text"],["address","Morada","text"],["email","Email","email"],["phone","Contacto","tel"],["tax","NIF","text"]].map(([key,label,type])=>`<label>${label}<input type="${type}" required maxlength="${key==="tax"?20:300}" data-sale-customer="${key}" value="${e(s.customer[key]||"")}"></label>`).join("")}</div><p>Confirma os artigos, valores e dados acima antes de guardar.</p><small>Comprovativo interno — não serve de factura. A opção Factura fica pendente de emissão no TOConline.</small>`:""}<div class="sales-toolbar"><button type="button" data-sale-action="edit">REVER VENDA</button>${s.type?`<button type="submit" name="save">CONFIRMAR VENDA</button>`:""}</div>`}</fieldset></form>`;
  }
  if (s.uncertain) body += `<p>O resultado do envio não foi confirmado. Verifica o registo antes de tentar novamente.</p><button data-sale-action="verify">Verificar gravação</button>`;
  return `<section class="sales-page">${s.busy?"<p role='status'>A processar…</p>":s.pending||s.uncertain?"":toolbar}${s.error?`<p class="sales-error" role="alert">${e(s.error)}</p>`:""}${body}</section>`;
}
function renderSalesPage() {
  const app=document.querySelector("#app");
  if (state.scannerOpen && app.querySelector(".camera-scanner")) app.querySelector(".app-content").innerHTML=salesMarkup();
  else app.innerHTML=`${headerMarkup()}<div class="app-content">${salesMarkup()}</div>${state.scannerOpen?scannerMarkup():""}`;
}
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
  stockRows=stockRows.map(row=>row.slice());
  validateSaleItems(s.items);
  for (const item of s.items) {
    const allocations=Object.entries(item.allocations).filter(([,q])=>Number(q)>0).map(([storage,q])=>({storage,quantity:Number(q)}));
    const stock=locationStockFromRows(stockRows,item.code);
    for (const a of allocations) if (a.quantity>(stock.find(l=>l.storage===a.storage)?.stock||0)) throw new Error(`O stock de ${item.code} em ${a.storage} mudou. Revê as quantidades.`);
    const lineId=createMovementId(), qty=allocations.reduce((a,b)=>a+b.quantity,0);
    lines.push([lineId,id,item.code,item.name,item.ean,qty,Number(item.price),Math.round(Number(item.price)*100)*qty/100]);
    for (const a of splitExitAllocations(stockRows,item.code,allocations)) {
      const movement=[createMovementId(),timestamp,item.ean,item.code,item.name,item.year,item.theme,item.subTheme||"","Venda",item.imageUrl,a.storage,-a.quantity,state.userEmail,item.rrp||"","","",a.group==="Com factura"?a.cost??"":"",a.group==="Sem factura"?a.cost??"":"",a.group,"",id,lineId];
      movements.push(movement);stockRows.push(movement.slice(3,19));
    }
  }
  const c=s.customer;
  return {sale:[id,timestamp,s.type,c.name,c.address,c.email,c.phone,c.tax,saleTotal(s.items)/100,s.type==="Factura"?"Pendente":"Não aplicável","",state.userEmail,saleSellerText()],lines,movements};
}
async function saveSale() {
  const s=salesState;
  validateSaleItems(s.items);
  if (!["Factura","Recibo"].includes(s.type) || ["name","address","email","phone","tax"].some(k=>!String(s.customer[k]||"").trim())) throw new Error("Preenche o documento e os dados do cliente.");
  if (!s.id) s.id=createMovementId();
  const sheets=await prepareSalesSheets();
  const existing=await saleValues("Vendas!A2:M");
  const duplicate=existing.find(r=>r[0]===s.id);
  if (duplicate) { s.saved=duplicate;s.lines=await saleValues("VendasLinhas!A2:H");s.phase="saved";s.uncertain=false;return; }
  const rows=buildSaleRows(await loadMovementStockRows(),s.id,createMovementTimestamp());
  s.uncertain=true;s.submittedAt=Date.now();persistSaleDraft();
  await salesRequest(":batchUpdate",{requests:[["Movimentos",rows.movements],["Vendas",[rows.sale]],["VendasLinhas",rows.lines]].map(([name,values])=>({appendCells:{sheetId:findSheetByName(sheets,name).properties.sheetId,rows:values.map(saleCells),fields:"userEnteredValue"}}))});
  s.uncertain=false;s.saved=rows.sale;s.lines=rows.lines;s.phase="saved";
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
  if (el.dataset.salePendingPrice !== undefined && s.pending) s.pending.item.price=el.value;
  if (el.dataset.salePendingLocation !== undefined && s.pending) {const item=s.pending.item;item.allocations[item.locations[Number(el.dataset.salePendingLocation)].storage]=el.value;}
  if (el.dataset.saleCustomer) s.customer[el.dataset.saleCustomer]=el.value;
  if (el.dataset.saleField) {s[el.dataset.saleField]=el.value;if (["type","from","to","filter","integration"].includes(el.dataset.saleField)) render();}
  if (el.dataset.salePrice!==undefined) s.items[Number(el.dataset.salePrice)].price=el.value;
  if (el.dataset.saleItem!==undefined) {const item=s.items[Number(el.dataset.saleItem)];item.allocations[item.locations[Number(el.dataset.location)].storage]=el.value;}
  const total=document.querySelector("#sale-total");if(total) total.textContent=`Total: ${saleMoney(saleTotal(s.items))}`;
  persistSaleDraft();
});
document.addEventListener("submit",event=>{
  if(event.target.id === "sale-price-form") {
    event.preventDefault();
    try { confirmSalePrice(); } catch(error) { salesState.error=error.message;render(); }
    return;
  }
  if(event.target.id!=="sales-form")return;
  event.preventDefault();
  void salesWork(async()=>{
    if(salesState.phase==="review") {validateSaleItems(salesState.items);salesState.phase="customer";}
    else await saveSale();
  });
});
document.addEventListener("click",event=>{
  const button=event.target.closest("[data-sale-action]");if(!button||salesState.busy)return;
  const action=button.dataset.saleAction,s=salesState;
  if(s.uncertain&&!["verify","resume"].includes(action))return;
  if(s.pending&&!["cancel-price","resume"].includes(action))return;
  if(action==="menu"){openSalesMenu();render();}
  if(action==="resume"){s.showMenu=false;render();}
  if(action==="new"){state.query="";Object.assign(s,{items:[],customer:{},type:"",phase:"scan",pending:null,id:"",saved:null,error:"",owner:state.userEmail,showMenu:false});persistSaleDraft();render();}
  if(action==="edit" || action==="review"){s.phase="review";persistSaleDraft();render();}
  if(action==="scan"){state.query="";s.phase="scan";persistSaleDraft();render();}
  if(action==="checkout")void salesWork(async()=>{validateSaleItems(s.items);s.phase="customer";});
  if(action==="cancel-price"){s.pending=null;s.error="";persistSaleDraft();render();}
  if(action==="remove"){s.items.splice(Number(button.dataset.index),1);persistSaleDraft();render();}
  if(action==="print")printSale(s.saved);
  if(action==="reprint")printSale(s.rows.find(r=>r[0]===button.dataset.id));
  if(action==="csv")exportSalesCSV();
  if(action==="list"){s.showMenu=false;s.phase="list";render();void salesWork(async()=>{const sheets=await loadSpreadsheetSheetMetadata();s.rows=findSheetByName(sheets,"Vendas")?await saleValues("Vendas!A2:M"):[];s.lines=findSheetByName(sheets,"VendasLinhas")?await saleValues("VendasLinhas!A2:H"):[];});}
  if(action==="verify")void salesWork(async()=>{const rows=await saleValues("Vendas!A2:M"),found=rows.find(r=>r[0]===s.id);if(found){s.saved=found;s.lines=await saleValues("VendasLinhas!A2:H");s.phase="saved";s.uncertain=false;}else if(Date.now()-(s.submittedAt||0)<185000){s.error="O pedido anterior ainda pode estar em processamento. Aguarda três minutos desde o envio e verifica novamente.";}else{s.uncertain=false;s.error="Venda não encontrada. Podes voltar a confirmar; o ID será mantido para evitar duplicações.";}});
});

document.addEventListener("keydown",event=>{
  if(state.mode!=="vendas" || salesState.showMenu || salesState.phase!=="scan" || salesState.pending || salesState.busy || salesState.uncertain || state.scannerOpen || !state.loggedIn || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if(event.target.closest?.("input:not(#entry-code), textarea, select, [contenteditable], .app-confirm-dialog"))return;
  if(/^\d$/.test(event.key))state.query+=event.key;
  else if(event.key==="Backspace")state.query=state.query.slice(0,-1);
  else if(event.key==="Delete")state.query="";
  else if(event.key==="Enter"){event.preventDefault();void addSaleCode(state.query);return;}
  else return;
  event.preventDefault();
  const display=document.querySelector("#entry-code");if(display)display.value=state.query;
});
document.addEventListener("click",event=>{
  if(state.mode!=="vendas")return;
  if(event.target.closest("[data-digit], [data-action='lookup'], [data-action='scanner'], [data-action='delete'], [data-action='clear']") && (salesState.busy||salesState.pending||salesState.uncertain||salesState.phase!=="scan")) {
    event.preventDefault();event.stopImmediatePropagation();
  }
},true);
