/**
 * Wiki.js Linker Chrome Extension - Main Popup Interface
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
 * @description Main functionality for adding links to Wiki.js with container and category management
 */

// Import reset functions and demo template
import { clearWikiPage, resetLinksOnly } from './reset-functions.js';
import { loadDemoTemplate } from './demo-template.js';

// ===== ERROR HANDLING =====
window.addEventListener("error", (e) => {
  try { 
    const out = document.getElementById("out");
    if (out) out.textContent = "Script error: " + (e?.error?.message || e.message); 
  } catch {}
});
window.addEventListener("unhandledrejection", (e) => {
  try { 
    const out = document.getElementById("out");
    if (out) out.textContent = "Promise error: " + (e?.reason?.message || String(e.reason)); 
  } catch {}
});

// ===== DOM HELPER FUNCTIONS =====
const $ = (s) => document.querySelector(s);
let out;

function log(msg) {
  const el = out || document.getElementById("out");
  if (el) el.textContent = String(msg ?? "");
  console.log("EXTENSION LOG:", msg);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// ===== GRAPHQL FUNCTIONS (INLINE) =====

/**
 * Robust GraphQL query function for Wiki.js
 * Handles all Wiki.js specific quirks
 */
async function executeGraphQL(endpoint, token, query, variables) {
  console.log("GraphQL Request:", { endpoint, query, variables });
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables })
  });

  const responseText = await response.text();
  console.log("GraphQL Raw Response:", responseText);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${response.statusText}: ${responseText}`);
  }
  
  let json = {};
  try {
    json = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Invalid JSON response: ${responseText.slice(0, 200)}`);
  }
  
  // Wiki.js specific error handling
  if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
    const errorMessages = json.errors.map(e => e.message || String(e)).join("; ");
    throw new Error(`GraphQL Error: ${errorMessages}`);
  }
  
  return json.data || json;
}

/**
 * Query to load a Wiki page
 * CRITICAL: tags is a complex type in Wiki.js, not just String[]
 */
const QUERY_GET_PAGE = `
  query GetPage($id: Int!) {
    pages {
      single(id: $id) {
        id
        path
        title
        editor
        content
        description
        isPrivate
        isPublished
        locale
        publishEndDate
        publishStartDate
        scriptCss
        scriptJs
        tags {
          id
          tag
          title
        }
        createdAt
        updatedAt
      }
    }
  }
`;

/**
 * SIMPLIFIED WIKI.JS UPDATE MUTATION
 * Based on Wiki.js documentation - only necessary fields
 */
const MUTATION_UPDATE_PAGE = `
  mutation UpdatePage(
    $id: Int!,
    $content: String!,
    $title: String,
    $isPublished: Boolean,
    $isPrivate: Boolean,
    $locale: String,
    $path: String,
    $tags: [String]
  ) {
    pages {
      update(
        id: $id,
        content: $content,
        title: $title,
        isPublished: $isPublished,
        isPrivate: $isPrivate,
        locale: $locale,
        path: $path,
        tags: $tags
      ) {
        responseResult {
          succeeded
          errorCode
          message
        }
        page {
          id
          updatedAt
        }
      }
    }
  }
`;

