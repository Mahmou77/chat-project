/**
 * games/memory.js - لعبة الذاكرة
 */
class MemoryGame {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.cards = [];
    this.flipped = [];
    this.matched = 0;
    this.moves = 0;
    this.lock = false;
    this.startTime = null;
    this.emojis = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐸'];
    this.init();
  }

  init() {
    const pairs = this.emojis.slice(0,8);
    this.cards = [...pairs,...pairs].sort(()=>Math.random()-.5).map((em,i)=>({id:i,emoji:em,flipped:false,matched:false}));
    this.flipped=[]; this.matched=0; this.moves=0; this.lock=false; this.startTime=Date.now();
    this.render();
  }

  render() {
    if (!this.container) return;
    const elapsed = Math.floor((Date.now()-this.startTime)/1000);
    this.container.innerHTML=`
      <div style="text-align:center;max-width:360px;margin:0 auto">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--pl)">🃏 لعبة الذاكرة</div>
        <div style="display:flex;gap:14px;justify-content:center;margin-bottom:12px;font-size:12px;color:var(--txm)">
          <span>🎯 الحركات: <strong style="color:var(--tx)">${this.moves}</strong></span>
          <span>⏱️ الوقت: <strong style="color:var(--tx)">${elapsed}ث</strong></span>
          <span>✅ مطابق: <strong style="color:var(--ok)">${this.matched/2}/${this.cards.length/2}</strong></span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-width:300px;margin:0 auto 14px">
          ${this.cards.map(card=>`
            <div onclick="window._memory.flip(${card.id})" style="
              height:60px;border-radius:9px;display:flex;align-items:center;justify-content:center;
              font-size:26px;cursor:pointer;transition:all .3s;
              background:${card.matched?'rgba(34,197,94,.15)':card.flipped?'var(--sf2)':'var(--p)'};
              border:2px solid ${card.matched?'var(--ok)':card.flipped?'var(--bd)':'rgba(124,58,237,.5)'};
              transform:${card.flipped||card.matched?'':'scale(.95)'};">
              ${card.flipped||card.matched?card.emoji:'🎴'}
            </div>`).join('')}
        </div>
        ${this.matched===this.cards.length?`<div style="background:rgba(34,197,94,.1);border:1px solid var(--ok);border-radius:10px;padding:12px;margin-bottom:10px"><div style="font-size:18px">🎉</div><div style="font-weight:700;color:var(--ok)">أنجزت اللعبة في ${this.moves} حركة!</div></div>`:''}
        <button onclick="window._memory=new MemoryGame('${this.container.id}')" style="background:var(--p);color:#fff;border:none;border-radius:8px;padding:7px 16px;cursor:pointer;font-family:Tajawal;font-size:12px">🔄 لعبة جديدة</button>
      </div>`;
    window._memory = this;
  }

  flip(id) {
    if (this.lock) return;
    const card = this.cards.find(c=>c.id===id);
    if (!card||card.flipped||card.matched) return;
    card.flipped = true;
    this.flipped.push(card);
    if (this.flipped.length===2) {
      this.moves++;
      this.lock=true;
      const [a,b]=this.flipped;
      if (a.emoji===b.emoji) {
        a.matched=b.matched=true;
        this.matched+=2;
        this.flipped=[]; this.lock=false;
        this.render();
      } else {
        setTimeout(()=>{a.flipped=b.flipped=false;this.flipped=[];this.lock=false;this.render();},900);
        this.render();
      }
    } else this.render();
  }
}
window.MemoryGame = MemoryGame;
