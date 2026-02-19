import type Anthropic from "@anthropic-ai/sdk";

export const boardTools: Anthropic.Tool[] = [
  {
    name: "createStickyNote",
    description:
      "Create a sticky note. Use for ideas, tasks, or any text card. Default size 200x200px. If position not specified by user, space them 220px apart from each other.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {type: "string" as const, description: "Text content of the sticky note"},
        x: {type: "number" as const, description: "X coordinate on the board"},
        y: {type: "number" as const, description: "Y coordinate on the board"},
        color: {
          type: "string" as const,
          enum: ["yellow", "pink", "blue", "green", "purple", "orange"],
          description: "Background color of the sticky note",
        },
      },
      required: ["text", "x", "y", "color"],
    },
  },
  {
    name: "createShape",
    description:
      "Create a geometric shape. Use for diagrams, borders, or visual separators.",
    input_schema: {
      type: "object" as const,
      properties: {
        shapeType: {
          type: "string" as const,
          enum: ["rectangle", "circle", "line"],
          description: "Type of geometric shape to create",
        },
        x: {type: "number" as const, description: "X coordinate on the board"},
        y: {type: "number" as const, description: "Y coordinate on the board"},
        width: {type: "number" as const, description: "Width in pixels (default 200)"},
        height: {type: "number" as const, description: "Height in pixels (default 200)"},
        color: {type: "string" as const, description: "Fill color as hex string (e.g. #90CAF9)"},
      },
      required: ["shapeType", "x", "y", "width", "height", "color"],
    },
  },
  {
    name: "createFrame",
    description:
      "Create a labeled container to group content. Use for sections, swim lanes, quadrants, columns.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {type: "string" as const, description: "Label displayed on the frame"},
        x: {type: "number" as const, description: "X coordinate on the board"},
        y: {type: "number" as const, description: "Y coordinate on the board"},
        width: {type: "number" as const, description: "Width in pixels (default 400)"},
        height: {type: "number" as const, description: "Height in pixels (default 300)"},
      },
      required: ["title", "x", "y", "width", "height"],
    },
  },
  {
    name: "createConnector",
    description:
      "Draw an arrow or line between two existing objects. IMPORTANT: only call after you have valid objectIds from getBoardState or from a just-created object.",
    input_schema: {
      type: "object" as const,
      properties: {
        fromId: {type: "string" as const, description: "ID of the source object"},
        toId: {type: "string" as const, description: "ID of the target object"},
        style: {
          type: "string" as const,
          enum: ["arrow", "line", "dashed"],
          description: "Visual style of the connector",
        },
      },
      required: ["fromId", "toId", "style"],
    },
  },
  {
    name: "moveObject",
    description:
      "Move an existing object to new coordinates. ALWAYS call getBoardState first to get valid objectIds and current positions before calling this.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: {type: "string" as const, description: "ID of the object to move"},
        x: {type: "number" as const, description: "New X coordinate"},
        y: {type: "number" as const, description: "New Y coordinate"},
      },
      required: ["objectId", "x", "y"],
    },
  },
  {
    name: "resizeObject",
    description:
      "Change width/height of an existing object. ALWAYS call getBoardState first.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: {type: "string" as const, description: "ID of the object to resize"},
        width: {type: "number" as const, description: "New width in pixels"},
        height: {type: "number" as const, description: "New height in pixels"},
      },
      required: ["objectId", "width", "height"],
    },
  },
  {
    name: "updateText",
    description:
      "Change the text of a sticky note. Only valid for sticky type objects. ALWAYS call getBoardState first.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: {type: "string" as const, description: "ID of the sticky note"},
        newText: {type: "string" as const, description: "New text content"},
      },
      required: ["objectId", "newText"],
    },
  },
  {
    name: "changeColor",
    description:
      "Change color of an existing object. For stickies use color names, for shapes use hex. ALWAYS call getBoardState first.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: {type: "string" as const, description: "ID of the object to recolor"},
        color: {type: "string" as const, description: "New color (name for stickies, hex for shapes)"},
      },
      required: ["objectId", "color"],
    },
  },
  {
    name: "getBoardState",
    description:
      "Returns ALL current objects on the board with their ids, positions, types and properties. ALWAYS call this before any manipulation command. Call this first for: move, resize, recolor, arrange, any command referencing existing objects.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];
