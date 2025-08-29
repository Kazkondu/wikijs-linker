/**
 * Wiki.js Linker Chrome Extension - Service Worker
 * Copyright (c) 2025 Adem Kazkondu
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 * @version 1.67
 * @description Service Worker for extension stability
 */

// background.js - Service Worker for Extension Stability

/**
 * Service Worker Installation Handler
 * Called when the extension is installed or updated
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Wiki.js Linker Extension installed');
});

/**
 * Extension Icon Click Handler (fallback if popup doesn't open)
 * Opens options page as a fallback if popup fails to load
 */
chrome.action.onClicked.addListener((tab) => {
  // Fallback if popup doesn't work
  chrome.tabs.create({
    url: chrome.runtime.getURL('options.html')
  });
});

/**
 * Popup Stability: Ensure storage is available
 * Tests storage availability on startup
 */
chrome.runtime.onStartup.addListener(() => {
  // Storage test on startup
  chrome.storage.sync.get(['endpoint'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Storage not available:', chrome.runtime.lastError);
    } else {
      console.log('Storage available');
    }
  });
});