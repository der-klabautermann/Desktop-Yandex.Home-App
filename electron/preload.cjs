// preload.cjs

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    setLanguage: (lang) => ipcRenderer.send('app:set-language', lang),
    getCameraStream: (deviceId) => ipcRenderer.invoke('yandex-api:getCameraStream', deviceId),
    setCameraPrivacyMode: (deviceId, privacyEnabled, toggleInstance) =>
        ipcRenderer.invoke('yandex-api:setCameraPrivacyMode', deviceId, privacyEnabled, toggleInstance),
    getQuasarCameraDevice: (deviceId, options) => ipcRenderer.invoke('yandex-api:getQuasarCameraDevice', deviceId, options),

    hasXToken: () => ipcRenderer.invoke('yandex-auth:hasXToken'),
    startQrAuth: () => ipcRenderer.invoke('yandex-auth:startQr'),
    pollQrAuth: () => ipcRenderer.invoke('yandex-auth:pollQr'),
    cancelQrAuth: () => ipcRenderer.invoke('yandex-auth:cancelQr'),
    
    hub: {
        accounts: () => ipcRenderer.invoke('hub:accounts'),
        connect: (providerId, payload) => ipcRenderer.invoke('hub:connect', providerId, payload),
        disconnect: (providerId) => ipcRenderer.invoke('hub:disconnect', providerId),
        loadHome: (options) => ipcRenderer.invoke('hub:loadHome', options),
        toggleDevice: (deviceId, newState) => ipcRenderer.invoke('hub:toggleDevice', deviceId, newState),
        setDeviceMode: (deviceId, actions, turnOn) => ipcRenderer.invoke('hub:setDeviceMode', deviceId, actions, turnOn),
        toggleGroup: (groupId, deviceIds, newState) => ipcRenderer.invoke('hub:toggleGroup', groupId, deviceIds, newState),
        runScenario: (scenarioId) => ipcRenderer.invoke('hub:runScenario', scenarioId),
    },

    zones: {
        load: () => ipcRenderer.invoke('zones:load'),
        save: (config) => ipcRenderer.invoke('zones:save', config),
    },

    // Auto-launch methods
    isAutostartEnabled: () => ipcRenderer.invoke('autostart:isEnabled'),
    setAutostartEnabled: (enabled) => ipcRenderer.invoke('autostart:setEnabled', enabled), 
	
    // Отправка данных избранного из рендерера в главный процесс
    sendFavoritesToTray: (favorites) => ipcRenderer.send('tray:update-favorites', favorites),
    
    // Прослушивание команд из трея (главный процесс -> рендерер)
    onTrayCommand: (callback) => {
        ipcRenderer.on('tray:execute-command', (event, command, id, currentState) => {
            callback(command, id, currentState);
        });
    },
    removeTrayCommandListener: () => {
        // Очистка слушателей при размонтировании компонента App
        ipcRenderer.removeAllListeners('tray:execute-command');
    },
    
    // Прослушивание событий повторных попыток подключения (retry)
    onRetryAttempt: (callback) => {
        const handler = (event, data) => {
            callback(data);
        };
        ipcRenderer.on('yandex-api:retry-attempt', handler);
        // Возвращаем функцию для отписки
        return () => ipcRenderer.removeListener('yandex-api:retry-attempt', handler);
    },

    showCameraStreamErrorNotification: (payload) =>
        ipcRenderer.invoke('notification:camera-stream-error', payload),
    onCameraStreamRetry: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('camera-stream:retry', handler);
        return () => ipcRenderer.removeListener('camera-stream:retry', handler);
    },
});