import { animate, keyframes, state, style, transition, trigger } from '@angular/animations';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { Card, CardState } from '@udonarium/card';
import { CardStack } from '@udonarium/card-stack';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { TabletopObject } from '@udonarium/tabletop-object';
import { EventSystem, Network } from '@udonarium/core/system';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { MathUtil } from '@udonarium/core/system/util/math-util';
import { PeerCursor } from '@udonarium/peer-cursor';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { OpenUrlComponent } from 'component/open-url/open-url.component';
import { ObjectInteractGesture } from 'component/game-table/object-interact-gesture';
import { MovableOption } from 'directive/movable.directive';
import { RotableOption } from 'directive/rotable.directive';
import { ContextMenuAction, ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { ImageService } from 'service/image.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { SelectionState, TabletopSelectionService } from 'service/tabletop-selection.service';
import { TabletopService } from 'service/tabletop.service';
import { ModalService } from 'service/modal.service';
import { ChatMessageService } from 'service/chat-message.service';

@Component({
    selector: 'card',
    templateUrl: './card.component.html',
    styleUrls: ['./card.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [
        trigger('inverse', [
            state('inverse', style({ transform: '' })),
            transition(':increment, :decrement', [
                animate('200ms ease', keyframes([
                    style({ transform: 'scale3d(1.0, 1.0, 1.0)', offset: 0 }),
                    style({ transform: 'scale3d(0.6, 1.2, 1.2)', offset: 0.5 }),
                    style({ transform: 'scale3d(0, 0.75, 0.75)', offset: 0.75 }),
                    style({ transform: 'scale3d(0.5, 1.125, 1.125)', offset: 0.875 }),
                    style({ transform: 'scale3d(1.0, 1.0, 1.0)', offset: 1.0 })
                ]))
            ])
        ]),
        trigger('flipOpen', [
            transition(':enter', [
                animate('200ms ease', keyframes([
                    style({ transform: 'scale3d(0, 1.0, 1.0)', offset: 0 }),
                    style({ transform: 'scale3d(0, 1.2, 1.2)', offset: 0.5 }),
                    style({ transform: 'scale3d(0, 0.75, 0.75)', offset: 0.75 }),
                    style({ transform: 'scale3d(0.5, 1.125, 1.125)', offset: 0.875 }),
                    style({ transform: 'scale3d(1.0, 1.0, 1.0)', offset: 1.0 })
                ]))
            ])
        ]),
        trigger('slidInOut', [
            transition('void => *', [
                animate('200ms ease', keyframes([
                    style({ 'transform-origin': 'left center', transform: 'scale3d(0, 1.0, 1.0)', offset: 0 }),
                    style({ 'transform-origin': 'left center', transform: 'scale3d(1.0, 1.0, 1.0)', offset: 1.0 })
                ]))
            ]),
            transition('* => void', [
                animate(100, style({ 'transform-origin': 'left center', transform: 'scale3d(0, 1.0, 1.0)' }))
            ])
        ])
    ],
    standalone: false
})
export class CardComponent implements OnDestroy, OnChanges, AfterViewInit {
  @Input() card: Card | null = null;
  @Input() is3D: boolean = false;
  @ViewChild('cardImage', { static: false }) cardImageElement: ElementRef<HTMLImageElement>;
  @ViewChild('translucentImage', { static: false }) translucentImageElement: ElementRef<HTMLImageElement>;

  get name(): string { return this.card?.name ?? ''; }
  get state(): CardState { return this.card?.state ?? (CardState as any).NORMAL; }
  set state(state: CardState) { if (this.card) this.card.state = state; }
  get rotate(): number { return this.card?.rotate ?? 0; }
  set rotate(rotate: number) { if (this.card) this.card.rotate = rotate; }
  get owner(): string { return this.card?.owner ?? ''; }
  set owner(owner: string) { if (this.card) this.card.owner = owner; }
  get zindex(): number { return this.card?.zindex ?? 0; }
  get size(): number { return MathUtil.clampMin(this.card?.size ?? 0); }

  get fontSize(): number { return this.card?.fontsize ?? 14; }
  set fontSize(fontSize: number) { if (this.card) this.card.fontsize = fontSize; }
  get text(): string { return this.card?.text ?? ''; }
  set text(text: string) { if (this.card) this.card.text = text; }
  get color(): string { return this.card?.color ?? '#000000'; }
  set color(color: string) { if (this.card) this.card.color = color; }

  get textShadowCss(): string {
    const shadow = StringUtil.textShadowColor(this.color);
    return `${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px,
    ${shadow} 0px 0px 2px,
    ${shadow} 0px 0px 2px`;
  }

  get isHand(): boolean { return this.card?.isHand ?? false; }
  get isFront(): boolean { return this.card?.isFront ?? false; }
  get isVisible(): boolean { return this.card?.isVisible ?? true; }
  get hasOwner(): boolean { return this.card?.hasOwner ?? false; }
  get ownerIsOnline(): boolean { return this.card?.ownerIsOnline ?? false; }
  get ownerName(): string { return this.card?.ownerName ?? ''; }
  get ownerColor(): string { return this.card?.ownerColor ?? ''; }

  get isGMMode(): boolean { return this.card?.isGMMode ?? false; }

  get imageFile(): ImageFile { return this.imageService.getSkeletonOr(this.card?.imageFile as ImageFile); }
  get frontImage(): ImageFile { return this.imageService.getSkeletonOr(this.card?.frontImage as ImageFile); }
  get backImage(): ImageFile { return this.imageService.getSkeletonOr(this.card?.backImage as ImageFile); }

  get selectionState(): SelectionState { return this.selectionService.state(this.card as TabletopObject); }
  get isSelected(): boolean { return this.selectionState !== SelectionState.NONE; }
  get isMagnetic(): boolean { return this.selectionState === SelectionState.MAGNETIC; }

  private iconHiddenTimer: NodeJS.Timeout | null = null;
  get isIconHidden(): boolean { return this.iconHiddenTimer != null };

  get rubiedText(): string { return StringUtil.rubyToHtml(StringUtil.escapeHtml(this.card?.text ?? '')) }

  get isLocked(): boolean { return this.card ? this.card.isLocked : false; }
  set isLocked(isLocked: boolean) { if (this.card) this.card.isLocked = isLocked; }

  get isInverse(): boolean {
    const rotate = Math.abs(this.viewRotateZ + this.rotate) % 360;
    return 90 < rotate && rotate < 270
  }

  gridSize: number = 50;

  movableOption: MovableOption = {};
  rotableOption: RotableOption = {};
  
  viewRotateZ = 10;

  frontImageClientHeight = 0;
  backImageClientHeight = 0;
  get textDivTopPixcel(): number {
    return this.isFront ? 0 : ((this.backImageClientHeight - this.frontImageClientHeight) / 2);
  }
  get textDivHeightCss(): string {
    return (this.isFront || !this.frontImageClientHeight) ? '100%' : this.frontImageClientHeight + 'px';
  }

  private interactGesture: ObjectInteractGesture | null = null;

  constructor(
    private ngZone: NgZone,
    private contextMenuService: ContextMenuService,
    private panelService: PanelService,
    private elementRef: ElementRef<HTMLElement>,
    private changeDetector: ChangeDetectorRef,
    private tabletopService: TabletopService,
    private selectionService: TabletopSelectionService,
    private imageService: ImageService,
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService,
    private chatMessageService: ChatMessageService
  ) { }

  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      .on(`UPDATE_GAME_OBJECT/aliasName/${PeerCursor.aliasName}`, event => {
        const object = ObjectStore.instance.get<PeerCursor>(event.data.identifier);
        if (this.card && object && object.userId === this.card.owner) {
          this.changeDetector.markForCheck();
        }
      })
      .on(`UPDATE_GAME_OBJECT/identifier/${this.card?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on(`UPDATE_OBJECT_CHILDREN/identifier/${this.card?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on<object>('TABLE_VIEW_ROTATE', -1000, event => {
        this.ngZone.run(() => {
          this.viewRotateZ = event.data['z'];
          this.changeDetector.markForCheck();
        });
      })
      .on('SYNCHRONIZE_FILE_LIST', event => {
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_FILE_RESOURE', event => {
        this.changeDetector.markForCheck();
      })
      .on('CHANGE_GM_MODE', event => {
        this.changeDetector.markForCheck();
      })
      .on(`UPDATE_SELECTION/identifier/${this.card?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on('DISCONNECT_PEER', event => {
        const cursor = PeerCursor.findByPeerId(event.data.peerId);
        if (!cursor || this.card?.owner === cursor.userId) this.changeDetector.markForCheck();
      });
    this.movableOption = {
      tabletopObject: this.card ?? undefined,
      transformCssOffset: 'translateZ(0.15px)',
      colideLayers: ['terrain', 'text-note']
    };
    this.rotableOption = {
      tabletopObject: this.card ?? undefined
    };
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.interactGesture = new ObjectInteractGesture(this.elementRef.nativeElement);
    });

    if (this.interactGesture) {
      this.interactGesture.onstart = this.onInputStart.bind(this);
      this.interactGesture.oninteract = this.onDoubleClick.bind(this);
    }
  }

  ngOnDestroy() {
    if (this.interactGesture) this.interactGesture.destroy();
    EventSystem.unregister(this);
  }

  @HostListener('carddrop', ['$event'])
  onCardDrop(e) {
    if (!this.card || this.card === e.detail || (e.detail instanceof Card === false && e.detail instanceof CardStack === false)) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    if (e.detail instanceof CardStack) {
      if (this.isLocked) return;
      const cardStack: CardStack = e.detail;
      const distance: number = this.card.calcSqrDistance(cardStack);
      if (distance < 25 ** 2) {
        cardStack.location.x = this.card.location.x;
        cardStack.location.y = this.card.location.y;
        cardStack.posZ = this.card.posZ;
        cardStack.putOnBottom(this.card);
        this.isLocked = false;
      }
    }
  }

  onDoubleClick() {
    if (!this.card || this.isLocked || (this.ownerIsOnline && !this.isHand)) return;
    this.ngZone.run(() => {
      this.state = this.isVisible && !this.isHand ? CardState.BACK : CardState.FRONT;
      this.owner = '';
      if (this.state === CardState.FRONT) this.chatMessageService.sendOperationLog((this.card?.name == '' ? '(無名牌)' : this.card?.name)  + ' 公開');
      SoundEffect.play(PresetSound.cardDraw);
    });
  }

  @HostListener('dragstart', ['$event'])
  onDragstart(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  onInputStart(e: MouseEvent | TouchEvent) {
    // TODO:もっと良い方法考える
    if (!this.card) return;
    this.ngZone.run(() => {
      this.card!.toTopmost();
    });
    this.startIconHiddenTimer();

    if (this.isLocked) {
      EventSystem.trigger('DRAG_LOCKED_OBJECT', { });
    }
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;
    const position = this.pointerDeviceService.pointers[0];

    let menuActions: ContextMenuAction[] = [];
    menuActions = menuActions.concat(this.makeSelectionContextMenu());
    menuActions = menuActions.concat(this.makeContextMenu());

    this.contextMenuService.open(position, menuActions, this.isVisible ? this.name : '牌');
  }

  onMove() {
    this.contextMenuService.close();
    SoundEffect.play(PresetSound.cardPick);
  }

  onMoved() {
    SoundEffect.play(PresetSound.cardPut);
    this.ngZone.run(() => this.dispatchCardDropEvent());
  }

  onImageLoad() {
    if (this.isFront) {
      if (this.cardImageElement) this.frontImageClientHeight = this.cardImageElement.nativeElement.clientHeight;
      if (!this.backImageClientHeight) this.backImageClientHeight = this.frontImageClientHeight;
    } else {
      if (this.cardImageElement) this.backImageClientHeight = this.cardImageElement.nativeElement.clientHeight;
      if (!this.frontImageClientHeight) this.frontImageClientHeight = this.backImageClientHeight;
      if (this.translucentImageElement) this.frontImageClientHeight = this.translucentImageElement.nativeElement.clientHeight;
    }
  }

  private createStack() {
    if (!this.card) return;
    const cardStack = CardStack.create('山札');
    cardStack.location.x = this.card.location.x;
    cardStack.location.y = this.card.location.y;
    cardStack.posZ = this.card.posZ;
    cardStack.location.name = this.card.location.name;
    cardStack.rotate = this.rotate;
    cardStack.zindex = this.card.zindex;

    const cards: Card[] = this.tabletopService.cards.filter(card => {
      const distance: number = this.card!.calcSqrDistance(card);
      return distance < 100 ** 2;
    });

    cards.sort((a, b) => {
      if (a.zindex < b.zindex) return 1;
      if (a.zindex > b.zindex) return -1;
      return 0;
    });

    for (const card of cards) {
      cardStack.putOnBottom(card);
    }
  }

  private dispatchCardDropEvent() {
    if (!this.card) return;
    const element: HTMLElement = this.elementRef.nativeElement;
    const parent = element.parentElement;
    const children = parent!.children;
    const event = new CustomEvent('carddrop', { detail: this.card, bubbles: true });
    for (let i = 0; i < children.length; i++) {
      children[i].dispatchEvent(event);
    }
  }

  private makeSelectionContextMenu(): ContextMenuAction[] {
    if (!this.card || this.selectionService.objects.length < 1) return [];

    const actions: ContextMenuAction[] = [];

    const objectPosition = {
      x: this.card.location.x + (this.card.size * this.gridSize) / 2,
      y: this.card.location.y + (this.card.size * this.gridSize) / 2,
      z: this.card.posZ
    };
    actions.push({ name: '集中於此', action: () => this.selectionService.congregate(objectPosition) });

    if (this.isSelected) {
      const selectedCards = () => this.selectionService.objects.filter(object => object.aliasName === this.card?.aliasName) as Card[];
      actions.push(
        {
          name: '選取的牌', action: undefined, subActions: [
            {
              name: '全部翻面（公開）', action: () => {
                const counter: Map<string, number> = new Map<string, number>();
                selectedCards().forEach(card => {
                  if (card.hasOwner || !card.isFront) {
                    const name = card.name == '' ? '(無名牌)' : card.name;
                    let count = counter.get(name) || 0;
                    count += 1;
                    counter.set(name, count);
                  }
                  card.faceUp();
                });
                this.chatMessageService.sendOperationLog([...counter.keys()].map(key => key + ((counter.get(key) ?? 0) <= 1 ? '' : ` ×${counter.get(key)}張`)).join('、') + ' 公開')
                SoundEffect.play(PresetSound.cardDraw);
              }
            },
            {
              name: '全部蓋牌', action: () => {
                selectedCards().forEach(card => card.faceDown());
                SoundEffect.play(PresetSound.cardDraw);
              }
            },
            {
              name: '全部只有自己查看（加入手牌）', action: () => {
                const counter: Map<string, number> = new Map<string, number>();
                let faceDownCount = 0;
                selectedCards().forEach(card => {
                  if (!card.isHand) {
                    if (card.isFront) {
                      const name = card.name == '' ? '(無名牌)' : card.name;
                      let count = counter.get(name) || 0;
                      count += 1;
                      counter.set(name, count);
                    } else {
                      faceDownCount += 1;
                    }
                  }
                  card.faceDown();
                  card.owner = Network.peer.userId;
                });
                const messages = [...counter.keys()].map(key => key + ((counter.get(key) ?? 0) <= 1 ? '' : ` ×${counter.get(key)}張`));
                if (faceDownCount) messages.push(`(面朝下的牌)×${faceDownCount}張`);
                this.chatMessageService.sendOperationLog(messages.join('、') + ' 只有自己查看');
                SoundEffect.play(PresetSound.cardDraw);
              }
            },
          ]
        }
      );
    }
    actions.push(ContextMenuSeparator);
    return actions;
  }

  private makeContextMenu(): ContextMenuAction[] {
    if (!this.card) return [];

    const actions: ContextMenuAction[] = [];
    actions.push(this.isLocked
      ? {
        name: '☑ 固定', action: () => {
          this.isLocked = false;
          SoundEffect.play(PresetSound.unlock);
        },
        checkBox: 'check'
      } : {
        name: '☐ 固定', action: () => {
          this.isLocked = true;
          SoundEffect.play(PresetSound.lock);
        },
        checkBox: 'check'
      });
    actions.push(ContextMenuSeparator);
    actions.push(!this.isVisible || this.isHand
      ? {
        name: this.isHand ? '正面出牌（公開）' : this.ownerIsOnline ? '翻面（公開）' : '翻面', action: () => {
          this.card!.faceUp();
          this.chatMessageService.sendOperationLog((this.card!.name == '' ? '(無名牌)' : this.card!.name) + ' 公開');
          SoundEffect.play(PresetSound.cardDraw);
        }, default: !this.isLocked && (!this.ownerIsOnline || this.isHand)
      }
      : {
        name: '蓋牌', action: () => {
          this.card!.faceDown();
          SoundEffect.play(PresetSound.cardDraw);
        }, default: !this.card.isLocked && (!this.ownerIsOnline || this.isHand)
      });
    actions.push(this.isHand
      ? {
        name: '背面出牌', action: () => {
          this.card!.faceDown();
          SoundEffect.play(PresetSound.cardDraw);
        }
      }
      : {
        name: '只有自己查看（加入手牌）', action: () => {
          SoundEffect.play(PresetSound.cardDraw);
          this.chatMessageService.sendOperationLog(`${this.card!.isFront ? (this.card!.name == '' ? '(無名牌)' : this.card!.name)  : '(蓋牌)'} 只有自己查看`);
          this.card!.faceDown();
          this.owner = Network.peer.userId;
        }
      });
    actions.push(ContextMenuSeparator);
    actions.push({
      name: '右回転', action: () => {
        this.turnRight();
      },
      materialIcon: 'turn_right',
      hotkey: 'R',
      disabled: this.isLocked
    },
    {
      name: '左回転', action: () => {
        this.turnLeft();
      },
      materialIcon: 'turn_left',
      hotkey: 'Shift+R',
      disabled: this.isLocked
    });
    if (this.card.isVisible) {
      actions.push(ContextMenuSeparator,
      {
        name: '設為正位置(0°)', action: () => {
          this.vertical();
        },
        hotkey: 'U',
        disabled: !this.card.isVisible || this.isLocked || this.card.rotate == 0
      },
      {
        name: '設為橫向(90°)', action: () => {
          this.horizontal();
        },
        hotkey: 'T',
        disabled: !this.card.isVisible || this.isLocked || this.card.rotate == 90
      });
    }
    actions.push(ContextMenuSeparator);
    actions.push({
      name: '用重疊的牌建立牌堆', action: () => {
        this.createStack();
        SoundEffect.play(PresetSound.cardPut);
      },
      disabled: this.isLocked
    });
    actions.push(ContextMenuSeparator);
    actions.push({ name: '編輯牌...', action: () => { this.showDetail(this.card!); } });

    if (this.isVisible && this.card.getUrls().length > 0) {
      actions.push({
        name: '開啟參考URL', action: undefined,
        subActions: this.card.getUrls().map((urlElement) => {
          const url = urlElement.value.toString();
          return {
            name: urlElement.name ? urlElement.name : url,
            action: () => {
              if (StringUtil.sameOrigin(url)) {
                window.open(url.trim(), '_blank', 'noopener');
              } else {
                this.modalService.open(OpenUrlComponent, { url: url, title: this.card!.name, subTitle: urlElement.name });
              }
            },
            disabled: !StringUtil.validUrl(url),
            error: !StringUtil.validUrl(url) ? 'URL無效' : undefined,
            isOuterLink: StringUtil.validUrl(url) && !StringUtil.sameOrigin(url)
          };
        })
      });
      actions.push(ContextMenuSeparator);
    }

    actions.push({
      name: '建立副本', action: () => {
        const cloneObject = this.card!.clone();
        cloneObject.location.x += this.gridSize;
        cloneObject.location.y += this.gridSize;
        cloneObject.toTopmost();
        cloneObject.isLocked = false;
        SoundEffect.play(PresetSound.cardPut);
      }
    },
    {
      name: '刪除', action: () => {
        this.card!.destroy();
        SoundEffect.play(PresetSound.sweep);
      }
    });

    return actions;
  }

  private startIconHiddenTimer() {
    clearTimeout(this.iconHiddenTimer!);
    this.iconHiddenTimer = setTimeout(() => {
      this.iconHiddenTimer = null;
      this.changeDetector.markForCheck();
    }, 300);
    this.changeDetector.markForCheck();
  }

  vertical() {
    if (!this.card || !this.card.isVisible || this.card.rotate == 0) return;
    this.card.rotate = 0;
    SoundEffect.play(PresetSound.cardPut);
  }

  horizontal() {
    if (!this.card || !this.card.isVisible || this.card.rotate == 90) return;
    this.card.rotate = 90;
    SoundEffect.play(PresetSound.cardPut);
  }

  turnRight() {
    if (!this.card) return;
    this.card.rotate += 45;
    SoundEffect.play(PresetSound.cardPut);
  }

  turnLeft() {
    if (!this.card) return;
    this.card.rotate -= 45;
    SoundEffect.play(PresetSound.cardPut);
  }

  private showDetail(gameObject: Card | null) {
    if (!gameObject) return;
    EventSystem.trigger('SELECT_TABLETOP_OBJECT', { identifier: gameObject.identifier, className: gameObject.aliasName });
    const coordinate = this.pointerDeviceService.pointers[0];
    let title = '牌設定';
    if (gameObject.name.length) title += ' - ' + (this.isVisible ? gameObject.name : '牌（裏面）');
    const option: PanelOption = { title: title, left: coordinate.x - 300, top: coordinate.y - 300, width: 600, height: 490 };
    const component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }
}