import { Component, signal, effect, inject, Input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TermComponent } from '../common/term.component';
import { DebateArgument, FrameworkData } from '../../core/models';

interface ColumnDef { id: string; name: string; isCx: boolean; }

@Component({
  selector: 'app-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, TermComponent],
  template: `
    <div id="debate-flow" class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col relative">
      <div *ngIf="readOnly()" class="absolute top-2 right-4 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded border border-amber-200 z-10">Read Only View</div>
      
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="font-bold text-slate-700">Interactive Flow Sheet</h2>
          <p class="text-xs text-slate-500">Star <span class="text-purple-600 font-bold">★ Voting Issues</span> to track winning arguments.</p>
        </div>
        <button *ngIf="!readOnly()" (click)="resetFlow()" class="text-xs text-red-400 hover:text-red-600 underline" aria-label="Clear All Notes">Clear All</button>
      </div>
      <div class="flex-1 overflow-x-auto pb-12" (click)="closeMenus()"> 
        <div class="flex h-full min-w-max divide-x divide-slate-200 border border-slate-200 rounded-lg bg-slate-50">
          <div *ngFor="let col of columns; let i = index" class="flex flex-col group transition-all" [ngClass]="col.isCx ? 'w-64 bg-amber-50/50' : 'w-80 bg-slate-50'">
            <div class="p-3 text-center text-xs font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-20 shadow-sm" [ngClass]="col.isCx ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'">{{ col.name }}</div>
            <div class="flex-1 p-2 space-y-3 overflow-y-auto min-h-[400px]">
              <div *ngIf="['1AC', '1NC'].includes(col.id)" class="mb-4 p-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50">
                <div class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 text-center">Framework</div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs font-bold text-indigo-700 w-16 text-right"><app-term lookup="Value Premise">Value</app-term>:</span>
                  <input type="text" [(ngModel)]="frameworks()[col.id].value" (ngModelChange)="emitChange()" [disabled]="readOnly()" placeholder="e.g. Justice" class="flex-1 text-sm font-bold text-indigo-900 bg-white border border-indigo-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Value Premise">
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-indigo-700 w-16 text-right"><app-term lookup="Value Criterion">Criterion</app-term>:</span>
                  <input type="text" [(ngModel)]="frameworks()[col.id].criterion" (ngModelChange)="emitChange()" [disabled]="readOnly()" placeholder="e.g. Social Welfare" class="flex-1 text-sm font-medium text-indigo-800 bg-white border border-indigo-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Value Criterion">
                </div>
              </div>
              <div *ngFor="let arg of getArgsForCol(i)" class="relative p-3 rounded-lg border shadow-sm transition-all group/card" [ngClass]="{'bg-purple-50 border-purple-300 ring-1 ring-purple-200 shadow-md': arg.isVoter, 'bg-green-50 border-green-200 opacity-70': !arg.isVoter && arg.status === 'addressed', 'bg-red-50 border-red-200': !arg.isVoter && arg.status === 'dropped', 'bg-white border-slate-200': !arg.isVoter && arg.status === 'open'}">
                <div *ngIf="isLinkedToPrevious(arg)" class="absolute -left-3 top-4 w-3 h-[2px] bg-slate-300"></div>
                <div *ngIf="editingId() !== arg.id" (click)="!readOnly() && editArg(arg.id, $event)" class="text-sm text-slate-800 whitespace-pre-wrap cursor-text min-h-[1.5rem]">{{ arg.text }}</div>
                <textarea *ngIf="editingId() === arg.id && !readOnly()" [(ngModel)]="arg.text" (blur)="stopEditing()" (click)="$event.stopPropagation()" (keydown.enter)="$event.preventDefault(); stopEditing()" class="w-full text-sm p-1 border rounded focus:ring-2 focus:ring-blue-500 bg-white" autoFocus></textarea>
                
                <div *ngIf="!readOnly()" class="mt-2 flex justify-between items-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <div class="flex gap-1 items-center">
                    <button (click)="setDrop(arg); $event.stopPropagation()" title="Drop" class="p-1 hover:text-red-600 text-slate-400"><span class="font-bold text-xs">✕</span></button>
                    <button (click)="setAddressed(arg); $event.stopPropagation()" title="Address" class="p-1 hover:text-green-600 text-slate-400"><span class="font-bold text-xs">✓</span></button>
                    <div class="w-px h-3 bg-slate-200 mx-1"></div>
                    <button (click)="toggleVoter(arg); $event.stopPropagation()" class="p-1 transition-colors" [class]="arg.isVoter ? 'text-purple-600' : 'text-slate-300 hover:text-purple-500'" title="Mark as Voting Issue"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd" /></svg></button>
                    <div class="w-px h-3 bg-slate-200 mx-1"></div>
                    <button (click)="deleteArg(arg); $event.stopPropagation()" title="Delete" class="p-1 hover:text-slate-600 text-slate-300"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                  <div class="relative">
                    <button *ngIf="i < columns.length - 1" (click)="toggleLinkMenu(arg.id, $event)" class="text-xs px-2 py-1 rounded border font-medium flex items-center gap-1 transition-colors" [ngClass]="col.isCx ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'" title="Link argument to previous point">Link ⤵</button>
                     <div *ngIf="activeLinkId() === arg.id" (click)="$event.stopPropagation()" class="absolute right-0 top-full mt-1 w-36 bg-white rounded shadow-lg border border-slate-200 z-50 flex flex-col py-1">
                      <button *ngFor="let target of getFutureColumns(i)" (click)="createLink(arg, target.idx)" class="text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 w-full">{{ target.name }}</button>
                    </div>
                  </div>
                </div>
                
                <div *ngIf="arg.status === 'dropped' && !arg.isVoter" class="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm z-10">DROP</div>
                <div *ngIf="arg.isVoter" class="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm z-10 flex items-center gap-1"><span>★</span> VOTER</div>
                <div class="mt-1 pt-1 border-t border-slate-100/50">
                   <input [(ngModel)]="arg.comments" (ngModelChange)="emitChange()" [disabled]="readOnly()" placeholder="Add note..." class="w-full text-[10px] p-0.5 bg-transparent border-none focus:ring-0 placeholder:text-slate-300 text-slate-500 italic">
                </div>
              </div>
              <div *ngIf="!readOnly()" class="mt-2"><input type="text" [placeholder]="col.isCx ? '+ Note Admission...' : '+ New Point...'" (keydown.enter)="addArg($event, i)" class="w-full text-xs p-2 bg-transparent border border-dashed border-slate-300 rounded hover:bg-white focus:ring-2 focus:ring-blue-500 transition-all" aria-label="Add new argument"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class FlowComponent {
  columns: ColumnDef[] = [
    { id: '1AC', name: '1. Affirmative Constructive', isCx: false },
    { id: 'CX1', name: 'Cross-Ex (Neg Questions)', isCx: true },
    { id: '1NC', name: '2. Negative Constructive', isCx: false },
    { id: 'CX2', name: 'Cross-Ex (Aff Questions)', isCx: true },
    { id: '1AR', name: '3. 1st Affirmative Rebuttal', isCx: false },
    { id: '2NR', name: '4. Negative Rebuttal', isCx: false },
    { id: '2AR', name: '5. 2nd Affirmative Rebuttal', isCx: false }
  ];
  
  arguments = signal<DebateArgument[]>([]);
  frameworks = signal<Record<string, FrameworkData>>({ '1AC': { value: '', criterion: '' }, '1NC': { value: '', criterion: '' } });
  editingId = signal<string | null>(null);
  activeLinkId = signal<string | null>(null);
  readOnly = signal(false);

  @Input() set viewOnlyFlow(data: { args: DebateArgument[], frameworks: Record<string, FrameworkData> } | undefined) {
      if (data) {
          this.arguments.set(data.args || []);
          this.frameworks.set(data.frameworks || { '1AC': { value: '', criterion: '' }, '1NC': { value: '', criterion: '' } });
          this.readOnly.set(true);
      } else {
          this.readOnly.set(false);
          this.loadData(); 
      }
  }

  flowChange = output<DebateArgument[]>();
  frameworksChange = output<Record<string, FrameworkData>>();

  constructor() {
    this.loadData();
  }

  emitChange() {
      if (this.readOnly()) return;
      this.flowChange.emit(this.arguments());
      this.frameworksChange.emit(this.frameworks());
      localStorage.setItem('ld-flow-args', JSON.stringify(this.arguments()));
      localStorage.setItem('ld-flow-frameworks', JSON.stringify(this.frameworks()));
  }

  internalReset() {
    this.arguments.set([]);
    this.frameworks.set({ '1AC': { value: '', criterion: '' }, '1NC': { value: '', criterion: '' } });
    this.editingId.set(null); this.activeLinkId.set(null);
    localStorage.setItem('ld-flow-args', '[]');
    localStorage.setItem('ld-flow-frameworks', JSON.stringify(this.frameworks()));
    this.emitChange();
  }

  loadData() {
    try {
      const savedArgs = localStorage.getItem('ld-flow-args');
      const savedFrames = localStorage.getItem('ld-flow-frameworks');
      if (savedArgs) this.arguments.set(JSON.parse(savedArgs));
      if (savedFrames) this.frameworks.set(JSON.parse(savedFrames));
    } catch(e) { this.arguments.set([]); }
  }

  toggleVoter(arg: DebateArgument) { if(!this.readOnly()) { this.arguments.update(args => args.map(a => a.id === arg.id ? { ...a, isVoter: !a.isVoter } : a)); this.emitChange(); }}
  
  createLink(originalArg: DebateArgument, targetIdx: number) { 
    if(this.readOnly()) return;
    this.updateArgStatus(originalArg.id, 'addressed');
    const isSkip = targetIdx > originalArg.colIdx + 1;
    const sourceName = this.columns[originalArg.colIdx].id; 
    const sourceIsCx = this.columns[originalArg.colIdx].isCx;
    let prefix = 'Ref:';
    if (sourceIsCx) prefix = 'Grant in CX:'; else if (isSkip) prefix = `Ref (${sourceName}):`;
    this.arguments.update(args => [...args, { id: crypto.randomUUID(), text: `${prefix} "${originalArg.text.substring(0, 15)}..."`, colIdx: targetIdx, status: 'open', parentId: originalArg.id, isVoter: false, comments: '' }]);
    this.activeLinkId.set(null);
    this.emitChange();
  }
  
  addArg(event: any, colIdx: number) { 
    if(this.readOnly()) return;
    const text = event.target.value.trim();
    if (!text) return;
    this.arguments.update(args => [...args, { id: crypto.randomUUID(), text, colIdx, status: 'open', parentId: null, isVoter: false, comments: '' }]);
    event.target.value = '';
    this.emitChange();
  }
  
  getArgsForCol(idx: number) { return this.arguments().filter(a => a.colIdx === idx); }
  getFutureColumns(currentIdx: number) { return this.columns.map((col, idx) => ({ name: col.id, isCx: col.isCx, idx })).filter(c => c.idx > currentIdx); }
  isLinkedToPrevious(arg: DebateArgument): boolean { if (!arg.parentId) return false; const parent = this.arguments().find(a => a.id === arg.parentId); return parent ? (arg.colIdx === parent.colIdx + 1) : false; }
  toggleLinkMenu(id: string, e: Event) { e.stopPropagation(); this.activeLinkId.set(this.activeLinkId() === id ? null : id); }
  closeMenus() { this.activeLinkId.set(null); }
  deleteArg(arg: DebateArgument) { if (!this.readOnly() && confirm('Delete note?')) { this.arguments.update(args => args.filter(a => a.id !== arg.id)); this.emitChange(); } }
  setDrop(arg: DebateArgument) { if(!this.readOnly()) { this.updateArgStatus(arg.id, 'dropped'); this.emitChange(); } }
  setAddressed(arg: DebateArgument) { if(!this.readOnly()) { this.updateArgStatus(arg.id, 'addressed'); this.emitChange(); } }
  updateArgStatus(id: string, status: any) { this.arguments.update(args => args.map(a => a.id === id ? { ...a, status } : a)); }
  editArg(id: string, e: Event) { if(!this.readOnly()) { e.stopPropagation(); this.editingId.set(id); } }
  stopEditing() { this.editingId.set(null); this.emitChange(); }
  resetFlow() { if(!this.readOnly() && confirm('Clear all notes?')) this.internalReset(); }
}