import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utilidad estándar de shadcn/ui: combina clases condicionales y resuelve conflictos de Tailwind.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
