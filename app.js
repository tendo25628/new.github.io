// PDF Storage Manager using IndexedDB
class PDFStorage {
    constructor() {
        this.dbName = 'PDFStorageDB';
        this.storeName = 'PDFs';
        this.db = null;
        this.initDB();
        this.currentFile = null;
    }

    initDB() {
        const request = indexedDB.open(this.dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName, { keyPath: 'name' });
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.updateFileList();
            this.updateStorageUsage();
        };

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
        };
    }

    addPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const request = store.put({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified,
                    data: event.target.result
                });

                request.onsuccess = () => {
                    this.updateFileList();
                    this.updateStorageUsage();
                    resolve();
                };

                request.onerror = (event) => {
                    reject(event.target.error);
                };
            };
            reader.readAsDataURL(file);
        });
    }

    getPDF(name) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(name);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    deletePDF(name) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(name);

            request.onsuccess = () => {
                this.updateFileList();
                this.updateStorageUsage();
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    getAllPDFs() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async updateFileList() {
        const fileList = document.getElementById('file-list');
        const files = await this.getAllPDFs();

        if (files.length === 0) {
            fileList.innerHTML = '<p class="text-muted">No files found</p>';
            return;
        }

        fileList.innerHTML = '';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item p-2 border-bottom';
            fileItem.textContent = file.name;
            
            fileItem.addEventListener('click', () => {
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('bg-primary', 'text-white');
                });
                
                fileItem.classList.add('bg-primary', 'text-white');
                this.displayPDF(file);
                this.currentFile = file;
                
                document.getElementById('download-btn').disabled = false;
                document.getElementById('delete-btn').disabled = false;
            });
            
            fileList.appendChild(fileItem);
        });
    }

    displayPDF(file) {
        const pdfFrame = document.getElementById('pdf-frame');
        const placeholder = document.getElementById('pdf-placeholder');
        
        placeholder.style.display = 'none';
        pdfFrame.style.display = 'block';
        pdfFrame.src = file.data;
    }

    async updateStorageUsage() {
        const files = await this.getAllPDFs();
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const usageMB = (totalSize / (1024 * 1024)).toFixed(2);
        
        document.getElementById('storage-usage').textContent = `${usageMB} MB used`;
        
        // Check if approaching storage limit (typically 5-10% of total disk space)
        if (totalSize > 50 * 1024 * 1024) { // 50MB warning
            document.getElementById('storage-usage').style.color = 'orange';
        } else {
            document.getElementById('storage-usage').style.color = '';
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const storage = new PDFStorage();
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const downloadBtn = document.getElementById('download-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const pdfFrame = document.getElementById('pdf-frame');

    uploadBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Please select a PDF file');
            return;
        }

        try {
            await storage.addPDF(file);
            fileInput.value = '';
            uploadBtn.disabled = true;
        } catch (error) {
            alert('Error uploading file: ' + error.message);
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (!storage.currentFile) return;
        
        const a = document.createElement('a');
        a.href = storage.currentFile.data;
        a.download = storage.currentFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    deleteBtn.addEventListener('click', async () => {
        if (!storage.currentFile) return;
        
        if (confirm('Are you sure you want to delete this file?')) {
            try {
                await storage.deletePDF(storage.currentFile.name);
                pdfFrame.style.display = 'none';
                document.getElementById('pdf-placeholder').style.display = 'block';
                downloadBtn.disabled = true;
                deleteBtn.disabled = true;
                storage.currentFile = null;
            } catch (error) {
                alert('Error deleting file: ' + error.message);
            }
        }
    });

    fileInput.addEventListener('change', () => {
        uploadBtn.disabled = !fileInput.files.length;
    });
});