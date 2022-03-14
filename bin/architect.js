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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjaGl0ZWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYXJjaGl0ZWN0X2NsaS9iaW4vYXJjaGl0ZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQWlHO0FBQ2pHLHlEQUFtRjtBQUNuRiwrQ0FBeUU7QUFDekUsb0RBQWdGO0FBQ2hGLHdEQUEwQztBQUMxQywyQkFBZ0M7QUFDaEMsd0RBQWdDO0FBQ2hDLDJDQUE2QjtBQUM3Qiw4Q0FBcUM7QUFDckMsOENBQW1EO0FBRW5ELFNBQVMsTUFBTSxDQUFDLEtBQXdCLEVBQUUsSUFBWTtJQUNwRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUN6QixLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNqQjtJQUNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDO0lBRW5DLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQztJQUN0QixPQUFPLFVBQVUsSUFBSSxVQUFVLEtBQUssSUFBSSxFQUFFO1FBQ3hDLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3hCLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3RDLElBQUksSUFBQSxlQUFVLEVBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ2pCLE9BQU8sQ0FBQyxDQUFDO2FBQ1Y7U0FDRjtRQUVELFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQ3ZDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLEtBQUssQ0FBQyxNQUFz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Q0FBQztBQUN2RSxDQUFDO0FBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUM5QixDQUFDLElBQUksRUFBRSxFQUFFO0lBQ1AsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQixDQUFDLEVBQ0QsQ0FBQyxHQUFHLEVBQUUsRUFBRTtJQUNOLHNDQUFzQztJQUN0QyxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxJQUFJLEdBQUcsQ0FBQyxPQUFPLElBQUksR0FBRyxDQUFDLENBQUM7SUFDM0QsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25CLENBQUMsQ0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEFyY2hpdGVjdCwgQnVpbGRlckluZm8sIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLCBUYXJnZXQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFdvcmtzcGFjZU5vZGVNb2R1bGVzQXJjaGl0ZWN0SG9zdCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3Qvbm9kZSc7XG5pbXBvcnQgeyBsb2dnaW5nLCBzY2hlbWEsIHRhZ3MsIHdvcmtzcGFjZXMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBOb2RlSnNTeW5jSG9zdCwgY3JlYXRlQ29uc29sZUxvZ2dlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlL25vZGUnO1xuaW1wb3J0ICogYXMgYW5zaUNvbG9ycyBmcm9tICdhbnNpLWNvbG9ycyc7XG5pbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IG1pbmltaXN0IGZyb20gJ21pbmltaXN0JztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBNdWx0aVByb2dyZXNzQmFyIH0gZnJvbSAnLi4vc3JjL3Byb2dyZXNzJztcblxuZnVuY3Rpb24gZmluZFVwKG5hbWVzOiBzdHJpbmcgfCBzdHJpbmdbXSwgZnJvbTogc3RyaW5nKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShuYW1lcykpIHtcbiAgICBuYW1lcyA9IFtuYW1lc107XG4gIH1cbiAgY29uc3Qgcm9vdCA9IHBhdGgucGFyc2UoZnJvbSkucm9vdDtcblxuICBsZXQgY3VycmVudERpciA9IGZyb207XG4gIHdoaWxlIChjdXJyZW50RGlyICYmIGN1cnJlbnREaXIgIT09IHJvb3QpIHtcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2YgbmFtZXMpIHtcbiAgICAgIGNvbnN0IHAgPSBwYXRoLmpvaW4oY3VycmVudERpciwgbmFtZSk7XG4gICAgICBpZiAoZXhpc3RzU3luYyhwKSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjdXJyZW50RGlyID0gcGF0aC5kaXJuYW1lKGN1cnJlbnREaXIpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogU2hvdyB1c2FnZSBvZiB0aGUgQ0xJIHRvb2wsIGFuZCBleGl0IHRoZSBwcm9jZXNzLlxuICovXG5mdW5jdGlvbiB1c2FnZShsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyLCBleGl0Q29kZSA9IDApOiBuZXZlciB7XG4gIGxvZ2dlci5pbmZvKHRhZ3Muc3RyaXBJbmRlbnRgXG4gICAgYXJjaGl0ZWN0IFtwcm9qZWN0XVs6dGFyZ2V0XVs6Y29uZmlndXJhdGlvbl0gW29wdGlvbnMsIC4uLl1cblxuICAgIFJ1biBhIHByb2plY3QgdGFyZ2V0LlxuICAgIElmIHByb2plY3QvdGFyZ2V0L2NvbmZpZ3VyYXRpb24gYXJlIG5vdCBzcGVjaWZpZWQsIHRoZSB3b3Jrc3BhY2UgZGVmYXVsdHMgd2lsbCBiZSB1c2VkLlxuXG4gICAgT3B0aW9uczpcbiAgICAgICAgLS1oZWxwICAgICAgICAgICAgICBTaG93IGF2YWlsYWJsZSBvcHRpb25zIGZvciBwcm9qZWN0IHRhcmdldC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBTaG93cyB0aGlzIG1lc3NhZ2UgaW5zdGVhZCB3aGVuIHJhbiB3aXRob3V0IHRoZSBydW4gYXJndW1lbnQuXG5cblxuICAgIEFueSBhZGRpdGlvbmFsIG9wdGlvbiBpcyBwYXNzZWQgdGhlIHRhcmdldCwgb3ZlcnJpZGluZyBleGlzdGluZyBvcHRpb25zLlxuICBgKTtcblxuICByZXR1cm4gcHJvY2Vzcy5leGl0KGV4aXRDb2RlKTtcbn1cblxuZnVuY3Rpb24gX3RhcmdldFN0cmluZ0Zyb21UYXJnZXQoeyBwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb24gfTogVGFyZ2V0KSB7XG4gIHJldHVybiBgJHtwcm9qZWN0fToke3RhcmdldH0ke2NvbmZpZ3VyYXRpb24gIT09IHVuZGVmaW5lZCA/ICc6JyArIGNvbmZpZ3VyYXRpb24gOiAnJ31gO1xufVxuXG5pbnRlcmZhY2UgQmFySW5mbyB7XG4gIHN0YXR1cz86IHN0cmluZztcbiAgYnVpbGRlcjogQnVpbGRlckluZm87XG4gIHRhcmdldD86IFRhcmdldDtcbn1cblxuLy8gQ3JlYXRlIGEgc2VwYXJhdGUgaW5zdGFuY2UgdG8gcHJldmVudCB1bmludGVuZGVkIGdsb2JhbCBjaGFuZ2VzIHRvIHRoZSBjb2xvciBjb25maWd1cmF0aW9uXG4vLyBDcmVhdGUgZnVuY3Rpb24gaXMgbm90IGRlZmluZWQgaW4gdGhlIHR5cGluZ3MuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Rvb3diL2Fuc2ktY29sb3JzL3B1bGwvNDRcbmNvbnN0IGNvbG9ycyA9IChhbnNpQ29sb3JzIGFzIHR5cGVvZiBhbnNpQ29sb3JzICYgeyBjcmVhdGU6ICgpID0+IHR5cGVvZiBhbnNpQ29sb3JzIH0pLmNyZWF0ZSgpO1xuXG5hc3luYyBmdW5jdGlvbiBfZXhlY3V0ZVRhcmdldChcbiAgcGFyZW50TG9nZ2VyOiBsb2dnaW5nLkxvZ2dlcixcbiAgd29ya3NwYWNlOiB3b3Jrc3BhY2VzLldvcmtzcGFjZURlZmluaXRpb24sXG4gIHJvb3Q6IHN0cmluZyxcbiAgYXJndjogbWluaW1pc3QuUGFyc2VkQXJncyxcbiAgcmVnaXN0cnk6IHNjaGVtYS5TY2hlbWFSZWdpc3RyeSxcbikge1xuICBjb25zdCBhcmNoaXRlY3RIb3N0ID0gbmV3IFdvcmtzcGFjZU5vZGVNb2R1bGVzQXJjaGl0ZWN0SG9zdCh3b3Jrc3BhY2UsIHJvb3QpO1xuICBjb25zdCBhcmNoaXRlY3QgPSBuZXcgQXJjaGl0ZWN0KGFyY2hpdGVjdEhvc3QsIHJlZ2lzdHJ5KTtcblxuICAvLyBTcGxpdCBhIHRhcmdldCBpbnRvIGl0cyBwYXJ0cy5cbiAgY29uc3QgdGFyZ2V0U3RyID0gYXJndi5fLnNoaWZ0KCkgfHwgJyc7XG4gIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb25dID0gdGFyZ2V0U3RyLnNwbGl0KCc6Jyk7XG4gIGNvbnN0IHRhcmdldFNwZWMgPSB7IHByb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbiB9O1xuXG4gIGRlbGV0ZSBhcmd2WydoZWxwJ107XG4gIGNvbnN0IGxvZ2dlciA9IG5ldyBsb2dnaW5nLkxvZ2dlcignam9icycpO1xuICBjb25zdCBsb2dzOiBsb2dnaW5nLkxvZ0VudHJ5W10gPSBbXTtcbiAgbG9nZ2VyLnN1YnNjcmliZSgoZW50cnkpID0+IGxvZ3MucHVzaCh7IC4uLmVudHJ5LCBtZXNzYWdlOiBgJHtlbnRyeS5uYW1lfTogYCArIGVudHJ5Lm1lc3NhZ2UgfSkpO1xuXG4gIGNvbnN0IHsgXywgLi4ub3B0aW9ucyB9ID0gYXJndjtcbiAgY29uc3QgcnVuID0gYXdhaXQgYXJjaGl0ZWN0LnNjaGVkdWxlVGFyZ2V0KHRhcmdldFNwZWMsIG9wdGlvbnMsIHsgbG9nZ2VyIH0pO1xuICBjb25zdCBiYXJzID0gbmV3IE11bHRpUHJvZ3Jlc3NCYXI8bnVtYmVyLCBCYXJJbmZvPignOm5hbWUgOmJhciAoOmN1cnJlbnQvOnRvdGFsKSA6c3RhdHVzJyk7XG5cbiAgcnVuLnByb2dyZXNzLnN1YnNjcmliZSgodXBkYXRlKSA9PiB7XG4gICAgY29uc3QgZGF0YSA9IGJhcnMuZ2V0KHVwZGF0ZS5pZCkgfHwge1xuICAgICAgaWQ6IHVwZGF0ZS5pZCxcbiAgICAgIGJ1aWxkZXI6IHVwZGF0ZS5idWlsZGVyLFxuICAgICAgdGFyZ2V0OiB1cGRhdGUudGFyZ2V0LFxuICAgICAgc3RhdHVzOiB1cGRhdGUuc3RhdHVzIHx8ICcnLFxuICAgICAgbmFtZTogKFxuICAgICAgICAodXBkYXRlLnRhcmdldCA/IF90YXJnZXRTdHJpbmdGcm9tVGFyZ2V0KHVwZGF0ZS50YXJnZXQpIDogdXBkYXRlLmJ1aWxkZXIubmFtZSkgK1xuICAgICAgICAnICcucmVwZWF0KDgwKVxuICAgICAgKS5zdWJzdHIoMCwgNDApLFxuICAgIH07XG5cbiAgICBpZiAodXBkYXRlLnN0YXR1cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBkYXRhLnN0YXR1cyA9IHVwZGF0ZS5zdGF0dXM7XG4gICAgfVxuXG4gICAgc3dpdGNoICh1cGRhdGUuc3RhdGUpIHtcbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuRXJyb3I6XG4gICAgICAgIGRhdGEuc3RhdHVzID0gJ0Vycm9yOiAnICsgdXBkYXRlLmVycm9yO1xuICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5TdG9wcGVkOlxuICAgICAgICBkYXRhLnN0YXR1cyA9ICdEb25lLic7XG4gICAgICAgIGJhcnMuY29tcGxldGUodXBkYXRlLmlkKTtcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhLCB1cGRhdGUudG90YWwsIHVwZGF0ZS50b3RhbCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLldhaXRpbmc6XG4gICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLlJ1bm5pbmc6XG4gICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSwgdXBkYXRlLmN1cnJlbnQsIHVwZGF0ZS50b3RhbCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGJhcnMucmVuZGVyKCk7XG4gIH0pO1xuXG4gIC8vIFdhaXQgZm9yIGZ1bGwgY29tcGxldGlvbiBvZiB0aGUgYnVpbGRlci5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN1Y2Nlc3MgfSA9IGF3YWl0IHJ1bi5vdXRwdXRcbiAgICAgIC5waXBlKFxuICAgICAgICB0YXAoKHJlc3VsdCkgPT4ge1xuICAgICAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgcGFyZW50TG9nZ2VyLmluZm8oY29sb3JzLmdyZWVuKCdTVUNDRVNTJykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbyhjb2xvcnMucmVkKCdGQUlMVVJFJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbygnUmVzdWx0OiAnICsgSlNPTi5zdHJpbmdpZnkoeyAuLi5yZXN1bHQsIGluZm86IHVuZGVmaW5lZCB9LCBudWxsLCA0KSk7XG5cbiAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbygnXFxuTG9nczonKTtcbiAgICAgICAgICBsb2dzLmZvckVhY2goKGwpID0+IHBhcmVudExvZ2dlci5uZXh0KGwpKTtcbiAgICAgICAgICBsb2dzLnNwbGljZSgwKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAudG9Qcm9taXNlKCk7XG5cbiAgICBhd2FpdCBydW4uc3RvcCgpO1xuICAgIGJhcnMudGVybWluYXRlKCk7XG5cbiAgICByZXR1cm4gc3VjY2VzcyA/IDAgOiAxO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBwYXJlbnRMb2dnZXIuaW5mbyhjb2xvcnMucmVkKCdFUlJPUicpKTtcbiAgICBwYXJlbnRMb2dnZXIuaW5mbygnXFxuTG9nczonKTtcbiAgICBsb2dzLmZvckVhY2goKGwpID0+IHBhcmVudExvZ2dlci5uZXh0KGwpKTtcblxuICAgIHBhcmVudExvZ2dlci5mYXRhbCgnRXhjZXB0aW9uOicpO1xuICAgIHBhcmVudExvZ2dlci5mYXRhbChlcnIuc3RhY2spO1xuXG4gICAgcmV0dXJuIDI7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gbWFpbihhcmdzOiBzdHJpbmdbXSk6IFByb21pc2U8bnVtYmVyPiB7XG4gIC8qKiBQYXJzZSB0aGUgY29tbWFuZCBsaW5lLiAqL1xuICBjb25zdCBhcmd2ID0gbWluaW1pc3QoYXJncywgeyBib29sZWFuOiBbJ2hlbHAnXSB9KTtcblxuICAvKiogQ3JlYXRlIHRoZSBEZXZLaXQgTG9nZ2VyIHVzZWQgdGhyb3VnaCB0aGUgQ0xJLiAqL1xuICBjb25zdCBsb2dnZXIgPSBjcmVhdGVDb25zb2xlTG9nZ2VyKGFyZ3ZbJ3ZlcmJvc2UnXSwgcHJvY2Vzcy5zdGRvdXQsIHByb2Nlc3Muc3RkZXJyLCB7XG4gICAgaW5mbzogKHMpID0+IHMsXG4gICAgZGVidWc6IChzKSA9PiBzLFxuICAgIHdhcm46IChzKSA9PiBjb2xvcnMuYm9sZC55ZWxsb3cocyksXG4gICAgZXJyb3I6IChzKSA9PiBjb2xvcnMuYm9sZC5yZWQocyksXG4gICAgZmF0YWw6IChzKSA9PiBjb2xvcnMuYm9sZC5yZWQocyksXG4gIH0pO1xuXG4gIC8vIENoZWNrIHRoZSB0YXJnZXQuXG4gIGNvbnN0IHRhcmdldFN0ciA9IGFyZ3YuX1swXSB8fCAnJztcbiAgaWYgKCF0YXJnZXRTdHIgfHwgYXJndi5oZWxwKSB7XG4gICAgLy8gU2hvdyBhcmNoaXRlY3QgdXNhZ2UgaWYgdGhlcmUncyBubyB0YXJnZXQuXG4gICAgdXNhZ2UobG9nZ2VyKTtcbiAgfVxuXG4gIC8vIExvYWQgd29ya3NwYWNlIGNvbmZpZ3VyYXRpb24gZmlsZS5cbiAgY29uc3QgY3VycmVudFBhdGggPSBwcm9jZXNzLmN3ZCgpO1xuICBjb25zdCBjb25maWdGaWxlTmFtZXMgPSBbJ2FuZ3VsYXIuanNvbicsICcuYW5ndWxhci5qc29uJywgJ3dvcmtzcGFjZS5qc29uJywgJy53b3Jrc3BhY2UuanNvbiddO1xuXG4gIGNvbnN0IGNvbmZpZ0ZpbGVQYXRoID0gZmluZFVwKGNvbmZpZ0ZpbGVOYW1lcywgY3VycmVudFBhdGgpO1xuXG4gIGlmICghY29uZmlnRmlsZVBhdGgpIHtcbiAgICBsb2dnZXIuZmF0YWwoXG4gICAgICBgV29ya3NwYWNlIGNvbmZpZ3VyYXRpb24gZmlsZSAoJHtjb25maWdGaWxlTmFtZXMuam9pbignLCAnKX0pIGNhbm5vdCBiZSBmb3VuZCBpbiBgICtcbiAgICAgICAgYCcke2N1cnJlbnRQYXRofScgb3IgaW4gcGFyZW50IGRpcmVjdG9yaWVzLmAsXG4gICAgKTtcblxuICAgIHJldHVybiAzO1xuICB9XG5cbiAgY29uc3Qgcm9vdCA9IHBhdGguZGlybmFtZShjb25maWdGaWxlUGF0aCk7XG5cbiAgY29uc3QgcmVnaXN0cnkgPSBuZXcgc2NoZW1hLkNvcmVTY2hlbWFSZWdpc3RyeSgpO1xuICByZWdpc3RyeS5hZGRQb3N0VHJhbnNmb3JtKHNjaGVtYS50cmFuc2Zvcm1zLmFkZFVuZGVmaW5lZERlZmF1bHRzKTtcblxuICAvLyBTaG93IHVzYWdlIG9mIGRlcHJlY2F0ZWQgb3B0aW9uc1xuICByZWdpc3RyeS51c2VYRGVwcmVjYXRlZFByb3ZpZGVyKChtc2cpID0+IGxvZ2dlci53YXJuKG1zZykpO1xuXG4gIGNvbnN0IHsgd29ya3NwYWNlIH0gPSBhd2FpdCB3b3Jrc3BhY2VzLnJlYWRXb3Jrc3BhY2UoXG4gICAgY29uZmlnRmlsZVBhdGgsXG4gICAgd29ya3NwYWNlcy5jcmVhdGVXb3Jrc3BhY2VIb3N0KG5ldyBOb2RlSnNTeW5jSG9zdCgpKSxcbiAgKTtcblxuICAvLyBDbGVhciB0aGUgY29uc29sZS5cbiAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoJ1xcdTAwMUJjJyk7XG5cbiAgcmV0dXJuIGF3YWl0IF9leGVjdXRlVGFyZ2V0KGxvZ2dlciwgd29ya3NwYWNlLCByb290LCBhcmd2LCByZWdpc3RyeSk7XG59XG5cbm1haW4ocHJvY2Vzcy5hcmd2LnNsaWNlKDIpKS50aGVuKFxuICAoY29kZSkgPT4ge1xuICAgIHByb2Nlc3MuZXhpdChjb2RlKTtcbiAgfSxcbiAgKGVycikgPT4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgY29uc29sZS5lcnJvcignRXJyb3I6ICcgKyBlcnIuc3RhY2sgfHwgZXJyLm1lc3NhZ2UgfHwgZXJyKTtcbiAgICBwcm9jZXNzLmV4aXQoLTEpO1xuICB9LFxuKTtcbiJdfQ==