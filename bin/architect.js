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
Object.defineProperty(exports, "__esModule", { value: true });
const architect_1 = require("@angular-devkit/architect");
const node_1 = require("@angular-devkit/architect/node");
const core_1 = require("@angular-devkit/core");
const node_2 = require("@angular-devkit/core/node");
const ansiColors = __importStar(require("ansi-colors"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const operators_1 = require("rxjs/operators");
const yargs_parser_1 = __importStar(require("yargs-parser"));
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
    const { _: [targetStr = ''], help, ...options } = argv;
    const [project, target, configuration] = targetStr.toString().split(':');
    const targetSpec = { project, target, configuration };
    const logger = new core_1.logging.Logger('jobs');
    const logs = [];
    logger.subscribe((entry) => logs.push({ ...entry, message: `${entry.name}: ` + entry.message }));
    // Camelize options as yargs will return the object in kebab-case when camel casing is disabled.
    const camelCasedOptions = {};
    for (const [key, value] of Object.entries(options)) {
        if (/[A-Z]/.test(key)) {
            throw new Error(`Unknown argument ${key}. Did you mean ${(0, yargs_parser_1.decamelize)(key)}?`);
        }
        camelCasedOptions[(0, yargs_parser_1.camelCase)(key)] = value;
    }
    const run = await architect.scheduleTarget(targetSpec, camelCasedOptions, { logger });
    const bars = new progress_1.MultiProgressBar(':name :bar (:current/:total) :status');
    run.progress.subscribe((update) => {
        const data = bars.get(update.id) || {
            id: update.id,
            builder: update.builder,
            target: update.target,
            status: update.status || '',
            name: ((update.target ? _targetStringFromTarget(update.target) : update.builder.name) +
                ' '.repeat(80)).substring(0, 40),
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
    const argv = (0, yargs_parser_1.default)(args, {
        boolean: ['help'],
        configuration: {
            'dot-notation': false,
            'boolean-negation': true,
            'strip-aliased': true,
            'camel-case-expansion': false,
        },
    });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjaGl0ZWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYXJjaGl0ZWN0X2NsaS9iaW4vYXJjaGl0ZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBaUc7QUFDakcseURBQW1GO0FBQ25GLCtDQUErRTtBQUMvRSxvREFBZ0Y7QUFDaEYsd0RBQTBDO0FBQzFDLDJCQUFnQztBQUNoQywyQ0FBNkI7QUFDN0IsOENBQXFDO0FBQ3JDLDZEQUFrRTtBQUNsRSw4Q0FBbUQ7QUFFbkQsU0FBUyxNQUFNLENBQUMsS0FBd0IsRUFBRSxJQUFZO0lBQ3BELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2pCO0lBQ0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFFbkMsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLE9BQU8sVUFBVSxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDeEMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdEMsSUFBSSxJQUFBLGVBQVUsRUFBQyxDQUFDLENBQUMsRUFBRTtnQkFDakIsT0FBTyxDQUFDLENBQUM7YUFDVjtTQUNGO1FBRUQsVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDdkM7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsS0FBSyxDQUFDLE1BQXNCLEVBQUUs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LENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUVsRSxtQ0FBbUM7SUFDbkMsUUFBUSxDQUFDLHNCQUFzQixDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFM0QsTUFBTSxFQUFFLFNBQVMsRUFBRSxHQUFHLE1BQU0saUJBQVUsQ0FBQyxhQUFhLENBQ2xELGNBQWMsRUFDZCxpQkFBVSxDQUFDLG1CQUFtQixDQUFDLElBQUkscUJBQWMsRUFBRSxDQUFDLENBQ3JELENBQUM7SUFFRixxQkFBcUI7SUFDckIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFaEMsT0FBTyxNQUFNLGNBQWMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDdkUsQ0FBQztBQUVELElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDOUIsQ0FBQyxJQUFJLEVBQUUsRUFBRTtJQUNQLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckIsQ0FBQyxFQUNELENBQUMsR0FBRyxFQUFFLEVBQUU7SUFDTixzQ0FBc0M7SUFDdEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDLEtBQUssSUFBSSxHQUFHLENBQUMsT0FBTyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQzNELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQixDQUFDLENBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBBcmNoaXRlY3QsIEJ1aWxkZXJJbmZvLCBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZSwgVGFyZ2V0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VOb2RlTW9kdWxlc0FyY2hpdGVjdEhvc3QgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0L25vZGUnO1xuaW1wb3J0IHsganNvbiwgbG9nZ2luZywgc2NoZW1hLCB0YWdzLCB3b3Jrc3BhY2VzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgTm9kZUpzU3luY0hvc3QsIGNyZWF0ZUNvbnNvbGVMb2dnZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZS9ub2RlJztcbmltcG9ydCAqIGFzIGFuc2lDb2xvcnMgZnJvbSAnYW5zaS1jb2xvcnMnO1xuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeWFyZ3NQYXJzZXIsIHsgY2FtZWxDYXNlLCBkZWNhbWVsaXplIH0gZnJvbSAneWFyZ3MtcGFyc2VyJztcbmltcG9ydCB7IE11bHRpUHJvZ3Jlc3NCYXIgfSBmcm9tICcuLi9zcmMvcHJvZ3Jlc3MnO1xuXG5mdW5jdGlvbiBmaW5kVXAobmFtZXM6IHN0cmluZyB8IHN0cmluZ1tdLCBmcm9tOiBzdHJpbmcpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KG5hbWVzKSkge1xuICAgIG5hbWVzID0gW25hbWVzXTtcbiAgfVxuICBjb25zdCByb290ID0gcGF0aC5wYXJzZShmcm9tKS5yb290O1xuXG4gIGxldCBjdXJyZW50RGlyID0gZnJvbTtcbiAgd2hpbGUgKGN1cnJlbnREaXIgJiYgY3VycmVudERpciAhPT0gcm9vdCkge1xuICAgIGZvciAoY29uc3QgbmFtZSBvZiBuYW1lcykge1xuICAgICAgY29uc3QgcCA9IHBhdGguam9pbihjdXJyZW50RGlyLCBuYW1lKTtcbiAgICAgIGlmIChleGlzdHNTeW5jKHApKSB7XG4gICAgICAgIHJldHVybiBwO1xuICAgICAgfVxuICAgIH1cblxuICAgIGN1cnJlbnREaXIgPSBwYXRoLmRpcm5hbWUoY3VycmVudERpcik7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBTaG93IHVzYWdlIG9mIHRoZSBDTEkgdG9vbCwgYW5kIGV4aXQgdGhlIHByb2Nlc3MuXG4gKi9cbmZ1bmN0aW9uIHVzYWdlKGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXIsIGV4aXRDb2RlID0gMCk6IG5ldmVyIHtcbiAgbG9nZ2VyLmluZm8odGFncy5zdHJpcEluZGVudGBcbiAgICBhcmNoaXRlY3QgW3Byb2plY3RdWzp0YXJnZXRdWzpjb25maWd1cmF0aW9uXSBbb3B0aW9ucywgLi4uXVxuXG4gICAgUnVuIGEgcHJvamVjdCB0YXJnZXQuXG4gICAgSWYgcHJvamVjdC90YXJnZXQvY29uZmlndXJhdGlvbiBhcmUgbm90IHNwZWNpZmllZCwgdGhlIHdvcmtzcGFjZSBkZWZhdWx0cyB3aWxsIGJlIHVzZWQuXG5cbiAgICBPcHRpb25zOlxuICAgICAgICAtLWhlbHAgICAgICAgICAgICAgIFNob3cgYXZhaWxhYmxlIG9wdGlvbnMgZm9yIHByb2plY3QgdGFyZ2V0LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNob3dzIHRoaXMgbWVzc2FnZSBpbnN0ZWFkIHdoZW4gcmFuIHdpdGhvdXQgdGhlIHJ1biBhcmd1bWVudC5cblxuXG4gICAgQW55IGFkZGl0aW9uYWwgb3B0aW9uIGlzIHBhc3NlZCB0aGUgdGFyZ2V0LCBvdmVycmlkaW5nIGV4aXN0aW5nIG9wdGlvbnMuXG4gIGApO1xuXG4gIHJldHVybiBwcm9jZXNzLmV4aXQoZXhpdENvZGUpO1xufVxuXG5mdW5jdGlvbiBfdGFyZ2V0U3RyaW5nRnJvbVRhcmdldCh7IHByb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbiB9OiBUYXJnZXQpIHtcbiAgcmV0dXJuIGAke3Byb2plY3R9OiR7dGFyZ2V0fSR7Y29uZmlndXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gJzonICsgY29uZmlndXJhdGlvbiA6ICcnfWA7XG59XG5cbmludGVyZmFjZSBCYXJJbmZvIHtcbiAgc3RhdHVzPzogc3RyaW5nO1xuICBidWlsZGVyOiBCdWlsZGVySW5mbztcbiAgdGFyZ2V0PzogVGFyZ2V0O1xufVxuXG4vLyBDcmVhdGUgYSBzZXBhcmF0ZSBpbnN0YW5jZSB0byBwcmV2ZW50IHVuaW50ZW5kZWQgZ2xvYmFsIGNoYW5nZXMgdG8gdGhlIGNvbG9yIGNvbmZpZ3VyYXRpb25cbi8vIENyZWF0ZSBmdW5jdGlvbiBpcyBub3QgZGVmaW5lZCBpbiB0aGUgdHlwaW5ncy4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZG9vd2IvYW5zaS1jb2xvcnMvcHVsbC80NFxuY29uc3QgY29sb3JzID0gKGFuc2lDb2xvcnMgYXMgdHlwZW9mIGFuc2lDb2xvcnMgJiB7IGNyZWF0ZTogKCkgPT4gdHlwZW9mIGFuc2lDb2xvcnMgfSkuY3JlYXRlKCk7XG5cbmFzeW5jIGZ1bmN0aW9uIF9leGVjdXRlVGFyZ2V0KFxuICBwYXJlbnRMb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyLFxuICB3b3Jrc3BhY2U6IHdvcmtzcGFjZXMuV29ya3NwYWNlRGVmaW5pdGlvbixcbiAgcm9vdDogc3RyaW5nLFxuICBhcmd2OiB5YXJnc1BhcnNlci5Bcmd1bWVudHMsXG4gIHJlZ2lzdHJ5OiBzY2hlbWEuU2NoZW1hUmVnaXN0cnksXG4pIHtcbiAgY29uc3QgYXJjaGl0ZWN0SG9zdCA9IG5ldyBXb3Jrc3BhY2VOb2RlTW9kdWxlc0FyY2hpdGVjdEhvc3Qod29ya3NwYWNlLCByb290KTtcbiAgY29uc3QgYXJjaGl0ZWN0ID0gbmV3IEFyY2hpdGVjdChhcmNoaXRlY3RIb3N0LCByZWdpc3RyeSk7XG5cbiAgLy8gU3BsaXQgYSB0YXJnZXQgaW50byBpdHMgcGFydHMuXG4gIGNvbnN0IHtcbiAgICBfOiBbdGFyZ2V0U3RyID0gJyddLFxuICAgIGhlbHAsXG4gICAgLi4ub3B0aW9uc1xuICB9ID0gYXJndjtcbiAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSB0YXJnZXRTdHIudG9TdHJpbmcoKS5zcGxpdCgnOicpO1xuICBjb25zdCB0YXJnZXRTcGVjID0geyBwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb24gfTtcblxuICBjb25zdCBsb2dnZXIgPSBuZXcgbG9nZ2luZy5Mb2dnZXIoJ2pvYnMnKTtcbiAgY29uc3QgbG9nczogbG9nZ2luZy5Mb2dFbnRyeVtdID0gW107XG4gIGxvZ2dlci5zdWJzY3JpYmUoKGVudHJ5KSA9PiBsb2dzLnB1c2goeyAuLi5lbnRyeSwgbWVzc2FnZTogYCR7ZW50cnkubmFtZX06IGAgKyBlbnRyeS5tZXNzYWdlIH0pKTtcblxuICAvLyBDYW1lbGl6ZSBvcHRpb25zIGFzIHlhcmdzIHdpbGwgcmV0dXJuIHRoZSBvYmplY3QgaW4ga2ViYWItY2FzZSB3aGVuIGNhbWVsIGNhc2luZyBpcyBkaXNhYmxlZC5cbiAgY29uc3QgY2FtZWxDYXNlZE9wdGlvbnM6IGpzb24uSnNvbk9iamVjdCA9IHt9O1xuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zKSkge1xuICAgIGlmICgvW0EtWl0vLnRlc3Qoa2V5KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGFyZ3VtZW50ICR7a2V5fS4gRGlkIHlvdSBtZWFuICR7ZGVjYW1lbGl6ZShrZXkpfT9gKTtcbiAgICB9XG5cbiAgICBjYW1lbENhc2VkT3B0aW9uc1tjYW1lbENhc2Uoa2V5KV0gPSB2YWx1ZTtcbiAgfVxuXG4gIGNvbnN0IHJ1biA9IGF3YWl0IGFyY2hpdGVjdC5zY2hlZHVsZVRhcmdldCh0YXJnZXRTcGVjLCBjYW1lbENhc2VkT3B0aW9ucywgeyBsb2dnZXIgfSk7XG4gIGNvbnN0IGJhcnMgPSBuZXcgTXVsdGlQcm9ncmVzc0JhcjxudW1iZXIsIEJhckluZm8+KCc6bmFtZSA6YmFyICg6Y3VycmVudC86dG90YWwpIDpzdGF0dXMnKTtcblxuICBydW4ucHJvZ3Jlc3Muc3Vic2NyaWJlKCh1cGRhdGUpID0+IHtcbiAgICBjb25zdCBkYXRhID0gYmFycy5nZXQodXBkYXRlLmlkKSB8fCB7XG4gICAgICBpZDogdXBkYXRlLmlkLFxuICAgICAgYnVpbGRlcjogdXBkYXRlLmJ1aWxkZXIsXG4gICAgICB0YXJnZXQ6IHVwZGF0ZS50YXJnZXQsXG4gICAgICBzdGF0dXM6IHVwZGF0ZS5zdGF0dXMgfHwgJycsXG4gICAgICBuYW1lOiAoXG4gICAgICAgICh1cGRhdGUudGFyZ2V0ID8gX3RhcmdldFN0cmluZ0Zyb21UYXJnZXQodXBkYXRlLnRhcmdldCkgOiB1cGRhdGUuYnVpbGRlci5uYW1lKSArXG4gICAgICAgICcgJy5yZXBlYXQoODApXG4gICAgICApLnN1YnN0cmluZygwLCA0MCksXG4gICAgfTtcblxuICAgIGlmICh1cGRhdGUuc3RhdHVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGRhdGEuc3RhdHVzID0gdXBkYXRlLnN0YXR1cztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHVwZGF0ZS5zdGF0ZSkge1xuICAgICAgY2FzZSBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5FcnJvcjpcbiAgICAgICAgZGF0YS5zdGF0dXMgPSAnRXJyb3I6ICcgKyB1cGRhdGUuZXJyb3I7XG4gICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLlN0b3BwZWQ6XG4gICAgICAgIGRhdGEuc3RhdHVzID0gJ0RvbmUuJztcbiAgICAgICAgYmFycy5jb21wbGV0ZSh1cGRhdGUuaWQpO1xuICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEsIHVwZGF0ZS50b3RhbCwgdXBkYXRlLnRvdGFsKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuV2FpdGluZzpcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuUnVubmluZzpcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhLCB1cGRhdGUuY3VycmVudCwgdXBkYXRlLnRvdGFsKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYmFycy5yZW5kZXIoKTtcbiAgfSk7XG5cbiAgLy8gV2FpdCBmb3IgZnVsbCBjb21wbGV0aW9uIG9mIHRoZSBidWlsZGVyLlxuICB0cnkge1xuICAgIGNvbnN0IHsgc3VjY2VzcyB9ID0gYXdhaXQgcnVuLm91dHB1dFxuICAgICAgLnBpcGUoXG4gICAgICAgIHRhcCgocmVzdWx0KSA9PiB7XG4gICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbyhjb2xvcnMuZ3JlZW4oJ1NVQ0NFU1MnKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKGNvbG9ycy5yZWQoJ0ZBSUxVUkUnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKCdSZXN1bHQ6ICcgKyBKU09OLnN0cmluZ2lmeSh7IC4uLnJlc3VsdCwgaW5mbzogdW5kZWZpbmVkIH0sIG51bGwsIDQpKTtcblxuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKCdcXG5Mb2dzOicpO1xuICAgICAgICAgIGxvZ3MuZm9yRWFjaCgobCkgPT4gcGFyZW50TG9nZ2VyLm5leHQobCkpO1xuICAgICAgICAgIGxvZ3Muc3BsaWNlKDApO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC50b1Byb21pc2UoKTtcblxuICAgIGF3YWl0IHJ1bi5zdG9wKCk7XG4gICAgYmFycy50ZXJtaW5hdGUoKTtcblxuICAgIHJldHVybiBzdWNjZXNzID8gMCA6IDE7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHBhcmVudExvZ2dlci5pbmZvKGNvbG9ycy5yZWQoJ0VSUk9SJykpO1xuICAgIHBhcmVudExvZ2dlci5pbmZvKCdcXG5Mb2dzOicpO1xuICAgIGxvZ3MuZm9yRWFjaCgobCkgPT4gcGFyZW50TG9nZ2VyLm5leHQobCkpO1xuXG4gICAgcGFyZW50TG9nZ2VyLmZhdGFsKCdFeGNlcHRpb246Jyk7XG4gICAgcGFyZW50TG9nZ2VyLmZhdGFsKGVyci5zdGFjayk7XG5cbiAgICByZXR1cm4gMjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBtYWluKGFyZ3M6IHN0cmluZ1tdKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgLyoqIFBhcnNlIHRoZSBjb21tYW5kIGxpbmUuICovXG4gIGNvbnN0IGFyZ3YgPSB5YXJnc1BhcnNlcihhcmdzLCB7XG4gICAgYm9vbGVhbjogWydoZWxwJ10sXG4gICAgY29uZmlndXJhdGlvbjoge1xuICAgICAgJ2RvdC1ub3RhdGlvbic6IGZhbHNlLFxuICAgICAgJ2Jvb2xlYW4tbmVnYXRpb24nOiB0cnVlLFxuICAgICAgJ3N0cmlwLWFsaWFzZWQnOiB0cnVlLFxuICAgICAgJ2NhbWVsLWNhc2UtZXhwYW5zaW9uJzogZmFsc2UsXG4gICAgfSxcbiAgfSk7XG5cbiAgLyoqIENyZWF0ZSB0aGUgRGV2S2l0IExvZ2dlciB1c2VkIHRocm91Z2ggdGhlIENMSS4gKi9cbiAgY29uc3QgbG9nZ2VyID0gY3JlYXRlQ29uc29sZUxvZ2dlcihhcmd2Wyd2ZXJib3NlJ10sIHByb2Nlc3Muc3Rkb3V0LCBwcm9jZXNzLnN0ZGVyciwge1xuICAgIGluZm86IChzKSA9PiBzLFxuICAgIGRlYnVnOiAocykgPT4gcyxcbiAgICB3YXJuOiAocykgPT4gY29sb3JzLmJvbGQueWVsbG93KHMpLFxuICAgIGVycm9yOiAocykgPT4gY29sb3JzLmJvbGQucmVkKHMpLFxuICAgIGZhdGFsOiAocykgPT4gY29sb3JzLmJvbGQucmVkKHMpLFxuICB9KTtcblxuICAvLyBDaGVjayB0aGUgdGFyZ2V0LlxuICBjb25zdCB0YXJnZXRTdHIgPSBhcmd2Ll9bMF0gfHwgJyc7XG4gIGlmICghdGFyZ2V0U3RyIHx8IGFyZ3YuaGVscCkge1xuICAgIC8vIFNob3cgYXJjaGl0ZWN0IHVzYWdlIGlmIHRoZXJlJ3Mgbm8gdGFyZ2V0LlxuICAgIHVzYWdlKGxvZ2dlcik7XG4gIH1cblxuICAvLyBMb2FkIHdvcmtzcGFjZSBjb25maWd1cmF0aW9uIGZpbGUuXG4gIGNvbnN0IGN1cnJlbnRQYXRoID0gcHJvY2Vzcy5jd2QoKTtcbiAgY29uc3QgY29uZmlnRmlsZU5hbWVzID0gWydhbmd1bGFyLmpzb24nLCAnLmFuZ3VsYXIuanNvbicsICd3b3Jrc3BhY2UuanNvbicsICcud29ya3NwYWNlLmpzb24nXTtcblxuICBjb25zdCBjb25maWdGaWxlUGF0aCA9IGZpbmRVcChjb25maWdGaWxlTmFtZXMsIGN1cnJlbnRQYXRoKTtcblxuICBpZiAoIWNvbmZpZ0ZpbGVQYXRoKSB7XG4gICAgbG9nZ2VyLmZhdGFsKFxuICAgICAgYFdvcmtzcGFjZSBjb25maWd1cmF0aW9uIGZpbGUgKCR7Y29uZmlnRmlsZU5hbWVzLmpvaW4oJywgJyl9KSBjYW5ub3QgYmUgZm91bmQgaW4gYCArXG4gICAgICAgIGAnJHtjdXJyZW50UGF0aH0nIG9yIGluIHBhcmVudCBkaXJlY3Rvcmllcy5gLFxuICAgICk7XG5cbiAgICByZXR1cm4gMztcbiAgfVxuXG4gIGNvbnN0IHJvb3QgPSBwYXRoLmRpcm5hbWUoY29uZmlnRmlsZVBhdGgpO1xuXG4gIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IHNjaGVtYS5Db3JlU2NoZW1hUmVnaXN0cnkoKTtcbiAgcmVnaXN0cnkuYWRkUG9zdFRyYW5zZm9ybShzY2hlbWEudHJhbnNmb3Jtcy5hZGRVbmRlZmluZWREZWZhdWx0cyk7XG5cbiAgLy8gU2hvdyB1c2FnZSBvZiBkZXByZWNhdGVkIG9wdGlvbnNcbiAgcmVnaXN0cnkudXNlWERlcHJlY2F0ZWRQcm92aWRlcigobXNnKSA9PiBsb2dnZXIud2Fybihtc2cpKTtcblxuICBjb25zdCB7IHdvcmtzcGFjZSB9ID0gYXdhaXQgd29ya3NwYWNlcy5yZWFkV29ya3NwYWNlKFxuICAgIGNvbmZpZ0ZpbGVQYXRoLFxuICAgIHdvcmtzcGFjZXMuY3JlYXRlV29ya3NwYWNlSG9zdChuZXcgTm9kZUpzU3luY0hvc3QoKSksXG4gICk7XG5cbiAgLy8gQ2xlYXIgdGhlIGNvbnNvbGUuXG4gIHByb2Nlc3Muc3Rkb3V0LndyaXRlKCdcXHUwMDFCYycpO1xuXG4gIHJldHVybiBhd2FpdCBfZXhlY3V0ZVRhcmdldChsb2dnZXIsIHdvcmtzcGFjZSwgcm9vdCwgYXJndiwgcmVnaXN0cnkpO1xufVxuXG5tYWluKHByb2Nlc3MuYXJndi5zbGljZSgyKSkudGhlbihcbiAgKGNvZGUpID0+IHtcbiAgICBwcm9jZXNzLmV4aXQoY29kZSk7XG4gIH0sXG4gIChlcnIpID0+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yOiAnICsgZXJyLnN0YWNrIHx8IGVyci5tZXNzYWdlIHx8IGVycik7XG4gICAgcHJvY2Vzcy5leGl0KC0xKTtcbiAgfSxcbik7XG4iXX0=