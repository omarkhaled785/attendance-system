import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AddWorkerForm from './AddWorkerForm';
import './Dashboard.css';
import API_URL from '../config';

// Import PDF generator

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('workers');
  const [showAddWorker, setShowAddWorker] = useState(false);
  
  const [workers, setWorkers] = useState([]);
  
  const [reportType, setReportType] = useState('monthly');
  const [reportData, setReportData] = useState([]);
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  
  const [hourlyRate, setHourlyRate] = useState(50);
  const [companySettings, setCompanySettings] = useState({
    company_name: 'شركتك',
    company_logo: ''
  });
  
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusWorkerId, setBonusWorkerId] = useState(null);
  const [bonusHours, setBonusHours] = useState('');
  const [bonusDate, setBonusDate] = useState(new Date().toLocaleDateString('en-CA'));
  
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateWorkerId, setRateWorkerId] = useState(null);
  const [newHourlyRate, setNewHourlyRate] = useState('');
  
  const [backups, setBackups] = useState([]);

  // Invoice states
  const [showWorkerInvoice, setShowWorkerInvoice] = useState(false);
  const [selectedWorkerForInvoice, setSelectedWorkerForInvoice] = useState(null);
  const [showCompanyInvoice, setShowCompanyInvoice] = useState(false); // NEW
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1);
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear());
  const [invoiceType, setInvoiceType] = useState('monthly'); // NEW: daily, weekly, monthly, yearly
  const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('en-CA')); // NEW
  
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceWorkerId, setAdvanceWorkerId] = useState(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [advanceNotes, setAdvanceNotes] = useState('');
  useEffect(() => {
    loadWorkers();
    loadSettings();
    if (activeTab === 'backup') {
      loadBackups();
    }
  }, [activeTab]);

  const loadWorkers = async () => {
    try {
      const res = await fetch(`${API_URL}/workers`);
      const data = await res.json();
      
      // Fetch advances for each worker (current month)
      const workersWithAdvances = await Promise.all(
        data.map(async (worker) => {
          try {
            const today = new Date();
            const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA');
            const endDate = today.toLocaleDateString('en-CA');
            
            const advancesRes = await fetch(`${API_URL}/advances/total/${worker.id}?startDate=${startDate}&endDate=${endDate}`);
            const advancesData = await advancesRes.json();
            
            return {
              ...worker,
              advances: advancesData.total || 0
            };
          } catch (error) {
            return { ...worker, advances: 0 };
          }
        })
      );
      
      setWorkers(workersWithAdvances);
    } catch (error) {
      console.error('Error loading workers:', error);
    }
  };

  const calculateTotals = () => {
    if (reportData.length === 0) return { totalHours: 0, totalAmount: 0, totalAdvances: 0, totalNet: 0 };
    
    const totalHours = reportData.reduce((sum, row) => sum + (parseFloat(row.total_hours) || 0), 0);
    const totalAmount = reportData.reduce((sum, row) => {
      const rate = row.hourly_rate || 50;
      return sum + ((parseFloat(row.total_hours) || 0) * rate);
    }, 0);
    
    const totalAdvances = reportData.reduce((sum, row) => sum + (parseFloat(row.advances) || 0), 0);
    const totalNet = totalAmount - totalAdvances;
    
    return { 
      totalHours: totalHours.toFixed(2), 
      totalAmount: totalAmount.toFixed(2),
      totalAdvances: totalAdvances.toFixed(2),
      totalNet: totalNet.toFixed(2)
    };
  };

  const downloadReport = () => {
    if (reportData.length === 0) {
      alert('لا توجد بيانات لتحميلها');
      return;
    }

    let filename = 'تقرير_';
    if (reportType === 'daily') {
      filename += `يومي_${reportDate}`;
    } else if (reportType === 'weekly') {
      filename += `أسبوعي_${reportDate}`;
    } else if (reportType === 'monthly') {
      const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      filename += `شهري_${months[reportMonth - 1]}_${reportYear}`;
    }

    let csvContent = '';
    
    // Use UTF-8 BOM for Arabic support
    const BOM = '\uFEFF';
    
    if (reportType === 'daily') {
      csvContent = BOM + 'الاسم,الوظيفة,وقت الحضور,وقت الانصراف,إجمالي الساعات,سعر الساعة,المستحق,السلف,الصافي\n';
      reportData.forEach(row => {
        const rate = row.hourly_rate || 50;
        const hours = parseFloat(row.total_hours) || 0;
        const earned = hours * rate;
        const advances = parseFloat(row.advances) || 0;
        const net = earned - advances;
        
        csvContent += `"${row.name || ''}","${row.job_title || 'عامل'}","${row.check_in || '--'}","${row.check_out || '--'}","${hours}","${rate}","${earned.toFixed(2)}","${advances.toFixed(2)}","${net.toFixed(2)}"\n`;
      });
    } else {
      csvContent = BOM + (reportType === 'monthly' 
        ? 'الاسم,الوظيفة,أيام الحضور,أيام الغياب,إجمالي الساعات,سعر الساعة,المستحق,السلف,الصافي\n'
        : 'الاسم,الوظيفة,أيام الحضور,إجمالي الساعات,سعر الساعة,المستحق,السلف,الصافي\n');
      
      reportData.forEach(row => {
        const rate = row.hourly_rate || 50;
        const hours = parseFloat(row.total_hours) || 0;
        const earned = hours * rate;
        const advances = parseFloat(row.advances) || 0;
        const net = earned - advances;
        
        if (reportType === 'monthly') {
          csvContent += `"${row.name || ''}","${row.job_title || 'عامل'}","${row.days_present || 0}","${row.days_absent || 0}","${hours}","${rate}","${earned.toFixed(2)}","${advances.toFixed(2)}","${net.toFixed(2)}"\n`;
        } else {
          csvContent += `"${row.name || ''}","${row.job_title || 'عامل'}","${row.days_present || 0}","${hours}","${rate}","${earned.toFixed(2)}","${advances.toFixed(2)}","${net.toFixed(2)}"\n`;
        }
      });
    }

    // Add totals row
    const totals = calculateTotals();
    const totalAdvances = reportData.reduce((sum, row) => sum + (parseFloat(row.advances) || 0), 0);
    const totalNet = totals.totalAmount - totalAdvances;
    
    if (reportType === 'daily') {
      csvContent += `"الإجمالي","","","","${totals.totalHours}","","${totals.totalAmount}","${totalAdvances.toFixed(2)}","${totalNet.toFixed(2)}"\n`;
    } else if (reportType === 'monthly') {
      csvContent += `"الإجمالي","","","","${totals.totalHours}","","${totals.totalAmount}","${totalAdvances.toFixed(2)}","${totalNet.toFixed(2)}"\n`;
    } else {
      csvContent += `"الإجمالي","","","${totals.totalHours}","","${totals.totalAmount}","${totalAdvances.toFixed(2)}","${totalNet.toFixed(2)}"\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`);
      const data = await res.json();
      setHourlyRate(data.hourly_rate);
      setCompanySettings({
        company_name: data.company_name || 'شركتك',
        company_logo: data.company_logo || ''
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const deleteWorker = async (id, name) => {
    if (!confirm(`هل أنت متأكد من حذف ${name}؟`)) return;

    try {
      const res = await fetch(`${API_URL}/workers/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        loadWorkers();
        alert('تم حذف العامل بنجاح');
      }
    } catch (error) {
      alert('حدث خطأ في حذف العامل');
    }
  };

  const loadReport = async () => {
    setIsLoadingReport(true);
    setReportData([]);
    
    try {
      let url = `${API_URL}/reports/${reportType}`;
      
      if (reportType === 'daily') {
        url += `/${reportDate}`;
      } else if (reportType === 'weekly') {
        url += `?date=${reportDate}`;
      } else if (reportType === 'monthly') {
        url += `?year=${reportYear}&month=${reportMonth}`;
      }
      
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setReportData(data);
    } catch (error) {
      console.error('❌ Error loading report:', error);
      alert(`حدث خطأ في تحميل التقرير: ${error.message}`);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const updateHourlyRate = async () => {
    try {
      const res = await fetch(`${API_URL}/settings/hourly-rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: parseFloat(hourlyRate) })
      });
      
      if (res.ok) {
        alert('تم تحديث سعر الساعة الافتراضي بنجاح');
      }
    } catch (error) {
      alert('حدث خطأ في تحديث سعر الساعة');
    }
  };

  const updateCompanySettings = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companySettings.company_name,
          company_logo: companySettings.company_logo
        })
      });
      
      if (res.ok) {
        alert('تم تحديث إعدادات الشركة بنجاح');
      }
    } catch (error) {
      alert('حدث خطأ في تحديث إعدادات الشركة');
    }
  };

  const openRateModal = (workerId, currentRate) => {
    setRateWorkerId(workerId);
    setNewHourlyRate(currentRate || 50);
    setShowRateModal(true);
  };

  const updateWorkerRate = async () => {
    if (!newHourlyRate || parseFloat(newHourlyRate) <= 0) {
      alert('من فضلك أدخل سعر ساعة صحيح');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/workers/${rateWorkerId}/hourly-rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: parseFloat(newHourlyRate) })
      });

      if (res.ok) {
        alert('تم تحديث سعر الساعة بنجاح');
        setShowRateModal(false);
        loadWorkers();
      }
    } catch (error) {
      alert('حدث خطأ في تحديث سعر الساعة');
    }
  };

  const openBonusModal = (workerId) => {
    setBonusWorkerId(workerId);
    setBonusHours('');
    setBonusDate(new Date().toLocaleDateString('en-CA'));
    setShowBonusModal(true);
  };

  const addBonusHours = async () => {
    if (!bonusHours || parseFloat(bonusHours) <= 0) {
      alert('من فضلك أدخل عدد ساعات صحيح');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/attendance/add-bonus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: bonusWorkerId,
          bonusHours: parseFloat(bonusHours),
          date: bonusDate
        })
      });

      if (res.ok) {
        alert('تم إضافة ساعات البونص بنجاح');
        setShowBonusModal(false);
        loadWorkers();
      }
    } catch (error) {
      alert('حدث خطأ في إضافة البونص');
    }
  };

  const openAdvanceModal = (workerId) => {
    setAdvanceWorkerId(workerId);
    setAdvanceAmount('');
    setAdvanceDate(new Date().toLocaleDateString('en-CA'));
    setAdvanceNotes('');
    setShowAdvanceModal(true);
  };

  const addAdvance = async () => {
    if (!advanceAmount || parseFloat(advanceAmount) <= 0) {
      alert('من فضلك أدخل مبلغ صحيح');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/advances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_id: advanceWorkerId,
          amount: parseFloat(advanceAmount),
          date: advanceDate,
          notes: advanceNotes
        })
      });

      if (res.ok) {
        alert('تم إضافة السلفة بنجاح');
        setShowAdvanceModal(false);
        loadWorkers();
      }
    } catch (error) {
      alert('حدث خطأ في إضافة السلفة');
    }
  };

  const createBackup = async () => {
    try {
      const res = await fetch(`${API_URL}/backup/create`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        alert('✅ تم إنشاء نسخة احتياطية بنجاح');
        loadBackups();
      } else {
        alert('❌ فشل إنشاء النسخة الاحتياطية');
      }
    } catch (error) {
      alert('حدث خطأ في إنشاء النسخة الاحتياطية');
    }
  };

  const loadBackups = async () => {
    try {
      const res = await fetch(`${API_URL}/backup/list`);
      const data = await res.json();
      
      if (data.success) {
        setBackups(data.backups);
      }
    } catch (error) {
      console.error('Error loading backups:', error);
    }
  };

  const restoreBackup = async (filename) => {
    if (!confirm(`هل أنت متأكد من استعادة النسخة الاحتياطية؟\n${filename}\n\n⚠️ سيتم استبدال جميع البيانات الحالية!`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/backup/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const data = await res.json();

      if (data.success) {
        alert('✅ تم استعادة النسخة الاحتياطية بنجاح!\n\nسيتم إعادة تحميل الصفحة...');
        window.location.reload();
      } else {
        alert('❌ فشل استعادة النسخة الاحتياطية');
      }
    } catch (error) {
      alert('حدث خطأ في استعادة النسخة الاحتياطية');
    }
  };

const generateWorkerInvoicePDF = async (workerId) => {
  try {
    const res = await fetch(
      `${API_URL}/workers/${workerId}/full-report?year=${invoiceYear}&month=${invoiceMonth}`
    );
    const data = await res.json();

    if (!data || !data.worker) {
      alert("لا توجد بيانات للفاتورة");
      return;
    }

    const settingsRes = await fetch(`${API_URL}/settings`);
    const settings = await settingsRes.json();

    // ✅ dynamic import الصحيح
    const { generateWorkerInvoice } = await import('../utils/pdfGenerator');

    await generateWorkerInvoice(
      {
        ...data,
        companyName: settings.company_name,
        period: `${invoiceMonth}/${invoiceYear}`
      },
      settings.company_logo
    );

  } catch (error) {
    console.error('❌ Error generating worker invoice:', error);
    alert('حدث خطأ في إنشاء فاتورة العامل');
  }
};

 const generateCompanyInvoicePDF = async () => {
  try {
    console.log("📊 Fetching company invoice data...");
    
    let url = `${API_URL}/invoice/company?`;
    let periodText = '';
    
    // Build URL based on invoice type
    if (invoiceType === 'daily') {
      url += `date=${invoiceDate}&type=daily`;
      periodText = invoiceDate;
    } else if (invoiceType === 'weekly') {
      url += `date=${invoiceDate}&type=weekly`;
      const weekEnd = new Date(invoiceDate);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      periodText = `${weekStart.toLocaleDateString('en-CA')} إلى ${invoiceDate}`;
    } else if (invoiceType === 'monthly') {
      url += `year=${invoiceYear}&month=${invoiceMonth}&type=monthly`;
      const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      periodText = `${arabicMonths[invoiceMonth - 1]} ${invoiceYear}`;
    } else if (invoiceType === 'yearly') {
      url += `year=${invoiceYear}&type=yearly`;
      periodText = `${invoiceYear}`;
    }
    
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }
    
    const data = await res.json();
    console.log("✅ Received data:", data);

    if (!data.workers || data.workers.length === 0) {
      alert("لا توجد بيانات لإنشاء الفاتورة");
      return;
    }

    // Override period text with our Arabic formatted version
    data.period = periodText;

    const { generateCompanyInvoice } = await import('../utils/pdfGenerator');

    await generateCompanyInvoice(data, data.settings?.company_logo);
    
    console.log("✅ PDF generated successfully");
    setShowCompanyInvoice(false); // Close modal after success

  } catch (error) {
    console.error('❌ Error generating company invoice:', error);
    alert(`حدث خطأ في إنشاء فاتورة الشركة: ${error.message}`);
  }
};

  const openWorkerInvoiceModal = (workerId) => {
    setSelectedWorkerForInvoice(workerId);
    setShowWorkerInvoice(true);
  };

  const getJobTitleBadge = (jobTitle) => {
    if (!jobTitle) jobTitle = 'عامل';
    
    switch(jobTitle) {
      case 'عامل':
        return <span className="job-title-badge عامل">{jobTitle}</span>;
      case 'سواق':
        return <span className="job-title-badge سواق">{jobTitle}</span>;
      case 'هير':
      case 'فوس':
        return <span className="job-title-badge خاصة">{jobTitle}</span>;
      default:
        return <span className="job-title-badge أخرى">{jobTitle}</span>;
    }
  };

  const handleCompanyLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميجابايت');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        // Compress image
        compressImage(reader.result, (compressed) => {
          setCompanySettings({...companySettings, company_logo: compressed});
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
      
      const maxSize = 400;
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
      
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      callback(compressed);
    };
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      if (reportType === 'monthly') {
        loadReport();
      } else if (reportType === 'daily' && reportDate) {
        loadReport();
      } else if (reportType === 'weekly' && reportDate) {
        loadReport();
      }
    }
  }, [activeTab, reportType, reportDate, reportMonth, reportYear]);

  const totals = calculateTotals();

  return (
    <div className="dashboard-container">
      {showAddWorker && (
        <AddWorkerForm
          onClose={() => setShowAddWorker(false)}
          onSuccess={loadWorkers}
        />
      )}

      {showBonusModal && (
        <div className="modal-overlay" onClick={() => setShowBonusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إضافة ساعات بونص</h2>
              <button className="close-btn" onClick={() => setShowBonusModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>عدد الساعات الإضافية</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={bonusHours}
                  onChange={(e) => setBonusHours(e.target.value)}
                  className="input-field"
                  placeholder="مثال: 2"
                />
              </div>
              <div className="form-group">
                <label>التاريخ</label>
                <input
                  type="date"
                  value={bonusDate}
                  onChange={(e) => setBonusDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="form-actions">
                <button onClick={() => setShowBonusModal(false)} className="cancel-btn">
                  إلغاء
                </button>
                <button onClick={addBonusHours} className="submit-btn">
                  إضافة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRateModal && (
        <div className="modal-overlay" onClick={() => setShowRateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تعديل سعر الساعة</h2>
              <button className="close-btn" onClick={() => setShowRateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>سعر الساعة الجديد (جنيه)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newHourlyRate}
                  onChange={(e) => setNewHourlyRate(e.target.value)}
                  className="input-field"
                  placeholder="50"
                />
              </div>
              <div className="form-actions">
                <button onClick={() => setShowRateModal(false)} className="cancel-btn">
                  إلغاء
                </button>
                <button onClick={updateWorkerRate} className="submit-btn">
                  تحديث
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdvanceModal && (
        <div className="modal-overlay" onClick={() => setShowAdvanceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إضافة سلفة للعامل</h2>
              <button className="close-btn" onClick={() => setShowAdvanceModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>المبلغ (جنيه)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="input-field"
                  placeholder="مثال: 500"
                />
              </div>
              <div className="form-group">
                <label>التاريخ</label>
                <input
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="form-group">
                <label>ملاحظات (اختياري)</label>
                <textarea
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  className="input-field"
                  rows="2"
                  placeholder="سبب السلفة"
                />
              </div>
              <div className="form-actions">
                <button onClick={() => setShowAdvanceModal(false)} className="cancel-btn">
                  إلغاء
                </button>
                <button onClick={addAdvance} className="submit-btn">
                  إضافة السلفة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWorkerInvoice && (
        <div className="modal-overlay" onClick={() => setShowWorkerInvoice(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إنشاء فاتورة للعامل</h2>
              <button className="close-btn" onClick={() => setShowWorkerInvoice(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>الشهر</label>
                <select
                  value={invoiceMonth}
                  onChange={(e) => setInvoiceMonth(parseInt(e.target.value))}
                  className="select-field"
                >
                  <option value="1">يناير</option>
                  <option value="2">فبراير</option>
                  <option value="3">مارس</option>
                  <option value="4">أبريل</option>
                  <option value="5">مايو</option>
                  <option value="6">يونيو</option>
                  <option value="7">يوليو</option>
                  <option value="8">أغسطس</option>
                  <option value="9">سبتمبر</option>
                  <option value="10">أكتوبر</option>
                  <option value="11">نوفمبر</option>
                  <option value="12">ديسمبر</option>
                </select>
              </div>
              <div className="form-group">
                <label>السنة</label>
                <input
                  type="number"
                  value={invoiceYear}
                  onChange={(e) => setInvoiceYear(parseInt(e.target.value))}
                  className="input-field"
                  min="2020"
                  max="2050"
                />
              </div>
              <div className="form-actions">
                <button onClick={() => setShowWorkerInvoice(false)} className="cancel-btn">
                  إلغاء
                </button>
                <button onClick={() => generateWorkerInvoicePDF(selectedWorkerForInvoice)} className="submit-btn">
                  إنشاء فاتورة PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCompanyInvoice && (
  <div className="modal-overlay" onClick={() => setShowCompanyInvoice(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>إنشاء فاتورة الشركة</h2>
        <button className="close-btn" onClick={() => setShowCompanyInvoice(false)}>×</button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label>نوع التقرير</label>
          <select
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value)}
            className="select-field"
          >
            <option value="daily">يومي</option>
            <option value="weekly">أسبوعي</option>
            <option value="monthly">شهري</option>
            <option value="yearly">سنوي</option>
          </select>
        </div>

        {invoiceType === 'daily' && (
          <div className="form-group">
            <label>التاريخ</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="input-field"
            />
          </div>
        )}

        {invoiceType === 'weekly' && (
          <div className="form-group">
            <label>نهاية الأسبوع (آخر يوم)</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="input-field"
            />
            <small className="help-text">
              سيتم احتساب آخر 7 أيام من التاريخ المحدد
            </small>
          </div>
        )}

        {invoiceType === 'monthly' && (
          <>
            <div className="form-group">
              <label>الشهر</label>
              <select
                value={invoiceMonth}
                onChange={(e) => setInvoiceMonth(parseInt(e.target.value))}
                className="select-field"
              >
                <option value="1">يناير</option>
                <option value="2">فبراير</option>
                <option value="3">مارس</option>
                <option value="4">أبريل</option>
                <option value="5">مايو</option>
                <option value="6">يونيو</option>
                <option value="7">يوليو</option>
                <option value="8">أغسطس</option>
                <option value="9">سبتمبر</option>
                <option value="10">أكتوبر</option>
                <option value="11">نوفمبر</option>
                <option value="12">ديسمبر</option>
              </select>
            </div>
            <div className="form-group">
              <label>السنة</label>
              <input
                type="number"
                value={invoiceYear}
                onChange={(e) => setInvoiceYear(parseInt(e.target.value))}
                className="input-field"
                min="2020"
                max="2050"
              />
            </div>
          </>
        )}

        {invoiceType === 'yearly' && (
          <div className="form-group">
            <label>السنة</label>
            <input
              type="number"
              value={invoiceYear}
              onChange={(e) => setInvoiceYear(parseInt(e.target.value))}
              className="input-field"
              min="2020"
              max="2050"
            />
          </div>
        )}

        <div className="form-actions">
          <button onClick={() => setShowCompanyInvoice(false)} className="cancel-btn">
            إلغاء
          </button>
          <button onClick={generateCompanyInvoicePDF} className="submit-btn">
            📄 إنشاء الفاتورة
          </button>
        </div>
      </div>
    </div>
  </div>
)}
      <div className="dashboard-header">
        <h1>لوحة التحكم - الأدمن</h1>
        <button onClick={() => navigate('/')} className="logout-btn">
          العودة للصفحة الرئيسية
        </button>
      </div>

      <div className="tabs">
        <button 
          className={activeTab === 'workers' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('workers')}
        >
          إدارة العمال
        </button>
        <button 
          className={activeTab === 'reports' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('reports')}
        >
          التقارير
        </button>
        <button 
          className={activeTab === 'backup' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('backup')}
        >
          💾 النسخ الاحتياطي
        </button>
        <button 
          className={activeTab === 'settings' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('settings')}
        >
          الإعدادات
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'workers' && (
          <div>
            <div className="add-worker-section">
              <h3>إضافة عامل جديد</h3>
              <button onClick={() => setShowAddWorker(true)} className="add-btn">
                + إضافة عامل
              </button>
            </div>

            <div className="workers-list">
              <h3>قائمة العمال ({workers.length})</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>الوظيفة</th>
                    <th>العمر</th>
                    <th>رقم الهاتف</th>
                    <th>تاريخ التعيين</th>
                    <th>سعر الساعة</th>
                    <th>الإجراءات</th>
                    <th>الرواتب</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map(worker => {
                    const advances = parseFloat(worker.advances) || 0;
                    return (
                      <tr key={worker.id}>
                        <td>
                          <button 
                            onClick={() => navigate(`/worker/${worker.id}`)}
                            className="worker-name-link"
                          >
                            {worker.name}
                          </button>
                        </td>
                        <td>{getJobTitleBadge(worker.job_title)}</td>
                        <td>{worker.age} سنة</td>
                        <td>{worker.phone}</td>
                        <td>{new Date(worker.date_joined).toLocaleDateString('ar-EG')}</td>
                        <td>
                          <button
                            onClick={() => openRateModal(worker.id, worker.hourly_rate)}
                            className="rate-display-btn"
                            title="تعديل سعر الساعة"
                          >
                            {worker.hourly_rate || 50} ج/س
                          </button>
                        </td>
                      
                        <td>
                          <div className="action-buttons">
                            <button 
                              onClick={() => openBonusModal(worker.id)}
                              className="bonus-btn"
                              title="إضافة ساعات بونص"
                            >
                              ⭐ بونص
                            </button>
                            <button 
                              onClick={() => openAdvanceModal(worker.id)}
                              className="advance-btn"
                              title="إضافة سلفة"
                            >
                              💰 سلفة
                            </button>
                            <button 
                              onClick={() => deleteWorker(worker.id, worker.name)}
                              className="delete-btn"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                        <td>
                          <button 
                            onClick={() => openWorkerInvoiceModal(worker.id)}
                            className="invoice-btn"
                            title="إنشاء فاتورة للعامل"
                          >
                            📄 فاتورة
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div>
            <div className="report-controls">
              <select 
                value={reportType} 
                onChange={(e) => setReportType(e.target.value)}
                className="select-field"
              >
                <option value="daily">تقرير يومي</option>
                <option value="weekly">تقرير أسبوعي</option>
                <option value="monthly">تقرير شهري</option>
              </select>

              {reportType === 'daily' && (
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="input-field"
                />
              )}

              {reportType === 'weekly' && (
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="input-field"
                  title="اختر نهاية الأسبوع"
                />
              )}

              {reportType === 'monthly' && (
                <>
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(parseInt(e.target.value))}
                    className="select-field"
                  >
                    <option value="1">يناير</option>
                    <option value="2">فبراير</option>
                    <option value="3">مارس</option>
                    <option value="4">أبريل</option>
                    <option value="5">مايو</option>
                    <option value="6">يونيو</option>
                    <option value="7">يوليو</option>
                    <option value="8">أغسطس</option>
                    <option value="9">سبتمبر</option>
                    <option value="10">أكتوبر</option>
                    <option value="11">نوفمبر</option>
                    <option value="12">ديسمبر</option>
                  </select>
                  
                  <input
                    type="number"
                    value={reportYear}
                    onChange={(e) => setReportYear(parseInt(e.target.value))}
                    className="input-field"
                    placeholder="السنة"
                    min="2020"
                    max="2050"
                    style={{ maxWidth: '120px' }}
                  />
                </>
              )}

              <button onClick={loadReport} className="load-report-btn" disabled={isLoadingReport}>
                {isLoadingReport ? '⏳ جاري التحميل...' : 'تحميل التقرير'}
              </button>
              
              <button onClick={downloadReport} className="download-report-btn" disabled={isLoadingReport}>
                📥 تحميل CSV
              </button>

              <button 
  onClick={() => setShowCompanyInvoice(true)} 
  className="company-invoice-btn" 
  disabled={isLoadingReport}
>
  🏢 فاتورة الشركة (PDF)
</button>
            </div>

            <div className="report-data">
              <div className="report-header-info">
                <h3>
                  {reportType === 'daily' && `📅 تقرير يوم ${reportDate}`}
                  {reportType === 'weekly' && `📅 تقرير أسبوعي حتى ${reportDate}`}
                  {reportType === 'monthly' && `📅 تقرير ${['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][reportMonth - 1]} ${reportYear}`}
                </h3>
                <p className="report-count">عدد العمال: {reportData.length}</p>
              </div>
              
              {reportData.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>الوظيفة</th>
                      {reportType === 'daily' && (
                        <>
                          <th>وقت الحضور</th>
                          <th>وقت الانصراف</th>
                        </>
                      )}
                      {reportType !== 'daily' && (
                        <>
                          <th>أيام الحضور</th>
                          {reportType === 'monthly' && <th>أيام الغياب</th>}
                        </>
                      )}
                      <th>إجمالي الساعات</th>
                      <th>سعر الساعة</th>
                      <th>المستحق</th>
                      <th>السلف</th>
                      <th>الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => {
                      const rate = row.hourly_rate || 50;
                      const hours = parseFloat(row.total_hours) || 0;
                      const earned = hours * rate;
                      const advances = parseFloat(row.advances) || 0;
                      const net = earned - advances;
                      
                      return (
                        <tr key={i}>
                          <td>{row.name}</td>
                          <td>{row.job_title || 'عامل'}</td>
                          {reportType === 'daily' && (
                            <>
                              <td>{row.check_in || '--'}</td>
                              <td>{row.check_out || '--'}</td>
                            </>
                          )}
                          {reportType !== 'daily' && (
                            <>
                              <td>{row.days_present || 0}</td>
                              {reportType === 'monthly' && <td>{row.days_absent || 0}</td>}
                            </>
                          )}
                          <td>{hours.toFixed(2)} ساعة</td>
                          <td>{rate} ج</td>
                          <td className="amount">{earned.toFixed(2)} جنيه</td>
                          <td className="advances" style={{color: '#dc3545'}}>{advances.toFixed(2)} جنيه</td>
                          <td className="net-amount" style={{color: '#28a745', fontWeight: 'bold'}}>
                            {net.toFixed(2)} جنيه
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr className="total-row">
                      <td colSpan={reportType === 'daily' ? 5 : (reportType === 'monthly' ? 6 : 5)}>
                        <strong>الإجمالي</strong>
                      </td>
                      <td><strong>{totals.totalHours} ساعة</strong></td>
                      <td>--</td>
                      <td className="amount"><strong>{totals.totalAmount} جنيه</strong></td>
                      <td style={{color: '#dc3545', fontWeight: 'bold'}}>
                        <strong>{totals.totalAdvances} جنيه</strong>
                      </td>
                      <td style={{color: '#28a745', fontWeight: 'bold'}}>
                        <strong>{totals.totalNet} جنيه</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="no-data">لا توجد بيانات للعرض</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div>
            <div className="backup-section">
              <h3>💾 النسخ الاحتياطي التلقائي</h3>
              <p className="backup-info">
                ✅ النظام يأخذ نسخة احتياطية تلقائية كل 24 ساعة<br/>
                📁 النسخ محفوظة لمدة 30 يوم<br/>
                🔒 يمكنك إنشاء نسخة احتياطية يدوية في أي وقت
              </p>
              <button onClick={createBackup} className="create-backup-btn">
                ➕ إنشاء نسخة احتياطية الآن
              </button>
            </div>

            <div className="backups-list">
              <h3>📋 النسخ الاحتياطية المتوفرة ({backups.length})</h3>
              {backups.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>اسم الملف</th>
                      <th>التاريخ والوقت</th>
                      <th>الحجم</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup, index) => (
                      <tr key={index}>
                        <td>{backup.filename}</td>
                        <td>{new Date(backup.date).toLocaleString('ar-EG')}</td>
                        <td>{backup.size}</td>
                        <td>
                          <button
                            onClick={() => restoreBackup(backup.filename)}
                            className="restore-btn"
                          >
                            ↩️ استعادة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="no-data">لا توجد نسخ احتياطية متوفرة</p>
              )}
            </div>

            <div className="backup-warning">
              <h4>⚠️ تعليمات مهمة:</h4>
              <ul>
                <li>احتفظ بنسخة احتياطية على فلاشة أو سحابة خارجية</li>
                <li>مجلد النسخ الاحتياطية: <code>backups/</code></li>
                <li>لا تحذف هذا المجلد أبداً</li>
                <li>عند استعادة نسخة، يتم حفظ النسخة الحالية تلقائياً</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <div className="settings-section">
              <h3>سعر الساعة الافتراضي</h3>
              <p className="settings-note">
                ⚠️ هذا السعر سيستخدم للعمال الجدد فقط. لتعديل سعر عامل موجود، اذهب لقسم "إدارة العمال"
              </p>
              <div className="setting-group">
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="input-field"
                  step="0.01"
                  min="0"
                />
                <button onClick={updateHourlyRate} className="save-btn">
                  حفظ
                </button>
              </div>
            </div>

            <div className="company-settings">
              <h3>إعدادات الشركة</h3>
              <p className="settings-note">
                ⚠️ هذه المعلومات ستظهر على الفواتير والمستندات
              </p>
              <div className="setting-group">
                <label>اسم الشركة:</label>
                <input
                  type="text"
                  value={companySettings.company_name}
                  onChange={(e) => setCompanySettings({...companySettings, company_name: e.target.value})}
                  className="input-field"
                  placeholder="اسم الشركة"
                />
                <button onClick={updateCompanySettings} className="save-btn">
                  حفظ
                </button>
              </div>
              
              <div className="setting-group">
                <label>شعار الشركة:</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCompanyLogoUpload}
                  className="input-field"
                />
                {companySettings.company_logo && (
                  <div className="logo-preview">
                    <img src={companySettings.company_logo} alt="شعار الشركة" />
                    <small>معاينة الشعار</small>
                  </div>
                )}
                <button onClick={updateCompanySettings} className="save-btn" style={{marginTop: '10px'}}>
                  حفظ الشعار
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;