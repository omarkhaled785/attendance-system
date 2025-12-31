/* =====================================================
   PDF Generator – Fixed with Logo & Yearly Data
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

// Add logo to PDF (top left)
function addLogoToPDF(doc, logoBase64) {
  if (!logoBase64) {
    console.log("⚠️ No logo provided");
    return;
  }
  
  try {
    // Try to detect image format
    let imageFormat = "PNG";
    if (logoBase64.startsWith("data:image/jpeg") || logoBase64.startsWith("data:image/jpg")) {
      imageFormat = "JPEG";
    } else if (logoBase64.startsWith("data:image/png")) {
      imageFormat = "PNG";
    }
    
    // Clean the base64 string
    const cleanBase64 = logoBase64.split(",")[1] || logoBase64;
    
    // Add logo (10mm from left, 15mm from top, 25x25mm size)
    doc.addImage(cleanBase64, imageFormat, 10, 15, 25, 25);
    console.log("✅ Logo added successfully at position (10, 15)");
  } catch (error) {
    console.warn("⚠️ Could not add logo:", error.message);
    // Try with the original base64
    try {
      doc.addImage(logoBase64, "PNG", 10, 15, 25, 25);
    } catch (e) {
      console.error("❌ Logo could not be added in any format:", e.message);
    }
  }
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

    // Add Logo (top-left)
    addLogoToPDF(doc, logoBase64);

    // Header (Arabic, right-aligned) - moved down to accommodate logo
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text("فاتورة عامل", 105, 35, { align: "center" });

    // Company name
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(data.companyName || "شركتك", 105, 43, { align: "center" });

    // Worker details box
    doc.setFillColor(240, 248, 255);
    doc.rect(10, 50, 190, 20, 'F');
    
    doc.setFontSize(11);
    doc.text(`اسم العامل: ${data.worker.name}`, 195, 57, { align: "right" });
    doc.text(`الفترة: ${data.period}`, 195, 63, { align: "right" });
    doc.text(`تاريخ الإصدار: ${formatArabicDate(new Date())}`, 15, 63);

    // Calculate summary if not provided
    const summary = data.summary || {};
    const totalHours = summary.totalHours || "0.00";
    const totalEarned = summary.totalEarned || "0.00";
    const totalAdvances = summary.totalAdvances || "0.00";
    const netAmount = summary.netAmount || "0.00";

    // Attendance Table
    doc.autoTable({
      startY: 75,
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

    // Summary box with border
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.setFillColor(240, 248, 255);
    doc.rect(10, y - 5, 190, 55, 'FD');
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    doc.text(`إجمالي الساعات: ${totalHours}`, 195, y + 3, { align: "right" });
    y += 10;
    doc.text(`إجمالي المستحق: ${totalEarned} جنيه`, 195, y + 3, { align: "right" });
    y += 10;
    doc.text(`إجمالي السلف: ${totalAdvances} جنيه`, 195, y + 3, { align: "right" });
    y += 10;
    
    // Net amount with highlight
    doc.setFillColor(0, 128, 0, 0.1);
    doc.rect(10, y - 2, 190, 10, 'F');
    doc.setFontSize(14);
    doc.setTextColor(0, 128, 0);
    doc.text(`الصافي: ${netAmount} جنيه`, 195, y + 5, { align: "right" });

    // Footer
    y = doc.internal.pageSize.height - 15;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.line(10, y - 5, 200, y - 5);
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
   🏢 Company Invoice (فاتورة الشركة) - FIXED YEARLY DATA
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

    // Add Logo (top-left)
    addLogoToPDF(doc, logoBase64);

    // Header (Arabic, centered) - moved down to accommodate logo
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text("فاتورة الشركة", 105, 35, { align: "center" });

    // Company name
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(data.settings?.company_name || "شركتك", 105, 43, { align: "center" });

    // Period details box
    doc.setFillColor(240, 248, 255);
    doc.rect(10, 50, 190, 15, 'F');
    
    doc.setFontSize(11);
    doc.text(`الفترة: ${data.period}`, 195, 58, { align: "right" });
    doc.text(`تاريخ الإصدار: ${formatArabicDate(new Date())}`, 15, 58);

    // Company Workers Table
    const tableData = (data.workers || []).map(w => {
      return [
        w.name || "",
        w.job_title || "عامل",
        parseFloat(w.total_hours || 0).toFixed(2),
        parseFloat(w.earned || 0).toFixed(2),
        parseFloat(w.advances || 0).toFixed(2),
        parseFloat(w.net_amount || 0).toFixed(2)
      ];
    });

    // Calculate totals
    const totalHours = parseFloat(data.totalHours || 0).toFixed(2);
    const totalEarned = parseFloat(data.totalEarned || 0).toFixed(2);
    const totalAdvances = parseFloat(data.totalAdvances || 0).toFixed(2);
    const totalNet = parseFloat(data.totalNet || 0).toFixed(2);

    doc.autoTable({
      startY: 70,
      head: [[
        "الاسم",
        "الوظيفة",
        "الساعات",
        "المستحق",
        "السلف",
        "الصافي"
      ]],
      body: tableData,
      foot: [[
        "الإجمالي",
        "",
        totalHours,
        totalEarned,
        totalAdvances,
        totalNet
      ]],
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
      footStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
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
        5: { cellWidth: 30, fontStyle: 'bold', textColor: [0, 128, 0] }
      }
    });

    let y = doc.lastAutoTable.finalY + 15;

    // Totals Summary Box with border
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.setFillColor(240, 248, 255);
    doc.rect(10, y - 5, 190, 55, 'FD');
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    doc.text(`إجمالي الساعات: ${totalHours}`, 195, y + 3, { align: "right" });
    y += 10;
    doc.text(`إجمالي المستحق: ${totalEarned} جنيه`, 195, y + 3, { align: "right" });
    y += 10;
    doc.text(`إجمالي السلف: ${totalAdvances} جنيه`, 195, y + 3, { align: "right" });
    y += 10;
    
    // Net amount with highlight
    doc.setFillColor(0, 128, 0, 0.1);
    doc.rect(10, y - 2, 190, 10, 'F');
    doc.setFontSize(14);
    doc.setTextColor(0, 128, 0);
    doc.text(`الصافي الكلي: ${totalNet} جنيه`, 195, y + 5, { align: "right" });

    // Footer
    y = doc.internal.pageSize.height - 15;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.line(10, y - 5, 200, y - 5);
    doc.text(data.settings?.company_name || "شركتك", 105, y, { align: "center" });

    const filename = `فاتورة_الشركة_${data.period.replace(/[\/\s]/g, '-')}.pdf`;
    doc.save(filename);
    
    console.log("✅ Company invoice generated successfully");

  } catch (err) {
    console.error("❌ Company invoice PDF error:", err);
    throw err;
  }
}

/* =====================================================
   📊 Daily Report (تقرير يومي)
   ===================================================== */
