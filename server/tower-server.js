#!/usr/bin/env node
/* ===========================================================================
   Capy Tower — online race lobby + relay
   No dependencies: RFC6455 is implemented inline (same approach as Capy
   Leap's mp-server.js), so there is nothing to npm install on the server.

     PORT=8096 node server/tower-server.js

   Rooms hold up to 4 players. Everyone climbs the same seeded tower on their
   own camera; the server hands out the seed, relays each player's position
   at ~15 Hz and ranks the race: the last capybara still climbing wins.
   The server never simulates the game.
   =========================================================================== */
'use strict';
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8096);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_PLAYERS = 4;
const TICK_MS = 66;                       // relay flush rate (~15 Hz)
const IDLE_MS = 45000;
const COUNTDOWN_MS = 3200;                // "3, 2, 1, GO" before the clock runs
const CHARS = ['capy', 'yoru', 'tico', 'piko', 'chang'];
const MAPS = ['classic', 'onsen', 'reef', 'sky', 'toys'];

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const rooms = new Map();                  // code -> room
const clients = new Set();

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ----------------------------------------------------------- ws framing */
function frame(str) {
  const data = Buffer.from(str, 'utf8');
  const len = data.length;
  let head;
  if (len < 126) {
    head = Buffer.alloc(2); head[1] = len;
  } else if (len < 65536) {
    head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10); head[1] = 127;
    head.writeUInt32BE(0, 2); head.writeUInt32BE(len, 6);
  }
  head[0] = 0x81;                                   // FIN + text
  return Buffer.concat([head, data]);
}
function ctlFrame(opcode, payload) {
  const p = payload || Buffer.alloc(0);
  const b = Buffer.alloc(2 + p.length);
  b[0] = 0x80 | opcode; b[1] = p.length;
  p.copy(b, 2);
  return b;
}

class Client {
  constructor(sock) {
    this.sock = sock;
    this.buf = Buffer.alloc(0);
    this.id = crypto.randomBytes(4).toString('hex');
    this.name = 'capy';
    this.char = 'capy';
    this.room = null;
    this.ready = false;
    this.state = null;
    this.dirty = false;
    this.result = null;                   // { floor, score, combo, time, place }
    this.alive = true;
    this.last = Date.now();
    clients.add(this);
  }
  send(obj) {
    if (!this.alive) return;
    try { this.sock.write(frame(JSON.stringify(obj))); } catch (e) { this.close(); }
  }
  close() {
    if (!this.alive) return;
    this.alive = false;
    clients.delete(this);
    try { this.sock.end(); } catch (e) {}
    leaveRoom(this);
  }
  feed(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const op = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) {
        if (b.length < 10) return;
        if (b.readUInt32BE(2) !== 0) return this.close();
        len = b.readUInt32BE(6); off = 10;
      }
      if (len > 1 << 16) return this.close();                 // 64 KB is plenty
      const need = off + (masked ? 4 : 0) + len;
      if (b.length < need) return;
      let payload;
      if (masked) {
        const key = b.slice(off, off + 4);
        payload = Buffer.from(b.slice(off + 4, need));
        for (let i = 0; i < payload.length; i++) payload[i] ^= key[i & 3];
      } else payload = b.slice(off, need);
      this.buf = b.slice(need);
      this.last = Date.now();

      if (op === 0x8) return this.close();
      if (op === 0x9) { try { this.sock.write(ctlFrame(0xA, payload)); } catch (e) {} continue; }
      if (op !== 0x1) continue;                               // text only
      let msg;
      try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; }
      if (msg && typeof msg === 'object') handle(this, msg);
    }
  }
}

