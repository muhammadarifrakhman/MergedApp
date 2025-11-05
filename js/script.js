// --- 0. Setup Library ---
const { PDFDocument } = PDFLib;
const { pdfjsLib } = window;

// Memberi tahu pdf.js di mana file 'worker'-nya berada (dari CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// --- 1. Ambil Elemen HTML ---
const uploadScreen = document.getElementById('upload-screen');
const previewScreen = document.getElementById('preview-screen');

const pdfInput = document.getElementById('pdf-input');
const fileStatus = document.getElementById('file-status');
const thumbnailContainer = document.getElementById('thumbnail-container');

const mergeButton = document.getElementById('merge-button');
const downloadButton = document.getElementById('download-button');
const backButton = document.getElementById('back-button');

const pdfPreview = document.getElementById('pdf-preview');

// --- 2. Variabel Global (State) ---
// Ini adalah array PENTING untuk melacak file yang akan digabung
let filesToMerge = [];
let mergedPdfUrl = null;

// --- 3. Event Listener Utama ---

// Saat pengguna memilih file
pdfInput.addEventListener('change', handleFileSelect);

// Saat tombol "Gabungkan" diklik
mergeButton.addEventListener('click', mergePdfs);

// Saat tombol "Download" diklik
downloadButton.addEventListener('click', downloadPdf);

// Saat tombol "Gabung Lagi" diklik
backButton.addEventListener('click', resetApp);

// --- 4. Fungsi-Fungsi ---

/**
 * Dipanggil saat input file berubah (pengguna memilih file)
 */
async function handleFileSelect(event) {
    const newFiles = Array.from(event.target.files);
    if (newFiles.length === 0) return;

    // Bersihkan daftar lama sebelum menambah yang baru
    // (Anda bisa ganti logika ini jika ingin menambah file, bukan mengganti)
    resetFileList();

    // Tambahkan file ke state kita dan buat thumbnail
    for (const file of newFiles) {
        const fileId = `${file.name}-${Date.now()}`;

        // Simpan file-nya di array
        filesToMerge.push({ id: fileId, file: file });

        // Buat elemen thumbnail di HTML
        const thumbnailEl = createThumbnailElement(fileId);
        thumbnailContainer.appendChild(thumbnailEl);

        // Render PDF ke canvas (thumbnail)
        try {
            const canvas = thumbnailEl.querySelector('.thumbnail-canvas');
            await renderPdfThumbnail(file, canvas);
        } catch (err) {
            console.error('Gagal me-render thumbnail:', err);
            // Tampilkan pesan error di canvas?
        }
    }

    updateFileStatus();
}

/**
 * Merender halaman pertama PDF ke elemen canvas
 */
async function renderPdfThumbnail(file, canvas) {
    const fileReader = new FileReader();

    fileReader.onload = async (event) => {
        try {
            const typedarray = new Uint8Array(event.target.result);
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            const page = await pdf.getPage(1); // Ambil halaman pertama

            const viewport = page.getViewport({ scale: 0.5 }); // Buat skala kecil

            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
        } catch (err) {
            console.error('Error pdf.js:', err);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'red';
            ctx.fillText('Error', 10, 10);
        }
    };

    fileReader.readAsArrayBuffer(file);
}

/**
 * Membuat elemen DOM untuk thumbnail (canvas + tombol hapus)
 */
function createThumbnailElement(fileId) {
    const item = document.createElement('div');
    item.className = 'thumbnail-item';
    item.dataset.id = fileId; // Simpan ID di elemen

    const canvas = document.createElement('canvas');
    canvas.className = 'thumbnail-canvas';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-button';
    removeBtn.innerHTML = '&times;'; // Simbol 'x'

    removeBtn.addEventListener('click', () => {
        removeFile(fileId);
    });

    item.appendChild(canvas);
    item.appendChild(removeBtn);
    return item;
}

/**
 * Menghapus file dari daftar (state) dan dari DOM
 */
function removeFile(fileId) {
    // 1. Hapus dari state array
    filesToMerge = filesToMerge.filter((f) => f.id !== fileId);

    // 2. Hapus dari HTML
    const thumbnailEl = thumbnailContainer.querySelector(`.thumbnail-item[data-id="${fileId}"]`);
    if (thumbnailEl) {
        thumbnailEl.remove();
    }

    updateFileStatus();
}

/**
 * Memperbarui teks status "Berhasil mengunggah X files"
 */
function updateFileStatus() {
    const count = filesToMerge.length;
    if (count === 0) {
        fileStatus.textContent = '';
    } else if (count === 1) {
        fileStatus.textContent = 'Berhasil mengunggah 1 file';
    } else {
        fileStatus.textContent = `Berhasil mengunggah ${count} files`;
    }
}

/**
 * Fungsi inti untuk menggabungkan PDF menggunakan pdf-lib
 */
async function mergePdfs() {
    if (filesToMerge.length < 2) {
        alert('Silakan pilih minimal 2 file PDF untuk digabung.');
        return;
    }

    try {
        mergeButton.textContent = 'Menggabungkan...';
        mergeButton.disabled = true;

        const mergedPdf = await PDFDocument.create();

        for (const fileObj of filesToMerge) {
            const fileBytes = await fileObj.file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(fileBytes, {
                // Abaikan error jika PDF-nya sedikit rusak
                ignoreEncryption: true,
            });

            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const pdfBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

        if (mergedPdfUrl) {
            URL.revokeObjectURL(mergedPdfUrl);
        }
        mergedPdfUrl = URL.createObjectURL(pdfBlob);

        pdfPreview.src = mergedPdfUrl;

        uploadScreen.classList.remove('active');
        previewScreen.classList.add('active');
    } catch (err) {
        alert('Terjadi error saat menggabung PDF: ' + err.message);
    } finally {
        mergeButton.textContent = 'Gabungkan PDF';
        mergeButton.disabled = false;
    }
}

/**
 * Memicu download PDF yang sudah digabung
 */
function downloadPdf() {
    if (mergedPdfUrl) {
        const a = document.createElement('a');
        a.href = mergedPdfUrl;
        a.download = 'Struk_Gabungan.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

/**
 * Membersihkan semua state untuk kembali ke awal
 */
function resetFileList() {
    filesToMerge = [];
    thumbnailContainer.innerHTML = '';
    updateFileStatus();
}

/**
 * Reset total aplikasi
 */
function resetApp() {
    previewScreen.classList.remove('active');
    uploadScreen.classList.add('active');

    pdfPreview.src = '';
    if (mergedPdfUrl) {
        URL.revokeObjectURL(mergedPdfUrl);
        mergedPdfUrl = null;
    }

    // Reset input file dan daftar thumbnail
    pdfInput.value = null;
    resetFileList();
}
