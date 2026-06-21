import { ImageFile } from './core/file-storage/image-file';
import { ImageStorage } from './core/file-storage/image-storage';
import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { ObjectNode } from './core/synchronize-object/object-node';
import { ObjectStore } from './core/synchronize-object/object-store';
import { MathUtil } from './core/system/util/math-util';
import { DataElement } from './data-element';
import { PeerCursor } from './peer-cursor';

export interface TabletopLocation {
  name: string;
  x: number;
  y: number;
}

@SyncObject('TabletopObject')
export class TabletopObject extends ObjectNode {
  @SyncVar() location: TabletopLocation = {
    name: 'table',
    x: 0,
    y: 0
  };

  @SyncVar() posZ: number = 0;

  get isVisibleOnTable(): boolean { return this.location.name === 'table'; }

  private _imageFile: ImageFile = ImageFile.Empty;
  private _shadowImageFile: ImageFile = ImageFile.Empty;
  //private _faceIcon: ImageFile = null;
  private _dataElements: { [name: string]: string } = {};

  // GameDataElement getter/setter
  get rootDataElement(): DataElement {
    for (const node of this.children) {
      if (node.getAttribute('name') === this.aliasName) return <DataElement>node;
    }
    return null;
  }

  get imageDataElement(): DataElement { return this.getElement('image'); }
  get commonDataElement(): DataElement { return this.getElement('common'); }
  get detailDataElement(): DataElement { return this.getElement('detail'); }

  @SyncVar() currntImageIndex: number = 0;
  /*
  get imageFile(): ImageFile {
    if (!this.imageDataElement) return this._imageFile;
    let imageIdElement: DataElement = this.imageDataElement.getFirstElementByName('imageIdentifier');
    if (imageIdElement && this._imageFile.identifier !== imageIdElement.value) {
      let file: ImageFile = ImageStorage.instance.get(<string>imageIdElement.value);
      this._imageFile = file ? file : ImageFile.Empty;
    }
    return this._imageFile;
  }
  */
  get imageElement(): DataElement {
    if (!this.imageDataElement) return null;
    const imageIdElements: DataElement[] = this.imageDataElement.getElementsByName('imageIdentifier');
    return imageIdElements[this.currntImageIndex < 0 ? 0 : this.currntImageIndex >= imageIdElements.length ? imageIdElements.length - 1 : this.currntImageIndex];
  }
  get imageFile(): ImageFile {
    if (!this.imageDataElement) return this._imageFile;
    const imageIdElement = this.imageElement;
    if (imageIdElement && this._imageFile.identifier !== imageIdElement.value) {
      const file: ImageFile = ImageStorage.instance.get(<string>imageIdElement.value);
      this._imageFile = file ? file : ImageFile.Empty;
    }
    return this._imageFile;
  }
  get imageFiles(): ImageFile[] {
    if (!this.imageDataElement) return [];
    const elements = this.imageDataElement.getElementsByName('imageIdentifier');
    return elements.map((element) => {
      const file: ImageFile = ImageStorage.instance.get(<string>element.value);
      return file ? file : null;
    }).filter((file) => { return file != null });
  }

  @SyncVar() isUseIconToOverviewImage: boolean = false;
  @SyncVar() currntIconIndex: number = 0;
  get faceIcon(): ImageFile {
    if (!this.imageDataElement) return null;
    const elements = this.imageDataElement.getElementsByName('faceIcon');
    if (elements) {
      const imageIdElement = elements[this.currntIconIndex];
      if (this.currntIconIndex < 0) this.currntIconIndex = 0;
      return imageIdElement ? ImageStorage.instance.get(<string>imageIdElement.value) : null;
    }
    return null;
  }
  get faceIcons(): ImageFile[] {
    if (!this.imageDataElement) return [];
    const elements = this.imageDataElement.getElementsByName('faceIcon');
    return elements.map((element) => {
      const file: ImageFile = ImageStorage.instance.get(<string>element.value);
      return file ? file : null;
    }).filter((file) => { return file != null });
  }

