/**
 * @module tabs
 * @description Owns the tab strip: switches the active tab button and the
 * matching tab panel. All DOM access for the tab strip lives here.
 */

/**
 * Wire up tab switching for every element with the .tab class.
 *
 * @returns {void}
 */
export function initTabs() {
  const tabButtons = document.querySelectorAll(".tab");
  const tabPanels = document.querySelectorAll(".tab-panel");
  tabButtons.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab, tabButtons, tabPanels));
  });
}

/**
 * Activate one tab and its panel, deactivating all others.
 *
 * @param {HTMLElement} tab - The clicked tab button.
 * @param {NodeList} tabButtons - All tab buttons.
 * @param {NodeList} tabPanels - All tab panels.
 * @returns {void}
 */
function activate(tab, tabButtons, tabPanels) {
  tabButtons.forEach((t) => t.classList.remove("active"));
  tabPanels.forEach((p) => p.classList.remove("active"));
  tab.classList.add("active");
  document.getElementById(tab.dataset.tab).classList.add("active");
}
