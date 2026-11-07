import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const variants = cva('inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 disabled:opacity-50 disabled:pointer-events-none', { variants: { variant: { default: 'bg-primary text-primary-foreground hover:bg-primary-hover', outline: 'border border-border-strong bg-white text-foreground hover:border-primary hover:bg-brand-soft' } }, defaultVariants: { variant: 'default' } });
export function Button({ className, variant, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : 'button';
  return <Component data-slot="button" className={twMerge(clsx(variants({ variant }), className))} {...props} />;
}
