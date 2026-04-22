// ========================================
// Node.js — Node Data & Rendering
// ========================================

import { generateId } from '../utils/helpers.js';

// Node type definitions with defaults
export const NODE_TYPES = {
  story: {
    label: 'Story Beat',
    color: '#7c3aed',
    icon: '📖',
    category: 'Narrative',
    defaultPorts: {
      inputs: [{ name: 'Flow In', type: 'flow' }],
      outputs: [{ name: 'Flow Out', type: 'flow' }, { name: 'Trigger', type: 'event' }]
    },
    fields: ['title', 'description', 'tags']
  },
  character: {
    label: 'Character',
    color: '#3b82f6',
    icon: '👤',
    category: 'Narrative',
    defaultPorts: {
      inputs: [{ name: 'Relations', type: 'data' }],
      outputs: [{ name: 'Relations', type: 'data' }, { name: 'Events', type: 'event' }]
    },
    fields: ['title', 'description', 'traits', 'tags']
  },
  location: {
    label: 'Location',
    color: '#10b981',
    icon: '🏔️',
    category: 'World',
    defaultPorts: {
      inputs: [{ name: 'Link', type: 'data' }],
      outputs: [{ name: 'Link', type: 'data' }, { name: 'Characters', type: 'data' }]
    },
    fields: ['title', 'description', 'tags']
  },
  note: {
    label: 'Note',
    color: '#f59e0b',
    icon: '📝',
    category: 'Utility',
    defaultPorts: {
      inputs: [{ name: 'In', type: 'data' }],
      outputs: [{ name: 'Out', type: 'data' }]
    },
    fields: ['title', 'description']
  },
  quest: {
    label: 'Quest',
    color: '#f43f5e',
    icon: '⚔️',
    category: 'Game Design',
    defaultPorts: {
      inputs: [{ name: 'Trigger', type: 'event' }],
      outputs: [{ name: 'Complete', type: 'event' }, { name: 'Fail', type: 'event' }]
    },
    fields: ['title', 'description', 'objectives', 'tags']
  },
  dialogue: {
    label: 'Dialogue',
    color: '#06b6d4',
    icon: '💬',
    category: 'Narrative',
    defaultPorts: {
      inputs: [{ name: 'Flow In', type: 'flow' }],
      outputs: [{ name: 'Choice A', type: 'flow' }, { name: 'Choice B', type: 'flow' }, { name: 'Choice C', type: 'flow' }]
    },
    fields: ['title', 'description', 'speaker', 'tags']
  },
  item: {
    label: 'Item',
    color: '#8b5cf6',
    icon: '🎒',
    category: 'Game Design',
    defaultPorts: {
      inputs: [{ name: 'Source', type: 'data' }],
      outputs: [{ name: 'Use', type: 'event' }]
    },
    fields: ['title', 'description', 'tags']
  },
  event: {
    label: 'Event',
    color: '#f97316',
    icon: '⚡',
    category: 'Utility',
    defaultPorts: {
      inputs: [{ name: 'Trigger', type: 'event' }],
      outputs: [{ name: 'Action', type: 'event' }, { name: 'Data', type: 'data' }]
    },
    fields: ['title', 'description', 'tags']
  },
  generic: {
    label: 'Generic',
    color: '#64748b',
    icon: '🔲',
    category: 'Utility',
    defaultPorts: {
      inputs: [{ name: 'In', type: 'data' }],
      outputs: [{ name: 'Out', type: 'data' }]
    },
    fields: ['title', 'description', 'tags']
  },
  condition: {
    label: 'Condition',
    color: '#0ea5e9',
    icon: '⚖️',
    category: 'Logic / Flow',
    defaultPorts: {
      inputs: [{ name: 'Flow In', type: 'flow' }],
      outputs: [{ name: 'True', type: 'flow' }, { name: 'False', type: 'flow' }]
    },
    fields: ['title', 'condition', 'description', 'tags']
  },
  variable: {
    label: 'Variable',
    color: '#ec4899',
    icon: '🔢',
    category: 'Logic / Flow',
    defaultPorts: {
      inputs: [{ name: 'Flow In', type: 'flow' }],
      outputs: [{ name: 'Next', type: 'flow' }]
    },
    fields: ['title', 'variableName', 'operation', 'value', 'description', 'tags']
  },
  encounter: {
    label: 'Encounter',
    color: '#ef4444',
    icon: '⚔️',
    category: 'Game Design',
    defaultPorts: {
      inputs: [{ name: 'Flow In', type: 'flow' }],
      outputs: [{ name: 'Win', type: 'flow' }, { name: 'Lose', type: 'flow' }, { name: 'Loot', type: 'data' }]
    },
    fields: ['title', 'enemyType', 'difficulty', 'description', 'tags']
  },
  audio: {
    label: 'Audio',
    color: '#a855f7',
    icon: '🎵',
    category: 'Media',
    defaultPorts: {
      inputs: [{ name: 'Flow In', type: 'flow' }],
      outputs: [{ name: 'Next', type: 'flow' }]
    },
    fields: ['title', 'trackName', 'audioType', 'volume', 'description', 'tags']
  },
  cutscene: {
    label: 'Cutscene',
    color: '#f97316',
    icon: '🎬',
    category: 'Narrative',
    defaultPorts: {
      inputs: [{ name: 'Flow In', type: 'flow' }],
      outputs: [{ name: 'On Complete', type: 'flow' }]
    },
    fields: ['title', 'duration', 'cameraAngles', 'description', 'tags']
  },
  endState: {
    label: 'End State',
    color: '#000000',
    icon: '🏁',
    category: 'Flow',
    defaultPorts: {
      inputs: [{ name: 'Flow In', type: 'flow' }],
      outputs: []
    },
    fields: ['title', 'endType', 'description', 'tags']
  }
};

