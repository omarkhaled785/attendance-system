import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DriverTrips.css';
import API_URL from '../config';

function DriverTrips() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showTripModal, setShowTripModal] = useState(false);
  const [todayTrips, setTodayTrips] = useState([]);
  const [tripData, setTripData] = useState({
    fromLocation: 'مكان العمل',
    toLocation: '',
    departureTime: '',
    arrivalTime: '',
    date: new Date().toLocaleDateString('en-CA'),
    notes: ''
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    if (selectedDriver) {
      loadTodayTrips(selectedDriver.id);
    }
  }, [selectedDriver]);

  const loadDrivers = async () => {
    try {
      const res = await fetch(`${API_URL}/workers/drivers`);
      const data = await res.json();
      setDrivers(data);
      if (data.length > 0) {
        setSelectedDriver(data[0]);
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadTodayTrips = async (driverId) => {
    try {
      const res = await fetch(`${API_URL}/driver-trips/today/${driverId}`);
      const data = await res.json();
      setTodayTrips(data);
    } catch (error) {
      console.error('Error loading trips:', error);
    }
  };

  const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleRecordTime = (type) => {
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0].substring(0, 5);
    
    if (type === 'departure') {
      setTripData({ ...tripData, departureTime: timeString });
    } else if (type === 'arrival') {
      setTripData({ ...tripData, arrivalTime: timeString });
    }
  };

  const handleSubmitTrip = async (e) => {
    e.preventDefault();

    if (!tripData.toLocation) {
      alert('يرجى إدخال وجهة الرحلة');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/driver-trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: selectedDriver.id,
          fromLocation: tripData.fromLocation,
          toLocation: tripData.toLocation,
          departureTime: tripData.departureTime,
          arrivalTime: tripData.arrivalTime,
          date: tripData.date,
          notes: tripData.notes
        })
      });

      if (res.ok) {
        alert('تم تسجيل الرحلة بنجاح');
        setShowTripModal(false);
        setTripData({
          fromLocation: 'مكان العمل',
          toLocation: '',
          departureTime: '',
          arrivalTime: '',
          date: new Date().toLocaleDateString('en-CA'),
          notes: ''
        });
        loadTodayTrips(selectedDriver.id);
      }
    } catch (error) {
      console.error('Error recording trip:', error);
      alert('حدث خطأ في تسجيل الرحلة');
    }
  };

  return (
    <div className="driver-trips-container">
      <div className="header">
        <h1>🚗 إدارة رحلات السائقين</h1>
        <button onClick={() => navigate('/')} className="back-btn">
          العودة للصفحة الرئيسية
        </button>
      </div>

      <div className="driver-selection">
        <h3>اختر السائق:</h3>
        <div className="driver-buttons">
          {drivers.map(driver => (
            <button
              key={driver.id}
              className={`driver-btn ${selectedDriver?.id === driver.id ? 'active' : ''}`}
              onClick={() => setSelectedDriver(driver)}
            >
              {driver.name}
            </button>
          ))}
        </div>
      </div>

      {selectedDriver && (
        <>
          <div className="trip-actions">
            <button 
              onClick={() => setShowTripModal(true)}
              className="new-trip-btn"
            >
              ➕ رحلة جديدة
            </button>
          </div>

          <div className="today-trips">
            <h3>رحلات اليوم - {selectedDriver.name}</h3>
            {todayTrips.length > 0 ? (
              <table className="trips-table">
                <thead>
                  <tr>
                    <th>من</th>
                    <th>إلى</th>
                    <th>وقت المغادرة</th>
                    <th>وقت الوصول</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {todayTrips.map(trip => (
                    <tr key={trip.id}>
                      <td>{trip.from_location}</td>
                      <td>{trip.to_location}</td>
                      <td>{trip.departure_time ? formatTime12Hour(trip.departure_time) : '--'}</td>
                      <td>{trip.arrival_time ? formatTime12Hour(trip.arrival_time) : '--'}</td>
                      <td>{trip.notes || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-data">لا توجد رحلات لليوم</p>
            )}
          </div>
        </>
      )}

      {showTripModal && (
        <div className="modal-overlay" onClick={() => setShowTripModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تسجيل رحلة جديدة</h2>
              <button className="close-btn" onClick={() => setShowTripModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmitTrip} className="trip-form">
              <div className="form-group">
                <label>السائق</label>
                <input
                  type="text"
                  value={selectedDriver?.name}
                  disabled
                  className="input-field"
                />
              </div>

              <div className="form-group">
                <label>من (نقطة الانطلاق) *</label>
                <input
                  type="text"
                  value={tripData.fromLocation}
                  onChange={(e) => setTripData({ ...tripData, fromLocation: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div className="form-group">
                <label>إلى (الوجهة) *</label>
                <input
                  type="text"
                  value={tripData.toLocation}
                  onChange={(e) => setTripData({ ...tripData, toLocation: e.target.value })}
                  className="input-field"
                  placeholder="أدخل اسم الموقع"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>وقت المغادرة</label>
                  <div className="time-input-group">
                    <input
                      type="time"
                      value={tripData.departureTime}
                      onChange={(e) => setTripData({ ...tripData, departureTime: e.target.value })}
                      className="input-field"
                    />
                    <button 
                      type="button"
                      onClick={() => handleRecordTime('departure')}
                      className="now-btn"
                    >
                      الآن
                    </button>
                  </div>
                  {tripData.departureTime && (
                    <small className="time-display">{formatTime12Hour(tripData.departureTime)}</small>
                  )}
                </div>

                <div className="form-group">
                  <label>وقت الوصول</label>
                  <div className="time-input-group">
                    <input
                      type="time"
                      value={tripData.arrivalTime}
                      onChange={(e) => setTripData({ ...tripData, arrivalTime: e.target.value })}
                      className="input-field"
                    />
                    <button 
                      type="button"
                      onClick={() => handleRecordTime('arrival')}
                      className="now-btn"
                    >
                      الآن
                    </button>
                  </div>
                  {tripData.arrivalTime && (
                    <small className="time-display">{formatTime12Hour(tripData.arrivalTime)}</small>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>ملاحظات</label>
                <textarea
                  value={tripData.notes}
                  onChange={(e) => setTripData({ ...tripData, notes: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="أي ملاحظات إضافية..."
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowTripModal(false)} 
                  className="cancel-btn"
                >
                  إلغاء
                </button>
                <button type="submit" className="submit-btn">
                  تسجيل الرحلة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverTrips;