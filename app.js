// === CONFIGURATION ===
const API_BASE = 'https://mini-chatgpt-api-v5.onrender.com/api';
const USE_SERVER = true;

// === INITIALISATION ===
const memory = new Memory();
const orchestrator = new Orchestrator(memory);

let conversations = Storage.load('conversations', {});
let currentChatId = Storage.load('currentChatId', null);
let isProcessing = false;
let currentStyle = 'professional';
let imageSearchMode = 'auto';

// === DOM ===
const chatMessages = document.getElementById('chatMessages');
const welcomeScreen = document.getElementById('welcomeScreen');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sidebarChats = document.getElementById('sidebarChats');
const userNameDisplay = document.getElementById('userNameDisplay');

// === INIT ===
function init() {
  const savedName = memory.userName;
  if (savedName) {
    userNameDisplay.textContent = savedName;
    document.getElementById('userAvatar').textContent = savedName.charAt(0).toUpperCase();
  }

  currentStyle = memory.getPreference('style', 'professional');
  imageSearchMode = memory.getPreference('images', 'auto');
  
  document.getElementById('settingStyle').value = currentStyle;
  document.getElementById('settingImages').value = imageSearchMode;

  renderSidebar();

  if (currentChatId && conversations[currentChatId]) {
    loadChat(currentChatId);
  } else {
    createNewChat();
  }

  checkForUpdate();
}

// === CONVERSATIONS ===
function createNewChat() {
  const id = Date.now().toString();
  currentChatId = id;
  conversations[id] = {
    id,
    title: 'Nouvelle conversation',
    messages: [],
    createdAt: new Date().toISOString(),
    style: currentStyle,
    imageMode: imageSearchMode
  };
  saveConversations();
  renderSidebar();
  clearChat();
  welcomeScreen.style.display = 'flex';
}

function loadChat(id) {
  currentChatId = id;
  Storage.save('currentChatId', id);
  clearChat();

  const chat = conversations[id];
  if (chat && chat.messages.length > 0) {
    welcomeScreen.style.display = 'none';
    chat.messages.forEach(msg => {
      addMessageToChat(msg.content, msg.role, false, msg.metadata);
    });
  } else {
    welcomeScreen.style.display = 'flex';
  }

  renderSidebar();
  scrollToBottom();
}

function deleteChat(id) {
  delete conversations[id];
  if (currentChatId === id) {
    const remaining = Object.keys(conversations);
    if (remaining.length > 0) {
      loadChat(remaining[remaining.length - 1]);
    } else {
      createNewChat();
    }
  }
  saveConversations();
  renderSidebar();
}

function clearChat() {
  chatMessages.innerHTML = '';
  chatMessages.appendChild(welcomeScreen);
}

function saveConversations() {
  Storage.save('conversations', conversations);
  Storage.save('currentChatId', currentChatId);
}

function renderSidebar() {
  const chatList = Object.values(conversations).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  sidebarChats.innerHTML = chatList.map(chat => `
    <div class="chat-item ${chat.id === currentChatId ? 'active' : ''}"
         onclick="loadChat('${chat.id}')">
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(chat.title)}</span>
      <span class="delete-chat" onclick="event.stopPropagation();deleteChat('${chat.id}')">🗑️</span>
    </div>
  `).join('') || '<div style="padding:16px;text-align:center;color:#888;">Aucune conversation</div>';
}

// === ENVOI MESSAGE ===
async function sendMessage() {
  if (isProcessing) return;

  const text = userInput.value.trim();
  if (!text) return;

  isProcessing = true;
  sendBtn.disabled = true;
  welcomeScreen.style.display = 'none';

  addMessageToChat(text, 'user');
  userInput.value = '';
  userInput.style.height = 'auto';

  if (!conversations[currentChatId]) createNewChat();
  conversations[currentChatId].messages.push({ role: 'user', content: text, timestamp: new Date().toISOString() });
  if (conversations[currentChatId].title === 'Nouvelle conversation') {
    conversations[currentChatId].title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
  }
  saveConversations();
  renderSidebar();

  const typingId = showTypingIndicator();

  try {
    const options = {
      style: currentStyle,
      imageSearch: imageSearchMode === 'never' ? 'never' : imageSearchMode === 'always' ? 'always' : 'auto'
    };

    const result = await orchestrator.processMessage(text, options);

    removeTypingIndicator(typingId);
    addMessageToChat(result.response, 'bot', false, result.metadata);

    conversations[currentChatId].messages.push({
      role: 'bot',
      content: result.response,
      metadata: result.metadata,
      pipeline: result.pipeline,
      timestamp: new Date().toISOString()
    });

    saveConversations();
    renderSidebar();
    updatePipelineModal(result.pipeline, result.stats);

  } catch (error) {
    removeTypingIndicator(typingId);
    console.error('Erreur:', error);
    addMessageToChat('Une erreur est survenue. Peux-tu réessayer ? 😊', 'bot');
  }

  isProcessing = false;
  sendBtn.disabled = false;
  userInput.focus();
  scrollToBottom();
}

// === AFFICHAGE ===
function addMessageToChat(content, role, isRewritten = false, metadata = null) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `message-avatar ${role}`;
  avatar.textContent = role === 'user' ? '👤' : '🧠';

  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';

  if (metadata?.searchPerformed) {
    const indicator = document.createElement('div');
    indicator.className = 'search-indicator';
    indicator.textContent = '🌐 Recherche web effectuée';
    messageContent.appendChild(indicator);
  }

  if (metadata?.hasImages) {
    const indicator = document.createElement('div');
    indicator.className = 'search-indicator';
    indicator.textContent = `🖼️ ${metadata.imageCount || ''} images trouvées`;
    messageContent.appendChild(indicator);
  }

  if (isRewritten) {
    const rewritten = document.createElement('div');
    rewritten.className = 'search-indicator';
    rewritten.textContent = '🔄 Reformulé';
    messageContent.appendChild(rewritten);
  }

  const formattedContent = formatMessage(content);
  messageContent.innerHTML += formattedContent;

  // Ajouter les événements sur les cartes images
  messageContent.querySelectorAll('.image-card').forEach(card => {
    card.addEventListener('click', function() {
      const img = this.querySelector('img');
      const caption = this.querySelector('.image-caption div:first-child')?.textContent || '';
      const source = this.querySelector('.image-source')?.textContent || '';
      if (img) openImageModal(img.src, caption, source);
    });
  });

  const actions = document.createElement('div');
  actions.className = 'message-actions';
  actions.innerHTML = `
    <button onclick="copyMessage(this)">📋 Copier</button>
    ${role === 'bot' ? '<button onclick="regenerateMessage(this)">🔄 Regénérer</button>' : ''}
  `;
  messageContent.appendChild(actions);

  row.appendChild(avatar);
  row.appendChild(messageContent);
  chatMessages.insertBefore(row, welcomeScreen);
}

