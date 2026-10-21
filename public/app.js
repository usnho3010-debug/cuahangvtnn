const $=(s,root=document)=>root.querySelector(s);
const money=v=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(v)||0);
const state={site:{},products:[],category:'',cart:loadCart(),config:{},checkoutId:null,captcha:{}};
function loadCart(){try{const v=JSON.parse(localStorage.getItem('vt_cart')||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}}
function saveCart(){localStorage.setItem('vt_cart',JSON.stringify(state.cart));renderCart()}
async function api(path,options={}){
  const res=await fetch('/api'+path,{credentials:'same-origin',...options});
  const body=await res.json().catch(()=>({ok:false,error:'Lỗi phản hồi máy chủ'}));
  if(!res.ok||!body.ok)throw Error(body.error||'Không thể kết nối máy chủ');
  return body.data;
}
const text=(node,value)=>{if(node)node.textContent=String(value??'')};
const node=(name,cls,textValue)=>{const n=document.createElement(name);if(cls)n.className=cls;if(textValue!==undefined)n.textContent=String(textValue);return n};
const placeholder=()=>node('span','product-fallback','🌿');
function imageOrFallback(src,parent){
  if(src&&(/^(https:\/\/|\/api\/media\/)/i).test(src)){
    const img=document.createElement('img');img.loading='lazy';img.alt='Ảnh sản phẩm';img.src=src;
    img.onerror=()=>{img.remove();parent.append(placeholder())};parent.append(img);
  }else parent.append(placeholder());
}
function urlHref(raw){
  if(!raw)return '';
  try {const url=new URL(raw);return url.protocol==='https:'?url.href:''}catch{return ''}
}
function makeContact(type,caption,value,href){
  if(!value)return;
  const n=node(href?'a':'div','',type+'  '+caption+': '+value);
  if(href){n.href=href;n.target=href.startsWith('https:')?'_blank':'_self';if(n.target==='_blank')n.rel='noopener noreferrer'}
  $('#contactDetails').append(n);
}
function initializeSite(site){
  state.site=site.settings||{};
  state.products=(site.products||[]).filter(p=>p&&p.active&&p.verified);
  const s=state.site;
  const title=s.siteName||'Cửa hàng vật tư nông nghiệp';
  text($('#brandName'),title.toUpperCase());text($('#brandTag'),s.tagline||'Đồng hành cùng nhà nông');
  text($('#footerName'),title.toUpperCase());text($('#footerCopyright'),title);
  text($('#footerNote'),s.footerNote||s.tagline||'Đồng hành cùng nhà nông');
  if(s.heroTitle)text($('#heroTitle'),s.heroTitle);
  if(s.heroText)text($('#heroText'),s.heroText);
  if(s.aboutText)text($('#aboutText'),s.aboutText);
  const a=$('#announce');if(s.announcement){text(a,s.announcement);a.hidden=false}
  if(s.primaryColor&&/^#[0-9a-f]{6}$/i.test(s.primaryColor))document.documentElement.style.setProperty('--forest',s.primaryColor);
  if(s.heroUrl&&urlHref(s.heroUrl)){const v=$('#heroVisual');v.style.background='url("'+s.heroUrl.replace(/["()\\]/g,'')+'") center/cover';$('.hero-graphic',v)?.remove();}
  if(s.logoUrl&&(/^(https:\/\/|\/api\/media\/)/.test(s.logoUrl))){
    document.querySelectorAll('.brand-icon').forEach(v=>{
      v.textContent='';const img=document.createElement('img');img.src=s.logoUrl;img.alt='Logo';img.style.cssText='width:100%;height:100%;object-fit:contain;border-radius:inherit';v.append(img);
    });
  }
  document.title=(s.seoTitle||title+' · Vật tư nông nghiệp');
  const meta=$('meta[name=description]');if(s.seoDescription)meta.content=s.seoDescription;
  if(s.hotline){
    const phone=String(s.hotline).replace(/[^+0-9]/g,'');$('#phoneTop').href='tel:'+phone;$('#heroCall').href='tel:'+phone;
    makeContact('☎','Hotline',s.hotline,'tel:'+phone);
  }
  if(s.zalo){
    const zalo=urlHref(s.zalo)||'https://zalo.me/'+String(s.zalo).replace(/\D/g,'');
    makeContact('✉','Zalo','Nhắn tin Zalo',zalo);
  }
  makeContact('⌂','Địa chỉ',s.address,s.mapUrl?urlHref(s.mapUrl):'');
  makeContact('◷','Giờ mở cửa',s.hours,'');
  makeContact('✉','Email',s.email,s.email?'mailto:'+s.email:'');
  makeContact('◈','Khu vực phục vụ',s.serviceArea,'');
  text($('#footerContact'),[s.address,s.hotline,s.email].filter(Boolean).join(' · ')||'Đang cập nhật thông tin liên hệ');
  if(s.facebook&&urlHref(s.facebook))makeContact('f','Facebook','Trang Facebook',urlHref(s.facebook));
  renderProducts();renderCart();text($('#year'),new Date().getFullYear());
}
function matchProducts(){
  const term=$('#search').value.trim().toLocaleLowerCase('vi');
  const list=state.products.filter(p=>(!state.category||p.category===state.category)&&(!term||[p.name,p.sku,p.brand,p.ingredients,p.category].join(' ').toLocaleLowerCase('vi').includes(term)));
  const sort=$('#sort').value;
  if(sort==='priceAsc')list.sort((a,b)=>a.price-b.price);
  if(sort==='priceDesc')list.sort((a,b)=>b.price-a.price);
  if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  if(sort==='featured')list.sort((a,b)=>Number(b.featured)-Number(a.featured));
  return list;
}
function renderCategories(){
  const list=['Tất cả',...new Set(state.products.map(p=>p.category).filter(Boolean))];
  const parent=$('#categories');parent.replaceChildren();
  list.forEach(c=>{
    const b=node('button',state.category===(c==='Tất cả'?'':c)?'active':'',c);b.type='button';b.onclick=()=>{state.category=c==='Tất cả'?'':c;renderProducts()};
    parent.append(b);
  });
}
function addItem(id){
  const product=state.products.find(p=>p.id===id);
  if(!product||Number(product.stock)<1)return;
  state.cart[id]=Math.min(Number(product.stock),Number(state.cart[id]||0)+1);
  saveCart();openDrawer();
}
function card(p){
  const root=node('article','product-card');
  const picture=node('div','product-picture');
  imageOrFallback(p.images?.[0],picture);
  if(p.featured)picture.append(node('span','badge','NỔI BẬT'));
  const body=node('div','product-body');
  body.append(node('span','product-category',p.category||'Vật tư nông nghiệp'));
  body.append(node('h3','product-name',p.name));
  body.append(node('div','product-meta',[p.brand,p.pack].filter(Boolean).join(' · ')));
  body.append(node('div','product-price',money(p.price)));
  const actions=node('div','product-actions'),detail=node('button','','Chi tiết'),add=node('button','add',Number(p.stock)>0?'+ Thêm giỏ':'Hết hàng');
  detail.type=add.type='button';detail.onclick=()=>showProduct(p);add.onclick=()=>addItem(p.id);add.disabled=!(Number(p.stock)>0);
  actions.append(detail,add);body.append(actions);root.append(picture,body);
  return root;
}
function renderProducts(){
  renderCategories();const list=matchProducts(),target=$('#products');target.replaceChildren(...list.map(card));
  text($('#resultCount'),list.length+' sản phẩm');
  const empty=$('#empty');empty.hidden=list.length>0;
  text($('#emptyText'),state.products.length?'Hãy thử tên hoặc danh mục khác.':'Cửa hàng đang cập nhật sản phẩm. Vui lòng liên hệ để được tư vấn.');
}
function showProduct(p){
  const panel=$('#infoContent');panel.replaceChildren();
  const photo=node('div','info-photo');imageOrFallback(p.images?.[0],photo);panel.append(photo);
  panel.append(node('span','product-category',p.category||'Vật tư nông nghiệp'));
  panel.append(node('h2','',p.name));
  panel.append(node('p','muted',[p.brand,p.pack,p.sku].filter(Boolean).join(' · ')));
  panel.append(node('h3','',money(p.price)));
  for(const [label,value] of [['Thành phần / hoạt chất',p.ingredients],['Mô tả',p.description],['Thông tin an toàn theo nhãn',p.safety],['Số đăng ký / Thông tin pháp lý',p.registrationRef]]){
    if(value){panel.append(node('h3','',label),node('p','',value))}
  }
  const add=node('button','btn btn-primary full',Number(p.stock)>0?'Thêm vào giỏ hàng →':'Tạm hết hàng');
  add.disabled=Number(p.stock)<=0;add.onclick=()=>{addItem(p.id);$('#infoDialog').close()};panel.append(add);
  $('#infoDialog').showModal();
}
function cartLines(){
  return Object.entries(state.cart).map(([id,qty])=>({p:state.products.find(p=>p.id===id),qty:Number(qty)})).filter(x=>x.p&&x.qty>0);
}
function cartTotal(){return cartLines().reduce((s,{p,qty})=>s+p.price*qty,0)}
function renderCart(){
  const list=cartLines(),target=$('#cartItems');target.replaceChildren();
  text($('#cartCount'),list.reduce((n,x)=>n+x.qty,0));
  text($('#cartTotal'),money(cartTotal()));text($('#checkoutTotal'),money(cartTotal()));
  if(!list.length)target.append(node('p','muted','Giỏ hàng đang trống. Khám phá các sản phẩm và thêm vào giỏ nhé.'));
  for(const {p,qty} of list){
    const line=node('div','cart-line'),img=node('div','cart-line-image');
    imageOrFallback(p.images?.[0],img);
    const body=node('div','cart-line-content');
    body.append(node('strong','',p.name),node('small','',p.pack+' · '+money(p.price)));
    const ctrl=node('div','quantity'),minus=node('button','','−'),num=node('span','',qty),plus=node('button','','+'),remove=node('button','remove','Xóa');
    minus.type=plus.type=remove.type='button';
    minus.onclick=()=>setQty(p.id,qty-1);plus.onclick=()=>setQty(p.id,Math.min(Number(p.stock),qty+1));remove.onclick=()=>setQty(p.id,0);
    ctrl.append(minus,num,plus,remove);body.append(ctrl);line.append(img,body);target.append(line);
  }
  $('#checkoutOpen').disabled=!list.length||state.site.ordersEnabled!==true;
  $('#checkoutOpen').textContent=state.site.ordersEnabled===true?'Tiến hành đặt hàng →':'Cửa hàng chưa bật nhận đơn';
}
function setQty(id,n){if(n<=0)delete state.cart[id];else state.cart[id]=n;saveCart()}
function openDrawer(){$('#shade').hidden=false;$('#drawer').hidden=false;document.body.style.overflow='hidden'}
function closeDrawer(){$('#shade').hidden=true;$('#drawer').hidden=true;document.body.style.overflow=''}
function showPolicy(key){
  const titles={shippingPolicy:'Chính sách giao hàng',returnPolicy:'Chính sách đổi trả',privacyPolicy:'Quyền riêng tư',terms:'Điều khoản'};
  const wrap=$('#infoContent');wrap.replaceChildren(node('h2','',titles[key]),node('p','policy-body',state.site[key]||'Cửa hàng chưa cập nhật nội dung này.'));
  $('#infoDialog').showModal();
}
function captchaRender(id){
  if(!state.config.turnstileSiteKey)return;
  const root=document.getElementById(id);
  const show=()=>{if(window.turnstile&&!root.dataset.ready){
    window.turnstile.render(root,{sitekey:state.config.turnstileSiteKey,callback:token=>state.captcha[id]=token,'expired-callback':()=>state.captcha[id]=''});
    root.dataset.ready='1';
  }};
  if(!document.getElementById('turnstileScript')){
    const script=document.createElement('script');script.id='turnstileScript';script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>{show();captchaRender('checkoutCaptcha');captchaRender('contactCaptcha')};document.head.append(script);
  }else show();
}
function resetCaptcha(id){state.captcha[id]='';const el=document.getElementById(id);if(el.dataset.ready&&window.turnstile)window.turnstile.reset(el)}
async function sendForm(form,path,extra,statusId){
  const btn=$('button[type=submit]',form);btn.disabled=true;
  text($(statusId),'Đang gửi dữ liệu...');
  try{
    const data=Object.fromEntries(new FormData(form));data.consent=$('[name=consent]',form).checked;
    Object.assign(data,extra);
    const result=await api(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
    return result;
  }catch(e){text($(statusId),e.message);throw e}
  finally{btn.disabled=false}
}
function prepareEvents(){
  $('#search').addEventListener('input',()=>renderProducts());$('#sort').addEventListener('change',renderProducts);
  $('#cartOpen').onclick=openDrawer;$('#cartClose').onclick=closeDrawer;$('#shade').onclick=closeDrawer;
  $('#infoClose').onclick=()=>$('#infoDialog').close();
  $('#checkoutClose').onclick=()=>$('#checkoutDialog').close();
  $('#checkoutOpen').onclick=()=>{if(!cartLines().length)return;closeDrawer();$('#checkoutDialog').showModal();captchaRender('checkoutCaptcha')};
  document.querySelectorAll('[data-policy]').forEach(b=>b.onclick=()=>showPolicy(b.dataset.policy));
  $('#privacyOpen').onclick=e=>{e.preventDefault();showPolicy('privacyPolicy')};
  $('#contactForm').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget;
    try{const result=await sendForm(form,'/contact',{turnstile:state.captcha.contactCaptcha},'#contactStatus');
      text($('#contactStatus'),'Đã gửi yêu cầu #'+result.id.slice(0,8)+'. Cửa hàng sẽ liên hệ bạn.');form.reset();}
    catch{}finally{resetCaptcha('contactCaptcha')}
  };
  $('#checkoutForm').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget;
    const lines=cartLines();if(!lines.length)return;
    if(!state.checkoutId)state.checkoutId=crypto.randomUUID();
    try{
      const result=await sendForm(form,'/orders',{idempotencyKey:state.checkoutId,items:lines.map(x=>({id:x.p.id,qty:x.qty})),turnstile:state.captcha.checkoutCaptcha},'#checkoutStatus');
      state.cart={};saveCart();state.checkoutId=null;form.reset();
      const wrap=$('#infoContent');wrap.replaceChildren(node('h2','','Đặt hàng thành công!'),node('p','','Mã đơn hàng: '+result.id),node('p','','Tiền hàng: '+money(result.total)+'. Cửa hàng sẽ liên hệ xác nhận và báo phí giao.'));
      $('#checkoutDialog').close();$('#infoDialog').showModal();
    }catch{}finally{resetCaptcha('checkoutCaptcha')}
  };
}
async function init(){
  prepareEvents();
  try{state.config=await api('/config');captchaRender('contactCaptcha')}catch{}
  try{initializeSite(await api('/site'))}
  catch(e){
    $('#products').replaceChildren();$('#empty').hidden=false;
    text($('#emptyText'),'Gian hàng đang được kết nối với hệ thống quản lý. Vui lòng quay lại sau.');text($('#resultCount'),'Chưa có dữ liệu');
    console.warn('Store configuration unavailable',e.message);
  }
  if(!state.config.turnstileSiteKey) {
    $('#contactStatus').textContent='Tư vấn trực tuyến sẽ hoạt động khi cửa hàng hoàn tất cấu hình bảo mật.';
  }
}
init();
