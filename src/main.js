// ========================================
// main.js — Blueprint Studio Application
// ========================================

import './styles/index.css';
import './styles/mobile.css';
import { BlueprintCanvas } from './engine/Canvas.js';
import { NODE_TYPES, PORT_COLORS } from './engine/Node.js';
import {
  onAuthChanged,
  getCurrentUser,
  signInWithGoogle,
  setupRecaptcha,
  sendOTP,
  verifyOTP,
  logOut,
  saveProject,
  loadProject,
  listProjects,
  deleteProject
} from './firebase.js';
import { generateId, showToast, formatDate, debounce, downloadJSON, readFileAsJSON } from './utils/helpers.js';

// ============================
// App State
// ============================

let canvas = null;
let currentUser = null;
let currentProjectId = null;
let autoSaveTimer = null;
let isDirty = false;

// ============================
// Auth UI
// ============================

function initAuth() {
  const authScreen = document.getElementById('auth-screen');
  const appEl = document.getElementById('app');
  
  // Google Sign-in
  document.getElementById('google-signin-btn').addEventListener('click', async () => {
    showAuthLoading(true);
    hideAuthError();
    const { user, error } = await signInWithGoogle();
    showAuthLoading(false);
    if (error) {
      showAuthError(error);
    }
  });
  
  // Phone Sign-in toggle
  document.getElementById('phone-toggle-btn').addEventListener('click', () => {
    document.getElementById('auth-methods').classList.add('hidden');
    document.getElementById('phone-input-section').classList.remove('hidden');
    setupRecaptcha('recaptcha-container');
  });
  
  document.getElementById('phone-back-btn').addEventListener('click', () => {
    document.getElementById('phone-input-section').classList.add('hidden');
    document.getElementById('auth-methods').classList.remove('hidden');
  });
  
  // Send OTP
  document.getElementById('send-otp-btn').addEventListener('click', async () => {
    const phoneInput = document.getElementById('phone-number');
    const phone = phoneInput.value.trim();
    if (!phone || phone.length < 10) {
      showAuthError('Please enter a valid phone number');
      return;
    }
    
    showAuthLoading(true);
    hideAuthError();
    const fullNumber = '+91' + phone;
    const { success, error } = await sendOTP(fullNumber);
    showAuthLoading(false);
    
    if (success) {
      document.getElementById('phone-input-section').classList.add('hidden');
      document.getElementById('otp-section').classList.remove('hidden');
      document.querySelector('.otp-digit').focus();
    } else {
      showAuthError(error || 'Failed to send OTP');
    }
  });
  
  document.getElementById('otp-back-btn').addEventListener('click', () => {
    document.getElementById('otp-section').classList.add('hidden');
    document.getElementById('phone-input-section').classList.remove('hidden');
  });
  
  // OTP digit inputs
  const otpDigits = document.querySelectorAll('.otp-digit');
  otpDigits.forEach((input, i) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val && i < 5) {
        otpDigits[i + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && i > 0) {
        otpDigits[i - 1].focus();
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (text.length === 6 && /^\d+$/.test(text)) {
        text.split('').forEach((char, j) => {
          if (otpDigits[j]) otpDigits[j].value = char;
        });
        otpDigits[5].focus();
      }
    });
  });
  
  // Verify OTP
  document.getElementById('verify-otp-btn').addEventListener('click', async () => {
    const otp = Array.from(otpDigits).map(d => d.value).join('');
    if (otp.length !== 6) {
      showAuthError('Please enter the complete 6-digit OTP');
      return;
    }
    
    showAuthLoading(true);
    hideAuthError();
    const { user, error } = await verifyOTP(otp);
    showAuthLoading(false);
    
    if (error) {
      showAuthError(error);
    }
  });
  
  // Auth state observer
  onAuthChanged((user) => {
    if (user) {
      currentUser = user;
      authScreen.classList.add('hidden');
      appEl.classList.remove('hidden');
      initApp();
    } else {
      currentUser = null;
      authScreen.classList.remove('hidden');
      appEl.classList.add('hidden');
      // Reset auth UI
      document.getElementById('auth-methods').classList.remove('hidden');
      document.getElementById('phone-input-section').classList.add('hidden');
      document.getElementById('otp-section').classList.add('hidden');
    }
  });
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideAuthError() {
  document.getElementById('auth-error').classList.add('hidden');
}

