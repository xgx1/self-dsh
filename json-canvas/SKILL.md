---
name: json-canvas
description: "Create/edit JSON Canvas (.canvas): nodes, edges, groups, connections. For .canvas files, mind maps, flowcharts, or Canvas in Obsidian."
---

# JSON Canvas Skill

## File Structure

A canvas file (`.canvas`) contains two top-level arrays following the [JSON Canvas Spec 1.0](https://jsoncanvas.org/spec/1.0/):

```json
{
  "nodes": [],
  "edges": []
}
```

- `nodes` (optional): Array of node objects
- `edges` (optional): Array of edge objects connecting nodes

## Common Workflows

**Tool mapping**: Use `Read` to read existing files. Use `Write` ONLY for creating NEW files. Use `Edit` for ALL modifications to existing files.

### 1. Create a New Canvas

0. **Check for existing file**: Use the `Read` tool to check if the file already exists. If it does, use the Edit workflow instead of creating a new file.
1. Create a `.canvas` file with the base structure `{"nodes": [], "edges": []}`
2. Generate unique 16-character hex IDs for each node (e.g., `"6f0ad84f44ce9c17"`)
3. Add nodes with required fields: `id`, `type`, `x`, `y`, `width`, `height`
4. Add edges referencing valid node IDs via `fromNode` and `toNode`
5. **Validate**: Parse the JSON to confirm it is valid. Verify all `fromNode`/`toNode` values exist in the nodes array. For group nodes, verify child nodes are positioned within the group's bounding box (x between group.x and group.x+group.width, y between group.y and group.y+group.height).
6. **Complete**: Ensure all nodes and edges are fully defined with all required fields before writing. Do not stop or return partial results.
7. **Tool selection**: Use `Write` tool only when creating a NEW file. For ALL modifications to existing files, use the `Edit` tool.

### 2. Add a Node to an Existing Canvas

1. Read and parse the existing `.canvas` file using the `Read` tool
2. Generate a unique ID that does not collide with existing node or edge IDs
3. Choose position (`x`, `y`) that avoids overlapping existing nodes (leave 50-100px spacing)
4. Append the new node object to the `nodes` array using the `Edit` tool
5. Optionally add edges connecting the new node to existing nodes
6. **Validate**: Confirm all IDs are unique and all edge references resolve to existing nodes

### 3. Connect Two Nodes

1. Identify the source and target node IDs
2. Generate a unique edge ID
3. Set `fromNode` and `toNode` to the source and target IDs
4. Optionally set `fromSide`/`toSide` (top, right, bottom, left) for anchor points
5. Optionally set `label` for descriptive text on the edge
6. Append the edge to the `edges` array using the `Edit` tool
7. **Validate**: Confirm both `fromNode` and `toNode` reference existing node IDs

### 4. Edit an Existing Canvas

1. **Read and parse** the existing `.canvas` file as JSON using the `Read` tool. Do NOT use Write for existing files - always use the `Edit` tool for modifications.
2. Locate the target node or edge by `id`
3. Modify the desired attributes (text, position, color, etc.)
4. Write the updated JSON back to the file using the `Edit` tool
5. **Validate**: Re-check all ID uniqueness and edge reference integrity after editing. If modifying a group node's dimensions, check that all child nodes still fit inside the group's bounding box.
6. **Complete**: Verify the entire canvas structure is valid (not just the edited portion). Confirm all edges reference existing nodes and all IDs remain unique.

## Nodes

Nodes are objects placed on the canvas. Array order determines z-index: first node = bottom layer, last node = top layer.

### Generic Node Attributes

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `id` | Yes | string | Unique 16-char hex identifier |
| `type` | Yes | string | `text`, `file`, `link`, or `group` |
| `x` | Yes | integer | X position in pixels |
| `y` | Yes | integer | Y position in pixels |
| `width` | Yes | integer | Width in pixels |
| `height` | Yes | integer | Height in pixels |
| `color` | No | canvasColor | Preset `"1"`-`"6"` or hex (e.g., `"#FF0000"`) |

### Text Nodes

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `text` | Yes | string | Plain text with Markdown syntax |

```json
{
  "id": "6f0ad84f44ce9c17",
  "type": "text",
  "x": 0,
  "y": 0,
  "width": 400,
  "height": 200,
  "text": "# Hello World\n\nThis is **Markdown** content."
}
```

**Newline pitfall**: Use `\n` for line breaks in JSON strings. Do **not** use the literal `\\n` -- Obsidian renders that as the characters `\` and `n`.

### File Nodes

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `file` | Yes | string | Path to file within the system |
| `subpath` | No | string | Link to heading or block (starts with `#`) |

```json
{
  "id": "a1b2c3d4e5f67890",
  "type": "file",
  "x": 500,
  "y": 0,
  "width": 400,
  "height": 300,
  "file": "Attachments/diagram.png"
}
```

### Link Nodes

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `url` | Yes | string | External URL |

```json
{
  "id": "c3d4e5f678901234",
  "type": "link",
  "x": 1000,
  "y": 0,
  "width": 400,
  "height": 200,
  "url": "https://obsidian.md"
}
```

### Group Nodes

Group nodes are containers that visually wrap other nodes. They have special behavior: child nodes are positioned inside the group's bounding box, and the group's `label` is displayed as the group header.

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `label` | No | string | Display text shown at the top of the group |
| `text` | No | string | Alternative to `label` for Markdown content inside the group |
| `background` | No | string | Path to background image |
| `backgroundStyle` | No | string | `cover`, `ratio`, or `repeat` |

**Group positioning**: The group's `x` and `y` define the top-left corner of the group box. Child nodes should be positioned inside this box (e.g., `x` between group.x and group.x+group.width, `y` between group.y and group.y+group.height). Leave at least 20px padding from group edges.

**Group colors**: Use preset colors `"1"` through `"6"` for standard Obsidian canvas colors, or a hex string like `"#FF0000"`.

**Example group with children**:
```json
{
  "nodes": [
    {
      "id": "group1",
      "type": "group",
      "x": 50,
      "y": 50,