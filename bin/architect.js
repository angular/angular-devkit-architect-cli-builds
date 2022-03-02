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
const path = __importStar(require("path"));
const operators_1 = require("rxjs/operators");
const yargs_parser_1 = __importDefault(require("yargs-parser"));
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
    const [project, target, configuration] = targetStr.split(':');
    const targetSpec = { project, target, configuration };
    const logger = new core_1.logging.Logger('jobs');
    const logs = [];
    logger.subscribe((entry) => logs.push({ ...entry, message: `${entry.name}: ` + entry.message }));
    // Camelize options as yargs will return the object in kebab-case when camel casing is disabled.
    // Casting temporary until https://github.com/DefinitelyTyped/DefinitelyTyped/pull/59065 is merged and released.
    const { camelCase, decamelize } = yargs_parser_1.default;
    const camelCasedOptions = {};
    for (const [key, value] of Object.entries(options)) {
        if (/[A-Z]/.test(key)) {
            throw new Error(`Unknown argument ${key}. Did you mean ${decamelize(key)}?`);
        }
        camelCasedOptions[camelCase(key)] = value;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjaGl0ZWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYXJjaGl0ZWN0X2NsaS9iaW4vYXJjaGl0ZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBaUc7QUFDakcseURBQW1GO0FBQ25GLCtDQUErRTtBQUMvRSxvREFBZ0Y7QUFDaEYsd0RBQTBDO0FBQzFDLDJCQUFnQztBQUNoQywyQ0FBNkI7QUFDN0IsOENBQXFDO0FBQ3JDLGdFQUF1QztBQUN2Qyw4Q0FBbUQ7QUFFbkQsU0FBUyxNQUFNLENBQUMsS0FBd0IsRUFBRSxJQUFZO0lBQ3BELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2pCO0lBQ0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFFbkMsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLE9BQU8sVUFBVSxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDeEMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdEMsSUFBSSxJQUFBLGVBQVUsRUFBQyxDQUFDLENBQUMsRUFBRTtnQkFDakIsT0FBTyxDQUFDLENBQUM7YUFDVjtTQUNGO1FBRUQsVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDdkM7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsS0FBSyxDQUFDLE1BQXNCLEVB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QUNqRCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsYUFBTSxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBRWxFLG1DQUFtQztJQUNuQyxRQUFRLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUUzRCxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsTUFBTSxpQkFBVSxDQUFDLGFBQWEsQ0FDbEQsY0FBYyxFQUNkLGlCQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxxQkFBYyxFQUFFLENBQUMsQ0FDckQsQ0FBQztJQUVGLHFCQUFxQjtJQUNyQixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUVoQyxPQUFPLE1BQU0sY0FBYyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztBQUN2RSxDQUFDO0FBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUM5QixDQUFDLElBQUksRUFBRSxFQUFFO0lBQ1AsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQixDQUFDLEVBQ0QsQ0FBQyxHQUFHLEVBQUUsRUFBRTtJQUNOLHNDQUFzQztJQUN0QyxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxJQUFJLEdBQUcsQ0FBQyxPQUFPLElBQUksR0FBRyxDQUFDLENBQUM7SUFDM0QsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25CLENBQUMsQ0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEFyY2hpdGVjdCwgQnVpbGRlckluZm8sIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLCBUYXJnZXQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFdvcmtzcGFjZU5vZGVNb2R1bGVzQXJjaGl0ZWN0SG9zdCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3Qvbm9kZSc7XG5pbXBvcnQgeyBqc29uLCBsb2dnaW5nLCBzY2hlbWEsIHRhZ3MsIHdvcmtzcGFjZXMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBOb2RlSnNTeW5jSG9zdCwgY3JlYXRlQ29uc29sZUxvZ2dlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlL25vZGUnO1xuaW1wb3J0ICogYXMgYW5zaUNvbG9ycyBmcm9tICdhbnNpLWNvbG9ycyc7XG5pbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB5YXJnc1BhcnNlciBmcm9tICd5YXJncy1wYXJzZXInO1xuaW1wb3J0IHsgTXVsdGlQcm9ncmVzc0JhciB9IGZyb20gJy4uL3NyYy9wcm9ncmVzcyc7XG5cbmZ1bmN0aW9uIGZpbmRVcChuYW1lczogc3RyaW5nIHwgc3RyaW5nW10sIGZyb206IHN0cmluZykge1xuICBpZiAoIUFycmF5LmlzQXJyYXkobmFtZXMpKSB7XG4gICAgbmFtZXMgPSBbbmFtZXNdO1xuICB9XG4gIGNvbnN0IHJvb3QgPSBwYXRoLnBhcnNlKGZyb20pLnJvb3Q7XG5cbiAgbGV0IGN1cnJlbnREaXIgPSBmcm9tO1xuICB3aGlsZSAoY3VycmVudERpciAmJiBjdXJyZW50RGlyICE9PSByb290KSB7XG4gICAgZm9yIChjb25zdCBuYW1lIG9mIG5hbWVzKSB7XG4gICAgICBjb25zdCBwID0gcGF0aC5qb2luKGN1cnJlbnREaXIsIG5hbWUpO1xuICAgICAgaWYgKGV4aXN0c1N5bmMocCkpIHtcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY3VycmVudERpciA9IHBhdGguZGlybmFtZShjdXJyZW50RGlyKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFNob3cgdXNhZ2Ugb2YgdGhlIENMSSB0b29sLCBhbmQgZXhpdCB0aGUgcHJvY2Vzcy5cbiAqL1xuZnVuY3Rpb24gdXNhZ2UobG9nZ2VyOiBsb2dnaW5nLkxvZ2dlciwgZXhpdENvZGUgPSAwKTogbmV2ZXIge1xuICBsb2dnZXIuaW5mbyh0YWdzLnN0cmlwSW5kZW50YFxuICAgIGFyY2hpdGVjdCBbcHJvamVjdF1bOnRhcmdldF1bOmNvbmZpZ3VyYXRpb25dIFtvcHRpb25zLCAuLi5dXG5cbiAgICBSdW4gYSBwcm9qZWN0IHRhcmdldC5cbiAgICBJZiBwcm9qZWN0L3RhcmdldC9jb25maWd1cmF0aW9uIGFyZSBub3Qgc3BlY2lmaWVkLCB0aGUgd29ya3NwYWNlIGRlZmF1bHRzIHdpbGwgYmUgdXNlZC5cblxuICAgIE9wdGlvbnM6XG4gICAgICAgIC0taGVscCAgICAgICAgICAgICAgU2hvdyBhdmFpbGFibGUgb3B0aW9ucyBmb3IgcHJvamVjdCB0YXJnZXQuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgU2hvd3MgdGhpcyBtZXNzYWdlIGluc3RlYWQgd2hlbiByYW4gd2l0aG91dCB0aGUgcnVuIGFyZ3VtZW50LlxuXG5cbiAgICBBbnkgYWRkaXRpb25hbCBvcHRpb24gaXMgcGFzc2VkIHRoZSB0YXJnZXQsIG92ZXJyaWRpbmcgZXhpc3Rpbmcgb3B0aW9ucy5cbiAgYCk7XG5cbiAgcmV0dXJuIHByb2Nlc3MuZXhpdChleGl0Q29kZSk7XG59XG5cbmZ1bmN0aW9uIF90YXJnZXRTdHJpbmdGcm9tVGFyZ2V0KHsgcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uIH06IFRhcmdldCkge1xuICByZXR1cm4gYCR7cHJvamVjdH06JHt0YXJnZXR9JHtjb25maWd1cmF0aW9uICE9PSB1bmRlZmluZWQgPyAnOicgKyBjb25maWd1cmF0aW9uIDogJyd9YDtcbn1cblxuaW50ZXJmYWNlIEJhckluZm8ge1xuICBzdGF0dXM/OiBzdHJpbmc7XG4gIGJ1aWxkZXI6IEJ1aWxkZXJJbmZvO1xuICB0YXJnZXQ/OiBUYXJnZXQ7XG59XG5cbi8vIENyZWF0ZSBhIHNlcGFyYXRlIGluc3RhbmNlIHRvIHByZXZlbnQgdW5pbnRlbmRlZCBnbG9iYWwgY2hhbmdlcyB0byB0aGUgY29sb3IgY29uZmlndXJhdGlvblxuLy8gQ3JlYXRlIGZ1bmN0aW9uIGlzIG5vdCBkZWZpbmVkIGluIHRoZSB0eXBpbmdzLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9kb293Yi9hbnNpLWNvbG9ycy9wdWxsLzQ0XG5jb25zdCBjb2xvcnMgPSAoYW5zaUNvbG9ycyBhcyB0eXBlb2YgYW5zaUNvbG9ycyAmIHsgY3JlYXRlOiAoKSA9PiB0eXBlb2YgYW5zaUNvbG9ycyB9KS5jcmVhdGUoKTtcblxuYXN5bmMgZnVuY3Rpb24gX2V4ZWN1dGVUYXJnZXQoXG4gIHBhcmVudExvZ2dlcjogbG9nZ2luZy5Mb2dnZXIsXG4gIHdvcmtzcGFjZTogd29ya3NwYWNlcy5Xb3Jrc3BhY2VEZWZpbml0aW9uLFxuICByb290OiBzdHJpbmcsXG4gIGFyZ3Y6IHlhcmdzUGFyc2VyLkFyZ3VtZW50cyxcbiAgcmVnaXN0cnk6IHNjaGVtYS5TY2hlbWFSZWdpc3RyeSxcbikge1xuICBjb25zdCBhcmNoaXRlY3RIb3N0ID0gbmV3IFdvcmtzcGFjZU5vZGVNb2R1bGVzQXJjaGl0ZWN0SG9zdCh3b3Jrc3BhY2UsIHJvb3QpO1xuICBjb25zdCBhcmNoaXRlY3QgPSBuZXcgQXJjaGl0ZWN0KGFyY2hpdGVjdEhvc3QsIHJlZ2lzdHJ5KTtcblxuICAvLyBTcGxpdCBhIHRhcmdldCBpbnRvIGl0cyBwYXJ0cy5cbiAgY29uc3Qge1xuICAgIF86IFt0YXJnZXRTdHIgPSAnJ10sXG4gICAgaGVscCxcbiAgICAuLi5vcHRpb25zXG4gIH0gPSBhcmd2O1xuICBjb25zdCBbcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uXSA9IHRhcmdldFN0ci5zcGxpdCgnOicpO1xuICBjb25zdCB0YXJnZXRTcGVjID0geyBwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb24gfTtcblxuICBjb25zdCBsb2dnZXIgPSBuZXcgbG9nZ2luZy5Mb2dnZXIoJ2pvYnMnKTtcbiAgY29uc3QgbG9nczogbG9nZ2luZy5Mb2dFbnRyeVtdID0gW107XG4gIGxvZ2dlci5zdWJzY3JpYmUoKGVudHJ5KSA9PiBsb2dzLnB1c2goeyAuLi5lbnRyeSwgbWVzc2FnZTogYCR7ZW50cnkubmFtZX06IGAgKyBlbnRyeS5tZXNzYWdlIH0pKTtcblxuICAvLyBDYW1lbGl6ZSBvcHRpb25zIGFzIHlhcmdzIHdpbGwgcmV0dXJuIHRoZSBvYmplY3QgaW4ga2ViYWItY2FzZSB3aGVuIGNhbWVsIGNhc2luZyBpcyBkaXNhYmxlZC5cblxuICAvLyBDYXN0aW5nIHRlbXBvcmFyeSB1bnRpbCBodHRwczovL2dpdGh1Yi5jb20vRGVmaW5pdGVseVR5cGVkL0RlZmluaXRlbHlUeXBlZC9wdWxsLzU5MDY1IGlzIG1lcmdlZCBhbmQgcmVsZWFzZWQuXG4gIGNvbnN0IHsgY2FtZWxDYXNlLCBkZWNhbWVsaXplIH0gPSB5YXJnc1BhcnNlciBhcyB5YXJnc1BhcnNlci5QYXJzZXIgJiB7XG4gICAgY2FtZWxDYXNlKHN0cjogc3RyaW5nKTogc3RyaW5nO1xuICAgIGRlY2FtZWxpemUoc3RyOiBzdHJpbmcsIGpvaW5TdHJpbmc/OiBzdHJpbmcpOiBzdHJpbmc7XG4gIH07XG5cbiAgY29uc3QgY2FtZWxDYXNlZE9wdGlvbnM6IGpzb24uSnNvbk9iamVjdCA9IHt9O1xuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zKSkge1xuICAgIGlmICgvW0EtWl0vLnRlc3Qoa2V5KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGFyZ3VtZW50ICR7a2V5fS4gRGlkIHlvdSBtZWFuICR7ZGVjYW1lbGl6ZShrZXkpfT9gKTtcbiAgICB9XG5cbiAgICBjYW1lbENhc2VkT3B0aW9uc1tjYW1lbENhc2Uoa2V5KV0gPSB2YWx1ZTtcbiAgfVxuXG4gIGNvbnN0IHJ1biA9IGF3YWl0IGFyY2hpdGVjdC5zY2hlZHVsZVRhcmdldCh0YXJnZXRTcGVjLCBjYW1lbENhc2VkT3B0aW9ucywgeyBsb2dnZXIgfSk7XG4gIGNvbnN0IGJhcnMgPSBuZXcgTXVsdGlQcm9ncmVzc0JhcjxudW1iZXIsIEJhckluZm8+KCc6bmFtZSA6YmFyICg6Y3VycmVudC86dG90YWwpIDpzdGF0dXMnKTtcblxuICBydW4ucHJvZ3Jlc3Muc3Vic2NyaWJlKCh1cGRhdGUpID0+IHtcbiAgICBjb25zdCBkYXRhID0gYmFycy5nZXQodXBkYXRlLmlkKSB8fCB7XG4gICAgICBpZDogdXBkYXRlLmlkLFxuICAgICAgYnVpbGRlcjogdXBkYXRlLmJ1aWxkZXIsXG4gICAgICB0YXJnZXQ6IHVwZGF0ZS50YXJnZXQsXG4gICAgICBzdGF0dXM6IHVwZGF0ZS5zdGF0dXMgfHwgJycsXG4gICAgICBuYW1lOiAoXG4gICAgICAgICh1cGRhdGUudGFyZ2V0ID8gX3RhcmdldFN0cmluZ0Zyb21UYXJnZXQodXBkYXRlLnRhcmdldCkgOiB1cGRhdGUuYnVpbGRlci5uYW1lKSArXG4gICAgICAgICcgJy5yZXBlYXQoODApXG4gICAgICApLnN1YnN0cmluZygwLCA0MCksXG4gICAgfTtcblxuICAgIGlmICh1cGRhdGUuc3RhdHVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGRhdGEuc3RhdHVzID0gdXBkYXRlLnN0YXR1cztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHVwZGF0ZS5zdGF0ZSkge1xuICAgICAgY2FzZSBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5FcnJvcjpcbiAgICAgICAgZGF0YS5zdGF0dXMgPSAnRXJyb3I6ICcgKyB1cGRhdGUuZXJyb3I7XG4gICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLlN0b3BwZWQ6XG4gICAgICAgIGRhdGEuc3RhdHVzID0gJ0RvbmUuJztcbiAgICAgICAgYmFycy5jb21wbGV0ZSh1cGRhdGUuaWQpO1xuICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEsIHVwZGF0ZS50b3RhbCwgdXBkYXRlLnRvdGFsKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuV2FpdGluZzpcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuUnVubmluZzpcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhLCB1cGRhdGUuY3VycmVudCwgdXBkYXRlLnRvdGFsKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYmFycy5yZW5kZXIoKTtcbiAgfSk7XG5cbiAgLy8gV2FpdCBmb3IgZnVsbCBjb21wbGV0aW9uIG9mIHRoZSBidWlsZGVyLlxuICB0cnkge1xuICAgIGNvbnN0IHsgc3VjY2VzcyB9ID0gYXdhaXQgcnVuLm91dHB1dFxuICAgICAgLnBpcGUoXG4gICAgICAgIHRhcCgocmVzdWx0KSA9PiB7XG4gICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbyhjb2xvcnMuZ3JlZW4oJ1NVQ0NFU1MnKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKGNvbG9ycy5yZWQoJ0ZBSUxVUkUnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKCdSZXN1bHQ6ICcgKyBKU09OLnN0cmluZ2lmeSh7IC4uLnJlc3VsdCwgaW5mbzogdW5kZWZpbmVkIH0sIG51bGwsIDQpKTtcblxuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKCdcXG5Mb2dzOicpO1xuICAgICAgICAgIGxvZ3MuZm9yRWFjaCgobCkgPT4gcGFyZW50TG9nZ2VyLm5leHQobCkpO1xuICAgICAgICAgIGxvZ3Muc3BsaWNlKDApO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC50b1Byb21pc2UoKTtcblxuICAgIGF3YWl0IHJ1bi5zdG9wKCk7XG4gICAgYmFycy50ZXJtaW5hdGUoKTtcblxuICAgIHJldHVybiBzdWNjZXNzID8gMCA6IDE7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHBhcmVudExvZ2dlci5pbmZvKGNvbG9ycy5yZWQoJ0VSUk9SJykpO1xuICAgIHBhcmVudExvZ2dlci5pbmZvKCdcXG5Mb2dzOicpO1xuICAgIGxvZ3MuZm9yRWFjaCgobCkgPT4gcGFyZW50TG9nZ2VyLm5leHQobCkpO1xuXG4gICAgcGFyZW50TG9nZ2VyLmZhdGFsKCdFeGNlcHRpb246Jyk7XG4gICAgcGFyZW50TG9nZ2VyLmZhdGFsKGVyci5zdGFjayk7XG5cbiAgICByZXR1cm4gMjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBtYWluKGFyZ3M6IHN0cmluZ1tdKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgLyoqIFBhcnNlIHRoZSBjb21tYW5kIGxpbmUuICovXG4gIGNvbnN0IGFyZ3YgPSB5YXJnc1BhcnNlcihhcmdzLCB7XG4gICAgYm9vbGVhbjogWydoZWxwJ10sXG4gICAgY29uZmlndXJhdGlvbjoge1xuICAgICAgJ2RvdC1ub3RhdGlvbic6IGZhbHNlLFxuICAgICAgJ2Jvb2xlYW4tbmVnYXRpb24nOiB0cnVlLFxuICAgICAgJ3N0cmlwLWFsaWFzZWQnOiB0cnVlLFxuICAgICAgJ2NhbWVsLWNhc2UtZXhwYW5zaW9uJzogZmFsc2UsXG4gICAgfSxcbiAgfSk7XG5cbiAgLyoqIENyZWF0ZSB0aGUgRGV2S2l0IExvZ2dlciB1c2VkIHRocm91Z2ggdGhlIENMSS4gKi9cbiAgY29uc3QgbG9nZ2VyID0gY3JlYXRlQ29uc29sZUxvZ2dlcihhcmd2Wyd2ZXJib3NlJ10sIHByb2Nlc3Muc3Rkb3V0LCBwcm9jZXNzLnN0ZGVyciwge1xuICAgIGluZm86IChzKSA9PiBzLFxuICAgIGRlYnVnOiAocykgPT4gcyxcbiAgICB3YXJuOiAocykgPT4gY29sb3JzLmJvbGQueWVsbG93KHMpLFxuICAgIGVycm9yOiAocykgPT4gY29sb3JzLmJvbGQucmVkKHMpLFxuICAgIGZhdGFsOiAocykgPT4gY29sb3JzLmJvbGQucmVkKHMpLFxuICB9KTtcblxuICAvLyBDaGVjayB0aGUgdGFyZ2V0LlxuICBjb25zdCB0YXJnZXRTdHIgPSBhcmd2Ll9bMF0gfHwgJyc7XG4gIGlmICghdGFyZ2V0U3RyIHx8IGFyZ3YuaGVscCkge1xuICAgIC8vIFNob3cgYXJjaGl0ZWN0IHVzYWdlIGlmIHRoZXJlJ3Mgbm8gdGFyZ2V0LlxuICAgIHVzYWdlKGxvZ2dlcik7XG4gIH1cblxuICAvLyBMb2FkIHdvcmtzcGFjZSBjb25maWd1cmF0aW9uIGZpbGUuXG4gIGNvbnN0IGN1cnJlbnRQYXRoID0gcHJvY2Vzcy5jd2QoKTtcbiAgY29uc3QgY29uZmlnRmlsZU5hbWVzID0gWydhbmd1bGFyLmpzb24nLCAnLmFuZ3VsYXIuanNvbicsICd3b3Jrc3BhY2UuanNvbicsICcud29ya3NwYWNlLmpzb24nXTtcblxuICBjb25zdCBjb25maWdGaWxlUGF0aCA9IGZpbmRVcChjb25maWdGaWxlTmFtZXMsIGN1cnJlbnRQYXRoKTtcblxuICBpZiAoIWNvbmZpZ0ZpbGVQYXRoKSB7XG4gICAgbG9nZ2VyLmZhdGFsKFxuICAgICAgYFdvcmtzcGFjZSBjb25maWd1cmF0aW9uIGZpbGUgKCR7Y29uZmlnRmlsZU5hbWVzLmpvaW4oJywgJyl9KSBjYW5ub3QgYmUgZm91bmQgaW4gYCArXG4gICAgICAgIGAnJHtjdXJyZW50UGF0aH0nIG9yIGluIHBhcmVudCBkaXJlY3Rvcmllcy5gLFxuICAgICk7XG5cbiAgICByZXR1cm4gMztcbiAgfVxuXG4gIGNvbnN0IHJvb3QgPSBwYXRoLmRpcm5hbWUoY29uZmlnRmlsZVBhdGgpO1xuXG4gIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IHNjaGVtYS5Db3JlU2NoZW1hUmVnaXN0cnkoKTtcbiAgcmVnaXN0cnkuYWRkUG9zdFRyYW5zZm9ybShzY2hlbWEudHJhbnNmb3Jtcy5hZGRVbmRlZmluZWREZWZhdWx0cyk7XG5cbiAgLy8gU2hvdyB1c2FnZSBvZiBkZXByZWNhdGVkIG9wdGlvbnNcbiAgcmVnaXN0cnkudXNlWERlcHJlY2F0ZWRQcm92aWRlcigobXNnKSA9PiBsb2dnZXIud2Fybihtc2cpKTtcblxuICBjb25zdCB7IHdvcmtzcGFjZSB9ID0gYXdhaXQgd29ya3NwYWNlcy5yZWFkV29ya3NwYWNlKFxuICAgIGNvbmZpZ0ZpbGVQYXRoLFxuICAgIHdvcmtzcGFjZXMuY3JlYXRlV29ya3NwYWNlSG9zdChuZXcgTm9kZUpzU3luY0hvc3QoKSksXG4gICk7XG5cbiAgLy8gQ2xlYXIgdGhlIGNvbnNvbGUuXG4gIHByb2Nlc3Muc3Rkb3V0LndyaXRlKCdcXHUwMDFCYycpO1xuXG4gIHJldHVybiBhd2FpdCBfZXhlY3V0ZVRhcmdldChsb2dnZXIsIHdvcmtzcGFjZSwgcm9vdCwgYXJndiwgcmVnaXN0cnkpO1xufVxuXG5tYWluKHByb2Nlc3MuYXJndi5zbGljZSgyKSkudGhlbihcbiAgKGNvZGUpID0+IHtcbiAgICBwcm9jZXNzLmV4aXQoY29kZSk7XG4gIH0sXG4gIChlcnIpID0+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yOiAnICsgZXJyLnN0YWNrIHx8IGVyci5tZXNzYWdlIHx8IGVycik7XG4gICAgcHJvY2Vzcy5leGl0KC0xKTtcbiAgfSxcbik7XG4iXX0=