function showAuthLoading(show) {
  const el = document.getElementById('auth-loading');
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

// ============================
// Main App Init
// ============================

function initApp() {
  updateUserUI();
  initCanvas();
  initToolbar();
  initSidebar();
  initProperties();
  initContextMenu();
  initSearch();
  initProjectModal();
  initKeyboardShortcuts();
  initMobile();
  startAutoSave();
  
  // Load last project or create new
  loadLastProject();
}

function updateUserUI() {
  if (!currentUser) return;
  
  const nameEl = document.getElementById('user-name');
  const emailEl = document.getElementById('user-email');
  const initialEl = document.getElementById('user-initial');
  const photoEl = document.getElementById('user-photo');
  
  nameEl.textContent = currentUser.displayName || 'User';
  emailEl.textContent = currentUser.email || currentUser.phoneNumber || '';
  
  if (currentUser.photoURL) {
    photoEl.src = currentUser.photoURL;
    photoEl.classList.remove('hidden');
    initialEl.classList.add('hidden');
  } else {
    const name = currentUser.displayName || currentUser.email || currentUser.phoneNumber || '?';
    initialEl.textContent = name[0].toUpperCase();
    photoEl.classList.add('hidden');
    initialEl.classList.remove('hidden');
  }
}

// ============================
// Canvas
// ============================

function initCanvas() {
  const canvasEl = document.getElementById('blueprint-canvas');
  const minimapEl = document.getElementById('minimap-canvas');
  
  canvas = new BlueprintCanvas(canvasEl, minimapEl);
  
  canvas.onSelectionChanged = (selectedNodes) => {
    updateProperties(selectedNodes);
  };
  
  canvas.onGraphChanged = () => {
    markDirty();
  };
  
  canvas.onContextMenu = (info) => {
    showContextMenu(info);
  };
}

// ============================
// Toolbar
// ============================

function initToolbar() {
  // Menu toggles
  document.querySelectorAll('.toolbar-menu').forEach(menu => {
    const span = menu.querySelector('span');
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other menus
      document.querySelectorAll('.toolbar-menu.open').forEach(m => {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open');
    });
  });
  
  // User menu
  document.getElementById('user-avatar').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('user-menu').classList.toggle('open');
  });
  
  // Close menus on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.toolbar-menu.open').forEach(m => m.classList.remove('open'));
    document.getElementById('user-menu')?.classList.remove('open');
  });
  
  // Menu actions
  document.querySelectorAll('.dropdown-menu button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleMenuAction(btn.dataset.action);
      // Close menus
      document.querySelectorAll('.toolbar-menu.open').forEach(m => m.classList.remove('open'));
      document.getElementById('user-menu')?.classList.remove('open');
    });
  });
  
  // Project name
  const projectNameInput = document.getElementById('project-name');
  projectNameInput.addEventListener('change', () => {
    markDirty();
  });
  
  // Zoom controls
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => canvas.zoomIn());
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => canvas.zoomOut());
  
  // Search button
  document.getElementById('search-btn')?.addEventListener('click', () => toggleSearch());
  
  // Minimap button
  document.getElementById('minimap-btn')?.addEventListener('click', () => {
    canvas.showMinimap = !canvas.showMinimap;
    document.getElementById('minimap').style.display = canvas.showMinimap ? 'block' : 'none';
    canvas.render();
  });
}

function handleMenuAction(action) {
  switch (action) {
    case 'new-project':
      newProject();
      break;
    case 'open-project':
      showProjectModal();
      break;
    case 'save':
      saveCurrentProject();
      break;
    case 'save-as':
      saveAsNewProject();
      break;
    case 'export-json':
      exportJSON();
      break;
    case 'export-png':
      canvas.exportAsPNG();
      showToast('Blueprint exported as PNG', 'success');
      break;
    case 'import-json':
      document.getElementById('import-file-input').click();
      break;
    case 'undo':
      canvas.undo();
      break;
    case 'redo':
      canvas.redo();
      break;
    case 'cut':
      canvas.cutSelected();
      break;
    case 'copy':
      canvas.copySelected();
      break;
    case 'paste':
      canvas.paste();
      break;
    case 'select-all':
      canvas.selectAll();
      break;
    case 'delete-selected':
      canvas.deleteSelected();
      break;
    case 'zoom-in':
      canvas.zoomIn();
      break;
    case 'zoom-out':
      canvas.zoomOut();
      break;
    case 'zoom-reset':
      canvas.resetZoom();
      break;
    case 'fit-all':
      canvas.fitAll();
      break;
    case 'toggle-grid':
      canvas.showGrid = !canvas.showGrid;
      canvas.render();
      break;
    case 'toggle-minimap':
      canvas.showMinimap = !canvas.showMinimap;
      document.getElementById('minimap').style.display = canvas.showMinimap ? 'block' : 'none';
      canvas.render();
      break;
    case 'toggle-snap':
      canvas.snapToGrid = !canvas.snapToGrid;
      showToast(`Snap to grid: ${canvas.snapToGrid ? 'ON' : 'OFF'}`, 'info');
      break;
    case 'my-projects':
      showProjectModal();
      break;
    case 'install-app':
      triggerInstall();
      break;
    case 'logout':
      handleLogout();
      break;
  }
}

