/**
 * Google Apps Script bound to a Google Sheet.
 * Script Properties: API_SHARED_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
 * Run initialize() as owner once, then deploy as Web App: execute as Me, access Anyone.
 * Signed requests are accepted only from the Netlify function holding API_SHARED_SECRET.
 */
const TABLES={
  Settings:['key','value'],
  Products:['id','sku','name','category','brand','ingredients','pack','description','safety','registrationRef','price','stock','active','verified','featured','images','createdAt','updatedAt'],
  Orders:['id','createdAt','customerName','phone','address','region','notes','items','subtotal','shipping','total','status','idempotencyKey','consentAt','updatedAt'],
  OrderEvents:['id','orderId','from','to','actor','note','at'],
  Contacts:['id','createdAt','name','phone','question','status','consentAt'],
  NotificationQueue:['id','orderId','text','attempt','nextRetry','status','error'],
  StockLedger:['id','sku','delta','reason','orderId','actor','at'],
  AuditLog:['id','actor','action','target','at']
};
const SETTINGS_FIELDS=['siteName','tagline','logoUrl','heroUrl','heroTitle','heroText','announcement','primaryColor','address','mapUrl','hotline','zalo','email','facebook','hours','serviceArea','aboutText','shippingPolicy','returnPolicy','privacyPolicy','terms','footerNote','seoTitle','seoDescription','shippingNote','ordersEnabled'];
function spreadsheet(){const p=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');return p?SpreadsheetApp.openById(p):SpreadsheetApp.getActiveSpreadsheet()}
function table(name){
  const ss=spreadsheet(), sheet=ss.getSheetByName(name);
  if(!sheet)throw Error('Chưa khởi tạo sheet '+name);
  return sheet;
}
function initialize(){
  const ss=spreadsheet();Object.keys(TABLES).forEach(name=>{
    let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);
    const cols=TABLES[name];
    if(sh.getLastRow()===0)sh.getRange(1,1,1,cols.length).setValues([cols]);
    sh.setFrozenRows(1);
  });
  const s=table('Settings');if(s.getLastRow()===1) {
    s.getRange(2,1,3,2).setValues([
      ['siteName',JSON.stringify('Cửa hàng vật tư nông nghiệp')],
      ['primaryColor',JSON.stringify('#20624a')],
      ['ordersEnabled',JSON.stringify(false)]
    ]);
  }
  const existing=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='processNotifications');
  if(!existing)ScriptApp.newTrigger('processNotifications').timeBased().everyMinutes(1).create();
}
function rows(name){
  const sh=table(name),last=sh.getLastRow();
  if(last<2)return [];
  const keys=TABLES[name],values=sh.getRange(2,1,last-1,keys.length).getValues();
  return values.map((values,i)=>({row:i+2,...Object.fromEntries(keys.map((key,j)=>[key,values[j]]))}));
}
function safeText(v,max){
  const s=String(v??'').trim().slice(0,max);
  return /^[=+@\-]/.test(s)?"'"+s:s;
}
function append(name,obj){
  const keys=TABLES[name];table(name).appendRow(keys.map(k=>obj[k]??''));return obj;
}
function setRow(name,row,obj){
  const cols=TABLES[name],sh=table(name);
  sh.getRange(row,1,1,cols.length).setValues([cols.map(k=>obj[k]??'')]);
}
function uid(){return Utilities.getUuid()}
function iso(){return new Date().toISOString()}
function parsed(x,fallback){try{return JSON.parse(String(x))}catch{return fallback}}
function settings(){
  const s={ordersEnabled:false,siteName:'Cửa hàng vật tư nông nghiệp',primaryColor:'#20624a'};
  rows('Settings').forEach(r=>{if(SETTINGS_FIELDS.indexOf(String(r.key))>=0)s[r.key]=parsed(r.value,'')});
  return s;
}
function products(){return rows('Products').map(({row,...p})=>({...p,price:Number(p.price)||0,stock:Number(p.stock)||0,active:p.active===true||p.active==='true',verified:p.verified===true||p.verified==='true',featured:p.featured===true||p.featured==='true',images:parsed(p.images,[])}))}
function publicSite(){
  const list=products().filter(p=>p.active&&p.verified).map(({createdAt,updatedAt,...p})=>p);
  const s=settings();
  return {settings:s,products:list,categories:[...new Set(list.map(p=>p.category).filter(Boolean))].sort()};
}
function updateSettings(input){
  const data=input||{}, old=settings(),actor=safeText(data.actor,150);
  const clean={...old};
  SETTINGS_FIELDS.forEach(k=>{
    if(Object.prototype.hasOwnProperty.call(data,k)){
      clean[k]=k==='ordersEnabled'?data[k]===true:safeText(data[k],6000);
    }
  });
  const sh=table('Settings');const output=SETTINGS_FIELDS.filter(k=>Object.prototype.hasOwnProperty.call(clean,k)).map(k=>[k,JSON.stringify(clean[k])]);
  if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,2).clearContent();
  if(output.length)sh.getRange(2,1,output.length,2).setValues(output);
  audit(actor,'settings.save','store');
  return clean;
}
function saveProduct(input){
  const p=input||{},actor=safeText(p.actor,150);
  const existing=rows('Products'),id=String(p.id||uid()),old=existing.find(x=>x.id===id);
  if(existing.some(x=>x.sku===p.sku&&x.id!==id))throw Error('Mã SKU đã tồn tại');
  if(!p.name||!p.sku||!p.pack)throw Error('Thiếu dữ liệu sản phẩm');
  if(p.active===true&&p.verified!==true)throw Error('Chỉ hiển thị sản phẩm đã kiểm tra điều kiện kinh doanh');
  const now=iso();
  const obj={...p,id,sku:safeText(p.sku,250),name:safeText(p.name,250),
    category:safeText(p.category,250),brand:safeText(p.brand,250),ingredients:safeText(p.ingredients,250),
    pack:safeText(p.pack,250),description:safeText(p.description,5000),
    safety:safeText(p.safety,5000),registrationRef:safeText(p.registrationRef,250),
    price:Math.floor(Number(p.price)),stock:Math.floor(Number(p.stock)),
    active:p.active===true,verified:p.verified===true,featured:p.featured===true,
    images:JSON.stringify(Array.isArray(p.images)?p.images.slice(0,8):[]),
    createdAt:old?.createdAt||now,updatedAt:now};
  delete obj.actor;
  if(!Number.isSafeInteger(obj.price)||obj.price<0||!Number.isSafeInteger(obj.stock)||obj.stock<0)throw Error('Giá và số tồn không hợp lệ');
  if(old)setRow('Products',old.row,obj);else append('Products',obj);
  audit(actor,'products.save',id);return {id};
}
function deleteProduct(p){
  const item=rows('Products').find(x=>x.id===p.id);if(!item)throw Error('Không tìm thấy sản phẩm');
  item.active=false;item.updatedAt=iso();setRow('Products',item.row,item);
  audit(safeText(p.actor,150),'products.delete',item.id);return {id:item.id};
}
function digits(v){return String(v||'').replace(/[\s().-]/g,'')}
function validateContact(name,phone){
  if(String(name||'').trim().length<2||String(name).length>80)throw Error('Tên người nhận phải từ 2 đến 80 ký tự');
  if(!/^(0\d{9}|\+84\d{9})$/.test(digits(phone)))throw Error('Số điện thoại Việt Nam không hợp lệ');
}
function createOrder(input){
  const data=input||{},s=settings();
  if(!s.ordersEnabled)throw Error('Cửa hàng chưa mở chức năng đặt hàng');
  validateContact(data.customerName,data.phone);
  if(data.consent!==true)throw Error('Cần xác nhận đồng ý xử lý thông tin đơn hàng');
  if(!/^[a-z0-9-]{20,100}$/i.test(String(data.idempotencyKey||'')))throw Error('Mã yêu cầu đặt hàng không hợp lệ');
  const previous=rows('Orders').find(o=>o.idempotencyKey===data.idempotencyKey);
  if(previous)return {id:previous.id,total:previous.total,status:previous.status,duplicate:true};
  const requested=data.items;
  if(!Array.isArray(requested)||!requested.length||requested.length>12)throw Error('Giỏ hàng phải có từ 1 đến 12 loại sản phẩm');
  const catalog=products().filter(p=>p.active&&p.verified);
  const found=new Set(),lines=[];
  requested.forEach(item=>{
    const id=String(item.id||''),qty=Number(item.qty);
    if(found.has(id)||!Number.isSafeInteger(qty)||qty<1||qty>50)throw Error('Số lượng sản phẩm không hợp lệ');
    found.add(id);const p=catalog.find(x=>x.id===id);
    if(!p)throw Error('Sản phẩm không còn được bán');
    if(qty>p.stock)throw Error('Sản phẩm '+p.name+' không đủ tồn kho');
    lines.push({id:p.id,sku:p.sku,name:p.name,pack:p.pack,qty,price:p.price,lineTotal:p.price*qty});
  });
  const subtotal=lines.reduce((sum,x)=>sum+x.lineTotal,0);
  if(!Number.isSafeInteger(subtotal)||subtotal>1000000000)throw Error('Đơn vượt giới hạn hỗ trợ');
  const id='VT-'+Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyyMMdd')+'-'+uid().slice(0,8).toUpperCase(),now=iso();
  append('Orders',{id,createdAt:now,customerName:safeText(data.customerName,80),phone:safeText(digits(data.phone),20),
    address:safeText(data.address,300),region:safeText(data.region,150),notes:safeText(data.notes,700),
    items:JSON.stringify(lines),subtotal,shipping:0,total:subtotal,status:'NEW',
    idempotencyKey:String(data.idempotencyKey),consentAt:now,updatedAt:now});
  append('OrderEvents',{id:uid(),orderId:id,from:'',to:'NEW',actor:'customer',note:'Đơn mới',at:now});
  append('NotificationQueue',{id:uid(),orderId:id,
    text:'🛒 ĐƠN MỚI '+id+'\n'+lines.length+' loại sản phẩm / '+lines.reduce((t,x)=>t+x.qty,0)+' món\nTạm tính: '+subtotal.toLocaleString('vi-VN')+' đ\nXem chi tiết trong trang Admin.',
    attempt:0,nextRetry:now,status:'PENDING',error:''});
  return {id,total:subtotal,status:'NEW'};
}
const transitions={NEW:['CONFIRMED','CANCELLED'],CONFIRMED:['PACKING','CANCELLED'],PACKING:['SHIPPING','CANCELLED'],SHIPPING:['COMPLETED','CANCELLED'],COMPLETED:[],CANCELLED:[]};
function updateOrder(p){
  const o=rows('Orders').find(r=>r.id===p.id);if(!o)throw Error('Không tìm thấy đơn hàng');
  const status=String(p.status||''),from=o.status;
  if(!transitions[from]||transitions[from].indexOf(status)<0)throw Error('Không thể chuyển trạng thái '+from+' → '+status);
  const line=parsed(o.items,[]);
  if(from==='NEW'&&status==='CONFIRMED'){
    const list=rows('Products');
    line.forEach(x=>{const found=list.find(v=>v.id===x.id);if(!found||Number(found.stock)<x.qty)throw Error('Không đủ tồn kho: '+x.name)});
    line.forEach(x=>{const found=list.find(v=>v.id===x.id);found.stock=Number(found.stock)-x.qty;setRow('Products',found.row,found);
      append('StockLedger',{id:uid(),sku:x.sku,delta:-x.qty,reason:'order_confirm',orderId:o.id,actor:safeText(p.actor,150),at:iso()});
    });
  }
  if(status==='CANCELLED'&&from!=='NEW'){
    const list=rows('Products');
    line.forEach(x=>{const found=list.find(v=>v.id===x.id);if(!found)return;
      found.stock=Number(found.stock)+x.qty;setRow('Products',found.row,found);
      append('StockLedger',{id:uid(),sku:x.sku,delta:x.qty,reason:'order_cancel',orderId:o.id,actor:safeText(p.actor,150),at:iso()});
    });
  }
  o.status=status;o.updatedAt=iso();setRow('Orders',o.row,o);
  append('OrderEvents',{id:uid(),orderId:o.id,from,to:status,actor:safeText(p.actor,150),note:safeText(p.note,250),at:iso()});
  audit(safeText(p.actor,150),'orders.update',o.id+' '+status);
  return {id:o.id,status};
}
function orderList(){return rows('Orders').map(({row,...o})=>({...o,items:parsed(o.items,[])})).reverse().slice(0,1000)}
function contactList(){return rows('Contacts').map(({row,...o})=>o).reverse().slice(0,1000)}
function createContact(p){
  validateContact(p.name,p.phone);if(p.consent!==true)throw Error('Cần xác nhận đồng ý xử lý thông tin');
  if(!String(p.question||'').trim()||String(p.question).length>1200)throw Error('Nội dung tư vấn không hợp lệ');
  const id=uid();append('Contacts',{id,createdAt:iso(),name:safeText(p.name,80),phone:safeText(digits(p.phone),20),question:safeText(p.question,1200),status:'NEW',consentAt:iso()});
  append('NotificationQueue',{id:uid(),orderId:id,text:'📞 Yêu cầu tư vấn mới. Mã: '+id.slice(0,8)+'\nXem trong Admin.',attempt:0,nextRetry:iso(),status:'PENDING',error:''});
  return {id};
}
function stats(){
  const list=rows('Orders'),completed=list.filter(o=>o.status==='COMPLETED');
  const today=Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd');
  return {orders:list.length,today:list.filter(o=>String(o.createdAt).slice(0,10)===today).length,
    pending:list.filter(o=>o.status==='NEW').length,completed:completed.length,cancelled:list.filter(o=>o.status==='CANCELLED').length,
    revenue:completed.reduce((t,o)=>t+Number(o.total||0),0),
    totalOrderValue:list.reduce((t,o)=>t+Number(o.total||0),0),products:rows('Products').length};
}
function audit(actor,action,target){append('AuditLog',{id:uid(),actor,action,target,at:iso()})}
function route(a,d){
  switch(a){
    case 'site.get':return publicSite();
    case 'settings.get':return settings();
    case 'settings.save':return updateSettings(d);
    case 'products.list':return products();
    case 'products.save':return saveProduct(d);
    case 'products.delete':return deleteProduct(d);
    case 'orders.create':return createOrder(d);
    case 'orders.list':return orderList();
    case 'orders.update':return updateOrder(d);
    case 'contacts.create':return createContact(d);
    case 'contacts.list':return contactList();
    case 'stats.get':return stats();
    default:throw Error('Tác vụ không được hỗ trợ');
  }
}
function response(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
function doGet(){return response({ok:false,error:'Use signed POST requests'})}
function doPost(e){
  let lock;
  try{
    const envelope=JSON.parse(e.postData.contents||'{}'),raw=String(envelope.body||''),sig=String(envelope.sig||'');
    if(raw.length>60000)throw Error('Yêu cầu quá lớn');
    const secret=PropertiesService.getScriptProperties().getProperty('API_SHARED_SECRET');
    if(!secret)throw Error('API_SHARED_SECRET chưa được cấu hình');
    const bytes=Utilities.computeHmacSha256Signature(raw,secret);
    const expected=Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
    if(sig!==expected)throw Error('Chữ ký không hợp lệ');
    const call=JSON.parse(raw);
    if(!Number.isFinite(call.ts)||Math.abs(Date.now()-call.ts)>300000||!/^[0-9a-f-]{36}$/.test(String(call.nonce||'')))throw Error('Yêu cầu hết hạn');
    lock=LockService.getScriptLock();lock.waitLock(20000);
    const cache=CacheService.getScriptCache();
    if(cache.get('nonce:'+call.nonce))throw Error('Yêu cầu đã được xử lý');
    cache.put('nonce:'+call.nonce,'1',360);
    const data=route(String(call.action||''),call.data||{});
    return response({ok:true,data});
  }catch(ex){return response({ok:false,error:String(ex.message||ex).slice(0,240),status:400})}
  finally{if(lock)lock.releaseLock()}
}
function processNotifications(){
  const p=PropertiesService.getScriptProperties(),token=p.getProperty('TELEGRAM_BOT_TOKEN'),chat=p.getProperty('TELEGRAM_CHAT_ID');
  if(!token||!chat)return;
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try {
    const now=Date.now(),pending=rows('NotificationQueue').filter(r=>r.status==='PENDING'&&new Date(r.nextRetry).getTime()<=now).slice(0,10);
    pending.forEach(r=>{
      try{
        const reply=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/sendMessage',{
          method:'post',contentType:'application/json',
          payload:JSON.stringify({chat_id:chat,text:String(r.text),disable_web_page_preview:true}),muteHttpExceptions:true});
        if(reply.getResponseCode()!==200||!parsed(reply.getContentText(),{}).ok)throw Error('Telegram HTTP '+reply.getResponseCode());
        r.status='SENT';r.error='';
      }catch(ex){
        r.attempt=Number(r.attempt||0)+1;
        r.nextRetry=new Date(now+Math.min(3600,Math.pow(2,Math.min(r.attempt,9))*60)*1000).toISOString();
        r.error=String(ex.message||ex).slice(0,100);
      }
      setRow('NotificationQueue',r.row,r);
    });
  }finally{lock.releaseLock()}
}
