import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DEBATE_TERMS } from './glossary.data';

@Component({
  selector: 'app-term',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="group relative inline-block">
      <span class="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-4 decoration-2 hover:text-blue-600 hover:decoration-blue-400 transition-colors">
        <ng-content></ng-content>
      </span>

      <div class="absolute left-1/2 -translate-x-1/2 mb-2 w-48 z-50 pointer-events-none 
                  opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 
                  transition-all duration-200 ease-out"
           [ngClass]="position === 'top' ? 'bottom-full pb-2' : 'top-full pt-2'">
        
        <div class="bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-700 relative">
          <div class="absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 border-slate-700"
               [ngClass]="position === 'top' ? '-bottom-1 border-b border-r' : '-top-1 border-t border-l'">
          </div>
          
          <span class="font-bold block mb-1 text-slate-300 uppercase text-[10px] tracking-wider">Definition</span>
          {{ definition() }}
        </div>
      </div>
    </span>
  `
})
export class TermComponent {
  @Input() lookup: string = ''; // The key to find in dictionary
  @Input() position: 'top' | 'bottom' = 'top'; // Where the popup appears

  definition = computed(() => {
    // If exact match fails, try fuzzy or return generic message
    return DEBATE_TERMS[this.lookup] || DEBATE_TERMS[this.lookup.trim()] || 'Definition not found.';
  });
}