// ===== HTML TEMPLATE GENERATOR =====
const HTML_TEMPLATES = {
  // Container template
  container: (containerKey, columns) => {
    return `<div class="layout-container layout-${columns}col" id="${containerKey}-container">
  <!-- Container: ${containerKey} -->
  <!-- CONTAINER_${containerKey.toUpperCase()}_CONTENT_START -->
  <!-- CONTAINER_${containerKey.toUpperCase()}_CONTENT_END -->
</div>

`;
  },
  
  // Category template
  category: (category, layout) => {
    const layoutClass = layout === 'compact' ? 'section-compact' : 
                       layout === 'large' ? 'section-large' : 'section-card';
    
    const contentClass = layout === 'compact' ? 'compact-links' : 
                        layout === 'large' ? 'large-links' : 'links';
    
    return `  <section class="${layoutClass} accent-${category.accent}" id="${category.key}-section">
    <header class="${layoutClass}__header">
      <div class="${layoutClass}__title">${escapeHtml(category.name)}</div>
      <div class="${layoutClass}__meta">${escapeHtml(category.description)}</div>
    </header>
    <div class="${contentClass}">
      <!-- ${category.key.toUpperCase()}_LINKS_END -->
    </div>
  </section>`;
  },
  
  // Link template
  link: (tabInfo, layout) => {
    const { url, title, host, iconUrl } = tabInfo;
    
    if (layout === 'compact') {
      return `      <a class="compact-link" href="${url}" target="_blank" rel="noopener">
        <img src="${iconUrl}" alt="" class="compact-icon">
        <span class="compact-title">${escapeHtml(title)}</span>
        <span class="compact-url">${escapeHtml(host)}</span>
      </a>`;
    } else if (layout === 'large') {
      return `      <a class="large-link" href="${url}" target="_blank" rel="noopener">
        <div class="large-preview">
          <img src="https://mini.s-shot.ru/1024x768/JPEG/1024/Z100/?${encodeURIComponent(url)}" alt="Preview" class="large-screenshot" onerror="this.style.display='none';">
          <img src="${iconUrl}" alt="" class="large-icon">
        </div>
        <div class="large-content">
          <div class="large-title">${escapeHtml(title)}</div>
          <div class="large-url">${escapeHtml(host)}</div>
        </div>
      </a>`;
    } else {
      return `      <a class="linkcard" href="${url}" target="_blank" rel="noopener">
        <img src="${iconUrl}" alt="">
        <div>
          <div class="title">${escapeHtml(title)}</div>
          <div class="url">${escapeHtml(host)}</div>
        </div>
      </a>`;
    }
  }
};

// ===== WIKI STRUCTURE ANALYZER =====
class WikiStructureAnalyzer {
  constructor(content) {
    this.content = content || "";
  }
  
  extractContainers() {
    const containers = [];
    const containerRegex = /<div class="layout-container layout-(\d+)col" id="([^"]+)-container">/g;
    let match;
    
    while ((match = containerRegex.exec(this.content)) !== null) {
      const columns = parseInt(match[1]);
      const key = match[2];
      
      const commentPattern = new RegExp(`<!-- Container: ${key}(?:\\s*-\\s*(.+?))? -->`, 'i');
      const commentMatch = commentPattern.exec(this.content);
      const name = commentMatch && commentMatch[1] ? commentMatch[1] : key.charAt(0).toUpperCase() + key.slice(1);
      
      containers.push({ key, name, columns });
    }
    
    return containers;
  }
  
  extractCategories() {
    const categories = [];
    const sectionRegex = /<section class="(section-\w+)\s+accent-(\w+)" id="([^"]+)-section">/g;
    let match;
    
    while ((match = sectionRegex.exec(this.content)) !== null) {
      const layoutClass = match[1];
      const accent = match[2];
      const key = match[3];
      
      const layout = layoutClass.includes('compact') ? 'compact' : 
                    layoutClass.includes('large') ? 'large' : 'cards';
      
      const sectionStart = this.content.indexOf(`id="${key}-section"`);
      const sectionContent = this.content.substring(sectionStart, sectionStart + 500);
      
      const titleRegex = new RegExp(`<div class="${layoutClass}__title">([^<]+)</div>`);
      const metaRegex = new RegExp(`<div class="${layoutClass}__meta">([^<]*)</div>`);
      
      const titleMatch = titleRegex.exec(sectionContent);
      const metaMatch = metaRegex.exec(sectionContent);
      
      const containerKey = this.findContainerForCategory(key);
      
      categories.push({
        key,
        name: titleMatch ? titleMatch[1] : key,
        description: metaMatch ? metaMatch[1] : '',
        layout,
        accent,
        containerKey: containerKey || 'unknown',
        column: 0
      });
    }
    
    return categories;
  }
  
  findContainerForCategory(categoryKey) {
    const sectionPos = this.content.indexOf(`id="${categoryKey}-section"`);
    if (sectionPos === -1) return null;
    
    const beforeSection = this.content.substring(0, sectionPos);
    const containerMatches = [...beforeSection.matchAll(/<!-- CONTAINER_([^_]+)_CONTENT_START -->/g)];
    
    if (containerMatches.length === 0) return null;
    
    const lastMatch = containerMatches[containerMatches.length - 1];
    return lastMatch[1].toLowerCase();
  }
  
  categoryExists(categoryKey) {
    return this.content.includes(`id="${categoryKey}-section"`);
  }
  
  containerExists(containerKey) {
    return this.content.includes(`id="${containerKey}-container"`);
  }
}

