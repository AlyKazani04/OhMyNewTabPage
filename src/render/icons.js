import { get } from '../config/storage.js';
import { getFaviconUrl } from '../core/chrome-api.js';

// Gets best icon for a node
export function getIcon(node) {
  let url = null;
  let url2x = null;

  if (node.icons) {
    let size;
    for (const i in node.icons) {
      const iconInfo = node.icons[i];
      if (
        iconInfo.url &&
        (!size || (iconInfo.size < size && iconInfo.size > 15))
      ) {
        url = iconInfo.url;
        if (iconInfo.size > 31) url2x = iconInfo.url;
        size = iconInfo.size;
      }
    }
  } else if (node.icon) {
    url = node.icon;
  } else if (node.url) {
    url = getFaviconUrl(node.url, 16);
    url2x = getFaviconUrl(node.url, 32);
  }

  const icon = document.createElement(url ? 'img' : 'div');
  icon.className = 'icon';
  icon.src = url;
  if (url2x) icon.srcset = url2x + ' 2x';
  icon.alt = ' ';
  return icon;
}