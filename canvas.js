/**
 * canvas.js
 * Animated floating ice-crystal snowflake particles on a <canvas>.
 * Completely self-contained — no external dependencies.
 */

(function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H;
  const PARTICLE_COUNT = 55;
  const particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x:    Math.random() * 20000,
      y:    Math.random() * 20000,
      vx:   (Math.random() - 0.5) * 0.22,
      vy:   (Math.random() - 0.5) * 0.22,
      size: Math.random() * 2.2 + 0.5,
      op:   Math.random() * 0.45 + 0.12,
      rot:  Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.004,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(makeParticle());

  function draw() {
    ctx.clearRect(0, 0, W, H);

    particles.forEach(p => {
      // drift
      p.x = ((p.x + p.vx) % W + W) % W;
      p.y = ((p.y + p.vy) % H + H) % H;
      p.rot += p.rotV;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.op;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 0.45;

      const len = p.size * 5;
      for (let a = 0; a < 6; a++) {
        // main arm
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -len);
        ctx.stroke();
        // tiny branch
        ctx.beginPath();
        ctx.moveTo(0, -len * 0.55);
        ctx.lineTo(len * 0.22, -len * 0.72);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -len * 0.55);
        ctx.lineTo(-len * 0.22, -len * 0.72);
        ctx.stroke();
        ctx.rotate(Math.PI / 3);
      }
      ctx.restore();
    });

    requestAnimationFrame(draw);
  }

  draw();
})();
