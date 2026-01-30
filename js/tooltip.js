/**
 * Tooltip utility for showing text bubbles on hover (desktop) or long-press (mobile)
 */

let tooltipElement = null;
let tooltipTimeout = null;
let isLongPressActive = false;

const LONG_PRESS_DURATION = 500; // milliseconds

/**
 * Initialize tooltip system
 */
export function initTooltips() {
  // Create tooltip element if it doesn't exist
  if (!tooltipElement) {
    tooltipElement = document.createElement("div");
    tooltipElement.className = "tooltip";
    document.body.appendChild(tooltipElement);
  }
}

/**
 * Show tooltip at specified position
 */
function showTooltip(text, x, y) {
  if (!tooltipElement) return;
  
  tooltipElement.textContent = text;
  
  // Position tooltip
  tooltipElement.style.left = `${x}px`;
  tooltipElement.style.top = `${y}px`;
  
  // Show tooltip
  tooltipElement.classList.add("visible");
  
  // Adjust position if tooltip goes off screen
  requestAnimationFrame(() => {
    const rect = tooltipElement.getBoundingClientRect();
    const padding = 8;
    
    let adjustedX = x;
    let adjustedY = y;
    
    // Check right edge
    if (rect.right > window.innerWidth - padding) {
      adjustedX = window.innerWidth - rect.width - padding;
    }
    
    // Check left edge
    if (rect.left < padding) {
      adjustedX = padding;
    }
    
    // Check bottom edge
    if (rect.bottom > window.innerHeight - padding) {
      adjustedY = y - rect.height - 16;
    }
    
    // Check top edge
    if (adjustedY < padding) {
      adjustedY = padding;
    }
    
    tooltipElement.style.left = `${adjustedX}px`;
    tooltipElement.style.top = `${adjustedY}px`;
  });
}

/**
 * Hide tooltip
 */
function hideTooltip() {
  if (!tooltipElement) return;
  tooltipElement.classList.remove("visible");
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
}

/**
 * Add tooltip to an element
 */
export function addTooltip(element, text) {
  if (!element || !text) return;
  
  element.setAttribute("data-tooltip", text);
  
  // Desktop: hover support
  element.addEventListener("mouseenter", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - 50; // Approximate center
    const y = rect.bottom + 8;
    showTooltip(text, x, y);
  });
  
  element.addEventListener("mouseleave", () => {
    if (!isLongPressActive) {
      hideTooltip();
    }
  });
  
  // Mobile: long-press support
  let longPressTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  
  element.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    
    longPressTimer = setTimeout(() => {
      isLongPressActive = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = touch.clientX - 50; // Position near touch point
      const y = rect.bottom + 8;
      showTooltip(text, x, y);
    }, LONG_PRESS_DURATION);
  }, { passive: true });
  
  element.addEventListener("touchmove", (e) => {
    // Cancel long press if finger moves too much
    const touch = e.touches[0];
    const moveThreshold = 10;
    
    if (Math.abs(touch.clientX - touchStartX) > moveThreshold ||
        Math.abs(touch.clientY - touchStartY) > moveThreshold) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (isLongPressActive) {
        hideTooltip();
        isLongPressActive = false;
      }
    }
  }, { passive: true });
  
  element.addEventListener("touchend", () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (isLongPressActive) {
      // Keep tooltip visible briefly after long press
      setTimeout(() => {
        hideTooltip();
        isLongPressActive = false;
      }, 1500);
    }
  }, { passive: true });
  
  element.addEventListener("touchcancel", () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (isLongPressActive) {
      hideTooltip();
      isLongPressActive = false;
    }
  }, { passive: true });
}

/**
 * Update tooltip text for an element
 */
export function updateTooltip(element, newText) {
  if (!element) return;
  element.setAttribute("data-tooltip", newText);
}

/**
 * Remove tooltip from an element
 */
export function removeTooltip(element) {
  if (!element) return;
  element.removeAttribute("data-tooltip");
  // Note: Event listeners will remain, but won't show anything without data-tooltip
}
