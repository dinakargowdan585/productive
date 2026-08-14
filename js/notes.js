/* Notes Editor Engine & Markdown Processing */

let editingId = null;
let isRecording = false;
let recognition = null;
let editorMode = "write";

const TEMPLATES = {
  Meeting: {
    topic: "Executive Standup Meeting",
    category: "Architecture",
    takeaway: "## 🎯 Key Decisions\n- Approved single-file SPA architecture.\n- Implemented Apple Liquid Glass design system.\n\n## 📋 Next Steps\n- Execute performance benchmarks."
  },
  Architecture: {
    topic: "System Architecture Proposal",
    category: "Architecture",
    takeaway: "## 🏗️ Overview\nModular CSS & JS architecture with zero external dependencies.\n\n## ⚡ Core Metrics\n- Render Velocity: 60 FPS\n- Security: AES-256 WebCrypto Vault"
  },
  Learning: {
    topic: "Deep Work Learning Log",
    category: "Learning",
    takeaway: "## 💡 Key Concept\nProgressive disclosure in UI design prioritizes information hierarchy over visual density.\n\n## 🔗 Mentions\n- @Task: Review Q3 System Architecture"
  }
};

function setEditorMode(mode) {
  editorMode = mode;
  const writePane = document.getElementById("writePane");
  const previewPane = document.getElementById("previewPane");
  const modeWriteBtn = document.getElementById("modeWriteBtn");
  const modePreviewBtn = document.getElementById("modePreviewBtn");

  if (!writePane || !previewPane) return;

  if (mode === "preview") {
    previewPane.innerHTML = parseMarkdownMentions(document.getElementById("takeaway").value) || '<span style="color:var(--muted)">Nothing to preview...</span>';
    writePane.style.display = "none";
    previewPane.style.display = "block";
    if (modeWriteBtn) modeWriteBtn.classList.remove("active");
    if (modePreviewBtn) modePreviewBtn.classList.add("active");
  } else {
    writePane.style.display = "block";
    previewPane.style.display = "none";
    if (modeWriteBtn) modeWriteBtn.classList.add("active");
    if (modePreviewBtn) modePreviewBtn.classList.remove("active");
  }
}

function formatMarkdown(type) {
  const textarea = document.getElementById("takeaway");
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  let replacement = "";

  if (type === "bold") replacement = `**${selectedText || 'bold text'}**`;
  else if (type === "italic") replacement = `*${selectedText || 'italic text'}*`;
  else if (type === "heading") replacement = `\n## ${selectedText || 'Heading Title'}\n`;
  else if (type === "code") replacement = `\`${selectedText || 'code snippet'}\``;
  else if (type === "list") replacement = `\n- ${selectedText || 'List item'}`;
  else if (type === "quote") replacement = `\n> ${selectedText || 'Quote text'}`;

  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
  updateCharCounter();
  textarea.focus();
}

function cancelEditing() {
  editingId = null;
  const form = document.getElementById("noteForm");
  if (form) form.reset();
  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.hidden = true;
  setEditorMode("write");
  updateCharCounter();
}

