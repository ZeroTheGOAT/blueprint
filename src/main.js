// ========================================
// main.js — Blueprint Studio Application
// ========================================

import './styles/index.css';
import './styles/mobile.css';
import { BlueprintCanvas } from './engine/Canvas.js';
import { NODE_TYPES, PORT_COLORS } from './engine/Node.js';
import { PlatformerCanvas, TILE_TYPES } from './engine/Platformer.js';
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
  deleteProject,
  shareProject,
  saveProjectVersion,
  listProjectVersions,
  deleteProjectVersion
} from './firebase.js';
import { generateId, showToast, formatDate, debounce, downloadJSON, readFileAsJSON } from './utils/helpers.js';
import { checkPlotHoles, chatWithAI, chatWithPlotChecker, setApiKey } from './engine/AIHelper.js';
// ============================
// App State
let currentAiMode = 'assistant';
let prePreviewState = null;
let currentlyPreviewingVersion = null;
// ============================

let canvas = null;
let platformerCanvas = null;
let currentMode = '3d-story';
let projectFilterMode = 'all';
let currentUser = null;
let currentProjectId = null;
let currentProjectOwnerId = null;
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
  initPlatformerSidebar();
  initModeSwitcher();
  initToolbar();
  initSidebar();
  initProperties();
  initContextMenu();
  initSearch();
  initProjectModal();
  initVersionModal();
  initKeyboardShortcuts();
  initMobile();
  initAIChat();
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
  
  canvas.onNodeTapped = (selectedNodes) => {
    updateProperties(selectedNodes, true);
  };
  
  const platformerCanvasEl = document.getElementById('platformer-canvas');
  if (platformerCanvasEl) {
    platformerCanvas = new PlatformerCanvas(platformerCanvasEl);
  }
}

function initModeSwitcher() {
  const switcher = document.getElementById('mode-switcher');
  if (!switcher) return;
  
  switcher.addEventListener('change', (e) => {
    if (currentMode !== e.target.value) {
      if (confirm('Switching modes will create a new project. Are you sure?')) {
        switchMode(e.target.value);
        newProject();
      } else {
        switcher.value = currentMode;
      }
    }
  });
}

function switchMode(mode) {
  currentMode = mode;
  const switcher = document.getElementById('mode-switcher');
  if (switcher) switcher.value = mode;
  
  const storySidebar = document.getElementById('sidebar');
  const platSidebar = document.getElementById('platformer-sidebar');
  const storyCanvas = document.getElementById('canvas-container');
  const platCanvas = document.getElementById('platformer-canvas-container');
  const propsPanel = document.getElementById('properties-panel');
  
  if (mode === '2d-platformer') {
    storySidebar?.classList.add('hidden');
    storyCanvas?.classList.add('hidden');
    propsPanel?.classList.add('hidden');
    platSidebar?.classList.remove('hidden');
    platCanvas?.classList.remove('hidden');
    
    // Force layout update so the container has actual dimensions
    if (platCanvas) platCanvas.offsetHeight;
    if (platformerCanvas) {
      platformerCanvas.resize();
    }
  } else {
    platSidebar?.classList.add('hidden');
    platCanvas?.classList.add('hidden');
    storySidebar?.classList.remove('hidden');
    storyCanvas?.classList.remove('hidden');
    
    // Force layout update so the container has actual dimensions
    if (storyCanvas) storyCanvas.offsetHeight;
    if (canvas) {
      canvas.resize();
    }
  }
}