// ============================
// Sidebar — Node Palette
// ============================

function initSidebar() {
  const palette = document.getElementById('node-palette');
  const searchInput = document.getElementById('node-search');
  
  // Group nodes by category
  const categories = {};
  Object.entries(NODE_TYPES).forEach(([key, type]) => {
    const cat = type.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ key, ...type });
  });
  
  function renderPalette(filter = '') {
    palette.innerHTML = '';
    
    Object.entries(categories).forEach(([catName, nodes]) => {
      const filtered = nodes.filter(n => 
        n.label.toLowerCase().includes(filter.toLowerCase())
      );
      if (filtered.length === 0) return;
      
      const catDiv = document.createElement('div');
      catDiv.className = 'node-category';
      
      const header = document.createElement('div');
      header.className = 'node-category-header';
      header.innerHTML = `<span class="arrow">▼</span> ${catName}`;
      header.addEventListener('click', () => {
        catDiv.classList.toggle('collapsed');
      });
      
      const items = document.createElement('div');
      items.className = 'node-category-items';
      
      filtered.forEach(node => {
        const item = document.createElement('div');
        item.className = 'node-palette-item';
        item.innerHTML = `
          <span class="node-color-dot" style="background:${node.color}"></span>
          <span>${node.icon} ${node.label}</span>
        `;
        item.draggable = true;
        
        // Double-click to add at center
        item.addEventListener('dblclick', () => {
          canvas.addNodeAtCenter(node.key);
          showToast(`Added ${node.label} node`, 'success', 1500);
        });
        
        // Drag to add
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('node-type', node.key);
          e.dataTransfer.effectAllowed = 'copy';
        });
        
        items.appendChild(item);
      });
      
      catDiv.appendChild(header);
      catDiv.appendChild(items);
      palette.appendChild(catDiv);
    });
  }
  
  renderPalette();
  
  searchInput.addEventListener('input', () => {
    renderPalette(searchInput.value);
  });
  
  // Canvas drop handler
  const canvasContainer = document.getElementById('canvas-container');
  canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  
  canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('node-type');
    if (!nodeType) return;
    
    const rect = canvas.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x, y } = canvas.screenToWorld(sx, sy);
    
    canvas.addNode(nodeType, 
      canvas.snapToGrid ? Math.round(x / canvas.gridSize) * canvas.gridSize : x,
      canvas.snapToGrid ? Math.round(y / canvas.gridSize) * canvas.gridSize : y
    );
    showToast(`Added ${NODE_TYPES[nodeType]?.label || 'node'}`, 'success', 1500);
  });
}

// ============================
// Properties Panel
// ============================

function initProperties() {
  document.getElementById('close-properties').addEventListener('click', () => {
    document.getElementById('properties-panel').classList.add('hidden');
  });
}

