const {test}=require('node:test');const assert=require('node:assert/strict');const {EventEmitter}=require('node:events');
process.env.CONTROL_MODE='mqtt';process.env.ADMIN_PASSWORD='test-password';process.env.SESSION_SECRET='long-test-secret-32-characters-minimum';process.env.MQTT_URL='mqtts://test.example:8883';
const transport=new EventEmitter();transport.connected=true;transport.subscribe=()=>{};
let sent;
transport.publish=(topic,payload,options,callback)=>{sent={topic,body:JSON.parse(payload),options};callback();};
require('mqtt');require.cache[require.resolve('mqtt')].exports={connect:()=>transport};
const app=require('../server');
test('live command waits for matching device state acknowledgement and is never retained',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 const report=data=>transport.emit('message','house/my-house/state',Buffer.from(JSON.stringify(data)));
 try{
 transport.emit('connect');report({online:true,lights:Array(18).fill(false)});
 const login=await fetch(base+'login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"password":"test-password"}'});const cookie=login.headers.get('set-cookie').split(';')[0];
 const request=fetch(base+'control',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:'{"target":2,"on":true}'});
 for(let i=0;i<100&&!sent;i++)await new Promise(r=>setTimeout(r,5));
 assert.ok(sent);assert.equal(sent.topic,'house/my-house/command');assert.equal(sent.options.retain,false);assert.equal(sent.body.target,2);assert.ok(sent.body.expires> Date.now()/1000);
 const lights=Array(18).fill(false);lights[1]=true;report({online:true,lights,ack:sent.body.id});
 assert.equal((await request).status,200);
 const state=await (await fetch(base+'state',{headers:{Cookie:cookie}})).json();assert.equal(state.lights[1].on,true);
 report({online:false});assert.equal((await (await fetch(base+'state',{headers:{Cookie:cookie}})).json()).online,false);
 }finally{server.close();}
});
