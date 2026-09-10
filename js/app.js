'use strict';

const W = 480;
const H = 600;
const HUD_H = 36;
const BRICK_TOP = HUD_H + 18;
const BRICK_MARGIN = 14;
const BRICK_GAP = 4;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_H = 20;
const ROW_VALUE = [50, 50, 30, 30, 20, 10];
const ROW_HP = [1, 1, 1, 1, 2, 2];
const PADDLE_W = 92;
const PADDLE_H = 14;
const PADDLE_Y = H - 52;
const PADDLE_SPEED = 430;
const BALL_R = 7;
const BASE_SPEED = 300;
const SPEED_STEP = 26;
const MAX_SPEED = 640;
const MAX_LEVEL = 5;
const MAX_LIVES = 3;
const TRAIL_LEN = 10;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const AudioFX = (function () {
  let ctx = null;
  let enabled = true;

  function unlock() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function beep(freq, dur, vol, when, type) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  return {
    unlock,
    isOn: () => enabled,
    toggle() {
      enabled = !enabled;
      if (enabled) beep(880, 0.05, 0.2, 0);
      return enabled;
    },
    select() { beep(880, 0.05, 0.2, 0); },
    move() { beep(420, 0.03, 0.1, 0); },
    wall() { beep(235, 0.04, 0.16, 0); },
    paddle() { beep(520, 0.045, 0.22, 0); },
    brick(row) { beep(620 + row * 34, 0.055, 0.26, 0); },
    breakBrick(row) { beep(760 + row * 42, 0.07, 0.28, 0); },
    launch() { beep(340, 0.05, 0.2, 0); beep(680, 0.08, 0.2, 0.06); },
    lose() { beep(300, 0.12, 0.24, 0); beep(190, 0.18, 0.24, 0.12); beep(120, 0.26, 0.24, 0.3); },
    levelClear() { [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.09, 0.2, i * 0.09)); },
    gameOver() { [392, 330, 262, 196, 147, 98].forEach((f, i) => beep(f, 0.13, 0.22, i * 0.11)); },
    victory() { [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => beep(f, 0.1, 0.2, i * 0.1)); },
    pause() { beep(440, 0.06, 0.18, 0); },
    resume() { beep(660, 0.06, 0.18, 0); }
  };
})();

const HighScores = (function () {
  const KEY = 'arknoid.scores.v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10))); } catch (e) {}
  }

  function qualifies(score) {
    if (typeof score !== 'number' || score <= 0) return false;
    const list = load();
    if (list.length < 10) return true;
    return score > list[list.length - 1].score;
  }

  function add(name, score, level) {
    const list = load();
    const rec = {
      name: String(name || 'AAA').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'AAA',
      score: Math.floor(score) || 0,
      level: Math.floor(level) || 1
    };
    list.push(rec);
    list.sort((a, b) => b.score - a.score);
    list.length = Math.min(10, list.length);
    save(list);
    return { list, rank: list.indexOf(rec) + 1 };
  }

  function best() {
    const list = load();
    return list.length ? list[0].score : 0;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  return { load, qualifies, add, best, clear };
})();

