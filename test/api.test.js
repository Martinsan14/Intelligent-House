const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const app=require('../server');let server,url;
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));url=`http://127.0.0.1:${server.address().port}`;});
after(()=>server.close());
async function get(){return (await fetch(url+'/api/state')).json();}
async function send(body,origin){return fetch(url+'/api/control',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});}
test('demo has eighteen individually controllable lights',async()=>{let s=await get();assert.equal(s.mode,'demo');assert.equal(s.lights.length,18);assert.equal((await send({target:3,on:true})).status,200);s=await get();assert.equal(s.lights[2].on,true);assert.equal(s.lights[1].on,false);});
test('all-light commands affect every light',async()=>{await send({target:'all',on:true});assert.ok((await get()).lights.every(l=>l.on));await send({target:'all',on:false});assert.ok((await get()).lights.every(l=>!l.on));});
test('main power remains locked',async()=>assert.equal((await send({target:'main',on:false,confirmation:'CONFIRM HOUSE POWER'})).status,403));
test('invalid commands and foreign origins are rejected',async()=>{for(const b of [{target:19,on:true},{target:0,on:false},{target:1,on:'true'}])assert.equal((await send(b)).status,400);assert.equal((await send({target:1,on:true},'https://evil.example')).status,403);});
test('security headers present',async()=>{const r=await fetch(url);assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));});
