import Konva from 'konva';

export interface TextMeasureOptions {
  text: string;
  width: number;
  fontSize?: number;
  fontFamily?: string;
}

// Text element layout constants
export const TEXT_ELEMENT_PADDING = 8;
export const TEXT_ELEMENT_MIN_HEIGHT = 40;
export const TEXT_ELEMENT_FONT_SIZE = 16;
export const TEXT_ELEMENT_FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";

// Sticky note layout constants
export const STICKY_TEXT_OFFSET_Y = 26;
export const STICKY_TEXT_PADDING_BOTTOM = 8;
export const STICKY_MIN_HEIGHT = 60;
export const STICKY_FONT_SIZE = 16;
export const STICKY_FONT_FAMILY = "'Segoe Print', 'Comic Sans MS', cursive";

/**
 * Measures the height needed to render wrapped text using Konva's text engine.
 * Creates a temporary offscreen Konva.Text node, reads its measured height,
 * then destroys it.
 */
export function measureTextHeight(options: TextMeasureOptions): number {
  const {
    text,
    width,
    fontSize = TEXT_ELEMENT_FONT_SIZE,
    fontFamily = TEXT_ELEMENT_FONT_FAMILY,
  } = options;

  const tempText = new Konva.Text({
    text: text || ' ',
    width,
    fontSize,
    fontFamily,
    wrap: 'word',
  });

  const measuredHeight = tempText.height();
  tempText.destroy();
  return measuredHeight;
}
