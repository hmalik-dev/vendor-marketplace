'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          // `rounded-xl`, per 03-components.md. Sonner reads this variable in
          // its own `[data-styled]` rule, which is the one that actually wins.
          '--border-radius': 'var(--radius-xl)',
        } as React.CSSProperties
      }
      /*
       * The surface, radius, shadow and 4px type accent are in `globals.css`,
       * keyed on Sonner's own `[data-sonner-toast]` attributes. Utility
       * classes lose to Sonner's attribute selectors and inline custom
       * properties, so styling it from here silently does nothing — which is
       * exactly how it drifted from `03-components.md` in the first place.
       */
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
