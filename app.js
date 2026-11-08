const STORAGE_KEY = 'hem-och-hard-data-v1';

const starterData = {
  tasks: [
    { id: 'task-1', title: 'Rensa förråd', category: 'Inomhus' },
    { id: 'task-2', title: 'Rensa ogräs', category: 'Trädgård' },
    { id: 'task-3', title: 'Kratta löv', category: 'Trädgård' },
    { id: 'task-4', title: 'Rensa hängrännor', category: 'Underhåll' },
    { id: 'task-5', title: 'Olja altanen', category: 'Underhåll' },
    { id: 'task-6', title: 'Byta batteri i brandvarnaren', category: 'Inomhus' },
  ],
  projects: [
    { id: 'project-1', title: 'Helgen v. 45', description: 'En skön nystart ute och inne.', items: [
      { taskId: 'task-1', done: false }, { taskId: 'task-2', done: false },
      { taskId: 'task-3', done: false }, { taskId: 'task-4', done: false },
    ] },
    { id: 'project-2', title: 'Höstfix i trädgården', description: 'Gör trädgården redo för vintern.', items: [
      { taskId: 'task-3', done: true }, { taskId: 'task-5', done: false },
    ] },
  ],
};

let data = loadData();
let activeProjectId = null;
let modalMode = '';
let toastTimer;

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(starterData);
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.projects)) throw new Error('Ogiltigt lokalt format');
    return parsed;
  } catch (error) {
    console.error('Kunde inte läsa sparade Hem & Härd-data.', error);
    return structuredClone(starterData);
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Kunde inte spara Hem & Härd-data.', error);
    showToast('Kunde inte spara ändringen i webbläsaren.');
  }
}

function taskById(id) {
  return data.tasks.find((task) => task.id === id);
}

function projectById(id) {
  return data.projects.find((project) => project.id === id);
}

function progress(project) {
  const total = project.items.length;
  const done = project.items.filter((item) => item.done).length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

function showView(name) {
  const viewIds = ['home', 'projects', 'library', 'project'];
  viewIds.forEach((view) => byId(`${view}-view`).classList.toggle('hidden', view !== name));
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === (name === 'project' ? 'projects' : name));
  });
  const names = { home: 'Överblick', projects: 'Projekt', library: 'Uppgiftsboden', project: 'Projekt' };
  byId('breadcrumb-current').textContent = name === 'project' && projectById(activeProjectId)
    ? projectById(activeProjectId).title : names[name];
  if (name === 'project') renderProjectDetail();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  renderSidebar();
  renderHome();
  renderProjects();
  renderLibrary();
  if (activeProjectId && !byId('project-view').classList.contains('hidden')) renderProjectDetail();
}

function renderSidebar() {
  byId('project-count').textContent = data.projects.length;
  byId('project-nav-list').innerHTML = data.projects.slice(0, 5).map((project) => `
    <button class="project-nav-item" data-project-id="${escapeHtml(project.id)}">
      <span aria-hidden="true">▤</span><span>${escapeHtml(project.title)}</span><span class="nav-task-count">${project.items.filter((item) => !item.done).length}</span>
    </button>`).join('');
}

function projectCard(project) {
  const state = progress(project);
  const icons = ['▤', '⌂', '✿', '⚒'];
  const icon = icons[Math.abs(project.title.length) % icons.length];
  return `<article class="project-card" data-project-id="${escapeHtml(project.id)}" tabindex="0" role="button" aria-label="Öppna projekt ${escapeHtml(project.title)}" style="--card-accent:${state.percent === 100 ? '#78856b' : '#a8744c'}">
    <div class="project-card-top"><span class="project-glyph">${icon}</span><span class="project-date">${state.total ? `${state.done} av ${state.total} klara` : 'Nytt projekt'}</span></div>
    <h3>${escapeHtml(project.title)}</h3><div class="project-meta">${escapeHtml(project.description || 'Dina uppgifter, samlade på ett ställe.')}</div>
    <div class="card-progress"><span style="width:${state.percent}%"></span></div>
    <div class="card-progress-caption"><span>${state.total ? 'Framsteg' : 'Lägg till en uppgift för att komma igång'}</span><span>${state.percent}%</span></div>
  </article>`;
}

