import { spawnSync } from "node:child_process";
import {
  DEFAULT_AUDIT_OUTPUT,
  DEFAULT_SEED,
  parseArgs,
  writeRunMetadata,
} from "./achievement_audit_utils.mjs";

function argValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : argv[index + 1];
}

const argv = process.argv.slice(2);
const options = parseArgs(argv, {
  iterations: 1000,
  seed: DEFAULT_SEED,
  output: DEFAULT_AUDIT_OUTPUT,
});
const thresholdIterations = Number(argValue(argv, "--threshold-iterations", options.iterations));
const draftIterations = Number(argValue(argv, "--draft-iterations", options.iterations));
const commands = [
  ["node", ["scripts/validate_achievements.mjs", "--output", options.output]],
  ["node", ["scripts/audit_achievement_league_thresholds.mjs", "--iterations", String(thresholdIterations), "--seed", String(options.seed), "--output", options.output]],
  ["node", ["scripts/audit_achievement_cup_thresholds.mjs", "--iterations", String(thresholdIterations), "--seed", String(options.seed), "--output", options.output]],
  ["node", ["scripts/audit_achievement_drafts.mjs", "--iterations", String(draftIterations), "--seed", String(options.seed), "--output", options.output]],
];
const started = Date.now();
const failed = [];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    failed.push(`${command} ${args.join(" ")}`);
    break;
  }
}

writeRunMetadata(options.output, {
  audit_all: {
    seed: options.seed,
    threshold_iterations: thresholdIterations,
    draft_iterations: draftIterations,
    runtime_ms: Date.now() - started,
    commands: commands.map(([command, args]) => `${command} ${args.join(" ")}`),
    failed_or_skipped_runs: failed,
  },
});

if (failed.length > 0) {
  process.exit(1);
}
