(function () {
    const form = document.getElementById('task-form');
    const taskList = document.getElementById('task-list');
    const status = document.getElementById('status-message');
    const importInput = document.getElementById('import-json');
    let tasks = [];
    let editingId = null;

    function showStatus(message, isError) {
        status.textContent = message;
        status.className = isError ? 'mt-4 text-sm text-red-400' : 'mt-4 text-sm text-green-400';
    }

    function renderTasks() {
        taskList.replaceChildren();

        if (tasks.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-gray-400';
            empty.textContent = 'Belum ada tugas. Tambahkan tugas melalui formulir.';
            taskList.appendChild(empty);
            return;
        }

        tasks.forEach((task) => {
            const row = document.createElement('article');
            row.className = 'flex flex-col gap-4 rounded-xl border border-gray-800 bg-[#151515] p-5 sm:flex-row sm:items-center sm:justify-between';

            const details = document.createElement('div');
            const heading = document.createElement('h3');
            heading.className = 'text-xl font-bold title-font';
            heading.textContent = task.title;
            const description = document.createElement('p');
            description.className = 'mt-1 whitespace-pre-line text-sm text-gray-400';
            description.textContent = task.description || 'Tanpa deskripsi';
            const attachment = document.createElement('p');
            attachment.className = 'mt-2 text-sm text-yellow-600';
            attachment.textContent = task.attachment ? `Lampiran: ${task.attachment.name}` : 'Belum ada lampiran';
            details.append(heading, description, attachment);

            const actions = document.createElement('div');
            actions.className = 'flex shrink-0 gap-2';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-yellow-600 hover:bg-yellow-600';
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', () => beginEditing(task));

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-900';
            deleteButton.textContent = 'Hapus';
            deleteButton.addEventListener('click', () => deleteTask(task));
            actions.append(editButton, deleteButton);
            row.append(details, actions);
            taskList.appendChild(row);
        });
    }

    function resetForm() {
        form.reset();
        editingId = null;
        document.getElementById('form-heading').textContent = 'Tambah tugas';
        document.getElementById('save-task').textContent = 'Tambah tugas';
        document.getElementById('cancel-edit').hidden = true;
        document.getElementById('current-attachment').textContent = 'Belum ada lampiran';
        document.getElementById('remove-attachment-row').hidden = true;
    }

    function beginEditing(task) {
        editingId = task.id;
        form.elements.title.value = task.title;
        form.elements.description.value = task.description;
        form.elements.file.value = '';
        form.elements.removeAttachment.checked = false;
        document.getElementById('form-heading').textContent = 'Edit tugas';
        document.getElementById('save-task').textContent = 'Simpan perubahan';
        document.getElementById('cancel-edit').hidden = false;
        document.getElementById('remove-attachment-row').hidden = !task.attachment;
        document.getElementById('current-attachment').textContent = task.attachment
            ? `Lampiran saat ini: ${task.attachment.name}`
            : 'Belum ada lampiran';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function deleteTask(task) {
        if (!window.confirm(`Hapus tugas "${task.title}"?`)) return;
        try {
            tasks = tasks.filter((item) => item.id !== task.id);
            await window.TaskStore.saveTasks(tasks);
            if (editingId === task.id) resetForm();
            renderTasks();
            showStatus('Tugas berhasil dihapus.', false);
        } catch (error) {
            showStatus(`Tugas gagal dihapus: ${error.message}`, true);
            await refreshTasks();
        }
    }

    async function refreshTasks() {
        tasks = await window.TaskStore.getTasks();
        renderTasks();
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const title = String(formData.get('title')).trim();
        const description = String(formData.get('description')).trim();
        const existing = tasks.find((task) => task.id === editingId);
        const selectedFile = form.elements.file.files[0];

        try {
            let attachment = existing ? existing.attachment : null;
            if (selectedFile) {
                attachment = {
                    name: selectedFile.name,
                    type: selectedFile.type,
                    size: selectedFile.size,
                    dataUrl: await window.TaskStore.fileToDataUrl(selectedFile)
                };
            } else if (existing && form.elements.removeAttachment.checked) {
                attachment = null;
            }

            const task = {
                id: existing ? existing.id : window.TaskStore.createId(),
                title,
                description,
                attachment
            };
            const updatedTasks = existing
                ? tasks.map((item) => item.id === existing.id ? task : item)
                : [...tasks, task];

            await window.TaskStore.saveTasks(updatedTasks);
            tasks = updatedTasks;
            renderTasks();
            resetForm();
            showStatus(existing ? 'Perubahan tugas berhasil disimpan.' : 'Tugas berhasil ditambahkan.', false);
        } catch (error) {
            showStatus(`Tugas gagal disimpan: ${error.message}`, true);
        }
    });

    document.getElementById('cancel-edit').addEventListener('click', resetForm);

    document.getElementById('export-json').addEventListener('click', () => {
        const data = {
            format: 'task-panel-v1',
            tasks
        };
        const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'tasks.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showStatus('Cadangan JSON berhasil diunduh.', false);
    });

    importInput.addEventListener('change', async () => {
        const file = importInput.files[0];
        if (!file) return;

        try {
            const backup = JSON.parse(await file.text());
            if (!backup || backup.format !== 'task-panel-v1') {
                throw new Error('Format cadangan tidak dikenal.');
            }
            const importedTasks = window.TaskStore.validateTasks(backup.tasks);
            if (!window.confirm(`Ganti seluruh daftar tugas dengan ${importedTasks.length} tugas dari file JSON?`)) {
                return;
            }
            await window.TaskStore.saveTasks(importedTasks);
            tasks = importedTasks;
            renderTasks();
            resetForm();
            showStatus('Daftar tugas berhasil diimpor dari JSON.', false);
        } catch (error) {
            showStatus(`JSON gagal diimpor: ${error.message}`, true);
        } finally {
            importInput.value = '';
        }
    });

    refreshTasks().catch((error) => {
        showStatus(`Daftar tugas gagal dimuat: ${error.message}`, true);
    });
})();
