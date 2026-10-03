// Online race client: talks to server/tower-server.js over a WebSocket at
// ./ws (nginx proxies /tower/ws to the Node service). Works with any
// relative mount point, and falls back to ws://host:8096 when opened from a
// local file server so the game can be tested without nginx.

export class Net {
  constructor() {
    this.ws = null;
    this.id = null;
    this.room = null;           // lobby view from the server
    this.status = 'offline';    // offline | connecting | online | error
    this.error = '';
    this.handlers = {};
    this.lastSend = 0;
  }

  on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); return this; }
  emit(type, msg) { (this.handlers[type] || []).forEach(fn => fn(msg)); }

  url() {
    const q = new URLSearchParams(location.search).get('ws');
    if (q) return q;
    // packaged as a native app (Capacitor serves from capacitor:// on iOS and
    // https://localhost on Android): talk to the live race server
    if (window.Capacitor || location.protocol === 'capacitor:' || location.protocol === 'file:' ||
        (location.hostname === 'localhost' && location.port === ''))
      return 'wss://capy.apforge.net/tower/ws';
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== '')
      return `${proto}//${location.hostname}:8096/`;
    return `${proto}//${location.host}${location.pathname.replace(/[^/]*$/, '')}ws`;
  }

  connect(name, char) {
    if (this.ws && this.ws.readyState <= 1) { this.hello(name, char); return Promise.resolve(); }
    this.status = 'connecting'; this.error = '';
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url()); } catch (e) {
        this.status = 'error'; this.error = 'Could not reach the race server.'; reject(e); return;
      }
      this.ws = ws;
      const timer = setTimeout(() => { if (ws.readyState !== 1) ws.close(); }, 6000);
      ws.onopen = () => {
        clearTimeout(timer);
        this.status = 'online';
        this.hello(name, char);
        resolve();
      };
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch (_) { return; }
        if (m.t === 'welcome') this.id = m.id;
        if (m.t === 'joined') this.id = m.you || this.id;
        if (m.t === 'lobby') this.room = m.room;
        if (m.t === 'err') this.error = m.msg;
        this.emit(m.t, m);
      };
      ws.onclose = () => {
        clearTimeout(timer);
        const was = this.status;
        this.status = was === 'connecting' ? 'error' : 'offline';
        if (was === 'connecting') { this.error = 'Could not reach the race server.'; reject(new Error('closed')); }
        this.room = null; this.ws = null;
        this.emit('close', {});
      };
      ws.onerror = () => {};
    });
  }

  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  hello(name, char) { this.send({ t: 'hello', name, char }); }
  create(pub = true) { this.send({ t: 'create', pub }); }
  join(code) { this.send({ t: 'join', code }); }
  quick() { this.send({ t: 'quick' }); }
  ready(v) { this.send({ t: 'ready', v }); }
  start() { this.send({ t: 'start' }); }
  leave() { this.send({ t: 'leave' }); this.room = null; }
  event(k, d) { this.send({ t: 'ev', k, d }); }
  dead(d) { this.send({ t: 'dead', ...d }); }
  disconnect() { if (this.ws) this.ws.close(); }

  // throttled position stream (~15 Hz)
  state(now, d) {
    if (now - this.lastSend < 60) return;
    this.lastSend = now;
    this.send({ t: 's', d });
  }

  get isHost() { return !!(this.room && this.room.host === this.id); }
}
