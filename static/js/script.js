// Khởi tạo biến toàn cục
let currentImage = null;
let stream = null;

// DOM elements
const fileMethod = document.getElementById('file-method');
const cameraMethod = document.getElementById('camera-method');
const urlMethod = document.getElementById('url-method');
const fileInput = document.getElementById('file-input');
const urlInputField = document.getElementById('url-input-field');
const loadUrlBtn = document.getElementById('load-url');
const imagePreview = document.getElementById('image-preview');
const predictBtn = document.getElementById('predict-btn');
const cameraVideo = document.getElementById('camera-video');
const startCameraBtn = document.getElementById('start-camera');
const capturePhotoBtn = document.getElementById('capture-photo');
const stopCameraBtn = document.getElementById('stop-camera');
const loading = document.getElementById('loading');
const predictionResult = document.getElementById('prediction-result');
const errorMessage = document.getElementById('error-message');

// Khởi tạo ứng dụng
async function initApp() {
    try {
        showLoading(true);
        const response = await fetch('http://localhost:8000/health');
        const result = await response.json();
        
        if (result.status !== "ok") {
            throw new Error(result.message || 'Server is not ready');
        }

        showLoading(false);
        showError('Mô hình autoencoder đã sẵn sàng! Bạn có thể bắt đầu tái tạo ảnh.', 'success');
        setTimeout(() => hideError(), 3000);
    } catch (error) {
        showLoading(false);
        showError('Không thể kết nối đến server. Vui lòng kiểm tra lại.');
        console.error('Error initializing app:', error);
    }
}

// Event listeners cho input methods
fileMethod?.addEventListener('click', () => selectInputMethod('file'));
cameraMethod?.addEventListener('click', () => selectInputMethod('camera'));
urlMethod?.addEventListener('click', () => selectInputMethod('url'));

function selectInputMethod(method) {
    // Reset all methods
    document.querySelectorAll('.input-method').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.file-input, .camera-container, #url-input').forEach(i => i.classList.remove('active'));

    // Activate selected method
    if (method === 'file') {
        fileMethod?.classList.add('active');
        document.querySelector('.file-input')?.classList.add('active');
    } else if (method === 'camera') {
        cameraMethod?.classList.add('active');
        document.querySelector('.camera-container')?.classList.add('active');
    } else if (method === 'url') {
        urlMethod?.classList.add('active');
        document.getElementById('url-input')?.classList.add('active');
    }
}

// File input handler
fileInput?.addEventListener('change', handleFileSelect);

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            displayImage(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        showError('Vui lòng chọn file ảnh hợp lệ');
    }
}

// URL input handler
loadUrlBtn?.addEventListener('click', handleUrlLoad);
urlInputField?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUrlLoad();
});

async function handleUrlLoad() {
    const url = urlInputField?.value.trim();
    if (url) {
        try {
            showLoading(true);
            // Tạo img element để load ảnh từ URL
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                // Chuyển đổi image thành canvas rồi thành data URL
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const dataURL = canvas.toDataURL('image/png');
                displayImage(dataURL);
                showLoading(false);
            };
            
            img.onerror = () => {
                showLoading(false);
                showError('Không thể tải ảnh từ URL này');
            };
            
            img.src = url;
        } catch (error) {
            showLoading(false);
            showError('Không thể tải ảnh từ URL này');
            console.error('URL load error:', error);
        }
    }
}

// Camera handlers
startCameraBtn?.addEventListener('click', startCamera);
capturePhotoBtn?.addEventListener('click', capturePhoto);
stopCameraBtn?.addEventListener('click', stopCamera);

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cameraVideo) {
            cameraVideo.srcObject = stream;
            cameraVideo.play();
        }
        
        if (startCameraBtn) startCameraBtn.disabled = true;
        if (capturePhotoBtn) capturePhotoBtn.disabled = false;
        if (stopCameraBtn) stopCameraBtn.disabled = false;
    } catch (error) {
        showError('Không thể truy cập camera');
        console.error('Camera error:', error);
    }
}

function capturePhoto() {
    if (!cameraVideo) return;
    
    const canvas = document.getElementById('hidden-canvas') || document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = cameraVideo.videoWidth || 640;
    canvas.height = cameraVideo.videoHeight || 480;

    context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL('image/jpeg');
    displayImage(dataURL);
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (cameraVideo) {
        cameraVideo.srcObject = null;
    }
    
    if (startCameraBtn) startCameraBtn.disabled = false;
    if (capturePhotoBtn) capturePhotoBtn.disabled = true;
    if (stopCameraBtn) stopCameraBtn.disabled = true;
}

// Display image
function displayImage(src) {
    const img = document.createElement('img');
    img.src = src;
    img.onload = () => {
        if (imagePreview) {
            imagePreview.innerHTML = '';
            imagePreview.appendChild(img);
        }
        currentImage = img;
        if (predictBtn) {
            predictBtn.disabled = false;
            predictBtn.textContent = 'Tái tạo ảnh';
        }
        hideError();
    };
    
    img.onerror = () => {
        showError('Không thể hiển thị ảnh');
    };
}