function updateProperties(selectedNodes) {
  const panel = document.getElementById('properties-panel');
  const content = document.getElementById('properties-content');
  
  if (selectedNodes.length === 0) {
    panel.classList.add('hidden');
    return;
  }
  
  panel.classList.remove('hidden');
  const node = selectedNodes[0]; // Show first selected node
  
  const typeDef = NODE_TYPES[node.type];
  const typeColor = node.color;
  
  content.innerHTML = `
    <div class="prop-group">
      <div class="prop-group-title" style="color:${typeColor}">${typeDef?.icon || '🔲'} ${typeDef?.label || 'Node'}</div>
      
      <div class="prop-field">
        <label>Title</label>
        <input type="text" id="prop-title" value="${escapeHtml(node.title)}" />
      </div>
      
      <div class="prop-field">
        <label>Description</label>
        <textarea id="prop-description" rows="3">${escapeHtml(node.description)}</textarea>
      </div>
      
      ${node.type === 'character' ? `
        <div class="prop-field">
          <label>Traits</label>
          <textarea id="prop-traits" rows="2" placeholder="Brave, cunning, loyal...">${escapeHtml(node.traits || '')}</textarea>
        </div>
      ` : ''}
      
      ${node.type === 'quest' ? `
        <div class="prop-field">
          <label>Objectives</label>
          <textarea id="prop-objectives" rows="2" placeholder="1. Find the artifact...">${escapeHtml(node.objectives || '')}</textarea>
        </div>
      ` : ''}
      
      ${node.type === 'dialogue' ? `
        <div class="prop-field">
          <label>Speaker</label>
          <input type="text" id="prop-speaker" value="${escapeHtml(node.speaker || '')}" placeholder="Character name" />
        </div>
      ` : ''}
    </div>
    
    <div class="prop-group">
      <div class="prop-group-title">Color</div>
      <div class="prop-color-row">
        ${['#7c3aed','#3b82f6','#10b981','#f59e0b','#f43f5e','#06b6d4','#8b5cf6','#f97316','#64748b','#ec4899'].map(c => `
          <div class="prop-color-swatch ${c === node.color ? 'active' : ''}" 
               style="background:${c}" 
               data-color="${c}"></div>
        `).join('')}
      </div>
    </div>
    
    <div class="prop-group">
      <div class="prop-group-title">Tags</div>
      <div class="prop-tags" id="prop-tags-list">
        ${(node.tags || []).map(t => `
          <span class="prop-tag">${escapeHtml(t)} <span class="remove-tag" data-tag="${escapeHtml(t)}">×</span></span>
        `).join('')}
      </div>
      <div class="prop-field">
        <input type="text" id="prop-add-tag" placeholder="Add tag (Enter)" />
      </div>
    </div>
    
    <div class="prop-group">
      <div class="prop-group-title">Input Ports</div>
      <div class="prop-ports-list" id="input-ports-list">
        ${node.inputs.map((p, i) => `
          <div class="prop-port-item">
            <span class="prop-port-dot" style="background:${PORT_COLORS[p.type] || PORT_COLORS.data}"></span>
            <span class="prop-port-name">${escapeHtml(p.name)}</span>
            <span class="prop-port-remove" data-port-type="input" data-port-index="${i}">×</span>
          </div>
        `).join('')}
      </div>
      <button class="add-port-btn" data-port-direction="input">+ Add Input</button>
    </div>
    
    <div class="prop-group">
      <div class="prop-group-title">Output Ports</div>
      <div class="prop-ports-list" id="output-ports-list">
        ${node.outputs.map((p, i) => `
          <div class="prop-port-item">
            <span class="prop-port-dot" style="background:${PORT_COLORS[p.type] || PORT_COLORS.data}"></span>
            <span class="prop-port-name">${escapeHtml(p.name)}</span>
            <span class="prop-port-remove" data-port-type="output" data-port-index="${i}">×</span>
          </div>
        `).join('')}
      </div>
      <button class="add-port-btn" data-port-direction="output">+ Add Output</button>
    </div>
    
    <div class="prop-group">
      <div class="prop-group-title">Info</div>
      <div style="font-size:11px;color:var(--text-muted);">
        <p>ID: <code style="font-size:10px;font-family:var(--font-mono)">${node.id.substring(0,16)}...</code></p>
        <p>Position: (${Math.round(node.x)}, ${Math.round(node.y)})</p>
        <p>Size: ${node.width} × ${Math.round(node.height)}</p>
      </div>
    </div>
  `;
  
  // Event listeners for property changes
  const titleInput = document.getElementById('prop-title');
  titleInput?.addEventListener('input', debounce(() => {
    node.title = titleInput.value;
    canvas.pushHistory();
    canvas.render();
    markDirty();
  }, 300));
  
  const descInput = document.getElementById('prop-description');
  descInput?.addEventListener('input', debounce(() => {
    node.description = descInput.value;
    node.computeHeight();
    canvas.pushHistory();
    canvas.render();
    markDirty();
  }, 300));
  
  const traitsInput = document.getElementById('prop-traits');
  traitsInput?.addEventListener('input', debounce(() => {
    node.traits = traitsInput.value;
    markDirty();
  }, 300));
  
  const objectivesInput = document.getElementById('prop-objectives');
  objectivesInput?.addEventListener('input', debounce(() => {
    node.objectives = objectivesInput.value;
    markDirty();
  }, 300));
  
  const speakerInput = document.getElementById('prop-speaker');
  speakerInput?.addEventListener('input', debounce(() => {
    node.speaker = speakerInput.value;
    markDirty();
  }, 300));
  
  // Color swatches
  document.querySelectorAll('.prop-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      node.color = swatch.dataset.color;
      document.querySelectorAll('.prop-color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      canvas.pushHistory();
      canvas.render();
      markDirty();
    });
  });
  
  // Tags
  const tagInput = document.getElementById('prop-add-tag');
  tagInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && tagInput.value.trim()) {
      node.tags.push(tagInput.value.trim());
      tagInput.value = '';
      updateProperties([node]);
      canvas.pushHistory();
      markDirty();
    }
  });
  
  document.querySelectorAll('.remove-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      node.tags = node.tags.filter(t => t !== btn.dataset.tag);
      updateProperties([node]);
      canvas.pushHistory();
      markDirty();
    });
  });
  
  // Port management
  document.querySelectorAll('.prop-port-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const portType = btn.dataset.portType;
      const idx = parseInt(btn.dataset.portIndex);
      if (portType === 'input') {
        node.inputs.splice(idx, 1);
      } else {
        node.outputs.splice(idx, 1);
      }
      node.computeHeight();
      updateProperties([node]);
      canvas.pushHistory();
      canvas.render();
      markDirty();
    });
  });
  
  document.querySelectorAll('.add-port-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const direction = btn.dataset.portDirection;
      const name = prompt('Port name:', direction === 'input' ? 'New Input' : 'New Output');
      if (!name) return;
      
      const port = { name, type: 'data', index: 0 };
      if (direction === 'input') {
        port.index = node.inputs.length;
        node.inputs.push(port);
      } else {
        port.index = node.outputs.length;
        node.outputs.push(port);
      }
      node.computeHeight();
      updateProperties([node]);
      canvas.pushHistory();
      canvas.render();
      markDirty();
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================
// Context Menu
// ============================

function initContextMenu() {
  document.addEventListener('click', () => {
    hideContextMenu();
  });
}

function showContextMenu(info) {
  const menu = document.getElementById('context-menu');
  menu.innerHTML = '';
  
  if (info.node) {
    // Right-clicked on a node
    if (!canvas.selectedNodes.has(info.node.id)) {
      canvas.clearSelection();
      canvas.selectNode(info.node.id);
    }
    
    menu.innerHTML = `
      <button data-action="cut"><span class="menu-icon">✂️</span> Cut</button>
      <button data-action="copy"><span class="menu-icon">📋</span> Copy</button>
      <button data-action="duplicate"><span class="menu-icon">📑</span> Duplicate</button>
      <div class="menu-divider"></div>
      <button data-action="collapse"><span class="menu-icon">${info.node.collapsed ? '🔽' : '🔼'}</span> ${info.node.collapsed ? 'Expand' : 'Collapse'}</button>
      <button data-action="rename"><span class="menu-icon">✏️</span> Rename</button>
      <div class="menu-divider"></div>
      <button data-action="delete" style="color:var(--accent-rose)"><span class="menu-icon">🗑️</span> Delete</button>
    `;
  } else if (info.connection) {
    menu.innerHTML = `
      <button data-action="label-connection" data-conn-id="${info.connection.id}"><span class="menu-icon">🏷️</span> ${info.connection.label ? 'Edit Label' : 'Add Label'}</button>
      ${info.connection.label ? `<button data-action="remove-label" data-conn-id="${info.connection.id}"><span class="menu-icon">🚫</span> Remove Label</button>` : ''}
      <div class="menu-divider"></div>
      <button data-action="delete-connection" data-conn-id="${info.connection.id}"><span class="menu-icon">🗑️</span> Delete Connection</button>
    `;
  } else {
    // Right-clicked on empty canvas
    const nodeTypeItems = Object.entries(NODE_TYPES).map(([key, type]) => 
      `<button data-action="add-node" data-node-type="${key}"><span class="node-color-dot" style="background:${type.color};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px"></span> ${type.icon} ${type.label}</button>`
    ).join('');
    
    menu.innerHTML = `
      <div class="context-submenu">
        <button><span class="menu-icon">➕</span> Add Node</button>
        <div class="context-submenu-items">
          ${nodeTypeItems}
        </div>
      </div>
      <div class="menu-divider"></div>
      <button data-action="paste"><span class="menu-icon">📌</span> Paste</button>
      <button data-action="select-all"><span class="menu-icon">⬜</span> Select All</button>
      <button data-action="fit-all"><span class="menu-icon">📐</span> Fit All</button>
    `;
  }
  
  // Position
  menu.style.left = info.screenX + 'px';
  menu.style.top = info.screenY + 'px';
  menu.classList.remove('hidden');
  
  // Keep in viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = info.screenX - rect.width + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = info.screenY - rect.height + 'px';
  }
  
  // Context menu action handlers
  menu.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      
      switch (action) {
        case 'cut': canvas.cutSelected(); break;
        case 'copy': canvas.copySelected(); break;
        case 'duplicate': canvas.duplicateSelected(); break;
        case 'collapse':
          if (info.node) {
            info.node.collapsed = !info.node.collapsed;
            info.node.computeHeight();
            canvas.pushHistory();
            canvas.render();
          }
          break;
        case 'rename':
          if (info.node) canvas.editNodeTitle(info.node);
          break;
        case 'delete': canvas.deleteSelected(); break;
        case 'delete-connection':
          canvas.deleteConnection(btn.dataset.connId);
          break;
        case 'label-connection': {
          const connId = btn.dataset.connId;
          const conn = canvas.graph.connections.get(connId);
          if (conn) {
            const label = prompt('Connection label:', conn.label || '');
            if (label !== null) {
              conn.label = label.trim() || '';
              canvas.pushHistory();
              canvas.notifyGraphChanged();
              canvas.render();
            }
          }
          break;
        }
        case 'remove-label': {
          const cId = btn.dataset.connId;
          const c = canvas.graph.connections.get(cId);
          if (c) {
            c.label = '';
            canvas.pushHistory();
            canvas.notifyGraphChanged();
            canvas.render();
          }
          break;
        }
        case 'add-node':
          canvas.addNode(btn.dataset.nodeType, info.worldX, info.worldY);
          break;
        case 'paste': canvas.paste(); break;
        case 'select-all': canvas.selectAll(); break;
        case 'fit-all': canvas.fitAll(); break;
      }
      
      hideContextMenu();
    });
  });
}

