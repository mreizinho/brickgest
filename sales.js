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
if(salesState.phase==="customer" && !["Factura","Recibo"].includes(salesState.type) && !salesState.uncertain)salesState.phase="document";
salesState.showMenu = true;
salesState.confirmNew = false;
function hasSaleInProgress() { return !salesState.saved && Boolean(salesState.items.length || salesState.pending || salesState.uncertain); }
function startNewSale() {
  if(salesState.uncertain)return;
  state.query="";
  Object.assign(salesState,{items:[],customer:{},type:"",phase:"scan",resumePhase:"scan",pending:null,id:"",saved:null,error:"",owner:state.userEmail,showMenu:false,confirmNew:false,submittedAt:0});
  persistSaleDraft();render();
}
function resumeSaleDraft() {
  const s=salesState;
  s.confirmNew=false;s.showMenu=false;
  if(s.uncertain)s.phase="customer";
  else if(s.pending)s.phase="scan";
  else if(!["scan","review","document","customer"].includes(s.phase))s.phase=["scan","review","document","customer"].includes(s.resumePhase)?s.resumePhase:"review";
  if(s.phase==="customer" && !["Factura","Recibo"].includes(s.type) && !s.uncertain)s.phase="document";
  if(s.phase==="document" && !s.uncertain)s.type="";
  persistSaleDraft();render();
}
function requestNewSale() {
  if(salesState.uncertain){resumeSaleDraft();return;}
  if(hasSaleInProgress()) {
    salesState.confirmNew=true;salesState.showMenu=false;render();
  } else startNewSale();
}
function saleInProgressMarkup() {
  const s=salesState,units=saleUnitCount()+(s.pending?Object.values(s.pending.item.allocations).reduce((sum,q)=>sum+Number(q||0),0):0);
  return `<section class="workspace batch-page"><section class="batch-panel"><div class="batch-heading"><h2>Já existe uma venda em progresso</h2><span>${units} ${units===1?"unidade preparada":"unidades preparadas"}. Queres continuar essa venda ou começar uma nova?</span></div><p>Começar uma nova venda substitui o rascunho atual.</p><div class="batch-actions sale-resume-actions"><button type="button" class="secondary" data-sale-action="continue-draft">CONTINUAR VENDA</button><button type="button" class="primary" data-sale-action="restart-draft">COMEÇAR NOVA</button></div></section></section>`;
}
function openSalesMenu() { salesState.showMenu=true;state.query=""; }
function salesTitle() {
  if(salesState.showMenu)return "VENDAS";
  if(salesState.confirmNew)return "VENDA EM PROGRESSO";
  if(salesState.pending)return "PREÇO DE VENDA";
  return {scan:"NOVA VENDA",review:"REVER VENDA",document:"DOCUMENTO",customer:"DADOS DO CLIENTE",list:"CONSULTAR VENDAS",saved:"VENDA REGISTADA"}[salesState.phase] || "VENDAS";
}
function salesMenuMarkup() {
  const recovery=salesState.uncertain;
  return `<section class="workspace batch-page"><section class="batch-panel"><div class="batch-heading"><h2>O que queres fazer?</h2><span>Prepara uma nova venda ou consulta as vendas registadas.</span></div><div class="home-actions movement-actions batch-movement-actions"><button type="button" class="sheets-open-button home-action home-action-entrada" data-sale-action="new" ${recovery?"disabled":""}>NOVA VENDA<span class="material-symbols-outlined" aria-hidden="true">shopping_cart</span></button><button type="button" class="sheets-open-button home-action home-action-transferencia" data-sale-action="list" ${recovery?"disabled":""}>CONSULTAR VENDAS<img src="public/options/consultar.svg" alt="" width="28" height="28"></button></div>${recovery?'<p>Existe uma leitura ou gravação por concluir.</p><button type="button" class="sheets-open-button" data-sale-action="resume">Retomar venda</button>':""}</section></section>`;
}
function persistSaleDraft() {
  if(!salesState.saved && ["scan","review","document","customer"].includes(salesState.phase))salesState.resumePhase=salesState.phase;
  try { const {rows,lines,busy,error,...draft}=salesState;sessionStorage.setItem("brickGestSaleDraft",JSON.stringify(draft)); } catch { /* Storage may be unavailable. */ }
}
const saleMoney = cents => formatMoneyValue(cents / 100);
const saleTotal = items => items.reduce((sum,item) => sum + Math.round(Number(item.price) * 100) * Object.values(item.allocations).reduce((a,b) => a + Number(b || 0),0),0);
function saleUnitCount() { return salesState.items.reduce((sum,item)=>sum+Object.values(item.allocations).reduce((a,b)=>a+Number(b||0),0),0); }
function salesScanMarkup() {
  const s=salesState,e=escapeHtml,units=saleUnitCount(),references=new Set(s.items.map(item=>item.code)).size;
  const latest=s.items.length?`<div class="batch-mini-list">${s.items.slice(-4).reverse().map(item=>`<div role="button" tabindex="0" data-sale-action="review" aria-label="Rever venda: ${e(item.code)} ${e(item.name)}"><span><b>${e(item.code)}</b><small>${e(item.name)}</small></span><strong>${Object.values(item.allocations).reduce((sum,q)=>sum+Number(q||0),0)} un.</strong><strong class="sales-mini-price">${saleMoney(Math.round(Number(item.price)*100))}</strong></div>`).join("")}</div>`:'<p class="batch-empty">Ainda não foi lido nenhum conjunto.</p>';
  return `<section class="workspace batch-page"><section class="batch-panel batch-scan-panel sales-scan-panel"><div class="batch-heading"><p>VENDA</p><h2>Ler ${units>1?"conjuntos":"conjunto"}</h2><span>Cada leitura adiciona uma unidade e pede o preço de venda.</span></div>${s.busy?'<p role="status">A processar…</p>':""}${s.error?`<p class="sales-error" role="alert">${e(s.error)}</p>`:""}<fieldset class="sales-scan-controls" ${s.busy?"disabled":""}><div class="batch-keypad-shell"><div class="entry-keypad lote batch-keypad">${keypadControlsMarkup()}</div></div></fieldset><hr class="batch-keypad-divider"><div class="batch-counter"><strong>${units}</strong><span>${units===1?"unidade":"unidades"}</span><i></i><strong>${references}</strong><span>${references===1?"referência":"referências"}</span></div><p class="batch-mini-title">Últimas leituras</p>${latest}<p class="sales-scan-total">Total: ${saleMoney(saleTotal(s.items))}</p><div class="batch-actions"><button type="button" class="secondary batch-delete-action" data-sale-action="cancel" ${s.busy?"disabled":""}>CANCELAR</button><button type="button" class="secondary" data-sale-action="review" ${references&&!s.busy?"":"disabled"}>REVER</button><button type="button" class="primary" data-sale-action="checkout" ${references&&!s.busy?"":"disabled"}>CONCLUIR</button></div></section></section>`;
}
function saleSetCardMarkup(item,index,readonly=false) {
  const e=escapeHtml,quantity=Object.values(item.allocations).reduce((sum,q)=>sum+Number(q||0),0);
  const remove=index==="pending"?"cancel-price":"remove";
  const details=`<b>${e(item.code)} · ${e(item.name)}</b><small>${e(item.theme||"")}${item.year?` · ${e(item.year)}`:""}</small>${Number.isFinite(parseMoneyValue(item.rrp))?`<span class="sale-item-rrp">PVR ${e(formatMoneyValue(parseMoneyValue(item.rrp)))}</span>`:""}${item.price===""?"":`<strong class="sale-item-price">${saleMoney(Math.round(Number(item.price)*100))} / un.</strong>`}`;
  const detailBlock=readonly?`<span class="sale-item-details">${details}</span>`:`<button type="button" class="sale-item-details" data-sale-action="edit-price" data-index="${index}" aria-label="Alterar preço de ${e(item.code)}">${details}</button>`;
  return `<div class="batch-item-main">${readonly?'<span aria-hidden="true"></span>':`<button type="button" class="batch-remove-item" data-sale-action="${remove}" data-index="${index}" aria-label="Remover ${e(item.code)}">×</button>`}${item.imageUrl?`<button type="button" class="batch-item-image batch-image-button" data-sale-action="image" data-index="${index}" aria-label="Ver imagem de ${e(item.code)}"><img src="${e(item.imageUrl)}" alt=""></button>`:'<span class="batch-item-image">#</span>'}${detailBlock}<div class="batch-inline-qty${readonly?" sale-qty-readonly":""}"><strong>${quantity}</strong>${readonly?"":`<div><button type="button" data-sale-action="qty-increase" data-index="${index}" aria-label="Aumentar quantidade de ${e(item.code)}">▴</button><button type="button" data-sale-action="qty-decrease" data-index="${index}" aria-label="Diminuir quantidade de ${e(item.code)}">▾</button></div>`}</div></div>`;
}
function setSaleItemPrice(index,price) {
  const item=index==="pending"?salesState.pending?.item:salesState.items[Number(index)];
  if(!item)return;
  validateSaleItems([{...item,price}]);
  item.price=String(price);persistSaleDraft();render();
}
function openSalePriceDialog(index) {
  const item=index==="pending"?salesState.pending?.item:salesState.items[Number(index)];
  if(!item||salesState.busy||salesState.uncertain||document.querySelector(".sale-price-dialog"))return;
  const dialog=document.createElement("dialog"),previousFocus=document.activeElement,e=escapeHtml;
  dialog.className="sale-price-dialog app-confirm-dialog";
  dialog.setAttribute("aria-labelledby","sale-price-dialog-title");
  dialog.innerHTML=`<h2 id="sale-price-dialog-title">Alterar preço unitário</h2><p>${e(item.code)} · ${e(item.name)}</p><form><label for="sale-dialog-price">Preço unitário de venda (€)<input id="sale-dialog-price" type="number" min="0" step="0.01" inputmode="decimal" enterkeyhint="done" required value="${e(item.price)}"></label><p class="sales-error" role="alert" hidden></p><div class="batch-actions"><button type="button" class="secondary">CANCELAR</button><button type="submit" class="primary">GUARDAR PREÇO</button></div></form>`;
  dialog.querySelector(".secondary").addEventListener("click",()=>dialog.close());
  dialog.querySelector("form").addEventListener("submit",event=>{
    event.preventDefault();
    try {setSaleItemPrice(index,dialog.querySelector("input").value);dialog.close();}
    catch(error){const message=dialog.querySelector("[role='alert']");message.textContent=error.message;message.hidden=false;}
  });
  dialog.addEventListener("close",()=>{
    dialog.remove();
    if(window.matchMedia?.("(pointer: coarse)").matches){
      const focused=document.activeElement;
      if(focused?.matches?.("[data-sale-action=edit-price]"))focused.blur();
      return;
    }
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    else document.querySelector(`[data-sale-action="edit-price"][data-index="${index}"]`)?.focus({preventScroll:true});
  },{once:true});
  document.body.append(dialog);dialog.showModal();dialog.querySelector("input").focus();dialog.querySelector("input").select();
}
function saleLocationMarkup(item,index,readonly=false) {
  const e=escapeHtml,pending=index==="pending";
  return item.locations.map((loc,j)=>{
    const id=`sale-location-${index}-${j}`;
    return `<div class="sale-location-field"><label for="${id}">${e(loc.storage)} (${loc.stock} disponíveis${pending?" nesta leitura":""})</label><div class="batch-inline-qty sale-location-qty${readonly?" sale-qty-readonly":""}"><input id="${id}" class="sale-location-input" type="number" inputmode="numeric" min="0" max="${loc.stock}" step="1" required ${pending?`data-sale-pending-location="${j}"`:`data-sale-item="${index}" data-location="${j}"`} value="${item.allocations[loc.storage]||0}" ${readonly?"readonly":""}>${readonly?"":`<div><button type="button" data-sale-action="location-increase" data-index="${index}" data-location="${j}" aria-label="Aumentar quantidade em ${e(loc.storage)}">▴</button><button type="button" data-sale-action="location-decrease" data-index="${index}" data-location="${j}" aria-label="Diminuir quantidade em ${e(loc.storage)}">▾</button></div>`}</div></div>`;
  }).join("");
}
function setSaleLocation(index,locationIndex,requested) {
  const item=index==="pending"?salesState.pending?.item:salesState.items[Number(index)],loc=item?.locations[Number(locationIndex)];
  if(!loc)return;
  const capacity=location=>Math.max(0,location.stock-(index==="pending"?0:salesState.items.filter(other=>other!==item&&other.code===item.code).reduce((sum,other)=>sum+Number(other.allocations[location.storage]||0),0)));
  const current=Number(item.allocations[loc.storage]||0);
  if(!Number.isSafeInteger(Number(requested)))return current;
  const target=Math.min(capacity(loc),Math.max(0,Number(requested)));
  let remaining=Math.abs(target-current),moved=0;
  for(const other of item.locations) {
    if(other.storage===loc.storage)continue;
    const allocated=Number(item.allocations[other.storage]||0);
    const available=target>current?allocated:Math.max(0,capacity(other)-allocated);
    const transfer=Math.min(remaining,available);
    if(!transfer)continue;
    item.allocations[other.storage]=allocated+(target>current?-transfer:transfer);
    moved+=transfer;remaining-=transfer;
    if(!remaining)break;
  }
  item.allocations[loc.storage]=current+(target>current?moved:-moved);
  return item.allocations[loc.storage];
}
function adjustSaleLocation(index,locationIndex,delta) {
  const item=index==="pending"?salesState.pending?.item:salesState.items[Number(index)],loc=item?.locations[Number(locationIndex)];
  if(!loc)return;
  setSaleLocation(index,locationIndex,Number(item.allocations[loc.storage]||0)+delta);
  salesState.error="";persistSaleDraft();render();
}
function saleItemMarkup(item,index,readonly=false) {
  const e=escapeHtml;
  return `<article class="batch-item sale-item">${saleSetCardMarkup(item,index,readonly)}<div class="sale-item-fields"><div class="sales-grid">${saleLocationMarkup(item,index,readonly)}</div></div></article>`;
}
function canAcceptSalePrice() {
  const pending=salesState.pending;if(!pending||pending.acceptedPrice===String(pending.item.price))return false;
  try{validateSaleItems([pending.item]);return true;}catch{return false;}
}
function salePriceMarkup() {
  const item=salesState.pending.item,e=escapeHtml;
  return `<form id="sale-price-form"><fieldset ${salesState.busy?"disabled":""}><article class="batch-item sale-item">${saleSetCardMarkup(item,"pending")}<div class="sale-item-fields"><label for="sale-pending-price">Preço unitário de venda (€)</label><div class="sale-price-entry"><input class="sale-price-input" id="sale-pending-price" type="number" inputmode="decimal" enterkeyhint="done" min="0" step="0.01" required autofocus data-sale-pending-price value="${e(item.price)}"><button type="button" class="sale-price-ok" data-sale-action="accept-price" ${String(item.price??"").trim()?"":"hidden"} ${canAcceptSalePrice()?"":"disabled"}>OK</button></div><div class="sales-grid">${saleLocationMarkup(item,"pending")}</div></div></article><div class="batch-actions sale-price-actions"><button type="button" class="secondary batch-delete-action" data-sale-action="cancel-price">CANCELAR LEITURA</button><button type="submit" class="primary">CONFIRMAR PREÇO / CONTINUAR</button></div></fieldset></form>`;
}
function adjustSaleQuantity(index,delta) {
  const item=index==="pending"?salesState.pending?.item:salesState.items[Number(index)];
  if(!item)return;
  const quantity=Object.values(item.allocations).reduce((sum,q)=>sum+Number(q||0),0);
  if(delta<0&&quantity<=1)return;
  const location=delta>0?item.locations.find(loc=>{
    const elsewhere=salesState.items.filter(other=>other!==item&&other.code===item.code).reduce((sum,other)=>sum+Number(other.allocations[loc.storage]||0),0);
    return Number(item.allocations[loc.storage]||0)<loc.stock-(index==="pending"?0:elsewhere);
  }):[...item.locations].reverse().find(loc=>Number(item.allocations[loc.storage]||0)>0);
  if(!location){salesState.error="Não há mais stock disponível para aumentar a quantidade.";render();return;}
  item.allocations[location.storage]=Number(item.allocations[location.storage]||0)+delta;
  salesState.error="";persistSaleDraft();render();
}
async function addSaleCode(rawCode, fromScanner = false) {
  const s=salesState;
  if(s.showMenu || s.confirmNew || s.busy || s.pending || s.uncertain || s.phase!=="scan")return;
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
function continueSaleDocument() {  if(!["Factura","Recibo"].includes(salesState.type))throw new Error("Seleciona Factura ou Recibo para continuar.");  salesState.phase="customer";persistSaleDraft();}function saleRequiredCustomerFields(type) { return type==="Factura"?["name","tax"]:["name"]; }
function salesMarkup() {
  const s = salesState, e = escapeHtml;
  if(s.showMenu)return salesMenuMarkup();
  if (!state.loggedIn) return `<section class="sales-page"><h1>VENDAS</h1><p>Inicia sessão para gerir as vendas.</p><button data-action="login">Login Google</button><button data-action="home">Início</button></section>`;
  if(s.confirmNew)return saleInProgressMarkup();
  if (s.owner && s.owner !== state.userEmail) return `<section class="sales-page"><h1>VENDAS</h1><p>Existe um rascunho de outra conta nesta sessão. Entra com essa conta para o recuperar ou inicia uma nova venda.</p><button data-sale-action="new">Nova venda</button><button data-action="home">Início</button></section>`;
  if(s.phase==="scan"&&!s.pending&&!s.uncertain)return salesScanMarkup();

  let body;
  if (s.phase === "list") {
    const rows = s.searched?filteredSales():[];
    body = `<div class="sales-grid"><label>Desde<input type="date" data-sale-field="from" value="${e(s.from)}"></label><label>Até<input type="date" data-sale-field="to" value="${e(s.to)}"></label><label>Documento<select data-sale-field="filter">${["","Factura","Recibo"].map(v=>`<option value="${v}" ${s.filter===v?"selected":""}>${v||"Todos"}</option>`).join("")}</select></label><label>TOConline<select data-sale-field="integration">${["","Pendente","Integrada","Não aplicável"].map(v=>`<option value="${v}" ${s.integration===v?"selected":""}>${v||"Todos"}</option>`).join("")}</select></label></div><div class="batch-actions sales-search-actions"><button type="button" class="primary" data-sale-action="search" ${s.busy?"disabled":""}>PESQUISAR</button></div>${s.searched?`<button data-sale-action="csv">Exportar CSV</button><div class="sales-table"><table><thead><tr><th>Data</th><th>Cliente</th><th>Documento</th><th>Total</th><th>TOConline</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${e(r[1])}</td><td>${e(r[3])}</td><td>${e(r[2])}</td><td>${saleMoney(Math.round(Number(r[8])*100))}</td><td>${e(r[9])}</td><td><button data-sale-action="reprint" data-id="${e(r[0])}">Consultar / imprimir</button></td></tr>`).join("")}</tbody></table></div><p class="sales-total">${rows.length} vendas · ${saleMoney(rows.reduce((a,r)=>a+Math.round(Number(r[8])*100),0))}</p>`:'<p>Escolhe os critérios e carrega em PESQUISAR.</p>'}`;
  } else if (s.phase === "saved") {
    body = `<article><h2>Venda registada</h2><p>${e(s.saved[0])}</p><p>${e(s.saved[3])} · ${saleMoney(Math.round(Number(s.saved[8])*100))}</p><button data-sale-action="print">Imprimir / guardar PDF</button></article>`;
  } else if (s.pending) {
    body = salePriceMarkup();

  } else {
    const reviewing=s.phase==="review",customer=s.phase==="customer";
    const customerInput=([key,label,type])=>`<label class="sale-customer-${key}">${label}<input type="${type}" ${saleRequiredCustomerFields(s.type).includes(key)?"required":""} maxlength="${key==="tax"?20:300}" data-sale-customer="${key}" value="${e(s.customer[key]||"")}"></label>`;
    const customerFields=`<div class="sales-customer-grid">${[["name","Nome","text"],["tax","NIF","text"]].map(customerInput).join("")}</div><details class="sale-customer-extra"><summary>Outros dados do cliente</summary><div class="sales-customer-grid">${[["address","Morada 1","text"],["address2","Morada 2","text"],["phone","Contacto (tel)","tel"],["email","Email","email"]].map(customerInput).join("")}</div></details>`;
    const summary=customer?`<p>Documento: <strong>${e(s.type)}</strong></p>`:s.items.map((item,i)=>reviewing?saleItemMarkup(item,i):`<article class="batch-item sale-item">${saleSetCardMarkup(item,i,true)}</article>`).join("");
    const actions=reviewing?`<button type="button" class="secondary" data-sale-action="scan">CONTINUAR LEITURA</button><button type="submit" class="primary" name="checkout">CONCLUIR</button>`:customer?`<button type="button" class="secondary" data-sale-action="document-back">VOLTAR AO DOCUMENTO</button><button type="submit" class="primary" name="save">CONFIRMAR VENDA</button>`:`<button type="button" class="secondary" data-sale-action="edit">REVER VENDA</button><button type="submit" class="primary" name="customer" ${["Factura","Recibo"].includes(s.type)?"":"disabled"}>CONTINUAR</button>`;
    const documentField=`<p id="sale-document-label">Documento</p><div class="batch-actions sale-document-options" role="group" aria-labelledby="sale-document-label">${["Factura","Recibo"].map(type=>`<button type="button" class="${s.type===type?"primary":"secondary"}" data-sale-action="select-document" data-document="${type}" aria-pressed="${s.type===type}">${type.toUpperCase()}</button>`).join("")}</div>`;
    body=`<form id="sales-form"><fieldset ${s.busy||s.uncertain?"disabled":""}>${summary}<p class="sales-total" id="sale-total">Total: ${saleMoney(saleTotal(s.items))}</p>${reviewing?"":customer?customerFields:documentField}${customer?'<p>Confirma os dados do cliente antes de guardar a venda.</p>':""}<div class="batch-actions sale-review-actions">${actions}</div></fieldset></form>`;
  }
  if (s.uncertain) body += `<p>O resultado do envio não foi confirmado. Verifica o registo antes de tentar novamente.</p><button data-sale-action="verify">Verificar gravação</button>`;
  return `<section class="sales-page">${s.busy?"<p role='status'>A processar…</p>":""}${s.error?`<p class="sales-error" role="alert">${e(s.error)}</p>`:""}${body}</section>`;
}
function renderSalesPage() {
  const app=document.querySelector("#app");
  if (state.scannerOpen && app.querySelector(".camera-scanner")) app.querySelector(".app-content").innerHTML=salesMarkup();
  else app.innerHTML=`${headerMarkup()}<div class="app-content">${salesMarkup()}</div>${state.scannerOpen?scannerMarkup():""}`;
  setupMobileConcludeButton();
}
async function salesRequest(path, body) {
  if (!state.loggedIn || !state.accessToken) throw new Error("Inicia sessão com Google para gerir vendas.");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`, {method:body?"POST":"GET",headers:{Authorization:`Bearer ${state.accessToken}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{cache:"no-store"})});
  if (!response.ok) throw new Error(response.status===401?"A sessão Google expirou. Inicia sessão novamente.":response.status===403?"A conta Google não tem permissão para esta operação.":`Não foi possível aceder às vendas (${response.status}).`);
  return response.json();
}
async function saleValues(range) { return (await salesRequest(`/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`)).values || []; }
function saleCells(values) { return {values:values.map(v=>({userEnteredValue:typeof v === "number"?{numberValue:v}:{stringValue:String(v??"")}}))}; }
function saleMovementCells(values) {
  const row=[...values],reference=String(row[3]??"").trim(),number=Number(reference);
  // Match USER_ENTERED movements without changing literal IDs, EANs or custom article codes.
  if (/^(0|[1-9][0-9]*)$/.test(reference) && Number.isSafeInteger(number) && String(number)===reference) row[3]=number;
  return saleCells(row);
}
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
  return {sale:[id,timestamp,s.type,c.name,[c.address,c.address2].filter(value=>String(value||"").trim()).join("\n"),c.email,c.phone,c.tax,saleTotal(s.items)/100,s.type==="Factura"?"Pendente":"Não aplicável","",state.userEmail,saleSellerText()],lines,movements};
}
async function saveSale() {
  const s=salesState;
  validateSaleItems(s.items);
  if (!["Factura","Recibo"].includes(s.type) || saleRequiredCustomerFields(s.type).some(k=>!String(s.customer[k]||"").trim())) throw new Error(s.type==="Factura"?"Preenche o nome e o NIF do cliente.":s.type==="Recibo"?"Preenche o nome do cliente.":"Seleciona o documento.");
  if (!s.id) s.id=createMovementId();
  const sheets=await prepareSalesSheets();
  const existing=await saleValues("Vendas!A2:M");
  const duplicate=existing.find(r=>r[0]===s.id);
  if (duplicate) { s.saved=duplicate;s.lines=await saleValues("VendasLinhas!A2:H");s.phase="saved";s.uncertain=false;return; }
  const rows=buildSaleRows(await loadMovementStockRows(),s.id,createMovementTimestamp());
  s.uncertain=true;s.submittedAt=Date.now();persistSaleDraft();
  await salesRequest(":batchUpdate",{requests:[["Movimentos",rows.movements],["Vendas",[rows.sale]],["VendasLinhas",rows.lines]].map(([name,values])=>({appendCells:{sheetId:findSheetByName(sheets,name).properties.sheetId,rows:values.map(name==="Movimentos"?saleMovementCells:saleCells),fields:"userEnteredValue"}}))});
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
  if (el.dataset.salePendingPrice !== undefined && s.pending) {s.pending.item.price=el.value;const ok=el.parentElement?.querySelector(".sale-price-ok");if(ok){ok.hidden=!el.value.trim();ok.disabled=!canAcceptSalePrice();}}
  if (el.dataset.salePendingLocation !== undefined && s.pending) setSaleLocation("pending",Number(el.dataset.salePendingLocation),el.value);
  if (el.dataset.saleCustomer) s.customer[el.dataset.saleCustomer]=el.value;
  if (el.dataset.saleField) {s[el.dataset.saleField]=el.value;if(s.phase==="list")s.searched=false;if (["type","from","to","filter","integration"].includes(el.dataset.saleField)) render();}
  if (el.dataset.salePrice!==undefined) s.items[Number(el.dataset.salePrice)].price=el.value;
  if (el.dataset.saleItem!==undefined) setSaleLocation(el.dataset.saleItem,Number(el.dataset.location),el.value);
  if(el.dataset.saleItem!==undefined || el.dataset.salePendingLocation!==undefined) {
    const item=el.dataset.salePendingLocation!==undefined?s.pending?.item:s.items[Number(el.dataset.saleItem)];
    const quantity=el.closest(".sale-item")?.querySelector(".batch-inline-qty>strong");
    if(item&&quantity)quantity.textContent=Object.values(item.allocations).reduce((sum,q)=>sum+Number(q||0),0);
    if(item)el.closest(".sale-item")?.querySelectorAll(".sale-location-input").forEach(input=>{
      const location=item.locations[Number(input.dataset.salePendingLocation??input.dataset.location)];
      if(location)input.value=item.allocations[location.storage]||0;
    });
  }
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
    if(salesState.phase==="review") {validateSaleItems(salesState.items);salesState.type="";salesState.phase="document";}
    else if(salesState.phase==="document")continueSaleDocument();
    else if(salesState.phase==="customer")await saveSale();
  });
});
document.addEventListener("click",async event=>{
  const button=event.target.closest("[data-sale-action]");if(!button||salesState.busy)return;
  const action=button.dataset.saleAction,s=salesState;
  if(s.uncertain&&!["verify","resume"].includes(action))return;
  if(s.pending&&!["cancel-price","accept-price","resume","qty-increase","qty-decrease","location-increase","location-decrease","image","edit-price","new","continue-draft","restart-draft"].includes(action))return;
  if(action==="accept-price"){if(!canAcceptSalePrice())return;const input=document.querySelector("#sale-pending-price");if(!input||!input.reportValidity())return;try{validateSaleItems([s.pending.item]);s.pending.acceptedPrice=String(s.pending.item.price);button.disabled=true;persistSaleDraft();input.blur();button.blur();}catch(error){s.error=error.message;render();}return;}
  if(action==="cancel") {
    if(s.items.length&&!await confirmRemoval("Cancelar esta venda e apagar o rascunho?"))return;
    state.query="";Object.assign(s,{items:[],customer:{},type:"",phase:"scan",pending:null,id:"",saved:null,error:"",showMenu:true});persistSaleDraft();render();return;
  }
  if(action==="location-increase"||action==="location-decrease")adjustSaleLocation(button.dataset.index,button.dataset.location,action==="location-increase"?1:-1);
  if(action==="qty-increase"||action==="qty-decrease")adjustSaleQuantity(button.dataset.index,action==="qty-increase"?1:-1);
  if(action==="edit-price")openSalePriceDialog(button.dataset.index);
  if(action==="image")openBatchImage(button.dataset.index==="pending"?s.pending?.item:s.items[Number(button.dataset.index)]);

  if(action==="resume"||action==="continue-draft"){resumeSaleDraft();return;}
  if(action==="restart-draft"){startNewSale();return;}
  if(action==="new"){requestNewSale();return;}
  if(action==="edit" || action==="review"){s.phase="review";persistSaleDraft();render();}
  if(action==="select-document" && s.phase==="document" && ["Factura","Recibo"].includes(button.dataset.document)){s.type=button.dataset.document;persistSaleDraft();render();document.querySelector(`[data-sale-action="select-document"][data-document="${s.type}"]`)?.focus({preventScroll:true});return;}
  if(action==="document-back"){s.type="";s.phase="document";persistSaleDraft();render();}
  if(action==="scan"){state.query="";s.phase="scan";persistSaleDraft();render();}
  if(action==="checkout")void salesWork(async()=>{validateSaleItems(s.items);s.type="";s.phase="document";});
  if(action==="cancel-price"){s.pending=null;s.error="";persistSaleDraft();render();}
  if(action==="remove"){s.items.splice(Number(button.dataset.index),1);persistSaleDraft();render();}
  if(action==="print")printSale(s.saved);
  if(action==="reprint")printSale(s.rows.find(r=>r[0]===button.dataset.id));
  if(action==="csv")exportSalesCSV();
  if(action==="list"){s.showMenu=false;s.phase="list";s.searched=false;s.rows=[];s.lines=[];render();return;}
  if(action==="search" && s.phase==="list")void salesWork(async()=>{const sheets=await loadSpreadsheetSheetMetadata();s.rows=findSheetByName(sheets,"Vendas")?await saleValues("Vendas!A2:M"):[];s.lines=findSheetByName(sheets,"VendasLinhas")?await saleValues("VendasLinhas!A2:H"):[];s.searched=true;});
  if(action==="verify")void salesWork(async()=>{const rows=await saleValues("Vendas!A2:M"),found=rows.find(r=>r[0]===s.id);if(found){s.saved=found;s.lines=await saleValues("VendasLinhas!A2:H");s.phase="saved";s.uncertain=false;}else if(Date.now()-(s.submittedAt||0)<185000){s.error="O pedido anterior ainda pode estar em processamento. Aguarda três minutos desde o envio e verifica novamente.";}else{s.uncertain=false;s.error="Venda não encontrada. Podes voltar a confirmar; o ID será mantido para evitar duplicações.";}});
});

document.addEventListener("keydown",event=>{
  if(state.mode==="vendas" && (event.key==="Enter"||event.key===" ") && event.target.matches?.(".sales-scan-panel .batch-mini-list [data-sale-action=review]")){event.preventDefault();event.target.click();return;}
  if(state.mode!=="vendas" || salesState.showMenu || salesState.confirmNew || salesState.phase!=="scan" || salesState.pending || salesState.busy || salesState.uncertain || state.scannerOpen || !state.loggedIn || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
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
