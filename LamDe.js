// --- Khởi tạo biến ---
let canvas;
let imageFiles = [];
let currentIndex = -1;

// Khởi tạo Fabric Canvas khi tải trang
window.onload = () => {
    canvas = new fabric.Canvas('mainCanvas', {
        fireRightClick: true,  // Bật tính năng nhận diện chuột phải
        stopContextMenu: true  // Chặn menu chuột phải mặc định của trình duyệt hiện lên canvas
    });
    setupKeyboardEvents();
    setupMouseTouchEvents(); // Thêm sự kiện chuột phải / ấn giữ
};

// --- DOM Elements ---
const folderInput = document.getElementById('folderInput');
const fileList = document.getElementById('fileList');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const imageCounter = document.getElementById('imageCounter');
const fileNameInput = document.getElementById('fileNameInput');

// --- Xử lý tải thư mục ---
folderInput.addEventListener('change', (e) => {
    imageFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
        alert("Không tìm thấy ảnh nào trong thư mục này!");
        return;
    }
    renderFileList();
    loadImage(0);
});

function renderFileList() {
    fileList.innerHTML = '';
    imageFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = `p-2 text-sm cursor-pointer truncate rounded mb-1 ${index === currentIndex ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-gray-100'}`;
        item.textContent = file.name;
        item.onclick = () => loadImage(index);
        fileList.appendChild(item);
    });
}

// --- Load ảnh lên Canvas ---
function loadImage(index) {
    if (index < 0 || index >= imageFiles.length) return;
    currentIndex = index;
    
    const file = imageFiles[currentIndex];
    renderFileList();
    imageCounter.textContent = `${currentIndex + 1} / ${imageFiles.length}`;
    
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    fileNameInput.value = baseName;

    const reader = new FileReader();
    reader.onload = function(f) {
        fabric.Image.fromURL(f.target.result, function(img) {
            canvas.clear(); 
            const maxWidth = 800;
            const maxHeight = 600;
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
            
            canvas.setWidth(img.width * scale);
            canvas.setHeight(img.height * scale);
            img.set({ originX: 'left', originY: 'top', scaleX: scale, scaleY: scale });
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
        });
    };
    reader.readAsDataURL(file);
}

// --- Điều hướng ---
btnPrev.addEventListener('click', () => loadImage(currentIndex - 1));
btnNext.addEventListener('click', () => loadImage(currentIndex + 1));

// --- Các hàm thêm Công cụ ---
const defaultOptions = { left: 50, top: 50, strokeWidth: 3, fill: 'transparent', stroke: 'red' };

document.getElementById('btnAddText').onclick = () => {
    const text = new fabric.IText('Nhập chữ...', {
        left: 50, top: 50, fontFamily: 'Arial', fill: 'red', fontSize: 24, fontWeight: 'bold'
    });
    canvas.add(text).setActiveObject(text);
};

document.getElementById('btnRectHollow').onclick = () => {
    canvas.add(new fabric.Rect({ ...defaultOptions, width: 100, height: 100 }));
};

document.getElementById('btnRectFill').onclick = () => {
    canvas.add(new fabric.Rect({ left: 50, top: 50, width: 100, height: 100, fill: 'red' }));
};

document.getElementById('btnCircleHollow').onclick = () => {
    canvas.add(new fabric.Circle({ ...defaultOptions, radius: 50 }));
};

document.getElementById('btnCircleFill').onclick = () => {
    canvas.add(new fabric.Circle({ left: 50, top: 50, radius: 50, fill: 'red' }));
};

document.getElementById('btnAddArrow').onclick = () => {
    const arrow = new fabric.Path('M 0 0 L 60 0 M 60 0 L 45 -15 M 60 0 L 45 15', {
        ...defaultOptions, stroke: 'red', strokeWidth: 4, fill: 'transparent'
    });
    canvas.add(arrow);
};

