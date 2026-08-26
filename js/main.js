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
    'case-companion': document.getElementById('view-case-companion'),
    'case-justpaper': document.getElementById('view-case-justpaper'),
    'case-oreate': document.getElementById('view-case-oreate'),
  };
  const ROUTES = ['home', 'about', 'contact', 'projects', 'case-companion', 'case-justpaper', 'case-oreate'];
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
    if (r.indexOf('case-') === 0) {
      fitCase(r);
      resetCaseNav(r);
      fadeInView(views[r]);
      // 内页不显示顶部胶囊，且回到外层页面时让它从中间重新弹开，而不是从旧位置平移过来
      if (pill) pill.classList.remove('is-visible', 'is-expand', 'is-collapse');
      scrolledExpand = false;
      // is-pop 动画会用 fill 锁住 opacity，压过内页的渐隐规则，进内页前先摘掉
      if (cornerLogo) cornerLogo.classList.remove('is-pop', 'is-shrink');
    }
    if (r === 'projects') {
      if (pendingCard >= 0) { active = pendingCard; pendingCard = -1; }
      fitStage();
      prepEnter();                          // 同一帧内先藏好，绝不露帧
      setTimeout(playEnter, 140);            // 等转场落定后再放动画
      startAuto();
    } else stopAuto();
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

  let leavingProjects = false;
  let leavingCase = false;
  let leavingOuter = false;
  function navigate(r) {
    if (!ROUTES.includes(r)) r = 'home';
    if (r === route || transitioning) return;
    // 进作品内页：正文首次进入时才拉取，拉到手再切，避免进去看到空白
    if (r.indexOf('case-') === 0 && CASES[r] && !CASES[r].loaded && !CASES[r].failed) {
      loadCase(r).then(() => navigate(r));
      return;
    }
    // 离开作品内页：正文先整体渐隐
    if (route.indexOf('case-') === 0 && canAnim && !leavingCase) {
      leavingCase = true;
      const v = views[route];
      if (v) v.style.opacity = '0';
      setTimeout(() => { navigate(r); leavingCase = false; }, 300);
      return;
    }
    // 离开 Projects：先让所有卡片渐隐，再走原来的转场
    if (route === 'projects' && canAnim && !leavingProjects && projects) {
      leavingProjects = true;
      projects.classList.add('is-leaving');
      setTimeout(() => {
        navigate(r);                       // 仍持有 leavingProjects，避免再次进入淡出分支
        projects.classList.add('is-hidden');     // 闸门关上：之后任何一帧都不会再露出卡片
        leavingProjects = false;
      }, 240);
      return;
    }
    // about / contact 之间互切（以及去 Projects）：旧页面正文先渐隐，别硬切。
    // 内页和 Projects 的离场各有自己的分支，这里必须让开：它们的 setTimeout 回调里
    // 二次调用 navigate 时 route 还没变，若被这条接住就会两个分支交替接管、路由永远切不过去
    if (canAnim && !leavingOuter && !leavingProjects && route.indexOf('case-') !== 0 &&
        route !== 'home' && r !== 'home' && views[route]) {
      leavingOuter = true;
      views[route].style.opacity = '0';
      setTimeout(() => { navigate(r); leavingOuter = false; }, 260);
      return;
    }
    setAwake(false);
    const from = route;
    const involvesHome = r === 'home' || from === 'home';
    const mode = from === 'home' ? 'enter' : (r === 'home' ? 'leave' : 'slide');
    // 内页之间切换：不动画幽灵；胶囊平移
    if (!canAnim || !involvesHome) {
      if (mode === 'leave') pillLeave();
      applyRoute(r);
      if (location.hash !== hashOf(r)) location.hash = hashOf(r);
      if (mode === 'slide') {
        // 从作品内页回来：胶囊已经收掉了，直接在原位从中间渐显展开
        if (from.indexOf('case-') === 0) pillEnter(r);
        else pillSlide(r);
      } else if (mode === 'enter') pillPlace(r);
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
  const REVEAL_SEL = '.view.is-active .about__avatar, .view.is-active .about__name, .view.is-active .about__role, .view.is-active .about__bio > p, .view.is-active .about__heading, .view.is-active .row, .view.is-active .about__cta, .view.is-active .contact__note, .view.is-active .contact__item';
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

  /* ---------------- Projects：翻页式卡片牌堆 + 收缩式 icon 坞 ---------------- */
  // 卡片数据：base 为设计稿原始画板尺寸，其余坐标同样直接取设计稿值
  const PROJECTS = [
    { id: 'companion', tpl: 'tpl-companion', title: 'Companion App', bw: 969.80, bh: 419.48, bg: '#f9f9f9',
      caseRoute: 'case-companion',
      icon: { src: 'assets/projects/companion/image_5.webp', x: 35.73, y: 272.50, w: 22.29, h: 22.29 },
      ds: 23.0,
      tx: 62.79, ty: 271.89, color: '#32302e',
      dx: 41, dy: 315.84, dw: 457, dop: 0.8, dlh: 19, dwrap: true,
      desc: 'Tiko是一位智能协作助手，能够帮助用户更快速地获取信息、完成决策并简化日常工作流程，为用户带来更顺畅的使用体验。' },
    { id: 'justpaper', tpl: 'tpl-justpaper', title: 'Just Paper', bw: 946, bh: 395.68,
      bg: 'linear-gradient(180deg,#2d2d2d -79.86%,#000 100.08%)',
      caseRoute: 'case-justpaper',
      icon: { src: 'assets/projects/justpaper/image_3.webp', x: 40, y: 282, w: 27.28, h: 26 },
      ds: 21.5,
      tx: 77.74, ty: 286.27, color: '#fdfdfd',
      dx: 42.74, dy: 331.37, dw: 438, dop: 0.75, dcolor: '#fff',
      desc: '原生笔记软件，结合双屏的产品特点为用户构建笔记使用新体验。' },
    { id: 'oreate', tpl: 'tpl-oreate', title: 'Oreate AI', bw: 946, bh: 395.68, bg: '#f9f9f9',
      caseRoute: 'case-oreate',
      icon: { src: 'assets/projects/oreate/image_12.webp', x: 36.73, y: 288.16, w: 19.73, h: 20.05 },
      ds: 21.5,
      tx: 67, ty: 287.84, color: '#32302e',
      dx: 40, dy: 337.84, dw: 566, dop: 0.75,
      desc: 'AI全模态内容，快速生成AI图像、视频等多元需求，支持PPT、助力深度研究与写作。' },
    { id: 'terabox', tpl: 'tpl-terabox', title: 'Terabox', bw: 955.10, bh: 404.78, bg: '#f9f9f9',
      icon: { src: 'assets/projects/terabox/image_13.webp', x: 40, y: 289.56, w: 22.33, h: 20.32 },
      ds: 22.0,
      tx: 71.73, ty: 286.90, color: '#32302e',
      dx: 40, dy: 338.37, dw: 461, dop: 1,
      desc: '百度网盘海外版本，主打内容+AI，海外方向强化多模态与AI能力。' },
    { id: 'practices', tpl: 'tpl-practices', title: 'Practices', bw: 946, bh: 400, bg: '#fff',
      icon: { src: 'assets/projects/practices/image_3.webp', x: 40, y: 294.36, w: 25.51, h: 24.27 },
      ds: 21.5,
      tx: 61, ty: 295, tw: 78.83, color: '#32302e', tls: '-2%',
      dx: 39.94, dy: 332.25, dw: 578, dop: 1,
      desc: '个人技能练习作品，包括UI页面、MG动效/三维动效（静帧展示）、建模视觉等。' },
  ];
  // icon 坞里 5 个槽位的中心横坐标（设计稿 198px 胶囊内）
  const SLOT_CX = [36.76, 66.87, 99.18, 128.71, 161.63];
  const CARD_W = 979, CARD_H = 409, DOCK_CX = 99;

  const deck = document.getElementById('deck');
  const dock = document.getElementById('dock');
  const projects = document.getElementById('projects');
  const AUTO_MS = 4600;
  const FLIP_MS = 680;
  const DEPTH = 3;            // 设计稿只露出 3 层
  let active = 0;
  let pendingCard = -1;      // 从内页返回时要直接落在哪张卡
  let autoTimer = null;
  let flipping = false;
  let hovering = false;
  let cards = [];
  let dockItems = [];

  function iconHTML(p) {
    return `<img src="assets/projects/icons/${p.id}.webp" alt="" decoding="async" />`;
  }



  // 一张卡片：画面层从模板克隆（设计稿坐标），信息条为真实文本
  function buildCard(p, i) {
    const li = document.createElement('li');
    li.className = 'card';
    li.dataset.idx = String(i);
    li.style.background = p.bg;
    const art = document.createElement('div');
    art.className = 'card__art';
    art.style.width = p.bw + 'px';
    art.style.height = p.bh + 'px';
    art.style.transform = `scale(${(CARD_W / p.bw).toFixed(5)})`;   // 等比缩放，绝不拉伸
    const tpl = document.getElementById(p.tpl);
    if (tpl) art.appendChild(tpl.content.cloneNode(true));
    art.insertAdjacentHTML('beforeend', `
      <img class="card__icon" src="${p.icon.src}" alt="" decoding="async"
           style="left:${p.icon.x}px;top:${p.icon.y}px;width:${p.icon.w}px;height:${p.icon.h}px" />
      <h2 class="card__title" style="left:${p.tx}px;top:${p.ty}px;color:${p.color}${p.tw ? ';width:' + p.tw + 'px;text-align:center' : ''}${p.tls ? ';letter-spacing:' + p.tls : ''}">${p.title}</h2>
      <p class="card__desc" style="left:${p.dx}px;top:${p.dy}px;width:${p.dw}px;color:${p.dcolor || p.color};opacity:${p.dop}${p.dlh ? ';line-height:' + p.dlh + 'px' : ''};white-space:${p.dwrap ? 'normal' : 'nowrap'}">${p.desc}</p>`);
    li.appendChild(art);
    return li;
  }

  // 一个 dock icon：绝对定位在设计稿槽位，收起时整体平移回胶囊中心
  function buildDockItem(p, i) {
    const cx = SLOT_CX[i];
    const li = document.createElement('li');
    li.className = 'dock__item';
    li.dataset.idx = String(i);
    li.style.left = (cx - p.ds / 2) + 'px';
    li.style.top = ((44 - p.ds) / 2) + 'px';
    li.style.width = p.ds + 'px';
    li.style.height = p.ds + 'px';
    li.style.setProperty('--dx', (DOCK_CX - cx) + 'px');
    li.innerHTML = `<button class="dock__btn" type="button" aria-label="查看 ${p.title}">
        <span class="dock__icon">${iconHTML(p)}</span>
      </button>`;
    return li;
  }

  function renderProjects() {
    if (!deck || !dock) return;
    deck.replaceChildren(...PROJECTS.map(buildCard));
    const list = document.createElement('ul');
    list.className = 'dock__list';
    list.replaceChildren(...PROJECTS.map(buildDockItem));
    dock.replaceChildren(Object.assign(document.createElement('span'), { className: 'dock__pill' }), list);
    cards = Array.prototype.slice.call(deck.children);
    dockItems = Array.prototype.slice.call(list.children);
    dockItems.forEach((li) => {
      li.querySelector('.dock__btn').addEventListener('click', () => goTo(Number(li.dataset.idx)));
    });
    layout();
  }

  // 视口适配：整个舞台等比缩放，避免任何内部尺寸重算
  function fitStage() {
    if (!projects) return;
    const s = Math.min(1, (window.innerWidth - 80) / CARD_W, (window.innerHeight - 250) / 567);
    projects.style.setProperty('--s', Math.max(0.4, s).toFixed(4));
  }

  // 被拖离牌堆时的位置：向左上偏移并微微旋转
  const OUT_T = 'translate(-4%, -48%) rotate(-5deg) scale(0.96)';

  // 牌堆层叠：每往后一层下移 70px、缩小 9.4%，与设计稿三层的位置一致
  function layout() {
    const n = PROJECTS.length;
    cards.forEach((el, i) => {
      if (el.classList.contains('is-out')) return;   // 正在被拖走的那张不参与排布
      const d = (i - active + n) % n;
      const shown = d < DEPTH;
      el.style.zIndex = String(n - d);
      el.style.transform = `translateY(${(d * 70).toFixed(1)}px) scale(${(1 - d * 0.094).toFixed(4)})`;
      el.style.opacity = shown ? '1' : '0';
      el.style.pointerEvents = d === 0 ? 'auto' : 'none';
      el.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
    });
    dockItems.forEach((li, i) => li.classList.toggle('is-active', i === active));
    preload((active + 1) % n);
  }

  // 提前解码下一张，避免翻页瞬间图片还没绘制出来
  const decoded = new Set();
  function preload(i) {
    if (decoded.has(i) || !cards[i]) return;
    decoded.add(i);
    cards[i].querySelectorAll('img').forEach((img) => {
      if (img.decode) img.decode().catch(() => {});
    });
  }

  // 收起状态下换卡：当前那个 icon 跟着卡片方向滚出，新的从反方向滚进来
  function rollIcons(from, to, back) {
    if (!dockItems[from] || !dockItems[to] || dock.classList.contains('is-open')) return;
    dock.style.setProperty('--dir', back ? '1' : '-1');
    const out = dockItems[from], inn = dockItems[to];
    [out, inn].forEach((el) => el.classList.remove('roll-out', 'roll-in'));
    void out.offsetWidth;
    out.classList.add('roll-out');
    inn.classList.add('roll-in');
    setTimeout(() => {
      out.classList.remove('roll-out');
      inn.classList.remove('roll-in');
    }, 460);
  }

  // 入场分两步：先把卡片藏好并摆到起点，等页面真正到位后再开动
  function prepEnter() {
    if (!cards.length) return;
    const n = PROJECTS.length;
    projects.classList.remove('is-leaving');
    projects.classList.add('is-hidden');                   // 整个舞台先彻底隐藏
    cards.forEach((el, i) => {
      const d = (i - active + n) % n;
      el.classList.add('no-anim', 'is-entering');
      el.style.opacity = d < DEPTH ? '1' : '0';             // 目标值，可见性仍由闸门决定
      // 后两张起点与最前面那张完全重合，之后才向下探出，避免飞行和叠影
      el.style.transform = d === 0
        ? 'translateY(0) scale(0.9)'
        : `translateY(0) scale(${(1 - d * 0.094).toFixed(4)})`;
      el.style.transitionDelay = d === 0 ? '0ms' : (360 + (d - 1) * 140) + 'ms';
    });
  }

  // 最上面那张先从 90% 放大并淡入，后两张等它完全不透明后再依次探出
  function playEnter() {
    if (!cards.length) return;
    if (!canAnim) { projects.classList.remove('is-hidden'); layout(); return; }
    projects.classList.remove('is-hidden');
    void deck.offsetWidth;                                 // 让起点状态先生效
    cards.forEach((el) => el.classList.remove('no-anim'));
    layout();
    setTimeout(() => {
      cards.forEach((el) => { el.classList.remove('is-entering'); el.style.transitionDelay = ''; });
    }, 1300);
  }

  function goTo(i, dir) {
    const n = PROJECTS.length;
    i = ((i % n) + n) % n;
    if (i === active || flipping) return;
    preload(i);
    flipping = true;
    const was = active;
    // 入场动画若还没跑完，先把它的延迟清掉，避免翻卡带着延迟走
    cards.forEach((el) => { el.classList.remove('is-entering'); el.style.transitionDelay = ''; });
    cards.forEach((el) => el.classList.add('is-moving'));
    if (dir === 'prev') {
      // 往回滚：目标卡先瞬移到"被拖走"的位置，再滑回牌堆最前
      const back = cards[i];
      back.classList.add('no-anim');
      back.style.zIndex = String(n + 1);
      back.style.transform = OUT_T;
      back.style.opacity = '0';
      void back.offsetWidth;
      back.classList.remove('no-anim');
      active = i;
      layout();
    } else {
      // 往前滚：当前这张被拖离牌堆，随后无声无息回到最底
      const front = cards[active];
      front.classList.add('is-out');
      front.style.zIndex = String(n + 1);
      front.style.transform = OUT_T;
      front.style.opacity = '0';
      active = i;
      layout();
      setTimeout(() => { front.classList.remove('is-out'); layout(); }, FLIP_MS);
    }
    setTimeout(() => {
      cards.forEach((el) => el.classList.remove('is-moving'));
      flipping = false;
    }, FLIP_MS);
    rollIcons(was, i, dir === 'prev');
  }
  function next() { goTo(active + 1); }
  function prev() { goTo(active - 1, 'prev'); }

  function startAuto() {
    stopAuto();
    if (!canAnim || !cards.length) return;
    autoTimer = setInterval(() => {
      if (document.hidden || hovering || route !== 'projects') return;
      next();
    }, AUTO_MS);
  }
  function stopAuto() { clearInterval(autoTimer); autoTimer = null; }

  if (deck && dock) {
    renderProjects();
    fitStage();
    window.addEventListener('resize', fitStage);

    // hover 期间暂停自动翻页
    projects.addEventListener('pointerenter', () => { hovering = true; });
    projects.addEventListener('pointerleave', () => { hovering = false; });

    // 滚轮/触控板滚动切卡：向下滚把最上面那张拖走，向上滚把它滚回来
    let wheelAcc = 0, wheelTimer = null;
    projects.addEventListener('wheel', (e) => {
      if (route !== 'projects') return;
      e.preventDefault();
      if (flipping) return;
      wheelAcc += e.deltaY;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelAcc = 0; }, 220);   // 停手就清零，避免累积误触
      if (wheelAcc > 48) { wheelAcc = 0; next(); }
      else if (wheelAcc < -48) { wheelAcc = 0; prev(); }
    }, { passive: false });

    // 也支持直接把卡片拖走（触屏/触控板拖拽）
    let downX = 0, downY = 0;
    deck.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
    deck.addEventListener('pointerup', (e) => {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      const move = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(move) > 40) { (move < 0 ? next() : prev()); return; }
      // 基本没位移就算点击：有内页的卡片点进去
      const p = PROJECTS[active];
      if (p && p.caseRoute) navigate(p.caseRoute);
    });
    window.addEventListener('keydown', (e) => {
      if (route !== 'projects') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
    });

    // icon 坞展开/收起：以中间那个为原点，向两侧依次展开；收起时反向收回中心
    const STAGGER = 45;
    const MID = (PROJECTS.length - 1) / 2;
    function setDelays(open) {
      dockItems.forEach((li, i) => {
        const rank = Math.abs(i - MID);          // 离中心越远越晚出现
        li.style.setProperty('--d', (open ? rank * STAGGER : (MID - rank) * STAGGER) + 'ms');
      });
      dock.style.setProperty('--pd', open ? '0ms' : (MID + 1) * STAGGER + 'ms');
    }
    function openDock() { setDelays(true); dock.classList.add('is-open'); }
    function closeDock() { setDelays(false); dock.classList.remove('is-open'); }

    // 鼠标只是划过时不触发动画：停留 140ms 才展开，离开 80ms 后再收起
    let hoverTimer = null;
    function scheduleOpen() {
      clearTimeout(hoverTimer);
      if (dock.classList.contains('is-open')) return;
      hoverTimer = setTimeout(openDock, 140);
    }
    function scheduleClose() {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(closeDock, 80);
    }
    dock.addEventListener('pointerenter', scheduleOpen);
    dock.addEventListener('pointerleave', scheduleClose);
    dock.addEventListener('focusin', openDock);
    dock.addEventListener('focusout', (e) => { if (!dock.contains(e.relatedTarget)) closeDock(); });
    closeDock();
  }

  /* ---------------- 作品内页 ---------------- */
  // 每个内页一份配置：正文脚本、挂载的全局变量、设计稿画布高度、底部“下个作品”指向的卡片
  const CASES = {
    'case-companion': { src: 'pages/case-companion.js', key: 'CASE_DOC_COMPANION', h: 8944, nextRoute: 'case-justpaper' },
    'case-justpaper': { src: 'pages/case-justpaper.js', key: 'CASE_DOC_JUSTPAPER', h: 9952, nextRoute: 'case-oreate' },
    'case-oreate': { src: 'pages/case-oreate.js', key: 'CASE_DOC_OREATE', h: 10795, nextId: 'terabox' },
  };
  const CASE_W = 1920;
  let caseScale = 1, caseScrolled = false;

  Object.keys(CASES).forEach((r) => {
    const c = CASES[r];
    const v = views[r];
    c.doc = v ? v.querySelector('.case-doc') : null;
    c.nav = v ? v.querySelector('.case-nav') : null;
    c.items = c.nav ? Array.prototype.slice.call(c.nav.querySelectorAll('.case-nav__item')) : [];
    c.secs = c.items.filter((el) => el.dataset.sec).map((el) => Number(el.dataset.sec));
    c.loaded = false; c.loading = null; c.failed = false;
    c.items.forEach((el) => {
      el.addEventListener('click', () => {
        if (el.hasAttribute('data-back')) { navigate('projects'); return; }
        const y = Number(el.dataset.sec) * caseScale - window.innerHeight * 0.18;
        window.scrollTo({ top: Math.max(0, y), behavior: canAnim ? 'smooth' : 'auto' });
      });
    });
  });

  // 正文单独成文件，首次进入时以 script 方式加载（fetch 在 file:// 下会被拦，改用 script 才能双击直接打开）
  function loadCase(r) {
    const c = CASES[r];
    if (!c || c.loaded) return Promise.resolve();
    if (!c.loading) {
      c.loading = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = c.src;
        s.onload = () => {
          if (c.doc) c.doc.innerHTML = window[c.key] || '';
          c.loaded = !!window[c.key];
          const nextCard = c.doc && c.doc.querySelector('#case-next-card');
          if (nextCard) {
            nextCard.setAttribute('role', 'link');
            nextCard.addEventListener('click', () => {
              // 对方有内页就直接进内页，没有就回牌堆并落在那张卡
              if (c.nextRoute) { navigate(c.nextRoute); return; }
              pendingCard = PROJECTS.findIndex((x) => x.id === c.nextId);
              navigate('projects');
            });
          }
          if (c.doc) initHScroll(c.doc);
          if (c.doc) initMarquee(c.doc);
          resolve();
        };
        s.onerror = () => { c.loading = null; c.failed = true; resolve(); };
        document.head.appendChild(s);
      });
    }
    return c.loading;
  }
  // 横向滚动图：设计稿里图下方那根蓝条就是可视滚动条，滑块宽度按可视/总宽比例，且可直接拖
  function initHScroll(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-hscroll]'), (view) => {
      const bar = doc.querySelector('[data-hscroll-bar="' + view.getAttribute('data-hscroll') + '"]');
      const thumb = bar && bar.querySelector('.hscroll__thumb');
      if (!thumb) return;
      let thumbW = 0;
      function sync() {
        // 内页 display:none 时量出来全是 0，比例算成 NaN 会把滑块宽度写坏，直接跳过等真正显示了再算
        if (!view.clientWidth || !view.scrollWidth || !bar.clientWidth) return;
        const max = view.scrollWidth - view.clientWidth;
        thumbW = Math.max(bar.clientWidth * (view.clientWidth / view.scrollWidth), 12);
        thumb.style.width = thumbW.toFixed(2) + 'px';
        const p = max > 0 ? view.scrollLeft / max : 0;
        thumb.style.transform = 'translateX(' + (p * (bar.clientWidth - thumbW)).toFixed(2) + 'px)';
      }
      view.addEventListener('scroll', sync);
      window.addEventListener('resize', sync);
      // 预取时内页还是隐藏的，尺寸从 0 变成真实值时补算一次，用户不滚也能先看到滑块
      if (window.ResizeObserver) new ResizeObserver(sync).observe(view);
      thumb.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const x0 = e.clientX, from = view.scrollLeft;
        const max = view.scrollWidth - view.clientWidth;
        const span = bar.clientWidth - thumbW;
        thumb.classList.add('is-drag');
        // 正文整体被 scale 过，指针位移要先除掉缩放系数才是画布上的距离
        const move = (ev) => {
          if (span <= 0) return;
          view.scrollLeft = from + ((ev.clientX - x0) / (caseScale || 1) / span) * max;
        };
        const up = () => {
          thumb.classList.remove('is-drag');
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
      sync();
    });
  }
  // 产出素材图墙：从右往左匀速滚动，整条内容复制过一份，位移到一半就归零，所以看不出接缝。
  // hover 不是直接停，而是把播放速率分档降到 0（约 0.6s），移开再升回 1
  function initMarquee(doc) {
    if (!canAnim) return;
    Array.prototype.forEach.call(doc.querySelectorAll('.marquee'), (box) => {
      const track = box.querySelector('.marquee__track');
      if (!track) return;
      const speed = Number(box.getAttribute('data-marquee-speed')) || 45;   // px/s
      let anim = null, ramp = null, rate = 1;
      function start() {
        if (anim) return true;
        const half = track.scrollWidth / 2;
        if (!half) return false;
        anim = track.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(' + -half + 'px)' }],
          { duration: (half / speed) * 1000, iterations: Infinity, easing: 'linear' }
        );
        anim.playbackRate = rate;
        return true;
      }
      // 正文是在首页就预取的，那会儿内页还是 display:none，scrollWidth 量出来是 0，
      // 启动不了。load 早就过去了、再挂 load 监听永远不会触发，所以靠 ResizeObserver
      // 等它真正显示、尺寸出来那一刻再启动（图的宽高是内联写死的，不受懒加载影响）
      if (!start()) {
        if (window.ResizeObserver) {
          const ro = new ResizeObserver(() => { if (start()) ro.disconnect(); });
          ro.observe(track);
        } else {
          window.addEventListener('load', start, { once: true });
        }
      }
      function ease(to) {
        clearInterval(ramp);
        ramp = setInterval(() => {
          rate = Math.max(0, Math.min(1, rate + (to > rate ? 0.07 : -0.07)));
          // 用 playbackRate 而不是 updatePlaybackRate：后者是「等动画 ready 再生效」，
          // 直接赋值会立刻生效且不改 currentTime，所以不会跳帧
          if (anim) anim.playbackRate = rate;
          if (rate === to) clearInterval(ramp);
        }, 40);
      }
      box.addEventListener('pointerenter', () => ease(0));
      box.addEventListener('pointerleave', () => ease(1));
    });
  }
  // 到 Projects 页时顺手预取，点卡片进内页就不用等
  window.addEventListener('load', () => {
    setTimeout(() => { Object.keys(CASES).forEach(loadCase); }, 1200);
  });

  function fitCase(r) {
    const c = CASES[r];
    if (!c || !views[r]) return;
    caseScale = document.documentElement.clientWidth / CASE_W;
    views[r].style.setProperty('--cs', caseScale.toFixed(5));
    views[r].style.setProperty('--ch', c.h + 'px');
    views[r].style.height = Math.round(c.h * caseScale) + 'px';
  }
  function fadeInView(v) {
    if (!v) return;
    if (!canAnim) { v.style.opacity = '1'; return; }
    v.style.transition = 'none';
    v.style.opacity = '0';
    void v.offsetWidth;
    v.style.transition = '';
    requestAnimationFrame(() => { v.style.opacity = '1'; });
  }
  // 侧栏一开始不出现，进场时也不做动画；只有用户真的往下滚了才逐行显现
  function resetCaseNav(r) {
    const c = CASES[r];
    if (!c || !c.nav) return;
    caseScrolled = false;
    c.nav.classList.add('no-anim');
    c.nav.classList.remove('is-visible');
    c.items.forEach((el, i) => el.style.setProperty('--d', (i * 0.06).toFixed(2) + 's'));
    c.items.forEach((el) => el.classList.remove('is-current'));
    void c.nav.offsetWidth;                     // 先把隐藏态定住，入场不会闪一下
    requestAnimationFrame(() => c.nav.classList.remove('no-anim'));
  }
  function caseScrollSpy() {
    const c = CASES[route];
    if (!c || !c.nav) return;
    if (window.scrollY <= 30) caseScrolled = false;
    if (caseScrolled) c.nav.classList.add('is-visible');
    else c.nav.classList.remove('is-visible');
    const line = window.scrollY + window.innerHeight * 0.35;
    let cur = 0;
    c.secs.forEach((y, i) => { if (y * caseScale <= line) cur = i; });
    c.items.forEach((el) => el.classList.remove('is-current'));
    const target = c.items.filter((el) => el.dataset.sec)[cur];
    if (target) target.classList.add('is-current');
  }
  // 只认真实的滚动输入，避免进场时浏览器恢复滚动位置把侧栏带出来
  ['wheel', 'touchmove', 'keydown'].forEach((ev) => {
    window.addEventListener(ev, () => {
      if (CASES[route] && window.scrollY > 30) { caseScrolled = true; caseScrollSpy(); }
    }, { passive: true });
  });
  let caseTick = false;
  window.addEventListener('scroll', () => {
    if (caseTick) return;
    caseTick = true;
    requestAnimationFrame(() => { caseScrollSpy(); caseTick = false; });
  }, { passive: true });
  window.addEventListener('resize', () => { if (CASES[route]) fitCase(route); });

  /* ---------------- 初始化 ---------------- */
  const initial = routeFromHash();
  applyRoute(initial);
  if (CASES[initial]) loadCase(initial).then(() => fitCase(initial));
  if (initial.indexOf('case-') !== 0) popEl(initial === 'home' ? ghost : cornerLogo);
  if (initial !== 'home') pillEnter(initial);
})();