function emptyState(title, message, buttonText, action) {
  return `<div class="empty-state"><span class="empty-state-icon">⌂</span><h3>${title}</h3><p>${message}</p><button class="button button-dark" data-action="${action}"><span>＋</span> ${buttonText}</button></div>`;
}

function renderHome() {
  const allItems = data.projects.flatMap((project) => project.items.map((item) => ({ project, item, task: taskById(item.taskId) })).filter((entry) => entry.task));
  const openCount = allItems.filter((entry) => !entry.item.done).length;
  const doneCount = allItems.filter((entry) => entry.item.done).length;
  byId('stat-projects').textContent = data.projects.length;
  byId('stat-open').textContent = openCount;
  byId('stat-done').textContent = doneCount;
  byId('home-project-grid').innerHTML = data.projects.length
    ? data.projects.slice(0, 3).map(projectCard).join('')
    : emptyState('Här börjar det.', 'Skapa ett projekt och samla uppgifter som du vill få gjorda.', 'Skapa ditt första projekt', 'create-project');
  byId('next-up-list').innerHTML = allItems.filter((entry) => !entry.item.done).slice(0, 4).map(({ project, item, task }) => `
    <div class="next-task"><button class="task-check" data-toggle-task="${escapeHtml(project.id)}:${escapeHtml(item.taskId)}" aria-label="Markera ${escapeHtml(task.title)} som klar"></button>
      <div class="next-task-copy"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(project.title)}</span></div>
    </div>`).join('') || '<p class="empty-inline">Allt är avbockat! Eller så väntar ditt första projekt på att skapas.</p>';
}

function renderProjects() {
  byId('all-projects-grid').innerHTML = data.projects.length
    ? data.projects.map(projectCard).join('')
    : emptyState('Inga projekt ännu.', 'Börja med en helgplan, ett rum eller en säsongslista.', 'Skapa ditt första projekt', 'create-project');
}

function renderLibrary() {
  byId('library-count').textContent = `${data.tasks.length} sparade ${data.tasks.length === 1 ? 'uppgift' : 'uppgifter'}`;
  byId('library-list').innerHTML = data.tasks.length ? data.tasks.map((task) => {
    const usedIn = data.projects.filter((project) => project.items.some((item) => item.taskId === task.id)).length;
    return `<article class="library-item"><span class="library-item-icon" aria-hidden="true">▧</span>
      <div class="library-item-copy"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.category || 'Övrigt')} · Används i ${usedIn} ${usedIn === 1 ? 'projekt' : 'projekt'}</span></div>
      <div class="library-item-actions"><button class="small-action" data-add-to-project="${escapeHtml(task.id)}">Lägg i projekt</button><button class="small-action danger" data-delete-task="${escapeHtml(task.id)}" aria-label="Ta bort ${escapeHtml(task.title)}">Ta bort</button></div>
    </article>`;
  }).join('') : emptyState('Uppgiftsboden är tom.', 'Spara en uppgift här så kan du plocka in den i ett projekt när det passar.', 'Spara första uppgiften', 'create-task');
}

function renderProjectDetail() {
  const project = projectById(activeProjectId);
  if (!project) { showView('projects'); return; }
  const state = progress(project);
  byId('detail-title').textContent = project.title;
  byId('detail-description').textContent = project.description || 'Här samlas allt som hör till projektet.';
  byId('detail-progress-text').textContent = `${state.done} av ${state.total} klart`;
  byId('detail-progress-percent').textContent = `${state.percent}%`;
  byId('detail-progress-bar').style.width = `${state.percent}%`;
  byId('detail-task-count').textContent = `${state.total} ${state.total === 1 ? 'uppgift' : 'uppgifter'}`;
  byId('detail-task-list').innerHTML = project.items.length ? project.items.map((item) => {
    const task = taskById(item.taskId);
    if (!task) return '';
    return `<article class="detail-task ${item.done ? 'is-done' : ''}">
      <button class="task-check ${item.done ? 'is-done' : ''}" data-toggle-task="${escapeHtml(project.id)}:${escapeHtml(item.taskId)}" aria-label="${item.done ? 'Markera som inte klar' : 'Markera som klar'}">${item.done ? '✓' : ''}</button>
      <div class="detail-task-copy"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.category || 'Övrigt')}</span></div>
      <span class="task-origin">Från uppgiftsboden</span>
      <button class="remove-task" data-remove-from-project="${escapeHtml(project.id)}:${escapeHtml(item.taskId)}" aria-label="Ta bort från projekt">×</button>
    </article>`;
  }).join('') : emptyState('Dags att fylla på.', 'Välj sparade uppgifter från uppgiftsboden eller skapa en ny.', 'Lägg till uppgift', 'add-project-task');
}

