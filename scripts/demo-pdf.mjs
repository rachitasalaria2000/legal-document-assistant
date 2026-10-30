import PDFDocument from 'pdfkit';
import {createWriteStream} from 'node:fs';
import {mkdir} from 'node:fs/promises';
await mkdir('demo',{recursive:true});
const pdf=new PDFDocument({autoFirstPage:false});pdf.pipe(createWriteStream('demo/sample-services-agreement.pdf'));
const sections=[
 ['1. SERVICES AND TERM','This fictional agreement is between Acorn Studio and Northbank Ltd. Services begin on 1 January 2026 and continue for twelve months. The supplier provides monthly software maintenance and support.'],
 ['2. PAYMENT OBLIGATIONS','The customer must pay each undisputed invoice within 30 days of receipt. Monthly fees are INR 50,000. Disputed amounts must be notified in writing within 10 days. Late undisputed amounts accrue simple interest at 1 percent per month. Payment obligations for services already performed survive termination.'],
 ['3. CONFIDENTIALITY','Both parties must protect confidential information and use it only to perform this agreement. Confidentiality continues for three years after termination. Public information and independently developed information are excluded.'],
 ['4. TERMINATION','Either party may terminate for a material breach that remains uncured for 15 days after written notice. The customer may terminate for convenience with 30 days written notice. On termination, the customer must pay all undisputed fees for services performed through the effective termination date, as described in section 2. No future monthly fees become due solely because of termination.'],
 ['5. LIABILITY AND RETURN OF DATA','Each party limits aggregate liability to fees paid during the previous six months, except for fraud and deliberate confidentiality violations. Within 20 days after termination, the supplier must return customer data and delete remaining copies, except records required by law. This document intentionally does not specify a governing law or arbitration venue.'],
];
for(const [index,[heading,text]] of sections.entries()){pdf.addPage();pdf.fontSize(11).text('SAMPLE ONLY — Fictional services agreement');pdf.moveDown(3);pdf.fontSize(18).text(heading);pdf.moveDown();pdf.fontSize(12).text(text,{lineGap:7});pdf.fontSize(10).text(`Page ${index+1}`,50,700);}
pdf.end();console.log('Created demo/sample-services-agreement.pdf');
