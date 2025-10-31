import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/cosmic/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-none text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
  {
    variants: {
      variant: {
        default:
          'bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90',
        destructive: 'bg-crimson-500 text-white hover:bg-crimson-600',
        outline:
          'border border-input bg-background hover:bg-almostblack dark:hover:bg-white hover:text-white dark:hover:text-almostblack',
        secondary:
          'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
        ghost:
          'hover:bg-almostblack dark:hover:bg-white hover:text-white dark:hover:text-almostblack',
        link: 'underline-offset-4 hover:underline text-primary',
        inverted:
          'bg-almostblack text-white hover:bg-white hover:text-almostblack hover:border-1 hover:border-almostblack',
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  renderAs?: string;
  iconRight?: React.ReactElement;
  href?: string;
  target?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      renderAs = 'button',
      href,
      target,
      iconRight,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : href ? 'a' : renderAs;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        {...(Comp === 'a' ? { href, target } : {})}
      >
        {props.children}
        {iconRight && <span className='relative -top-px ml-1'>{iconRight}</span>}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
