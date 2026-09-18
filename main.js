// GTN v12 Main Application Entry Point
import { 
    showToast, 
    parseDate, 
    formatDate, 
    getFormattedDateForFilename, 
    getFormattedTimestampForFilename, 
    calculateDays, 
    formatCuitCuil, 
    sortReferenceDbObject, 
    getSortedListOptions 
} from './js/utils.js';

import { createModalManager } from './js/modals.js';
import { createDbManager } from './js/dbManager.js';
import { createPdfManager } from './js/pdfExport.js';
import { createAutoSyncEngine } from './js/autoSync.js';
import { createColumnsManager } from './js/columnsManager.js';
import { createTemplateManager } from './js/templateManager.js';
import { createFilterManager } from './js/filterManager.js';
import { normalizeAppData } from './js/migrationHelper.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- CORE STATE ---
    let appData = {};
    let filteredData = [];
    let selectedRowId = null;
    let selectedTemplateId = null;
    let currentPage = 1;
    let searchDebounceTimer;
    let lastLocalSaveTimestamp = 0;

    const elements = {
        htmlTag: document.documentElement,
        tableContainer: document.getElementById('table-container'),
        paginationControlsBottom: document.getElementById('pagination-controls-bottom'),
        rowCount: document.getElementById('row-count'),
        searchInput: document.getElementById('search-input'),
        addRowBtn: document.getElementById('add-row-btn'),
        deleteRowBtn: document.getElementById('delete-row-btn'),
        manageColsBtn: document.getElementById('manage-cols-btn'),
        exportExcelBtn: document.getElementById('export-excel-btn'),
        importAllBtn: document.getElementById('import-all-btn'),
        importAllInput: document.getElementById('import-all-input'),
        exportAllBtn: document.getElementById('export-all-btn'),
        templateSelectDropdown: document.getElementById('template-select-dropdown'),
        createTemplateBtn: document.getElementById('create-template-btn'),
        editSelectedTemplateBtn: document.getElementById('edit-selected-template-btn'),
        deleteSelectedTemplateBtn: document.getElementById('delete-selected-template-btn'),
        generatePdfBtn: document.getElementById('generate-pdf-btn'),
        summaryBar: document.getElementById('summary-bar'),
        filtersContainer: document.getElementById('filters-container'),
        toastContainer: document.getElementById('toast-container'),
        templateModal: document.getElementById('template-modal'),
        manualVarsModal: document.getElementById('manual-vars-modal'),
        previewModal: document.getElementById('preview-modal'),
        manageDbBtn: document.getElementById('manage-db-btn'),
        dbModal: document.getElementById('db-modal'),
        columnsModal: document.getElementById('columns-modal'),
        imageUploadModal: document.getElementById('image-upload-modal'),
        loadingOverlay: document.getElementById('loading-overlay'),
        increaseFontSizeBtn: document.getElementById('increase-font-size'),
        decreaseFontSizeBtn: document.getElementById('decrease-font-size'),
        tableFontColorPicker: document.getElementById('table-font-color-picker'),
        selectedRowIdentifierDisplay: document.getElementById('selected-row-identifier-display'),
    };

    const getState = () => ({ appData, filteredData, selectedRowId, selectedTemplateId, currentPage });

    // --- SUB-MANAGERS INITIALIZATION ---
    const modalManager = createModalManager(getState, saveData, fullReloadUI);
    modalManager.initModals(elements);

    const pdfManager = createPdfManager(getState, modalManager.showPromptModal);
    const dbManager = createDbManager(getState, saveData, fullReloadUI, modalManager);
    
    const filterManager = createFilterManager(
        getState,
        saveData,
        () => {
            currentPage = 1;
            sortAndApplyFilters();
        },
        elements
    );

    const columnsManager = createColumnsManager(
        getState,
        saveData,
        fullReloadUI,
        modalManager,
        renderTable,
        recalculateAllDays
    );

    const templateManager = createTemplateManager(
        getState,
        saveData,
        renderTemplates,
        updateSelectionStatus,
        modalManager,
        pdfManager,
        elements,
        (newTemplateId) => {
            selectedTemplateId = newTemplateId;
        }
    );

    // --- DATA MANAGEMENT ---
    function saveData(updateTimestamp = true) {
        try {
            if (updateTimestamp) {
                lastLocalSaveTimestamp = Date.now();
                appData._lastUpdated = lastLocalSaveTimestamp;
            }
            localStorage.setItem('gestorReclamosData_v43_generic', JSON.stringify(appData));
        } catch (e) {
            console.error('Error guardando datos:', e);
            showToast('Error al guardar datos.', 'error');
        }
    }

    function loadData() {
        const storedData = localStorage.getItem('gestorReclamosData_v43_generic');

        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                if (parsed && (parsed.mainData || parsed.headers || Array.isArray(parsed))) {
                    appData = normalizeAppData(parsed);
                    lastLocalSaveTimestamp = appData._lastUpdated || Date.now();
                    return;
                }
            } catch (e) {
                console.error('Error cargando datos:', e);
            }
        }

        // INITIAL DEFAULT DATA
        appData = normalizeAppData({
            mainData: [],
            templates: [],
            visualAlerts: [{ id: 1, enabled: true, color: { bg: '#fee2e2', text: '#000000' }, condition: '>=', value: '10' }],
            filters: [],
            hideSettings: { column: 'ESTADO', hiddenValues: [] },
            lookupRelations: [],
            referenceDB: {
                '_list_ESTADO': {
                    '__DEFAULT__': { bg: '#f9fafb', text: '#1f2937' },
                    'EN TRÁMITE': { bg: '#fef9c3', text: '#713f12' },
                    'FINALIZADO': { bg: '#dcfce7', text: '#166534' },
                    'PENDIENTE': { bg: '#e0e7ff', text: '#3730a3' },
                    'RECHAZADO': { bg: '#fee2e2', text: '#991b1b' }
                }
            },
            headers: [ "FECHA DE INICIO", "EXPEDIENTE", "ESTADO", "FECHA ULTIMA/ PROXIMA ACCION", "DIAS", "N° EMPRESA", "NOMBRE EMPRESA", "CUIT EMPRESA" ],
            keyColumns: {
                dateForCalculation: 'FECHA ULTIMA/ PROXIMA ACCION',
                daysDisplay: 'DIAS'
            },
            columnMetadata: { "DIAS": { isProtected: true } },
            columnFormats: {
                'FECHA DE INICIO': 'date',
                'FECHA ULTIMA/ PROXIMA ACCION': 'date',
                'ESTADO': 'list',
                'CUIT EMPRESA': 'cuit'
            },
            columnWidths: {},
            pdfFilenameFormat: 'Documento {{NOMBRE EMPRESA}} {{FECHA DE INICIO}}',
            sortBy: 'FECHA DE INICIO',
            sortOrder: 'desc',
            tableFontSize: 14,
            tableTextColor: 'inherit',
            rowsPerPage: 10,
            colorCodingColumn: 'ESTADO',
            bulkDeleteColumn: 'ESTADO',
            selectedRowIdentifierColumn: 'EXPEDIENTE',
            _lastUpdated: Date.now()
        });

        if (appData.mainData.length === 0) addRow(false);
    }

    // --- RECALCULATION & FILTERING ---
    function recalculateAllDays() {
        let hasChanges = false;
        const dateCol = appData.keyColumns?.dateForCalculation;
        const daysCol = appData.keyColumns?.daysDisplay;
        
        if (!dateCol || !daysCol || !appData.headers.includes(dateCol) || !appData.headers.includes(daysCol)) {
            return false;
        }
        
        appData.mainData.forEach(row => {
            const newDays = calculateDays(row[dateCol]);
            if (String(row[daysCol] || '') !== String(newDays || '')) {
                row[daysCol] = newDays;
                hasChanges = true;
            }
        });
        if (hasChanges) saveData(false);
        return hasChanges;
    }

    function sortAndApplyFilters() {
        const generalQuery = elements.searchInput.value.toLowerCase().trim();
        let data = filterManager.applyFiltersToData(appData.mainData, appData, generalQuery);

        if (appData.sortBy && appData.headers.includes(appData.sortBy)) {
            const sortBy = appData.sortBy;
            const sortOrder = appData.sortOrder === 'asc' ? 1 : -1;
            const format = appData.columnFormats[sortBy];

            data.sort((a, b) => {
                let valA = a[sortBy] || '';
                let valB = b[sortBy] || '';

                if (format === 'date') {
                    valA = parseDate(valA) || 0;
                    valB = parseDate(valB) || 0;
                } else if (!isNaN(parseFloat(valA)) && !isNaN(parseFloat(valB))) {
                    valA = parseFloat(valA);
                    valB = parseFloat(valB);
                } else if (typeof valA === 'string' && typeof valB === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }

                if (valA < valB) return -1 * sortOrder;
                if (valA > valB) return 1 * sortOrder;
                return 0;
            });
        }

        filteredData = data;
        
        if (currentPage > Math.ceil(filteredData.length / appData.rowsPerPage) && filteredData.length > 0) {
            currentPage = Math.ceil(filteredData.length / appData.rowsPerPage);
        } else if (filteredData.length === 0) {
            currentPage = 1;
        }

        renderTable();
        updateSummaryBar();
    }

    function handleCellUpdate(rowId, column, value) {
        const rowIndex = appData.mainData.findIndex(r => r.id === rowId);
        if (rowIndex === -1) return;
        const row = appData.mainData[rowIndex];
        
        let finalValue = value;
        const columnFormat = appData.columnFormats[column];

        if (columnFormat === 'date') {
            const parsed = parseDate(value);
            if (value && !parsed) {
                showToast(`Formato de fecha inválido para '${value}'. Use DD/MM/YYYY.`, 'error');
                return;
            }
            finalValue = parsed ? formatDate(parsed) : '';
        } else if (columnFormat === 'cuit') {
            finalValue = formatCuitCuil(value);
        }
        
        const dateCalcCol = appData.keyColumns?.dateForCalculation;
        const daysDisplayCol = appData.keyColumns?.daysDisplay;

        if (row[column] === finalValue && column !== dateCalcCol) return;
        
        row[column] = finalValue;
        let needsRerender = false;
        
        (appData.lookupRelations || []).forEach(relation => {
            if (relation.enabled && relation.keyColumn === column && relation.sourceDB) {
                const sourceData = appData.referenceDB[relation.sourceDB]?.[finalValue];
                if (sourceData) {
                    Object.entries(relation.targetMap || {}).forEach(([sourceField, targetColumn]) => {
                        if (targetColumn && row.hasOwnProperty(targetColumn)) {
                            let valueToPopulate = sourceData[sourceField] || '';
                            const targetFormat = appData.columnFormats[targetColumn];

                            if (targetFormat === 'cuit') {
                                valueToPopulate = formatCuitCuil(valueToPopulate);
                            } else if (targetFormat === 'date') {
                                const parsedDate = parseDate(valueToPopulate);
                                valueToPopulate = parsedDate ? formatDate(parsedDate) : '';
                            }

                            row[targetColumn] = valueToPopulate;
                            needsRerender = true;
                        }
                    });
                }
            }
        });
        
        if (dateCalcCol && daysDisplayCol && column === dateCalcCol) {
            row[daysDisplayCol] = calculateDays(finalValue);
            needsRerender = true;
        } 
        
        saveData();
        if (needsRerender || column === appData.colorCodingColumn || column === appData.selectedRowIdentifierColumn) {
            sortAndApplyFilters();
            updateSelectedRowIdentifierDisplay();
        }
        updateSummaryBar();
    }

    function addRow(showToastNotification = true) {
        const newRow = { id: `row_${Date.now()}` };
        appData.headers.forEach(header => newRow[header] = '');
        
        const sortColumn = appData.sortBy;
        if (sortColumn && appData.columnFormats[sortColumn] === 'date') {
            newRow[sortColumn] = formatDate(new Date());
        }

        currentPage = 1; 
        appData.mainData.unshift(newRow); 
        
        saveData();
        sortAndApplyFilters(); 
        
        if (showToastNotification) {
            showToast('Nueva fila añadida.', 'success');
        }
    }

    function deleteRow() {
        if (!selectedRowId) return;
        modalManager.showConfirmModal('¿Seguro que quieres eliminar la fila seleccionada?', () => {
            appData.mainData = appData.mainData.filter(row => row.id !== selectedRowId);
            handleRowSelection(null);
            saveData();
            sortAndApplyFilters();
            showToast('Fila eliminada.', 'success');
        });
    }

    // --- TABLE RENDERING WITH ALPHABETICAL LISTS (A - Z) ---
    function renderTable() {
        elements.tableContainer.style.setProperty('--table-font-size', `${appData.tableFontSize || 14}px`);
        elements.tableContainer.style.setProperty('--table-text-color', appData.tableTextColor || 'inherit');

        const table = document.createElement('table');
        table.id = "data-table";
        const thead = document.createElement('thead');
        
        const headersHtml = `<th class="sticky-col p-1 w-12 bg-gray-100 dark:bg-gray-800 border-b-2 dark:border-gray-600"></th>` + 
            appData.headers.map(h => {
                const width = (appData.columnWidths && appData.columnWidths[h]) || 'auto';
                const isAuto = width === 'auto';
                const headerStyle = `style="width: ${width}; min-width: ${isAuto ? '120px' : width}; ${!isAuto ? `max-width: ${width};` : ''}"`;
                const sortIndicator = appData.sortBy === h ? (appData.sortOrder === 'asc' ? ' 🔼' : ' 🔽') : '';
                return `<th ${headerStyle} data-header-sort="${h}">${h.replace(/_/g, ' ')}${sortIndicator}</th>`;
            }).join('');

        thead.innerHTML = `<tr class="sticky-header text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-800 shadow-sm">${headersHtml}</tr>`;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        const paginatedData = filteredData.slice((currentPage - 1) * appData.rowsPerPage, currentPage * appData.rowsPerPage);

        if (paginatedData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${appData.headers.length + 1}" class="text-center p-8 text-gray-500 dark:text-gray-400">No hay datos que coincidan con la búsqueda o filtros.</td></tr>`;
        } else {
            const theme = elements.htmlTag.classList.contains('dark') ? 'dark' : 'light';
            const daysDisplayCol = appData.keyColumns?.daysDisplay;
            const colorColumn = appData.colorCodingColumn;
            const colorDbKey = colorColumn ? `_list_${colorColumn}` : null;
            const colorDb = colorDbKey ? appData.referenceDB[colorDbKey] : null;

            paginatedData.forEach((row, rowIndex) => {
                const tr = document.createElement('tr');
                tr.className = `transition-colors duration-150`;
                tr.dataset.rowId = row.id;

                const isSelected = selectedRowId === row.id;
                if (isSelected) tr.classList.add('selected-row');

                if (colorDb && colorColumn && !isSelected) {
                    const valueForColor = row[colorColumn];
                    const colorConfig = colorDb[valueForColor] || colorDb['__DEFAULT__'];
                    if (colorConfig) {
                        tr.style.backgroundColor = colorConfig.bg || (theme === 'dark' ? colorConfig.dark : colorConfig.light) || colorConfig.light;
                        const isDefaultCase = !valueForColor || !colorDb[valueForColor];
                        let textColor;

                        if (isDefaultCase) {
                            textColor = appData.tableTextColor;
                        } else {
                            textColor = colorConfig.text || (theme === 'dark' ? colorConfig.textDark : colorConfig.textLight) || colorConfig.textLight;
                        }

                        if (textColor && textColor !== 'inherit') {
                            tr.style.color = textColor;
                        }
                    }
                }
                 
                const selectionTd = document.createElement('td');
                selectionTd.className = "sticky-col p-1 text-center";
                let rowBgColor = 'inherit';
                if (tr.style.backgroundColor) {
                    rowBgColor = tr.style.backgroundColor;
                } else {
                    const isEven = rowIndex % 2 === 1;
                    rowBgColor = theme === 'dark' ? (isEven ? '#1f2937' : '#111827') : (isEven ? '#ffffff' : '#f9fafb');
                }
                selectionTd.style.backgroundColor = isSelected ? '' : rowBgColor;
                
                const selectButton = document.createElement('button');
                selectButton.className = `selection-button flex items-center justify-center w-8 h-8 rounded-md transition-colors ${isSelected ? 'bg-sky-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`;
                selectButton.innerHTML = isSelected ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>` : '';
                selectButton.onclick = () => handleRowSelection(row.id);
                selectionTd.appendChild(selectButton);
                tr.appendChild(selectionTd);
                
                appData.headers.forEach(header => {
                    const value = row[header] ?? '';
                    const td = document.createElement('td');
                    td.className = "p-0 text-center align-middle";
                    td.dataset.columnHeader = header;
                    const colWidth = (appData.columnWidths && appData.columnWidths[header]) || 'auto';
                    if (colWidth !== 'auto') {
                        td.style.width = colWidth;
                        td.style.minWidth = colWidth;
                        td.style.maxWidth = colWidth;
                    } else {
                        td.style.minWidth = '120px';
                    }
                    
                    if (header === daysDisplayCol) {
                        const diasValue = parseInt(value, 10);
                        const sortedAlerts = appData.visualAlerts ? [...appData.visualAlerts].sort((a, b) => b.value - a.value) : [];
                        let matchedAlert = null;
                        if (!isNaN(diasValue)) {
                            for (const alert of sortedAlerts) {
                                if (!alert.enabled) continue;
                                const alertValue = parseInt(alert.value, 10);
                                let conditionMet = false;
                                if (alert.condition === '>=') conditionMet = diasValue >= alertValue;
                                else if (alert.condition === '<=') conditionMet = diasValue <= alertValue;
                                else conditionMet = diasValue === alertValue;

                                if (conditionMet) {
                                    matchedAlert = alert;
                                    break;
                                }
                            }
                        }
                        if (matchedAlert) {
                            td.style.setProperty('background-color', matchedAlert.color.bg, 'important');
                            td.style.setProperty('color', matchedAlert.color.text || '#000000', 'important');
                            td.style.fontWeight = '700';
                        }
                    }
                    
                    const format = appData.columnFormats[header];
                    if (format === 'list') {
                        // ORDENAMIENTO ALFABÉTICO (A - Z) EN EL SELECTOR DE CELDAS
                        const options = getSortedListOptions(appData, header);
                        const select = document.createElement('select');
                        select.className = "w-full h-full p-3 bg-transparent border-0 focus:ring-0 text-center";
                        select.innerHTML = `<option value=""></option>` + options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                        select.onchange = (e) => handleCellUpdate(row.id, header, e.target.value);
                        select.style.color = 'inherit';
                        td.appendChild(select);
                    } else if (format === 'date') {
                        const input = createDateInputComponent(value, (newValue) => {
                            handleCellUpdate(row.id, header, newValue);
                        });
                        input.style.color = 'inherit';
                        td.appendChild(input);
                    } else {
                        const div = document.createElement('div');
                        div.className = "data-cell w-full h-full p-3";
                        div.setAttribute('contenteditable', 'true');
                        div.textContent = value;
                        div.onblur = (e) => handleCellUpdate(row.id, header, e.target.textContent);
                        div.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }};
                        div.style.color = 'inherit';
                        td.appendChild(div);
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }
        table.appendChild(tbody);
        elements.tableContainer.innerHTML = '';
        elements.tableContainer.appendChild(table);

        table.querySelectorAll('th[data-header-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const header = th.dataset.headerSort;
                if (appData.sortBy === header) {
                    appData.sortOrder = appData.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    appData.sortBy = header;
                    appData.sortOrder = 'asc';
                }
                saveData();
                sortAndApplyFilters();
            });
        });

        elements.rowCount.textContent = `${filteredData.length} de ${appData.mainData.length} registros`;
        renderPagination();
    }
    
    function createDateInputComponent(initialValue, onUpdateCallback) {
        const input = document.createElement('input');
        input.type = "text";
        input.className = "w-full h-full p-3 bg-transparent border-0 focus:ring-0 text-center date-cell";
        input.value = initialValue;
        let valueOnFocus = initialValue;

        input.onfocus = (e) => {
            valueOnFocus = e.target.value; 
            e.target.type = 'date';
            const date = parseDate(valueOnFocus);
            if (date) {
                e.target.value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
            } else {
                e.target.value = '';
            }
        };

        input.onblur = (e) => {
            e.target.type = 'text';
            let finalValue = '';
            if (e.target.value) {
                const dateObj = new Date(e.target.value + 'T00:00:00Z');
                if (!isNaN(dateObj)) {
                    finalValue = formatDate(dateObj);
                }
            }
            e.target.value = finalValue;

            if (finalValue !== valueOnFocus) {
                if (onUpdateCallback) onUpdateCallback(finalValue);
            } else {
                e.target.value = valueOnFocus;
            }
        };
        return input;
    }

    function renderPagination() {
        const totalPages = Math.ceil(filteredData.length / appData.rowsPerPage);
        const container = elements.paginationControlsBottom;
        container.innerHTML = '';
        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Anterior';
        prevBtn.className = "px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50 text-sm font-medium";
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
        container.appendChild(prevBtn);

        const pageInfo = document.createElement('span');
        pageInfo.className = "font-semibold text-sm";
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
        container.appendChild(pageInfo);

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Siguiente';
        nextBtn.className = "px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50 text-sm font-medium";
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
        container.appendChild(nextBtn);
    }
    
    function renderFilters() {
        filterManager.renderFilters();
    }

    function updateSummaryBar() {
        const bar = elements.summaryBar;
        bar.innerHTML = '';
        const colorCol = appData.colorCodingColumn;
        if (!colorCol) return;

        const counts = filteredData.reduce((acc, row) => {
            const value = row[colorCol] || `Sin ${colorCol}`;
            acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {});

        const theme = elements.htmlTag.classList.contains('dark') ? 'dark' : 'light';
        const colorDbKey = `_list_${colorCol}`;
        const colorDb = appData.referenceDB[colorDbKey];

        // Mostrar ordenado alfabéticamente A-Z
        const sortedKeys = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

        sortedKeys.forEach(value => {
            const count = counts[value];
            const span = document.createElement('span');
            span.className = 'text-xs px-2 py-1 rounded-full font-bold';
            
            const colorConfig = colorDb ? (colorDb[value] || colorDb['__DEFAULT__']) : null;
            if (colorConfig) {
                span.style.backgroundColor = colorConfig.bg || (theme === 'dark' ? colorConfig.dark : colorConfig.light) || colorConfig.light;
                span.style.color = colorConfig.text || (theme === 'dark' ? colorConfig.textDark : colorConfig.textLight) || colorConfig.textLight;
            } else {
                span.style.backgroundColor = theme === 'dark' ? '#374151' : '#e5e7eb';
                span.style.color = theme === 'dark' ? '#d1d5db' : '#374151';
            }
            span.textContent = `${value}: ${count}`;
            bar.appendChild(span);
        });
    }

    function updateSelectionStatus() {
        elements.deleteRowBtn.disabled = !selectedRowId;
        elements.generatePdfBtn.disabled = !(selectedRowId && selectedTemplateId);
        elements.editSelectedTemplateBtn.disabled = !selectedTemplateId;
        elements.deleteSelectedTemplateBtn.disabled = !selectedTemplateId;
        updateSelectedRowIdentifierDisplay();
    }

    function handleRowSelection(rowId) {
        selectedRowId = selectedRowId === rowId ? null : rowId;
        renderTable();
        updateSelectionStatus();
    }

    function updateSelectedRowIdentifierDisplay() {
        const display = elements.selectedRowIdentifierDisplay;
        if (!display) return;
        const idColumn = appData.selectedRowIdentifierColumn;

        if (selectedRowId && idColumn && appData.headers.includes(idColumn)) {
            const rowData = appData.mainData.find(r => r.id === selectedRowId);
            if (rowData) {
                const identifierValue = rowData[idColumn] || 'N/A';
                display.innerHTML = `<span class="font-medium">Seleccionado:</span> <span class="font-extrabold">${identifierValue}</span>`;
                display.title = `${idColumn}: ${identifierValue}`;
                display.style.display = 'block';
            } else {
                display.style.display = 'none';
            }
        } else {
            display.style.display = 'none';
        }
    }

    function applyTheme(theme) {
        elements.htmlTag.className = theme;
        fullReloadUI();
    }

    function fullReloadUI() {
        sortAndApplyFilters();
        renderFilters();
        renderTemplates();
        updateSelectionStatus();
    }

    function renderTemplates() {
        const select = elements.templateSelectDropdown;
        select.innerHTML = '';
        const hasTemplates = appData.templates && appData.templates.length > 0;
        const noneOption = document.createElement('option');
        noneOption.value = "";
        noneOption.textContent = hasTemplates ? 'Seleccionar plantilla...' : 'Crea una plantilla';
        select.appendChild(noneOption);

        if (hasTemplates) {
            // ORDENAMIENTO ALFABÉTICO (A - Z) EN PLANTILLAS
            const sortedTemplates = [...appData.templates].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
            sortedTemplates.forEach(template => {
                select.innerHTML += `<option value="${template.id}">${template.name}</option>`;
            });
        }
        select.value = selectedTemplateId || '';
    }

    // --- AUTO-SYNC ENGINE INTEGRATION ---
    const autoSyncEngine = createAutoSyncEngine(({ shouldSkipRender, fromOtherTab }) => {
        // Check if there is newer data in localStorage
        const storedStr = localStorage.getItem('gestorReclamosData_v43_generic');
        if (storedStr && fromOtherTab) {
            try {
                const parsed = JSON.parse(storedStr);
                if (parsed.headers && parsed.mainData) {
                    appData = parsed;
                }
            } catch (e) {
                console.error('Error sincronizando datos externos:', e);
            }
        }

        // Recalculate days based on current date
        const daysUpdated = recalculateAllDays();

        if (!shouldSkipRender) {
            sortAndApplyFilters();
            updateSummaryBar();
            updateSelectedRowIdentifierDisplay();
        } else if (daysUpdated) {
            updateSummaryBar();
        }
    }, () => lastLocalSaveTimestamp);

    // --- EXCEL AND BACKUP ---
    function exportDataToExcel(data, filename) {
        if (data.length === 0) { showToast("No hay datos para exportar.", "warning"); return false; }
        const { XLSX } = window;
        const dataToExport = data.map(row => {
            const exportRow = {};
            appData.headers.forEach(h => { exportRow[h] = row[h]; });
            return exportRow;
        });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: appData.headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
        XLSX.writeFile(workbook, filename);
        return true;
    }

    function exportFilteredToExcel() {
        elements.loadingOverlay.classList.add('active');
        setTimeout(() => {
            const filename = `gtn_datos_filtrados_${getFormattedDateForFilename()}.xlsx`;
            const success = exportDataToExcel(filteredData, filename);
            if (success) showToast('Datos exportados a Excel.', 'success');
            elements.loadingOverlay.classList.remove('active');
        }, 50);
    }

    function exportAllData() {
        elements.loadingOverlay.classList.add('active');
        setTimeout(() => {
            const dataStr = JSON.stringify(appData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); 
            a.href = url; 
            a.download = `gtn_v12_backup_completo_${getFormattedTimestampForFilename()}.json`;
            document.body.appendChild(a); 
            a.click(); 
            document.body.removeChild(a); 
            URL.revokeObjectURL(url);
            showToast('Copia de seguridad completa exportada.', 'success');
            elements.loadingOverlay.classList.remove('active');
        }, 50);
    }

    function importAllData(event) {
        const file = event.target.files[0]; 
        if (!file) return;

        elements.loadingOverlay.classList.add('active');
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawParsed = JSON.parse(e.target.result);
                // Validate if it is an object or array with data
                if (rawParsed && (rawParsed.headers || rawParsed.mainData || rawParsed.data || Array.isArray(rawParsed))) {
                    modalManager.showConfirmModal('Esto reemplazará TODOS los datos actuales con el contenido del archivo y migrará la estructura automáticamente. ¿Continuar?', () => {
                        try {
                            appData = normalizeAppData(rawParsed); 
                            saveData(); 
                            showToast('Copia de seguridad restaurada y migrada con éxito.', 'success'); 
                            setTimeout(() => location.reload(), 1200);
                        } catch (migErr) {
                            console.error('Error migrando datos:', migErr);
                            showToast('Error al migrar los datos del archivo.', 'error');
                        }
                    }, 'Restaurar Copia de Seguridad');
                } else { 
                    showToast('Archivo de copia de seguridad no válido.', 'error'); 
                }
            } catch (err) { 
                console.error(err);
                showToast('Error al leer el archivo JSON.', 'error'); 
            } finally {
                elements.loadingOverlay.classList.remove('active');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // --- SETUP EVENT LISTENERS ---
    function setupEventListeners() {
        elements.searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => { currentPage = 1; sortAndApplyFilters(); }, 300);
        });
        elements.addRowBtn.addEventListener('click', () => addRow());
        elements.deleteRowBtn.addEventListener('click', deleteRow);
        
        elements.increaseFontSizeBtn.addEventListener('click', () => {
            let current = appData.tableFontSize || 14;
            if (current < 24) current++;
            appData.tableFontSize = current;
            elements.tableContainer.style.setProperty('--table-font-size', `${current}px`);
            saveData();
        });
        elements.decreaseFontSizeBtn.addEventListener('click', () => {
            let current = appData.tableFontSize || 14;
            if (current > 10) current--;
            appData.tableFontSize = current;
            elements.tableContainer.style.setProperty('--table-font-size', `${current}px`);
            saveData();
        });

        elements.tableFontColorPicker.addEventListener('input', (e) => {
            appData.tableTextColor = e.target.value;
            elements.tableContainer.style.setProperty('--table-text-color', appData.tableTextColor);
            saveData();
        });

        elements.manageColsBtn.addEventListener('click', () => {
            columnsManager.openColumnsModal();
        });

        elements.exportAllBtn.addEventListener('click', exportAllData);
        elements.exportExcelBtn.addEventListener('click', exportFilteredToExcel);
        elements.importAllBtn.addEventListener('click', () => elements.importAllInput.click());
        elements.importAllInput.addEventListener('change', importAllData);
        
        elements.templateSelectDropdown.addEventListener('change', (e) => { 
            selectedTemplateId = e.target.value || null; 
            updateSelectionStatus(); 
        });

        elements.createTemplateBtn.addEventListener('click', () => {
            templateManager.openTemplateModal();
        });

        elements.editSelectedTemplateBtn.addEventListener('click', () => {
            if (selectedTemplateId) {
                templateManager.openTemplateModal(selectedTemplateId);
            } else {
                showToast('Por favor selecciona una plantilla para editar.', 'info');
            }
        });

        elements.deleteSelectedTemplateBtn.addEventListener('click', () => {
            templateManager.deleteSelectedTemplate();
        });

        elements.generatePdfBtn.addEventListener('click', () => {
            templateManager.startPdfGenerationFlow();
        });

        elements.manageDbBtn.addEventListener('click', () => {
            dbManager.renderDbTables();
            elements.dbModal.classList.add('active');
        });

        elements.dbModal.addEventListener('click', (e) => {
            if (e.target.id === 'close-db-btn' || e.target.closest('#close-db-btn')) { 
                elements.dbModal.classList.remove('active'); 
                fullReloadUI(); 
            }
            if (e.target.id === 'export-db-btn' || e.target.closest('#export-db-btn')) {
                dbManager.exportDb();
            }
            if (e.target.id === 'import-db-btn' || e.target.closest('#import-db-btn')) {
                const impInput = document.getElementById('import-db-input');
                if (impInput) impInput.click();
            }
            if (e.target.closest('.alert-delete-btn')) dbManager.handleAlertsDbDelete(e);
            else dbManager.handleDbDelete(e);
        });

        const importDbInput = document.getElementById('import-db-input');
        if (importDbInput) {
            importDbInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    dbManager.importDb(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        elements.dbModal.addEventListener('focusout', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.dataset.dbKey && e.target.dataset.isKey === 'true') {
                dbManager.handleDbUpdate(e);
            }
        });

        elements.dbModal.addEventListener('change', (e) => {
            if (e.target.classList.contains('alert-input') || e.target.classList.contains('alert-input-color')) {
                dbManager.handleAlertsDbUpdate(e);
            } else if (e.target.classList.contains('db-color-input')) {
                dbManager.handleColorDbUpdate(e);
            } else if (e.target.dataset.dbKey) {
                dbManager.handleDbUpdate(e);
            }
        });

        elements.dbModal.addEventListener('input', (e) => {
            if (e.target.classList.contains('alert-input-color')) {
                dbManager.handleAlertsDbUpdate(e);
                const row = e.target.closest('tr');
                if (row) {
                    const preview = row.querySelector('span.rounded');
                    const bgInput = row.querySelector('.alert-input-color[data-field="bg"]');
                    const textInput = row.querySelector('.alert-input-color[data-field="text"]');
                    if (preview && bgInput && textInput) {
                        preview.style.backgroundColor = bgInput.value;
                        preview.style.color = textInput.value;
                    }
                }
            } else if (e.target.classList.contains('db-color-input')) {
                dbManager.handleColorDbUpdate(e);
            }
        });
    }

    function openColumnsModal() {
        columnsManager.openColumnsModal();
    }

    // --- APP INITIALIZATION ---
    function init() {
        elements.loadingOverlay.classList.add('active');
        loadData();
        setupEventListeners();
        recalculateAllDays();
        autoSyncEngine.init();

        // SYNC THEME DIRECTLY WITH USER'S BROWSER
        try {
            localStorage.removeItem('theme');
        } catch (_) {}
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        applyTheme(mediaQuery.matches ? 'dark' : 'light');
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', (e) => {
                applyTheme(e.matches ? 'dark' : 'light');
            });
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener((e) => {
                applyTheme(e.matches ? 'dark' : 'light');
            });
        }
        elements.tableFontColorPicker.value = appData.tableTextColor === 'inherit' ? '#000000' : appData.tableTextColor;
        updateSelectedRowIdentifierDisplay();
        
        console.log('GTN v12 con Auto-Sync y Listas A-Z inicializado.');
        setTimeout(() => {
            elements.loadingOverlay.classList.remove('active');
        }, 200);
    }

    init();
});
