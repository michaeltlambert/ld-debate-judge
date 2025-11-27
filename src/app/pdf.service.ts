import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({ providedIn: 'root' })
export class PdfService {

  async generateBallotPdf(flowElementId: string, ballotElementId: string) {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const options = { scale: 2 }; // Improves resolution

    // 1. Capture the Ballot (Page 1)
    const ballotEl = document.getElementById(ballotElementId);
    if (ballotEl) {
      const canvas = await html2canvas(ballotEl, options);
      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.setFontSize(18);
      pdf.text('Official Debate Ballot', 10, 15);
      pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, pdfHeight);
    }

    // 2. Add New Page for the Flow
    pdf.addPage();

    // 3. Capture the Flow Sheet (Page 2)
    const flowEl = document.getElementById(flowElementId);
    if (flowEl) {
      const canvas = await html2canvas(flowEl, options);
      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      // Calculate height to fit page, allowing for long flows
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.setFontSize(18);
      pdf.text('Debate Flow / Notes', 10, 15);
      pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, pdfHeight);
    }

    // 4. Save
    pdf.save(`Debate_Ballot_${new Date().toISOString().slice(0,10)}.pdf`);
  }
}