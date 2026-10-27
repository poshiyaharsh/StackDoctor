import readline from "node:readline";
import process from "node:process";
import {
  resolveOperationId,
  getOperation,
  validateProjectDirectory,
  appendFixHistory,
  ALLOWLISTED_OPERATION_IDS
} from "@stackdoctor/adapters";
import { runCommand, type CommandResult } from "@stackdoctor/adapters";

export interface FixCommandOptions {
  apply?: boolean;
  ci?: boolean;
  yes?: boolean;
  askConfirmation?: (promptText: string) => Promise<string>;
}

export async function promptForTypedConfirmation(
  expectedText: string,
  customPrompt?: (p: string) => Promise<string>
): Promise<boolean> {
  const promptMessage = `Type "${expectedText}" to confirm execution: `;

  if (customPrompt) {
    const answer = await customPrompt(promptMessage);
    return answer.trim() === expectedText;
  }

  return new Promise<boolean>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(promptMessage, (answer) => {
      rl.close();
      resolve(answer.trim() === expectedText);
    });
  });
}

/**
 * Handles the `stackdoctor fix <ruleId | operationId> [path]` command.
 * Default is DRY RUN (executes nothing, spawns no process).
 * To apply: requires `--apply` and typed confirmation of the operation ID.
 * Refuses in `--ci` mode.
 */
export async function handleFix(
  ruleOrOperationId: string | undefined,
  targetPath: string = process.cwd(),
  options: FixCommandOptions = {}
): Promise<number> {
  if (!ruleOrOperationId || ruleOrOperationId.trim().length === 0) {
    console.error("Error: Missing rule ID or operation ID.");
    console.error(`Usage: stackdoctor fix <ruleId | operationId> [path] [--apply]`);
    console.error("Allowed operations:");
    for (const opId of ALLOWLISTED_OPERATION_IDS) {
      console.error(`  • ${opId}`);
    }
    return 1;
  }

  const operationId = resolveOperationId(ruleOrOperationId.trim());
  if (!operationId) {
    console.error(`Error: Unknown or unsupported remediation operation: "${ruleOrOperationId}".`);
    console.error("Allowed operations:");
    for (const opId of ALLOWLISTED_OPERATION_IDS) {
      console.error(`  • ${opId}`);
    }
    return 1;
  }

  let projectDir: string;
  try {
    projectDir = validateProjectDirectory(targetPath);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const operation = getOperation(operationId);

  // Check preconditions before planning or executing
  const preconditionResult = await operation.checkPreconditions(projectDir);
  if (!preconditionResult.ok) {
    console.error(`Error: Precondition failed for ${operationId}:`);
    console.error(`  ${preconditionResult.reason || "Preconditions not met."}`);
    return 1;
  }

  let executionPlan;
  try {
    executionPlan = await operation.buildExecution(projectDir);
  } catch (err) {
    console.error(`Error: Failed building execution plan: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const plannedCommandStr = `${executionPlan.executable} ${executionPlan.args.join(" ")}`;

  // 1. DRY RUN (DEFAULT)
  if (!options.apply) {
    console.log("======================================================");
    console.log("           StackDoctor Safe Remediation");
    console.log("                    [ DRY RUN ]");
    console.log("======================================================");
    console.log(`Operation ID     : ${operation.id}`);
    console.log(`Title            : ${operation.title}`);
    console.log(`Description      : ${operation.description}`);
    console.log(`Target Directory : ${projectDir}`);
    console.log(`Planned Command  : ${plannedCommandStr}`);
    console.log(`Working Dir      : ${executionPlan.cwd}`);
    console.log(`Expected Result  : ${operation.expectedResult}`);
    console.log(`Risks            : ${operation.risks}`);
    console.log(`Undo Steps       : ${operation.undoInstructions}`);
    console.log(`Verification     : ${operation.verificationCheckId}`);
    console.log("======================================================");
    console.log("DRY RUN ONLY. No process was spawned and no files were modified.");
    console.log("To execute this remediation, re-run with:");
    console.log(`  stackdoctor fix ${operation.id} --apply`);
    return 0;
  }

  // 2. APPLY EXECUTION
  // Refusal in CI mode
  if (options.ci || process.env.CI === "true" || process.env.CI === "1") {
    console.error("Error: Remediation execution is refused in --ci mode.");
    console.error("Run interactively without --ci to review and confirm.");
    return 1;
  }

  // Interactive typed confirmation
  let confirmed = false;
  if (operation.hasInstallNetworkEffects) {
    if (options.yes) {
      console.warn(`[NOTICE] Operation "${operation.id}" has install/network effects.`);
      console.warn(`--yes flag cannot bypass typed confirmation for install/network operations.`);
    }
    console.log(`\nOperation "${operation.id}" involves installing packages.`);
    console.log(`Risks: ${operation.risks}`);
    confirmed = await promptForTypedConfirmation(operation.id, options.askConfirmation);
  } else {
    if (options.yes) {
      confirmed = true;
    } else {
      console.log(`\nOperation "${operation.id}": ${operation.title}`);
      console.log(`Command to execute: ${plannedCommandStr}`);
      confirmed = await promptForTypedConfirmation(operation.id, options.askConfirmation);
    }
  }

  if (!confirmed) {
    console.log(`\nAborted. Confirmation text did not match "${operation.id}". No changes were made.`);
    return 1;
  }

  // Record pre-verification status
  const beforeVerification = await operation.verify(projectDir);

  console.log(`\nExecuting remediation command:`);
  console.log(`$ ${plannedCommandStr}`);
  console.log("------------------------------------------------------");

  let cmdResult: CommandResult;
  try {
    cmdResult = await runCommand(executionPlan.executable, executionPlan.args, {
      cwd: executionPlan.cwd,
      timeoutMs: 60_000,
      onOutput: (chunk, stream) => {
        if (stream === "stdout") {
          process.stdout.write(chunk);
        } else {
          process.stderr.write(chunk);
        }
      }
    });
  } catch (err) {
    console.error(`\nExecution error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  console.log("------------------------------------------------------");
  console.log(`Command completed with exit code: ${cmdResult.exitCode ?? 1}`);

  // Record post-verification status
  const afterVerification = await operation.verify(projectDir);

  console.log("\nRemediation Verification:");
  console.log(`  Check ID : ${operation.verificationCheckId}`);
  console.log(`  Before   : ${beforeVerification.passed ? "PASSED" : "FAILED"} (${beforeVerification.details})`);
  console.log(`  After    : ${afterVerification.passed ? "PASSED" : "FAILED"} (${afterVerification.details})`);

  // Log audit history
  try {
    appendFixHistory(projectDir, {
      timestamp: new Date().toISOString(),
      operationId: operation.id,
      command: plannedCommandStr,
      argsSummary: executionPlan.args,
      result: {
        exitCode: cmdResult.exitCode,
        success: cmdResult.exitCode === 0
      },
      verification: {
        checkId: operation.verificationCheckId,
        passed: afterVerification.passed,
        details: afterVerification.details
      }
    });
    console.log("Audit entry logged to .stackdoctor/fix-history.json");
  } catch (err) {
    console.warn(`Warning: Could not write fix history: ${err instanceof Error ? err.message : String(err)}`);
  }

  return cmdResult.exitCode === 0 ? 0 : 1;
}
