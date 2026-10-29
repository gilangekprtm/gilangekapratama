(function () {
    const BUCKET_NAME = 'task-attachments';
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    let client;

    function getClient() {
        if (client) return client;
        const config = window.SUPABASE_CONFIG;
        if (!config || !config.url || !config.anonKey ||
            config.url.includes('YOUR_PROJECT_ID') ||
            config.anonKey.includes('YOUR_SUPABASE')) {
            throw new Error('Supabase belum dikonfigurasi. Isi URL proyek dan publishable/anon key di assets/js/supabase-config.js.');
        }
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            throw new Error('Library Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.');
        }
        client = window.supabase.createClient(config.url, config.anonKey);
        return client;
    }

    function unwrap(result) {
        if (result.error) {
            throw new Error(result.error.message || 'Permintaan ke Supabase gagal.');
        }
        return result.data;
    }

    function mapTask(row) {
        let attachment = null;
        if (row.attachment_name) {
            const url = row.attachment_path
                ? getClient().storage.from(BUCKET_NAME).getPublicUrl(row.attachment_path).data.publicUrl
                : row.attachment_url;
            if (!url) {
                throw new Error(`Tugas "${row.title}" memiliki lampiran tanpa URL yang valid.`);
            }
            attachment = {
                name: row.attachment_name,
                type: row.attachment_type || '',
                url
            };
        }

        return {
            id: row.id,
            title: row.title,
            description: row.description || '',
            attachment
        };
    }

    function safeFileName(name) {
        const baseName = name.split(/[\\/]/).pop() || 'attachment';
        return baseName.replace(/[^\w.\-() ]/g, '_').slice(-120) || 'attachment';
    }

    async function uploadAttachment(taskId, file) {
        if (!file) return null;
        if (file.size > MAX_FILE_SIZE) {
            throw new Error('Ukuran file maksimal 50 MB.');
        }

        const path = `${taskId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const storage = getClient().storage.from(BUCKET_NAME);
        const result = await storage.upload(path, file, {
            cacheControl: '3600',
            contentType: file.type || 'application/octet-stream',
            upsert: false
        });
        unwrap(result);
        return {
            attachment_path: path,
            attachment_name: file.name,
            attachment_type: file.type || 'application/octet-stream',
            attachment_url: null
        };
    }

    async function removeAttachment(path) {
        if (!path) return;
        unwrap(await getClient().storage.from(BUCKET_NAME).remove([path]));
    }

    async function getTasks() {
        const data = unwrap(await getClient()
            .from('tasks')
            .select('id,title,description,attachment_path,attachment_name,attachment_type,attachment_url,created_at')
            .order('created_at', { ascending: true }));
        return data.map(mapTask);
    }

    async function createTask(task) {
        const id = crypto.randomUUID();
        let uploaded;
        try {
            uploaded = await uploadAttachment(id, task.file);
            const row = {
                id,
                title: task.title.trim(),
                description: task.description.trim(),
                ...(uploaded || {})
            };
            const data = unwrap(await getClient().from('tasks').insert(row)
                .select('id,title,description,attachment_path,attachment_name,attachment_type,attachment_url,created_at')
                .single());
            return mapTask(data);
        } catch (error) {
            if (uploaded) {
                try {
                    await removeAttachment(uploaded.attachment_path);
                } catch (cleanupError) {
                    throw new Error(`${error.message} File yang sempat diunggah juga gagal dibersihkan: ${cleanupError.message}`);
                }
            }
            throw error;
        }
    }

    async function importTask(task, attachmentUrl) {
        if (!task || typeof task.title !== 'string' || typeof task.description !== 'string') {
            throw new Error('Data tugas di dalam JSON tidak valid.');
        }
        if (attachmentUrl && !attachmentUrl.startsWith('https://') &&
            (!attachmentUrl.startsWith('assets/') || attachmentUrl.includes('..'))) {
            throw new Error('URL lampiran impor harus berupa URL HTTPS atau path assets/.');
        }

        const row = {
            id: crypto.randomUUID(),
            title: task.title.trim(),
            description: task.description,
            ...(attachmentUrl
                ? {
                    attachment_url: attachmentUrl,
                    attachment_name: task.attachment.name,
                    attachment_type: task.attachment.type || ''
                }
                : {})
        };
        return mapTask(unwrap(await getClient().from('tasks').insert(row)
            .select('id,title,description,attachment_path,attachment_name,attachment_type,attachment_url,created_at')
            .single()));
    }

    async function updateTask(id, task) {
        const current = unwrap(await getClient().from('tasks')
            .select('attachment_path,attachment_name,attachment_type,attachment_url')
            .eq('id', id)
            .single());
        const uploaded = await uploadAttachment(id, task.file);
        const removeExisting = task.removeAttachment && !uploaded;
        const attachmentFields = uploaded
            ? uploaded
            : removeExisting
                ? { attachment_path: null, attachment_name: null, attachment_type: null, attachment_url: null }
                : {};
        let data;
        try {
            data = unwrap(await getClient().from('tasks').update({
                title: task.title.trim(),
                description: task.description.trim(),
                ...attachmentFields
            }).eq('id', id)
                .select('id,title,description,attachment_path,attachment_name,attachment_type,attachment_url,created_at')
                .single());
        } catch (error) {
            if (uploaded) {
                try {
                    await removeAttachment(uploaded.attachment_path);
                } catch (cleanupError) {
                    throw new Error(`${error.message} File pengganti yang sempat diunggah juga gagal dibersihkan: ${cleanupError.message}`);
                }
            }
            throw error;
        }

        const oldPath = current.attachment_path;
        if (oldPath && (uploaded || removeExisting)) {
            try {
                await removeAttachment(oldPath);
            } catch (error) {
                throw new Error(`Perubahan tugas tersimpan, tetapi lampiran lama gagal dihapus: ${error.message}`);
            }
        }
        return mapTask(data);
    }

    async function deleteTask(id) {
        const current = unwrap(await getClient().from('tasks')
            .select('attachment_path')
            .eq('id', id)
            .single());
        unwrap(await getClient().from('tasks').delete().eq('id', id));
        if (current.attachment_path) {
            try {
                await removeAttachment(current.attachment_path);
            } catch (error) {
                throw new Error(`Tugas berhasil dihapus, tetapi file lampiran gagal dihapus: ${error.message}`);
            }
        }
    }

    async function signIn(email, password) {
        return unwrap(await getClient().auth.signInWithPassword({ email, password }));
    }

    async function signOut() {
        unwrap(await getClient().auth.signOut());
    }

    async function getCurrentAdmin() {
        const auth = getClient().auth;
        const sessionResult = await auth.getSession();
        const session = unwrap(sessionResult)?.session;
        if (!session) return null;

        const result = await getClient().from('task_admins')
            .select('user_id')
            .eq('user_id', session.user.id)
            .maybeSingle();
        if (result.error) {
            throw new Error(`Tidak dapat memverifikasi akses admin: ${result.error.message}`);
        }
        if (!result.data) {
            await signOut();
            return null;
        }
        return session.user;
    }

    window.TaskStore = Object.freeze({
        createTask,
        deleteTask,
        getCurrentAdmin,
        getTasks,
        importTask,
        signIn,
        signOut,
        updateTask
    });
})();
