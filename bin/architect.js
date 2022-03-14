#!/usr/bin/env node
"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const architect_1 = require("@angular-devkit/architect");
const node_1 = require("@angular-devkit/architect/node");
const core_1 = require("@angular-devkit/core");
const node_2 = require("@angular-devkit/core/node");
const ansiColors = __importStar(require("ansi-colors"));
const fs_1 = require("fs");
const minimist_1 = __importDefault(require("minimist"));
const path = __importStar(require("path"));
const operators_1 = require("rxjs/operators");
const progress_1 = require("../src/progress");
function findUp(names, from) {
    if (!Array.isArray(names)) {
        names = [names];
    }
    const root = path.parse(from).root;
    let currentDir = from;
    while (currentDir && currentDir !== root) {
        for (const name of names) {
            const p = path.join(currentDir, name);
            if ((0, fs_1.existsSync)(p)) {
                return p;
            }
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}
/**
 * Show usage of the CLI tool, and exit the process.
 */
function usage(logger, exitCode = 0) {
    logger.info(core_1.tags.stripIndent `
    architect [project][:target][:configuration] [options, ...]

    Run a project target.
    If project/target/configuration are not specified, the workspace defaults will be used.

    Options:
        --help              Show available options for project target.
                            Shows this message instead when ran without the run argument.


    Any additional option is passed the target, overriding existing options.
  `);
    return process.exit(exitCode);
}
function _targetStringFromTarget({ project, target, configuration }) {
    return `${project}:${target}${configuration !== undefined ? ':' + configuration : ''}`;
}
// Create a separate instance to prevent unintended global changes to the color configuration
// Create function is not defined in the typings. See: https://github.com/doowb/ansi-colors/pull/44
const colors = ansiColors.create();
async function _executeTarget(parentLogger, workspace, root, argv, registry) {
    const architectHost = new node_1.WorkspaceNodeModulesArchitectHost(workspace, root);
    const architect = new architect_1.Architect(architectHost, registry);
    // Split a target into its parts.
    const targetStr = argv._.shift() || '';
    const [project, target, configuration] = targetStr.split(':');
    const targetSpec = { project, target, configuration };
    delete argv['help'];
    const logger = new core_1.logging.Logger('jobs');
    const logs = [];
    logger.subscribe((entry) => logs.push({ ...entry, message: `${entry.name}: ` + entry.message }));
    const { _, ...options } = argv;
    const run = await architect.scheduleTarget(targetSpec, options, { logger });
    const bars = new progress_1.MultiProgressBar(':name :bar (:current/:total) :status');
    run.progress.subscribe((update) => {
        const data = bars.get(update.id) || {
            id: update.id,
            builder: update.builder,
            target: update.target,
            status: update.status || '',
            name: ((update.target ? _targetStringFromTarget(update.target) : update.builder.name) +
                ' '.repeat(80)).substr(0, 40),
        };
        if (update.status !== undefined) {
            data.status = update.status;
        }
        switch (update.state) {
            case architect_1.BuilderProgressState.Error:
                data.status = 'Error: ' + update.error;
                bars.update(update.id, data);
                break;
            case architect_1.BuilderProgressState.Stopped:
                data.status = 'Done.';
                bars.complete(update.id);
                bars.update(update.id, data, update.total, update.total);
                break;
            case architect_1.BuilderProgressState.Waiting:
                bars.update(update.id, data);
                break;
            case architect_1.BuilderProgressState.Running:
                bars.update(update.id, data, update.current, update.total);
                break;
        }
        bars.render();
    });
    // Wait for full completion of the builder.
    try {
        const { success } = await run.output
            .pipe((0, operators_1.tap)((result) => {
            if (result.success) {
                parentLogger.info(colors.green('SUCCESS'));
            }
            else {
                parentLogger.info(colors.red('FAILURE'));
            }
            parentLogger.info('Result: ' + JSON.stringify({ ...result, info: undefined }, null, 4));
            parentLogger.info('\nLogs:');
            logs.forEach((l) => parentLogger.next(l));
            logs.splice(0);
        }))
            .toPromise();
        await run.stop();
        bars.terminate();
        return success ? 0 : 1;
    }
    catch (err) {
        parentLogger.info(colors.red('ERROR'));
        parentLogger.info('\nLogs:');
        logs.forEach((l) => parentLogger.next(l));
        parentLogger.fatal('Exception:');
        parentLogger.fatal(err.stack);
        return 2;
    }
}
async function main(args) {
    /** Parse the command line. */
    const argv = (0, minimist_1.default)(args, { boolean: ['help'] });
    /** Create the DevKit Logger used through the CLI. */
    const logger = (0, node_2.createConsoleLogger)(argv['verbose'], process.stdout, process.stderr, {
        info: (s) => s,
        debug: (s) => s,
        warn: (s) => colors.bold.yellow(s),
        error: (s) => colors.bold.red(s),
        fatal: (s) => colors.bold.red(s),
    });
    // Check the target.
    const targetStr = argv._[0] || '';
    if (!targetStr || argv.help) {
        // Show architect usage if there's no target.
        usage(logger);
    }
    // Load workspace configuration file.
    const currentPath = process.cwd();
    const configFileNames = ['angular.json', '.angular.json', 'workspace.json', '.workspace.json'];
    const configFilePath = findUp(configFileNames, currentPath);
    if (!configFilePath) {
        logger.fatal(`Workspace configuration file (${configFileNames.join(', ')}) cannot be found in ` +
            `'${currentPath}' or in parent directories.`);
        return 3;
    }
    const root = path.dirname(configFilePath);
    const registry = new core_1.schema.CoreSchemaRegistry();
    registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
    // Show usage of deprecated options
    registry.useXDeprecatedProvider((msg) => logger.warn(msg));
    const { workspace } = await core_1.workspaces.readWorkspace(configFilePath, core_1.workspaces.createWorkspaceHost(new node_2.NodeJsSyncHost()));
    // Clear the console.
    process.stdout.write('\u001Bc');
    return await _executeTarget(logger, workspace, root, argv, registry);
}
main(process.argv.slice(2)).then((code) => {
    process.exit(code);
}, (err) => {
    // eslint-disable-next-line no-console
    console.error('Error: ' + err.stack || err.message || err);
    process.exit(-1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjaGl0ZWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYXJjaGl0ZWN0X2NsaS9iaW4vYXJjaGl0ZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBaUc7QUFDakcseURBQW1GO0FBQ25GLCtDQUF5RTtBQUN6RSxvREFBZ0Y7QUFDaEYsd0RBQTBDO0FBQzFDLDJCQUFnQztBQUNoQyx3REFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLDhDQUFxQztBQUNyQyw4Q0FBbUQ7QUFFbkQsU0FBUyxNQUFNLENBQUMsS0FBd0IsRUFBRSxJQUFZO0lBQ3BELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2pCO0lBQ0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFFbkMsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLE9BQU8sVUFBVSxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDeEMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdEMsSUFBSSxJQUFBLGVBQVUsRUFBQyxDQUFDLENBQUMsRUFBRTtnQkFDakIsT0FBTyxDQUFDLENBQUM7YUFDVjtTQUNGO1FBRUQsVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDdkM7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsS0FBSyxDQUFDLE1BQXNCLEVB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O0FBQ3ZFLENBQUM7QUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzlCLENBQUMsSUFBSSxFQUFFLEVBQUU7SUFDUCxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLENBQUMsRUFDRCxDQUFDLEdBQUcsRUFBRSxFQUFFO0lBQ04sc0NBQXNDO0lBQ3RDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLE9BQU8sSUFBSSxHQUFHLENBQUMsQ0FBQztJQUMzRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbkIsQ0FBQyxDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQXJjaGl0ZWN0LCBCdWlsZGVySW5mbywgQnVpbGRlclByb2dyZXNzU3RhdGUsIFRhcmdldCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgV29ya3NwYWNlTm9kZU1vZHVsZXNBcmNoaXRlY3RIb3N0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdC9ub2RlJztcbmltcG9ydCB7IGxvZ2dpbmcsIHNjaGVtYSwgdGFncywgd29ya3NwYWNlcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IE5vZGVKc1N5bmNIb3N0LCBjcmVhdGVDb25zb2xlTG9nZ2VyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUvbm9kZSc7XG5pbXBvcnQgKiBhcyBhbnNpQ29sb3JzIGZyb20gJ2Fuc2ktY29sb3JzJztcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgbWluaW1pc3QgZnJvbSAnbWluaW1pc3QnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IE11bHRpUHJvZ3Jlc3NCYXIgfSBmcm9tICcuLi9zcmMvcHJvZ3Jlc3MnO1xuXG5mdW5jdGlvbiBmaW5kVXAobmFtZXM6IHN0cmluZyB8IHN0cmluZ1tdLCBmcm9tOiBzdHJpbmcpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KG5hbWVzKSkge1xuICAgIG5hbWVzID0gW25hbWVzXTtcbiAgfVxuICBjb25zdCByb290ID0gcGF0aC5wYXJzZShmcm9tKS5yb290O1xuXG4gIGxldCBjdXJyZW50RGlyID0gZnJvbTtcbiAgd2hpbGUgKGN1cnJlbnREaXIgJiYgY3VycmVudERpciAhPT0gcm9vdCkge1xuICAgIGZvciAoY29uc3QgbmFtZSBvZiBuYW1lcykge1xuICAgICAgY29uc3QgcCA9IHBhdGguam9pbihjdXJyZW50RGlyLCBuYW1lKTtcbiAgICAgIGlmIChleGlzdHNTeW5jKHApKSB7XG4gICAgICAgIHJldHVybiBwO1xuICAgICAgfVxuICAgIH1cblxuICAgIGN1cnJlbnREaXIgPSBwYXRoLmRpcm5hbWUoY3VycmVudERpcik7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBTaG93IHVzYWdlIG9mIHRoZSBDTEkgdG9vbCwgYW5kIGV4aXQgdGhlIHByb2Nlc3MuXG4gKi9cbmZ1bmN0aW9uIHVzYWdlKGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXIsIGV4aXRDb2RlID0gMCk6IG5ldmVyIHtcbiAgbG9nZ2VyLmluZm8odGFncy5zdHJpcEluZGVudGBcbiAgICBhcmNoaXRlY3QgW3Byb2plY3RdWzp0YXJnZXRdWzpjb25maWd1cmF0aW9uXSBbb3B0aW9ucywgLi4uXVxuXG4gICAgUnVuIGEgcHJvamVjdCB0YXJnZXQuXG4gICAgSWYgcHJvamVjdC90YXJnZXQvY29uZmlndXJhdGlvbiBhcmUgbm90IHNwZWNpZmllZCwgdGhlIHdvcmtzcGFjZSBkZWZhdWx0cyB3aWxsIGJlIHVzZWQuXG5cbiAgICBPcHRpb25zOlxuICAgICAgICAtLWhlbHAgICAgICAgICAgICAgIFNob3cgYXZhaWxhYmxlIG9wdGlvbnMgZm9yIHByb2plY3QgdGFyZ2V0LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNob3dzIHRoaXMgbWVzc2FnZSBpbnN0ZWFkIHdoZW4gcmFuIHdpdGhvdXQgdGhlIHJ1biBhcmd1bWVudC5cblxuXG4gICAgQW55IGFkZGl0aW9uYWwgb3B0aW9uIGlzIHBhc3NlZCB0aGUgdGFyZ2V0LCBvdmVycmlkaW5nIGV4aXN0aW5nIG9wdGlvbnMuXG4gIGApO1xuXG4gIHJldHVybiBwcm9jZXNzLmV4aXQoZXhpdENvZGUpO1xufVxuXG5mdW5jdGlvbiBfdGFyZ2V0U3RyaW5nRnJvbVRhcmdldCh7IHByb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbiB9OiBUYXJnZXQpIHtcbiAgcmV0dXJuIGAke3Byb2plY3R9OiR7dGFyZ2V0fSR7Y29uZmlndXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gJzonICsgY29uZmlndXJhdGlvbiA6ICcnfWA7XG59XG5cbmludGVyZmFjZSBCYXJJbmZvIHtcbiAgc3RhdHVzPzogc3RyaW5nO1xuICBidWlsZGVyOiBCdWlsZGVySW5mbztcbiAgdGFyZ2V0PzogVGFyZ2V0O1xufVxuXG4vLyBDcmVhdGUgYSBzZXBhcmF0ZSBpbnN0YW5jZSB0byBwcmV2ZW50IHVuaW50ZW5kZWQgZ2xvYmFsIGNoYW5nZXMgdG8gdGhlIGNvbG9yIGNvbmZpZ3VyYXRpb25cbi8vIENyZWF0ZSBmdW5jdGlvbiBpcyBub3QgZGVmaW5lZCBpbiB0aGUgdHlwaW5ncy4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZG9vd2IvYW5zaS1jb2xvcnMvcHVsbC80NFxuY29uc3QgY29sb3JzID0gKGFuc2lDb2xvcnMgYXMgdHlwZW9mIGFuc2lDb2xvcnMgJiB7IGNyZWF0ZTogKCkgPT4gdHlwZW9mIGFuc2lDb2xvcnMgfSkuY3JlYXRlKCk7XG5cbmFzeW5jIGZ1bmN0aW9uIF9leGVjdXRlVGFyZ2V0KFxuICBwYXJlbnRMb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyLFxuICB3b3Jrc3BhY2U6IHdvcmtzcGFjZXMuV29ya3NwYWNlRGVmaW5pdGlvbixcbiAgcm9vdDogc3RyaW5nLFxuICBhcmd2OiBtaW5pbWlzdC5QYXJzZWRBcmdzLFxuICByZWdpc3RyeTogc2NoZW1hLlNjaGVtYVJlZ2lzdHJ5LFxuKSB7XG4gIGNvbnN0IGFyY2hpdGVjdEhvc3QgPSBuZXcgV29ya3NwYWNlTm9kZU1vZHVsZXNBcmNoaXRlY3RIb3N0KHdvcmtzcGFjZSwgcm9vdCk7XG4gIGNvbnN0IGFyY2hpdGVjdCA9IG5ldyBBcmNoaXRlY3QoYXJjaGl0ZWN0SG9zdCwgcmVnaXN0cnkpO1xuXG4gIC8vIFNwbGl0IGEgdGFyZ2V0IGludG8gaXRzIHBhcnRzLlxuICBjb25zdCB0YXJnZXRTdHIgPSBhcmd2Ll8uc2hpZnQoKSB8fCAnJztcbiAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSB0YXJnZXRTdHIuc3BsaXQoJzonKTtcbiAgY29uc3QgdGFyZ2V0U3BlYyA9IHsgcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uIH07XG5cbiAgZGVsZXRlIGFyZ3ZbJ2hlbHAnXTtcbiAgY29uc3QgbG9nZ2VyID0gbmV3IGxvZ2dpbmcuTG9nZ2VyKCdqb2JzJyk7XG4gIGNvbnN0IGxvZ3M6IGxvZ2dpbmcuTG9nRW50cnlbXSA9IFtdO1xuICBsb2dnZXIuc3Vic2NyaWJlKChlbnRyeSkgPT4gbG9ncy5wdXNoKHsgLi4uZW50cnksIG1lc3NhZ2U6IGAke2VudHJ5Lm5hbWV9OiBgICsgZW50cnkubWVzc2FnZSB9KSk7XG5cbiAgY29uc3QgeyBfLCAuLi5vcHRpb25zIH0gPSBhcmd2O1xuICBjb25zdCBydW4gPSBhd2FpdCBhcmNoaXRlY3Quc2NoZWR1bGVUYXJnZXQodGFyZ2V0U3BlYywgb3B0aW9ucywgeyBsb2dnZXIgfSk7XG4gIGNvbnN0IGJhcnMgPSBuZXcgTXVsdGlQcm9ncmVzc0JhcjxudW1iZXIsIEJhckluZm8+KCc6bmFtZSA6YmFyICg6Y3VycmVudC86dG90YWwpIDpzdGF0dXMnKTtcblxuICBydW4ucHJvZ3Jlc3Muc3Vic2NyaWJlKCh1cGRhdGUpID0+IHtcbiAgICBjb25zdCBkYXRhID0gYmFycy5nZXQodXBkYXRlLmlkKSB8fCB7XG4gICAgICBpZDogdXBkYXRlLmlkLFxuICAgICAgYnVpbGRlcjogdXBkYXRlLmJ1aWxkZXIsXG4gICAgICB0YXJnZXQ6IHVwZGF0ZS50YXJnZXQsXG4gICAgICBzdGF0dXM6IHVwZGF0ZS5zdGF0dXMgfHwgJycsXG4gICAgICBuYW1lOiAoXG4gICAgICAgICh1cGRhdGUudGFyZ2V0ID8gX3RhcmdldFN0cmluZ0Zyb21UYXJnZXQodXBkYXRlLnRhcmdldCkgOiB1cGRhdGUuYnVpbGRlci5uYW1lKSArXG4gICAgICAgICcgJy5yZXBlYXQoODApXG4gICAgICApLnN1YnN0cigwLCA0MCksXG4gICAgfTtcblxuICAgIGlmICh1cGRhdGUuc3RhdHVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGRhdGEuc3RhdHVzID0gdXBkYXRlLnN0YXR1cztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHVwZGF0ZS5zdGF0ZSkge1xuICAgICAgY2FzZSBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5FcnJvcjpcbiAgICAgICAgZGF0YS5zdGF0dXMgPSAnRXJyb3I6ICcgKyB1cGRhdGUuZXJyb3I7XG4gICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLlN0b3BwZWQ6XG4gICAgICAgIGRhdGEuc3RhdHVzID0gJ0RvbmUuJztcbiAgICAgICAgYmFycy5jb21wbGV0ZSh1cGRhdGUuaWQpO1xuICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEsIHVwZGF0ZS50b3RhbCwgdXBkYXRlLnRvdGFsKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuV2FpdGluZzpcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuUnVubmluZzpcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhLCB1cGRhdGUuY3VycmVudCwgdXBkYXRlLnRvdGFsKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYmFycy5yZW5kZXIoKTtcbiAgfSk7XG5cbiAgLy8gV2FpdCBmb3IgZnVsbCBjb21wbGV0aW9uIG9mIHRoZSBidWlsZGVyLlxuICB0cnkge1xuICAgIGNvbnN0IHsgc3VjY2VzcyB9ID0gYXdhaXQgcnVuLm91dHB1dFxuICAgICAgLnBpcGUoXG4gICAgICAgIHRhcCgocmVzdWx0KSA9PiB7XG4gICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbyhjb2xvcnMuZ3JlZW4oJ1NVQ0NFU1MnKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKGNvbG9ycy5yZWQoJ0ZBSUxVUkUnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKCdSZXN1bHQ6ICcgKyBKU09OLnN0cmluZ2lmeSh7IC4uLnJlc3VsdCwgaW5mbzogdW5kZWZpbmVkIH0sIG51bGwsIDQpKTtcblxuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKCdcXG5Mb2dzOicpO1xuICAgICAgICAgIGxvZ3MuZm9yRWFjaCgobCkgPT4gcGFyZW50TG9nZ2VyLm5leHQobCkpO1xuICAgICAgICAgIGxvZ3Muc3BsaWNlKDApO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC50b1Byb21pc2UoKTtcblxuICAgIGF3YWl0IHJ1bi5zdG9wKCk7XG4gICAgYmFycy50ZXJtaW5hdGUoKTtcblxuICAgIHJldHVybiBzdWNjZXNzID8gMCA6IDE7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHBhcmVudExvZ2dlci5pbmZvKGNvbG9ycy5yZWQoJ0VSUk9SJykpO1xuICAgIHBhcmVudExvZ2dlci5pbmZvKCdcXG5Mb2dzOicpO1xuICAgIGxvZ3MuZm9yRWFjaCgobCkgPT4gcGFyZW50TG9nZ2VyLm5leHQobCkpO1xuXG4gICAgcGFyZW50TG9nZ2VyLmZhdGFsKCdFeGNlcHRpb246Jyk7XG4gICAgcGFyZW50TG9nZ2VyLmZhdGFsKGVyci5zdGFjayk7XG5cbiAgICByZXR1cm4gMjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBtYWluKGFyZ3M6IHN0cmluZ1tdKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgLyoqIFBhcnNlIHRoZSBjb21tYW5kIGxpbmUuICovXG4gIGNvbnN0IGFyZ3YgPSBtaW5pbWlzdChhcmdzLCB7IGJvb2xlYW46IFsnaGVscCddIH0pO1xuXG4gIC8qKiBDcmVhdGUgdGhlIERldktpdCBMb2dnZXIgdXNlZCB0aHJvdWdoIHRoZSBDTEkuICovXG4gIGNvbnN0IGxvZ2dlciA9IGNyZWF0ZUNvbnNvbGVMb2dnZXIoYXJndlsndmVyYm9zZSddLCBwcm9jZXNzLnN0ZG91dCwgcHJvY2Vzcy5zdGRlcnIsIHtcbiAgICBpbmZvOiAocykgPT4gcyxcbiAgICBkZWJ1ZzogKHMpID0+IHMsXG4gICAgd2FybjogKHMpID0+IGNvbG9ycy5ib2xkLnllbGxvdyhzKSxcbiAgICBlcnJvcjogKHMpID0+IGNvbG9ycy5ib2xkLnJlZChzKSxcbiAgICBmYXRhbDogKHMpID0+IGNvbG9ycy5ib2xkLnJlZChzKSxcbiAgfSk7XG5cbiAgLy8gQ2hlY2sgdGhlIHRhcmdldC5cbiAgY29uc3QgdGFyZ2V0U3RyID0gYXJndi5fWzBdIHx8ICcnO1xuICBpZiAoIXRhcmdldFN0ciB8fCBhcmd2LmhlbHApIHtcbiAgICAvLyBTaG93IGFyY2hpdGVjdCB1c2FnZSBpZiB0aGVyZSdzIG5vIHRhcmdldC5cbiAgICB1c2FnZShsb2dnZXIpO1xuICB9XG5cbiAgLy8gTG9hZCB3b3Jrc3BhY2UgY29uZmlndXJhdGlvbiBmaWxlLlxuICBjb25zdCBjdXJyZW50UGF0aCA9IHByb2Nlc3MuY3dkKCk7XG4gIGNvbnN0IGNvbmZpZ0ZpbGVOYW1lcyA9IFsnYW5ndWxhci5qc29uJywgJy5hbmd1bGFyLmpzb24nLCAnd29ya3NwYWNlLmpzb24nLCAnLndvcmtzcGFjZS5qc29uJ107XG5cbiAgY29uc3QgY29uZmlnRmlsZVBhdGggPSBmaW5kVXAoY29uZmlnRmlsZU5hbWVzLCBjdXJyZW50UGF0aCk7XG5cbiAgaWYgKCFjb25maWdGaWxlUGF0aCkge1xuICAgIGxvZ2dlci5mYXRhbChcbiAgICAgIGBXb3Jrc3BhY2UgY29uZmlndXJhdGlvbiBmaWxlICgke2NvbmZpZ0ZpbGVOYW1lcy5qb2luKCcsICcpfSkgY2Fubm90IGJlIGZvdW5kIGluIGAgK1xuICAgICAgICBgJyR7Y3VycmVudFBhdGh9JyBvciBpbiBwYXJlbnQgZGlyZWN0b3JpZXMuYCxcbiAgICApO1xuXG4gICAgcmV0dXJuIDM7XG4gIH1cblxuICBjb25zdCByb290ID0gcGF0aC5kaXJuYW1lKGNvbmZpZ0ZpbGVQYXRoKTtcblxuICBjb25zdCByZWdpc3RyeSA9IG5ldyBzY2hlbWEuQ29yZVNjaGVtYVJlZ2lzdHJ5KCk7XG4gIHJlZ2lzdHJ5LmFkZFBvc3RUcmFuc2Zvcm0oc2NoZW1hLnRyYW5zZm9ybXMuYWRkVW5kZWZpbmVkRGVmYXVsdHMpO1xuXG4gIC8vIFNob3cgdXNhZ2Ugb2YgZGVwcmVjYXRlZCBvcHRpb25zXG4gIHJlZ2lzdHJ5LnVzZVhEZXByZWNhdGVkUHJvdmlkZXIoKG1zZykgPT4gbG9nZ2VyLndhcm4obXNnKSk7XG5cbiAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IGF3YWl0IHdvcmtzcGFjZXMucmVhZFdvcmtzcGFjZShcbiAgICBjb25maWdGaWxlUGF0aCxcbiAgICB3b3Jrc3BhY2VzLmNyZWF0ZVdvcmtzcGFjZUhvc3QobmV3IE5vZGVKc1N5bmNIb3N0KCkpLFxuICApO1xuXG4gIC8vIENsZWFyIHRoZSBjb25zb2xlLlxuICBwcm9jZXNzLnN0ZG91dC53cml0ZSgnXFx1MDAxQmMnKTtcblxuICByZXR1cm4gYXdhaXQgX2V4ZWN1dGVUYXJnZXQobG9nZ2VyLCB3b3Jrc3BhY2UsIHJvb3QsIGFyZ3YsIHJlZ2lzdHJ5KTtcbn1cblxubWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpLnRoZW4oXG4gIChjb2RlKSA9PiB7XG4gICAgcHJvY2Vzcy5leGl0KGNvZGUpO1xuICB9LFxuICAoZXJyKSA9PiB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvcjogJyArIGVyci5zdGFjayB8fCBlcnIubWVzc2FnZSB8fCBlcnIpO1xuICAgIHByb2Nlc3MuZXhpdCgtMSk7XG4gIH0sXG4pO1xuIl19