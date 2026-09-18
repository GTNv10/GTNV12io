// Template Management and PDF Flow for GTN v12
import { showToast } from './utils.js';

export function createTemplateManager(getState, saveData, renderTemplates, updateSelectionStatus, modalManager, pdfManager, elements, onSelectTemplate) {
    let activeUploadedImages = {};
    let activeManualValues = {};

    function openTemplateModal(templateId = null) {
        const { appData } = getState();
        const modal = elements.templateModal;
        if (!modal) return;

        const titleEl = modal.querySelector('#modal-title');
        const idInput = modal.querySelector('#template-id');
        const nameInput = modal.querySelector('#template-name');
        const fontSelect = modal.querySelector('#template-font');
        const contentArea = modal.querySelector('#template-content');
        const placeholdersContainer = modal.querySelector('#placeholders-container');
        const manualFieldInput = modal.querySelector('#manual-field-input');
        const addManualFieldBtn = modal.querySelector('#add-manual-field-btn');
        const formatBoldBtn = modal.querySelector('#format-bold-btn');
        const formatItalicBtn = modal.querySelector('#format-italic-btn');
        const cancelBtn = modal.querySelector('#cancel-template-btn');
        const saveBtn = modal.querySelector('#save-template-btn');

        let template = null;
        if (templateId) {
            template = (appData.templates || []).find(t => t.id === templateId);
        }

        if (titleEl) titleEl.textContent = template ? 'Editar Plantilla' : 'Nueva Plantilla';
        if (idInput) idInput.value = template ? template.id : '';
        if (nameInput) nameInput.value = template ? template.name : '';
        if (fontSelect) fontSelect.value = template ? (template.fontFamily || 'Helvetica') : 'Helvetica';
        if (contentArea) contentArea.value = template ? (template.content || '') : '';
        if (manualFieldInput) manualFieldInput.value = '';

        // Helper to insert tag into textarea at cursor position
        const insertTag = (tag) => {
            if (!contentArea) return;
            const start = contentArea.selectionStart;
            const end = contentArea.selectionEnd;
            const text = contentArea.value;
            contentArea.value = text.substring(0, start) + tag + text.substring(end);
            contentArea.focus();
            const newPos = start + tag.length;
            contentArea.setSelectionRange(newPos, newPos);
        };

        // Render placeholders
        const renderPlaceholders = () => {
            if (!placeholdersContainer) return;
            placeholdersContainer.innerHTML = '';

            // System variables
            const systemVars = ['FECHA_ACTUAL', 'NOMBRE_PLANTILLA'];
            systemVars.forEach(v => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'text-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 rounded-md px-2.5 py-1 font-mono font-bold hover:bg-emerald-200 transition-colors';
                btn.textContent = `{{${v}}}`;
                btn.title = `Variable de sistema: ${v}`;
                btn.onclick = () => insertTag(`{{${v}}}`);
                placeholdersContainer.appendChild(btn);
            });

            // Column variables
            (appData.headers || []).forEach(h => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'text-xs bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700 rounded-md px-2.5 py-1 font-mono font-medium hover:bg-sky-200 transition-colors';
                btn.textContent = `{{${h}}}`;
                btn.title = `Columna: ${h}`;
                btn.onclick = () => insertTag(`{{${h}}}`);
                placeholdersContainer.appendChild(btn);
            });

            // Custom manual and image variables
            const currentContent = contentArea ? contentArea.value : '';
            const manualMatches = currentContent.match(/\{\{(?!IMAGEN:)(.*?)\}\}/g) || [];
            const imageMatches = currentContent.match(/\{\{IMAGEN:(.*?)\}\}/g) || [];

            const customVars = new Set();
            manualMatches.forEach(m => {
                const key = m.slice(2, -2).trim();
                if (!appData.headers.includes(key) && !systemVars.includes(key) && key) {
                    customVars.add({ type: 'text', name: key });
                }
            });

            imageMatches.forEach(m => {
                const key = m.slice(9, -2).trim();
                if (key) customVars.add({ type: 'image', name: key });
            });

            customVars.forEach(item => {
                const tag = item.type === 'image' ? `{{IMAGEN:${item.name}}}` : `{{${item.name}}}`;
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = item.type === 'image' 
                    ? 'text-xs bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700 rounded-md px-2.5 py-1 font-mono font-bold hover:bg-purple-200 transition-colors'
                    : 'text-xs bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-md px-2.5 py-1 font-mono font-bold hover:bg-amber-200 transition-colors';
                chip.textContent = tag;
                chip.title = item.type === 'image' ? `Campo de imagen: ${item.name}` : `Campo manual: ${item.name}`;
                chip.onclick = () => insertTag(tag);
                placeholdersContainer.appendChild(chip);
            });
        };

        renderPlaceholders();

        // Add manual field
        if (addManualFieldBtn && manualFieldInput) {
            addManualFieldBtn.onclick = () => {
                const fieldName = manualFieldInput.value.trim();
                if (!fieldName) {
                    showToast('Ingresa un nombre para el campo manual.', 'warning');
                    return;
                }
                modalManager.showFieldTypeModal(fieldName, manualFieldInput, (name, type) => {
                    const tag = type === 'image' ? `{{IMAGEN:${name}}}` : `{{${name}}}`;
                    insertTag(tag);
                    renderPlaceholders();
                });
            };
        }

        // Bold formatting
        if (formatBoldBtn && contentArea) {
            formatBoldBtn.onclick = () => {
                const start = contentArea.selectionStart;
                const end = contentArea.selectionEnd;
                const text = contentArea.value;
                const selected = text.substring(start, end) || 'texto en negrita';
                contentArea.value = text.substring(0, start) + `**${selected}**` + text.substring(end);
                contentArea.focus();
            };
        }

        // Italic formatting
        if (formatItalicBtn && contentArea) {
            formatItalicBtn.onclick = () => {
                const start = contentArea.selectionStart;
                const end = contentArea.selectionEnd;
                const text = contentArea.value;
                const selected = text.substring(start, end) || 'texto en cursiva';
                contentArea.value = text.substring(0, start) + `*${selected}*` + text.substring(end);
                contentArea.focus();
            };
        }

        // Cancel
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.classList.remove('active');
            };
        }

        // Save Template
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = (nameInput ? nameInput.value.trim() : '');
                const content = (contentArea ? contentArea.value : '');
                const fontFamily = (fontSelect ? fontSelect.value : 'Helvetica');

                if (!name) {
                    showToast('La plantilla debe tener un nombre.', 'error');
                    nameInput?.focus();
                    return;
                }

                if (!content.trim()) {
                    showToast('El contenido de la plantilla no puede estar vacío.', 'error');
                    contentArea?.focus();
                    return;
                }

                // Extract image and manual fields
                const imageMatches = content.match(/\{\{IMAGEN:(.*?)\}\}/g) || [];
                const imageFields = Array.from(new Set(imageMatches.map(m => m.slice(9, -2).trim()).filter(Boolean)));

                const allMatches = content.match(/\{\{(?!IMAGEN:)(.*?)\}\}/g) || [];
                const systemVars = ['FECHA_ACTUAL', 'NOMBRE_PLANTILLA'];
                const manualFields = Array.from(new Set(allMatches.map(m => m.slice(2, -2).trim()).filter(k => {
                    return k && !appData.headers.includes(k) && !systemVars.includes(k);
                })));

                if (!appData.templates) appData.templates = [];

                let savedTemplateId;
                if (template) {
                    template.name = name;
                    template.content = content;
                    template.fontFamily = fontFamily;
                    template.imageFields = imageFields;
                    template.manualFields = manualFields;
                    savedTemplateId = template.id;
                } else {
                    savedTemplateId = `tmpl_${Date.now()}`;
                    const newTmpl = {
                        id: savedTemplateId,
                        name: name,
                        content: content,
                        fontFamily: fontFamily,
                        imageFields: imageFields,
                        manualFields: manualFields
                    };
                    appData.templates.push(newTmpl);
                }

                saveData();
                renderTemplates();
                onSelectTemplate(savedTemplateId);
                updateSelectionStatus();
                modal.classList.remove('active');
                showToast(`Plantilla "${name}" guardada con éxito.`, 'success');
            };
        }

        modal.classList.add('active');
    }

    function deleteSelectedTemplate() {
        const { appData, selectedTemplateId } = getState();
        if (!selectedTemplateId) {
            showToast('Selecciona una plantilla para eliminar.', 'warning');
            return;
        }

        const template = (appData.templates || []).find(t => t.id === selectedTemplateId);
        if (!template) return;

        modalManager.showConfirmModal(`¿Seguro que deseas eliminar la plantilla "${template.name}"?`, () => {
            appData.templates = appData.templates.filter(t => t.id !== selectedTemplateId);
            onSelectTemplate(null);
            saveData();
            renderTemplates();
            updateSelectionStatus();
            showToast(`Plantilla "${template.name}" eliminada.`, 'success');
        }, 'Eliminar Plantilla');
    }

    // --- PDF GENERATION FLOW ---
    function startPdfGenerationFlow() {
        const { appData, selectedRowId, selectedTemplateId } = getState();
        if (!selectedRowId) {
            showToast('Debes seleccionar una fila de la tabla primero.', 'warning');
            return;
        }
        if (!selectedTemplateId) {
            showToast('Debes seleccionar una plantilla.', 'warning');
            return;
        }

        const rowData = appData.mainData.find(r => r.id === selectedRowId);
        const template = (appData.templates || []).find(t => t.id === selectedTemplateId);

        if (!rowData || !template) {
            showToast('No se encontró el registro o la plantilla seleccionada.', 'error');
            return;
        }

        activeUploadedImages = {};
        activeManualValues = {};

        // Parse required images
        const imageMatches = template.content.match(/\{\{IMAGEN:(.*?)\}\}/g) || [];
        const imageFields = Array.from(new Set(imageMatches.map(m => m.slice(9, -2).trim()).filter(Boolean)));

        // Parse required manual variables
        const allMatches = template.content.match(/\{\{(?!IMAGEN:)(.*?)\}\}/g) || [];
        const systemVars = ['FECHA_ACTUAL', 'NOMBRE_PLANTILLA'];
        const manualFields = Array.from(new Set(allMatches.map(m => m.slice(2, -2).trim()).filter(k => {
            return k && !appData.headers.includes(k) && !systemVars.includes(k);
        })));

        if (imageFields.length > 0) {
            promptForImages(imageFields, () => {
                if (manualFields.length > 0) {
                    promptForManualVars(manualFields, () => showPdfPreview(rowData, template));
                } else {
                    showPdfPreview(rowData, template);
                }
            });
        } else if (manualFields.length > 0) {
            promptForManualVars(manualFields, () => showPdfPreview(rowData, template));
        } else {
            showPdfPreview(rowData, template);
        }
    }

    function promptForImages(imageFields, onComplete) {
        const modal = elements.imageUploadModal;
        const form = document.getElementById('image-upload-form');
        const submitBtn = document.getElementById('submit-image-upload-btn');
        const cancelBtn = document.getElementById('cancel-image-upload-btn');

        if (!modal || !form) return;
        form.innerHTML = '';

        imageFields.forEach(fieldName => {
            const group = document.createElement('div');
            group.className = 'p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600 space-y-2';
            group.innerHTML = `
                <label class="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                    📸 ${fieldName}
                </label>
                <input type="file" accept="image/*" data-image-name="${fieldName}" class="image-file-input block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100">
                <div class="image-preview-container hidden mt-2 text-center">
                    <img class="max-h-32 mx-auto rounded border shadow-sm">
                </div>
            `;
            form.appendChild(group);
        });

        // Live preview for image selection
        form.querySelectorAll('.image-file-input').forEach(input => {
            input.onchange = (e) => {
                const file = e.target.files[0];
                const previewContainer = input.closest('div').querySelector('.image-preview-container');
                const img = previewContainer.querySelector('img');
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (rev) => {
                        img.src = rev.target.result;
                        previewContainer.classList.remove('hidden');
                    };
                    reader.readAsDataURL(file);
                } else {
                    previewContainer.classList.add('hidden');
                }
            };
        });

        modal.classList.add('active');

        cancelBtn.onclick = () => {
            modal.classList.remove('active');
        };

        submitBtn.onclick = async (e) => {
            e.preventDefault();
            const inputs = form.querySelectorAll('.image-file-input');
            const readers = [];

            inputs.forEach(input => {
                const name = input.dataset.imageName;
                const file = input.files[0];
                if (file) {
                    readers.push(new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            activeUploadedImages[name] = reader.result;
                            resolve();
                        };
                        reader.readAsDataURL(file);
                    }));
                }
            });

            await Promise.all(readers);
            modal.classList.remove('active');
            onComplete();
        };
    }

    function promptForManualVars(manualFields, onComplete) {
        const modal = elements.manualVarsModal;
        const form = document.getElementById('manual-vars-form');
        const submitBtn = document.getElementById('submit-manual-vars-btn');
        const cancelBtn = document.getElementById('cancel-manual-vars-btn');

        if (!modal || !form) return;
        form.innerHTML = '';

        manualFields.forEach(field => {
            const group = document.createElement('div');
            group.innerHTML = `
                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">${field}</label>
                <input type="text" name="${field}" class="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 text-sm focus:ring-2 focus:ring-sky-500" placeholder="Ingrese ${field}..." required>
            `;
            form.appendChild(group);
        });

        modal.classList.add('active');

        cancelBtn.onclick = () => {
            modal.classList.remove('active');
        };

        submitBtn.onclick = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            for (let [key, val] of formData.entries()) {
                activeManualValues[key] = val;
            }
            modal.classList.remove('active');
            onComplete();
        };
    }

    function showPdfPreview(rowData, template) {
        const modal = elements.previewModal;
        const previewTextEl = document.getElementById('preview-text');
        const cancelBtn = document.getElementById('cancel-preview-btn');
        const downloadBtn = document.getElementById('download-pdf-btn');

        if (!modal || !previewTextEl) return;

        let content = template.content;

        // Replace manual variables
        Object.entries(activeManualValues).forEach(([k, v]) => {
            content = content.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
        });

        // Replace column variables
        const { appData } = getState();
        (appData.headers || []).forEach(h => {
            const val = rowData[h] !== undefined && rowData[h] !== null ? String(rowData[h]) : '';
            content = content.replace(new RegExp(`\\{\\{${h}\\}\\}`, 'g'), val);
        });

        // Replace system variables
        content = content.replace(/\{\{FECHA_ACTUAL\}\}/g, new Date().toLocaleDateString('es-ES'));
        content = content.replace(/\{\{NOMBRE_PLANTILLA\}\}/g, template.name);

        // Replace images preview tag
        content = content.replace(/\{\{IMAGEN:(.*?)\}\}/g, (_, name) => `[IMAGEN ADJUNTA: ${name.trim()}]`);

        previewTextEl.textContent = content;

        pdfManager.setPending({
            rowData,
            template,
            uploadedImages: activeUploadedImages
        });

        modal.classList.add('active');

        cancelBtn.onclick = () => {
            modal.classList.remove('active');
            pdfManager.setPending(null);
        };

        downloadBtn.onclick = () => {
            pdfManager.downloadPDF();
        };
    }

    return {
        openTemplateModal,
        deleteSelectedTemplate,
        startPdfGenerationFlow
    };
}
