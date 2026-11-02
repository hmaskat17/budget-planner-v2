/** Browser file interactions for backups. Mobile provides its own adapter with the same shape. */
export interface PickedBackupFile {
  name: string;
  text: string;
}

export function downloadBackup(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function readBackupFile(file: File): Promise<PickedBackupFile> {
  return { name: file.name, text: await file.text() };
}
