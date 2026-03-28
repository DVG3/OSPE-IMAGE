// --- Khởi tạo biến ---
let canvas;
let imageFiles = [];
let currentIndex = -1;
let currentEditorColor = '#ff0000'; // Màu mặc định (Đỏ)

// Khởi tạo Fabric Canvas khi tải trang
window.onload = () => {
    canvas = new fabric.Canvas('mainCanvas', {
        fireRightClick: true,  // Bật chuột phải
        stopContextMenu: true  // Chặn menu chuột phải mặc định
    });
    setupKeyboardEvents();
    setupMouseTouchEvents(); 
    setupColorPickerEvent(); // THÊM MỚI: Khởi tạo sự kiện chọn màu
};

// --- DOM Elements ---
const folderInput = document.getElementById('folderInput');
const fileList = document.getElementById('fileList');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const imageCounter = document.getElementById('imageCounter');
const fileNameInput = document.getElementById('fileNameInput');
const colorPicker = document.getElementById('colorPicker'); // THÊM MỚI

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
        item.className = `p-2.5 text-sm cursor-pointer truncate rounded-lg mb-1 transition ${index === currentIndex ? 'bg-blue-100 text-blue-800 font-bold shadow-inner' : 'hover:bg-gray-100 text-gray-700'}`;
        item.textContent = file.name;
        item.onclick = () => loadImage(index);
        fileList.appendChild(item);
    });
}

// --- Load ảnh lên Canvas ---
function loadImage(index) {
    if (index < 0 || index >= imageFiles.length) return;
    
    // Cập nhật trạng thái disable của nút Trước/Sau
    btnPrev.disabled = (index === 0);
    btnNext.disabled = (index === imageFiles.length - 1);

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
            // Giới hạn hiển thị đẹp trong khung 800x600
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

// --- THÊM MỚI: Xử lý sự kiện Chọn Màu Sắc ---
function setupColorPickerEvent() {
    // Lấy màu mặc định lúc load trang từ input HTML
    currentEditorColor = colorPicker.value;

    // Sự kiện khi người dùng thay đổi màu trong hộp thoại
    colorPicker.addEventListener('input', (e) => {
        currentEditorColor = e.target.value; // Cập nhật màu hiện tại

        // NÂNG CAO: Nếu đang chọn 1 đối tượng, đổi màu đối tượng đó ngay lập tức
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            // Nếu là Text hoặc vật thể có Fill (Hình đặc)
            if (activeObject.type === 'i-text' || activeObject.fill !== 'transparent') {
                 // Nếu hình đặc, thường ta chỉ đổi màu fill, stroke giữ nguyên hoặc bỏ
                activeObject.set({ fill: currentEditorColor });
            } 
            // Nếu là vật thể Rỗng (chỉ có viền) hoặc Mũi tên (Path)
            else {
                activeObject.set({ stroke: currentEditorColor });
            }
            canvas.renderAll(); // Vẽ lại canvas
        }
    });
}

// --- CẬP NHẬT: Các hàm thêm Công cụ (Sử dụng currentEditorColor) ---
const getHollowOptions = () => ({ 
    left: 100, top: 100, strokeWidth: 4, fill: 'transparent', stroke: currentEditorColor 
});
const getFillOptions = () => ({ 
    left: 100, top: 100, fill: currentEditorColor, stroke: 'transparent'
});

document.getElementById('btnAddText').onclick = () => {
    const text = new fabric.IText('Nhập chữ...', {
        left: 100, top: 100, fontFamily: 'Arial', fill: currentEditorColor, fontSize: 26, fontWeight: 'bold'
    });
    canvas.add(text).setActiveObject(text);
};

document.getElementById('btnRectHollow').onclick = () => {
    canvas.add(new fabric.Rect({ ...getHollowOptions(), width: 120, height: 100 }));
};

document.getElementById('btnRectFill').onclick = () => {
    canvas.add(new fabric.Rect({ ...getFillOptions(), width: 120, height: 100 }));
};

document.getElementById('btnCircleHollow').onclick = () => {
    canvas.add(new fabric.Circle({ ...getHollowOptions(), radius: 55 }));
};

document.getElementById('btnCircleFill').onclick = () => {
    canvas.add(new fabric.Circle({ ...getFillOptions(), radius: 55 }));
};

document.getElementById('btnAddArrow').onclick = () => {
    // Vẽ mũi tên bằng Path, sử dụng currentEditorColor cho nét vẽ (stroke)
    const arrow = new fabric.Path('M 0 0 L 70 0 M 70 0 L 52 -18 M 70 0 L 52 18', {
        ...getHollowOptions(), stroke: currentEditorColor, strokeWidth: 5, left: 100, top: 100
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
        if (options.button === 3) { // Chuột phải
            canvas.remove(target); canvas.discardActiveObject(); return;
        }
        pressTimer = setTimeout(() => { // Long press
            canvas.remove(target); canvas.discardActiveObject();
        }, 800); 
    });
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
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

// --- Xuất (Lưu) ảnh và File System Access API ---
let saveDirectoryHandle = null;

document.getElementById('btnSelectSaveDir').addEventListener('click', async () => {
    try {
        saveDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const statusEl = document.getElementById('saveDirStatus');
        statusEl.textContent = `📁 Lưu tại: ${saveDirectoryHandle.name}`;
        statusEl.classList.remove('hidden');
    } catch (error) { console.log('Hủy hoặc không hỗ trợ:', error); }
});

document.getElementById('btnDownload').addEventListener('click', async () => {
    if (!canvas || imageFiles.length === 0) return;
    const finalFileName = `${fileNameInput.value.trim() || 'edited'}_${getFormattedTime()}.png`;
    canvas.discardActiveObject(); canvas.renderAll();
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1 });

    // CÁCH 1: Lưu thẳng vào thư mục (Chrome/Edge)
    if (saveDirectoryHandle) {
        try {
            const blob = await (await fetch(dataURL)).blob();
            const writable = await (await saveDirectoryHandle.getFileHandle(finalFileName, { create: true })).createWritable();
            await writable.write(blob); await writable.close();
            
            const btn = document.getElementById('btnDownload');
            btn.textContent = "✅ Đã lưu xong!"; btn.classList.replace('bg-blue-600', 'bg-green-600');
            setTimeout(() => { btn.textContent = "Lưu ảnh hiện tại"; btn.classList.replace('bg-green-600', 'bg-blue-600'); }, 1000);
            return;
        } catch (err) { console.error("Lỗi ghi file:", err); }
    }

    // CÁCH 2: Fallback - Tải xuống mặc định
    const link = document.createElement('a'); link.href = dataURL; link.download = finalFileName;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
});