import { Languages, Lightbulb, Volume2, VolumeX } from 'lucide-react';
import {
  labelLocale,
  labelTheme,
  LOCALE_OPTIONS,
  useI18n,
} from '../../i18n';
import { THEME_ORDER, THEMES } from '../../theme';
import { ViewSelector } from '../ViewSelector';
import type { PanelOptionsProps } from './types';
import { usePanelDisclosure } from './usePanelDisclosure';

export function PanelOptions({
  coachDisabledOnline,
  coachEnabled,
  coachSetting,
  language,
  layout,
  soundSetting,
  themeId,
  onCoachSettingChange,
  onLanguageChange,
  onLayoutChange,
  onThemeChange,
  onToggleSound,
}: PanelOptionsProps) {
  const [open, setOpen] = usePanelDisclosure('3dxox-panel-options-open', false);
  const i18n = useI18n();
  const { t } = i18n;

  return (
    <details
      className="panel-section panel-section-options"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{t('options.title')}</span>
        <small>{t('options.subtitle')}</small>
      </summary>

      <div className="panel-section-body">
        <div className="control-group">
          <span className="control-label">{t('language.label')}</span>
          <div className="segmented-control language-control">
            {LOCALE_OPTIONS.map((locale) => {
              const label = labelLocale(i18n, locale);

              return (
                <button
                  key={locale}
                  aria-label={label}
                  className={language === locale ? 'active' : ''}
                  title={label}
                  type="button"
                  onClick={() => onLanguageChange(locale)}
                >
                  <Languages size={16} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <ViewSelector
          className="panel-view-selector"
          layout={layout}
          onChange={onLayoutChange}
        />

        <div className="control-group">
          <span className="control-label">{t('options.style')}</span>
          <div className="theme-grid">
            {THEME_ORDER.map((id) => {
              const option = THEMES[id];
              const label = labelTheme(i18n, id);

              return (
                <button
                  key={id}
                  className={`theme-option ${themeId === id ? 'active' : ''}`}
                  type="button"
                  onClick={() => onThemeChange(id)}
                >
                  <span
                    className="theme-swatch"
                    aria-hidden="true"
                    style={{ background: option.scene.background }}
                  >
                    <span style={{ background: option.scene.x }} />
                    <span style={{ background: option.scene.o }} />
                    <span style={{ background: option.scene.edge }} />
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">{t('options.sound')}</span>
          <div className="segmented-control">
            <button
              aria-label={t('sound.on')}
              className={soundSetting === 'on' ? 'active' : ''}
              title={t('sound.on')}
              type="button"
              onClick={() => {
                if (soundSetting !== 'on') {
                  onToggleSound();
                }
              }}
            >
              <Volume2 size={16} />
              <span>{t('sound.on')}</span>
            </button>
            <button
              aria-label={t('sound.off')}
              className={soundSetting === 'off' ? 'active' : ''}
              title={t('sound.off')}
              type="button"
              onClick={() => {
                if (soundSetting !== 'off') {
                  onToggleSound();
                }
              }}
            >
              <VolumeX size={16} />
              <span>{t('sound.off')}</span>
            </button>
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">{t('options.coach')}</span>
          <div className="segmented-control coach-control">
            {(['auto', 'on', 'off'] as const).map((setting) => (
              <button
                key={setting}
                aria-label={
                  setting === 'auto'
                    ? t('coach.auto')
                    : setting === 'on'
                      ? t('sound.on')
                      : t('sound.off')
                }
                className={coachSetting === setting ? 'active' : ''}
                disabled={coachDisabledOnline}
                title={
                  setting === 'auto'
                    ? t('coach.auto')
                    : setting === 'on'
                      ? t('sound.on')
                      : t('sound.off')
                }
                type="button"
                onClick={() => onCoachSettingChange(setting)}
              >
                <Lightbulb size={16} />
                <span>
                  {setting === 'auto'
                    ? t('coach.auto')
                    : setting === 'on'
                      ? t('sound.on')
                      : t('sound.off')}
                </span>
              </button>
            ))}
          </div>
          {coachDisabledOnline ? (
            <p className="control-note">{t('coach.disabledOnline')}</p>
          ) : coachSetting === 'auto' && coachEnabled ? (
            <p className="control-note">{t('coach.activeAuto')}</p>
          ) : null}
        </div>
      </div>
    </details>
  );
}
