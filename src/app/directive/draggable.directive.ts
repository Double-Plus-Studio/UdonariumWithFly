import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output } from '@angular/core';
import { MathUtil } from '@udonarium/core/system/util/math-util';
import { CSSNumber } from '@udonarium/transform/css-number';
import { PointerCoordinate } from 'service/pointer-device.service';

import { InputHandler } from './input-handler';

@Directive({
    selector: '[appDraggable]',
    standalone: false
})
export class DraggableDirective implements AfterViewInit, OnDestroy {
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('draggable.disable') isDisable: boolean = false;
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('draggable.bounds') boundsSelector: string = 'body';
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('draggable.handle') handleSelector: string = '';
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('draggable.unhandle') unhandleSelector: string = 'input,textarea,button,select,option,span,label,li';
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('draggable.stack') stackSelector: string = '';
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('draggable.opacity') opacity: number = 0.7;
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('draggable.allowOverHalf') allowOverHalf: boolean = false;

  // eslint-disable-next-line @angular-eslint/no-output-rename
  @Output('draggable.start') onstart: EventEmitter<MouseEvent | TouchEvent> = new EventEmitter();
  // eslint-disable-next-line @angular-eslint/no-output-rename
  @Output('draggable.move') onmove: EventEmitter<MouseEvent | TouchEvent> = new EventEmitter();
  // eslint-disable-next-line @angular-eslint/no-output-rename
  @Output('draggable.end') onend: EventEmitter<MouseEvent | TouchEvent> = new EventEmitter();

  private callbackOnResize = this.adjustPosition.bind(this);

  private input: InputHandler | null = null;
  private startPosition: PointerCoordinate = { x: 0, y: 0, z: 0 };
  private startPointer: PointerCoordinate = { x: 0, y: 0, z: 0 };
  private prevTrans: PointerCoordinate = { x: 0, y: 0, z: 0 };

  constructor(
    private ngZone: NgZone,
    private elementRef: ElementRef<HTMLElement>
  ) { }

  ngAfterViewInit() {
    this.initialize();
    this.adjustPosition();
    this.setForeground();
  }

  ngOnDestroy() {
    this.cancel();
    this.destroy();
  }

  private initialize() {
    this.ngZone.runOutsideAngular(() => {
      this.input = new InputHandler(this.elementRef.nativeElement);
      window.addEventListener('resize', this.callbackOnResize, false);
    });
    if (this.input) {
      this.input.onStart = this.onInputStart.bind(this);
      this.input.onMove = this.onInputMove.bind(this);
      this.input.onEnd = this.onInputEnd.bind(this);
      this.input.onContextMenu = this.onContextMenu.bind(this);
    }
  }

  cancel() {
    this.input?.cancel();
  }

  destroy() {
    window.removeEventListener('resize', this.callbackOnResize, false);
    this.input?.destroy();
  }

  private onInputStart(e: MouseEvent | TouchEvent) {
    if (this.isDisable) return this.cancel();
    if ((e as MouseEvent).button === 1 || (e as MouseEvent).button === 2) return this.cancel();
    this.setForeground();
    this.startPosition = this.calcElementPosition(this.elementRef.nativeElement);

    this.startPointer = this.input?.pointer ?? { x: 0, y: 0, z: 0 };
    this.prevTrans = { x: 0, y: 0, z: 0 };

    const isHandle = this.isHandleElement(e.target as HTMLElement);
    const isUnhandle = this.isUnhandleElement(e.target as HTMLElement);
    const isScrollable = (e as TouchEvent).touches != null ? this.isScrollableElement(e.target as HTMLElement) : false;

    if (!isHandle || isUnhandle || isScrollable) {
      this.cancel();
      return;
    }
    this.elementRef.nativeElement.style.cursor = 'grabbing';

    this.removeSelectionRanges();
    this.removeFocus();
    e.stopPropagation();
  }

  private onInputMove(e: MouseEvent | TouchEvent) {
    if (!this.input) return;
    const trans = {
      x: this.input.pointer.x - this.startPointer.x,
      y: this.input.pointer.y - this.startPointer.y,
      z: this.input.pointer.z - this.startPointer.z
    };

    const diff = {
      x: trans.x - this.prevTrans.x,
      y: trans.y - this.prevTrans.y,
      z: trans.z - this.prevTrans.z
    };

    const correction = this.calcCorrectionPosition(diff);
    trans.x += correction.x;
    trans.y += correction.y;
    trans.z += correction.z;

    if (0 < MathUtil.sqrMagnitude(trans)) {
      this.elementRef.nativeElement.style.opacity = this.opacity + '';
    }

    this.elementRef.nativeElement.style.willChange = 'top, left';
    this.elementRef.nativeElement.style.left = trans.x + this.startPosition.x + 'px';
    this.elementRef.nativeElement.style.top = trans.y + this.startPosition.y + 'px';
    this.elementRef.nativeElement.style.cursor = 'grabbing';

    this.prevTrans = trans;

    this.removeSelectionRanges();
    this.removeFocus();
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }

  private onInputEnd(e: MouseEvent | TouchEvent) {
    this.elementRef.nativeElement.style.opacity = '';
    this.elementRef.nativeElement.style.cursor = '';
    this.elementRef.nativeElement.style.willChange = '';
    if (this.input?.isDragging && e.cancelable) {
      this.preventClickIfNeeded(e);
      e.preventDefault();
    }
    e.stopPropagation();
  }

