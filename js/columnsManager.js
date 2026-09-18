// Columns Management module for GTN v12
import { showToast } from './utils.js';

export function createColumnsManager(getState, saveData, fullReloadUI, modalManager, renderTable, recalculateAllDays) {

    function handleRenameColumn(oldName, newName) {
        const { appData } = getState();
        const trimmedNew = (newName || '').trim();

        if (!trimmedNew || trimmedNew === oldName) {
            return false;
        }

        if (appData.headers.includes(trimmedNew)) {
            showToast(`Ya existe una columna con el nombre "${trimmedNew}".`, 'error');
            return false;
        }

        const isProtected = appData.columnMetadata[oldName]?.isProtected || oldName === appData.keyColumns?.daysDisplay;
        if (isProtected) {
            showToast(`La columna "${oldName}" está protegida del sistema y no se puede renombrar.`, 'warning');
            return false;
        }

        // 1. Update headers array preserving index
        const index = appData.headers.indexOf(oldName);
        if (index === -1) return false;
        appData.headers[index] = trimmedNew;

        // 2. Rename in each row in mainData
        (appData.mainData || []).forEach(row => {
            if (row.hasOwnProperty(oldName)) {
                row[trimmedNew] = row[oldName];
                delete row[oldName];
            }
        });

        // 3. Rename in columnFormats
        if (appData.columnFormats && appData.columnFormats.hasOwnProperty(oldName)) {
            appData.columnFormats[trimmedNew] = appData.columnFormats[oldName];
            delete appData.columnFormats[oldName];
        }

        // 4. Rename in columnWidths
        if (appData.columnWidths && appData.columnWidths.hasOwnProperty(oldName)) {
            appData.columnWidths[trimmedNew] = appData.columnWidths[oldName];
            delete appData.columnWidths[oldName];
        }

        // 5. Rename in columnMetadata
        if (appData.columnMetadata && appData.columnMetadata.hasOwnProperty(oldName)) {
            appData.columnMetadata[trimmedNew] = appData.columnMetadata[oldName];
            delete appData.columnMetadata[oldName];
        }

        // 6. Rename in referenceDB if it is a list
        const oldListKey = `_list_${oldName}`;
        const newListKey = `_list_${trimmedNew}`;
        if (appData.referenceDB && appData.referenceDB.hasOwnProperty(oldListKey)) {
            appData.referenceDB[newListKey] = appData.referenceDB[oldListKey];
            delete appData.referenceDB[oldListKey];
        }

        // 7. Update keyColumns
        if (appData.keyColumns) {
            if (appData.keyColumns.dateForCalculation === oldName) {
                appData.keyColumns.dateForCalculation = trimmedNew;
            }
            if (appData.keyColumns.daysDisplay === oldName) {
                appData.keyColumns.daysDisplay = trimmedNew;
            }
        }

        // 8. Update colorCodingColumn, bulkDeleteColumn, selectedRowIdentifierColumn
        if (appData.colorCodingColumn === oldName) appData.colorCodingColumn = trimmedNew;
        if (appData.bulkDeleteColumn === oldName) appData.bulkDeleteColumn = trimmedNew;
        if (appData.selectedRowIdentifierColumn === oldName) appData.selectedRowIdentifierColumn = trimmedNew;
        if (appData.sortBy === oldName) appData.sortBy = trimmedNew;

        // 9. Update hideSettings
        if (appData.hideSettings && appData.hideSettings.column === oldName) {
            appData.hideSettings.column = trimmedNew;
        }

        // 10. Update active filters
        (appData.filters || []).forEach(f => {
            if (f.column === oldName) f.column = trimmedNew;
        });

        // 11. Update lookupRelations
        (appData.lookupRelations || []).forEach(rel => {
            if (rel.keyColumn === oldName) rel.keyColumn = trimmedNew;
            if (rel.targetMap) {
                Object.entries(rel.targetMap).forEach(([src, tgt]) => {
                    if (tgt === oldName) rel.targetMap[src] = trimmedNew;
                });
            }
        });

        saveData();
        fullReloadUI();
        showToast(`Columna renombrada a "${trimmedNew}".`, 'success');
        return true;
    }

    function handleSetColumnWidth(header, rawWidth) {
        const { appData } = getState();
        if (!appData.columnWidths) appData.columnWidths = {};

        const cleanVal = (rawWidth || '').trim().toLowerCase().replace('px', '').trim();

        if (!cleanVal || cleanVal === 'auto') {
            delete appData.columnWidths[header];
        } else {
            const num = parseInt(cleanVal, 10);
            if (!isNaN(num) && num >= 40) {
                appData.columnWidths[header] = `${num}px`;
            } else {
                delete appData.columnWidths[header];
            }
        }

        saveData();
        renderTable();
    }

    function openColumnsModal() {
        const { appData } = getState();
        const columnsModal = document.getElementById('columns-modal');
        const columnsList = document.getElementById('columns-list');
        const addColBtn = document.getElementById('add-col-btn');
        const deleteColBtn = document.getElementById('delete-col-btn');
        const closeBtn = document.getElementById('close-columns-btn');
        const keySettingsContainer = document.getElementById('column-key-settings');

        if (!columnsModal || !columnsList) return;

        columnsList.innerHTML = '';
        modalManager.setSelectedColForDeletion(null);
        if (deleteColBtn) deleteColBtn.disabled = true;

        // Key columns settings (Date for calculation)
        if (keySettingsContainer) {
            keySettingsContainer.innerHTML = '';
            const keyColLabel = document.createElement('label');
            keyColLabel.className = 'flex flex-wrap items-center gap-2 text-sm';
            keyColLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Calcular "DIAS" a partir de la columna de fecha:</span>`;
            
            const keyColSelect = document.createElement('select');
            keyColSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
            
            const dateColumns = appData.headers.filter(h => appData.columnFormats[h] === 'date');
            keyColSelect.innerHTML = `<option value="">-- No calcular --</option>` + 
                dateColumns.map(h => `<option value="${h}" ${appData.keyColumns?.dateForCalculation === h ? 'selected' : ''}>${h}</option>`).join('');
            
            keyColSelect.onchange = (e) => {
                if (!appData.keyColumns) appData.keyColumns = {};
                appData.keyColumns.dateForCalculation = e.target.value || null;
                recalculateAllDays();
                saveData();
                fullReloadUI();
                showToast('Columna de cálculo actualizada.', 'success');
            };
            
            keyColLabel.appendChild(keyColSelect);
            keySettingsContainer.appendChild(keyColLabel);
        }

        // Add column button listener
        if (addColBtn) {
            addColBtn.onclick = () => {
                modalManager.showPromptModal('Nombre de la nueva columna', (newColName) => {
                    const cleanName = (newColName || '').trim();
                    if (!cleanName) return;

                    if (appData.headers.includes(cleanName)) {
                        showToast(`Ya existe una columna llamada "${cleanName}".`, 'error');
                        return;
                    }

                    appData.headers.push(cleanName);
                    if (!appData.columnFormats) appData.columnFormats = {};
                    appData.columnFormats[cleanName] = 'text';

                    if (!appData.columnWidths) appData.columnWidths = {};
                    appData.columnWidths[cleanName] = '150px';

                    (appData.mainData || []).forEach(row => {
                        row[cleanName] = '';
                    });

                    saveData();
                    openColumnsModal();
                    fullReloadUI();
                    showToast(`Columna "${cleanName}" añadida con éxito.`, 'success');
                });
            };
        }

        // Delete column button listener
        if (deleteColBtn) {
            deleteColBtn.onclick = () => {
                const selectedCol = modalManager.getSelectedColForDeletion();
                if (!selectedCol) return;

                const isProtected = appData.columnMetadata[selectedCol]?.isProtected || selectedCol === appData.keyColumns?.daysDisplay;
                if (isProtected) {
                    showToast(`La columna "${selectedCol}" no se puede eliminar.`, 'warning');
                    return;
                }

                modalManager.showConfirmModal(
                    `¿Estás seguro de eliminar la columna "${selectedCol}"? Se borrarán todos los datos de esta columna en todos los registros.`,
                    () => {
                        appData.headers = appData.headers.filter(h => h !== selectedCol);
                        (appData.mainData || []).forEach(r => { delete r[selectedCol]; });
                        delete appData.columnFormats[selectedCol];
                        if (appData.columnWidths) delete appData.columnWidths[selectedCol];
                        if (appData.columnMetadata) delete appData.columnMetadata[selectedCol];
                        if (appData.referenceDB) delete appData.referenceDB[`_list_${selectedCol}`];

                        if (appData.keyColumns?.dateForCalculation === selectedCol) {
                            appData.keyColumns.dateForCalculation = null;
                        }
                        if (appData.colorCodingColumn === selectedCol) appData.colorCodingColumn = null;
                        if (appData.bulkDeleteColumn === selectedCol) appData.bulkDeleteColumn = null;
                        if (appData.selectedRowIdentifierColumn === selectedCol) appData.selectedRowIdentifierColumn = null;
                        if (appData.sortBy === selectedCol) appData.sortBy = appData.headers[0] || null;

                        saveData();
                        openColumnsModal();
                        fullReloadUI();
                        showToast(`Columna "${selectedCol}" eliminada.`, 'success');
                    },
                    'Eliminar Columna'
                );
            };
        }

        // Render each column in the manager list
        appData.headers.forEach((header) => {
            const item = document.createElement('div');
            item.className = 'column-manager-item flex flex-wrap items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700/70 rounded-lg border border-transparent transition-all';
            item.dataset.headerName = header;

            const isProtected = appData.columnMetadata[header]?.isProtected || header === appData.keyColumns?.daysDisplay;

            // Selection for deletion
            item.onclick = (e) => {
                if (e.target.closest('input, select, button')) return;
                const currentSelected = columnsList.querySelector('.border-sky-500');
                if (currentSelected) currentSelected.classList.remove('border-sky-500', 'bg-sky-100', 'dark:bg-sky-800');
                item.classList.add('border-sky-500', 'bg-sky-100', 'dark:bg-sky-800');
                modalManager.setSelectedColForDeletion(header);
                if (deleteColBtn) deleteColBtn.disabled = isProtected;
            };

            // 1. Column Title Input (EDITABLE)
            const nameInputContainer = document.createElement('div');
            nameInputContainer.className = 'flex-grow min-w-[140px] flex items-center gap-1.5';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = header;
            nameInput.title = isProtected ? 'Columna protegida' : 'Haz clic para modificar el título y presiona Enter o fuera del campo para guardar';
            nameInput.disabled = isProtected;
            nameInput.className = `w-full font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-none ${isProtected ? 'opacity-70 cursor-not-allowed' : ''}`;

            nameInput.onchange = () => {
                const newTitle = nameInput.value.trim();
                if (newTitle !== header) {
                    const success = handleRenameColumn(header, newTitle);
                    if (success) {
                        openColumnsModal();
                    } else {
                        nameInput.value = header;
                    }
                }
            };
            nameInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    nameInput.blur();
                }
            };
            nameInputContainer.appendChild(nameInput);
            item.appendChild(nameInputContainer);

            // 2. Width Input in px (EDITABLE)
            const widthContainer = document.createElement('div');
            widthContainer.className = 'flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 shadow-sm';
            widthContainer.title = 'Ancho de columna (en px, ej: 150. Dejar vacío para auto)';

            const widthLabel = document.createElement('span');
            widthLabel.className = 'text-xs text-gray-400 dark:text-gray-500 font-medium select-none';
            widthLabel.textContent = 'Ancho:';
            widthContainer.appendChild(widthLabel);

            const widthInput = document.createElement('input');
            widthInput.type = 'text';
            const curWidth = (appData.columnWidths && appData.columnWidths[header]) 
                ? appData.columnWidths[header].replace('px', '').trim() 
                : '';
            widthInput.value = curWidth;
            widthInput.placeholder = 'auto';
            widthInput.className = 'w-16 bg-transparent text-sm text-center border-0 focus:outline-none focus:ring-0 p-0 text-gray-800 dark:text-gray-200 font-mono';

            const pxLabel = document.createElement('span');
            pxLabel.className = 'text-xs text-gray-500 font-mono select-none';
            pxLabel.textContent = 'px';
            widthContainer.appendChild(widthInput);
            widthContainer.appendChild(pxLabel);

            widthInput.onchange = () => {
                handleSetColumnWidth(header, widthInput.value);
                const updated = (appData.columnWidths && appData.columnWidths[header]) 
                    ? appData.columnWidths[header].replace('px', '').trim() 
                    : '';
                widthInput.value = updated;
                showToast(`Ancho de "${header}" actualizado a ${updated ? updated + 'px' : 'auto'}.`, 'info');
            };
            widthInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    widthInput.blur();
                }
            };
            item.appendChild(widthContainer);

            // 3. Format Selector
            const formatContainer = document.createElement('div');
            const formatSelect = document.createElement('select');
            formatSelect.className = 'w-32 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-sky-500';
            formatSelect.innerHTML = `<option value="text">Texto</option><option value="date">Fecha</option><option value="list">Lista</option><option value="cuit">CUIT/CUIL</option>`;
            formatSelect.value = appData.columnFormats[header] || 'text';
            formatSelect.onchange = () => {
                if (formatSelect.value === 'text') {
                    delete appData.columnFormats[header];
                } else {
                    appData.columnFormats[header] = formatSelect.value;
                    if (formatSelect.value === 'list') {
                        const listKey = `_list_${header}`;
                        if (!appData.referenceDB[listKey]) {
                            appData.referenceDB[listKey] = {
                                '__DEFAULT__': { light: '#f9fafb', dark: '#111827', textLight: '#1f2937', textDark: '#f3f4f6' }
                            };
                            showToast(`Se creó una nueva lista para "${header}" ordenada A-Z.`, 'info');
                        }
                    }
                }
                saveData();
                openColumnsModal();
                fullReloadUI();
            };
            formatContainer.appendChild(formatSelect);
            item.appendChild(formatContainer);

            // 4. Protected badge or indicator
            if (isProtected) {
                const badge = document.createElement('span');
                badge.className = 'text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-mono';
                badge.textContent = 'Sistema';
                badge.title = 'Columna reservada para el cálculo o visualización del sistema';
                item.appendChild(badge);
            }
            
            columnsList.appendChild(item);
        });

        if (closeBtn) {
            closeBtn.onclick = () => {
                columnsModal.classList.remove('active');
                fullReloadUI();
            };
        }

        columnsModal.classList.add('active');
    }

    return {
        openColumnsModal,
        handleRenameColumn,
        handleSetColumnWidth
    };
}
