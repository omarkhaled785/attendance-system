import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './WorkerDetails.css';

const API_URL = 'http://localhost:3001/api';

function WorkerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [report, setReport] = useState({ attendance: [], summary: {} });
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkerData();
  }, [id, period]);

  const loadWorkerData = async () => {
    try {
      // جلب بيانات العامل
      const workerRes = await fetch(`${API_URL}/workers/${id}`);
      const workerData = await workerRes.json();
      setWorker(workerData);

      // جلب تقرير العامل
      const reportRes = await fetch(`${API_URL}/workers/${id}/report?period=${period}`);
      const reportData = await reportRes.json();
      setReport(reportData);

      setLoading(false);
    } catch (error) {
      console.error('Error loading worker data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">جاري التحميل...</div>;
  }

  if (!worker) {
    return <div className="loading">العامل غير موجود</div>;
  }

  return (
    <div className="worker-details-container">
      <div className="details-header">
        <button onClick={() => navigate(-1)} className="back-btn">
          ← رجوع
        </button>
        <h1>بيانات العامل</h1>
      </div>

      <div className="details-content">
        {/* البيانات الأساسية */}
        <div className="info-card">
          <h2>المعلومات الشخصية</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">الاسم:</span>
              <span className="value">{worker.name}</span>
            </div>
            <div className="info-item">
              <span className="label">العمر:</span>
              <span className="value">{worker.age} سنة</span>
            </div>
            <div className="info-item">
              <span className="label">رقم الهاتف:</span>
              <span className="value">{worker.phone}</span>
            </div>
            <div className="info-item">
              <span className="label">الرقم القومي:</span>
              <span className="value">{worker.national_id}</span>
            </div>
            <div className="info-item">
              <span className="label">تاريخ التعيين:</span>
              <span className="value">
                {new Date(worker.date_joined).toLocaleDateString('ar-EG')}
              </span>
            </div>
          </div>

          {worker.photo && (
            <div className="id-photo">
              <h3>صورة البطاقة</h3>
              <img src={worker.photo} alt="البطاقة الشخصية" />
            </div>
          )}
        </div>

        {/* الإحصائيات */}
        <div className="stats-card">
          <h2>الإحصائيات</h2>
          <div className="period-selector">
            <button
              className={period === 'daily' ? 'active' : ''}
              onClick={() => setPeriod('daily')}
            >
              اليوم
            </button>
            <button
              className={period === 'monthly' ? 'active' : ''}
              onClick={() => setPeriod('monthly')}
            >
              الشهر الحالي
            </button>
            <button
              className={period === 'yearly' ? 'active' : ''}
              onClick={() => setPeriod('yearly')}
            >
              السنة الحالية
            </button>
          </div>

          <div className="stats-summary">
            <div className="stat-box">
              <div className="stat-value">{report.summary.daysWorked || 0}</div>
              <div className="stat-label">أيام العمل</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{report.summary.totalHours || 0}</div>
              <div className="stat-label">إجمالي الساعات</div>
            </div>
          </div>
        </div>

        {/* سجل الحضور */}
        <div className="attendance-card">
          <h2>سجل الحضور</h2>
          {report.attendance.length > 0 ? (
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>وقت الحضور</th>
                  <th>وقت الانصراف</th>
                  <th>عدد الساعات</th>
                </tr>
              </thead>
              <tbody>
                {report.attendance.map((record, index) => (
                  <tr key={index}>
                    <td>{new Date(record.date).toLocaleDateString('ar-EG')}</td>
                    <td>{record.check_in || '--'}</td>
                    <td>{record.check_out || '--'}</td>
                    <td>{record.total_hours || 0} ساعة</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-data">لا يوجد سجل حضور لهذه الفترة</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkerDetails;