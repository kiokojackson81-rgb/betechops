export const PRODUCT_GALLERY_AI_WIDTH = 1774;
export const PRODUCT_GALLERY_AI_HEIGHT = 887;
export const PRODUCT_GALLERY_AI_MAX_SOURCE_EDGE = 1600;
export const PRODUCT_GALLERY_AI_EDIT_WIDTH = 1536;
export const PRODUCT_GALLERY_AI_EDIT_HEIGHT = 1024;

// OpenAI image models work best when asked to preserve the source text and branding exactly.
export const PRODUCT_GALLERY_AI_PROMPT = `Redesign and resize this image into a wide website product gallery image.

Keep all original wording, logos, prices, specifications, icons, badges, contact details, and branding visible and readable. Do not remove, rewrite, recreate, or change any text.

Reframe the design into a clean wide product image layout similar to a website catalog banner. The image should fill the frame well with minimal empty margins. Arrange the content so the main product is large, centered, sharp, and professional, while all text sections remain balanced and fully visible.

Preserve the entire source artwork from edge to edge. No text may be cut off, hidden, truncated, or pushed outside the frame. If the original design is tall or square, reduce and reposition the composition so everything remains visible inside the wide canvas.

Do not add blurred side panels, thick outer borders, floating framed cards, or large empty white gutters. The artwork itself should span the banner naturally. Keep all important wording, logos, prices, specifications, icons, badges, and contact details inside a centered 2:1 safe area so the final website banner can use the full width cleanly.

Prioritize zero cropping over edge-to-edge fill. It is better to preserve the full artwork with subtle edge extension than to cut off any text, logo, price, icon, contact detail, or product edge.

Requirements:

- Output size: 1774 x 887 px
- Aspect ratio: 2:1 wide landscape
- Keep the full design visible
- Do not crop important content
- Do not stretch or warp the image
- Do not distort product proportions
- Keep colors natural and close to the original
- Minimize side, top, and bottom empty space
- Make it look clean, sharp, and ready for website product gallery upload`;

export const PRODUCT_GALLERY_AI_SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
