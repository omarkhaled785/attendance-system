/* =====================================================
   PDF Generator – Electron Safe (Arabic RTL)
   ===================================================== */

import { amiriFontBase64 } from './arabicFont';

// Setup Arabic font
function setupArabicFont(doc) {
  try {
    doc.addFileToVFS("Amiri-Regular.ttf", amiriFontBase64);
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    doc.setFont("Amiri");
    console.log("✅ Arabic font loaded successfully");
    return true;
  } catch (error) {
    console.warn("⚠️ Could not load Arabic font:", error);
    doc.setFont("helvetica");
    return false;
  }
}

// Arabic month names
const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

// Format date in Arabic
function formatArabicDate(date) {
  const day = date.getDate();
  const month = arabicMonths[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/* =====================================================
   📄 Worker Invoice (فاتورة عامل)
   ===================================================== */
export async function generateWorkerInvoice(data, logoBase64 = "") {
  try {
    console.log("📄 Starting worker invoice generation...", data);

    // Dynamic imports
    const jsPDF = (await import("jspdf")).default;
    await import("jspdf-autotable");

    // Create document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Setup Arabic font
    setupArabicFont(doc);

    // Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "JPEG", 10, 10, 30, 20);
      } catch (e) {
        console.warn("Could not add logo:", e);
      }
    }

    // Header (Arabic, right-aligned)
    doc.setFontSize(16);
    doc.text(data.companyName || "فاتورة عامل", 105, 20, { align: "center" });

    doc.setFontSize(11);
    doc.text(`اسم العامل: ${data.worker.name}`, 195, 35, { align: "right" });
    doc.text(`الفترة: ${data.period}`, 195, 43, { align: "right" });
    doc.text(`تاريخ الإصدار: ${formatArabicDate(new Date())}`, 195, 51, { align: "right" });

    // Attendance Table
    doc.autoTable({
      startY: 58,
      head: [[
        "التاريخ",
        "وقت الحضور",
        "وقت الانصراف",
        "إجمالي الساعات"
      ]],
      body: (data.attendance || []).map(row => ([
        row.date || "",
        row.check_in || "--",
        row.check_out || "--",
        (parseFloat(row.total_hours) || 0).toFixed(2)
      ])),
      styles: {
        font: "Amiri",
        fontSize: 10,
        cellPadding: 3,
        halign: "right"
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
        halign: "right"
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });

    let y = doc.lastAutoTable.finalY + 15;

    // Summary box
    doc.setFillColor(240, 240, 240);
    doc.rect(10, y - 5, 190, 50, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    doc.text(`إجمالي الساعات: ${data.summary.totalHours}`, 195, y, { align: "right" });
    y += 10;
    doc.text(`إجمالي المستحق: ${data.summary.totalEarned} جنيه`, 195, y, { align: "right" });
    y += 10;
    doc.text(`إجمالي السلف: ${data.summary.totalAdvances} جنيه`, 195, y, { align: "right" });
    y += 10;
    
    doc.setFontSize(14);
    doc.setTextColor(0, 128, 0);
    doc.text(`الصافي: ${data.summary.netAmount} جنيه`, 195, y, { align: "right" });

    // Footer
    y = doc.internal.pageSize.height - 15;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(data.companyName || "شركتك", 105, y, { align: "center" });

    const filename = `فاتورة_${data.worker.name.replace(/\s+/g, '_')}_${data.period.replace('/', '-')}.pdf`;
    doc.save(filename);
    
    console.log("✅ Worker invoice generated successfully");

  } catch (err) {
    console.error("❌ Worker invoice PDF error:", err);
    throw err;
  }
}

/* =====================================================
   🏢 Company Invoice (فاتورة الشركة)
   ===================================================== */
export async function generateCompanyInvoice(data, logoBase64 = "") {
  try {
    console.log("📄 Starting company invoice generation...", data);

    // Dynamic imports
    const jsPDF = (await import("jspdf")).default;
    await import("jspdf-autotable");

    // Create document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Setup Arabic font
    setupArabicFont(doc);

    // Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "JPEG", 10, 10, 30, 20);
      } catch (e) {
        console.warn("Could not add logo:", e);
      }
    }

    // Header (Arabic, centered)
    doc.setFontSize(16);
    doc.text("فاتورة الشركة", 105, 20, { align: "center" });

    doc.setFontSize(11);
    doc.text(`الفترة: ${data.period}`, 195, 35, { align: "right" });
    doc.text(`تاريخ الإصدار: ${formatArabicDate(new Date())}`, 195, 43, { align: "right" });

    // Company Workers Table
    doc.autoTable({
      startY: 50,
      head: [[
        "الاسم",
        "الوظيفة",
        "الساعات",
        "المستحق",
        "السلف",
        "الصافي"
      ]],
      body: (data.workers || []).map(w => {
        return [
          w.name || "",
          w.job_title || "عامل",
          w.total_hours || "0.00",
          w.earned || "0.00",
          w.advances || "0.00",
          w.net_amount || "0.00"
        ];
      }),
      styles: {
        font: "Amiri",
        fontSize: 9,
        cellPadding: 3,
        halign: "right"
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
        halign: "right"
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30 }
      }
    });

    let y = doc.lastAutoTable.finalY + 15;

    // Totals box with background
    doc.setFillColor(240, 240, 240);
    doc.rect(10, y - 5, 190, 50, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    doc.text(`إجمالي الساعات: ${data.totalHours || "0.00"}`, 195, y, { align: "right" });
    y += 10;
    doc.text(`إجمالي المستحق: ${data.totalEarned || "0.00"} جنيه`, 195, y, { align: "right" });
    y += 10;
    doc.text(`إجمالي السلف: ${data.totalAdvances || "0.00"} جنيه`, 195, y, { align: "right" });
    y += 10;
    
    doc.setFontSize(14);
    doc.setTextColor(0, 128, 0);
    doc.text(`الصافي الكلي: ${data.totalNet || "0.00"} جنيه`, 195, y, { align: "right" });

    // Footer
    y = doc.internal.pageSize.height - 15;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(data.settings?.company_name || "شركتك", 105, y, { align: "center" });

    const filename = `فاتورة_الشركة_${data.period.replace('/', '-')}.pdf`;
    doc.save(filename);
    
    console.log("✅ Company invoice generated successfully");

  } catch (err) {
    console.error("❌ Company invoice PDF error:", err);
    throw err;
  }
}