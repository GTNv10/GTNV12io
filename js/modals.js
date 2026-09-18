// Modal dialogs management module for GTN v12
import { showToast, sortReferenceDbObject, getSortedListOptions, parseDate, formatDate } from './utils.js';

export function createModalManager(getState, onSaveData, onFullReloadUI) {
    let elements = {};
    let selectedColumnNameForDeletion = null;

    function initModals(domElements) {
        elements = domElements;
        populateModals();
    }

    function populateModals() {
        const createAndAppend = (id, html) => {
            let container = document.getElementById(id);
            if (!container) {
                container = document.createElement('div');
                container.id = id;
                document.body.appendChild(container);
            }
            container.className = "modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center p-4 z-50";
            container.innerHTML = html;
            return container;
        };
        
        elements.templateModal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto"><h3 id="modal-title" class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Crear/Editar Plantilla</h3><div class="space-y-6"><input type="hidden" id="template-id"><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label for="template-name" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nombre</label><input type="text" id="template-name" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" placeholder="Ej: Notificación de Vencimiento"></div><div><label for="template-font" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tipo de Letra (PDF)</label><select id="template-font" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"><option value="Helvetica">Helvetica (Normal)</option><option value="Times">Times (Serif)</option><option value="Courier">Courier (Monoespaciada)</option></select></div></div><div><label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Variables (clic para insertar)</label><div id="placeholders-container" class="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600 min-h-[60px]"></div></div><div><label for="manual-field-input" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Añadir Campo de Pregunta (Manual)</label><div class="flex gap-2"><input type="text" id="manual-field-input" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" placeholder="Nombre del campo, ej: Fecha de Notificación"><button id="add-manual-field-btn" type="button" class="bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-600 text-nowrap">Añadir</button></div></div><div><label for="template-content" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Contenido</label><div class="flex items-center gap-2 mb-2"><button id="format-bold-btn" type="button" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-3 py-1 rounded-md text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-500" title="Negrita">B</button><button id="format-italic-btn" type="button" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-3 py-1 rounded-md text-sm italic hover:bg-gray-300 dark:hover:bg-gray-500" title="Cursiva">C</button></div><textarea id="template-content" rows="12" class="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" placeholder="Escribe aquí... Usa {{Variable}} para insertar datos."></textarea></div></div><div class="mt-8 flex justify-end space-x-3"><button id="cancel-template-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-3 px-6 rounded-lg">Cancelar</button><button id="save-template-btn" class="bg-sky-600 text-white font-bold py-3 px-6 rounded-lg">Guardar</button></div></div>`;
        elements.manualVarsModal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto"><h3 class="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Completar Datos Manuales</h3><form id="manual-vars-form" class="space-y-4"></form><div class="mt-8 flex justify-end space-x-3"><button id="cancel-manual-vars-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-3 px-6 rounded-lg">Cancelar</button><button id="submit-manual-vars-btn" class="bg-sky-600 text-white font-bold py-3 px-6 rounded-lg">Continuar</button></div></div>`;
        elements.previewModal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto"><h3 class="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Previsualizar y Generar PDF</h3><pre id="preview-text" class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 max-h-72 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 rounded border dark:border-gray-600 font-sans leading-relaxed"></pre><div class="mt-8 flex justify-end space-x-3"><button id="cancel-preview-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-3 px-6 rounded-lg">Cancelar</button><button id="download-pdf-btn" class="bg-green-500 text-white font-bold py-3 px-6 rounded-lg">Descargar PDF</button></div></div>`;
        
        elements.dbModal.innerHTML = `
            <div class="modal-content bg-white dark:bg-gray-800 w-screen h-screen max-w-none max-h-none rounded-none shadow-2xl p-4 md:p-6 flex flex-col">
                <div class="flex flex-wrap justify-between items-center pb-3 border-b dark:border-gray-700 gap-3">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3zM3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7zM17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestor de Datos y Ajustes</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Administración de listas A-Z, tablas de referencia, colores, alertas, lotes y nombres de PDF</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="file" id="import-db-input" class="hidden" accept=".json">
                        <button id="import-db-btn" class="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-semibold py-2 px-3 rounded-lg transition-colors shadow-sm" title="Importar configuración y base de datos de referencia (JSON)">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            <span>Importar BD</span>
                        </button>
                        <button id="export-db-btn" class="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-semibold py-2 px-3 rounded-lg transition-colors shadow-sm" title="Exportar configuración y base de datos de referencia (JSON)">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span>Exportar BD</span>
                        </button>
                        <button id="close-db-btn" class="text-3xl text-gray-400 hover:text-red-500 transition-colors px-2 ml-1" title="Cerrar">&times;</button>
                    </div>
                </div>

                <!-- Navigation Tabs -->
                <div class="flex overflow-x-auto gap-2 py-3 border-b dark:border-gray-700 text-sm font-semibold shrink-0" id="db-nav-tabs">
                    <button class="db-tab-btn active px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800" data-tab="lists">
                        <span>📋 Listas Desplegables (A-Z)</span>
                    </button>
                    <button class="db-tab-btn px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" data-tab="lookups">
                        <span>🔗 Tablas y Relaciones (Lookups)</span>
                    </button>
                    <button class="db-tab-btn px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" data-tab="colors-alerts">
                        <span>🎨 Colores y Alertas</span>
                    </button>
                    <button class="db-tab-btn px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" data-tab="maintenance">
                        <span>🧹 Mantenimiento y Lotes</span>
                    </button>
                    <button class="db-tab-btn px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" data-tab="settings">
                        <span>⚙️ Ajustes de Tabla y PDF</span>
                    </button>
                </div>

                <!-- Tab Content Panel -->
                <div id="db-tab-content-container" class="flex-grow overflow-y-auto mt-3 pr-2"></div>
            </div>`;
        
        elements.columnsModal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-5xl max-h-[90vh] flex flex-col"><div class="flex justify-between items-center mb-6"><h3 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestionar Columnas</h3><div><button id="add-col-btn" class="bg-sky-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-sky-600 mr-2">Añadir Columna</button><button id="delete-col-btn" class="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 disabled:bg-gray-400" disabled>Eliminar Seleccionada</button></div></div><div id="column-key-settings" class="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg"></div><div class="flex-grow overflow-y-auto pr-4 space-y-2" id="columns-list"></div><div class="mt-8 pt-4 border-t dark:border-gray-700 flex justify-end"><button id="close-columns-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-3 px-6 rounded-lg">Cerrar</button></div></div>`;
    
        const promptModalHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md"><form id="prompt-form"><h3 id="prompt-title" class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4"></h3><input type="text" id="prompt-input" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" required><div class="mt-6 flex justify-end space-x-3"><button type="button" id="prompt-cancel-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-2 px-5 rounded-lg">Cancelar</button><button type="submit" id="prompt-submit-btn" class="bg-sky-600 text-white font-bold py-2 px-5 rounded-lg">Aceptar</button></div></form></div>`;
        elements.promptModal = createAndAppend('prompt-modal', promptModalHTML);

        const confirmModalHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md"><h3 id="confirm-title" class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Confirmar Acción</h3><p id="confirm-message" class="text-gray-700 dark:text-gray-300 mb-6 text-base leading-relaxed"></p><div class="mt-8 flex justify-end space-x-3 gap-3"><button id="confirm-cancel-btn" class="bg-gray-300 hover:bg-gray-400 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-bold py-2 px-6 rounded-lg transition-colors">Cancelar</button><button id="confirm-submit-btn" class="bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800 font-bold py-2 px-6 rounded-lg transition-colors">Confirmar</button></div></div>`;
        elements.confirmModal = createAndAppend('confirm-modal', confirmModalHTML);
    }

    function showConfirmModal(message, onConfirm, title = 'Confirmar Acción') {
        if (!elements.confirmModal) return;
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        
        const confirmBtn = document.getElementById('confirm-submit-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        elements.confirmModal.classList.add('active');

        const cleanup = () => {
            elements.confirmModal.classList.remove('active');
            confirmBtn?.removeEventListener('click', confirmHandler);
            cancelBtn?.removeEventListener('click', cleanup);
        };

        const confirmHandler = () => {
            cleanup();
            onConfirm();
        };

        confirmBtn?.addEventListener('click', confirmHandler);
        cancelBtn?.addEventListener('click', cleanup);
    }

    function showPromptModal(title, onConfirm, defaultValue = '') {
        return new Promise((resolve) => {
            elements.promptModal.classList.add('active');
            const titleEl = document.getElementById('prompt-title');
            if (titleEl) titleEl.textContent = title;
            const input = document.getElementById('prompt-input');
            const form = document.getElementById('prompt-form');
            const cancelBtn = document.getElementById('prompt-cancel-btn');
            input.value = defaultValue;
            input.focus();

            const cleanup = () => {
                elements.promptModal.classList.remove('active');
                form.removeEventListener('submit', submitHandler);
                cancelBtn.removeEventListener('click', cleanup);
            };

            const submitHandler = (e) => {
                e.preventDefault();
                const val = input.value.trim();
                if (val) {
                    if (onConfirm) onConfirm(val);
                    resolve(val);
                    cleanup();
                } else {
                    showToast('El valor no puede estar vacío.', 'warning');
                }
            };

            form.addEventListener('submit', submitHandler);
            cancelBtn.addEventListener('click', cleanup);
        });
    }

    function showFieldTypeModal(fieldName, inputElement, onAddPlaceholder) {
        const fieldTypeModalHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md"><h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Tipo de Campo</h3><p class="text-gray-700 dark:text-gray-300 mb-6">¿Qué tipo de campo es "<strong>${fieldName}</strong>"?</p><div class="space-y-3 mb-6"><div class="p-3 bg-sky-50 dark:bg-sky-900/30 rounded-lg border border-sky-200 dark:border-sky-700"><p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Texto</p><p class="text-xs text-gray-600 dark:text-gray-400">Se preguntará al escribir el registro</p></div><div class="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700"><p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Imagen</p><p class="text-xs text-gray-600 dark:text-gray-400">Se pedirá un archivo o URL de imagen</p></div></div><div class="flex justify-end space-x-3 gap-3"><button id="field-type-text-btn" class="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Texto</button><button id="field-type-image-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Imagen</button></div></div>`;
        
        let container = document.getElementById('field-type-modal');
        if (container) container.remove();
        container = document.createElement('div');
        container.id = 'field-type-modal';
        container.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center p-4 z-50';
        container.innerHTML = fieldTypeModalHTML;
        document.body.appendChild(container);
        container.classList.add('active');

        const cleanup = () => {
            container.classList.remove('active');
            setTimeout(() => container.remove(), 300);
        };

        document.getElementById('field-type-text-btn')?.addEventListener('click', () => {
            onAddPlaceholder(fieldName, 'text');
            inputElement.value = '';
            cleanup();
        });

        document.getElementById('field-type-image-btn')?.addEventListener('click', () => {
            onAddPlaceholder(fieldName, 'image');
            inputElement.value = '';
            cleanup();
        });
    }

    return {
        initModals,
        showConfirmModal,
        showPromptModal,
        showFieldTypeModal,
        getSelectedColForDeletion: () => selectedColumnNameForDeletion,
        setSelectedColForDeletion: (c) => { selectedColumnNameForDeletion = c; }
    };
}
