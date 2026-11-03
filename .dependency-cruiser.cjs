// SPDX-License-Identifier: AGPL-3.0-only

// One-way dependency direction between workspace members:
//   apps/web, mcbuilder -> render, core
//   render              -> core
//   core                -> nothing else in the workspace, and no DOM
// packages/render/src/webgl is the browser entry point (@voxwright/render/webgl): the only
// place that may import three.js or touch the DOM, and nothing outside it may import it
// except apps/web. The rest of render stays DOM-free, so Node programs can use it.
// Directory names are packages/<name> and apps/<name>.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-imports-nothing-in-workspace",
      comment: "packages/core must not import from any other workspace package or app.",
      severity: "error",
      from: { path: "^packages/core/" },
      to: { path: "^(packages/(?!core/)|apps/)" },
    },
    {
      name: "core-no-dom-dependency",
      comment: "packages/core must stay DOM-free: no DOM-specific packages or type libraries.",
      severity: "error",
      from: { path: "^packages/core/" },
      to: {
        path: "(^|/)node_modules/(@types/web|@webgpu/types|jsdom|happy-dom|three|react-dom)(/|$)",
      },
    },
    {
      name: "core-no-node-builtins",
      comment:
        "packages/core/src must run in a browser: no node: built-in modules. Tests may use them.",
      severity: "error",
      from: { path: "^packages/core/src/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "render-only-uses-core",
      comment: "packages/render may depend on packages/core only.",
      severity: "error",
      from: { path: "^packages/render/" },
      to: { path: "^(packages/(?!render/|core/)|apps/)" },
    },
    {
      name: "mcbuilder-only-uses-render-and-core",
      comment: "packages/mcbuilder may depend on packages/render and packages/core only.",
      severity: "error",
      from: { path: "^packages/mcbuilder/" },
      to: { path: "^(packages/(?!mcbuilder/|render/|core/)|apps/)" },
    },
    {
      name: "three-only-in-render-webgl",
      comment:
        "three.js is for the browser renderer only: nothing outside packages/render/src/webgl imports it.",
      severity: "error",
      from: { pathNot: "^packages/render/(src/webgl/|test/webgl)" },
      to: { path: "(^|/)node_modules/three(/|$)" },
    },
    {
      name: "render-dom-free-outside-webgl",
      comment:
        "packages/render outside src/webgl must not import the browser entry point, so it stays usable in Node.",
      severity: "error",
      from: { path: "^packages/render/", pathNot: "^packages/render/(src/webgl/|test/webgl)" },
      to: { path: "^packages/render/src/webgl/" },
    },
    {
      name: "mcbuilder-no-webgl",
      comment: "The Node CLI never imports the browser renderer.",
      severity: "error",
      from: { path: "^packages/mcbuilder/" },
      to: { path: "^packages/render/src/webgl/" },
    },
    {
      name: "web-only-uses-render-and-core",
      comment: "apps/web may depend on packages/render and packages/core only.",
      severity: "error",
      from: { path: "^apps/web/" },
      to: { path: "^(packages/(?!render/|core/)|apps/(?!web/))" },
    },
    {
      name: "no-reference-imports",
      comment: "reference/ is a read-only oracle and must never be imported.",
      severity: "error",
      from: {},
      to: { path: "^reference/" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^reference/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "types", "default"],
    },
  },
};
