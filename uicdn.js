#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import url from "url";

// === Defaults ===
let REGISTRY_GIT = "https://github.com/iegik/uicdn-bootstrap.git";
const REGISTRY_BRANCH = "main";
const TEMP_DIR = path.join(os.tmpdir(), "uicdn-registry");

let componentPath = "./src/components";
let uiPath = null;

// === CLI Args Parsing ===
const argv = process.argv.slice(2);
const cmd = argv[0];
const itemName = argv[1];
const destPath = argv[2];

for (let i = 3; i < argv.length; i++) {
  if (argv[i] === "--registry" && argv[i + 1]) REGISTRY_GIT = argv[++i];
  else if (argv[i] === "--componentPath" && argv[i + 1]) componentPath = argv[++i];
  else if (argv[i] === "--uiPath" && argv[i + 1]) uiPath = argv[++i];
}

if (!uiPath) uiPath = path.join(componentPath, "ui");

function cloneOrUpdateRepo() {
  if (fs.existsSync(TEMP_DIR)) {
    execSync(`git -C ${TEMP_DIR} pull`, { stdio: "inherit" });
  } else {
    execSync(`git clone --depth=1 -b ${REGISTRY_BRANCH} ${REGISTRY_GIT} ${TEMP_DIR}`, { stdio: "inherit" });
  }
}

function loadRegistry() {
  const registryPath = path.join(TEMP_DIR, "registry.json");
  if (fs.existsSync(registryPath)) {
    return JSON.parse(fs.readFileSync(registryPath, "utf8"));
  }
  const jsPath = path.join(TEMP_DIR, "registry.js");
  if (fs.existsSync(jsPath)) {
    return require(url.pathToFileURL(jsPath).href);
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
  return path.join(isUI ? uiPath : componentPath, path.basename(filePath));
}

function copyFiles(files) {
  for (const file of files) {
    const src = path.join(TEMP_DIR, file.path);
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
if (cmd === "add" && itemName && destPath) {
  (async () => {
    console.log(`📥 Fetching registry from ${REGISTRY_GIT}...`);
    cloneOrUpdateRepo();
    const registry = loadRegistry();
    const item = resolveItemByName(registry.items, itemName);
    if (!item) throw new Error(`Component "${itemName}" not found in registry.`);

    console.log(`🔍 Resolving "${item.name}"...`);
    const allComponentNames = Array.from(resolveRegistryDeps(item, registry.items));
    allComponentNames.unshift(item.name); // ensure main item is first

    const allItemsToCopy = allComponentNames.map(name => resolveItemByName(registry.items, name)).filter(Boolean);

    // Aggregate all files and dependencies
    const allFiles = new Set();
    const allDeps = new Set();

    for (const componentItem of allItemsToCopy) {
      collectFiles(componentItem, registry.items, allFiles);
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