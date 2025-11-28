import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipService } from './tooltip.service';

/**
 * This component lives at the root of app.component.
 * It has position: fixed and z-index: 9999.
 * This ensures tooltips are never "cut off" by scrolling containers in the Flow Sheet.
 */
@Component({
  selector: 'app-global-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="svc.isVisible()"
         class="fixed z-[9999] pointer-events-none transition-opacity duration-200"
         [style.top.px]="svc.coords().y"
         [style.left.px]="svc.coords().x"
         style="transform: translateX(-50%);"> <!-- Center align logic -->
      
      <div class="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-2xl border border-slate-700 w-48 relative animate-in fade-in zoom-in-95 duration-100">
        
        <!-- CSS Triangle Arrow -->
        <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-t border-l border-slate-700"></div>
        
        <!-- Content -->
        <span class="font-bold block mb-1 text-slate-300 uppercase text-[10px] tracking-wider">Definition</span>
        <p class="leading-relaxed">{{ svc.text() }}</p>
      </div>
    </div>
  `
})
export class GlobalTooltipComponent {
  svc = inject(TooltipService); // Public so template can access signals
}