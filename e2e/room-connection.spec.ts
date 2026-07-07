/**
 * 房間連線整合測試
 *
 * 測試情境：
 *   視窗一（regularCtx）建立房間
 *   視窗二（incognitoCtx）加入房間 — 模擬無痕視窗
 *   視窗三（regularCtx，與視窗一共用 storage）加入房間
 *
 * 重現的已知問題：
 *   - 視窗三（非無痕）開大廳時出現「已連線」警告而無法加入
 *   - 視窗一看不到視窗三（連線不對稱）
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  waitForAppReady, openLobby, createRoom, joinRoom,
  isAlreadyConnectedWarningVisible, getRoomPeerCount, getPersistedAuthUid,
  waitForConsoleMessage, ALREADY_CONNECTED_MSG, ROOM_LIST_TABLE,
  REFRESH_BTN, CONNECT_BTN,
} from './helpers';

const CONNECT_TIMEOUT = 10_000;

test.describe('房間連線', () => {
  let browser: Browser;
  let regularCtx: BrowserContext;   // 視窗一、三：模擬同一非無痕瀏覽器
  let incognitoCtx: BrowserContext; // 視窗二：模擬無痕
  let page1: Page, page2: Page, page3: Page;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    regularCtx = await browser.newContext();
    incognitoCtx = await browser.newContext();
  });

  test.afterAll(async () => {
    await regularCtx.close();
    await incognitoCtx.close();
  });

  // ────────────────────────────────────────────────────────────
  // 步驟 1：視窗一開啟並建立房間
  // ────────────────────────────────────────────────────────────
  test('視窗一：啟動並建立房間', async () => {
    page1 = await regularCtx.newPage();
    const connectLog = waitForConsoleMessage(page1, 'OPEN_NETWORK');
    await waitForAppReady(page1);
    await connectLog;

    await createRoom(page1);
    // 建立完成後 modal 應關閉，大廳按鈕應可見
    await expect(page1.locator('button:has-text("大廳")')).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────
  // 步驟 2：視窗二（無痕）加入房間
  // ────────────────────────────────────────────────────────────
  test('視窗二（無痕）：加入房間並連線成功', async () => {
    page2 = await incognitoCtx.newPage();
    const connectLog = waitForConsoleMessage(page2, 'OPEN_NETWORK');
    await waitForAppReady(page2);
    await connectLog;

    await openLobby(page2);

    // 大廳應顯示房間列表，不應有「已連線」警告
    await expect(page2.locator(ALREADY_CONNECTED_MSG)).not.toBeVisible({ timeout: 3000 });

    await page2.locator(REFRESH_BTN).click();
    await expect(page2.locator(ROOM_LIST_TABLE)).toBeVisible({ timeout: 5000 });

    // 加入房間，等待 CONNECT_PEER
    const win2Connected = waitForConsoleMessage(page2, 'CONNECT_PEER', CONNECT_TIMEOUT);
    await page2.locator(CONNECT_BTN).first().click();
    await win2Connected;

    // 視窗一也應收到 CONNECT_PEER
    const win1SeesWin2 = waitForConsoleMessage(page1, 'CONNECT_PEER', CONNECT_TIMEOUT);
    await win1SeesWin2;
  });

  // ────────────────────────────────────────────────────────────
  // 步驟 3：視窗三（同 Context，非無痕）加入房間
  // ────────────────────────────────────────────────────────────
  test('視窗三（非無痕，同 Context）：開大廳不應出現「已連線」警告', async () => {
    // 視窗三開啟前先記錄視窗一的 Firebase 匿名 UID
    const uid1Before = await getPersistedAuthUid(page1);

    page3 = await regularCtx.newPage();
    const connectLog = waitForConsoleMessage(page3, 'OPEN_NETWORK');
    await waitForAppReady(page3);
    await connectLog;

    // 視窗三不應鑄造新的匿名帳號覆寫共用的持久化 auth
    // （否則視窗一的 RTDB 授權會在 signaling 期間被中斷 → 視窗一看不到視窗三）
    const uid3 = await getPersistedAuthUid(page3);
    expect(uid1Before, '視窗一應已有持久化的匿名 UID').not.toBeNull();
    expect(uid3, '視窗三應沿用視窗一的匿名帳號而非建立新帳號').toBe(uid1Before);

    await openLobby(page3);

    // ❌ 已知 Bug：此處常出現「如需連線其他房間，請先與所有參加者斷線」
    // 預期：不應出現此警告，應直接顯示房間列表
    const warned = await isAlreadyConnectedWarningVisible(page3);
    if (warned) {
      await page3.screenshot({ path: 'e2e-screenshots/win3-already-connected-bug.png' });
    }
    expect(warned, '視窗三不應出現「已連線」警告').toBe(false);
  });

  test('視窗三：加入房間並連線到視窗一和視窗二', async () => {
    await page3.locator(REFRESH_BTN).click();
    await expect(page3.locator(ROOM_LIST_TABLE)).toBeVisible({ timeout: 5000 });

    // 應看到房間有 2 人（視窗一、二已在）
    const countText = await page3.locator('td:has-text("人")').first().textContent();
    expect(parseInt(countText ?? '0')).toBeGreaterThanOrEqual(1);

    // 加入，等待連線（視窗一的監聽要在點擊前註冊，否則可能錯過事件）
    const win3ConnectedToWin2 = waitForConsoleMessage(page3, 'CONNECT_PEER', CONNECT_TIMEOUT);
    const win1SeesWin3 = waitForConsoleMessage(page1, 'CONNECT_PEER', CONNECT_TIMEOUT)
      .catch(() => 'timeout');
    await page3.locator(CONNECT_BTN).first().click();
    await win3ConnectedToWin2;

    // ❌ 已知 Bug：視窗一有時看不到視窗三
    const result = await win1SeesWin3;
    if (result === 'timeout') {
      await page1.screenshot({ path: 'e2e-screenshots/win1-cant-see-win3-bug.png' });
    }
    expect(result, '視窗一應連線到視窗三').not.toBe('timeout');
  });

  // ────────────────────────────────────────────────────────────
  // 步驟 4：送出訊息（驗證連線真的可用）
  // ────────────────────────────────────────────────────────────
  test('三個視窗互相可以看到聊天訊息', async () => {
    const testMsg = `測試訊息 ${Date.now()}`;

    // 視窗一送出訊息
    const textarea1 = page1.locator('textarea.chat-input').first();
    await textarea1.fill(testMsg);
    await textarea1.press('Enter');

    // 視窗二和三應在聊天視窗中看到此訊息
    await expect(page2.locator(`text=${testMsg}`)).toBeVisible({ timeout: 8000 });
    await expect(page3.locator(`text=${testMsg}`)).toBeVisible({ timeout: 8000 });
  });
});

// ────────────────────────────────────────────────────────────
// 獨立測試：SEND 按鈕能送出訊息（對應已修正的 keyCode bug）
// ────────────────────────────────────────────────────────────
test.describe('SEND 按鈕', () => {
  test('點擊 SEND 按鈕應能送出訊息', async ({ page }) => {
    await waitForAppReady(page);
    const testMsg = `SEND btn test ${Date.now()}`;
    const textarea = page.locator('textarea.chat-input').first();
    await textarea.fill(testMsg);

    // 點擊 SEND（不按 Enter）
    await page.locator('button:has-text("SEND")').first().click();

    // 訊息應出現在聊天紀錄中
    await expect(page.locator(`text=${testMsg}`)).toBeVisible({ timeout: 5000 });
  });
});