function hideContextMenu() {
  document.getElementById('context-menu').classList.add('hidden');
}

// ============================
// Search
// ============================

function initSearch() {
  const dialog = document.getElementById('search-dialog');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) toggleSearch();
  });
  
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    results.innerHTML = '';
    
    if (!q) return;
    
    const nodes = canvas.graph.getAllNodes().filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
    
    nodes.forEach(node => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <span class="result-color" style="background:${node.color}"></span>
        <span class="result-name">${escapeHtml(node.title)}</span>
        <span class="result-type">${NODE_TYPES[node.type]?.label || node.type}</span>
      `;
      item.addEventListener('click', () => {
        canvas.clearSelection();
        canvas.selectNode(node.id);
        // Center on node
        canvas.panX = canvas.canvasWidth / 2 - node.x * canvas.zoom;
        canvas.panY = canvas.canvasHeight / 2 - node.y * canvas.zoom;
        canvas.render();
        toggleSearch();
      });
      results.appendChild(item);
    });
  });
}

function toggleSearch() {
  const dialog = document.getElementById('search-dialog');
  dialog.classList.toggle('hidden');
  if (!dialog.classList.contains('hidden')) {
    const input = document.getElementById('search-input');
    input.value = '';
    input.focus();
    document.getElementById('search-results').innerHTML = '';
  }
}

// ============================
// Project Modal
// ============================

function initProjectModal() {
  document.getElementById('close-project-modal')?.addEventListener('click', hideProjectModal);
  document.getElementById('project-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'project-modal') hideProjectModal();
  });
  
  document.getElementById('new-project-modal-btn')?.addEventListener('click', () => {
    hideProjectModal();
    newProject();
  });
  
  // Import file handler
  document.getElementById('import-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await readFileAsJSON(file);
      if (data.graphData) {
        canvas.loadProjectData(data.graphData);
        document.getElementById('project-name').value = data.name || 'Imported Project';
        currentProjectId = generateId();
        showToast('Project imported successfully', 'success');
        saveCurrentProject();
      } else {
        showToast('Invalid project file', 'error');
      }
    } catch (err) {
      showToast('Failed to import: ' + err.message, 'error');
    }
    e.target.value = '';
  });
}

async function showProjectModal() {
  const modal = document.getElementById('project-modal');
  const list = document.getElementById('project-list');
  modal.classList.remove('hidden');
  
  list.innerHTML = '<div class="empty-projects"><div class="spinner"></div><p>Loading projects...</p></div>';
  
  if (!currentUser) return;
  
  const { projects, error } = await listProjects(currentUser.uid);
  
  if (error) {
    list.innerHTML = `<div class="empty-projects"><p>Error: ${error}</p></div>`;
    return;
  }
  
  if (projects.length === 0) {
    list.innerHTML = `
      <div class="empty-projects">
        <p>No projects yet</p>
        <small>Create your first blueprint project!</small>
      </div>
    `;
    return;
  }
  
  list.innerHTML = '';
  projects.forEach(proj => {
    const item = document.createElement('div');
    item.className = `project-item ${proj.id === currentProjectId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="project-icon">🔷</div>
      <div class="project-details">
        <div class="project-title">${escapeHtml(proj.name || 'Untitled')}</div>
        <div class="project-meta">${proj.nodeCount || 0} nodes · ${formatDate(proj.updatedAt)}</div>
      </div>
      <div class="project-actions">
        <button class="project-action-btn delete" title="Delete" data-delete-id="${proj.id}">🗑️</button>
      </div>
    `;
    
    item.addEventListener('click', (e) => {
      if (e.target.closest('.project-action-btn')) return;
      openProject(proj.id);
      hideProjectModal();
    });
    
    const deleteBtn = item.querySelector('[data-delete-id]');
    deleteBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${proj.name || 'Untitled'}"?`)) {
        await deleteProject(currentUser.uid, proj.id);
        showToast('Project deleted', 'info');
        showProjectModal(); // Refresh list
      }
    });
    
    list.appendChild(item);
  });
}

