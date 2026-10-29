(async function () {
    const grid = document.getElementById('task-grid');
    if (!grid) return;

    try {
        const tasks = await window.TaskStore.getTasks();
        const cards = await Promise.all(tasks.map(async (task) => {
            const card = document.createElement(task.attachment ? 'a' : 'article');
            card.className = 'reveal-card group bg-[#151515] border border-gray-800 rounded-2xl p-8 flex flex-col items-center text-center transition-all duration-500 hover:-translate-y-3 hover:border-yellow-600 hover:shadow-[0_0_40px_-10px_rgba(220,38,38,0.4)]';

            if (task.attachment) {
                if (task.attachment.dataUrl) {
                    const response = await fetch(task.attachment.dataUrl);
                    if (!response.ok) {
                        throw new Error(`Lampiran "${task.attachment.name}" tidak dapat dibuka.`);
                    }
                    card.href = URL.createObjectURL(await response.blob());
                    if (task.attachment.type !== 'application/pdf' && !task.attachment.name.toLowerCase().endsWith('.pdf')) {
                        card.download = task.attachment.name;
                    }
                } else {
                    card.href = task.attachment.url;
                }
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
                card.classList.add('cursor-pointer', 'focus-visible:outline', 'focus-visible:outline-2', 'focus-visible:outline-yellow-600');
                card.setAttribute('aria-label', `${task.title} — buka lampiran`);
            }

            const icon = document.createElement('div');
            icon.className = 'w-20 h-20 mb-6 bg-gray-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500';
            const image = document.createElement('img');
            image.src = 'assets/img/docs.png';
            image.alt = '';
            image.className = 'w-7 h-10';
            icon.appendChild(image);

            const heading = document.createElement('h3');
            heading.className = 'text-2xl font-bold mb-3 title-font tracking-wide';
            heading.textContent = task.title;

            const description = document.createElement('p');
            description.className = 'text-gray-400 text-sm mb-8 flex-grow whitespace-pre-line';
            description.textContent = task.description;

            const action = document.createElement('span');
            action.className = 'w-full py-3 px-6 bg-gray-900 border border-gray-700 text-gray-300 font-semibold rounded-lg group-hover:bg-yellow-600 group-hover:border-yellow-600 group-hover:text-white transition-all duration-300';
            action.textContent = task.attachment
                ? `OPEN ${task.attachment.name}`
                : 'NO ATTACHMENT';

            card.append(icon, heading, description, action);
            return card;
        }));

        grid.replaceChildren(...cards);
    } catch (error) {
        console.error('Unable to load task cards:', error);
        const message = document.createElement('p');
        message.className = 'text-red-400 md:col-span-3';
        message.setAttribute('role', 'alert');
        message.textContent = `Daftar tugas gagal dimuat: ${error.message}`;
        grid.replaceChildren(message);
    }
})();
