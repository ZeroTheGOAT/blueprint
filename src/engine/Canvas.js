// ========================================
// Canvas.js — Main Canvas Renderer & Interaction Handler
// ========================================

import { Graph } from './Graph.js';
import { Node, NODE_TYPES, PORT_COLORS } from './Node.js';
import { History } from './History.js';
import { generateId } from '../utils/helpers.js';

export class BlueprintCanvas {
  constructor(canvasElement, minimapCanvas) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
    
    this.graph = new Graph();
    this.history = new History();
    
    // View state
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.minZoom = 0.1;
    this.maxZoom = 3;
    
    // Grid settings
    this.showGrid = true;
    this.gridSize = 20;
    this.snapToGrid = true;
    
    // Interaction state
    this.isDragging = false;
    this.isPanning = false;
    this.isConnecting = false;
    this.isSelecting = false;
    this.spaceHeld = false;
    
    // Drag state
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.dragNodes = [];
    
    // Connection state
    this.connectFromNode = null;
    this.connectFromPort = null;
    this.connectFromType = null;
    this.connectMouseX = 0;
    this.connectMouseY = 0;
    
    // Selection
    this.selectedNodes = new Set();
    this.hoveredNode = null;
    this.selectionRect = null;
    
    // Clipboard
    this.clipboard = null;
    
    // Minimap
    this.showMinimap = true;
    
    // Callbacks
    this.onSelectionChanged = null;
    this.onGraphChanged = null;
    this.onContextMenu = null;
    
    // Double-click tracking
    this.lastClickTime = 0;
    this.lastClickNodeId = null;
    
    // Animation
    this.animationFrame = null;
    this.connectionFlowOffset = 0;
    
