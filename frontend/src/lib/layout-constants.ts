/**
 * Layout constants for consistent page spacing and containers
 * across all pages in the application.
 */
export const LAYOUT = {
  /** Navigation offset - matches absolute positioned navigation height */
  NAV_OFFSET: 60, // pixels - matches main-chat.tsx

  /** Mobile horizontal padding (px-4) */
  PADDING_MOBILE: 16,

  /** Desktop horizontal padding (px-6) */
  PADDING_DESKTOP: 24,
} as const;

/** Tailwind class names for layout patterns */
export const LAYOUT_CLASSES = {
  /** Navigation offset class */
  navOffset: 'pt-[60px]',

  /** Mobile horizontal padding */
  paddingMobile: 'px-4',

  /** Desktop horizontal padding */
  paddingDesktop: 'md:px-6',

  /** Mobile bottom padding */
  paddingBottomMobile: 'pb-4',

  /** Desktop bottom padding */
  paddingBottomDesktop: 'md:pb-6',

  /** Full screen height for mobile */
  fullScreenHeight: 'h-screen-mobile',
} as const;
