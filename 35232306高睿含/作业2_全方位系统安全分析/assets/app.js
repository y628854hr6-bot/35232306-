/* Fundamentals of Flying Vehicle Technology (2026) — Assignment 2 (Joby S4)
 * Tilt-Rotor Transition Corridor Calculator, Uncontained Burst FTA Simulator & FAA Stage 5 Audit
 */

(function () {
  'use strict';

  function isEn() {
    return document.body.classList.contains('E');
  }

  function t(cn, en) {
    return isEn() ? en : cn;
  }

  function prepareCanvas(canvas, cssHeight) {
    if (!canvas) return null;
    var dpr = window.devicePixelRatio || 1;
    var width = canvas.parentElement ? canvas.parentElement.clientWidth : 540;
    if (width < 260) width = 260;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.height = cssHeight + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: width, h: cssHeight };
  }

  window.toggleLang = function () {
    var en = document.body.classList.toggle('E');
    var btn = document.getElementById('langBtn');
    if (btn) btn.textContent = en ? '中文' : 'EN';
    document.documentElement.lang = en ? 'en' : 'zh-CN';
    try {
      localStorage.setItem('fv_joby_safety_lang', en ? 'E' : 'C');
    } catch (e) {}
    updateTiltCalc();
    updateFtaSim();
    updateSafetyAudit();
  };

  window.toggleNav = function () {
    var links = document.querySelector('.lab-nav-links');
    if (links) links.classList.toggle('open');
  };

  document.addEventListener('click', function (ev) {
    var link = ev.target.closest('.lab-nav-links a');
    if (link && !link.closest('.lab-lang-switch')) {
      var menu = document.querySelector('.lab-nav-links');
      if (menu) menu.classList.remove('open');
    }
  });

  function setupScrollSpy() {
    var bar = document.getElementById('readingProgress');
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.fv-toc a'));
    var sections = tocLinks
      .map(function (a) {
        var id = a.getAttribute('href');
        return id && id.charAt(0) === '#' ? document.getElementById(id.slice(1)) : null;
      })
      .filter(Boolean);

    function onScroll() {
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop;
      var height = doc.scrollHeight - doc.clientHeight;
      if (bar && height > 0) {
        bar.style.width = Math.min(100, Math.max(0, (scrollTop / height) * 100)).toFixed(1) + '%';
      }
      var currentId = '';
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= 120) currentId = sections[i].id;
      }
      tocLinks.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href').slice(1) === currentId);
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  window.filterStpa = function (domain, btnEl) {
    document.querySelectorAll('#stpaFilterBar .fv-filter-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    document.querySelectorAll('#stpaMatrixTable tbody tr').forEach(function (row) {
      var d = row.getAttribute('data-domain') || '';
      row.classList.toggle('is-hidden', domain !== 'all' && d !== domain);
    });
  };

  /* Widget #1: Powered-Lift Tilt Transition Corridor Evaluator */
  function updateTiltCalc() {
    var angleEl = document.getElementById('tiltAngle');
    if (!angleEl) return;
    var tiltDeg = Number(angleEl.value); // 0 deg = Cruise horizontal, 90 deg = Hover vertical
    var iasKt = Number(document.getElementById('tiltIas').value);
    var asymDeg = Number(document.getElementById('tiltAsym').value);
    var altFt = Number(document.getElementById('tiltAlt').value);

    document.getElementById('valTiltAngle').textContent = tiltDeg + '°';
    document.getElementById('valTiltIas').textContent = iasKt + ' KIAS';
    document.getElementById('valTiltAsym').textContent = asymDeg + '°';
    document.getElementById('valTiltAlt').textContent = altFt + ' ft';

    /* Simplified corridor envelope: at 0 deg (wing-borne) stall ~65 KIAS, max Vne ~175 KIAS;
       at 90 deg (hover) speed ~0-40 KIAS; linear blend in transition */
    var minSafeKt = Math.max(0, 65 * (1 - tiltDeg / 90) - 5);
    var maxSafeKt = 45 + 130 * (1 - tiltDeg / 90);
    var airDensityRatio = Math.max(0.7, 1 - (altFt / 10000) * 0.26);
    var oeiMarginPct = Math.round((airDensityRatio * 100) - (asymDeg * 2.2) - (tiltDeg > 20 && tiltDeg < 70 ? 8 : 0));

    document.getElementById('outTiltCorridor').textContent =
      Math.round(minSafeKt) + ' – ' + Math.round(maxSafeKt) + ' KIAS';
    document.getElementById('outTiltOei').textContent = oeiMarginPct + '%';

    var box = document.getElementById('outTiltBox');
    var vEl = document.getElementById('outTiltVerdict');
    box.classList.remove('warn-ok', 'warn-tight', 'warn-over');

    if (iasKt < minSafeKt || iasKt > maxSafeKt || asymDeg > 8 || oeiMarginPct < 60) {
      box.classList.add('warn-over');
      vEl.textContent = t(
        '包线越界告警：机翼失速/超速（参照 N542AJ 181 KIAS 超限）或倾转不对称超限',
        'ENVELOPE VIOLATION: Wing stall, overspeed (cf. N542AJ 181 KIAS), or asymmetric jam risk'
      );
    } else if (asymDeg > 4 || oeiMarginPct < 75) {
      box.classList.add('warn-tight');
      vEl.textContent = t(
        '过渡裕度收窄：需依赖飞控差动推力与副翼耦合配平，建议降低倾转速率',
        'TIGHT MARGIN: Relies on coupled differential thrust + aileron trim; slow tilt rate'
      );
    } else {
      box.classList.add('warn-ok');
      vEl.textContent = t(
        '位于正常倾转安全走廊：机翼升力与旋翼矢量平稳交接，满足单发 OEI 裕度',
        'SAFE CORRIDOR: Smooth wing-to-rotor lift handoff with positive OEI margin'
      );
    }
  }

  /* Widget #2: 6-Tiltrotor Cascade Burst & Actuator Jam FTA Simulator */
  var FTA_DEFAULTS = { epu: 3, burst: 2.0, shield: 90, act: 1.5, beta: 1.0 };

  function fmtSci(val) {
    if (val <= 0) return '0';
    var exp = Math.floor(Math.log10(val));
    var mant = val / Math.pow(10, exp);
    return mant.toFixed(2) + '×10^' + exp;
  }

  function updateFtaSim() {
    var epuEl = document.getElementById('ftaLambdaEpu');
    if (!epuEl) return;

    var epuScaled = Number(epuEl.value); // x 1e-5 /fh
    var burstScaled = Number(document.getElementById('ftaBurst').value); // x 1e-7 /fh blade separation
    var shieldPct = Number(document.getElementById('ftaShield').value); // % containment / non-strike geometry
    var actScaled = Number(document.getElementById('ftaAct').value); // x 1e-6 /fh asymmetric tilt jam
    var betaPct = Number(document.getElementById('ftaBeta').value);

    document.getElementById('valFtaEpu').textContent = epuScaled + '×10⁻⁵ /fh';
    document.getElementById('valFtaBurst').textContent = burstScaled.toFixed(1) + '×10⁻⁷ /fh';
    document.getElementById('valFtaShield').textContent = shieldPct + '%';
    document.getElementById('valFtaAct').textContent = actScaled.toFixed(1) + '×10⁻⁶ /fh';
    document.getElementById('valFtaBeta').textContent = betaPct.toFixed(1) + '%';

    var lambdaEpu = epuScaled * 1e-5;
    var lambdaBurst = burstScaled * 1e-7;
    var pUncontained = 1 - shieldPct / 100;
    var lambdaAct = actScaled * 1e-6;
    var beta = betaPct / 100;

    /* CS1: Dual independent EPU failures out of 6 (15 pairs * lambda^2) */
    var lambdaInd = lambdaEpu * (1 - beta);
    var cs1 = 15 * lambdaInd * lambdaInd;
    /* CS2: Uncontained rotor blade separation striking adjacent nacelle / wing spar (NTSB DCA22FA082) */
    var cs2 = 6 * lambdaBurst * pUncontained;
    /* CS3: Asymmetric tilt-actuator jam not trimmed by differential thrust (approx 1% unrecoverable rate) */
    var cs3 = 6 * lambdaAct * 0.01;
    /* CS4: DEP / 4-Pack CCF */
    var cs4 = lambdaEpu * beta * 0.01;

    var pTotal = cs1 + cs2 + cs3 + cs4;

    document.getElementById('outFtaBurstNet').textContent = fmtSci(cs2) + ' /fh';
    document.getElementById('outFtaTotal').textContent = fmtSci(pTotal) + ' /fh';

    var maxCs = Math.max(cs1, cs2, cs3, cs4);
    var dom = '';
    if (maxCs === cs2) dom = t('CS2：断桨非包容性级联打击 (N542AJ 教训)', 'CS2: Uncontained Blade-Strike Cascade');
    else if (maxCs === cs3) dom = t('CS3：倾转作动器不对称卡阻', 'CS3: Asymmetric Tilt-Actuator Jam');
    else if (maxCs === cs4) dom = t('CS4：共享软硬件共因失效 (β·λ)', 'CS4: Shared Software/Bus CCF');
    else dom = t('CS1：独立双发随机失效', 'CS1: Dual Independent EPU Failure');
    document.getElementById('outFtaDom').textContent = dom;

    var box = document.getElementById('outFtaVerdictBox');
    var vEl = document.getElementById('outFtaVerdict');
    box.classList.remove('warn-ok', 'warn-tight', 'warn-over');
    if (pTotal <= 1e-8) {
      box.classList.add('warn-ok');
      vEl.textContent = t('接近 FAA/EASA 商业载客 10⁻⁹/fh 增强标准', 'Approaches 10⁻⁹/fh FAA/EASA Commercial Air-Taxi Target');
    } else if (pTotal <= 1e-7) {
      box.classList.add('warn-tight');
      vEl.textContent = t('10⁻⁷–10⁻⁸/fh 区间：需进一步提高桨叶包容性隔离与作动器双余度', '10⁻⁷–10⁻⁸/fh Band: Tighten blade-strike shielding & actuator redundancy');
    } else {
      box.classList.add('warn-over');
      vEl.textContent = t('超出商业载客容限：非包容断桨级联或作动卡阻主导风险', 'Exceeds Commercial Target: Uncontained blade cascade or jam dominates');
    }

    drawFtaChart(cs1, cs2, cs3, cs4, pTotal);
  }

  function drawFtaChart(cs1, cs2, cs3, cs4, pTotal) {
    var canvas = document.getElementById('ftaBarCanvas');
    var p = prepareCanvas(canvas, 240);
    if (!p) return;
    var ctx = p.ctx, w = p.w, h = p.h;
    ctx.clearRect(0, 0, w, h);

    var pad = { l: 155, r: 28, t: 36, b: 36 };
    var pw = w - pad.l - pad.r;
    var ph = h - pad.t - pad.b;
    var minExp = -10, maxExp = -4;

    function toX(val) {
      var exp = Math.log10(Math.max(1e-10, Math.min(1e-4, val)));
      return pad.l + ((exp - minExp) / (maxExp - minExp)) * pw;
    }

    for (var ex = minExp; ex <= maxExp; ex++) {
      var gx = pad.l + ((ex - minExp) / (maxExp - minExp)) * pw;
      ctx.strokeStyle = '#e5e9ed';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, pad.t);
      ctx.lineTo(gx, h - pad.b);
      ctx.stroke();

      ctx.fillStyle = '#5c6270';
      ctx.font = '10.5px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('10^' + ex, gx, h - pad.b + 16);
    }

    [
      { x: toX(1e-7), color: '#9a5b13' },
      { x: toX(1e-9), color: '#165b3d' }
    ].forEach(function (ref) {
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = ref.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ref.x, pad.t);
      ctx.lineTo(ref.x, h - pad.b);
      ctx.stroke();
      ctx.restore();
    });

    ctx.font = '10.5px sans-serif';
    ctx.textAlign = 'right';
    var enhLbl = '│ ' + t('商业载客目标 (10⁻⁹)', 'Commercial Target (10⁻⁹)');
    var basicLbl = '│ ' + t('基础限值 (10⁻⁷)', 'Basic Limit (10⁻⁷)');
    var enhW = ctx.measureText(enhLbl).width;
    ctx.fillStyle = '#165b3d';
    ctx.fillText(enhLbl, w - pad.r, 18);
    ctx.fillStyle = '#9a5b13';
    ctx.fillText(basicLbl, w - pad.r - enhW - 18, 18);

    var items = [
      { lbl: t('CS1 双发随机独立失效', 'CS1 Dual EPU Random'), val: cs1, color: '#3a5694' },
      { lbl: t('CS2 断桨非包容级联', 'CS2 Blade Burst Cascade'), val: cs2, color: '#8e2424' },
      { lbl: t('CS3 倾转作动器卡阻', 'CS3 Tilt Actuator Jam'), val: cs3, color: '#9a5b13' },
      { lbl: t('CS4 共因失效 (β·λ)', 'CS4 Common-Cause (β·λ)'), val: cs4, color: '#6b7280' },
      { lbl: t('顶事件总失控率 P_cat', 'Total Top Event P_cat'), val: pTotal, color: '#182542' }
    ];

    var rowH = ph / items.length;
    items.forEach(function (it, idx) {
      var cy = pad.t + idx * rowH + rowH * 0.22;
      var bh = rowH * 0.56;
      var bw = Math.max(4, toX(it.val) - pad.l);

      ctx.fillStyle = '#111214';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(it.lbl, pad.l - 10, cy + bh * 0.72);

      ctx.fillStyle = it.color;
      ctx.fillRect(pad.l, cy, bw, bh);

      ctx.font = '10px ui-monospace, monospace';
      var valText = fmtSci(it.val);
      if (pad.l + bw + 66 < w - pad.r) {
        ctx.fillStyle = '#25272b';
        ctx.textAlign = 'left';
        ctx.fillText(valText, pad.l + bw + 6, cy + bh * 0.72);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(valText, pad.l + bw - 6, cy + bh * 0.72);
      }
    });

    ctx.strokeStyle = '#9aa5ae';
    ctx.strokeRect(pad.l, pad.t, pw, ph);
  }

  window.resetFtaSim = function () {
    document.getElementById('ftaLambdaEpu').value = FTA_DEFAULTS.epu;
    document.getElementById('ftaBurst').value = FTA_DEFAULTS.burst;
    document.getElementById('ftaShield').value = FTA_DEFAULTS.shield;
    document.getElementById('ftaAct').value = FTA_DEFAULTS.act;
    document.getElementById('ftaBeta').value = FTA_DEFAULTS.beta;
    updateFtaSim();
  };

  /* Widget #3: FAA Stage 5 TIA & Air Taxi Release Checklist */
  window.updateSafetyAudit = function () {
    var checks = Array.prototype.slice.call(document.querySelectorAll('#safetyGateAudit .gate-check'));
    if (!checks.length) return;
    var done = 0;
    checks.forEach(function (cb) {
      var item = cb.closest('.gate-item');
      if (cb.checked) {
        done++;
        if (item) item.classList.add('checked');
      } else if (item) {
        item.classList.remove('checked');
      }
    });

    var pct = Math.round((done / checks.length) * 100);
    document.getElementById('auditScore').textContent = pct + '%';
    document.getElementById('auditCount').textContent = done + ' / ' + checks.length;
    var fill = document.getElementById('auditBarFill');
    fill.style.width = pct + '%';
    fill.style.backgroundColor = pct === 100 ? '#165b3d' : pct >= 50 ? '#283e6e' : '#9a5b13';

    var box = document.getElementById('auditVerdictBox');
    var vEl = document.getElementById('auditVerdict');
    box.classList.remove('warn-ok', 'warn-tight', 'warn-over');
    if (done === checks.length) {
      box.classList.add('warn-ok');
      vEl.textContent = t(
        'READY FOR FAA PART 135 COMMERCIAL OPS：满足城际载客空中出租车全部适航门控',
        'READY FOR FAA PART 135 AIR TAXI OPS: All TIA & commercial safety gates closed'
      );
    } else if (done >= 4) {
      box.classList.add('warn-tight');
      vEl.textContent = t(
        'STAGE 5 TIA FLIGHT TESTING（2026 现状）：符合性原型机 N547JX 已进入局方试飞，尚待最终 TC 与 Part 135 放行',
        'STAGE 5 TIA FLIGHT TESTING (2026 Status): Conforming N547JX in TIA; awaiting final TC & Part 135 sign-off'
      );
    } else {
      box.classList.add('warn-over');
      vEl.textContent = t(
        'EXPERIMENTAL R&D ONLY：仅限遥控/实验特许试飞',
        'EXPERIMENTAL R&D ONLY: Restricted to experimental test flights'
      );
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    try {
      if (localStorage.getItem('fv_joby_safety_lang') === 'E') {
        document.body.classList.add('E');
        document.documentElement.lang = 'en';
        var btn = document.getElementById('langBtn');
        if (btn) btn.textContent = '中文';
      }
    } catch (e) {}

    setupScrollSpy();

    ['tiltAngle', 'tiltIas', 'tiltAsym', 'tiltAlt'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', updateTiltCalc);
    });

    ['ftaLambdaEpu', 'ftaBurst', 'ftaShield', 'ftaAct', 'ftaBeta'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', updateFtaSim);
    });

    document.querySelectorAll('#safetyGateAudit .gate-check').forEach(function (cb) {
      cb.addEventListener('change', updateSafetyAudit);
    });

    updateTiltCalc();
    updateFtaSim();
    updateSafetyAudit();

    window.addEventListener('resize', updateFtaSim);
  });
})();