// Port type colors
export const PORT_COLORS = {
  flow: '#ffffff',
  data: '#00d4ff',
  event: '#f59e0b'
};

export class Node {
  constructor(type, x, y, options = {}) {
    this.id = options.id || generateId();
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = options.width || 220;
    this.height = 0; // Computed
    this.title = options.title || NODE_TYPES[type]?.label || 'Node';
    this.description = options.description || '';
    this.tags = options.tags || [];
    this.color = options.color || NODE_TYPES[type]?.color || '#64748b';
    this.collapsed = false;
    this.selected = false;
    this.traits = options.traits || '';
    this.objectives = options.objectives || '';
    this.speaker = options.speaker || '';
    
    // New fields
    this.condition = options.condition || '';
    this.variableName = options.variableName || '';
    this.operation = options.operation || '';
    this.value = options.value || '';
    this.enemyType = options.enemyType || '';
    this.difficulty = options.difficulty || '';
    this.trackName = options.trackName || '';
    this.audioType = options.audioType || '';
    this.volume = options.volume || '';
    this.duration = options.duration || '';
    this.cameraAngles = options.cameraAngles || '';
    this.endType = options.endType || '';
    
    // Ports
    const typeDef = NODE_TYPES[type];
    this.inputs = options.inputs || (typeDef?.defaultPorts.inputs.map((p, i) => ({
      name: p.name,
      type: p.type,
      index: i
    })) || []);
    
    this.outputs = options.outputs || (typeDef?.defaultPorts.outputs.map((p, i) => ({
      name: p.name,
      type: p.type,
      index: i
    })) || []);
    
    // Rendering constants
    this.headerHeight = 36;
    this.portRadius = 7;
    this.portSpacing = 28;
    this.bodyPadding = 12;
    this.computeHeight();
  }

  computeHeight() {
    if (this.collapsed) {
      this.height = this.headerHeight;
      return;
    }
    const maxPorts = Math.max(this.inputs.length, this.outputs.length);
    const portsHeight = maxPorts * this.portSpacing;
    const descHeight = this.description ? 30 : 0;
    this.height = this.headerHeight + this.bodyPadding + portsHeight + descHeight + this.bodyPadding;
  }

  getDescOffset() {
    return this.description ? 30 : 0;
  }

  getInputPortPosition(index) {
    const descOffset = this.getDescOffset();
    const y = this.y + this.headerHeight + this.bodyPadding + descOffset + index * this.portSpacing + this.portSpacing / 2;
    return { x: this.x, y };
  }

  getOutputPortPosition(index) {
    const descOffset = this.getDescOffset();
    const y = this.y + this.headerHeight + this.bodyPadding + descOffset + index * this.portSpacing + this.portSpacing / 2;
    return { x: this.x + this.width, y };
  }

  hitTest(mx, my) {
    return mx >= this.x && mx <= this.x + this.width &&
           my >= this.y && my <= this.y + this.height;
  }

  hitTestHeader(mx, my) {
    return mx >= this.x && mx <= this.x + this.width &&
           my >= this.y && my <= this.y + this.headerHeight;
  }

  hitTestPort(mx, my) {
    const threshold = 12;
    
    // Check input ports
    for (let i = 0; i < this.inputs.length; i++) {
      if (this.collapsed) continue;
      const pos = this.getInputPortPosition(i);
      const dx = mx - pos.x;
      const dy = my - pos.y;
      if (dx * dx + dy * dy < threshold * threshold) {
        return { type: 'input', index: i, port: this.inputs[i] };
      }
    }
    
    // Check output ports
    for (let i = 0; i < this.outputs.length; i++) {
      if (this.collapsed) continue;
      const pos = this.getOutputPortPosition(i);
      const dx = mx - pos.x;
      const dy = my - pos.y;
      if (dx * dx + dy * dy < threshold * threshold) {
        return { type: 'output', index: i, port: this.outputs[i] };
      }
    }
    
    return null;
  }