export async function generateDailyReport(data, logoBase64 = "") {
  try {
    console.log("📄 Starting daily report generation...", data);

    // Dynamic imports
    const jsPDF = (await import("jspdf")).default;
    await import("jspdf-autotable");

    // Create document
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    // Setup Arabic font
    setupArabicFont(doc);

    // Add Logo (top-left)
    addLogoToPDF(doc, logoBase64);

    // Header
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text("تقرير الحضور اليومي", 148, 35, { align: "center" });

    // Company name and date
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(data.companyName || "شركتك", 148, 43, { align: "center" });
    
    const reportDate = data.date || new Date().toLocaleDateString('en-CA');
    const arabicDate = new Date(reportDate).toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    doc.setFontSize(11);
    doc.text(`تاريخ التقرير: ${arabicDate}`, 148, 50, { align: "center" });
    doc.text(`تاريخ الإصدار: ${formatArabicDate(new Date())}`, 15, 50);

    // Daily Report Table
    const tableData = (data.workers || []).map(worker => {
      const hours = parseFloat(worker.total_hours || 0);
      const rate = parseFloat(worker.hourly_rate || 50);
      const earned = hours * rate;
      const advances = parseFloat(worker.advances || 0);
      const net = earned - advances;

      return [
        worker.name || "",
        worker.job_title || "عامل",
        worker.check_in || "--",
        worker.check_out || "--",
        hours.toFixed(2),
        rate.toFixed(2),
        earned.toFixed(2),
        advances.toFixed(2),
        net.toFixed(2)
      ];
    });

    // Calculate totals
    const totalHours = tableData.reduce((sum, row) => sum + parseFloat(row[4]), 0);
    const totalEarned = tableData.reduce((sum, row) => sum + parseFloat(row[6]), 0);
    const totalAdvances = tableData.reduce((sum, row) => sum + parseFloat(row[7]), 0);
    const totalNet = totalEarned - totalAdvances;

    doc.autoTable({
      startY: 60,
      head: [[
        "الاسم",
        "الوظيفة",
        "وقت الحضور",
        "وقت الانصراف",
        "الساعات",
        "سعر الساعة",
        "المستحق",
        "السلف",
        "الصافي"
      ]],
      body: tableData,
      foot: [[
        "الإجمالي",
        "",
        "",
        "",
        totalHours.toFixed(2),
        "",
        totalEarned.toFixed(2),
        totalAdvances.toFixed(2),
        totalNet.toFixed(2)
      ]],
      styles: {
        font: "Amiri",
        fontSize: 8,
        cellPadding: 3,
        halign: "right"
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
        halign: "right"
      },
      footStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "right"
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });

    // Footer
    const y = doc.internal.pageSize.height - 15;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.line(10, y - 5, 287, y - 5);
    doc.text(data.companyName || "شركتك", 148, y, { align: "center" });

    const filename = `تقرير_يومي_${reportDate.replace(/-/g, '_')}.pdf`;
    doc.save(filename);
    
    console.log("✅ Daily report generated successfully");

  } catch (err) {
    console.error("❌ Daily report PDF error:", err);
    throw err;
  }
}

