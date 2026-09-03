// Tooltip management
let tooltipTimeout = null;

// Adds tooltips to truncated text
export function updateTooltips() {
  if (tooltipTimeout) clearTimeout(tooltipTimeout);

  tooltipTimeout = setTimeout(() => {
    tooltipTimeout = null;
    const elements = document.querySelectorAll('#main li a');
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.clientWidth + 1 < element.scrollWidth) {
        element.title = element.title || element.textContent;
      } else if (element.title === element.textContent) {
        element.title = '';
      }
    }
  }, 100);
}