function hideProjectModal() {
  document.getElementById('project-modal').classList.add('hidden');
}

// ============================
// Project Operations
// ============================

function newProject() {
  currentProjectId = generateId();
  document.getElementById('project-name').value = 'Untitled Project';
  canvas.clearAll();
  showToast('New project created', 'success');
  markDirty();
}

async function saveCurrentProject() {
  if (!currentUser) return;
  if (!currentProjectId) currentProjectId = generateId();
  
  const name = document.getElementById('project-name').value || 'Untitled Project';
  const graphData = canvas.getProjectData();
  
  updateSaveStatus('saving');
  
  const { success, error } = await saveProject(currentUser.uid, currentProjectId, {
    name,
    graphData,
    nodeCount: canvas.graph.getNodeCount(),
    createdAt: new Date()
  });
  
  if (success) {
    isDirty = false;
    updateSaveStatus('saved');
    localStorage.setItem('blueprint_lastProjectId', currentProjectId);
  } else {
    updateSaveStatus('unsaved');
    showToast('Save failed: ' + error, 'error');
  }
}

async function saveAsNewProject() {
  const name = prompt('Project name:', document.getElementById('project-name').value);
  if (!name) return;
  
  currentProjectId = generateId();
  document.getElementById('project-name').value = name;
  await saveCurrentProject();
  showToast('Saved as new project', 'success');
}

