import { Icon } from '../icons';

export function ScreenHeader({ title, subtitle, onProfile }: { title: string; subtitle?: string; onProfile?: () => void }) {
  return (
    <header className="ui-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {onProfile && (
        <button type="button" className="ui-header__profile" aria-label="Buka akun" onClick={onProfile}>
          <Icon name="user" />
        </button>
      )}
    </header>
  );
}
