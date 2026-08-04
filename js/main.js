(function () {
  const body = document.body;
  const ghost = document.getElementById('ghost');
  const inner = document.getElementById('ghostInner');
  const ghostStage = document.getElementById('ghostStage');
  const cornerLogo = document.getElementById('cornerLogo');
  const floaters = document.getElementById('floaters');
  const eyes = document.querySelectorAll('.eye');
  const navLinks = document.querySelectorAll('.nav__link');
  if (!ghost || !inner || !ghostStage) return;

  const views = {
    home: document.getElementById('view-home'),
    about: document.getElementById('view-about'),
    contact: document.getElementById('view-contact'),
    projects: document.getElementById('view-projects'),
  };
  const ROUTES = ['home', 'about', 'contact', 'projects'];
  let route = 'home';
  let transitioning = false;

  const WAKE_RADIUS = 300;
  const MAX_EYE = 7;
  const MAX_BODY = 4;
  let sleepTimer = null;

  /* ---------------- 睡/醒 ---------------- */
  function setAwake(on) {
    ghost.classList.toggle('is-awake', on);
    if (!on) {
      eyes.forEach((eye) => {
        eye.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)';
        eye.style.transform = 'translate(0, 0)';
      });
      inner.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)';
      inner.style.transform = 'translate(0, 0)';
    }
  }
  function wake() {
    setAwake(true);
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => setAwake(false), 2800);
  }

  function onMove(e) {
    if (route !== 'home') return; // 仅首页跟随
    const r = ghost.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < WAKE_RADIUS) wake();
    const angle = Math.atan2(dy, dx);
    const t = Math.min(dist / 70, 1);
    const ex = Math.cos(angle) * t * MAX_EYE;
    const ey = Math.sin(angle) * t * MAX_EYE;
    const bx = Math.cos(angle) * t * MAX_BODY;
    const by = Math.sin(angle) * t * MAX_BODY;
    eyes.forEach((eye) => {
      eye.style.transition = 'transform 0.16s ease-out';
      eye.style.transform = `translate(${ex}px, ${ey}px)`;
    });
    inner.style.transition = 'transform 0.16s ease-out';
    inner.style.transform = `translate(${bx}px, ${by}px)`;
  }
  window.addEventListener('mousemove', onMove, { passive: true });
  // ROUTER_PLACEHOLDER

  /* ---------------- 路由 & 幽灵转场 ---------------- */
  const canAnim = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function applyRoute(r) {
    route = r;
    body.className = 'route-' + r;
    Object.keys(views).forEach((k) => {
      const on = k === r;
      if (!views[k]) return;
      views[k].classList.toggle('is-active', on);
      views[k].setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    navLinks.forEach((a) => a.classList.toggle('active', a.dataset.route === r && r !== 'home'));
    ghost.setAttribute('aria-label', r === 'home' ? '小幽灵吉祥物' : '返回首页');
    window.scrollTo(0, 0);
  }
  function popEl(el) {
    if (!el) return;
    el.classList.remove('is-pop');
    void el.offsetWidth; // 强制重排以重放动画
    el.classList.add('is-pop');
  }
  function hashOf(r) { return '#/' + r; }
  function routeFromHash() {
    const h = location.hash.replace(/^#\/?/, '');
    return ROUTES.includes(h) ? h : 'home';
  }

  function navigate(r) {
    if (!ROUTES.includes(r)) r = 'home';
    if (r === route || transitioning) return;
    setAwake(false);
    const involvesHome = r === 'home' || route === 'home';
    // 内页之间切换：不动画（左上角 Logo 保持不动）
    if (!canAnim || !involvesHome) {
      applyRoute(r);
      if (location.hash !== hashOf(r)) location.hash = hashOf(r);
      return;
    }
    transitioning = true;
    const outEl = route === 'home' ? ghost : cornerLogo; // 当前可见的那只
    const inEl = r === 'home' ? ghost : cornerLogo;       // 目标页要出现的那只
    outEl.classList.remove('is-pop');
    outEl.classList.add('is-shrink'); // 原地缩小消失
    setTimeout(() => {
      outEl.classList.remove('is-shrink');
      applyRoute(r);
      if (location.hash !== hashOf(r)) location.hash = hashOf(r);
      popEl(inEl); // 在新位置以相同动画弹出（可能是不同造型）
      transitioning = false;
    }, 260);
  }

  // 导航点击
  navLinks.forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); navigate(a.dataset.route); });
  });
  // “联系我吧”按钮
  document.querySelectorAll('[data-route="contact"].btn-contact').forEach((b) => {
    b.addEventListener('click', () => navigate('contact'));
  });
  // 浏览器前进/后退
  window.addEventListener('hashchange', () => navigate(routeFromHash()));

  /* ---------------- 点击幽灵：首页弹动+唤醒；内页返回首页 ---------------- */
  function bounce() {
    if (canAnim && typeof ghost.animate === 'function') {
      ghost.animate(
        [{ scale: '1' }, { scale: '1.045' }, { scale: '1' }],
        { duration: 340, easing: 'ease-in-out' }
      );
    }
  }
  function onGhostActivate() {
    if (route === 'home') { wake(); bounce(); }
    else { navigate('home'); }
  }
  ghost.addEventListener('click', onGhostActivate);
  ghost.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGhostActivate(); }
  });
  // 左上角 Logo 点击返回首页
  if (cornerLogo) {
    cornerLogo.addEventListener('click', () => navigate('home'));
    cornerLogo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('home'); }
    });
  }

  /* ---------------- 漂浮粒子（仅首页） ---------------- */
  if (floaters && canAnim) {
    const Z = [
      { src: 'assets/image_2.png', w: 58 },
      { src: 'assets/image_4.png', w: 52 },
      { src: 'assets/image_3.png', w: 34 },
    ];
    const BUB = [
      { d: 16, c: '#1a7af0' }, { d: 40, c: '#6aa8f5' }, { d: 24, c: '#1a7af0' },
    ];
    let i = 0;
    function spawn() {
      if (document.hidden || route !== 'home') return;
      const awake = ghost.classList.contains('is-awake');
      const p = document.createElement('span');
      p.className = 'p';
      p.style.setProperty('--dur', (2600 + Math.random() * 600).toFixed(0) + 'ms');
      p.style.setProperty('--dx', (Math.random() * 22 - 30).toFixed(0) + 'px');
      if (awake) {
        const b = BUB[i % BUB.length];
        p.style.width = b.d + 'px'; p.style.height = b.d + 'px';
        const c = document.createElement('span'); c.className = 'bub'; c.style.background = b.c;
        p.appendChild(c);
      } else {
        const z = Z[i % Z.length];
        p.style.width = z.w + 'px';
        const img = document.createElement('img'); img.src = z.src; img.alt = '';
        p.appendChild(img);
      }
      i++;
      floaters.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }
    spawn();
    setInterval(spawn, 1500);
    document.addEventListener('visibilitychange', () => { if (document.hidden) floaters.replaceChildren(); });
  }

  /* ---------------- 初始化 ---------------- */
  const initial = routeFromHash();
  applyRoute(initial);
  popEl(initial === 'home' ? ghost : cornerLogo);
})();
