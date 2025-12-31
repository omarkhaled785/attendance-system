import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Drivers.css';
import API_URL from '../config';

function Drivers() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [trips, setTrips] = useState([]);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // New states for all trips view
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [allTrips, setAllTrips] = useState([]);
  const [loadingAllTrips, setLoadingAllTrips] = useState(false);
  
  const [newTrip, setNewTrip] = useState({
    from_location: 'مكان العمل',
    to_location: '',
    date: new Date().toLocaleDateString('en-CA'),
    notes: ''
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    if (selectedDriver) {
      loadTrips(selectedDriver);
    }
  }, [selectedDriver]);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_URL}/drivers`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const driverWorkers = await res.json();
      
      console.log('Loaded drivers:', driverWorkers);
      
      setDrivers(driverWorkers);
      
      // Auto-select first driver if available
      if (driverWorkers.length > 0 && !selectedDriver) {
        setSelectedDriver(driverWorkers[0].id);
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
      setError('حدث خطأ في تحميل السواقين: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTrips = async (driverId) => {
    try {
      setError('');
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA');
      const endDate = today.toLocaleDateString('en-CA');
      
      const res = await fetch(`${API_URL}/trips/${driverId}?startDate=${startDate}&endDate=${endDate}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('Loaded trips:', data);
      setTrips(data);
    } catch (error) {
      console.error('Error loading trips:', error);
      setError('حدث خطأ في تحميل الرحلات: ' + error.message);
      setTrips([]);
    }
  };

  // Function to load all trips for current month
  const loadAllTrips = async () => {
    try {
      setLoadingAllTrips(true);
      setError('');
      
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA');
      const endDate = today.toLocaleDateString('en-CA');
      
      // First get all drivers
      const driversRes = await fetch(`${API_URL}/drivers`);
      const driversData = await driversRes.json();
      
      // Load trips for all drivers
      const allTripsData = [];
      
      for (const driver of driversData) {
        const tripsRes = await fetch(`${API_URL}/trips/${driver.id}?startDate=${startDate}&endDate=${endDate}`);
        const driverTrips = await tripsRes.json();
        
        driverTrips.forEach(trip => {
          allTripsData.push({
            ...trip,
            driver_name: driver.name,
            driver_phone: driver.phone
          });
        });
      }
      
      setAllTrips(allTripsData);
      setShowAllTrips(true);
    } catch (error) {
      console.error('Error loading all trips:', error);
      setError('حدث خطأ في تحميل جميع الرحلات: ' + error.message);
    } finally {
      setLoadingAllTrips(false);
    }
  };

  const addTrip = async () => {
    if (!newTrip.to_location) {
      alert('من فضلك أدخل الوجهة');
      return;
    }

    if (!selectedDriver) {
      alert('من فضلك اختر سائقاً أولاً');
      return;
    }

    try {
      setError('');
      const res = await fetch(`${API_URL}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: selectedDriver,
          ...newTrip
        })
      });

      const result = await res.json();
      
      if (res.ok) {
        alert('تم إضافة الرحلة بنجاح');
        setShowAddTrip(false);
        setNewTrip({
          from_location: 'مكان العمل',
          to_location: '',
          date: new Date().toLocaleDateString('en-CA'),
          notes: ''
        });
        loadTrips(selectedDriver);
      } else {
        throw new Error(result.error || 'فشل إضافة الرحلة');
      }
    } catch (error) {
      console.error('Error adding trip:', error);
      alert(`حدث خطأ في إضافة الرحلة: ${error.message}`);
    }
  };

  const recordTripTime = async (tripId, type) => {
    try {
      setError('');
      const now = new Date().toTimeString().split(' ')[0];
      const res = await fetch(`${API_URL}/trips/${tripId}/time`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, time: now })
      });

      const result = await res.json();
      
      if (res.ok) {
        loadTrips(selectedDriver);
      } else {
        throw new Error(result.error || 'فشل تسجيل الوقت');
      }
    } catch (error) {
      console.error('Error recording time:', error);
      alert(`حدث خطأ في تسجيل الوقت: ${error.message}`);
    }
  };

  // Function to delete trip
  const deleteTrip = async (tripId, tripDetails) => {
    if (!confirm(`هل أنت متأكد من حذف هذه الرحلة؟\nمن: ${tripDetails.from_location} إلى: ${tripDetails.to_location}\nالتاريخ: ${tripDetails.date}`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/trips/${tripId}`, {
        method: 'DELETE'
      });
      
      const result = await res.json();
      
      if (res.ok) {
        alert('تم حذف الرحلة بنجاح');
        loadTrips(selectedDriver);
      } else {
        throw new Error(result.error || 'فشل حذف الرحلة');
      }
    } catch (error) {
      console.error('Error deleting trip:', error);
      alert(`حدث خطأ في حذف الرحلة: ${error.message}`);
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

  const addDriverFromDashboard = () => {
    navigate('/dashboard');
    // Show a message about how to add drivers
    setTimeout(() => {
      alert('لإضافة سائق جديد:\n1. اضغط على زر "إضافة عامل"\n2. اختر "سواق" كوظيفة\n3. املأ باقي البيانات\n4. احفظ');
    }, 500);
  };

  if (loading) {
    return (
      <div className="drivers-container">
        <div className="drivers-header">
          <button onClick={() => navigate('/')} className="back-btn">
            ← رجوع للصفحة الرئيسية
          </button>
          <h1>🚗 إدارة السواقين والرحلات</h1>
        </div>
        <div className="loading">جاري تحميل السواقين...</div>
      </div>
    );
  }

  return (
    <div className="drivers-container">
      <div className="drivers-header">
        <button onClick={() => navigate('/')} className="back-btn">
          ← رجوع للصفحة الرئيسية
        </button>
        <h1>🚗 إدارة السواقين والرحلات</h1>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      <div className="drivers-content">
        <div className="drivers-sidebar">
          <div className="sidebar-header">
            <h3>السواقين ({drivers.length})</h3>
            <button 
              onClick={addDriverFromDashboard}
              className="add-driver-btn"
              title="إضافة سائق جديد من لوحة التحكم"
            >
              + إضافة سائق
            </button>
          </div>
          
          <div className="drivers-list">
            {drivers.map(driver => (
              <button
                key={driver.id}
                className={`driver-item ${selectedDriver === driver.id ? 'active' : ''}`}
                onClick={() => setSelectedDriver(driver.id)}
              >
                <span className="driver-name">{driver.name}</span>
                <span className="driver-phone">{driver.phone}</span>
                {driver.license_number && (
                  <span className="driver-license">رخصة: {driver.license_number}</span>
                )}
              </button>
            ))}
          </div>
          
          {drivers.length === 0 && (
            <div className="no-drivers">
              <p>لا يوجد سواقين مسجلين</p>
              <p className="help-text">لإضافة سائق:</p>
              <ol className="instructions">
                <li>اذهب إلى لوحة التحكم (زر أدمن أسفل الصفحة)</li>
                <li>اضغط على "إضافة عامل"</li>
                <li>اختر "سواق" كوظيفة</li>
                <li>املأ باقي البيانات واحفظ</li>
              </ol>
              <button onClick={() => navigate('/dashboard')} className="go-to-dashboard-btn">
                الذهاب للوحة التحكم
              </button>
            </div>
          )}
        </div>

        <div className="trips-section">
          {selectedDriver ? (
            <>
              <div className="trips-header">
                <h3>رحلات السائق</h3>
                <div className="trips-header-actions">
                  <button onClick={() => setShowAddTrip(true)} className="add-trip-btn">
                    ➕ إضافة رحلة جديدة
                  </button>
                  <button onClick={loadAllTrips} className="all-trips-btn">
                    🚗 جميع الرحلات
                  </button>
                </div>
              </div>

              {showAddTrip && (
                <div className="add-trip-form">
                  <h4>رحلة جديدة</h4>
                  <div className="form-group">
                    <label>من:</label>
                    <input
                      type="text"
                      value={newTrip.from_location}
                      onChange={(e) => setNewTrip({...newTrip, from_location: e.target.value})}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>إلى:</label>
                    <input
                      type="text"
                      value={newTrip.to_location}
                      onChange={(e) => setNewTrip({...newTrip, to_location: e.target.value})}
                      className="input-field"
                      placeholder="الوجهة"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>التاريخ:</label>
                    <input
                      type="date"
                      value={newTrip.date}
                      onChange={(e) => setNewTrip({...newTrip, date: e.target.value})}
                      className="input-field"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>ملاحظات:</label>
                    <textarea
                      value={newTrip.notes}
                      onChange={(e) => setNewTrip({...newTrip, notes: e.target.value})}
                      className="input-field"
                      rows="2"
                      placeholder="تفاصيل الرحلة"
                    />
                  </div>
                  <div className="form-actions">
                    <button onClick={() => setShowAddTrip(false)} className="cancel-btn">
                      إلغاء
                    </button>
                    <button onClick={addTrip} className="submit-btn">
                      إضافة
                    </button>
                  </div>
                </div>
              )}

              <div className="trips-list">
                {trips.length > 0 ? (
                  <table className="trips-table">
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>من</th>
                        <th>إلى</th>
                        <th>وقت البداية</th>
                        <th>وقت النهاية</th>
                        <th>ملاحظات</th>
                        <th>الحالة</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map(trip => (
                        <tr key={trip.id}>
                          <td>{new Date(trip.date).toLocaleDateString('ar-EG')}</td>
                          <td>{trip.from_location}</td>
                          <td>{trip.to_location}</td>
                          <td>
                            {trip.start_time ? (
                              <span className="recorded-time">{formatTime12Hour(trip.start_time)}</span>
                            ) : (
                              <button
                                onClick={() => recordTripTime(trip.id, 'start')}
                                className="time-btn"
                              >
                                تسجيل البداية
                              </button>
                            )}
                          </td>
                          <td>
                            {trip.end_time ? (
                              <span className="recorded-time">{formatTime12Hour(trip.end_time)}</span>
                            ) : (
                              <button
                                onClick={() => recordTripTime(trip.id, 'end')}
                                className="time-btn"
                                disabled={!trip.start_time}
                              >
                                تسجيل النهاية
                              </button>
                            )}
                          </td>
                          <td>{trip.notes || '--'}</td>
                          <td>
                            <span className={`status-badge ${trip.end_time ? 'completed' : trip.start_time ? 'in-progress' : 'pending'}`}>
                              {trip.end_time ? 'مكتملة' : trip.start_time ? 'جارية' : 'معلقة'}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => deleteTrip(trip.id, trip)}
                              className="delete-trip-btn"
                              title="حذف الرحلة"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-trips">
                    <p>لا توجد رحلات لهذا السائق في الشهر الحالي</p>
                    <button onClick={() => setShowAddTrip(true)} className="add-first-trip-btn">
                      ➕ إضافة أول رحلة
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="no-selection">
              {drivers.length > 0 ? (
                <p>اختر سائقاً لعرض رحلاته</p>
              ) : (
                <div className="empty-state">
                  <p>لا يوجد سواقين مسجلين</p>
                  <p>لإضافة سائق، اذهب إلى لوحة التحكم وأضف عاملاً جديداً مع اختيار "سواق" كوظيفة</p>
                  <button onClick={() => navigate('/dashboard')} className="primary-btn">
                    الذهاب للوحة التحكم
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* All Trips Modal */}
      {showAllTrips && (
        <div className="modal-overlay" onClick={() => setShowAllTrips(false)}>
          <div className="modal-content wide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>جميع الرحلات لهذا الشهر</h2>
              <button className="close-btn" onClick={() => setShowAllTrips(false)}>×</button>
            </div>
            <div className="modal-body">
              {loadingAllTrips ? (
                <div className="loading">جاري تحميل الرحلات...</div>
              ) : allTrips.length > 0 ? (
                <table className="trips-table">
                  <thead>
                    <tr>
                      <th>السائق</th>
                      <th>رقم الهاتف</th>
                      <th>التاريخ</th>
                      <th>من</th>
                      <th>إلى</th>
                      <th>وقت البداية</th>
                      <th>وقت النهاية</th>
                      <th>ملاحظات</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTrips.map(trip => (
                      <tr key={trip.id}>
                        <td>{trip.driver_name}</td>
                        <td>{trip.driver_phone}</td>
                        <td>{new Date(trip.date).toLocaleDateString('ar-EG')}</td>
                        <td>{trip.from_location}</td>
                        <td>{trip.to_location}</td>
                        <td>{trip.start_time ? formatTime12Hour(trip.start_time) : '--'}</td>
                        <td>{trip.end_time ? formatTime12Hour(trip.end_time) : '--'}</td>
                        <td>{trip.notes || '--'}</td>
                        <td>
                          <span className={`status-badge ${trip.end_time ? 'completed' : trip.start_time ? 'in-progress' : 'pending'}`}>
                            {trip.end_time ? 'مكتملة' : trip.start_time ? 'جارية' : 'معلقة'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>لا توجد رحلات لهذا الشهر</p>
              )}
              <div className="form-actions">
                <button onClick={() => setShowAllTrips(false)} className="cancel-btn">
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Drivers;