function initPlatformerSidebar() {
  const palette = document.getElementById('platformer-palette');
  if (!palette) return;
  
  Object.entries(TILE_TYPES).forEach(([key, type]) => {
    const item = document.createElement('div');
    item.className = `platformer-palette-item ${key === 'floor' ? 'active' : ''}`;
    item.innerHTML = `
      <div class="platformer-tile-icon" style="background-color: ${type.color}33; border-color: ${type.color}">${type.icon}</div>
      <span>${type.label}</span>
    `;
    item.addEventListener('click', () => {
      document.querySelectorAll('.platformer-palette-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      if (platformerCanvas) platformerCanvas.setTool(key);
    });
    palette.appendChild(item);
  });
  
  document.getElementById('platformer-canvas')?.addEventListener('pointerup', () => {
    markDirty();
  });
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
  
  // Mobile save button
  document.getElementById('btn-save-mobile')?.addEventListener('click', () => {
    saveCurrentProject();
    showToast('Saving...', 'info', 1000);
  });
  // AI Plot check button
  document.getElementById('ai-check-btn')?.addEventListener('click', handleAiCheck);
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
    case 'save-version':
      commitVersion();
      break;
    case 'version-history':
      showVersionHistory();
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
      showProjectModal('my-projects');
      break;
    case 'shared-projects':
      showProjectModal('shared-projects');
      break;
    case 'install-app':
      triggerInstall();
      break;
    case 'logout':
      handleLogout();
      break;
    case 'switch-mode-3d':
      if (currentMode !== '3d-story' && confirm('Switching modes will create a new project. Are you sure?')) {
        switchMode('3d-story');
        newProject();
      }
      break;
    case 'switch-mode-2d':
      if (currentMode !== '2d-platformer' && confirm('Switching modes will create a new project. Are you sure?')) {
        switchMode('2d-platformer');
        newProject();
      }
      break;
    case 'trigger-ai-check':
      handleAiCheck();
      break;
    case 'trigger-ai-chat':
      const chatPanel = document.getElementById('ai-chat-panel');
      if (chatPanel) {
        chatPanel.classList.toggle('hidden');
        if (!chatPanel.classList.contains('hidden')) {
          document.getElementById('ai-chat-input')?.focus();
        }
      }
      break;
  }
}

async function handleAiCheck() {
  if (canvas.graph.nodes.size < 3) {
    showToast('Add at least 3 nodes to analyze plot holes!', 'error');
    return;
  }
  
  showToast('AI is checking for plot holes...', 'info', 5000);
  
  try {
    // Build simple data objects instead of calling serialize
    const nodes = [];
    const res = await checkPlotHoles(canvas.serialize());
    
    const modePlot = document.getElementById('ai-mode-plot');
    if (modePlot) modePlot.click(); // Automatically switch to plot mode

    const chatPanel = document.getElementById('ai-chat-panel');
    if (chatPanel) chatPanel.classList.remove('hidden');
    
    const messages = document.getElementById('ai-chat-messages-plot');
    if (messages) {
      const bubble = document.createElement('div');
      bubble.className = 'ai-chat-bubble ai';
      
      // Basic markdown formatting
      let formattedText = res
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
      bubble.innerHTML = `<strong>AI Plot Analysis:</strong><p>${formattedText}</p>`;
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
    }
  } catch (err) {
    if (err.message.includes('No API key found')) {
      const key = prompt('Please enter your Gemini API key (it will be saved locally in your browser):');
      if (key) {
        setApiKey(key.trim());
        handleAiCheck();
      }
    } else {
      showToast('AI Error: ' + err.message, 'error');
    }
  }
}


// ============================
// AI Chat Panel
// ============================

function initAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  const toggleBtn = document.getElementById('ai-chat-btn');
  const closeBtn = document.getElementById('ai-chat-close');
  const input = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-chat-send');
  
  if (!panel || !toggleBtn) return;

  const modeAssistant = document.getElementById('ai-mode-assistant');
  const modePlot = document.getElementById('ai-mode-plot');
  const msgAssistant = document.getElementById('ai-chat-messages-assistant');
  const msgPlot = document.getElementById('ai-chat-messages-plot');

  if (modeAssistant && modePlot) {
    modeAssistant.addEventListener('click', () => {
      currentAiMode = 'assistant';
      modeAssistant.classList.add('active');
      modePlot.classList.remove('active');
      if(msgAssistant) msgAssistant.classList.remove('hidden');
      if(msgPlot) msgPlot.classList.add('hidden');
      input.placeholder = "Ask about your story...";
    });
    
    modePlot.addEventListener('click', () => {
      currentAiMode = 'plot';
      modePlot.classList.add('active');
      modeAssistant.classList.remove('active');
      if(msgPlot) msgPlot.classList.remove('hidden');
      if(msgAssistant) msgAssistant.classList.add('hidden');
      input.placeholder = "Ask the Plot Checker...";
    });
  }

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    toggleBtn.classList.toggle('active');
    if (!panel.classList.contains('hidden')) {
      input.focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
    toggleBtn.classList.remove('active');
  });

  function addBubble(text, sender = 'user') {
    const messages = document.getElementById(currentAiMode === 'plot' ? 'ai-chat-messages-plot' : 'ai-chat-messages-assistant');
    if (!messages) return;
    
    const bubble = document.createElement('div');
    bubble.className = `ai-chat-bubble ${sender}`;
    
    const name = sender === 'ai' ? (currentAiMode === 'plot' ? 'Plot Checker' : 'AI Assistant') : 'You';
    if (sender === 'ai') {
      // Convert newlines, bullet points, and basic markdown
      const formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
      bubble.innerHTML = `<strong>${name}</strong><p>${formatted}</p>`;
    } else {
      bubble.textContent = text;
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;

    addBubble(msg, 'user');
    input.value = '';
    
    const messages = document.getElementById(currentAiMode === 'plot' ? 'ai-chat-messages-plot' : 'ai-chat-messages-assistant');
    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'ai-chat-bubble ai thinking';
    thinkingBubble.innerHTML = `<strong>${currentAiMode === 'plot' ? 'Plot Checker' : 'AI Assistant'}</strong><p>Thinking...</p>`;
    if(messages) {
      messages.appendChild(thinkingBubble);
      messages.scrollTop = messages.scrollHeight;
    }

    try {
      const nodes = [];
      canvas.graph.nodes.forEach(n => {
        nodes.push({ id: n.id, type: n.type, title: n.title, description: n.description || '' });
      });
      
      let response;
      if (currentAiMode === 'plot') {
        response = await chatWithPlotChecker(msg, { nodes });
      } else {
        response = await chatWithAI(msg, { nodes });
      }
      
      thinkingBubble.remove();
      addBubble(response, 'ai');
    } catch (err) {
      thinkingBubble.remove();
      if (err.message.includes('No API key found')) {
        const key = prompt('Enter your Gemini API key:');
        if (key) {
          setApiKey(key.trim());
          addBubble('API key saved! Please try again.', 'ai');
        }
      } else {
        addBubble('Sorry, I encountered an error: ' + err.message, 'ai');
      }
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
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
        
        // Double-click to add at center
        item.addEventListener('dblclick', () => {
          canvas.addNodeAtCenter(node.key);
          showToast(`Added ${node.label} node`, 'success', 1500);
        });
        
        // Custom pointer-based drag-and-drop (works on Touch/Stylus/Mouse)
        item.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          
          const startX = e.clientX;
          const startY = e.clientY;
          const rect = item.getBoundingClientRect();
          const offsetX = e.clientX - rect.left;
          const offsetY = e.clientY - rect.top;
          let ghost = null;
          let hasMoved = false;
          
          const onMove = (me) => {
            me.preventDefault();
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;
            
            if (!hasMoved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            
            if (!hasMoved) {
              hasMoved = true;
              ghost = item.cloneNode(true);
              ghost.classList.add('drag-ghost');
              ghost.style.cssText = `position:fixed;width:${rect.width}px;pointer-events:none;z-index:9999;opacity:0.85;`;
              document.body.appendChild(ghost);
            }
            
            ghost.style.left = (me.clientX - offsetX) + 'px';
            ghost.style.top = (me.clientY - offsetY) + 'px';
            
            const cr = canvas.canvas.getBoundingClientRect();
            canvas.canvas.style.boxShadow = 
              (me.clientX >= cr.left && me.clientX <= cr.right && me.clientY >= cr.top && me.clientY <= cr.bottom)
                ? 'inset 0 0 0 2px var(--accent-primary)' : 'none';
          };
          
          const onUp = (ue) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            if (ghost) document.body.removeChild(ghost);
            canvas.canvas.style.boxShadow = 'none';
            
            if (hasMoved) {
              const cr = canvas.canvas.getBoundingClientRect();
              if (ue.clientX >= cr.left && ue.clientX <= cr.right && ue.clientY >= cr.top && ue.clientY <= cr.bottom) {
                const { x, y } = canvas.screenToWorld(ue.clientX - cr.left, ue.clientY - cr.top);
                canvas.addNode(node.key,
                  canvas.snapToGrid ? Math.round(x / canvas.gridSize) * canvas.gridSize : x,
                  canvas.snapToGrid ? Math.round(y / canvas.gridSize) * canvas.gridSize : y
                );
                showToast(`Added ${node.label}`, 'success', 1500);
              }
            }
          };
          
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          window.addEventListener('pointercancel', onUp);
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
}

// ============================
// Properties Panel
// ============================

function initProperties() {
  document.getElementById('close-properties').addEventListener('click', () => {
    document.getElementById('properties-panel').classList.add('hidden');
  });
}

function updateProperties(selectedNodes, forceOpen = false) {
  const panel = document.getElementById('properties-panel');
  const content = document.getElementById('properties-content');
  
  if (selectedNodes.length === 0) {
    panel.classList.add('hidden');
    return;
  }
  
  // Only open if explicitly requested (e.g. tap) or if already open
  if (!forceOpen && panel.classList.contains('hidden')) {
    // Keep hidden but update content
  } else {
    panel.classList.remove('hidden');
  }
  
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
        <textarea id="prop-description" rows="12">${escapeHtml(node.description)}</textarea>
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
      
      ${node.type === 'condition' ? `
        <div class="prop-field">
          <label>Condition</label>
          <input type="text" id="prop-condition" value="${escapeHtml(node.condition || '')}" placeholder="e.g. hasKey == true" />
        </div>
      ` : ''}
      
      ${node.type === 'variable' ? `
        <div class="prop-field">
          <label>Variable Name</label>
          <input type="text" id="prop-variable-name" value="${escapeHtml(node.variableName || '')}" placeholder="Health" />
        </div>
        <div class="prop-field">
          <label>Operation</label>
          <select id="prop-operation">
            <option value="set" ${node.operation === 'set' ? 'selected' : ''}>Set (=)</option>
            <option value="add" ${node.operation === 'add' ? 'selected' : ''}>Add (+)</option>
            <option value="sub" ${node.operation === 'sub' ? 'selected' : ''}>Subtract (-)</option>
          </select>
        </div>
        <div class="prop-field">
          <label>Value</label>
          <input type="text" id="prop-value" value="${escapeHtml(node.value || '')}" placeholder="10" />
        </div>
      ` : ''}
      
      ${node.type === 'encounter' ? `
        <div class="prop-field">
          <label>Enemy Type</label>
          <input type="text" id="prop-enemy-type" value="${escapeHtml(node.enemyType || '')}" placeholder="Skeleton Archer" />
        </div>
        <div class="prop-field">
          <label>Difficulty</label>
          <select id="prop-difficulty">
            <option value="easy" ${node.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
            <option value="medium" ${node.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="hard" ${node.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
            <option value="boss" ${node.difficulty === 'boss' ? 'selected' : ''}>Boss</option>
          </select>
        </div>
      ` : ''}
      
      ${node.type === 'audio' ? `
        <div class="prop-field">
          <label>Track Name</label>
          <input type="text" id="prop-track-name" value="${escapeHtml(node.trackName || '')}" placeholder="Forest_Ambience.mp3" />
        </div>
        <div class="prop-field">
          <label>Audio Type</label>
          <select id="prop-audio-type">
            <option value="bgm" ${node.audioType === 'bgm' ? 'selected' : ''}>Background Music</option>
            <option value="sfx" ${node.audioType === 'sfx' ? 'selected' : ''}>Sound Effect</option>
            <option value="voice" ${node.audioType === 'voice' ? 'selected' : ''}>Voice Over</option>
          </select>
        </div>
        <div class="prop-field">
          <label>Volume</label>
          <input type="range" id="prop-volume" min="0" max="100" value="${node.volume || 100}" />
        </div>
      ` : ''}
      
      ${node.type === 'cutscene' ? `
        <div class="prop-field">
          <label>Duration (sec)</label>
          <input type="number" id="prop-duration" value="${node.duration || 5}" />
        </div>
        <div class="prop-field">
          <label>Camera Angles</label>
          <textarea id="prop-camera-angles" rows="2" placeholder="Close up on face, panning left...">${escapeHtml(node.cameraAngles || '')}</textarea>
        </div>
      ` : ''}
      
      ${node.type === 'endState' ? `
        <div class="prop-field">
          <label>End Type</label>
          <select id="prop-end-type">
            <option value="win" ${node.endType === 'win' ? 'selected' : ''}>Victory / Level Complete</option>
            <option value="fail" ${node.endType === 'fail' ? 'selected' : ''}>Game Over / Defeat</option>
            <option value="other" ${node.endType === 'other' ? 'selected' : ''}>Custom Ending</option>
          </select>
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
            <input type="text" class="prop-port-name-input" value="${escapeHtml(p.name)}" data-port-type="input" data-port-index="${i}" />
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
            <input type="text" class="prop-port-name-input" value="${escapeHtml(p.name)}" data-port-type="output" data-port-index="${i}" />
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
  
  const conditionInput = document.getElementById('prop-condition');
  conditionInput?.addEventListener('input', debounce(() => {
    node.condition = conditionInput.value;
    markDirty();
  }, 300));

  const varNameInput = document.getElementById('prop-variable-name');
  varNameInput?.addEventListener('input', debounce(() => {
    node.variableName = varNameInput.value;
    markDirty();
  }, 300));

  const opSelect = document.getElementById('prop-operation');
  opSelect?.addEventListener('change', () => {
    node.operation = opSelect.value;
    markDirty();
  });

  const valInput = document.getElementById('prop-value');
  valInput?.addEventListener('input', debounce(() => {
    node.value = valInput.value;
    markDirty();
  }, 300));

  const enemyInput = document.getElementById('prop-enemy-type');
  enemyInput?.addEventListener('input', debounce(() => {
    node.enemyType = enemyInput.value;
    markDirty();
  }, 300));

  const diffSelect = document.getElementById('prop-difficulty');
  diffSelect?.addEventListener('change', () => {
    node.difficulty = diffSelect.value;
    markDirty();
  });

  const trackInput = document.getElementById('prop-track-name');
  trackInput?.addEventListener('input', debounce(() => {
    node.trackName = trackInput.value;
    markDirty();
  }, 300));

  const audioTypeSelect = document.getElementById('prop-audio-type');
  audioTypeSelect?.addEventListener('change', () => {
    node.audioType = audioTypeSelect.value;
    markDirty();
  });

  const volInput = document.getElementById('prop-volume');
  volInput?.addEventListener('input', () => {
    node.volume = volInput.value;
    markDirty();
  });

  const durInput = document.getElementById('prop-duration');
  durInput?.addEventListener('input', () => {
    node.duration = durInput.value;
    markDirty();
  });

  const camInput = document.getElementById('prop-camera-angles');
  camInput?.addEventListener('input', debounce(() => {
    node.cameraAngles = camInput.value;
    markDirty();
  }, 300));

  const endTypeSelect = document.getElementById('prop-end-type');
  endTypeSelect?.addEventListener('change', () => {
    node.endType = endTypeSelect.value;
    markDirty();
  });
  
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
  
  // Port name editing
  document.querySelectorAll('.prop-port-name-input').forEach(input => {
    input.addEventListener('input', debounce(() => {
      const type = input.dataset.portType;
      const idx = parseInt(input.dataset.portIndex);
      if (type === 'input') {
        node.inputs[idx].name = input.value;
      } else {
        node.outputs[idx].name = input.value;
      }
      canvas.render();
      markDirty();
    }, 300));
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
      ${canvas.selectedNodes.size > 0 ? '<button data-action="group-selected"><span class="menu-icon">📦</span> Group Selected</button>' : ''}
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
        case 'group-selected':
          canvas.groupSelected();
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
        if (data.graphData.type === 'platformer2d') {
          switchMode('2d-platformer');
          if (platformerCanvas) platformerCanvas.loadProjectData(data.graphData);
        } else {
          switchMode('3d-story');
          canvas.loadProjectData(data.graphData);
        }
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

  // Tab handlers
  document.querySelectorAll('.project-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.project-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      showProjectModal(e.target.dataset.tab);
    });
  });

  document.getElementById('project-filter-switcher')?.addEventListener('change', (e) => {
    projectFilterMode = e.target.value;
    const activeTab = document.querySelector('.project-tab.active')?.dataset.tab || 'my-projects';
    showProjectModal(activeTab);
  });
}

async function showProjectModal(mode = 'my-projects') {
  const modal = document.getElementById('project-modal');
  const list = document.getElementById('project-list');
  const adminViewTab = document.getElementById('admin-view-tab');
  modal.classList.remove('hidden');
  
  if (!currentUser) return;

  if (currentUser.email === 'hariprasadhp637@gmail.com') {
    adminViewTab?.classList.remove('hidden');
  } else {
    adminViewTab?.classList.add('hidden');
  }
  
  // Visually update the active tab
  document.querySelectorAll('.project-tab').forEach(t => {
    if (t.dataset.tab === mode) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
  
  list.innerHTML = '<div class="empty-projects"><div class="spinner"></div><p>Loading projects...</p></div>';
  
  const { projects, error } = await listProjects(currentUser.uid, currentUser.email, mode);
  
  if (error) {
    list.innerHTML = `<div class="empty-projects"><p>Error: ${error}</p></div>`;
    return;
  }
  
  let filteredProjects = projects;
  if (projectFilterMode === '2d-platformer') {
    filteredProjects = projects.filter(p => p.graphData?.type === 'platformer2d');
  } else if (projectFilterMode === '3d-story') {
    filteredProjects = projects.filter(p => p.graphData?.type !== 'platformer2d');
  }

  if (filteredProjects.length === 0) {
    list.innerHTML = `
      <div class="empty-projects">
        <p>${projects.length === 0 ? 'No projects yet' : 'No projects match your filter'}</p>
        <small>${projects.length === 0 ? 'Create your first blueprint project!' : 'Try changing the type filter.'}</small>
      </div>
    `;
    return;
  }
  
  list.innerHTML = '';
  filteredProjects.forEach(proj => {
    const item = document.createElement('div');
    item.className = `project-item ${proj.id === currentProjectId ? 'active' : ''}`;
    
    // Determine ownership and badges
    const projOwnerId = proj.ownerId || currentUser.uid;
    const isOwner = projOwnerId === currentUser.uid;
    const isAdmin = currentUser.email === 'hariprasadhp637@gmail.com';
    let badge = '';
    if (!isOwner) {
      if (proj.sharedWith && proj.sharedWith.includes(currentUser.email)) {
        badge = '<span class="project-badge">Shared</span>';
      } else if (isAdmin) {
        badge = '<span class="project-badge admin">Admin View</span>';
      }
    }

    item.innerHTML = `
      <div class="project-icon">🔷</div>
      <div class="project-details">
        ${mode === 'admin-view' && proj.ownerContact ? `<div class="project-owner-contact">${escapeHtml(proj.ownerContact)}</div>` : ''}
        <div class="project-title">${escapeHtml(proj.name || 'Untitled')} ${badge}</div>
        <div class="project-meta">${proj.nodeCount || 0} nodes · ${formatDate(proj.updatedAt)}</div>
      </div>
      <div class="project-actions">
        ${isOwner ? `<button class="project-action-btn share" title="Share" data-share-id="${proj.id}">🔗</button>` : ''}
        ${isOwner || isAdmin ? `<button class="project-action-btn delete" title="Delete" data-delete-id="${proj.id}">🗑️</button>` : ''}
      </div>
    `;
    
    item.addEventListener('click', (e) => {
      if (e.target.closest('.project-action-btn')) return;
      openProject(proj.id, projOwnerId);
      hideProjectModal();
    });
    
    const shareBtn = item.querySelector('[data-share-id]');
    shareBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const email = prompt(`Share "${proj.name || 'Untitled'}" with email:`);
      if (email && email.trim()) {
        const res = await shareProject(projOwnerId, proj.id, email.trim());
        if (res.success) showToast(`Shared with ${email}`, 'success');
        else showToast(`Failed to share: ${res.error}`, 'error');
      }
    });

    const deleteBtn = item.querySelector('[data-delete-id]');
    deleteBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${proj.name || 'Untitled'}"?`)) {
        await deleteProject(projOwnerId, proj.id);
        showToast('Project deleted', 'info');
        showProjectModal(mode); // Refresh list
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
  currentProjectOwnerId = currentUser ? currentUser.uid : null;
  document.getElementById('project-name').value = 'Untitled Project';
  canvas.clearAll();
  if (platformerCanvas) platformerCanvas.clear();
  showToast('New project created', 'success');
  markDirty();
}

async function saveCurrentProject() {
  if (!currentUser) return;
  if (!currentProjectId) {
    currentProjectId = generateId();
    currentProjectOwnerId = currentUser.uid;
  }
  
  const ownerId = currentProjectOwnerId || currentUser.uid;
  const name = document.getElementById('project-name').value || 'Untitled Project';
  const graphData = currentMode === '2d-platformer' ? platformerCanvas.getProjectData() : canvas.getProjectData();
  const nodeCount = currentMode === '2d-platformer' ? platformerCanvas.tiles.size : canvas.graph.getNodeCount();
  const ownerContact = currentUser.email || currentUser.phoneNumber || 'Unknown';
  
  updateSaveStatus('saving');
  
  const { success, error } = await saveProject(ownerId, currentProjectId, {
    name,
    graphData,
    nodeCount,
    ownerContact: ownerContact,
    createdAt: new Date()
  });
  
  if (success) {
    isDirty = false;
    updateSaveStatus('saved');
    localStorage.setItem('blueprint_lastProjectId', currentProjectId);
    localStorage.setItem('blueprint_lastOwnerId', ownerId);
    localStorage.removeItem(`blueprint_cache_${currentProjectId}`);
    saveProjectVersion(ownerId, currentProjectId, { graphData, nodeCount }, 'Auto-save at ' + new Date().toLocaleTimeString());
  } else {
    updateSaveStatus('unsaved');
    showToast('Save failed: ' + error, 'error');
  }
}

async function saveAsNewProject() {
  const name = prompt('Project name:', document.getElementById('project-name').value);
  if (!name) return;
  
  currentProjectId = generateId();
  currentProjectOwnerId = currentUser ? currentUser.uid : null;
  document.getElementById('project-name').value = name;
  await saveCurrentProject();
  showToast('Saved as new project', 'success');
}

async function openProject(projectId, ownerId) {
  if (!currentUser) return;
  
  const targetOwnerId = ownerId || currentUser.uid;
  const { data, error } = await loadProject(targetOwnerId, projectId);
  if (error) {
    showToast('Failed to load: ' + error, 'error');
    return;
  }
  
  currentProjectId = projectId;
  currentProjectOwnerId = targetOwnerId;
  document.getElementById('project-name').value = data.name || 'Untitled';
  
  let finalGraphData = data.graphData;
  const cachedStr = localStorage.getItem(`blueprint_cache_${projectId}`);
  let restoredFromCache = false;
  if (cachedStr) {
    try {
      const cache = JSON.parse(cachedStr);
      if (cache && cache.data) {
        finalGraphData = cache.data;
        restoredFromCache = true;
      }
    } catch(e) {}
  }
  
  if (finalGraphData) {
    if (finalGraphData.type === 'platformer2d') {
      switchMode('2d-platformer');
      if (platformerCanvas) platformerCanvas.loadProjectData(finalGraphData);
    } else {
      switchMode('3d-story');
      canvas.loadProjectData(finalGraphData);
    }
  } else {
    canvas.clearAll();
    if (platformerCanvas) platformerCanvas.clear();
  }
  
  if (restoredFromCache) {
    showToast('Restored unsaved changes from local cache', 'info');
    markDirty();
  } else {
    isDirty = false;
    updateSaveStatus('saved');
  }
  localStorage.setItem('blueprint_lastProjectId', projectId);
  localStorage.setItem('blueprint_lastOwnerId', targetOwnerId);
  showToast('Project loaded', 'success');
}

async function loadLastProject() {
  const lastId = localStorage.getItem('blueprint_lastProjectId');
  const lastOwner = localStorage.getItem('blueprint_lastOwnerId');
  if (lastId && currentUser) {
    const targetOwnerId = lastOwner || currentUser.uid;
    const { data } = await loadProject(targetOwnerId, lastId);
    if (data) {
      currentProjectId = lastId;
      currentProjectOwnerId = targetOwnerId;
      document.getElementById('project-name').value = data.name || 'Untitled';
      if (data.graphData) {
        if (data.graphData.type === 'platformer2d') {
          switchMode('2d-platformer');
          if (platformerCanvas) platformerCanvas.loadProjectData(data.graphData);
        } else {
          switchMode('3d-story');
          canvas.loadProjectData(data.graphData);
        }
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
    graphData: currentMode === '2d-platformer' ? platformerCanvas.getProjectData() : canvas.getProjectData()
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
  
  // Cache to localStorage instantly so nothing is lost if internet cuts off
  if (currentProjectId) {
    const graphData = currentMode === '2d-platformer' ? (platformerCanvas ? platformerCanvas.getProjectData() : null) : canvas.getProjectData();
    if (graphData) {
      localStorage.setItem(`blueprint_cache_${currentProjectId}`, JSON.stringify({
        mode: currentMode,
        data: graphData,
        timestamp: Date.now()
      }));
    }
  }
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
  let paletteScrolled = false;
  const nodePalette = document.getElementById('node-palette');
  
  nodePalette?.addEventListener('touchmove', () => {
    paletteScrolled = true;
  }, { passive: true });
  
  nodePalette?.addEventListener('touchstart', () => {
    paletteScrolled = false;
  }, { passive: true });

  nodePalette?.addEventListener('click', (e) => {
    if (window.innerWidth > 768) return; // Only on mobile
    if (paletteScrolled) return;
    
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
    if (currentMode === '2d-platformer' && platformerCanvas) {
      platformerCanvas.undo();
    } else {
      canvas.undo();
    }
  });

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (currentMode === '2d-platformer' && platformerCanvas) {
      platformerCanvas.undo();
    } else {
      canvas.undo();
    }
  });
  
  document.getElementById('fab-redo')?.addEventListener('click', () => {
    if (currentMode === '2d-platformer' && platformerCanvas) {
      platformerCanvas.redo();
    } else {
      canvas.redo();
    }
  });

  document.getElementById('btn-redo')?.addEventListener('click', () => {
    if (currentMode === '2d-platformer' && platformerCanvas) {
      platformerCanvas.redo();
    } else {
      canvas.redo();
    }
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
// Version History
// ============================

function initVersionModal() {
  document.getElementById('close-version-modal')?.addEventListener('click', hideVersionModal);
  document.getElementById('version-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'version-modal') hideVersionModal();
  });
}

async function commitVersion() {
  if (!currentUser || !currentProjectId) {
    showToast('Please save the project first before committing a version.', 'error');
    return;
  }
  const message = prompt('Commit Message:', 'Version ' + new Date().toLocaleTimeString());
  if (!message) return;

  const ownerId = currentProjectOwnerId || currentUser.uid;
  const graphData = currentMode === '2d-platformer' ? platformerCanvas.getProjectData() : canvas.getProjectData();
  const nodeCount = currentMode === '2d-platformer' ? platformerCanvas.tiles.size : canvas.graph.getNodeCount();

  const { success, error } = await saveProjectVersion(ownerId, currentProjectId, {
    graphData,
    nodeCount
  }, message);

  if (success) {
    showToast('Version committed successfully!', 'success');
  } else {
    showToast('Failed to commit version: ' + error, 'error');
  }
}

async function showVersionHistory() {
  if (!currentUser || !currentProjectId) {
    showToast('Please open or save a project first.', 'error');
    return;
  }

  const modal = document.getElementById('version-modal');
  const list = document.getElementById('version-list');
  modal.classList.remove('hidden');

  list.innerHTML = '<div class="empty-projects"><div class="spinner"></div><p>Loading versions...</p></div>';

  const ownerId = currentProjectOwnerId || currentUser.uid;
  const { versions, error } = await listProjectVersions(ownerId, currentProjectId);

  if (error) {
    list.innerHTML = `<div class="empty-projects"><p>Error: ${error}</p></div>`;
    return;
  }

  if (versions.length === 0) {
    list.innerHTML = '<div class="empty-projects"><p>No version history available.</p><small>Commit a version first!</small></div>';
    return;
  }

  list.innerHTML = '';
  versions.forEach(ver => {
    const item = document.createElement('div');
    item.className = 'project-item';
    item.innerHTML = `
      <div class="project-icon">📄</div>
      <div class="project-details">
        <div class="project-title">${escapeHtml(ver.message || 'Untitled Version')}</div>
        <div class="project-meta">${ver.nodeCount || 0} nodes • ${formatDate(ver.createdAt)}</div>
      </div>
      <div class="project-actions">
        <button class="project-action-btn share preview-btn" title="Preview this version">👁 Preview</button>
        <button class="project-action-btn delete delete-btn" title="Delete this version" style="color:var(--accent-error)">🗑</button>
      </div>
    `;

    item.querySelector('.preview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      prePreviewState = canvas.serialize();
      currentlyPreviewingVersion = ver;
      restoreVersion(ver);
      hideVersionModal();
      document.getElementById('preview-bar').classList.remove('hidden');
      document.getElementById('preview-version-name').textContent = ver.message || 'Untitled Version';
    });
    
    item.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this version forever?')) {
        const res = await deleteProjectVersion(ownerId, currentProjectId, ver.id);
        if (res.error) showToast('Error: ' + res.error, 'error');
        else showVersionHistory(); // Refresh list
      }
    });

    list.appendChild(item);
  });
}

function hideVersionModal() {
  document.getElementById('version-modal')?.classList.add('hidden');
}

function restoreVersion(versionData) {
  if (versionData.graphData) {
    if (versionData.graphData.type === 'platformer2d') {
      switchMode('2d-platformer');
      if (platformerCanvas) platformerCanvas.loadProjectData(versionData.graphData);
    } else {
      switchMode('3d-story');
      canvas.loadProjectData(versionData.graphData);
    }
    showToast('Version restored', 'success');
    markDirty(); // Mark dirty so it gets saved to main branch on next save
  }
}

// Preview UI Actions
document.getElementById('preview-restore-btn')?.addEventListener('click', () => {
    saveCurrentProject(); // saves currently loaded canvas back to db as current
    document.getElementById('preview-bar').classList.add('hidden');
    prePreviewState = null;
    currentlyPreviewingVersion = null;
    showToast('Version restored successfully!', 'success');
});

document.getElementById('preview-cancel-btn')?.addEventListener('click', () => {
    if (prePreviewState) {
       canvas.loadFromJSON(JSON.parse(prePreviewState));
       canvas.render();
    }
    document.getElementById('preview-bar').classList.add('hidden');
    prePreviewState = null;
    currentlyPreviewingVersion = null;
    showToast('Preview cancelled.', 'info');
});

// ============================
// Boot
// ============================

document.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initAuth();
});
