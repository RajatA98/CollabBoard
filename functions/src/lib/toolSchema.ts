import type Anthropic from "@anthropic-ai/sdk";

export const boardTools: Anthropic.Tool[] = [
  {
    name: "createStickyNote",
    description:
      "Create a sticky note at a position with optional size and color. Pass x, y for position; color for background. Default size 200x200px. Use exactPosition to place at exact (x,y) without overlap shifting. To place inside a frame, pass frameId (from createFrames/createFrame result) and use x,y relative to the frame's top-left.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {type: "string" as const, description: "Text content of the sticky note"},
        x: {type: "number" as const, description: "X coordinate on the board"},
        y: {type: "number" as const, description: "Y coordinate on the board"},
        color: {
          type: "string" as const,
          description: "Background color: name (yellow, pink, blue, green, purple, orange) or hex (e.g. #FF0000).",
        },
        exactPosition: {
          type: "boolean" as const,
          description: "If true, place at exact (x,y) without avoiding overlap. Use for drawings/pictures.",
        },
        zIndex: {
          type: "number" as const,
          description: "Stacking order. Higher values render on top. Use to layer parts correctly (e.g. body=0, head=1, eyes=2).",
        },
        frameId: {
          type: "string" as const,
          description: "If set, place this sticky inside the frame with this id; x and y are then relative to the frame's top-left.",
        },
      },
      required: ["text", "x", "y", "color"],
    },
  },
  {
    name: "createStickyNotes",
    description:
      "Create many sticky notes in one call (e.g. grids with stickies, bulk add, or one sticky per frame in SWOT). Pass an array of stickies; each item has text, x, y, color (optional exactPosition, frameId). To place inside frames, pass frameId per item or a top-level frameId for all. When frameId is set, x,y are relative to that frame's top-left. Max 50 per call; if more are needed, call this tool repeatedly in batches and keep global grid coordinates (do not restart x/y at 0,0 each batch). Use createStickyNote only for a single sticky.",
    input_schema: {
      type: "object" as const,
      properties: {
        stickies: {
          type: "array" as const,
          description: "List of sticky note specs",
          items: {
            type: "object" as const,
            properties: {
              text: {type: "string" as const, description: "Text content of the sticky note"},
              x: {type: "number" as const, description: "X coordinate (relative to grid origin or frame top-left if frameId set)"},
              y: {type: "number" as const, description: "Y coordinate (relative to grid origin or frame top-left if frameId set)"},
              color: {
                type: "string" as const,
                description: "Background color: name (yellow, pink, blue, green, purple, orange) or hex (e.g. #FF0000).",
              },
              exactPosition: {
                type: "boolean" as const,
                description: "If true, place at exact (x,y) for this sticky",
              },
              frameId: {
                type: "string" as const,
                description: "If set, this sticky is placed inside this frame; x,y relative to frame top-left.",
              },
            },
            required: ["text", "x", "y", "color"],
          },
        },
        exactPosition: {
          type: "boolean" as const,
          description: "If true, all stickies use exact (x,y); use for grids. Default true.",
        },
        frameId: {
          type: "string" as const,
          description: "If set, all stickies in this call are placed inside this frame; x,y relative to frame top-left.",
        },
      },
      required: ["stickies"],
    },
  },
  {
    name: "createShape",
    description:
      "Create a single shape at (x, y) with size (width, height) and color. Use createShapes for 2+ shapes. Types: rectangle, circle, triangle, star (filled); line (plain), arrow-single (one arrowhead), arrow-double (two arrowheads). For bent lines/arrows pass optional waypoints: array of {x, y} absolute bend points. To place inside a frame, pass frameId (from createFrames/createFrame result) and use x,y relative to the frame's top-left.",
    input_schema: {
      type: "object" as const,
      properties: {
        shapeType: {
          type: "string" as const,
          enum: ["rectangle", "circle", "triangle", "star", "line", "arrow-single", "arrow-double"],
          description: "Shape type: rectangle/circle/triangle/star (filled), line/arrow-single/arrow-double (paths)",
        },
        x: {type: "number" as const, description: "X coordinate on the board"},
        y: {type: "number" as const, description: "Y coordinate on the board"},
        width: {type: "number" as const, description: "Width in pixels"},
        height: {type: "number" as const, description: "Height in pixels"},
        color: {type: "string" as const, description: "Fill color as hex (e.g. #90CAF9)"},
        waypoints: {
          type: "array" as const,
          description: "Bend points for line/arrow. Each item: {x, y} in absolute board coords.",
          items: {
            type: "object" as const,
            properties: {
              x: {type: "number" as const, description: "X of bend point"},
              y: {type: "number" as const, description: "Y of bend point"},
            },
            required: ["x", "y"],
          },
        },
        exactPosition: {
          type: "boolean" as const,
          description: "If true, place at exact (x,y) without avoiding overlap. Use for drawings (e.g. cat, house).",
        },
        zIndex: {
          type: "number" as const,
          description: "Stacking order. Higher values render on top. Use to layer parts correctly (e.g. body=0, head=1, eyes=2).",
        },
        frameId: {
          type: "string" as const,
          description: "If set, place this shape inside the frame with this id; x and y are then relative to the frame's top-left.",
        },
      },
      required: ["shapeType", "x", "y", "width", "height", "color"],
    },
  },
  {
    name: "createShapes",
    description:
      "Create many shapes in one call (e.g. grids, matrices). Pass an array of shapes; each item has shapeType, x, y, width, height, color (optional waypoints, exactPosition, frameId). To place inside frames, pass frameId per item or a top-level frameId for all; when frameId is set, x,y are relative to that frame's top-left. Max 50 shapes per call; if more are needed, call this tool repeatedly in batches. Omit color unless the user asks for specific colors.",
    input_schema: {
      type: "object" as const,
      properties: {
        shapes: {
          type: "array" as const,
          description: "List of shape specs; each has shapeType, x, y, width, height, color",
          items: {
            type: "object" as const,
            properties: {
              shapeType: {
                type: "string" as const,
                enum: ["rectangle", "circle", "triangle", "star", "line", "arrow-single", "arrow-double"],
                description: "Shape type",
              },
              x: {type: "number" as const, description: "X coordinate (relative to grid origin or frame top-left if frameId set)"},
              y: {type: "number" as const, description: "Y coordinate (relative to grid origin or frame top-left if frameId set)"},
              width: {type: "number" as const, description: "Width in pixels"},
              height: {type: "number" as const, description: "Height in pixels"},
              color: {type: "string" as const, description: "Fill color as hex (e.g. #90CAF9)"},
              waypoints: {
                type: "array" as const,
                description: "Bend points for line/arrow; each item {x, y}",
                items: {
                  type: "object" as const,
                  properties: {
                    x: {type: "number" as const},
                    y: {type: "number" as const},
                  },
                  required: ["x", "y"],
                },
              },
              exactPosition: {
                type: "boolean" as const,
                description: "If true, place at exact (x,y) for this shape",
              },
              frameId: {
                type: "string" as const,
                description: "If set, this shape is placed inside this frame; x,y relative to frame top-left.",
              },
            },
            required: ["shapeType", "x", "y", "width", "height"],
          },
        },
        exactPosition: {
          type: "boolean" as const,
          description: "If true, all shapes use exact (x,y); use for grids. Default true.",
        },
        frameId: {
          type: "string" as const,
          description: "If set, all shapes in this call are placed inside this frame; x,y relative to frame top-left.",
        },
      },
      required: ["shapes"],
    },
  },
  {
    name: "createTextBoxes",
    description:
      "Create many text boxes in one call (e.g. grids of labels, bulk headings). Pass an array of textBoxes; each item has text, x, y (optional width, height, frameId). To place inside frames, pass frameId per item or a top-level frameId; when frameId is set, x,y are relative to that frame's top-left. Max 50 per call; if more are needed, call in batches. Use createTextBox only for a single text box.",
    input_schema: {
      type: "object" as const,
      properties: {
        textBoxes: {
          type: "array" as const,
          description: "List of text box specs",
          items: {
            type: "object" as const,
            properties: {
              text: {type: "string" as const, description: "Initial text content"},
              x: {type: "number" as const, description: "X coordinate (relative to grid origin or frame top-left if frameId set)"},
              y: {type: "number" as const, description: "Y coordinate (relative to grid origin or frame top-left if frameId set)"},
              width: {type: "number" as const, description: "Width in pixels. Optional; default 200."},
              height: {type: "number" as const, description: "Height in pixels. Optional; default 40."},
              exactPosition: {type: "boolean" as const, description: "If true, place at exact (x,y) for this item"},
              frameId: {
                type: "string" as const,
                description: "If set, this text box is placed inside this frame; x,y relative to frame top-left.",
              },
            },
            required: ["x", "y"],
          },
        },
        exactPosition: {
          type: "boolean" as const,
          description: "If true, all text boxes use exact (x,y); use for grids. Default true.",
        },
        frameId: {
          type: "string" as const,
          description: "If set, all text boxes in this call are placed inside this frame; x,y relative to frame top-left.",
        },
      },
      required: ["textBoxes"],
    },
  },
  {
    name: "createFrame",
    description:
      "Create a single frame with title (label), position (x, y), size (width, height), and optional color. Use createFrames for 2+ frames. Use for sections, SWOT quadrants, swim lanes, retrospectives. Always pass title (e.g. 'Strengths', 'What Went Well'), x, y, width, height; optionally color (hex).",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {type: "string" as const, description: "Title/label shown on the frame (e.g. 'SWOT - Strengths', 'Team A')"},
        x: {type: "number" as const, description: "X coordinate on the board"},
        y: {type: "number" as const, description: "Y coordinate on the board"},
        width: {type: "number" as const, description: "Width in pixels"},
        height: {type: "number" as const, description: "Height in pixels"},
        color: {
          type: "string" as const,
          description: "Frame header/fill color as hex (e.g. #3366ff). Optional; default blue.",
        },
        exactPosition: {
          type: "boolean" as const,
          description: "If true, place at exact (x,y) without avoiding overlap. Use for layouts.",
        },
        zIndex: {
          type: "number" as const,
          description: "Stacking order. Higher values render on top. Frames usually have the lowest zIndex.",
        },
      },
      required: ["title", "x", "y", "width", "height"],
    },
  },
  {
    name: "createFrames",
    description:
      "Create many frames in one call (e.g. SWOT 4 quadrants, retrospective columns, bulk sections). Pass an array of frames; each item has title, x, y, width, height (optional color, exactPosition). Max 50 per call; if more are needed, call this tool repeatedly in batches and keep global grid coordinates (do not restart x/y at 0,0 each batch). Coordinates relative to empty space; exactPosition defaults to true. Use createFrame only for a single frame.",
    input_schema: {
      type: "object" as const,
      properties: {
        frames: {
          type: "array" as const,
          description: "List of frame specs",
          items: {
            type: "object" as const,
            properties: {
              title: {type: "string" as const, description: "Title/label shown on the frame"},
              x: {type: "number" as const, description: "X coordinate (relative to grid origin)"},
              y: {type: "number" as const, description: "Y coordinate (relative to grid origin)"},
              width: {type: "number" as const, description: "Width in pixels"},
              height: {type: "number" as const, description: "Height in pixels"},
              color: {type: "string" as const, description: "Frame header color as hex. Optional; default blue."},
              exactPosition: {type: "boolean" as const, description: "If true, place at exact (x,y) for this frame"},
            },
            required: ["title", "x", "y", "width", "height"],
          },
        },
        exactPosition: {
          type: "boolean" as const,
          description: "If true, all frames use exact (x,y); use for layouts. Default true.",
        },
      },
      required: ["frames"],
    },
  },
  {
    name: "createTextBox",
    description:
      "Create a standalone text box at (x, y) with optional content and size. Use for labels, headings, or short text without a sticky background. Default size 200x40px. Pass text for initial content; optional width, height. To place inside a frame, pass frameId (from createFrames/createFrame result) and use x,y relative to the frame's top-left.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {type: "string" as const, description: "Initial text content of the text box. Optional; default empty."},
        x: {type: "number" as const, description: "X coordinate on the board"},
        y: {type: "number" as const, description: "Y coordinate on the board"},
        width: {type: "number" as const, description: "Width in pixels. Optional; default 200."},
        height: {type: "number" as const, description: "Height in pixels. Optional; default 40."},
        exactPosition: {
          type: "boolean" as const,
          description: "If true, place at exact (x,y) without avoiding overlap.",
        },
        zIndex: {
          type: "number" as const,
          description: "Stacking order. Higher values render on top.",
        },
        frameId: {
          type: "string" as const,
          description: "If set, place this text box inside the frame with this id; x and y are then relative to the frame's top-left.",
        },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "createConnector",
    description:
      "Use when the user asks to draw a line between two objects, connect two objects, or link two shapes. Call getBoardState first to get valid fromId and toId. Optionally pass fromPoint and toPoint when the user specifies attachment points (e.g. 'from the tip to the left edge' — triangle tip = corner-0, square left = left). Optionally pass waypoints (array of {x, y}) for bent paths. Style: arrow, line, or dashed.",
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
        fromPoint: {
          type: "string" as const,
          description: "Attachment point ID on the source shape (e.g. center, triangle tip = corner-0, square left = left). If omitted, line starts at shape center.",
        },
        toPoint: {
          type: "string" as const,
          description: "Attachment point ID on the target shape (e.g. center, left, right, top, corner-0). If omitted, line ends at shape center.",
        },
        waypoints: {
          type: "array" as const,
          description: "Optional bend points. Each item: {x, y} in absolute board coords. If omitted, path is auto-routed.",
          items: {
            type: "object" as const,
            properties: {
              x: {type: "number" as const, description: "X of bend point"},
              y: {type: "number" as const, description: "Y of bend point"},
            },
            required: ["x", "y"],
          },
        },
      },
      required: ["fromId", "toId", "style"],
    },
  },
  {
    name: "moveObject",
    description:
      "Move a single object to new coordinates. If the object is a frame, its contained shapes move with it. ALWAYS call getBoardState first to get valid objectIds and current positions.",
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
    name: "moveMultipleObjects",
    description:
      "Move many objects at once (e.g. rearrange into a row or grid). Pass an array of { objectId, x, y }. ALWAYS call getBoardState first to get valid objectIds and current positions. Use this for 'rearrange', 'align', 'space out', or moving several items together. For large selections, execution is automatically chunked in batches of 50.",
    input_schema: {
      type: "object" as const,
      properties: {
        moves: {
          type: "array" as const,
          description: "List of moves: each item has objectId (string), x (number), y (number)",
          items: {
            type: "object" as const,
            properties: {
              objectId: {type: "string" as const, description: "ID of the object to move"},
              x: {type: "number" as const, description: "New X coordinate"},
              y: {type: "number" as const, description: "New Y coordinate"},
            },
            required: ["objectId", "x", "y"],
          },
        },
      },
      required: ["moves"],
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
    name: "resizeMultipleObjects",
    description:
      "Resize many objects at once (e.g. multi-select). Pass an array of { objectId, width, height }. Use for 'make all stickies bigger', 'resize these shapes to 100x100', or resizing several selected items. For large selections, execution is automatically chunked in batches of 50. ALWAYS call getBoardState first.",
    input_schema: {
      type: "object" as const,
      properties: {
        resizes: {
          type: "array" as const,
          description: "List of resizes: each item has objectId (string), width (number), height (number)",
          items: {
            type: "object" as const,
            properties: {
              objectId: {type: "string" as const, description: "ID of the object to resize"},
              width: {type: "number" as const, description: "New width in pixels"},
              height: {type: "number" as const, description: "New height in pixels"},
            },
            required: ["objectId", "width", "height"],
          },
        },
      },
      required: ["resizes"],
    },
  },
  {
    name: "rotateObject",
    description:
      "Set rotation of a single object in degrees. Works for all shapes (rectangle, circle, triangle, star), lines/arrows, frames, sticky notes, and text. If the object is a frame, its contained shapes rotate with it (same delta). ALWAYS call getBoardState first for valid objectIds.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: {type: "string" as const, description: "ID of the object to rotate"},
        rotation: {type: "number" as const, description: "Rotation in degrees (e.g. 0, 45, 90, -30). Typically -360 to 360."},
      },
      required: ["objectId", "rotation"],
    },
  },
  {
    name: "rotateMultipleObjects",
    description:
      "Set rotation of many objects at once (e.g. marquee multi-select). Pass an array of { objectId, rotation }. Use for 'rotate all sticky notes 45°', 'tilt these shapes', or rotating several selected items. If any object is a frame, its children rotate with it. For large selections, execution is automatically chunked in batches of 50. ALWAYS call getBoardState first.",
    input_schema: {
      type: "object" as const,
      properties: {
        rotations: {
          type: "array" as const,
          description: "List of rotations: each item has objectId (string), rotation (number, degrees)",
          items: {
            type: "object" as const,
            properties: {
              objectId: {type: "string" as const, description: "ID of the object to rotate"},
              rotation: {type: "number" as const, description: "Rotation in degrees"},
            },
            required: ["objectId", "rotation"],
          },
        },
      },
      required: ["rotations"],
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
      "Change color of a single object. Works for stickies, shapes, frames, and text. For stickies use color names (yellow, pink, blue, green, purple, orange); for shapes and frames use hex (e.g. #3366ff). For frames, hex updates the border and title color. ALWAYS call getBoardState first for valid objectIds.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: {type: "string" as const, description: "ID of the object to recolor"},
        color: {type: "string" as const, description: "New color (name for stickies, hex for shapes/frames)"},
      },
      required: ["objectId", "color"],
    },
  },
  {
    name: "changeMultipleColors",
    description:
      "Change color of many objects at once. Use for 'recolor all stickies', 'make all frames blue', 'change color of all shapes', etc. Pass an array of { objectId, color }. Works for all object types including frames; for frames use hex and border/title update. For stickies use color names (yellow, pink, etc.); for shapes and frames use hex. ALWAYS call getBoardState first to get objectIds, then filter by type or selection and build the changes array. Execution is chunked in batches of 50 for large lists.",
    input_schema: {
      type: "object" as const,
      properties: {
        changes: {
          type: "array" as const,
          description: "List of color changes: each item has objectId (string), color (string)",
          items: {
            type: "object" as const,
            properties: {
              objectId: {type: "string" as const, description: "ID of the object to recolor"},
              color: {type: "string" as const, description: "New color (name for stickies, hex for shapes/frames)"},
            },
            required: ["objectId", "color"],
          },
        },
      },
      required: ["changes"],
    },
  },
  {
    name: "deleteObject",
    description:
      "Delete a single object by ID. If the object is a frame, all children inside it are also deleted. ALWAYS call getBoardState first to get valid objectIds.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: {type: "string" as const, description: "ID of the object to delete"},
      },
      required: ["objectId"],
    },
  },
  {
    name: "deleteMultipleObjects",
    description:
      "Delete many objects at once. Pass an array of objectIds. Use for bulk removal (e.g. 'delete all sticky notes', 'remove these shapes'). For large selections, execution is automatically chunked in batches of 50. ALWAYS call getBoardState first to get valid objectIds.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectIds: {
          type: "array" as const,
          description: "List of object IDs to delete",
          items: {type: "string" as const, description: "ID of an object to delete"},
        },
      },
      required: ["objectIds"],
    },
  },
  {
    name: "clearBoard",
    description:
      "Delete EVERY object on the board. This is destructive — only use when the user explicitly asks to clear, wipe, or start fresh. No parameters needed.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "createPenStroke",
    description:
      "Draw a freehand pen stroke on the board using an ordered list of absolute (x, y) points. Use for organic curves, hand-drawn arrows, underlines, scribbles, and any path that can't be expressed cleanly as a straight line/arrow. The stroke is rendered above all shapes, frames, and sticky notes. For simple straight connectors between objects prefer createConnector. For complex pictorial drawings (e.g. a cat face made of curves) use multiple createPenStroke calls. Use createPenStrokes to draw several strokes in one call.",
    input_schema: {
      type: "object" as const,
      properties: {
        points: {
          type: "array" as const,
          description:
            "Ordered list of absolute board-coordinate points that define the stroke path. Each item must have x and y. Use enough points (10-50+) to produce a smooth curve — more points = smoother line.",
          items: {
            type: "object" as const,
            properties: {
              x: {type: "number" as const, description: "Absolute X on the board"},
              y: {type: "number" as const, description: "Absolute Y on the board"},
            },
            required: ["x", "y"],
          },
        },
        color: {
          type: "string" as const,
          description: "Stroke color as hex (e.g. #000000 for black, #FF0000 for red)",
        },
        strokeWidth: {
          type: "number" as const,
          description: "Width of the stroke in pixels. Default 4. Use 2 for thin detail lines, 8+ for bold strokes.",
        },
        zIndex: {
          type: "number" as const,
          description: "Stacking order among pen strokes. Higher = on top. Defaults to 0.",
        },
      },
      required: ["points", "color"],
    },
  },
  {
    name: "createPenStrokes",
    description:
      "Draw multiple freehand pen strokes in one call. Use when a drawing requires several separate paths (e.g. two eyes, a smile, and eyebrows for a face). Pass an array of stroke specs; each item has points, color (optional strokeWidth, zIndex). Max 20 strokes per call.",
    input_schema: {
      type: "object" as const,
      properties: {
        strokes: {
          type: "array" as const,
          description: "List of pen stroke specs",
          items: {
            type: "object" as const,
            properties: {
              points: {
                type: "array" as const,
                description: "Ordered absolute board-coordinate points",
                items: {
                  type: "object" as const,
                  properties: {
                    x: {type: "number" as const},
                    y: {type: "number" as const},
                  },
                  required: ["x", "y"],
                },
              },
              color: {type: "string" as const, description: "Stroke color as hex"},
              strokeWidth: {type: "number" as const, description: "Stroke width in pixels. Default 4."},
              zIndex: {type: "number" as const, description: "Stacking order. Default 0."},
            },
            required: ["points", "color"],
          },
        },
      },
      required: ["strokes"],
    },
  },
  {
    name: "getBoardState",
    description:
      "Returns EVERY object currently on the board with no limit: objects (array with id, type, x, y, etc.), total count, byType counts, and a summary string. For 'recolor all stickies', 'make all frames blue', or 'change color of all X': call getBoardState FIRST, filter by type (e.g. type==='sticky' or type==='frame'), then call changeMultipleColors with a changes array of { objectId, color }. For changing text on many stickies use getBoardState then updateText per object as needed. Never act only on objects you just created—use getBoardState to include everything on the board.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];