  private onContextMenu(e: MouseEvent | TouchEvent) {
    e.stopPropagation();
  }

  private preventClickIfNeeded(e: MouseEvent | TouchEvent) {
    if ((e as TouchEvent).touches != null) return;
    if (!this.input) return;

    const distance = MathUtil.sqrMagnitude(this.input.pointer, this.startPointer);

    if (15 ** 2 > distance) return;

    const callback = (e: Event) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    };

    this.elementRef.nativeElement.addEventListener('click', callback, true);
    queueMicrotask(() => this.elementRef.nativeElement.removeEventListener('click', callback, true));
  }

  private adjustPosition() {
    const current = this.calcElementPosition(this.elementRef.nativeElement);
    const correction = this.calcCorrectionPosition();
    this.elementRef.nativeElement.style.left = correction.x + current.x + 'px';
    this.elementRef.nativeElement.style.top = correction.y + current.y + 'px';
  }

  private isHandleElement(target: HTMLElement): boolean {
    if (this.handleSelector.length < 1) return true;
    return this.isContainsElement(target, this.handleSelector);
  }

  private isUnhandleElement(target: HTMLElement): boolean {
    if (this.unhandleSelector.length < 1) return false;
    return this.isContainsElement(target, this.unhandleSelector);
  }

  private isContainsElement(target: HTMLElement, selectors: string): boolean {
    const elms = this.elementRef.nativeElement.querySelectorAll<HTMLElement>(selectors);
    for (let i = 0; i < elms.length; i++) {
      if (elms[i].contains(target)) return true;
    }
    return false;
  }

  private isScrollableElement(target: HTMLElement) {
    const boundsElm = this.elementRef.nativeElement.ownerDocument.querySelector(this.boundsSelector);
    let node: HTMLElement | null = target;
    const overflowType = ['scroll', 'auto'];
    const positionType = ['fixed', 'sticky', '-webkit-sticky'];
    while (node && boundsElm !== node && this.elementRef.nativeElement !== node) {
      const css: CSSStyleDeclaration = window.getComputedStyle(node);
      if (0 <= overflowType.indexOf(css.overflowY) && node.offsetHeight < node.scrollHeight) return true;
      if (0 <= positionType.indexOf(css.position)) return false;
      node = node.parentElement;
    }
    return false;
  }

  private calcCorrectionPosition(diff: PointerCoordinate = { x: 0, y: 0, z: 0 }): PointerCoordinate {
    const correction: PointerCoordinate = { x: 0, y: 0, z: 0 };
    const box = this.elementRef.nativeElement.getBoundingClientRect();
    const bounds = this.elementRef.nativeElement.ownerDocument.querySelector(this.boundsSelector)!.getBoundingClientRect();

    if (this.allowOverHalf) {
      const boxWidth = box.right - box.left;
      const boxHeight = box.bottom - box.top;
      if (bounds.right + boxWidth / 2 < box.right + diff.x) {
        correction.x += bounds.right + boxWidth / 2 - (box.right + diff.x);
      }
      if (box.left + diff.x < bounds.left - boxWidth / 2) {
        correction.x += bounds.left - boxWidth / 2 - (box.left + diff.x);
      }
      if (bounds.bottom + boxHeight / 2 < box.bottom + diff.y) {
        correction.y += bounds.bottom + boxHeight / 2 - (box.bottom + diff.y);
      }
      if (box.top + diff.y < bounds.top - boxHeight / 2) {
        correction.y += bounds.top - boxHeight / 2 - (box.top + diff.y);
      }
    } else {
      if (bounds.right < box.right + diff.x) {
        correction.x += bounds.right - (box.right + diff.x);
      }
      if (box.left + diff.x < bounds.left) {
        correction.x += bounds.left - (box.left + diff.x);
      }
      if (bounds.bottom < box.bottom + diff.y) {
        correction.y += bounds.bottom - (box.bottom + diff.y);
      }
      if (box.top + diff.y < bounds.top) {
        correction.y += bounds.top - (box.top + diff.y);
      }
    }
    return correction;
  }

  private calcElementPosition(target: HTMLElement): PointerCoordinate {
    const css: CSSStyleDeclaration = window.getComputedStyle(target);
    return {
      x: CSSNumber.relation(css.left, target.parentElement!.offsetWidth, target.parentElement!.offsetWidth * 0.5),
      y: CSSNumber.relation(css.top, target.parentElement!.offsetHeight, target.parentElement!.offsetHeight * 0.5),
      z: 0
    };
  }

  private setForeground() {
    if (this.stackSelector.length < 1) return;
    const stacks = this.elementRef.nativeElement.ownerDocument.querySelectorAll<HTMLElement>(this.stackSelector);
    let topZindex: number = 0;
    let bottomZindex: number = 99999;
    stacks.forEach(elm => {
      const zIndex = parseInt(elm.style.zIndex);
      if (topZindex < zIndex) topZindex = zIndex;
      if (zIndex < bottomZindex) bottomZindex = zIndex;
    });

    if (topZindex <= parseInt(this.elementRef.nativeElement.style.zIndex)) return;

    stacks.forEach(elm => {
      elm.style.zIndex = (parseInt(elm.style.zIndex) - bottomZindex) + '';
    });
    this.elementRef.nativeElement.style.zIndex = (topZindex + 1) + '';
  }

  private removeSelectionRanges() {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      selection.removeAllRanges();
    }
  }

  private removeFocus() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }
}
