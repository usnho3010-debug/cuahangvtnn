import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const COOKIE='vt_admin', TTL=60*60*24*2;
const SETTINGS=['siteName','tagline','logoUrl','heroUrl','heroTitle','heroText','announcement','primaryColor','address','mapUrl','hotline','zalo','email','facebook','hours','serviceArea','aboutText','shippingPolicy','returnPolicy','privacyPolicy','terms','footerNote','seoTitle','seoDescription','shippingNote','ordersEnabled'];
const expose=(data,status=200,headers={})=>Response.json({ok:true,data},{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const fail=(message,status=400)=>Response.json({ok:false,error:message},{status,headers:{'cache-control':'no-store'}});
const err=(message,status=400)=>{let e=new Error(message);e.status=status;throw e};
const sign=(text,secret)=>createHmac('sha256',secret).update(text).digest('base64url');
const eq=(a,b)=>{if(!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
const origin=(req)=>{const incoming=req.headers.get('origin');if(!incoming||incoming!==new URL(req.url).origin)err('Yêu cầu khác nguồn bị từ chối',403)};
const admins=(s)=>(s||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
const isAdmin=(claim)=>admins(process.env.ADMIN_EMAILS).includes((claim.email||'').toLowerCase()) || admins(process.env.ADMIN_GOOGLE_SUBS).includes(claim.sub);
async function getBody(req,max=20000){
  const size=Number(req.headers.get('content-length')||0);
  if(size>max)err('Dữ liệu quá lớn',413);
  const txt=await req.text();if(Buffer.byteLength(txt)>max)err('Dữ liệu quá lớn',413);
  try{return JSON.parse(txt)}catch{err('Dữ liệu JSON không hợp lệ')}
}
function safeString(v,max=2000){return typeof v==='string'&&v.length<=max}
async function callSheet(action,data={}){
  const url=process.env.APPS_SCRIPT_URL, secret=process.env.API_SHARED_SECRET;
  if(!url||!secret)err('Hệ thống chưa kết nối Google Sheets',503);
  let u;try{u=new URL(url)}catch{err('Địa chỉ Apps Script không hợp lệ',503)}
  if(u.protocol!=='https:'||u.hostname!=='script.google.com')err('Địa chỉ Apps Script không hợp lệ',503);
  const body=JSON.stringify({ts:Date.now(),nonce:randomUUID(),action,data});
  const response=await fetch(url,{method:'POST',body:JSON.stringify({body,sig:sign(body,secret)}),headers:{'content-type':'text/plain;charset=utf-8'},redirect:'follow',signal:AbortSignal.timeout(18000)});
  if(!response.ok)err('Không liên hệ được Google Sheets',503);
  const result=await response.json();
  if(!result.ok)err(result.error||'Không thể xử lý yêu cầu',result.status||400);
  return result.data;
}
async function auth(req){
  const all=req.headers.get('cookie')||'';
  const token=all.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!token||!process.env.SESSION_SECRET)return null;
  const dot=token.lastIndexOf('.');if(dot<1)return null;
  const [body,signature]=[token.slice(0,dot),token.slice(dot+1)];
  if(!eq(sign(body,process.env.SESSION_SECRET),signature))return null;
  try{
    const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if(!p.sub||p.exp<Math.floor(Date.now()/1000)||!isAdmin(p))return null;
    return p;
  }catch{return null}
}
async function login(credential){
  if(!safeString(credential,4096)||!process.env.GOOGLE_CLIENT_ID)err('Google Sign-In chưa được cấu hình',503);
  const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(credential),{signal:AbortSignal.timeout(9000)});
  if(!r.ok)err('Không xác thực được với Google',401);
  const user=await r.json();
  if(user.aud!==process.env.GOOGLE_CLIENT_ID||!['accounts.google.com','https://accounts.google.com'].includes(user.iss)||Number(user.exp)<Date.now()/1000||String(user.email_verified)!=='true'||!isAdmin(user))err('Tài khoản Google chưa được cấp quyền quản trị',403);
  if(!process.env.SESSION_SECRET)err('Thiếu SESSION_SECRET',503);
  const body=Buffer.from(JSON.stringify({sub:user.sub,email:user.email,exp:Math.floor(Date.now()/1000)+TTL})).toString('base64url');
  return {cookie:body+'.'+sign(body,process.env.SESSION_SECRET),email:user.email};
}
async function verifyTurnstile(token,req){
  const secret=process.env.TURNSTILE_SECRET;if(!secret)err('Chức năng đặt hàng đang chờ kích hoạt bảo mật',503);
  if(!token||typeof token!=='string')err('Vui lòng xác minh bảo mật');
  const form=new URLSearchParams({secret,response:token});
  const ip=req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'';
  if(ip)form.set('remoteip',ip);
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form,signal:AbortSignal.timeout(8000)});
  if(!r.ok || !(await r.json()).success)err('Xác minh bảo mật không thành công',403);
}
function validateSettings(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))err('Cấu hình không hợp lệ');
  const clean={};
  for(const field of SETTINGS){
    if(!(field in payload))continue;
    if(field==='ordersEnabled'){clean[field]=payload[field]===true;continue}
    if(!safeString(payload[field],6000))err('Trường '+field+' vượt giới hạn');
    clean[field]=payload[field].trim();
    if(/(url|Url)$/i.test(field)&&clean[field]&&!/^(https:\/\/|\/api\/media\/)/.test(clean[field]))err('Liên kết '+field+' phải dùng HTTPS');
  }
  if(clean.primaryColor&&!/^#[a-f0-9]{6}$/i.test(clean.primaryColor))err('Màu nhận diện không hợp lệ');
  return clean;
}
function validateProduct(p){
  if(!p||typeof p!=='object')err('Sản phẩm không hợp lệ');
  const o={};for(const key of ['id','sku','name','category','brand','ingredients','pack','description','safety','registrationRef']){
    const v=p[key]??'';if(!safeString(v,['description','safety'].includes(key)?5000:250))err('Dữ liệu '+key+' không hợp lệ');
    o[key]=v.trim();
  }
  o.price=Number(p.price);o.stock=Number(p.stock);
  if(!o.sku||!o.name||!o.pack||!Number.isSafeInteger(o.price)||o.price<0||!Number.isSafeInteger(o.stock)||o.stock<0||o.stock>100000)err('Cần tên, mã SKU, quy cách, giá và tồn kho hợp lệ');
  o.active=p.active===true;o.verified=p.verified===true;o.featured=p.featured===true;
  o.images=(Array.isArray(p.images)?p.images:[]).filter(x=>typeof x==='string'&&/^\/api\/media\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(x)).slice(0,8);
  return o;
}
async function upload(req){
  const form=await req.formData(), file=form.get('image');
  if(!file||typeof file.arrayBuffer!=='function'||file.size>4_000_000||file.size<100)err('Chỉ nhận ảnh tối đa 4 MB',413);
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];if(!ext)err('Định dạng ảnh không hợp lệ');
  const b=Buffer.from(await file.arrayBuffer());
  const magic=ext==='jpg'?b[0]===0xff&&b[1]===0xd8:ext==='png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  if(!magic)err('Tệp không phải ảnh hợp lệ');
  const key=randomUUID()+'.'+ext;await getStore('product-images').set(key,b);
  return {url:'/api/media/'+key};
}
async function getImage(key){
  if(!/^[0-9a-f-]{36}\.(png|webp|jpg)$/.test(key))return fail('Không tìm thấy ảnh',404);
  const val=await getStore('product-images').get(key,{type:'arrayBuffer'});
  if(!val)return fail('Không tìm thấy ảnh',404);
  const ext=key.split('.').pop(),mime={png:'image/png',jpg:'image/jpeg',webp:'image/webp'}[ext];
  return new Response(val,{headers:{'content-type':mime,'cache-control':'public,max-age=86400','x-content-type-options':'nosniff'}});
}
export default async function handler(req){
  const path=new URL(req.url).pathname.replace(/^\/(?:\.netlify\/functions\/api|api)/,'')||'/';
  const method=req.method;
  try {
    if(path==='/health'&&method==='GET')return expose({status:'up',service:'cuahangvtnn'});
    if(path==='/config'&&method==='GET')return expose({googleClientId:process.env.GOOGLE_CLIENT_ID||'',turnstileSiteKey:process.env.TURNSTILE_SITE_KEY||''});
    if(path==='/site'&&method==='GET')return expose(await callSheet('site.get'));
    if(path==='/auth/me'&&method==='GET'){const u=await auth(req);return u?expose({email:u.email}):fail('Chưa đăng nhập',401)}
    if(path==='/auth/login'&&method==='POST'){origin(req);const {credential}=await getBody(req,6000);const u=await login(credential);
      return expose({email:u.email},200,{'set-cookie':COOKIE+'='+u.cookie+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age='+TTL});}
    if(path==='/auth/logout'&&method==='POST'){origin(req);return expose({},200,{'set-cookie':COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'})}
    if(path==='/orders'&&method==='POST'){origin(req);const b=await getBody(req,12000);await verifyTurnstile(b.turnstile,req);return expose(await callSheet('orders.create',b),201)}
    if(path==='/contact'&&method==='POST'){origin(req);const b=await getBody(req,4000);await verifyTurnstile(b.turnstile,req);return expose(await callSheet('contacts.create',b),201)}
    if(path.startsWith('/media/')&&method==='GET')return await getImage(path.slice(7));
    if(path.startsWith('/admin/')){
      const u=await auth(req);if(!u)return fail('Không có quyền quản trị',401);
      if(method!=='GET')origin(req);
      if(path==='/admin/images'&&method==='POST')return expose(await upload(req),201);
      const endpoints={
        '/admin/settings':{GET:'settings.get',POST:'settings.save'},
        '/admin/products':{GET:'products.list',POST:'products.save'},
        '/admin/products/delete':{POST:'products.delete'},
        '/admin/orders':{GET:'orders.list',POST:'orders.update'},
        '/admin/contacts':{GET:'contacts.list'},
        '/admin/stats':{GET:'stats.get'}
      };
      const action=endpoints[path]?.[method];if(!action)return fail('Không tìm thấy API',404);
      let data=method==='GET'?{}:await getBody(req,40000);
      if(action==='settings.save')data=validateSettings(data);
      if(action==='products.save')data=validateProduct(data);
      if(action==='products.delete'&&!safeString(data.id,100))err('ID không hợp lệ');
      if(action==='orders.update'&&(!safeString(data.id,100)||!['CONFIRMED','PACKING','SHIPPING','COMPLETED','CANCELLED'].includes(data.status)))err('Trạng thái không hợp lệ');
      return expose(await callSheet(action,{...data,actor:u.email}));
    }
    return fail('Không tìm thấy API',404);
  }catch(e){
    console.error('API',path,e.message);
    return fail(e.status?e.message:'Hệ thống tạm thời chưa xử lý được yêu cầu',e.status||503);
  }
}
