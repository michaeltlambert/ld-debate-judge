import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

@Injectable({ providedIn: 'root' })
export class PdfService {

  /**
   * Generates a 2-page PDF.
   * Page 1: The Ballot (Scoring)
   * Page 2: The Flow (Notes)
   */
  async generateBallotPdf(flowElementId: string, ballotElementId: string) {
    try {
      // Create A4 PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      const options = { 
        backgroundColor: '#ffffff',
        pixelRatio: 2 // 2x resolution for crisp text
      };

      // --- PAGE 1: BALLOT ---
      const ballotEl = document.getElementById(ballotElementId);
      if (!ballotEl) throw new Error(`Element #${ballotElementId} not found`);

      // Library Change: We use html-to-image because html2canvas crashes on 
      // Tailwind v4's 'oklch' color syntax.
      const ballotImgData = await toPng(ballotEl, options);
      
      const ballotProps = pdf.getImageProperties(ballotImgData);
      const ballotImgHeight = (ballotProps.height * pdfWidth) / ballotProps.width;

      pdf.setFontSize(18);
      pdf.text('Official Debate Ballot', 10, 15);
      pdf.addImage(ballotImgData, 'PNG', 0, 25, pdfWidth, ballotImgHeight);

      // --- PAGE 2: FLOW SHEET ---
      pdf.addPage();
      const flowEl = document.getElementById(flowElementId);
      if (!flowEl) throw new Error(`Element #${flowElementId} not found`);

      // HACK: The Flow Sheet usually has scrollbars (overflow: auto).
      // If we snapshot it as-is, we only get the visible part.
      // We temporarily set it to 'visible' to force the browser to render the WHOLE list.
      const originalOverflow = flowEl.style.overflow;
      flowEl.style.overflow = 'visible'; 

      const flowImgData = await toPng(flowEl, options);
      
      // Restore scroll immediately after snapshot
      flowEl.style.overflow = originalOverflow;

      const flowProps = pdf.getImageProperties(flowImgData);
      const flowImgHeight = (flowProps.height * pdfWidth) / flowProps.width;

      pdf.text('Debate Flow / Notes', 10, 15);
      pdf.addImage(flowImgData, 'PNG', 0, 25, pdfWidth, flowImgHeight);

      // Trigger download
      pdf.save(`Debate_Ballot_${new Date().toISOString().slice(0,10)}.pdf`);

    } catch (err) {
      console.error('Export Failed:', err);
      alert('Could not generate PDF. Please try again.\nError: ' + err);
    }
  }
}