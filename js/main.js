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
    if (r === 'projects') {
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
  function navigate(r) {
    if (!ROUTES.includes(r)) r = 'home';
    if (r === route || transitioning) return;
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

  /* ---------------- Projects：翻页式卡片牌堆 + 收缩式 icon 坞 ---------------- */
  // 卡片数据：base 为设计稿原始画板尺寸，其余坐标同样直接取设计稿值
  const PROJECTS = [
    { id: 'terabox', tpl: 'tpl-terabox', title: 'Terabox', bw: 955.10, bh: 404.78, bg: '#f9f9f9',
      icon: { src: 'assets/projects/terabox/image_13.webp', x: 40, y: 289.56, w: 22.33, h: 20.32 },
      ds: 22.0,
      tx: 71.73, ty: 286.90, color: '#32302e',
      dx: 40, dy: 338.37, dw: 461, dop: 1,
      desc: '百度网盘海外版本，主打内容+AI，海外方向强化多模态与AI能力。' },
    { id: 'oreate', tpl: 'tpl-oreate', title: 'Oreate AI', bw: 946, bh: 395.68, bg: '#f9f9f9',
      icon: { src: 'assets/projects/oreate/image_12.webp', x: 36.73, y: 288.16, w: 19.73, h: 20.05 },
      ds: 21.5,
      tx: 67, ty: 287.84, color: '#32302e',
      dx: 40, dy: 337.84, dw: 566, dop: 0.75,
      desc: 'AI全模态内容，快速生成AI图像、视频等多元需求，支持PPT、助力深度研究与写作。' },
    { id: 'companion', tpl: 'tpl-companion', title: 'Companion App', bw: 969.80, bh: 419.48, bg: '#f9f9f9',
      icon: { src: 'assets/projects/companion/image_5.webp', x: 35.73, y: 272.50, w: 22.29, h: 22.29 },
      ds: 23.0,
      tx: 62.79, ty: 271.89, color: '#32302e',
      dx: 41, dy: 315.84, dw: 457, dop: 0.8, dlh: 19, dwrap: true,
      desc: 'Tiko是一位智能协作助手，能够帮助用户更快速地获取信息、完成决策并简化日常工作流程，为用户带来更顺畅的使用体验。' },
    { id: 'justpaper', tpl: 'tpl-justpaper', title: 'Just Paper', bw: 946, bh: 395.68,
      bg: 'linear-gradient(180deg,#2d2d2d -79.86%,#000 100.08%)',
      icon: { src: 'assets/projects/justpaper/image_3.webp', x: 40, y: 282, w: 27.28, h: 26 },
      ds: 21.5,
      tx: 77.74, ty: 286.27, color: '#fdfdfd',
      dx: 42.74, dy: 331.37, dw: 438, dop: 0.75, dcolor: '#fff',
      desc: '原生笔记软件，结合双屏的产品特点为用户构建笔记使用新体验。' },
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
      if (Math.abs(move) > 40) (move < 0 ? next() : prev());
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

  /* ---------------- 初始化 ---------------- */
  const initial = routeFromHash();
  applyRoute(initial);
  popEl(initial === 'home' ? ghost : cornerLogo);
  if (initial !== 'home') pillEnter(initial);
})();
