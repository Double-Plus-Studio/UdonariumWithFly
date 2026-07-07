import { Page, BrowserContext } from '@playwright/test';

export const LOBBY_BTN = 'button:has-text("大廳")';
export const REFRESH_BTN = 'button:has-text("重新整理列表")';
export const CREATE_ROOM_BTN = 'button:has-text("建立新房間")';
export const CONNECT_BTN = 'button:has-text("連線")';
export const ALREADY_CONNECTED_MSG = 'text=如需連線其他房間';
export const ROOM_LIST_TABLE = 'table.room-list';

export async function waitForAppReady(page: Page) {
  await page.goto('/');
  // 等待 Angular 啟動並完成 Network.open()
  await page.waitForFunction(() => {
    return document.querySelector('app-root') !== null &&
      !document.querySelector('.loading');
  }, { timeout: 15_000 });
  // 等待 Network.open() 完成（dev build 會把 Network 掛在 window 上）
  await page.waitForFunction(() => (window as any).Network?.isOpen === true, { timeout: 15_000 });
}

export async function openLobby(page: Page) {
  await page.locator(LOBBY_BTN).first().click();
  await page.waitForTimeout(500);
}

export async function createRoom(page: Page, roomName = '測試房間') {
  await openLobby(page);
  await page.locator(CREATE_ROOM_BTN).click();
  // 房間名稱欄位（room-setting modal 內，以 placeholder 定位）
  await page.locator('input[placeholder="房間名稱為必填"]').fill(roomName);
  // 強制點擊「建立新房間」確認按鈕（modal 背景可能擋住）
  await page.locator(CREATE_ROOM_BTN).last().click({ force: true });
  // 等待 Network 重新以房間身分開啟
  await page.waitForFunction(() => (window as any).Network?.peer?.isRoom === true, { timeout: 15_000 });
}

export async function joinRoom(page: Page) {
  await openLobby(page);
  await page.locator(REFRESH_BTN).click();
  await page.waitForTimeout(1500);
  await page.locator(CONNECT_BTN).first().click();
  // 等待連線完成（lobby modal 會關閉，或等一段時間）
  await page.waitForTimeout(5000);
}

export async function getPeerIds(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).Network?.peerIds ?? []);
}

/** 讀取 window.Network 的連線狀態快照（dev build 限定） */
export async function getNetworkState(page: Page): Promise<{ peerId: string; peerIds: string[]; isOpen: boolean }> {
  return page.evaluate(() => {
    const network = (window as any).Network;
    return {
      peerId: network?.peerId ?? '',
      peerIds: network?.peerIds ?? [],
      isOpen: network?.isOpen ?? false,
    };
  });
}

export async function isAlreadyConnectedWarningVisible(page: Page): Promise<boolean> {
  return page.locator(ALREADY_CONNECTED_MSG).isVisible({ timeout: 2000 }).catch(() => false);
}

export async function getRoomPeerCount(page: Page): Promise<number> {
  const rows = await page.locator(`${ROOM_LIST_TABLE} td`).allTextContents();
  const countCell = rows.find(t => t.includes('人'));
  if (!countCell) return 0;
  return parseInt(countCell) || 0;
}

/** 讀取 Firebase auth 持久化在 IndexedDB 中的匿名使用者 UID */
export async function getPersistedAuthUid(page: Page): Promise<string | null> {
  return page.evaluate(() => new Promise<string | null>(resolve => {
    const req = indexedDB.open('firebaseLocalStorageDb');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('firebaseLocalStorage')) { resolve(null); return; }
      const getAll = db.transaction('firebaseLocalStorage', 'readonly')
        .objectStore('firebaseLocalStorage').getAll();
      getAll.onerror = () => resolve(null);
      getAll.onsuccess = () => {
        const entry = getAll.result.find((e: any) => String(e.fbase_key).startsWith('firebase:authUser'));
        resolve(entry?.value?.uid ?? null);
      };
    };
  }));
}

/** 等待特定 console 訊息出現 */
export function waitForConsoleMessage(page: Page, pattern: string | RegExp, timeout = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for console: ${pattern}`)), timeout);
    page.on('console', msg => {
      const text = msg.text();
      const matched = typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
      if (matched) {
        clearTimeout(timer);
        resolve(text);
      }
    });
  });
}

/** 建立已分享 storage 的 context（模擬同一非無痕瀏覽器的兩個視窗） */
export async function createSharedContext(browser: import('@playwright/test').Browser) {
  return browser.newContext();
}

/** 建立隔離 storage 的 context（模擬無痕視窗） */
export async function createIncognitoContext(browser: import('@playwright/test').Browser) {
  return browser.newContext();
}