async function openProject(projectId) {
  if (!currentUser) return;
  
  const { data, error } = await loadProject(currentUser.uid, projectId);
  if (error) {
    showToast('Failed to load: ' + error, 'error');
    return;
  }
  
  currentProjectId = projectId;
  document.getElementById('project-name').value = data.name || 'Untitled';
  
  if (data.graphData) {
    canvas.loadProjectData(data.graphData);
  } else {
    canvas.clearAll();
  }
  
  isDirty = false;
  updateSaveStatus('saved');
  localStorage.setItem('blueprint_lastProjectId', projectId);
  showToast('Project loaded', 'success');
}

async function loadLastProject() {
  const lastId = localStorage.getItem('blueprint_lastProjectId');
  if (lastId && currentUser) {
    const { data } = await loadProject(currentUser.uid, lastId);
    if (data) {
      currentProjectId = lastId;
      document.getElementById('project-name').value = data.name || 'Untitled';
      if (data.graphData) {
        canvas.loadProjectData(data.graphData);
      }
      isDirty = false;
      updateSaveStatus('saved');
      return;
    }
  }
  // No last project, start fresh
  newProject();
}

function exportJSON() {
  const name = document.getElementById('project-name').value || 'blueprint';
  const data = {
    name,
    exportedAt: new Date().toISOString(),
    graphData: canvas.getProjectData()
  };
  downloadJSON(data, `${name.replace(/\s+/g, '_')}.blueprint.json`);
  showToast('Exported as JSON', 'success');
}

// ============================
// Auto-save & State
// ============================

function markDirty() {
  isDirty = true;
  updateSaveStatus('unsaved');
}

function updateSaveStatus(status) {
  const el = document.getElementById('save-status');
  if (!el) return;
  
  el.className = 'save-status';
  switch (status) {
    case 'saved':
      el.textContent = 'Saved';
      el.classList.add('saved');
      break;
    case 'saving':
      el.textContent = 'Saving...';
      el.classList.add('saving');
      break;
    case 'unsaved':
      el.textContent = 'Unsaved';
      el.classList.add('unsaved');
      break;
  }
}

function startAutoSave() {
  autoSaveTimer = setInterval(() => {
    if (isDirty && currentUser) {
      saveCurrentProject();
    }
  }, 30000); // Every 30 seconds
}

// ============================
// Keyboard Shortcuts (global)
// ============================

function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Don't capture if in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentProject();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      toggleSearch();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      newProject();
    }
  });
}

// ============================
// Mobile UI
// ============================

