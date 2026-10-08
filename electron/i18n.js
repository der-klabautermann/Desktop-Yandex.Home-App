// Тексты главного процесса (трей, уведомления) на трёх языках.

const STRINGS = {
    ru: {
        appName: 'Смарт Центр',
        about: 'О программе',
        hide: 'Скрыть',
        hideOthers: 'Скрыть остальные',
        showAll: 'Показать все',
        edit: 'Правка',
        undo: 'Отменить',
        redo: 'Повторить',
        cut: 'Вырезать',
        copy: 'Копировать',
        paste: 'Вставить',
        selectAll: 'Выбрать все',
        view: 'Вид',
        reload: 'Перезагрузить',
        fullscreen: 'Полный экран',
        window: 'Окно',
        minimize: 'Свернуть',
        zoom: 'Изменить масштаб',
        trayTooltip: 'Управление умным домом',
        openApp: 'Открыть приложение',
        quit: 'Выход',
        cameraNoVideo: '{name}: нет видео',
        retry: 'Повторить',
        close: 'Закрыть',
        retryAttempt: 'Попытка повторного подключения {attempt} из {max}...',
        unreachable: 'нет связи',
    },
    en: {
        appName: 'Smart Central',
        about: 'About',
        hide: 'Hide',
        hideOthers: 'Hide Others',
        showAll: 'Show All',
        edit: 'Edit',
        undo: 'Undo',
        redo: 'Redo',
        cut: 'Cut',
        copy: 'Copy',
        paste: 'Paste',
        selectAll: 'Select All',
        view: 'View',
        reload: 'Reload',
        fullscreen: 'Toggle Full Screen',
        window: 'Window',
        minimize: 'Minimize',
        zoom: 'Zoom',
        trayTooltip: 'Smart home control',
        openApp: 'Open app',
        quit: 'Quit',
        cameraNoVideo: '{name}: no video',
        retry: 'Retry',
        close: 'Close',
        retryAttempt: 'Reconnecting, attempt {attempt} of {max}...',
        unreachable: 'unreachable',
    },
    de: {
        appName: 'Smart Zentrale',
        about: 'Über',
        hide: 'Ausblenden',
        hideOthers: 'Andere ausblenden',
        showAll: 'Alle einblenden',
        edit: 'Bearbeiten',
        undo: 'Widerrufen',
        redo: 'Wiederholen',
        cut: 'Ausschneiden',
        copy: 'Kopieren',
        paste: 'Einsetzen',
        selectAll: 'Alles auswählen',
        view: 'Darstellung',
        reload: 'Neu laden',
        fullscreen: 'Vollbildmodus',
        window: 'Fenster',
        minimize: 'Im Dock ablegen',
        zoom: 'Zoomen',
        trayTooltip: 'Smart-Home-Steuerung',
        openApp: 'App öffnen',
        quit: 'Beenden',
        cameraNoVideo: '{name}: kein Video',
        retry: 'Erneut versuchen',
        close: 'Schließen',
        retryAttempt: 'Verbindung wird wiederhergestellt, Versuch {attempt} von {max} …',
        unreachable: 'nicht erreichbar',
    },
};

let current = 'ru';

export const mainLanguage = () => current;

export const setMainLanguage = (lang) => {
    if (STRINGS[lang]) current = lang;
};

export const tm = (key, vars = {}) => {
    const text = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
};
