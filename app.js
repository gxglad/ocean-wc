/* ============================================================
   深蓝档案 · OCEAN DOSSIER
   app.js —— 下潜引擎 / 声呐 / 生物发光 / 净海互动
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAX_DEPTH = 10909;

  var body = document.body;
  var nav = $('#nav');
  var hud = $('#hud');
  var hudDepth = $('#hud-depth');
  var hudZone = $('#hud-zone');
  var rail = $('#rail');
  var toast = $('#toast');

  /* ==========================================================
     0. 入场序列 —— 从 10909 米上浮，穿过五层海域冲出海面
     ========================================================== */
  function initIntro() {
    var intro = $('#intro');
    var cvI = $('#intro-canvas');
    var lightEl = $('#intro-light');
    var flashEl = $('#intro-flash');
    var depthEl = $('#intro-depth');
    var msgEl = $('#intro-msg');

    function finish() {
      if (!intro || intro.dataset.finished) return;
      intro.dataset.finished = '1';
      intro.classList.add('done');
      body.classList.remove('loading');
      body.classList.add('loaded');
      setTimeout(function () {
        if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
        buildMarkers();
        updateScrollState();
      }, 1000);
      setTimeout(function () { buildMarkers(); updateScrollState(); }, 1400);
    }

    function bail() {
      var i = $('#intro');
      if (i && i.parentNode) i.parentNode.removeChild(i);
      body.classList.remove('loading');
      body.classList.add('loaded');
    }

    if (!intro) { body.classList.remove('loading'); body.classList.add('loaded'); return; }
    if (REDUCED || !cvI || !cvI.getContext) { bail(); return; }

    intro.addEventListener('click', finish);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    });

    /* ---- 上浮时间线：0 → 1 ---- */
    var DUR = 5200;
    var ZONES = [
      [1.00, '挑战者深渊 · 起点'],
      [0.84, '超深渊带 · 端足类在脚下'],
      [0.62, '深渊带 · 只剩海雪与鲸落'],
      [0.40, '无光带 · 生物开始发光'],
      [0.20, '弱光带 · 幽蓝渗了下来'],
      [0.06, '透光带 · 光在头顶'],
      [0.00, '海面']
    ];
    var zoneDone = {};

    /* ---- 画布 ---- */
    var ctx = cvI.getContext('2d');
    var W = 0, H = 0, DPRi = 1;
    var bubbles = [], snow = [], sparks = [];

    function sizeIntro() {
      DPRi = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cvI.width = Math.floor(W * DPRi);
      cvI.height = Math.floor(H * DPRi);
      cvI.style.width = W + 'px';
      cvI.style.height = H + 'px';
      ctx.setTransform(DPRi, 0, 0, DPRi, 0, 0);
    }

    function seed() {
      bubbles = []; snow = []; sparks = [];
      var i;
      for (i = 0; i < 40; i++) {
        bubbles.push({
          x: Math.random() * W, y: Math.random() * H,
          r: 0.8 + Math.random() * 3.6, v: 0.5 + Math.random() * 1.9,
          a: 0.2 + Math.random() * 0.5, w: Math.random() * 6.28
        });
      }
      for (i = 0; i < 90; i++) {
        snow.push({
          x: Math.random() * W, y: Math.random() * H,
          r: 0.5 + Math.random() * 1.8, v: 0.16 + Math.random() * 0.5,
          a: 0.12 + Math.random() * 0.4
        });
      }
      // 深海生物发光点（越深越多，后期淡出）
      for (i = 0; i < 26; i++) {
        var hue = 170 + Math.random() * 60;
        sparks.push({
          x: Math.random() * W, y: Math.random() * H,
          r: 1 + Math.random() * 2.4,
          hue: hue,
          ph: Math.random() * 6.28,
          sp: 0.6 + Math.random() * 1.6,
          drift: (Math.random() - 0.5) * 0.22,
          born: 0.1 + Math.random() * 0.75,
          life: 0.5 + Math.random() * 0.5
        });
      }
    }

    /* ---- 光柱（透光带往后出现） ---- */
    function drawRays(t, alpha) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.translate(W * 0.5, -H * 0.16);
      for (var i = 0; i < 7; i++) {
        var ang = (-0.42 + i * 0.14) + Math.sin(t * 1.5 + i) * 0.018;
        var wid = 0.035 + (i % 3) * 0.022;
        ctx.save();
        ctx.rotate(ang);
        var g = ctx.createLinearGradient(0, 0, 0, H * 1.5);
        g.addColorStop(0, 'rgba(230, 253, 255,' + (0.5 * alpha).toFixed(3) + ')');
        g.addColorStop(0.45, 'rgba(180, 240, 255,' + (0.14 * alpha).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(150, 230, 255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-W * wid * 0.35, 0);
        ctx.lineTo(W * wid * 0.35, 0);
        ctx.lineTo(W * wid * 1.25, H * 1.5);
        ctx.lineTo(-W * wid * 1.25, H * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    /* ---- 主循环 ---- */
    var t0 = null, done = false;

    function frame(ts) {
      if (intro.dataset.finished) return;
      if (t0 === null) t0 = ts;
      var t = clamp((ts - t0) / DUR, 0, 1);      // 0 = 深渊, 1 = 海面
      var e = ease(t);                            // 上浮缓动（出发慢、接近海面快）

      /* 深度与层级文案 */
      var depth = Math.round(MAX_DEPTH * (1 - e));
      if (depthEl) depthEl.textContent = depth;
      for (var z = 0; z < ZONES.length; z++) {
        var cue = 1 - ZONES[z][0];
        if (t >= cue && !zoneDone[z]) {
          zoneDone[z] = 1;
          if (msgEl) msgEl.textContent = ZONES[z][1];
        }
      }

      /* 水色：深渊近黑蓝 → 海面青蓝（色相始终留在蓝绿区间） */
      var hueTop = [224, 220, 214, 206, 199, 194, 190];
      var hueBot = [232, 228, 222, 214, 205, 196, 190];
      var seg = Math.min(Math.floor(t * (hueTop.length - 1)), hueTop.length - 2);
      var st = t * (hueTop.length - 1) - seg;
      var hT = lerp(hueTop[seg], hueTop[seg + 1], st);
      var hB = lerp(hueBot[seg], hueBot[seg + 1], st);
      var lumT = lerp(4, 56, ease(t * 1.15));
      var lumB = lerp(1.5, 26, ease(t));

      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'hsl(' + hT.toFixed(1) + ',72%,' + lumT.toFixed(1) + '%)');
      grad.addColorStop(1, 'hsl(' + hB.toFixed(1) + ',80%,' + lumB.toFixed(1) + '%)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      /* 天光：接近海面时从上方压下来 */
      var skyA = clamp((t - 0.5) / 0.5, 0, 1);
      if (lightEl) lightEl.style.opacity = (skyA * skyA * 0.9).toFixed(3);
      drawRays(ts * 0.0006, clamp((t - 0.55) / 0.45, 0, 1) * 0.85);

      /* 海雪（深海为主） */
      var snowA = (1 - t * 0.75);
      for (var i = 0; i < snow.length; i++) {
        var s = snow[i];
        s.y += s.v * (1 + (1 - t) * 1.6);
        if (s.y > H + 6) { s.y = -6; s.x = Math.random() * W; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(214,238,255,' + (s.a * snowA).toFixed(3) + ')';
        ctx.fill();
      }

      /* 生物发光点：无光带最盛，靠近海面淡出 */
      var deepMask = clamp((0.95 - t) / 0.6, 0, 1) * clamp(t / 0.06, 0, 1);
      if (deepMask > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var k = 0; k < sparks.length; k++) {
          var sp = sparks[k];
          sp.ph += 0.02 * sp.sp;
          var pulse = (Math.sin(sp.ph) + 1) / 2;
          sp.x += sp.drift;
          if (sp.x < -10) sp.x = W + 10;
          if (sp.x > W + 10) sp.x = -10;
          var al = deepMask * (0.25 + pulse * 0.75);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.r * (0.7 + pulse * 0.5), 0, 6.2832);
          ctx.fillStyle = 'hsla(' + sp.hue.toFixed(0) + ',100%,72%,' + al.toFixed(3) + ')';
          ctx.shadowColor = 'hsla(' + sp.hue.toFixed(0) + ',100%,70%,.9)';
          ctx.shadowBlur = 14;
          ctx.fill();
        }
        ctx.restore();
      }

      /* 气泡：上浮越久越多越快 */
      var bA = 0.25 + t * 0.75;
      for (var b = 0; b < bubbles.length; b++) {
        var bb = bubbles[b];
        bb.y -= bb.v * (1 + t * 2.4);
        bb.w += 0.03;
        bb.x += Math.sin(bb.w) * 0.5;
        if (bb.y < -12) { bb.y = H + 12; bb.x = Math.random() * W; }
        ctx.beginPath();
        ctx.arc(bb.x, bb.y, bb.r, 0, 6.2832);
        ctx.strokeStyle = 'rgba(206,244,255,' + (bb.a * bA * 0.7).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* 水面：最后 20% 从底部涌上来 */
      var surf = clamp((t - 0.78) / 0.22, 0, 1);
      if (surf > 0) {
        var sy = H * (1.06 - surf * 1.12);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, sy);
        for (var x = 0; x <= W; x += 14) {
          ctx.lineTo(x, sy + Math.sin(x * 0.012 + ts * 0.004) * 9 + Math.sin(x * 0.031 - ts * 0.006) * 4);
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        var wg = ctx.createLinearGradient(0, sy, 0, H);
        wg.addColorStop(0, 'rgba(226, 252, 255,' + (0.5 * surf).toFixed(3) + ')');
        wg.addColorStop(0.22, 'rgba(120, 216, 246,' + (0.34 * surf).toFixed(3) + ')');
        wg.addColorStop(1, 'rgba(20, 110, 160, 0)');
        ctx.fillStyle = wg;
        ctx.fill();
        ctx.restore();
      }

      /* 破水白闪 */
      if (flashEl) {
        var fl = clamp((t - 0.9) / 0.1, 0, 1);
        flashEl.style.opacity = (Math.sin(fl * Math.PI) * 0.85).toFixed(3);
      }

      if (t < 1) requestAnimationFrame(frame);
      else if (!done) { done = true; setTimeout(finish, 340); }
    }

    sizeIntro();
    seed();
    requestAnimationFrame(frame);
    window.addEventListener('resize', function () { sizeIntro(); seed(); });

    // 兜底：任何异常都不该把页面卡在入场里
    setTimeout(finish, 9000);
  }

  /* ==========================================================
     1. 深度引擎 —— 滚动条就是潜水器
     ========================================================== */
  var markers = [];
  var curDepth = 0;
  var shownDepth = 0;
  var curZone = '海面';
  var lastZone = '';
  var milestones = {};

  function buildMarkers() {
    var pts = [];
    var surface = $('#surface');
    if (surface) pts.push({ top: 0, depth: 0, zone: '海面' });

    $$('section[data-depth], article[data-depth]').forEach(function (el) {
      var d = parseInt(el.getAttribute('data-depth'), 10);
      var z = el.getAttribute('data-zone') || '';
      var top = el.getBoundingClientRect().top + window.pageYOffset;
      pts.push({ top: top, depth: isNaN(d) ? 0 : d, zone: z || '深海' });
    });

    pts.sort(function (a, b) { return a.top - b.top; });

    var docH = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    if (pts.length) {
      var last = pts[pts.length - 1];
      if (docH - 40 > last.top) {
        pts.push({ top: docH - window.innerHeight * 0.5, depth: MAX_DEPTH, zone: last.zone });
      }
    }
    markers = pts;
  }

  function depthAt(y) {
    if (!markers.length) return 0;
    if (y <= markers[0].top) return markers[0].depth;

    for (var i = 0; i < markers.length - 1; i++) {
      var a = markers[i], b = markers[i + 1];
      if (y >= a.top && y <= b.top) {
        var span = b.top - a.top;
        var t = span > 1 ? (y - a.top) / span : 1;
        // 每层内部用一点缓动，让数字变化更「呼吸」
        return Math.round(lerp(a.depth, b.depth, ease(clamp(t, 0, 1))));
      }
    }
    return markers[markers.length - 1].depth;
  }

  function zoneAt(y) {
    var z = '海面';
    for (var i = 0; i < markers.length; i++) {
      if (y >= markers[i].top - 4) z = markers[i].zone;
    }
    return z;
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateScrollState();
      ticking = false;
    });
  }

  function updateScrollState() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    // 直接用滚动量作为深度探针：y = 0 必须正好是海面 0 米
    var probe = y;

    curDepth = depthAt(probe);
    curZone = zoneAt(probe);

    // 顶部导航
    if (nav) nav.classList.toggle('scrolled', y > 40);

    // 深度 HUD
    var p = clamp(curDepth / MAX_DEPTH, 0, 1);
    if (hud) {
      hud.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      if (hudDepth) hudDepth.textContent = curDepth.toLocaleString('en-US');
      if (hudZone) hudZone.textContent = curZone;
    }

    body.classList.toggle('dived', y > window.innerHeight * 0.45);

    // 深度里程碑提示
    checkMilestones(curDepth);
  }

  function checkMilestones(d) {
    var list = [
      [200, '透光层 · 阳光还能到达'],
      [1000, '弱光层 · 光不够用了'],
      [4000, '无光层 · 太阳彻底缺席'],
      [6000, '深渊层 · 水压 400 公斤/平方厘米'],
      [10909, '挑战者深渊底 · 10909 米']
    ];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (d >= m[0] && !milestones[m[0]]) {
        milestones[m[0]] = true;
        say(m[1]);
      }
    }
  }

  var toastTimer = null;
  function say(msg, ms) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, ms || 3200);
  }

  /* ==========================================================
     2. 出镜动画 / 进度条 / 计数器
     ========================================================== */
  function initReveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window) || REDUCED) {
      items.forEach(function (el) { el.classList.add('in'); });
      $$('.depth-row').forEach(function (el) { el.classList.add('seen'); });
      $$('.threat').forEach(fillMeter);
      $$('.stat').forEach(runCounter);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        if (en.target.classList.contains('stat')) runCounter(en.target);
        if (en.target.classList.contains('threat')) fillMeter(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });

    // 下潜层：进入即点亮徽章
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) en.target.classList.add('seen');
      });
    }, { threshold: 0.3 });
    $$('.depth-row').forEach(function (el) {
      io2.observe(el);
      var card = $('.depth-card', el);
      if (card) io.observe(card);
    });
  }

  function runCounter(stat) {
    var el = $('.num', stat);
    if (!el || el.dataset.done) return;
    el.dataset.done = '1';

    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1500, start = null;

    if (REDUCED) { el.textContent = target + suffix; return; }

    function frame(ts) {
      if (start === null) start = ts;
      var t = clamp((ts - start) / dur, 0, 1);
      var v = Math.round(target * ease(t));
      el.textContent = v.toLocaleString('en-US') + suffix;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = target.toLocaleString('en-US') + suffix;
    }
    requestAnimationFrame(frame);
  }

  function fillMeter(threat) {
    if (threat.dataset.filled) return;
    threat.dataset.filled = '1';
    var lv = parseInt(threat.getAttribute('data-level'), 10) || 0;
    var bar = $('.meter .bar i', threat);
    if (bar) setTimeout(function () { bar.style.width = clamp(lv, 0, 100) + '%'; }, 180);
  }

  /* ==========================================================
     3. 导航 / 深度轨道 高亮
     ========================================================== */
  function initNavHighlight() {
    var links = $$('.nav-links a');
    var railLinks = $$('#rail a');
    var targets = [];

    links.concat(railLinks).forEach(function (a) {
      var id = (a.getAttribute('href') || '').replace('#', '');
      var el = id ? document.getElementById(id) : null;
      if (el && targets.indexOf(el) < 0) targets.push(el);
    });
    var compare = $('#s-sunlight');
    if (compare && targets.indexOf(compare) < 0) targets.push(compare);

    if (!('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        links.forEach(function (a) {
          a.classList.toggle('active', (a.getAttribute('href') || '') === '#' + id);
        });
        railLinks.forEach(function (a) {
          a.classList.toggle('active', (a.getAttribute('data-for') || '') === id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    targets.forEach(function (t) { io.observe(t); });
  }

  /* ==========================================================
     4. 水体微粒（CSS 层）
     ========================================================== */
  function initMotes() {
    var host = $('.w-layer.motes');
    if (!host || REDUCED) return;
    var n = window.innerWidth < 700 ? 18 : 34;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var d = document.createElement('div');
      d.className = 'mote';
      d.style.left = (Math.random() * 100).toFixed(2) + '%';
      d.style.top = (60 + Math.random() * 45).toFixed(2) + '%';
      d.style.animationDuration = (13 + Math.random() * 20).toFixed(1) + 's';
      d.style.animationDelay = (-Math.random() * 26).toFixed(1) + 's';
      var s = (0.5 + Math.random() * 1.1).toFixed(2);
      d.style.transform = 'scale(' + s + ')';
      d.style.opacity = (0.25 + Math.random() * 0.55).toFixed(2);
      frag.appendChild(d);
    }
    host.appendChild(frag);
  }

  /* ==========================================================
     5. 主画布 —— 气泡 / 海雪 / 塑料瓶
     ========================================================== */
  var cv = $('#fx');
  var cx = cv ? cv.getContext('2d') : null;
  var W = 0, H = 0, DPR = 1;
  var bubbles = [], snow = [], bottles = [];
  var cleaned = 0, sweep = -1, ripples = [];
  var lastBottleSpawn = 0;

  function sizeCanvas() {
    if (!cv) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.floor(W * DPR);
    cv.height = Math.floor(H * DPR);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    if (cx) cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function mkBubble(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 12,
      r: 0.8 + Math.random() * 3.4,
      v: 0.28 + Math.random() * 0.85,
      w: Math.random() * Math.PI * 2,
      a: 0.14 + Math.random() * 0.4
    };
  }

  function mkSnow() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.5 + Math.random() * 1.7,
      vy: 0.12 + Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.22,
      a: 0.1 + Math.random() * 0.32
    };
  }

  function mkBottle() {
    return {
      x: Math.random() < 0.5 ? -40 : W + 40,
      y: 90 + Math.random() * (H - 240),
      vx: (Math.random() < 0.5 ? 1 : -1) * (0.28 + Math.random() * 0.5),
      vy: (Math.random() - 0.5) * 0.16,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.012,
      s: 0.8 + Math.random() * 0.55,
      born: performance.now(),
      dying: 0
    };
  }

  function initParticles() {
    if (!cx || REDUCED) return;
    var nb = window.innerWidth < 700 ? 26 : 54;
    var ns = window.innerWidth < 700 ? 40 : 90;
    bubbles = []; snow = []; bottles = [];
    for (var i = 0; i < nb; i++) bubbles.push(mkBubble(true));
    for (var j = 0; j < ns; j++) snow.push(mkSnow());
    for (var k = 0; k < 3; k++) { var b = mkBottle(); b.x = Math.random() * W; bottles.push(b); }
  }

  function drawBottle(ctx, x, y, s, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = 'rgba(255,138,150,0.95)';
    ctx.beginPath();
    ctx.moveTo(-6.5, -13);
    ctx.lineTo(6.5, -13);
    ctx.lineTo(6.5, -3);
    ctx.quadraticCurveTo(11.5, 1, 11.5, 10);
    ctx.lineTo(11.5, 18);
    ctx.quadraticCurveTo(11.5, 22.5, 7.5, 22.5);
    ctx.lineTo(-7.5, 22.5);
    ctx.quadraticCurveTo(-11.5, 22.5, -11.5, 18);
    ctx.lineTo(-11.5, 10);
    ctx.quadraticCurveTo(-11.5, 1, -6.5, -3);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-4.6, -19, 9.2, 5.4);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.6;
    ctx.beginPath();
    ctx.moveTo(-11.5, 6);
    ctx.lineTo(11.5, 6);
    ctx.stroke();
    ctx.restore();
  }

  var t0 = 0;
  function loop(ts) {
    if (!cx) return;
    if (!t0) t0 = ts;
    var dt = Math.min((ts - t0) / 16.667, 3);
    t0 = ts;

    cx.clearRect(0, 0, W, H);

    var deep = clamp(curDepth / MAX_DEPTH, 0, 1);
    var deepFactor = clamp((curDepth - 900) / 3500, 0, 1);

    /* --- 气泡：越深越少 --- */
    var bubbleAlpha = 0.55 * (1 - deepFactor * 0.78);
    if (bubbleAlpha > 0.02) {
      for (var i = 0; i < bubbles.length; i++) {
        var b = bubbles[i];
        b.y -= b.v * dt * (1 + deep * 0.7);
        b.w += 0.02 * dt;
        b.x += Math.sin(b.w) * 0.32 * dt;
        if (b.y < -14) { bubbles[i] = mkBubble(false); continue; }
        cx.beginPath();
        cx.arc(b.x, b.y, b.r, 0, 6.2832);
        cx.strokeStyle = 'rgba(190,240,255,' + (b.a * bubbleAlpha * 1.8).toFixed(3) + ')';
        cx.lineWidth = 1;
        cx.stroke();
        cx.beginPath();
        cx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.3, 0, 6.2832);
        cx.fillStyle = 'rgba(235,252,255,' + (b.a * bubbleAlpha * 1.5).toFixed(3) + ')';
        cx.fill();
      }
    }

    /* --- 海雪：越深越多 --- */
    var snowAlpha = 0.14 + deepFactor * 0.72;
    for (var j = 0; j < snow.length; j++) {
      var s = snow[j];
      s.y += s.vy * dt * (1 + deepFactor * 1.4);
      s.x += s.vx * dt + Math.sin(s.y * 0.01) * 0.14 * dt;
      if (s.y > H + 8) { snow[j] = mkSnow(); snow[j].y = -6; continue; }
      if (s.x < -8) s.x = W + 8;
      if (s.x > W + 8) s.x = -8;
      cx.beginPath();
      cx.arc(s.x, s.y, s.r, 0, 6.2832);
      cx.fillStyle = 'rgba(215,240,255,' + (s.a * snowAlpha).toFixed(3) + ')';
      cx.fill();
    }

    /* --- 塑料瓶 --- */
    if (!REDUCED) {
      if (ts - lastBottleSpawn > 2800 && bottles.length < 7) {
        lastBottleSpawn = ts;
        bottles.push(mkBottle());
      }
    }

    if (sweep >= 0) {
      sweep += 0.022 * dt;
      if (sweep > 1.25) sweep = -1;
    }

    for (var k = bottles.length - 1; k >= 0; k--) {
      var bo = bottles[k];
      bo.x += bo.vx * dt;
      bo.y += bo.vy * dt + Math.sin((ts + bo.born) * 0.0009) * 0.24 * dt;
      bo.rot += bo.vr * dt;

      // 撞到画面外 → 从另一侧回来（海洋是连通的）
      if (bo.x < -70) bo.x = W + 60;
      if (bo.x > W + 70) bo.x = -60;
      if (bo.y < 60) bo.vy = Math.abs(bo.vy);
      if (bo.y > H - 60) bo.vy = -Math.abs(bo.vy);

      // 撒网扫过
      if (sweep >= 0 && bo.dying === 0) {
        var netX = sweep * (W + 120) - 60;
        var passed = bo.vx > 0 ? bo.x <= netX : bo.x >= netX;
        if (passed) { bo.dying = 1; ripples.push({ x: bo.x, y: bo.y, r: 4, a: 0.8 }); }
      }

      if (bo.dying) {
        bo.dying += 0.05 * dt;
        if (bo.dying > 1) {
          bottles.splice(k, 1);
          cleaned++;
          updateCleanCount();
          continue;
        }
      }

      var alpha = bo.dying ? Math.max(0, 1 - bo.dying) : 1;
      var sc = bo.s * (bo.dying ? 1 + bo.dying * 0.6 : 1);
      drawBottle(cx, bo.x, bo.y, sc, bo.rot, alpha);
    }

    /* --- 撒网动画 --- */
    if (sweep >= 0 && sweep <= 1.05) {
      var nx = sweep * (W + 120) - 60;
      cx.save();
      cx.strokeStyle = 'rgba(99,230,255,0.5)';
      cx.lineWidth = 1.4;
      cx.beginPath();
      cx.moveTo(nx - 26, -10);
      cx.quadraticCurveTo(nx + 22, H * 0.5, nx - 26, H + 10);
      cx.stroke();
      for (var q = 0; q < 16; q++) {
        var yy = (q / 15) * H;
        cx.beginPath();
        cx.arc(nx - 4, yy, 2.6, 0, 6.2832);
        cx.strokeStyle = 'rgba(99,230,255,0.22)';
        cx.stroke();
      }
      cx.restore();
    }

    /* --- 涟漪 --- */
    for (var r = ripples.length - 1; r >= 0; r--) {
      var rp = ripples[r];
      rp.r += 1.8 * dt;
      rp.a -= 0.022 * dt;
      if (rp.a <= 0) { ripples.splice(r, 1); continue; }
      cx.beginPath();
      cx.arc(rp.x, rp.y, rp.r, 0, 6.2832);
      cx.strokeStyle = 'rgba(120,235,255,' + rp.a.toFixed(3) + ')';
      cx.lineWidth = 1.2;
      cx.stroke();
    }

    requestAnimationFrame(loop);
  }

  function updateCleanCount() {
    var el = $('#clean-count');
    if (el) el.textContent = cleaned;

    var note = $('#clean-note');
    if (!note) return;
    if (cleaned === 0) note.textContent = '海面看起来还挺干净';
    else if (cleaned < 5) note.textContent = '捞到 ' + cleaned + ' 个，水里还有';
    else if (cleaned < 12) note.textContent = '你开始明白「永远捞不完」的意思了';
    else if (cleaned < 25) note.textContent = '现实里每分钟都有一整车倒进来';
    else note.textContent = '谢谢你。真的——但这不是你一个人的活';

    if (cleaned === 8) body.setAttribute('data-mood', 'thriving');
    if (cleaned === 30) { body.setAttribute('data-mood', 'thriving'); say('这一片海，因为你亮了一点'); }
  }

  function initCanvasInteraction() {
    if (!cv) return;

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('a,button,input,select,textarea,.chip,label')) return;
      if (REDUCED) return;

      var mx = e.clientX, my = e.clientY;
      var hit = -1, best = 42 * 42;
      for (var i = 0; i < bottles.length; i++) {
        var b = bottles[i];
        if (b.dying) continue;
        var dx = b.x - mx, dy = b.y - my;
        var d2 = dx * dx + dy * dy;
        if (d2 < best) { best = d2; hit = i; }
      }
      if (hit < 0) return;

      var bo = bottles[hit];
      bo.dying = 1;
      ripples.push({ x: bo.x, y: bo.y, r: 4, a: 0.85 });
      for (var s = 0; s < 6; s++) {
        bubbles.push({ x: bo.x, y: bo.y, r: 0.9 + Math.random() * 2.4, v: 0.7 + Math.random(), w: Math.random() * 6, a: 0.5 });
      }
    });

    var btnClean = $('#btn-clean');
    if (btnClean) {
      btnClean.addEventListener('click', function () {
        if (REDUCED) return;
        if (sweep >= 0) return;
        sweep = 0;
        say('撒网中 —— 别指望一次就干净');
      });
    }

    var btnSpot = $('#btn-spot');
    if (btnSpot) {
      btnSpot.addEventListener('click', function () {
        body.classList.add('sonar');
        var fx = $('#btn-sonar');
        if (fx) fx.classList.add('on');
        say('声呐已开启：看，水里不只是塑料');
        setTimeout(function () {
          if (!sonarLocked) {
            body.classList.remove('sonar');
            if (fx) fx.classList.remove('on');
          }
        }, 7000);
      });
    }
  }

  /* ==========================================================
     6. 声呐
     ========================================================== */
  var sonarLocked = false;
  function initSonar() {
    var btn = $('#btn-sonar');
    var cursor = $('#sonar-cursor');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var on = body.classList.toggle('sonar');
      sonarLocked = on;
      btn.classList.toggle('on', on);
      say(on ? '声呐开启 · 生命信号已高亮' : '声呐关闭');
    });

    if (REDUCED) return;
    window.addEventListener('mousemove', function (e) {
      if (!cursor) return;
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    }, { passive: true });
  }

  /* ==========================================================
     7. 生物发光（水母群）
     ========================================================== */
  var jc = $('#bloom-canvas');
  var jx = jc ? jc.getContext('2d') : null;
  var jellies = [];
  var bloomTarget = 0, bloomAmt = 0;

  function sizeJelly() {
    if (!jc) return;
    jc.width = Math.floor(window.innerWidth * DPR);
    jc.height = Math.floor(window.innerHeight * DPR);
    jc.style.width = window.innerWidth + 'px';
    jc.style.height = window.innerHeight + 'px';
    if (jx) jx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function mkJelly() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 14 + Math.random() * 26,
      ph: Math.random() * 6.2832,
      sp: 0.004 + Math.random() * 0.01,
      vy: 0.08 + Math.random() * 0.28,
      vx: (Math.random() - 0.5) * 0.24,
      hue: 178 + Math.random() * 40
    };
  }

  function initJellies() {
    if (!jx) return;
    var n = window.innerWidth < 700 ? 7 : 14;
    jellies = [];
    for (var i = 0; i < n; i++) jellies.push(mkJelly());
  }

  function jellyLoop(ts) {
    if (!jx) return;
    var W2 = window.innerWidth, H2 = window.innerHeight;

    bloomAmt += (bloomTarget - bloomAmt) * 0.045;
    jx.clearRect(0, 0, W2, H2);

    if (bloomAmt > 0.01) {
      jx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < jellies.length; i++) {
        var j = jellies[i];
        j.ph += j.sp;
        j.y -= j.vy;
        j.x += j.vx + Math.sin(j.ph * 0.6) * 0.2;
        if (j.y < -80) { j.y = H2 + 60; j.x = Math.random() * W2; }
        if (j.x < -60) j.x = W2 + 50;
        if (j.x > W2 + 60) j.x = -50;

        var pulse = (Math.sin(j.ph) + 1) / 2;      // 0..1
        var glow = 0.22 + pulse * 0.6;
        var shade = pulse * 0.34;                  // 钟体收缩

        jx.globalAlpha = bloomAmt * glow;
        jx.strokeStyle = 'hsla(' + j.hue + ',100%,74%,1)';
        jx.lineWidth = 1.5;
        jx.shadowColor = 'hsla(' + j.hue + ',100%,70%,0.9)';
        jx.shadowBlur = 18;

        // 钟体
        jx.beginPath();
        jx.ellipse(j.x, j.y, j.r * (1 - shade * 0.4), j.r * (0.78 - shade * 0.34), 0, Math.PI, 0);
        jx.stroke();

        // 触手
        jx.globalAlpha = bloomAmt * glow * 0.72;
        jx.beginPath();
        for (var t = -2; t <= 2; t++) {
          var tx = j.x + t * j.r * 0.38;
          jx.moveTo(tx, j.y);
          jx.bezierCurveTo(
            tx + Math.sin(j.ph * 1.4 + t) * j.r * 0.5, j.y + j.r * 1.2,
            tx - Math.sin(j.ph * 1.1 + t) * j.r * 0.5, j.y + j.r * 2.1,
            tx + Math.sin(j.ph * 1.7 + t) * j.r * 0.4, j.y + j.r * 3.1
          );
        }
        jx.stroke();
        jx.shadowBlur = 0;
      }
      jx.globalAlpha = 1;
      jx.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame(jellyLoop);
  }

  function initBloom() {
    var btn = $('#btn-bloom');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var on = bloomTarget < 0.5;
      bloomTarget = on ? 1 : 0;
      body.classList.toggle('bloom', on);
      btn.classList.toggle('on', on);
      if (on) {
        body.setAttribute('data-mood', 'thriving');
        say('生物发光 · 深海 76% 的生命都会自己点灯');
      } else {
        body.removeAttribute('data-mood');
        say('灯光熄灭');
      }
    });
  }

  /* ==========================================================
     8. 两种未来（悬停染色）
     ========================================================== */
  function initContrast() {
    var good = $('.cmp-col.good');
    var bad = $('.cmp-col.bad');
    if (!good || !bad) return;

    good.addEventListener('mouseenter', function () {
      if (bloomTarget > 0.5) return;
      body.setAttribute('data-mood', 'thriving');
    });
    bad.addEventListener('mouseenter', function () {
      if (bloomTarget > 0.5) return;
      body.setAttribute('data-mood', 'dead');
    });
    [good, bad].forEach(function (el) {
      el.addEventListener('mouseleave', function () {
        if (bloomTarget > 0.5) return;
        body.removeAttribute('data-mood');
      });
    });
  }

  /* ==========================================================
     9. 分享 —— 多级降级，任何环境都要有反馈
     ========================================================== */
  function initShare() {
    var btn = $('#btn-share');
    if (!btn) return;

    var TITLE = '深蓝档案 · 一口气潜到马里亚纳';
    var TEXT = '深蓝档案 —— 一口气潜到马里亚纳。往下滚，就是下潜。';

    /** 旧式复制：兼容非安全上下文（file:// 等无 clipboard API 的场景） */
    function legacyCopy(str) {
      try {
        var ta = document.createElement('textarea');
        ta.value = str;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        return !!ok;
      } catch (e) {
        return false;
      }
    }

    /** 弹出一个可手动复制的面板（最终兜底） */
    function manualPanel(str) {
      var old = document.getElementById('share-panel');
      if (old && old.parentNode) old.parentNode.removeChild(old);

      var box = document.createElement('div');
      box.id = 'share-panel';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', '手动复制分享链接');
      box.innerHTML =
        '<div class="sp-card">' +
        '<div class="sp-title">复制这个链接分享出去</div>' +
        '<input class="sp-input" readonly>' +
        '<div class="sp-row">' +
        '<button class="sp-btn sp-ok" type="button">复制</button>' +
        '<button class="sp-btn sp-close" type="button">关闭</button>' +
        '</div>' +
        '</div>';
      document.body.appendChild(box);
      var input = box.querySelector('.sp-input');
      input.value = str;
      setTimeout(function () {
        input.focus();
        input.select();
      }, 60);

      box.querySelector('.sp-ok').addEventListener('click', function () {
        input.focus();
        input.select();
        if (legacyCopy(str)) { say('已复制 · 请把它交给下一个人'); return; }
        toClipboard(str).then(function (ok) {
          say(ok ? '已复制 · 请把它交给下一个人' : '已全选 · 按 Ctrl+C 复制');
        });
      });
      box.querySelector('.sp-close').addEventListener('click', function () {
        if (box.parentNode) box.parentNode.removeChild(box);
      });
      box.addEventListener('click', function (e) {
        if (e.target === box && box.parentNode) box.parentNode.removeChild(box);
      });
    }

    function toClipboard(str) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(str).then(function () { return true; }, function () { return false; });
      }
      return Promise.resolve(false);
    }

    btn.addEventListener('click', function () {
      var url = location.href;
      var payload = TEXT + ' ' + url;

      function fallback() {
        toClipboard(payload).then(function (ok) {
          if (ok) { say('链接已复制 · 请把它交给下一个人'); return; }
          if (legacyCopy(payload)) { say('链接已复制 · 请把它交给下一个人'); return; }
          manualPanel(payload);
        });
      }

      // 1) 系统分享（需要安全上下文 + 用户手势）
      if (navigator.share) {
        var data = { title: TITLE, text: TEXT, url: url };
        var p;
        try {
          if (navigator.canShare && !navigator.canShare(data)) { fallback(); return; }
          p = navigator.share(data);
        } catch (e) { fallback(); return; }

        if (p && p.then) {
          p.then(function () {
            say('谢谢分享 · 海洋需要更多人看见');
          }, function (err) {
            // 用户主动取消：不打扰
            if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
              if (err.name === 'NotAllowedError') fallback();
              return;
            }
            fallback();
          });
        } else {
          // 老式实现没有返回 Promise，无法判断结果，补一个复制兜底
          toClipboard(payload);
        }
        return;
      }

      fallback();
    });
  }

  /* ==========================================================
     10. 启动
     ========================================================== */
  function boot() {
    initIntro();
    buildMarkers();
    sizeCanvas();
    sizeJelly();
    initParticles();
    initJellies();
    initMotes();
    initReveal();
    initNavHighlight();
    initCanvasInteraction();
    initSonar();
    initBloom();
    initContrast();
    initShare();
    updateScrollState();
    updateCleanCount();

    if (!REDUCED && cx) requestAnimationFrame(loop);
    if (!REDUCED && jx) requestAnimationFrame(jellyLoop);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      sizeCanvas();
      sizeJelly();
      buildMarkers();
      updateScrollState();
    }, { passive: true });

    setTimeout(function () { buildMarkers(); updateScrollState(); }, 900);
    setTimeout(function () { buildMarkers(); }, 2400);
  }

  function safeBoot() {
    try {
      boot();
    } catch (err) {
      // 任何意外都不能让页面卡在入场遮罩里
      var intro = $('#intro');
      if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
      body.classList.remove('loading');
      body.classList.add('loaded');
      try { buildMarkers(); updateScrollState(); } catch (e2) {}
      if (window.console) console.error('[深蓝档案] 初始化异常:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeBoot);
  } else {
    safeBoot();
  }
})();
