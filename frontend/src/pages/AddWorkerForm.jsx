import { useState } from 'react';
import './AddWorkerForm.css';

const API_URL = 'http://localhost:3001/api';

function AddWorkerForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    phone: '',
    national_id: '',
    date_joined: new Date().toLocaleDateString('en-CA'),
    photo: ''
  });
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // التحقق من حجم الملف (أقل من 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 5 ميجابايت');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        // ضغط الصورة
        compressImage(reader.result, (compressed) => {
          setFormData({ ...formData, photo: compressed });
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const compressImage = (base64, callback) => {
    const img = new Image();
    img.src = base64;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // تصغير الحجم لو أكبر من 800px
      const maxSize = 800;
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // تحويل لـ base64 مع ضغط بجودة 0.7
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      callback(compressed);
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // التحقق من البيانات
    if (!formData.name || !formData.age || !formData.phone || !formData.national_id || !formData.date_joined) {
      alert('جميع الحقول مطلوبة');
      return;
    }

    if (formData.national_id.length !== 14) {
      alert('الرقم القومي يجب أن يكون 14 رقم');
      return;
    }

    if (!formData.photo) {
      alert('يرجى إضافة صورة البطاقة');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        alert('تم إضافة العامل بنجاح');
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(`خطأ: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ في إضافة العامل. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>إضافة عامل جديد</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="worker-form">
          <div className="form-group">
            <label>الاسم الكامل *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="أدخل الاسم الكامل"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>العمر *</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="العمر"
                min="18"
                max="65"
                required
              />
            </div>

            <div className="form-group">
              <label>رقم الهاتف *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="01xxxxxxxxx"
                pattern="[0-9]{11}"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>الرقم القومي *</label>
            <input
              type="text"
              value={formData.national_id}
              onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
              placeholder="14 رقم"
              pattern="[0-9]{14}"
              maxLength="14"
              required
            />
          </div>

          <div className="form-group">
            <label>تاريخ التعيين *</label>
            <input
              type="date"
              value={formData.date_joined}
              onChange={(e) => setFormData({ ...formData, date_joined: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>صورة البطاقة الشخصية *</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              required
            />
            <small className="help-text">
              يفضل اختيار صورة أقل من 5 ميجابايت. سيتم ضغط الصورة تلقائياً.
            </small>
            {formData.photo && (
              <div className="image-preview">
                <img src={formData.photo} alt="معاينة" />
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              إلغاء
            </button>
            <button type="submit" className="submit-btn">
              إضافة العامل
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddWorkerForm;