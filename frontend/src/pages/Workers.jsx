import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Workers.css';
import API_URL from '../config';

function Workers() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [filteredWorkers, setFilteredWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [workersPerPage] = useState(6); // Show 6 workers per page

  useEffect(() => {
    loadWorkersAttendance();
    const interval = setInterval(loadWorkersAttendance, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Filter workers based on search term
    if (searchTerm.trim() === '') {
      setFilteredWorkers(workers);
    } else {
      const filtered = workers.filter(worker =>
        worker.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredWorkers(filtered);
    }
    setCurrentPage(1); // Reset to first page when search changes
  }, [searchTerm, workers]);

  // Calculate pagination
  const indexOfLastWorker = currentPage * workersPerPage;
  const indexOfFirstWorker = indexOfLastWorker - workersPerPage;
  const currentWorkers = filteredWorkers.slice(indexOfFirstWorker, indexOfLastWorker);
  const totalPages = Math.ceil(filteredWorkers.length / workersPerPage);

  // Navigation functions
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    };
  };

  const goToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const loadWorkersAttendance = async () => {
    try {
      const res = await fetch(`${API_URL}/attendance/today`);
      const data = await res.json();
      setWorkers(data);
      setFilteredWorkers(data);
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

  const formatTime12Hour = (time) => {
    if (!time) return '--:--';
    
    const [hours24, minutes] = time.substring(0, 5).split(':');
    let hours = parseInt(hours24);
    const period = hours >= 12 ? 'م' : 'ص';
    
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    
    return `${hours}:${minutes} ${period}`;
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
        {/* Search Bar */}
        <div className="search-container">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 بحث عن عامل بالاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="clear-search"
                title="مسح البحث"
              >
                ✕
              </button>
            )}
          </div>
          <div className="search-info">
            <span className="worker-count">
              العدد: {filteredWorkers.length} من {workers.length}
            </span>
            {searchTerm && filteredWorkers.length === 0 && (
              <span className="no-results">لا توجد نتائج لـ "{searchTerm}"</span>
            )}
          </div>
        </div>

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
              <li>🍽️ سجل خروج ودخول الغداء (اختياري)</li>
              <li>⚠️ لو سجلت خروج غداء، لازم تسجل الرجوع قبل الانصراف</li>
              <li>🏠 سجل الانصراف عند المغادرة</li>
              <li>⏰ يتم حساب ساعات العمل تلقائياً (بدون وقت الغداء)</li>
            </ul>
          )}
        </div>
        
        <table className="workers-table">
          <thead>
            <tr>
              <th>اسم العامل</th>
              <th>الوظيفة</th>
              <th>تسجيل الحضور</th>
              <th>خروج الغداء</th>
              <th>دخول الغداء</th>
              <th>تسجيل الانصراف</th>
              <th>إجمالي الساعات</th>
            </tr>
          </thead>
          <tbody>
            {currentWorkers.map((worker) => (
              <tr key={worker.id}>
                <td className="worker-name">
                  <button 
                    onClick={() => navigate(`/worker/${worker.id}`)}
                    className="worker-name-btn"
                  >
                    {worker.name}
                  </button>
                </td>
                
                <td className="job-title">{worker.job_title || 'عامل'}</td>
                
                <td>
                  <button
                    className={`time-btn ${worker.check_in ? 'recorded' : ''}`}
                    onClick={() => recordTime(worker.id, 'check_in')}
                    disabled={worker.check_in}
                  >
                    {worker.check_in ? formatTime12Hour(worker.check_in) : 'تسجيل'}
                  </button>
                </td>

                <td>
                  <button
                    className={`time-btn ${worker.lunch_out ? 'recorded' : ''}`}
                    onClick={() => recordTime(worker.id, 'lunch_out')}
                    disabled={!worker.check_in || worker.lunch_out}
                  >
                    {worker.lunch_out ? formatTime12Hour(worker.lunch_out) : 'تسجيل'}
                  </button>
                </td>

                <td>
                  <button
                    className={`time-btn ${worker.lunch_in ? 'recorded' : ''}`}
                    onClick={() => recordTime(worker.id, 'lunch_in')}
                    disabled={!worker.lunch_out || worker.lunch_in}
                  >
                    {worker.lunch_in ? formatTime12Hour(worker.lunch_in) : 'تسجيل'}
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
                        ? 'يجب تسجيل العودة من الغداء أولاً'
                        : ''
                    }
                  >
                    {worker.check_out ? formatTime12Hour(worker.check_out) : 'تسجيل'}
                  </button>
                </td>

                <td className="total-hours">
                  {worker.total_hours ? `${worker.total_hours} ساعة` : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination-controls">
            <button 
              onClick={prevPage} 
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              السابق
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                <button
                  key={number}
                  onClick={() => goToPage(number)}
                  className={`page-number ${currentPage === number ? 'active' : ''}`}
                >
                  {number}
                </button>
              ))}
            </div>
            
            <button 
              onClick={nextPage} 
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              التالي
            </button>
          </div>
        )}
      </div>

      <div className="footer">
        <button onClick={resetTodayData} className="reset-btn">
          🔄 إعادة تعيين بيانات اليوم
        </button>
        
        <button 
          onClick={() => navigate('/drivers')} 
          className="drivers-link"
        >
          🚗 إدارة السواقين والرحلات
        </button>
        
        <button 
          onClick={() => navigate('/dashboard')} 
          className="admin-link"
        >
          👨‍💼 دخول لوحة التحكم (أدمن)
        </button>
      </div>
    </div>
  );
}

export default Workers;