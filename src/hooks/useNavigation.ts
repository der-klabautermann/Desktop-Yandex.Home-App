import { useState, useCallback, useRef } from 'react';

export type SidebarView = 'home' | 'room' | 'group' | 'device' | 'cameras' | 'rooms' | 'sensors' | 'groups' | 'scenarios';
/** Страницы из бокового меню без выбранного объекта. */
export type PageView = 'cameras' | 'rooms' | 'sensors' | 'groups' | 'scenarios';

interface UseNavigationReturn {
    activeSidebarView: SidebarView;
    activeRoomId: string | null;
    activeGroupId: string | null;
    activeDeviceId: string | null;
    onSelectHome: () => void;
    onSelectRoom: (roomId: string) => void;
    onSelectGroup: (groupId: string) => void;
    /** Страница устройства; «назад» вернёт на ту страницу, откуда пришли. */
    onSelectDevice: (deviceId: string) => void;
    onBack: () => void;
    onSelectCameras: () => void;
    onSelectPage: (page: PageView) => void;
}

interface Place { view: SidebarView; roomId: string | null; groupId: string | null; deviceId: string | null }

export function useNavigation(): UseNavigationReturn {
    const [place, setPlace] = useState<Place>({ view: 'home', roomId: null, groupId: null, deviceId: null });
    const previous = useRef<Place | null>(null);

    const onSelectHome = useCallback(() => setPlace({ view: 'home', roomId: null, groupId: null, deviceId: null }), []);
    const onSelectRoom = useCallback((roomId: string) => setPlace({ view: 'room', roomId, groupId: null, deviceId: null }), []);
    const onSelectGroup = useCallback((groupId: string) => setPlace({ view: 'group', roomId: null, groupId, deviceId: null }), []);
    const onSelectDevice = useCallback((deviceId: string) => setPlace(current => {
        if (current.view !== 'device') previous.current = current;
        return { view: 'device', roomId: null, groupId: null, deviceId };
    }), []);
    const onSelectPage = useCallback((page: PageView) => setPlace({ view: page, roomId: null, groupId: null, deviceId: null }), []);
    const onSelectCameras = useCallback(() => onSelectPage('cameras'), [onSelectPage]);
    const onBack = useCallback(() => {
        setPlace(previous.current ?? { view: 'home', roomId: null, groupId: null, deviceId: null });
        previous.current = null;
    }, []);

    return {
        activeSidebarView: place.view,
        activeRoomId: place.roomId,
        activeGroupId: place.groupId,
        activeDeviceId: place.deviceId,
        onSelectHome, onSelectRoom, onSelectGroup, onSelectDevice, onBack, onSelectCameras, onSelectPage,
    };
}