  get shadowImageFile(): ImageFile {
    if (!this.imageDataElement) return this._shadowImageFile;
    const imageIdElement: DataElement = this.imageDataElement.getFirstElementByName('shadowImageIdentifier');
    if (imageIdElement && this._shadowImageFile.identifier !== imageIdElement.value) {
      const file: ImageFile = ImageStorage.instance.get(<string>imageIdElement.value);
      this._shadowImageFile = file ? file : ImageFile.Empty;
    } else {
      const imageIdElement: DataElement = this.imageElement;
      if (imageIdElement && this._shadowImageFile.identifier !== imageIdElement.currentValue) {
        const file: ImageFile = ImageStorage.instance.get(<string>imageIdElement.currentValue);
        this._shadowImageFile = file ? file : ImageFile.Empty;
      }
    }
    return this._shadowImageFile;
  }

  @SyncVar() isAltitudeIndicate: boolean = false;
  get altitude(): number {
    const element = this.getElement('altitude', this.commonDataElement);
    //if (!element && this.commonDataElement) {
    //  this.commonDataElement.appendChild(DataElement.create('altitude', 0, {}, 'altitude_' + this.identifier));
    //}
    const num = element ? +element.value : 0;
    return Number.isNaN(num) ? 0 : num;
  }
  set altitude(altitude: number) {
    const element = this.getElement('altitude', this.commonDataElement);
    if (element) element.value = altitude;
  }

  get isHaveAltitude(): boolean {
    return !!this.getElement('altitude', this.commonDataElement);
  }

  @SyncVar() isInverse: boolean = false;
  @SyncVar() isHollow: boolean = false;
  @SyncVar() isBlackPaint: boolean = false;
  @SyncVar() aura = -1;

  @SyncVar() isNotRide: boolean = true;
  @SyncVar() isInventoryIndicate: boolean = true;

  get isGMMode(): boolean{ return PeerCursor.myCursor ? PeerCursor.myCursor.isGMMode : false; }

  calcSqrDistance(other: TabletopObject): number {
    const pos1 = { x: this.location.x, y: this.location.y, z: this.posZ };
    const pos2 = { x: other.location.x, y: other.location.y, z: other.posZ };
    return MathUtil.sqrMagnitude(pos1, pos2);
  }

  protected createDataElements() {
    this.initialize();
    const aliasName: string = this.aliasName;
    if (!this.rootDataElement) {
      const rootElement = DataElement.create(aliasName, '', {}, aliasName + '_' + this.identifier);
      this.appendChild(rootElement);
    }

    if (!this.imageDataElement) {
      this.rootDataElement.appendChild(DataElement.create('image', '', {}, 'image_' + this.identifier));
      this.imageDataElement.appendChild(DataElement.create('imageIdentifier', '', { type: 'image' }, 'imageIdentifier_' + this.identifier));
    }
    if (!this.commonDataElement) this.rootDataElement.appendChild(DataElement.create('common', '', {}, 'common_' + this.identifier));
    if (!this.detailDataElement) this.rootDataElement.appendChild(DataElement.create('detail', '', {}, 'detail_' + this.identifier));
  }

  protected getElement(name: string, from: DataElement = this.rootDataElement): DataElement {
    if (!from) return null;
    let element: DataElement = this._dataElements[name] ? ObjectStore.instance.get(this._dataElements[name]) : null;
    if (!element || !from.contains(element)) {
      element = from.getFirstElementByName(name);
      this._dataElements[name] = element ? element.identifier : null;
    }
    return element;
  }

  protected getCommonValue<T extends string | number>(elementName: string, defaultValue: T): T {
    const element = this.getElement(elementName, this.commonDataElement);
    if (!element) return defaultValue;

    if (typeof defaultValue === 'number') {
      const number: number = +element.value;
      return <T>(Number.isNaN(number) ? defaultValue : number);
    } else {
      return <T>(element.value + '');
    }
  }

  getUrls(): DataElement[] {
    return this.rootDataElement.getElementsByType('url');
  }

  protected setCommonValue(elementName: string, value: any) {
    const element = this.getElement(elementName, this.commonDataElement);
    if (!element) { return; }
    element.value = value;
  }

  protected getImageFile(elementName: string) {
    if (!this.imageDataElement) return null;
    const image = this.getElement(elementName, this.imageDataElement);
    return image ? ImageStorage.instance.get(<string>image.value) : null;
  }

  protected setImageFile(elementName: string, imageFile: ImageFile) {
    const image = imageFile ? this.getElement(elementName, this.imageDataElement) : null;
    if (!image) return;
    image.value = imageFile.identifier;
  }

  setLocation(location: string) {
    this.location.name = location;
    this.update();
  }
}