// ===== CONTENT MANAGER =====
class WikiContentManager {
  constructor(content) {
    this.content = content || "";
    this.analyzer = new WikiStructureAnalyzer(content);
  }
  
  addContainer(containerKey, name, columns) {
    if (this.analyzer.containerExists(containerKey)) {
      throw new Error(`Container '${containerKey}' already exists`);
    }
    
    const containerHTML = HTML_TEMPLATES.container(containerKey, columns);
    this.content += (this.content && !this.content.endsWith('\n') ? '\n\n' : '\n') + containerHTML;
    this.analyzer = new WikiStructureAnalyzer(this.content);
    
    return this;
  }
  
  addCategory(category) {
    if (this.analyzer.categoryExists(category.key)) {
      throw new Error(`Category '${category.key}' already exists`);
    }
    
    if (!this.analyzer.containerExists(category.containerKey)) {
      throw new Error(`Container '${category.containerKey}' does not exist. Create the container first.`);
    }
    
    const categoryHTML = HTML_TEMPLATES.category(category, category.layout);
    const contentEndMarker = `<!-- CONTAINER_${category.containerKey.toUpperCase()}_CONTENT_END -->`;
    const markerPos = this.content.indexOf(contentEndMarker);
    
    if (markerPos === -1) {
      throw new Error(`Container content marker for '${category.containerKey}' not found`);
    }
    
    const beforeMarker = this.content.substring(0, markerPos);
    const afterMarker = this.content.substring(markerPos);
    
    const startMarker = `<!-- CONTAINER_${category.containerKey.toUpperCase()}_CONTENT_START -->`;
    const startPos = this.content.indexOf(startMarker);
    const hasContent = startPos !== -1 && 
                      this.content.substring(startPos + startMarker.length, markerPos).trim().length > 0;
    
    const insertion = (hasContent ? '\n  ' : '') + categoryHTML + '\n  ';
    
    this.content = beforeMarker + insertion + afterMarker;
    this.analyzer = new WikiStructureAnalyzer(this.content);
    
    return this;
  }
  
  addLinkToCategory(tabInfo, categoryKey) {
    if (!this.analyzer.categoryExists(categoryKey)) {
      throw new Error(`Category '${categoryKey}' does not exist`);
    }
    
    const categories = this.analyzer.extractCategories();
    const category = categories.find(cat => cat.key === categoryKey);
    
    if (!category) {
      throw new Error(`Category information for '${categoryKey}' not found`);
    }
    
    const linkHTML = HTML_TEMPLATES.link(tabInfo, category.layout);
    const marker = `<!-- ${categoryKey.toUpperCase()}_LINKS_END -->`;
    const markerPos = this.content.indexOf(marker);
    
    if (markerPos === -1) {
      throw new Error(`Insert marker for category '${categoryKey}' not found`);
    }
    
    this.content = this.content.slice(0, markerPos) + linkHTML + '\n      ' + this.content.slice(markerPos);
    
    return this;
  }
  
  /**
   * NEW FUNCTION: Remove all links from all categories
   * Keeps containers and categories, removes only link content
   */
  removeAllLinks() {
    const categories = this.analyzer.extractCategories();
    
    categories.forEach(category => {
      const marker = `<!-- ${category.key.toUpperCase()}_LINKS_END -->`;
      const markerPos = this.content.indexOf(marker);
      
      if (markerPos === -1) return;
      
      const beforeMarker = this.content.substring(0, markerPos);
      const afterMarker = this.content.substring(markerPos);
      
      // Find link container start based on layout
      let linkContainerStart;
      if (category.layout === 'compact') {
        linkContainerStart = beforeMarker.lastIndexOf('<div class="compact-links">');
      } else if (category.layout === 'large') {
        linkContainerStart = beforeMarker.lastIndexOf('<div class="large-links">');
      } else {
        linkContainerStart = beforeMarker.lastIndexOf('<div class="links">');
      }
      
      if (linkContainerStart === -1) return;
      
      const linkContainerStartEnd = this.content.indexOf('>', linkContainerStart) + 1;
      const beforeLinks = this.content.substring(0, linkContainerStartEnd);
      const afterLinks = this.content.substring(markerPos);
      
      // Set empty link area with correct indentation
      this.content = beforeLinks + '\n      ' + afterLinks;
    });
    
    this.analyzer = new WikiStructureAnalyzer(this.content);
    return this;
  }
  
