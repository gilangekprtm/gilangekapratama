(function () {
    const DATABASE_NAME = 'gilang-assignment-tasks';
    const DATABASE_VERSION = 1;
    const STORE_NAME = 'data';
    const TASKS_KEY = 'tasks-json';

    const defaultTasks = [
        {
            id: 'task-1',
            title: 'Task 1 - Curriculum Vitae',
            description: 'Fresh Graduate Curriculum Vitae (CV) Submission\n\nThis document is a text-based submission for Task 1, featuring a professional English Curriculum Vitae (CV) tailored for a fresh graduate in Electrical Engineering (B.A.Sc.). It covers professional summary, educational background, work experience, organizational roles, certifications, and technical skill sets.',
            attachment: {
                name: 'CV GILANG EKA PRATAMA 2026.pdf',
                type: 'application/pdf',
                url: 'assets/pdf/CV%20GILANG%20EKA%20PRATAMA%202026.pdf'
            }
        }
    ];

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('Browser ini tidak mendukung penyimpanan lokal yang dibutuhkan.'));
                return;
            }

            const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                    request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Database tugas tidak dapat dibuka.'));
        });
    }

    function validateTasks(tasks) {
        if (!Array.isArray(tasks)) {
            throw new Error('Format JSON tidak valid: daftar tugas harus berupa array.');
        }

        const ids = new Set();
        return tasks.map((task, index) => {
            if (!task || typeof task !== 'object' ||
                typeof task.id !== 'string' || !task.id.trim() ||
                typeof task.title !== 'string' || !task.title.trim() ||
                typeof task.description !== 'string') {
                throw new Error(`Data tugas nomor ${index + 1} tidak valid.`);
            }
            if (ids.has(task.id)) {
                throw new Error(`ID tugas duplikat: ${task.id}`);
            }
            ids.add(task.id);

            let attachment = null;
            if (task.attachment != null) {
                const item = task.attachment;
                if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim()) {
                    throw new Error(`Lampiran tugas nomor ${index + 1} tidak valid.`);
                }

                if (typeof item.dataUrl === 'string' && /^data:[^,]*;base64,[A-Za-z0-9+/]*={0,2}$/.test(item.dataUrl)) {
                    attachment = {
                        name: item.name,
                        type: typeof item.type === 'string' ? item.type : '',
                        size: Number.isFinite(item.size) ? item.size : 0,
                        dataUrl: item.dataUrl
                    };
                } else if (typeof item.url === 'string' &&
                    (item.url.startsWith('assets/') || item.url.startsWith('https://')) &&
                    !item.url.includes('..')) {
                    attachment = {
                        name: item.name,
                        type: typeof item.type === 'string' ? item.type : '',
                        size: Number.isFinite(item.size) ? item.size : 0,
                        url: item.url
                    };
                } else {
                    throw new Error(`Format lampiran tugas nomor ${index + 1} tidak didukung.`);
                }
            }

            return {
                id: task.id,
                title: task.title.trim(),
                description: task.description,
                attachment
            };
        });
    }

    async function getTasks() {
        const database = await openDatabase();
        try {
            const transaction = database.transaction(STORE_NAME, 'readonly');
            const request = transaction.objectStore(STORE_NAME).get(TASKS_KEY);
            const record = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('Data tugas tidak dapat dibaca.'));
            });

            if (!record) {
                const initialTasks = validateTasks(defaultTasks);
                await saveTasks(initialTasks);
                return initialTasks;
            }

            let tasks;
            try {
                tasks = JSON.parse(record.value);
            } catch (error) {
                throw new Error(`Data JSON tugas rusak dan tidak dapat dibaca: ${error.message}`);
            }
            return validateTasks(tasks);
        } finally {
            database.close();
        }
    }

    async function saveTasks(tasks) {
        const validatedTasks = validateTasks(tasks);
        const database = await openDatabase();
        try {
            await new Promise((resolve, reject) => {
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                transaction.objectStore(STORE_NAME).put({
                    key: TASKS_KEY,
                    value: JSON.stringify(validatedTasks)
                });
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error || new Error('Data tugas tidak dapat disimpan.'));
                transaction.onabort = () => reject(transaction.error || new Error('Penyimpanan data tugas dibatalkan.'));
            });
        } finally {
            database.close();
        }
    }

    function createId() {
        return window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('File lampiran tidak dapat dibaca.'));
            reader.readAsDataURL(file);
        });
    }

    window.TaskStore = Object.freeze({
        createId,
        defaultTasks: validateTasks(defaultTasks),
        fileToDataUrl,
        getTasks,
        saveTasks,
        validateTasks
    });
})();
