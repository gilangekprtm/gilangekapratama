(function () {
    const loginPanel = document.getElementById('login-panel');
    const adminPanel = document.getElementById('admin-panel');
    const loginForm = document.getElementById('login-form');
    const taskForm = document.getElementById('task-form');
    const taskList = document.getElementById('task-list');
    const status = document.getElementById('status-message');
    let tasks = [];
    let editingId = null;

    function showStatus(message, isError) {
        status.textContent = message;
        status.className = isError ? 'mt-4 text-sm text-red-400' : 'mt-4 text-sm text-green-400';
    }

    function setAdminVisible(isAdmin) {
        loginPanel.hidden = isAdmin;
        adminPanel.hidden = !isAdmin;
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
        taskForm.reset();
        editingId = null;
        document.getElementById('form-heading').textContent = 'Tambah tugas';
        document.getElementById('save-task').textContent = 'Tambah tugas';
        document.getElementById('cancel-edit').hidden = true;
        document.getElementById('current-attachment').textContent = 'Belum ada lampiran';
        document.getElementById('remove-attachment-row').hidden = true;
    }

    function beginEditing(task) {
        editingId = task.id;
        taskForm.elements.title.value = task.title;
        taskForm.elements.description.value = task.description;
        taskForm.elements.file.value = '';
        taskForm.elements.removeAttachment.checked = false;
        document.getElementById('form-heading').textContent = 'Edit tugas';
        document.getElementById('save-task').textContent = 'Simpan perubahan';
        document.getElementById('cancel-edit').hidden = false;
        document.getElementById('remove-attachment-row').hidden = !task.attachment;
        document.getElementById('current-attachment').textContent = task.attachment
            ? `Lampiran saat ini: ${task.attachment.name}`
            : 'Belum ada lampiran';
        taskForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function refreshTasks() {
        tasks = await window.TaskStore.getTasks();
        renderTasks();
    }

    async function deleteTask(task) {
        if (!window.confirm(`Hapus tugas "${task.title}"?`)) return;
        try {
            await window.TaskStore.deleteTask(task.id);
        } catch (error) {
            try {
                await refreshTasks();
            } catch (refreshError) {
                showStatus(`Penghapusan gagal atau belum lengkap: ${error.message}. Daftar juga gagal diperbarui: ${refreshError.message}`, true);
                return;
            }
            showStatus(`Penghapusan gagal atau belum lengkap: ${error.message}`, true);
            return;
        }

        if (editingId === task.id) resetForm();
        try {
            await refreshTasks();
            showStatus('Tugas berhasil dihapus.', false);
        } catch (error) {
            showStatus(`Tugas terhapus, tetapi daftar tugas gagal diperbarui: ${error.message}`, true);
        }
    }

    async function enableAdmin() {
        setAdminVisible(true);
        try {
            await refreshTasks();
            showStatus('Perubahan tugas akan langsung terlihat oleh semua pengunjung.', false);
        } catch (error) {
            showStatus(`Daftar tugas gagal dimuat: ${error.message}`, true);
        }
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        try {
            await window.TaskStore.signIn(
                loginForm.elements.email.value.trim(),
                loginForm.elements.password.value
            );
            const user = await window.TaskStore.getCurrentAdmin();
            if (!user) {
                throw new Error('Akun ini belum diberi akses admin. Tambahkan ID akun ke tabel task_admins di Supabase.');
            }
            loginForm.reset();
            await enableAdmin();
        } catch (error) {
            showStatus(`Login gagal: ${error.message}`, true);
        } finally {
            submitButton.disabled = false;
        }
    });

    document.getElementById('sign-out').addEventListener('click', async () => {
        try {
            await window.TaskStore.signOut();
            setAdminVisible(false);
            showStatus('Anda telah keluar.', false);
        } catch (error) {
            showStatus(`Tidak dapat keluar: ${error.message}`, true);
        }
    });

    taskForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = taskForm.elements.title.value.trim();
        const description = taskForm.elements.description.value.trim();
        const file = taskForm.elements.file.files[0] || null;
        const isEditing = Boolean(editingId);
        const submitButton = document.getElementById('save-task');
        submitButton.disabled = true;
        try {
            if (editingId) {
                await window.TaskStore.updateTask(editingId, {
                    title,
                    description,
                    file,
                    removeAttachment: taskForm.elements.removeAttachment.checked
                });
            } else {
                await window.TaskStore.createTask({ title, description, file });
            }
            const resultMessage = isEditing
                ? 'Perubahan tugas berhasil disimpan.'
                : 'Tugas berhasil ditambahkan dan kini terlihat oleh semua pengunjung.';
            resetForm();
            showStatus(resultMessage, false);
            try {
                await refreshTasks();
            } catch (error) {
                showStatus(`Perubahan tersimpan, tetapi daftar tugas gagal diperbarui: ${error.message}`, true);
            }
        } catch (error) {
            showStatus(`Tugas gagal disimpan: ${error.message}`, true);
        } finally {
            submitButton.disabled = false;
        }
    });

    document.getElementById('cancel-edit').addEventListener('click', resetForm);

    document.getElementById('export-json').addEventListener('click', () => {
        const file = new Blob([JSON.stringify({ format: 'task-panel-v1', tasks }, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'tasks.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showStatus('Daftar tugas berhasil diekspor. Lampiran tetap tersimpan di Supabase Storage.', false);
    });

    document.getElementById('import-json').addEventListener('change', async (event) => {
        const input = event.currentTarget;
        const file = input.files[0];
        if (!file) return;

        try {
            const backup = JSON.parse(await file.text());
            if (!backup || backup.format !== 'task-panel-v1' || !Array.isArray(backup.tasks)) {
                throw new Error('Format cadangan JSON tidak dikenal.');
            }
            if (backup.tasks.some((task) => task.attachment?.dataUrl)) {
                throw new Error('Cadangan lama berisi lampiran lokal. Unggah ulang lampiran melalui formulir tugas.');
            }
            if (!window.confirm(`Impor ${backup.tasks.length} tugas? Tugas yang sudah ada tidak dihapus.`)) return;

            for (const task of backup.tasks) {
                const fileUrl = task.attachment?.url || null;
                if (fileUrl && !fileUrl.startsWith('https://') && !fileUrl.startsWith('assets/')) {
                    throw new Error(`URL lampiran tugas "${task.title}" tidak valid.`);
                }
                const result = await window.TaskStore.importTask(task, fileUrl);
                tasks.push(result);
            }
            renderTasks();
            showStatus('Tugas berhasil diimpor. Perubahan terlihat oleh semua pengunjung.', false);
        } catch (error) {
            showStatus(`JSON gagal diimpor: ${error.message}`, true);
            await refreshTasks();
        } finally {
            input.value = '';
        }
    });

    window.TaskStore.getCurrentAdmin()
        .then((user) => {
            if (user) return enableAdmin();
        })
        .catch((error) => {
            showStatus(`Tidak dapat memeriksa sesi admin: ${error.message}`, true);
        });
})();
