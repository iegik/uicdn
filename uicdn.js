#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import url from "url";

// === Defaults ===
const tmp = path.join(os.tmpdir(), "uicdn-registry");

// === CLI Args Parsing ===
const argv = process.argv.slice(2);
const cmd = argv.shift();
const itemName = argv.shift();

function parseArgv(argv, defaults) {
  const knownFlags = Object.keys(defaults)
  const result = {
    ...defaults,
    _: [] // positional arguments (e.g., cmd, itemName)
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      const flag = arg.slice(2);
      const next = argv[i + 1];

      if (knownFlags.includes(flag) && next && !next.startsWith('--')) {
        result[flag] = next;
        argv.splice(i, 2); // remove flag and value
      } else {
        result[flag] = true;
        argv.splice(i, 1); // remove just the flag
      }
    } else {
      result._.push(arg);
      i++;
    }
  }

  return result;
}

let {
  registry,
  registryBranch,
  componentPath,
  uiPath,
  registryPath,
  registryFile,
} = parseArgv(argv, {
  registry: "https://github.com/iegik/uicdn-bootstrap.git",
  registryBranch: "main",
  componentPath: "./src/components",
  uiPath: null,
  registryPath: ".",
  registryFile: null,
});

if (!uiPath) uiPath = path.join(componentPath, "ui");

const destPath = argv.shift();

function cloneOrUpdateRepo() {
  if (fs.existsSync(tmp)) {
    execSync(`git -C ${tmp} pull`, { stdio: "inherit" });
  } else {
    execSync(`git clone --depth=1 -b ${registryBranch} ${registry} ${tmp}`, { stdio: "inherit" });
  }
}

async function loadRegistry() {
  const modulesPath = path.join(tmp, registryPath, registryFile);
  if (fs.existsSync(modulesPath)) {
    return await import(url.pathToFileURL(modulesPath).href);
  }
  const jsonPath = path.join(tmp, registryPath, "registry.json");
  if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  }
  const jsPath = path.join(tmp, registryPath, "registry.js");
  if (fs.existsSync(jsPath)) {
    return import(url.pathToFileURL(jsPath).href);
  }
  throw new Error("No registry.json or registry.js found in registry repo.");
}

function resolveItemByName(items, name) {
  return items.find(item => item.name === name);
}

const resolveRegistryDeps = (item, allItems, resolved = new Set()) => {
  if (resolved.has(item.name)) return resolved;
  resolved.add(item.name);

  const deps = item.registryDependencies || [];
  for (const depName of deps) {
    const depItem = resolveItemByName(allItems, depName);
    if (!depItem) throw new Error(`Missing registry dependency "${depName}"`);
    resolveRegistryDeps(depItem, allItems, resolved);
  }

  return resolved;
};

function collectFiles(item, items, collected = new Set()) {
  for (const fileRef of item.files) {
    if (typeof fileRef === "string") {
      const refItem = resolveItemByName(items, fileRef);
      if (!refItem) throw new Error(`Missing reference "${fileRef}"`);
      collectFiles(refItem, items, collected);
    } else {
      collected.add(fileRef);
    }
  }
  return Array.from(collected);
}

function mapFileDest(filePath) {
  const isUI = filePath.includes("/ui/") || filePath.startsWith("ui/");
  return path.join(destPath || (isUI ? uiPath : componentPath), path.basename(filePath));
}

function copyFiles(files) {
  for (const file of files) {
    const src = path.join(tmp, registryPath, file.path);
    const dest = mapFileDest(file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied: ${file.path} -> ${dest}`);
  }
}

function installDeps(deps) {
  if (deps.length === 0) return;
  console.log("📦 Installing dependencies:", deps.join(" "));
  execSync(`npm install ${deps.join(" ")}`, { stdio: "inherit" });
}

// === Run ===
if (cmd === "add" && itemName) {
  (async () => {
    console.log(`📥 Fetching registry from ${registry}...`);
    cloneOrUpdateRepo();
    const r = await loadRegistry();
    const item = resolveItemByName(r.items, itemName);
    if (!item) throw new Error(`Component "${itemName}" not found in registry.`);

    console.log(`🔍 Resolving "${item.name}"...`);
    const allComponentNames = Array.from(resolveRegistryDeps(item, r.items));
    allComponentNames.unshift(item.name); // ensure main item is first

    const allItemsToCopy = allComponentNames.map(name => resolveItemByName(r.items, name)).filter(Boolean);

    // Aggregate all files and dependencies
    const allFiles = new Set();
    const allDeps = new Set();

    for (const componentItem of allItemsToCopy) {
      collectFiles(componentItem, r.items, allFiles);
      (componentItem.dependencies || []).forEach(dep => allDeps.add(dep));
    }

    copyFiles(Array.from(allFiles));
    installDeps(Array.from(allDeps));

  })().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
  });
} else {
  console.log(`Usage:
  uicdn add <component-name> <dest-folder> [--registry <url>] [--componentPath <relative-path>] [--uiPath <relative-path>]

Defaults:
  --componentPath = ./src/components
  --uiPath = {componentPath}/ui`);
}