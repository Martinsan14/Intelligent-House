const express = require('express');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');
const { timingSafeEqual, createHash, randomBytes } = require('node:crypto');
const mqtt = require('mqtt');
const path = require('node:path');
const { createNameStore, validName } = require('./light-names');
const nameStore = createNameStore(process.env.LIGHT_NAMES_FILE || path.join(__dirname, 'data', 'light-names.json'));
const mode = process.env.CONTROL_MODE || 'demo';
if (!['demo','mqtt'].includes(mode)) throw Error('CONTROL_MODE must be demo or mqtt');
const live = mode === 'mqtt';
if (live && (!process.env.ADMIN_PASSWORD || (process.env.SESSION_SECRET || '').length < 32)) throw Error('Live mode needs ADMIN_PASSWORD and SESSION_SECRET (32+ characters)');
if (!/^[A-Za-z0-9-]+$/.test(process.env.MQTT_HOME_ID || 'my-house')) throw Error('MQTT_HOME_ID may contain only letters, digits and hyphens');
const mainEnabled = live && process.env.ENABLE_MAIN_POWER === 'true';
const rooms = ['Living room','Kitchen','Bedrooms','Outdoors'];
const names = ['Ceiling','Reading lamp','Accent lights','Dining table','Counter lights','Ceiling','Pantry','Main bedroom','Bedside left','Bedside right','Bedroom two','Bedroom three','Hallway','Bathroom','Porch','Garden','Driveway','Terrace'];
const lights = names.map((name,i)=>({id:i+1,name:nameStore.get(i+1,name),room:rooms[i<4?0:i<7?1:i<14?2:3],on:live?null:false}));
let online = !live, main = null, updatedAt = null;
let broker;
const pending = new Map();
const prefix = `house/${process.env.MQTT_HOME_ID || 'my-house'}`;
if (live) {
 if (!process.env.MQTT_URL?.startsWith('mqtts://')) throw Error('MQTT_URL must use mqtts://');
 broker = mqtt.connect(process.env.MQTT_URL,{username:process.env.MQTT_USERNAME,password:process.env.MQTT_PASSWORD,reconnectPeriod:3000});
 broker.on('connect',()=>broker.subscribe(`${prefix}/state`,{qos:1}));
 broker.on('offline',()=>{online=false;});
 broker.on('error',()=>{online=false;});
 broker.on('message',(_,payload)=>{try {
  const data=JSON.parse(payload.toString());
  if(data.online===false){online=false;return;}
  if(!Array.isArray(data.lights)||data.lights.length!==18||!data.lights.every(x=>typeof x==='boolean'))return;
  online=data.online===true; updatedAt=Date.now();
  lights.forEach((l,i)=>l.on=data.lights[i]); main=typeof data.main==='boolean'?data.main:null;
  if(online&&pending.has(data.ack))pending.get(data.ack)(data);
 }catch{}});
}
const app=express();
app.disable('x-powered-by');
if(process.env.SECURE_COOKIES==='true')app.set('trust proxy',1);
app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});next();});
app.use(express.json({limit:'4kb'}));
app.use(session({secret:process.env.SESSION_SECRET||randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'strict',secure:process.env.SECURE_COOKIES==='true',maxAge:8*60*60*1000}}));
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(req.method!=='GET'&&req.get('origin')&&req.get('origin')!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({error:'Origin rejected'});next();});
app.get('/api/session',(req,res)=>res.json({authenticated:!live||!!req.session.auth,mode}));
const hash=x=>createHash('sha256').update(x).digest();
app.post('/api/login',rateLimit({windowMs:900000,limit:10,standardHeaders:'draft-8',legacyHeaders:false}), (req,res)=>{
 if(!timingSafeEqual(hash(String(req.body.password||'')),hash(process.env.ADMIN_PASSWORD||randomBytes(32).toString('hex'))))return res.status(401).json({error:'Incorrect password'});
 req.session.regenerate(err=>{if(err)return res.status(500).json({error:'Session unavailable'});req.session.auth=true;res.json({ok:true});});
});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.use('/api',(req,res,next)=>!live||req.session.auth?next():res.status(401).json({error:'Sign in required'}));
function connected(){return !live||(online&&broker?.connected&&updatedAt&&Date.now()-updatedAt<45000);}
app.get('/api/state',(req,res)=>res.json({mode,online:!!connected(),lights,main,mainEnabled,updatedAt}));
app.post('/api/lights/:id/name',(req,res)=>{
 const id = Number(req.params.id);
 if (!/^(?:[1-9]|1[0-8])$/.test(req.params.id) || !Number.isInteger(id)) return res.status(404).json({error:'Light not found'});
 if (!validName(req.body?.name)) return res.status(400).json({error:'Enter a name of 1–40 characters, without control characters.'});
 const name = req.body.name.trim();
 try { nameStore.set(id,name); }
 catch { return res.status(500).json({error:'Could not save the name. Please check server storage and try again.'}); }
 lights[id-1].name = name;
 res.json({id,name});
});
app.post('/api/control',rateLimit({windowMs:1000,limit:12,legacyHeaders:false}),async(req,res)=>{
 const {target,on,confirmation}=req.body;
 if(typeof on!=='boolean'||!(target==='all'||target==='main'||Number.isInteger(target)&&target>=1&&target<=18))return res.status(400).json({error:'Invalid command'});
 if(target==='main'&&(!mainEnabled||confirmation!=='CONFIRM HOUSE POWER'))return res.status(403).json({error:'House power is locked. Hardware commissioning required.'});
 if(!connected())return res.status(503).json({error:'Controller offline. No command sent.'});
 if(!live){lights.forEach(l=>{if(target==='all'||target===l.id)l.on=on;});updatedAt=Date.now();return res.json({ok:true});}
 const id=randomBytes(12).toString('hex');
 try{await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('No device acknowledgement. Check the actual lights before retrying.'));},5000);
  pending.set(id,data=>{
   const matches=target==='main'?data.main===on:target==='all'?data.lights.every(value=>value===on):data.lights[target-1]===on;
   if(matches){clearTimeout(timer);pending.delete(id);resolve();}
  });
  broker.publish(`${prefix}/command`,JSON.stringify({id,target,on,expires:Math.floor(Date.now()/1000)+10}),{qos:1,retain:false},err=>{if(err){clearTimeout(timer);pending.delete(id);reject(Error('Command delivery failed'));}});
 });res.json({ok:true});}catch(e){res.status(504).json({error:e.message});}
});
app.use(express.static('public'));
if(require.main===module)app.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log(`House control started (${mode})`));
module.exports=app;