function exportNotesJSON() {
  const notes = loadNotes();
  const jsonStr = JSON.stringify(notes, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notes_export_${getIsoDateStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === "function") showToast("Exported notes JSON!", "success");
}

function exportNotesMarkdown() {
  const notes = loadNotes();
  let mdStr = `# Productive OS Notes Export (${getIsoDateStr()})\n\n`;
  notes.forEach(n => {
    mdStr += `## ${n.topic}\n**Category**: ${n.category} | **Date**: ${new Date(n.createdAt).toLocaleDateString()}\n\n${n.takeaway}\n\n---\n\n`;
  });
  const blob = new Blob([mdStr], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notes_export_${getIsoDateStr()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === "function") showToast("Exported notes Markdown!", "success");
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  importAppDataJSON(file);
}

function applyTemplate(key) {
  if (!key || !TEMPLATES[key]) return;
  const tpl = TEMPLATES[key];
  document.getElementById("topic").value = tpl.topic;
  document.getElementById("category").value = tpl.category;
  document.getElementById("takeaway").value = tpl.takeaway;
  updateCharCounter();
  if (typeof showToast === "function") showToast(`Applied ${key} template`, "info");
}

function updateCharCounter() {
  const el = document.getElementById("takeaway");
  const countEl = document.getElementById("charCount");
  if (el && countEl) countEl.textContent = `${el.value.length}/1000`;
}

function toggleVoiceDictation() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (typeof showToast === "function") showToast("Voice recognition is not supported in this browser.", "error");
    return;
  }
  const btn = document.getElementById("voiceBtn");
  if (isRecording && recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.onstart = () => {
    isRecording = true;
    if (btn) { btn.classList.add("recording"); btn.innerHTML = `🎙️ Listening...`; }
  };
  recognition.onresult = (e) => {
    const transcript = e.results[e.results.length - 1][0].transcript;
    const t = document.getElementById("takeaway");
    if (t) {
      t.value = (t.value + " " + transcript).trim();
      updateCharCounter();
    }
  };
  recognition.onerror = recognition.onend = () => {
    isRecording = false;
    if (btn) { btn.classList.remove("recording"); btn.innerHTML = `🎙️ Voice`; }
  };
  recognition.start();
}

function calcReadTime(text) {
  if (!text) return "1 min";
  const words = text.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return `${mins} min`;
}

function parseMarkdownMentions(text) {
  if (!text) return "";
  let html = escapeHTML(text);
  
  // Format Headings
  html = html.replace(/^### (.*$)/gim, '<h4 style="margin:8px 0; font-weight:700; color:var(--accent);">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="margin:10px 0; font-weight:800; color:var(--text);">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="margin:12px 0; font-weight:800; color:var(--text);">$1</h2>');

  // Format Bold & Italics
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Format Linebreaks & Lists
  html = html.replace(/^\- (.*$)/gim, '• $1');
  
  return html;
}

function renderNotes() {
  const all = loadNotes();
  const searchInput = document.getElementById("search");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const catFilter = document.getElementById("filterCategory") ? document.getElementById("filterCategory").value : "ALL";
  const sort = document.getElementById("sortMode") ? document.getElementById("sortMode").value : "newest";

  let filtered = all.filter(n => {
    const matchesCat = catFilter === "ALL" || n.category === catFilter;
    const matchesQuery = !query || (n.topic && n.topic.toLowerCase().includes(query)) || (n.takeaway && n.takeaway.toLowerCase().includes(query));
    return matchesCat && matchesQuery;
  });

  if (sort === "pinned") filtered.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  else if (sort === "oldest") filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  else filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const container = document.getElementById("notesGrid");
  if (!container) return;
  container.innerHTML = "";

  const statTotal = document.getElementById("statTotal");
  if (statTotal) statTotal.textContent = all.length;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><h3>No notes found</h3><p>Create your first note in the sidebar form.</p></div>`;
    return;
  }

  filtered.forEach(note => {
    const card = document.createElement("article");
    card.className = `note-card ${note.isPinned ? 'pinned' : ''}`;
    const dateStr = new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    card.innerHTML = `
      <div class="note-header">
        <div class="note-title">${escapeHTML(note.topic)}</div>
        <span class="badge">${escapeHTML(note.category)}</span>
      </div>
      <div class="note-body">${parseMarkdownMentions(note.takeaway)}</div>
      <div class="note-footer">
        <span>📅 ${dateStr} • ⏱️ ${calcReadTime(note.takeaway)}</span>
        <div style="display:flex; gap:6px;">
          <button type="button" class="secondary" onclick="editNote('${note.id}')" style="padding:3px 8px; font-size:0.75rem;">Edit</button>
          <button type="button" class="secondary" onclick="togglePinNote('${note.id}')" style="padding:3px 8px; font-size:0.75rem;">${note.isPinned ? '📌 Pinned' : 'Pin'}</button>
          <button type="button" class="secondary" onclick="deleteNote('${note.id}')" style="padding:3px 8px; font-size:0.75rem; color:var(--danger);">Delete</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function editNote(id) {
  const notes = loadNotes();
  const target = notes.find(n => n.id === id);
  if (!target) return;

  editingId = id;
  const topicEl = document.getElementById("topic");
  const categoryEl = document.getElementById("category");
  const takeawayEl = document.getElementById("takeaway");
  const isPinnedEl = document.getElementById("isPinned");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const saveBtn = document.getElementById("saveBtn");

  if (topicEl) topicEl.value = target.topic || "";
  if (categoryEl) categoryEl.value = target.category || "General";
  if (takeawayEl) takeawayEl.value = target.takeaway || "";
  if (isPinnedEl) isPinnedEl.checked = !!target.isPinned;
  if (cancelBtn) cancelBtn.hidden = false;
  if (saveBtn) saveBtn.textContent = "Update Note";

  updateCharCounter();
  setEditorMode("write");
  if (topicEl) topicEl.focus();
}

function togglePinNote(id) {
  const notes = loadNotes();
  const target = notes.find(n => n.id === id);
  if (target) {
    target.isPinned = !target.isPinned;
    target.updatedAt = new Date().toISOString();
    if (typeof saveNoteSingle === "function") saveNoteSingle(target);
    else saveNotes(notes);
    renderNotes();
    if (typeof showToast === "function") showToast(target.isPinned ? "Note pinned!" : "Note unpinned.", "info");
  }
}

function deleteNote(id) {
  if (typeof deleteNoteSingle === "function") {
    deleteNoteSingle(id);
  } else {
    let notes = loadNotes();
    notes = notes.filter(n => n.id !== id);
    saveNotes(notes);
  }
  renderNotes();
  if (typeof showToast === "function") showToast("Note deleted.", "info");
}

function handleSaveNote(e) {
  if (e) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
  }
  const topicEl = document.getElementById("topic");
  const categoryEl = document.getElementById("category");
  const takeawayEl = document.getElementById("takeaway");
  const isPinnedEl = document.getElementById("isPinned");

  if (!topicEl || !takeawayEl) return;

  const topic = topicEl.value.trim();
  const category = categoryEl ? categoryEl.value : "General";
  const takeaway = takeawayEl.value.trim();
  const isPinned = isPinnedEl ? isPinnedEl.checked : false;

  if (!topic) {
    if (typeof showToast === "function") showToast("Please enter a Topic Title for the note.", "error");
    topicEl.focus();
    return;
  }

  if (!takeaway) {
    if (typeof showToast === "function") showToast("Please enter Takeaway / Note Content.", "error");
    if (typeof setEditorMode === "function") setEditorMode("write");
    takeawayEl.focus();
    return;
  }

  if (editingId) {
    const notes = loadNotes();
    const idx = notes.findIndex(n => n.id === editingId);
    if (idx >= 0) {
      notes[idx] = {
        ...notes[idx],
        topic,
        category,
        takeaway,
        isPinned,
        updatedAt: new Date().toISOString()
      };
      if (typeof saveNoteSingle === "function") saveNoteSingle(notes[idx]);
      else saveNotes(notes);
      if (typeof showToast === "function") showToast("Note updated successfully!", "success");
    }
    editingId = null;
  } else {
    const newNote = {
      id: typeof uuid === "function" ? uuid() : "note-" + Date.now(),
      topic,
      category,
      takeaway,
      isPinned,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (typeof saveNoteSingle === "function") {
      saveNoteSingle(newNote);
    } else {
      const notes = loadNotes();
      notes.unshift(newNote);
      saveNotes(notes);
    }
    if (typeof showToast === "function") showToast("Note saved successfully!", "success");
  }

  const form = document.getElementById("noteForm");
  if (form) form.reset();

  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.hidden = true;

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.textContent = "Save Note";

  setEditorMode("write");
  updateCharCounter();
  renderNotes();
}

// Auto-bind form listener on DOM ready
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const noteForm = document.getElementById("noteForm");
    if (noteForm) {
      noteForm.removeEventListener("submit", handleSaveNote);
      noteForm.addEventListener("submit", handleSaveNote);
    }
    renderNotes();
  });
}