/* ----------------------------------------------------------- rooms */
function newCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); }
  while (rooms.has(c));
  return c;
}
function roomView(r) {
  return {
    code: r.code, state: r.state, host: r.host, pub: r.pub, map: r.map || 'classic',
    players: r.players.map(p => ({
      id: p.id, name: p.name, char: p.char, ready: p.ready,
      host: p.id === r.host, result: p.result
    }))
  };
}
function pushLobby(r) {
  const v = roomView(r);
  r.players.forEach(p => p.send({ t: 'lobby', room: v }));
}
function leaveRoom(c) {
  const r = c.room; if (!r) return;
  // quitting mid-race counts as falling off
  if (r.state === 'playing' && !c.result) knockOut(r, c, { floor: (c.state || {}).fl, score: (c.state || {}).sc });
  c.room = null; c.ready = false; c.result = null; c.state = null;
  r.players = r.players.filter(p => p !== c);
  r.players.forEach(p => p.send({ t: 'left', id: c.id }));
  if (!r.players.length) { rooms.delete(r.code); log('room', r.code, 'closed'); return; }
  if (r.host === c.id) r.host = r.players[0].id;
  if (r.state === 'playing') checkFinished(r);
  pushLobby(r);
}
function joinRoom(c, r) {
  if (r.players.length >= MAX_PLAYERS) return c.send({ t: 'err', msg: 'That room is full.' });
  if (r.state === 'playing') return c.send({ t: 'err', msg: 'That race already started.' });
  leaveRoom(c);
  c.room = r; c.ready = false; c.result = null; c.state = null;
  r.players.push(c);
  c.send({ t: 'joined', code: r.code, you: c.id });
  r.players.forEach(p => { if (p !== c) p.send({ t: 'ev', id: c.id, k: 'join', d: { name: c.name } }); });
  pushLobby(r);
}

/* ----------------------------------------------------------- race */
// A racer is done either by falling off (knocked out) or by reaching the
// summit on a summit map. Final order: summit finishers by time, then the
// fallers, latest fall first; score breaks ties.
function knockOut(r, c, d, summit = false) {
  c.result = {
    floor: Math.max(0, d.floor | 0), score: Math.max(0, d.score | 0),
    combo: Math.max(0, d.combo | 0), summit,
    time: Math.max(0, Date.now() - r.startedAt - COUNTDOWN_MS),
    order: ++r.doneCount,
  };
  r.players.forEach(p => p.send({ t: 'out', id: c.id, result: c.result }));
  log('room', r.code, c.name, summit ? 'reached the summit' : 'out on floor', c.result.floor);
}
function ranked(players) {
  return players.slice().sort((a, b) => {
    const x = a.result, y = b.result;
    if (x.summit !== y.summit) return x.summit ? -1 : 1;
    if (x.summit) return x.time - y.time;
    return y.order - x.order || y.score - x.score;
  });
}
function checkFinished(r) {
  if (r.state !== 'playing' || r.players.some(p => !p.result)) return;
  r.state = 'lobby';
  r.players.forEach(p => { p.ready = false; });
  const order = ranked(r.players).map((p, i) => ({ id: p.id, name: p.name, char: p.char, ...p.result, place: i + 1 }));
  r.players.forEach(p => p.send({ t: 'results', order }));
  pushLobby(r);
  log('room', r.code, 'finished, winner', order[0] && order[0].name);
}

