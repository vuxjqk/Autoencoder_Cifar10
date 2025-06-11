from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from tensorflow.keras.models import load_model
import numpy as np
import base64
from io import BytesIO
from PIL import Image

app = Flask(__name__)
CORS(app)

# Load model with error handling
try:
    model = load_model('autoencoder_cifar10_best.keras')
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

# CIFAR-10 class names
class_names = [
    'máy bay', 'ô tô', 'chim', 'mèo', 'hươu',
    'chó', 'ếch', 'ngựa', 'tàu', 'xe tải'
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health', methods=['GET'])
def health_check():
    if model is None:
        return jsonify({'status': 'error', 'message': 'Model not loaded'}), 500
    return jsonify({'status': 'ok'})

@app.route('/predict', methods=['POST'])
def predict():
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
            
        data = request.json['image']

        # Giải mã ảnh từ Base64
        image_data = base64.b64decode(data.split(',')[1])
        image = Image.open(BytesIO(image_data)).convert('RGB').resize((32, 32))

        # Chuyển đổi ảnh thành numpy array
        input_data = np.array(image) / 255.0  # Chuẩn hóa
        input_data = np.expand_dims(input_data, axis=0)  # Thêm batch dimension

        # Dự đoán với mô hình
        prediction = model.predict(input_data)
        
        # Chuyển đổi ảnh tái tạo về định dạng 0-255 và sang PIL Image
        # Đảm bảo giá trị nằm trong khoảng [0, 1] trước khi nhân 255
        prediction = np.clip(prediction, 0, 1) * 255
        prediction = prediction.astype(np.uint8)

        # Loại bỏ chiều batch (1, 32, 32, 3) -> (32, 32, 3)
        prediction_img = Image.fromarray(prediction[0])

        # Lưu ảnh tái tạo vào buffer và encode thành base64 string
        buffered = BytesIO()
        prediction_img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return jsonify({'reconstructed_image': img_str})

    except Exception as e:
        print(f"Error in prediction: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=8000, debug=True)