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
      const res = await fetch(`${API_URL}/drivers`);
      const data = await res.json();
      setDrivers(data);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadTrips = async (driverId) => {
    try {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA');
      const endDate = today.toLocaleDateString('en-CA');
      
      const res = await fetch(`${API_URL}/trips/${driverId}?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      setTrips(data);
    } catch (error) {
      console.error('Error loading trips:', error);
    }
  };

  const addTrip = async () => {
    if (!newTrip.to_location) {
      alert('من فضلك أدخل الوجهة');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: selectedDriver,
          ...newTrip
        })
      });

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
      }
    } catch (error) {
      alert('حدث خطأ في إضافة الرحلة');
    }
  };

  const recordTripTime = async (tripId, type) => {
    try {
      const now = new Date().toTimeString().split(' ')[0];
      const res = await fetch(`${API_URL}/trips/${tripId}/time`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, time: now })
      });

      if (res.ok) {
        loadTrips(selectedDriver);
      }
    } catch (error) {
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

  return (
    <div className="drivers-container">
      <div className="drivers-header">
        <button onClick={() => navigate('/')} className="back-btn">
          ← رجوع للصفحة الرئيسية
        </button>
        <h1>🚗 إدارة السواقين والرحلات</h1>
      </div>

      <div className="drivers-content">
        <div className="drivers-sidebar">
          <h3>السواقين</h3>
          <div className="drivers-list">
            {drivers.map(driver => (
              <button
                key={driver.id}
                className={`driver-item ${selectedDriver === driver.id ? 'active' : ''}`}
                onClick={() => setSelectedDriver(driver.id)}
              >
                <span className="driver-name">{driver.name}</span>
                <span className="driver-phone">{driver.phone}</span>
              </button>
            ))}
          </div>
          
          {drivers.length === 0 && (
            <p className="no-drivers">
              لا يوجد سواقين مسجلين<br/>
              يمكنك إضافة سواق من لوحة التحكم
            </p>
          )}
        </div>

        <div className="trips-section">
          {selectedDriver ? (
            <>
              <div className="trips-header">
                <h3>رحلات السائق</h3>
                <button onClick={() => setShowAddTrip(true)} className="add-trip-btn">
                  ➕ إضافة رحلة جديدة
                </button>
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
                    />
                  </div>
                  <div className="form-group">
                    <label>التاريخ:</label>
                    <input
                      type="date"
                      value={newTrip.date}
                      onChange={(e) => setNewTrip({...newTrip, date: e.target.value})}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>ملاحظات:</label>
                    <textarea
                      value={newTrip.notes}
                      onChange={(e) => setNewTrip({...newTrip, notes: e.target.value})}
                      className="input-field"
                      rows="2"
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="no-data">لا توجد رحلات لهذا السائق</p>
                )}
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>اختر سائق لعرض رحلاته</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Drivers;