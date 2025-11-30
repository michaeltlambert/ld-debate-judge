import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

@Injectable({ providedIn: 'root' })
export class PdfService {
  async generateBallotPdf(flowElementId: string, ballotElementId: string) {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const options = { backgroundColor: '#ffffff', pixelRatio: 2 };

      const ballotEl = document.getElementById(ballotElementId);
      if (!ballotEl) throw new Error(`Element #${ballotElementId} not found`);

      const ballotImgData = await toPng(ballotEl, options);
      const ballotProps = pdf.getImageProperties(ballotImgData);
      const ballotImgHeight = (ballotProps.height * pdfWidth) / ballotProps.width;

      pdf.setFontSize(18);
      pdf.text('Official Debate Ballot', 10, 15);
      pdf.addImage(ballotImgData, 'PNG', 0, 25, pdfWidth, ballotImgHeight);

      pdf.addPage();
      const flowEl = document.getElementById(flowElementId);
      if (!flowEl) throw new Error(`Element #${flowElementId} not found`);

      const originalOverflow = flowEl.style.overflow;
      flowEl.style.overflow = 'visible'; 

      const flowImgData = await toPng(flowEl, options);
      flowEl.style.overflow = originalOverflow;

      const flowProps = pdf.getImageProperties(flowImgData);
      const flowImgHeight = (flowProps.height * pdfWidth) / flowProps.width;

      pdf.text('Debate Flow / Notes', 10, 15);
      pdf.addImage(flowImgData, 'PNG', 0, 25, pdfWidth, flowImgHeight);

      pdf.save(`Debate_Ballot_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error('Export Failed:', err);
      alert('Could not generate PDF. Please try again.\nError: ' + err);
    }
  }
}