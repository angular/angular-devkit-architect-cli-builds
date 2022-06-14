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
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
        parentLogger.fatal((err instanceof Error && err.stack) || `${err}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjaGl0ZWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYXJjaGl0ZWN0X2NsaS9iaW4vYXJjaGl0ZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQWlHO0FBQ2pHLHlEQUFtRjtBQUNuRiwrQ0FBK0U7QUFDL0Usb0RBQWdGO0FBQ2hGLHdEQUEwQztBQUMxQywyQkFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLDhDQUFxQztBQUNyQyw2REFBa0U7QUFDbEUsOENBQW1EO0FBRW5ELFNBQVMsTUFBTSxDQUFDLEtBQXdCLEVBQUUsSUFBWTtJQUNwRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUN6QixLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNqQjtJQUNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDO0lBRW5DLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQztJQUN0QixPQUFPLFVBQVUsSUFBSSxVQUFVLEtBQUssSUFBSSxFQUFFO1FBQ3hDLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3hCLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3RDLElBQUksSUFBQSxlQUFVLEVBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ2pCLE9BQU8sQ0FBQyxDQUFDO2FBQ1Y7U0FDRjtRQUVELFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQ3ZDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLEtBQUssQ0FBQyxNQUFzQixF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QixFQUFFLENBQUM7SUFDakQsUUFBUSxDQUFDLGdCQUFnQixDQUFDLGFBQU0sQ0FBQyxVQUFVLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUVsRSxtQ0FBbUM7SUFDbkMsUUFBUSxDQUFDLHNCQUFzQixDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFM0QsTUFBTSxFQUFFLFNBQVMsRUFBRSxHQUFHLE1BQU0saUJBQVUsQ0FBQyxhQUFhLENBQ2xELGNBQWMsRUFDZCxpQkFBVSxDQUFDLG1CQUFtQixDQUFDLElBQUkscUJBQWMsRUFBRSxDQUFDLENBQ3JELENBQUM7SUFFRixxQkFBcUI7SUFDckIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFaEMsT0FBTyxNQUFNLGNBQWMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDdkUsQ0FBQztBQUVELElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDOUIsQ0FBQyxJQUFJLEVBQUUsRUFBRTtJQUNQLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckIsQ0FBQyxFQUNELENBQUMsR0FBRyxFQUFFLEVBQUU7SUFDTixzQ0FBc0M7SUFDdEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDLEtBQUssSUFBSSxHQUFHLENBQUMsT0FBTyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQzNELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQixDQUFDLENBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBBcmNoaXRlY3QsIEJ1aWxkZXJJbmZvLCBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZSwgVGFyZ2V0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VOb2RlTW9kdWxlc0FyY2hpdGVjdEhvc3QgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0L25vZGUnO1xuaW1wb3J0IHsganNvbiwgbG9nZ2luZywgc2NoZW1hLCB0YWdzLCB3b3Jrc3BhY2VzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgTm9kZUpzU3luY0hvc3QsIGNyZWF0ZUNvbnNvbGVMb2dnZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZS9ub2RlJztcbmltcG9ydCAqIGFzIGFuc2lDb2xvcnMgZnJvbSAnYW5zaS1jb2xvcnMnO1xuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeWFyZ3NQYXJzZXIsIHsgY2FtZWxDYXNlLCBkZWNhbWVsaXplIH0gZnJvbSAneWFyZ3MtcGFyc2VyJztcbmltcG9ydCB7IE11bHRpUHJvZ3Jlc3NCYXIgfSBmcm9tICcuLi9zcmMvcHJvZ3Jlc3MnO1xuXG5mdW5jdGlvbiBmaW5kVXAobmFtZXM6IHN0cmluZyB8IHN0cmluZ1tdLCBmcm9tOiBzdHJpbmcpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KG5hbWVzKSkge1xuICAgIG5hbWVzID0gW25hbWVzXTtcbiAgfVxuICBjb25zdCByb290ID0gcGF0aC5wYXJzZShmcm9tKS5yb290O1xuXG4gIGxldCBjdXJyZW50RGlyID0gZnJvbTtcbiAgd2hpbGUgKGN1cnJlbnREaXIgJiYgY3VycmVudERpciAhPT0gcm9vdCkge1xuICAgIGZvciAoY29uc3QgbmFtZSBvZiBuYW1lcykge1xuICAgICAgY29uc3QgcCA9IHBhdGguam9pbihjdXJyZW50RGlyLCBuYW1lKTtcbiAgICAgIGlmIChleGlzdHNTeW5jKHApKSB7XG4gICAgICAgIHJldHVybiBwO1xuICAgICAgfVxuICAgIH1cblxuICAgIGN1cnJlbnREaXIgPSBwYXRoLmRpcm5hbWUoY3VycmVudERpcik7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBTaG93IHVzYWdlIG9mIHRoZSBDTEkgdG9vbCwgYW5kIGV4aXQgdGhlIHByb2Nlc3MuXG4gKi9cbmZ1bmN0aW9uIHVzYWdlKGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXIsIGV4aXRDb2RlID0gMCk6IG5ldmVyIHtcbiAgbG9nZ2VyLmluZm8odGFncy5zdHJpcEluZGVudGBcbiAgICBhcmNoaXRlY3QgW3Byb2plY3RdWzp0YXJnZXRdWzpjb25maWd1cmF0aW9uXSBbb3B0aW9ucywgLi4uXVxuXG4gICAgUnVuIGEgcHJvamVjdCB0YXJnZXQuXG4gICAgSWYgcHJvamVjdC90YXJnZXQvY29uZmlndXJhdGlvbiBhcmUgbm90IHNwZWNpZmllZCwgdGhlIHdvcmtzcGFjZSBkZWZhdWx0cyB3aWxsIGJlIHVzZWQuXG5cbiAgICBPcHRpb25zOlxuICAgICAgICAtLWhlbHAgICAgICAgICAgICAgIFNob3cgYXZhaWxhYmxlIG9wdGlvbnMgZm9yIHByb2plY3QgdGFyZ2V0LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNob3dzIHRoaXMgbWVzc2FnZSBpbnN0ZWFkIHdoZW4gcmFuIHdpdGhvdXQgdGhlIHJ1biBhcmd1bWVudC5cblxuXG4gICAgQW55IGFkZGl0aW9uYWwgb3B0aW9uIGlzIHBhc3NlZCB0aGUgdGFyZ2V0LCBvdmVycmlkaW5nIGV4aXN0aW5nIG9wdGlvbnMuXG4gIGApO1xuXG4gIHJldHVybiBwcm9jZXNzLmV4aXQoZXhpdENvZGUpO1xufVxuXG5mdW5jdGlvbiBfdGFyZ2V0U3RyaW5nRnJvbVRhcmdldCh7IHByb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbiB9OiBUYXJnZXQpIHtcbiAgcmV0dXJuIGAke3Byb2plY3R9OiR7dGFyZ2V0fSR7Y29uZmlndXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gJzonICsgY29uZmlndXJhdGlvbiA6ICcnfWA7XG59XG5cbmludGVyZmFjZSBCYXJJbmZvIHtcbiAgc3RhdHVzPzogc3RyaW5nO1xuICBidWlsZGVyOiBCdWlsZGVySW5mbztcbiAgdGFyZ2V0PzogVGFyZ2V0O1xufVxuXG4vLyBDcmVhdGUgYSBzZXBhcmF0ZSBpbnN0YW5jZSB0byBwcmV2ZW50IHVuaW50ZW5kZWQgZ2xvYmFsIGNoYW5nZXMgdG8gdGhlIGNvbG9yIGNvbmZpZ3VyYXRpb25cbi8vIENyZWF0ZSBmdW5jdGlvbiBpcyBub3QgZGVmaW5lZCBpbiB0aGUgdHlwaW5ncy4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZG9vd2IvYW5zaS1jb2xvcnMvcHVsbC80NFxuY29uc3QgY29sb3JzID0gKGFuc2lDb2xvcnMgYXMgdHlwZW9mIGFuc2lDb2xvcnMgJiB7IGNyZWF0ZTogKCkgPT4gdHlwZW9mIGFuc2lDb2xvcnMgfSkuY3JlYXRlKCk7XG5cbmFzeW5jIGZ1bmN0aW9uIF9leGVjdXRlVGFyZ2V0KFxuICBwYXJlbnRMb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyLFxuICB3b3Jrc3BhY2U6IHdvcmtzcGFjZXMuV29ya3NwYWNlRGVmaW5pdGlvbixcbiAgcm9vdDogc3RyaW5nLFxuICBhcmd2OiB5YXJnc1BhcnNlci5Bcmd1bWVudHMsXG4gIHJlZ2lzdHJ5OiBzY2hlbWEuU2NoZW1hUmVnaXN0cnksXG4pIHtcbiAgY29uc3QgYXJjaGl0ZWN0SG9zdCA9IG5ldyBXb3Jrc3BhY2VOb2RlTW9kdWxlc0FyY2hpdGVjdEhvc3Qod29ya3NwYWNlLCByb290KTtcbiAgY29uc3QgYXJjaGl0ZWN0ID0gbmV3IEFyY2hpdGVjdChhcmNoaXRlY3RIb3N0LCByZWdpc3RyeSk7XG5cbiAgLy8gU3BsaXQgYSB0YXJnZXQgaW50byBpdHMgcGFydHMuXG4gIGNvbnN0IHtcbiAgICBfOiBbdGFyZ2V0U3RyID0gJyddLFxuICAgIGhlbHAsXG4gICAgLi4ub3B0aW9uc1xuICB9ID0gYXJndjtcbiAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSB0YXJnZXRTdHIudG9TdHJpbmcoKS5zcGxpdCgnOicpO1xuICBjb25zdCB0YXJnZXRTcGVjID0geyBwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb24gfTtcblxuICBjb25zdCBsb2dnZXIgPSBuZXcgbG9nZ2luZy5Mb2dnZXIoJ2pvYnMnKTtcbiAgY29uc3QgbG9nczogbG9nZ2luZy5Mb2dFbnRyeVtdID0gW107XG4gIGxvZ2dlci5zdWJzY3JpYmUoKGVudHJ5KSA9PiBsb2dzLnB1c2goeyAuLi5lbnRyeSwgbWVzc2FnZTogYCR7ZW50cnkubmFtZX06IGAgKyBlbnRyeS5tZXNzYWdlIH0pKTtcblxuICAvLyBDYW1lbGl6ZSBvcHRpb25zIGFzIHlhcmdzIHdpbGwgcmV0dXJuIHRoZSBvYmplY3QgaW4ga2ViYWItY2FzZSB3aGVuIGNhbWVsIGNhc2luZyBpcyBkaXNhYmxlZC5cbiAgY29uc3QgY2FtZWxDYXNlZE9wdGlvbnM6IGpzb24uSnNvbk9iamVjdCA9IHt9O1xuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zKSkge1xuICAgIGlmICgvW0EtWl0vLnRlc3Qoa2V5KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGFyZ3VtZW50ICR7a2V5fS4gRGlkIHlvdSBtZWFuICR7ZGVjYW1lbGl6ZShrZXkpfT9gKTtcbiAgICB9XG5cbiAgICBjYW1lbENhc2VkT3B0aW9uc1tjYW1lbENhc2Uoa2V5KV0gPSB2YWx1ZTtcbiAgfVxuXG4gIGNvbnN0IHJ1biA9IGF3YWl0IGFyY2hpdGVjdC5zY2hlZHVsZVRhcmdldCh0YXJnZXRTcGVjLCBjYW1lbENhc2VkT3B0aW9ucywgeyBsb2dnZXIgfSk7XG4gIGNvbnN0IGJhcnMgPSBuZXcgTXVsdGlQcm9ncmVzc0JhcjxudW1iZXIsIEJhckluZm8+KCc6bmFtZSA6YmFyICg6Y3VycmVudC86dG90YWwpIDpzdGF0dXMnKTtcblxuICBydW4ucHJvZ3Jlc3Muc3Vic2NyaWJlKCh1cGRhdGUpID0+IHtcbiAgICBjb25zdCBkYXRhID0gYmFycy5nZXQodXBkYXRlLmlkKSB8fCB7XG4gICAgICBpZDogdXBkYXRlLmlkLFxuICAgICAgYnVpbGRlcjogdXBkYXRlLmJ1aWxkZXIsXG4gICAgICB0YXJnZXQ6IHVwZGF0ZS50YXJnZXQsXG4gICAgICBzdGF0dXM6IHVwZGF0ZS5zdGF0dXMgfHwgJycsXG4gICAgICBuYW1lOiAoXG4gICAgICAgICh1cGRhdGUudGFyZ2V0ID8gX3RhcmdldFN0cmluZ0Zyb21UYXJnZXQodXBkYXRlLnRhcmdldCkgOiB1cGRhdGUuYnVpbGRlci5uYW1lKSArXG4gICAgICAgICcgJy5yZXBlYXQoODApXG4gICAgICApLnN1YnN0cmluZygwLCA0MCksXG4gICAgfTtcblxuICAgIGlmICh1cGRhdGUuc3RhdHVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGRhdGEuc3RhdHVzID0gdXBkYXRlLnN0YXR1cztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHVwZGF0ZS5zdGF0ZSkge1xuICAgICAgY2FzZSBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5FcnJvcjpcbiAgICAgICAgZGF0YS5zdGF0dXMgPSAnRXJyb3I6ICcgKyB1cGRhdGUuZXJyb3I7XG4gICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLlN0b3BwZWQ6XG4gICAgICAgIGRhdGEuc3RhdHVzID0gJ0RvbmUuJztcbiAgICAgICAgYmFycy5jb21wbGV0ZSh1cGRhdGUuaWQpO1xuICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEsIHVwZGF0ZS50b3RhbCwgdXBkYXRlLnRvdGFsKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuV2FpdGluZzpcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuUnVubmluZzpcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhLCB1cGRhdGUuY3VycmVudCwgdXBkYXRlLnRvdGFsKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYmFycy5yZW5kZXIoKTtcbiAgfSk7XG5cbiAgLy8gV2FpdCBmb3IgZnVsbCBjb21wbGV0aW9uIG9mIHRoZSBidWlsZGVyLlxuICB0cnkge1xuICAgIGNvbnN0IHsgc3VjY2VzcyB9ID0gYXdhaXQgcnVuLm91dHB1dFxuICAgICAgLnBpcGUoXG4gICAgICAgIHRhcCgocmVzdWx0KSA9PiB7XG4gICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbyhjb2xvcnMuZ3JlZW4oJ1NVQ0NFU1MnKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKGNvbG9ycy5yZWQoJ0ZBSUxVUkUnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKCdSZXN1bHQ6ICcgKyBKU09OLnN0cmluZ2lmeSh7IC4uLnJlc3VsdCwgaW5mbzogdW5kZWZpbmVkIH0sIG51bGwsIDQpKTtcblxuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKCdcXG5Mb2dzOicpO1xuICAgICAgICAgIGxvZ3MuZm9yRWFjaCgobCkgPT4gcGFyZW50TG9nZ2VyLm5leHQobCkpO1xuICAgICAgICAgIGxvZ3Muc3BsaWNlKDApO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC50b1Byb21pc2UoKTtcblxuICAgIGF3YWl0IHJ1bi5zdG9wKCk7XG4gICAgYmFycy50ZXJtaW5hdGUoKTtcblxuICAgIHJldHVybiBzdWNjZXNzID8gMCA6IDE7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHBhcmVudExvZ2dlci5pbmZvKGNvbG9ycy5yZWQoJ0VSUk9SJykpO1xuICAgIHBhcmVudExvZ2dlci5pbmZvKCdcXG5Mb2dzOicpO1xuICAgIGxvZ3MuZm9yRWFjaCgobCkgPT4gcGFyZW50TG9nZ2VyLm5leHQobCkpO1xuXG4gICAgcGFyZW50TG9nZ2VyLmZhdGFsKCdFeGNlcHRpb246Jyk7XG4gICAgcGFyZW50TG9nZ2VyLmZhdGFsKChlcnIgaW5zdGFuY2VvZiBFcnJvciAmJiBlcnIuc3RhY2spIHx8IGAke2Vycn1gKTtcblxuICAgIHJldHVybiAyO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG1haW4oYXJnczogc3RyaW5nW10pOiBQcm9taXNlPG51bWJlcj4ge1xuICAvKiogUGFyc2UgdGhlIGNvbW1hbmQgbGluZS4gKi9cbiAgY29uc3QgYXJndiA9IHlhcmdzUGFyc2VyKGFyZ3MsIHtcbiAgICBib29sZWFuOiBbJ2hlbHAnXSxcbiAgICBjb25maWd1cmF0aW9uOiB7XG4gICAgICAnZG90LW5vdGF0aW9uJzogZmFsc2UsXG4gICAgICAnYm9vbGVhbi1uZWdhdGlvbic6IHRydWUsXG4gICAgICAnc3RyaXAtYWxpYXNlZCc6IHRydWUsXG4gICAgICAnY2FtZWwtY2FzZS1leHBhbnNpb24nOiBmYWxzZSxcbiAgICB9LFxuICB9KTtcblxuICAvKiogQ3JlYXRlIHRoZSBEZXZLaXQgTG9nZ2VyIHVzZWQgdGhyb3VnaCB0aGUgQ0xJLiAqL1xuICBjb25zdCBsb2dnZXIgPSBjcmVhdGVDb25zb2xlTG9nZ2VyKGFyZ3ZbJ3ZlcmJvc2UnXSwgcHJvY2Vzcy5zdGRvdXQsIHByb2Nlc3Muc3RkZXJyLCB7XG4gICAgaW5mbzogKHMpID0+IHMsXG4gICAgZGVidWc6IChzKSA9PiBzLFxuICAgIHdhcm46IChzKSA9PiBjb2xvcnMuYm9sZC55ZWxsb3cocyksXG4gICAgZXJyb3I6IChzKSA9PiBjb2xvcnMuYm9sZC5yZWQocyksXG4gICAgZmF0YWw6IChzKSA9PiBjb2xvcnMuYm9sZC5yZWQocyksXG4gIH0pO1xuXG4gIC8vIENoZWNrIHRoZSB0YXJnZXQuXG4gIGNvbnN0IHRhcmdldFN0ciA9IGFyZ3YuX1swXSB8fCAnJztcbiAgaWYgKCF0YXJnZXRTdHIgfHwgYXJndi5oZWxwKSB7XG4gICAgLy8gU2hvdyBhcmNoaXRlY3QgdXNhZ2UgaWYgdGhlcmUncyBubyB0YXJnZXQuXG4gICAgdXNhZ2UobG9nZ2VyKTtcbiAgfVxuXG4gIC8vIExvYWQgd29ya3NwYWNlIGNvbmZpZ3VyYXRpb24gZmlsZS5cbiAgY29uc3QgY3VycmVudFBhdGggPSBwcm9jZXNzLmN3ZCgpO1xuICBjb25zdCBjb25maWdGaWxlTmFtZXMgPSBbJ2FuZ3VsYXIuanNvbicsICcuYW5ndWxhci5qc29uJywgJ3dvcmtzcGFjZS5qc29uJywgJy53b3Jrc3BhY2UuanNvbiddO1xuXG4gIGNvbnN0IGNvbmZpZ0ZpbGVQYXRoID0gZmluZFVwKGNvbmZpZ0ZpbGVOYW1lcywgY3VycmVudFBhdGgpO1xuXG4gIGlmICghY29uZmlnRmlsZVBhdGgpIHtcbiAgICBsb2dnZXIuZmF0YWwoXG4gICAgICBgV29ya3NwYWNlIGNvbmZpZ3VyYXRpb24gZmlsZSAoJHtjb25maWdGaWxlTmFtZXMuam9pbignLCAnKX0pIGNhbm5vdCBiZSBmb3VuZCBpbiBgICtcbiAgICAgICAgYCcke2N1cnJlbnRQYXRofScgb3IgaW4gcGFyZW50IGRpcmVjdG9yaWVzLmAsXG4gICAgKTtcblxuICAgIHJldHVybiAzO1xuICB9XG5cbiAgY29uc3Qgcm9vdCA9IHBhdGguZGlybmFtZShjb25maWdGaWxlUGF0aCk7XG5cbiAgY29uc3QgcmVnaXN0cnkgPSBuZXcgc2NoZW1hLkNvcmVTY2hlbWFSZWdpc3RyeSgpO1xuICByZWdpc3RyeS5hZGRQb3N0VHJhbnNmb3JtKHNjaGVtYS50cmFuc2Zvcm1zLmFkZFVuZGVmaW5lZERlZmF1bHRzKTtcblxuICAvLyBTaG93IHVzYWdlIG9mIGRlcHJlY2F0ZWQgb3B0aW9uc1xuICByZWdpc3RyeS51c2VYRGVwcmVjYXRlZFByb3ZpZGVyKChtc2cpID0+IGxvZ2dlci53YXJuKG1zZykpO1xuXG4gIGNvbnN0IHsgd29ya3NwYWNlIH0gPSBhd2FpdCB3b3Jrc3BhY2VzLnJlYWRXb3Jrc3BhY2UoXG4gICAgY29uZmlnRmlsZVBhdGgsXG4gICAgd29ya3NwYWNlcy5jcmVhdGVXb3Jrc3BhY2VIb3N0KG5ldyBOb2RlSnNTeW5jSG9zdCgpKSxcbiAgKTtcblxuICAvLyBDbGVhciB0aGUgY29uc29sZS5cbiAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoJ1xcdTAwMUJjJyk7XG5cbiAgcmV0dXJuIGF3YWl0IF9leGVjdXRlVGFyZ2V0KGxvZ2dlciwgd29ya3NwYWNlLCByb290LCBhcmd2LCByZWdpc3RyeSk7XG59XG5cbm1haW4ocHJvY2Vzcy5hcmd2LnNsaWNlKDIpKS50aGVuKFxuICAoY29kZSkgPT4ge1xuICAgIHByb2Nlc3MuZXhpdChjb2RlKTtcbiAgfSxcbiAgKGVycikgPT4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgY29uc29sZS5lcnJvcignRXJyb3I6ICcgKyBlcnIuc3RhY2sgfHwgZXJyLm1lc3NhZ2UgfHwgZXJyKTtcbiAgICBwcm9jZXNzLmV4aXQoLTEpO1xuICB9LFxuKTtcbiJdfQ==