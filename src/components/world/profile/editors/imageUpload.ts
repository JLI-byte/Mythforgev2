/** Reads a File into a base64 data URL (same approach the app uses for covers). */
export function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('read failed'));
        reader.readAsDataURL(file);
    });
}