    this.setupEventListeners();
    this.resize();
    this.startRenderLoop();
  }

  // ============================
  // Setup
  // ============================

  setupEventListeners() {
    // Pointer events (handles Mouse, Touch, and Stylus/Pen)
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    this.canvas.style.touchAction = 'none'; // Prevent browser gestures
    
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handleContextMenu(e);
    });
    
    // Pointer/Multi-touch state
    this.pointers = new Map(); // Track active pointers for multi-touch
    this.pointerState = {
      lastTapTime: 0,
      lastTapX: 0,
      lastTapY: 0,
      longPressTimer: null,
      isPinching: false,
      initialPinchDist: 0,
      initialPinchZoom: 1,
      initialPinchCenter: { x: 0, y: 0 },
      isDragging: false,
      isPanning: false,
      startedOnNode: false
    };
    
    // Keyboard
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    
    // Resize
    window.addEventListener('resize', () => this.resize());
  }

  // ============================
  // Touch Handlers
  // ============================

  onPointerDown(e) {
    this.pointers.set(e.pointerId, e);
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = this.screenToWorld(sx, sy);
    
    this.canvas.setPointerCapture(e.pointerId);

    // Multi-touch pinch start
    if (this.pointers.size === 2) {
      this.cancelLongPress();
      this.pointerState.isPinching = true;
      this.isDragging = false;
      this.isConnecting = false;
      
      const pts = Array.from(this.pointers.values());
      const dx = pts[1].clientX - pts[0].clientX;
      const dy = pts[1].clientY - pts[0].clientY;
      this.pointerState.initialPinchDist = Math.hypot(dx, dy);
      this.pointerState.initialPinchZoom = this.zoom;
      this.pointerState.initialPinchCenter = {
        x: (pts[0].clientX + pts[1].clientX) / 2 - rect.left,
        y: (pts[0].clientY + pts[1].clientY) / 2 - rect.top
      };
      this.pointerState.lastPinchCenter = { ...this.pointerState.initialPinchCenter };
      return;
    }

    if (this.pointers.size === 1) {
      // Middle mouse or Space + Left → Pan
      if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
        this.isPanning = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      // Check port hit
      const nodes = this.graph.getAllNodes();
      for (let i = nodes.length - 1; i >= 0; i--) {
        const portHit = nodes[i].hitTestPort(wx, wy);
        if (portHit) {
          this.startConnection(nodes[i], portHit);
          return;
        }
      }

      // Check node hit
      let hitNode = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].hitTest(wx, wy)) {
          hitNode = nodes[i];
          break;
        }
      }

      if (hitNode) {
        this.pointerState.startedOnNode = true;
        
        // Handle collapse arrow
        if (hitNode.hitTestHeader(wx, wy)) {
          const arrowX = hitNode.x + hitNode.width - 18;
          if (Math.abs(wx - arrowX) < 12 && Math.abs(wy - (hitNode.y + hitNode.headerHeight / 2)) < 12) {
            hitNode.collapsed = !hitNode.collapsed;
            hitNode.computeHeight();
            this.pushHistory();
            this.render();
            return;
          }
        }

        if (!e.shiftKey && !this.selectedNodes.has(hitNode.id)) {
          this.clearSelection();
        }
        this.selectNode(hitNode.id);
        
        this.isDragging = true;
        this.dragStartX = wx;
        this.dragStartY = wy;
        this.dragNodes = this.getSelectedNodes().map(n => ({
          node: n,
          startX: n.x,
          startY: n.y
        }));
        
        // Reorder
        this.graph.nodes.delete(hitNode.id);
        this.graph.nodes.set(hitNode.id, hitNode);
        
        // Long press for stylus/touch context menu
        if (e.pointerType !== 'mouse') {
          this.startLongPress(e.clientX, e.clientY, wx, wy, hitNode);
        }
      } else {
        // Empty canvas
        if (!e.shiftKey) this.clearSelection();
        
        // If left click, start selection rect
        if (e.button === 0) {
          this.isSelecting = true;
          this.selectionRect = { x: wx, y: wy, w: 0, h: 0 };
          this.dragStartX = wx;
          this.dragStartY = wy;
        }
        
        if (e.pointerType !== 'mouse') {
          this.startLongPress(e.clientX, e.clientY, wx, wy, null);
        }
      }
    }
  }

  onPointerMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, e);
    
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = this.screenToWorld(sx, sy);

    this.cancelLongPress();

    // Pinch zoom
    if (this.pointerState.isPinching && this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      const dx = pts[1].clientX - pts[0].clientX;
      const dy = pts[1].clientY - pts[0].clientY;
      const dist = Math.hypot(dx, dy);
      
      const center = {
        x: (pts[0].clientX + pts[1].clientX) / 2 - rect.left,
        y: (pts[0].clientY + pts[1].clientY) / 2 - rect.top
      };
      
      const scale = dist / this.pointerState.initialPinchDist;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.pointerState.initialPinchZoom * scale));
      
      const factor = newZoom / this.zoom;
      this.panX = center.x - (center.x - this.panX) * factor;
      this.panY = center.y - (center.y - this.panY) * factor;
      this.zoom = newZoom;
      
      this.panX += center.x - this.pointerState.lastPinchCenter.x;
      this.panY += center.y - this.pointerState.lastPinchCenter.y;
      this.pointerState.lastPinchCenter = center;
      
      this.updateZoomDisplay();
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

    if (this.isDragging) {
      const dx = wx - this.dragStartX;
      const dy = wy - this.dragStartY;
      this.dragNodes.forEach(({ node, startX, startY }) => {
        let nx = startX + dx;
        let ny = startY + dy;
        if (this.snapToGrid) {
          nx = Math.round(nx / this.gridSize) * this.gridSize;
          ny = Math.round(ny / this.gridSize) * this.gridSize;
        }
        node.x = nx;
        node.y = ny;
      });
      this.notifyGraphChanged();
      this.render();
      return;
    }

    if (this.isConnecting) {
      this.connectMouseX = wx;
      this.connectMouseY = wy;
      this.render();
      return;
    }

    if (this.isSelecting && this.selectionRect) {
      this.selectionRect.w = wx - this.dragStartX;
      this.selectionRect.h = wy - this.dragStartY;
      this.render();
      return;
    }

    // Default hover
    let hoveredNode = null;
    const nodes = this.graph.getAllNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].hitTest(wx, wy)) {
        hoveredNode = nodes[i];
        break;
      }
    }
    
    if (this.hoveredNode !== hoveredNode) {
      this.hoveredNode = hoveredNode;
      this.render();
    }
  }

  onPointerUp(e) {
    this.pointers.delete(e.pointerId);
    this.canvas.releasePointerCapture(e.pointerId);
    this.cancelLongPress();

    if (this.pointerState.isPinching) {
      if (this.pointers.size === 0) this.pointerState.isPinching = false;
      return;
    }

    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.spaceHeld ? 'grab' : 'default';
      return;
    }

    if (this.isDragging) {
      this.isDragging = false;
      this.pushHistory();
      this.notifySelectionChanged();
      this.render();
      return;
    }

    if (this.isConnecting) {
      const rect = this.canvas.getBoundingClientRect();
      const { x: wx, y: wy } = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      this.finishConnection(wx, wy);
      return;
    }

    if (this.isSelecting && this.selectionRect) {
      this.finishSelection();
      return;
    }

    // Tap logic (for non-drag clicks)
    if (this.pointerState.startedOnNode && !this.isDragging) {
      this.notifySelectionChanged();
      this.render();
    }
    this.pointerState.startedOnNode = false;
  }

  startLongPress(clientX, clientY, wx, wy, node) {
    this.cancelLongPress();
    this.pointerState.longPressTimer = setTimeout(() => {
      // Vibrate on supported devices
      if (navigator.vibrate) navigator.vibrate(30);
      
      if (this.onContextMenu) {
        this.onContextMenu({
          screenX: clientX,
          screenY: clientY,
          worldX: wx,
          worldY: wy,
          node: node,
          connection: node ? null : this.findConnectionAt(wx, wy)
        });
      }
      
      // Prevent subsequent drag
      this.pointerState.startedOnNode = false;
    }, 600);
  }

  cancelLongPress() {
    if (this.pointerState.longPressTimer) {
      clearTimeout(this.pointerState.longPressTimer);
      this.pointerState.longPressTimer = null;
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

  // ============================
  // Coordinate Transform
  // ============================

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom
    };
  }

  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this.panX,
      y: wy * this.zoom + this.panY
    };
  }

  // Legacy mouse handlers removed - replaced by pointer handlers above.


  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * (1 + delta)));
    
    // Zoom towards cursor
    const factor = newZoom / this.zoom;
    this.panX = sx - (sx - this.panX) * factor;
    this.panY = sy - (sy - this.panY) * factor;
    this.zoom = newZoom;
    
    this.updateZoomDisplay();
    this.render();
  }

  onDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = this.screenToWorld(sx, sy);
    
    const nodes = this.graph.getAllNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].hitTestHeader(wx, wy)) {
        this.editNodeTitle(nodes[i]);
        return;
      }
    }
  }

  handleContextMenu(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = this.screenToWorld(sx, sy);
    
    if (this.onContextMenu) {
      // Check if right-click on a node
      let hitNode = null;
      const nodes = this.graph.getAllNodes();
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].hitTest(wx, wy)) {
          hitNode = nodes[i];
          break;
        }
      }
      
      // Check if right-click on a connection
      let hitConn = null;
      if (!hitNode) {
        hitConn = this.findConnectionAt(wx, wy);
      }
      
      this.onContextMenu({
        screenX: e.clientX,
        screenY: e.clientY,
        worldX: wx,
        worldY: wy,
        node: hitNode,
        connection: hitConn
      });
    }
  }

  // ============================
  // Keyboard
  // ============================

  onKeyDown(e) {
    if (e.code === 'Space') {
      this.spaceHeld = true;
      this.canvas.style.cursor = 'grab';
    }
    
    // Ignore shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          e.preventDefault();
          this.undo();
          break;
        case 'y':
          e.preventDefault();
          this.redo();
          break;
        case 'c':
          e.preventDefault();
          this.copySelected();
          break;
        case 'v':
          e.preventDefault();
          this.paste();
          break;
        case 'x':
          e.preventDefault();
          this.cutSelected();
          break;
        case 'a':
          e.preventDefault();
          this.selectAll();
          break;
        case 'd':
          e.preventDefault();
          this.duplicateSelected();
          break;
      }
    } else {
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          this.deleteSelected();
          break;
        case 'f':
        case 'F':
          this.fitAll();
          break;
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

  // ============================
  // Connection handling
  // ============================

  startConnection(node, portHit) {
    this.isConnecting = true;
    this.connectFromNode = node;
    this.connectFromPort = portHit;
    this.connectFromType = portHit.type;
    
    const pos = portHit.type === 'output'
      ? node.getOutputPortPosition(portHit.index)
      : node.getInputPortPosition(portHit.index);
    this.connectMouseX = pos.x;
    this.connectMouseY = pos.y;
    this.canvas.style.cursor = 'crosshair';
  }

  finishConnection(wx, wy) {
    this.isConnecting = false;
    this.canvas.style.cursor = 'default';
    
    // Find target port
    const nodes = this.graph.getAllNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.id === this.connectFromNode.id) continue;
      
      const portHit = node.hitTestPort(wx, wy);
      if (portHit && portHit.type !== this.connectFromType) {
        // Valid connection
        let fromNode, fromPort, toNode, toPort;
        if (this.connectFromType === 'output') {
          fromNode = this.connectFromNode;
          fromPort = this.connectFromPort.index;
          toNode = node;
          toPort = portHit.index;
        } else {
          fromNode = node;
          fromPort = portHit.index;
          toNode = this.connectFromNode;
          toPort = this.connectFromPort.index;
        }
        
        const conn = this.graph.addConnection({
          id: generateId(),
          fromNodeId: fromNode.id,
          fromPortIndex: fromPort,
          toNodeId: toNode.id,
          toPortIndex: toPort
        });
        
        if (conn) {
          this.pushHistory();
          this.notifyGraphChanged();
        }
        break;
      }
    }
    
    this.connectFromNode = null;
    this.connectFromPort = null;
    this.render();
  }

  findConnectionAt(wx, wy) {
    const threshold = 8;
    const connections = this.graph.getAllConnections();
    
    for (const conn of connections) {
      const fromNode = this.graph.getNode(conn.fromNodeId);
      const toNode = this.graph.getNode(conn.toNodeId);
      if (!fromNode || !toNode) continue;
      
      const from = fromNode.getOutputPortPosition(conn.fromPortIndex);
      const to = toNode.getInputPortPosition(conn.toPortIndex);
      
      // Sample bezier curve and check distance
      for (let t = 0; t <= 1; t += 0.05) {
        const cp1x = from.x + (to.x - from.x) * 0.5;
        const cp2x = cp1x;
        const cp1y = from.y;
        const cp2y = to.y;
        
        const px = Math.pow(1-t,3) * from.x + 3*Math.pow(1-t,2)*t * cp1x + 
                   3*(1-t)*t*t * cp2x + t*t*t * to.x;
        const py = Math.pow(1-t,3) * from.y + 3*Math.pow(1-t,2)*t * cp1y + 
                   3*(1-t)*t*t * cp2y + t*t*t * to.y;
        
        const dx = wx - px;
        const dy = wy - py;
        if (Math.sqrt(dx*dx + dy*dy) < threshold) {
          return conn;
        }
      }
    }
    return null;
  }

  // ============================
  // Selection
  // ============================

  selectNode(nodeId) {
    this.selectedNodes.add(nodeId);
    const node = this.graph.getNode(nodeId);
    if (node) node.selected = true;
    this.notifySelectionChanged();
    this.render();
  }

  deselectNode(nodeId) {
    this.selectedNodes.delete(nodeId);
    const node = this.graph.getNode(nodeId);
    if (node) node.selected = false;
    this.notifySelectionChanged();
    this.render();
  }

  clearSelection() {
    this.selectedNodes.forEach(id => {
      const node = this.graph.getNode(id);
      if (node) node.selected = false;
    });
    this.selectedNodes.clear();
    this.notifySelectionChanged();
  }

  selectAll() {
    this.graph.getAllNodes().forEach(node => {
      node.selected = true;
      this.selectedNodes.add(node.id);
    });
    this.notifySelectionChanged();
    this.render();
  }

  getSelectedNodes() {
    return Array.from(this.selectedNodes)
      .map(id => this.graph.getNode(id))
      .filter(Boolean);
  }

  finishSelection() {
    this.isSelecting = false;
    if (!this.selectionRect) return;
    
    const { x, y, w, h } = this.selectionRect;
    const rx = w < 0 ? x + w : x;
    const ry = h < 0 ? y + h : y;
    const rw = Math.abs(w);
    const rh = Math.abs(h);
    
    this.graph.getAllNodes().forEach(node => {
      if (node.x + node.width > rx && node.x < rx + rw &&
          node.y + node.height > ry && node.y < ry + rh) {
        this.selectedNodes.add(node.id);
        node.selected = true;
      }
    });
    
    this.selectionRect = null;
    this.notifySelectionChanged();
    this.render();
  }

  // ============================
  // Node Operations
  // ============================

  addNode(type, x, y, options = {}) {
    const node = new Node(type, x || 0, y || 0, options);
    this.graph.addNode(node);
    this.pushHistory();
    this.notifyGraphChanged();
    this.render();
    return node;
  }

  addNodeAtCenter(type) {
    const cx = (this.canvasWidth / 2 - this.panX) / this.zoom;
    const cy = (this.canvasHeight / 2 - this.panY) / this.zoom;
    if (this.snapToGrid) {
      return this.addNode(type, 
        Math.round(cx / this.gridSize) * this.gridSize,
        Math.round(cy / this.gridSize) * this.gridSize
      );
    }
    return this.addNode(type, cx, cy);
  }

  deleteSelected() {
    if (this.selectedNodes.size === 0) return;
    this.selectedNodes.forEach(id => {
      this.graph.removeNode(id);
    });
    this.selectedNodes.clear();
    this.pushHistory();
    this.notifySelectionChanged();
    this.notifyGraphChanged();
    this.render();
  }

  deleteConnection(connId) {
    this.graph.removeConnection(connId);
    this.pushHistory();
    this.notifyGraphChanged();
    this.render();
  }

  duplicateSelected() {
    const nodes = this.getSelectedNodes();
    if (nodes.length === 0) return;
    
    this.clearSelection();
    const offset = 40;
    
    const idMap = new Map();
    nodes.forEach(node => {
      const data = node.serialize();
      const newId = generateId();
      idMap.set(data.id, newId);
      const newNode = Node.fromData({
        ...data,
        id: newId,
        x: data.x + offset,
        y: data.y + offset
      });
      this.graph.addNode(newNode);
      this.selectedNodes.add(newId);
      newNode.selected = true;
    });
    
    // Duplicate connections between selected nodes
    const connections = this.graph.getAllConnections();
    connections.forEach(conn => {
      if (idMap.has(conn.fromNodeId) && idMap.has(conn.toNodeId)) {
        this.graph.addConnection({
          id: generateId(),
          fromNodeId: idMap.get(conn.fromNodeId),
          fromPortIndex: conn.fromPortIndex,
          toNodeId: idMap.get(conn.toNodeId),
          toPortIndex: conn.toPortIndex
        });
      }
    });
    
    this.pushHistory();
    this.notifySelectionChanged();
    this.notifyGraphChanged();
    this.render();
  }

  copySelected() {
    const nodes = this.getSelectedNodes();
    if (nodes.length === 0) return;
    
    const nodeIds = new Set(nodes.map(n => n.id));
    const connections = this.graph.getAllConnections().filter(
      c => nodeIds.has(c.fromNodeId) && nodeIds.has(c.toNodeId)
    );
    
    this.clipboard = {
      nodes: nodes.map(n => n.serialize()),
      connections: connections.map(c => ({ ...c }))
    };
  }

  cutSelected() {
    this.copySelected();
    this.deleteSelected();
  }

  paste() {
    if (!this.clipboard) return;
    
    this.clearSelection();
    const offset = 60;
    const idMap = new Map();
    
    this.clipboard.nodes.forEach(data => {
      const newId = generateId();
      idMap.set(data.id, newId);
      const node = Node.fromData({
        ...data,
        id: newId,
        x: data.x + offset,
        y: data.y + offset
      });
      this.graph.addNode(node);
      this.selectedNodes.add(newId);
      node.selected = true;
    });
    
    this.clipboard.connections.forEach(conn => {
      if (idMap.has(conn.fromNodeId) && idMap.has(conn.toNodeId)) {
        this.graph.addConnection({
          id: generateId(),
          fromNodeId: idMap.get(conn.fromNodeId),
          fromPortIndex: conn.fromPortIndex,
          toNodeId: idMap.get(conn.toNodeId),
          toPortIndex: conn.toPortIndex
        });
      }
    });
    
    this.pushHistory();
    this.notifySelectionChanged();
    this.notifyGraphChanged();
    this.render();
  }

  editNodeTitle(node) {
    const pos = this.worldToScreen(node.x, node.y);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = node.title;
    input.style.cssText = `
      position: fixed;
      left: ${pos.x + 12 * this.zoom}px;
      top: ${pos.y + 4 * this.zoom}px;
      width: ${(node.width - 30) * this.zoom}px;
      height: ${28 * this.zoom}px;
      font-size: ${13 * this.zoom}px;
      font-family: Inter, sans-serif;
      font-weight: 500;
      background: rgba(0,0,0,0.8);
      color: #fff;
      border: 1px solid #7c3aed;
      border-radius: 4px;
      padding: 2px 8px;
      outline: none;
      z-index: 1000;
    `;
    
    const finish = () => {
      node.title = input.value || node.title;
      input.remove();
      this.pushHistory();
      this.notifySelectionChanged();
      this.render();
    };
    
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish();
      if (e.key === 'Escape') { input.remove(); }
    });
    
    document.body.appendChild(input);
    input.focus();
    input.select();
  }

  // ============================
  // View Controls
  // ============================

  setZoom(newZoom) {
    const cx = this.canvasWidth / 2;
    const cy = this.canvasHeight / 2;
    const factor = newZoom / this.zoom;
    this.panX = cx - (cx - this.panX) * factor;
    this.panY = cy - (cy - this.panY) * factor;
    this.zoom = newZoom;
    this.updateZoomDisplay();
    this.render();
  }

  zoomIn() {
    this.setZoom(Math.min(this.maxZoom, this.zoom * 1.2));
  }

  zoomOut() {
    this.setZoom(Math.max(this.minZoom, this.zoom / 1.2));
  }

  resetZoom() {
    this.setZoom(1);
    this.panX = this.canvasWidth / 2;
    this.panY = this.canvasHeight / 2;
    this.render();
  }

  fitAll() {
    const bounds = this.graph.getBounds();
    if (bounds.width === 0 && bounds.height === 0) {
      this.resetZoom();
      return;
    }
    
    const padding = 80;
    const scaleX = (this.canvasWidth - padding * 2) / bounds.width;
    const scaleY = (this.canvasHeight - padding * 2) / bounds.height;
    const newZoom = Math.min(scaleX, scaleY, 1.5);
    
    this.zoom = newZoom;
    this.panX = this.canvasWidth / 2 - (bounds.x + bounds.width / 2) * newZoom;
    this.panY = this.canvasHeight / 2 - (bounds.y + bounds.height / 2) * newZoom;
    
    this.updateZoomDisplay();
    this.render();
  }

  updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = Math.round(this.zoom * 100) + '%';
  }

  // ============================
  // History
  // ============================

  pushHistory() {
    this.history.push(this.graph.serialize());
  }

  undo() {
    const state = this.history.undo();
    if (state) {
      this.loadState(state);
    }
  }

  redo() {
    const state = this.history.redo();
    if (state) {
      this.loadState(state);
    }
  }

  loadState(state) {
    this.graph.clear();
    this.selectedNodes.clear();
    
    if (state.nodes) {
      state.nodes.forEach(data => {
        const node = Node.fromData(data);
        this.graph.nodes.set(node.id, node);
      });
    }
    if (state.connections) {
      state.connections.forEach(conn => {
        this.graph.connections.set(conn.id, { ...conn });
      });
    }
    
    this.notifySelectionChanged();
    this.notifyGraphChanged();
    this.render();
  }

  // ============================
  // Serialization
  // ============================

  getProjectData() {
    return this.graph.serialize();
  }

  loadProjectData(data) {
    this.graph.clear();
    this.selectedNodes.clear();
    
    if (data.nodes) {
      data.nodes.forEach(nodeData => {
        const node = Node.fromData(nodeData);
        this.graph.nodes.set(node.id, node);
      });
    }
    if (data.connections) {
      data.connections.forEach(conn => {
        this.graph.connections.set(conn.id, { ...conn });
      });
    }
    
    this.history.clear();
    this.pushHistory();
    this.notifyGraphChanged();
    this.fitAll();
  }

  clearAll() {
    this.graph.clear();
    this.selectedNodes.clear();
    this.history.clear();
    this.panX = this.canvasWidth / 2;
    this.panY = this.canvasHeight / 2;
    this.zoom = 1;
    this.updateZoomDisplay();
    this.notifySelectionChanged();
    this.notifyGraphChanged();
    this.render();
  }

  // ============================
  // Notifications
  // ============================

  notifySelectionChanged() {
    if (this.onSelectionChanged) {
      this.onSelectionChanged(this.getSelectedNodes());
    }
  }

  notifyGraphChanged() {
    const nc = document.getElementById('node-count');
    const cc = document.getElementById('connection-count');
    if (nc) nc.textContent = `${this.graph.getNodeCount()} nodes`;
    if (cc) cc.textContent = `${this.graph.getConnectionCount()} connections`;
    if (this.onGraphChanged) this.onGraphChanged();
  }

  // ============================
  // Rendering
  // ============================

  startRenderLoop() {
    const loop = () => {
      this.connectionFlowOffset += 0.5;
      if (this.connectionFlowOffset > 1000) this.connectionFlowOffset = 0;
      this.render();
      this.animationFrame = requestAnimationFrame(loop);
    };
    // Use one-shot renders instead of loop for performance
    // We'll call render() manually when state changes
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    
    // Clear
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Grid
    if (this.showGrid) {
      this.drawGrid(ctx);
    }
    
    // Apply zoom & pan transform
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);
    
    // Draw connections
    this.drawConnections(ctx);
    
    // Draw active connection (being dragged)
    if (this.isConnecting && this.connectFromNode) {
      this.drawActiveConnection(ctx);
    }
    
    // Draw selection rect
    if (this.isSelecting && this.selectionRect) {
      this.drawSelectionRect(ctx);
    }
    
    // Draw nodes
    const nodes = this.graph.getAllNodes();
    nodes.forEach(node => {
      const isHovered = this.hoveredNode === node;
      node.draw(ctx, isHovered, this.zoom);
    });
    
    ctx.restore();
    ctx.restore();
    
    // Draw minimap
    if (this.showMinimap) {
      this.drawMinimap();
    }
  }

  drawGrid(ctx) {
    const gridSize = this.gridSize * this.zoom;
    const majorGridSize = gridSize * 5;
    
    const startX = this.panX % gridSize;
    const startY = this.panY % gridSize;
    const majorStartX = this.panX % majorGridSize;
    const majorStartY = this.panY % majorGridSize;
    
    // Minor grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x < this.canvasWidth; x += gridSize) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, this.canvasHeight);
    }
    for (let y = startY; y < this.canvasHeight; y += gridSize) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(this.canvasWidth, Math.round(y) + 0.5);
    }
    ctx.stroke();
    
    // Major grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = majorStartX; x < this.canvasWidth; x += majorGridSize) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, this.canvasHeight);
    }
    for (let y = majorStartY; y < this.canvasHeight; y += majorGridSize) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(this.canvasWidth, Math.round(y) + 0.5);
    }
    ctx.stroke();
  }

  drawConnections(ctx) {
    const connections = this.graph.getAllConnections();
    
    connections.forEach(conn => {
      const fromNode = this.graph.getNode(conn.fromNodeId);
      const toNode = this.graph.getNode(conn.toNodeId);
      if (!fromNode || !toNode) return;
      
      const from = fromNode.getOutputPortPosition(conn.fromPortIndex);
      const to = toNode.getInputPortPosition(conn.toPortIndex);
      
      // Determine wire color from port type
      const port = fromNode.outputs[conn.fromPortIndex];
      const color = PORT_COLORS[port?.type] || PORT_COLORS.data;
      
      this.drawBezier(ctx, from, to, color, false);
      
      // Draw connection label if present
      if (conn.label) {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        
        ctx.save();
        ctx.font = '11px Inter, sans-serif';
        const textWidth = ctx.measureText(conn.label).width;
        
        // Label background pill
        ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
        const px = 8, py = 4;
        ctx.beginPath();
        const lx = midX - textWidth / 2 - px;
        const ly = midY - 8 - py;
        const lw = textWidth + px * 2;
        const lh = 16 + py * 2;
        ctx.moveTo(lx + 6, ly);
        ctx.lineTo(lx + lw - 6, ly);
        ctx.quadraticCurveTo(lx + lw, ly, lx + lw, ly + 6);
        ctx.lineTo(lx + lw, ly + lh - 6);
        ctx.quadraticCurveTo(lx + lw, ly + lh, lx + lw - 6, ly + lh);
        ctx.lineTo(lx + 6, ly + lh);
        ctx.quadraticCurveTo(lx, ly + lh, lx, ly + lh - 6);
        ctx.lineTo(lx, ly + 6);
        ctx.quadraticCurveTo(lx, ly, lx + 6, ly);
        ctx.closePath();
        ctx.fill();
        
        // Label border
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        // Label text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(conn.label, midX, midY);
        ctx.textAlign = 'left';
        ctx.restore();
      }
    });
  }

  drawActiveConnection(ctx) {
    const portType = this.connectFromPort.type;
    let from, to;
    
    if (portType === 'output') {
      from = this.connectFromNode.getOutputPortPosition(this.connectFromPort.index);
      to = { x: this.connectMouseX, y: this.connectMouseY };
    } else {
      from = { x: this.connectMouseX, y: this.connectMouseY };
      to = this.connectFromNode.getInputPortPosition(this.connectFromPort.index);
    }
    
    const portDef = this.connectFromNode[portType === 'output' ? 'outputs' : 'inputs'][this.connectFromPort.index];
    const color = PORT_COLORS[portDef?.type] || PORT_COLORS.data;
    
    this.drawBezier(ctx, from, to, color, true);
  }

  drawBezier(ctx, from, to, color, isDashed) {
    const dx = Math.abs(to.x - from.x);
    const cpOffset = Math.max(dx * 0.5, 50);
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(
      from.x + cpOffset, from.y,
      to.x - cpOffset, to.y,
      to.x, to.y
    );
    
    if (isDashed) {
      ctx.setLineDash([6, 4]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = isDashed ? 0.6 : 0.8;
    ctx.stroke();
    
    // Glow
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.1;
    ctx.stroke();
    
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  drawSelectionRect(ctx) {
    const { x, y, w, h } = this.selectionRect;
    
    ctx.fillStyle = 'rgba(124, 58, 237, 0.08)';
    ctx.fillRect(x, y, w, h);
    
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  drawMinimap() {
    if (!this.minimapCtx) return;
    
    const mw = 200;
    const mh = 140;
    const dpr = window.devicePixelRatio || 1;
    
    this.minimapCanvas.width = mw * dpr;
    this.minimapCanvas.height = mh * dpr;
    
    const mctx = this.minimapCtx;
    mctx.save();
    mctx.scale(dpr, dpr);
    
    // Background
    mctx.fillStyle = 'rgba(13, 13, 26, 0.9)';
    mctx.fillRect(0, 0, mw, mh);
    
    const bounds = this.graph.getBounds();
    if (bounds.width === 0) {
      mctx.restore();
      return;
    }
    
    const padding = 20;
    const scaleX = (mw - padding * 2) / bounds.width;
    const scaleY = (mh - padding * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 0.5);
    
    const offsetX = (mw - bounds.width * scale) / 2 - bounds.x * scale;
    const offsetY = (mh - bounds.height * scale) / 2 - bounds.y * scale;
    
    // Draw nodes as colored rectangles
    mctx.save();
    mctx.translate(offsetX, offsetY);
    mctx.scale(scale, scale);
    
    this.graph.getAllNodes().forEach(node => {
      mctx.fillStyle = node.color;
      mctx.globalAlpha = 0.6;
      mctx.fillRect(node.x, node.y, node.width, node.height);
    });
    
    mctx.globalAlpha = 1;
    mctx.restore();
    
    // Draw viewport rectangle
    const vpX = (-this.panX / this.zoom) * scale + offsetX;
    const vpY = (-this.panY / this.zoom) * scale + offsetY;
    const vpW = (this.canvasWidth / this.zoom) * scale;
    const vpH = (this.canvasHeight / this.zoom) * scale;
    
    mctx.strokeStyle = 'rgba(124, 58, 237, 0.6)';
    mctx.lineWidth = 1;
    mctx.strokeRect(vpX, vpY, vpW, vpH);
    
    mctx.restore();
  }

  // ============================
  // Export
  // ============================

  exportAsPNG() {
    const bounds = this.graph.getBounds();
    const padding = 40;
    
    const exportCanvas = document.createElement('canvas');
    const w = Math.max(bounds.width + padding * 2, 400);
    const h = Math.max(bounds.height + padding * 2, 300);
    exportCanvas.width = w * 2;
    exportCanvas.height = h * 2;
    
    const ectx = exportCanvas.getContext('2d');
    ectx.scale(2, 2);
    
    // Background
    ectx.fillStyle = '#0d0d1a';
    ectx.fillRect(0, 0, w, h);
    
    // Grid
    const gridSize = 20;
    ectx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ectx.lineWidth = 1;
    for (let x = 0; x < w; x += gridSize) {
      ectx.beginPath();
      ectx.moveTo(x, 0);
      ectx.lineTo(x, h);
      ectx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ectx.beginPath();
      ectx.moveTo(0, y);
      ectx.lineTo(w, y);
      ectx.stroke();
    }
    
    ectx.save();
    ectx.translate(padding - bounds.x, padding - bounds.y);
    
    // Draw connections
    const connections = this.graph.getAllConnections();
    connections.forEach(conn => {
      const fromNode = this.graph.getNode(conn.fromNodeId);
      const toNode = this.graph.getNode(conn.toNodeId);
      if (!fromNode || !toNode) return;
      const from = fromNode.getOutputPortPosition(conn.fromPortIndex);
      const to = toNode.getInputPortPosition(conn.toPortIndex);
      const port = fromNode.outputs[conn.fromPortIndex];
      const color = PORT_COLORS[port?.type] || PORT_COLORS.data;
      this.drawBezier(ectx, from, to, color, false);
    });
    
    // Draw nodes
    this.graph.getAllNodes().forEach(node => {
      node.draw(ectx, false, 1);
    });
    
    ectx.restore();
    
    // Download
    const link = document.createElement('a');
    link.download = 'blueprint.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }
}
