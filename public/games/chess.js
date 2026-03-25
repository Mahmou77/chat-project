/**
 * games/chess.js - شطرنج مبسط
 */
class ChessGame {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.selected = null;
    this.turn = 'w';
    this.board = this.initBoard();
    this.moveHistory = [];
    this.gameOver = false;
  }

  initBoard() {
    const b = Array(8).fill(null).map(() => Array(8).fill(null));
    const order = ['R','N','B','Q','K','B','N','R'];
    order.forEach((p,i) => { b[0][i] = 'b'+p; b[7][i] = 'w'+p; });
    for (let i=0;i<8;i++) { b[1][i]='bP'; b[6][i]='wP'; }
    return b;
  }

  pieceEmoji(p) {
    if (!p) return '';
    const map = {wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'};
    return map[p] || '?';
  }

  render() {
    if (!this.container) return;
    let html = `
      <div style="text-align:center;max-width:380px;margin:0 auto">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--pl)">♟️ الشطرنج</div>
        <div style="font-size:12px;margin-bottom:10px;color:${this.turn==='w'?'var(--tx)':'var(--txm)'}">
          دور: ${this.turn==='w'?'الأبيض ♔':'الأسود ♚'}
        </div>
        <div style="display:inline-block;border:2px solid var(--bd);border-radius:6px;overflow:hidden;margin-bottom:12px">`;
    for (let r=0;r<8;r++) {
      for (let c=0;c<8;c++) {
        const isLight = (r+c)%2===0;
        const piece = this.board[r][c];
        const isSelected = this.selected && this.selected[0]===r && this.selected[1]===c;
        const bg = isSelected ? '#7c3aed' : isLight ? '#f0d9b5' : '#b58863';
        const color = piece ? (piece[0]==='w' ? '#fff' : '#000') : 'transparent';
        html += `<div onclick="window._chess.click(${r},${c})" style="
          width:42px;height:42px;background:${bg};display:inline-flex;align-items:center;
          justify-content:center;font-size:24px;cursor:pointer;transition:background .1s;
          color:${color};border:1px solid rgba(0,0,0,.1);text-shadow:${piece&&piece[0]==='w'?'0 0 3px #000':piece&&piece[0]==='b'?'0 0 3px #fff':''};
          line-height:1;font-family:serif;font-weight:900;">
          ${this.pieceEmoji(piece)}
        </div>`;
      }
      html += '<br/>';
    }
    html += `</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="window._chess=new ChessGame('${this.container.id}');window._chess.render()" style="background:var(--p);color:#fff;border:none;border-radius:8px;padding:7px 16px;cursor:pointer;font-family:Tajawal;font-size:12px">🔄 إعادة</button>
      </div>
      <div style="font-size:11px;color:var(--txm);margin-top:8px">انقر على قطعة ثم المكان المراد</div>
    </div>`;
    this.container.innerHTML = html;
    window._chess = this;
  }

  click(r, c) {
    const piece = this.board[r][c];
    if (this.selected) {
      const [sr, sc] = this.selected;
      if (sr === r && sc === c) { this.selected = null; this.render(); return; }
      if (this.isValidMove(sr, sc, r, c)) {
        this.board[r][c] = this.board[sr][sc];
        this.board[sr][sc] = null;
        this.moveHistory.push({from:[sr,sc],to:[r,c]});
        this.turn = this.turn === 'w' ? 'b' : 'w';
        this.selected = null;
        this.render();
        return;
      }
    }
    if (piece && piece[0] === this.turn) { this.selected = [r, c]; }
    else { this.selected = null; }
    this.render();
  }

  isValidMove(sr, sc, tr, tc) {
    const piece = this.board[sr][sc];
    if (!piece) return false;
    const target = this.board[tr][tc];
    if (target && target[0] === piece[0]) return false;
    const dr = tr - sr, dc = tc - sc;
    const type = piece[1];
    const color = piece[0];
    if (type === 'P') {
      const dir = color === 'w' ? -1 : 1;
      if (dc === 0 && dr === dir && !target) return true;
      if (dc === 0 && dr === dir*2 && !target && !this.board[sr+dir][sc] && ((color==='w'&&sr===6)||(color==='b'&&sr===1))) return true;
      if (Math.abs(dc) === 1 && dr === dir && target) return true;
      return false;
    }
    if (type === 'R') return (dr === 0 || dc === 0) && this.clearPath(sr,sc,tr,tc);
    if (type === 'B') return Math.abs(dr) === Math.abs(dc) && this.clearPath(sr,sc,tr,tc);
    if (type === 'Q') return (dr===0||dc===0||Math.abs(dr)===Math.abs(dc)) && this.clearPath(sr,sc,tr,tc);
    if (type === 'N') return (Math.abs(dr)===2&&Math.abs(dc)===1)||(Math.abs(dr)===1&&Math.abs(dc)===2);
    if (type === 'K') return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
    return false;
  }

  clearPath(sr,sc,tr,tc) {
    const dr = Math.sign(tr-sr), dc = Math.sign(tc-sc);
    let r=sr+dr, c=sc+dc;
    while (r!==tr || c!==tc) {
      if (this.board[r][c]) return false;
      r+=dr; c+=dc;
    }
    return true;
  }
}
window.ChessGame = ChessGame;