// --- Xử lý sự kiện Xóa (Bàn phím) ---
function setupKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || canvas.getActiveObject()?.isEditing) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteActiveObjects();
        }
    });
}

// --- Xử lý sự kiện Xóa (Chuột phải & Ấn giữ mobile) ---
function setupMouseTouchEvents() {
    let pressTimer;

    canvas.on('mouse:down', function(options) {
        const target = options.target;
        if (!target) return;

        // Chuột phải (Fabric JS quy định button === 3 là chuột phải)
        if (options.button === 3) {
            canvas.remove(target);
            canvas.discardActiveObject();
            return;
        }

        // Bắt đầu đếm thời gian ấn giữ (Long press) cho màn hình cảm ứng
        pressTimer = setTimeout(() => {
            canvas.remove(target);
            canvas.discardActiveObject();
        }, 800); // Giữ 800ms sẽ kích hoạt xóa
    });

    // Nếu người dùng nhả chuột/tay ra, hoặc bắt đầu kéo thả di chuyển vật thể -> Hủy lệnh xóa
    canvas.on('mouse:up', () => clearTimeout(pressTimer));
    canvas.on('mouse:move', () => clearTimeout(pressTimer));
}

function deleteActiveObjects() {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
        activeObjects.forEach(obj => canvas.remove(obj));
        canvas.discardActiveObject();
    }
}

// --- Hàm tạo chuỗi thời gian định dạng YYYYMMDD_HHMMSS ---
function getFormattedTime() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

// --- Xuất (Lưu) ảnh và File System Access API ---
let saveDirectoryHandle = null;

// Xử lý nút chọn thư mục lưu
document.getElementById('btnSelectSaveDir').addEventListener('click', async () => {
    try {
        // Mở hộp thoại chọn thư mục và xin quyền ghi
        saveDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        
        // Hiển thị tên thư mục đã chọn lên UI
        const statusEl = document.getElementById('saveDirStatus');
        statusEl.textContent = `📁 Đang lưu tại: ${saveDirectoryHandle.name}`;
        statusEl.classList.remove('hidden');
    } catch (error) {
        console.log('Người dùng hủy chọn hoặc trình duyệt không hỗ trợ:', error);
    }
});

// Xử lý nút Lưu ảnh
document.getElementById('btnDownload').addEventListener('click', async () => {
    if (!canvas || imageFiles.length === 0) return;
    
    const baseFileName = fileNameInput.value.trim() || 'edited_image';
    const timestamp = getFormattedTime();
    const finalFileName = `${baseFileName}_${timestamp}.png`;
    
    // Bỏ chọn đối tượng trước khi lưu
    canvas.discardActiveObject();
    canvas.renderAll();

    // Lấy dữ liệu ảnh từ canvas
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1 });

    // CÁCH 1: Dùng File System Access API để lưu thẳng vào thư mục đã chọn
    if (saveDirectoryHandle) {
        try {
            // Chuyển dataURL thành Blob để ghi file
            const response = await fetch(dataURL);
            const blob = await response.blob();

            // Tạo file mới trong thư mục đã chọn
            const fileHandle = await saveDirectoryHandle.getFileHandle(finalFileName, { create: true });
            
            // Ghi dữ liệu vào file
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            
            // Đổi màu nút chớp nháy nhẹ để báo hiệu lưu thành công
            const btn = document.getElementById('btnDownload');
            const originalText = btn.textContent;
            btn.textContent = "✅ Đã lưu!";
            btn.classList.add('bg-green-600');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('bg-green-600');
            }, 1000);
            return; // Kết thúc hàm nếu đã lưu thành công
        } catch (err) {
            console.error("Lỗi khi ghi file vào thư mục:", err);
            // Nếu lỗi (ví dụ mất quyền), sẽ tự động chạy xuống Cách 2
        }
    }

    // CÁCH 2: Fallback - Tải xuống theo kiểu truyền thống (vào mục Downloads)
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});