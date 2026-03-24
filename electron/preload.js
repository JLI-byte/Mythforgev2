const { contextBridge, ipcRenderer } = require('electron');

// We can expose IPC handlers here if we need to interact with the file system directly later.
contextBridge.exposeInMainWorld('electronAPI', {
    // Placeholder for future native interactions
});