const GLYPH_ROWS = 7;
const GLYPHS = {
  A: ['  █  ', ' █ █ ', '█   █', '█████', '█   █', '█   █', '█   █'],
  B: ['████ ', '█   █', '█   █', '████ ', '█   █', '█   █', '████ '],
  C: [' ███ ', '█   █', '█    ', '█    ', '█    ', '█   █', ' ███ '],
  D: ['████ ', '█   █', '█   █', '█   █', '█   █', '█   █', '████ '],
  E: ['█████', '█    ', '█    ', '████ ', '█    ', '█    ', '█████'],
  F: ['█████', '█    ', '█    ', '████ ', '█    ', '█    ', '█    '],
  G: [' ███ ', '█    ', '█    ', '█ ███', '█   █', '█   █', ' ███ '],
  H: ['█   █', '█   █', '█   █', '█████', '█   █', '█   █', '█   █'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '  █  ', '  █  ', '█████'],
  J: ['  ███', '   █ ', '   █ ', '   █ ', '   █ ', '█  █ ', ' ██  '],
  K: ['█   █', '█  █ ', '█ █  ', '██   ', '█ █  ', '█  █ ', '█   █'],
  L: ['█    ', '█    ', '█    ', '█    ', '█    ', '█    ', '█████'],
  M: ['█   █', '██ ██', '█ █ █', '█   █', '█   █', '█   █', '█   █'],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █', '█   █', '█   █'],
  O: [' ███ ', '█   █', '█   █', '█   █', '█   █', '█   █', ' ███ '],
  P: ['████ ', '█   █', '█   █', '████ ', '█    ', '█    ', '█    '],
  Q: [' ███ ', '█   █', '█   █', '█   █', '█ █ █', '█  █ ', ' ██ █'],
  R: ['████ ', '█   █', '█   █', '████ ', '█ █  ', '█  █ ', '█   █'],
  S: [' ████', '█    ', '█    ', ' ███ ', '    █', '    █', '████ '],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  ', '  █  ', '  █  '],
  U: ['█   █', '█   █', '█   █', '█   █', '█   █', '█   █', ' ███ '],
  V: ['█   █', '█   █', '█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  W: ['█   █', '█   █', '█   █', '█ █ █', '█ █ █', '██ ██', '█   █'],
  X: ['█   █', '█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █', '█   █'],
  Y: ['█   █', '█   █', ' █ █ ', '  █  ', '  █  ', '  █  ', '  █  '],
  Z: ['█████', '   █ ', '  █  ', ' █   ', '█    ', '█    ', '█████']
};

function buildLogo(word) {
  const chars = word.toUpperCase().split('');
  const rows = [];
  for (let i = 0; i < GLYPH_ROWS; i++) {
    let line = '';
    chars.forEach((c, idx) => {
      if (idx > 0) line += '   ';
      if (c === ' ') { line += '      '; return; }
      line += GLYPHS[c] ? GLYPHS[c][i] : '     ';
    });
    rows.push(line);
  }
  return rows.join('\n');
}

const Menu = (function () {
  let idx = 0;
  let buttons = [];
  const items = [
    { label: 'INICIAR JOGO', nav: 'newgame' },
    { label: 'HIGH-SCORES', nav: 'scores' },
    { label: 'COMO JOGAR', nav: 'help' }
  ];

  function mount() {
    const el = document.getElementById('mainMenu');
    el.innerHTML = '';
    buttons = [];
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu-item';
      b.setAttribute('aria-label', it.label);
      b.addEventListener('click', () => { set(i); select(); });
      el.appendChild(b);
      buttons.push(b);
    });
    set(0);
  }

  function set(n) {
    idx = (n + items.length) % items.length;
    buttons.forEach((b, i) => {
      b.className = 'menu-item' + (i === idx ? ' active' : '');
      b.textContent = (i === idx ? '>  ' : '   ') + items[i].label;
    });
  }

  function move(delta) {
    set(idx + delta);
    AudioFX.move();
  }

  function select() {
    AudioFX.select();
    Screens.go(items[idx].nav);
  }

  return { mount, move, select };
})();

