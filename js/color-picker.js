// Simple color picker modal for ticket color selection

const PRESET_COLORS = [
  "#FF6B6B", // Red
  "#FFB74D", // Orange
  "#FFD93D", // Yellow
  "#8BC34A", // Green
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#7E57C2", // Purple
  "#EC407A", // Pink
  "#78909C", // Gray
  "#A1887F", // Brown
];

let currentTicketId = null;
let onColorSelected = null;

export function showColorPicker(ticketId, currentColor, callback) {
  currentTicketId = ticketId;
  onColorSelected = callback;

  // Remove existing picker if any
  const existing = document.getElementById("colorPickerModal");
  if (existing) {
    existing.remove();
  }

  // Create modal overlay
  const overlay = document.createElement("div");
  overlay.id = "colorPickerModal";
  overlay.className = "colorPickerOverlay";

  // Create modal content
  const modal = document.createElement("div");
  modal.className = "colorPickerModal";

  // Add title
  const title = document.createElement("h3");
  title.className = "colorPickerTitle";
  title.textContent = "Choose Ticket Color";
  modal.appendChild(title);

  // Add color grid
  const colorGrid = document.createElement("div");
  colorGrid.className = "colorPickerGrid";

  // Add preset color options
  PRESET_COLORS.forEach((color) => {
    const colorOption = document.createElement("button");
    colorOption.className = "colorPickerOption";
    colorOption.style.backgroundColor = color;
    colorOption.type = "button";
    
    if (color === currentColor) {
      colorOption.classList.add("selected");
    }

    colorOption.addEventListener("click", () => {
      selectColor(color);
    });

    colorGrid.appendChild(colorOption);
  });

  modal.appendChild(colorGrid);

  // Add custom color input
  const customSection = document.createElement("div");
  customSection.className = "colorPickerCustom";

  const customLabel = document.createElement("label");
  customLabel.textContent = "Custom color:";
  customLabel.className = "colorPickerLabel";

  const customInput = document.createElement("input");
  customInput.type = "color";
  customInput.className = "colorPickerInput";
  customInput.value = currentColor || PRESET_COLORS[0];

  customInput.addEventListener("change", (e) => {
    selectColor(e.target.value);
  });

  customSection.appendChild(customLabel);
  customSection.appendChild(customInput);
  modal.appendChild(customSection);

  // Add clear button
  const clearBtn = document.createElement("button");
  clearBtn.className = "colorPickerClearBtn";
  clearBtn.textContent = "Clear Color";
  clearBtn.type = "button";
  clearBtn.addEventListener("click", () => {
    selectColor(null);
  });
  modal.appendChild(clearBtn);

  // Add close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "colorPickerCloseBtn";
  closeBtn.textContent = "×";
  closeBtn.type = "button";
  closeBtn.addEventListener("click", closeColorPicker);
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeColorPicker();
    }
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeColorPicker();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

function selectColor(color) {
  if (onColorSelected) {
    onColorSelected(currentTicketId, color);
  }
  closeColorPicker();
}

function closeColorPicker() {
  const overlay = document.getElementById("colorPickerModal");
  if (overlay) {
    overlay.remove();
  }
  currentTicketId = null;
  onColorSelected = null;
}
