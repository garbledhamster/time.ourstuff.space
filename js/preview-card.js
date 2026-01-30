import { getTimeFormat, cycleTimeFormat, formatDurationByFormat } from './utils.js';

/**
 * Format duration based on current format preference
 */
function formatDuration(startDate, endDate) {
  const diffMs = endDate.getTime() - startDate.getTime();
  
  // Handle negative or invalid durations
  if (diffMs < 0 || isNaN(diffMs)) {
    return '0s';
  }
  
  const totalSeconds = Math.floor(diffMs / 1000);
  const format = getTimeFormat();
  
  return formatDurationByFormat(totalSeconds, format);
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
export function createPreviewCard({ onDelete } = {}) {
  let card = null;
  let currentEvent = null;
  let clickOutsideListenerAdded = false;
  
  function handleClickOutside(e) {
    if (card && !card.contains(e.target) && card.classList.contains('visible')) {
      hide();
    }
  }
  
  function handleEscapeKey(e) {
    if (e.key === 'Escape' && card && card.classList.contains('visible')) {
      hide();
    }
  }
  
  function create() {
    if (card) return card;
    
    card = document.createElement('div');
    card.className = 'previewCard';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-labelledby', 'previewCardTitle');
    card.innerHTML = `
      <div class="previewCard-header">
        <div class="previewCard-title" id="previewCardTitle"></div>
        <div class="previewCard-actions">
          <button class="previewCard-action previewCard-delete" type="button" aria-label="Delete time block">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <button class="previewCard-action previewCard-close" type="button" aria-label="Close">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="previewCard-body">
        <div class="previewCard-time">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span class="previewCard-duration clickable" title="Click to cycle time format"></span>
        </div>
        <div class="previewCard-note"></div>
      </div>
    `;
    
    // Close button handler
    const closeBtn = card.querySelector(".previewCard-close");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hide();
    });

    const deleteBtn = card.querySelector(".previewCard-delete");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (onDelete && currentEvent) {
        onDelete(currentEvent);
      }
      hide();
    });
    
    // Duration click handler to cycle format
    const durationEl = card.querySelector('.previewCard-duration');
    durationEl.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleTimeFormat();
      // Re-show with the same event to update the display
      if (currentEvent) {
        const start = currentEvent.start ? new Date(currentEvent.start) : new Date();
        const end = currentEvent.end ? new Date(currentEvent.end) : new Date();
        const duration = formatDuration(start, end);
        durationEl.textContent = duration;
      }
    });
    
    document.body.appendChild(card);
    
    // Add click outside and keyboard handlers only once
    if (!clickOutsideListenerAdded) {
      // Use capture phase and add delay to prevent immediate close
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
        document.addEventListener('keydown', handleEscapeKey);
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
  
  function getCurrentEventId() {
    return currentEvent ? currentEvent.id : null;
  }
  
  return { show, hide, isVisible, getCurrentEventId };
}
