// backend/utils/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generateInvoice(data, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(outputPath);
      
      doc.pipe(stream);

      // Add logo if exists
      const logoPath = path.join(__dirname, '../../icon.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 80 });
      }

      // Header
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('فاتورة', 400, 50, { align: 'right' });

      doc.fontSize(10)
         .font('Helvetica')
         .text(`رقم الفاتورة: ${data.invoiceNumber}`, 400, 75, { align: 'right' })
         .text(`التاريخ: ${data.date}`, 400, 90, { align: 'right' });

      // Worker info
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('بيانات العامل:', 50, 150, { align: 'right' });

      doc.fontSize(10)
         .font('Helvetica')
         .text(`الاسم: ${data.workerName}`, 50, 170, { align: 'right' })
         .text(`الوظيفة: ${data.jobTitle}`, 50, 185, { align: 'right' });

      // Period
      doc.fontSize(10)
         .text(`الفترة: ${data.period}`, 50, 210, { align: 'right' });

      // Line
      doc.moveTo(50, 240)
         .lineTo(550, 240)
         .stroke();

      // Table header
      let yPosition = 260;
      doc.fontSize(11)
         .font('Helvetica-Bold');
      
      doc.text('الإجمالي', 420, yPosition, { width: 100, align: 'right' });
      doc.text('السعر', 330, yPosition, { width: 80, align: 'right' });
      doc.text('العدد', 240, yPosition, { width: 80, align: 'right' });
      doc.text('البيان', 50, yPosition, { width: 180, align: 'right' });

      // Line under header
      yPosition += 20;
      doc.moveTo(50, yPosition)
         .lineTo(550, yPosition)
         .stroke();

      // Items
      yPosition += 20;
      doc.font('Helvetica')
         .fontSize(10);

      // Work hours
      doc.text(`${(data.totalHours * data.hourlyRate).toFixed(2)} جنيه`, 420, yPosition, { width: 100, align: 'right' });
      doc.text(`${data.hourlyRate} جنيه`, 330, yPosition, { width: 80, align: 'right' });
      doc.text(`${data.totalHours} ساعة`, 240, yPosition, { width: 80, align: 'right' });
      doc.text('ساعات العمل', 50, yPosition, { width: 180, align: 'right' });

      // Days present
      yPosition += 25;
      doc.text('', 420, yPosition, { width: 100, align: 'right' });
      doc.text('', 330, yPosition, { width: 80, align: 'right' });
      doc.text(`${data.daysPresent} يوم`, 240, yPosition, { width: 80, align: 'right' });
      doc.text('أيام الحضور', 50, yPosition, { width: 180, align: 'right' });

      // Days absent
      yPosition += 25;
      doc.text('', 420, yPosition, { width: 100, align: 'right' });
      doc.text('', 330, yPosition, { width: 80, align: 'right' });
      doc.text(`${data.daysAbsent} يوم`, 240, yPosition, { width: 80, align: 'right' });
      doc.text('أيام الغياب', 50, yPosition, { width: 180, align: 'right' });

      // Line before advances
      if (data.totalAdvances && data.totalAdvances > 0) {
        yPosition += 35;
        doc.moveTo(50, yPosition)
           .lineTo(550, yPosition)
           .stroke();

        // Advances
        yPosition += 20;
        doc.fillColor('red')
           .text(`-${data.totalAdvances.toFixed(2)} جنيه`, 420, yPosition, { width: 100, align: 'right' });
        doc.fillColor('black')
           .text('', 330, yPosition, { width: 80, align: 'right' })
           .text('', 240, yPosition, { width: 80, align: 'right' })
           .text('السلف المدفوعة', 50, yPosition, { width: 180, align: 'right' });
      }

      // Line before total
      yPosition += 35;
      doc.moveTo(50, yPosition)
         .lineTo(550, yPosition)
         .stroke();

      // Total
      yPosition += 20;
      const netAmount = (data.totalHours * data.hourlyRate) - (data.totalAdvances || 0);
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text(`${netAmount.toFixed(2)} جنيه`, 420, yPosition, { width: 100, align: 'right' })
         .text('صافي المستحق', 50, yPosition, { width: 180, align: 'right' });

      // Footer
      doc.fontSize(8)
         .font('Helvetica')
         .text('تم إنشاء هذه الفاتورة آلياً بواسطة نظام الحضور والانصراف', 50, 750, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve(outputPath);
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateInvoice };