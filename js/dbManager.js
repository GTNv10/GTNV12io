// Complete Database, References, Lookups & Settings Manager for GTN v12
import { 
    showToast, 
    sortReferenceDbObject, 
    getSortedListOptions, 
    isDefaultKey,
    parseDate, 
    formatDate,
    getFormattedDateForFilename 
} from './utils.js';
import { normalizeAppData } from './migrationHelper.js';

export function createDbManager(getState, onSaveData, onFullReloadUI, modalManager) {
    const { showConfirmModal, showPromptModal } = modalManager;
    let activeTab = 'lists';
    let bulkDeleteState = {
        selectedStatuses: new Set(),
        dateColumn: '',
        dateValue: ''
    };

    function renderDbTables() {
        renderTabsNav();
        renderActiveTabContent();
    }

    function renderTabsNav() {
        const navContainer = document.getElementById('db-nav-tabs');
        if (!navContainer) return;
        const buttons = navContainer.querySelectorAll('.db-tab-btn');
        buttons.forEach(btn => {
            const tab = btn.dataset.tab;
            if (tab === activeTab) {
                btn.className = 'db-tab-btn active px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 font-bold shadow-sm';
            } else {
                btn.className = 'db-tab-btn px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium';
            }
            btn.onclick = () => {
                activeTab = tab;
                renderTabsNav();
                renderActiveTabContent();
            };
        });
    }

    function renderActiveTabContent() {
        const container = document.getElementById('db-tab-content-container');
        if (!container) return;
        container.innerHTML = '';

        switch (activeTab) {
            case 'lists':
                renderListsTab(container);
                break;
            case 'lookups':
                renderLookupsTab(container);
                break;
            case 'colors-alerts':
                renderColorsAlertsTab(container);
                break;
            case 'maintenance':
                renderMaintenanceTab(container);
                break;
            case 'settings':
                renderSettingsTab(container);
                break;
            default:
                renderListsTab(container);
        }
    }

    // ==========================================
    // TAB 1: LISTAS DESPLEGABLES (A - Z)
    // ==========================================
    function renderListsTab(container) {
        const { appData } = getState();
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-6';

        // Top bar for lists
        const headerBar = document.createElement('div');
        headerBar.className = 'flex flex-wrap justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm gap-3';
        headerBar.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>📋 Listas Desplegables</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">Orden Estricto A - Z</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Cree y administre las listas de opciones para celdas desplegables y filtros. Cada nuevo valor se ordena automáticamente de la A a la Z.
                </p>
            </div>
        `;

        const createListBtn = document.createElement('button');
        createListBtn.className = 'flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors shadow-sm';
        createListBtn.innerHTML = `<span>+ Nueva Lista</span>`;
        createListBtn.onclick = () => {
            showPromptModal('Nombre de la nueva lista (ej: SECTOR, PRIORIDAD, TIPO):', (name) => {
                name = name.trim().toUpperCase();
                if (!name) return showToast('El nombre no puede estar vacío.', 'warning');
                const listKey = `_list_${name}`;
                if (appData.referenceDB[listKey]) return showToast('Ya existe una lista con ese nombre.', 'warning');

                appData.referenceDB[listKey] = {
                    '__DEFAULT__': { light: '#f9fafb', dark: '#111827', textLight: '#1f2937', textDark: '#f3f4f6' },
                    'OPCIÓN A': { light: '#e0f2fe', dark: '#0c4a6e', textLight: '#0369a1', textDark: '#bae6fd' },
                    'OPCIÓN B': { light: '#fef3c7', dark: '#78350f', textLight: '#b45309', textDark: '#fde68a' }
                };
                appData.referenceDB[listKey] = sortReferenceDbObject(appData.referenceDB[listKey]);

                // If header exists, assign format
                if (appData.headers.includes(name)) {
                    appData.columnFormats[name] = 'list';
                }

                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
                showToast(`Lista "${name}" creada con éxito (A-Z).`, 'success');
            });
        };
        headerBar.appendChild(createListBtn);
        wrapper.appendChild(headerBar);

        // Render each list
        const lists = Object.entries(appData.referenceDB).filter(([k]) => k.startsWith('_list_'));
        if (lists.length === 0) {
            wrapper.innerHTML += `
                <div class="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p class="text-gray-500 dark:text-gray-400">No hay listas desplegables configuradas aún.</p>
                </div>
            `;
        } else {
            lists.forEach(([listKey, data]) => {
                const listName = listKey.replace('_list_', '');
                const listCard = document.createElement('div');
                listCard.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';

                const cardHeader = document.createElement('div');
                cardHeader.className = 'flex flex-wrap justify-between items-center gap-3 pb-3 border-b dark:border-gray-700';

                const sortedEntries = getSortedListOptions(appData, listKey);
                cardHeader.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="text-lg font-bold text-gray-800 dark:text-gray-100">${listName}</span>
                        <span class="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">${sortedEntries.length} opciones</span>
                        ${appData.columnFormats[listName] === 'list' ? '<span class="text-xs bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded font-medium">Vinculada a Columna</span>' : ''}
                    </div>
                `;

                const headerActions = document.createElement('div');
                headerActions.className = 'flex items-center gap-2';

                const addOptionBtn = document.createElement('button');
                addOptionBtn.className = 'text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-lg transition-colors';
                addOptionBtn.textContent = '+ Añadir Opción';
                addOptionBtn.onclick = () => {
                    showPromptModal(`Nuevo valor para la lista "${listName}":`, (val) => {
                        val = val.trim();
                        if (!val) return showToast('El valor no puede estar vacío.', 'warning');
                        if (appData.referenceDB[listKey][val]) return showToast('Esa opción ya existe en la lista.', 'warning');

                        appData.referenceDB[listKey][val] = {
                            light: '#ffffff',
                            textLight: '#1f2937',
                            dark: '#1f2937',
                            textDark: '#f3f4f6'
                        };
                        appData.referenceDB[listKey] = sortReferenceDbObject(appData.referenceDB[listKey]);
                        onSaveData();
                        renderActiveTabContent();
                        onFullReloadUI();
                        showToast(`"${val}" añadido en orden alfabético A-Z.`, 'success');
                    });
                };
                headerActions.appendChild(addOptionBtn);

                const deleteListBtn = document.createElement('button');
                deleteListBtn.className = 'text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 font-semibold py-1.5 px-3 rounded-lg transition-colors';
                deleteListBtn.textContent = 'Eliminar Lista';
                deleteListBtn.onclick = () => {
                    showConfirmModal(`¿Está seguro de eliminar la lista "${listName}"? Si alguna columna utiliza esta lista, pasará a formato Texto.`, () => {
                        delete appData.referenceDB[listKey];
                        if (appData.columnFormats[listName] === 'list') {
                            appData.columnFormats[listName] = 'text';
                        }
                        if (appData.colorCodingColumn === listName) appData.colorCodingColumn = null;
                        if (appData.hideSettings.column === listName) appData.hideSettings.column = null;
                        if (appData.bulkDeleteColumn === listName) appData.bulkDeleteColumn = null;
                        onSaveData();
                        renderActiveTabContent();
                        onFullReloadUI();
                        showToast(`Lista "${listName}" eliminada.`, 'info');
                    });
                };
                headerActions.appendChild(deleteListBtn);
                cardHeader.appendChild(headerActions);
                listCard.appendChild(cardHeader);

                // Table of options with color pickers and A-Z ordering
                const tableContainer = document.createElement('div');
                tableContainer.className = 'overflow-x-auto';
                const table = document.createElement('table');
                table.className = 'w-full text-xs md:text-sm';
                table.innerHTML = `
                    <thead class="text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700 uppercase bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                            <th class="p-2.5 text-left">Valor (Ordenado A - Z)</th>
                            <th class="p-2.5 text-center">Color de Fondo</th>
                            <th class="p-2.5 text-center">Color de Texto</th>
                            <th class="p-2.5 text-center">Muestra</th>
                            <th class="p-2.5 text-center w-12">Acción</th>
                        </tr>
                    </thead>
                `;

                const tbody = document.createElement('tbody');
                const entries = [];
                if (data['__DEFAULT__']) entries.push(['__DEFAULT__', data['__DEFAULT__']]);
                sortedEntries.forEach(k => {
                    if (data[k]) entries.push([k, data[k]]);
                });

                entries.forEach(([key, values]) => {
                    if (!values) return;
                    const isDefault = key === '__DEFAULT__';
                    const tr = document.createElement('tr');
                    tr.className = 'border-b dark:border-gray-700/60 hover:bg-gray-50/50 dark:hover:bg-gray-700/50';

                    const currentBg = values.bg || values.light || values.dark || '#ffffff';
                    const currentText = values.text || values.textLight || values.textDark || '#000000';

                    tr.innerHTML = `
                        <td class="p-2">
                            ${isDefault 
                                ? '<span class="italic text-gray-400 font-medium">Por Defecto / Sin Valor</span>' 
                                : `<input type="text" value="${key}" class="db-list-key-input font-semibold w-full p-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-800 dark:text-gray-200" data-db-key="${listKey}" data-entry-key="${key}" data-is-key="true">`}
                        </td>
                        <td class="p-2 text-center">
                            <input type="color" class="db-color-input w-9 h-8 p-0 border-0 bg-transparent rounded cursor-pointer mx-auto" value="${currentBg}" data-db-key="${listKey}" data-entry-key="${key}" data-field="bg" title="Color de Fondo">
                        </td>
                        <td class="p-2 text-center">
                            <input type="color" class="db-color-input w-9 h-8 p-0 border-0 bg-transparent rounded cursor-pointer mx-auto" value="${currentText}" data-db-key="${listKey}" data-entry-key="${key}" data-field="text" title="Color de Texto">
                        </td>
                        <td class="p-2 text-center align-middle">
                            <span class="color-sample-badge inline-block px-3 py-1 rounded-full text-xs font-bold shadow-xs transition-colors" style="background-color: ${currentBg}; color: ${currentText}">
                                ${isDefault ? 'Ejemplo' : key}
                            </span>
                        </td>
                        <td class="p-2 text-center">
                            ${isDefault ? '' : `<button class="db-delete-btn text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 font-bold p-1 rounded transition-colors" data-db-key="${listKey}" data-entry-key="${key}" title="Eliminar opción">&times;</button>`}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                table.appendChild(tbody);
                tableContainer.appendChild(table);
                listCard.appendChild(tableContainer);
                wrapper.appendChild(listCard);
            });
        }

        container.appendChild(wrapper);
    }

    // ==========================================
    // TAB 2: TABLAS DE REFERENCIA Y LOOKUPS
    // ==========================================
    function renderLookupsTab(container) {
        const { appData } = getState();
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-8';

        // Section A: Tablas de Referencia (Padrón / Datos externos)
        const refTablesSection = document.createElement('div');
        refTablesSection.className = 'space-y-4';

        const refHeader = document.createElement('div');
        refHeader.className = 'flex flex-wrap justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm gap-3';
        refHeader.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>📑 Tablas de Referencia de Datos</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Defina tablas de entidades (ej: Padrón de Empresas, Proveedores o Clientes) con múltiples campos para alimentar automáticamente la tabla principal.
                </p>
            </div>
        `;

        const createLookupTableBtn = document.createElement('button');
        createLookupTableBtn.className = 'flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors shadow-sm';
        createLookupTableBtn.innerHTML = `<span>+ Nueva Tabla de Referencia</span>`;
        createLookupTableBtn.onclick = () => {
            showPromptModal('Nombre de la nueva tabla de referencia (ej: EMPRESAS, CLIENTES):', (name) => {
                name = name.trim().toUpperCase();
                if (!name) return showToast('El nombre no puede estar vacío.', 'warning');
                const dbKey = `_lookup_${name}`;
                if (appData.referenceDB[dbKey]) return showToast('Ya existe una tabla con ese nombre.', 'warning');

                appData.referenceDB[dbKey] = {
                    '__FIELDS__': { 'NOMBRE': 'text', 'DIRECCION': 'text', 'TELEFONO': 'text' },
                    '20-12345678-9': { 'NOMBRE': 'EMPRESA EJEMPLO S.A.', 'DIRECCION': 'Av. Principal 123', 'TELEFONO': '011-4567-8900' }
                };

                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
                showToast(`Tabla "${name}" creada.`, 'success');
            });
        };
        refHeader.appendChild(createLookupTableBtn);
        refTablesSection.appendChild(refHeader);

        // Render each lookup table
        const lookupTables = Object.entries(appData.referenceDB).filter(([k]) => k.startsWith('_lookup_'));
        if (lookupTables.length === 0) {
            refTablesSection.innerHTML += `
                <div class="p-6 text-center bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500">
                    No hay tablas de referencia aún. Cree una como "EMPRESAS" para comenzar a autocompletar datos.
                </div>
            `;
        } else {
            lookupTables.forEach(([dbKey, data]) => {
                const tableName = dbKey.replace('_lookup_', '');
                const fieldsMap = data['__FIELDS__'] || { 'Dato 1': 'text' };
                const fieldNames = Object.keys(fieldsMap);

                const card = document.createElement('div');
                card.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';

                const cardHead = document.createElement('div');
                cardHead.className = 'flex flex-wrap justify-between items-center gap-3 pb-3 border-b dark:border-gray-700';
                cardHead.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-lg text-gray-800 dark:text-gray-100">${tableName}</span>
                        <span class="text-xs font-mono bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">Tabla Maestra</span>
                    </div>
                `;

                const actions = document.createElement('div');
                actions.className = 'flex items-center gap-2';

                const addRowBtn = document.createElement('button');
                addRowBtn.className = 'text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-lg';
                addRowBtn.textContent = '+ Añadir Registro';
                addRowBtn.onclick = () => {
                    showPromptModal(`Código identificador para el registro en "${tableName}":`, (code) => {
                        code = code.trim();
                        if (!code) return showToast('El código es obligatorio.', 'warning');
                        if (data[code]) return showToast('Ese código ya existe en la tabla.', 'warning');

                        const newRow = {};
                        fieldNames.forEach(f => newRow[f] = '');
                        data[code] = newRow;

                        onSaveData();
                        renderActiveTabContent();
                        onFullReloadUI();
                        showToast(`Registro "${code}" añadido.`, 'success');
                    });
                };
                actions.appendChild(addRowBtn);

                const addFieldBtn = document.createElement('button');
                addFieldBtn.className = 'text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold py-1.5 px-3 rounded-lg';
                addFieldBtn.textContent = '+ Añadir Campo';
                addFieldBtn.onclick = () => {
                    showPromptModal(`Nombre del nuevo campo/columna para "${tableName}":`, (fName) => {
                        fName = fName.trim().toUpperCase();
                        if (!fName) return;
                        if (fieldsMap[fName]) return showToast('Ese campo ya existe.', 'warning');

                        fieldsMap[fName] = 'text';
                        Object.keys(data).forEach(k => {
                            if (k !== '__FIELDS__') data[k][fName] = '';
                        });

                        onSaveData();
                        renderActiveTabContent();
                        onFullReloadUI();
                        showToast(`Campo "${fName}" añadido.`, 'success');
                    });
                };
                actions.appendChild(addFieldBtn);

                const deleteTableBtn = document.createElement('button');
                deleteTableBtn.className = 'text-xs bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 font-semibold py-1.5 px-3 rounded-lg';
                deleteTableBtn.textContent = 'Eliminar Tabla';
                deleteTableBtn.onclick = () => {
                    showConfirmModal(`¿Eliminar la tabla de referencia "${tableName}" y todas sus relaciones?`, () => {
                        delete appData.referenceDB[dbKey];
                        appData.lookupRelations = (appData.lookupRelations || []).filter(r => r.sourceDB !== dbKey);
                        onSaveData();
                        renderActiveTabContent();
                        onFullReloadUI();
                        showToast(`Tabla "${tableName}" eliminada.`, 'info');
                    });
                };
                actions.appendChild(deleteTableBtn);
                cardHead.appendChild(actions);
                card.appendChild(cardHead);

                // Table rows
                const tableWrap = document.createElement('div');
                tableWrap.className = 'overflow-x-auto max-h-72 overflow-y-auto';
                const table = document.createElement('table');
                table.className = 'w-full text-xs md:text-sm';
                
                let ths = `<th class="p-2 text-left bg-gray-50 dark:bg-gray-900/50">Código (Clave)</th>` +
                    fieldNames.map(f => `<th class="p-2 text-left bg-gray-50 dark:bg-gray-900/50">${f}</th>`).join('') +
                    `<th class="p-2 text-center bg-gray-50 dark:bg-gray-900/50 w-12"></th>`;
                table.innerHTML = `<thead><tr class="border-b dark:border-gray-700">${ths}</tr></thead>`;

                const tbody = document.createElement('tbody');
                const rowEntries = Object.entries(data).filter(([k]) => k !== '__FIELDS__');
                
                rowEntries.forEach(([code, fields]) => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b dark:border-gray-700/60';
                    let tds = `
                        <td class="p-1.5 font-semibold text-gray-800 dark:text-gray-200">
                            <input type="text" value="${code}" class="db-lookup-key-input w-full p-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded" data-db-key="${dbKey}" data-entry-key="${code}" data-is-key="true">
                        </td>
                    `;
                    fieldNames.forEach(f => {
                        tds += `
                            <td class="p-1.5">
                                <input type="text" value="${fields[f] || ''}" class="db-lookup-val-input w-full p-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded" data-db-key="${dbKey}" data-entry-key="${code}" data-field="${f}">
                            </td>
                        `;
                    });
                    tds += `
                        <td class="p-1.5 text-center">
                            <button class="db-delete-btn text-red-500 hover:text-red-700 font-bold px-1" data-db-key="${dbKey}" data-entry-key="${code}">&times;</button>
                        </td>
                    `;
                    tr.innerHTML = tds;
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                tableWrap.appendChild(table);
                card.appendChild(tableWrap);
                refTablesSection.appendChild(card);
            });
        }
        wrapper.appendChild(refTablesSection);

        // Section B: Relaciones de Autocompletado (Lookups)
        const relationsSection = document.createElement('div');
        relationsSection.className = 'space-y-4 pt-4 border-t dark:border-gray-700';

        const relHeader = document.createElement('div');
        relHeader.className = 'flex flex-wrap justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm gap-3';
        relHeader.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>🔗 Relaciones de Autocompletado (Lookups)</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Conecte una columna de la tabla principal con una tabla de referencia. Al escribir el código, las demás columnas se autocompletarán solas.
                </p>
            </div>
        `;

        const addRelationBtn = document.createElement('button');
        addRelationBtn.className = 'flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors shadow-sm';
        addRelationBtn.innerHTML = `<span>+ Nueva Relación</span>`;
        addRelationBtn.onclick = () => {
            if (lookupTables.length === 0) {
                return showToast('Primero debe crear al menos una tabla de referencia arriba.', 'warning');
            }
            const firstTable = lookupTables[0][0];
            const newRelation = {
                id: Date.now(),
                name: `Relación con ${firstTable.replace('_lookup_', '')}`,
                enabled: true,
                keyColumn: appData.headers[0] || '',
                sourceDB: firstTable,
                targetMap: {}
            };
            if (!appData.lookupRelations) appData.lookupRelations = [];
            appData.lookupRelations.push(newRelation);
            onSaveData();
            renderActiveTabContent();
            onFullReloadUI();
            showToast('Nueva relación creada. Configure los mapeos a continuación.', 'info');
        };
        relHeader.appendChild(addRelationBtn);
        relationsSection.appendChild(relHeader);

        // Render relations
        const relations = appData.lookupRelations || [];
        if (relations.length === 0) {
            relationsSection.innerHTML += `
                <div class="p-6 text-center bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500">
                    No hay relaciones de autocompletado activas. Haga clic en "+ Nueva Relación" para conectar sus columnas.
                </div>
            `;
        } else {
            relations.forEach((rel, index) => {
                const relCard = document.createElement('div');
                relCard.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';

                const sourceFields = Object.keys(appData.referenceDB[rel.sourceDB]?.['__FIELDS__'] || {});

                relCard.innerHTML = `
                    <div class="flex flex-wrap justify-between items-center pb-3 border-b dark:border-gray-700 gap-3">
                        <div class="flex items-center gap-3">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" class="rel-enable-toggle h-5 w-5 rounded text-sky-600 focus:ring-sky-500" ${rel.enabled ? 'checked' : ''} data-index="${index}">
                                <span class="font-bold text-gray-800 dark:text-gray-100 text-base">${rel.name}</span>
                            </label>
                        </div>
                        <button class="rel-delete-btn text-xs bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold py-1.5 px-3 rounded-lg" data-index="${index}">
                            Eliminar Relación
                        </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Columna Clave en Tabla Principal (Disparador):</label>
                            <select class="rel-key-col-select w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm" data-index="${index}">
                                ${appData.headers.map(h => `<option value="${h}" ${rel.keyColumn === h ? 'selected' : ''}>${h}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Tabla de Referencia Origen:</label>
                            <select class="rel-source-db-select w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm" data-index="${index}">
                                ${lookupTables.map(([k]) => `<option value="${k}" ${rel.sourceDB === k ? 'selected' : ''}>${k.replace('_lookup_', '')}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="space-y-2 pt-2">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Mapeo de Campos a Autocompletar:</span>
                            <button class="add-mapping-btn text-xs text-sky-600 dark:text-sky-400 hover:underline font-semibold" data-index="${index}">+ Añadir Mapeo</button>
                        </div>
                        <div class="mappings-list space-y-2" id="mappings-list-${index}"></div>
                    </div>
                `;

                relationsSection.appendChild(relCard);

                // Render mappings
                setTimeout(() => {
                    const mappingsList = document.getElementById(`mappings-list-${index}`);
                    if (!mappingsList) return;
                    const mapEntries = Object.entries(rel.targetMap || {});
                    if (mapEntries.length === 0) {
                        mappingsList.innerHTML = `<p class="text-xs text-gray-400 italic">No hay columnas mapeadas. Haz clic en "+ Añadir Mapeo".</p>`;
                    } else {
                        mapEntries.forEach(([srcField, tgtCol]) => {
                            const mapRow = document.createElement('div');
                            mapRow.className = 'flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-700/60 p-2 rounded-lg';
                            mapRow.innerHTML = `
                                <span class="text-gray-500 dark:text-gray-400 font-medium">Copiar campo</span>
                                <span class="font-bold text-indigo-600 dark:text-indigo-400">${srcField}</span>
                                <span class="text-gray-500 dark:text-gray-400 font-medium">hacia columna</span>
                                <span class="font-bold text-emerald-600 dark:text-emerald-400">${tgtCol}</span>
                                <button class="delete-map-btn ml-auto text-red-500 hover:text-red-700 font-bold px-2" data-index="${index}" data-field="${srcField}">&times;</button>
                            `;
                            mappingsList.appendChild(mapRow);
                        });
                    }
                }, 0);
            });
        }

        wrapper.appendChild(relationsSection);
        container.appendChild(wrapper);

        // Bind relations events
        bindRelationsEvents(container);
    }

    function bindRelationsEvents(container) {
        const { appData } = getState();
        container.addEventListener('change', (e) => {
            if (e.target.classList.contains('rel-enable-toggle')) {
                const idx = parseInt(e.target.dataset.index, 10);
                if (appData.lookupRelations[idx]) {
                    appData.lookupRelations[idx].enabled = e.target.checked;
                    onSaveData();
                }
            } else if (e.target.classList.contains('rel-key-col-select')) {
                const idx = parseInt(e.target.dataset.index, 10);
                if (appData.lookupRelations[idx]) {
                    appData.lookupRelations[idx].keyColumn = e.target.value;
                    onSaveData();
                }
            } else if (e.target.classList.contains('rel-source-db-select')) {
                const idx = parseInt(e.target.dataset.index, 10);
                if (appData.lookupRelations[idx]) {
                    appData.lookupRelations[idx].sourceDB = e.target.value;
                    appData.lookupRelations[idx].targetMap = {};
                    onSaveData();
                    renderActiveTabContent();
                }
            } else if (e.target.classList.contains('db-lookup-val-input')) {
                const { dbKey, entryKey, field } = e.target.dataset;
                if (appData.referenceDB[dbKey]?.[entryKey]) {
                    appData.referenceDB[dbKey][entryKey][field] = e.target.value;
                    onSaveData();
                }
            }
        });

        container.addEventListener('focusout', (e) => {
            if (e.target.classList.contains('db-lookup-key-input')) {
                const { dbKey, entryKey } = e.target.dataset;
                const newCode = e.target.value.trim();
                if (newCode && newCode !== entryKey) {
                    if (appData.referenceDB[dbKey]?.[newCode]) {
                        showToast('Ese código ya existe en la tabla.', 'warning');
                        e.target.value = entryKey;
                        return;
                    }
                    const rowData = appData.referenceDB[dbKey][entryKey];
                    delete appData.referenceDB[dbKey][entryKey];
                    appData.referenceDB[dbKey][newCode] = rowData;
                    e.target.dataset.entryKey = newCode;
                    onSaveData();
                    showToast(`Código actualizado a "${newCode}".`, 'success');
                }
            }
        });

        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('rel-delete-btn')) {
                const idx = parseInt(e.target.dataset.index, 10);
                showConfirmModal('¿Desea eliminar esta relación de autocompletado?', () => {
                    appData.lookupRelations.splice(idx, 1);
                    onSaveData();
                    renderActiveTabContent();
                    onFullReloadUI();
                    showToast('Relación eliminada.', 'info');
                });
            } else if (e.target.classList.contains('add-mapping-btn')) {
                const idx = parseInt(e.target.dataset.index, 10);
                const rel = appData.lookupRelations[idx];
                const sourceFields = Object.keys(appData.referenceDB[rel.sourceDB]?.['__FIELDS__'] || {});
                if (sourceFields.length === 0) return showToast('La tabla origen no tiene campos definidos.', 'warning');

                showPromptModal(`Campo origen (${sourceFields.join(', ')}):`, (srcField) => {
                    srcField = srcField.trim();
                    if (!sourceFields.includes(srcField)) {
                        return showToast(`El campo debe ser uno de: ${sourceFields.join(', ')}`, 'warning');
                    }
                    showPromptModal(`Columna destino en la tabla principal (${appData.headers.join(', ')}):`, (tgtCol) => {
                        tgtCol = tgtCol.trim();
                        if (!appData.headers.includes(tgtCol)) {
                            return showToast(`La columna debe existir en la tabla principal.`, 'warning');
                        }
                        if (!rel.targetMap) rel.targetMap = {};
                        rel.targetMap[srcField] = tgtCol;
                        onSaveData();
                        renderActiveTabContent();
                        showToast('Mapeo añadido correctamente.', 'success');
                    });
                });
            } else if (e.target.classList.contains('delete-map-btn')) {
                const idx = parseInt(e.target.dataset.index, 10);
                const field = e.target.dataset.field;
                if (appData.lookupRelations[idx]?.targetMap) {
                    delete appData.lookupRelations[idx].targetMap[field];
                    onSaveData();
                    renderActiveTabContent();
                    showToast('Mapeo quitado.', 'info');
                }
            }
        });
    }

    // ==========================================
    // TAB 3: COLORES Y ALERTAS POR VENCIMIENTO
    // ==========================================
    function renderColorsAlertsTab(container) {
        const { appData } = getState();
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-8';

        const listColumns = appData.headers.filter(h => appData.columnFormats[h] === 'list');

        // Section A: Codificación de color de fila
        const colorSection = document.createElement('div');
        colorSection.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';
        colorSection.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>🎨 Codificación de Color de Filas</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Seleccione una columna con opciones de lista (ej: ESTADO) para que las filas de la tabla principal se coloreen automáticamente según su valor.
                </p>
            </div>
            <div class="flex items-center gap-3 max-w-md">
                <label class="font-semibold text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Colorear filas según:</label>
                <select id="color-coding-col-select" class="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm w-full">
                    <option value="">-- Ninguna --</option>
                    ${listColumns.map(h => `<option value="${h}" ${appData.colorCodingColumn === h ? 'selected' : ''}>${h}</option>`).join('')}
                </select>
            </div>
        `;

        if (appData.colorCodingColumn) {
            const colorDbKey = `_list_${appData.colorCodingColumn}`;
            const colorDbData = appData.referenceDB[colorDbKey];
            if (colorDbData) {
                const palettePreview = document.createElement('div');
                palettePreview.className = 'pt-3 border-t dark:border-gray-700';
                palettePreview.innerHTML = `<h5 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Paleta Activa para "${appData.colorCodingColumn}" (A-Z)</h5>`;
                
                const table = document.createElement('table');
                table.className = 'w-full text-xs md:text-sm';
                table.innerHTML = `
                    <thead class="text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                            <th class="p-2.5 text-left">Valor</th>
                            <th class="p-2.5 text-center">Color de Fondo</th>
                            <th class="p-2.5 text-center">Color de Texto</th>
                            <th class="p-2.5 text-center">Muestra</th>
                        </tr>
                    </thead>
                `;
                const tbody = document.createElement('tbody');
                const sortedKeys = getSortedListOptions(appData, colorDbKey);
                const entries = [];
                if (colorDbData['__DEFAULT__']) entries.push(['__DEFAULT__', colorDbData['__DEFAULT__']]);
                sortedKeys.forEach(k => { if (colorDbData[k]) entries.push([k, colorDbData[k]]); });

                entries.forEach(([k, vals]) => {
                    const isDef = k === '__DEFAULT__';
                    const tr = document.createElement('tr');
                    tr.className = 'border-b dark:border-gray-700/60 hover:bg-gray-50/50 dark:hover:bg-gray-700/50';
                    const currentBg = vals.bg || vals.light || vals.dark || '#ffffff';
                    const currentText = vals.text || vals.textLight || vals.textDark || '#000000';

                    tr.innerHTML = `
                        <td class="p-2 font-semibold text-gray-800 dark:text-gray-200">${isDef ? 'Por Defecto' : k}</td>
                        <td class="p-2 text-center">
                            <input type="color" class="db-color-input w-9 h-8 p-0 border-0 bg-transparent rounded cursor-pointer mx-auto" value="${currentBg}" data-db-key="${colorDbKey}" data-entry-key="${k}" data-field="bg" title="Color de Fondo">
                        </td>
                        <td class="p-2 text-center">
                            <input type="color" class="db-color-input w-9 h-8 p-0 border-0 bg-transparent rounded cursor-pointer mx-auto" value="${currentText}" data-db-key="${colorDbKey}" data-entry-key="${k}" data-field="text" title="Color de Texto">
                        </td>
                        <td class="p-2 text-center align-middle">
                            <span class="color-sample-badge inline-block px-3 py-1 rounded-full text-xs font-bold shadow-xs transition-colors" style="background-color: ${currentBg}; color: ${currentText}">
                                ${isDef ? 'Muestra' : k}
                            </span>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                palettePreview.appendChild(table);
                colorSection.appendChild(palettePreview);
            }
        }
        wrapper.appendChild(colorSection);

        // Section B: Alertas Visuales por Vencimiento
        const alertsSection = document.createElement('div');
        alertsSection.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';
        alertsSection.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <span>⏰ Alertas Visuales por Vencimiento (DIAS)</span>
                    </h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Establezca reglas condicionales para resaltar la celda de días transcurridos o restantes en colores llamativos.
                    </p>
                </div>
                <button id="add-alert-btn" class="text-xs bg-sky-600 hover:bg-sky-700 text-white font-bold py-1.5 px-3 rounded-lg transition-colors">
                    + Añadir Regla de Alerta
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-xs md:text-sm">
                    <thead class="text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700 uppercase bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                            <th class="p-2 text-center w-16">Activo</th>
                            <th class="p-2 text-center">Color Fondo</th>
                            <th class="p-2 text-center">Color Texto</th>
                            <th class="p-2 text-center">Condición</th>
                            <th class="p-2 text-center">Días Límite</th>
                            <th class="p-2 text-center">Vista Previa</th>
                            <th class="p-2 text-center w-12"></th>
                        </tr>
                    </thead>
                    <tbody id="alerts-table-body">
                        ${(appData.visualAlerts || []).map(alert => `
                            <tr class="border-b dark:border-gray-700/60">
                                <td class="p-2 text-center">
                                    <input type="checkbox" class="alert-input h-5 w-5 rounded text-sky-600" ${alert.enabled ? 'checked' : ''} data-id="${alert.id}" data-field="enabled">
                                </td>
                                <td class="p-2 text-center">
                                    <input type="color" class="alert-input-color w-8 h-8 p-0 border-0 bg-transparent rounded cursor-pointer mx-auto" value="${alert.color.bg}" data-id="${alert.id}" data-field="bg">
                                </td>
                                <td class="p-2 text-center">
                                    <input type="color" class="alert-input-color w-8 h-8 p-0 border-0 bg-transparent rounded cursor-pointer mx-auto" value="${alert.color.text || '#000000'}" data-id="${alert.id}" data-field="text">
                                </td>
                                <td class="p-2 text-center">
                                    <select class="alert-input p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-xs font-semibold" data-id="${alert.id}" data-field="condition">
                                        <option value=">=" ${alert.condition === '>=' ? 'selected':''}> >= (Mayor o igual) </option>
                                        <option value="<=" ${alert.condition === '<=' ? 'selected':''}> <= (Menor o igual) </option>
                                        <option value="=" ${alert.condition === '=' ? 'selected':''}> = (Exactamente) </option>
                                    </select>
                                </td>
                                <td class="p-2 text-center">
                                    <input type="number" class="alert-input w-24 p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-center text-xs font-bold" value="${alert.value}" data-id="${alert.id}" data-field="value">
                                </td>
                                <td class="p-2 text-center">
                                    <span class="px-2 py-0.5 rounded text-xs font-bold font-mono" style="background-color: ${alert.color.bg}; color: ${alert.color.text || '#000000'}">
                                        ${alert.condition} ${alert.value} días
                                    </span>
                                </td>
                                <td class="p-2 text-center">
                                    <button class="alert-delete-btn text-red-500 hover:text-red-700 font-bold p-1" data-id="${alert.id}">&times;</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        wrapper.appendChild(alertsSection);

        container.appendChild(wrapper);

        // Bind events
        const colSelect = document.getElementById('color-coding-col-select');
        if (colSelect) {
            colSelect.onchange = (e) => {
                appData.colorCodingColumn = e.target.value || null;
                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
                showToast('Columna de codificación de color actualizada.', 'success');
            };
        }

        const addAlertBtn = document.getElementById('add-alert-btn');
        if (addAlertBtn) {
            addAlertBtn.onclick = () => {
                if (!appData.visualAlerts) appData.visualAlerts = [];
                appData.visualAlerts.push({
                    id: Date.now(),
                    enabled: true,
                    color: { bg: '#fee2e2', text: '#000000' },
                    condition: '>=',
                    value: '15'
                });
                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
                showToast('Alerta añadida.', 'success');
            };
        }
    }

    // ==========================================
    // TAB 4: MANTENIMIENTO, OCULTAMIENTO Y LOTES
    // ==========================================
    function renderMaintenanceTab(container) {
        const { appData } = getState();
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-8';

        const listColumns = appData.headers.filter(h => appData.columnFormats[h] === 'list');

        // Section A: Valores Ocultos por Defecto
        const hideSection = document.createElement('div');
        hideSection.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';
        hideSection.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>👁️ Valores Ocultos por Defecto</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Permite que los registros con ciertos estados (ej: FINALIZADO o ARCHIVADO) no se muestren al cargar la página a menos que el usuario busque activamente.
                </p>
            </div>
            <div class="flex items-center gap-3 max-w-md">
                <label class="font-semibold text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Ocultar valores de columna:</label>
                <select id="hide-settings-col-select" class="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm w-full">
                    <option value="">-- Ninguna --</option>
                    ${listColumns.map(h => `<option value="${h}" ${appData.hideSettings?.column === h ? 'selected' : ''}>${h}</option>`).join('')}
                </select>
            </div>
        `;

        const hideCol = appData.hideSettings?.column;
        if (hideCol) {
            const hideOptions = getSortedListOptions(appData, hideCol);
            const hiddenContainer = document.createElement('div');
            hiddenContainer.className = 'space-y-3 pt-3 border-t dark:border-gray-700';

            const buttonRow = document.createElement('div');
            buttonRow.className = 'flex items-center gap-2';
            buttonRow.innerHTML = `
                <button id="hide-all-btn" class="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1 rounded font-medium">Ocultar Todos</button>
                <button id="show-all-btn" class="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1 rounded font-medium">Mostrar Todos</button>
            `;
            hiddenContainer.appendChild(buttonRow);

            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5';
            hideOptions.forEach(opt => {
                const isHidden = (appData.hideSettings.hiddenValues || []).includes(opt);
                const label = document.createElement('label');
                label.className = `flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    isHidden 
                        ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-xs' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`;
                label.innerHTML = `
                    <input type="checkbox" value="${opt}" class="hide-checkbox h-4 w-4 rounded text-amber-600 focus:ring-amber-500" ${isHidden ? 'checked' : ''}>
                    <span class="font-bold text-gray-800 dark:text-gray-100">${opt}</span>
                `;
                grid.appendChild(label);
            });
            hiddenContainer.appendChild(grid);
            hideSection.appendChild(hiddenContainer);
        }
        wrapper.appendChild(hideSection);

        // Section B: Eliminación Rápida por Lotes (Bulk Delete)
        const bulkSection = document.createElement('div');
        bulkSection.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';
        bulkSection.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>🗑️ Eliminación y Archivado Rápido por Lotes</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Permite seleccionar y archivar/eliminar múltiples registros de la tabla de forma masiva (por ejemplo, todos los registros 'FINALIZADO' o 'RECHAZADO'). Se descarga una copia de seguridad automática antes del borrado.
                </p>
            </div>
            <div class="flex items-center gap-3 max-w-md">
                <label class="font-semibold text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Filtrar por columna:</label>
                <select id="bulk-delete-col-select" class="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm w-full">
                    <option value="">-- Seleccionar --</option>
                    ${listColumns.map(h => `<option value="${h}" ${appData.bulkDeleteColumn === h ? 'selected' : ''}>${h}</option>`).join('')}
                </select>
            </div>
        `;

        const deleteCol = appData.bulkDeleteColumn;
        if (deleteCol) {
            const bulkOptions = getSortedListOptions(appData, deleteCol);
            const counts = {};
            bulkOptions.forEach(s => counts[s] = 0);
            appData.mainData.forEach(row => {
                if (row[deleteCol] && counts.hasOwnProperty(row[deleteCol])) counts[row[deleteCol]]++;
            });

            const bulkControls = document.createElement('div');
            bulkControls.className = 'space-y-4 pt-3 border-t dark:border-gray-700';

            const listCheckboxes = document.createElement('div');
            listCheckboxes.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2';
            bulkOptions.forEach(opt => {
                const count = counts[opt] || 0;
                const isChecked = bulkDeleteState.selectedStatuses.has(opt);
                const item = document.createElement('label');
                item.className = `flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    count === 0 
                        ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-500' 
                        : isChecked
                            ? 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100 shadow-xs'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`;
                item.innerHTML = `
                    <div class="flex items-center gap-2">
                        <input type="checkbox" value="${opt}" class="bulk-status-chk h-4 w-4 rounded text-red-600 focus:ring-red-500" ${count === 0 ? 'disabled' : ''} ${isChecked ? 'checked' : ''}>
                        <span class="font-bold text-gray-800 dark:text-gray-100">${opt}</span>
                    </div>
                    <span class="font-mono ${isChecked ? 'bg-red-200 dark:bg-red-900/60 text-red-900 dark:text-red-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} px-2 py-0.5 rounded font-bold">${count} reg.</span>
                `;
                listCheckboxes.appendChild(item);
            });
            bulkControls.appendChild(listCheckboxes);

            // Optional Date Filter
            const dateColumns = appData.headers.filter(h => appData.columnFormats[h] === 'date');
            const dateRow = document.createElement('div');
            dateRow.className = 'flex flex-wrap items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs';
            dateRow.innerHTML = `
                <span class="font-bold text-gray-700 dark:text-gray-300">Condición opcional de fecha:</span>
                <select id="bulk-date-col" class="p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700">
                    <option value="">-- Sin filtro de fecha --</option>
                    ${dateColumns.map(h => `<option value="${h}" ${bulkDeleteState.dateColumn === h ? 'selected' : ''}>${h}</option>`).join('')}
                </select>
                <span class="text-gray-500">anterior a:</span>
                <input type="date" id="bulk-date-val" class="p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700" value="${bulkDeleteState.dateValue}">
            `;
            bulkControls.appendChild(dateRow);

            // Calculate affected count
            const matchingRows = getMatchingBulkDeleteRows(appData);

            const footer = document.createElement('div');
            footer.className = 'flex flex-wrap items-center justify-between gap-4 pt-2';
            footer.innerHTML = `
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Registros afectados: <span class="text-red-600 dark:text-red-400 font-bold text-base font-mono">${matchingRows.length}</span>
                </div>
            `;

            const executeBtn = document.createElement('button');
            executeBtn.className = `flex items-center gap-2 font-bold py-2 px-5 rounded-lg text-sm text-white shadow-sm transition-colors ${
                matchingRows.length === 0 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700 cursor-pointer'
            }`;
            executeBtn.disabled = matchingRows.length === 0;
            executeBtn.innerHTML = `<span>📦 Archivar y Eliminar (${matchingRows.length})</span>`;
            executeBtn.onclick = () => executeBulkDelete(matchingRows);

            footer.appendChild(executeBtn);
            bulkControls.appendChild(footer);
            bulkSection.appendChild(bulkControls);
        }
        wrapper.appendChild(bulkSection);

        container.appendChild(wrapper);

        // Bind maintenance events
        bindMaintenanceEvents(container);
    }

    function getMatchingBulkDeleteRows(appData) {
        const deleteCol = appData.bulkDeleteColumn;
        if (!deleteCol || bulkDeleteState.selectedStatuses.size === 0) return [];

        return appData.mainData.filter(row => {
            const val = row[deleteCol];
            if (!bulkDeleteState.selectedStatuses.has(val)) return false;

            if (bulkDeleteState.dateColumn && bulkDeleteState.dateValue) {
                const rowDateVal = row[bulkDeleteState.dateColumn];
                const rowDate = parseDate(rowDateVal);
                const limitDate = new Date(bulkDeleteState.dateValue + 'T00:00:00Z');
                if (rowDate && limitDate && !isNaN(rowDate) && !isNaN(limitDate)) {
                    if (rowDate >= limitDate) return false;
                }
            }
            return true;
        });
    }

    function executeBulkDelete(matchingRows) {
        const { appData } = getState();
        if (matchingRows.length === 0) return;

        showConfirmModal(
            `Se archivarán y eliminarán permanentemente ${matchingRows.length} registros de la tabla.\n\nSe descargará automáticamente un archivo JSON con la copia de los registros antes de borrarlos.\n\n¿Desea continuar?`,
            () => {
                // 1. Export backup of deleted rows
                const backupData = {
                    date: new Date().toISOString(),
                    column: appData.bulkDeleteColumn,
                    deletedCount: matchingRows.length,
                    records: matchingRows
                };
                const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `gtn_archivo_eliminados_${getFormattedDateForFilename()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                // 2. Remove matching rows from mainData
                const matchingIds = new Set(matchingRows.map(r => r.id));
                appData.mainData = appData.mainData.filter(r => !matchingIds.has(r.id));

                // 3. Reset state & save
                bulkDeleteState.selectedStatuses.clear();
                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
                showToast(`Se eliminaron y archivaron ${matchingRows.length} registros. Copia guardada.`, 'success');
            },
            'Confirmar Eliminación Masiva'
        );
    }

    function bindMaintenanceEvents(container) {
        const { appData } = getState();

        // Hide settings column change
        const hideColSelect = document.getElementById('hide-settings-col-select');
        if (hideColSelect) {
            hideColSelect.onchange = (e) => {
                appData.hideSettings.column = e.target.value || null;
                appData.hideSettings.hiddenValues = [];
                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
            };
        }

        // Hide/show all
        const hideAllBtn = document.getElementById('hide-all-btn');
        if (hideAllBtn) {
            hideAllBtn.onclick = () => {
                const col = appData.hideSettings?.column;
                if (!col) return;
                appData.hideSettings.hiddenValues = getSortedListOptions(appData, col);
                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
            };
        }

        const showAllBtn = document.getElementById('show-all-btn');
        if (showAllBtn) {
            showAllBtn.onclick = () => {
                if (!appData.hideSettings) return;
                appData.hideSettings.hiddenValues = [];
                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
            };
        }

        // Checkbox toggle for hide
        container.querySelectorAll('.hide-checkbox').forEach(chk => {
            chk.onchange = (e) => {
                const val = e.target.value;
                if (!appData.hideSettings.hiddenValues) appData.hideSettings.hiddenValues = [];
                if (e.target.checked) {
                    if (!appData.hideSettings.hiddenValues.includes(val)) appData.hideSettings.hiddenValues.push(val);
                } else {
                    appData.hideSettings.hiddenValues = appData.hideSettings.hiddenValues.filter(v => v !== val);
                }
                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
            };
        });

        // Bulk delete column select
        const bulkColSelect = document.getElementById('bulk-delete-col-select');
        if (bulkColSelect) {
            bulkColSelect.onchange = (e) => {
                appData.bulkDeleteColumn = e.target.value || null;
                bulkDeleteState.selectedStatuses.clear();
                onSaveData();
                renderActiveTabContent();
            };
        }

        // Bulk status checkboxes
        container.querySelectorAll('.bulk-status-chk').forEach(chk => {
            chk.onchange = (e) => {
                if (e.target.checked) {
                    bulkDeleteState.selectedStatuses.add(e.target.value);
                } else {
                    bulkDeleteState.selectedStatuses.delete(e.target.value);
                }
                renderActiveTabContent();
            };
        });

        // Bulk date filter inputs
        const bulkDateCol = document.getElementById('bulk-date-col');
        if (bulkDateCol) {
            bulkDateCol.onchange = (e) => {
                bulkDeleteState.dateColumn = e.target.value;
                renderActiveTabContent();
            };
        }
        const bulkDateVal = document.getElementById('bulk-date-val');
        if (bulkDateVal) {
            bulkDateVal.onchange = (e) => {
                bulkDeleteState.dateValue = e.target.value;
                renderActiveTabContent();
            };
        }
    }

    // ==========================================
    // TAB 5: AJUSTES DE TABLA, PDF Y SISTEMA
    // ==========================================
    function renderSettingsTab(container) {
        const { appData } = getState();
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-6';

        // Section A: Fila seleccionada e Identificador
        const rowIdentSection = document.createElement('div');
        rowIdentSection.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';
        rowIdentSection.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>📌 Identificador de Fila Seleccionada</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Elija qué columna se muestra como título destacado en el panel de acciones superior cuando hace clic en una fila (ej: EXPEDIENTE, N° EMPRESA, etc.).
                </p>
            </div>
            <div class="flex items-center gap-3 max-w-md">
                <label class="font-semibold text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Mostrar columna:</label>
                <select id="selected-row-id-col-select" class="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm w-full">
                    ${appData.headers.map(h => `<option value="${h}" ${appData.selectedRowIdentifierColumn === h ? 'selected' : ''}>${h}</option>`).join('')}
                </select>
            </div>
        `;
        wrapper.appendChild(rowIdentSection);

        // Section B: Paginación
        const paginationSection = document.createElement('div');
        paginationSection.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';
        paginationSection.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>📄 Paginación de la Tabla</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Cantidad de registros a desplegar por página en la vista principal.
                </p>
            </div>
            <div class="flex items-center gap-3 max-w-xs">
                <label class="font-semibold text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Filas por página:</label>
                <select id="rows-per-page-select" class="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm w-full">
                    ${[3, 5, 10, 15, 20, 25, 50, 100].map(n => `<option value="${n}" ${appData.rowsPerPage == n ? 'selected' : ''}>${n} registros</option>`).join('')}
                </select>
            </div>
        `;
        wrapper.appendChild(paginationSection);

        // Section C: Formato del Nombre de Archivo PDF (Resuelve Documento__.pdf)
        const pdfFormatSection = document.createElement('div');
        pdfFormatSection.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';
        
        const currentPdfFormat = (appData.pdfFilenameFormat || 'Documento {{EXPEDIENTE}} {{FECHA_ACTUAL}}').replace(/_/g, ' ');
        
        pdfFormatSection.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>📑 Plantilla para Nombre de Archivo PDF</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Defina el patrón dinámico utilizado al descargar o exportar documentos PDF. Haga clic en los botones de abajo para insertar variables de su tabla.
                </p>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Patrón de Nombre de Archivo:</label>
                <div class="flex gap-2">
                    <input type="text" id="pdf-filename-format-input" value="${currentPdfFormat}" class="flex-grow p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 font-mono text-sm text-gray-900 dark:text-gray-100">
                    <button id="save-pdf-format-btn" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">Guardar</button>
                </div>
            </div>

            <div>
                <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Variables Disponibles (Haga clic para insertar):</label>
                <div class="flex flex-wrap gap-1.5" id="pdf-chips-container">
                    ${appData.headers.map(h => `
                        <button type="button" class="pdf-chip-btn text-xs bg-indigo-50 dark:bg-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-700 transition-colors" data-var="{{${h}}}">
                            + {{${h}}}
                        </button>
                    `).join('')}
                    <button type="button" class="pdf-chip-btn text-xs bg-emerald-50 dark:bg-emerald-900/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-mono px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-700" data-var="{{FECHA_ACTUAL}}">
                        + {{FECHA_ACTUAL}}
                    </button>
                    <button type="button" class="pdf-chip-btn text-xs bg-emerald-50 dark:bg-emerald-900/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-mono px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-700" data-var="{{NOMBRE_PLANTILLA}}">
                        + {{NOMBRE_PLANTILLA}}
                    </button>
                </div>
            </div>

            <div class="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                <span class="font-bold text-gray-700 dark:text-gray-300">Vista previa del nombre generado:</span>
                <span id="pdf-filename-preview-text" class="font-mono text-sky-600 dark:text-sky-400 ml-2 font-bold">Documento</span>
            </div>
        `;
        wrapper.appendChild(pdfFormatSection);

        // Section D: Copias de Seguridad y Datos de Fábrica
        const backupSection = document.createElement('div');
        backupSection.className = 'p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4';
        backupSection.innerHTML = `
            <div>
                <h4 class="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>💾 Copias de Seguridad de Base de Datos</span>
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Exporte o importe únicamente las configuraciones de listas, tablas de referencia y ajustes sin alterar los registros de la tabla principal.
                </p>
            </div>
            <div class="flex flex-wrap gap-3">
                <button id="export-db-action-btn" class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors">
                    📤 Exportar Base de Datos (JSON)
                </button>
                <button id="import-db-action-btn" class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors">
                    📥 Importar Base de Datos (JSON)
                </button>
                <button id="reset-default-db-btn" class="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold py-2 px-4 rounded-lg text-sm transition-colors">
                    🔄 Restaurar Listas por Defecto
                </button>
            </div>
        `;
        wrapper.appendChild(backupSection);

        container.appendChild(wrapper);

        // Bind settings events
        bindSettingsEvents(container);
    }

    function bindSettingsEvents(container) {
        const { appData } = getState();

        // Selected row identifier
        const selRowCol = document.getElementById('selected-row-id-col-select');
        if (selRowCol) {
            selRowCol.onchange = (e) => {
                appData.selectedRowIdentifierColumn = e.target.value;
                onSaveData();
                onFullReloadUI();
                showToast('Columna identificadora actualizada.', 'success');
            };
        }

        // Rows per page
        const rpp = document.getElementById('rows-per-page-select');
        if (rpp) {
            rpp.onchange = (e) => {
                appData.rowsPerPage = parseInt(e.target.value, 10);
                onSaveData();
                onFullReloadUI();
                showToast('Paginación actualizada.', 'success');
            };
        }

        // PDF Filename Format
        const pdfInput = document.getElementById('pdf-filename-format-input');
        const pdfPreview = document.getElementById('pdf-filename-preview-text');
        const savePdfBtn = document.getElementById('save-pdf-format-btn');

        const updatePdfPreview = () => {
            if (!pdfInput || !pdfPreview) return;
            const pattern = (pdfInput.value.trim() || 'Documento {{EXPEDIENTE}} {{FECHA_ACTUAL}}').replace(/_/g, ' ');
            const sampleRow = appData.mainData[0] || {};
            let res = pattern.replace(/\{\{(.*?)\}\}/g, (_, key) => {
                key = key.trim();
                if (sampleRow[key]) return String(sampleRow[key]).trim();
                if (key.toLowerCase() === 'fecha_actual') return getFormattedDateForFilename().replace(/_/g, '-');
                if (key.toLowerCase() === 'nombre_plantilla') return 'Notificación';
                return key;
            });
            res = res.replace(/[\\/:*?"<>|]/g, '-').replace(/_/g, ' ').replace(/\s+/g, ' ').replace(/\.pdf$/i, '').trim();
            pdfPreview.textContent = `${res || 'Documento'}`;
        };

        if (pdfInput) {
            pdfInput.addEventListener('input', updatePdfPreview);
            updatePdfPreview();
        }

        if (savePdfBtn && pdfInput) {
            savePdfBtn.onclick = () => {
                const val = pdfInput.value.replace(/_/g, ' ').trim();
                if (!val) return showToast('El formato no puede estar vacío.', 'warning');
                appData.pdfFilenameFormat = val;
                pdfInput.value = val;
                onSaveData();
                updatePdfPreview();
                showToast('Formato de nombre PDF guardado.', 'success');
            };
        }

        // Chips click
        container.querySelectorAll('.pdf-chip-btn').forEach(btn => {
            btn.onclick = () => {
                if (!pdfInput) return;
                const tag = btn.dataset.var;
                const start = pdfInput.selectionStart || pdfInput.value.length;
                const end = pdfInput.selectionEnd || pdfInput.value.length;
                const needsSpace = start > 0 && !pdfInput.value[start - 1].match(/\s/);
                pdfInput.value = pdfInput.value.substring(0, start) + (needsSpace ? ' ' : '') + tag + pdfInput.value.substring(end);
                pdfInput.focus();
                updatePdfPreview();
            };
        });

        // Backup buttons
        const expBtn = document.getElementById('export-db-action-btn');
        if (expBtn) expBtn.onclick = exportDb;

        const impBtn = document.getElementById('import-db-action-btn');
        const impInput = document.getElementById('import-db-input');
        if (impBtn && impInput) {
            impBtn.onclick = () => impInput.click();
        }

        const resetBtn = document.getElementById('reset-default-db-btn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                showConfirmModal('¿Restaurar las listas de referencia y alertas por defecto?', () => {
                    appData.referenceDB['_list_ESTADO'] = {
                        '__DEFAULT__': { bg: '#f9fafb', text: '#1f2937', light: '#f9fafb', dark: '#111827', textLight: '#1f2937', textDark: '#f3f4f6' },
                        'EN TRÁMITE': { bg: '#fef9c3', text: '#713f12', light: '#fef9c3', dark: '#422006', textLight: '#713f12', textDark: '#fef08a' },
                        'FINALIZADO': { bg: '#dcfce7', text: '#166534', light: '#dcfce7', dark: '#14532d', textLight: '#166534', textDark: '#bbf7d0' },
                        'PENDIENTE': { bg: '#e0e7ff', text: '#3730a3', light: '#e0e7ff', dark: '#312e81', textLight: '#3730a3', textDark: '#c7d2fe' },
                        'RECHAZADO': { bg: '#fee2e2', text: '#991b1b', light: '#fee2e2', dark: '#7f1d1d', textLight: '#991b1b', textDark: '#fecaca' }
                    };
                    appData.referenceDB['_list_ESTADO'] = sortReferenceDbObject(appData.referenceDB['_list_ESTADO']);
                    onSaveData();
                    renderActiveTabContent();
                    onFullReloadUI();
                    showToast('Listas restauradas.', 'success');
                });
            };
        }
    }

    // ==========================================
    // INLINE INPUT UPDATES & DELETE HANDLERS
    // ==========================================
    function handleDbUpdate(e) {
        const { appData } = getState();
        const input = e.target;
        const { dbKey, entryKey, field, isKey: isKeyStr } = input.dataset;
        if (!dbKey) return;

        const value = input.value.trim();
        const isKey = isKeyStr === "true";

        if (isKey) {
            if (value && value !== entryKey && !appData.referenceDB[dbKey][value]) {
                const oldData = { ...appData.referenceDB[dbKey][entryKey] };
                delete appData.referenceDB[dbKey][entryKey];
                appData.referenceDB[dbKey][value] = oldData;

                if (dbKey.startsWith('_list_')) {
                    const listColumn = dbKey.replace('_list_', '');
                    appData.mainData.forEach(row => {
                        if (row[listColumn] === entryKey) row[listColumn] = value;
                    });
                    appData.referenceDB[dbKey] = sortReferenceDbObject(appData.referenceDB[dbKey]);
                }

                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
            } else if (value !== entryKey) {
                showToast('El identificador ya existe o no es válido.', 'warning');
                input.value = entryKey;
            }
        } else {
            if (appData.referenceDB[dbKey]?.[entryKey] && typeof field !== 'undefined') {
                appData.referenceDB[dbKey][entryKey][field] = input.value;
                onSaveData();
                onFullReloadUI();
            }
        }
    }

    function handleColorDbUpdate(e) {
        const { appData } = getState();
        const input = e.target;
        const { dbKey, entryKey, field } = input.dataset;
        if (!dbKey || !entryKey || !field) return;

        if (appData.referenceDB[dbKey]?.[entryKey]) {
            const val = input.value;
            if (field === 'bg' || field === 'light' || field === 'dark') {
                appData.referenceDB[dbKey][entryKey].bg = val;
                appData.referenceDB[dbKey][entryKey].light = val;
                appData.referenceDB[dbKey][entryKey].dark = val;
            } else if (field === 'text' || field === 'textLight' || field === 'textDark') {
                appData.referenceDB[dbKey][entryKey].text = val;
                appData.referenceDB[dbKey][entryKey].textLight = val;
                appData.referenceDB[dbKey][entryKey].textDark = val;
            } else {
                appData.referenceDB[dbKey][entryKey][field] = val;
            }

            const row = input.closest('tr');
            if (row) {
                const badge = row.querySelector('.color-sample-badge');
                if (badge) {
                    const cur = appData.referenceDB[dbKey][entryKey];
                    const bg = cur.bg || cur.light || cur.dark || '#ffffff';
                    const text = cur.text || cur.textLight || cur.textDark || '#000000';
                    badge.style.backgroundColor = bg;
                    badge.style.color = text;
                }
            }

            onSaveData();
            onFullReloadUI();
        }
    }

    function handleDbDelete(e) {
        const { appData } = getState();
        const button = e.target.closest('.db-delete-btn');
        if (!button) return;

        const { dbKey, entryKey } = button.dataset;
        if (!dbKey || !entryKey) return;

        showConfirmModal(`¿Eliminar la entrada "${entryKey}"?`, () => {
            delete appData.referenceDB[dbKey][entryKey];
            if (dbKey.startsWith('_list_')) {
                appData.referenceDB[dbKey] = sortReferenceDbObject(appData.referenceDB[dbKey]);
            }
            onSaveData();
            renderActiveTabContent();
            onFullReloadUI();
            showToast(`"${entryKey}" eliminado.`, 'success');
        });
    }

    function handleAlertsDbUpdate(e) {
        const { appData } = getState();
        const input = e.target.closest('.alert-input, .alert-input-color');
        if (!input) return;

        const { id, field } = input.dataset;
        if (!id || !field) return;

        const alert = (appData.visualAlerts || []).find(a => a.id == id);
        if (!alert) return;

        if (input.type === 'checkbox') {
            alert[field] = input.checked;
        } else if (field === 'bg' || field === 'text') {
            alert.color[field] = input.value;
        } else {
            alert[field] = input.value;
        }
        onSaveData();
        onFullReloadUI();
    }

    function handleAlertsDbDelete(e) {
        const { appData } = getState();
        const button = e.target.closest('.alert-delete-btn');
        if (button && button.dataset.id) {
            showConfirmModal('¿Eliminar esta regla de alerta visual?', () => {
                appData.visualAlerts = (appData.visualAlerts || []).filter(a => a.id != button.dataset.id);
                onSaveData();
                renderActiveTabContent();
                onFullReloadUI();
            });
        }
    }

    // ==========================================
    // EXPORT & IMPORT BASE DE DATOS JSON
    // ==========================================
    function exportDb() {
        const { appData } = getState();
        const payload = {
            _version: 'GTN_v12_DB',
            exportedAt: new Date().toISOString(),
            referenceDB: appData.referenceDB,
            lookupRelations: appData.lookupRelations || [],
            visualAlerts: appData.visualAlerts || [],
            hideSettings: appData.hideSettings || {},
            colorCodingColumn: appData.colorCodingColumn,
            pdfFilenameFormat: appData.pdfFilenameFormat
        };
        const dataStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gtn_db_backup_${getFormattedDateForFilename()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Base de datos y ajustes exportados correctamente.', 'success');
    }

    function importDb(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                const { appData } = getState();
                if (parsed && (parsed.referenceDB || parsed.headers || parsed.mainData)) {
                    showConfirmModal('¿Importar esta base de datos? Se actualizarán y migrarán las listas, colores y tablas de referencia.', () => {
                        const normalized = normalizeAppData({
                            ...appData,
                            ...parsed,
                            referenceDB: { ...(appData.referenceDB || {}), ...(parsed.referenceDB || {}) }
                        });

                        Object.assign(appData, normalized);

                        onSaveData();
                        renderActiveTabContent();
                        onFullReloadUI();
                        showToast('Base de datos de referencia importada y migrada con éxito.', 'success');
                    });
                } else {
                    showToast('El archivo no contiene una estructura de base de datos válida.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error al leer el archivo JSON.', 'error');
            }
        };
        reader.readAsText(file);
    }

    return {
        renderDbTables,
        handleDbUpdate,
        handleColorDbUpdate,
        handleDbDelete,
        handleAlertsDbUpdate,
        handleAlertsDbDelete,
        exportDb,
        importDb
    };
}
