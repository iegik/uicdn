type RegistryItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json";
  name: string; // name in cli
  title: string;
  description: string;
  path: string; // relative path to the file
  type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:page" | "registry:file" | "registry:style";
  dependencies: string[]; // need to be installed with npm i *
  registryDependencies?: string[]; // other components from registry to resolve recursively
  files: (string | RegistryItem)[]; // entity of RegistryItem object or string as a link to the RegistryItem entity object within a Registry['items'] (may also be a link to the external object in js version) by "name" property
}

type Registry = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: string;
  homepage: string;
  items: (RegistryFile | RegistryItem)[];
}