/* ----------------------------------------------------------- protocol */
function handle(c, m) {
  switch (m.t) {
    case 'hello':
      c.name = String(m.name || 'capy').replace(/[^\x20-\x7e]/g, '').trim().slice(0, 12) || 'capy';
      c.char = CHARS.includes(m.char) ? m.char : 'capy';
      c.send({ t: 'welcome', id: c.id, players: clients.size, rooms: rooms.size });
      if (c.room) pushLobby(c.room);
      break;

    case 'create': {
      const r = { code: newCode(), host: c.id, players: [], state: 'lobby',
                  pub: m.pub !== false, created: Date.now() };
      rooms.set(r.code, r);
      log('room', r.code, 'created by', c.name);
      joinRoom(c, r);
      break;
    }
    case 'join': {
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) return c.send({ t: 'err', msg: 'No room with that code.' });
      joinRoom(c, r);
      break;
    }
    case 'quick': {
      let best = null;
      for (const r of rooms.values())
        if (r.pub && r.state === 'lobby' && r.players.length < MAX_PLAYERS)
          if (!best || r.players.length > best.players.length) best = r;
      if (best) joinRoom(c, best);
      else handle(c, { t: 'create', pub: true });
      break;
    }
    case 'ready':
      if (!c.room) return;
      c.ready = !!m.v; pushLobby(c.room);
      break;
    case 'start': {
      const r = c.room;
      if (!r || r.host !== c.id || r.state === 'playing') return;
      r.state = 'playing';
      r.startedAt = Date.now();
      r.doneCount = 0;
      r.players.forEach(p => { p.result = null; p.state = null; p.ready = false; });
      const seed = (Math.random() * 2147483647) | 0;
      r.players.forEach(p => p.send({ t: 'go', seed, countdown: COUNTDOWN_MS, map: r.map || 'classic',
        players: r.players.map(q => ({ id: q.id, name: q.name, char: q.char })) }));
      pushLobby(r);
      log('room', r.code, 'race started with', r.players.length);
      break;
    }
    case 's':                                   // player state, batched relay
      if (!c.room || c.room.state !== 'playing' || c.result) return;
      c.state = m.d && typeof m.d === 'object' ? m.d : null; c.dirty = true;
      break;
    case 'ev': {                                // one-off event (praise, combo...)
      const r = c.room; if (!r) return;
      const out = { t: 'ev', id: c.id, k: String(m.k || '').slice(0, 16), d: m.d };
      r.players.forEach(p => { if (p !== c) p.send(out); });
      break;
    }
    case 'map':
      if (!c.room || c.room.host !== c.id || c.room.state === 'playing') return;
      if (MAPS.includes(m.map)) { c.room.map = m.map; pushLobby(c.room); }
      break;
    case 'summit': {
      const r = c.room;
      if (!r || r.state !== 'playing' || c.result || (r.map || 'classic') === 'classic') return;
      knockOut(r, c, m, true);
      checkFinished(r);
      pushLobby(r);
      break;
    }
    case 'dead': {
      const r = c.room;
      if (!r || r.state !== 'playing' || c.result) return;
      knockOut(r, c, m);
      checkFinished(r);
      pushLobby(r);
      break;
    }
    case 'leave': leaveRoom(c); c.send({ t: 'lobby', room: null }); break;
    case 'ping': c.send({ t: 'pong', d: m.d }); break;
  }
}

/* ----------------------------------------------------------- relay loop */
setInterval(() => {
  for (const r of rooms.values()) {
    if (r.state !== 'playing') continue;
    const moving = r.players.filter(p => p.dirty && p.state);
    if (!moving.length) continue;
    const msg = { t: 'sync', p: moving.map(p => ({ id: p.id, d: p.state })) };
    moving.forEach(p => { p.dirty = false; });
    r.players.forEach(p => p.send(msg));
  }
}, TICK_MS);

setInterval(() => {
  const now = Date.now();
  for (const c of Array.from(clients)) {
    if (now - c.last > IDLE_MS) { log('idle drop', c.name); c.close(); }
    else try { c.sock.write(ctlFrame(0x9)); } catch (e) { c.close(); }
  }
}, 15000);

/* ----------------------------------------------------------- http/upgrade */
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/ws/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, clients: clients.size, rooms: rooms.size }));
  }
  res.writeHead(426, { 'Content-Type': 'text/plain' });
  res.end('websocket only');
});

server.on('upgrade', (req, sock, head) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    sock.destroy(); return;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = new Client(sock);
  if (head && head.length) c.feed(head);
  sock.on('data', d => c.feed(d));
  sock.on('error', () => c.close());
  sock.on('close', () => c.close());
});

server.listen(PORT, HOST, () =>
  log(`capy-tower race server on ws://${HOST}:${PORT}  (max ${MAX_PLAYERS}/room)`));
