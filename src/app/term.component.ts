import { Component, Input, ElementRef, ViewChild, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipService } from './tooltip.service';

/**
 * Usage: <app-term lookup="Value Premise">Value</app-term>
 * This component wraps text in a dotted underline and triggers the global tooltip service.
 */
@Component({
  selector: 'app-term',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span #trigger 
          (mouseenter)="onEnter()" 
          (mouseleave)="onLeave()"
          class="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-4 decoration-2 hover:text-blue-600 hover:decoration-blue-400 transition-colors">
      <ng-content></ng-content>
    </span>
  `
})
export class TermComponent {
  @Input() lookup: string = ''; // Key to find in glossary.data.ts
  @ViewChild('trigger') trigger!: ElementRef; // Reference to the span element
  
  tooltipService = inject(TooltipService);

  onEnter() {
    // Get screen coordinates of this specific word
    const rect = this.trigger.nativeElement.getBoundingClientRect();
    this.tooltipService.show(this.lookup, rect);
  }

  onLeave() {
    this.tooltipService.hide();
  }

  // UX Polish: If user scrolls, hiding the tooltip prevents it from 
  // getting detached from the word.
  @HostListener('window:scroll')
  onScroll() {
    this.tooltipService.hide();
  }
}