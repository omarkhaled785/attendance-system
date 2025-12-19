import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Workers.css';

const API_URL = 'http://localhost:3001/api';

function Workers() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    loadWorkersAttendance();
    // تحديث تلقائي كل 30 ثانية
    const interval = setInterval(loadWorkersAttendance, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadWorkersAttendance = async () => {
    try {
      const res = await fetch(`${API_URL}/attendance/today`);
      const data = await res.json();
      setWorkers(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading workers:', error);
      setLoading(false);
    }
  };

  const recordTime = async (workerId, type) => {
    try {
      const res = await fetch(`${API_URL}/attendance/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, type })
      });
      
      const data = await res.json();
      
      if (data.success) {
        loadWorkersAttendance();
      } else {
        alert(data.error || 'حدث خطأ في تسجيل الوقت');
      }
    } catch (error) {
      console.error('Error recording time:', error);
      alert('حدث خطأ في تسجيل الوقت');
    }
  };

  const formatTime = (time) => {
    if (!time) return '--:--';
    return time.substring(0, 5); // HH:MM
  };

  const resetTodayData = async () => {
    if (!confirm('هل أنت متأكد من إعادة تعيين بيانات اليوم؟\nسيتم حذف جميع التسجيلات لليوم الحالي فقط')) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/attendance/reset-today`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        alert('تم إعادة تعيين البيانات بنجاح');
        loadWorkersAttendance();
      }
    } catch (error) {
      console.error('Error resetting data:', error);
      alert('حدث خطأ في إعادة التعيين');
    }
  };

  if (loading) {
    return <div className="loading">جاري التحميل...</div>;
  }

  return (
    <div className="workers-container">
      <div className="header">
        <h1>نظام الحضور والانصراف</h1>
        <div className="current-date">
          {new Date().toLocaleDateString('ar-EG', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      <div className="workers-table-container">
        <div className="info-box">
          <div 
            className="info-header" 
            onClick={() => setShowInstructions(!showInstructions)}
          >
            <h3>📋 تعليمات التسجيل</h3>
            <span className={`arrow ${showInstructions ? 'open' : ''}`}>▼</span>
          </div>
          
          {showInstructions && (
            <ul className="info-list">
              <li>✅ سجل الحضور عند الوصول</li>
              <li>🍽️ سجل خروج ودخول الغدا (اختياري)</li>
              <li>⚠️ لو سجلت خروج غدا، لازم تسجل الرجوع قبل الانصراف</li>
              <li>🏁 سجل الانصراف عند المغادرة</li>
              <li>⏰ يتم حساب ساعات العمل تلقائياً (بدون وقت الغدا)</li>
            </ul>
          )}
        </div>
        
        <table className="workers-table">
          <thead>
            <tr>
              <th>اسم العامل</th>
              <th>تسجيل الحضور</th>
              <th>خروج الغدا</th>
              <th>دخول الغدا</th>
              <th>تسجيل الانصراف</th>
              <th>إجمالي الساعات</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.id}>
                <td className="worker-name">
                  <button 
                    onClick={() => navigate(`/worker/${worker.id}`)}
                    className="worker-name-btn"
                  >
                    {worker.name}
                  </button>
                </td>
                
                <td>
                  <button
                    className={`time-btn ${worker.check_in ? 'recorded' : ''}`}
                    onClick={() => recordTime(worker.id, 'check_in')}
                    disabled={worker.check_in}
                  >
                    {worker.check_in ? formatTime(worker.check_in) : 'تسجيل'}
                  </button>
                </td>

                <td>
                  <button
                    className={`time-btn ${worker.lunch_out ? 'recorded' : ''}`}
                    onClick={() => recordTime(worker.id, 'lunch_out')}
                    disabled={!worker.check_in || worker.lunch_out}
                  >
                    {worker.lunch_out ? formatTime(worker.lunch_out) : 'تسجيل'}
                  </button>
                </td>

                <td>
                  <button
                    className={`time-btn ${worker.lunch_in ? 'recorded' : ''}`}
                    onClick={() => recordTime(worker.id, 'lunch_in')}
                    disabled={!worker.lunch_out || worker.lunch_in}
                  >
                    {worker.lunch_in ? formatTime(worker.lunch_in) : 'تسجيل'}
                  </button>
                </td>

                <td>
                  <button
                    className={`time-btn ${worker.check_out ? 'recorded' : ''}`}
                    onClick={() => recordTime(worker.id, 'check_out')}
                    disabled={
                      !worker.check_in || 
                      (worker.lunch_out && !worker.lunch_in) ||
                      worker.check_out
                    }
                    title={
                      !worker.check_in 
                        ? 'يجب تسجيل الحضور أولاً' 
                        : (worker.lunch_out && !worker.lunch_in)
                        ? 'يجب تسجيل العودة من الغدا أولاً'
                        : ''
                    }
                  >
                    {worker.check_out ? formatTime(worker.check_out) : 'تسجيل'}
                  </button>
                </td>

                <td className="total-hours">
                  {worker.total_hours ? `${worker.total_hours} ساعة` : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="footer">
        <button onClick={resetTodayData} className="reset-btn">
          🔄 إعادة تعيين بيانات اليوم
        </button>
        
        <a href="/dashboard" className="admin-link">
          دخول لوحة التحكم (أدمن)
        </a>
      </div>
    </div>
  );
}

export default Workers;