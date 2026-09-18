// Data Migration, Normalization and Compatibility Helper for GTN v12
import { sortReferenceDbObject } from './utils.js';

/**
 * Normaliza y migra un objeto importado o cargado desde versiones anteriores
 * para garantizar compatibilidad total con la versión actual (v12).
 * 
 * Tolera:
 * - Backups antiguos con estructuras incompletas o campos ausentes
 * - Filas sin IDs únicos
 * - Arrays puros de objetos (exportaciones planas)
 * - Formatos antiguos de colores (light/dark vs bg/text)
 * - Formato antiguo de alertas visuales (strings tipo "Rojo" vs objetos de color)
 * - Paletas de referencia y opciones sin ordenar
 * - Ausencia de keyColumns, columnMetadata, hideSettings, columnFormats, etc.
 */
export function normalizeAppData(rawInput) {
    if (!rawInput || typeof rawInput !== 'object') {
        throw new Error('El archivo no contiene un JSON válido.');
    }

    let parsed = rawInput;

    // Caso 1: El JSON es un array de objetos directamente (ej: exportación plana de filas [{...}])
    if (Array.isArray(parsed)) {
        const rows = parsed.filter(r => r && typeof r === 'object');
        const headersSet = new Set();
        rows.forEach(r => Object.keys(r).forEach(k => {
            if (k !== 'id') headersSet.add(k);
        }));
        const headers = Array.from(headersSet);

        parsed = {
            headers: headers.length > 0 ? headers : [ "FECHA DE INICIO", "EXPEDIENTE", "ESTADO", "FECHA ULTIMA/ PROXIMA ACCION", "DIAS", "N° EMPRESA", "NOMBRE EMPRESA", "CUIT EMPRESA" ],
            mainData: rows
        };
    }

    // Si tiene 'data' en lugar de 'mainData'
    if (!parsed.mainData && Array.isArray(parsed.data)) {
        parsed.mainData = parsed.data;
    }

    // Si tiene 'columns' en vez de 'headers'
    if (!parsed.headers && Array.isArray(parsed.columns)) {
        parsed.headers = parsed.columns;
    }

    // Si tiene mainData pero no tiene headers, deducirlos de las filas
    if (Array.isArray(parsed.mainData) && (!parsed.headers || !Array.isArray(parsed.headers) || parsed.headers.length === 0)) {
        const headersSet = new Set();
        parsed.mainData.forEach(r => {
            if (r && typeof r === 'object') {
                Object.keys(r).forEach(k => {
                    if (k !== 'id') headersSet.add(k);
                });
            }
        });
        parsed.headers = Array.from(headersSet);
    }

    // Si aún así no hay headers o no hay mainData, crear estructura base
    if (!Array.isArray(parsed.headers) || parsed.headers.length === 0) {
        parsed.headers = [ "FECHA DE INICIO", "EXPEDIENTE", "ESTADO", "FECHA ULTIMA/ PROXIMA ACCION", "DIAS", "N° EMPRESA", "NOMBRE EMPRESA", "CUIT EMPRESA" ];
    }
    if (!Array.isArray(parsed.mainData)) {
        parsed.mainData = [];
    }

    // 1. Normalizar filas de mainData (asegurar id único y claves para todos los headers)
    const seenIds = new Set();
    parsed.mainData = parsed.mainData.map((row, idx) => {
        if (!row || typeof row !== 'object') return { id: `row_${Date.now()}_${idx}` };
        const cleanRow = { ...row };
        if (!cleanRow.id || seenIds.has(cleanRow.id)) {
            cleanRow.id = `row_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`;
        }
        seenIds.add(cleanRow.id);

        parsed.headers.forEach(h => {
            if (cleanRow[h] === undefined || cleanRow[h] === null) {
                cleanRow[h] = '';
            }
        });
        return cleanRow;
    });

    // 2. Normalizar alertas visuales
    if (!Array.isArray(parsed.visualAlerts)) {
        parsed.visualAlerts = [
            { id: 1, enabled: true, color: { bg: '#fee2e2', text: '#000000' }, condition: '>=', value: '10' }
        ];
    } else {
        parsed.visualAlerts.forEach((alert, idx) => {
            if (!alert.id) alert.id = idx + 1;
            if (typeof alert.enabled === 'undefined') alert.enabled = true;
            if (!alert.condition) alert.condition = '>=';
            if (alert.value === undefined) alert.value = '10';

            if (typeof alert.color === 'string') {
                const mapping = { 
                    'Rojo': { bg: '#fee2e2', text: '#991b1b' }, 
                    'Amarillo': { bg: '#fef9c3', text: '#854d0e' }, 
                    'Verde': { bg: '#dcfce7', text: '#166534' },
                    'Azul': { bg: '#e0e7ff', text: '#3730a3' }
                };
                alert.color = mapping[alert.color] || { bg: alert.color, text: '#000000' };
            } else if (alert.color && typeof alert.color === 'object') {
                const bg = alert.color.bg || alert.color.light || '#fee2e2';
                const text = alert.color.text || alert.color.textLight || '#000000';
                alert.color = { bg, text };
            } else {
                alert.color = { bg: '#fee2e2', text: '#000000' };
            }
        });
    }

    // 3. Normalizar filtros y ocultar filas
    if (!Array.isArray(parsed.filters)) parsed.filters = [];
    if (!parsed.hideSettings || typeof parsed.hideSettings !== 'object') {
        parsed.hideSettings = { column: parsed.headers.includes('ESTADO') ? 'ESTADO' : parsed.headers[0] || '', hiddenValues: [] };
    }
    if (!Array.isArray(parsed.hideSettings.hiddenValues)) {
        parsed.hideSettings.hiddenValues = [];
    }

    // 4. Normalizar plantillas PDF
    if (!Array.isArray(parsed.templates)) parsed.templates = [];
    parsed.templates.forEach(t => {
        if (!t.id) t.id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        if (!t.name) t.name = 'Plantilla sin título';
        if (!Array.isArray(t.manualFields)) t.manualFields = [];
        if (!Array.isArray(t.imageFields)) t.imageFields = [];
        if (!t.fontFamily) t.fontFamily = 'Helvetica';
    });

    // 5. Normalizar Formatos de Columnas
    if (!parsed.columnFormats || typeof parsed.columnFormats !== 'object') {
        parsed.columnFormats = {};
    }

    // Auto-detección por nombres conocidos si no están seteados
    parsed.headers.forEach(h => {
        if (!parsed.columnFormats[h]) {
            const hUpper = h.toUpperCase();
            if (hUpper.includes('FECHA')) {
                parsed.columnFormats[h] = 'date';
            } else if (hUpper === 'ESTADO' || hUpper.includes('ESTADO')) {
                parsed.columnFormats[h] = 'list';
            } else if (hUpper.includes('CUIT') || hUpper.includes('CUIL')) {
                parsed.columnFormats[h] = 'cuit';
            } else if (hUpper === 'DIAS' || hUpper.includes('DIAS') || hUpper === 'CANTIDAD' || hUpper.includes('IMPORTE')) {
                parsed.columnFormats[h] = 'number';
            } else {
                parsed.columnFormats[h] = 'text';
            }
        }
    });

    // 6. Normalizar Lookup Relations
    if (!Array.isArray(parsed.lookupRelations)) parsed.lookupRelations = [];

    // 7. Normalizar Base de Referencia (referenceDB) y Colores
    if (!parsed.referenceDB || typeof parsed.referenceDB !== 'object') {
        parsed.referenceDB = {};
    }

    // Si existen listas sin prefijo '_list_', normalizarlas
    parsed.headers.forEach(h => {
        if (parsed.referenceDB[h] && !parsed.referenceDB[`_list_${h}`] && typeof parsed.referenceDB[h] === 'object') {
            parsed.referenceDB[`_list_${h}`] = parsed.referenceDB[h];
            delete parsed.referenceDB[h];
        }
    });

    // Asegurar lista ESTADO por defecto si existe la columna ESTADO y la lista no
    if (parsed.headers.includes('ESTADO') && !parsed.referenceDB['_list_ESTADO']) {
        parsed.referenceDB['_list_ESTADO'] = {
            '__DEFAULT__': { bg: '#f9fafb', text: '#1f2937', light: '#f9fafb', dark: '#111827', textLight: '#1f2937', textDark: '#f3f4f6' },
            'EN TRÁMITE': { bg: '#fef9c3', text: '#713f12', light: '#fef9c3', dark: '#422006', textLight: '#713f12', textDark: '#fef08a' },
            'FINALIZADO': { bg: '#dcfce7', text: '#166534', light: '#dcfce7', dark: '#14532d', textLight: '#166534', textDark: '#bbf7d0' },
            'PENDIENTE': { bg: '#e0e7ff', text: '#3730a3', light: '#e0e7ff', dark: '#312e81', textLight: '#3730a3', textDark: '#c7d2fe' },
            'RECHAZADO': { bg: '#fee2e2', text: '#991b1b', light: '#fee2e2', dark: '#7f1d1d', textLight: '#991b1b', textDark: '#fecaca' }
        };
    }

    // Normalizar paletas de colores en todas las listas de referenceDB (compatibilidad retroactiva light/dark y bg/text)
    Object.keys(parsed.referenceDB).forEach(key => {
        const item = parsed.referenceDB[key];
        if (item && typeof item === 'object') {
            if (key.startsWith('_list_')) {
                // Detectar sinónimos de 'Por Defecto' y normalizar a '__DEFAULT__'
                if (!item['__DEFAULT__']) {
                    const defKey = Object.keys(item).find(k => {
                        const l = k.trim().toLowerCase();
                        return l === 'por defecto' || l === 'pordefecto' || l === 'default' || l === 'por_defecto' || l === '';
                    });
                    if (defKey) {
                        item['__DEFAULT__'] = item[defKey];
                        delete item[defKey];
                    }
                }

                // Asegurar que toda lista tenga una entrada '__DEFAULT__'
                if (!item['__DEFAULT__']) {
                    item['__DEFAULT__'] = {
                        bg: '#f9fafb',
                        text: '#1f2937',
                        light: '#f9fafb',
                        dark: '#111827',
                        textLight: '#1f2937',
                        textDark: '#f3f4f6'
                    };
                }

                Object.keys(item).forEach(optionKey => {
                    const opt = item[optionKey];
                    if (opt && typeof opt === 'object') {
                        const bg = opt.bg || opt.light || opt.dark || '#ffffff';
                        const text = opt.text || opt.textLight || opt.textDark || '#000000';
                        opt.bg = bg;
                        opt.text = text;
                        opt.light = bg;
                        opt.dark = opt.dark || bg;
                        opt.textLight = text;
                        opt.textDark = opt.textDark || text;
                    } else if (typeof opt === 'string') {
                        // Caso antiguo donde el valor era directamente un hex
                        item[optionKey] = {
                            bg: opt,
                            text: '#000000',
                            light: opt,
                            dark: opt,
                            textLight: '#000000',
                            textDark: '#ffffff'
                        };
                    }
                });
                parsed.referenceDB[key] = sortReferenceDbObject(item);
            }
        }
    });

    // 8. Normalizar anchos de columnas
    if (!parsed.columnWidths || typeof parsed.columnWidths !== 'object') {
        parsed.columnWidths = {};
    }

    // 9. Normalizar metadatos de columnas
    if (!parsed.columnMetadata || typeof parsed.columnMetadata !== 'object') {
        parsed.columnMetadata = {};
    }
    if (parsed.headers.includes('DIAS')) {
        parsed.columnMetadata['DIAS'] = { ...(parsed.columnMetadata['DIAS'] || {}), isProtected: true };
    }

    // 10. Normalizar Columnas Clave (KeyColumns)
    if (!parsed.keyColumns || typeof parsed.keyColumns !== 'object') {
        parsed.keyColumns = {};
    }
    if (!parsed.keyColumns.dateForCalculation) {
        const possibleDateCols = ['FECHA ULTIMA / PROXIMA ACCION', 'FECHA ULTIMA/ PROXIMA ACCION', 'FECHA DE INICIO'];
        const foundDateCol = possibleDateCols.find(name => parsed.headers.includes(name)) || parsed.headers.find(h => parsed.columnFormats[h] === 'date');
        parsed.keyColumns.dateForCalculation = foundDateCol || null;
    }
    if (!parsed.keyColumns.daysDisplay) {
        const foundDaysCol = parsed.headers.find(name => name === 'DIAS' || name.toUpperCase().includes('DIAS'));
        parsed.keyColumns.daysDisplay = foundDaysCol || null;
    }

    // 11. Formato de Nombre de PDF
    if (!parsed.pdfFilenameFormat) {
        const empresaCol = parsed.headers.find(h => h.includes('EMPRESA')) || parsed.headers[0] || 'Documento';
        const fechaCol = parsed.headers.find(h => h.includes('FECHA')) || '';
        parsed.pdfFilenameFormat = `Documento {{${empresaCol}}} ${fechaCol ? `{{${fechaCol}}}` : ''}`.trim();
    } else {
        parsed.pdfFilenameFormat = String(parsed.pdfFilenameFormat).replace(/_/g, ' ');
    }

    // 12. Configuración de ordenamiento y visualización de tabla
    if (!parsed.sortBy || !parsed.headers.includes(parsed.sortBy)) {
        parsed.sortBy = parsed.headers[0] || 'FECHA DE INICIO';
    }
    if (!parsed.sortOrder) parsed.sortOrder = 'desc';
    if (!parsed.tableFontSize) parsed.tableFontSize = 14;
    if (!parsed.tableTextColor) parsed.tableTextColor = 'inherit';
    if (!parsed.rowsPerPage || parsed.rowsPerPage < 1) parsed.rowsPerPage = 10;
    
    if (!parsed.colorCodingColumn || !parsed.headers.includes(parsed.colorCodingColumn)) {
        parsed.colorCodingColumn = parsed.headers.includes('ESTADO') ? 'ESTADO' : (parsed.headers[0] || '');
    }
    if (!parsed.bulkDeleteColumn || !parsed.headers.includes(parsed.bulkDeleteColumn)) {
        parsed.bulkDeleteColumn = parsed.headers.includes('ESTADO') ? 'ESTADO' : (parsed.headers[0] || '');
    }
    if (!parsed.selectedRowIdentifierColumn || !parsed.headers.includes(parsed.selectedRowIdentifierColumn)) {
        parsed.selectedRowIdentifierColumn = parsed.headers.includes('EXPEDIENTE') ? 'EXPEDIENTE' : (parsed.headers[1] || parsed.headers[0] || '');
    }

    parsed._lastUpdated = parsed._lastUpdated || Date.now();

    return parsed;
}
