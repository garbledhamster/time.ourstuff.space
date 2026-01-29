import { $ } from "./utils.js";

/**
 * Format duration in hours, minutes, and seconds
 */
function formatDuration(startDate, endDate) {
  const diffMs = endDate.getTime() - startDate.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

/**
 * Position the card within screen boundaries
 */
function positionCard(card, clickX, clickY) {
  const cardRect = card.getBoundingClientRect();
  const padding = 10;
  
  let left = clickX + padding;
  let top = clickY + padding;
  
  // Check right boundary
  if (left + cardRect.width > window.innerWidth - padding) {
    left = clickX - cardRect.width - padding;
  }
  
  // Check bottom boundary
  if (top + cardRect.height > window.innerHeight - padding) {
    top = clickY - cardRect.height - padding;
  }
  
  // Ensure not too far left
  if (left < padding) {
    left = padding;
  }
  
  // Ensure not too far top
  if (top < padding) {
    top = padding;
  }
  
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

/**
 * Create and manage the preview card
 */
export function createPreviewCard() {
  let card = null;
  let currentEvent = null;
  let clickOutsideListenerAdded = false;
  
  function handleClickOutside(e) {
    if (card && !card.contains(e.target) && card.classList.contains('visible')) {
      hide();
    }
  }
  
  function create() {
    if (card) return card;
    
    card = document.createElement('div');
    card.className = 'previewCard';
    card.innerHTML = `
      <div class="previewCard-header">
        <div class="previewCard-title"></div>
        <button class="previewCard-close" type="button" aria-label="Close">
          <svg class="btn-icon" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="previewCard-body">
        <div class="previewCard-time">
          <svg class="btn-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span class="previewCard-duration"></span>
        </div>
        <div class="previewCard-note"></div>
        <div class="previewCard-hint">Click again to edit</div>
      </div>
    `;
    
    // Close button handler
    const closeBtn = card.querySelector('.previewCard-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hide();
    });
    
    document.body.appendChild(card);
    
    // Add click outside handler only once
    if (!clickOutsideListenerAdded) {
      // Use capture phase and add delay to prevent immediate close
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
        clickOutsideListenerAdded = true;
      }, 100);
    }
    
    return card;
  }
  
  function show(event, ticketTitle, clickX, clickY) {
    currentEvent = event;
    const cardEl = create();
    
    const start = event.start ? new Date(event.start) : new Date();
    const end = event.end ? new Date(event.end) : new Date();
    const duration = formatDuration(start, end);
    const notes = event.extendedProps?.notes || '';
    const title = ticketTitle || event.title || 'Untitled';
    
    // Update content
    cardEl.querySelector('.previewCard-title').textContent = title;
    cardEl.querySelector('.previewCard-duration').textContent = duration;
    
    const noteEl = cardEl.querySelector('.previewCard-note');
    if (notes.trim()) {
      noteEl.textContent = notes;
      noteEl.style.display = 'block';
    } else {
      noteEl.textContent = '';
      noteEl.style.display = 'none';
    }
    
    // Show card
    cardEl.classList.add('visible');
    
    // Position after render to get accurate dimensions
    requestAnimationFrame(() => {
      positionCard(cardEl, clickX, clickY);
    });
  }
  
  function hide() {
    if (card) {
      card.classList.remove('visible');
      currentEvent = null;
    }
  }
  
  function isVisible() {
    return card && card.classList.contains('visible');
  }
  
  function getCurrentEvent() {
    return currentEvent;
  }
  
  return { show, hide, isVisible, getCurrentEvent };
}
