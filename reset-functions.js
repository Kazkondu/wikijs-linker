/**
 * Wiki.js Linker Chrome Extension - Reset Functions
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
 * @description Reset functions with correct removeAllLinks implementation
 */

// ===== HELPER FUNCTIONS (GraphQL, etc.) =====

/**
 * Executes a GraphQL query against Wiki.js
 * @param {string} endpoint - GraphQL endpoint URL
 * @param {string} token - Bearer authentication token
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} GraphQL response data
 * @throws {Error} On HTTP or GraphQL errors
 */
async function executeGraphQL(endpoint, token, query, variables) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ query, variables })
  });
  const responseText = await response.text();
  if (!response.ok) { throw new Error(`HTTP ${response.status} — ${response.statusText}: ${responseText}`); }
  let json = {};
  try { json = JSON.parse(responseText); } catch (e) { throw new Error(`Invalid JSON response: ${responseText.slice(0, 200)}`); }
  if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) { throw new Error(`GraphQL Error: ${json.errors.map(e => e.message || String(e)).join("; ")}`); }
  return json.data || json;
}

/**
 * Loads a Wiki.js page by ID
 * @param {string} endpoint - GraphQL endpoint URL
 * @param {string} token - Bearer authentication token
 * @param {number|string} pageId - Wiki page ID
 * @returns {Promise<Object>} Page data object
 * @throws {Error} If page not found
 */
async function loadWikiPage(endpoint, token, pageId) {
  const id = Number(pageId);
  const data = await executeGraphQL(endpoint, token, QUERY_GET_PAGE, { id });
  const page = data?.pages?.single;
  if (!page) { throw new Error(`Wiki page with ID ${id} not found`); }
  return page;
}

/**
 * Updates a Wiki.js page with new content
 * @param {string} endpoint - GraphQL endpoint URL
 * @param {string} token - Bearer authentication token
 * @param {Object} page - Page object with metadata
 * @param {string} newContent - New HTML content
 * @returns {Promise<Object>} Update result
 * @throws {Error} On update failure
 */
async function updateWikiPage(endpoint, token, page, newContent) {
  const currentPageDetails = page;
  const tagStrings = Array.isArray(currentPageDetails.tags) ? currentPageDetails.tags.map(tag => (typeof tag === 'object' && tag.tag) ? tag.tag : String(tag)) : [];
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
  const result = await executeGraphQL(endpoint, token, MUTATION_UPDATE_PAGE, variables);
  const responseResult = result?.pages?.update?.responseResult;
  if (!responseResult?.succeeded) { throw new Error(`Wiki Update Error: ${responseResult?.message || "Update failed"}`); }
  return result;
}

// GraphQL query to retrieve page data
const QUERY_GET_PAGE = `query GetPage($id: Int!) { pages { single(id: $id) { id path title editor content description isPrivate isPublished locale tags { id tag title } createdAt updatedAt } } }`;

// GraphQL mutation to update page content
const MUTATION_UPDATE_PAGE = `mutation UpdatePage($id: Int!, $content: String!, $title: String, $isPublished: Boolean, $isPrivate: Boolean, $locale: String, $path: String, $tags: [String]) { pages { update(id: $id, content: $content, title: $title, isPublished: $isPublished, isPrivate: $isPrivate, locale: $locale, path: $path, tags: $tags) { responseResult { succeeded errorCode message } page { id updatedAt } } } }`;

// ===== WIKI STRUCTURE ANALYZER =====

/**
 * Analyzes Wiki page structure to extract containers and categories
 */
class WikiStructureAnalyzer {
  /**
   * @param {string} content - HTML content to analyze
   */
  constructor(content) {
    this.content = content || "";
  }
  
  /**
   * Extracts category information from HTML content
   * @returns {Array<Object>} Array of category objects
   */
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
      
      categories.push({
        key,
        name: titleMatch ? titleMatch[1] : key,
        description: metaMatch ? metaMatch[1] : '',
        layout,
        accent
      });
    }
    
    return categories;
  }
}

// ===== WIKI CONTENT MANAGER =====

/**
 * Manages Wiki page content modifications
 */
class WikiContentManager {
    /**
     * @param {string} content - Initial HTML content
     */
    constructor(content) {
        this.content = content || "";
        this.analyzer = new WikiStructureAnalyzer(content);
    }
    
    /**
     * Remove all links from categories
     * Based on the working implementation from popup.js
     * @returns {WikiContentManager} Returns this for method chaining
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

    /**
     * Gets the current content
     * @returns {string} HTML content
     */
    getContent() {
        return this.content;
    }
}

// ===== EXPORTED MAIN FUNCTIONS =====

/**
 * Reset only the links on the Wiki page
 * Uses the correct removeAllLinks implementation
 * @param {Function} log - Logging function for status updates
 * @returns {Promise<Object>} Result object with success status
 */
export async function resetLinksOnly(log) {
  log("Resetting links on wiki page...");
  try {
    const config = await chrome.storage.sync.get(['endpoint', 'token', 'pageId']);
    if (!config.endpoint || !config.token || !config.pageId) {
      throw new Error("Wiki configuration incomplete. Please check options.");
    }

    const page = await loadWikiPage(config.endpoint, config.token, config.pageId);
    const contentManager = new WikiContentManager(page.content);

    // Uses the corrected logic
    contentManager.removeAllLinks();
    const newContent = contentManager.getContent();

    await updateWikiPage(config.endpoint, config.token, page, newContent);

    log("✅ Links successfully reset. Page structure and publication status have been preserved.");
    return { success: true };

  } catch (error) {
    console.error("Error resetting links:", error);
    log(`❌ Error resetting: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Clear the entire Wiki page
 * @param {Function} log - Logging function for status updates
 * @returns {Promise<Object>} Result object with success status
 */
export async function clearWikiPage(log) {
  log("Clearing entire wiki page...");
  try {
    const config = await chrome.storage.sync.get(['endpoint', 'token', 'pageId']);
     if (!config.endpoint || !config.token || !config.pageId) {
      throw new Error("Wiki configuration incomplete. Please check options.");
    }

    const page = await loadWikiPage(config.endpoint, config.token, config.pageId);
    const emptyContentPlaceholder = "<br/>"; 
    await updateWikiPage(config.endpoint, config.token, page, emptyContentPlaceholder);

    log("✅ Wiki page successfully cleared (content was set to <br/>).");
    return { success: true };

  } catch (error) {
    console.error("Error clearing wiki page:", error);
    log(`❌ Error clearing: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Diagnostic function for testing reset functions
 * @param {Function} log - Logging function for status updates
 * @returns {Promise<Object>} Result object with success status
 */
export async function testResetFunctions(log) {
    log("✅ Reset functions are correctly loaded and ready.");
    return { success: true };
}