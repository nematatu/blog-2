function isElement(node) {
  return !!node && typeof node === "object" && node.type === "element";
}

function isWhitespaceText(node) {
  return (
    !!node &&
    typeof node === "object" &&
    node.type === "text" &&
    String(node.value || "").trim().length === 0
  );
}

function isCaptionParagraph(node) {
  if (!isElement(node) || node.tagName !== "p") return false;
  let hasText = false;

  for (const child of node.children || []) {
    if (child.type === "text") {
      if (String(child.value || "").trim().length > 0) hasText = true;
      continue;
    }

    if (isElement(child) && child.tagName === "em") {
      let emHasText = false;
      for (const emChild of child.children || []) {
        if (emChild.type === "text") {
          if (String(emChild.value || "").trim().length > 0) emHasText = true;
          continue;
        }
        return false;
      }
      if (emHasText) hasText = true;
      continue;
    }

    return false;
  }

  return hasText;
}

function isInlineEmCaption(node) {
  if (!isElement(node) || node.tagName !== "em") return false;
  let hasText = false;

  for (const child of node.children || []) {
    if (child.type === "text") {
      if (String(child.value || "").trim().length > 0) hasText = true;
      continue;
    }
    return false;
  }

  return hasText;
}

function applyLazyImageAttrs(node) {
  if (!isElement(node) || node.tagName !== "img") return;
  if (!node.properties) node.properties = {};
  if (!("loading" in node.properties)) node.properties.loading = "lazy";
  if (!("decoding" in node.properties)) node.properties.decoding = "async";
  if (!("fetchpriority" in node.properties)) node.properties.fetchpriority = "low";
}

function splitParagraphWithInlineCaption(node) {
  if (!isElement(node) || node.tagName !== "p") return null;

  let imgIndex = -1;
  for (let i = 0; i < node.children.length; i += 1) {
    const child = node.children[i];
    if (isElement(child) && child.tagName === "img") {
      imgIndex = i;
      break;
    }
  }
  if (imgIndex === -1) return null;

  let lastMeaningfulIndex = -1;
  for (let i = node.children.length - 1; i >= 0; i -= 1) {
    const child = node.children[i];
    if (isWhitespaceText(child)) continue;
    lastMeaningfulIndex = i;
    break;
  }
  if (lastMeaningfulIndex === -1) return null;

  const lastMeaningful = node.children[lastMeaningfulIndex];
  if (!isElement(lastMeaningful) || !isInlineEmCaption(lastMeaningful)) return null;
  if (imgIndex >= lastMeaningfulIndex) return null;

  for (let i = imgIndex + 1; i < lastMeaningfulIndex; i += 1) {
    if (!isWhitespaceText(node.children[i])) return null;
  }

  const beforeChildren = node.children
    .slice(0, imgIndex)
    .filter((child) => !isWhitespaceText(child));

  const figure = {
    type: "element",
    tagName: "figure",
    properties: { className: ["image-caption"] },
    children: [
      node.children[imgIndex],
      {
        type: "element",
        tagName: "figcaption",
        properties: {},
        children: lastMeaningful.children,
      },
    ],
  };

  const result = [];
  if (beforeChildren.length > 0) {
    result.push({
      type: "element",
      tagName: "p",
      properties: node.properties || {},
      children: beforeChildren,
    });
  }
  result.push(figure);
  return result;
}

function wrapImageWithCaption(parent) {
  if (!parent || !Array.isArray(parent.children)) return;

  for (let i = 0; i < parent.children.length - 1; i += 1) {
    const node = parent.children[i];
    const next = parent.children[i + 1];

    if (!isElement(node)) continue;

    if (node.tagName === "p") {
      const split = splitParagraphWithInlineCaption(node);
      if (split) {
        for (const item of split) {
          if (!isElement(item)) continue;
          if (item.tagName === "figure") {
            const img = item.children?.[0];
            if (img && isElement(img)) applyLazyImageAttrs(img);
          }
        }
        parent.children.splice(i, 1, ...split);
        i += split.length - 1;
        continue;
      }
    }

    if (node.tagName === "img" && isElement(next) && isCaptionParagraph(next)) {
      applyLazyImageAttrs(node);
      const figure = {
        type: "element",
        tagName: "figure",
        properties: { className: ["image-caption"] },
        children: [
          node,
          {
            type: "element",
            tagName: "figcaption",
            properties: {},
            children: next.children,
          },
        ],
      };

      parent.children.splice(i, 2, figure);
      continue;
    }

    if (node.tagName === "img") {
      applyLazyImageAttrs(node);
    }

    if (Array.isArray(node.children)) {
      wrapImageWithCaption(node);
    }
  }
}

export default function rehypeImageCaption() {
  return (tree) => {
    wrapImageWithCaption(tree);
  };
}