  getContent() {
    return this.content;
  }
}

// ===== STORAGE MANAGEMENT =====
async function saveData(key, data) {
  await chrome.storage.sync.set({ [key]: data });
}

async function loadData(key, defaultValue) {
  const result = await chrome.storage.sync.get({ [key]: defaultValue });
  return result[key];
}

// ===== WIKI FUNCTIONS =====

/**
 * Load a Wiki page completely with all metadata
 */
async function loadWikiPage(endpoint, token, pageId) {
  const id = Number(pageId);
  const data = await executeGraphQL(endpoint, token, QUERY_GET_PAGE, { id });
  const page = data?.pages?.single;
  
  if (!page) {
    throw new Error(`Wiki page with ID ${id} not found`);
  }
  
  return page;
}

/**
 * SIMPLIFIED WIKI.js UPDATE FUNCTION
 * Uses minimal mutation - only necessary fields based on Wiki.js documentation
 */
async function updateWikiPage(endpoint, token, pageId, newContent) {
  console.log("Updating Wiki page:", { pageId, contentLength: newContent.length });
  
  // Load current page data for basic information
  const currentPage = await loadWikiPage(endpoint, token, pageId);
  
  // Convert complex tag objects to string array
  const tagStrings = Array.isArray(currentPage.tags) 
    ? currentPage.tags.map(tag => {
        return (typeof tag === 'object' && tag.tag) ? tag.tag : String(tag);
      })
    : [];
  
  // SIMPLIFIED VARIABLES - only the most necessary fields
  const variables = {
    id: Number(pageId),
    content: newContent,
    title: currentPage.title || "",
    isPublished: currentPage.isPublished !== false, // Default true
    isPrivate: currentPage.isPrivate || false,
    locale: currentPage.locale || "en",
    path: currentPage.path || "",
    tags: tagStrings
  };
  
  console.log("Update variables:", variables);
  
  const result = await executeGraphQL(endpoint, token, MUTATION_UPDATE_PAGE, variables);
  
  const responseResult = result?.pages?.update?.responseResult;
  if (!responseResult?.succeeded) {
    const errorMsg = responseResult?.message || "Update failed";
    throw new Error(`Wiki Update Error: ${errorMsg}`);
  }
  
  console.log("Wiki page updated successfully");
  return result;
}

/**
 * Synchronize extension with Wiki data
 */
async function syncFromWiki() {
  const { endpoint, token, pageId } = await chrome.storage.sync.get();
  
  if (!endpoint || !token || !pageId) {
    throw new Error("Wiki configuration missing. Please configure in options.");
  }
  
  const page = await loadWikiPage(endpoint, token, pageId);
  
  const analyzer = new WikiStructureAnalyzer(page.content);
  const containers = analyzer.extractContainers();
  const categories = analyzer.extractCategories();
  
  await saveData('containers', containers);
  await saveData('categories', categories);
  
  return { containers, categories, content: page.content, page };
}

// ===== TAB INFO EXTRACTOR =====
async function getActiveTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || /^chrome(-extension)?:\/\//.test(tab.url) || /^vivaldi:\/\//.test(tab.url)) {
    throw new Error("This page cannot be linked (internal browser page)");
  }

  const u = new URL(tab.url);
  const iconUrl = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  return {
    url: tab.url,
    title: tab.title || u.hostname,
    host: u.hostname,
    iconUrl
  };
}

