import React, { useMemo, useState } from 'react';
import { YandexRoom, YandexDevice, YandexGroup, YandexScenario } from '../types/index';
import { ScenarioCard } from './cards/ScenarioCard';
import { GroupCard } from './cards/GroupCard';
import { DeviceCardAdapter } from './cards/DeviceCardAdapter';
import { useDashboardContext } from '../contexts/DashboardContext';
import { UseDashboardStateReturn } from '../hooks/useDashboardState';
import { isCameraDevice, isLightGroup, isSensorDevice } from '../constants';
import { findNode, flattenTree, searchDevices } from '../../core/zones';
import { ZoneIcon } from './zones/zoneIcons';
import { Building2, SquareSquare, ScrollText, Lightbulb, Star, ChevronRight, ChevronDown, Search, X, Check, Cctv } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { Pinned } from './Pinned';
import { ClimateChip } from './DashboardPages';

interface DashboardHomeViewProps {
    state: UseDashboardStateReturn;
    roomsForHome: YandexRoom[];
    groupsForHome: YandexGroup[];
    devicesForHome: YandexDevice[];
    activeScenarios: YandexScenario[];
    favoriteScenarios: YandexScenario[];
    favoriteDevices: YandexDevice[];
    favoriteGroups: YandexGroup[];
    favoriteSensorDevices: YandexDevice[];
    favoriteNonSensorDevices: YandexDevice[];
    visibleFavoriteScenarios: YandexScenario[];
    visibleFavoriteDevices: YandexDevice[];
    visibleFavoriteSensorDevices: YandexDevice[];
    visibleFavoriteNonSensorDevices: YandexDevice[];
    visibleFavoriteGroups: YandexGroup[];
    hasFavorites: boolean;
    hasFavoriteSensors: boolean;
    /** Строка поиска из шапки. */
    query: string;
}

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
    state,
    roomsForHome,
    groupsForHome,
    devicesForHome,
    activeScenarios,
    favoriteScenarios,
    favoriteDevices,
    favoriteGroups,
    favoriteSensorDevices,
    favoriteNonSensorDevices,
    visibleFavoriteScenarios,
    visibleFavoriteDevices,
    visibleFavoriteSensorDevices,
    visibleFavoriteNonSensorDevices,
    visibleFavoriteGroups,
    hasFavorites,
    hasFavoriteSensors,
    query,
}) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    // Фильтр по чипам сверху и строка поиска
    const [filter, setFilter] = useState<'all' | 'rooms' | 'devices' | 'scenarios'>('all');
    const [homesOpen, setHomesOpen] = useState(false);
    const searching = query.trim().length > 0;
    const matches = useMemo(
        () => (searching ? searchDevices(devicesForHome, ctx.zones.tree, query) : null),
        [searching, devicesForHome, ctx.zones.tree, query],
    );
    const visible = (id: string) => !matches || matches.has(id);
    const toggleFilter = (next: typeof filter) => setFilter(current => (current === next ? 'all' : next));
    const multipleHomes = ctx.households.length > 1;
    const cameraCount = devicesForHome.filter(isCameraDevice).length;
    const shownScenarios = searching
        ? activeScenarios.filter(sc => sc.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
        : activeScenarios;
    const scenariosCollapsed = filter === 'scenarios' ? false : state.collapse.isScenariosCollapsed;
    const nothingFound = searching && (filter === 'scenarios' ? shownScenarios.length === 0 : matches?.size === 0);

    // ---- Render helpers ----
    const renderStatsRow = () => (
        <Pinned>
        <div className="stats-row">
            <div className="stat-homes">
                <button
                    className={`stat-chip ${homesOpen ? 'is-active' : ''}`}
                    disabled={!multipleHomes}
                    onClick={() => setHomesOpen(open => !open)}
                    title={multipleHomes ? t('dashboard.filter.switchHome') : undefined}
                >
                    <Building2 /> {t('dashboard.stats.homes', { count: ctx.households.length })}
                </button>
                {homesOpen && multipleHomes && (
                    <div className="stat-menu" role="menu">
                        {ctx.households.map(h => (
                            <button key={h.id} role="menuitem" onClick={() => { ctx.onSwitchHousehold(h.id); setHomesOpen(false); }}>
                                <span>{h.name}</span>
                                {h.id === ctx.activeHouseholdId && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button className={`stat-chip ${filter === 'rooms' ? 'is-active' : ''}`} onClick={() => toggleFilter('rooms')} aria-pressed={filter === 'rooms'}>
                <SquareSquare /> {t('dashboard.stats.rooms', { count: roomsForHome.length })}
            </button>
            <button className={`stat-chip ${filter === 'scenarios' ? 'is-active' : ''}`} onClick={() => toggleFilter('scenarios')} aria-pressed={filter === 'scenarios'}>
                <ScrollText /> {t('dashboard.stats.scenarios', { count: activeScenarios.length })}
            </button>
            <button className={`stat-chip ${filter === 'devices' ? 'is-active' : ''}`} onClick={() => toggleFilter('devices')} aria-pressed={filter === 'devices'}>
                <Lightbulb /> {t('dashboard.stats.devices', { count: devicesForHome.length })}
            </button>
            {cameraCount > 0 && (
                <button className="stat-chip" onClick={ctx.onSelectCameras}>
                    <Cctv /> {t('dashboard.stats.cameras', { count: cameraCount })}
                </button>
            )}
        </div>
        </Pinned>
    );

    const renderFavoritesSection = () => {
        if (!hasFavorites) return null;
        return (
            <section className="favorites-section">
                <div className="favorites-title">
                    <Star />
                    <h2>{t('dashboard.favorites')}</h2>
                </div>

                {/* Sensors — first at the top */}
                {visibleFavoriteSensorDevices.length > 0 && (
                    <>
                        <div className="section-header" style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{t('dashboard.sensors')}</span>
                                <span className="section-count">{visibleFavoriteSensorDevices.length}</span>
                            </div>
                        </div>
                        <div className="device-grid" style={{ marginBottom: 16 }}>
                            {visibleFavoriteSensorDevices.map(device => (
                                <DeviceCardAdapter key={device.id} device={device} onToggle={ctx.onToggleDevice} isFavorite={true} onToggleFavorite={ctx.onToggleDeviceFavorite} onOpenSettings={state.handleOpenDeviceSettings} onOpenCameraStream={state.openCameraStream} isEditMode={state.edit.isEditMode} iconHiddenState={state.getIconHiddenState(`device_${device.id}`)} onToggleVisibility={() => state.toggleCardVisibility(`device_${device.id}`)} sensorDisplayConfig={state.sensorDisplayConfig} />
                            ))}
                        </div>
                    </>
                )}

                {visibleFavoriteScenarios.length > 0 && (
                    <>
                        <div className="section-header" style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{t('dashboard.scenarios')}</span>
                                <span className="section-count">{visibleFavoriteScenarios.length}</span>
                            </div>
                        </div>
                        <div className="scenario-grid" style={{ marginBottom: 16 }}>
                            {visibleFavoriteScenarios.map(scenario => (
                                <ScenarioCard
                                    key={scenario.id}
                                    scenario={scenario}
                                    onExecute={ctx.onExecuteScenario}
                                    isFavorite={true}
                                    onToggleFavorite={ctx.onToggleScenarioFavorite}
                                    isEditMode={state.edit.isEditMode}
                                    iconHiddenState={state.getIconHiddenState(`scenario_${scenario.id}`)}
                                    onToggleVisibility={() => state.toggleCardVisibility(`scenario_${scenario.id}`)}
                                />
                            ))}
                        </div>
                    </>
                )}

                {visibleFavoriteNonSensorDevices.length > 0 && (
                    <>
                        <div className="section-header" style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{t('dashboard.devices')}</span>
                                <span className="section-count">{visibleFavoriteNonSensorDevices.length}</span>
                            </div>
                        </div>
                        <div className="device-grid" style={{ marginBottom: 16 }}>
                            {visibleFavoriteNonSensorDevices.map(device => (
                                <DeviceCardAdapter key={device.id} device={device} onToggle={ctx.onToggleDevice} isFavorite={true} onToggleFavorite={ctx.onToggleDeviceFavorite} onOpenSettings={state.handleOpenDeviceSettings} onOpenCameraStream={state.openCameraStream} isEditMode={state.edit.isEditMode} iconHiddenState={state.getIconHiddenState(`device_${device.id}`)} onToggleVisibility={() => state.toggleCardVisibility(`device_${device.id}`)} sensorDisplayConfig={state.sensorDisplayConfig} />
                            ))}
                        </div>
                    </>
                )}

                {visibleFavoriteGroups.length > 0 && (
                    <>
                        <div className="section-header" style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{t('dashboard.groups')}</span>
                                <span className="section-count">{visibleFavoriteGroups.length}</span>
                            </div>
                        </div>
                        {visibleFavoriteGroups.map(group => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                devices={devicesForHome}
                                onToggleGroup={ctx.onToggleGroup}
                                onToggleDevice={ctx.onToggleDevice}
                                favoriteDeviceIds={ctx.favoriteDeviceIds}
                                onToggleDeviceFavorite={ctx.onToggleDeviceFavorite}
                                isFavorite={true}
                                onToggleFavorite={ctx.onToggleGroupFavorite}
                                onOpenSettings={state.handleOpenDeviceSettings}
                                onOpenCameraStream={state.openCameraStream}
                                onOpenGroupSettings={(g) => {
                                    const gDevices = devicesForHome.filter(d => g.devices.includes(d.id));
                                    if (isLightGroup(gDevices)) state.openGroupLightSettings(g);
                                    else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat')) state.openGroupThermostatSettings(g);
                                    else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.ventilation.fan')) state.openGroupFanSettings(g);
                                }}
                                isEditMode={state.edit.isEditMode}
                                getEffectiveHidden={state.getEffectiveHidden}
                                getIconHiddenState={state.getIconHiddenState}
                                onToggleDeviceVisibility={state.toggleCardVisibility}
                            />
                        ))}
                    </>
                )}
            </section>
        );
    };

    const renderRoom = (room: YandexRoom) => {
        const roomDevices = devicesForHome.filter(d => room.devices.includes(d.id) && visible(d.id));
        if (roomDevices.length === 0) return null;
        const isRoomCollapsed = !searching && state.collapse.collapsedRooms.has(room.id);

        // Separate standalone devices and devices that belong to groups (при поиске только найденные карточки)
        const roomGroups = searching ? [] : groupsForHome.filter(g => g.devices.some(deviceId => roomDevices.some(d => d.id === deviceId)));
        const groupedDeviceIds = new Set(roomGroups.flatMap(g => g.devices));
        const standaloneDevices = roomDevices.filter(d => !groupedDeviceIds.has(d.id));

        return (
            <div key={room.id} className="room-section">
                <div className="room-header" onClick={() => state.toggleRoom(room.id)}>
                    {isRoomCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--muted)' }} />}
                    <span className="room-icon"><ZoneIcon icon={findNode(ctx.zones.tree, room.id)?.icon} kind="room" className="w-4 h-4" /></span>
                    <h2>{room.name}</h2>
                    <span className="room-count">{roomDevices.length}</span>
                    <ClimateChip devices={devicesForHome.filter(d => room.devices.includes(d.id))} />
                </div>
                {!isRoomCollapsed && (
                    <>
                        {standaloneDevices.length > 0 && (
                            <div className="device-grid" style={{ marginBottom: 16 }}>
                                {standaloneDevices
                                    .filter(d => !state.getEffectiveHidden(`device_${d.id}`))
                                    .map(dev => (
                                        <DeviceCardAdapter key={dev.id} device={dev} onToggle={ctx.onToggleDevice} isFavorite={ctx.favoriteDeviceIds.includes(dev.id)} onToggleFavorite={ctx.onToggleDeviceFavorite} onOpenSettings={state.handleOpenDeviceSettings} onOpenCameraStream={state.openCameraStream} isEditMode={state.edit.isEditMode} iconHiddenState={state.getIconHiddenState(`device_${dev.id}`)} onToggleVisibility={() => state.toggleCardVisibility(`device_${dev.id}`)} sensorDisplayConfig={state.sensorDisplayConfig} />
                                    ))}
                            </div>
                        )}

                        {roomGroups.map(group => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                devices={devicesForHome}
                                onToggleGroup={ctx.onToggleGroup}
                                onToggleDevice={ctx.onToggleDevice}
                                favoriteDeviceIds={ctx.favoriteDeviceIds}
                                onToggleDeviceFavorite={ctx.onToggleDeviceFavorite}
                                isFavorite={ctx.favoriteGroupIds.includes(group.id)}
                                onToggleFavorite={ctx.onToggleGroupFavorite}
                                onOpenSettings={state.handleOpenDeviceSettings}
                                onOpenCameraStream={state.openCameraStream}
                                onOpenGroupSettings={(g) => {
                                    const gDevices = devicesForHome.filter(d => g.devices.includes(d.id));
                                    if (isLightGroup(gDevices)) state.openGroupLightSettings(g);
                                    else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat')) state.openGroupThermostatSettings(g);
                                    else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.ventilation.fan')) state.openGroupFanSettings(g);
                                }}
                                isEditMode={state.edit.isEditMode}
                                getEffectiveHidden={state.getEffectiveHidden}
                                getIconHiddenState={state.getIconHiddenState}
                                onToggleDeviceVisibility={state.toggleCardVisibility}
                            />
                        ))}
                    </>
                )}
            </div>
        );
    };

    return (
        <>
            {renderStatsRow()}
            {nothingFound && <div className="empty-state"><p>{t('dashboard.nothingFound')}</p></div>}
            {filter === 'all' && !searching && renderFavoritesSection()}

            {filter === 'devices' && (() => {
                const list = devicesForHome.filter(d => visible(d.id)).sort((a, b) => a.name.localeCompare(b.name));
                return (
                    <div className="device-grid">
                        {list.map(dev => (
                            <DeviceCardAdapter key={dev.id} device={dev} onToggle={ctx.onToggleDevice} isFavorite={ctx.favoriteDeviceIds.includes(dev.id)} onToggleFavorite={ctx.onToggleDeviceFavorite} onOpenSettings={state.handleOpenDeviceSettings} onOpenCameraStream={state.openCameraStream} sensorDisplayConfig={state.sensorDisplayConfig} />
                        ))}
                    </div>
                );
            })()}

            {(filter === 'all' || filter === 'rooms') && flattenTree(ctx.zones.tree).map(node => {
                if (node.kind === 'room') {
                    const room = roomsForHome.find(r => r.id === node.id);
                    return room ? <React.Fragment key={node.id}>{renderRoom(room)}</React.Fragment> : null;
                }
                // Собственная зона (этаж): заголовок, если внутри есть (найденные) устройства
                if (!node.allDeviceIds.some(id => visible(id) && devicesForHome.some(d => d.id === id))) return null;
                // Устройства, которые лежат прямо в зоне (переложены туда в приложении)
                const direct = devicesForHome.filter(d => node.deviceIds.includes(d.id) && visible(d.id));
                return (
                    <React.Fragment key={node.id}>
                        <button className="zone-floor-heading" style={{ marginLeft: node.depth * 12 }} onClick={() => ctx.onSelectRoom(node.id)}>
                            <ZoneIcon icon={node.icon} kind="zone" className="w-4 h-4" />
                            <span>{node.name}</span>
                        </button>
                        {direct.length > 0 && (
                            <div className="device-grid zone-direct-grid">
                                {direct.map(dev => (
                                    <DeviceCardAdapter key={dev.id} device={dev} onToggle={ctx.onToggleDevice} isFavorite={ctx.favoriteDeviceIds.includes(dev.id)} onToggleFavorite={ctx.onToggleDeviceFavorite} onOpenSettings={state.handleOpenDeviceSettings} onOpenCameraStream={state.openCameraStream} sensorDisplayConfig={state.sensorDisplayConfig} />
                                ))}
                            </div>
                        )}
                    </React.Fragment>
                );
            })}

            {/* Unassigned Devices */}
            {(filter === 'all' || filter === 'rooms') && (() => {
                const assignedIds = new Set(roomsForHome.flatMap(r => r.devices));
                const unassignedDevices = devicesForHome.filter(d => !assignedIds.has(d.id) && visible(d.id));
                if (unassignedDevices.length === 0) return null;
                return (
                    <div className="room-section">
                        <div className="room-header" onClick={state.toggleUnassignedDevices}>
                            {state.collapse.isUnassignedDevicesCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--muted)' }} />}
                            <h2>{t('dashboard.noRoom')}</h2>
                            <span className="room-count">{unassignedDevices.length}</span>
                        </div>
                        {!state.collapse.isUnassignedDevicesCollapsed && (
                            <div className="device-grid">
                                {unassignedDevices
                                    .filter(d => !state.getEffectiveHidden(`device_${d.id}`))
                                    .map(dev => (
                                        <DeviceCardAdapter key={dev.id} device={dev} onToggle={ctx.onToggleDevice} isFavorite={ctx.favoriteDeviceIds.includes(dev.id)} onToggleFavorite={ctx.onToggleDeviceFavorite} onOpenSettings={state.handleOpenDeviceSettings} onOpenCameraStream={state.openCameraStream} isEditMode={state.edit.isEditMode} iconHiddenState={state.getIconHiddenState(`device_${dev.id}`)} onToggleVisibility={() => state.toggleCardVisibility(`device_${dev.id}`)} sensorDisplayConfig={state.sensorDisplayConfig} />
                                    ))}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Scenarios Section */}
            {(filter === 'all' || filter === 'scenarios') && !(searching && filter === 'all') && shownScenarios.length > 0 && (
                <section style={{ marginTop: 32 }}>
                    <div className="section-header">
                        <button onClick={state.toggleScenarios} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                            {scenariosCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--muted)' }} />}
                            <h2>{t('dashboard.scenarios')}</h2>
                            <span className="section-count">{shownScenarios.filter(s => !state.getEffectiveHidden(`scenario_${s.id}`)).length}</span>
                        </button>
                    </div>
                    {!scenariosCollapsed && (
                        <>
                            {shownScenarios.length === 0 ? (
                                <div className="empty-state"><p>{t('dashboard.noScenarios')}</p></div>
                            ) : (
                                <div className="scenario-grid">
                                    {shownScenarios.map(scenario => {
                                        const cardId = `scenario_${scenario.id}`;
                                        const isHidden = state.getEffectiveHidden(cardId);
                                        if (!state.edit.isEditMode && isHidden) return null;
                                        return (
                                            <ScenarioCard
                                                key={scenario.id}
                                                scenario={scenario}
                                                onExecute={ctx.onExecuteScenario}
                                                isFavorite={ctx.favoriteScenarioIds.includes(scenario.id)}
                                                onToggleFavorite={ctx.onToggleScenarioFavorite}
                                                isEditMode={state.edit.isEditMode}
                                                iconHiddenState={state.getIconHiddenState(cardId)}
                                                onToggleVisibility={() => state.toggleCardVisibility(cardId)}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </section>
            )}
        </>
    );
};
