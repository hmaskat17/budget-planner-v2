/** Browser file interactions for backups and reports. Mobile provides its own adapter with the same shape. */
export interface PickedBackupFile {
  name: string;
  text: string;
}

export function downloadFile(filename: string, content: BlobPart, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadBackup(filename: string, text: string): void {
  downloadFile(filename, text, 'application/json');
}

export async function readBackupFile(file: File): Promise<PickedBackupFile> {
  return { name: file.name, text: await file.text() };
}
