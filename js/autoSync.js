// Auto-Sync and Live Synchronization Engine for GTN v12
import { showToast } from './utils.js';

export function createAutoSyncEngine(onPerformSync, getLastLocalSaveTime) {
    let isAutoSyncEnabled = localStorage.getItem('gtn_auto_sync_enabled') !== 'false'; // Default: true
    let syncIntervalMs = parseInt(localStorage.getItem('gtn_auto_sync_interval') || '10000', 10);
    let syncTimer = null;
    let lastSyncTime = null;

    const elements = {
        toggleBtn: document.getElementById('toggle-auto-sync-btn'),
        syncPulseDot: document.getElementById('sync-pulse-dot'),
        syncBtnText: document.getElementById('sync-btn-text'),
        manualSyncBtn: document.getElementById('manual-sync-btn'),
        manualSyncIcon: document.getElementById('manual-sync-icon'),
        intervalSelect: document.getElementById('auto-sync-interval-select'),
        lastSyncTimeDisplay: document.getElementById('last-sync-time')
    };

    function init() {
        if (elements.intervalSelect) {
            elements.intervalSelect.value = String(syncIntervalMs);
            elements.intervalSelect.addEventListener('change', (e) => {
                syncIntervalMs = parseInt(e.target.value, 10);
                localStorage.setItem('gtn_auto_sync_interval', String(syncIntervalMs));
                restartTimer();
                showToast(`Intervalo de auto-sincronización: ${syncIntervalMs / 1000}s`, 'info', 2000);
            });
        }

        if (elements.toggleBtn) {
            elements.toggleBtn.addEventListener('click', toggleAutoSync);
        }

        if (elements.manualSyncBtn) {
            elements.manualSyncBtn.addEventListener('click', () => {
                triggerManualSync();
            });
        }

        // Cross-tab synchronization via StorageEvent
        window.addEventListener('storage', (e) => {
            if (e.key === 'gestorReclamosData_v43_generic') {
                console.log('[AutoSync] Detectado cambio en otra pestaña.');
                executeSync(false, true);
            }
        });

        updateUI();
        if (isAutoSyncEnabled) {
            startTimer();
        }
    }

    function toggleAutoSync() {
        isAutoSyncEnabled = !isAutoSyncEnabled;
        localStorage.setItem('gtn_auto_sync_enabled', String(isAutoSyncEnabled));
        updateUI();
        if (isAutoSyncEnabled) {
            startTimer();
            showToast('Sincronización automática activada.', 'success', 2000);
            executeSync(false);
        } else {
            stopTimer();
            showToast('Sincronización automática pausada.', 'warning', 2000);
        }
    }

    function startTimer() {
        stopTimer();
        syncTimer = setInterval(() => {
            executeSync(false);
        }, syncIntervalMs);
    }

    function stopTimer() {
        if (syncTimer) {
            clearInterval(syncTimer);
            syncTimer = null;
        }
    }

    function restartTimer() {
        if (isAutoSyncEnabled) {
            startTimer();
        }
    }

    function triggerManualSync() {
        // Spin animation on sync icon
        if (elements.manualSyncIcon) {
            elements.manualSyncIcon.classList.add('animate-spin-once');
            setTimeout(() => {
                elements.manualSyncIcon.classList.remove('animate-spin-once');
            }, 600);
        }
        executeSync(true);
        showToast('Datos sincronizados correctamente.', 'success', 1800);
    }

    function executeSync(isManual = false, fromOtherTab = false) {
        // Safe check: do not interrupt user if typing in cell or input
        const active = document.activeElement;
        const isEditingCell = active && (
            active.isContentEditable || 
            active.tagName === 'INPUT' || 
            active.tagName === 'TEXTAREA' || 
            active.tagName === 'SELECT'
        );

        const shouldSkipRender = isEditingCell && !isManual;

        try {
            onPerformSync({ shouldSkipRender, fromOtherTab });
            lastSyncTime = new Date();
            updateLastSyncDisplay();
        } catch (e) {
            console.error('[AutoSync] Error durante la sincronización:', e);
        }
    }

    function updateLastSyncDisplay() {
        if (!elements.lastSyncTimeDisplay) return;
        if (!lastSyncTime) {
            elements.lastSyncTimeDisplay.textContent = '| Listo';
            return;
        }
        const h = String(lastSyncTime.getHours()).padStart(2, '0');
        const m = String(lastSyncTime.getMinutes()).padStart(2, '0');
        const s = String(lastSyncTime.getSeconds()).padStart(2, '0');
        elements.lastSyncTimeDisplay.textContent = `| Sinc: ${h}:${m}:${s}`;
    }

    function updateUI() {
        if (!elements.toggleBtn) return;
        if (isAutoSyncEnabled) {
            elements.toggleBtn.className = 'flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-md transition-all bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm';
            if (elements.syncPulseDot) {
                elements.syncPulseDot.className = 'w-2 h-2 rounded-full bg-white animate-pulse-dot';
            }
            if (elements.syncBtnText) {
                elements.syncBtnText.textContent = 'Auto-Sync: ON';
            }
        } else {
            elements.toggleBtn.className = 'flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-md transition-all bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600 shadow-sm';
            if (elements.syncPulseDot) {
                elements.syncPulseDot.className = 'w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500';
            }
            if (elements.syncBtnText) {
                elements.syncBtnText.textContent = 'Auto-Sync: OFF';
            }
        }
        updateLastSyncDisplay();
    }

    return {
        init,
        triggerManualSync,
        isAutoSyncEnabled: () => isAutoSyncEnabled
    };
}
