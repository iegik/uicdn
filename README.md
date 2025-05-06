# uicdn

CLI for your favorite component registry

## Usage

```
npx uicdn add button --registry https://github.com/YOUR_USERNAME/YOUR_UI_REGISTRY.git --componentPath "./src/components"
```

> NOTE: "registry:component" will be copied to `{componentPath}/`, "registry:ui" will be copied to `{uiPath}/` or `{componentPath}/ui`

## Contribute

- create repository
- add `registry.json` file:

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "myuicdn",
  "homepage": "https://myuicdn.com",
  "items": [
    {
      "name": "button",
      "type": "registry:ui",
      "title": "Button",
      "description": "A simple Button component",
      "files": [
        {
          "path": "./src/components/button.tsx",
          "type": "registry:file"
        }
      ]
    }
  ]
}
```

- or `registry.js` file:

```javascript
const * as components from "./src/components/"

module.exports = {
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "myuicdn",
  "homepage": "https://myuicdn.com",
  "items": Object.values(components),
}
```

> DISCLAIMER: The differences from https://ui.shadcn.com are:
> - links to same registry collection or objects reduces the size of the collection
> - external repository allow you to create your own collection of the components
> - simplicity to own registry creation and compatibility to shadcn

---

Inspired by https://ui.shadcn.com/
