/**
 * games/snake.js - لعبة الأفعى
 */
class SnakeGame {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.size = 16;
    this.snake = [{x:8,y:8},{x:7,y:8},{x:6,y:8}];
    this.dir = {x:1,y:0};
    this.nextDir = {x:1,y:0};
    this.food = this.spawnFood();
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('snake_hs')||'0');
    this.running = false;
    this.interval = null;
    this.speed = 150;
    this.renderUI();
    this.setupKeys();
  }

  spawnFood() {
    let f;
    do { f={x:Math.floor(Math.random()*this.size),y:Math.floor(Math.random()*this.size)}; }
    while (this.snake?.some(s=>s.x===f.x&&s.y===f.y));
    return f;
  }

  renderUI() {
    if (!this.container) return;
    const cell = 22;
    const boardSize = this.size * cell;
    this.container.innerHTML=`
      <div style="text-align:center;max-width:${boardSize+20}px;margin:0 auto">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--pl)">🐍 لعبة الأفعى</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;padding:0 4px">
          <span>🎯 النقاط: <strong id="snake-score" style="color:var(--pl)">0</strong></span>
          <span>🏆 الأعلى: <strong id="snake-hs" style="color:var(--ac)">${this.highScore}</strong></span>
        </div>
        <canvas id="snake-canvas" width="${boardSize}" height="${boardSize}" style="border:2px solid var(--bd);border-radius:8px;display:block;margin:0 auto 10px;cursor:pointer;background:#0a0a1a"></canvas>
        <div style="display:flex;gap:6px;justify-content:center;margin-bottom:8px">
          <button onclick="window._snake.togglePause()" id="snake-btn" style="background:var(--p);color:#fff;border:none;border-radius:8px;padding:7px 16px;cursor:pointer;font-family:Tajawal;font-size:12px;font-weight:700">▶ ابدأ</button>
          <button onclick="window._snake=new SnakeGame('${this.container.id}')" style="background:var(--sf2);border:1px solid var(--bd);color:var(--tx);border-radius:8px;padding:7px 14px;cursor:pointer;font-family:Tajawal;font-size:12px">🔄 إعادة</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,44px);gap:5px;justify-content:center">
          <div></div>
          <button onclick="window._snake.setDir(0,-1)" style="background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:8px;cursor:pointer;font-size:18px">⬆️</button>
          <div></div>
          <button onclick="window._snake.setDir(-1,0)" style="background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:8px;cursor:pointer;font-size:18px">⬅️</button>
          <button onclick="window._snake.setDir(0,1)" style="background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:8px;cursor:pointer;font-size:18px">⬇️</button>
          <button onclick="window._snake.setDir(1,0)" style="background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:8px;cursor:pointer;font-size:18px">➡️</button>
        </div>
      </div>`;
    this.canvas = document.getElementById('snake-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.cell = cell;
    window._snake = this;
    this.draw();
  }

  setupKeys() {
    this._keyHandler = (e) => {
      const dirs = {ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
        w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
      if (dirs[e.key]) { e.preventDefault(); const d=dirs[e.key]; if(d.x!==-this.dir.x||d.y!==-this.dir.y) this.nextDir=d; }
      if (e.key===' ') this.togglePause();
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  setDir(x,y) { if(x!==-this.dir.x||y!==-this.dir.y) this.nextDir={x,y}; }

  togglePause() {
    const btn=document.getElementById('snake-btn');
    if (this.running) { clearInterval(this.interval); this.running=false; if(btn)btn.textContent='▶ استمر'; }
    else { this.running=true; if(btn)btn.textContent='⏸ إيقاف'; this.interval=setInterval(()=>this.tick(),this.speed); }
  }

  tick() {
    this.dir = this.nextDir;
    const head = {x:this.snake[0].x+this.dir.x, y:this.snake[0].y+this.dir.y};
    if (head.x<0||head.x>=this.size||head.y<0||head.y>=this.size||this.snake.some(s=>s.x===head.x&&s.y===head.y)) {
      this.gameOver(); return;
    }
    this.snake.unshift(head);
    if (head.x===this.food.x&&head.y===this.food.y) {
      this.score+=10; this.food=this.spawnFood();
      if(this.score>this.highScore){this.highScore=this.score;localStorage.setItem('snake_hs',this.highScore);}
      if(this.score%50===0) this.speed=Math.max(60,this.speed-10);
      const sc=document.getElementById('snake-score'),hs=document.getElementById('snake-hs');
      if(sc)sc.textContent=this.score;if(hs)hs.textContent=this.highScore;
    } else this.snake.pop();
    this.draw();
  }

  draw() {
    if (!this.ctx) return;
    const {ctx,cell,size}=this;
    ctx.fillStyle='#0a0a1a';ctx.fillRect(0,0,size*cell,size*cell);
    // Grid
    ctx.strokeStyle='rgba(255,255,255,.03)';ctx.lineWidth=.5;
    for(let i=0;i<=size;i++){ctx.beginPath();ctx.moveTo(i*cell,0);ctx.lineTo(i*cell,size*cell);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cell);ctx.lineTo(size*cell,i*cell);ctx.stroke();}
    // Food
    ctx.fillStyle='#ef4444';ctx.shadowColor='#ef4444';ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(this.food.x*cell+cell/2,this.food.y*cell+cell/2,cell/2-2,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    // Snake
    this.snake.forEach((s,i)=>{
      ctx.fillStyle=i===0?'#a78bfa':i===1?'#7c3aed':'#5b21b6';
      if(i===0){ctx.shadowColor='#a78bfa';ctx.shadowBlur=8;}else ctx.shadowBlur=0;
      ctx.beginPath();ctx.roundRect(s.x*cell+1,s.y*cell+1,cell-2,cell-2,4);ctx.fill();
    });
    ctx.shadowBlur=0;
  }

  gameOver() {
    clearInterval(this.interval);this.running=false;
    document.removeEventListener('keydown',this._keyHandler);
    const ctx=this.ctx,cw=this.size*this.cell;
    ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(0,0,cw,cw);
    ctx.fillStyle='#f87171';ctx.font='bold 20px Tajawal';ctx.textAlign='center';ctx.fillText('انتهت اللعبة!',cw/2,cw/2-20);
    ctx.fillStyle='#e2e8f0';ctx.font='14px Tajawal';ctx.fillText('النقاط: '+this.score,cw/2,cw/2+10);
    ctx.fillStyle='#fbbf24';ctx.fillText('أعلى: '+this.highScore,cw/2,cw/2+34);
  }
}
window.SnakeGame = SnakeGame;
