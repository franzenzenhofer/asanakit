/**
 * The paywall seam. Everything is free at launch; a license check plugs in
 * here later without touching any feature code.
 */
export type Feature = 'export-png' | 'export-yaml' | 'sheet-builder' | 'unlimited-poses' | 'view-3d';

export const can = (_feature: Feature): boolean => true;
