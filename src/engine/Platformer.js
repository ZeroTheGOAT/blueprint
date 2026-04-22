// ========================================
// Platformer.js — 2D Platformer Level Designer Engine
// ========================================

import { generateId } from '../utils/helpers.js';

export const TILE_TYPES = {
  eraser: { label: 'Eraser', color: '#ff0000', icon: '🧹', category: 'Tools' },
  character: { label: 'Character', color: '#a78bfa', icon: '🧑', category: 'Story' },
  dialog: { label: 'Dialog', color: '#f0abfc', icon: '💬', category: 'Story' },
  floor: { label: 'Floor', color: '#4ade80', icon: '🟩', category: 'Terrain' },
  wall: { label: 'Wall', color: '#94a3b8', icon: '🧱', category: 'Terrain' },
  dirt: { label: 'Dirt', color: '#854d0e', icon: '🟫', category: 'Terrain' },
  platform: { label: 'Platform', color: '#d97706', icon: '➖', category: 'Terrain' },
  spike: { label: 'Spike', color: '#f87171', icon: '🗡️', category: 'Hazards' },
  fire: { label: 'Fire', color: '#fb923c', icon: '🔥', category: 'Hazards' },
  water: { label: 'Water', color: '#60a5fa', icon: '💧', category: 'Hazards' },
  lava: { label: 'Lava', color: '#ef4444', icon: '🌋', category: 'Hazards' },
  saw: { label: 'Sawblade', color: '#64748b', icon: '⚙️', category: 'Hazards' },
  gate: { label: 'Gate', color: '#fcd34d', icon: '🚪', category: 'Interactive' },
  key: { label: 'Key', color: '#fbbf24', icon: '🔑', category: 'Interactive' },
  lever: { label: 'Lever', color: '#a3e635', icon: '🕹️', category: 'Interactive' },
  chest: { label: 'Chest', color: '#d97706', icon: '🧰', category: 'Interactive' },
  start: { label: 'Player Start', color: '#34d399', icon: '🧍', category: 'Logic' },
  end: { label: 'Level End', color: '#c084fc', icon: '🏁', category: 'Logic' },
  checkpoint: { label: 'Checkpoint', color: '#38bdf8', icon: '🚩', category: 'Logic' },
  enemy: { label: 'Enemy', color: '#e11d48', icon: '👾', category: 'Entities' },
  boss: { label: 'Boss', color: '#9f1239', icon: '👹', category: 'Entities' },
  npc: { label: 'NPC', color: '#2dd4bf', icon: '🗣️', category: 'Entities' },
  coin: { label: 'Coin', color: '#facc15', icon: '🪙', category: 'Entities' },
  health: { label: 'Health Potion', color: '#f43f5e', icon: '❤️', category: 'Entities' },
  powerup: { label: 'Powerup', color: '#818cf8', icon: '⭐', category: 'Entities' }
};

