const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,mkdirSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const directory=mkdtempSync(path.join(tmpdir(),'haven-names-'));
const file=path.join(directory,'names.json');
async function start(){
 const child=spawn(process.execPath,['-e',`const app=require('./server');const s=app.listen(0,'127.0.0.1',()=>console.log(s.address().port));`],{cwd:path.join(__dirname,'..'),env:{...process.env,CONTROL_MODE:'demo',LIGHT_NAMES_FILE:file},stdio:['ignore','pipe','pipe']});
 let output='';const port=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill();reject(Error('Server startup timeout'));},5000);
  child.once('exit',()=>{clearTimeout(timer);reject(Error('Server stopped before startup'));});
  child.stdout.on('data',data=>{output+=data;const match=output.match(/^(\d+)\n/);if(match){clearTimeout(timer);resolve(match[1]);}});
 });
 return {url:`http://127.0.0.1:${port}/api/`,async stop(){const exited=once(child,'exit');child.kill();await exited;}};
}
test('renames persist after actual server restart; validation and write failures preserve names',async()=>{
 let server;
 try{
  server=await start();
  const rename=(id,name,origin)=>fetch(server.url+`lights/${id}/name`,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({name})});
  assert.equal((await rename(1,'  Luz de la sala 💡  ')).status,200);
  assert.equal((await rename(19,'Invalid')).status,404);
  for(const name of ['', '   ', 'x'.repeat(41),'bad\nname',42])assert.equal((await rename(1,name)).status,400);
  assert.equal((await rename(1,'Rejected','https://evil.example')).status,403);
  await server.stop();server=await start();
  let state=await (await fetch(server.url+'state')).json();assert.equal(state.lights[0].name,'Luz de la sala 💡');assert.equal(state.lights[0].on,false);
  // Force a real storage failure without relying on permission behavior as root.
  mkdirSync(file+'.tmp');assert.equal((await rename(1,'Not saved')).status,500);
  state=await (await fetch(server.url+'state')).json();assert.equal(state.lights[0].name,'Luz de la sala 💡');
 }finally{if(server)await server.stop();rmSync(directory,{recursive:true,force:true});}
});
