import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { ToggleSwitch } from '../ToggleSwitch';
import { getCheckUpdatesOnStartup, setCheckUpdatesOnStartup } from '../../utils/updateSettings';
import { useI18n } from '../../i18n/I18nContext';
import { RELEASES_API_URL } from '../../constants/app';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  body?: string;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, currentVersion }) => {
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [noReleases, setNoReleases] = useState(false);
  const { t, lang } = useI18n();
  const [checkOnStartup, setCheckOnStartup] = useState(getCheckUpdatesOnStartup);

  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  };

  const checkForUpdates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(RELEASES_API_URL);
      if (response.status === 404) {
        // Релизов ещё нет: значит, установлена самая новая сборка
        setNoReleases(true);
        setHasChecked(true);
        return;
      }
      if (!response.ok) {
        throw new Error(t('modals.info.fetchFailed'));
      }
      const data: GitHubRelease = await response.json();
      setLatestRelease(data);
      setHasChecked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modals.info.checkFailed'));
      setHasChecked(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !hasChecked) {
      checkForUpdates();
    }
  }, [isOpen, hasChecked]);

  useEffect(() => {
    if (isOpen) {
      setCheckOnStartup(getCheckUpdatesOnStartup());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const latestVersion = latestRelease?.tag_name || null;
  const isUpdateAvailable = latestVersion && compareVersions(latestVersion, currentVersion) > 0;
  const downloadUrl = latestRelease?.html_url || '#';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-soft">
          <h2 className="text-xl font-bold text-slate-900 dark:text-card-fg">{t('dashboard.about')}</h2>
          <button
            onClick={onClose}
            className="p-1 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 rounded-lg transition-colors"
            title={t('common.close')}
          >
            <X className="w-5 h-5 text-slate-600 dark:text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Version */}
          <div>
            <p className="text-sm text-slate-600 dark:text-muted mb-2">{t('modals.info.currentVersion')}</p>
            <div className="bg-gray-100 dark:bg-surface-warm rounded-lg p-4">
              <p className="text-2xl font-bold text-slate-900 dark:text-card-fg">v{currentVersion}</p>
            </div>
          </div>

          {/* Latest Version Status */}
          <div>
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--accent)] dark:border-primary"></div>
              </div>
            )}

            {!isLoading && latestVersion && (
              <>
                {isUpdateAvailable ? (
                  <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-4">
                    <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-400 mb-2">
                      {t('modals.info.updateAvailable')}
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                      {t('modals.info.newVersion')} <span className="font-bold">{latestVersion}</span>
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      {t('modals.info.released', { date: new Date(latestRelease!.published_at).toLocaleDateString(lang) })}
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-900 dark:text-green-400 mb-2">
                      {t('modals.info.upToDate')}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      {t('modals.info.updated', { date: new Date(latestRelease!.published_at).toLocaleDateString(lang) })}
                    </p>
                  </div>
                )}
              </>
            )}

            {!isLoading && noReleases && (
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-900 dark:text-green-400">
                  {t('modals.info.upToDate')}
                </p>
              </div>
            )}

            {!isLoading && !latestVersion && !error && !noReleases && (
              <button
                onClick={checkForUpdates}
                className="w-full px-4 py-2 bg-[color:var(--accent)] dark:bg-primary hover:bg-[color:var(--accent-hover)] dark:hover:bg-primary-hover text-white rounded-lg transition-colors font-medium text-sm"
              >
                {t('modals.info.check')}
              </button>
            )}
          </div>

          <div className="bg-gray-100 dark:bg-surface-warm rounded-lg p-4">
            <ToggleSwitch
              checked={checkOnStartup}
              onChange={(enabled) => {
                setCheckOnStartup(enabled);
                setCheckUpdatesOnStartup(enabled);
              }}
              label={t('modals.info.checkOnStartup')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-border-soft p-6 flex gap-3">
          {isUpdateAvailable && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[color:var(--accent)] dark:bg-primary hover:bg-[color:var(--accent-hover)] dark:hover:bg-primary-hover text-white rounded-lg transition-colors font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              {t('modals.info.download')}
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 text-slate-900 dark:text-card-fg rounded-lg transition-colors font-medium text-sm"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