export class PlatformerCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    
    // Grid settings — Infinite canvas
    this.tileSize = 40;
    this.tiles = new Map(); // key: "x,y", value: type
    
    // View state
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.minZoom = 0.05;
    this.maxZoom = 4;
    
    // Interaction state
    this.isPanning = false;
    this.isPainting = false;
    this.isErasing = false;
    this.spaceHeld = false;
    
    // Deferred paint — prevents placing a tile on first touch before
    // we know if it's a single-finger paint or a two-finger pinch.
    this.pendingPaint = null;   // stores the initial pointer event
    this.paintConfirmed = false;
    
    // Pinch & multi-touch
    this.pointers = new Map();
    this.isPinching = false;
    this.initialPinchDist = 0;
    this.initialPinchZoom = 1;
    this.lastPinchCenter = { x: 0, y: 0 };
    
    // Drag state
    this.dragStartX = 0;
    this.dragStartY = 0;
    
    // History
    this.history = [];
    this.historyIndex = -1;
    this.hasModificationsInStroke = false;
    
    // Selected tool
    this.currentTool = 'floor'; // default tile type
    
    this.setupEventListeners();
    this.resize();
    this.centerView();
  }

  setupEventListeners() {
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('resize', () => this.resize());
  }

  centerView() {
    if (!this.canvasWidth || !this.canvasHeight) return;
    this.zoom = 1;
    this.panX = this.canvasWidth / 2;
    this.panY = this.canvasHeight / 2;
    this.render();
  }

  onPointerDown(e) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, event: e });
    
    // Two fingers → pinch. Cancel any pending paint immediately.
    if (this.pointers.size === 2) {
      this.isPinching = true;
      this.isPainting = false;
      this.isErasing = false;
      this.pendingPaint = null;
      this.paintConfirmed = false;
      
      const pts = Array.from(this.pointers.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      this.initialPinchDist = Math.hypot(dx, dy);
      this.initialPinchZoom = this.zoom;
      
      const rect = this.canvas.getBoundingClientRect();
      this.lastPinchCenter = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top
      };
      return;
    }

    if (this.pointers.size === 1) {
      this.canvas.setPointerCapture(e.pointerId);
      
      // Middle-click or space+click → pan
      if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
        this.isPanning = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      // Right-click → erase immediately (no conflict with pinch on desktop)
      if (e.button === 2) {
        this.isErasing = true;
        this.eraseTile(e);
        return;
      }

      // Left click on touch → DEFER the paint. Don't place a tile yet.
      // We wait until onPointerMove confirms it's a single-finger drag,
      // or onPointerUp confirms it's a single tap.
      if (e.button === 0) {
        this.hasModificationsInStroke = false;
        if (e.pointerType === 'touch') {
          // Touch: defer to avoid placing tile before second finger arrives
          this.pendingPaint = e;
          this.paintConfirmed = false;
        } else {
          // Mouse: paint immediately (no pinch conflict on desktop)
          this.paintConfirmed = true;
          if (this.currentTool === 'eraser') {
            this.isErasing = true;
            this.eraseTile(e);
          } else {
            this.isPainting = true;
            this.paintTile(e);
          }
        }
      }
    }
  }

  onPointerMove(e) {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, event: e });
    }
    
    // Pinch zoom
    if (this.isPinching && this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);
      
      const rect = this.canvas.getBoundingClientRect();
      const center = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top
      };
      
      const scale = dist / this.initialPinchDist;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.initialPinchZoom * scale));
      
      const factor = newZoom / this.zoom;
      this.panX = center.x - (center.x - this.panX) * factor;
      this.panY = center.y - (center.y - this.panY) * factor;
      this.zoom = newZoom;
      
      this.panX += center.x - this.lastPinchCenter.x;
      this.panY += center.y - this.lastPinchCenter.y;
      this.lastPinchCenter = center;
      
      this.render();
      return;
    }

    if (this.isPanning) {
      this.panX += e.clientX - this.dragStartX;
      this.panY += e.clientY - this.dragStartY;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.render();
      return;
    }

    // If we had a pending touch paint and the finger has moved enough
    // (still single finger), confirm it as painting.
    if (this.pendingPaint && !this.paintConfirmed && this.pointers.size === 1) {
      this.paintConfirmed = true;
      // Now commit the initial tile
      if (this.currentTool === 'eraser') {
        this.isErasing = true;
        this.eraseTile(this.pendingPaint);
      } else {
        this.isPainting = true;
        this.paintTile(this.pendingPaint);
      }
      this.pendingPaint = null;
    }

    if (this.isPainting) {
      this.paintTile(e);
    } else if (this.isErasing) {
      this.eraseTile(e);
    }
  }

  onPointerUp(e) {
    this.pointers.delete(e.pointerId);
    try { this.canvas.releasePointerCapture(e.pointerId); } catch(_) {}
    
    if (this.isPinching) {
      if (this.pointers.size === 0) this.isPinching = false;
      this.pendingPaint = null;
      this.paintConfirmed = false;
      return;
    }
    
    // If we had a deferred pending paint that was never moved (single tap),
    // commit it now on release.
    if (this.pendingPaint && !this.paintConfirmed && this.pointers.size === 0) {
      if (this.currentTool === 'eraser') {
        this.eraseTile(this.pendingPaint);
      } else {
        this.paintTile(this.pendingPaint);
      }
      this.pendingPaint = null;
      this.paintConfirmed = false;
    }
    
    if (this.hasModificationsInStroke) {
      this.pushHistory();
      if (window.markDirty) window.markDirty();
      this.hasModificationsInStroke = false;
    }
    
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.spaceHeld ? 'grab' : 'default';
    }
    this.isPainting = false;
    this.isErasing = false;
    this.pendingPaint = null;
    this.paintConfirmed = false;
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * (1 + delta)));
    
    const factor = newZoom / this.zoom;
    this.panX = sx - (sx - this.panX) * factor;
    this.panY = sy - (sy - this.panY) * factor;
    this.zoom = newZoom;
    
    this.render();
  }

  onKeyDown(e) {
    if (e.code === 'Space') {
      this.spaceHeld = true;
      if (!this.isPanning && !this.isPainting && !this.isErasing) {
        this.canvas.style.cursor = 'grab';
      }
    }
    
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        e.preventDefault();
        this.undo();
      } else if (e.key === 'y') {
        e.preventDefault();
        this.redo();
      }
    }
  }

  onKeyUp(e) {
    if (e.code === 'Space') {
      this.spaceHeld = false;
      if (!this.isPanning) {
        this.canvas.style.cursor = 'default';
      }
    }
  }

  getGridCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    
    const wx = (sx - this.panX) / this.zoom;
    const wy = (sy - this.panY) / this.zoom;
    
    const gx = Math.floor(wx / this.tileSize);
    const gy = Math.floor(wy / this.tileSize);
    
    return { gx, gy };
  }

  paintTile(e) {
    const { gx, gy } = this.getGridCoords(e);
    const key = `${gx},${gy}`;
    if (this.tiles.get(key) !== this.currentTool) {
      this.tiles.set(key, this.currentTool);
      this.hasModificationsInStroke = true;
      this.render();
    }
  }

  eraseTile(e) {
    const { gx, gy } = this.getGridCoords(e);
    const key = `${gx},${gy}`;
    if (this.tiles.has(key)) {
      this.tiles.delete(key);
      this.hasModificationsInStroke = true;
      this.render();
    }
  }

  resize() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = container.clientWidth * dpr;
    this.canvas.height = container.clientHeight * dpr;
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';
    this.ctx.scale(dpr, dpr);
    this.canvasWidth = container.clientWidth;
    this.canvasHeight = container.clientHeight;
    this.render();
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  clear() {
    this.tiles.clear();
    this.render();
  }

  getProjectData() {
    const tilesObj = {};
    for (const [k, v] of this.tiles.entries()) {
      tilesObj[k] = v;
    }
    return {
      type: 'platformer2d',
      tiles: tilesObj
    };
  }

  loadProjectData(data) {
    this.clear();
    if (data && data.tiles) {
      for (const [k, v] of Object.entries(data.tiles)) {
        this.tiles.set(k, v);
      }
    }
    this.history = [];
    this.historyIndex = -1;
    this.pushHistory();
    this.render();
  }

  pushHistory() {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const tilesObj = {};
    for (const [k, v] of this.tiles.entries()) {
      tilesObj[k] = v;
    }
    this.history.push(JSON.stringify(tilesObj));
    if (this.history.length > 50) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = JSON.parse(this.history[this.historyIndex]);
      this.tiles.clear();
      for (const [k, v] of Object.entries(state)) {
        this.tiles.set(k, v);
      }
      this.render();
      if (window.markDirty) window.markDirty();
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = JSON.parse(this.history[this.historyIndex]);
      this.tiles.clear();
      for (const [k, v] of Object.entries(state)) {
        this.tiles.set(k, v);
      }
      this.render();
      if (window.markDirty) window.markDirty();
    }
  }

  render() {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);
    
    // Only draw what's visible for performance
    const vx0 = -this.panX / this.zoom;
    const vy0 = -this.panY / this.zoom;
    const vx1 = vx0 + this.canvasWidth / this.zoom;
    const vy1 = vy0 + this.canvasHeight / this.zoom;
    
    const startCol = Math.floor(vx0 / this.tileSize);
    const endCol = Math.ceil(vx1 / this.tileSize);
    const startRow = Math.floor(vy0 / this.tileSize);
    const endRow = Math.ceil(vy1 / this.tileSize);
    
    // Draw Grid area background for the visible area
    ctx.fillStyle = '#111827';
    ctx.fillRect(
      startCol * this.tileSize,
      startRow * this.tileSize,
      (endCol - startCol) * this.tileSize,
      (endRow - startRow) * this.tileSize
    );
    
    // Draw Grid lines (only visible ones)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startCol; x <= endCol; x++) {
      ctx.moveTo(x * this.tileSize, startRow * this.tileSize);
      ctx.lineTo(x * this.tileSize, endRow * this.tileSize);
    }
    for (let y = startRow; y <= endRow; y++) {
      ctx.moveTo(startCol * this.tileSize, y * this.tileSize);
      ctx.lineTo(endCol * this.tileSize, y * this.tileSize);
    }
    ctx.stroke();

    // Draw tiles (only visible ones)
    ctx.font = `${this.tileSize * 0.6}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (const [key, type] of this.tiles.entries()) {
      const [gx, gy] = key.split(',').map(Number);
      if (gx < startCol - 1 || gx > endCol || gy < startRow - 1 || gy > endRow) continue;
      
      const def = TILE_TYPES[type];
      if (!def || type === 'eraser') continue;
      
      const tx = gx * this.tileSize;
      const ty = gy * this.tileSize;
      
      // Tile background
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(tx + 2, ty + 2, this.tileSize - 4, this.tileSize - 4);
      
      ctx.globalAlpha = 1.0;
      // Tile border
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(tx + 2, ty + 2, this.tileSize - 4, this.tileSize - 4);
      
      // Tile icon
      ctx.fillText(def.icon, tx + this.tileSize / 2, ty + this.tileSize / 2 + 2);
    }
    
    ctx.restore();
  }
}
