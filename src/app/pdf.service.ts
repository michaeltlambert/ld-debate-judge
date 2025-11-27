import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

@Injectable({ providedIn: 'root' })
export class PdfService {

  async generateBallotPdf(flowElementId: string, ballotElementId: string) {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Configuration to ensure white background and proper sizing
      const options = { 
        backgroundColor: '#ffffff',
        pixelRatio: 2 // High resolution
      };

      // --- PAGE 1: BALLOT ---
      const ballotEl = document.getElementById(ballotElementId);
      if (!ballotEl) throw new Error(`Element #${ballotElementId} not found`);

      // Convert DOM to PNG Data URL
      const ballotImgData = await toPng(ballotEl, options);
      
      // Calculate aspect ratio to fit image on PDF
      const ballotProps = pdf.getImageProperties(ballotImgData);
      const ballotImgHeight = (ballotProps.height * pdfWidth) / ballotProps.width;

      pdf.setFontSize(18);
      pdf.text('Official Debate Ballot', 10, 15);
      pdf.addImage(ballotImgData, 'PNG', 0, 25, pdfWidth, ballotImgHeight);

      // --- PAGE 2: FLOW SHEET ---
      pdf.addPage();
      const flowEl = document.getElementById(flowElementId);
      if (!flowEl) throw new Error(`Element #${flowElementId} not found`);

      // We need to temporarily force the flow container to be fully visible (no scroll)
      // to capture the whole thing, then revert it.
      const originalOverflow = flowEl.style.overflow;
      flowEl.style.overflow = 'visible'; // Force full render

      const flowImgData = await toPng(flowEl, options);
      
      // Restore scroll
      flowEl.style.overflow = originalOverflow;

      const flowProps = pdf.getImageProperties(flowImgData);
      // Fit to width, allow height to expand
      const flowImgHeight = (flowProps.height * pdfWidth) / flowProps.width;

      // Handle multi-page flow if it's too long (Basic implementation: Shrink to fit or just print)
      // For now, we scale to width.
      pdf.text('Debate Flow / Notes', 10, 15);
      
      // If flow is massive, we might want to scale it down, but let's stick to standard width
      pdf.addImage(flowImgData, 'PNG', 0, 25, pdfWidth, flowImgHeight);

      // Save
      pdf.save(`Debate_Ballot_${new Date().toISOString().slice(0,10)}.pdf`);

    } catch (err) {
      console.error('Export Failed:', err);
      alert('Could not generate PDF. Please try again.\nError: ' + err);
    }
  }
}