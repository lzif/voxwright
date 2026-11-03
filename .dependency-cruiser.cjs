// SPDX-License-Identifier: AGPL-3.0-only

// One-way dependency direction between workspace members:
//   apps/web, mcbuilder -> render, core
//   render              -> core
//   core                -> nothing else in the workspace, and no DOM
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
