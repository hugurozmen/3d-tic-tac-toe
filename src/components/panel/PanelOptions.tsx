import { Lightbulb, Volume2, VolumeX } from 'lucide-react';
import { THEME_ORDER, THEMES } from '../../theme';
import { ViewSelector } from '../ViewSelector';
import type { PanelOptionsProps } from './types';
import { usePanelDisclosure } from './usePanelDisclosure';

export function PanelOptions({
  coachDisabledOnline,
  coachEnabled,
  coachSetting,
  layout,
  soundSetting,
  themeId,
  onCoachSettingChange,
  onLayoutChange,
  onThemeChange,
  onToggleSound,
}: PanelOptionsProps) {
  const [open, setOpen] = usePanelDisclosure('3dxox-panel-options-open', false);

  return (
    <details
      className="panel-section panel-section-options"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>Options</span>
        <small>View, theme, sound, Coach</small>
      </summary>

      <div className="panel-section-body">
        <ViewSelector
          className="panel-view-selector"
          layout={layout}
          onChange={onLayoutChange}
        />

        <div className="control-group">
          <span className="control-label">Style</span>
          <div className="theme-grid">
            {THEME_ORDER.map((id) => {
              const option = THEMES[id];

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
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Sound</span>
          <div className="segmented-control">
            <button
              aria-label="On"
              className={soundSetting === 'on' ? 'active' : ''}
              title="On"
              type="button"
              onClick={() => {
                if (soundSetting !== 'on') {
                  onToggleSound();
                }
              }}
            >
              <Volume2 size={16} />
              <span>On</span>
            </button>
            <button
              aria-label="Off"
              className={soundSetting === 'off' ? 'active' : ''}
              title="Off"
              type="button"
              onClick={() => {
                if (soundSetting !== 'off') {
                  onToggleSound();
                }
              }}
            >
              <VolumeX size={16} />
              <span>Off</span>
            </button>
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Coach</span>
          <div className="segmented-control coach-control">
            {(['auto', 'on', 'off'] as const).map((setting) => (
              <button
                key={setting}
                aria-label={
                  setting === 'auto'
                    ? 'Auto'
                    : setting === 'on'
                      ? 'On'
                      : 'Off'
                }
                className={coachSetting === setting ? 'active' : ''}
                disabled={coachDisabledOnline}
                title={
                  setting === 'auto'
                    ? 'Auto'
                    : setting === 'on'
                      ? 'On'
                      : 'Off'
                }
                type="button"
                onClick={() => onCoachSettingChange(setting)}
              >
                <Lightbulb size={16} />
                <span>
                  {setting === 'auto'
                    ? 'Auto'
                    : setting === 'on'
                      ? 'On'
                      : 'Off'}
                </span>
              </button>
            ))}
          </div>
          {coachDisabledOnline ? (
            <p className="control-note">Coach disabled online</p>
          ) : coachSetting === 'auto' && coachEnabled ? (
            <p className="control-note">Coach is active automatically.</p>
          ) : null}
        </div>
      </div>
    </details>
  );
}
