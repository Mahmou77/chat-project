/**
 * games/xo.js - إكس أو كامل مع تحدي الأعضاء
 */
class XOGame {
  constructor(containerId, socket, currentUser) {
    this.container = document.getElementById(containerId);
    this.socket = socket;
    this.currentUser = currentUser;
    this.board = Array(9).fill(null);
    this.turn = 'X';
    this.mySymbol = null;
    this.challengeId = null;
    this.opponentName = '';
    this.gameOver = false;
    this.scores = { X: 0, O: 0, draw: 0 };
  }

  initLocal() {
    this.board = Array(9).fill(null);
    this.turn = 'X';
    this.gameOver = false;
    this.mySymbol = 'X';
    this.render('لعبة محلية - أنت ❌، الكمبيوتر ⭕');
  }

  initChallenge(challengeId, mySymbol, opponentName) {
    this.board = Array(9).fill(null);
    this.turn = 'X';
    this.gameOver = false;
    this.challengeId = challengeId;
    this.mySymbol = mySymbol;
    this.opponentName = opponentName;
    this.render(`تحدٍّ مع ${opponentName} - أنت ${mySymbol === 'X' ? '❌' : '⭕'}`);
  }

  render(statusText) {
    if (!this.container) return;
    const winLine = this.getWinLine();
    this.container.innerHTML = `
      <div style="text-align:center;max-width:320px;margin:0 auto">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--pl)">${statusText || ''}</div>
        <div id="xo-status" style="font-size:14px;margin-bottom:10px;min-height:24px;font-weight:700"></div>
        <div style="display:flex;justify-content:center;gap:14px;margin-bottom:12px">
          <div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:6px 14px;text-align:center">
            <div style="font-size:18px">❌</div>
            <div style="font-size:16px;font-weight:700;color:#f87171" id="xo-score-x">${this.scores.X}</div>
          </div>
          <div style="background:rgba(148,163,184,.1);border:1px solid var(--bd);border-radius:8px;padding:6px 14px;text-align:center">
            <div style="font-size:18px">🤝</div>
            <div style="font-size:16px;font-weight:700;color:var(--txm)" id="xo-score-d">${this.scores.draw}</div>
          </div>
          <div style="background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:8px;padding:6px 14px;text-align:center">
            <div style="font-size:18px">⭕</div>
            <div style="font-size:16px;font-weight:700;color:#60a5fa" id="xo-score-o">${this.scores.O}</div>
          </div>
        </div>
        <div id="xo-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:240px;margin:0 auto 14px">
          ${this.board.map((cell, i) => `
            <div onclick="window._xoGame.move(${i})" style="
              background:${winLine.includes(i) ? 'rgba(34,197,94,.15)' : 'var(--bg)'};
              border:2px solid ${winLine.includes(i) ? 'var(--ok)' : 'var(--bd)'};
              border-radius:10px;height:68px;display:flex;align-items:center;justify-content:center;
              font-size:30px;cursor:${cell || this.gameOver ? 'not-allowed' : 'pointer'};
              transition:all .15s;${!cell && !this.gameOver ? 'hover:background:rgba(124,58,237,.1)' : ''}
            " onmouseover="${!cell && !this.gameOver ? "this.style.background='rgba(124,58,237,.1)'" : ''}"
               onmouseout="${!cell && !this.gameOver ? "this.style.background='var(--bg)'" : ''}">
              ${cell === 'X' ? '❌' : cell === 'O' ? '⭕' : ''}
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button onclick="window._xoGame.reset()" style="background:var(--p);color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-family:Tajawal;font-size:13px;font-weight:700">🔄 جولة جديدة</button>
          <button onclick="window._xoGame.initLocal()" style="background:var(--sf2);border:1px solid var(--bd);color:var(--tx);border-radius:8px;padding:8px 14px;cursor:pointer;font-family:Tajawal;font-size:13px">🔁 إعادة البداية</button>
        </div>
      </div>`;
    window._xoGame = this;
    this.updateStatus();
  }

  move(i) {
    if (this.board[i] || this.gameOver) return;
    if (this.challengeId && this.turn !== this.mySymbol) return;
    this.board[i] = this.turn;
    if (this.challengeId && this.socket) {
      this.socket.emit('game_move', { challengeId: this.challengeId, move: i });
    }
    this.processMove();
  }

  receiveMove(i) {
    if (this.board[i] || this.gameOver) return;
    this.board[i] = this.turn;
    this.processMove();
  }

  processMove() {
    const winner = this.checkWin();
    if (winner) {
      this.gameOver = true;
      this.scores[winner]++;
      this.render(this.challengeId ? `تحدٍّ مع ${this.opponentName}` : 'لعبة محلية');
      document.getElementById('xo-status').innerHTML = `<span style="color:${winner === 'X' ? '#f87171' : '#60a5fa'}">🎉 فاز ${winner === 'X' ? '❌' : '⭕'}!</span>`;
      if (this.challengeId && this.socket) {
        this.socket.emit('game_over', { challengeId: this.challengeId, winner: this.currentUser?.id });
      }
    } else if (this.board.every(Boolean)) {
      this.gameOver = true;
      this.scores.draw++;
      this.render(this.challengeId ? `تحدٍّ مع ${this.opponentName}` : 'لعبة محلية');
      document.getElementById('xo-status').textContent = '🤝 تعادل!';
    } else {
      this.turn = this.turn === 'X' ? 'O' : 'X';
      const grid = document.getElementById('xo-grid');
      if (grid) {
        grid.innerHTML = this.board.map((cell, i) => `
          <div onclick="window._xoGame.move(${i})" style="
            background:var(--bg);border:2px solid var(--bd);border-radius:10px;
            height:68px;display:flex;align-items:center;justify-content:center;
            font-size:30px;cursor:${cell || this.gameOver ? 'not-allowed' : 'pointer'};transition:all .15s;"
            onmouseover="${!cell && !this.gameOver ? "this.style.background='rgba(124,58,237,.1)'" : ''}"
            onmouseout="${!cell && !this.gameOver ? "this.style.background='var(--bg)'" : ''}">
            ${cell === 'X' ? '❌' : cell === 'O' ? '⭕' : ''}
          </div>`).join('');
      }
      this.updateStatus();
      // AI move if local game
      if (!this.challengeId && this.turn !== this.mySymbol) {
        setTimeout(() => this.aiMove(), 600);
      }
    }
  }

  aiMove() {
    if (this.gameOver) return;
    // Try to win
    let best = this.findBestMove('O');
    // Try to block
    if (best === -1) best = this.findBestMove('X');
    // Center
    if (best === -1 && !this.board[4]) best = 4;
    // Any corner
    if (best === -1) { const corners = [0,2,6,8].filter(i => !this.board[i]); if (corners.length) best = corners[Math.floor(Math.random()*corners.length)]; }
    // Any cell
    if (best === -1) best = this.board.findIndex(c => !c);
    if (best !== -1) { this.board[best] = 'O'; this.processMove(); }
  }

  findBestMove(sym) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) {
      const cells = [this.board[a],this.board[b],this.board[c]];
      const empties = [a,b,c].filter(i => !this.board[i]);
      if (cells.filter(x=>x===sym).length === 2 && empties.length === 1) return empties[0];
    }
    return -1;
  }

  checkWin() {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) {
      if (this.board[a] && this.board[a]===this.board[b] && this.board[a]===this.board[c]) return this.board[a];
    }
    return null;
  }

  getWinLine() {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const l of lines) {
      const [a,b,c] = l;
      if (this.board[a] && this.board[a]===this.board[b] && this.board[a]===this.board[c]) return l;
    }
    return [];
  }

  updateStatus() {
    const el = document.getElementById('xo-status');
    if (!el) return;
    const isMyTurn = !this.challengeId || this.turn === this.mySymbol;
    el.innerHTML = isMyTurn
      ? `<span style="color:var(--ok)">دورك: ${this.turn === 'X' ? '❌' : '⭕'}</span>`
      : `<span style="color:var(--txm)">دور ${this.opponentName}: ${this.turn === 'X' ? '❌' : '⭕'}</span>`;
  }

  reset() {
    this.board = Array(9).fill(null);
    this.turn = 'X';
    this.gameOver = false;
    this.render(this.challengeId ? `تحدٍّ مع ${this.opponentName}` : 'لعبة محلية');
  }
}

window.XOGame = XOGame;