const Screens = (function () {
  let current = 'menu';
  let game = null;

  function show(id) {
    current = id;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + id);
    if (target) target.classList.add('active');
  }

  function updateMenuMeta() {
    const high = document.getElementById('highPreview');
    if (high) high.textContent = 'RECORDE: ' + HighScores.best();
  }

  function paintScores() {
    const rows = HighScores.load();
    const tb = document.getElementById('scoreTable');
    tb.innerHTML = '';
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = '— ARCADE SISTEMA VAZIO —';
      td.className = 'empty';
      tr.appendChild(td);
      tb.appendChild(tr);
      return;
    }
    const head = document.createElement('tr');
    ['RANK', 'OPERADOR', 'SCORE'].forEach(t => {
      const th = document.createElement('th');
      th.textContent = t;
      head.appendChild(th);
    });
    tb.appendChild(head);
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.className = i === 0 ? 'best' : '';
      [String(i + 1).padStart(2, '0'), r.name, String(r.score).padStart(6, '0')].forEach(t => {
        const td = document.createElement('td');
        td.textContent = t;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  function go(name) {
    AudioFX.unlock();
    switch (name) {
      case 'newgame':
        if (game) game.newGame();
        show('game');
        break;
      case 'menu':
        updateMenuMeta();
        show('menu');
        break;
      case 'scores':
        paintScores();
        show('scores');
        break;
      case 'help':
        show('help');
        break;
    }
  }

  return {
    show,
    go,
    setGame(g) { game = g; },
    get current() { return current; }
  };
})();

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pointerDown = false;
    this.pendingRun = null;
    this.state = 'ready';
    this.level = 1;
    this.lives = MAX_LIVES;
    this.score = 0;
    this.best = HighScores.best();
    this.paddle = { x: 0, w: PADDLE_W, y: PADDLE_Y, keyDir: 0, ctrlMode: 'key', target: null };
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: BALL_R, docked: true, spd: BASE_SPEED };
    this.bricks = [];
    this.trail = [];
    this.banner = null;
    this.loopT0 = 0;
    this.resize();
    this.bind();
    this.newGame();
    requestAnimationFrame(() => this.loop(0));
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = W * this.dpr;
    this.canvas.height = H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const wrap = document.getElementById('gameWrap');
    if (!wrap) return;
    const cw = wrap.clientWidth || W;
    const ch = wrap.clientHeight || H;
    const scale = Math.min(cw / W, ch / H);
    this.canvas.style.width = Math.floor(W * scale) + 'px';
    this.canvas.style.height = Math.floor(H * scale) + 'px';
  }

  newGame() {
    this.score = 0;
    this.lives = MAX_LIVES;
    this.startLevel(1);
  }

  startLevel(level) {
    this.level = level;
    this.best = HighScores.best();
    this.bricks = this.buildBricks();
    this.state = 'ready';
    this.banner = { text: 'LEVEL ' + level, t: 1.4 };
    this.resetPaddle();
    this.trail.length = 0;
  }

  buildBricks() {
    const bw = (W - BRICK_MARGIN * 2 - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
    const list = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        list.push({
          x: BRICK_MARGIN + c * (bw + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: bw,
          h: BRICK_H,
          hp: ROW_HP[r],
          val: ROW_VALUE[r],
          row: r
        });
      }
    }
    return list;
  }

  resetPaddle() {
    this.paddle.x = (W - PADDLE_W) / 2;
    this.paddle.keyDir = 0;
    this.paddle.ctrlMode = 'key';
    this.paddle.target = null;
    this.ball.spd = Math.min(BASE_SPEED + SPEED_STEP * (this.level - 1), MAX_SPEED);
    this.ball.docked = true;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.x = this.paddle.x + PADDLE_W / 2;
    this.ball.y = PADDLE_Y - BALL_R - 1;
  }

  launch() {
    if (this.state !== 'ready') return;
    const a = (Math.random() - 0.5) * 0.5;
    this.ball.docked = false;
    this.ball.vx = Math.sin(a) * this.ball.spd;
    this.ball.vy = -Math.cos(a) * this.ball.spd;
    this.state = 'playing';
    this.trail.length = 0;
    AudioFX.launch();
  }

  togglePause() {
    if (Screens.current !== 'game') return;
    if (this.state === 'playing' || this.state === 'ready') {
      this.state = 'paused';
      document.getElementById('pauseOverlay').classList.add('visible');
      AudioFX.pause();
    } else if (this.state === 'paused') {
      this.state = this.ball.docked ? 'ready' : 'playing';
      document.getElementById('pauseOverlay').classList.remove('visible');
      AudioFX.resume();
    }
  }

  update(dt) {
    if (this.state === 'paused' || this.state === 'over') return;

    const pad = this.paddle;
    if (pad.ctrlMode === 'key') {
      pad.x += pad.keyDir * PADDLE_SPEED * dt;
    } else if (pad.target !== null) {
      pad.x += (pad.target - (pad.x + PADDLE_W / 2)) * Math.min(1, 20 * dt);
    }
    pad.x = clamp(pad.x, 0, W - PADDLE_W);

    if (this.ball.docked) {
      this.ball.x = pad.x + PADDLE_W / 2;
      this.ball.y = PADDLE_Y - BALL_R - 1;
      if (this.banner) {
        this.banner.t -= dt;
        if (this.banner.t <= 0) this.banner = null;
      }
      return;
    }

    const px = this.ball.x;
    const py = this.ball.y;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > TRAIL_LEN) this.trail.shift();
    this.collide(px, py);

    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }

    if (this.bricks.length === 0) {
      if (this.level >= MAX_LEVEL) {
        this.victory();
      } else {
        this.level++;
        AudioFX.levelClear();
        this.startLevel(this.level);
      }
    }
  }

  collide(px, py) {
    const b = this.ball;
    const pad = this.paddle;

    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); AudioFX.wall(); }
    else if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); AudioFX.wall(); }
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); AudioFX.wall(); }

    if (b.vy > 0 && py + b.r <= pad.y && b.y + b.r >= pad.y && b.x >= pad.x - b.r && b.x <= pad.x + pad.w + b.r) {
      const rel = clamp((b.x - (pad.x + pad.w / 2)) / (pad.w / 2 + b.r), -1, 1);
      const ang = rel * (Math.PI / 3);
      b.vx = Math.sin(ang) * b.spd;
      b.vy = -Math.abs(Math.cos(ang)) * b.spd;
      b.y = pad.y - b.r - 0.5;
      AudioFX.paddle();
    }

    for (let i = 0; i < this.bricks.length; i++) {
      const br = this.bricks[i];
      const cx = clamp(b.x, br.x, br.x + br.w);
      const cy = clamp(b.y, br.y, br.y + br.h);
      const dx = b.x - cx;
      const dy = b.y - cy;
      if (dx * dx + dy * dy > b.r * b.r) continue;

      const ol = b.x + b.r - br.x;
      const orr = br.x + br.w - (b.x - b.r);
      const ot = b.y + b.r - br.y;
      const ob = br.y + br.h - (b.y - b.r);
      const mx = Math.min(ol, orr);
      const my = Math.min(ot, ob);

      if (mx < my) {
        if (ol < orr) { b.vx = -Math.abs(b.vx); b.x = br.x - b.r; }
        else { b.vx = Math.abs(b.vx); b.x = br.x + br.w + b.r; }
      } else {
        if (ot < ob) { b.vy = -Math.abs(b.vy); b.y = br.y - b.r; }
        else { b.vy = Math.abs(b.vy); b.y = br.y + br.h + b.r; }
      }

      br.hp--;
      if (br.hp <= 0) {
        this.bricks.splice(i, 1);
        this.score += br.val;
        if (this.score > this.best) this.best = this.score;
        AudioFX.breakBrick(br.row);
      } else {
        AudioFX.brick(br.row);
      }
      break;
    }

    if (b.y - b.r > H) this.loseLife();
  }

  loseLife() {
    this.trail.length = 0;
    if (this.state === 'over') return;
    this.lives--;
    if (this.lives <= 0) {
      this.state = 'over';
      AudioFX.gameOver();
      this.showResult(false);
      return;
    }
    AudioFX.lose();
    this.state = 'ready';
    this.resetPaddle();
  }

  victory() {
    this.state = 'over';
    AudioFX.victory();
    this.showResult(true);
  }

  showResult(win) {
    this.pendingRun = { win, score: this.score, level: this.level };
    document.getElementById('resultArt').textContent = buildLogo(win ? 'YOU WIN' : 'GAME OVER');
    document.getElementById('resultTitle').textContent = win ? 'VITÓRIA // SISTEMA OK' : 'GAME OVER';
    document.getElementById('resultMsg').textContent = win
      ? 'TODOS OS BLOCOS DESTRUÍDOS. LINHA DE COMANDO CUMPRIDA.'
      : 'SEM VIDA DETECTADA. DRIVE C: NÃO RESPONDE.';
    document.getElementById('finalScore').textContent = String(this.score).padStart(6, '0');
    document.getElementById('finalLevel').textContent = String(this.level).padStart(2, '0');
    document.getElementById('finalRank').textContent = '#1';
    document.getElementById('rankLine').hidden = true;
    const entry = document.getElementById('nameEntry');
    entry.hidden = !HighScores.qualifies(this.score);
    if (entry.hidden) {
      this.pendingRun = null;
    } else {
      document.getElementById('playerName').value = '';
      setTimeout(() => document.getElementById('playerName').focus(), 60);
    }
    Screens.show('result');
  }

  saveName() {
    if (!this.pendingRun) return;
    const input = document.getElementById('playerName');
    const { rank } = HighScores.add(input.value, this.pendingRun.score, this.pendingRun.level);
    this.best = HighScores.best();
    if (rank > 0) {
      document.getElementById('finalRank').textContent = '#' + rank;
      document.getElementById('rankLine').hidden = false;
    }
    document.getElementById('nameEntry').hidden = true;
    this.pendingRun = null;
    input.blur();
    AudioFX.select();
  }

  toLogicalX(e) {
    const rect = this.canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * W;
  }

  bind() {
    const canvas = this.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (Screens.current !== 'game') return;
      AudioFX.unlock();
      e.preventDefault();
      this.pointerDown = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      this.paddle.target = clamp(this.toLogicalX(e), 0, W);
      this.paddle.ctrlMode = 'ptr';
      if (this.ball.docked && this.state === 'ready') this.launch();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (Screens.current !== 'game') return;
      this.paddle.target = clamp(this.toLogicalX(e), 0, W);
      this.paddle.ctrlMode = 'ptr';
    });

    const end = () => { this.pointerDown = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      AudioFX.unlock();
      const k = e.code;

      if (Screens.current === 'menu') {
        if (k === 'ArrowUp' || k === 'ArrowDown') {
          e.preventDefault();
          Menu.move(k === 'ArrowUp' ? -1 : 1);
        } else if (k === 'Enter' || k === 'Space') {
          e.preventDefault();
          Menu.select();
        }
        return;
      }

      if (Screens.current !== 'game') return;

      if (k === 'ArrowLeft' || k === 'KeyA') {
        this.paddle.keyDir = -1;
        this.paddle.ctrlMode = 'key';
        this.paddle.target = null;
      } else if (k === 'ArrowRight' || k === 'KeyD') {
        this.paddle.keyDir = 1;
        this.paddle.ctrlMode = 'key';
        this.paddle.target = null;
      } else if (k === 'Space' || k === 'Enter') {
        e.preventDefault();
        if (this.state === 'ready') this.launch();
        else if (this.state === 'paused') this.togglePause();
      } else if (k === 'KeyP' || k === 'Escape') {
        this.togglePause();
      } else if (k === 'KeyM') {
        this.toggleSound();
      }

      if (k.startsWith('Arrow')) e.preventDefault();
    });

    document.addEventListener('keyup', (e) => {
      if (Screens.current !== 'game') return;
      const k = e.code;
      if ((k === 'ArrowLeft' || k === 'KeyA') && this.paddle.keyDir === -1) this.paddle.keyDir = 0;
      if ((k === 'ArrowRight' || k === 'KeyD') && this.paddle.keyDir === 1) this.paddle.keyDir = 0;
    });

    const btn = (id) => document.getElementById(id);
    const setPad = (dir) => {
      this.paddle.keyDir = dir;
      this.paddle.ctrlMode = 'key';
      this.paddle.target = null;
    };
    const stopPad = () => { this.paddle.keyDir = 0; };

    const leftB = btn('btnLeft');
    const rightB = btn('btnRight');
    leftB.addEventListener('pointerdown', () => setPad(-1));
    leftB.addEventListener('pointerup', stopPad);
    leftB.addEventListener('pointerleave', stopPad);
    leftB.addEventListener('pointercancel', stopPad);
    rightB.addEventListener('pointerdown', () => setPad(1));
    rightB.addEventListener('pointerup', stopPad);
    rightB.addEventListener('pointerleave', stopPad);
    rightB.addEventListener('pointercancel', stopPad);

    btn('btnLaunch').addEventListener('click', () => {
      AudioFX.unlock();
      if (this.state === 'ready') this.launch();
      else if (this.state === 'paused') this.togglePause();
    });
    btn('btnPause').addEventListener('click', () => {
      AudioFX.unlock();
      this.togglePause();
    });
    btn('btnSound').addEventListener('click', () => {
      AudioFX.unlock();
      this.toggleSound();
    });
    btn('btnSave').addEventListener('click', () => this.saveName());
    btn('playerName').addEventListener('keydown', (e) => {
      if (e.code === 'Enter') this.saveName();
    });
    document.querySelectorAll('[data-resume]').forEach(el => {
      el.addEventListener('click', () => this.togglePause());
    });
  }

  toggleSound() {
    const on = AudioFX.toggle();
    const b = document.getElementById('btnSound');
    b.textContent = on ? '◉' : '○';
    b.classList.toggle('off', !on);
  }

  loop(t) {
    requestAnimationFrame((nt) => this.loop(nt));
    if (t === 0 || this.loopT0 === 0) {
      this.loopT0 = t || 0;
      return;
    }
    let dt = (t - this.loopT0) / 1000;
    this.loopT0 = t;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    this.update(dt);
    if (Screens.current === 'game') this.render();
  }

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(51,255,102,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    this.drawTrail(ctx);
    this.drawBricks(ctx);
    this.drawPaddle(ctx);
    this.drawBall(ctx);
    this.drawHud(ctx);
    this.drawBanner(ctx);
    this.drawReadyHint(ctx);
  }

  drawTrail(ctx) {
    const len = this.trail.length;
    for (let i = 0; i < len; i++) {
      const p = this.trail[i];
      ctx.fillStyle = 'rgba(51,255,102,' + (i / len) * 0.22 + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * (i / len + 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBricks(ctx) {
    for (const b of this.bricks) {
      ctx.fillStyle = b.hp > 1 ? '#1c7a3a' : '#2fd860';
      ctx.fillRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.fillStyle = 'rgba(51,255,102,0.9)';
      ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 3);
      if (b.hp > 1) {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        for (let o = -b.h; o < b.w; o += 8) {
          ctx.moveTo(b.x + o, b.y + b.h);
          ctx.lineTo(b.x + o + b.h, b.y);
        }
        ctx.stroke();
      }
    }
  }

  drawPaddle(ctx) {
    const pad = this.paddle;
    ctx.fillStyle = '#0f5330';
    ctx.fillRect(pad.x + 2, pad.y + 2, pad.w - 4, pad.h - 4);
    ctx.fillStyle = '#33ff66';
    ctx.fillRect(pad.x, pad.y, pad.w, 3);
    ctx.fillRect(pad.x, pad.y + pad.h - 3, pad.w, 3);
    ctx.fillStyle = 'rgba(51,255,102,0.5)';
    ctx.fillRect(pad.x + 9, pad.y + 4, 3, 5);
    ctx.fillRect(pad.x + pad.w - 12, pad.y + 4, 3, 5);
  }

  drawBall(ctx) {
    const b = this.ball;
    ctx.fillStyle = 'rgba(51,255,102,0.25)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#66ff99';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(b.x - 2, b.y - 2, BALL_R * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHud(ctx) {
    ctx.font = '600 13px "Courier New", monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2fd860';
    ctx.fillText('SCORE', 14, 14);
    ctx.fillStyle = '#33ff66';
    ctx.fillText(String(this.score).padStart(6, '0'), 14, 32);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#2fd860';
    ctx.fillText('NÍVEL', W / 2, 14);
    ctx.fillStyle = '#33ff66';
    ctx.fillText(String(this.level).padStart(2, '0'), W / 2, 32);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#2fd860';
    ctx.fillText('RECORDE', W - 14, 14);
    ctx.fillStyle = '#33ff66';
    ctx.fillText(String(this.best).padStart(6, '0'), W - 14, 32);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#2fd860';
    ctx.fillText('VIDAS', 14, 50);
    for (let i = 0; i < MAX_LIVES; i++) {
      ctx.fillStyle = i < this.lives ? '#33ff66' : '#12331d';
      ctx.fillRect(84 + i * 13, 44, 9, 9);
    }
  }

  drawBanner(ctx) {
    if (!this.banner) return;
    if (Math.floor(this.banner.t * 6) % 2 !== 0) return;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#33ff66';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(this.banner.text, W / 2, 150);
    if (this.level > 1) {
      ctx.fillStyle = 'rgba(51,255,102,0.6)';
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText('NOVO NÍVEL DETECTADO', W / 2, 168);
    }
  }

  drawReadyHint(ctx) {
    if (this.state !== 'ready') return;
    if (Math.floor(Date.now() / 400) % 2 !== 0) return;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(51,255,102,0.8)';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('PRESSIONE [ESPAÇO] OU TOQUE PARA LANÇAR', W / 2, PADDLE_Y - 30);
  }
}

function wireNav() {
  document.querySelectorAll('[data-nav]').forEach(b => {
    b.addEventListener('click', () => {
      AudioFX.unlock();
      AudioFX.select();
      Screens.go(b.getAttribute('data-nav'));
    });
  });
  document.getElementById('btnClearScores').addEventListener('click', () => {
    if (window.confirm('APAGAR TODOS OS REGISTROS DO HIGH-SCORE?')) {
      HighScores.clear();
      Screens.go('scores');
    }
  });
}

function bootSequence() {
  const el = document.getElementById('bootText');
  const lines = [
    'C:\\> ARKANOID.EXE /gfx:mda /snd:pcspk',
    'BIOS ..................... OK',
    '640K RAM ................. OK',
    'VÍDEO MONO 80x25 ......... OK',
    'BALL\\MODULE.BIN .......... OK',
    'RECORDE ATUAL ............ ' + HighScores.best(),
    ''
  ];
  let t = 100;
  lines.forEach(ln => {
    setTimeout(() => { el.textContent += ln + '\n'; AudioFX.move(); }, t);
    t += 190;
  });
  setTimeout(() => {
    const screenMenu = document.getElementById('screen-menu');
    screenMenu.classList.add('ready');
    document.getElementById('logo').textContent = buildLogo('ARKANOID');
    document.getElementById('highPreview').textContent = 'RECORDE: ' + HighScores.best();
    AudioFX.wall();
  }, t + 400);
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const proto = location.protocol;
  const isLocal = ['localhost', '127.0.0.1'].indexOf(location.hostname) !== -1;
  if (proto !== 'https:' && !(proto === 'http:' && isLocal)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service Worker:', err && err.message);
    });
  });
}

(function init() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  Screens.setGame(game);
  Menu.mount();
  wireNav();
  bootSequence();
  registerSW();
  window.addEventListener('resize', () => game.resize());
})();