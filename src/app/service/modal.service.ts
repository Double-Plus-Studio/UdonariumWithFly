import { ComponentRef, Injectable, Injector, OnChanges, ViewContainerRef } from '@angular/core';

class ModalContext {
  constructor(
    private _resolve: ((value?: unknown) => void) | null,
    private _reject: ((reason?: unknown) => void) | null,
    public option?: any
  ) {
  }
  resolve(value: any) {
    if (this._resolve) this._resolve(value);
    this._resolve = null;
  }
  reject(reason?: any) {
    if (this._reject) this._reject(reason);
    this._reject = null;
  }
}

@Injectable()
export class ModalService {
  private modalContext: ModalContext | null = null;
  private count = 0;

  title: string = '無名對話框';

  /* Todo */
  static defaultParentViewContainerRef: ViewContainerRef;
  static ModalComponentClass: { new(...args: any[]): any } | null = null;

  get option(): any {
    return this.modalContext ? this.modalContext.option : null;
  }

  get isShow(): boolean {
    return this.count > 0;
  }

  open<T>(childComponent: { new(...args: any[]) }, option?, parentViewContainerRef?: ViewContainerRef): Promise<T> {
    if (!parentViewContainerRef) {
      parentViewContainerRef = ModalService.defaultParentViewContainerRef;
    }
    return new Promise<T>((resolve, reject) => {
      // Injector 作成
      const _resolve = (val: T) => {
        if (panelComponentRef) {
          panelComponentRef.destroy();
          resolve(val);
          this.count--;
        }
      };

      const _reject = (reason?: any) => {
        if (panelComponentRef) {
          panelComponentRef.destroy();
          reject(reason);
          this.count--;
        }
      };

      const childModalService: ModalService = new ModalService();
      childModalService.modalContext = new ModalContext(_resolve, _reject, option);

      const parentInjector = parentViewContainerRef.injector;
      const injector = Injector.create({ providers: [{ provide: ModalService, useValue: childModalService }], parent: parentInjector });

      const panelComponentRef: ComponentRef<any> = parentViewContainerRef.createComponent(ModalService.ModalComponentClass!, { index: parentViewContainerRef.length, injector: injector });
      const bodyComponentRef: ComponentRef<any> = panelComponentRef.instance.content.createComponent(childComponent);

      let panelRef = panelComponentRef;
      let bodyRef = bodyComponentRef;

      panelComponentRef.onDestroy(() => {
        panelRef = null as any;
        this.count--;
      });

      bodyComponentRef.onDestroy(() => {
        bodyRef = null as any;
        this.count--;
      });

      this.count++;

      const panelOnChanges = panelComponentRef.instance as OnChanges;
      const bodyOnChanges = bodyComponentRef.instance as OnChanges;
      if (panelOnChanges?.ngOnChanges != null || bodyOnChanges?.ngOnChanges != null) {
        queueMicrotask(() => {
          if (bodyComponentRef) bodyOnChanges?.ngOnChanges({});
          if (panelComponentRef) panelOnChanges?.ngOnChanges({});
        });
      }
    });
  }

  resolve(value?: any) {
    if (this.modalContext) {
      this.modalContext.resolve(value);
      this.modalContext = null;
    }
  }

  reject(reason?: any) {
    if (this.modalContext) {
      this.modalContext.reject(reason);
      this.modalContext = null;
    }
  }
}