/* =====================================================
   🗓️ Monthly Report (تقرير شهري)
   ===================================================== */
export async function generateMonthlyReport(data, logoBase64 = "") {
  try {
    console.log("📄 Starting monthly report generation...", data);

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

    // Add Logo (top-left)
    addLogoToPDF(doc, logoBase64);

    // Header
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text("تقرير شهري", 105, 35, { align: "center" });

    // Company name and period
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(data.companyName || "شركتك", 105, 43, { align: "center" });
    
    doc.setFontSize(11);
    doc.text(`الفترة: ${data.period}`, 195, 50, { align: "right" });
    doc.text(`تاريخ الإصدار: ${formatArabicDate(new Date())}`, 15, 50);

    // Monthly Report Table
    const tableData = (data.workers || []).map(worker => {
      return [
        worker.name || "",
        worker.job_title || "عامل",
        worker.days_present || 0,
        worker.days_absent || 0,
        parseFloat(worker.total_hours || 0).toFixed(2),
        parseFloat(worker.earned || 0).toFixed(2),
        parseFloat(worker.advances || 0).toFixed(2),
        parseFloat(worker.net_amount || 0).toFixed(2)
      ];
    });

    // Calculate totals
    const totalPresent = tableData.reduce((sum, row) => sum + parseInt(row[2]), 0);
    const totalAbsent = tableData.reduce((sum, row) => sum + parseInt(row[3]), 0);
    const totalHours = tableData.reduce((sum, row) => sum + parseFloat(row[4]), 0);
    const totalEarned = tableData.reduce((sum, row) => sum + parseFloat(row[5]), 0);
    const totalAdvances = tableData.reduce((sum, row) => sum + parseFloat(row[6]), 0);
    const totalNet = totalEarned - totalAdvances;

    doc.autoTable({
      startY: 60,
      head: [[
        "الاسم",
        "الوظيفة",
        "أيام الحضور",
        "أيام الغياب",
        "الساعات",
        "المستحق",
        "السلف",
        "الصافي"
      ]],
      body: tableData,
      foot: [[
        "الإجمالي",
        "",
        totalPresent,
        totalAbsent,
        totalHours.toFixed(2),
        totalEarned.toFixed(2),
        totalAdvances.toFixed(2),
        totalNet.toFixed(2)
      ]],
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
      footStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "right"
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });

    // Summary section
    let y = doc.lastAutoTable.finalY + 15;
    
    doc.setFillColor(240, 248, 255);
    doc.rect(10, y - 5, 190, 25, 'F');
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    doc.text(`إجمالي أيام الحضور: ${totalPresent} يوم`, 195, y + 3, { align: "right" });
    y += 8;
    doc.text(`إجمالي أيام الغياب: ${totalAbsent} يوم`, 195, y + 3, { align: "right" });
    y += 8;
    
    // Highlight net total
    doc.setFillColor(0, 128, 0, 0.1);
    doc.rect(10, y - 2, 190, 10, 'F');
    doc.setFontSize(12);
    doc.setTextColor(0, 128, 0);
    doc.text(`الصافي الكلي: ${totalNet.toFixed(2)} جنيه`, 195, y + 5, { align: "right" });

    // Footer
    y = doc.internal.pageSize.height - 15;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.line(10, y - 5, 200, y - 5);
    doc.text(data.companyName || "شركتك", 105, y, { align: "center" });

    const filename = `تقرير_شهري_${data.period.replace(/[\/\s]/g, '-')}.pdf`;
    doc.save(filename);
    
    console.log("✅ Monthly report generated successfully");

  } catch (err) {
    console.error("❌ Monthly report PDF error:", err);
    throw err;
  }
}

export default {
  generateWorkerInvoice,
  generateCompanyInvoice,
  generateDailyReport,
  generateMonthlyReport
};