  draw(ctx, isHovered, scale) {
    this.computeHeight();
    
    const { x, y, width, height, headerHeight, color, title, collapsed } = this;
    
    // Node shadow
    ctx.save();
    ctx.shadowColor = this.selected ? color : 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = this.selected ? 16 : 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    // Node body
    ctx.fillStyle = 'rgba(22, 22, 40, 0.92)';
    ctx.beginPath();
    this.roundRect(ctx, x, y, width, height, 8);
    ctx.fill();
    ctx.restore();
    
    // Node border
    ctx.strokeStyle = this.selected 
      ? color
      : isHovered 
        ? 'rgba(255,255,255,0.15)' 
        : 'rgba(255,255,255,0.06)';
    ctx.lineWidth = this.selected ? 2 : 1;
    ctx.beginPath();
    this.roundRect(ctx, x, y, width, height, 8);
    ctx.stroke();
    
    // Header gradient
    const headerGrad = ctx.createLinearGradient(x, y, x + width, y);
    headerGrad.addColorStop(0, color);
    headerGrad.addColorStop(1, this.adjustColor(color, -30));
    
    ctx.fillStyle = headerGrad;
    ctx.beginPath();
    this.roundRectTop(ctx, x, y, width, headerHeight, 8);
    ctx.fill();
    
    // Header text
    const typeDef = NODE_TYPES[this.type];
    const icon = typeDef?.icon || '🔲';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${icon} ${title}`, x + 12, y + headerHeight / 2);
    
    // Collapse indicator
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Inter';
    ctx.fillText(collapsed ? '▶' : '▼', x + width - 18, y + headerHeight / 2);
    
    if (collapsed) return;
    
    // Description preview
    if (this.description) {
      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      const descText = this.description.length > 30 
        ? this.description.substring(0, 30) + '...' 
        : this.description;
      ctx.fillText(descText, x + 14, y + headerHeight + 16);
    }
    
    const descOffset = this.description ? 30 : 0;
    
    // Draw ports
    this.drawPorts(ctx, isHovered, descOffset);
  }

  drawPorts(ctx, isHovered, descOffset = 0) {
    const { x, y, width, headerHeight, bodyPadding, portSpacing, portRadius } = this;
    
    // Input ports
    this.inputs.forEach((port, i) => {
      const py = y + headerHeight + bodyPadding + descOffset + i * portSpacing + portSpacing / 2;
      const px = x;
      const portColor = PORT_COLORS[port.type] || PORT_COLORS.data;
      
      // Port circle
      ctx.beginPath();
      ctx.arc(px, py, portRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(22, 22, 40, 0.95)';
      ctx.fill();
      ctx.strokeStyle = portColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner dot
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = portColor;
      ctx.fill();
      
      // Port label
      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(port.name, px + portRadius + 6, py);
    });
    
    // Output ports
    this.outputs.forEach((port, i) => {
      const py = y + headerHeight + bodyPadding + descOffset + i * portSpacing + portSpacing / 2;
      const px = x + width;
      const portColor = PORT_COLORS[port.type] || PORT_COLORS.data;
      
      // Port circle
      ctx.beginPath();
      ctx.arc(px, py, portRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(22, 22, 40, 0.95)';
      ctx.fill();
      ctx.strokeStyle = portColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner dot
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = portColor;
      ctx.fill();
      
      // Port label
      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(port.name, px - portRadius - 6, py);
    });
    
    // Reset text align
    ctx.textAlign = 'left';
  }

  // Utility: rounded rect
  roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Rounded rect top only
  roundRectTop(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      title: this.title,
      description: this.description,
      tags: [...this.tags],
      color: this.color,
      collapsed: this.collapsed,
      traits: this.traits,
      objectives: this.objectives,
      speaker: this.speaker,
      condition: this.condition,
      variableName: this.variableName,
      operation: this.operation,
      value: this.value,
      enemyType: this.enemyType,
      difficulty: this.difficulty,
      trackName: this.trackName,
      audioType: this.audioType,
      volume: this.volume,
      duration: this.duration,
      cameraAngles: this.cameraAngles,
      endType: this.endType,
      inputs: this.inputs.map(p => ({ ...p })),
      outputs: this.outputs.map(p => ({ ...p }))
    };
  }

  static fromData(data) {
    const node = new Node(data.type, data.x, data.y, {
      id: data.id,
      width: data.width,
      title: data.title,
      description: data.description,
      tags: data.tags,
      color: data.color,
      traits: data.traits,
      objectives: data.objectives,
      speaker: data.speaker,
      condition: data.condition,
      variableName: data.variableName,
      operation: data.operation,
      value: data.value,
      enemyType: data.enemyType,
      difficulty: data.difficulty,
      trackName: data.trackName,
      audioType: data.audioType,
      volume: data.volume,
      duration: data.duration,
      cameraAngles: data.cameraAngles,
      endType: data.endType,
      inputs: data.inputs,
      outputs: data.outputs
    });
    node.collapsed = data.collapsed || false;
    return node;
  }
}