function openProject(id) {
  activeProjectId = id;
  showView('project');
}

function openModal(mode, context = {}) {
  modalMode = mode;
  const availableProjects = data.projects.filter((project) =>
    !project.items.some((item) => item.taskId === context.taskId));
  const config = {
    project: {
      title: 'Skapa projekt', description: 'Ge dina planer en egen plats.', submit: 'Skapa projekt',
      fields: `<div class="form-field"><label for="field-title">Projektnamn</label><input id="field-title" name="title" maxlength="60" placeholder="Till exempel: Helgen v. 45" required /></div>
        <div class="form-field"><label for="field-description">Kort beskrivning <span>(valfritt)</span></label><textarea id="field-description" name="description" maxlength="140" placeholder="Vad vill du få gjort?"></textarea></div>`,
    },
    task: {
      title: 'Spara en uppgift', description: 'Den ligger kvar i uppgiftsboden och kan användas i flera projekt.', submit: 'Spara uppgift',
      fields: `<div class="form-field"><label for="field-title">Vad behöver göras?</label><input id="field-title" name="title" maxlength="80" placeholder="Till exempel: Rensa förråd" required /></div>
        <div class="form-field"><label for="field-category">Område</label><select id="field-category" name="category"><option>Inomhus</option><option>Trädgård</option><option>Underhåll</option><option>Övrigt</option></select></div>`,
    },
    'project-task': {
      title: 'Lägg till uppgift', description: 'Välj en sparad uppgift att lägga i projektet.', submit: 'Lägg till',
      fields: `<div class="form-field"><label for="field-task">Välj från uppgiftsboden</label><select id="field-task" name="taskId" required>${data.tasks.map((task) => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`).join('')}</select></div>
        <p class="empty-inline" id="no-available-tasks" style="display:${data.tasks.length ? 'none' : 'block'}">Uppgiftsboden är tom. Spara en uppgift först.</p>`,
    },
    'library-project-task': {
      title: 'Lägg i projekt', description: 'Välj vilket projekt som ska få uppgiften.', submit: 'Lägg till',
      fields: `<div class="form-field"><label for="field-project">Välj projekt</label><select id="field-project" name="projectId" required>${availableProjects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title)}</option>`).join('')}</select></div>
        <p class="empty-inline" style="display:${availableProjects.length ? 'none' : 'block'}">Uppgiften finns redan i alla dina projekt.</p>`,
    },
  }[mode];
  if (!config) return;
  byId('modal-title').textContent = config.title;
  byId('modal-description').textContent = config.description;
  byId('modal-submit').textContent = config.submit;
  byId('modal-fields').innerHTML = config.fields;
  byId('modal-submit').disabled = (mode === 'project-task' && !data.tasks.length) || (mode === 'library-project-task' && !availableProjects.length);
  if (mode === 'library-project-task') byId('modal-form').dataset.taskId = context.taskId || '';
  byId('modal-backdrop').classList.remove('hidden');
  const firstField = byId('modal-fields').querySelector('input, select, textarea');
  if (firstField && !firstField.disabled) firstField.focus();
}

function closeModal() {
  byId('modal-backdrop').classList.add('hidden');
  byId('modal-form').reset();
}

