/**
 * Wiki.js Linker Chrome Extension - Live Edit Module
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
 * @description Live editing functionality with correct GraphQL queries from popup.js
 */

// live_edit.js — with correct GraphQL queries from popup.js
(() => {
  "use strict";

  // ============== SMALL UTILS ==============
  const qs = (s, r = document) => r.querySelector(s);
  const ce = (t, o = {}) => Object.assign(document.createElement(t), o);
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  const DEBUG = true;
  const log = (...a) => DEBUG && console.log("[LiveEdit]", ...a);

  // CORRECTED STORAGE FUNCTION
  async function getSettings() {
    try {
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Storage timeout"));
        }, 5000);

        chrome.storage.sync.get(['endpoint', 'token', 'locale', 'pageId'], (data) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(data);
        });
      });

      if (!result.endpoint || !result.token) {
        throw new Error("Endpoint/token missing (open options & save).");
      }
      
      return {
        endpoint: String(result.endpoint).trim() || "/graphql",
        token: String(result.token).trim(),
        locale: (result.locale || "en").trim(),
        pageId: result.pageId != null && String(result.pageId).trim() !== "" ? Number(result.pageId) : null,
      };
    } catch (error) {
      log("Storage Error:", error.message);
      throw error;
    }
  }

  // CORRECTED GRAPHQL FUNCTION WITH ABSOLUTE ENDPOINT
  async function gql(query, variables) {
    const settings = await getSettings();
    let endpoint = settings.endpoint;
    
    // Convert relative path to absolute URL
    if (endpoint.startsWith('/')) {
      endpoint = window.location.origin + endpoint;
    }
    
    if (DEBUG) log("→ gql", { endpoint, query: query.slice(0, 100) + '...', variables });
    
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": "Bearer " + settings.token 
      },
      body: JSON.stringify({ query, variables }),
    });

    const text = await res.text();
    if (DEBUG) log("← status", res.status, "body:", text.slice(0, 300));
    
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      if ([400, 401, 403].includes(res.status)) {
        throw new Error(`GraphQL ${res.status} — Check endpoint/token/syntax`);
      }
      throw new Error(`GraphQL Error (${res.status}): ${text.slice(0, 200)}`);
    }
    
    if (json.errors) {
      const msg = Array.isArray(json.errors)
        ? json.errors.map((e) => e.message).join("; ")
        : String(json.errors.message || "Unknown GraphQL error");
      throw new Error(msg);
    }
    
    return json.data;
  }

  // CORRECTED PAGE QUERY - EXACTLY LIKE IN POPUP.JS
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

  async function getPage() {
    const settings = await getSettings();
    
    if (!settings.pageId) {
      throw new Error("No page ID configured. Please enter in extension options.");
    }

    try {
      const data = await gql(QUERY_GET_PAGE, { id: settings.pageId });
      const page = data?.pages?.single;
      
      if (!page) {
        throw new Error(`Page with ID ${settings.pageId} not found`);
      }
      
      log("✅ Page loaded:", page.id, "Content length:", page.content?.length || 0);
      return page;
    } catch (error) {
      log("❌ getPage failed:", error.message);
      throw error;
    }
  }

  // CORRECTED UPDATE MUTATION - EXACTLY LIKE IN POPUP.JS
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

  // CORRECTED: Exactly like in reset-functions.js
  async function updateWikiPage(endpoint, token, page, newContent) {
    const currentPageDetails = page;
    const tagStrings = Array.isArray(currentPageDetails.tags) 
      ? currentPageDetails.tags.map(tag => (typeof tag === 'object' && tag.tag) ? tag.tag : String(tag)) 
      : [];
    
    const variables = {
      id: Number(currentPageDetails.id),
      content: newContent,
      title: currentPageDetails.title || "",
      isPublished: currentPageDetails.isPublished !== undefined ? currentPageDetails.isPublished : true,
      isPrivate: currentPageDetails.isPrivate || false,
      locale: currentPageDetails.locale || "en",
      path: currentPageDetails.path || "",
      tags: tagStrings
    };
    
    log("Updating with variables:", variables);
    const result = await gql(MUTATION_UPDATE_PAGE, variables);
    const responseResult = result?.pages?.update?.responseResult;
    
    if (!responseResult?.succeeded) { 
      throw new Error(`Wiki Update Error: ${responseResult?.message || "Update failed"}`); 
    }
    return result;
  }

  // ============== CONTENT HELPERS - CORRECTED WITH PROPER ID FORMAT ==============
  function buildSectionHTML({ title, accent = "accent-blue", body = "" }) {
    const timestamp = Date.now();
    
    // Create category key from title (like in popup.js)
    const categoryKey = title.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[äöüß]/g, match => {
        const replacements = {'ä':'ae', 'ö':'oe', 'ü':'ue', 'ß':'ss'};
        return replacements[match];
      })
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/[-_]{2,}/g, '_') + '_' + timestamp; // Uniqueness through timestamp
    
    // CRITICAL: ID must end with "-section" for popup.js compatibility!
    const id = categoryKey + "-section";
    
    const html = `
<section class="section-card ${accent}" id="${id}">
  <header class="section-card__header">
    <div class="section-card__title">${title}</div>
    <div class="section-card__meta">newly added</div>
  </header>
  <div class="links">
    ${body}
    <!-- ${categoryKey.toUpperCase()}_LINKS_END -->
  </div>
</section>`.trim();
    return { id, html, categoryKey };
  }

  function insertBeforeMarker(content, marker, snippet) {
    const i = content.indexOf(marker);
    if (i === -1) return null;
    return content.slice(0, i) + snippet + "\n" + content.slice(i);
  }

  // ============== UI - UNCHANGED ==============
  function injectStyles() {
    if (qs("#liveedit-style")) return;
    const css = `
#liveedit-bar{position:fixed;right:1rem;top:6rem;z-index:2147483647;background:rgba(20,20,25,.92);color:#f1f5f9;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.15);border-radius:.7rem;padding:.6rem .7rem;display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;font:500 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#liveedit-bar select,#liveedit-bar input{padding:.35rem .5rem;border-radius:.45rem;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:inherit}
#liveedit-bar select option{background:rgba(20,20,25,.95);color:#f1f5f9;border:none}
#liveedit-bar button{padding:.4rem .6rem;border-radius:.45rem;border:1px solid #64748b;background:transparent;color:#e2e8f0;cursor:pointer}
#liveedit-bar button:hover{background:#64748b;color:#fff}
#liveedit-toast{position:fixed;right:1rem;top:4.3rem;z-index:2147483647;padding:.4rem .6rem;border-radius:.4rem;display:none;color:#fff}
#liveedit-toast.ok{background:#16a34a}#liveedit-toast.err{background:#b91c1c}
@media (max-width:980px){#liveedit-bar{left:.8rem;right:.8rem}}
`;
    document.head.appendChild(ce("style", { id: "liveedit-style", textContent: css }));
  }

  function toast(msg, ok = true) {
    let t = qs("#liveedit-toast");
    if (!t) document.body.appendChild((t = ce("div", { id: "liveedit-toast" })));
    t.className = ok ? "ok" : "err";
    t.textContent = msg;
    t.style.display = "block";
    setTimeout(() => (t.style.display = "none"), 3000);
  }

  function createBar() {
    if (qs("#liveedit-bar")) return qs("#liveedit-bar");
    injectStyles();
    const bar = ce("div", { id: "liveedit-bar" });
    bar.innerHTML = `
      <strong style="margin-right:.4rem">Live&nbsp;Edit</strong>
      <select id="le-container"><option value="development">Development</option><option value="productivity">Productivity</option></select>
      <select id="le-accent"><option value="accent-blue">Blue</option><option value="accent-green">Green</option><option value="accent-purple">Purple</option><option value="accent-orange">Orange</option><option value="accent-teal">Teal</option></select>
      <input id="le-title" type="text" placeholder="Title" style="min-width:14rem">
      <button id="le-add">Insert Category</button>
      <button id="le-save">Save + Publish</button>
      <button id="le-close" title="Close">×</button>
    `;
    document.body.appendChild(bar);
    return bar;
  }

  // ============== STATE & ACTIONS ==============
  const MARKERS = {
    development: "<!-- CONTAINER_DEVELOPMENT_CONTENT_END -->",
    productivity: "<!-- CONTAINER_PRODUCTIVITY_CONTENT_END -->",
  };

  let loaded = null;        // { id, content }
  let working = "";         // Working string
  let lastSnippetId = null; // ID for verification

  async function ensureLoaded() {
    if (loaded) return loaded;
    const page = await getPage();
    if (!page) throw new Error("Page not found");
    loaded = page;
    working = String(page.content || "");
    return loaded;
  }

  async function actionAdd() {
    await ensureLoaded();
    const container = qs("#le-container").value;
    const accent = qs("#le-accent").value;
    const title = qs("#le-title").value.trim() || "New Category";

    const { id: snippetId, html, categoryKey } = buildSectionHTML({ title, accent });
    lastSnippetId = snippetId;

    const marker = MARKERS[container] || MARKERS.development;
    const next = insertBeforeMarker(working, marker, html);
    if (!next) throw new Error("Marker not found: " + marker);
    working = next;

    // Local preview
    const hostId = container === "productivity" ? "productivity-container" : "development-container";
    const host = document.getElementById(hostId) || document.body;
    const tmp = ce("div"); tmp.innerHTML = html;
    host.appendChild(tmp.firstElementChild);

    // Add NEW category to extension structure
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.sync.get(['categories'], (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(data);
        });
      });

      const categories = result.categories || [];
      const newCategory = {
        key: categoryKey,
        name: title,
        description: 'newly added',
        layout: 'cards', // live_edit always uses section-card
        accent: accent.replace('accent-', ''), // 'accent-blue' → 'blue'
        containerKey: container,
        column: 0
      };

      categories.push(newCategory);

      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({ categories }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });

      log("✅ Category added to extension structure:", categoryKey);
    } catch (storageError) {
      log("⚠️ Storage update failed:", storageError.message);
      // Not critical - category still works
    }

    toast("Category locally inserted (not yet saved)");
  }

  async function actionSave() {
    const page = await ensureLoaded();
    const settings = await getSettings();
    
    // CORRECTED: Use same function as reset-functions.js
    await updateWikiPage(settings.endpoint, settings.token, page, working);

    // Verification - reload page and check
    const after = await getPage();
    const ok = after?.content?.includes(lastSnippetId) ||
               (typeof after?.content === "string" && after.content.length >= working.length - 10);

    if (!ok) {
      throw new Error("Server did not accept the block. Check network tab for details.");
    }

    toast("Saved & published", true);
    
    // Reset for next round
    loaded = null;
    working = "";
  }

  function mount() {
    const bar = createBar();
    bar.querySelector("#le-add").onclick = () =>
      actionAdd().catch((e) => toast(e.message || String(e), false));
    bar.querySelector("#le-save").onclick = () =>
      actionSave().catch((e) => toast(e.message || String(e), false));
    bar.querySelector("#le-close").onclick = () => bar.remove();

    ensureLoaded().catch((e) => toast(e.message || String(e), false));
  }

  ready(mount);
})();