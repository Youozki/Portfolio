(function () {
  const body = document.body;
  const ghost = document.getElementById('ghost');
  const inner = document.getElementById('ghostInner');
  const ghostStage = document.getElementById('ghostStage');
  const cornerLogo = document.getElementById('cornerLogo');
  const floaters = document.getElementById('floaters');
  const pill = document.querySelector('.nav__pill');
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
  let scrolledExpand = false;

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
    if (views[r]) views[r].style.opacity = '1';   // 新页面复位为可见
    ghost.setAttribute('aria-label', r === 'home' ? '小幽灵吉祥物' : '返回首页');
    window.scrollTo(0, 0);
    // 离开首页时清空残留粒子，避免切回首页时堆积
    if (r !== 'home' && floaters) floaters.replaceChildren();
    if (r === 'about' || r === 'contact') requestAnimationFrame(enterReveal);
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
    const from = route;
    const involvesHome = r === 'home' || from === 'home';
    const mode = from === 'home' ? 'enter' : (r === 'home' ? 'leave' : 'slide');
    // 内页之间切换：不动画幽灵；胶囊平移
    if (!canAnim || !involvesHome) {
      if (mode === 'leave') pillLeave();
      applyRoute(r);
      if (location.hash !== hashOf(r)) location.hash = hashOf(r);
      if (mode === 'slide') pillSlide(r);
      else if (mode === 'enter') pillPlace(r);
      return;
    }
    transitioning = true;
    const outEl = from === 'home' ? ghost : cornerLogo;
    const inEl = r === 'home' ? ghost : cornerLogo;
    if (views[from]) views[from].style.opacity = '0'; // 旧页面正文渐隐，避免直接消失
    if (mode === 'leave') pillLeave(); // 胶囊收起（进场的逆过程）
    outEl.classList.remove('is-pop');
    outEl.classList.add('is-shrink');
    setTimeout(() => {
      outEl.classList.remove('is-shrink');
      applyRoute(r);
      if (location.hash !== hashOf(r)) location.hash = hashOf(r);
      if (mode === 'enter') pillEnter(r); // 胶囊自中部向左右弹开
      popEl(inEl);
      transitioning = false;
    }, 260);
  }

  /* ---------------- 顶部导航磨砂胶囊 ---------------- */
  function linkFor(r) { for (const a of navLinks) if (a.dataset.route === r) return a; return null; }
  function placePill(r) {
    const l = linkFor(r);
    if (!l || !pill) return;
    pill.style.left = (l.offsetLeft - 16) + 'px';
    pill.style.width = (l.offsetWidth + 32) + 'px';
  }
  function pillEnter(r) { // 无过渡定位 -> scaleX 弹开
    if (!pill) return;
    scrolledExpand = false;
    pill.classList.remove('is-collapse', 'is-expand');
    pill.style.transition = 'none';
    placePill(r);
    pill.classList.add('is-visible');
    void pill.offsetWidth;
    pill.style.transition = '';
    pill.classList.add('is-expand');
  }
  function pillSlide(r) { // 保持展开，平移+变宽
    if (!pill) return;
    pill.classList.remove('is-collapse', 'is-expand');
    pill.classList.add('is-visible');
    placePill(r);
  }
  function pillLeave() { // 回首页：普通态用 scaleX 收起；延展态直接渐隐
    if (!pill) return;
    pill.classList.remove('is-expand');
    if (scrolledExpand) {
      pill.classList.remove('is-collapse');
      pill.classList.add('is-fading');       // 更慢的渐隐，避免文字瞬间重叠
      pill.classList.remove('is-visible');
      setTimeout(() => pill.classList.remove('is-fading'), 720);
    } else {
      pill.classList.add('is-collapse');
      setTimeout(() => pill.classList.remove('is-visible', 'is-collapse'), 300);
    }
  }
  function pillPlace(r) { // 无动画直接定位显示（如减动效场景）
    if (!pill) return;
    pill.classList.remove('is-collapse', 'is-expand');
    pill.style.transition = 'none';
    placePill(r);
    pill.classList.add('is-visible');
    void pill.offsetWidth;
    pill.style.transition = '';
  }
  if (pill) pill.addEventListener('animationend', () => pill.classList.remove('is-expand'));
  window.addEventListener('resize', () => { if (route !== 'home') { pill.style.transition = 'none'; scrolledExpand ? fullPill() : placePill(route); void pill.offsetWidth; pill.style.transition = ''; } });

  // 滚动到接近正文时，胶囊延伸覆盖整排导航，避免正文文字与导航文字叠加
  function fullPill() {
    if (!pill || !navLinks.length) return;
    const first = navLinks[0], last = navLinks[navLinks.length - 1];
    const left = first.offsetLeft - 16;
    const right = last.offsetLeft + last.offsetWidth + 16;
    pill.classList.add('is-visible');
    pill.style.left = left + 'px';
    pill.style.width = (right - left) + 'px';
  }
  function onScroll() {
    if (route === 'home') { scrolledExpand = false; return; }
    if (transitioning) return;
    const s = window.scrollY > 80;
    if (s === scrolledExpand) return;
    scrolledExpand = s;
    if (s) fullPill(); else placePill(route);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------- 正文逐行渐显 + 底部偏外文字淡化 ---------------- */
  const REVEAL_SEL = '.view.is-active .about__name, .view.is-active .about__role, .view.is-active .about__bio > p, .view.is-active .about__heading, .view.is-active .row, .view.is-active .about__cta, .view.is-active .contact__note, .view.is-active .contact__item';
  function revealEls() { return Array.prototype.slice.call(document.querySelectorAll(REVEAL_SEL)); }
  // 元素自身的基础透明度（"用户体验设计师"本就偏浅，与"体验设计实习生"一致）
  function baseOp(el) { return el.classList.contains('about__role') ? 0.5 : 1; }
  // 按元素在视口中的位置计算透明度：中心低于视口 80% 后逐渐变淡，只影响底部小范围
  function opacityFor(el) {
    const r = el.getBoundingClientRect();
    const c = r.top + r.height / 2;
    const vh = window.innerHeight;
    if (c <= vh * 0.8) return 1;
    return Math.max(0.12, 1 - (c - vh * 0.8) / (vh * 0.28));
  }
  function scrollReveal() {
    if (route === 'home') return;
    revealEls().forEach((el) => { el.style.opacity = (opacityFor(el) * baseOp(el)).toFixed(3); });
  }
  // 进入 About：逐行快速渐显（较快，仅作视觉过渡），随后交给滚动淡化
  function enterReveal() {
    if (!canAnim) { revealEls().forEach((el) => { el.style.opacity = ''; }); return; }
    const els = revealEls();
    els.forEach((el) => { el.style.transition = 'none'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; });
    void document.body.offsetWidth;
    els.forEach((el, i) => {
      el.style.transition = `opacity 0.4s ease ${(i * 0.03).toFixed(3)}s, transform 0.4s ease ${(i * 0.03).toFixed(3)}s`;
      el.style.opacity = (opacityFor(el) * baseOp(el)).toFixed(3);
      el.style.transform = 'none';
    });
    setTimeout(() => {
      els.forEach((el) => { el.style.transition = 'opacity 0.3s ease, transform 0.3s ease'; });
      scrollReveal();
    }, els.length * 30 + 460);
  }
  let revealTick = false;
  window.addEventListener('scroll', () => {
    if (revealTick) return;
    revealTick = true;
    requestAnimationFrame(() => { scrollReveal(); revealTick = false; });
  }, { passive: true });

  // 导航点击（点击当前所在页则滚动到顶部）
  navLinks.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const r = a.dataset.route;
      if (r === route) window.scrollTo({ top: 0, behavior: 'smooth' });
      else navigate(r);
    });
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
  if (initial !== 'home') pillEnter(initial);
})();
