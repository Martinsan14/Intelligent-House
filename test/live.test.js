const {test}=require('node:test');const assert=require('node:assert/strict');
process.env.CONTROL_MODE='mqtt';process.env.ADMIN_PASSWORD='test-only-password';process.env.SESSION_SECRET='test-only-secret-with-at-least-32-characters';process.env.MQTT_URL='mqtts://127.0.0.1:1';
// Stub only transport: exercise real HTTP authentication and offline behavior.
const {EventEmitter}=require('node:events');require('mqtt');require.cache[require.resolve('mqtt')].exports={connect:()=>new EventEmitter()};
const app=require('../server');
test('live mode protects state, accepts login, refuses offline commands and logs out',async()=>{
 const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));const base=`http://127.0.0.1:${s.address().port}/api/`;
 try{
 assert.equal((await fetch(base+'state')).status,401);
 assert.equal((await fetch(base+'lights/1/name',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"Unauthorized"}'})).status,401);
 assert.equal((await fetch(base+'login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"password":"wrong"}'})).status,401);
 const login=await fetch(base+'login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.ADMIN_PASSWORD})});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];const headers={Cookie:cookie,'Content-Type':'application/json'};
 const state=await (await fetch(base+'state',{headers})).json();assert.equal(state.online,false);assert.ok(state.lights.every(l=>l.on===null));
 assert.equal((await fetch(base+'control',{method:'POST',headers,body:'{"target":1,"on":true}'})).status,503);
 await fetch(base+'logout',{method:'POST',headers,body:'{}'});assert.equal((await fetch(base+'state',{headers})).status,401);
 }finally{s.close();}
});
