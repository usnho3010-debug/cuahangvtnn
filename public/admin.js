const $=(s,root=document)=>root.querySelector(s);
const money=v=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(v)||0);
const text=(n,v)=>{if(n)n.textContent=String(v??'')};
const el=(tag,cls,v)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(v!==undefined)n.textContent=String(v);return n};
const state={page:'overview',settings:{},products:[],orders:[],contacts:[],stats:{},productImages:[],activeOrder:null};
async function api(path,options={}){
  const response=await fetch('/api'+path,{credentials:'same-origin',...options});
  const payload=await response.json().catch(()=>({ok:false,error:'Lỗi phản hồi từ máy chủ'}));
  if(!response.ok||!payload.ok)throw Error(payload.error||'Không thể kết nối');
  return payload.data;
}
function notice(message,bad=false){
  const n=$('#adminAlert');n.hidden=false;text(n,message);n.style.background=bad?'#fff0ec':'#ebf3df';n.style.color=bad?'#9e3b2e':'#225538';
  clearTimeout(notice.timer);notice.timer=setTimeout(()=>n.hidden=true,5500);
}
function td(content){
  const t=document.createElement('td');
  if(content instanceof Node)t.append(content);else text(t,content);
  return t;
}
function button(label,action){
  const b=el('button','',label);b.type='button';b.onclick=action;return b;
}
function row(cells){
  const tr=document.createElement('tr');cells.forEach(c=>tr.append(td(c)));return tr;
}
async function googleAuth(){
  let config;
  try{config=await api('/config')}catch(e){text($('#loginMessage'),e.message);return}
  if(!config.googleClientId){text($('#loginMessage'),'Chưa cấu hình GOOGLE_CLIENT_ID trên Netlify.');return}
  for(let i=0;i<40&&!window.google?.accounts?.id;i++)await new Promise(resolve=>setTimeout(resolve,250));
  if(!window.google?.accounts?.id){text($('#loginMessage'),'Chưa tải được dịch vụ đăng nhập Google.');return}
  google.accounts.id.initialize({client_id:config.googleClientId,callback:async result=>{
    text($('#loginMessage'),'Đang xác thực tài khoản...');
    try{const u=await api('/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({credential:result.credential})});showApp(u)}
    catch(e){text($('#loginMessage'),e.message)}
  }});
  google.accounts.id.renderButton($('#googleButton'),{theme:'outline',size:'large',shape:'pill',text:'signin_with',width:285});
}
async function showApp(user){
  $('#loginPanel').hidden=true;$('#adminApp').hidden=false;
  text($('#adminEmail'),user.email);
  await go('overview');
}
function setPage(page){
  state.page=page;
  document.querySelectorAll('.admin-view').forEach(n=>n.hidden=n.id!=='view'+page[0].toUpperCase()+page.slice(1));
  document.querySelectorAll('#adminNav button').forEach(n=>n.classList.toggle('active',n.dataset.view===page));
  text($('#pageTitle'),{overview:'Tổng quan',products:'Sản phẩm',orders:'Đơn hàng',contacts:'Khách liên hệ',settings:'Cấu hình cửa hàng'}[page]||page);
  $('.admin-sidebar').classList.remove('open');
}
async function go(page){
  setPage(page);
  try{
    if(page==='overview'){state.stats=await api('/admin/stats');renderStats()}
    if(page==='products'){state.products=await api('/admin/products');renderProducts()}
    if(page==='orders'){state.orders=await api('/admin/orders');renderOrders()}
    if(page==='contacts'){state.contacts=await api('/admin/contacts');renderContacts()}
    if(page==='settings'){state.settings=await api('/admin/settings');renderSettings()}
  }catch(e){notice('Không tải được dữ liệu: '+e.message,true)}
}
function renderStats(){
  const values=[
    ['Tổng đơn hàng',state.stats.orders||0],
    ['Đơn hôm nay',state.stats.today||0],
    ['Chờ xác nhận',state.stats.pending||0],
    ['Doanh thu đơn hoàn tất',money(state.stats.revenue||0)],
    ['Đơn hoàn tất',state.stats.completed||0],
    ['Đơn đã hủy',state.stats.cancelled||0],
    ['Giá trị đơn tạo',money(state.stats.totalOrderValue||0)],
    ['Sản phẩm quản lý',state.stats.products||0]
  ];
  $('#statCards').replaceChildren(...values.map(([label,val])=>{
    const card=el('div','stat-card');card.append(el('small','',label),el('strong','',val));return card;
  }));
}
function pill(s){
  const textValue=s===true?'Đang bán':s===false?'Đã ẩn':({NEW:'Mới',CONFIRMED:'Đã xác nhận',PACKING:'Đang đóng gói',SHIPPING:'Đang giao',COMPLETED:'Hoàn tất',CANCELLED:'Đã hủy'})[s]||s;
  return el('span','pill'+(s===false||s==='CANCELLED'?' off':''),textValue);
}
function renderProducts(){
  const list=state.products||[];
  $('#productRows').replaceChildren(...list.map(p=>{
    const title=el('div');title.append(el('strong','',p.name));
    if(!p.verified)title.append(el('small','pill off',' Chưa kiểm duyệt'));
    return row([title,el('span','',p.sku+' · '+p.pack),money(p.price),p.stock,pill(p.active&&p.verified),button('Sửa',()=>editProduct(p))]);
  }));
  if(!list.length)$('#productRows').append(row(['Chưa có sản phẩm. Nhấn “Thêm sản phẩm” để bắt đầu.','','','','','']));
}
function editProduct(p={}){
  const form=$('#productForm');form.reset();state.productImages=Array.isArray(p.images)?[...p.images]:[];
  for(const name of ['id','name','sku','category','brand','pack','ingredients','price','stock','registrationRef','description','safety']){
    const input=form.elements.namedItem(name);if(input)input.value=p[name]??(name==='price'||name==='stock'?0:'');
  }
  form.elements.namedItem('active').checked=p.active===true;
  form.elements.namedItem('featured').checked=p.featured===true;
  form.elements.namedItem('verified').checked=p.verified===true;
  text($('#productDialogTitle'),p.id?'Chỉnh sửa sản phẩm':'Thêm sản phẩm');
  text($('#productMessage'),'');
  showProductImages();$('#productDialog').showModal();
}
function showProductImages(){
  const t=$('#productImagesText');t.replaceChildren();
  text(t,state.productImages.length?state.productImages.length+' ảnh đã tải: ':'Chưa có ảnh.');
  if(state.productImages.length){
    const buttonRemove=button('Xóa tất cả ảnh',()=>{state.productImages=[];showProductImages()});
    buttonRemove.style.marginLeft='10px';t.append(buttonRemove);
  }
}
async function upload(file){
  if(!file||file.size>4_000_000)throw Error('Ảnh vượt quá 4 MB');
  const form=new FormData();form.set('image',file);
  return api('/admin/images',{method:'POST',body:form});
}
async function handleProductSubmit(e){
  e.preventDefault();const form=e.currentTarget;
  const save=$('button[type=submit]',form);save.disabled=true;
  text($('#productMessage'),'Đang lưu...');
  try{
    const data=Object.fromEntries(new FormData(form));
    data.price=Number(data.price);data.stock=Number(data.stock);
    data.verified=form.elements.namedItem('verified').checked;
    data.active=form.elements.namedItem('active').checked;
    data.featured=form.elements.namedItem('featured').checked;
    data.images=state.productImages;
    await api('/admin/products',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
    $('#productDialog').close();notice('Sản phẩm đã được lưu.');await go('products');
  }catch(ex){text($('#productMessage'),ex.message)}
  finally{save.disabled=false}
}
function renderOrders(){
  $('#orderRows').replaceChildren(...(state.orders||[]).map(o=>{
    const cell=el('div');cell.append(el('strong','',o.id),el('small','',String(o.createdAt).slice(0,16).replace('T',' ')));
    const customer=el('div');customer.append(el('strong','',o.customerName),el('small','',o.phone));
    return row([cell,customer,money(o.total),pill(o.status),button('Chi tiết',()=>showOrder(o))]);
  }));
  if(!state.orders?.length)$('#orderRows').append(row(['Chưa có đơn hàng.','','','','']));
}
const nextStatus={NEW:['CONFIRMED','CANCELLED'],CONFIRMED:['PACKING','CANCELLED'],PACKING:['SHIPPING','CANCELLED'],SHIPPING:['COMPLETED','CANCELLED'],COMPLETED:[],CANCELLED:[]};
const labels={CONFIRMED:'Xác nhận',PACKING:'Đóng gói',SHIPPING:'Đang giao',COMPLETED:'Hoàn tất',CANCELLED:'Hủy đơn'};
function showOrder(o){
  state.activeOrder=o.id;
  const target=$('#orderDetails');target.replaceChildren();
  target.append(el('h2','',o.id));
  const meta=el('div','order-meta');
  for(const [a,b] of [['Khách hàng',o.customerName],['Điện thoại',o.phone],['Địa chỉ',[o.address,o.region].filter(Boolean).join(' · ')],['Ngày đặt',o.createdAt],['Trạng thái',o.status],['Ghi chú',o.notes||'Không có']]){
    const m=el('div');m.append(el('small','',a),el('strong','',b));meta.append(m);
  }
  target.append(meta,el('h3','', 'Sản phẩm trong đơn'));
  for(const item of o.items||[])target.append(el('div','order-item',item.name+' ('+item.pack+') × '+item.qty+' · '+money(item.price)+' = '+money(item.lineTotal)));
  target.append(el('h3','', 'Tổng tiền hàng: '+money(o.total)));
  const actions=el('div','order-status');
  for(const status of nextStatus[o.status]||[]){
    const b=button(labels[status],async()=>{
      if(status==='CANCELLED'&&!confirm('Xác nhận hủy đơn '+o.id+'?'))return;
      b.disabled=true;
      try{
        await api('/admin/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:o.id,status})});
        $('#orderDialog').close();notice('Đã cập nhật trạng thái đơn hàng.');await go('orders');
      }catch(ex){notice(ex.message,true)}finally{b.disabled=false}
    });actions.append(b);
  }
  target.append(actions);$('#orderDialog').showModal();
}
function renderContacts(){
  $('#contactRows').replaceChildren(...(state.contacts||[]).map(c=>row([String(c.createdAt).slice(0,16),c.name,c.phone,c.question])));
  if(!state.contacts?.length)$('#contactRows').append(row(['Chưa có yêu cầu tư vấn','','','']));
}
function renderSettings(){
  const form=$('#settingsForm');
  for(const control of form.querySelectorAll('[name]')){
    if(control.name==='ordersEnabled')control.checked=state.settings.ordersEnabled===true;
    else control.value=state.settings[control.name]??(control.name==='primaryColor'?'#20624a':'');
  }
}
async function saveSettings(e){
  e.preventDefault();const form=e.currentTarget,submit=$('button[type=submit]',form);submit.disabled=true;text($('#settingsMessage'),'Đang lưu cấu hình...');
  try{
    const data=Object.fromEntries(new FormData(form));data.ordersEnabled=form.elements.namedItem('ordersEnabled').checked;
    await api('/admin/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
    text($('#settingsMessage'),'Đã lưu lúc '+new Date().toLocaleTimeString('vi-VN'));notice('Cấu hình cửa hàng đã cập nhật.');
  }catch(ex){text($('#settingsMessage'),ex.message);notice(ex.message,true)}
  finally{submit.disabled=false}
}
function csvDownload(){
  const keys=['id','createdAt','customerName','phone','address','region','subtotal','total','status'];
  const safe=v=>{let s=String(v??'');if(/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const lines=[keys.join(','),...(state.orders||[]).map(o=>keys.map(k=>safe(o[k])).join(','))];
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='don-hang-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function initEvents(){
  $('#adminNav').addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(b)go(b.dataset.view)});
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  $('#mobileMenu').onclick=()=>$('.admin-sidebar').classList.toggle('open');
  $('#logout').onclick=async()=>{await api('/auth/logout',{method:'POST'}).catch(()=>{});location.reload()};
  $('#newProduct').onclick=()=>editProduct();
  $('#productClose').onclick=()=>$('#productDialog').close();
  $('#orderClose').onclick=()=>$('#orderDialog').close();
  $('#productForm').onsubmit=handleProductSubmit;
  $('#settingsForm').onsubmit=saveSettings;
  $('#downloadOrders').onclick=csvDownload;
  $('#productImage').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    text($('#productImagesText'),'Đang tải ảnh...');
    try{const r=await upload(file);state.productImages.push(r.url);showProductImages()}catch(ex){text($('#productImagesText'),ex.message)}e.target.value='';
  };
  $('#brandingUpload').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    text($('#brandingUploadStatus'),'Đang tải...');
    try{
      const r=await upload(file);
      text($('#brandingUploadStatus'),'Đã tải: '+r.url+' (sao chép đường dẫn này vào ô Logo hoặc Banner).');
      const input=$('#settingsForm [name=logoUrl]');if(!input.value)input.value=r.url;
    }catch(ex){text($('#brandingUploadStatus'),ex.message)}e.target.value='';
  };
}
async function boot(){
  initEvents();
  try{const user=await api('/auth/me');await showApp(user)}
  catch{await googleAuth()}
}
boot();
