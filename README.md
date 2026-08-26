# OhMyNewTabPage

<!--toc:start-->

- [OhMyNewTabPage](#ohmynewtabpage)
  - [Features & Roadmap](#features-roadmap)
  - [Themes](#themes)
  - [Usage & Navigation](#usage-navigation)
  - [Contributing](#contributing)
  - [License](#license)

<!--toc:end-->

A lightning-fast, keyboard-centric new tab page for power users. This project is a feature-rich fork of the **Humble New Tab Page** extension, with added functionalities and optimized for productivity.

## Features & Roadmap

- [x] **Vim Navigation** — Navigate your bookmarks and links seamlessly using intuitive keyboard shortcuts.
- [x] **Theme Picker** — Switch instantly between popular aesthetic themes (Nord, Catppuccin, Rosé Pine, Tokyo Night, and more).
- [x] **Cut, Copy & Paste for Bookmarks** — Easily rearrange and reorganize your bookmarked links directly from the keyboard or mouse.

## Themes

OhMyNewTabPage ships with 13 built-in themes, with inspiration taken from [Omarchy](https://omarchy.org/) — color values are drawn from its theme collection. **Nord** is the default.

| Dark             | Light            |
| :--------------- | :--------------- |
| Nord _(default)_ | Nord Light       |
| Catppuccin       | Catppuccin Latte |
| Rosé Pine        | Rosé Pine Dawn   |
| Tokyo Night      | Tokyo Night Day  |
| Gruvbox          |                  |
| Everforest       |                  |
| Hackerman        |                  |
| Matte Black      |                  |
| Osaka Jade       |                  |

Press `T` to open the keyboard-accessible theme picker, or pick a theme in the options panel (`/`).

Note: The themes do not auto-switch on Omarchy.

### Example

**Nord**

<img width="700" src="./demo/Nord.png" alt="Nord">

**Tokyo Night**

<img width="700" src="./demo/TokyoNight.png" alt="Tokyo Night">

**Osaka Jade**

<img width="700" src="./demo/OsakaJade.png" alt="Osaka Jade">

**Matte Black**

<img width="700" src="./demo/MatteBlack.png" alt="Matte Black">

and more...

## Usage & Navigation

Designed with speed in mind, OhMyNewTabPage allows you to stay entirely* on your keyboard.

|         **Key**          | **Action**                                   |
| :----------------------: | :------------------------------------------- |
| `h` or `left arrow (←)`  | Select the column to the left                |
| `l` or `right arrow (→)` | Select the column to the right               |
| `j` or `down arrow (↓)`  | Select the next item                         |
|  `k` or `up arrow (↑)`   | Select the previous item                     |
|      `Enter` or `o`      | Open folder or link                          |
|           `O`            | Open folder only (no-op on links)            |
|           `v`            | Toggle selection (visual mode)               |
|           `V`            | Clear selection                              |
|           `y`            | Yank (copy) selection or item under cursor   |
|           `x`            | Cut selection or item under cursor (dims it) |
|           `p`            | Paste below the item under the cursor        |
|           `P`            | Paste above the item under the cursor        |
|           `n`            | Create a bookmark on the current level       |
|           `N`            | Create a folder on the current level         |
|           `e`            | Edit bookmark or folder                      |
|           `d`            | Delete bookmark or folder (asks to confirm)  |
|           `T`            | Open the theme picker                        |
|           `/`            | Open the options panel (`Esc` closes it)     |
|          `Esc`           | Clear selection / cancel cut                 |

Notes:

- Cut and paste operate on your actual bookmarks, not just the page layout.
  The paste destination follows the cursor's layer: pasting while the cursor
  is inside an open folder puts the item in that folder; pasting on a
  top-level item puts it back at the top level of that column.
- Cut items stay where they are (dimmed) until pasted; `Esc` cancels.
- Copying (`y`) duplicates the whole subtree, including folder contents.
- With the mouse, drop an item directly onto a folder header to move it
  inside that folder — the top and bottom edges of the header keep the
  regular reorder behavior.
- _The options menu navigation is a work in progress._

## Contributing

Contributions are very welcome! Whether it's reporting a bug, suggesting a feature, or submitting a pull request, your help is appreciated.

Please read our [CONTRIBUTING](/CONTRIBUTING.md) guide for details.

## License

Distributed under the MIT License. See [LICENSE](/LICENSE) for more information.
