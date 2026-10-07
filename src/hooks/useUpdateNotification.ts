import { useState, useEffect } from 'react';
import { compareVersions } from '../utils/dataUtils';
import { getCheckUpdatesOnStartup } from '../utils/updateSettings';
import packageJson from '../../package.json';
import { RELEASES_API_URL } from '../constants/app';

interface UpdateInfo {
    latestVersion: string;
    releaseUrl: string;
    releaseDate: string;
}

interface UseUpdateNotificationReturn {
    showUpdateNotification: boolean;
    setShowUpdateNotification: React.Dispatch<React.SetStateAction<boolean>>;
    updateInfo: UpdateInfo | null;
}

const checkForUpdates = async (): Promise<UpdateInfo | null> => {
    try {
        const response = await fetch(RELEASES_API_URL);
        if (response.status === 404) return null;
        if (!response.ok) {
            throw new Error(`ERR_HTTP ${response.status}`);
        }
        const data = await response.json();
        const latestVersion = data.tag_name || null;
        const currentVersion = packageJson.version;

        if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
            return {
                latestVersion,
                releaseUrl: data.html_url,
                releaseDate: data.published_at,
            };
        }
        return null;
    } catch (err) {
        console.error('Ошибка при проверке обновлений:', err);
        return null;
    }
};

export function useUpdateNotification(): UseUpdateNotificationReturn {
    const [showUpdateNotification, setShowUpdateNotification] = useState<boolean>(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

    useEffect(() => {
        if (!getCheckUpdatesOnStartup()) {
            return;
        }

        checkForUpdates().then(newUpdateInfo => {
            if (newUpdateInfo) {
                setUpdateInfo(newUpdateInfo);
                setShowUpdateNotification(true);
            }
        }).catch(error => {
            console.error('Ошибка при проверке обновлений:', error);
        });
    }, []);

    return { showUpdateNotification, setShowUpdateNotification, updateInfo };
}
