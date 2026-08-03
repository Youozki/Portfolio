(function () {
  const hero = document.getElementById('hero');
  const ghost = document.getElementById('ghost');
  const inner = document.getElementById('ghostInner');
  const eyes = document.querySelectorAll('.eye');
  if (!hero || !ghost || !inner) return;

  const WAKE_RADIUS = 300;   // 鼠标进入该半径内幽灵苏醒
  const MAX_EYE = 7;         // 眼珠最大位移(px)
  const MAX_BODY = 4;        // 身体最大位移(px)，幅度略小于眼睛
  let sleepTimer = null;

  function setAwake(on) {
    hero.classList.toggle('is-awake', on);
    ghost.classList.toggle('is-awake', on);
  }

  function wake() {
    setAwake(true);
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => setAwake(false), 2800);
  }

  function onMove(e) {
    const r = ghost.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < WAKE_RADIUS) wake();

    const angle = Math.atan2(dy, dx);
    const t = Math.min(dist / 70, 1); // 距离越远偏移越接近上限
    const ex = Math.cos(angle) * t * MAX_EYE;
    const ey = Math.sin(angle) * t * MAX_EYE;
    const bx = Math.cos(angle) * t * MAX_BODY;
    const by = Math.sin(angle) * t * MAX_BODY;

    eyes.forEach((eye) => { eye.style.transform = `translate(${ex}px, ${ey}px)`; });
    // 身体微跟随（transform 与呼吸 bob 的 translate 属性互不冲突）
    inner.style.transform = `translate(${bx}px, ${by}px)`;
  }

  window.addEventListener('mousemove', onMove, { passive: true });
  ghost.addEventListener('click', wake); // 触屏兜底

  /* ---------- 漂浮粒子：逐个发射，类型在诞生时锁定 ---------- */
  const floaters = document.getElementById('floaters');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (floaters && !reduce) {
    const Z = [
      { src: 'assets/image_2.png', w: 58 }, // 大 Z
      { src: 'assets/image_4.png', w: 52 }, // 中 Z
      { src: 'assets/image_3.png', w: 34 }, // 小 z
    ];
    const BUB = [
      { d: 16, c: '#1a7af0' },
      { d: 40, c: '#6aa8f5' },
      { d: 24, c: '#1a7af0' },
    ];
    let i = 0;

    function spawn() {
      const awake = hero.classList.contains('is-awake');
      const p = document.createElement('span');
      p.className = 'p';
      p.style.setProperty('--dur', (2600 + Math.random() * 600).toFixed(0) + 'ms');
      p.style.setProperty('--dx', (Math.random() * 22 - 30).toFixed(0) + 'px'); // 略向左上漂

      if (awake) {
        const b = BUB[i % BUB.length];
        p.style.width = b.d + 'px';
        p.style.height = b.d + 'px';
        const c = document.createElement('span');
        c.className = 'bub';
        c.style.background = b.c;
        p.appendChild(c);
      } else {
        const z = Z[i % Z.length];
        p.style.width = z.w + 'px';
        const img = document.createElement('img');
        img.src = z.src;
        img.alt = '';
        p.appendChild(img);
      }
      i++;
      floaters.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }

    spawn();
    setInterval(spawn, 1500); // 每 1.5s 冒一个，间隔更长
  }
})();
