/** Open the platform file picker and read one text file. Rejects on cancel-free close is impossible, so it resolves null when nothing is picked. */
export const pickTextFile = (accept: string): Promise<{ name: string; text: string } | null> =>
  new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (): void => {
      const file = input.files?.[0];
      if (file === undefined) {
        resolve(null);
        return;
      }
      file.text().then((text) => resolve({ name: file.name, text }), reject);
    };
    input.oncancel = (): void => resolve(null);
    input.click();
  });