// Image reconstruction
predictBtn?.addEventListener('click', makeReconstruction);

async function makeReconstruction() {
    if (!currentImage) {
        showError('Vui lòng chọn ảnh');
        return;
    }

    showLoading(true);
    hidePredictionResult();

    try {
        const reconstructedImage = await reconstructImage(currentImage);
        if (reconstructedImage) {
            displayReconstructedImage(reconstructedImage);
            showPredictionResult();
        } else {
            showError('Không thể tái tạo ảnh này');
        }
        showLoading(false);
    } catch (error) {
        showLoading(false);
        showError('Lỗi khi tái tạo ảnh: ' + error.message);
        console.error('Reconstruction error:', error);
    }
}

async function reconstructImage(img) {
    try {
        // Tạo canvas để resize ảnh về 32x32
        const canvas = document.getElementById('hidden-canvas') || document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);

        const imageData = canvas.toDataURL('image/png');

        const response = await fetch('http://localhost:8000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        console.log('Reconstruction result:', result);
        return result.reconstructed_image;
        
    } catch (error) {
        console.error('Error reconstructing:', error);
        throw error;
    }
}

function displayReconstructedImage(reconstructedImageBase64) {
    // Tìm hoặc tạo container để hiển thị ảnh tái tạo
    let resultContainer = document.getElementById('reconstruction-result');
    if (!resultContainer) {
        resultContainer = document.createElement('div');
        resultContainer.id = 'reconstruction-result';
        resultContainer.className = 'reconstruction-result';
        
        // Thêm vào prediction result hoặc tạo mới
        if (predictionResult) {
            predictionResult.appendChild(resultContainer);
        } else {
            document.body.appendChild(resultContainer);
        }
    }

    // Tạo HTML để hiển thị ảnh gốc và ảnh tái tạo
    resultContainer.innerHTML = `
        <h3>Kết quả tái tạo ảnh</h3>
        <div class="image-comparison">
            <div class="image-container">
                <h4>Ảnh gốc (32x32)</h4>
                <div class="original-image"></div>
            </div>
            <div class="image-container">
                <h4>Ảnh tái tạo</h4>
                <div class="reconstructed-image">
                    <img src="data:image/png;base64,${reconstructedImageBase64}" alt="Reconstructed Image" />
                </div>
            </div>
        </div>
    `;

    // Hiển thị ảnh gốc đã resize về 32x32
    const originalContainer = resultContainer.querySelector('.original-image');
    if (originalContainer && currentImage) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 32;
        canvas.height = 32;
        canvas.style.width = '128px';
        canvas.style.height = '128px';
        canvas.style.imageRendering = 'pixelated';
        
        ctx.drawImage(currentImage, 0, 0, 32, 32);
        originalContainer.appendChild(canvas);
    }

    // Style cho ảnh tái tạo
    const reconstructedImg = resultContainer.querySelector('.reconstructed-image img');
    if (reconstructedImg) {
        reconstructedImg.style.width = '128px';
        reconstructedImg.style.height = '128px';
        reconstructedImg.style.imageRendering = 'pixelated';
    }
}

// Utility functions
function showLoading(show) {
    if (loading) {
        loading.classList.toggle('active', show);
    }
}

function showPredictionResult() {
    if (predictionResult) {
        predictionResult.classList.add('active');
    }
}

function hidePredictionResult() {
    if (predictionResult) {
        predictionResult.classList.remove('active');
    }
}

function showError(message, type = 'error') {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('success', 'error');
        errorMessage.classList.add('active', type);
    }
}

function hideError() {
    if (errorMessage) {
        errorMessage.classList.remove('active');
    }
}

// Tạo hidden canvas nếu chưa có
function createHiddenCanvas() {
    if (!document.getElementById('hidden-canvas')) {
        const canvas = document.createElement('canvas');
        canvas.id = 'hidden-canvas';
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
    }
}

// Thêm CSS cho image comparison
function addReconstructionStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .reconstruction-result {
            margin-top: 20px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #f9f9f9;
        }

        .image-comparison {
            display: flex;
            justify-content: space-around;
            align-items: center;
            gap: 20px;
            margin-top: 15px;
        }

        .image-container {
            text-align: center;
            flex: 1;
        }

        .image-container h4 {
            margin-bottom: 10px;
            color: #333;
            font-size: 14px;
        }

        .original-image, .reconstructed-image {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 10px;
            background-color: white;
            display: inline-block;
        }

        .reconstructed-image img {
            display: block;
        }

        @media (max-width: 768px) {
            .image-comparison {
                flex-direction: column;
                gap: 15px;
            }
        }
    `;
    document.head.appendChild(style);
}

// Khởi tạo ứng dụng khi trang tải xong
window.addEventListener('load', () => {
    createHiddenCanvas();
    addReconstructionStyles();
    initApp();
});