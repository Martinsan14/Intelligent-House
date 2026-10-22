const $=id=>document.getElementById(id);
let state,filter='All rooms',busy=false;
const bulb='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18h6m-6 3h6M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/></svg>';
async function api(path,body){const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok){if(r.status===401)showLogin();throw Error(data.error||'Request failed');}return data;}
let messageTimer;function notify(text){$('message').textContent=text;clearTimeout(messageTimer);messageTimer=setTimeout(()=>$('message').textContent='',6000);}
function showLogin(){$('login').hidden=false;$('dashboard').hidden=true;$('logout').hidden=true;}
function render(){
 const count=state.lights.filter(l=>l.on===true).length;
 $('connection').textContent=state.mode==='demo'?'Demo home':state.online?'Connected':'Offline';
 $('on-count').textContent=state.lights.some(l=>l.on===null)?'—':count;
 $('summary').textContent=state.online?(count?`${count} light${count===1?' is':'s are'} making home brighter`:'A quiet moment at home'):'Controller offline · state may be outdated';
 $('demo-banner').hidden=state.mode!=='demo';
 $('all-on').disabled=$('all-off').disabled=busy||!state.online;
 const rooms=['All rooms',...new Set(state.lights.map(l=>l.room))];
 $('filters').replaceChildren(...rooms.map(room=>{const b=document.createElement('button');b.textContent=room;b.className=filter===room?'active':'';b.setAttribute('aria-pressed',String(filter===room));b.onclick=()=>{filter=room;render();};return b;}));
 $('lights').replaceChildren(...state.lights.filter(l=>filter==='All rooms'||l.room===filter).map(l=>{
 const card=document.createElement('article');card.className='light-card'+(l.on?' on':'');
 card.innerHTML=`<div class="card-top"><span class="bulb" aria-hidden="true">${bulb}</span><button class="toggle" role="switch" aria-checked="${l.on===true}"></button></div><h3></h3><div class="card-bottom"><span class="room"></span><span class="state-label"></span></div>`;
 card.querySelector('h3').textContent=l.name;card.querySelector('.room').textContent=l.room;card.querySelector('.state-label').textContent=l.on===null?'Unknown':l.on?'On':'Off';
 const b=card.querySelector('button');b.setAttribute('aria-label',`${l.room} ${l.name}`);b.disabled=busy||!state.online;b.onclick=()=>control(l.id,!l.on);return card;
 }));
 $('main-power').disabled=busy||!state.mainEnabled||!state.online||state.main===null;
 document.querySelector('.locked').textContent=state.mainEnabled?'COMMISSIONED':'LOCKED';
 $('power-copy').textContent=state.mainEnabled?`Reported main contactor state: ${state.main===null?'unknown':state.main?'on':'off'}.`:'Main supply control requires commissioned switching hardware.';
}
async function refresh(){try{state=await api('state');$('dashboard').hidden=false;$('login').hidden=true;$('logout').hidden=state.mode==='demo';render();}catch(e){if(!e.message.includes('Sign in'))notify(e.message);}}
async function control(target,on,confirmation){if(busy)return;busy=true;render();try{await api('control',{target,on,confirmation});await refresh();}catch(e){notify(e.message);}finally{busy=false;if(state)render();}}
$('all-on').onclick=()=>control('all',true);$('all-off').onclick=()=>control('all',false);
$('login-form').onsubmit=async e=>{e.preventDefault();try{await api('login',{password:$('password').value});$('password').value='';await refresh();}catch(e){notify(e.message);}};
$('logout').onclick=async()=>{await api('logout',{});showLogin();};
$('main-power').onclick=()=>{$('confirm-text').value='';$('power-dialog').showModal();};
$('confirm-power').onclick=()=>{if($('confirm-text').value!=='CONFIRM HOUSE POWER'){notify('Enter the exact confirmation phrase.');return;}$('power-dialog').close();control('main',!state.main,'CONFIRM HOUSE POWER');};
api('session').then(s=>s.authenticated?refresh():showLogin()).catch(e=>notify(e.message));
setInterval(()=>{if(!$('dashboard').hidden&&!busy)refresh();},5000);