function showToast(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function toggleTask(projectId, taskId) {
  const project = projectById(projectId);
  const item = project?.items.find((entry) => entry.taskId === taskId);
  if (!item) return;
  item.done = !item.done;
  saveData();
  render();
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button, [data-project-id], [data-open-view], [data-action]');
  if (!target) return;
  if (target.dataset.view) { showView(target.dataset.view); return; }
  if (target.dataset.openView) { showView(target.dataset.openView); return; }
  if (target.dataset.projectId) { openProject(target.dataset.projectId); return; }
  if (target.dataset.action === 'create-project') { openModal('project'); return; }
  if (target.dataset.action === 'create-task') { openModal('task'); return; }
  if (target.dataset.action === 'add-project-task') { openModal('project-task'); return; }
  if (target.dataset.toggleTask) {
    const [projectId, taskId] = target.dataset.toggleTask.split(':');
    toggleTask(projectId, taskId);
    return;
  }
  if (target.dataset.removeFromProject) {
    const [projectId, taskId] = target.dataset.removeFromProject.split(':');
    const project = projectById(projectId);
    if (!project) return;
    project.items = project.items.filter((item) => item.taskId !== taskId);
    saveData(); render(); showToast('Uppgiften togs bort från projektet.');
    return;
  }
  if (target.dataset.addToProject) {
    const taskId = target.dataset.addToProject;
    const projectsWithRoom = data.projects.filter((project) => !project.items.some((item) => item.taskId === taskId));
    if (!projectsWithRoom.length) { showToast(data.projects.length ? 'Uppgiften finns redan i alla projekt.' : 'Skapa ett projekt först.'); return; }
    openModal('library-project-task', { taskId });
    return;
  }
  if (target.dataset.deleteTask) {
    const task = taskById(target.dataset.deleteTask);
    if (!task) return;
    const attached = data.projects.some((project) => project.items.some((item) => item.taskId === task.id));
    if (attached) { showToast('Ta först bort uppgiften från dina projekt.'); return; }
    data.tasks = data.tasks.filter((entry) => entry.id !== task.id);
    saveData(); render(); showToast('Uppgiften togs bort från uppgiftsboden.');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.matches('.project-card')) openProject(event.target.dataset.projectId);
  if (event.key === 'Escape') closeModal();
});

byId('top-add-project').addEventListener('click', () => openModal('project'));
byId('projects-add').addEventListener('click', () => openModal('project'));
byId('sidebar-add-project').addEventListener('click', () => openModal('project'));
byId('library-add').addEventListener('click', () => openModal('task'));
byId('detail-add-task').addEventListener('click', () => openModal('project-task'));
byId('modal-close').addEventListener('click', closeModal);
byId('modal-cancel').addEventListener('click', closeModal);
byId('modal-backdrop').addEventListener('click', (event) => {
  if (event.target === byId('modal-backdrop')) closeModal();
});

byId('modal-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  if (modalMode === 'project') {
    const project = {
      id: `project-${Date.now()}`,
      title: String(form.get('title')).trim(),
      description: String(form.get('description') || '').trim(),
      items: [],
    };
    if (!project.title) return;
    data.projects.unshift(project);
    activeProjectId = project.id;
    saveData(); render(); closeModal(); showView('project'); showToast('Projektet är skapat.');
    return;
  }
  if (modalMode === 'task') {
    const task = {
      id: `task-${Date.now()}`,
      title: String(form.get('title')).trim(),
      category: String(form.get('category') || 'Övrigt'),
    };
    if (!task.title) return;
    data.tasks.unshift(task);
    saveData(); render(); closeModal(); showToast('Uppgiften sparades i uppgiftsboden.');
    return;
  }
  if (modalMode === 'project-task') {
    const project = projectById(activeProjectId);
    const taskId = String(form.get('taskId') || '');
    if (!project || !taskById(taskId)) return;
    if (!project.items.some((item) => item.taskId === taskId)) {
      project.items.push({ taskId, done: false });
      saveData(); render(); showToast('Uppgiften lades till i projektet.');
    }
    closeModal();
    return;
  }
  if (modalMode === 'library-project-task') {
    const taskId = event.currentTarget.dataset.taskId;
    const project = projectById(String(form.get('projectId') || ''));
    if (!project || !taskById(taskId)) return;
    if (!project.items.some((item) => item.taskId === taskId)) {
      project.items.push({ taskId, done: false });
      saveData(); render(); showToast(`Uppgiften lades till i ${project.title}.`);
    }
    delete event.currentTarget.dataset.taskId;
    closeModal();
  }
});

const dateFormatter = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
byId('today-label').textContent = dateFormatter.format(new Date());
render();
