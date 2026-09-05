/* Notes Editor Engine, Slash Commands & Rich Markdown Processing */

let editingId = null;
let selectedNoteId = null;
let isRecording = false;
let recognition = null;
let editorMode = "write";
let slashActiveIndex = 0;
let currentSlashQuery = "";

const SLASH_COMMANDS = [
  { id: "h1", name: "Heading 1", trigger: "h1", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12h8"/><path d="M4 4v16"/><path d="M12 4v16"/><path d="m18 10 2-2v12"/></svg>`, desc: "Large section heading", template: "\n# Heading 1\n" },
  { id: "h2", name: "Heading 2", trigger: "h2", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12h8"/><path d="M4 4v16"/><path d="M12 4v16"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-1-2.5-2.5-2.5S16 10.5 16 12"/></svg>`, desc: "Medium section heading", template: "\n## Section Title\n" },
  { id: "h3", name: "Heading 3", trigger: "h3", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12h8"/><path d="M4 4v16"/><path d="M12 4v16"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>`, desc: "Small subsection heading", template: "\n### Subsection Title\n" },
  { id: "todo", name: "To-Do Checklist", trigger: "todo", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`, desc: "Interactive task checkbox", template: "\n- [ ] " },
  { id: "bullet", name: "Bulleted List", trigger: "bullet", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`, desc: "Unordered bullet point", template: "\n- " },
  { id: "num", name: "Numbered List", trigger: "num", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`, desc: "Sequential numbered list", template: "\n1. " },
  { id: "callout_note", name: "Callout: Note", trigger: "note", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--os-accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`, desc: "Highlighted info box", template: "\n> [!NOTE]\n> Key takeaway or insight here\n" },
  { id: "callout_tip", name: "Callout: Tip", trigger: "tip", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--os-success)" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`, desc: "Efficiency or best practice tip", template: "\n> [!TIP]\n> Pro-tip here\n" },
  { id: "callout_warn", name: "Callout: Warning", trigger: "warning", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--os-warning)" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, desc: "Attention / critical warning", template: "\n> [!WARNING]\n> Critical notice here\n" },
  { id: "callout_imp", name: "Callout: Important", trigger: "important", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--os-danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, desc: "High priority requirement", template: "\n> [!IMPORTANT]\n> Must-know requirement\n" },
  { id: "code", name: "Code Block", trigger: "code", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`, desc: "Syntax highlighted code snippet", template: "\n```javascript\n// Code snippet here\n```\n" },
  { id: "table", name: "Markdown Table", trigger: "table", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>`, desc: "2x3 Structured data grid", template: "\n| Item | Description | Status |\n|---|---|---|\n| Step 1 | Initial setup | Done |\n| Step 2 | Implementation | In Progress |\n" },
  { id: "quote", name: "Blockquote", trigger: "quote", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v6c0 4.4 2 8 3 8Zm13 0c3 0 7-1 7-8V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v6c0 4.4 2 8 3 8Z"/></svg>`, desc: "Capture a quote or reference", template: "\n> " },
  { id: "divider", name: "Divider Line", trigger: "hr", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>`, desc: "Visual horizontal break", template: "\n\n---\n\n" },
  { id: "date", name: "Date Stamp", trigger: "date", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`, desc: "Insert today's ISO date", template: () => `${getIsoDateStr()}` },
  { id: "time", name: "Time Stamp", trigger: "time", icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, desc: "Insert current time stamp", template: () => `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` }
];

const TEMPLATES = {
  Meeting: {
    topic: "Executive Standup Meeting",
    category: "Work",
    takeaway: "## Key Decisions\n- Approved single-file SPA architecture.\n- Implemented Apple Liquid Glass design system.\n\n## Next Steps\n- [ ] Execute performance benchmarks.\n- [ ] Review cloud sync latency."
  },
  Architecture: {
    topic: "System Architecture Proposal",
    category: "Code",
    takeaway: "## Overview\nModular CSS & JS architecture with zero external dependencies.\n\n> [!NOTE]\n> System designed for 60 FPS offline execution.\n\n## Core Metrics\n- Render Velocity: 60 FPS\n- Security: AES-256 WebCrypto Vault"
  },
  Learning: {
    topic: "Deep Work Learning Log",
    category: "Personal",
    takeaway: "## Key Concept\nProgressive disclosure in UI design prioritizes information hierarchy over visual density.\n\n> [!TIP]\n> Use slash commands `/` for rapid structured note taking."
  },
  Book: {
    topic: "Book / Article Summary",
    category: "Reference",
    takeaway: "## Core Thesis\nKey insight and central argument of the author.\n\n## Main Quotes\n> \"Simplicity is the ultimate sophistication.\"\n\n## Action Items\n- [ ] Apply principles to current project"
  },
  Bug: {
    topic: "Bug Analysis & Resolution",
    category: "Code",
    takeaway: "## Problem Description\nSymptoms and reproduction steps.\n\n## Root Cause\nAnalysis of the underlying fault.\n\n## Fix Implementation\n```javascript\n// Solution code\n```"
  },
  Journal: {
    topic: "Daily Reflection",
    category: "Personal",
    takeaway: "## Wins Today\n- Accomplished primary goal\n\n## Challenges & Blockers\n- \n\n## Gratitude\n- "
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
    const textVal = document.getElementById("takeaway") ? document.getElementById("takeaway").value : "";
    previewPane.innerHTML = parseMarkdownMentions(textVal, "preview-editor") || '<span style="color:var(--os-text-tertiary); font-style:italic;">Nothing to preview...</span>';
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

/* Modal Open & Close Mechanics */
function openNewNoteModal() {
  editingId = null;
  const form = document.getElementById("noteForm");
  if (form) form.reset();

  const formTitle = document.getElementById("formTitle");
  if (formTitle) formTitle.textContent = "New Note";

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.textContent = "Save Note";

  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.hidden = false;

  const tplSelect = document.getElementById("templateSelect");
  if (tplSelect) tplSelect.value = "";

  setEditorMode("write");
  updateCharCounter();

  const modal = document.getElementById("noteModal");
  if (modal && typeof modal.showModal === "function") {
    modal.showModal();
    const topicEl = document.getElementById("topic");
    if (topicEl) setTimeout(() => topicEl.focus(), 60);
  }
}

function closeNoteModal() {
  const modal = document.getElementById("noteModal");
  if (modal && typeof modal.close === "function") {
    modal.close();
  }
  editingId = null;
}

function selectNote(id) {
  selectedNoteId = id;
  const all = loadNotes();
  const searchInput = document.getElementById("search");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const catFilter = document.getElementById("filterCategory") ? document.getElementById("filterCategory").value : "ALL";
  const sort = document.getElementById("sortMode") ? document.getElementById("sortMode").value : "pinned";

  let filtered = all.filter(n => {
    const matchesCat = catFilter === "ALL" || n.category === catFilter;
    const matchesQuery = !query || 
      (n.topic && n.topic.toLowerCase().includes(query)) || 
      (n.title && n.title.toLowerCase().includes(query)) || 
      (n.takeaway && n.takeaway.toLowerCase().includes(query)) ||
      (n.content && n.content.toLowerCase().includes(query)) ||
      (Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(query))) ||
      (typeof n.tags === "string" && n.tags.toLowerCase().includes(query));
    return matchesCat && matchesQuery;
  });

  if (sort === "pinned") {
    filtered.sort((a, b) => {
      if (b.isPinned !== a.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  } else if (sort === "oldest") {
    filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } else if (sort === "topic") {
    filtered.sort((a, b) => (a.topic || a.title || "").localeCompare(b.topic || b.title || ""));
  } else {
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  renderNotesList(filtered);
  renderActiveNoteWorkspace(all);
}

function duplicateNote(id, e) {
  if (e && typeof e.stopPropagation === "function") e.stopPropagation();
  const notes = loadNotes();
  const target = notes.find(n => n.id === id);
  if (!target) return;

  const rawTitle = target.topic || target.title || "Untitled Note";
  const newTitle = rawTitle.endsWith("(Copy)") ? rawTitle : `${rawTitle} (Copy)`;
  const newNote = {
    ...target,
    id: typeof uuid === "function" ? uuid() : "note-" + Date.now(),
    title: newTitle,
    topic: newTitle,
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (typeof saveNoteSingle === "function") {
    saveNoteSingle(newNote);
  } else {
    notes.unshift(newNote);
    saveNotes(notes);
  }

  selectedNoteId = newNote.id;
  renderNotes();
  if (typeof showToast === "function") showToast("Note duplicated successfully!", "success");
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
}

function toggleNoteRowMenu(id, e) {
  if (e && typeof e.stopPropagation === "function") e.stopPropagation();
  const menu = document.getElementById(`noteMenu-${id}`);
  if (!menu) return;
  const isOpen = menu.style.display === "flex";
  closeAllNoteMenus();
  if (!isOpen) {
    menu.style.display = "flex";
  }
}

function toggleNotesActionMenu(e) {
  if (e && typeof e.stopPropagation === "function") e.stopPropagation();
  const menu = document.getElementById("notesActionMenuDropdown");
  if (!menu) return;
  const isOpen = menu.style.display === "flex";
  closeAllNoteMenus();
  if (!isOpen) {
    menu.style.display = "flex";
  }
}

function closeAllNoteMenus() {
  document.querySelectorAll(".note-card-menu-dropdown, .notes-actions-dropdown").forEach(m => m.style.display = "none");
}

/* Slash Command Controller */
function handleTakeawayInput(e) {
  updateCharCounter();
  const textarea = e.target;
  const val = textarea.value;
  const caretPos = textarea.selectionStart;
  const textBeforeCaret = val.substring(0, caretPos);

  const match = textBeforeCaret.match(/(?:^|\s)\/([a-zA-Z0-9_\-]*)$/);
  if (match) {
    currentSlashQuery = match[1].toLowerCase();
    showSlashMenu(currentSlashQuery);
  } else {
    hideSlashMenu();
  }
}

function handleTakeawayKeydown(e) {
  const menu = document.getElementById("slashCommandMenu");
  if (!menu || menu.style.display === "none") return;

  const items = menu.querySelectorAll(".slash-menu-item");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    slashActiveIndex = (slashActiveIndex + 1) % items.length;
    renderSlashMenuHighlight(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    slashActiveIndex = (slashActiveIndex - 1 + items.length) % items.length;
    renderSlashMenuHighlight(items);
  } else if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    const activeItem = items[slashActiveIndex];
    if (activeItem) {
      const cmdId = activeItem.getAttribute("data-cmd-id");
      insertSlashCommand(cmdId);
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    hideSlashMenu();
  }
}

function showSlashMenu(query = "") {
  const menu = document.getElementById("slashCommandMenu");
  if (!menu) return;

  const filtered = SLASH_COMMANDS.filter(c => {
    if (!query) return true;
    return c.trigger.toLowerCase().includes(query) || 
           c.name.toLowerCase().includes(query) || 
           c.desc.toLowerCase().includes(query);
  });

  if (!filtered.length) {
    hideSlashMenu();
    return;
  }

  slashActiveIndex = 0;
  menu.innerHTML = filtered.map((c, idx) => `
    <div class="slash-menu-item ${idx === 0 ? 'active' : ''}" data-cmd-id="${c.id}" onclick="insertSlashCommand('${c.id}')">
      <div class="slash-menu-icon">${c.icon}</div>
      <div class="slash-menu-info">
        <div class="slash-menu-title">
          <span>${escapeHTML(c.name)}</span>
          <span class="slash-menu-tag">/${c.trigger}</span>
        </div>
        <div class="slash-menu-desc">${escapeHTML(c.desc)}</div>
      </div>
    </div>
  `).join('');

  menu.style.display = "flex";
  menu.style.top = "10px";
  menu.style.left = "14px";
}

function renderSlashMenuHighlight(items) {
  items.forEach((item, idx) => {
    if (idx === slashActiveIndex) {
      item.classList.add("active");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("active");
    }
  });
}

function hideSlashMenu() {
  const menu = document.getElementById("slashCommandMenu");
  if (menu) menu.style.display = "none";
}

function openSlashMenuManual() {
  const textarea = document.getElementById("takeaway");
  if (!textarea) return;
  textarea.focus();
  const caret = textarea.selectionStart;
  textarea.value = textarea.value.substring(0, caret) + "/" + textarea.value.substring(caret);
  textarea.setSelectionRange(caret + 1, caret + 1);
  showSlashMenu("");
}

function insertSlashCommand(cmdId) {
  const textarea = document.getElementById("takeaway");
  if (!textarea) return;

  const cmd = SLASH_COMMANDS.find(c => c.id === cmdId);
  if (!cmd) return;

  const templateStr = typeof cmd.template === "function" ? cmd.template() : cmd.template;
  const val = textarea.value;
  const caret = textarea.selectionStart;
  const textBeforeCaret = val.substring(0, caret);
  const textAfterCaret = val.substring(caret);

  // Replace typed `/${query}` before caret
  const lastSlashIdx = textBeforeCaret.lastIndexOf("/");
  const prefix = (lastSlashIdx >= 0) ? textBeforeCaret.substring(0, lastSlashIdx) : textBeforeCaret;

  textarea.value = prefix + templateStr + textAfterCaret;
  const newCaretPos = prefix.length + templateStr.length;
  textarea.setSelectionRange(newCaretPos, newCaretPos);
  textarea.focus();

  hideSlashMenu();
  updateCharCounter();
  if (typeof FX !== "undefined") FX.playClick();
  if (typeof showToast === "function") showToast(`Inserted ${cmd.name}`, "info");
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
  let mdStr = `# DHARIN Notes Export (${getIsoDateStr()})\n\n`;
  notes.forEach(n => {
    mdStr += `## ${n.topic || n.title}\n**Category**: ${n.category} | **Date**: ${new Date(n.createdAt).toLocaleDateString()}\n\n${n.takeaway || n.content}\n\n---\n\n`;
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
  if (!key) return;
  const tpl = TEMPLATES[key] || TEMPLATES[key.toLowerCase()] || TEMPLATES[key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()];
  if (!tpl) return;
  const topicEl = document.getElementById("topic");
  const catEl = document.getElementById("category");
  const takeEl = document.getElementById("takeaway");

  if (topicEl) topicEl.value = tpl.topic;
  if (catEl) catEl.value = tpl.category;
  if (takeEl) takeEl.value = tpl.takeaway;
  updateCharCounter();
  if (typeof showToast === "function") showToast(`Applied ${key} template`, "info");
}

function updateCharCounter() {
  const el = document.getElementById("takeaway");
  const countEl = document.getElementById("charCount");
  if (!el || !countEl) return;
  const text = el.value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = el.value.length;
  countEl.textContent = `${words} word${words === 1 ? '' : 's'} • ${chars} chars`;
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
    if (btn) { btn.classList.add("recording"); btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Listening...`; }
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
    if (btn) { btn.classList.remove("recording"); btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Voice`; }
  };
  recognition.start();
}

function calcReadTime(text) {
  if (!text) return "1 min read";
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return `${mins} min read`;
}

function getNoteSnippet(text) {
  if (!text) return "No additional text";
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^>\s*\[![A-Z]+\]\s*/gim, "")
    .replace(/^#+\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^-\s*\[[ xX]\]\s*/gm, "")
    .replace(/^-\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNoteDateShort(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function copyCodeSnippet(btn) {
  const box = btn.closest(".note-code-box");
  if (!box) return;
  const code = box.querySelector("code");
  if (!code) return;
  navigator.clipboard.writeText(code.innerText).then(() => {
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = "Copy"; }, 2000);
  });
}

function toggleNoteChecklist(checkbox, noteId, lineIndex) {
  if (typeof FX !== "undefined") FX.playClick();
  const notes = loadNotes();
  const target = notes.find(n => n.id === noteId);
  if (!target) return;

  const content = target.takeaway || target.content || "";
  const lines = content.split("\n");

  let checkCounter = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\s*-\s*\[([ xX])\]\s*(.*)$/)) {
      if (checkCounter === lineIndex) {
        const isChecked = checkbox.checked;
        lines[i] = lines[i].replace(/^\s*-\s*\[([ xX])\]/, isChecked ? "- [x]" : "- [ ]");
        break;
      }
      checkCounter++;
    }
  }

  target.takeaway = lines.join("\n");
  target.content = target.takeaway;
  target.updatedAt = new Date().toISOString();

  if (typeof saveNoteSingle === "function") saveNoteSingle(target);
  else saveNotes(notes);

  renderNotes();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
}

function parseMarkdownMentions(text, noteId = "") {
  if (!text) return "";
  let html = escapeHTML(text);

  // 1. Code Blocks (```lang ... ```)
  html = html.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<div class="note-code-box">
      <div class="note-code-header">
        <span>${lang || 'CODE'}</span>
        <button type="button" class="note-code-copy-btn" onclick="copyCodeSnippet(this)">Copy</button>
      </div>
      <pre><code>${code.trim()}</code></pre>
    </div>`;
  });

  // 2. Callout Alerts (> [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT])
  html = html.replace(/^&gt;\s*\[!NOTE\]\n([\s\S]*?)(?=(?:\n\n|\n(?!&gt;)|$))/gim, (m, body) => {
    const cleanBody = body.replace(/^&gt;\s*/gm, '');
    return `<div class="note-callout callout-note"><div class="callout-header"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> NOTE</div><div>${cleanBody}</div></div>`;
  });
  html = html.replace(/^&gt;\s*\[!TIP\]\n([\s\S]*?)(?=(?:\n\n|\n(?!&gt;)|$))/gim, (m, body) => {
    const cleanBody = body.replace(/^&gt;\s*/gm, '');
    return `<div class="note-callout callout-tip"><div class="callout-header"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> TIP</div><div>${cleanBody}</div></div>`;
  });
  html = html.replace(/^&gt;\s*\[!WARNING\]\n([\s\S]*?)(?=(?:\n\n|\n(?!&gt;)|$))/gim, (m, body) => {
    const cleanBody = body.replace(/^&gt;\s*/gm, '');
    return `<div class="note-callout callout-warning"><div class="callout-header"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> WARNING</div><div>${cleanBody}</div></div>`;
  });
  html = html.replace(/^&gt;\s*\[!IMPORTANT\]\n([\s\S]*?)(?=(?:\n\n|\n(?!&gt;)|$))/gim, (m, body) => {
    const cleanBody = body.replace(/^&gt;\s*/gm, '');
    return `<div class="note-callout callout-important"><div class="callout-header"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> IMPORTANT</div><div>${cleanBody}</div></div>`;
  });

  // 3. Blockquotes
  html = html.replace(/^&gt;\s+(.*$)/gim, '<blockquote style="border-left:3px solid var(--os-accent); padding-left:12px; margin:10px 0; color:var(--os-text-secondary);">$1</blockquote>');

  // 4. Headings
  html = html.replace(/^### (.*$)/gim, '<h4 style="margin:14px 0 6px; font-weight:700; color:var(--os-accent); font-size:1rem;">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="margin:18px 0 8px; font-weight:700; color:var(--os-text); font-size:1.18rem; letter-spacing:-0.01em;">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="margin:22px 0 10px; font-weight:800; color:var(--os-text); font-size:1.35rem; letter-spacing:-0.02em;">$1</h2>');

  // 5. Interactive Checklists (- [ ] item, - [x] item)
  let checklistCounter = 0;
  html = html.replace(/^-\s*\[([ xX])\]\s*(.*$)/gim, (match, check, itemText) => {
    const isChecked = check.toLowerCase() === 'x';
    const idx = checklistCounter++;
    const clickHandler = noteId ? `onchange="toggleNoteChecklist(this, '${noteId}', ${idx})"` : '';
    return `<div class="note-todo-item ${isChecked ? 'checked' : ''}">
      <input type="checkbox" ${isChecked ? 'checked' : ''} ${clickHandler}>
      <span style="${isChecked ? 'text-decoration:line-through; opacity:0.6;' : ''}">${itemText}</span>
    </div>`;
  });

  // 6. Markdown Tables (| ... |)
  html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
    const rows = match.trim().split('\n').filter(r => !r.includes('---'));
    if (!rows.length) return match;
    let tableHTML = '<table class="note-table">';
    rows.forEach((r, idx) => {
      const cols = r.split('|').filter((c, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());
      tableHTML += '<tr>';
      cols.forEach(c => {
        tableHTML += idx === 0 ? `<th>${c}</th>` : `<td>${c}</td>`;
      });
      tableHTML += '</tr>';
    });
    tableHTML += '</table>';
    return tableHTML;
  });

  // 7. Dividers (---)
  html = html.replace(/^---$/gim, '<hr class="note-hr">');

  // 8. Bold & Italics
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; font-family:var(--font-code); color:var(--os-accent); font-size:0.82rem;">$1</code>');

  // 9. Bullet & Numbered lists
  html = html.replace(/^\-\s+(.*$)/gim, '• $1<br>');
  html = html.replace(/^(\d+)\.\s+(.*$)/gim, '<strong style="color:var(--os-accent);">$1.</strong> $2<br>');

  return html;
}

function renderNotes() {
  const all = loadNotes();
  const searchInput = document.getElementById("search");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const catFilter = document.getElementById("filterCategory") ? document.getElementById("filterCategory").value : "ALL";
  const sort = document.getElementById("sortMode") ? document.getElementById("sortMode").value : "pinned";

  let filtered = all.filter(n => {
    const matchesCat = catFilter === "ALL" || n.category === catFilter;
    const matchesQuery = !query || 
      (n.topic && n.topic.toLowerCase().includes(query)) || 
      (n.title && n.title.toLowerCase().includes(query)) || 
      (n.takeaway && n.takeaway.toLowerCase().includes(query)) ||
      (n.content && n.content.toLowerCase().includes(query)) ||
      (Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(query))) ||
      (typeof n.tags === "string" && n.tags.toLowerCase().includes(query));
    return matchesCat && matchesQuery;
  });

  if (sort === "pinned") {
    filtered.sort((a, b) => {
      if (b.isPinned !== a.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  } else if (sort === "oldest") {
    filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } else if (sort === "topic") {
    filtered.sort((a, b) => (a.topic || a.title || "").localeCompare(b.topic || b.title || ""));
  } else {
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  // Update subtitle note count
  const notesSummaryCount = document.getElementById("notesSummaryCount");
  if (notesSummaryCount) {
    notesSummaryCount.textContent = `${all.length} note${all.length === 1 ? '' : 's'} total • ${filtered.length} visible`;
  }
  const statTotal = document.getElementById("statTotal");
  if (statTotal) statTotal.textContent = all.length;

  // Determine selectedNoteId
  if (!selectedNoteId || !all.some(n => n.id === selectedNoteId)) {
    if (filtered.length > 0) {
      selectedNoteId = filtered[0].id;
    } else if (all.length > 0) {
      selectedNoteId = all[0].id;
    } else {
      selectedNoteId = null;
    }
  }

  renderNotesList(filtered);
  renderActiveNoteWorkspace(all);
}

function renderNotesList(filtered) {
  const listContainer = document.getElementById("notesListScroll");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  if (!filtered || !filtered.length) {
    listContainer.innerHTML = `
      <div style="padding:32px 16px; text-align:center; color:var(--os-text-tertiary); font-size:0.82rem;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:6px; opacity:0.6;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <div>No matching notes</div>
      </div>
    `;
    return;
  }

  filtered.forEach(note => {
    const isSelected = note.id === selectedNoteId;
    const row = document.createElement("div");
    row.className = `note-sidebar-row ${isSelected ? 'active' : ''} ${note.isPinned ? 'pinned' : ''}`;
    row.onclick = () => selectNote(note.id);

    const dateStr = formatNoteDateShort(note.updatedAt || note.createdAt);
    const noteTitle = note.topic || note.title || "Untitled Note";
    const noteBody = note.takeaway || note.content || "";
    const snippet = getNoteSnippet(noteBody);

    row.innerHTML = `
      <div class="note-sidebar-row-header">
        <span class="note-sidebar-title" title="${escapeHTML(noteTitle)}">${escapeHTML(noteTitle)}</span>
        <div class="note-sidebar-badges">
          ${note.isPinned ? `<span class="note-pin-indicator" title="Pinned Note"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg></span>` : ''}
          <span class="badge">${escapeHTML(note.category || 'General')}</span>
        </div>
      </div>
      <div class="note-sidebar-snippet">${escapeHTML(snippet)}</div>
      <div class="note-sidebar-meta">
        <span>${dateStr} • ${calcReadTime(noteBody)}</span>
        <div class="note-card-menu-wrap" onclick="event.stopPropagation()">
          <button type="button" class="note-menu-trigger-btn" onclick="toggleNoteRowMenu('${note.id}', event)" title="Note options" aria-label="Note options">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/></svg>
          </button>
          <div id="noteMenu-${note.id}" class="note-card-menu-dropdown" style="display:none;">
            <button type="button" class="note-menu-item" onclick="closeAllNoteMenus(); editNote('${note.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>Edit Note</span>
            </button>
            <button type="button" class="note-menu-item" onclick="closeAllNoteMenus(); togglePinNote('${note.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>
              <span>${note.isPinned ? 'Unpin Note' : 'Pin to Top'}</span>
            </button>
            <button type="button" class="note-menu-item" onclick="closeAllNoteMenus(); duplicateNote('${note.id}', event)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Duplicate</span>
            </button>
            <div class="note-menu-divider"></div>
            <button type="button" class="note-menu-item destructive" onclick="closeAllNoteMenus(); deleteNote('${note.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Delete Note</span>
            </button>
          </div>
        </div>
      </div>
    `;
    listContainer.appendChild(row);
  });
}

function renderActiveNoteWorkspace(allNotes) {
  const workspace = document.getElementById("notesMainWorkspace");
  if (!workspace) return;
  workspace.innerHTML = "";

  const notes = allNotes || loadNotes();
  const target = notes.find(n => n.id === selectedNoteId);

  if (!target) {
    workspace.innerHTML = `
      <div class="notes-workspace-empty">
        <div class="notes-empty-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <h3 class="notes-empty-title">${notes.length === 0 ? 'No Notes Yet' : 'No Note Selected'}</h3>
        <p class="notes-empty-subtitle">${notes.length === 0 ? 'Capture ideas, architecture specs, and markdown checklists.' : 'Select a note from the list on the left to read and review.'}</p>
        <button type="button" class="btn-apple-primary" onclick="openNewNoteModal()" style="margin-top:12px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Create Note</span>
        </button>
      </div>
    `;
    return;
  }

  const noteTitle = target.topic || target.title || "Untitled Note";
  const noteBody = target.takeaway || target.content || "";
  const dateCreated = target.createdAt ? new Date(target.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "";
  const dateUpdated = target.updatedAt ? new Date(target.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
  const dateDisplayStr = dateCreated ? (dateUpdated ? `${dateCreated} at ${dateUpdated}` : dateCreated) : "";

  let tagsHtml = "";
  let tagList = [];
  if (Array.isArray(target.tags)) tagList = target.tags;
  else if (typeof target.tags === "string" && target.tags) tagList = target.tags.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean);
  if (tagList.length > 0) {
    tagsHtml = `<div class="note-doc-tags-row">` + tagList.map(t => `<span class="note-doc-tag-pill">#${escapeHTML(t)}</span>`).join('') + `</div>`;
  }

  workspace.innerHTML = `
    <div class="note-doc-container">
      <div class="note-doc-header">
        <div class="note-doc-header-main">
          <h1 class="note-doc-title">${escapeHTML(noteTitle)}</h1>
          <div class="note-doc-actions">
            <button type="button" class="btn-apple-secondary" onclick="editNote('${target.id}')" title="Edit Note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>Edit</span>
            </button>
            <div class="note-card-menu-wrap" onclick="event.stopPropagation()">
              <button type="button" class="note-menu-trigger-btn" onclick="toggleNoteRowMenu('workspace-${target.id}', event)" title="More options" aria-label="More options" style="width:32px; height:32px; border-radius:6px; background:rgba(255,255,255,0.05) !important;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/></svg>
              </button>
              <div id="noteMenu-workspace-${target.id}" class="note-card-menu-dropdown" style="display:none;">
                <button type="button" class="note-menu-item" onclick="closeAllNoteMenus(); editNote('${target.id}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <span>Edit Note</span>
                </button>
                <button type="button" class="note-menu-item" onclick="closeAllNoteMenus(); togglePinNote('${target.id}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>
                  <span>${target.isPinned ? 'Unpin Note' : 'Pin to Top'}</span>
                </button>
                <button type="button" class="note-menu-item" onclick="closeAllNoteMenus(); duplicateNote('${target.id}', event)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>Duplicate Note</span>
                </button>
                <div class="note-menu-divider"></div>
                <button type="button" class="note-menu-item destructive" onclick="closeAllNoteMenus(); deleteNote('${target.id}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  <span>Delete Note</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="note-doc-meta">
          <span class="badge">${escapeHTML(target.category || 'General')}</span>
          ${dateDisplayStr ? `
            <span class="note-doc-meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${dateDisplayStr}
            </span>` : ''}
          <span class="note-doc-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${calcReadTime(noteBody)}
          </span>
          ${target.isPinned ? `
            <span class="note-doc-meta-pin">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>
              Pinned
            </span>` : ''}
        </div>

        ${tagsHtml}
      </div>

      <div class="note-doc-divider"></div>

      <div class="note-doc-body">
        ${parseMarkdownMentions(noteBody, target.id) || '<div style="color:var(--os-text-tertiary); font-style:italic; padding:20px 0;">No content in this note. Click "Edit" to add your takeaways and notes.</div>'}
      </div>
    </div>
  `;
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
  const tagsEl = document.getElementById("tags");
  const formTitle = document.getElementById("formTitle");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");

  if (formTitle) formTitle.textContent = "Edit Note";
  if (topicEl) topicEl.value = target.topic || target.title || "";
  if (categoryEl) categoryEl.value = target.category || "General";
  if (takeawayEl) takeawayEl.value = target.takeaway || target.content || "";
  if (isPinnedEl) isPinnedEl.checked = !!target.isPinned;
  if (tagsEl) {
    tagsEl.value = Array.isArray(target.tags) ? target.tags.join(", ") : (target.tags || "");
  }
  if (cancelBtn) cancelBtn.hidden = false;
  if (saveBtn) saveBtn.textContent = "Update Note";

  updateCharCounter();
  setEditorMode("write");

  const modal = document.getElementById("noteModal");
  if (modal && typeof modal.showModal === "function") {
    modal.showModal();
    if (topicEl) setTimeout(() => topicEl.focus(), 60);
  }
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
    if (typeof showToast === "function") showToast(target.isPinned ? "Note pinned to top!" : "Note unpinned.", "info");
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
  if (selectedNoteId === id) {
    selectedNoteId = null;
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
  const tagsEl = document.getElementById("tags");

  if (!topicEl || !takeawayEl) return;

  const topic = topicEl.value.trim();
  const category = categoryEl ? categoryEl.value : "General";
  const takeaway = takeawayEl.value.trim();
  const isPinned = isPinnedEl ? isPinnedEl.checked : false;
  const tagsStr = tagsEl ? tagsEl.value.trim() : "";
  const tagsList = tagsStr ? tagsStr.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean) : [];

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

  let savedNoteId = editingId;

  if (editingId) {
    const notes = loadNotes();
    const idx = notes.findIndex(n => n.id === editingId);
    if (idx >= 0) {
      notes[idx] = {
        ...notes[idx],
        title: topic,
        topic: topic,
        category: category,
        content: takeaway,
        takeaway: takeaway,
        tags: tagsList,
        isPinned,
        updatedAt: new Date().toISOString()
      };
      if (typeof saveNoteSingle === "function") saveNoteSingle(notes[idx]);
      else saveNotes(notes);
      if (typeof showToast === "function") showToast("Note updated successfully!", "success");
    }
    editingId = null;
  } else {
    const newId = typeof uuid === "function" ? uuid() : "note-" + Date.now();
    savedNoteId = newId;
    const newNote = {
      id: newId,
      title: topic,
      topic: topic,
      category: category,
      content: takeaway,
      takeaway: takeaway,
      tags: tagsList,
      isPinned: isPinned,
      isVault: false,
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

  closeNoteModal();
  selectedNoteId = savedNoteId;
  renderNotes();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
}

// Global click listener for closing menus on outside click
if (typeof window !== "undefined") {
  window.addEventListener("click", (e) => {
    if (!e.target.closest(".note-card-menu-wrap") && !e.target.closest(".notes-actions-menu-wrap")) {
      closeAllNoteMenus();
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    const noteForm = document.getElementById("noteForm");
    if (noteForm) {
      noteForm.removeEventListener("submit", handleSaveNote);
      noteForm.addEventListener("submit", handleSaveNote);
    }
    renderNotes();
  });
}

// Global window attachments
window.openNewNoteModal = openNewNoteModal;
window.closeNoteModal = closeNoteModal;
window.editNote = editNote;
window.selectNote = selectNote;
window.duplicateNote = duplicateNote;
window.togglePinNote = togglePinNote;
window.deleteNote = deleteNote;
window.handleSaveNote = handleSaveNote;
window.toggleNoteRowMenu = toggleNoteRowMenu;
window.toggleNotesActionMenu = toggleNotesActionMenu;
window.closeAllNoteMenus = closeAllNoteMenus;
window.renderNotes = renderNotes;
window.setEditorMode = setEditorMode;
window.applyTemplate = applyTemplate;
window.formatMarkdown = formatMarkdown;
window.openSlashMenuManual = openSlashMenuManual;
window.insertSlashCommand = insertSlashCommand;
window.toggleVoiceDictation = toggleVoiceDictation;
window.handleTakeawayInput = handleTakeawayInput;
window.handleTakeawayKeydown = handleTakeawayKeydown;
window.exportNotesJSON = exportNotesJSON;
window.exportNotesMarkdown = exportNotesMarkdown;
window.handleImportFile = handleImportFile;
window.copyCodeSnippet = copyCodeSnippet;
window.toggleNoteChecklist = toggleNoteChecklist;

