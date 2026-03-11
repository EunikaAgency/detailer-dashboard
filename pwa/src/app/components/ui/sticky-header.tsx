import { ArrowLeft, Home, Menu } from "lucide-react";
import { useNavigate } from "react-router";
import { ActionButton } from "./action-button";

interface StickyHeaderProps {
  idPrefix?: string;
  title: string;
  showBack?: boolean;
  showMenu?: boolean;
  backTo?: string;
  rightActions?: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function StickyHeader({ 
  idPrefix,
  title, 
  showBack, 
  showMenu, 
  backTo,
  rightActions,
  subtitle,
  icon 
}: StickyHeaderProps) {
  const navigate = useNavigate();
  const goHome = () => navigate("/presentations#presentations-screen-content");
  
  return (
    <header
      id={idPrefix ? `${idPrefix}-header` : undefined}
      className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-slate-200 px-4 py-3"
    >
      <div
        id={idPrefix ? `${idPrefix}-content` : undefined}
        className="flex items-center justify-between max-w-screen-xl mx-auto"
      >
        <div
          id={idPrefix ? `${idPrefix}-primary` : undefined}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <ActionButton
            id={idPrefix ? `${idPrefix}-home-button` : undefined}
            onClick={goHome}
            className={showMenu ? "shrink-0" : "-ml-2 shrink-0"}
            aria-label="Go to presentations"
            label="Home"
            icon={<Home className="w-5 h-5" />}
          />
          {showMenu && (
            <ActionButton
              id={idPrefix ? `${idPrefix}-menu-button` : undefined}
              onClick={() => navigate('/menu')}
              className="-ml-2 shrink-0"
              aria-label="Open menu"
              label="Menu"
              icon={<Menu className="w-5 h-5" />}
            />
          )}
          <div
            id={idPrefix ? `${idPrefix}-title-group` : undefined}
            className="flex items-center gap-2 min-w-0 flex-1"
          >
            {icon}
            <div id={idPrefix ? `${idPrefix}-title-wrap` : undefined} className="min-w-0 flex-1">
              <h1 id={idPrefix ? `${idPrefix}-title` : undefined} className="text-lg font-semibold text-slate-900 truncate">
                {title}
              </h1>
              {subtitle && (
                <p id={idPrefix ? `${idPrefix}-subtitle` : undefined} className="text-sm text-slate-500 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        {rightActions && (
          <div
            id={idPrefix ? `${idPrefix}-actions` : undefined}
            className="ml-2 flex shrink-0 items-center gap-2"
          >
            {rightActions}
          </div>
        )}
        {showBack && (
          <div
            id={idPrefix ? `${idPrefix}-back-wrap` : undefined}
            className="ml-2 flex shrink-0 items-center gap-2"
          >
            <ActionButton
              id={idPrefix ? `${idPrefix}-back-button` : undefined}
              onClick={() => navigate(backTo ?? "/presentations")}
              className="shrink-0"
              aria-label="Go back"
              label="Back"
              icon={<ArrowLeft className="w-5 h-5" />}
            />
          </div>
        )}
      </div>
    </header>
  );
}
