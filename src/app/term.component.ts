import { Component, Input, ElementRef, ViewChild, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipService } from './tooltip.service';

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
  @Input() lookup: string = '';
  @ViewChild('trigger') trigger!: ElementRef;
  
  tooltipService = inject(TooltipService);

  onEnter() {
    const rect = this.trigger.nativeElement.getBoundingClientRect();
    this.tooltipService.show(this.lookup, rect);
  }

  onLeave() {
    this.tooltipService.hide();
  }

  // FIXED: Removed second argument ['$event']
  @HostListener('window:scroll')
  onScroll() {
    this.tooltipService.hide();
  }
}