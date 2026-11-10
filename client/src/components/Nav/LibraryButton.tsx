import { Library } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button, TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface LibraryButtonProps {
  /** Which way the tooltip opens: the desktop rail is a left edge, the mobile
   *  drawer header is a top edge. Ignored by the `row` layout, which has no
   *  tooltip to place. */
  side?: 'right' | 'bottom';
  /** Mobile dismisses the drawer on navigation; the desktop rail stays put. */
  onNavigate?: () => void;
  /**
   * `icon` is the rail's square, labelled by a tooltip. `row` is a full-width
   * entry carrying its own label, for the mobile drawer.
   */
  layout?: 'icon' | 'row';
}

/**
 * ChatGPT-style Library entry in the sidebar. Displays all uploaded/generated
 * files, images, Canvas documents, and Mindmap boards.
 */
export default function LibraryButton({
  side = 'right',
  onNavigate,
  layout = 'icon',
}: LibraryButtonProps) {
  const localize = useLocalize();
  const location = useLocation();
  const isRow = layout === 'row';
  const isActive = location.pathname.startsWith('/library');

  const button = (
    <Button
      asChild
      variant="nav"
      size={isRow ? 'row' : 'icon'}
      className={cn('shrink-0', isRow ? 'w-full justify-start' : 'h-9 w-9')}
      aria-current={isActive ? 'page' : undefined}
    >
      <Link
        to="/library"
        data-testid="nav-library-button"
        aria-label={isRow ? undefined : localize('com_ui_library')}
        onClick={(event) => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
          }
          onNavigate?.();
        }}
      >
        <Library className="text-text-primary h-5 w-5 shrink-0" aria-hidden="true" />
        {isRow && (
          <span className="text-text-primary min-w-0 truncate text-sm font-medium">
            {localize('com_ui_library')}
          </span>
        )}
      </Link>
    </Button>
  );

  if (isRow) {
    return button;
  }

  return <TooltipAnchor description={localize('com_ui_library')} side={side} render={button} />;
}
