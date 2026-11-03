#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
import { runCli } from "../src/node/cli.ts";

process.exitCode = await runCli(process.argv.slice(2));
