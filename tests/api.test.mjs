import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mjs';

const url=p=>'https://example.netlify.app/api'+p;
const request=(p,opts)=>new Request(url(p),opts);
const body=async r=>r.json();

test('health endpoint exposes only service status',async()=>{
  const response=await handler(request('/health'));
  assert.equal(response.status,200);
  assert.deepEqual((await body(response)).data,{status:'up',service:'cuahangvtnn'});
});
test('no admin session means no access to private customer orders',async()=>{
  const response=await handler(request('/admin/orders'));
  assert.equal(response.status,401);
  assert.equal((await body(response)).ok,false);
});
test('changing state from another origin is rejected',async()=>{
  const response=await handler(request('/auth/login',{
    method:'POST',headers:{origin:'https://malicious.invalid','content-type':'application/json'},
    body:JSON.stringify({credential:'invalid'})
  }));
  assert.equal(response.status,403);
});
test('orders require same-origin request',async()=>{
  const response=await handler(request('/orders',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({items:[]})
  }));
  assert.equal(response.status,403);
});
test('unconfigured sheet returns clear unavailable error without leaking secrets',async()=>{
  const old=process.env.APPS_SCRIPT_URL;
  delete process.env.APPS_SCRIPT_URL;
  try {
    const response=await handler(request('/site'));
    assert.equal(response.status,503);
    const result=await body(response);
    assert.equal(result.ok,false);
    assert.match(result.error,/chưa kết nối/);
  }finally{if(old!==undefined)process.env.APPS_SCRIPT_URL=old}
});
test('path traversal cannot read files through media route',async()=>{
  const response=await handler(request('/media/foo.png'));
  assert.equal(response.status,404);
});
