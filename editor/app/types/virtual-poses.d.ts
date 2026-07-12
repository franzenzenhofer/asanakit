declare module 'virtual:asanakit-poses' {
  export interface BundledFile {
    readonly file: string;
    readonly yaml: string;
  }
  export const bundledPoses: readonly BundledFile[];
  export const bundledSequences: readonly BundledFile[];
}