function formatMessage(text) {
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  formatted = formatted.replace(/\n/g, '<br>');
  formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  return formatted;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showTypingIndicator() {
  const row = document.createElement('div');
  row.className = 'message-row bot';
  row.id = 'typing-' + Date.now();

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar bot';
  avatar.textContent = '🧠';

  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';

  row.appendChild(avatar);
  row.appendChild(indicator);
  chatMessages.insertBefore(row, welcomeScreen);
  scrollToBottom();

  return row.id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  const container = document.querySelector('.chat-container');
  if (container) {
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
  }
}

// === ACTIONS ===
function copyMessage(btn) {
  const content = btn.closest('.message-row').querySelector('.message-content');
  const text = content.textContent.replace('📋 Copier', '').replace('🔄 Regénérer', '').replace('🌐 Recherche web effectuée', '').replace(/🖼️ \d* images trouvées/, '').trim();
  navigator.clipboard.writeText(text);
  btn.textContent = '✅ Copié !';
  setTimeout(() => { btn.textContent = '📋 Copier'; }, 2000);
}

async function regenerateMessage(btn) {
  const row = btn.closest('.message-row');
  const prevUserMessage = row.previousElementSibling;

  if (prevUserMessage && prevUserMessage.classList.contains('user')) {
    const text = prevUserMessage.querySelector('.message-content').textContent.trim();

    const chat = conversations[currentChatId];
    if (chat && chat.messages.length >= 2) {
      chat.messages.pop();
      chat.messages.pop();
      saveConversations();
    }

    row.remove();
    prevUserMessage.remove();

    userInput.value = text;
    await sendMessage();
  }
}

function quickAsk(text) {
  userInput.value = text;
  sendMessage();
}

// === IMAGES ===
function searchImages() {
  const query = prompt('🖼️ Rechercher des images de :');
  if (query) {
    userInput.value = `Montre-moi des images de ${query}`;
    sendMessage();
  }
}

function openImageModal(url, caption, source) {
  document.getElementById('imageModal').classList.add('active');
  document.getElementById('imageFull').src = url;
  document.getElementById('imageModalTitle').textContent = caption || 'Image';
  document.getElementById('imageInfo').innerHTML = `
    <p>${caption || ''}</p>
    <p style="color:var(--text-muted);font-size:12px;">Source : ${source || 'Web'}</p>
    <p style="margin-top:8px;"><a href="${url}" target="_blank" style="color:var(--accent-light);">🔗 Ouvrir l'image originale</a></p>
  `;
}

function closeImageModal() {
  document.getElementById('imageModal').classList.remove('active');
}

// === PIPELINE ===
function showPipeline() {
  document.getElementById('pipelineModal').classList.add('active');
}

function closePipeline() {
  document.getElementById('pipelineModal').classList.remove('active');
}

function updatePipelineModal(pipeline, stats) {
  const container = document.getElementById('pipelineContainer');
  if (!pipeline || pipeline.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">Envoie un message pour voir le pipeline</p>';
    return;
  }

  container.innerHTML = pipeline.map(step => `
    <div class="pipeline-step">
      <span class="step-number">${step.step}</span>
      <div class="step-info">
        <div class="step-name">${step.ia} — ${step.name}</div>
        <div class="step-desc">${step.result}</div>
      </div>
      <span class="step-time">${step.time}</span>
    </div>
  `).join('') + `
    <div class="pipeline-total">
      🎯 Traitement 20 IA terminé en ${stats?.processingTime || 0}ms
      ${stats?.searchPerformed ? ' · 🌐 Recherche web' : ''}
      ${stats?.imagesFound > 0 ? ` · 🖼️ ${stats.imagesFound} images` : ''}
    </div>
  `;
}

// === SETTINGS ===
function showSettings() {
  document.getElementById('settingsModal').classList.add('active');
  document.getElementById('settingName').value = memory.userName || '';
  document.getElementById('settingStyle').value = currentStyle;
  document.getElementById('settingImages').value = imageSearchMode;
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('active');

  const newName = document.getElementById('settingName').value.trim();
  if (newName && newName !== memory.userName) {
    memory.setUserName(newName);
    userNameDisplay.textContent = newName;
    document.getElementById('userAvatar').textContent = newName.charAt(0).toUpperCase();
  }

  currentStyle = document.getElementById('settingStyle').value;
  imageSearchMode = document.getElementById('settingImages').value;

  memory.setPreference('style', currentStyle);
  memory.setPreference('images', imageSearchMode);
}

// === PDF ===
async function importPDF(event) {
  const file = event.target.files[0];
  if (!file) return;
  addMessageToChat(`📄 Importation de "${file.name}"...`, 'bot');
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const typedarray = new Uint8Array(e.target.result);
      const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
      }
      addMessageToChat(`✅ PDF importé : ${pdf.numPages} pages, ${fullText.length} caractères`, 'bot');
    };
    reader.readAsArrayBuffer(file);
  } catch (error) {
    addMessageToChat('❌ Erreur lors de l\'importation du PDF.', 'bot');
  }
  event.target.value = '';
}

// === RECHERCHE WEB ===
function searchWeb() {
  const query = prompt('🔍 Rechercher sur le web :');
  if (query) {
    userInput.value = query;
    sendMessage();
  }
}

// === EXPORT ===
function exportData() {
  const data = {
    conversations,
    memory: { userName: memory.userName, preferences: memory.preferences },
    exportDate: new Date().toISOString(),
    version: '5.0.0'
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `minichatgpt-v5-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

// === AUTO-UPDATE ===
async function checkForUpdate() {
  try {
    const response = await fetch('https://api.github.com/repos/TON-USER/mini-chatgpt/releases/latest');
    const release = await response.json();
    const latestVersion = release.tag_name;
    const currentVersion = localStorage.getItem('appVersion') || 'v0';
    if (latestVersion !== currentVersion) {
      const update = confirm(`🔄 Nouvelle version disponible : ${latestVersion}\n\nMettre à jour ?`);
      if (update) {
        window.open(release.html_url, '_blank');
        localStorage.setItem('appVersion', latestVersion);
      }
    }
  } catch (e) {}
}

// === UTILITAIRES ===
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hidden');
}

function generateApiKey() {
  const fakeKey = 'mcp_v5_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
  document.getElementById('apiKeyDisplay').style.display = 'block';
  document.getElementById('apiKeyDisplay').innerHTML = `
    <div style="background:#0a0a14;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;word-break:break-all;">${fakeKey}</div>
    <p style="color:var(--warning);font-size:12px;margin-top:8px;">⚠️ Mode local. Déploie le serveur pour une vraie clé API.</p>
  `;
}

// === DÉMARRAGE ===
init();
