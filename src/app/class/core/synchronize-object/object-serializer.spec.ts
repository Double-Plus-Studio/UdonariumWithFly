import { ObjectSerializer } from './object-serializer';

function makeAttributes(attrs: Record<string, string>): NamedNodeMap {
  const xml = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
  const doc = new DOMParser().parseFromString(`<root ${xml}/>`, 'text/xml');
  return doc.documentElement.attributes;
}

describe('ObjectSerializer.toAttributes()', () => {
  it('純量屬性應直接對應', () => {
    const result = ObjectSerializer.toAttributes({ name: 'Alice', hp: 10 });
    expect(result['name']).toBe('Alice');
    expect(result['hp']).toBe(10);
  });

  it('undefined 值應排除在外', () => {
    const result = ObjectSerializer.toAttributes({ name: 'Alice', secret: undefined });
    expect('secret' in result).toBeFalse();
  });

  it('巢狀物件應以點號格式展開', () => {
    const result = ObjectSerializer.toAttributes({ position: { x: 1, y: 2 } });
    expect(result['position.x']).toBe(1);
    expect(result['position.y']).toBe(2);
  });

  it('陣列應以索引格式展開', () => {
    const result = ObjectSerializer.toAttributes({ tags: ['a', 'b', 'c'] });
    expect(result['tags.0']).toBe('a');
    expect(result['tags.1']).toBe('b');
    expect(result['tags.2']).toBe('c');
  });

  it('多層巢狀應完整展開', () => {
    const result = ObjectSerializer.toAttributes({ a: { b: { c: 42 } } });
    expect(result['a.b.c']).toBe(42);
  });

  it('空物件應回傳空屬性', () => {
    const result = ObjectSerializer.toAttributes({});
    expect(Object.keys(result).length).toBe(0);
  });

  it('布林值應被保留（Attributes 型別為 number|string）', () => {
    const result = ObjectSerializer.toAttributes({ visible: true, locked: false });
    expect(result['visible']).toBeTruthy();
    expect(result['locked']).toBeFalsy();
  });
});

describe('ObjectSerializer.parseAttributes()', () => {
  it('字串屬性應正確解析', () => {
    const syncData: any = { name: '' };
    const attrs = makeAttributes({ name: 'Bob' });
    ObjectSerializer.parseAttributes(syncData, attrs);
    expect(syncData.name).toBe('Bob');
  });

  it('數值類型應以 JSON.parse 轉型', () => {
    const syncData: any = { hp: 0 };
    const attrs = makeAttributes({ hp: '100' });
    ObjectSerializer.parseAttributes(syncData, attrs);
    expect(syncData.hp).toBe(100);
  });

  it('布林值應以 JSON.parse 轉型', () => {
    const syncData: any = { visible: false };
    const attrs = makeAttributes({ visible: 'true' });
    ObjectSerializer.parseAttributes(syncData, attrs);
    expect(syncData.visible).toBe(true);
  });

  it('巢狀點號路徑應正確解析至對應物件', () => {
    const syncData: any = { position: { x: 0, y: 0 } };
    const attrs = makeAttributes({ 'position.x': '5', 'position.y': '10' });
    ObjectSerializer.parseAttributes(syncData, attrs);
    expect(syncData.position.x).toBe(5);
    expect(syncData.position.y).toBe(10);
  });

  it('XML 實體字元 &amp; 應正確解碼', () => {
    const syncData: any = { text: '' };
    const attrs = makeAttributes({ text: '&amp;' });
    ObjectSerializer.parseAttributes(syncData, attrs);
    expect(syncData.text).toBe('&');
  });

  it('XML 實體字元 &lt; &gt; 應正確解碼', () => {
    const syncData: any = { text: '' };
    const attrs = makeAttributes({ text: '&lt;b&gt;' });
    ObjectSerializer.parseAttributes(syncData, attrs);
    expect(syncData.text).toBe('<b>');
  });

  it('prototype pollution 攻擊鍵（如 __proto__）應被忽略', () => {
    const syncData: any = { name: 'safe' };
    const attrs = makeAttributes({ '__proto__.polluted': 'yes' });
    ObjectSerializer.parseAttributes(syncData, attrs);
    expect(({} as any).polluted).toBeUndefined();
    expect(syncData.name).toBe('safe');
  });

  it('toAttributes 與 parseAttributes 之間應為 round-trip', () => {
    const original = { name: 'Hero', hp: 100, mp: 50 };
    const syncData = { ...original };

    const attrs = ObjectSerializer.toAttributes(original);
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    const doc = new DOMParser().parseFromString(`<root ${attrStr}/>`, 'text/xml');
    const result = { ...original };
    ObjectSerializer.parseAttributes(result, doc.documentElement.attributes);

    expect(result.name).toBe(original.name);
    expect(result.hp).toBe(original.hp);
    expect(result.mp).toBe(original.mp);
  });
});