// ===== UI UPDATE FUNCTIONS =====
async function updateContainerSelect() {
  const select = $("#containerSelect");
  const containers = await loadData('containers', []);
  
  select.innerHTML = '<option value="">-- Create New Container --</option>';
  
  containers.forEach(container => {
    const option = document.createElement('option');
    option.value = container.key;
    option.textContent = `${container.name} (${container.columns} columns)`;
    select.appendChild(option);
  });
}

async function updateCategorySelect() {
  const select = $("#categorySelect");
  const categories = await loadData('categories', []);
  const containers = await loadData('containers', []);
  
  select.innerHTML = '<option value="">-- Select Category --</option>';
  
  categories.forEach(cat => {
    const container = containers.find(c => c.key === cat.containerKey);
    const containerInfo = container ? `${container.name} (${container.columns} columns)` : cat.containerKey;
    const layoutName = cat.layout === 'compact' ? 'List' : cat.layout === 'large' ? 'Large' : 'Cards';
    
    const option = document.createElement('option');
    option.value = cat.key;
    option.textContent = `${cat.name} | ${containerInfo} | ${layoutName}`;
    select.appendChild(option);
  });
}

function updateColumnSelect() {
  const containerColumns = parseInt($("#containerColumns").value) || 2;
  const columnSelect = $("#categoryColumn");
  
  if (columnSelect) {
    columnSelect.innerHTML = '';
    for (let i = 0; i < containerColumns; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Column ${i + 1}`;
      columnSelect.appendChild(option);
    }
  }
  
  const preview = document.querySelector('.container-grid-preview');
  if (preview) {
    preview.className = `container-grid-preview cols-${containerColumns}`;
    preview.innerHTML = Array(containerColumns).fill('<div></div>').join('');
  }
}

// ===== MAIN FUNCTIONS =====

/**
 * Test Wiki connection and synchronize data
 */
async function testConnection() {
  try {
    log("Testing connection and synchronizing structure...");
    const wikiData = await syncFromWiki();
    
    log(`✅ Connection successful!
    
Found structure:
- Containers: ${wikiData.containers.length}
- Categories: ${wikiData.categories.length}

Structure has been synchronized.`);
    
    await updateContainerSelect();
    await updateCategorySelect();
    
  } catch (e) {
    console.error("Connection test failed:", e);
    log(`❌ Connection failed: ${e.message}`);
  }
}

/**
 * CLEAR WIKI - Wrapper for external function
 */
async function handleClearWiki() {
  const result = await clearWikiPage(log);
  if (result?.success) {
    // Update UI after successful reset
    await updateContainerSelect();
    await updateCategorySelect();
  }
}

/**
 * RESET WIKI - Wrapper for external function  
 */
async function handleResetLinks() {
  const result = await resetLinksOnly(log);
  // UI update not needed as containers/categories are preserved
}

/**
 * LOAD DEMO TEMPLATE - New function
 */
async function handleLoadDemo() {
  const result = await loadDemoTemplate(log);
  if (result?.success) {
    // Update UI after successful demo load
    await updateContainerSelect();
    await updateCategorySelect();
  }
}

/**
 * Add link to selected category
 */
async function addCard() {
  try {
    log("Creating link card...");
    
    const tab = await getActiveTabInfo();
    const selectedCategoryKey = $("#categorySelect").value;
    
    if (!selectedCategoryKey) {
      throw new Error("Please select a category or create a new one.");
    }
    
    const { endpoint, token, pageId } = await chrome.storage.sync.get();
    const wikiData = await syncFromWiki();
    const contentManager = new WikiContentManager(wikiData.content);
    
    contentManager.addLinkToCategory(tab, selectedCategoryKey);
    
    await updateWikiPage(endpoint, token, pageId, contentManager.getContent());
    
    const categories = await loadData('categories', []);
    const category = categories.find(cat => cat.key === selectedCategoryKey);
    const categoryName = category ? category.name : selectedCategoryKey;
    
    log(`✅ Link successfully added!

Category: ${categoryName}
Title: "${tab.title}"
URL: ${tab.url}

The page has been updated and is immediately available.`);
    
  } catch (e) {
    console.error("Add card failed:", e);
    log(`❌ Error adding: ${e.message}`);
    
    // Fallback: Copy HTML to clipboard
    try {
      const tab = await getActiveTabInfo();
      const card = HTML_TEMPLATES.link(tab, 'cards');
      await navigator.clipboard.writeText(card);
      log(`\n📋 The link card has been copied to clipboard.`);
    } catch (clipErr) {
      console.error("Clipboard fallback failed:", clipErr);
    }
  }
}

/**
 * Create a new container
 */
async function createNewContainer() {
  const name = $("#containerName").value.trim();
  const columns = parseInt($("#containerColumns").value);
  
  if (!name) {
    log("❌ Error: Please enter a name for the container.");
    return;
  }
  
  const key = name.toLowerCase().replace(/[^a-z0-9äöüß]/g, '_').replace(/_+/g, '_');
  
  const containers = await loadData('containers', []);
  
  if (containers.some(container => container.key === key)) {
    log("❌ Error: A container with this name already exists.");
    return;
  }
  
  try {
    const { endpoint, token, pageId } = await chrome.storage.sync.get();
    const wikiData = await syncFromWiki();
    const contentManager = new WikiContentManager(wikiData.content);
    
    contentManager.addContainer(key, name, columns);
    
    await updateWikiPage(endpoint, token, pageId, contentManager.getContent());
    
    const newContainer = { key, name, columns };
    containers.push(newContainer);
    await saveData('containers', containers);
    
    await updateContainerSelect();
    $("#containerSelect").value = key;
    $("#newContainerForm").style.display = 'none';
    
    log(`✅ Container "${name}" successfully created and saved to wiki`);
    
  } catch (e) {
    console.error("Create container failed:", e);
    log(`❌ Error creating: ${e.message}`);
  }
}

/**
 * Create a new category
 */
async function createNewCategory() {
  const name = $("#categoryName").value.trim();
  const description = $("#categoryDesc").value.trim();
  const accent = $("#categoryAccent").value;
  const column = parseInt($("#categoryColumn").value || 0);
  const containerKey = $("#containerSelect").value;
  
  // Read layout from selected buttons
  const selectedLayoutButton = document.querySelector('.layout-option.selected');
  const layout = selectedLayoutButton ? selectedLayoutButton.dataset.layout : 'cards';
  
  if (!name) {
    log("❌ Error: Please enter a name for the category.");
    return;
  }
  
  if (!containerKey) {
    log("❌ Error: Please select a container or create a new one.");
    return;
  }
  
  const key = name.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[äöüß]/g, match => {
      const replacements = {'ä':'ae', 'ö':'oe', 'ü':'ue', 'ß':'ss'};
      return replacements[match];
    })
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/[-_]{2,}/g, '_');
  
  try {
    const { endpoint, token, pageId } = await chrome.storage.sync.get();
    const wikiData = await syncFromWiki();
    
    const existingCategories = wikiData.categories;
    const duplicateName = existingCategories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
    
    if (duplicateName) {
      log(`❌ Error: A category with the name "${name}" already exists.\n\nCategory names must be unique.`);
      return;
    }
    
    const contentManager = new WikiContentManager(wikiData.content);
    const newCategory = { key, name, description, layout, accent, containerKey, column };
    
    contentManager.addCategory(newCategory);
    
    await updateWikiPage(endpoint, token, pageId, contentManager.getContent());
    
    const categories = await loadData('categories', []);
    categories.push(newCategory);
    await saveData('categories', categories);
    
    await updateCategorySelect();
    $("#categorySelect").value = key;
    $("#newCategoryForm").style.display = 'none';
    
    log(`✅ Category "${name}" successfully created and saved to wiki`);
    
  } catch (e) {
    console.error("Create category failed:", e);
    log(`❌ Error creating: ${e.message}`);
  }
}

// Live Edit function
document.getElementById('btn-liveedit')?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  // Inject file - no existing logic is changed
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['live_edit.js']
  });
  window.close(); // Optionally close popup
});

// ===== EVENT LISTENERS =====
document.addEventListener("DOMContentLoaded", async function() {
  // Set DOM reference
  out = document.getElementById("out");
  
  // Main buttons
  const btnTest = $("#btnTest");
  const btnAdd = $("#btnAdd");
  
  if (btnTest) btnTest.addEventListener("click", testConnection);
  if (btnAdd) btnAdd.addEventListener("click", addCard);
  
  // ===== RESET BUTTONS AND DEMO BUTTON =====
  
  // Reset wiki (delete only links)
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Wiki';
  resetBtn.title = 'Deletes only links, keeps containers and categories';
  resetBtn.style.cssText = 'background-color: #d73a49; margin-left: 5px; color: white; padding: 8px 10px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px;';
  resetBtn.onclick = handleResetLinks;
  
  // Clear wiki completely
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Wiki';
  clearBtn.title = 'Deletes complete page (all data)';
  clearBtn.style.cssText = 'background-color: #666; margin-left: 5px; color: white; padding: 8px 10px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px;';
  clearBtn.onclick = handleClearWiki;
  
  // DEMO TEMPLATE Button
  const demoBtn = document.createElement('button');
  demoBtn.textContent = 'Load Demo';
  demoBtn.title = 'Loads a complete example template with containers and categories';
  demoBtn.style.cssText = 'background-color: #0366d6; margin-left: 5px; color: white; padding: 8px 10px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px;';
  demoBtn.onclick = handleLoadDemo;
  
  // Add buttons to DOM
  if (btnTest && btnTest.parentNode) {
    btnTest.parentNode.insertBefore(resetBtn, btnTest.nextSibling);
    btnTest.parentNode.insertBefore(clearBtn, resetBtn.nextSibling);
    btnTest.parentNode.insertBefore(demoBtn, clearBtn.nextSibling);
  }
  
  // ===== CONTAINER MANAGEMENT =====
  const newContainerBtn = $("#newContainerBtn");
  const createContainerBtn = $("#createContainerBtn");
  const cancelContainerBtn = $("#cancelContainerBtn");
  const containerColumns = $("#containerColumns");
  
  if (newContainerBtn) {
    newContainerBtn.addEventListener("click", () => {
      $("#newContainerForm").style.display = 'block';
      $("#containerName").focus();
    });
  }
  
  if (createContainerBtn) createContainerBtn.addEventListener("click", createNewContainer);
  
  if (cancelContainerBtn) {
    cancelContainerBtn.addEventListener("click", () => {
      $("#newContainerForm").style.display = 'none';
    });
  }
  
  if (containerColumns) containerColumns.addEventListener("change", updateColumnSelect);
  
  // ===== CATEGORY MANAGEMENT =====
  const newCategoryBtn = $("#newCategoryBtn");
  const createCategoryBtn = $("#createCategoryBtn");
  const cancelCategoryBtn = $("#cancelCategoryBtn");
  
  if (newCategoryBtn) {
    newCategoryBtn.addEventListener("click", () => {
      const containerKey = $("#containerSelect").value;
      if (!containerKey) {
        log("❌ Error: Please first select a container or create a new one.");
        return;
      }
      $("#newCategoryForm").style.display = 'block';
      updateColumnSelect();
      $("#categoryName").focus();
    });
  }
  
  if (createCategoryBtn) createCategoryBtn.addEventListener("click", createNewCategory);
  
  if (cancelCategoryBtn) {
    cancelCategoryBtn.addEventListener("click", () => {
      $("#newCategoryForm").style.display = 'none';
    });
  }
  
  // Layout button selection (without dropdown synchronization)
  document.querySelectorAll(".layout-option").forEach(option => {
    option.addEventListener("click", () => {
      document.querySelectorAll(".layout-option").forEach(o => o.classList.remove("selected"));
      option.classList.add("selected");
    });
  });
  
  // Container select change handler
  const containerSelect = $("#containerSelect");
  if (containerSelect) {
    containerSelect.addEventListener("change", async (e) => {
      if (e.target.value) {
        const containers = await loadData('containers', []);
        const container = containers.find(c => c.key === e.target.value);
        if (container) {
          const containerColumns = $("#containerColumns");
          if (containerColumns) {
            containerColumns.value = container.columns;
            updateColumnSelect();
          }
        }
      }
    });
  }
  
  // Initialization
  updateColumnSelect();
  
  // Auto-test on load (silently)
  testConnection().catch(() => {
    // Ignore initial connection errors
  });
  
  console.log("✅ EXTENSION LOG: Final popup.js with demo template loaded successfully");
});