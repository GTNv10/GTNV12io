// Filter Management Module for GTN v12
import { showToast, parseDate, formatDate, getSortedListOptions } from './utils.js';

export function createFilterManager(getState, saveData, onFilterApplied, elements) {

    function isNumericColumn(appData, column) {
        if (!column) return false;
        if (column === appData.keyColumns?.daysDisplay) return true;
        if (appData.columnFormats && appData.columnFormats[column] === 'number') return true;
        return false;
    }

    function applyFiltersToData(sourceData, appData, generalQuery = '') {
        let data = [...sourceData];

        // 1. Hide settings filter (e.g. archived/hidden states)
        const hideSettings = appData.hideSettings;
        if (hideSettings && hideSettings.column && hideSettings.hiddenValues && hideSettings.hiddenValues.length > 0 && !generalQuery) {
            data = data.filter(row => !hideSettings.hiddenValues.includes(row[hideSettings.column]));
        }

        // 2. General search query across all headers
        const q = (generalQuery || '').toLowerCase().trim();
        if (q) {
            data = data.filter(row => 
                appData.headers.some(h => String(row[h] || '').toLowerCase().includes(q))
            );
        }

        // 3. Structured filters
        const activeFilters = (appData.filters || []).filter(f => {
            if (!f.column || !appData.headers.includes(f.column)) return false;
            if (f.condition === 'vacio' || f.condition === 'no_vacio') return true;
            return f.value !== undefined && f.value !== null && String(f.value).trim() !== '';
        });

        if (activeFilters.length > 0) {
            data = data.filter(row => {
                return activeFilters.every(filter => {
                    const col = filter.column;
                    const cond = filter.condition || 'contiene';
                    const filterVal = filter.value;
                    const rowVal = row[col];
                    const format = appData.columnFormats[col] || 'text';

                    // Empty / Non-empty checks
                    if (cond === 'vacio') {
                        return rowVal === undefined || rowVal === null || String(rowVal).trim() === '';
                    }
                    if (cond === 'no_vacio') {
                        return rowVal !== undefined && rowVal !== null && String(rowVal).trim() !== '';
                    }

                    // For all other checks, if rowVal is blank, condition fails
                    if (rowVal === undefined || rowVal === null || String(rowVal).trim() === '') {
                        if (format === 'list' && filterVal === '__VACIO__') return true;
                        return false;
                    }

                    // List format filter
                    if (format === 'list') {
                        if (filterVal === '__VACIO__') {
                            return String(rowVal).trim() === '';
                        }
                        if (cond === '!=') {
                            return String(rowVal) !== String(filterVal);
                        }
                        return String(rowVal) === String(filterVal);
                    }

                    // Date format filter
                    if (format === 'date') {
                        const rDate = parseDate(rowVal);
                        const fDate = parseDate(filterVal);
                        if (!rDate || !fDate) return false;

                        rDate.setUTCHours(0, 0, 0, 0);
                        fDate.setUTCHours(0, 0, 0, 0);

                        const rTime = rDate.getTime();
                        const fTime = fDate.getTime();

                        if (cond === '>=') return rTime >= fTime;
                        if (cond === '<=') return rTime <= fTime;
                        return rTime === fTime;
                    }

                    // Pure Numeric filter (e.g. DIAS)
                    if (isNumericColumn(appData, col)) {
                        const rNum = parseFloat(rowVal);
                        const fNum = parseFloat(filterVal);
                        if (isNaN(rNum) || isNaN(fNum)) return false;

                        if (cond === '>=') return rNum >= fNum;
                        if (cond === '<=') return rNum <= fNum;
                        return rNum === fNum;
                    }

                    // Text / CUIT / General strings
                    const sRow = String(rowVal).toLowerCase().trim();
                    const sFilter = String(filterVal).toLowerCase().trim();

                    if (cond === '=') return sRow === sFilter;
                    if (cond === 'no_contiene') return !sRow.includes(sFilter);
                    if (cond === 'empieza') return sRow.startsWith(sFilter);
                    
                    // Default condition: 'contiene'
                    return sRow.includes(sFilter);
                });
            });
        }

        return data;
    }

    function renderFilters() {
        const container = elements.filtersContainer;
        if (!container) return;
        container.innerHTML = '';

        const { appData } = getState();
        if (!appData.filters) appData.filters = [];

        const activeFiltersList = document.createElement('div');
        activeFiltersList.id = 'active-filters-list';
        activeFiltersList.className = 'flex flex-col gap-2 w-full';

        appData.filters.forEach((filter, index) => {
            const filterEl = createFilterRowUI(filter, index);
            activeFiltersList.appendChild(filterEl);
        });

        container.appendChild(activeFiltersList);

        // Control buttons bar
        const controls = document.createElement('div');
        controls.className = 'flex flex-wrap items-center gap-2 mt-2';

        // Add filter button
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'flex items-center gap-1.5 text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white py-1.5 px-3 rounded-lg shadow-sm transition-colors';
        addBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> <span>Añadir Filtro</span>`;
        addBtn.onclick = () => {
            appData.filters.push({ column: '', condition: 'contiene', value: '' });
            saveData();
            renderFilters();
        };
        controls.appendChild(addBtn);

        // Apply filters button
        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 rounded-lg shadow-sm transition-colors';
        applyBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> <span>Aplicar</span>`;
        applyBtn.onclick = () => {
            saveData();
            onFilterApplied();
            showToast('Filtros aplicados correctamente.', 'info');
        };
        controls.appendChild(applyBtn);

        // Clear filters button
        if (appData.filters.length > 0 || elements.searchInput.value) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'text-xs font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-1.5 px-3 rounded-lg transition-colors';
            clearBtn.textContent = 'Limpiar Todo';
            clearBtn.onclick = () => {
                appData.filters = [];
                elements.searchInput.value = '';
                saveData();
                renderFilters();
                onFilterApplied();
                showToast('Filtros reiniciados.', 'info');
            };
            controls.appendChild(clearBtn);
        }

        container.appendChild(controls);
    }

    function createFilterRowUI(filter, index) {
        const { appData } = getState();
        const row = document.createElement('div');
        row.className = 'flex flex-wrap items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/60 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm w-full';

        // 1. Column selector
        const colSelect = document.createElement('select');
        colSelect.className = 'p-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 font-medium min-w-[130px]';
        colSelect.innerHTML = `<option value="">-- Elegir Columna --</option>` + 
            appData.headers.map(h => `<option value="${h}" ${filter.column === h ? 'selected' : ''}>${h}</option>`).join('');

        colSelect.onchange = (e) => {
            const selectedCol = e.target.value;
            filter.column = selectedCol;
            filter.value = '';
            
            // Set intelligent default condition
            const format = appData.columnFormats[selectedCol] || 'text';
            if (format === 'list') {
                filter.condition = '=';
            } else if (format === 'date' || isNumericColumn(appData, selectedCol)) {
                filter.condition = '>=';
            } else {
                filter.condition = 'contiene';
            }

            saveData();
            renderFilters();
            onFilterApplied();
        };
        row.appendChild(colSelect);

        if (filter.column) {
            const format = appData.columnFormats[filter.column] || 'text';
            const isNumeric = isNumericColumn(appData, filter.column);

            // 2. Condition selector
            const condSelect = document.createElement('select');
            condSelect.className = 'p-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 font-medium';

            if (format === 'list') {
                condSelect.innerHTML = `
                    <option value="=" ${filter.condition === '=' ? 'selected' : ''}>Es igual a</option>
                    <option value="!=" ${filter.condition === '!=' ? 'selected' : ''}>No es igual a</option>
                    <option value="vacio" ${filter.condition === 'vacio' ? 'selected' : ''}>Está vacío</option>
                    <option value="no_vacio" ${filter.condition === 'no_vacio' ? 'selected' : ''}>Tiene valor</option>
                `;
            } else if (format === 'date') {
                condSelect.innerHTML = `
                    <option value=">=" ${filter.condition === '>=' ? 'selected' : ''}>Desde (&ge;)</option>
                    <option value="<=" ${filter.condition === '<=' ? 'selected' : ''}>Hasta (&le;)</option>
                    <option value="=" ${filter.condition === '=' ? 'selected' : ''}>Fecha exacta (=)</option>
                    <option value="vacio" ${filter.condition === 'vacio' ? 'selected' : ''}>Sin fecha</option>
                `;
            } else if (isNumeric) {
                condSelect.innerHTML = `
                    <option value=">=" ${filter.condition === '>=' ? 'selected' : ''}>Mayor o igual (&ge;)</option>
                    <option value="<=" ${filter.condition === '<=' ? 'selected' : ''}>Menor o igual (&le;)</option>
                    <option value="=" ${filter.condition === '=' ? 'selected' : ''}>Igual a (=)</option>
                    <option value="vacio" ${filter.condition === 'vacio' ? 'selected' : ''}>Sin número</option>
                `;
            } else {
                condSelect.innerHTML = `
                    <option value="contiene" ${filter.condition === 'contiene' ? 'selected' : ''}>Contiene</option>
                    <option value="=" ${filter.condition === '=' ? 'selected' : ''}>Es exactamente igual a</option>
                    <option value="empieza" ${filter.condition === 'empieza' ? 'selected' : ''}>Empieza con</option>
                    <option value="no_contiene" ${filter.condition === 'no_contiene' ? 'selected' : ''}>No contiene</option>
                    <option value="vacio" ${filter.condition === 'vacio' ? 'selected' : ''}>Está vacío</option>
                    <option value="no_vacio" ${filter.condition === 'no_vacio' ? 'selected' : ''}>No está vacío</option>
                `;
            }

            condSelect.onchange = (e) => {
                filter.condition = e.target.value;
                saveData();
                renderFilters();
                onFilterApplied();
            };
            row.appendChild(condSelect);

            // 3. Value input / selector (hidden if condition is vacio or no_vacio)
            if (filter.condition !== 'vacio' && filter.condition !== 'no_vacio') {
                if (format === 'list') {
                    const listOptions = getSortedListOptions(appData, filter.column);
                    const valSelect = document.createElement('select');
                    valSelect.className = 'flex-grow p-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-sky-500';
                    valSelect.innerHTML = `<option value="">-- Cualquier valor --</option>` + 
                        listOptions.map(opt => `<option value="${opt}" ${filter.value === opt ? 'selected' : ''}>${opt}</option>`).join('') +
                        `<option value="__VACIO__" ${filter.value === '__VACIO__' ? 'selected' : ''}>(Sin valor)</option>`;

                    valSelect.onchange = (e) => {
                        filter.value = e.target.value;
                        saveData();
                        onFilterApplied();
                    };
                    row.appendChild(valSelect);
                } else if (format === 'date') {
                    const dateInput = document.createElement('input');
                    dateInput.type = 'date';
                    dateInput.className = 'flex-grow p-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 font-mono';
                    
                    // Convert DD/MM/YYYY to YYYY-MM-DD for native datepicker
                    if (filter.value) {
                        const parsed = parseDate(filter.value);
                        if (parsed) {
                            dateInput.value = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
                        }
                    }

                    dateInput.onchange = (e) => {
                        const val = e.target.value;
                        if (val) {
                            const [y, m, d] = val.split('-');
                            filter.value = `${d}/${m}/${y}`;
                        } else {
                            filter.value = '';
                        }
                        saveData();
                        onFilterApplied();
                    };
                    row.appendChild(dateInput);
                } else if (isNumeric) {
                    const numInput = document.createElement('input');
                    numInput.type = 'number';
                    numInput.placeholder = 'Número...';
                    numInput.value = filter.value || '';
                    numInput.className = 'flex-grow p-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 font-mono';
                    numInput.oninput = () => {
                        filter.value = numInput.value;
                        saveData();
                        onFilterApplied();
                    };
                    row.appendChild(numInput);
                } else {
                    const textInput = document.createElement('input');
                    textInput.type = 'text';
                    textInput.placeholder = 'Buscar texto...';
                    textInput.value = filter.value || '';
                    textInput.className = 'flex-grow p-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-sky-500';
                    textInput.oninput = () => {
                        filter.value = textInput.value;
                        saveData();
                        onFilterApplied();
                    };
                    row.appendChild(textInput);
                }
            }
        }

        // 4. Delete filter button
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 font-bold text-lg leading-none rounded transition-colors';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Eliminar este filtro';
        removeBtn.onclick = () => {
            appData.filters.splice(index, 1);
            saveData();
            renderFilters();
            onFilterApplied();
        };
        row.appendChild(removeBtn);

        return row;
    }

    return {
        renderFilters,
        applyFiltersToData
    };
}
