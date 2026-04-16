// ========================================
// History.js — Undo/Redo Stack
// ========================================

export class History {
  constructor(maxSize = 50) {
    this.states = [];
    this.currentIndex = -1;
    this.maxSize = maxSize;
  }

  push(state) {
    // Remove any future states (if we undid and then made a change)
    this.states = this.states.slice(0, this.currentIndex + 1);
    
    // Deep clone the state
    const cloned = JSON.parse(JSON.stringify(state));
    this.states.push(cloned);
    
    // Limit size
    if (this.states.length > this.maxSize) {
      this.states.shift();
    } else {
      this.currentIndex++;
    }
  }

  undo() {
    if (this.currentIndex <= 0) return null;
    this.currentIndex--;
    return JSON.parse(JSON.stringify(this.states[this.currentIndex]));
  }

  redo() {
    if (this.currentIndex >= this.states.length - 1) return null;
    this.currentIndex++;
    return JSON.parse(JSON.stringify(this.states[this.currentIndex]));
  }

  clear() {
    this.states = [];
    this.currentIndex = -1;
  }

  canUndo() {
    return this.currentIndex > 0;
  }

  canRedo() {
    return this.currentIndex < this.states.length - 1;
  }
}