function initMobile() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const closeSidebarBtn = document.getElementById('close-sidebar-btn');
  const addPanel = document.getElementById('mobile-add-panel');
  const addGrid = document.getElementById('mobile-node-grid');
  
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.remove('hidden');
  }
  
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.add('hidden');
  }
  
  // Hamburger menu
  mobileMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    openSidebar();
  });
  
  closeSidebarBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);
  
  // Make sidebar items tap-to-add on mobile (since drag-and-drop doesn't work well on touch)
  document.getElementById('node-palette')?.addEventListener('click', (e) => {
    if (window.innerWidth > 768) return; // Only on mobile
    const item = e.target.closest('.node-palette-item');
    if (item) {
      // Find the node type from the item
      const nodeTypes = Object.entries(NODE_TYPES);
      const label = item.textContent.trim();
      for (const [key, type] of nodeTypes) {
        if (label.includes(type.label)) {
          canvas.addNodeAtCenter(key);
          showToast(`Added ${type.label}`, 'success', 1500);
          closeSidebar();
          break;
        }
      }
    }
  });
  
  // FAB buttons
  document.getElementById('fab-add')?.addEventListener('click', () => {
    addPanel.classList.toggle('hidden');
  });
  
  document.getElementById('fab-undo')?.addEventListener('click', () => {
    canvas.undo();
  });
  
  document.getElementById('fab-redo')?.addEventListener('click', () => {
    canvas.redo();
  });
  
  document.getElementById('fab-fit')?.addEventListener('click', () => {
    canvas.fitAll();
  });
  
  document.getElementById('fab-delete')?.addEventListener('click', () => {
    canvas.deleteSelected();
  });
  
  // Close add panel
  document.getElementById('close-add-panel')?.addEventListener('click', () => {
    addPanel.classList.add('hidden');
  });
  
  // Populate mobile add-node grid
  if (addGrid) {
    Object.entries(NODE_TYPES).forEach(([key, type]) => {
      const item = document.createElement('div');
      item.className = 'mobile-node-item';
      item.innerHTML = `
        <span class="mobile-node-icon">${type.icon}</span>
        <span class="mobile-node-label">${type.label}</span>
      `;
      item.style.borderColor = type.color + '30';
      
      item.addEventListener('click', () => {
        canvas.addNodeAtCenter(key);
        showToast(`Added ${type.label}`, 'success', 1500);
        addPanel.classList.add('hidden');
      });
      
      addGrid.appendChild(item);
    });
  }
  
  // Hide minimap on mobile by default
  if (window.innerWidth <= 768) {
    canvas.showMinimap = false;
    document.getElementById('minimap').style.display = 'none';
  }
}

// ============================
// PWA Install
// ============================

let deferredInstallPrompt = null;

function initPWA() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('SW registered:', reg.scope);
    }).catch((err) => {
      console.log('SW registration failed:', err);
    });
  }
  
  // Capture the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    
    // Show install button in user menu
    const installMenuBtn = document.getElementById('install-menu-btn');
    if (installMenuBtn) installMenuBtn.classList.remove('hidden');
    
    // Show install banner after 3 seconds if not dismissed before
    const dismissed = localStorage.getItem('blueprint_install_dismissed');
    if (!dismissed) {
      setTimeout(() => {
        const banner = document.getElementById('install-banner');
        if (banner && deferredInstallPrompt) {
          banner.classList.remove('hidden');
        }
      }, 3000);
    }
  });
  
  // Install banner buttons
  document.getElementById('install-banner-btn')?.addEventListener('click', () => {
    triggerInstall();
    document.getElementById('install-banner')?.classList.add('hidden');
  });
  
  document.getElementById('install-banner-close')?.addEventListener('click', () => {
    document.getElementById('install-banner')?.classList.add('hidden');
    localStorage.setItem('blueprint_install_dismissed', 'true');
  });
  
  // Listen for successful install
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.getElementById('install-menu-btn')?.classList.add('hidden');
    document.getElementById('install-banner')?.classList.add('hidden');
    showToast('Blueprint Studio installed! 🎉', 'success');
  });
}

function triggerInstall() {
  if (!deferredInstallPrompt) {
    showToast('App is already installed or install not available', 'info');
    return;
  }
  
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then((choice) => {
    if (choice.outcome === 'accepted') {
      showToast('Installing Blueprint Studio...', 'success');
    }
    deferredInstallPrompt = null;
  });
}

// ============================
// Logout
// ============================

async function handleLogout() {
  if (isDirty) {
    await saveCurrentProject();
  }
  clearInterval(autoSaveTimer);
  await logOut();
  canvas = null;
  currentUser = null;
  currentProjectId = null;
}

// ============================
// Boot
// ============================

document.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initAuth();
});
