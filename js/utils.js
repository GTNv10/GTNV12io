// Utility functions for GTN v12

export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const colors = { 
        success: 'bg-green-500', 
        error: 'bg-red-500', 
        warning: 'bg-yellow-400 text-black', 
        info: 'bg-sky-500' 
    };
    toast.className = `toast text-white ${colors[type] || 'bg-sky-500'} p-3 rounded-lg shadow-2xl text-sm font-semibold`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { 
        toast.classList.remove('show'); 
        setTimeout(() => toast.remove(), 400); 
    }, duration);
}

export const parseDate = (str) => {
    if (!str || typeof str !== 'string' || !str.includes('/')) return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    let [day, month, year] = parts.map(p => parseInt(p, 10));
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
    const date = new Date(Date.UTC(fullYear, month - 1, day));
    if (date && date.getUTCMonth() === month - 1) return date;
    return null;
};

export const formatDate = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return '';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

export const getFormattedDateForFilename = (date = new Date()) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

export const getFormattedTimestampForFilename = (date = new Date()) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}-${m}-${y}_${h}-${min}`;
};

export const calculateDays = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date) return '';
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    return Math.ceil((date - todayUTC) / (1000 * 60 * 60 * 24)) * -1;
};

export function formatCuitCuil(value) {
    if (!value) return '';
    const cleaned = String(value).replace(/[^0-9]/g, '');
    if (cleaned.length !== 11) return value;
    return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 10)}-${cleaned.substring(10)}`;
}

export function isDefaultKey(k) {
    if (!k) return false;
    const lower = k.trim().toLowerCase();
    return k === '__DEFAULT__' || lower === 'por defecto' || lower === 'pordefecto' || lower === 'default' || lower === '__default__';
}

/**
 * Ordena alfabéticamente A-Z las opciones de una lista o diccionario.
 * Conserva '__DEFAULT__' y '__FIELDS__' en sus posiciones especiales.
 */
export function sortReferenceDbObject(dbObj) {
    if (!dbObj || typeof dbObj !== 'object') return dbObj;
    const sorted = {};
    if (dbObj['__DEFAULT__']) sorted['__DEFAULT__'] = dbObj['__DEFAULT__'];
    if (dbObj['__FIELDS__']) sorted['__FIELDS__'] = dbObj['__FIELDS__'];
    
    const keys = Object.keys(dbObj)
        .filter(k => !isDefaultKey(k) && k !== '__FIELDS__')
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }));
        
    keys.forEach(k => { sorted[k] = dbObj[k]; });
    return sorted;
}

/**
 * Retorna las opciones de cualquier lista ordenadas alfabéticamente A-Z
 */
export function getSortedListOptions(appData, headerOrListKey) {
    if (!appData || !appData.referenceDB) return [];
    const listKey = headerOrListKey.startsWith('_list_') ? headerOrListKey : `_list_${headerOrListKey}`;
    const optionsData = appData.referenceDB[listKey];
    if (!optionsData) return [];
    return Object.keys(optionsData)
        .filter(k => !isDefaultKey(k) && k !== '__FIELDS__')
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }));
}
