// ========================================
// Platformer.js — 2D Platformer Level Designer Engine
// ========================================

import { generateId } from '../utils/helpers.js';

export const TILE_TYPES = {
  eraser: { label: 'Eraser', color: '#ff0000', icon: '🧹', category: 'Tools' },
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
    
    // Grid settings
    this.tileSize = 40;
    this.gridWidth = 50;
    this.gridHeight = 50;
    this.tiles = new Map(); // key: "x,y", value: type
    
    // View state
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.minZoom = 0.2;
    this.maxZoom = 3;
    
    // Interaction state
    this.isPanning = false;
    this.isPainting = false;
    this.isErasing = false;
    this.spaceHeld = false;
    
    // Pinch & multi-touch
    this.pointers = new Map();
    this.isPinching = false;
    this.initialPinchDist = 0;
    this.initialPinchZoom = 1;
    this.lastPinchCenter = { x: 0, y: 0 };
    
    // Drag state
    this.dragStartX = 0;
    this.dragStartY = 0;
    
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
    this.panX = (this.canvasWidth - this.gridWidth * this.tileSize) / 2;
    this.panY = (this.canvasHeight - this.gridHeight * this.tileSize) / 2;
    this.render();
  }

  onPointerDown(e) {
    this.pointers.set(e.pointerId, e);
    
    if (this.pointers.size === 2) {
      this.isPinching = true;
      this.isPainting = false;
      this.isErasing = false;
      
      const pts = Array.from(this.pointers.values());
      const dx = pts[1].clientX - pts[0].clientX;
      const dy = pts[1].clientY - pts[0].clientY;
      this.initialPinchDist = Math.hypot(dx, dy);
      this.initialPinchZoom = this.zoom;
      
      const rect = this.canvas.getBoundingClientRect();
      const pinchCenter = {
        x: (pts[0].clientX + pts[1].clientX) / 2 - rect.left,
        y: (pts[0].clientY + pts[1].clientY) / 2 - rect.top
      };
      this.lastPinchCenter = { ...pinchCenter };
      return;
    }

    if (this.pointers.size === 1) {
      this.canvas.setPointerCapture(e.pointerId);
      
      if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
        this.isPanning = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      if (e.button === 0) { // Left click = Paint or Erase (if eraser tool)
        if (this.currentTool === 'eraser') {
          this.isErasing = true;
          this.eraseTile(e);
        } else {
          this.isPainting = true;
          this.paintTile(e);
        }
      } else if (e.button === 2) { // Right click = Erase
        this.isErasing = true;
        this.eraseTile(e);
      }
    }
  }

  onPointerMove(e) {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, e);
    }
    
    if (this.isPinching && this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      const dx = pts[1].clientX - pts[0].clientX;
      const dy = pts[1].clientY - pts[0].clientY;
      const dist = Math.hypot(dx, dy);
      
      const rect = this.canvas.getBoundingClientRect();
      const center = {
        x: (pts[0].clientX + pts[1].clientX) / 2 - rect.left,
        y: (pts[0].clientY + pts[1].clientY) / 2 - rect.top
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

    if (this.isPainting) {
      this.paintTile(e);
    } else if (this.isErasing) {
      this.eraseTile(e);
    }
  }

  onPointerUp(e) {
    this.pointers.delete(e.pointerId);
    this.canvas.releasePointerCapture(e.pointerId);
    
    if (this.isPinching) {
      if (this.pointers.size === 0) this.isPinching = false;
      return;
    }
    
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.spaceHeld ? 'grab' : 'default';
    }
    this.isPainting = false;
    this.isErasing = false;
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
    if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
      const key = `${gx},${gy}`;
      if (this.tiles.get(key) !== this.currentTool) {
        this.tiles.set(key, this.currentTool);
        this.render();
      }
    }
  }

  eraseTile(e) {
    const { gx, gy } = this.getGridCoords(e);
    const key = `${gx},${gy}`;
    if (this.tiles.has(key)) {
      this.tiles.delete(key);
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
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      tiles: tilesObj
    };
  }

  loadProjectData(data) {
    this.clear();
    if (data && data.tiles) {
      this.gridWidth = data.gridWidth || 50;
      this.gridHeight = data.gridHeight || 50;
      for (const [k, v] of Object.entries(data.tiles)) {
        this.tiles.set(k, v);
      }
    }
    this.render();
  }

  render() {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Background
    ctx.fillStyle = '#0b0f19'; // darker background
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);
    
    // Draw Grid area background (subtle gradient/shadow effect could be nice, but flat is fast)
    ctx.fillStyle = '#111827'; 
    ctx.fillRect(0, 0, this.gridWidth * this.tileSize, this.gridHeight * this.tileSize);
    
    // Draw Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.gridWidth; x++) {
      ctx.moveTo(x * this.tileSize, 0);
      ctx.lineTo(x * this.tileSize, this.gridHeight * this.tileSize);
    }
    for (let y = 0; y <= this.gridHeight; y++) {
      ctx.moveTo(0, y * this.tileSize);
      ctx.lineTo(this.gridWidth * this.tileSize, y * this.tileSize);
    }
    ctx.stroke();

    // Draw bounds with glow
    ctx.shadowColor = 'rgba(124, 58, 237, 0.5)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, this.gridWidth * this.tileSize, this.gridHeight * this.tileSize);
    ctx.shadowBlur = 0;

    // Draw tiles
    ctx.font = `${this.tileSize * 0.6}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (const [key, type] of this.tiles.entries()) {
      const [gx, gy] = key.split(',').map(Number);
      const def = TILE_TYPES[type];
      if (!def || type === 'eraser') continue;
      
      const tx = gx * this.tileSize;
      const ty = gy * this.tileSize;
      
      // Shadow for tiles
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      
      // Tile background
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(tx + 2, ty + 2, this.tileSize - 4, this.tileSize - 4);
      
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      
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
